'use strict';

const assert = require('node:assert/strict');
const { analyze } = require('../src/analysis/b7-explainable-setup-engine.js');

const STEP = 3600000;
const LAG = 500;
const AS_OF = 25 * STEP + LAG;
const SNAPSHOT_ID = 'b7-fixture:BTCUSDT:1h';

const policy = {
  version: 'b7-explainable-setups-v1',
  b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: 'b1-quality-v1',
  b2a_engine_version: '2.0.0-b2a', b2a_policy_version: 'b2a-policy-v1',
  b2b_engine_version: '2.2.0-b2b', b2b_policy_version: 'b2b-policy-v1',
  b2c_engine_version: '2.1.0-b2c', b2c_policy_version: 'b2c-policy-v2',
  b2d_engine_version: '2.0.0-b2d', b2d_policy_version: 'b2d-policy-v1',
  b2e_engine_version: '2.0.0-b2e', b2e_policy_version: 'b2e-policy-v1',
  finality_safety_lag_ms: LAG,
  max_candidates: 20,
  candle_feature_policy: {
    version: 'b7-candle-features-v1',
    rejection_wick_body_ratio: 2,
    max_rejection_body_range_ratio: 0.45,
    bullish_close_location_min: 0.65,
    bearish_close_location_max: 0.35,
    doji_body_range_max: 0.1,
    volume_lookback: 20,
    correction_lookback_bars: 3
  }
};

function makeCandles() {
  return Array.from({ length: 25 }, (_, i) => ({
    open_time_ms: i * STEP,
    close_time_ms: (i + 1) * STEP,
    canonical_symbol: 'BTCUSDT',
    market_type: 'linear_perpetual',
    timeframe: '1h',
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    volume_base: 10,
    closed_state: 'CONFIRMED'
  }));
}
function scoped(engineVersion, policyVersion, extra = {}) {
  return {
    status: 'VALID', engine_version: engineVersion, policy_version: policyVersion,
    snapshot_id: SNAPSHOT_ID, symbol: 'BTCUSDT', timeframe: '1h',
    analysis_as_of_ms: AS_OF,
    admission: { status: 'ADMITTED', snapshot_id: SNAPSHOT_ID },
    ...extra
  };
}
function fixture() {
  const candles = makeCandles();
  const snapshot = {
    contract_version: '1.1.0', snapshot_id: SNAPSHOT_ID,
    canonical_symbol: 'BTCUSDT', market_type: 'linear_perpetual',
    analysis_as_of_ms: AS_OF, provider_server_time_ms: AS_OF,
    provider_metadata: { time_source: 'provider' },
    candles_by_timeframe: { '1h': candles }
  };
  const quality_report = {
    status: 'VALID', snapshot_id: SNAPSHOT_ID, symbol: 'BTCUSDT',
    timeframe: '1h', analysis_as_of_ms: AS_OF,
    validator_version: '1.1.0', policy_version: 'b1-quality-v1',
    checked_at_ms: AS_OF
  };
  const b2a_result = scoped('2.0.0-b2a', 'b2a-policy-v1', { pivots: [] });
  const b2b_result = scoped('2.2.0-b2b', 'b2b-policy-v1', { sequence: [], sequence_history: [] });
  const b2c_result = scoped('2.1.0-b2c', 'b2c-policy-v2', {
    events: [], structure_state: 'UNESTABLISHED', protected_level: null
  });
  const b2d_result = scoped('2.0.0-b2d', 'b2d-policy-v1', { zones: [] });
  const b2e_result = scoped('2.0.0-b2e', 'b2e-policy-v1', { lifecycles: [] });
  return {
    policy: structuredClone(policy), snapshot, quality_report,
    timeframe: '1h', analysis_as_of_ms: AS_OF,
    b2a_result, b2b_result, b2c_result, b2d_result, b2e_result
  };
}
function lifecycle(status = 'RETEST_SUCCESSFUL', direction = 'BULLISH') {
  return {
    lifecycle_id: 'B2E:event-1:zone-1',
    breakout_event_id: 'event-1',
    breakout_event_type: direction === 'BULLISH' ? 'INITIAL_BULLISH_BREAK' : 'INITIAL_BEARISH_BREAK',
    direction,
    status,
    historical_zone: {
      historical_zone_id: 'zone-1', role: direction === 'BULLISH' ? 'RESISTANCE' : 'SUPPORT',
      lower_bound: 99, upper_bound: 100
    },
    failure_buffer_price: 0.5,
    success_buffer_price: 0.5,
    breakout_available_at_ms: 10 * STEP + LAG,
    touch: { candle_open_time_ms: 11 * STEP, candle_close_time_ms: 12 * STEP },
    confirmation: status === 'WAITING_RETEST' ? null : {
      outcome: status === 'RETEST_FAILED' ? 'FAILURE' : 'SUCCESS',
      candle_open_time_ms: 12 * STEP,
      candle_close_time_ms: 13 * STEP,
      candle_close: status === 'RETEST_FAILED'
        ? (direction === 'BULLISH' ? 98 : 101)
        : (direction === 'BULLISH' ? 101 : 98),
      available_at_ms: 13 * STEP + LAG
    }
  };
}
function attachLifecycles(input, items) {
  input.b2e_result.lifecycles = items;
  input.b2c_result.events = [...new Map(items.map(item => [item.breakout_event_id, {
    event_id: item.breakout_event_id,
    event_type: item.breakout_event_type,
    direction: item.direction,
    available_at_ms: item.breakout_available_at_ms
  }])).values()];
  for (const item of items) {
    if (!item.confirmation) continue;
    const candle = input.snapshot.candles_by_timeframe['1h'].find(row =>
      row.close_time_ms === item.confirmation.candle_close_time_ms);
    if (!candle) continue;
    candle.close = item.confirmation.candle_close;
    candle.high = Math.max(candle.high, candle.open, candle.close);
    candle.low = Math.min(candle.low, candle.open, candle.close);
  }
}
function run(name, fn) {
  try { fn(); process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + ': ' + error.stack + '\n'); process.exitCode = 1; }
}

