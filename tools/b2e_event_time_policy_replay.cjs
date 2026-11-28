'use strict';

const fs = require('node:fs');
const { analyze: analyzeD } = require('../src/analysis/b2d-support-resistance-engine.js');
const { analyze: analyzeE } = require('../src/analysis/b2e-breakout-retest-engine.js');
const { analyze: analyzeBreakoutQuality } = require('../src/analysis/b2e-breakout-quality-engine.js');
const { loadRows, runStructure, FILES, LAG } = require('./b2_historical_replay.cjs');

const WINDOW_BARS = 260;
const STRIDE_BARS = { '1h': 336, '4h': 84, '1d': 14 };
const RETEST_WINDOW_BARS = 20;
const CONFIRMATION_WINDOW_BARS = 3;
const ZONE_SPAN_ATR = 0.15;
const RETEST_BUFFER_ATR = 0.05;
const HORIZONS = [5, 10, 20];
const BREAK_EVENT_TYPES = new Set([
  'INITIAL_BULLISH_BREAK', 'BULLISH_BOS', 'BULLISH_CHOCH',
  'INITIAL_BEARISH_BREAK', 'BEARISH_BOS', 'BEARISH_CHOCH'
]);
const REPORT_PATH = 'b2e_event_time_policy_replay_report.json';

