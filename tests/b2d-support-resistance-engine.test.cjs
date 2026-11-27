'use strict';

const assert = require('node:assert/strict');
const { analyze } = require('../src/analysis/b2d-support-resistance-engine.js');

const STEP = 3600000;
const LAG = 500;
const SNAPSHOT_ID = 'fixture:BTCUSDT:1h:b2d';

const POLICY = Object.freeze({
  version: 'b2d-zone-engine-v1',
  b2c_engine_version: '2.0.0-b2c',
  b2c_policy_version: 'b2c-state-v1',
  b2b_engine_version: '2.0.0-b2b',
  b2b_policy_version: 'b2b-swing-sequence-v1',
  b2a_engine_version: '2.0.0-b2a',
  b2a_policy_version: 'b2a-causal-swing-v1',
  b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: 'b1-quality-v1',
  finality_safety_lag_ms: LAG,
  price_equality_policy: 'EXACT_PRICE_V1'
});

const ZONE_POLICY = Object.freeze({
  version: 'b2d-absolute-span-v1',
  instrument_symbol: 'BTCUSDT',
  timeframe: '1h',
  cluster_method: 'MAX_TOTAL_SPAN_V1',
  max_cluster_span_price: 2,
  min_independent_touches: 2
});

function candle(index, open = 100, close = 100) {
  return {
    open_time_ms: (index + 1) * STEP,
    close_time_ms: (index + 2) * STEP,
    canonical_symbol: 'BTCUSDT',
    market_type: 'LINEAR_PERPETUAL',
    timeframe: '1h',
    open,
    high: Math.max(100, open, close),
    low: Math.min(100, open, close),
    close,
    closed_state: 'CONFIRMED',
    volume: 10
  };
}

function pivot(id, type, price, sourceIndex, confirmIndex) {
  const confirmation = candle(confirmIndex);
  return {
    pivot_id: id,
    type,
    price,
    source_time_ms: candle(sourceIndex).open_time_ms,
    confirmed_at_ms: confirmation.close_time_ms,
    available_at_ms: confirmation.close_time_ms + LAG,
    confirmation: {
      method: 'CLOSED_CANDLE_SYMMETRIC_WINDOW',
      left_strength: 2,
      right_strength: 2,
      equality_policy: 'EXACT_PRICE_V1',
      finality_safety_lag_ms: LAG
    },
    sequence_status: 'ACCEPTED'
  };
}

