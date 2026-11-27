'use strict';

const assert = require('node:assert/strict');
const { analyze } = require('../src/analysis/b2f-mtf-structure-confluence-engine.js');
const { analyze: analyzeB2A } = require('../src/analysis/b2-causal-swing-engine.js');
const { analyze: analyzeB2B } = require('../src/analysis/b2b-swing-sequence-engine.js');
const { analyze: analyzeB2C } = require('../src/analysis/b2c-swing-structure-engine.js');

const REQUIRED = ['1d', '4h', '1h'];
const STEP = { '1d': 86400000, '4h': 14400000, '1h': 3600000 };
const LAG = 500;
const POLICY = {
  version: 'b2f-mtf-confluence-v1',
  b1_mtf_contract_version: '1.0.0',
  b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: 'b1-quality-policy-2026-11-27-v1',
  b2b_engine_version: '2.0.0-b2b',
  b2b_policy_version: 'b2b-swing-sequence-v1',
  b2c_engine_version: '2.0.0-b2c',
  b2c_policy_version: 'b2c-state-v1',
  finality_safety_lag_ms: LAG,
  max_provider_time_spread_ms: 50
};
const CUTOFF = 1700000000000;
let passed = 0;
function run(name, fn) {
  try {
    fn();
    passed++;
    console.log('PASS ' + name);
  } catch (error) {
    console.error('FAIL ' + name + '\n' + (error && error.stack ? error.stack : error));
    process.exitCode = 1;
  }
}
function makeCandle(tf, openTime, values = {}) {
  const closeTime = openTime + STEP[tf];
  return {
    provider_id: 'bybit-v5-rest',
    venue: 'bybit',
    market_type: 'linear_perpetual',
    canonical_symbol: 'BTC/USDT',
    provider_symbol: 'BTCUSDT',
    timeframe: tf,
    open_time_ms: openTime,
    close_time_ms: closeTime,
    open: values.open ?? 100,
    high: values.high ?? 101,
    low: values.low ?? 99,
    close: values.close ?? 100,
    volume_base: 1,
    volume_quote: 100,
    closed_state: 'TIME_DERIVED',
    provider_event_time_ms: null,
    received_at_ms: null,
    normalizer_version: 'bybit-rest-v1'
  };
}
function makeEvent(tf, state, candleClose, suffix = 'a') {
  if (state === 'UNESTABLISHED') return [];
  const bullish = state === 'UP';
  return [{
    event_id: 'event-' + tf + '-' + suffix,
    event_type: bullish ? 'BULLISH_BOS' : 'BEARISH_BOS',
    direction: bullish ? 'BULLISH' : 'BEARISH',
    level_price: 100,
    source_pivot_id: 'pivot-' + tf,
    breaking_candle_close_time_ms: candleClose,
    available_at_ms: candleClose + LAG,
    prior_state: state,
    transition: false
  }];
}
function makeInput(states = { '1d': 'UP', '4h': 'UP', '1h': 'UP' }, options = {}) {
  const cutoff = options.cutoff ?? CUTOFF;
  const count = options.count ?? 10;
  const timeframes = {};
  const b2c = {};
  const providerOffsets = { '1d': 0, '4h': 10, '1h': 20 };
  for (const tf of REQUIRED) {
    const step = STEP[tf];
    const end = Math.floor((cutoff - LAG) / step) * step - step;
    const start = end - (count - 1) * step;
    const candles = Array.from({ length: count }, (_, i) => makeCandle(tf, start + i * step));
    const snapshotId = 'snapshot-' + tf + '-' + cutoff;
    const snapshot = {
      contract_version: '1.1.0',
      snapshot_id: snapshotId,
      canonical_symbol: 'BTC/USDT',
      market_type: 'linear_perpetual',
      analysis_as_of_ms: cutoff,
      provider_server_time_ms: cutoff,
      received_at_ms: cutoff + 100,
      provider_metadata: {
        provider_id: 'bybit-v5-rest',
        venue: 'bybit',
        provider_symbol: 'BTCUSDT',
        market_type: 'linear_perpetual',
        host: 'api.bybit.com',
        time_source: 'provider'
      },
      candles_by_timeframe: { [tf]: candles },
      forming_candle_by_timeframe: { [tf]: null },
      unclassified_candles_by_timeframe: { [tf]: [] }
    };
    const report = {
      validator_version: '1.1.0',
      policy_version: 'b1-quality-policy-2026-11-27-v1',
      snapshot_id: snapshotId,
      status: 'VALID',
      reasons: [],
      symbol: 'BTC/USDT',
      timeframe: tf,
      analysis_as_of_ms: cutoff,
      received_at_ms: cutoff + 100,
      valid_count: count,
      closed_count: count,
      forming_count: 0,
      unknown_finality_count: 0,
      insufficient_history: false,
      checked_at_ms: cutoff - 100
    };
    const providerTime = cutoff + providerOffsets[tf];
    timeframes[tf] = {
      timeframe: tf,
      provider_time_ms: providerTime,
      receive_time_ms: cutoff + 200 + providerOffsets[tf],
      status: 'VALID',
      snapshot,
      analysis_candles: candles.map(c => ({ ...c })),
      forming_context: null,
      pending_finality_context: [],
      quality_report: report,
      reasons: []
    };
    const lastClose = candles[candles.length - 1].close_time_ms;
    b2c[tf] = {
      engine_version: '2.0.0-b2c',
      policy_version: 'b2c-state-v1',
      status: 'VALID',
      admission: {
        status: 'ADMITTED',
        snapshot_id: snapshotId,
        b2b_engine_version: '2.0.0-b2b',
        b2b_policy_version: 'b2b-swing-sequence-v1',
        b1_validator_version: '1.1.0',
        b1_quality_policy_version: 'b1-quality-policy-2026-11-27-v1'
      },
      snapshot_id: snapshotId,
      symbol: 'BTC/USDT',
      timeframe: tf,
      analysis_as_of_ms: cutoff,
      structure_state: states[tf],
      events: makeEvent(tf, states[tf], lastClose)
    };
  }
  const providerTimes = REQUIRED.map(tf => timeframes[tf].provider_time_ms);
  const mtf = {
    contract_version: '1.0.0',
    status: 'VALID',
    directional_allowed: true,
    required_timeframes: REQUIRED.slice(),
    analysis_as_of_ms: cutoff,
    symbol: 'BTCUSDT',
    market_type: 'linear_perpetual',
    provider_time_spread_ms: Math.max(...providerTimes) - Math.min(...providerTimes),
    max_provider_time_spread_ms: 50,
    requested_closed_count: count,
    timeframes
  };
  return { policy: { ...POLICY }, mtf_result: mtf, b2c_by_timeframe: b2c };
}