run('valid inputs with no setup return NO_SETUP and immutable evidence', () => {
  const result = analyze(fixture());
  assert.equal(result.status, 'VALID');
  assert.equal(result.summary, 'NO_SETUP');
  assert.deepEqual(result.setup_candidates, []);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.setup_candidates));
});

run('successful bullish breakout retest emits confirmed LONG candidate', () => {
  const input = fixture();
  attachLifecycles(input, [lifecycle()]);
  const result = analyze(input);
  assert.equal(result.status, 'VALID');
  assert.equal(result.setup_candidates.length, 1);
  assert.equal(result.setup_candidates[0].setup_type, 'BREAKOUT_RETEST');
  assert.equal(result.setup_candidates[0].direction, 'LONG');
  assert.equal(result.setup_candidates[0].status, 'CONFIRMED');
  assert.equal(result.setup_candidates[0].invalidation_level, 98.5);
});

run('successful bearish breakout retest emits confirmed SHORT candidate', () => {
  const input = fixture();
  attachLifecycles(input, [lifecycle('RETEST_SUCCESSFUL', 'BEARISH')]);
  const result = analyze(input);
  assert.equal(result.setup_candidates[0].direction, 'SHORT');
  assert.equal(result.setup_candidates[0].invalidation_level, 100.5);
});

run('failed bullish breakout is direction-inverted to SHORT', () => {
  const input = fixture();
  attachLifecycles(input, [lifecycle('RETEST_FAILED')]);
  const result = analyze(input);
  assert.equal(result.setup_candidates[0].setup_type, 'FALSE_BREAKOUT_RECLAIM');
  assert.equal(result.setup_candidates[0].direction, 'SHORT');
  assert.equal(result.setup_candidates[0].status, 'CONFIRMED');
});

run('failed bearish breakout is direction-inverted to LONG', () => {
  const input = fixture();
  attachLifecycles(input, [lifecycle('RETEST_FAILED', 'BEARISH')]);
  const result = analyze(input);
  assert.equal(result.setup_candidates[0].direction, 'LONG');
});

run('waiting retest is pending and never confirmed', () => {
  const input = fixture();
  attachLifecycles(input, [lifecycle('WAITING_RETEST')]);
  const result = analyze(input);
  assert.equal(result.setup_candidates[0].status, 'PENDING');
  assert.equal(result.diagnostics.confirmed_count, 0);
  assert.equal(result.diagnostics.pending_count, 1);
});

run('confirmation after analysis cutoff is excluded', () => {
  const input = fixture();
  const item = lifecycle();
  item.confirmation.available_at_ms = AS_OF + 1;
  attachLifecycles(input, [item]);
  assert.equal(analyze(input).setup_candidates.length, 0);
});

