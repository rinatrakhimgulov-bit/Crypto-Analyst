'use strict';

const assert = require('node:assert/strict');
const { analyze } = require('../src/analysis/b2c-swing-structure-engine.js');

const STEP = 3600000;
const LAG = 500;
const SNAPSHOT_ID = 'fixture:BTCUSDT:1h:b2c';

const POLICY = Object.freeze({
  version: 'b2c-state-v1',
  b2b_engine_version: '2.0.0-b2b',
  b2b_policy_version: 'b2b-swing-sequence-v1',
  b2a_engine_version: '2.0.0-b2a',
  b2a_policy_version: 'b2a-causal-swing-v1',
  b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: 'b1-quality-v1',
  finality_safety_lag_ms: LAG,
  price_equality_policy: 'EXACT_PRICE_V1',
  break_buffer_policy: 'ZERO_BUFFER_V1'
});

function candle(index, close = 100, high = Math.max(100, close), low = Math.min(100, close), open = 100) {
  return {
    open_time_ms: (index + 1) * STEP,
    close_time_ms: (index + 2) * STEP,
    canonical_symbol: 'BTCUSDT',
    market_type: 'LINEAR_PERPETUAL',
    timeframe: '1h',
    open,
    high: Math.max(high, open, close),
    low: Math.min(low, open, close),
    close,
    closed_state: 'CONFIRMED',
    volume: 10
  };
}

function makePivot(id, type, price, sourceIndex, confirmIndex) {
  const source = candle(sourceIndex);
  const confirmation = candle(confirmIndex);
  return {
    pivot_id: id,
    type,
    price,
    source_time_ms: source.open_time_ms,
    source_index: sourceIndex,
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

function labelSequence(pivots) {
  const previous = { SWING_HIGH: null, SWING_LOW: null };
  return pivots.map(p => {
    const prior = previous[p.type];
    const label = !prior
      ? (p.type === 'SWING_HIGH' ? 'INITIAL_HIGH' : 'INITIAL_LOW')
      : p.type === 'SWING_HIGH'
        ? (p.price > prior.price ? 'HH' : p.price < prior.price ? 'LH' : 'EQH')
        : (p.price > prior.price ? 'HL' : p.price < prior.price ? 'LL' : 'EQL');
    const result = {
      ...p,
      structure_label: label,
      comparison_pivot_id: prior ? prior.pivot_id : null
    };
    previous[p.type] = p;
    return result;
  });
}

function fixture(pivots, overrides = {}, options = {}) {
  const rows = Array.from({ length: options.count || 8 }, (_, i) => candle(i));
  for (const [indexText, values] of Object.entries(overrides)) {
    const i = Number(indexText);
    const base = rows[i];
    const open = values.open ?? base.open;
    const close = values.close ?? base.close;
    rows[i] = {
      ...base,
      ...values,
      open,
      close,
      high: Math.max(values.high ?? base.high, open, close),
      low: Math.min(values.low ?? base.low, open, close)
    };
  }
  for (const p of pivots) {
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
  const sequence = labelSequence(pivots);
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
  const snapshot = {
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
  };
  const b2b = {
    engine_version: '2.0.0-b2b',
    policy_version: 'b2b-swing-sequence-v1',
    status: 'VALID',
    admission: {
      status: 'ADMITTED',
      snapshot_id: SNAPSHOT_ID,
      b2a_engine_version: '2.0.0-b2a',
      b2a_policy_version: 'b2a-causal-swing-v1',
      b2a_quality_report: {
        snapshot_id: SNAPSHOT_ID,
        validator_version: '1.1.0',
        policy_version: 'b1-quality-v1',
        checked_at_ms: report.checked_at_ms
      }
    },
    snapshot_id: SNAPSHOT_ID,
    symbol: 'BTCUSDT',
    timeframe: '1h',
    analysis_as_of_ms: asOf,
    sequence_order_basis: 'B2A_AVAILABLE_AT_ORDER_STABLE',
    comparison_policy: 'EXACT_PRICE_V1',
    raw_pivots: pivots,
    sequence
  };
  return { policy: { ...POLICY, ...(options.policy || {}) }, snapshot, quality_report: report, b2b_result: b2b, analysis_as_of_ms: asOf, timeframe: '1h' };
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

const initialBull = [
  makePivot('l90', 'SWING_LOW', 90, 0, 1),
  makePivot('h100', 'SWING_HIGH', 100, 1, 2)
];

run('initial bullish break is named once and initializes protected low', () => {
  const input = fixture(initialBull, { 3: { close: 105, high: 106, low: 95, open: 100 } });
  const result = analyze(input);
  assert.equal(result.status, 'VALID');
  assert.equal(result.structure_state, 'UP');
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].event_type, 'INITIAL_BULLISH_BREAK');
  assert.equal(result.events[0].source_pivot_id, 'h100');
  assert.equal(result.protected_level.pivot_id, 'l90');
});

run('initial bearish break is symmetric', () => {
  const pivots = [
    makePivot('h110', 'SWING_HIGH', 110, 0, 1),
    makePivot('l100', 'SWING_LOW', 100, 1, 2)
  ];
  const input = fixture(pivots, { 3: { open: 100, close: 95, high: 105, low: 94 } });
  const result = analyze(input);
  assert.equal(result.structure_state, 'DOWN');
  assert.equal(result.events[0].event_type, 'INITIAL_BEARISH_BREAK');
  assert.equal(result.protected_level.pivot_id, 'h110');
});

run('a close exactly at a level is not a break', () => {
  const input = fixture(initialBull, { 3: { open: 100, close: 100, high: 105, low: 95 } });
  const result = analyze(input);
  assert.equal(result.structure_state, 'UNESTABLISHED');
  assert.equal(result.events.length, 0);
});

run('wick through a level without close confirmation emits sweep only', () => {
  const input = fixture(initialBull, { 3: { open: 100, close: 99, high: 105, low: 95 } });
  const result = analyze(input);
  assert.equal(result.structure_state, 'UNESTABLISHED');
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].event_type, 'BULLISH_SWEEP');
  assert.equal(result.events[0].transition, false);
});

