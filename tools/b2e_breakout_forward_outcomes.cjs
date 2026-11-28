'use strict';

const fs = require('node:fs');
const {
  loadRows, runStructure, runZones, runAnalyticalContext,
  FILES, STEP, LAG
} = require('./b2_historical_replay.cjs');

const WINDOW_BARS = 260;
const STRIDE_BARS = { '1h': 336, '4h': 84, '1d': 14 };
const HORIZONS = [5, 10, 20];
const ZONE_SPAN_ATR = 0.15;
const RETEST_BUFFER_ATR = 0.05;
const REPORT_PATH = 'b2e_breakout_forward_outcomes_report.json';
const BREAK_EVENT_TYPES = new Set([
  'INITIAL_BULLISH_BREAK', 'BULLISH_BOS', 'BULLISH_CHOCH',
  'INITIAL_BEARISH_BREAK', 'BEARISH_BOS', 'BEARISH_CHOCH'
]);

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
  for (let i = period; i < ranges.length; i++) atr = (atr * (period - 1) + ranges[i]) / period;
  return Number.isFinite(atr) && atr > 0 ? atr : null;
}
function sampleIndices(length, timeframe) {
  const indices = [];
  for (let i = WINDOW_BARS - 1; i < length; i += STRIDE_BARS[timeframe]) indices.push(i);
  if (indices.length && indices[indices.length - 1] !== length - 1) indices.push(length - 1);
  return indices;
}
function computeForwardOutcomes(rows, eventIndex, direction, atr, horizons = HORIZONS) {
  if (!Array.isArray(rows) || !Number.isInteger(eventIndex) || eventIndex < 0 ||
      eventIndex >= rows.length || !['BULLISH', 'BEARISH'].includes(direction) ||
      !Number.isFinite(atr) || atr <= 0) return null;
  const eventCandle = rows[eventIndex];
  const sign = direction === 'BULLISH' ? 1 : -1;
  const output = {};
  for (const horizon of horizons) {
    if (!Number.isSafeInteger(horizon) || horizon < 1) throw new Error('INVALID_HORIZON');
    if (eventIndex + horizon >= rows.length) {
      output[horizon] = null;
      continue;
    }
    const future = rows.slice(eventIndex + 1, eventIndex + horizon + 1);
    if (future.length !== horizon) {
      output[horizon] = null;
      continue;
    }
    const finalClose = future[future.length - 1].close;
    const maxHigh = Math.max(...future.map(c => c.high));
    const minLow = Math.min(...future.map(c => c.low));
    const directionAdjustedReturnAtr = sign * (finalClose - eventCandle.close) / atr;
    const favorableExcursionAtr = direction === 'BULLISH'
      ? (maxHigh - eventCandle.close) / atr
      : (eventCandle.close - minLow) / atr;
    const adverseExcursionAtr = direction === 'BULLISH'
      ? (eventCandle.close - minLow) / atr
      : (maxHigh - eventCandle.close) / atr;
    output[horizon] = {
      direction_adjusted_return_atr: directionAdjustedReturnAtr,
      favorable_excursion_atr: favorableExcursionAtr,
      adverse_excursion_atr: adverseExcursionAtr,
      positive_close: directionAdjustedReturnAtr > 0,
      move_at_least_0_5_atr: directionAdjustedReturnAtr >= 0.5,
      adverse_close_at_least_0_5_atr: directionAdjustedReturnAtr <= -0.5
    };
  }
  return output;
}
function summarizeOutcomes(events, groupKey) {
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
        median_direction_adjusted_return_atr: percentile(returns, 0.50),
        p25_direction_adjusted_return_atr: percentile(returns, 0.25),
        p75_direction_adjusted_return_atr: percentile(returns, 0.75),
        positive_close_rate: rows.length ? rows.filter(x => x.positive_close).length / rows.length : null,
        at_least_0_5_atr_rate: rows.length ? rows.filter(x => x.move_at_least_0_5_atr).length / rows.length : null,
        adverse_close_at_least_0_5_atr_rate: rows.length ? rows.filter(x => x.adverse_close_at_least_0_5_atr).length / rows.length : null,
        median_favorable_excursion_atr: percentile(favorable, 0.50),
        median_adverse_excursion_atr: percentile(adverse, 0.50)
      };
    }
  }
  return result;
}