run('B1 quality failure blocks all setup candidates', () => {
  const input = fixture();
  input.quality_report.status = 'STALE';
  attachLifecycles(input, [lifecycle()]);
  const result = analyze(input);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.setup_candidates.length, 0);
});

run('forming candle cannot enter the closed-candle snapshot', () => {
  const input = fixture();
  input.snapshot.candles_by_timeframe['1h'][24].closed_state = 'FORMING';
  const result = analyze(input);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.setup_candidates.length, 0);
});

run('snapshot mismatch in B2 output blocks analysis', () => {
  const input = fixture();
  input.b2d_result.snapshot_id = 'other-snapshot';
  const result = analyze(input);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.admission.reasons[0].code, 'B7_B2D_BINDING_INVALID');
});

run('unsupported MTF input is not required or used as a directional gate', () => {
  const input = fixture();
  attachLifecycles(input, [lifecycle()]);
  input.b2f_result = { status: 'INVALID', structure_state: 'CONFLICT' };
  const result = analyze(input);
  assert.equal(result.setup_candidates[0].direction, 'LONG');
});

run('duplicate lifecycle identifiers produce only one deterministic candidate', () => {
  const input = fixture();
  attachLifecycles(input, [lifecycle(), lifecycle()]);
  const result = analyze(input);
  assert.equal(result.setup_candidates.length, 1);
  assert.equal(result.setup_candidates[0].setup_id, 'B7:BREAKOUT_RETEST:B2E:event-1:zone-1');
});

run('future candle availability is rejected by finality cutoff', () => {
  const input = fixture();
  input.snapshot.candles_by_timeframe['1h'][24].close_time_ms = AS_OF + STEP;
  const result = analyze(input);
  assert.equal(result.status, 'BLOCKED');
});

run('invalid timeframe scope blocks analysis', () => {
  const input = fixture();
  input.timeframe = '15m';
  const result = analyze(input);
  assert.equal(result.status, 'BLOCKED');
});

run('same input produces byte-stable deterministic output', () => {
  const input = fixture();
  attachLifecycles(input, [lifecycle()]);
  assert.deepEqual(analyze(input), analyze(input));
});

run('trend continuation requires structure, correction, zone intersection and rejection candle', () => {
  const input = fixture();
  const candles = input.snapshot.candles_by_timeframe['1h'];
  candles[22].open = 102; candles[22].high = 102.5; candles[22].close = 101;
  candles[24] = { ...candles[24], open: 101, high: 102.2, low: 98.5, close: 102, volume_base: 15 };
  input.b2c_result.structure_state = 'UP';
  input.b2c_result.protected_level = { price: 97, available_at_ms: 20 * STEP };
  input.b2d_result.zones = [{
    zone_id: 'support-1', role: 'SUPPORT', lower_bound: 100, upper_bound: 101,
    representative_price: 100.5, available_at_ms: 20 * STEP
  }];
  const result = analyze(input);
  assert.equal(result.setup_candidates.length, 1);
  assert.equal(result.setup_candidates[0].setup_type, 'TREND_CONTINUATION_AFTER_CORRECTION');
  assert.equal(result.setup_candidates[0].direction, 'LONG');
  assert.equal(result.setup_candidates[0].status, 'CONFIRMED');
});

run('trend continuation does not appear without a correction candle', () => {
  const input = fixture();
  const candles = input.snapshot.candles_by_timeframe['1h'];
  candles[24] = { ...candles[24], open: 101, high: 102.2, low: 98.5, close: 102 };
  input.b2c_result.structure_state = 'UP';
  input.b2c_result.protected_level = { price: 97, available_at_ms: 20 * STEP };
  input.b2d_result.zones = [{
    zone_id: 'support-1', role: 'SUPPORT', lower_bound: 100, upper_bound: 101,
    representative_price: 100.5, available_at_ms: 20 * STEP
  }];
  assert.equal(analyze(input).setup_candidates.length, 0);
});

run('missing volume history is explicitly unavailable rather than fabricated', () => {
  const input = fixture();
  const candles = input.snapshot.candles_by_timeframe['1h'];
  candles.forEach(candle => { delete candle.volume_base; });
  const result = analyze(input);
  assert.equal(result.latest_candle_features.volume_status, 'VOLUME_MISSING');
  assert.equal(result.latest_candle_features.volume_ratio_20, null);
});
