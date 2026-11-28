'use strict';

const fs = require('node:fs');
const {
  loadRows, runStructure, runZones, runAnalyticalContext,
  FILES, LAG
} = require('./b2_historical_replay.cjs');

const WINDOW_BARS = 260;
const STRIDE_BARS = { '1h': 336, '4h': 84, '1d': 14 };
const HORIZONS = [5, 10, 20];
const ZONE_SPAN_ATR = 0.15;
const RETEST_BUFFER_ATR = 0.05;

function deriveEventTimePolicy(atrAtBreakout) {
  if (!Number.isFinite(atrAtBreakout) || atrAtBreakout <= 0) return null;
  return Object.freeze({
    zone_span_price: atrAtBreakout * ZONE_SPAN_ATR,
    retest_buffer_price: atrAtBreakout * RETEST_BUFFER_ATR,
    atr_at_breakout: atrAtBreakout,
    zone_span_atr: ZONE_SPAN_ATR,
    retest_buffer_atr: RETEST_BUFFER_ATR
  });
}
const FINAL_RETEST_STATES = new Set([
  'RETEST_SUCCESSFUL', 'RETEST_FAILED', 'RETEST_EXPIRED', 'RETEST_UNRESOLVED'
]);
const REPORT_PATH = 'b2e_retest_forward_outcomes_report.json';

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
function sampleIndices(length, timeframe) {
  const indices = [];
  for (let i = WINDOW_BARS - 1; i < length; i += STRIDE_BARS[timeframe]) indices.push(i);
  if (indices.length && indices[indices.length - 1] !== length - 1) indices.push(length - 1);
  return indices;
}
function computeForwardOutcomes(rows, resolutionIndex, direction, atr, horizons = HORIZONS) {
  if (!Array.isArray(rows) || !Number.isInteger(resolutionIndex) || resolutionIndex < 0 ||
      resolutionIndex >= rows.length || !['BULLISH', 'BEARISH'].includes(direction) ||
      !Number.isFinite(atr) || atr <= 0) return null;
  const resolutionClose = rows[resolutionIndex].close;
  const sign = direction === 'BULLISH' ? 1 : -1;
  const output = {};
  for (const horizon of horizons) {
    if (!Number.isSafeInteger(horizon) || horizon < 1) throw new Error('INVALID_HORIZON');
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
function summarizeOutcomes(events, groupKey, outcomeKey) {
  const groups = new Map();
  for (const event of events) {
    const key = event[groupKey] || 'UNKNOWN';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  const output = {};
  for (const [key, items] of groups) {
    output[key] = { event_count: items.length, horizons: {} };
    for (const horizon of HORIZONS) {
      const rows = items.map(e => e[outcomeKey][horizon]).filter(Boolean);
      const returns = rows.map(x => x.direction_adjusted_return_atr);
      const favorable = rows.map(x => x.favorable_excursion_atr);
      const adverse = rows.map(x => x.adverse_excursion_atr);
      output[key].horizons[horizon] = {
        evaluated_count: rows.length,
        median_direction_adjusted_return_atr: percentile(returns, 0.5),
        p25_direction_adjusted_return_atr: percentile(returns, 0.25),
        p75_direction_adjusted_return_atr: percentile(returns, 0.75),
        positive_close_rate: rows.length ? rows.filter(x => x.positive_close).length / rows.length : null,
        at_least_0_5_atr_rate: rows.length ? rows.filter(x => x.move_at_least_0_5_atr).length / rows.length : null,
        adverse_close_at_least_0_5_atr_rate: rows.length ? rows.filter(x => x.adverse_close_at_least_0_5_atr).length / rows.length : null,
        median_favorable_excursion_atr: percentile(favorable, 0.5),
        median_adverse_excursion_atr: percentile(adverse, 0.5)
      };
    }
  }
  return output;
}

async function replaySeries(symbol, timeframe, file) {
  const loaded = await loadRows(file, timeframe);
  const rows = loaded.rows;
  const indices = sampleIndices(rows.length, timeframe);
  const timeToIndex = new Map(rows.map((row, index) => [row.open_time_ms, index]));
  const seen = new Map();
  const diagnostics = {
    sampled_windows: indices.length,
    lifecycles_seen: 0,
    final_states_seen: 0,
    pending_states_skipped: 0,
    invalid_resolution_time: 0,
    duplicate_events: 0,
    duplicate_status_conflicts: 0,
    event_policy_replays: 0,
    event_policy_replay_missing: 0,
    causal_checks: 0,
    evaluated_events: 0
  };

  for (const endIndex of indices) {
    const slice = rows.slice(endIndex - WINDOW_BARS + 1, endIndex + 1);
    const end = slice[slice.length - 1];
    const asOf = end.close_time_ms + LAG;
    const structure = runStructure(slice, symbol, timeframe, asOf,
      ['retest-outcome', symbol, timeframe, end.open_time_ms].join(':'));
    const atr = calculateWilderAtr(slice);
    const priceScale = median(slice.map(c => c.close));
    if (!(atr > 0) || !(priceScale > 0)) continue;
    const zones = runZones(structure, symbol, timeframe,
      atr * ZONE_SPAN_ATR / priceScale,
      atr * RETEST_BUFFER_ATR / priceScale);
    const context = runAnalyticalContext(structure, zones, WINDOW_BARS);
    assert(context.breakoutQuality.status === 'VALID', 'BREAKOUT_QUALITY_BLOCKED');

    const qualityByEvent = new Map(context.breakoutQuality.breakouts.map(item =>
      [item.breakout_event_id, item]));
    for (const discoveredLifecycle of zones.e.lifecycles) {
      diagnostics.lifecycles_seen++;
      const breakoutIndex = timeToIndex.get(discoveredLifecycle.breakout_candle_open_time_ms);
      if (!Number.isInteger(breakoutIndex) || breakoutIndex < 1) {
        diagnostics.invalid_resolution_time++;
        continue;
      }
      // Freeze volatility-derived thresholds at the breakout candle close.
      // Later snapshot ATR must never rewrite an earlier event's zone/retest rules.
      const atrStart = Math.max(0, breakoutIndex - 260 + 1);
      const atrAtBreakout = calculateWilderAtr(rows.slice(atrStart, breakoutIndex + 1));
      const eventPolicy = deriveEventTimePolicy(atrAtBreakout);
      if (!eventPolicy) {
        diagnostics.invalid_resolution_time++;
        continue;
      }
      const eventZones = runZones(structure, symbol, timeframe, undefined, undefined, eventPolicy);
      const lifecycle = eventZones.e.lifecycles.find(item =>
        item.breakout_event_id === discoveredLifecycle.breakout_event_id);
      if (!lifecycle) {
        diagnostics.event_policy_replay_missing++;
        continue;
      }
      diagnostics.event_policy_replays++;
      if (!FINAL_RETEST_STATES.has(lifecycle.status)) {
        diagnostics.pending_states_skipped++;
        continue;
      }
      diagnostics.final_states_seen++;
      const resolutionIndex = resolveLifecycleIndex(lifecycle, rows, timeToIndex);
      if (!Number.isInteger(resolutionIndex) || resolutionIndex < 0 || resolutionIndex > endIndex) {
        diagnostics.invalid_resolution_time++;
        continue;
      }
      const resolutionCandle = rows[resolutionIndex];
      const resolutionAvailableAt = resolutionCandle.close_time_ms + LAG;
      assert(resolutionAvailableAt <= asOf, 'RETEST_STATE_AVAILABLE_AFTER_SNAPSHOT_CUTOFF');
      if (resolutionIndex <= breakoutIndex) {
        diagnostics.invalid_resolution_time++;
        continue;
      }
      const resolutionSliceStart = Math.max(0, resolutionIndex - 260 + 1);
      const resolutionSlice = rows.slice(resolutionSliceStart, resolutionIndex + 1);
      const resolutionAtr = calculateWilderAtr(resolutionSlice);
      if (!(resolutionAtr > 0)) {
        diagnostics.invalid_resolution_time++;
        continue;
      }
      const quality = qualityByEvent.get(lifecycle.breakout_event_id);
      const candidate = {
        symbol, timeframe,
        event_id: lifecycle.breakout_event_id,
        lifecycle_id: lifecycle.lifecycle_id,
        direction: lifecycle.direction,
        retest_status: lifecycle.status,
        breakout_time: new Date(lifecycle.breakout_candle_close_time_ms).toISOString(),
        resolution_time: new Date(resolutionCandle.close_time_ms).toISOString(),
        resolution_available_at_ms: resolutionAvailableAt,
        bars_from_break_to_resolution: resolutionIndex - breakoutIndex,
        quality_status: quality ? quality.quality_status : 'UNAVAILABLE',
        atr_at_breakout: eventPolicy.atr_at_breakout,
        zone_span_price_at_breakout: eventPolicy.zone_span_price,
        retest_buffer_price_at_breakout: eventPolicy.retest_buffer_price,
        event_policy_version: 'b2e-event-time-policy-v1',
        atr_at_resolution: resolutionAtr,
        resolution_close: resolutionCandle.close
      };
      const existing = seen.get(candidate.event_id);
      if (existing) {
        diagnostics.duplicate_events++;
        if (existing.retest_status !== candidate.retest_status ||
            existing.resolution_available_at_ms !== candidate.resolution_available_at_ms) {
          diagnostics.duplicate_status_conflicts++;
        }
        continue;
      }
      const forward = computeForwardOutcomes(rows, resolutionIndex, lifecycle.direction, resolutionAtr);
      const reverseDirection = lifecycle.direction === 'BULLISH' ? 'BEARISH' : 'BULLISH';
      const reverse = computeForwardOutcomes(rows, resolutionIndex, reverseDirection, resolutionAtr);
      candidate.forward_in_breakout_direction = forward;
      candidate.forward_in_reverse_direction = reverse;
      seen.set(candidate.event_id, candidate);
      diagnostics.causal_checks++;
      diagnostics.evaluated_events++;
    }
  }

  const events = [...seen.values()];
  return {
    symbol, timeframe,
    dataset_integrity: loaded.integrity,
    method: {
      lookback_bars: WINDOW_BARS,
      stride_bars: STRIDE_BARS[timeframe],
      event_time_policy_version: 'b2e-event-time-policy-v1',
      zone_span_atr_at_breakout: ZONE_SPAN_ATR,
      retest_buffer_atr_at_breakout: RETEST_BUFFER_ATR,
      resolution_at: 'exact B2-E confirmation candle, retest-window expiry candle, or unresolved confirmation-window completion candle',
      forward_horizons_bars: HORIZONS,
      forward_outcomes_begin_after_resolution_candle: true
    },
    diagnostics,
    outcomes_by_retest_status: summarizeOutcomes(events, 'retest_status', 'forward_in_breakout_direction'),
    outcomes_by_quality_and_retest: summarizeOutcomes(events, 'quality_status', 'forward_in_breakout_direction'),
    reverse_outcomes_by_retest_status: summarizeOutcomes(events, 'retest_status', 'forward_in_reverse_direction'),
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
    report_version: 'b2e-retest-forward-outcomes-v1',
    generated_at: new Date().toISOString(),
    dataset: {
      repository: 'mestoness/btc-eth-candles-history',
      commit: '9ca04178df06ce649f00779a49e11094fe5b1c70',
      coverage_end: '2025-12-05'
    },
    scope: 'Research-only forward outcome evaluation after B2-E retest lifecycle resolution. Future candles are excluded from the retest-state decision and used only for post-resolution outcomes.',
    limitations: [
      'Archive ends 2025-12-05 and excludes 2026 data.',
      'Discovery uses approximately 14-day-spaced snapshots; events between samples can be missed.',
      'Zone span and retest touch/success/failure buffers are frozen from ATR at each breakout candle close and replayed as fixed absolute prices for that event. The exact terminal-state resolution candle is used for post-resolution evaluation.',
      'Forward horizons overlap and observations are not statistically independent.',
      'No entries/exits, fees, funding, slippage, realized PnL, expectancy, drawdown or risk-adjusted return are evaluated.',
      'RETEST_SUCCESSFUL/FAILED/EXPIRED/UNRESOLVED are lifecycle states, not probabilities.'
    ],
    policy: { zone_span_atr: ZONE_SPAN_ATR, retest_buffer_atr: RETEST_BUFFER_ATR, atr_period: 14 },
    series,
    aggregate: {
      evaluated_event_count: allEvents.length,
      outcomes_by_retest_status: summarizeOutcomes(allEvents, 'retest_status', 'forward_in_breakout_direction'),
      outcomes_by_quality_and_retest: summarizeOutcomes(allEvents, 'quality_status', 'forward_in_breakout_direction'),
      reverse_outcomes_by_retest_status: summarizeOutcomes(allEvents, 'retest_status', 'forward_in_reverse_direction')
    }
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    report_version: report.report_version,
    evaluated_event_count: allEvents.length,
    outcomes_by_retest_status: report.aggregate.outcomes_by_retest_status,
    diagnostics: Object.fromEntries(Object.entries(series).map(([symbol, frames]) =>
      [symbol, Object.fromEntries(Object.entries(frames).map(([tf, result]) => [tf, result.diagnostics]))]))
  }, null, 2));
}
if (require.main === module) main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
module.exports = { calculateWilderAtr, sampleIndices, computeForwardOutcomes, resolveLifecycleIndex, summarizeOutcomes, deriveEventTimePolicy, HORIZONS };
