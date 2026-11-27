'use strict';

const assert = require('node:assert/strict');
const { analyze } = require('../src/analysis/b2b-swing-sequence-engine.js');

const POLICY = Object.freeze({
  version: 'b2b-swing-sequence-v1',
  b2a_engine_version: '2.0.0-b2a',
  b2a_policy_version: 'b2a-causal-swing-v1',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: 'b1-quality-v1',
  price_equality_policy: 'EXACT_PRICE_V1'
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
        quality_report: { snapshot_id: snapshotId, validator_version: '1.1.0', policy_version: 'b1-quality-v1' }
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
  assert.equal(result.sequence_order_basis, 'B2A_AVAILABLE_AT_ORDER_STABLE');
});

run('non-monotonic availability order fails closed instead of silently reordering', () => {
  const result = analyze(makeInput([
    pivot('h1', 'SWING_HIGH', 100, 2000),
    pivot('l1', 'SWING_LOW', 90, 1000)
  ]));
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'B2A_PIVOT_AVAILABILITY_ORDER_INVALID');
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
  p.available_at_ms = 2400;
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
