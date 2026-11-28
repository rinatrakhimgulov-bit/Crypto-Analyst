'use strict';

const fs = require('node:fs');
const {
  loadRows, runStructure, runZones, runSetups, FILES, STEP, LAG, QUALITY
} = require('./b2_historical_replay.cjs');
const { analyze: analyzeRegime } = require('../src/analysis/market-regime-engine.js');
const { analyze: analyzeZoneContext } = require('../src/analysis/b2d-zone-context-engine.js');
const { analyze: analyzeBreakoutQuality } = require('../src/analysis/b2e-breakout-quality-engine.js');
const { analyze: analyzeImpulse } = require('../src/analysis/market-impulse-event-engine.js');
const { analyze: analyzeDecision } = require('../src/analysis/market-decision-context-engine.js');

const DATASET_REPOSITORY = 'mestoness/btc-eth-candles-history';
const DATASET_COMMIT = '9ca04178df06ce649f00779a49e11094fe5b1c70';
const WINDOW_CANDLES = 240;
const SAMPLE_STRIDE = 250;

const POLICY_REGIME = {
  version: 'market-regime-policy-v1-initial',
  b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: QUALITY,
  structure_engine_version: '2.1.0-b2c',
  structure_policy_version: 'b2c-state-v2',
  finality_safety_lag_ms: LAG,
  ema_fast_period: 20, ema_mid_period: 50, ema_slow_period: 200,
  atr_period: 14, slope_lookback: 10, range_lookback: 20, impulse_lookback: 5,
  trend_min_ema50_slope_atr: 0.2, trend_min_ema200_slope_atr: 0.08,
  trend_min_fast_mid_spread_atr: 0.05, trend_min_mid_slow_spread_atr: 0.1,
  range_max_width_atr: 5, range_max_ema50_slope_atr: 0.12,
  range_max_mid_slow_spread_atr: 0.6, impulse_min_move_atr: 2.5,
  impulse_min_range_expansion: 1.25
};
const POLICY_ZONE_CONTEXT = {
  version: 'b2d-zone-context-v1',
  b2d_engine_version: '2.0.0-b2d',
  b2d_policy_version: 'b2d-zone-engine-v1',
  b2d_zone_policy_version: 'b2d-absolute-span-v1',
  b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: QUALITY,
  finality_safety_lag_ms: LAG,
  atr_period: 14, freshness_recent_bars: 10,
  freshness_aging_bars: 20, max_active_distance_atr: 5
};
const POLICY_BREAKOUT_QUALITY = {
  version: 'b2e-breakout-quality-v1',
  b2e_engine_version: '2.0.0-b2e',
  b2e_policy_version: 'b2e-retest-engine-v1',
  b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: QUALITY,
  finality_safety_lag_ms: LAG,
  atr_period: 14, volume_lookback: 20, volume_field: 'volume_base',
  volume_expansion_min_ratio: 1.5, range_expansion_min_atr: 1.2,
  directional_body_min_ratio: 0.5, close_location_min: 0.7
};
const SENSITIVITY_VARIANTS = [
  { name: 'baseline', overrides: {} },
  { name: 'impulse_displacement_1_0', overrides: { impulse_displacement_atr: 1.0 } },
  { name: 'impulse_displacement_1_5', overrides: { impulse_displacement_atr: 1.5 } },
  { name: 'selloff_displacement_1_5', overrides: { selloff_displacement_atr: 1.5 } },
  { name: 'selloff_displacement_2_5', overrides: { selloff_displacement_atr: 2.5 } },
  { name: 'range_expansion_1_0', overrides: { range_expansion_min_atr: 1.0 } },
  { name: 'range_expansion_1_5', overrides: { range_expansion_min_atr: 1.5 } },
  { name: 'volume_expansion_1_2', overrides: { volume_expansion_min_ratio: 1.2 } },
  { name: 'volume_expansion_2_0', overrides: { volume_expansion_min_ratio: 2.0 } },
  { name: 'directional_pressure_0_5', overrides: { directional_pressure_min: 0.5 } },
  { name: 'directional_pressure_0_8', overrides: { directional_pressure_min: 0.8 } }
];
const POLICY_IMPULSE = {
  version: 'market-impulse-event-v1',
  b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: QUALITY,
  b2e_policy_version: 'b2e-retest-engine-v1',
  zone_context_policy_version: 'b2d-zone-context-v1',
  finality_safety_lag_ms: LAG,
  atr_period: 14, window_bars: 3, volume_lookback: 20,
  volume_field: 'volume_base',
  impulse_displacement_atr: 1.2, selloff_displacement_atr: 2,
  range_expansion_min_atr: 1.2, volume_expansion_min_ratio: 1.5,
  directional_pressure_min: 2 / 3, close_location_max: 0.35,
  context_lookback_bars: 10
};

