'use strict';

const assert = require('node:assert/strict');
const { analyze } = require('../src/analysis/b2e-breakout-retest-engine.js');
const { analyze: analyzeB2A } = require('../src/analysis/b2-causal-swing-engine.js');
const { analyze: analyzeB2B } = require('../src/analysis/b2b-swing-sequence-engine.js');
const { analyze: analyzeB2C } = require('../src/analysis/b2c-swing-structure-engine.js');
const { analyze: analyzeB2D } = require('../src/analysis/b2d-support-resistance-engine.js');

const STEP = 3600000;
const LAG = 500;
const SNAPSHOT_ID = 'fixture:BTCUSDT:1h:b2e';

const POLICY = Object.freeze({
  version: 'b2e-retest-engine-v1',
  b2b_engine_version: '2.1.0-b2b',
  b2b_policy_version: 'b2b-swing-sequence-v2',
      b2b_same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
      same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
  b2c_engine_version: '2.0.0-b2c',
  b2c_policy_version: 'b2c-state-v1',
  b2d_engine_version: '2.0.0-b2d',
  b2d_policy_version: 'b2d-zone-engine-v1',
  b2d_zone_policy_version: 'b2d-absolute-span-v1',
  b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: 'b1-quality-v1',
  finality_safety_lag_ms: LAG,
  price_equality_policy: 'EXACT_PRICE_V1',
  b2b_same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
  retest_policy: {
    version: 'retest-policy-v1',
    touch_method: 'RANGE_INTERSECTION_V1',
    touch_tolerance_price: 0,
    success_buffer_price: 0,
    failure_buffer_price: 0,
    retest_window_bars: 3,
    confirmation_window_bars: 2
  }
});

function candle(index, open = 105, close = 105) {
  return {
    open_time_ms: (index + 1) * STEP,
    close_time_ms: (index + 2) * STEP,
    canonical_symbol: 'BTCUSDT',
    market_type: 'LINEAR_PERPETUAL',
    timeframe: '1h',
    open,
    high: Math.max(106, open, close),
    low: Math.min(104, open, close),
    close,
    closed_state: 'CONFIRMED',
    volume: 10
  };
}

