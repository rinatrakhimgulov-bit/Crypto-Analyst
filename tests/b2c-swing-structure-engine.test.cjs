'use strict';

const assert = require('node:assert/strict');
const { analyze } = require('../src/analysis/b2c-swing-structure-engine.js');
const { analyze: analyzeB2A } = require('../src/analysis/b2-causal-swing-engine.js');
const { analyze: analyzeB2B } = require('../src/analysis/b2b-swing-sequence-engine.js');

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
    const delta = prior ? p.price - prior.price : null;
    const result = {
      ...p,
      structure_label: label,
      comparison_pivot_id: prior ? prior.pivot_id : null,
      price_delta: delta,
      relative_delta_pct: prior ? (delta / prior.price) * 100 : null
    };
    previous[p.type] = p;
    return result;
  });
}

function deriveFixtureSequence(pivots) {
  const active = [];
  for (const p of pivots) {
    p.sequence_status = 'PENDING';
    p.superseded_by = null;
    const last = active.length ? active[active.length - 1] : null;
    if (last && last.type === p.type) {
      const moreExtreme = p.type === 'SWING_HIGH' ? p.price > last.price : p.price < last.price;
      if (!moreExtreme) {
        p.sequence_status = 'SUPERSEDED_FOR_SEQUENCE';
        p.superseded_by = last.pivot_id;
        continue;
      }
      last.sequence_status = 'SUPERSEDED_FOR_SEQUENCE';
      last.superseded_by = p.pivot_id;
      active.pop();
    }
    p.sequence_status = 'ACCEPTED';
    active.push(p);
  }
  return labelSequence(active);
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
  const sequence = deriveFixtureSequence(pivots);
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
  const b2a = {
    engine_version: '2.0.0-b2a',
    policy_version: 'b2a-causal-swing-v1',
    status: 'VALID',
    admission: {
      status: 'ADMITTED',
      snapshot_id: SNAPSHOT_ID,
      quality_report: {
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
    pivots: pivots.map(p => ({
      pivot_id: p.pivot_id, type: p.type, price: p.price,
      source_time_ms: p.source_time_ms, source_index: p.source_index,
      confirmed_at_ms: p.confirmed_at_ms, available_at_ms: p.available_at_ms,
      confirmation: { ...p.confirmation }
    }))
  };
  return { policy: { ...POLICY, ...(options.policy || {}) }, snapshot, quality_report: report, b2a_result: b2a, b2b_result: b2b, analysis_as_of_ms: asOf, timeframe: '1h' };
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
  const input = fixture(initialBull, { 3: { open: 100, close: 100, high: 100, low: 95 } });
  const result = analyze(input);
  assert.equal(result.status, 'VALID');
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

run('a lower high after bullish transition cannot become a bullish BOS level', () => {
  const pivots = [
    ...initialBull,
    makePivot('l95', 'SWING_LOW', 95, 3, 4),
    makePivot('h99', 'SWING_HIGH', 99, 4, 5)
  ];
  const input = fixture(pivots, {
    3: { open: 100, close: 105, high: 106, low: 95 },
    6: { open: 98, close: 100, high: 100, low: 97 }
  });
  const result = analyze(input);
  assert.equal(result.structure_state, 'UP');
  assert.deepEqual(result.events.map(e => e.event_type), ['INITIAL_BULLISH_BREAK']);
  assert.equal(result.continuation_level, null);
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

run('a higher low after bearish transition cannot become a bearish BOS level', () => {
  const pivots = [
    makePivot('h110', 'SWING_HIGH', 110, 0, 1),
    makePivot('l100', 'SWING_LOW', 100, 1, 2),
    makePivot('h105', 'SWING_HIGH', 105, 3, 4),
    makePivot('l101', 'SWING_LOW', 101, 4, 5)
  ];
  const input = fixture(pivots, {
    3: { open: 100, close: 95, high: 105, low: 94 },
    6: { open: 102, close: 100.5, high: 103, low: 100 }
  });
  const result = analyze(input);
  assert.equal(result.structure_state, 'DOWN');
  assert.deepEqual(result.events.map(e => e.event_type), ['INITIAL_BEARISH_BREAK']);
  assert.equal(result.continuation_level, null);
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

run('a consumed initial high can later serve as the protected bullish reversal level', () => {
  const pivots = [
    ...initialBull,
    makePivot('l95', 'SWING_LOW', 95, 3, 4)
  ];
  const input = fixture(pivots, {
    3: { open: 100, close: 105, high: 106, low: 95 },
    5: { open: 96, close: 90, high: 97, low: 89 },
    6: { open: 95, close: 101, high: 102, low: 94 }
  });
  const result = analyze(input);
  assert.equal(result.structure_state, 'UP');
  assert.deepEqual(result.events.map(e => e.event_type), [
    'INITIAL_BULLISH_BREAK', 'BEARISH_CHOCH', 'BULLISH_CHOCH'
  ]);
});

run('a consumed initial low can later serve as the protected bearish reversal level', () => {
  const pivots = [
    makePivot('h110', 'SWING_HIGH', 110, 0, 1),
    makePivot('l100', 'SWING_LOW', 100, 1, 2),
    makePivot('h105', 'SWING_HIGH', 105, 3, 4)
  ];
  const input = fixture(pivots, {
    3: { open: 100, close: 95, high: 105, low: 94 },
    5: { open: 104, close: 111, high: 112, low: 103 },
    6: { open: 105, close: 99, high: 106, low: 98 }
  });
  const result = analyze(input);
  assert.equal(result.structure_state, 'DOWN');
  assert.deepEqual(result.events.map(e => e.event_type), [
    'INITIAL_BEARISH_BREAK', 'BULLISH_CHOCH', 'BEARISH_CHOCH'
  ]);
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
  const input = fixture(pivots, { 6: { open: 95, close: 95, high: 96, low: 94 } }, { count: 7 });
  const result = analyze(input);
  assert.equal(result.structure_state, 'UNESTABLISHED', JSON.stringify(result.events));
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
  assert.equal(result.admission.reasons[0].code, 'B2B_SEQUENCE_DERIVATION_MISMATCH');
});

run('pivot price must match its actual source candle', () => {
  const input = fixture(initialBull);
  input.b2b_result.raw_pivots[1].price = 101;
  input.b2b_result.sequence[1].price = 101;
  input.b2a_result.pivots[1].price = 101;
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


run('a later LL does not lower the protected low established by an HL', () => {
  const pivots = [
    ...initialBull,
    makePivot('l95', 'SWING_LOW', 95, 3, 4),
    makePivot('h110', 'SWING_HIGH', 110, 4, 5),
    makePivot('l85', 'SWING_LOW', 85, 5, 6)
  ];
  const input = fixture(pivots, {
    3: { open: 100, close: 105, high: 106, low: 95 }
  });
  const result = analyze(input);
  assert.equal(result.structure_state, 'UP');
  assert.equal(result.protected_level.pivot_id, 'l95');
  assert.equal(result.diagnostics.protected_level_status, 'AVAILABLE');
  assert.equal(result.raw_pivots.length, 5);
});

run('prefix replay preserves every event already available at the prefix cutoff', () => {
  const fullInput = fixture(initialBull, {
    3: { open: 100, close: 105, high: 106, low: 95 }
  });
  const full = analyze(fullInput);
  const prefix = JSON.parse(JSON.stringify(fullInput));
  prefix.snapshot.candles_by_timeframe['1h'] = prefix.snapshot.candles_by_timeframe['1h'].slice(0, 5);
  prefix.snapshot.analysis_as_of_ms = prefix.snapshot.candles_by_timeframe['1h'][4].close_time_ms + LAG;
  prefix.snapshot.provider_server_time_ms = prefix.snapshot.analysis_as_of_ms;
  prefix.analysis_as_of_ms = prefix.snapshot.analysis_as_of_ms;
  prefix.quality_report.analysis_as_of_ms = prefix.analysis_as_of_ms;
  prefix.quality_report.checked_at_ms = prefix.analysis_as_of_ms - 100;
  prefix.quality_report.closed_count = 5;
  prefix.quality_report.valid_count = 5;
  prefix.b2a_result.analysis_as_of_ms = prefix.analysis_as_of_ms;
  prefix.b2a_result.admission.quality_report.checked_at_ms = prefix.quality_report.checked_at_ms;
  prefix.b2b_result.analysis_as_of_ms = prefix.analysis_as_of_ms;
  prefix.b2b_result.admission.b2a_quality_report.checked_at_ms = prefix.quality_report.checked_at_ms;
  const replay = analyze(prefix);
  const expected = full.events.filter(e => e.available_at_ms <= prefix.analysis_as_of_ms);
  assert.deepEqual(replay.events, expected);
});


run('B2-C independently reconstructs B2-B sequence and rejects omitted pivots', () => {
  const input = fixture(initialBull);
  input.b2b_result.sequence.pop();
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'B2B_SEQUENCE_DERIVATION_MISMATCH');
});

run('B2-C rejects a pivot omitted from both B2-B raw evidence and sequence', () => {
  const input = fixture(initialBull);
  input.b2b_result.raw_pivots.pop();
  input.b2b_result.sequence.pop();
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'B2A_PIVOT_SET_MISMATCH');
});

run('B2-C rejects forged raw supersession metadata', () => {
  const pivots = [
    makePivot('h100', 'SWING_HIGH', 100, 0, 1),
    makePivot('h110', 'SWING_HIGH', 110, 2, 3),
    makePivot('l90', 'SWING_LOW', 90, 4, 5)
  ];
  const input = fixture(pivots);
  input.b2b_result.raw_pivots[0].superseded_by = 'not-the-replacing-pivot';
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'B2B_RAW_SEQUENCE_STATUS_MISMATCH');
});


run('a consumed BOS swing high cannot emit repeated BOS on later closes', () => {
  const pivots = [
    ...initialBull,
    makePivot('l95', 'SWING_LOW', 95, 3, 4),
    makePivot('h110', 'SWING_HIGH', 110, 4, 5)
  ];
  const input = fixture(pivots, {
    3: { open: 100, close: 105, high: 106, low: 95 },
    6: { open: 108, close: 112, high: 113, low: 107 },
    7: { open: 112, close: 115, high: 116, low: 111 }
  });
  const result = analyze(input);
  assert.equal(result.events.filter(e => e.event_type === 'BULLISH_BOS').length, 1);
});


run('full B1 snapshot → B2-A → B2-B → B2-C chain emits a causal initial break', () => {
  const step = STEP;
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
  candles[7].close = 12.5;
  candles[7].high = 13;
  const asOf = candles[19].close_time_ms + LAG;
  for (const row of candles) {
    row.provider_event_time_ms = asOf;
    row.received_at_ms = asOf;
  }
  const snapshotId = 'integration:BTCUSDT:1h:' + asOf;
  const snapshot = {
    contract_version: '1.1.0',
    snapshot_id: snapshotId,
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
    unclassified_candles_by_timeframe: { '1h': [] }
  };
  const qualityReport = {
    validator_version: '1.1.0',
    policy_version: 'b1-quality-v1',
    snapshot_id: snapshotId,
    status: 'VALID',
    reasons: [],
    symbol: 'BTC/USDT',
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
  const b2a = analyzeB2A({
    snapshot,
    quality_report: qualityReport,
    timeframe: '1h',
    analysis_as_of_ms: asOf,
    policy: {
      version: 'b2a-causal-swing-v1',
      b1_contract_version: '1.1.0',
      b1_validator_version: '1.1.0',
      b1_quality_policy_version: 'b1-quality-v1',
      left_strength: 2,
      right_strength: 2,
      finality_safety_lag_ms: LAG,
      price_equality_policy: 'EXACT_PRICE_V1'
    }
  });
  assert.equal(b2a.status, 'VALID');
  const b2b = analyzeB2B({
    b2a_result: b2a,
    policy: {
      version: 'b2b-swing-sequence-v1',
      b2a_engine_version: '2.0.0-b2a',
      b2a_policy_version: 'b2a-causal-swing-v1',
      b1_validator_version: '1.1.0',
      b1_quality_policy_version: 'b1-quality-v1',
      price_equality_policy: 'EXACT_PRICE_V1'
    }
  });
  assert.equal(b2b.status, 'VALID');
  const b2c = analyze({
    policy: {
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
    },
    snapshot,
    quality_report: qualityReport,
    b2a_result: b2a,
    b2b_result: b2b,
    analysis_as_of_ms: asOf,
    timeframe: '1h'
  });
  assert.equal(b2c.status, 'VALID');
  assert.equal(b2c.structure_state, 'UP');
  assert.ok(b2c.events.some(event => event.event_type === 'BULLISH_SWEEP'));
  assert.ok(b2c.events.some(event => event.event_type === 'INITIAL_BULLISH_BREAK'));
  assert.ok(b2c.events.some(event => event.event_type === 'BEARISH_SWEEP'));
  assert.ok(b2c.raw_pivots.length > 0);
});
