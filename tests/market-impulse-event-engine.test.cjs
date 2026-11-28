'use strict';

const assert = require('node:assert/strict');
const { analyze } = require('../src/analysis/market-impulse-event-engine.js');

const STEP = 3600000;
const LAG = 500;
const POLICY = Object.freeze({
  version: 'market-impulse-event-v1',
  b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: 'b1-quality-v1',
  b2e_policy_version: 'b2e-retest-engine-v1',
  zone_context_policy_version: 'b2d-zone-context-v1',
  finality_safety_lag_ms: LAG,
  atr_period: 14,
  window_bars: 3,
  volume_lookback: 20,
  volume_field: 'volume_base',
  impulse_displacement_atr: 1.2,
  selloff_displacement_atr: 2,
  range_expansion_min_atr: 1.2,
  volume_expansion_min_ratio: 1.5,
  directional_pressure_min: 0.67,
  close_location_max: 0.35,
  context_lookback_bars: 10
});
function candle(i, values = {}) {
  const openTime = (i + 1) * STEP;
  return {
    open_time_ms: openTime, close_time_ms: openTime + STEP,
    canonical_symbol: 'BTCUSDT', market_type: 'LINEAR_PERPETUAL', timeframe: '1h',
    open: values.open ?? 105, high: values.high ?? 106, low: values.low ?? 104,
    close: values.close ?? 105, volume_base: values.volume ?? 100,
    closed_state: 'CONFIRMED'
  };
}
function fixture(options = {}) {
  const candles = Array.from({ length: 50 }, (_, i) => candle(i));
  const start = candles.length - POLICY.window_bars;
  if (options.window) options.window.forEach((values, i) => { candles[start + i] = candle(start + i, values); });
  const asOf = candles[candles.length - 1].close_time_ms + LAG;
  const snapshot = {
    snapshot_id: 'fixture:market-impulse:btc:1h', contract_version: '1.1.0',
    canonical_symbol: 'BTCUSDT', market_type: 'LINEAR_PERPETUAL',
    analysis_as_of_ms: asOf, provider_server_time_ms: asOf,
    provider_metadata: { time_source: 'provider' },
    candles_by_timeframe: { '1h': candles }
  };
  const report = {
    status: 'VALID', snapshot_id: snapshot.snapshot_id, symbol: snapshot.canonical_symbol,
    timeframe: '1h', analysis_as_of_ms: asOf, checked_at_ms: asOf - 100,
    validator_version: '1.1.0', policy_version: 'b1-quality-v1',
    closed_count: candles.length, valid_count: candles.length, insufficient_history: false
  };
  const b2e = {
    status: 'VALID', engine_version: '2.0.0-b2e', policy_version: 'b2e-retest-engine-v1',
    snapshot_id: snapshot.snapshot_id, symbol: snapshot.canonical_symbol,
    timeframe: '1h', analysis_as_of_ms: asOf,
    admission: { status: 'ADMITTED', snapshot_id: snapshot.snapshot_id },
    lifecycles: options.lifecycles || []
  };
  return {
    policy: { ...POLICY, ...(options.policy || {}) },
    snapshot, quality_report: { ...report, ...(options.report || {}) },
    b2e_result: { ...b2e, ...(options.b2e || {}) },
    zone_context_result: options.zoneContext || null,
    analysis_as_of_ms: asOf, timeframe: '1h'
  };
}
function run(name, fn) {
  try { fn(); process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + ': ' + error.message + '\n'); process.exitCode = 1; }
}

