'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');
const {
  runStructure, runZones, runAnalyticalContext, summarizeAnalyticalContext,
  runZoneContextWithPolicy
} = (() => {
  const replay = require('./b2_historical_replay.cjs');
  return { ...replay, TIMEFRAMES: null };
})();

const DATA_PATH = 'binance_usdm_recent_history.json';
const REPORT_PATH = 'binance_usdm_recent_replay_report.json';
const STRIDE = { '1h': 336, '4h': 84, '1d': 14 };
const PROVIDER_ID = 'binance-usdm-public-archive';
const VENUE = 'binance';
const FINALITY_LAG_MS = 500;
const FUTURE_HORIZON_BARS = 20;
const HOLD_CONFIRMATION_BARS = 3;
const ZONE_VARIANTS = [
  { id: 'base_r10_a20_d5', recent: 10, aging: 20, distance: 5 },
  { id: 'r10_a40_d5', recent: 10, aging: 40, distance: 5 },
  { id: 'r10_a60_d5', recent: 10, aging: 60, distance: 5 },
  { id: 'r10_a100_d5', recent: 10, aging: 100, distance: 5 },
  { id: 'r20_a40_d5', recent: 20, aging: 40, distance: 5 },
  { id: 'r20_a60_d5', recent: 20, aging: 60, distance: 5 },
  { id: 'r20_a100_d5', recent: 20, aging: 100, distance: 5 },
  { id: 'r10_a60_d7_5', recent: 10, aging: 60, distance: 7.5 },
  { id: 'r10_a60_d10', recent: 10, aging: 60, distance: 10 },
  { id: 'r20_a60_d7_5', recent: 20, aging: 60, distance: 7.5 },
  { id: 'r20_a60_d10', recent: 20, aging: 60, distance: 10 }
];

function evaluateZoneOutcome(zone, role, futureRows, atr) {
  if (!zone) return 'NO_ZONE';
  if (futureRows.length < FUTURE_HORIZON_BARS) return 'CENSORED';
  const buffer = atr * 0.25;
  let touchIndex = -1;
  for (let i = 0; i < FUTURE_HORIZON_BARS; i++) {
    const candle = futureRows[i];
    const intersects = candle.low <= zone.upper_bound && candle.high >= zone.lower_bound;
    if (intersects) { touchIndex = i; break; }
  }
  if (touchIndex < 0) return 'NOT_TOUCHED';
  let heldWithinConfirmation = false;
  for (let i = touchIndex; i < FUTURE_HORIZON_BARS; i++) {
    const candle = futureRows[i];
    if (role === 'SUPPORT' && candle.close < zone.lower_bound - buffer) return 'BROKEN';
    if (role === 'RESISTANCE' && candle.close > zone.upper_bound + buffer) return 'BROKEN';
    if (i <= touchIndex + HOLD_CONFIRMATION_BARS) {
      if (role === 'SUPPORT' && candle.close > zone.upper_bound + buffer) heldWithinConfirmation = true;
      if (role === 'RESISTANCE' && candle.close < zone.lower_bound - buffer) heldWithinConfirmation = true;
    }
  }
  return heldWithinConfirmation ? 'HELD' : 'TESTED_UNRESOLVED';
}