function makePivot(id, type, price, sourceIndex, confirmIndex) {
  const confirm = candle(confirmIndex);
  return {
    pivot_id: id,
    type,
    price,
    source_time_ms: candle(sourceIndex).open_time_ms,
    confirmed_at_ms: confirm.close_time_ms,
    available_at_ms: confirm.close_time_ms + LAG,
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

function makeZone(role, members, asOf) {
  const prices = members.map(p => p.price).sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);
  const representative = prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2;
  const ids = members.map(p => p.pivot_id).sort();
  const ordered = [...members].sort((a, b) => a.source_time_ms - b.source_time_ms || a.pivot_id.localeCompare(b.pivot_id));
  const sourceTimes = members.map(p => p.source_time_ms);
  const available = members.map(p => p.available_at_ms);
  return {
    zone_id: ['B2D', role, ids[0], ids[ids.length - 1]].join(':'),
    role,
    lower_bound: Math.min(...prices),
    upper_bound: Math.max(...prices),
    representative_price: representative,
    cluster_span_price: Math.max(...prices) - Math.min(...prices),
    touch_count: members.length,
    first_touch_time_ms: Math.min(...sourceTimes),
    last_touch_time_ms: Math.max(...sourceTimes),
    last_touch_age_ms: asOf - Math.max(...sourceTimes),
    available_at_ms: Math.max(...available),
    pivot_ids: ids,
    touches: ordered.map(p => ({
      pivot_id: p.pivot_id, price: p.price, source_time_ms: p.source_time_ms,
      confirmed_at_ms: p.confirmed_at_ms, available_at_ms: p.available_at_ms
    })),
    evidence_status: 'CONFIRMED_CLUSTER'
  };
}

function fixture(options = {}) {
  const count = options.count || 10;
  const rows = Array.from({ length: count }, (_, i) => candle(i));
  const high100Confirm = options.delayFirstResistance ? 8 : 1;
  const raw = [
    makePivot('h100', 'SWING_HIGH', 100, 0, high100Confirm),
    makePivot('l90', 'SWING_LOW', 90, 1, 2),
    makePivot('h101', 'SWING_HIGH', 101, 2, 3),
    makePivot('l91', 'SWING_LOW', 91, 4, 5)
  ];
  if (options.futureResistance) raw.push(makePivot('h102', 'SWING_HIGH', 102, 7, 8));
  if (options.preBreakHigherResistance) raw.push(makePivot('h102pre', 'SWING_HIGH', 102, 4, 5));
  raw.sort((a, b) => a.available_at_ms - b.available_at_ms || a.source_time_ms - b.source_time_ms);

  for (const p of raw) {
    const index = Math.round(p.source_time_ms / STEP) - 1;
    const row = rows[index];
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

  const direction = options.direction || 'BULLISH';
  const breakoutPivotId = direction === 'BULLISH' ? 'h101' : 'l91';
  const breakoutPivot = raw.find(p => p.pivot_id === breakoutPivotId);
  const breakIndex = 6;
  rows[breakIndex] = {
    ...rows[breakIndex],
    open: direction === 'BULLISH' ? 100 : 91,
    close: options.breakoutClose ?? (direction === 'BULLISH' ? 102 : 89),
    high: direction === 'BULLISH' ? 103 : 92,
    low: direction === 'BULLISH' ? 100 : 88
  };

  if (options.touchAt !== undefined && options.touchAt !== null) {
    const i = options.touchAt;
    const touch = options.touch || (direction === 'BULLISH'
      ? { open: 100.5, high: 102, low: 100.5, close: 102 }
      : { open: 90.5, high: 90.5, low: 89, close: 89 });
    rows[i] = { ...rows[i], ...touch };
  }
  if (options.postTouchOverrides) {
    for (const [indexText, values] of Object.entries(options.postTouchOverrides)) {
      const i = Number(indexText);
      rows[i] = { ...rows[i], ...values };
    }
  }

  const asOf = rows[rows.length - 1].close_time_ms + LAG;
  const report = {
    snapshot_id: SNAPSHOT_ID, symbol: 'BTCUSDT', timeframe: '1h',
    analysis_as_of_ms: asOf, validator_version: '1.1.0', policy_version: 'b1-quality-v1',
    checked_at_ms: asOf - 100, status: 'VALID', closed_count: rows.length,
    valid_count: rows.length, insufficient_history: false
  };
  const snapshot = {
    snapshot_id: SNAPSHOT_ID, canonical_symbol: 'BTCUSDT', market_type: 'LINEAR_PERPETUAL',
    contract_version: '1.1.0', analysis_as_of_ms: asOf, provider_server_time_ms: asOf,
    provider_metadata: { time_source: 'provider' },
    candles_by_timeframe: { '1h': rows },
    forming_candle_by_timeframe: { '1h': null },
    unclassified_candles_by_timeframe: { '1h': [] }
  };
  const zonePivots = direction === 'BULLISH'
    ? raw.filter(p => p.type === 'SWING_HIGH')
    : raw.filter(p => p.type === 'SWING_LOW');
  const oppositePivots = direction === 'BULLISH'
    ? raw.filter(p => p.type === 'SWING_LOW')
    : raw.filter(p => p.type === 'SWING_HIGH');
  const zoneRole = direction === 'BULLISH' ? 'RESISTANCE' : 'SUPPORT';
  const otherRole = direction === 'BULLISH' ? 'SUPPORT' : 'RESISTANCE';
  const zones = [
    ...(zonePivots.length >= 2 ? [makeZone(zoneRole, zonePivots, asOf)] : []),
    ...(oppositePivots.length >= 2 ? [makeZone(otherRole, oppositePivots, asOf)] : [])
  ];
  const b2c = {
    engine_version: '2.0.0-b2c', policy_version: 'b2c-state-v1', status: 'VALID',
    admission: {
      status: 'ADMITTED', snapshot_id: SNAPSHOT_ID,
      b2b_engine_version: '2.1.0-b2b', b2b_policy_version: 'b2b-swing-sequence-v2',
      b2b_same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
      same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
      b1_validator_version: '1.1.0', b1_quality_policy_version: 'b1-quality-v1'
    },
    snapshot_id: SNAPSHOT_ID, symbol: 'BTCUSDT', timeframe: '1h',
    analysis_as_of_ms: asOf, raw_pivots: raw,
    events: [{
      event_id: 'B2C:INITIAL_' + direction + '_BREAK:' + rows[breakIndex].close_time_ms + ':' + breakoutPivotId,
      event_type: direction === 'BULLISH' ? 'INITIAL_BULLISH_BREAK' : 'INITIAL_BEARISH_BREAK',
      direction,
      level_price: breakoutPivot.price,
      source_pivot_id: breakoutPivotId,
      source_time_ms: breakoutPivot.source_time_ms,
      pivot_confirmed_at_ms: breakoutPivot.confirmed_at_ms,
      pivot_available_at_ms: breakoutPivot.available_at_ms,
      breaking_candle_open_time_ms: rows[breakIndex].open_time_ms,
      breaking_candle_close_time_ms: rows[breakIndex].close_time_ms,
      breaking_candle_close: rows[breakIndex].close,
      confirmed_at_ms: rows[breakIndex].close_time_ms,
      available_at_ms: rows[breakIndex].close_time_ms + LAG,
      prior_state: 'UNESTABLISHED',
      transition: true,
      confirmation_method: 'CLOSED_CANDLE_CLOSE',
      break_buffer_policy: 'ZERO_BUFFER_V1',
      break_buffer: 0,
      gap_through: false
    }]
  };
  const b2d = {
    engine_version: '2.0.0-b2d', policy_version: 'b2d-zone-engine-v1',
    zone_policy_version: 'b2d-absolute-span-v1', status: 'VALID',
    admission: {
      status: 'ADMITTED', snapshot_id: SNAPSHOT_ID,
      b2c_engine_version: '2.0.0-b2c', b2c_policy_version: 'b2c-state-v1',
      b1_validator_version: '1.1.0', b1_quality_policy_version: 'b1-quality-v1'
    },
    snapshot_id: SNAPSHOT_ID, symbol: 'BTCUSDT', timeframe: '1h',
    analysis_as_of_ms: asOf, cluster_method: 'MAX_TOTAL_SPAN_V1',
    max_cluster_span_price: 2, min_independent_touches: 2,
    zones, candidate_levels: []
  };
  return {
    policy: { ...POLICY, retest_policy: { ...POLICY.retest_policy, ...(options.retestPolicy || {}) } },
    snapshot, quality_report: report, b2c_result: b2c, b2d_result: b2d,
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

run('bullish breakout with a successful retest confirms resistance-to-support role reversal', () => {
  const input = fixture({ touchAt: 7 });
  const result = analyze(input);
  assert.equal(result.status, 'VALID');
  assert.equal(result.lifecycles.length, 1);
  const lifecycle = result.lifecycles[0];
  assert.equal(lifecycle.status, 'RETEST_SUCCESSFUL');
  assert.equal(lifecycle.original_role, 'RESISTANCE');
  assert.equal(lifecycle.proposed_role, 'SUPPORT');
  assert.equal(lifecycle.role_transition_status, 'CONFIRMED');
  assert.equal(lifecycle.effective_role, 'SUPPORT');
});

run('bearish breakout with a successful retest confirms support-to-resistance role reversal', () => {
  const input = fixture({
    direction: 'BEARISH',
    touchAt: 7,
    touch: { open: 90.5, high: 90.5, low: 89, close: 89 }
  });
  const result = analyze(input);
  assert.equal(result.status, 'VALID');
  assert.equal(result.lifecycles[0].status, 'RETEST_SUCCESSFUL');
  assert.equal(result.lifecycles[0].original_role, 'SUPPORT');
  assert.equal(result.lifecycles[0].effective_role, 'RESISTANCE');
});

run('failed bullish retest rejects role reversal and preserves resistance role', () => {
  const input = fixture({
    touchAt: 7,
    touch: { open: 100.5, high: 101, low: 99, close: 99 }
  });
  const result = analyze(input);
  assert.equal(result.lifecycles[0].status, 'RETEST_FAILED');
  assert.equal(result.lifecycles[0].role_transition_status, 'REJECTED');
  assert.equal(result.lifecycles[0].effective_role, 'RESISTANCE');
});

run('a gap close beyond the failure boundary fails before any later retest', () => {
  const input = fixture({
    postTouchOverrides: {
      7: { open: 99, high: 99.5, low: 98, close: 98.5 },
      8: { open: 100.5, high: 102, low: 100.5, close: 102 }
    }
  });
  const result = analyze(input);
  assert.equal(result.lifecycles[0].status, 'RETEST_FAILED');
  assert.equal(result.lifecycles[0].role_transition_status, 'REJECTED');
  assert.equal(result.lifecycles[0].touch, null);
  assert.equal(result.lifecycles[0].confirmation.outcome, 'FAILURE');
});

run('no touch after a complete retest window expires without role reversal', () => {
  const input = fixture({
    postTouchOverrides: {
      7: { open: 105, high: 106, low: 104, close: 105 },
      8: { open: 105, high: 106, low: 104, close: 105 },
      9: { open: 105, high: 106, low: 104, close: 105 }
    },
    retestPolicy: { retest_window_bars: 2 }
  });
  const result = analyze(input);
  assert.equal(result.lifecycles[0].status, 'RETEST_EXPIRED');
  assert.equal(result.lifecycles[0].role_transition_status, 'UNCONFIRMED');
  assert.equal(result.lifecycles[0].effective_role, 'RESISTANCE');
});

run('incomplete retest window remains WAITING_RETEST rather than expiring early', () => {
  const input = fixture({
    count: 8,
    postTouchOverrides: { 7: { open: 105, high: 106, low: 104, close: 105 } },
    retestPolicy: { retest_window_bars: 3 }
  });
  const result = analyze(input);
  assert.equal(result.lifecycles[0].status, 'WAITING_RETEST');
  assert.equal(result.lifecycles[0].role_transition_status, 'PENDING');
});

run('touch without enough later confirmation bars remains pending', () => {
  const input = fixture({
    count: 8,
    touchAt: 7,
    touch: { open: 100.5, high: 101, low: 100, close: 100.5 },
    retestPolicy: { success_buffer_price: 1, failure_buffer_price: 1, confirmation_window_bars: 2 }
  });
  const result = analyze(input);
  assert.equal(result.lifecycles[0].status, 'RETEST_PENDING_CONFIRMATION');
  assert.equal(result.lifecycles[0].role_transition_status, 'PENDING');
});

run('complete confirmation window without reclaim or failure becomes unresolved', () => {
  const input = fixture({
    touchAt: 7,
    touch: { open: 100.5, high: 101, low: 100, close: 100.5 },
    postTouchOverrides: {
      8: { open: 100.5, high: 101, low: 100, close: 100.5 },
      9: { open: 100.5, high: 101, low: 100, close: 100.5 }
    },
    retestPolicy: { success_buffer_price: 1, failure_buffer_price: 1, confirmation_window_bars: 2 }
  });
  const result = analyze(input);
  assert.equal(result.lifecycles[0].status, 'RETEST_UNRESOLVED');
  assert.equal(result.lifecycles[0].role_transition_status, 'UNCONFIRMED');
});

run('historical zone is reconstructed from pivots available before the break, not later cluster members', () => {
  const input = fixture({ futureResistance: true, touchAt: 7 });
  const result = analyze(input);
  assert.equal(result.lifecycles[0].status, 'RETEST_SUCCESSFUL');
  assert.deepEqual(result.lifecycles[0].historical_zone.pivot_ids, ['h100', 'h101']);
  assert.equal(result.lifecycles[0].historical_zone.upper_bound, 101);
  assert.deepEqual(result.lifecycles[0].historical_zone.touches.map(t => t.pivot_id), ['h100', 'h101']);
});

run('a pivot break inside the historical zone does not start a zone retest lifecycle', () => {
  const input = fixture({
    preBreakHigherResistance: true,
    breakoutClose: 101.5,
    touchAt: 7
  });
  const result = analyze(input);
  assert.equal(result.lifecycles.length, 0);
  assert.equal(result.unmatched_breakouts.length, 1);
  assert.equal(result.unmatched_breakouts[0].reason, 'ZONE_BOUNDARY_NOT_CLEARED_AT_BREAK');
  assert.equal(result.unmatched_breakouts[0].zone_upper_bound, 102);
});

run('a zone that did not have enough independent touches before the break is unmatched', () => {
  const input = fixture({ delayFirstResistance: true });
  const result = analyze(input);
  assert.equal(result.lifecycles.length, 0);
  assert.equal(result.unmatched_breakouts.length, 1);
  assert.equal(result.unmatched_breakouts[0].reason, 'ZONE_NOT_FORMED_BEFORE_BREAK');
});

run('touch tolerance is explicit and can allow a near-zone wick', () => {
  const input = fixture({
    touchAt: 7,
    touch: { open: 102, high: 103, low: 101.5, close: 102 },
    retestPolicy: { touch_tolerance_price: 0.5 }
  });
  const result = analyze(input);
  assert.equal(result.lifecycles[0].status, 'RETEST_SUCCESSFUL');
});

run('zero touch tolerance does not count a wick that misses the zone', () => {
  const input = fixture({
    count: 8,
    touchAt: 7,
    touch: { open: 102, high: 103, low: 101.5, close: 102 },
    retestPolicy: { touch_tolerance_price: 0 }
  });
  const result = analyze(input);
  assert.equal(result.lifecycles[0].status, 'WAITING_RETEST');
});

run('missing retest policy fails closed', () => {
  const input = fixture();
  delete input.policy.retest_policy.touch_method;
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.lifecycles.length, 0);
});

run('non-VALID B1 quality report blocks retest analysis', () => {
  const input = fixture();
  input.quality_report.status = 'STALE';
  const result = analyze(input);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.lifecycles.length, 0);
});

run('B2-C and B2-D snapshot mismatch fails closed', () => {
  const input = fixture();
  input.b2d_result.snapshot_id = 'different-snapshot';
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.lifecycles.length, 0);
});

run('break event with invalid source pivot provenance fails closed', () => {
  const input = fixture();
  input.b2c_result.events[0].source_pivot_id = 'unknown-pivot';
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'B2C_EVENT_PIVOT_PROVENANCE_INVALID');
});

