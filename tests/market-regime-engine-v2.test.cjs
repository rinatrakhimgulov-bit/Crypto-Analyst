const test = require('node:test');
const assert = require('node:assert/strict');
const MarketRegimeEngine = require('../src/analysis/market-regime-engine-v2.js');

const HOUR = 3600000;
const AS_OF = 1800000000000;
const POLICY = Object.freeze({
  version: 'market-regime-policy-v2-local-consolidation',
  b1_contract_version: '1.0.0',
  b1_validator_version: '1.0.0',
  b1_quality_policy_version: 'b1-quality-policy-test-v1',
  structure_engine_version: '2.1.0-b2c',
  structure_policy_version: 'b2c-state-v2',
  finality_safety_lag_ms: 500,
  ema_fast_period: 20,
  ema_mid_period: 50,
  ema_slow_period: 200,
  atr_period: 14,
  slope_lookback: 10,
  range_lookback: 20,
  impulse_lookback: 5,
  trend_min_ema50_slope_atr: 0.2,
  trend_min_ema200_slope_atr: 0.08,
  trend_min_fast_mid_spread_atr: 0.05,
  trend_min_mid_slow_spread_atr: 0.1,
  range_max_width_atr: 5,
  range_max_ema50_slope_atr: 0.12,
  range_max_fast_mid_spread_atr: 0.5,
  impulse_min_move_atr: 2.5,
  impulse_min_range_expansion: 1.25
});

function buildCandles(mode, count = 240) {
  const candles = [];
  let previous = 100;
  for (let i = 0; i < count; i++) {
    let close;
    if (mode === 'up') close = 100 + i * 0.22;
    else if (mode === 'down') close = 160 - i * 0.22;
    else if (mode === 'range') close = 120 + Math.sin(i * 1.7) * 0.45;
    else if (mode === 'impulse') close = i < count - 5 ? 100 + i * 0.01 : previous + 1.8;
    else close = 100 + Math.sin(i) * 0.2;
    const open = previous;
    const high = Math.max(open, close) + 0.35;
    const low = Math.min(open, close) - 0.35;
    const openTime = Math.floor(1700000000000 / HOUR) * HOUR + i * HOUR;
    candles.push({
      canonical_symbol: 'BTCUSDT', market_type: 'linear_perpetual', timeframe: '1h',
      open_time_ms: openTime, close_time_ms: openTime + HOUR,
      open, high, low, close, volume_base: 100 + (i % 7), volume_quote: 10000 + (i % 7) * 100,
      closed_state: 'CONFIRMED'
    });
    previous = close;
  }
  return candles;
}

function fixture(mode, structureState = 'UP', count = 240) {
  const candles = buildCandles(mode, count);
  const snapshotId = 'snapshot-' + mode + '-' + structureState + '-' + count;
  const snapshot = {
    snapshot_id: snapshotId,
    contract_version: POLICY.b1_contract_version,
    canonical_symbol: 'BTCUSDT',
    market_type: 'linear_perpetual',
    analysis_as_of_ms: AS_OF,
    provider_server_time_ms: AS_OF,
    provider_metadata: { time_source: 'provider' },
    candles_by_timeframe: { '1h': candles },
    forming_candle_by_timeframe: { '1h': null },
    unclassified_candles_by_timeframe: { '1h': [] }
  };
  const qualityReport = {
    status: 'VALID', snapshot_id: snapshotId, symbol: 'BTCUSDT', timeframe: '1h',
    analysis_as_of_ms: AS_OF, validator_version: POLICY.b1_validator_version,
    policy_version: POLICY.b1_quality_policy_version, checked_at_ms: AS_OF - 1000,
    closed_count: candles.length, valid_count: candles.length, insufficient_history: false
  };
  const structure = structureState === null ? null : {
    engine_version: '2.1.0-b2c', policy_version: 'b2c-state-v2',
    status: 'VALID', snapshot_id: snapshotId, symbol: 'BTCUSDT', timeframe: '1h',
    analysis_as_of_ms: AS_OF, structure_state: structureState,
    admission: { status: 'ADMITTED', snapshot_id: snapshotId }
  };
  return { snapshot, qualityReport, structure, candles };
}

