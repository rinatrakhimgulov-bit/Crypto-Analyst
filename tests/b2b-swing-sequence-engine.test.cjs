'use strict';

const assert = require('node:assert/strict');
const { analyze } = require('../src/analysis/b2b-swing-sequence-engine.js');
const { analyze: analyzeB2A } = require('../src/analysis/b2-causal-swing-engine.js');

const POLICY = Object.freeze({
  version: 'b2b-swing-sequence-v3',
       same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
  b2a_engine_version: '2.0.0-b2a',
  b2a_policy_version: 'b2a-causal-swing-v1',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: 'b1-quality-v1',
  price_equality_policy: 'EXACT_PRICE_V1',
  same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1'
});

function pivot(id, type, price, availableAt, sourceTime = Math.max(1, availableAt - 1500)) {
  return {
    pivot_id: id,
    type,
    price,
    source_time_ms: sourceTime,
    confirmed_at_ms: availableAt - 500,
    available_at_ms: availableAt,
    confirmation: { equality_policy: 'EXACT_PRICE_V1' }
  };
}

function makeInput(pivots = []) {
  const snapshotId = 'fixture:BTCUSDT:1h:10000';
  return {
    policy: POLICY,
    b2a_result: {
      engine_version: '2.0.0-b2a',
      policy_version: 'b2a-causal-swing-v1',
      status: 'VALID',
      admission: {
        status: 'ADMITTED',
        snapshot_id: snapshotId,
        quality_report: { snapshot_id: snapshotId, validator_version: '1.1.0', policy_version: 'b1-quality-v1', checked_at_ms: 9000 }
      },
      snapshot_id: snapshotId,
      symbol: 'BTC/USDT',
      timeframe: '1h',
      analysis_as_of_ms: 10000,
      parameters: { price_equality_policy: 'EXACT_PRICE_V1' },
      pivots
    }
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

run('labels alternating highs and lows against the prior same-side pivot', () => {
  const input = makeInput([
    pivot('h1', 'SWING_HIGH', 100, 1000),
    pivot('l1', 'SWING_LOW', 90, 2000),
    pivot('h2', 'SWING_HIGH', 110, 3000),
    pivot('l2', 'SWING_LOW', 95, 4000),
    pivot('h3', 'SWING_HIGH', 105, 5000)
  ]);
  const result = analyze(input);
  assert.equal(result.status, 'VALID');
  assert.deepEqual(result.sequence.map(p => p.structure_label), [
    'INITIAL_HIGH', 'INITIAL_LOW', 'HH', 'HL', 'LH'
  ]);
  assert.equal(result.sequence[2].comparison_pivot_id, 'h1');
  assert.equal(result.sequence[3].comparison_pivot_id, 'l1');
});

run('a more extreme same-side high replaces the active sequence high but preserves raw evidence', () => {
  const result = analyze(makeInput([
    pivot('h1', 'SWING_HIGH', 100, 1000),
    pivot('h2', 'SWING_HIGH', 110, 2000),
    pivot('l1', 'SWING_LOW', 90, 3000),
    pivot('h3', 'SWING_HIGH', 120, 4000)
  ]));
  assert.deepEqual(result.sequence.map(p => p.pivot_id), ['h2', 'l1', 'h3']);
  assert.equal(result.raw_pivots[0].sequence_status, 'SUPERSEDED_FOR_SEQUENCE');
  assert.equal(result.raw_pivots[0].superseded_by, 'h2');
  assert.equal(result.sequence[2].structure_label, 'HH');
  assert.equal(result.sequence[2].comparison_pivot_id, 'h2');
});

run('a less extreme same-side high is retained as raw evidence but excluded from sequence', () => {
  const result = analyze(makeInput([
    pivot('h1', 'SWING_HIGH', 100, 1000),
    pivot('h2', 'SWING_HIGH', 110, 2000),
    pivot('h3', 'SWING_HIGH', 105, 3000)
  ]));
  assert.deepEqual(result.sequence.map(p => p.pivot_id), ['h2']);
  assert.equal(result.raw_pivots[0].sequence_status, 'SUPERSEDED_FOR_SEQUENCE');
  assert.equal(result.raw_pivots[2].sequence_status, 'SUPERSEDED_FOR_SEQUENCE');
  assert.equal(result.raw_pivots[2].superseded_by, 'h2');
});

run('same-side low replacement is symmetric and retains the lower low', () => {
  const result = analyze(makeInput([
    pivot('l1', 'SWING_LOW', 90, 1000),
    pivot('l2', 'SWING_LOW', 80, 2000),
    pivot('h1', 'SWING_HIGH', 110, 3000),
    pivot('l3', 'SWING_LOW', 70, 4000)
  ]));
  assert.deepEqual(result.sequence.map(p => p.pivot_id), ['l2', 'h1', 'l3']);
  assert.equal(result.sequence[2].structure_label, 'LL');
  assert.equal(result.sequence[2].comparison_pivot_id, 'l2');
});

run('a higher same-side low is superseded by the earlier lower low', () => {
  const result = analyze(makeInput([
    pivot('l1', 'SWING_LOW', 80, 1000),
    pivot('l2', 'SWING_LOW', 90, 2000)
  ]));
  assert.deepEqual(result.sequence.map(p => p.pivot_id), ['l1']);
  assert.equal(result.raw_pivots[1].sequence_status, 'SUPERSEDED_FOR_SEQUENCE');
  assert.equal(result.raw_pivots[1].superseded_by, 'l1');
});

run('exact equality retains the earlier same-side pivot', () => {
  const result = analyze(makeInput([
    pivot('h1', 'SWING_HIGH', 100, 1000),
    pivot('h2', 'SWING_HIGH', 100, 2000)
  ]));
  assert.deepEqual(result.sequence.map(p => p.pivot_id), ['h1']);
  assert.equal(result.raw_pivots[1].superseded_by, 'h1');
});

run('availability order is preserved even when source times are not chronological', () => {
  const result = analyze(makeInput([
    pivot('h-late-source', 'SWING_HIGH', 100, 1000, 400),
    pivot('l-early-source', 'SWING_LOW', 90, 2000, 300)
  ]));
  assert.deepEqual(result.sequence.map(p => p.pivot_id), ['h-late-source', 'l-early-source']);
  assert.equal(result.sequence_order_basis, 'B2A_AVAILABLE_AT_ORDER_STABLE_EXCLUDING_DUAL_PIVOTS');
});

run('non-monotonic availability order fails closed instead of silently reordering', () => {
  const result = analyze(makeInput([
    pivot('h1', 'SWING_HIGH', 100, 2000),
    pivot('l1', 'SWING_LOW', 90, 1000)
  ]));
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'B2A_PIVOT_AVAILABILITY_ORDER_INVALID');
});

run('same-candle high and low pivots remain raw but are excluded from the sequence', () => {
  const sourceTime = 1500;
  const result = analyze(makeInput([
    pivot('dual-high', 'SWING_HIGH', 110, 3000, sourceTime),
    pivot('dual-low', 'SWING_LOW', 90, 4000, sourceTime),
    pivot('later-high', 'SWING_HIGH', 115, 5000, 3500)
  ]));
  assert.equal(result.status, 'VALID');
  assert.deepEqual(result.sequence.map(p => p.pivot_id), ['later-high']);
  assert.equal(result.raw_pivots[0].sequence_status, 'AMBIGUOUS_FOR_SEQUENCE');
  assert.equal(result.raw_pivots[1].sequence_status, 'AMBIGUOUS_FOR_SEQUENCE');
  assert.equal(result.raw_pivots[0].exclusion_reason, 'SIMULTANEOUS_HIGH_LOW_SAME_SOURCE_CANDLE');
  assert.equal(result.diagnostics.ambiguous_dual_pivot_count, 2);
});

run('non-VALID B2-A input blocks and emits no sequence', () => {
  const input = makeInput([pivot('h1', 'SWING_HIGH', 100, 1000)]);
  input.b2a_result.status = 'BLOCKED';
  const result = analyze(input);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.sequence.length, 0);
});