function createZoneSensitivityStats(variant) {
  return {
    variant: variant.id,
    policy: {
      freshness_recent_bars: variant.recent,
      freshness_aging_bars: variant.aging,
      max_active_distance_atr: variant.distance
    },
    window_count: 0,
    support_available: 0,
    resistance_available: 0,
    both_available: 0,
    neither_available: 0,
    active_zone_total: 0,
    support_distances_atr: [],
    resistance_distances_atr: [],
    support_outcomes: {},
    resistance_outcomes: {}
  };
}
function addOutcome(target, outcome, amount = 1) {
  target[outcome] = (target[outcome] || 0) + amount;
}
function finishZoneSensitivity(stats) {
  const rate = (n, d) => d ? Number((n / d).toFixed(4)) : null;
  const median = values => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(4));
  };
  const touched = counts => (counts.HELD || 0) + (counts.BROKEN || 0) + (counts.TESTED_UNRESOLVED || 0);
  const resolved = counts => (counts.HELD || 0) + (counts.BROKEN || 0);
  const supportTouched = touched(stats.support_outcomes);
  const resistanceTouched = touched(stats.resistance_outcomes);
  return {
    variant: stats.variant,
    policy: stats.policy,
    window_count: stats.window_count,
    support_available: stats.support_available,
    support_available_rate: rate(stats.support_available, stats.window_count),
    resistance_available: stats.resistance_available,
    resistance_available_rate: rate(stats.resistance_available, stats.window_count),
    both_available: stats.both_available,
    neither_available: stats.neither_available,
    active_zone_total: stats.active_zone_total,
    average_active_zones: stats.window_count
      ? Number((stats.active_zone_total / stats.window_count).toFixed(2)) : 0,
    median_support_distance_atr: median(stats.support_distances_atr),
    median_resistance_distance_atr: median(stats.resistance_distances_atr),
    support_distance_samples_atr: stats.support_distances_atr,
    resistance_distance_samples_atr: stats.resistance_distances_atr,
    support_outcomes: stats.support_outcomes,
    support_touch_rate: rate(supportTouched, stats.support_outcomes.NOT_TOUCHED + supportTouched),
    support_hold_rate_of_resolved: rate(stats.support_outcomes.HELD || 0, resolved(stats.support_outcomes)),
    resistance_outcomes: stats.resistance_outcomes,
    resistance_touch_rate: rate(resistanceTouched, stats.resistance_outcomes.NOT_TOUCHED + resistanceTouched),
    resistance_hold_rate_of_resolved: rate(stats.resistance_outcomes.HELD || 0, resolved(stats.resistance_outcomes))
  };
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item && item[key] ? item[key] : 'UNKNOWN';
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}
function runSeries(symbol, timeframe, rows) {
  const windows = [];
  const sensitivityStats = Object.fromEntries(ZONE_VARIANTS.map(v => [v.id, createZoneSensitivityStats(v)]));
  const stride = STRIDE[timeframe];
  for (let endIndex = 259; endIndex < rows.length; endIndex += stride) {
    const slice = rows.slice(endIndex - 259, endIndex + 1);
    const last = slice[slice.length - 1];
    const asOf = last.close_time_ms + FINALITY_LAG_MS;
    const id = 'binance-recent:' + symbol + ':' + timeframe + ':' + last.open_time_ms;
    const structure = runStructure(slice, symbol, timeframe, asOf, id, 2, PROVIDER_ID, VENUE);
    assert.equal(structure.snapshot.provider_metadata.provider_id, PROVIDER_ID);
    const zones = runZones(structure, symbol, timeframe);
    const analytical = runAnalyticalContext(structure, zones);
    const summary = summarizeAnalyticalContext(analytical);
    const futureRows = rows.slice(endIndex + 1, endIndex + 1 + FUTURE_HORIZON_BARS);
    for (const variant of ZONE_VARIANTS) {
      const stats = sensitivityStats[variant.id];
      const context = runZoneContextWithPolicy(structure, zones, {
        version: 'b2d-zone-context-sensitivity-' + variant.id,
        freshness_recent_bars: variant.recent,
        freshness_aging_bars: variant.aging,
        max_active_distance_atr: variant.distance
      });
      const support = context.active_zone_selection.nearest_support;
      const resistance = context.active_zone_selection.nearest_resistance;
      stats.window_count++;
      stats.active_zone_total += context.diagnostics.active_zone_count;
      if (support) {
        stats.support_available++;
        stats.support_distances_atr.push(support.distance_atr);
      }
      if (resistance) {
        stats.resistance_available++;
        stats.resistance_distances_atr.push(resistance.distance_atr);
      }
      if (support && resistance) stats.both_available++;
      if (!support && !resistance) stats.neither_available++;
      addOutcome(stats.support_outcomes, evaluateZoneOutcome(support, 'SUPPORT', futureRows, context.atr));
      addOutcome(stats.resistance_outcomes, evaluateZoneOutcome(resistance, 'RESISTANCE', futureRows, context.atr));
    }

    assert(analytical.zoneContext.zones.every(zone => zone.available_at_ms <= asOf),
      'zone evidence exceeds cutoff ' + id);
    assert(analytical.breakoutQuality.breakouts.every(item =>
      item.breakout_candle_close_time_ms <= asOf - FINALITY_LAG_MS),
      'breakout evidence exceeds cutoff ' + id);
    assert(analytical.impulse.event.window_end_close_time_ms <= asOf - FINALITY_LAG_MS,
      'impulse window exceeds cutoff ' + id);
    assert.equal(analytical.regimeV2.status, 'VALID');

    windows.push({
      cutoff: new Date(asOf).toISOString(),
      bars: slice.length,
      regime_v1: {
        label: summary.regime.label,
        structure_state: summary.regime.structure_state
      },
      regime_v2: {
        label: summary.regime_v2.label,
        scope: summary.regime_v2.scope,
        directional_bias: summary.regime_v2.directional_bias,
        evidence_alignment: summary.regime_v2.evidence_alignment,
        structure_state: summary.regime_v2.structure_state,
        features: summary.regime_v2.features
      },
      zones: summary.zones,
      breakout_quality: summary.breakout_quality,
      impulse: summary.impulse
    });
  }
  assert(windows.length >= 5, 'insufficient 260-bar windows for ' + symbol + ':' + timeframe);
  return {
    provider_id: PROVIDER_ID,
    row_count: rows.length,
    zone_context_sensitivity: ZONE_VARIANTS.map(v => finishZoneSensitivity(sensitivityStats[v.id])),
    start: new Date(rows[0].open_time_ms).toISOString(),
    end: new Date(rows[rows.length - 1].close_time_ms).toISOString(),
    windows,
    distributions: {
      regime_v1: countBy(windows.map(x => ({ label: x.regime_v1.label })), 'label'),
      regime_v2: countBy(windows.map(x => ({ label: x.regime_v2.label })), 'label'),
      regime_scope_v2: countBy(windows.map(x => ({ scope: x.regime_v2.scope })), 'scope'),
      impulse: countBy(windows.map(x => ({ classification: x.impulse.classification })), 'classification')
    }
  };
}
function main() {
  assert(fs.existsSync(DATA_PATH), 'Missing Binance recent history dataset');
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  assert.equal(data.provider, 'Binance USD-M Futures public archive');
  const series = {};
  const allWindows = [];
  for (const symbol of ['BTCUSDT', 'ETHUSDT']) {
    series[symbol] = {};
    for (const timeframe of ['1h', '4h', '1d']) {
      const rows = data.series && data.series[symbol] && data.series[symbol][timeframe];
      assert(Array.isArray(rows) && rows.length >= 250,
        'Missing/short Binance series ' + symbol + ':' + timeframe);
      const result = runSeries(symbol, timeframe, rows);
      series[symbol][timeframe] = result;
      for (const window of result.windows) allWindows.push({ symbol, timeframe, ...window });
    }
  }
  const report = {
    report_version: 'binance-usdm-recent-replay-v1',
    provider: data.provider,
    market_type: data.market_type,
    generated_at: new Date().toISOString(),
    coverage_start: data.coverage_start,
    coverage_end: data.coverage_end,
    finality_safety_lag_ms: data.finality_safety_lag_ms,
    zone_outcome_policy: {
      horizon_bars: FUTURE_HORIZON_BARS,
      hold_confirmation_bars: HOLD_CONFIRMATION_BARS,
      boundary_buffer_atr: 0.25,
      outcomes: ['NO_ZONE', 'CENSORED', 'NOT_TOUCHED', 'HELD', 'BROKEN', 'TESTED_UNRESOLVED']
    },
    series,
    summary: {
      window_count: allWindows.length,
      zone_context_sensitivity: ZONE_VARIANTS.map(v => {
        const matching = Object.values(series).flatMap(x => Object.values(x))
          .map(x => x.zone_context_sensitivity.find(item => item.variant === v.id)).filter(Boolean);
        const merged = createZoneSensitivityStats(v);
        for (const item of matching) {
          merged.window_count += item.window_count;
          merged.support_available += item.support_available;
          merged.resistance_available += item.resistance_available;
          merged.both_available += item.both_available;
          merged.neither_available += item.neither_available;
          merged.active_zone_total += item.active_zone_total;
          merged.support_distances_atr.push(...item.support_distance_samples_atr);
          merged.resistance_distances_atr.push(...item.resistance_distance_samples_atr);
          for (const [k,n] of Object.entries(item.support_outcomes)) addOutcome(merged.support_outcomes,k,n);
          for (const [k,n] of Object.entries(item.resistance_outcomes)) addOutcome(merged.resistance_outcomes,k,n);
        }
        return finishZoneSensitivity(merged);
      }),
      regime_v1_distribution: countBy(allWindows.map(x => ({ label: x.regime_v1.label })), 'label'),
      regime_v2_distribution: countBy(allWindows.map(x => ({ label: x.regime_v2.label })), 'label'),
      regime_scope_v2_distribution: countBy(allWindows.map(x => ({ scope: x.regime_v2.scope })), 'scope'),
      impulse_distribution: countBy(allWindows.map(x => ({ classification: x.impulse.classification })), 'classification')
    },
    limitations: [
      'This is an independent Binance USD-M futures sample. It is not concatenated with the Bybit archive.',
      'Windows contain 260 closed candles and are sampled approximately every 14 calendar days.',
      'B1 quality is a synthetic VALID research wrapper after source archive checksums and OHLCV integrity validation.',
      'This report measures classification behavior and causal cutoffs, not predictive accuracy, trade PnL or profitability.',
      'The report does not evaluate every candle; short-lived events between sampled cutoffs can be missed.',
      'Zone outcome labels use the next 20 closed candles after each cutoff only for retrospective evaluation; they are not used to construct zones or select them at the cutoff, and they are not trade PnL.'
    ]
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report) + '\n');
  process.stdout.write('Binance recent replay: ' + allWindows.length + ' windows across six series\n');
  process.stdout.write('v2 regimes: ' + JSON.stringify(report.summary.regime_v2_distribution) + '\n');
  process.stdout.write('v2 scopes: ' + JSON.stringify(report.summary.regime_scope_v2_distribution) + '\n');
  process.stdout.write('Wrote ' + REPORT_PATH + ' through ' + report.coverage_end + '\n');
}
if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write((error && error.stack) || String(error));
    process.exitCode = 1;
  }
}
module.exports = { runSeries, STRIDE, PROVIDER_ID, REPORT_PATH };