run('full bullish alignment is explicit and unweighted', () => {
  const result = analyze(makeInput({ '1d': 'UP', '4h': 'UP', '1h': 'UP' }));
  assert.equal(result.status, 'VALID');
  assert.equal(result.structure_pattern, 'UP|UP|UP');
  assert.equal(result.alignment_status, 'FULL_BULLISH');
  assert.equal(result.alignment_context, 'BULLISH_STRUCTURE');
  assert.equal(result.hierarchical_interpretation, 'FULL_TIMEFRAME_ALIGNMENT');
});
run('MTF display market label may differ from canonical snapshot market type', () => {
  const input = makeInput();
  input.mtf_result.market_type = 'Linear Perpetual';
  const result = analyze(input);
  assert.equal(result.status, 'VALID');
  assert.equal(result.market_type, 'linear_perpetual');
  assert.equal(result.source_market_type_label, 'Linear Perpetual');
});

run('full bearish alignment is symmetric', () => {
  const result = analyze(makeInput({ '1d': 'DOWN', '4h': 'DOWN', '1h': 'DOWN' }));
  assert.equal(result.alignment_status, 'FULL_BEARISH');
  assert.equal(result.alignment_context, 'BEARISH_STRUCTURE');
});
run('partial bullish alignment preserves unestablished timeframe', () => {
  const result = analyze(makeInput({ '1d': 'UP', '4h': 'UNESTABLISHED', '1h': 'UP' }));
  assert.equal(result.alignment_status, 'PARTIAL_BULLISH');
  assert.equal(result.alignment_context, 'PARTIAL_BULLISH_STRUCTURE');
});
run('partial bearish alignment preserves unestablished timeframe', () => {
  const result = analyze(makeInput({ '1d': 'DOWN', '4h': 'DOWN', '1h': 'UNESTABLISHED' }));
  assert.equal(result.alignment_status, 'PARTIAL_BEARISH');
});
run('all unestablished timeframes do not invent a direction', () => {
  const result = analyze(makeInput({ '1d': 'UNESTABLISHED', '4h': 'UNESTABLISHED', '1h': 'UNESTABLISHED' }));
  assert.equal(result.alignment_status, 'UNESTABLISHED');
  assert.equal(result.alignment_context, 'UNESTABLISHED_STRUCTURE');
});
run('any opposing UP and DOWN states are mixed', () => {
  const result = analyze(makeInput({ '1d': 'UP', '4h': 'DOWN', '1h': 'UNESTABLISHED' }));
  assert.equal(result.alignment_status, 'MIXED');
  assert.equal(result.hierarchical_interpretation, 'MULTI_TIMEFRAME_CONFLICT');
});
run('1H down move against bullish daily and 4H is identified as pullback', () => {
  const result = analyze(makeInput({ '1d': 'UP', '4h': 'UP', '1h': 'DOWN' }));
  assert.equal(result.hierarchical_interpretation, '1H_PULLBACK_AGAINST_BULLISH_1D_4H');
  assert.equal(result.lower_timeframe_consensus, 'CONFLICT');
});
run('1H up move against bearish daily and 4H is identified as bounce', () => {
  const result = analyze(makeInput({ '1d': 'DOWN', '4h': 'DOWN', '1h': 'UP' }));
  assert.equal(result.hierarchical_interpretation, '1H_BOUNCE_AGAINST_BEARISH_1D_4H');
});
run('4H and 1H bearish against bullish daily are identified', () => {
  const result = analyze(makeInput({ '1d': 'UP', '4h': 'DOWN', '1h': 'DOWN' }));
  assert.equal(result.hierarchical_interpretation, '4H_1H_COUNTERTREND_BEARISH_VS_1D');
  assert.equal(result.lower_timeframe_consensus, 'BEARISH');
});
run('4H and 1H bullish against bearish daily are identified', () => {
  const result = analyze(makeInput({ '1d': 'DOWN', '4h': 'UP', '1h': 'UP' }));
  assert.equal(result.hierarchical_interpretation, '4H_1H_COUNTERTREND_BULLISH_VS_1D');
  assert.equal(result.lower_timeframe_consensus, 'BULLISH');
});
run('lower timeframe consensus distinguishes partial and unestablished states', () => {
  assert.equal(analyze(makeInput({ '1d': 'UP', '4h': 'UP', '1h': 'UNESTABLISHED' })).lower_timeframe_consensus, 'PARTIAL');
  assert.equal(analyze(makeInput({ '1d': 'UP', '4h': 'UNESTABLISHED', '1h': 'UNESTABLISHED' })).lower_timeframe_consensus, 'UNESTABLISHED');
});
run('missing timeframe blocks all output', () => {
  const input = makeInput();
  delete input.b2c_by_timeframe['4h'];
  const result = analyze(input);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.admission.reasons[0].code, 'B2C_TIMEFRAME_COLLECTION_INVALID');
});
run('B1 MTF non-VALID status blocks', () => {
  const input = makeInput();
  input.mtf_result.status = 'STALE';
  assert.equal(analyze(input).status, 'BLOCKED');
});
run('B1 MTF directional permission false blocks', () => {
  const input = makeInput();
  input.mtf_result.directional_allowed = false;
  assert.equal(analyze(input).admission.reasons[0].code, 'B1_MTF_DIRECTIONAL_PERMISSION_FALSE');
});
run('MTF maximum provider-time spread must match the B2-F policy', () => {
  const input = makeInput();
  input.mtf_result.max_provider_time_spread_ms = 100;
  assert.equal(analyze(input).admission.reasons[0].code, 'B1_MTF_METADATA_INVALID');
});

