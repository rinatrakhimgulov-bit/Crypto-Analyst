'use strict';

const assert = require('node:assert/strict');
const { analyze } = require('../src/analysis/b2e-breakout-quality-engine.js');

const STEP = 3600000;
const LAG = 500;
const POLICY = Object.freeze({
  version: 'b2e-breakout-quality-v1',
  b2e_engine_version: '2.0.0-b2e',
  b2e_policy_version: 'b2e-retest-engine-v1',
  b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: 'b1-quality-v1',
  finality_safety_lag_ms: LAG,
  atr_period: 14,
  volume_lookback: 20,
  volume_field: 'volume_base',
  volume_expansion_min_ratio: 1.5,
  range_expansion_min_atr: 1.2,
  directional_body_min_ratio: 0.5,
  close_location_min: 0.7
});
function candle(i, values = {}) {
  const openTime = (i + 1) * STEP;
  const open = values.open ?? 105;
  const close = values.close ?? 105;
  const high = values.high ?? 106;
  const low = values.low ?? 104;
  return {
    open_time_ms: openTime, close_time_ms: openTime + STEP,
    canonical_symbol: 'BTCUSDT', market_type: 'LINEAR_PERPETUAL', timeframe: '1h',
    open, high, low, close, volume_base: values.volume ?? 100,
    volume_quote: (values.volume ?? 100) * close,
    closed_state: 'CONFIRMED'
  };
}
function fixture(options = {}) {
  const candles = Array.from({ length: 45 }, (_, i) => candle(i));
  const breakIndex = options.breakIndex ?? 30;
  candles[breakIndex] = candle(breakIndex, options.breakCandle || {
    open: 105, high: 116, low: 104, close: 114, volume: 200
  });
  const asOf = candles[candles.length - 1].close_time_ms + LAG;
  const snapshot = {
    snapshot_id: 'fixture:b2e-breakout-quality:btc:1h',
    contract_version: '1.1.0',
    canonical_symbol: 'BTCUSDT',
    market_type: 'LINEAR_PERPETUAL',
    analysis_as_of_ms: asOf,
    provider_server_time_ms: asOf,
    provider_metadata: { time_source: 'provider' },
    candles_by_timeframe: { '1h': candles }
  };
  const report = {
    status: 'VALID', snapshot_id: snapshot.snapshot_id,
    symbol: snapshot.canonical_symbol, timeframe: '1h',
    analysis_as_of_ms: asOf, checked_at_ms: asOf - 100,
    validator_version: '1.1.0', policy_version: 'b1-quality-v1',
    closed_count: candles.length, valid_count: candles.length,
    insufficient_history: false
  };
  const zone = options.zone || {
    role: 'RESISTANCE', lower_bound: 110, upper_bound: 111
  };
  const lifecycle = {
    lifecycle_id: 'B2E:break-1:zone-1',
    breakout_event_id: 'break-1',
    direction: options.direction || 'BULLISH',
    breakout_candle_open_time_ms: candles[breakIndex].open_time_ms,
    breakout_candle_close_time_ms: candles[breakIndex].close_time_ms,
    breakout_available_at_ms: candles[breakIndex].close_time_ms + LAG,
    historical_zone: zone,
    status: 'WAITING_RETEST'
  };
  const b2e = {
    status: 'VALID', engine_version: '2.0.0-b2e',
    policy_version: 'b2e-retest-engine-v1',
    snapshot_id: snapshot.snapshot_id, symbol: snapshot.canonical_symbol,
    timeframe: '1h', analysis_as_of_ms: asOf,
    admission: { status: 'ADMITTED', snapshot_id: snapshot.snapshot_id },
    lifecycles: [lifecycle]
  };
  return {
    policy: { ...POLICY, ...(options.policy || {}) },
    snapshot,
    quality_report: { ...report, ...(options.report || {}) },
    b2e_result: { ...b2e, ...(options.b2e || {}) },
    analysis_as_of_ms: asOf, timeframe: '1h'
  };
}
function run(name, fn) {
  try {
    fn();
    process.stdout.write('PASS ' + name + '\n');
  } catch (error) {
    process.stderr.write('FAIL ' + name + ': ' + error.message + '\n');
    process.exitCode = 1;
  }
}