run('initial event is never relabeled as BOS by later candles', () => {
  const input = fixture(initialBull, {
    3: { open: 100, close: 105, high: 106, low: 95 },
    6: { open: 105, close: 108, high: 109, low: 103 }
  });
  const result = analyze(input);
  assert.equal(result.events[0].event_type, 'INITIAL_BULLISH_BREAK');
});

run('bullish BOS requires a later confirmed continuation high', () => {
  const pivots = [
    ...initialBull,
    makePivot('l95', 'SWING_LOW', 95, 3, 4),
    makePivot('h110', 'SWING_HIGH', 110, 4, 5)
  ];
  const input = fixture(pivots, {
    3: { open: 100, close: 105, high: 106, low: 95 },
    6: { open: 108, close: 112, high: 113, low: 107 }
  });
  const result = analyze(input);
  assert.equal(result.structure_state, 'UP');
  assert.deepEqual(result.events.map(e => e.event_type), ['INITIAL_BULLISH_BREAK', 'BULLISH_BOS']);
  assert.equal(result.events[1].source_pivot_id, 'h110');
});

run('bearish BOS requires a later confirmed continuation low', () => {
  const pivots = [
    makePivot('h110', 'SWING_HIGH', 110, 0, 1),
    makePivot('l100', 'SWING_LOW', 100, 1, 2),
    makePivot('h105', 'SWING_HIGH', 105, 3, 4),
    makePivot('l90', 'SWING_LOW', 90, 4, 5)
  ];
  const input = fixture(pivots, {
    3: { open: 100, close: 95, high: 105, low: 94 },
    6: { open: 92, close: 88, high: 93, low: 87 }
  });
  const result = analyze(input);
  assert.equal(result.structure_state, 'DOWN');
  assert.deepEqual(result.events.map(e => e.event_type), ['INITIAL_BEARISH_BREAK', 'BEARISH_BOS']);
  assert.equal(result.events[1].source_pivot_id, 'l90');
});

run('bearish close through protected HL emits bullish-to-bearish CHoCH', () => {
  const pivots = [
    ...initialBull,
    makePivot('l95', 'SWING_LOW', 95, 3, 4)
  ];
  const input = fixture(pivots, {
    3: { open: 100, close: 105, high: 106, low: 95 },
    5: { open: 98, close: 90, high: 99, low: 89 }
  });
  const result = analyze(input);
  assert.equal(result.structure_state, 'DOWN');
  assert.deepEqual(result.events.map(e => e.event_type), ['INITIAL_BULLISH_BREAK', 'BEARISH_CHOCH']);
  assert.equal(result.events[1].source_pivot_id, 'l95');
});

run('bullish close through protected LH emits bearish-to-bullish CHoCH', () => {
  const pivots = [
    makePivot('h110', 'SWING_HIGH', 110, 0, 1),
    makePivot('l100', 'SWING_LOW', 100, 1, 2),
    makePivot('h105', 'SWING_HIGH', 105, 3, 4)
  ];
  const input = fixture(pivots, {
    3: { open: 100, close: 95, high: 105, low: 94 },
    5: { open: 100, close: 111, high: 112, low: 99 }
  });
  const result = analyze(input);
  assert.equal(result.structure_state, 'UP');
  assert.deepEqual(result.events.map(e => e.event_type), ['INITIAL_BEARISH_BREAK', 'BULLISH_CHOCH']);
  assert.equal(result.events[1].source_pivot_id, 'h105');
});