run('B2-A engine and policy identities must match exactly', () => {
  const input = makeInput([pivot('h1', 'SWING_HIGH', 100, 1000)]);
  input.b2a_result.engine_version = '2.0.1-b2a';
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'B2A_ADMISSION_IDENTITY_MISMATCH');
});

run('duplicate pivot IDs are rejected', () => {
  const result = analyze(makeInput([
    pivot('same', 'SWING_HIGH', 100, 1000),
    pivot('same', 'SWING_LOW', 90, 2000)
  ]));
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'PIVOT_ID_DUPLICATE');
});

run('invalid pivot causal timestamps are rejected', () => {
  const p = pivot('h1', 'SWING_HIGH', 100, 1000);
  p.available_at_ms = 400;
  const result = analyze(makeInput([p]));
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'PIVOT_CAUSAL_TIME_INVALID');
});

run('invalid pivot type and price are rejected', () => {
  const badType = pivot('x1', 'OTHER', 100, 1000);
  const typeResult = analyze(makeInput([badType]));
  assert.equal(typeResult.admission.reasons[0].code, 'PIVOT_TYPE_INVALID');
  const badPrice = pivot('x2', 'SWING_HIGH', 0, 1000);
  const priceResult = analyze(makeInput([badPrice]));
  assert.equal(priceResult.admission.reasons[0].code, 'PIVOT_PRICE_INVALID');
});