const bearishWindow = [
  { open: 105, high: 106, low: 100, close: 101, volume: 180 },
  { open: 101, high: 102, low: 95, close: 96, volume: 220 },
  { open: 96, high: 97, low: 88, close: 89, volume: 260 }
];
run('classifies a high-displacement, expanding-volume bearish selloff', () => {
  const result = analyze(fixture({ window: bearishWindow }));
  assert.equal(result.status, 'VALID');
  assert.equal(result.event.classification, 'STRONG_SELL_OFF');
  assert.equal(result.event.direction, 'BEARISH');
  assert.ok(result.event.metrics.displacement_atr >= 2);
  assert.equal(result.event.evidence_flags.volume_expansion, true);
});
run('classifies a bearish impulse when volume expansion is absent', () => {
  const result = analyze(fixture({ window: bearishWindow.map(x => ({ ...x, volume: 100 })) }));
  assert.equal(result.event.classification, 'BEARISH_IMPULSE');
  assert.equal(result.event.evidence_flags.volume_expansion, false);
});
run('classifies partial selloff evidence when volume is unavailable', () => {
  const input = fixture({ window: bearishWindow });
  for (const c of input.snapshot.candles_by_timeframe['1h'].slice(-3)) delete c.volume_base;
  const result = analyze(input);
  assert.equal(result.event.classification, 'SELL_OFF_PARTIAL_EVIDENCE');
});
run('classifies a bullish impulse separately from a bearish selloff', () => {
  const window = [
    { open: 89, high: 97, low: 88, close: 96, volume: 180 },
    { open: 96, high: 103, low: 95, close: 102, volume: 220 },
    { open: 102, high: 110, low: 101, close: 109, volume: 260 }
  ];
  const result = analyze(fixture({ window }));
  assert.equal(result.event.classification, 'BULLISH_IMPULSE');
  assert.equal(result.event.direction, 'BULLISH');
});
run('does not call a low-displacement drift an impulse', () => {
  const result = analyze(fixture({ window: [
    { open: 105, high: 106, low: 104, close: 104.8, volume: 110 },
    { open: 104.8, high: 105.5, low: 103.8, close: 104.2, volume: 105 },
    { open: 104.2, high: 105, low: 103, close: 103.8, volume: 115 }
  ] }));
  assert.equal(result.event.classification, 'NO_IMPULSE');
});
run('directional pressure requires multiple candles closing near their directional extremes', () => {
  const result = analyze(fixture({ window: [
    { open: 105, high: 106, low: 100, close: 101, volume: 180 },
    { open: 101, high: 106, low: 95, close: 105, volume: 220 },
    { open: 105, high: 106, low: 88, close: 89, volume: 260 }
  ] }));
  assert.ok(result.event.metrics.directional_pressure < 1);
});
run('bearish successful retest means broken support held as resistance', () => {
  const lifecycle = {
    breakout_event_id: 'bear-break', lifecycle_id: 'life-1',
    direction: 'BEARISH', breakout_candle_open_time_ms: 45 * STEP,
    status: 'RETEST_SUCCESSFUL'
  };
  const result = analyze(fixture({ lifecycles: [lifecycle], window: bearishWindow }));
  assert.equal(result.event.bearish_breakout_context[0].interpretation, 'BROKEN_SUPPORT_HELD_AS_RESISTANCE');
});
run('bearish failed retest is reported as support reclaim, not as a confirmed breakdown', () => {
  const lifecycle = {
    breakout_event_id: 'bear-break', lifecycle_id: 'life-1',
    direction: 'BEARISH', breakout_candle_open_time_ms: 45 * STEP,
    status: 'RETEST_FAILED'
  };
  const result = analyze(fixture({ lifecycles: [lifecycle], window: bearishWindow }));
  assert.equal(result.event.bearish_breakout_context[0].interpretation, 'SUPPORT_RECLAIMED_BREAKDOWN_INVALIDATED');
});
run('zone context is included only when exact identity matches', () => {
  const input = fixture({ zoneContext: {
    status: 'VALID', engine_version: '1.0.0-b2d-zone-context',
    snapshot_id: 'fixture:market-impulse:btc:1h', symbol: 'BTCUSDT',
    timeframe: '1h', analysis_as_of_ms: 51 * STEP + LAG, policy_version: 'b2d-zone-context-v1',
    admission: { status: 'ADMITTED' },
    active_zone_selection: { nearest_support: null, nearest_resistance: null, intersecting_zone_ids: [] }
  } });
  assert.equal(analyze(input).status, 'VALID');
});
run('zone context identity mismatch fails closed', () => {
  const result = analyze(fixture({ zoneContext: {
    status: 'VALID', engine_version: '1.0.0-b2d-zone-context',
    snapshot_id: 'other', symbol: 'BTCUSDT', timeframe: '1h',
    analysis_as_of_ms: 51 * STEP + LAG, admission: { status: 'ADMITTED' }
  } }));
  assert.equal(result.status, 'BLOCKED');
});
run('B1 quality mismatch fails closed', () => {
  assert.equal(analyze(fixture({ report: { status: 'STALE' } })).status, 'BLOCKED');
});
run('forming candles fail closed', () => {
  const input = fixture();
  input.snapshot.candles_by_timeframe['1h'][49].closed_state = 'FORMING';
  assert.equal(analyze(input).status, 'BLOCKED');
});
run('candle gaps fail closed', () => {
  const input = fixture();
  input.snapshot.candles_by_timeframe['1h'][10].open_time_ms += STEP;
  assert.equal(analyze(input).status, 'BLOCKED');
});
run('invalid policy fails closed', () => {
  const result = analyze(fixture({ policy: { selloff_displacement_atr: 0.5 } }));
  assert.equal(result.status, 'BLOCKED');
});
run('results are immutable and inputs are not mutated', () => {
  const input = fixture({ window: bearishWindow });
  const before = JSON.stringify(input);
  const result = analyze(input);
  assert.equal(JSON.stringify(input), before);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.event));
  assert.ok(Object.isFrozen(result.event.metrics));
});
run('identical inputs produce deterministic impulse classification', () => {
  const input = fixture({ window: bearishWindow });
  assert.deepEqual(analyze(input), analyze(input));
});

if (process.exitCode) process.exit(process.exitCode);