run('current B2D zone evidence is revalidated against raw pivot membership', () => {
  const input = fixture();
  input.b2d_result.zones[0].upper_bound += 1;
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'B2D_ZONE_EVIDENCE_MISMATCH');
});

run('zone formed only after breakout is not retroactively used', () => {
  const input = fixture({ delayFirstResistance: true });
  const result = analyze(input);
  assert.equal(result.lifecycles.length, 0);
  assert.equal(result.unmatched_breakouts.length, 1);
});

run('result and nested lifecycle evidence are deeply immutable', () => {
  const result = analyze(fixture({ touchAt: 7 }));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.lifecycles));
  assert.ok(Object.isFrozen(result.lifecycles[0]));
  assert.ok(Object.isFrozen(result.lifecycles[0].historical_zone));
  assert.ok(Object.isFrozen(result.lifecycles[0].touch));
});

run('retest analysis does not mutate B1, B2-C or B2-D inputs', () => {
  const input = fixture({ touchAt: 7 });
  const before = JSON.stringify(input);
  analyze(input);
  assert.equal(JSON.stringify(input), before);
});

run('identical inputs produce deterministic lifecycle IDs and statuses', () => {
  const input = fixture({ touchAt: 7 });
  assert.deepEqual(analyze(input), analyze(input));
});


