'use strict';

const fs = require('node:fs');
const {
  loadRows, runStructure, runZones, runAnalyticalContext, FILES, LAG
} = require('./b2_historical_replay.cjs');
const { evaluateCandidate } = require('../src/research/b8-outcome-evaluator.js');

const WINDOW_BARS = 260;
const BREAKOUT_LOOKBACK_BARS = 160;
const STRIDE_BARS = { '1h': 80, '4h': 20, '1d': 3 };
const HORIZONS = [1, 3, 6, 12];
const REPORT_PATH = 'b2e_breakout_event_outcome_report.json';
const STEP_MS = { '1h': 3600000, '4h': 14400000, '1d': 86400000 };
const QUALITY_STATES = ['STRONG_EVIDENCE', 'MIXED_EVIDENCE', 'WEAK_EVIDENCE', 'PARTIAL_EVIDENCE'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sampleEndIndices(length, timeframe) {
  const stride = STRIDE_BARS[timeframe];
  assert(Number.isInteger(stride) && stride > 0, 'INVALID_STRIDE:' + timeframe);
  const indices = [];
  for (let index = WINDOW_BARS - 1; index < length; index += stride) indices.push(index);
  if (indices.length && indices[indices.length - 1] !== length - 1) indices.push(length - 1);
  return indices;
}

function addCount(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function summarizeOutcomeGroup(events) {
  const output = {};
  for (const horizon of HORIZONS) {
    const outcomes = events.map(event => event.outcome)
      .filter(outcome => outcome && outcome.status === 'EVALUATED')
      .map(outcome => outcome.horizons[String(horizon)])
      .filter(item => item && item.status === 'AVAILABLE');
    const returns = outcomes.map(item => item.forward_return_pct);
    const mfe = outcomes.map(item => item.mfe_pct);
    const mae = outcomes.map(item => item.mae_pct);
    const positive = outcomes.filter(item => item.forward_return_pct > 0).length;
    output[horizon] = {
      n: outcomes.length,
      positive_close_returns: positive,
      positive_rate_pct: outcomes.length ? Number((positive / outcomes.length * 100).toFixed(2)) : null,
      mean_forward_return_pct: returns.length
        ? Number((returns.reduce((sum, value) => sum + value, 0) / returns.length).toFixed(4)) : null,
      median_forward_return_pct: median(returns) == null ? null : Number(median(returns).toFixed(4)),
      mean_mfe_pct: mfe.length ? Number((mfe.reduce((sum, value) => sum + value, 0) / mfe.length).toFixed(4)) : null,
      mean_mae_pct: mae.length ? Number((mae.reduce((sum, value) => sum + value, 0) / mae.length).toFixed(4)) : null
    };
  }
  return output;
}

function summarizeEvents(events) {
  const byQuality = {};
  const byDirection = {};
  const retestAtFirstSeen = {};
  const retestLatest = {};
  for (const quality of QUALITY_STATES) {
    const selected = events.filter(event => event.quality_status_at_first_seen === quality);
    byQuality[quality] = { n: selected.length, outcomes: summarizeOutcomeGroup(selected) };
  }
  for (const direction of ['LONG', 'SHORT']) {
    const selected = events.filter(event => event.direction === direction);
    byDirection[direction] = { n: selected.length, outcomes: summarizeOutcomeGroup(selected) };
  }
  for (const event of events) {
    addCount(retestAtFirstSeen, event.retest_status_at_first_seen);
    addCount(retestLatest, event.retest_status_latest);
  }
  return {
    unique_breakout_events: events.length,
    quality_distribution_at_first_observation: Object.fromEntries(
      QUALITY_STATES.map(state => [state, events.filter(e => e.quality_status_at_first_seen === state).length])
    ),
    direction_distribution: Object.fromEntries(
      ['LONG', 'SHORT'].map(direction => [direction, events.filter(e => e.direction === direction).length])
    ),
    retest_status_at_first_observation: retestAtFirstSeen,
    latest_observed_retest_status: retestLatest,
    quality_outcomes: byQuality,
    direction_outcomes: byDirection
  };
}

function observeBreakout(event, asOf, record, stepMs) {
  const breakoutAvailableAt = event.breakout_candle_close_time_ms + LAG;
  assert(asOf >= breakoutAvailableAt, 'BREAKOUT_OBSERVED_BEFORE_AVAILABLE');
  if (!record) {
    return {
      breakout_event_id: event.breakout_event_id,
      direction: event.direction === 'BULLISH' ? 'LONG' : 'SHORT',
      breakout_direction: event.direction,
      breakout_candle_open_time_ms: event.breakout_candle_open_time_ms,
      breakout_candle_close_time_ms: event.breakout_candle_close_time_ms,
      breakout_available_at_ms: breakoutAvailableAt,
      first_seen_as_of_ms: asOf,
      last_seen_as_of_ms: asOf,
      first_seen_delay_bars: Math.max(0, Math.floor((asOf - breakoutAvailableAt) / stepMs)),
      observations: 1,
      quality_status_at_first_seen: event.quality_status,
      quality_status_latest: event.quality_status,
      quality_status_changes: [],
      retest_status_at_first_seen: event.retest_status,
      retest_status_latest: event.retest_status,
      retest_status_history: [{ as_of_ms: asOf, status: event.retest_status }],
      zone_at_first_seen: {
        lower_bound: event.zone_lower_bound,
        upper_bound: event.zone_upper_bound
      },
      zone_boundary_changes: 0,
      metrics_at_first_seen: event.metrics,
      evidence_flags_at_first_seen: event.evidence_flags
    };
  }

  assert(record.breakout_candle_close_time_ms === event.breakout_candle_close_time_ms &&
    record.breakout_direction === event.direction,
    'BREAKOUT_EVENT_IDENTITY_CONFLICT:' + event.breakout_event_id);
  record.observations++;
  record.last_seen_as_of_ms = asOf;
  if (record.quality_status_latest !== event.quality_status) {
    record.quality_status_changes.push({
      as_of_ms: asOf, from: record.quality_status_latest, to: event.quality_status
    });
    record.quality_status_latest = event.quality_status;
  }
  if (record.retest_status_latest !== event.retest_status) {
    record.retest_status_history.push({ as_of_ms: asOf, status: event.retest_status });
    record.retest_status_latest = event.retest_status;
  }
  if (record.zone_at_first_seen.lower_bound !== event.zone_lower_bound ||
      record.zone_at_first_seen.upper_bound !== event.zone_upper_bound) {
    record.zone_boundary_changes++;
  }
  return record;
}

async function replaySeries(symbol, timeframe, file) {
  const loaded = await loadRows(file, timeframe);
  const rows = loaded.rows;
  const indices = sampleEndIndices(rows.length, timeframe);
  const events = new Map();
  let windowsWithBreakouts = 0;
  let breakoutObservations = 0;

  for (let n = 0; n < indices.length; n++) {
    const endIndex = indices[n];
    const slice = rows.slice(endIndex - WINDOW_BARS + 1, endIndex + 1);
    const end = slice[slice.length - 1];
    const asOf = end.close_time_ms + LAG;
    const id = ['b2e-event-study', symbol, timeframe, end.open_time_ms].join(':');
    const structure = runStructure(slice, symbol, timeframe, asOf, id);
    const zones = runZones(structure, symbol, timeframe, 0.001, 0.0005, {
      zoneSpanMode: 'EVENT_RELATIVE_V2', retestMode: 'EVENT_RELATIVE_V2'
    });
    const context = runAnalyticalContext(structure, zones, BREAKOUT_LOOKBACK_BARS);
    assert(context.breakoutQuality.status === 'VALID',
      'BREAKOUT_QUALITY_BLOCKED:' + symbol + ':' + timeframe + ':' + end.open_time_ms);

    const breakouts = context.breakoutQuality.breakouts;
    if (breakouts.length) windowsWithBreakouts++;
    for (const event of breakouts) {
      assert(event.breakout_candle_close_time_ms <= asOf - LAG,
        'BREAKOUT_CANDLE_AFTER_ANALYSIS_CUTOFF');
      const previous = events.get(event.breakout_event_id);
      const record = observeBreakout(event, asOf, previous, STEP_MS[timeframe]);
      events.set(event.breakout_event_id, record);
      breakoutObservations++;
    }
  }

  const uniqueEvents = [...events.values()].sort((a, b) =>
    a.breakout_candle_close_time_ms - b.breakout_candle_close_time_ms ||
    a.breakout_event_id.localeCompare(b.breakout_event_id));

  for (const event of uniqueEvents) {
    const outcome = evaluateCandidate({
      candidate: {
        setup_id: event.breakout_event_id,
        status: 'CONFIRMED',
        direction: event.direction,
        available_at_ms: event.first_seen_as_of_ms
      },
      candles: rows,
      horizons: HORIZONS,
      finalitySafetyLagMs: LAG
    });
    event.outcome = outcome;
    if (outcome.status === 'EVALUATED') {
      assert(outcome.entry.close_time_ms > event.breakout_candle_close_time_ms,
        'OUTCOME_ENTRY_NOT_AFTER_BREAKOUT_CANDLE');
      assert(outcome.entry.available_at_ms > event.first_seen_as_of_ms,
        'OUTCOME_ENTRY_NOT_AFTER_FIRST_OBSERVATION');
    }
  }

  return {
    symbol, timeframe,
    dataset_integrity: loaded.integrity,
    method: {
      lookback_bars: WINDOW_BARS,
      breakout_quality_lookback_bars: BREAKOUT_LOOKBACK_BARS,
      stride_bars: STRIDE_BARS[timeframe],
      approximate_calendar_stride_days: 3.3,
      sampled_windows: indices.length,
      windows_with_breakouts: windowsWithBreakouts,
      breakout_observations: breakoutObservations,
      unique_breakout_events: uniqueEvents.length,
      event_detection_time: 'first sampled analysis cutoff at which the event is observed',
      entry_rule: 'first fully closed candle with finality availability strictly later than first_seen_as_of_ms',
      horizons_bars: HORIZONS
    },
    summary: summarizeEvents(uniqueEvents),
    events: uniqueEvents
  };
}

async function main() {
  const output = {
    report_version: 'b2e-breakout-event-outcomes-v1',
    generated_at: new Date().toISOString(),
    dataset: {
      repository: 'mestoness/btc-eth-candles-history',
      commit: '9ca04178df06ce649f00779a49e11094fe5b1c70',
      venue_description: 'Bybit USDT-M perpetual historical OHLCV archive',
      coverage_end: '2025-12-05'
    },
    scope: 'Research-only event study of B2-E breakout quality labels against causal forward candle outcomes. Not a trading strategy backtest.',
    limitations: [
      'The archive ends 2025-12-05 and does not include 2026 market conditions.',
      'B1 quality is represented by a synthetic VALID wrapper after CSV integrity checks; actual live B1 validation and provider finality are not replayed.',
      'Finality uses a fixed 500ms time-derived research lag.',
      'Events are sampled from rolling windows, not discovered from a separately validated tick-level event feed. The first observation time is used as candidate availability to avoid pretending the event was known at its breakout candle close.',
      'The zone-span policy in the current replay is based on the median price of each 260-candle snapshot. Zone boundaries can differ between observations of the same event; the report records boundary changes and uses the first observation for the outcome cohort.',
      'Forward returns, MFE and MAE are descriptive bar-based outcomes. No fees, slippage, funding, stop/target fills, expectancy, drawdown or account PnL are modeled.',
      'Events within the same symbol/timeframe and nearby dates are correlated. Raw positive-return rates are not independent-trial probabilities and no significance claim is made.'
    ],
    series: {}
  };

  for (const symbol of Object.keys(FILES)) {
    output.series[symbol] = {};
    for (const timeframe of ['1h', '4h', '1d']) {
      output.series[symbol][timeframe] =
        await replaySeries(symbol, timeframe, FILES[symbol][timeframe]);
    }
  }

  const all = Object.values(output.series).flatMap(byTf => Object.values(byTf));
  const allEvents = all.flatMap(series => series.events);
  output.summary = {
    series_count: all.length,
    sampled_windows: all.reduce((sum, series) => sum + series.method.sampled_windows, 0),
    breakout_observations: all.reduce((sum, series) => sum + series.method.breakout_observations, 0),
    unique_breakout_events: allEvents.length,
    quality_outcomes: summarizeEvents(allEvents).quality_outcomes,
    retest_status_at_first_observation: summarizeEvents(allEvents).retest_status_at_first_observation,
    latest_observed_retest_status: summarizeEvents(allEvents).latest_observed_retest_status,
    quality_status_changes: allEvents.reduce((sum, event) => sum + event.quality_status_changes.length, 0),
    zone_boundary_changes: allEvents.reduce((sum, event) => sum + event.zone_boundary_changes, 0),
    events_excluded_no_causal_entry: allEvents.filter(event => event.outcome.status !== 'EVALUATED').length
  };

  assert(output.summary.series_count === 6, 'EXPECTED_SIX_SERIES');
  assert(output.summary.sampled_windows >= 2500, 'INSUFFICIENT_BREAKOUT_SAMPLE_WINDOWS');
  assert(output.summary.unique_breakout_events > 0, 'NO_BREAKOUT_EVENTS_FOUND');
  fs.writeFileSync(REPORT_PATH, JSON.stringify(output, null, 2) + '\n');
  process.stdout.write(JSON.stringify(output.summary, null, 2) + '\n');
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write((error && error.stack) || String(error));
    process.exitCode = 1;
  });
}

module.exports = { sampleEndIndices, summarizeOutcomeGroup, summarizeEvents, observeBreakout, replaySeries };