run('common cutoff mismatch in one snapshot blocks', () => {
  const input = makeInput();
  input.mtf_result.timeframes['4h'].snapshot.analysis_as_of_ms -= 1;
  assert.equal(analyze(input).admission.reasons[0].code, 'B1_MTF_SNAPSHOT_QUALITY_MISMATCH');
});
run('quality report snapshot mismatch blocks', () => {
  const input = makeInput();
  input.mtf_result.timeframes['1h'].quality_report.snapshot_id = 'wrong-snapshot';
  assert.equal(analyze(input).admission.reasons[0].code, 'B1_MTF_SNAPSHOT_QUALITY_MISMATCH');
});
run('non-VALID B2-C timeframe result blocks', () => {
  const input = makeInput();
  input.b2c_by_timeframe['1d'].status = 'INVALID';
  assert.equal(analyze(input).admission.reasons[0].code, 'B2C_TIMEFRAME_RESULT_MISMATCH');
});
run('unknown B2-C structure state blocks', () => {
  const input = makeInput();
  input.b2c_by_timeframe['4h'].structure_state = 'SIDEWAYS';
  assert.equal(analyze(input).admission.reasons[0].code, 'B2C_TIMEFRAME_RESULT_MISMATCH');
});
run('duplicate B2-C event IDs block', () => {
  const input = makeInput();
  input.b2c_by_timeframe['1d'].events.push({ ...input.b2c_by_timeframe['1d'].events[0] });
  assert.equal(analyze(input).admission.reasons[0].code, 'B2C_EVENT_HISTORY_INVALID');
});
run('event available after common cutoff blocks', () => {
  const input = makeInput();
  input.b2c_by_timeframe['1d'].events[0].available_at_ms = input.mtf_result.analysis_as_of_ms + 1;
  assert.equal(analyze(input).admission.reasons[0].code, 'B2C_EVENT_HISTORY_INVALID');
});
run('B2-C event close timestamps must align to their timeframe', () => {
  const input = makeInput();
  input.b2c_by_timeframe['4h'].events[0].breaking_candle_close_time_ms += 1;
  input.b2c_by_timeframe['4h'].events[0].available_at_ms += 1;
  assert.equal(analyze(input).admission.reasons[0].code, 'B2C_EVENT_HISTORY_INVALID');
});