run('full B1 snapshot → B2-A → B2-B → B2-C → B2-D → B2-E confirms a historical retest', () => {
  const base = Math.floor(1700000000000 / STEP) * STEP;
  const candles = [];
  for (let i = 0; i < 20; i++) {
    candles.push({
      provider_id: 'bybit-v5-rest', venue: 'bybit', market_type: 'linear_perpetual',
      canonical_symbol: 'BTC/USDT', provider_symbol: 'BTCUSDT', timeframe: '1h',
      open_time_ms: base + i * STEP, close_time_ms: base + (i + 1) * STEP,
      open: 9.5, high: 10, low: 9, close: 9.7,
      volume_base: 1, volume_quote: 9.7, closed_state: 'TIME_DERIVED',
      provider_event_time_ms: null, received_at_ms: null, normalizer_version: 'bybit-rest-v1'
    });
  }
  candles[2].high = 12;
  candles[6].high = 14;
  candles[4].low = 7;
  candles[8].low = 8;
  candles[10] = { ...candles[10], open: 14, close: 15.5, high: 16, low: 13 };
  candles[11] = { ...candles[11], open: 15, close: 15.5, high: 16, low: 13.5 };
  const asOf = candles[19].close_time_ms + LAG;
  for (const row of candles) {
    row.provider_event_time_ms = asOf;
    row.received_at_ms = asOf;
  }
  const snapshotId = 'integration:b2e:BTCUSDT:1h:' + asOf;
  const snapshot = {
    contract_version: '1.1.0', snapshot_id: snapshotId, canonical_symbol: 'BTC/USDT',
    market_type: 'linear_perpetual', analysis_as_of_ms: asOf, provider_server_time_ms: asOf,
    provider_metadata: { provider_id: 'bybit-v5-rest', venue: 'bybit', provider_symbol: 'BTCUSDT', host: 'api.bybit.com', time_source: 'provider' },
    received_at_ms: asOf, candles_by_timeframe: { '1h': candles },
    forming_candle_by_timeframe: { '1h': null }, unclassified_candles_by_timeframe: { '1h': [] }
  };
  const qualityReport = {
    validator_version: '1.1.0', policy_version: 'b1-quality-v1', snapshot_id: snapshotId,
    status: 'VALID', reasons: [], symbol: 'BTC/USDT', timeframe: '1h',
    analysis_as_of_ms: asOf, received_at_ms: asOf, valid_count: candles.length,
    closed_count: candles.length, forming_count: 0, unknown_finality_count: 0,
    insufficient_history: false, checked_at_ms: asOf
  };
  const b2a = analyzeB2A({
    snapshot, quality_report: qualityReport, timeframe: '1h', analysis_as_of_ms: asOf,
    policy: {
      version: 'b2a-causal-swing-v1', b1_contract_version: '1.1.0',
      b1_validator_version: '1.1.0', b1_quality_policy_version: 'b1-quality-v1',
      left_strength: 2, right_strength: 2, finality_safety_lag_ms: LAG,
      price_equality_policy: 'EXACT_PRICE_V1'
    }
  });
  assert.equal(b2a.status, 'VALID', JSON.stringify(b2a.admission.reasons));
  const b2b = analyzeB2B({
    b2a_result: b2a,
    policy: {
      version: 'b2b-swing-sequence-v2',
      same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1', b2a_engine_version: '2.0.0-b2a',
      b2a_policy_version: 'b2a-causal-swing-v1', b1_validator_version: '1.1.0',
      b1_quality_policy_version: 'b1-quality-v1', price_equality_policy: 'EXACT_PRICE_V1'
    }
  });
  assert.equal(b2b.status, 'VALID', JSON.stringify(b2b.admission.reasons));
  const b2c = analyzeB2C({
    policy: {
      version: 'b2c-state-v1', b2b_engine_version: '2.1.0-b2b',
      b2b_policy_version: 'b2b-swing-sequence-v2',
      b2b_same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
      same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1', b2a_engine_version: '2.0.0-b2a',
      b2a_policy_version: 'b2a-causal-swing-v1', b1_contract_version: '1.1.0',
      b1_validator_version: '1.1.0', b1_quality_policy_version: 'b1-quality-v1',
      finality_safety_lag_ms: LAG, price_equality_policy: 'EXACT_PRICE_V1',
      break_buffer_policy: 'ZERO_BUFFER_V1'
    },
    snapshot, quality_report: qualityReport, b2a_result: b2a, b2b_result: b2b,
    analysis_as_of_ms: asOf, timeframe: '1h'
  });
  assert.equal(b2c.status, 'VALID', JSON.stringify(b2c.admission.reasons));
  assert.ok(b2c.events.some(e => e.event_type === 'INITIAL_BULLISH_BREAK'));
  const b2d = analyzeB2D({
    policy: {
      version: 'b2d-zone-engine-v1', b2c_engine_version: '2.0.0-b2c',
      b2c_policy_version: 'b2c-state-v1', b2b_engine_version: '2.1.0-b2b',
      b2b_policy_version: 'b2b-swing-sequence-v2',
      b2b_same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
      same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1', b2a_engine_version: '2.0.0-b2a',
      b2a_policy_version: 'b2a-causal-swing-v1', b1_contract_version: '1.1.0',
      b1_validator_version: '1.1.0', b1_quality_policy_version: 'b1-quality-v1',
      finality_safety_lag_ms: LAG, price_equality_policy: 'EXACT_PRICE_V1'
    },
    zone_policy: {
      version: 'b2d-absolute-span-v1', instrument_symbol: 'BTC/USDT',
      timeframe: '1h', cluster_method: 'MAX_TOTAL_SPAN_V1',
      max_cluster_span_price: 2, min_independent_touches: 2
    },
    snapshot, quality_report: qualityReport, b2c_result: b2c, analysis_as_of_ms: asOf, timeframe: '1h'
  });
  assert.equal(b2d.status, 'VALID', JSON.stringify(b2d.admission.reasons));
  const b2e = analyze({
    policy: {
      version: 'b2e-retest-engine-v1', b2b_engine_version: '2.1.0-b2b',
      b2b_policy_version: 'b2b-swing-sequence-v2',
      b2b_same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
      same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1', b2c_engine_version: '2.0.0-b2c',
      b2c_policy_version: 'b2c-state-v1', b2d_engine_version: '2.0.0-b2d',
      b2d_policy_version: 'b2d-zone-engine-v1', b2d_zone_policy_version: 'b2d-absolute-span-v1',
      b1_contract_version: '1.1.0', b1_validator_version: '1.1.0',
      b1_quality_policy_version: 'b1-quality-v1', finality_safety_lag_ms: LAG,
      price_equality_policy: 'EXACT_PRICE_V1',
      retest_policy: {
        version: 'retest-policy-v1', touch_method: 'RANGE_INTERSECTION_V1',
        touch_tolerance_price: 0, success_buffer_price: 0, failure_buffer_price: 0,
        retest_window_bars: 3, confirmation_window_bars: 2
      }
    },
    snapshot, quality_report: qualityReport, b2c_result: b2c, b2d_result: b2d,
    analysis_as_of_ms: asOf, timeframe: '1h'
  });
  assert.equal(b2e.status, 'VALID', JSON.stringify(b2e.admission.reasons));
  assert.equal(b2e.lifecycles.length, 1);
  assert.equal(b2e.lifecycles[0].status, 'RETEST_SUCCESSFUL');
  assert.equal(b2e.lifecycles[0].effective_role, 'SUPPORT');
});


run('forged B2-C prior-state or break-buffer metadata fails closed', () => {
  const input = fixture();
  input.b2c_result.events[0].prior_state = 'DOWN';
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'B2C_BREAK_EVENT_PROVENANCE_MISMATCH');
});
