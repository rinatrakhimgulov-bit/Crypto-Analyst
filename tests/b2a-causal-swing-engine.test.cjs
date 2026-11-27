'use strict';

const assert = require('node:assert/strict');
const { analyze } = require('../src/analysis/b2-causal-swing-engine.js');

const STEP = 3600000;
const LAG = 500;
const POLICY = Object.freeze({
  version: 'b2a-causal-swing-v1',
  b1_quality_policy_version: 'b1-quality-policy-2026-11-27-v1',
  left_strength: 2,
  right_strength: 2,
  finality_safety_lag_ms: LAG,
  price_equality_policy: 'EXACT_PRICE_V1'
});

function makeInput(count = 24, options = {}) {
  const base = Math.floor(1700000000000 / STEP) * STEP;
  const candles = [];
  for (let i = 0; i < count; i++) {
    const open = 7.2;
    const close = 7.4;
    candles.push({
      provider_id: 'bybit-v5-rest',
      venue: 'bybit',
      market_type: 'linear_perpetual',
      canonical_symbol: 'BTC/USDT',
      provider_symbol: 'BTCUSDT',
      timeframe: '1h',
      open_time_ms: base + i * STEP,
      close_time_ms: base + (i + 1) * STEP,
      open, high: 10 + (i % 3) / 10, low: 5 - (i % 3) / 10, close,
      volume_base: 1,
      volume_quote: 7.4,
      closed_state: 'TIME_DERIVED',
      provider_event_time_ms: null,
      received_at_ms: null,
      normalizer_version: 'bybit-rest-v1'
    });
  }
  if (options.highPlateau !== false && count > 6) {
    candles[5].high = 20;
    candles[6].high = 20;
  }
  if (options.lowPlateau !== false && count > 13) {
    candles[12].low = 1;
    candles[13].low = 1;
  }
  const asOf = candles[count - 1].close_time_ms + LAG;
  for (const candle of candles) {
    candle.provider_event_time_ms = asOf;
    candle.received_at_ms = asOf;
  }
  const snapshot = {
    contract_version: '1.1.0',
    snapshot_id: 'fixture:BTCUSDT:1h:' + asOf,
    canonical_symbol: 'BTC/USDT',
    market_type: 'linear_perpetual',
    analysis_as_of_ms: asOf,
    provider_server_time_ms: asOf,
    provider_metadata: {
      provider_id: 'bybit-v5-rest',
      venue: 'bybit',
      provider_symbol: 'BTCUSDT',
      host: 'api.bybit.com',
      time_source: 'provider'
    },
    received_at_ms: asOf,
    candles_by_timeframe: { '1h': candles },
    forming_candle_by_timeframe: { '1h': null },
    unclassified_candles_by_timeframe: { '1h': [] },
    quality_by_timeframe: { '1h': { status: 'UNASSESSED' } },
    aggregate_quality: { status: 'UNASSESSED' }
  };
  const qualityReport = {
    validator_version: '1.1.0',
    policy_version: POLICY.b1_quality_policy_version,
    snapshot_id: snapshot.snapshot_id,
    status: 'VALID',
    reasons: [],
    symbol: snapshot.canonical_symbol,
    timeframe: '1h',
    analysis_as_of_ms: asOf,
    received_at_ms: asOf,
    valid_count: candles.length,
    closed_count: candles.length,
    forming_count: 0,
    unknown_finality_count: 0,
    insufficient_history: false,
    checked_at_ms: asOf
  };
  return {
    snapshot, quality_report: qualityReport, timeframe: '1h',
    analysis_as_of_ms: asOf, policy: POLICY
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

run('detects rightmost plateau representatives with causal timestamps', () => {
  const input = makeInput();
  const result = analyze(input);
  assert.equal(result.status, 'VALID');
  const high = result.pivots.find(p => p.type === 'SWING_HIGH' && p.price === 20);
  const low = result.pivots.find(p => p.type === 'SWING_LOW' && p.price === 1);
  assert.ok(high);
  assert.ok(low);
  assert.equal(high.source_time_ms, input.snapshot.candles_by_timeframe['1h'][6].open_time_ms);
  assert.equal(high.plateau_start_time_ms, input.snapshot.candles_by_timeframe['1h'][5].open_time_ms);
  assert.equal(high.plateau_end_time_ms, input.snapshot.candles_by_timeframe['1h'][6].open_time_ms);
  assert.equal(high.confirmed_at_ms, input.snapshot.candles_by_timeframe['1h'][8].close_time_ms);
  assert.equal(high.available_at_ms, high.confirmed_at_ms + LAG);
  assert.equal(low.source_time_ms, input.snapshot.candles_by_timeframe['1h'][13].open_time_ms);
});

run('an equal-price plateau produces one raw pivot, not duplicates', () => {
  const result = analyze(makeInput());
  assert.equal(result.pivots.filter(p => p.type === 'SWING_HIGH' && p.price === 20).length, 1);
  assert.equal(result.pivots.filter(p => p.type === 'SWING_LOW' && p.price === 1).length, 1);
});

run('prefix replay is invariant for pivots already available at the earlier cutoff', () => {
  const full = makeInput(30);
  const prefix = makeInput(9);
  const early = analyze(prefix);
  const later = analyze(full);
  const earlyPivots = early.pivots.map(p => p.pivot_id).sort();
  const laterAvailable = later.pivots.filter(p => p.available_at_ms <= prefix.analysis_as_of_ms).map(p => p.pivot_id).sort();
  assert.deepEqual(laterAvailable, earlyPivots);
});

run('non-VALID quality blocks the engine', () => {
  const input = makeInput();
  input.quality_report.status = 'STALE';
  const result = analyze(input);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.pivots.length, 0);
});

run('mismatched quality report identity is rejected', () => {
  const input = makeInput();
  input.quality_report.snapshot_id = 'another-snapshot';
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'QUALITY_REPORT_IDENTITY_MISMATCH');
});

run('forming candles are not analyzed and overlap is rejected', () => {
  const input = makeInput();
  input.snapshot.forming_candle_by_timeframe['1h'] = { ...input.snapshot.candles_by_timeframe['1h'][0] };
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'FORMING_OR_UNKNOWN_CANDLE_OVERLAPS_CLOSED_SET');
});

run('closed candle beyond the provider cutoff is rejected', () => {
  const input = makeInput();
  input.snapshot.candles_by_timeframe['1h'][0].close_time_ms += STEP;
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'CANDLE_DURATION_INVALID');
});

run('insufficient pivot history is explicit', () => {
  const input = makeInput(4, { highPlateau: false, lowPlateau: false });
  const result = analyze(input);
  assert.equal(result.status, 'INSUFFICIENT');
  assert.equal(result.admission.reasons[0].code, 'INSUFFICIENT_PIVOT_HISTORY');
});

run('input snapshot is not mutated', () => {
  const input = makeInput();
  const before = JSON.stringify(input);
  analyze(input);
  assert.equal(JSON.stringify(input), before);
});

run('unsupported equality policy fails closed', () => {
  const input = makeInput();
  input.policy = { ...POLICY, price_equality_policy: 'FLOAT_TOLERANCE_MAGIC' };
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'PRICE_EQUALITY_POLICY_UNSUPPORTED');
});