function run(data, policy = POLICY) {
  return MarketRegimeEngine.analyze({
    snapshot: data.snapshot,
    quality_report: data.qualityReport,
    structure_result: data.structure,
    policy,
    timeframe: '1h',
    analysis_as_of_ms: data.snapshot.analysis_as_of_ms
  });
}

test('identifies bullish trend only when EMA stack and causal structure agree', () => {
  const result = run(fixture('up', 'UP'));
  assert.equal(result.status, 'VALID');
  assert.equal(result.regime, 'UPTREND');
  assert.equal(result.directional_bias, 'BULLISH');
  assert.equal(result.evidence_alignment, 'CONVERGENT');
});

test('identifies bearish trend only when EMA stack and causal structure agree', () => {
  const result = run(fixture('down', 'DOWN'));
  assert.equal(result.regime, 'DOWNTREND');
  assert.equal(result.directional_bias, 'BEARISH');
});

test('identifies compressed range when trend and structure are unestablished', () => {
  const result = run(fixture('range', 'UNESTABLISHED'));
  assert.equal(result.regime, 'RANGE');
  assert.equal(result.regime_scope, 'MARKET_RANGE');
  assert.equal(result.directional_bias, 'NEUTRAL');
});

test('identifies directional impulse as a separate regime', () => {
  const result = run(fixture('impulse', 'UP'));
  assert.equal(result.regime, 'IMPULSE');
  assert.equal(result.directional_bias, 'BULLISH');
});

test('conflicting EMA direction and structure degrades to transition', () => {
  const result = run(fixture('up', 'DOWN'));
  assert.equal(result.regime, 'TRANSITION');
  assert.equal(result.directional_bias, 'NEUTRAL');
  assert.ok(result.reasons.includes('STRUCTURE_EMA_CONFLICT'));
});

test('missing structure cannot be promoted to a confirmed trend', () => {
  const result = run(fixture('up', null));
  assert.equal(result.regime, 'TRANSITION');
  assert.ok(result.reasons.includes('STRUCTURE_NOT_PROVIDED'));
});

test('non-VALID quality report blocks regime classification', () => {
  const data = fixture('up', 'UP');
  data.qualityReport.status = 'STALE';
  const result = run(data);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.regime, 'UNKNOWN');
  assert.equal(result.directional_bias, 'NONE');
});

test('insufficient closed history returns INSUFFICIENT without guessing', () => {
  const result = run(fixture('up', 'UP', 150));
  assert.equal(result.status, 'INSUFFICIENT');
  assert.equal(result.regime, 'UNKNOWN');
});

test('forming candle is excluded and does not change the result', () => {
  const data = fixture('up', 'UP');
  const baseline = run(data);
  data.snapshot.forming_candle_by_timeframe['1h'] = {
    ...data.candles.at(-1), open_time_ms: AS_OF, close_time_ms: AS_OF + HOUR,
    closed_state: 'FORMING', open: 1, high: 100000, low: 1, close: 99999
  };
  const withForming = run(data);
  assert.equal(withForming.regime, baseline.regime);
  assert.deepEqual(withForming.features, baseline.features);
  assert.equal(withForming.diagnostics.forming_candle_excluded, true);
});

test('rejects candle provenance mismatch', () => {
  const data = fixture('up', 'UP');
  data.candles[10].canonical_symbol = 'ETHUSDT';
  const result = run(data);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.regime, 'UNKNOWN');
});

test('rejects a structure result from another snapshot', () => {
  const data = fixture('up', 'UP');
  data.structure.snapshot_id = 'other-snapshot';
  const result = run(data);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.admission.reasons[0].code.includes('STRUCTURE_RESULT'));
});