async function replaySeries(symbol, timeframe, file) {
  const loaded = await loadRows(file, timeframe);
  const rows = loaded.rows;
  const indices = sampleIndices(rows.length, timeframe);
  const candidateEvents = new Map();
  for (const endIndex of indices) {
    const slice = rows.slice(endIndex - WINDOW_BARS + 1, endIndex + 1);
    const end = slice[slice.length - 1];
    const asOf = end.close_time_ms + LAG;
    const structure = runStructure(slice, symbol, timeframe, asOf,
      ['b2e-forward-discovery', symbol, timeframe, end.open_time_ms].join(':'));
    for (const event of structure.c.events) {
      if (!BREAK_EVENT_TYPES.has(event.event_type)) continue;
      if (!candidateEvents.has(event.event_id)) {
        candidateEvents.set(event.event_id, {
          event_id: event.event_id,
          event_type: event.event_type,
          direction: event.direction,
          breaking_candle_open_time_ms: event.breaking_candle_open_time_ms,
          breaking_candle_close_time_ms: event.breaking_candle_close_time_ms,
          source_pivot_id: event.source_pivot_id
        });
      }
    }
  }

  const timeToIndex = new Map(rows.map((row, index) => [row.open_time_ms, index]));
  const evaluated = [];
  const diagnostics = {
    discovery_windows: indices.length,
    discovered_unique_break_events: candidateEvents.size,
    event_time_reconstruction_missing: 0,
    zone_unmatched_at_event_time: 0,
    quality_missing_at_event_time: 0,
    evaluated_breakouts: 0,
    causal_checks: 0
  };

  for (const candidate of candidateEvents.values()) {
    const eventIndex = timeToIndex.get(candidate.breaking_candle_open_time_ms);
    if (!Number.isInteger(eventIndex) || eventIndex < WINDOW_BARS - 1) {
      diagnostics.event_time_reconstruction_missing++;
      continue;
    }
    const eventSlice = rows.slice(eventIndex - WINDOW_BARS + 1, eventIndex + 1);
    const eventCandle = eventSlice[eventSlice.length - 1];
    const asOf = eventCandle.close_time_ms + LAG;
    assert(eventCandle.open_time_ms === candidate.breaking_candle_open_time_ms,
      'EVENT_TIME_SLICE_MISMATCH');
    const structure = runStructure(eventSlice, symbol, timeframe, asOf,
      ['b2e-forward-event', symbol, timeframe, candidate.event_id].join(':'));
    const reconstructed = structure.c.events.find(event =>
      event.event_id === candidate.event_id ||
      (event.event_type === candidate.event_type &&
       event.breaking_candle_open_time_ms === candidate.breaking_candle_open_time_ms &&
       event.source_pivot_id === candidate.source_pivot_id));
    if (!reconstructed) {
      diagnostics.event_time_reconstruction_missing++;
      continue;
    }
    assert(reconstructed.available_at_ms <= asOf && reconstructed.breaking_candle_close_time_ms <= asOf - LAG,
      'EVENT_SIGNAL_AVAILABLE_AFTER_CUTOFF');

    const atr = calculateWilderAtr(eventSlice);
    const priceScale = median(eventSlice.map(c => c.close));
    if (!(atr > 0) || !(priceScale > 0)) {
      diagnostics.quality_missing_at_event_time++;
      continue;
    }
    const zones = runZones(structure, symbol, timeframe,
      atr * ZONE_SPAN_ATR / priceScale,
      atr * RETEST_BUFFER_ATR / priceScale);
    const context = runAnalyticalContext(structure, zones, WINDOW_BARS);
    assert(context.breakoutQuality.status === 'VALID', 'BREAKOUT_QUALITY_BLOCKED');
    const quality = context.breakoutQuality.breakouts.find(item =>
      item.breakout_candle_open_time_ms === candidate.breaking_candle_open_time_ms &&
      item.direction === candidate.direction);
    if (!quality) {
      diagnostics.zone_unmatched_at_event_time++;
      continue;
    }
    assert(quality.metrics.atr_before_break > 0 &&
      quality.breakout_candle_close_time_ms <= asOf - LAG,
      'BREAKOUT_QUALITY_CUTOFF_INVALID');
    const forward = computeForwardOutcomes(rows, eventIndex, candidate.direction,
      quality.metrics.atr_before_break);
    evaluated.push({
      symbol, timeframe,
      event_id: candidate.event_id,
      event_type: reconstructed.event_type,
      direction: candidate.direction,
      breakout_time: new Date(eventCandle.close_time_ms).toISOString(),
      available_at_ms: reconstructed.available_at_ms,
      quality_status: quality.quality_status,
      evidence_available_count: quality.evidence_available_count,
      evidence_positive_count: quality.evidence_positive_count,
      atr_before_break: quality.metrics.atr_before_break,
      zone_lower_bound: quality.zone_lower_bound,
      zone_upper_bound: quality.zone_upper_bound,
      break_distance_atr: quality.metrics.break_distance_atr,
      forward_outcomes: forward
    });
    diagnostics.evaluated_breakouts++;
    diagnostics.causal_checks++;
  }

  return {
    symbol, timeframe,
    dataset_integrity: loaded.integrity,
    method: {
      discovery_window_bars: WINDOW_BARS,
      discovery_stride_bars: STRIDE_BARS[timeframe],
      event_reconstruction: '260 closed candles ending exactly at the breakout candle',
      zone_span_atr: ZONE_SPAN_ATR,
      retest_buffer_atr: RETEST_BUFFER_ATR,
      forward_horizons_bars: HORIZONS,
      forward_outcomes_use_future_candles_only_for_evaluation: true
    },
    diagnostics,
    quality_distribution: Object.fromEntries(
      [...new Set(evaluated.map(e => e.quality_status))].map(label =>
        [label, evaluated.filter(e => e.quality_status === label).length])),
    outcomes_by_quality: summarizeOutcomes(evaluated, 'quality_status'),
    outcomes_by_event_type: summarizeOutcomes(evaluated, 'event_type'),
    events: evaluated
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
    report_version: 'b2e-breakout-forward-outcomes-v1',
    generated_at: new Date().toISOString(),
    dataset: {
      repository: 'mestoness/btc-eth-candles-history',
      commit: '9ca04178df06ce649f00779a49e11094fe5b1c70',
      coverage_end: '2025-12-05'
    },
    scope: 'Research-only forward outcome evaluation of B2-C close-confirmed structural breaks that also match a B2-D zone and B2-E lifecycle. No strategy PnL or trading rule is tested.',
    limitations: [
      'The archive ends 2025-12-05 and excludes 2026 data.',
      'Candidate events are discovered on approximately 14-day-spaced snapshots; events not present in those sampled windows are not evaluated.',
      'The quality label is reconstructed using a 260-candle window ending exactly at the breakout candle. ATR-normalized zone span and retest buffers are also set from ATR available at that event-time cutoff.',
      'Forward horizons overlap across nearby events and are not independent observations.',
      'No entry/exit rule, fees, funding, slippage, realized PnL, expectancy, drawdown or risk-adjusted return is evaluated.',
      'Positive future movement after a structural break does not by itself establish a tradable edge.'
    ],
    policy: { zone_span_atr: ZONE_SPAN_ATR, retest_buffer_atr: RETEST_BUFFER_ATR, atr_period: 14 },
    series,
    aggregate: {
      evaluated_event_count: allEvents.length,
      outcomes_by_quality: summarizeOutcomes(allEvents, 'quality_status'),
      outcomes_by_event_type: summarizeOutcomes(allEvents, 'event_type')
    }
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    report_version: report.report_version,
    evaluated_event_count: allEvents.length,
    aggregate_outcomes_by_quality: report.aggregate.outcomes_by_quality,
    series_diagnostics: Object.fromEntries(Object.entries(series).map(([symbol, frames]) =>
      [symbol, Object.fromEntries(Object.entries(frames).map(([tf, result]) => [tf, result.diagnostics]))]))
  }, null, 2));
}

if (require.main === module) main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
module.exports = { calculateWilderAtr, sampleIndices, computeForwardOutcomes, summarizeOutcomes, HORIZONS };