run('comparison delta and relative percentage are explicit', () => {
  const result = analyze(makeInput([
    pivot('h1', 'SWING_HIGH', 100, 1000),
    pivot('l1', 'SWING_LOW', 90, 2000),
    pivot('h2', 'SWING_HIGH', 105, 3000)
  ]));
  assert.equal(result.sequence[2].price_delta, 5);
  assert.equal(result.sequence[2].relative_delta_pct, 5);
});

run('result and nested pivot evidence are deeply immutable', () => {
  const result = analyze(makeInput([
    pivot('h1', 'SWING_HIGH', 100, 1000),
    pivot('l1', 'SWING_LOW', 90, 2000)
  ]));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.raw_pivots));
  assert.ok(Object.isFrozen(result.raw_pivots[0]));
  assert.ok(Object.isFrozen(result.raw_pivots[0].confirmation));
  assert.ok(Object.isFrozen(result.sequence));
});

run('analysis does not mutate B2-A input', () => {
  const input = makeInput([
    pivot('h1', 'SWING_HIGH', 100, 1000),
    pivot('l1', 'SWING_LOW', 90, 2000)
  ]);
  const before = JSON.stringify(input);
  analyze(input);
  assert.equal(JSON.stringify(input), before);
});

run('same input and policy produce deterministic output', () => {
  const input = makeInput([
    pivot('h1', 'SWING_HIGH', 100, 1000),
    pivot('l1', 'SWING_LOW', 90, 2000),
    pivot('h2', 'SWING_HIGH', 110, 3000)
  ]);
  assert.deepEqual(analyze(input), analyze(input));
});

run('empty valid B2-A pivot set returns an empty valid sequence', () => {
  const result = analyze(makeInput([]));
  assert.equal(result.status, 'VALID');
  assert.equal(result.raw_pivots.length, 0);
  assert.equal(result.sequence.length, 0);
});


run('output freezing does not freeze nested objects owned by B2-A input', () => {
  const input = makeInput([
    pivot('h1', 'SWING_HIGH', 100, 3000),
    pivot('l1', 'SWING_LOW', 90, 4000)
  ]);
  const sourceConfirmation = input.b2a_result.pivots[0].confirmation;
  const sourceQualityReport = input.b2a_result.admission.quality_report;
  const result = analyze(input);
  assert.equal(Object.isFrozen(sourceConfirmation), false);
  assert.equal(Object.isFrozen(sourceQualityReport), false);
  assert.ok(Object.isFrozen(result.raw_pivots[0].confirmation));
  assert.ok(Object.isFrozen(result.admission.b2a_quality_report));
});