function fixture(rawPivots, options = {}) {
  const rows = Array.from({ length: options.count || 10 }, (_, i) => candle(i));
  for (const p of rawPivots) {
    const sourceIndex = Math.round(p.source_time_ms / STEP) - 1;
    const row = rows[sourceIndex];
    if (p.type === 'SWING_HIGH') {
      if (row.open > p.price) row.open = p.price;
      if (row.close > p.price) row.close = p.price;
      row.high = p.price;
      row.low = Math.min(row.low, row.open, row.close);
    } else {
      if (row.open < p.price) row.open = p.price;
      if (row.close < p.price) row.close = p.price;
      row.low = p.price;
      row.high = Math.max(row.high, row.open, row.close);
    }
  }
  const asOf = rows[rows.length - 1].close_time_ms + LAG;
  const report = {
    snapshot_id: SNAPSHOT_ID,
    symbol: 'BTCUSDT',
    timeframe: '1h',
    analysis_as_of_ms: asOf,
    validator_version: '1.1.0',
    policy_version: 'b1-quality-v1',
    checked_at_ms: asOf - 100,
    status: options.qualityStatus || 'VALID',
    closed_count: rows.length,
    valid_count: rows.length,
    insufficient_history: false
  };
  return {
    policy: { ...POLICY, ...(options.policy || {}) },
    zone_policy: { ...ZONE_POLICY, ...(options.zonePolicy || {}) },
    snapshot: {
      snapshot_id: SNAPSHOT_ID,
      canonical_symbol: 'BTCUSDT',
      market_type: 'LINEAR_PERPETUAL',
      contract_version: '1.1.0',
      analysis_as_of_ms: asOf,
      provider_server_time_ms: asOf,
      provider_metadata: { time_source: 'provider' },
      candles_by_timeframe: { '1h': rows },
      forming_candle_by_timeframe: { '1h': null },
      unclassified_candles_by_timeframe: { '1h': [] }
    },
    quality_report: report,
    b2c_result: {
      engine_version: '2.0.0-b2c',
      policy_version: 'b2c-state-v1',
      status: 'VALID',
      admission: {
        status: 'ADMITTED',
        snapshot_id: SNAPSHOT_ID,
        b2b_engine_version: '2.0.0-b2b',
        b2b_policy_version: 'b2b-swing-sequence-v1',
        b1_validator_version: '1.1.0',
        b1_quality_policy_version: 'b1-quality-v1'
      },
      snapshot_id: SNAPSHOT_ID,
      symbol: 'BTCUSDT',
      timeframe: '1h',
      analysis_as_of_ms: asOf,
      raw_pivots: rawPivots
    },
    analysis_as_of_ms: asOf,
    timeframe: '1h'
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

const basePivots = [
  pivot('s90a', 'SWING_LOW', 90, 0, 1),
  pivot('r110a', 'SWING_HIGH', 110, 1, 2),
  pivot('s91b', 'SWING_LOW', 91, 2, 3),
  pivot('r111b', 'SWING_HIGH', 111, 3, 4),
  pivot('s100c', 'SWING_LOW', 100, 4, 5),
  pivot('r120c', 'SWING_HIGH', 120, 5, 6)
];

run('clusters independent support and resistance pivots into two confirmed zones', () => {
  const result = analyze(fixture(basePivots));
  assert.equal(result.status, 'VALID');
  assert.equal(result.zones.length, 2);
  const support = result.zones.find(z => z.role === 'SUPPORT');
  const resistance = result.zones.find(z => z.role === 'RESISTANCE');
  assert.equal(support.lower_bound, 90);
  assert.equal(support.upper_bound, 91);
  assert.equal(support.representative_price, 90.5);
  assert.equal(support.touch_count, 2);
  assert.equal(resistance.lower_bound, 110);
  assert.equal(resistance.upper_bound, 111);
  assert.equal(resistance.touch_count, 2);
  assert.equal(result.candidate_levels.length, 2);
});

run('zone availability is no earlier than the latest constituent pivot availability', () => {
  const result = analyze(fixture(basePivots));
  const support = result.zones.find(z => z.role === 'SUPPORT');
  assert.equal(support.available_at_ms, Math.max(
    basePivots[0].available_at_ms, basePivots[2].available_at_ms
  ));
});

run('zone evidence preserves every contributing pivot ID and touch timestamp', () => {
  const result = analyze(fixture(basePivots));
  const support = result.zones.find(z => z.role === 'SUPPORT');
  assert.deepEqual(support.pivot_ids, ['s90a', 's91b']);
  assert.deepEqual(support.touches.map(t => t.pivot_id), ['s90a', 's91b']);
  assert.ok(support.touches.every(t => Number.isSafeInteger(t.available_at_ms)));
});

run('a single pivot remains a candidate level rather than a confirmed zone', () => {
  const result = analyze(fixture([basePivots[0]]));
  assert.equal(result.zones.length, 0);
  assert.equal(result.candidate_levels.length, 1);
  assert.equal(result.candidate_levels[0].evidence_status, 'INSUFFICIENT_INDEPENDENT_TOUCHES');
  assert.equal(result.candidate_levels[0].required_touch_count, 2);
});

run('exact maximum total span is included in one cluster', () => {
  const pivots = [
    pivot('s90', 'SWING_LOW', 90, 0, 1),
    pivot('s92', 'SWING_LOW', 92, 2, 3)
  ];
  const result = analyze(fixture(pivots));
  assert.equal(result.zones.length, 1);
  assert.equal(result.zones[0].cluster_span_price, 2);
});

run('cluster method prevents transitive chaining beyond the total span', () => {
  const pivots = [
    pivot('s100', 'SWING_LOW', 100, 0, 1),
    pivot('s101', 'SWING_LOW', 101, 2, 3),
    pivot('s102', 'SWING_LOW', 102, 4, 5),
    pivot('s103', 'SWING_LOW', 103, 6, 7)
  ];
  const result = analyze(fixture(pivots));
  assert.equal(result.zones.length, 2);
  assert.deepEqual(result.zones.map(z => [z.lower_bound, z.upper_bound]), [[100, 102], [103, 103]]);
  assert.equal(result.zones[0].cluster_span_price, 2);
});

run('support and resistance are never merged into one cluster', () => {
  const result = analyze(fixture([
    pivot('s100', 'SWING_LOW', 100, 0, 1),
    pivot('r100a', 'SWING_HIGH', 100, 2, 3),
    pivot('s100b', 'SWING_LOW', 100, 4, 5),
    pivot('r100b', 'SWING_HIGH', 100, 6, 7)
  ]));
  assert.equal(result.zones.length, 2);
  assert.deepEqual(result.zones.map(z => z.role).sort(), ['RESISTANCE', 'SUPPORT']);
});

run('same-role duplicate source-candle touches fail closed', () => {
  const pivots = [
    pivot('s90a', 'SWING_LOW', 90, 0, 1),
    pivot('s90b', 'SWING_LOW', 91, 0, 2)
  ];
  const result = analyze(fixture(pivots));
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'DUPLICATE_PIVOT_TOUCH_SOURCE_TIME');
});

run('missing explicit tolerance policy fails closed', () => {
  const input = fixture(basePivots);
  delete input.zone_policy.max_cluster_span_price;
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.zones.length, 0);
});