run('provider-time spread is recomputed rather than trusted', () => {
  const input = makeInput();
  input.mtf_result.provider_time_spread_ms = 0;
  assert.equal(analyze(input).admission.reasons[0].code, 'B1_MTF_PROVIDER_TIME_SPREAD_MISMATCH');
});
run('extra per-timeframe snapshot series are rejected', () => {
  const input = makeInput();
  input.mtf_result.timeframes['1d'].snapshot.candles_by_timeframe['4h'] = [];
  assert.equal(analyze(input).admission.reasons[0].code, 'B1_MTF_CANONICAL_CANDLES_INVALID');
});
run('duplicate snapshot IDs across timeframe entries are rejected', () => {
  const input = makeInput();
  input.mtf_result.timeframes['4h'].snapshot.snapshot_id = input.mtf_result.timeframes['1d'].snapshot.snapshot_id;
  input.mtf_result.timeframes['4h'].quality_report.snapshot_id = input.mtf_result.timeframes['1d'].snapshot.snapshot_id;
  input.b2c_by_timeframe['4h'].snapshot_id = input.mtf_result.timeframes['1d'].snapshot.snapshot_id;
  input.b2c_by_timeframe['4h'].admission.snapshot_id = input.mtf_result.timeframes['1d'].snapshot.snapshot_id;
  assert.equal(analyze(input).admission.reasons[0].code, 'B1_MTF_SNAPSHOT_QUALITY_MISMATCH');
});
run('event availability must equal break close plus exact B1 finality lag', () => {
  const input = makeInput();
  input.b2c_by_timeframe['1d'].events[0].available_at_ms += 1;
  assert.equal(analyze(input).admission.reasons[0].code, 'B2C_EVENT_HISTORY_INVALID');
});