run('B2-A to B2-B integration preserves causal swing sequence labels', () => {
  const step = 3600000;
  const lag = 500;
  const base = Math.floor(1700000000000 / step) * step;
  const candles = [];
  for (let i = 0; i < 20; i++) {
    candles.push({
      provider_id: 'bybit-v5-rest',
      venue: 'bybit',
      market_type: 'linear_perpetual',
      canonical_symbol: 'BTC/USDT',
      provider_symbol: 'BTCUSDT',
      timeframe: '1h',
      open_time_ms: base + i * step,
      close_time_ms: base + (i + 1) * step,
      open: 9.5,
      high: 10,
      low: 9,
      close: 9.7,
      volume_base: 1,
      volume_quote: 9.7,
      closed_state: 'TIME_DERIVED',
      provider_event_time_ms: null,
      received_at_ms: null,
      normalizer_version: 'bybit-rest-v1'
    });
  }
  candles[2].high = 12;
  candles[6].high = 14;
  candles[10].high = 13;
  candles[4].low = 7;
  candles[8].low = 8;
  candles[12].low = 6;
  const asOf = candles[19].close_time_ms + lag;
  for (const candle of candles) {
    candle.provider_event_time_ms = asOf;
    candle.received_at_ms = asOf;
  }
  const snapshotId = 'integration:BTCUSDT:1h:' + asOf;
  const snapshot = {
    contract_version: '1.1.0',
    snapshot_id: snapshotId,
    canonical_symbol: 'BTC/USDT',
    market_type: 'linear_perpetual',
    analysis_as_of_ms: asOf,
    provider_server_time_ms: asOf,
    provider_metadata: { provider_id: 'bybit-v5-rest', venue: 'bybit', provider_symbol: 'BTCUSDT', host: 'api.bybit.com', time_source: 'provider' },
    received_at_ms: asOf,
    candles_by_timeframe: { '1h': candles },
    forming_candle_by_timeframe: { '1h': null },
    unclassified_candles_by_timeframe: { '1h': [] }
  };
  const qualityReport = {
    validator_version: '1.1.0',
    policy_version: 'b1-quality-policy-2026-11-27-v1',
    snapshot_id: snapshotId,
    status: 'VALID',
    symbol: 'BTC/USDT',
    timeframe: '1h',
    analysis_as_of_ms: asOf,
    valid_count: candles.length,
    closed_count: candles.length,
    insufficient_history: false,
    checked_at_ms: asOf
  };
  const b2a = analyzeB2A({
    snapshot,
    quality_report: qualityReport,
    timeframe: '1h',
    analysis_as_of_ms: asOf,
    policy: {
      version: 'b2a-causal-swing-v1',
      b1_contract_version: '1.1.0',
      b1_validator_version: '1.1.0',
      b1_quality_policy_version: 'b1-quality-policy-2026-11-27-v1',
      left_strength: 2,
      right_strength: 2,
      finality_safety_lag_ms: lag,
      price_equality_policy: 'EXACT_PRICE_V1'
    }
  });
  assert.equal(b2a.status, 'VALID');
  const b2b = analyze({
    b2a_result: b2a,
    policy: {
      version: 'b2b-swing-sequence-v3',
       same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
      b2a_engine_version: '2.0.0-b2a',
      b2a_policy_version: 'b2a-causal-swing-v1',
      b1_validator_version: '1.1.0',
      b1_quality_policy_version: 'b1-quality-policy-2026-11-27-v1',
      price_equality_policy: 'EXACT_PRICE_V1'
    }
  });
  assert.equal(b2b.status, 'VALID');
  assert.deepEqual(b2b.sequence.map(p => p.structure_label), [
    'INITIAL_HIGH', 'INITIAL_LOW', 'HH', 'HL', 'LH', 'LL'
  ]);
});