run('zone policy must be scoped to the exact instrument and timeframe', () => {
  const input = fixture(basePivots, { zonePolicy: { instrument_symbol: 'ETHUSDT' } });
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'ZONE_POLICY_INVALID_OR_UNSCOPED');
});

run('non-VALID B1 quality report blocks zone generation', () => {
  const result = analyze(fixture(basePivots, { qualityStatus: 'STALE' }));
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.zones.length, 0);
});

run('B2-C snapshot identity mismatch fails closed', () => {
  const input = fixture(basePivots);
  input.b2c_result.snapshot_id = 'other-snapshot';
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'B2C_ADMISSION_IDENTITY_MISMATCH');
});

run('pivot source price must match the canonical source candle', () => {
  const input = fixture(basePivots);
  input.b2c_result.raw_pivots[0].price = 89;
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'B2C_PIVOT_PROVENANCE_MISMATCH');
});

run('forming candle overlapping the closed set fails closed', () => {
  const input = fixture(basePivots);
  input.snapshot.forming_candle_by_timeframe['1h'] = { ...input.snapshot.candles_by_timeframe['1h'][0] };
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
});

run('candle gaps fail closed', () => {
  const input = fixture(basePivots);
  input.snapshot.candles_by_timeframe['1h'][5].open_time_ms += STEP;
  input.snapshot.candles_by_timeframe['1h'][5].close_time_ms += STEP;
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
});

run('result and nested zone evidence are deeply immutable', () => {
  const result = analyze(fixture(basePivots));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.zones));
  assert.ok(Object.isFrozen(result.zones[0]));
  assert.ok(Object.isFrozen(result.zones[0].touches));
  assert.ok(Object.isFrozen(result.zones[0].touches[0]));
});

run('zone analysis does not mutate B1 or B2-C inputs', () => {
  const input = fixture(basePivots);
  const before = JSON.stringify(input);
  analyze(input);
  assert.equal(JSON.stringify(input), before);
});

run('identical inputs and policies produce deterministic zone IDs and boundaries', () => {
  const input = fixture(basePivots);
  assert.deepEqual(analyze(input), analyze(input));
});

run('zone clusters are available only from pivots confirmed by the analysis cutoff', () => {
  const input = fixture(basePivots);
  input.b2c_result.raw_pivots[5].available_at_ms = input.analysis_as_of_ms + 1;
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.zones.length, 0);
});