const POLICY_DECISION = {
  version: 'market-decision-context-v1',
  b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: QUALITY,
  b2c_engine_version: '2.1.0-b2c', b2c_policy_version: 'b2c-state-v2',
  b2e_engine_version: '2.0.0-b2e', b2e_policy_version: 'b2e-retest-engine-v1',
  zone_context_engine_version: '1.0.0-b2d-zone-context', zone_context_policy_version: 'b2d-zone-context-v1',
  breakout_quality_engine_version: '1.0.0-b2e-breakout-quality', breakout_quality_policy_version: 'b2e-breakout-quality-v1',
  regime_engine_version: '1.0.0-market-regime', regime_policy_version: 'market-regime-policy-v1-initial',
  impulse_engine_version: '1.0.0-market-impulse-event', impulse_policy_version: 'market-impulse-event-v1',
  b7_engine_version: '1.0.0-b7', b7_policy_version: 'b7-explainable-setups-v1'
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function increment(target, key) {
  target[key] = (target[key] || 0) + 1;
}
function sampleEndIndices(length) {
  const indices = [];
  for (let end = WINDOW_CANDLES - 1; end < length; end += SAMPLE_STRIDE) indices.push(end);
  if (indices[indices.length - 1] !== length - 1) indices.push(length - 1);
  return indices;
}
function buildWindow(rows, endIndex, symbol, timeframe) {
  const start = Math.max(0, endIndex - WINDOW_CANDLES + 1);
  const prefix = rows.slice(start, endIndex + 1);
  const last = prefix[prefix.length - 1];
  const asOf = last.close_time_ms + LAG;
  const id = 'analytics-replay:' + symbol + ':' + timeframe + ':' + last.close_time_ms;
  const structure = runStructure(prefix, symbol, timeframe, asOf, id);
  const zones = runZones(structure, symbol, timeframe);

  const zoneContext = analyzeZoneContext({
    policy: POLICY_ZONE_CONTEXT, snapshot: structure.snapshot,
    quality_report: structure.quality, b2d_result: zones.d,
    analysis_as_of_ms: asOf, timeframe
  });
  assert(zoneContext.status === 'VALID',
    symbol + ' ' + timeframe + ' B2-D zone context blocked: ' +
    JSON.stringify(zoneContext.admission.reasons));

  const breakoutQuality = analyzeBreakoutQuality({
    policy: POLICY_BREAKOUT_QUALITY, snapshot: structure.snapshot,
    quality_report: structure.quality, b2e_result: zones.e,
    analysis_as_of_ms: asOf, timeframe
  });
  assert(breakoutQuality.status === 'VALID',
    symbol + ' ' + timeframe + ' B2-E breakout quality blocked: ' +
    JSON.stringify(breakoutQuality.admission.reasons));

  const regime = analyzeRegime({
    policy: POLICY_REGIME, snapshot: structure.snapshot,
    quality_report: structure.quality, structure_result: structure.c,
    analysis_as_of_ms: asOf, timeframe
  });
  assert(regime.status === 'VALID',
    symbol + ' ' + timeframe + ' Market Regime blocked: ' +
    JSON.stringify(regime.admission.reasons));

  const impulse = analyzeImpulse({
    policy: POLICY_IMPULSE, snapshot: structure.snapshot,
    quality_report: structure.quality, b2e_result: zones.e,
    zone_context_result: zoneContext,
    analysis_as_of_ms: asOf, timeframe
  });
  assert(impulse.status === 'VALID',
    symbol + ' ' + timeframe + ' Market Impulse blocked: ' +
    JSON.stringify(impulse.admission.reasons));

  const setups = runSetups(structure, zones);
  const decision = analyzeDecision({
    policy: POLICY_DECISION, snapshot: structure.snapshot,
    quality_report: structure.quality, analysis_as_of_ms: asOf, timeframe,
    b2c_result: structure.c, b2e_result: zones.e,
    zone_context_result: zoneContext, breakout_quality_result: breakoutQuality,
    regime_result: regime, impulse_result: impulse, b7_result: setups
  });
  assert(decision.status === 'VALID',
    symbol + ' ' + timeframe + ' Decision Context blocked: ' +
    JSON.stringify(decision.admission.reasons));

  return { asOf, structure, zones, zoneContext, breakoutQuality, regime, impulse, setups, decision };
}
function verifyCutoff(result, asOf, label) {
  for (const [name, output] of [['Market Regime', result.regime], ['B2-D Zone Context', result.zoneContext], ['B2-E Breakout Quality', result.breakoutQuality], ['Market Impulse', result.impulse], ['B7 Setup', result.setups], ['Decision Context', result.decision]]) {
    assert(output.analysis_as_of_ms === asOf, label + ' ' + name + ' cutoff mismatch');
  }
  for (const lifecycle of result.zones.e.lifecycles) {
    assert(lifecycle.breakout_available_at_ms <= asOf, label + ' breakout available after cutoff');
    if (lifecycle.confirmation && Number.isSafeInteger(lifecycle.confirmation.available_at_ms)) {
      assert(lifecycle.confirmation.available_at_ms <= asOf, label + ' retest confirmation available after cutoff');
    }
  }
  for (const breakout of result.breakoutQuality.breakouts) {
    assert(breakout.breakout_candle_close_time_ms + LAG <= asOf,
      label + ' breakout quality used a candle after cutoff');
  }
  assert(result.impulse.event.window_end_close_time_ms + LAG <= asOf,
    label + ' impulse window ends after cutoff');
}
function compact(result) {
  return {
    cutoff: new Date(result.asOf).toISOString(),
    decision: result.decision.decision,
    decision_reason: result.decision.reasons[0] && result.decision.reasons[0].code,
    selected_setup_ids: result.decision.selected_setup_ids,
    regime: result.regime.regime,
    directional_bias: result.regime.directional_bias,
    structure_state: result.structure.c.structure_state,
    impulse: result.impulse.event.classification,
    impulse_direction: result.impulse.event.direction,
    impulse_displacement_atr: Number(result.impulse.event.metrics.displacement_atr.toFixed(4)),
    volume_ratio: result.impulse.event.metrics.volume_ratio === null
      ? null : Number(result.impulse.event.metrics.volume_ratio.toFixed(4)),
    zone_count: result.zoneContext.zones.length,
    active_support: result.zoneContext.active_zone_selection.nearest_support
      ? result.zoneContext.active_zone_selection.nearest_support.zone_id : null,
    active_resistance: result.zoneContext.active_zone_selection.nearest_resistance
      ? result.zoneContext.active_zone_selection.nearest_resistance.zone_id : null,
    breakout_quality_counts: Object.fromEntries(
      ['STRONG_EVIDENCE', 'MIXED_EVIDENCE', 'WEAK_EVIDENCE', 'PARTIAL_EVIDENCE'].map(k => [
        k, result.breakoutQuality.breakouts.filter(b => b.quality_status === k).length
      ])
    ),
    bearish_retest_context: result.impulse.event.bearish_breakout_context.map(x => ({
      breakout_event_id: x.breakout_event_id, retest_status: x.retest_status,
      interpretation: x.interpretation
    }))
  };
}
async function main() {
  const report = {
    report_version: 'market-analytics-prefix-replay-v1',
    dataset: { repository: DATASET_REPOSITORY, commit: DATASET_COMMIT },
    methodology: {
      window_candles: WINDOW_CANDLES,
      sample_stride_candles: SAMPLE_STRIDE,
      sample_note: 'Exploratory regular-stride prefix sample; not an exhaustive event census.',
      b1_quality: 'Synthetic B1 VALID wrapper after structural CSV integrity checks; actual B1 validator is not run.',
      finality: 'Historical TIME_DERIVED candles with fixed 500ms lag.',
      thresholds: 'All Market Regime, B2-D zone context, B2-E breakout quality and Market Impulse thresholds are uncalibrated engineering defaults.',
      outcomes: 'No trade simulation, returns, fees, funding, slippage, expectancy or profitability measured.',
      scope: 'Each sample is recomputed from a 240-candle prefix. No later candles are included in the input snapshot.'
    },
    totals: {
      series_count: 0, windows_evaluated: 0,
      regime_counts: {}, impulse_counts: {}, decision_counts: {}, breakout_quality_counts: {},
      bearish_retest_status_counts: {}, sensitivity_counts: {}, zone_context_windows: 0,
      deterministic_repeat_checks: 0, cutoff_checks: 0
    },
    series: {}
  };

  for (const symbol of Object.keys(FILES)) {
    report.series[symbol] = {};
    for (const timeframe of ['1h', '4h', '1d']) {
      const loaded = await loadRows(FILES[symbol][timeframe], timeframe);
      const indices = sampleEndIndices(loaded.rows.length);
      const summary = {
        dataset_integrity: loaded.integrity,
        windows_evaluated: 0,
        regime_counts: {}, impulse_counts: {}, decision_counts: {}, breakout_quality_counts: {},
        bearish_retest_status_counts: {}, sensitivity_counts: {}, zone_counts: [],
        sample_windows: []
      };
      for (const endIndex of indices) {
        const result = buildWindow(loaded.rows, endIndex, symbol, timeframe);
        verifyCutoff(result, result.asOf, symbol + ' ' + timeframe);
        const repeated = buildWindow(loaded.rows, endIndex, symbol, timeframe);
        assert(JSON.stringify(compact(result)) === JSON.stringify(compact(repeated)),
          symbol + ' ' + timeframe + ' replay is not deterministic at ' + result.asOf);

        increment(summary.regime_counts, result.regime.regime);
        increment(summary.impulse_counts, result.impulse.event.classification);
        increment(summary.decision_counts, result.decision.decision);
        for (const variant of SENSITIVITY_VARIANTS) {
          const varied = analyzeImpulse({
            policy: { ...POLICY_IMPULSE, ...variant.overrides, version: 'market-impulse-sensitivity-' + variant.name },
            snapshot: result.structure.snapshot, quality_report: result.structure.quality,
            b2e_result: result.zones.e, zone_context_result: result.zoneContext,
            analysis_as_of_ms: result.asOf, timeframe
          });
          assert(varied.status === 'VALID', symbol + ' ' + timeframe + ' sensitivity ' + variant.name + ' blocked');
          if (!summary.sensitivity_counts[variant.name]) summary.sensitivity_counts[variant.name] = {};
          increment(summary.sensitivity_counts[variant.name], varied.event.classification);
        }
        for (const breakout of result.breakoutQuality.breakouts) increment(summary.breakout_quality_counts, breakout.quality_status);
        for (const context of result.impulse.event.bearish_breakout_context) increment(summary.bearish_retest_status_counts, context.retest_status);
        summary.zone_counts.push(result.zoneContext.zones.length);
        summary.windows_evaluated++;
        summary.sample_windows.push(compact(result));

        report.totals.windows_evaluated++;
        increment(report.totals.regime_counts, result.regime.regime);
        increment(report.totals.impulse_counts, result.impulse.event.classification);
        increment(report.totals.decision_counts, result.decision.decision);
        for (const variant of SENSITIVITY_VARIANTS) {
          const varied = analyzeImpulse({
            policy: { ...POLICY_IMPULSE, ...variant.overrides, version: 'market-impulse-sensitivity-' + variant.name },
            snapshot: result.structure.snapshot, quality_report: result.structure.quality,
            b2e_result: result.zones.e, zone_context_result: result.zoneContext,
            analysis_as_of_ms: result.asOf, timeframe
          });
          if (!report.totals.sensitivity_counts[variant.name]) report.totals.sensitivity_counts[variant.name] = {};
          increment(report.totals.sensitivity_counts[variant.name], varied.event.classification);
        }
        for (const breakout of result.breakoutQuality.breakouts) increment(report.totals.breakout_quality_counts, breakout.quality_status);
        for (const context of result.impulse.event.bearish_breakout_context) increment(report.totals.bearish_retest_status_counts, context.retest_status);
        report.totals.zone_context_windows++;
        report.totals.deterministic_repeat_checks++;
        report.totals.cutoff_checks++;
      }
      report.series[symbol][timeframe] = summary;
      report.totals.series_count++;
    }
  }

  const json = JSON.stringify(report, null, 2);
  fs.writeFileSync('market_analytics_prefix_replay_report.json', json + '\n');
  console.log(json);
}
main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