run('uses only candles before the breakout to calculate ATR and volume baseline', () => {
  const result = analyze(fixture());
  const item = result.breakouts[0];
  assert.equal(result.status, 'VALID');
  assert.ok(item.metrics.atr_before_break > 0);
  assert.equal(item.metrics.volume_ratio, 2);
  assert.equal(item.quality_status, 'STRONG_EVIDENCE');
});
run('classifies a bearish breakout with direction-aware close quality', () => {
  const result = analyze(fixture({
    direction: 'BEARISH',
    zone: { role: 'SUPPORT', lower_bound: 99, upper_bound: 100 },
    breakCandle: { open: 105, high: 106, low: 94, close: 95, volume: 200 }
  }));
  assert.equal(result.breakouts[0].quality_status, 'STRONG_EVIDENCE');
  assert.equal(result.breakouts[0].evidence_flags.close_quality, true);
});
run('weak volume, small body and poor close location produce weak evidence', () => {
  const result = analyze(fixture({
    breakCandle: { open: 113, high: 119, low: 104, close: 113.2, volume: 50 }
  }));
  assert.equal(result.breakouts[0].evidence_flags.volume_expansion, false);
  assert.equal(result.breakouts[0].evidence_flags.directional_body, false);
  assert.equal(result.breakouts[0].evidence_flags.close_quality, false);
  assert.equal(result.breakouts[0].quality_status, 'WEAK_EVIDENCE');
});
run('two positive evidence flags are reported as mixed, not strong', () => {
  const result = analyze(fixture({
    breakCandle: { open: 105, high: 116, low: 104, close: 112, volume: 100 }
  }));
  assert.equal(result.breakouts[0].quality_status, 'MIXED_EVIDENCE');
});
run('missing volume is marked unavailable rather than silently treated as zero', () => {
  const input = fixture();
  delete input.snapshot.candles_by_timeframe['1h'][30].volume_base;
  const result = analyze(input);
  assert.equal(result.breakouts[0].evidence_flags.volume_expansion, null);
  assert.equal(result.breakouts[0].evidence_available_count, 3);
});
run('insufficient pre-break history yields partial evidence without using future candles', () => {
  const result = analyze(fixture({ breakIndex: 10 }));
  assert.equal(result.breakouts[0].metrics.atr_before_break, null);
  assert.equal(result.breakouts[0].evidence_flags.range_expansion, null);
  assert.equal(result.breakouts[0].quality_status, 'PARTIAL_EVIDENCE');
});
run('zero prior volume baseline is unavailable', () => {
  const input = fixture();
  for (let i = 10; i < 30; i++) input.snapshot.candles_by_timeframe['1h'][i].volume_base = 0;
  const result = analyze(input);
  assert.equal(result.breakouts[0].evidence_flags.volume_expansion, null);
});
run('B1 quality identity mismatch fails closed', () => {
  const result = analyze(fixture({ report: { snapshot_id: 'other' } }));
  assert.equal(result.status, 'BLOCKED');
});
run('B2-E identity mismatch fails closed', () => {
  const result = analyze(fixture({ b2e: { snapshot_id: 'other' } }));
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.admission.reasons[0].code, 'B2E_RESULT_IDENTITY_MISMATCH');
});
run('breakout candle timestamp mismatch fails closed', () => {
  const input = fixture();
  input.b2e_result.lifecycles[0].breakout_candle_close_time_ms += STEP;
  const result = analyze(input);
  assert.equal(result.status, 'BLOCKED');
});
run('a bullish lifecycle cannot be paired with a support zone', () => {
  const result = analyze(fixture({ zone: { role: 'SUPPORT', lower_bound: 99, upper_bound: 100 } }));
  assert.equal(result.status, 'BLOCKED');
});
run('a forming candle fails closed', () => {
  const input = fixture();
  input.snapshot.candles_by_timeframe['1h'][44].closed_state = 'FORMING';
  const result = analyze(input);
  assert.equal(result.status, 'BLOCKED');
});
run('candle gaps fail closed', () => {
  const input = fixture();
  input.snapshot.candles_by_timeframe['1h'][12].open_time_ms += STEP;
  const result = analyze(input);
  assert.equal(result.status, 'BLOCKED');
});
run('invalid policy fails closed', () => {
  const result = analyze(fixture({ policy: { close_location_min: 0.4 } }));
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.admission.reasons[0].code, 'B2E_BREAKOUT_QUALITY_POLICY_INVALID');
});
run('results are immutable and inputs are not mutated', () => {
  const input = fixture();
  const before = JSON.stringify(input);
  const result = analyze(input);
  assert.equal(JSON.stringify(input), before);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.breakouts));
  assert.ok(Object.isFrozen(result.breakouts[0].metrics));
});
run('identical inputs produce deterministic evidence classification', () => {
  const input = fixture();
  assert.deepEqual(analyze(input), analyze(input));
});

if (process.exitCode) process.exit(process.exitCode);