run('a same-candle pivot cannot be used for that candle break', () => {
  const pivots = [
    makePivot('l90', 'SWING_LOW', 90, 0, 1),
    makePivot('h100', 'SWING_HIGH', 100, 2, 3)
  ];
  const input = fixture(pivots, { 3: { open: 100, close: 105, high: 106, low: 95 } });
  const result = analyze(input);
  assert.equal(result.structure_state, 'UNESTABLISHED');
  assert.equal(result.events.length, 0);
});

run('consumed initial level cannot emit duplicate events on repeated closes', () => {
  const input = fixture(initialBull, {
    3: { open: 100, close: 105, high: 106, low: 95 },
    4: { open: 105, close: 108, high: 109, low: 104 },
    5: { open: 108, close: 109, high: 110, low: 107 }
  });
  const result = analyze(input);
  assert.equal(result.events.filter(e => e.source_pivot_id === 'h100').length, 1);
});

run('contradictory latest levels produce AMBIGUOUS_BREAK without choosing direction', () => {
  const pivots = [
    makePivot('l100', 'SWING_LOW', 100, 3, 4),
    makePivot('h90', 'SWING_HIGH', 90, 0, 5)
  ];
  const input = fixture(pivots, { 6: { open: 95, close: 95, high: 96, low: 94 } });
  const result = analyze(input);
  assert.equal(result.structure_state, 'UNESTABLISHED');
  assert.equal(result.events.at(-1).event_type, 'AMBIGUOUS_BREAK');
});

run('non-VALID quality report blocks and emits no events', () => {
  const input = fixture(initialBull, { 3: { close: 105, high: 106, low: 95 } }, { qualityStatus: 'STALE' });
  const result = analyze(input);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.events.length, 0);
});

run('B2-B snapshot identity mismatch fails closed', () => {
  const input = fixture(initialBull);
  input.b2b_result.snapshot_id = 'other-snapshot';
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.events.length, 0);
});

run('B2-B sequence label tampering fails closed', () => {
  const input = fixture(initialBull);
  input.b2b_result.sequence[1].structure_label = 'LH';
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'B2B_SEQUENCE_LABEL_MISMATCH');
});

run('pivot price must match its actual source candle', () => {
  const input = fixture(initialBull);
  input.b2b_result.raw_pivots[1].price = 101;
  input.b2b_result.sequence[1].price = 101;
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'B2B_PIVOT_CANDLE_PROVENANCE_MISMATCH');
});

run('candle gaps fail closed', () => {
  const input = fixture(initialBull);
  input.snapshot.candles_by_timeframe['1h'][4].open_time_ms += STEP;
  input.snapshot.candles_by_timeframe['1h'][4].close_time_ms += STEP;
  input.snapshot.analysis_as_of_ms += STEP;
  input.snapshot.provider_server_time_ms += STEP;
  input.analysis_as_of_ms += STEP;
  input.quality_report.analysis_as_of_ms += STEP;
  input.b2b_result.analysis_as_of_ms += STEP;
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.events.length, 0);
});

run('forming candle overlapping the closed set fails closed', () => {
  const input = fixture(initialBull);
  input.snapshot.forming_candle_by_timeframe['1h'] = { ...input.snapshot.candles_by_timeframe['1h'][0] };
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
});

run('result and nested event evidence are deeply immutable', () => {
  const input = fixture(initialBull, { 3: { close: 105, high: 106, low: 95 } });
  const result = analyze(input);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.events));
  assert.ok(Object.isFrozen(result.events[0]));
  assert.ok(Object.isFrozen(result.pivots));
});

run('analysis does not mutate any upstream input', () => {
  const input = fixture(initialBull, { 3: { close: 105, high: 106, low: 95 } });
  const before = JSON.stringify(input);
  analyze(input);
  assert.equal(JSON.stringify(input), before);
});

run('identical inputs produce deterministic event history', () => {
  const input = fixture(initialBull, { 3: { close: 105, high: 106, low: 95 } });
  assert.deepEqual(analyze(input), analyze(input));
});

run('B1 validator version mismatch blocks B2-C', () => {
  const input = fixture(initialBull);
  input.policy.b1_validator_version = '9.9.9';
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.events.length, 0);
});