const POLICY_D = {
  version: 'b2d-zone-engine-v1', b2c_engine_version: '2.1.0-b2c',
  b2c_policy_version: 'b2c-state-v2', b2b_engine_version: '2.2.0-b2b',
  b2b_policy_version: 'b2b-swing-sequence-v3',
  b2b_same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
  b2a_engine_version: '2.0.0-b2a', b2a_policy_version: 'b2a-causal-swing-v1',
  b1_contract_version: '1.1.0', b1_validator_version: '1.1.0',
  b1_quality_policy_version: 'b1-quality-policy-2026-11-27-v1',
  finality_safety_lag_ms: LAG, price_equality_policy: 'EXACT_PRICE_V1'
};
const BREAKOUT_QUALITY_POLICY = {
  version: 'b2e-breakout-quality-v1',
  b2e_engine_version: '2.0.0-b2e',
  b2e_policy_version: 'b2e-retest-engine-v1',
  b1_contract_version: '1.1.0', b1_validator_version: '1.1.0',
  b1_quality_policy_version: 'b1-quality-policy-2026-11-27-v1',
  finality_safety_lag_ms: LAG,
  atr_period: 14, volume_lookback: 20, volume_field: 'volume_base',
  volume_expansion_min_ratio: 1.5, range_expansion_min_atr: 1.2,
  directional_body_min_ratio: 0.5, close_location_min: 0.7
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}
function calculateWilderAtr(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period + 1) return null;
  const ranges = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], previousClose = candles[i - 1].close;
    ranges.push(Math.max(c.high - c.low, Math.abs(c.high - previousClose),
      Math.abs(c.low - previousClose)));
  }
  let atr = ranges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let i = period; i < ranges.length; i++) {
    atr = (atr * (period - 1) + ranges[i]) / period;
  }
  return Number.isFinite(atr) && atr > 0 ? atr : null;
}
function deriveEventTimePolicy(atrBeforeBreak, minTouches = 2) {
  if (!Number.isFinite(atrBeforeBreak) || atrBeforeBreak <= 0) return null;
  return {
    version: 'b2d-b2e-event-time-atr-v1',
    zone_span_price: atrBeforeBreak * ZONE_SPAN_ATR,
    retest_buffer_price: atrBeforeBreak * RETEST_BUFFER_ATR,
    zone_span_atr: ZONE_SPAN_ATR,
    retest_buffer_atr: RETEST_BUFFER_ATR,
    min_independent_touches: minTouches
  };
}
function sampleIndices(length, timeframe) {
  const indices = [];
  for (let i = WINDOW_BARS - 1; i < length; i += STRIDE_BARS[timeframe]) indices.push(i);
  if (indices.length && indices[indices.length - 1] !== length - 1) indices.push(length - 1);
  return indices;
}
function resolveLifecycleIndex(lifecycle, rows, timeToIndex) {
  if (lifecycle.status === 'RETEST_SUCCESSFUL' || lifecycle.status === 'RETEST_FAILED') {
    const closeTime = lifecycle.confirmation && lifecycle.confirmation.candle_close_time_ms;
    return Number.isSafeInteger(closeTime) ? rows.findIndex(r => r.close_time_ms === closeTime) : -1;
  }
  if (lifecycle.status === 'RETEST_EXPIRED') {
    const breakoutIndex = timeToIndex.get(lifecycle.breakout_candle_open_time_ms);
    return Number.isInteger(breakoutIndex) ? breakoutIndex + lifecycle.retest_window_bars : -1;
  }
  if (lifecycle.status === 'RETEST_UNRESOLVED') {
    const touchTime = lifecycle.touch && lifecycle.touch.candle_open_time_ms;
    const touchIndex = timeToIndex.get(touchTime);
    return Number.isInteger(touchIndex) ? touchIndex + lifecycle.confirmation_window_bars : -1;
  }
  return -1;
}
function computeForwardOutcomes(rows, resolutionIndex, direction, atr, horizons = HORIZONS) {
  if (!Array.isArray(rows) || !Number.isInteger(resolutionIndex) || resolutionIndex < 0 ||
      resolutionIndex >= rows.length || !['BULLISH', 'BEARISH'].includes(direction) ||
      !Number.isFinite(atr) || atr <= 0) return null;
  const resolutionClose = rows[resolutionIndex].close;
  const sign = direction === 'BULLISH' ? 1 : -1;
  const output = {};
  for (const horizon of horizons) {
    if (resolutionIndex + horizon >= rows.length) {
      output[horizon] = null;
      continue;
    }
    const future = rows.slice(resolutionIndex + 1, resolutionIndex + horizon + 1);
    if (future.length !== horizon) {
      output[horizon] = null;
      continue;
    }
    const finalClose = future[future.length - 1].close;
    const maxHigh = Math.max(...future.map(c => c.high));
    const minLow = Math.min(...future.map(c => c.low));
    const returnAtr = sign * (finalClose - resolutionClose) / atr;
    const favorableAtr = direction === 'BULLISH'
      ? (maxHigh - resolutionClose) / atr : (resolutionClose - minLow) / atr;
    const adverseAtr = direction === 'BULLISH'
      ? (resolutionClose - minLow) / atr : (maxHigh - resolutionClose) / atr;
    output[horizon] = {
      direction_adjusted_return_atr: returnAtr,
      favorable_excursion_atr: favorableAtr,
      adverse_excursion_atr: adverseAtr,
      positive_close: returnAtr > 0,
      move_at_least_0_5_atr: returnAtr >= 0.5,
      adverse_close_at_least_0_5_atr: returnAtr <= -0.5
    };
  }
  return output;
}
function summarize(events, groupKey) {
  const groups = new Map();
  for (const event of events) {
    const key = event[groupKey] || 'UNKNOWN';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  const result = {};
  for (const [key, items] of groups) {
    result[key] = { event_count: items.length, horizons: {} };
    for (const horizon of HORIZONS) {
      const rows = items.map(x => x.forward_outcomes[horizon]).filter(Boolean);
      const returns = rows.map(x => x.direction_adjusted_return_atr);
      const favorable = rows.map(x => x.favorable_excursion_atr);
      const adverse = rows.map(x => x.adverse_excursion_atr);
      result[key].horizons[horizon] = {
        evaluated_count: rows.length,
        median_direction_adjusted_return_atr: percentile(returns, 0.5),
        p25_direction_adjusted_return_atr: percentile(returns, 0.25),
        p75_direction_adjusted_return_atr: percentile(returns, 0.75),
        positive_close_rate: rows.length ? rows.filter(x => x.positive_close).length / rows.length : null,
        median_favorable_excursion_atr: percentile(favorable, 0.5),
        median_adverse_excursion_atr: percentile(adverse, 0.5)
      };
    }
  }
  return result;
}

function runEventTimeLifecycle(rows, symbol, timeframe, candidate) {
  const eventIndex = rows.findIndex(r => r.open_time_ms === candidate.breaking_candle_open_time_ms);
  if (eventIndex < WINDOW_BARS - 1) return { status: 'SKIPPED', reason: 'INSUFFICIENT_PRE_EVENT_HISTORY' };
  const endIndex = Math.min(rows.length - 1, eventIndex + RETEST_WINDOW_BARS + CONFIRMATION_WINDOW_BARS);
  const extendedRows = rows.slice(eventIndex - WINDOW_BARS + 1, endIndex + 1);
  const eventRelativeIndex = WINDOW_BARS - 1;
  const atrBeforeBreak = calculateWilderAtr(extendedRows.slice(0, eventRelativeIndex));
  const eventPolicy = deriveEventTimePolicy(atrBeforeBreak);
  if (!eventPolicy) return { status: 'SKIPPED', reason: 'ATR_BEFORE_BREAK_UNAVAILABLE' };

  const final = extendedRows[extendedRows.length - 1];
  const asOf = final.close_time_ms + LAG;
  const structure = runStructure(extendedRows, symbol, timeframe, asOf,
    ['event-time-policy', symbol, timeframe, candidate.event_id].join(':'));
  const event = structure.c.events.find(e =>
    e.event_id === candidate.event_id ||
    (e.event_type === candidate.event_type &&
     e.breaking_candle_open_time_ms === candidate.breaking_candle_open_time_ms &&
     e.source_pivot_id === candidate.source_pivot_id));
  if (!event) return { status: 'SKIPPED', reason: 'EVENT_NOT_RECONSTRUCTED' };

  const eventStructure = {
    ...structure,
    c: { ...structure.c, events: [event] }
  };
  const timeframePriceScale = median(extendedRows.map(c => c.close));
  const zonePolicy = {
    version: eventPolicy.version,
    instrument_symbol: symbol,
    timeframe,
    cluster_method: 'MAX_TOTAL_SPAN_V1',
    max_cluster_span_price: eventPolicy.zone_span_price,
    min_independent_touches: eventPolicy.min_independent_touches
  };
  const d = analyzeD({
    policy: POLICY_D, zone_policy: zonePolicy,
    snapshot: eventStructure.snapshot, quality_report: eventStructure.quality,
    b2c_result: eventStructure.c, analysis_as_of_ms: asOf, timeframe
  });
  if (d.status !== 'VALID') return {
    status: 'SKIPPED', reason: 'B2D_BLOCKED',
    details: d.admission && d.admission.reasons
  };
  const retestPolicy = {
    version: 'retest-policy-event-time-atr-v1',
    touch_method: 'RANGE_INTERSECTION_V1',
    touch_tolerance_price: eventPolicy.retest_buffer_price,
    success_buffer_price: eventPolicy.retest_buffer_price,
    failure_buffer_price: eventPolicy.retest_buffer_price,
    retest_window_bars: RETEST_WINDOW_BARS,
    confirmation_window_bars: CONFIRMATION_WINDOW_BARS
  };
  const policyE = {
    version: 'b2e-retest-engine-v1',
    b2b_engine_version: '2.2.0-b2b',
    b2b_policy_version: 'b2b-swing-sequence-v3',
    b2b_same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
    b2c_engine_version: '2.1.0-b2c',
    b2c_policy_version: 'b2c-state-v2',
    b2d_engine_version: '2.0.0-b2d',
    b2d_policy_version: 'b2d-zone-engine-v1',
    b2d_zone_policy_version: zonePolicy.version,
    b1_contract_version: '1.1.0',
    b1_validator_version: '1.1.0',
    b1_quality_policy_version: 'b1-quality-policy-2026-11-27-v1',
    finality_safety_lag_ms: LAG,
    price_equality_policy: 'EXACT_PRICE_V1',
    retest_policy: retestPolicy
  };
  const e = analyzeE({
    policy: policyE,
    snapshot: eventStructure.snapshot,
    quality_report: eventStructure.quality,
    b2c_result: eventStructure.c,
    b2d_result: d,
    analysis_as_of_ms: asOf,
    timeframe
  });
  if (e.status !== 'VALID') return {
    status: 'SKIPPED', reason: 'B2E_BLOCKED',
    details: e.admission && e.admission.reasons
  };
  const lifecycle = e.lifecycles.find(l => l.breakout_event_id === event.event_id ||
    (l.breakout_candle_open_time_ms === event.breaking_candle_open_time_ms && l.direction === event.direction));
  if (!lifecycle) return {
    status: 'UNMATCHED',
    reason: e.unmatched_breakouts.find(x => x.breakout_event_id === event.event_id)?.reason || 'NO_B2E_LIFECYCLE',
    unmatched: e.unmatched_breakouts.find(x => x.breakout_event_id === event.event_id) || null,
    event, atr_before_break: atrBeforeBreak, event_policy: eventPolicy
  };
  const quality = analyzeBreakoutQuality({
    policy: BREAKOUT_QUALITY_POLICY,
    snapshot: eventStructure.snapshot,
    quality_report: eventStructure.quality,
    b2e_result: e,
    analysis_as_of_ms: asOf,
    timeframe
  });
  if (quality.status !== 'VALID') return { status: 'SKIPPED', reason: 'QUALITY_BLOCKED' };
  const qualityItem = quality.breakouts.find(item =>
    item.breakout_candle_open_time_ms === event.breaking_candle_open_time_ms &&
    item.direction === event.direction);
  return {
    status: 'MATCHED',
    event,
    lifecycle,
    quality: qualityItem || null,
    atr_before_break: atrBeforeBreak,
    event_policy: eventPolicy,
    snapshot_as_of_ms: asOf
  };
}

async function replaySeries(symbol, timeframe, file) {
  const loaded = await loadRows(file, timeframe);
  const rows = loaded.rows;
  const indices = sampleIndices(rows.length, timeframe);
  const candidates = new Map();
  for (const endIndex of indices) {
    const slice = rows.slice(endIndex - WINDOW_BARS + 1, endIndex + 1);
    const end = slice[slice.length - 1];
    const structure = runStructure(slice, symbol, timeframe, end.close_time_ms + LAG,
      ['event-time-discovery', symbol, timeframe, end.open_time_ms].join(':'));
    for (const event of structure.c.events) {
      if (!BREAK_EVENT_TYPES.has(event.event_type)) continue;
      if (!candidates.has(event.event_id)) candidates.set(event.event_id, {
        event_id: event.event_id,
        event_type: event.event_type,
        direction: event.direction,
        breaking_candle_open_time_ms: event.breaking_candle_open_time_ms,
        source_pivot_id: event.source_pivot_id
      });
    }
  }
  const timeToIndex = new Map(rows.map((r, i) => [r.open_time_ms, i]));
  const events = [];
  const diagnostics = {
    discovery_windows: indices.length,
    discovered_unique_events: candidates.size,
    event_reconstruction_missing: 0,
    b2d_b2e_unmatched: 0,
    skipped: 0,
    pending_after_max_window: 0,
    causal_checks: 0
  };
  const unmatchedReasons = {};
  for (const candidate of candidates.values()) {
    const result = runEventTimeLifecycle(rows, symbol, timeframe, candidate);
    if (result.status === 'SKIPPED') {
      diagnostics.skipped++;
      if (result.reason === 'EVENT_NOT_RECONSTRUCTED') diagnostics.event_reconstruction_missing++;
      continue;
    }
    if (result.status === 'UNMATCHED') {
      diagnostics.b2d_b2e_unmatched++;
      unmatchedReasons[result.reason] = (unmatchedReasons[result.reason] || 0) + 1;
      continue;
    }
    if (result.status !== 'MATCHED') continue;
    const lifecycle = result.lifecycle;
    if (!FINAL_RETEST_STATES.has(lifecycle.status)) {
      diagnostics.pending_after_max_window++;
      continue;
    }
    const resolutionIndex = resolveLifecycleIndex(lifecycle, rows, timeToIndex);
    const breakoutIndex = timeToIndex.get(candidate.breaking_candle_open_time_ms);
    if (!Number.isInteger(resolutionIndex) || resolutionIndex < 0 ||
        resolutionIndex > Math.min(rows.length - 1, breakoutIndex + RETEST_WINDOW_BARS + CONFIRMATION_WINDOW_BARS)) {
      diagnostics.skipped++;
      continue;
    }
    const resolutionCandle = rows[resolutionIndex];
    const resolutionAvailableAt = resolutionCandle.close_time_ms + LAG;
    assert(resolutionAvailableAt <= result.snapshot_as_of_ms,
      'RETEST_STATE_AVAILABLE_AFTER_EVENT_TIME_SNAPSHOT');
    assert(lifecycle.breakout_available_at_ms === candidate.breaking_candle_open_time_ms + (timeframe === '1h' ? 3600000 : timeframe === '4h' ? 14400000 : 86400000) + LAG,
      'BREAKOUT_AVAILABILITY_TIMESTAMP_MISMATCH');
    const resolutionSlice = rows.slice(Math.max(0, resolutionIndex - 260 + 1), resolutionIndex + 1);
    const resolutionAtr = calculateWilderAtr(resolutionSlice);
    if (!(resolutionAtr > 0)) {
      diagnostics.skipped++;
      continue;
    }
    const forward = computeForwardOutcomes(rows, resolutionIndex, lifecycle.direction, resolutionAtr);
    const reverseDirection = lifecycle.direction === 'BULLISH' ? 'BEARISH' : 'BULLISH';
    const reverse = computeForwardOutcomes(rows, resolutionIndex, reverseDirection, resolutionAtr);
    events.push({
      symbol, timeframe,
      event_id: candidate.event_id,
      event_type: candidate.event_type,
      direction: candidate.direction,
      breakout_time: new Date(rows[breakoutIndex].close_time_ms).toISOString(),
      resolution_time: new Date(resolutionCandle.close_time_ms).toISOString(),
      resolution_available_at_ms: resolutionAvailableAt,
      retest_status: lifecycle.status,
      quality_status: result.quality ? result.quality.quality_status : 'UNAVAILABLE',
      atr_before_break: result.atr_before_break,
      zone_span_price: result.event_policy.zone_span_price,
      retest_buffer_price: result.event_policy.retest_buffer_price,
      zone_span_atr: ZONE_SPAN_ATR,
      retest_buffer_atr: RETEST_BUFFER_ATR,
      bars_from_break_to_resolution: resolutionIndex - breakoutIndex,
      forward_outcomes: forward,
      reverse_outcomes: reverse
    });
    diagnostics.causal_checks++;
  }
  diagnostics.evaluated_events = events.length;
  return {
    symbol, timeframe,
    dataset_integrity: loaded.integrity,
    method: {
      discovery_window_bars: WINDOW_BARS,
      discovery_stride_bars: STRIDE_BARS[timeframe],
      event_time_policy: 'ATR before breakout candle; fixed zone span and retest buffers for the entire lifecycle',
      event_time_zone_span_atr: ZONE_SPAN_ATR,
      event_time_retest_buffer_atr: RETEST_BUFFER_ATR,
      retest_window_bars: RETEST_WINDOW_BARS,
      confirmation_window_bars: CONFIRMATION_WINDOW_BARS,
      forward_horizons_bars: HORIZONS
    },
    diagnostics,
    unmatched_reasons: unmatchedReasons,
    outcomes_by_retest_status: summarize(events, 'retest_status'),
    outcomes_by_quality: summarize(events, 'quality_status'),
    events
  };
}

async function main() {
  const series = {};
  const allEvents = [];
  for (const [symbol, frames] of Object.entries(FILES)) {
    series[symbol] = {};
    for (const [timeframe, file] of Object.entries(frames)) {
      const result = await replaySeries(symbol, timeframe, file);
      series[symbol][timeframe] = result;
      allEvents.push(...result.events);
    }
  }
  const report = {
    report_version: 'b2e-event-time-policy-replay-v1',
    generated_at: new Date().toISOString(),
    dataset: {
      repository: 'mestoness/btc-eth-candles-history',
      commit: '9ca04178df06ce649f00779a49e11094fe5b1c70',
      coverage_end: '2025-12-05'
    },
    scope: 'Research-only event-time ATR policy replay. Each breakout receives a fixed zone span and retest buffer derived from ATR strictly before the breakout candle; later volatility cannot reclassify the event policy.',
    limitations: [
      'Archive ends 2025-12-05 and excludes 2026 data.',
      'Discovery uses approximately 14-day-spaced snapshots; events between samples may be missed.',
      'The event-time B2C result is reconstructed with up to 23 future candles only to evaluate the lifecycle; B2E historical-zone membership is filtered to pivots available strictly before the breakout.',
      'Forward windows overlap and observations are not statistically independent.',
      'No entries/exits, fees, funding, slippage, PnL, expectancy or drawdown are evaluated.'
    ],
    policy: {
      atr_period: 14,
      zone_span_atr: ZONE_SPAN_ATR,
      retest_buffer_atr: RETEST_BUFFER_ATR,
      retest_window_bars: RETEST_WINDOW_BARS,
      confirmation_window_bars: CONFIRMATION_WINDOW_BARS
    },
    series,
    aggregate: {
      evaluated_event_count: allEvents.length,
      outcomes_by_retest_status: summarize(allEvents, 'retest_status'),
      outcomes_by_quality: summarize(allEvents, 'quality_status')
    }
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    report_version: report.report_version,
    evaluated_event_count: allEvents.length,
    outcomes_by_retest_status: report.aggregate.outcomes_by_retest_status,
    series_diagnostics: Object.fromEntries(Object.entries(series).map(([symbol, frames]) =>
      [symbol, Object.fromEntries(Object.entries(frames).map(([tf, result]) => [tf, result.diagnostics]))]))
  }, null, 2));
}
if (require.main === module) main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
module.exports = { calculateWilderAtr, deriveEventTimePolicy, sampleIndices, resolveLifecycleIndex, computeForwardOutcomes, HORIZONS };