test('rejects a forming candle incorrectly inserted into the closed series', () => {
  const data = fixture('up', 'UP');
  data.candles.at(-1).closed_state = 'FORMING';
  const result = run(data);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.regime, 'UNKNOWN');
});

test('rejects invalid policy thresholds and EMA ordering', () => {
  const badThreshold = { ...POLICY, impulse_min_move_atr: 0 };
  assert.equal(run(fixture('up', 'UP'), badThreshold).status, 'INVALID');
  const badOrder = { ...POLICY, ema_fast_period: 60 };
  assert.equal(run(fixture('up', 'UP'), badOrder).status, 'INVALID');
});

test('returns deeply immutable output and does not mutate inputs', () => {
  const data = fixture('up', 'UP');
  const before = JSON.stringify(data);
  const result = run(data);
  assert.equal(JSON.stringify(data), before);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.features), true);
  assert.equal(Object.isFrozen(result.reasons), true);
});

test('rejects quality report bound to a different snapshot', () => {
  const data = fixture('up', 'UP');
  data.qualityReport.snapshot_id = 'different-snapshot';
  const result = run(data);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.regime, 'UNKNOWN');
});

test('rejects a candle that is not final at the declared analysis cutoff', () => {
  const data = fixture('up', 'UP');
  const cutoff = data.candles.at(-1).close_time_ms + 250;
  data.snapshot.analysis_as_of_ms = cutoff;
  data.snapshot.provider_server_time_ms = cutoff;
  data.qualityReport.analysis_as_of_ms = cutoff;
  data.structure.analysis_as_of_ms = cutoff;
  const result = run(data);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.admission.reasons[0].code.includes('NOT_FINAL'));
});

test('rejects a missing interval instead of silently calculating across a gap', () => {
  const data = fixture('up', 'UP');
  data.candles[100].open_time_ms += HOUR;
  data.candles[100].close_time_ms += HOUR;
  const result = run(data);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.admission.reasons[0].code.includes('ORDER_GAP'));
});

test('rejects a structure engine version mismatch', () => {
  const data = fixture('up', 'UP');
  data.structure.engine_version = '0.0.0';
  const result = run(data);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.admission.reasons[0].code.includes('STRUCTURE_RESULT'));
});


test('zero ATR returns UNKNOWN instead of emitting non-finite features', () => {
  const data = fixture('range', 'UNESTABLISHED');
  for (const candle of data.candles) {
    candle.open = 100;
    candle.high = 100;
    candle.low = 100;
    candle.close = 100;
  }
  const result = run(data);
  assert.equal(result.status, 'INSUFFICIENT');
  assert.equal(result.regime, 'UNKNOWN');
  assert.equal(result.features, null);
});


test('identifies local consolidation while causal structure remains UP', () => {
  const result = run(fixture('range', 'UP'));
  assert.equal(result.regime, 'RANGE');
  assert.equal(result.regime_scope, 'LOCAL_CONSOLIDATION');
  assert.equal(result.structure_state, 'UP');
  assert.equal(result.directional_bias, 'NEUTRAL');
  assert.equal(result.evidence_alignment, 'PARTIAL');
  assert.ok(result.reasons.includes('RESIDUAL_STRUCTURE_UP'));
});

test('identifies local consolidation while causal structure remains DOWN', () => {
  const result = run(fixture('range', 'DOWN'));
  assert.equal(result.regime, 'RANGE');
  assert.equal(result.regime_scope, 'LOCAL_CONSOLIDATION');
  assert.equal(result.structure_state, 'DOWN');
  assert.ok(result.reasons.includes('RESIDUAL_STRUCTURE_DOWN'));
});

test('strong aligned trend takes precedence over local range thresholds', () => {
  const result = run(fixture('up', 'UP'));
  assert.equal(result.regime, 'UPTREND');
  assert.equal(result.regime_scope, 'MARKET_TREND');
});