run('same input produces deterministic deeply immutable output', () => {
  const input = makeInput();
  const a = analyze(input);
  const b = analyze(input);
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.timeframes));
  assert.ok(Object.isFrozen(a.timeframes['1d']));
});
run('engine does not mutate inputs and emits no trade-decision fields', () => {
  const input = makeInput();
  const before = structuredClone(input);
  const result = analyze(input);
  assert.deepEqual(input, before);
  for (const key of ['long', 'short', 'wait', 'confidence', 'probability', 'entry_price', 'stop_loss', 'take_profit']) {
    assert.equal(Object.prototype.hasOwnProperty.call(result, key), false);
  }
});
run('full B1-E three-timeframe snapshot plus actual B2-A/B/C engines yields UP|UP|DOWN', () => {
  const cutoff = CUTOFF;
  const timeframes = {};
  const b2cByTf = {};
  const offsets = { '1d': 0, '4h': 10, '1h': 20 };
  for (const tf of REQUIRED) {
    const step = STEP[tf];
    const count = 20;
    const end = Math.floor((cutoff - LAG) / step) * step - step;
    const start = end - (count - 1) * step;
    const candles = Array.from({ length: count }, (_, i) => makeCandle(tf, start + i * step));
    const direction = tf === '1h' ? 'DOWN' : 'UP';
    if (direction === 'UP') {
      Object.assign(candles[2], { open: 100, high: 110, low: 96, close: 101 });
      Object.assign(candles[3], { open: 100, high: 106, low: 97, close: 101 });
      Object.assign(candles[4], { open: 100, high: 105, low: 90, close: 101 });
      Object.assign(candles[5], { open: 100, high: 112, low: 99, close: 111 });
      Object.assign(candles[6], { open: 111, high: 113, low: 100, close: 112 });
    } else {
      Object.assign(candles[2], { open: 100, high: 104, low: 90, close: 99 });
      Object.assign(candles[3], { open: 100, high: 105, low: 94, close: 99 });
      Object.assign(candles[4], { open: 100, high: 105, low: 95, close: 99 });
      Object.assign(candles[5], { open: 100, high: 101, low: 88, close: 89 });
      Object.assign(candles[6], { open: 89, high: 99, low: 87, close: 88 });
    }
    const snapshotId = 'integration-' + tf + '-' + cutoff;
    const snapshot = {
      contract_version: '1.1.0',
      snapshot_id: snapshotId,
      canonical_symbol: 'BTC/USDT',
      market_type: 'linear_perpetual',
      analysis_as_of_ms: cutoff,
      provider_server_time_ms: cutoff,
      received_at_ms: cutoff + 100,
      provider_metadata: {
        provider_id: 'bybit-v5-rest', venue: 'bybit', provider_symbol: 'BTCUSDT',
        market_type: 'linear_perpetual', host: 'api.bybit.com', time_source: 'provider'
      },
      candles_by_timeframe: { [tf]: candles },
      forming_candle_by_timeframe: { [tf]: null },
      unclassified_candles_by_timeframe: { [tf]: [] }
    };
    const report = {
      validator_version: '1.1.0', policy_version: 'b1-quality-policy-2026-11-27-v1',
      snapshot_id: snapshotId, status: 'VALID', reasons: [],
      symbol: 'BTC/USDT', timeframe: tf, analysis_as_of_ms: cutoff,
      received_at_ms: cutoff + 100, valid_count: count, closed_count: count,
      forming_count: 0, unknown_finality_count: 0, insufficient_history: false,
      checked_at_ms: cutoff - 100
    };
    const b2a = analyzeB2A({
      snapshot, quality_report: report, timeframe: tf, analysis_as_of_ms: cutoff,
      policy: {
        version: 'b2a-causal-swing-v1', b1_contract_version: '1.1.0',
        b1_validator_version: '1.1.0', b1_quality_policy_version: 'b1-quality-policy-2026-11-27-v1',
        left_strength: 2, right_strength: 2, finality_safety_lag_ms: LAG,
        price_equality_policy: 'EXACT_PRICE_V1'
      }
    });
    assert.equal(b2a.status, 'VALID', JSON.stringify(b2a.admission.reasons));
    const b2b = analyzeB2B({
      b2a_result: b2a,
      policy: {
        version: 'b2b-swing-sequence-v1', b2a_engine_version: '2.0.0-b2a',
        b2a_policy_version: 'b2a-causal-swing-v1', b1_validator_version: '1.1.0',
        b1_quality_policy_version: 'b1-quality-policy-2026-11-27-v1', price_equality_policy: 'EXACT_PRICE_V1'
      }
    });
    assert.equal(b2b.status, 'VALID', JSON.stringify(b2b.admission.reasons));
    const b2c = analyzeB2C({
      policy: {
        version: 'b2c-state-v1', b2b_engine_version: '2.0.0-b2b',
        b2b_policy_version: 'b2b-swing-sequence-v1', b2a_engine_version: '2.0.0-b2a',
        b2a_policy_version: 'b2a-causal-swing-v1', b1_contract_version: '1.1.0',
        b1_validator_version: '1.1.0', b1_quality_policy_version: 'b1-quality-policy-2026-11-27-v1',
        finality_safety_lag_ms: LAG, price_equality_policy: 'EXACT_PRICE_V1',
        break_buffer_policy: 'ZERO_BUFFER_V1'
      },
      snapshot, quality_report: report, b2a_result: b2a, b2b_result: b2b,
      analysis_as_of_ms: cutoff, timeframe: tf
    });
    assert.equal(b2c.status, 'VALID', JSON.stringify(b2c.admission.reasons));
    assert.equal(b2c.structure_state, direction);
    const providerTime = cutoff + offsets[tf];
    timeframes[tf] = {
      timeframe: tf, provider_time_ms: providerTime, receive_time_ms: cutoff + 200 + offsets[tf],
      status: 'VALID', snapshot, analysis_candles: candles.map(c => ({ ...c })),
      forming_context: null, pending_finality_context: [], quality_report: report, reasons: []
    };
    b2cByTf[tf] = b2c;
  }
  const mtf = {
    contract_version: '1.0.0', status: 'VALID', directional_allowed: true,
    required_timeframes: REQUIRED.slice(), analysis_as_of_ms: cutoff,
    symbol: 'BTCUSDT', market_type: 'linear_perpetual',
    provider_time_spread_ms: 20, max_provider_time_spread_ms: 50,
    requested_closed_count: 20, timeframes
  };
  const result = analyze({ policy: { ...POLICY }, mtf_result: mtf, b2c_by_timeframe: b2cByTf });
  assert.equal(result.status, 'VALID', JSON.stringify(result.admission.reasons));
  assert.equal(result.structure_pattern, 'UP|UP|DOWN');
  assert.equal(result.alignment_status, 'MIXED');
  assert.equal(result.hierarchical_interpretation, '1H_PULLBACK_AGAINST_BULLISH_1D_4H');
});

console.log('B2-F TESTS: ' + passed + '/30 passed');
if (passed !== 30) process.exitCode = 1;
