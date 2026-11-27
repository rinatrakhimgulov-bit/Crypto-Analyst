'use strict';

const assert = require('node:assert/strict');
const { analyze } = require('../src/analysis/b2g-chart-projection-engine.js');

const STEP = 3600000;
const LAG = 500;
const AS_OF = STEP * 20;
const POLICY = {
  version: 'b2g-chart-projection-v1',
  b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: 'b1-quality-policy-2026-11-27-v1',
  b2a_engine_version: '2.0.0-b2a',
  b2a_policy_version: 'b2a-causal-swing-v1',
  b2b_engine_version: '2.0.0-b2b',
  b2b_policy_version: 'b2b-swing-sequence-v1',
  b2c_engine_version: '2.0.0-b2c',
  b2c_policy_version: 'b2c-state-v1',
  b2d_engine_version: '2.0.0-b2d',
  b2d_policy_version: 'b2d-zone-engine-v1',
  b2d_zone_policy_version: 'b2d-absolute-span-v1',
  b2e_engine_version: '2.0.0-b2e',
  b2e_policy_version: 'b2e-retest-engine-v1',
  b2e_retest_policy_version: 'retest-policy-v1',
  b2f_engine_version: '2.0.0-b2f',
  b2f_policy_version: 'b2f-mtf-confluence-v1',
  finality_safety_lag_ms: LAG
};
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
function pivot(id, type, price, sourceIndex, confirmIndex, sequenceStatus = 'ACCEPTED', supersededBy = null) {
  return {
    pivot_id: id,
    type,
    price,
    source_time_ms: sourceIndex * STEP,
    confirmed_at_ms: confirmIndex * STEP,
    available_at_ms: confirmIndex * STEP + LAG,
    confirmation: {
      method: 'CLOSED_CANDLE_SYMMETRIC_WINDOW',
      left_strength: 2,
      right_strength: 2,
      equality_policy: 'EXACT_PRICE_V1',
      finality_safety_lag_ms: LAG
    },
    sequence_status: sequenceStatus,
    superseded_by: supersededBy
  };
}
function makeInput() {
  const snapshotId = 'snapshot-BTCUSDT-1h-' + AS_OF;
  const p1 = pivot('p1', 'SWING_HIGH', 110, 1, 3);
  const p2 = pivot('p2', 'SWING_LOW', 90, 2, 4);
  const p3 = pivot('p3', 'SWING_HIGH', 115, 5, 7);
  const p4 = pivot('p4', 'SWING_HIGH', 114, 6, 8, 'SUPERSEDED_FOR_SEQUENCE', 'p3');
  const raw = [p1, p2, p3, p4];
  const active = [
    { ...p1, structure_label: 'INITIAL_HIGH', comparison_pivot_id: null, price_delta: null, relative_delta_pct: null },
    { ...p2, structure_label: 'INITIAL_LOW', comparison_pivot_id: null, price_delta: null, relative_delta_pct: null },
    { ...p3, structure_label: 'HH', comparison_pivot_id: 'p1', price_delta: 5, relative_delta_pct: 4.54545 }
  ];
  const event = {
    event_id: 'event-1',
    event_type: 'BULLISH_BOS',
    direction: 'BULLISH',
    level_price: 115,
    source_pivot_id: 'p3',
    source_time_ms: p3.source_time_ms,
    pivot_confirmed_at_ms: p3.confirmed_at_ms,
    pivot_available_at_ms: p3.available_at_ms,
    breaking_candle_open_time_ms: STEP * 8,
    breaking_candle_close_time_ms: STEP * 9,
    breaking_candle_close: 116,
    confirmed_at_ms: STEP * 9,
    available_at_ms: STEP * 9 + LAG,
    prior_state: 'UP',
    transition: false,
    confirmation_method: 'CLOSED_CANDLE_CLOSE',
    break_buffer_policy: 'ZERO_BUFFER_V1',
    break_buffer: 0
  };
  const snapshot = {
    contract_version: '1.1.0',
    snapshot_id: snapshotId,
    canonical_symbol: 'BTC/USDT',
    market_type: 'linear_perpetual',
    analysis_as_of_ms: AS_OF,
    provider_server_time_ms: AS_OF,
    candles_by_timeframe: {
      '1h': [{
        open_time_ms: STEP * 19,
        close_time_ms: STEP * 20,
        open: 100, high: 101, low: 99, close: 100,
        volume_base: 1, volume_quote: 100,
        closed_state: 'TIME_DERIVED'
      }]
    },
    forming_candle_by_timeframe: { '1h': null },
    unclassified_candles_by_timeframe: { '1h': [] }
  };
  const report = {
    validator_version: '1.1.0',
    policy_version: POLICY.b1_quality_policy_version,
    snapshot_id: snapshotId,
    status: 'VALID',
    symbol: 'BTC/USDT',
    timeframe: '1h',
    analysis_as_of_ms: AS_OF,
    closed_count: 1,
    valid_count: 1,
    insufficient_history: false
  };
  const b2a = {
    engine_version: '2.0.0-b2a',
    policy_version: 'b2a-causal-swing-v1',
    status: 'VALID',
    admission: { status: 'ADMITTED', snapshot_id: snapshotId, quality_report: {
      snapshot_id: snapshotId,
      validator_version: '1.1.0',
      policy_version: POLICY.b1_quality_policy_version,
      checked_at_ms: AS_OF - 100
    }},
    snapshot_id: snapshotId,
    symbol: 'BTC/USDT',
    timeframe: '1h',
    analysis_as_of_ms: AS_OF,
    pivots: raw.map(({ sequence_status, superseded_by, ...p }) => p)
  };
  const b2c = {
    engine_version: '2.0.0-b2c',
    policy_version: 'b2c-state-v1',
    status: 'VALID',
    admission: {
      status: 'ADMITTED',
      snapshot_id: snapshotId,
      b2b_engine_version: '2.0.0-b2b',
      b2b_policy_version: 'b2b-swing-sequence-v1',
      b1_validator_version: '1.1.0',
      b1_quality_policy_version: POLICY.b1_quality_policy_version
    },
    snapshot_id: snapshotId,
    symbol: 'BTC/USDT',
    timeframe: '1h',
    analysis_as_of_ms: AS_OF,
    structure_state: 'UP',
    raw_pivots: raw,
    pivots: active,
    events: [event]
  };
  const b2d = {
    engine_version: '2.0.0-b2d',
    policy_version: 'b2d-zone-engine-v1',
    zone_policy_version: 'b2d-absolute-span-v1',
    status: 'VALID',
    admission: {
      status: 'ADMITTED',
      snapshot_id: snapshotId,
      b2c_engine_version: '2.0.0-b2c',
      b2c_policy_version: 'b2c-state-v1',
      b1_validator_version: '1.1.0',
      b1_quality_policy_version: POLICY.b1_quality_policy_version
    },
    snapshot_id: snapshotId,
    symbol: 'BTC/USDT',
    timeframe: '1h',
    analysis_as_of_ms: AS_OF,
    zones: [{
      zone_id: 'zone-r-p3-p4',
      role: 'RESISTANCE',
      lower_bound: 114,
      upper_bound: 115,
      representative_price: 114.5,
      cluster_span_price: 1,
      touch_count: 2,
      first_touch_time_ms: p3.source_time_ms,
      last_touch_time_ms: p4.source_time_ms,
      last_touch_age_ms: AS_OF - p4.source_time_ms,
      available_at_ms: p4.available_at_ms,
      pivot_ids: ['p3', 'p4'],
      touches: [],
      evidence_status: 'CONFIRMED_CLUSTER',
      freshness_status: 'NOT_CLASSIFIED'
    }],
    candidate_levels: [
      {
        candidate_id: 'candidate-r-p1',
        role: 'RESISTANCE',
        lower_bound: 110,
        upper_bound: 110,
        representative_price: 110,
        touch_count: 1,
        required_touch_count: 2,
        first_touch_time_ms: p1.source_time_ms,
        last_touch_time_ms: p1.source_time_ms,
        available_at_ms: p1.available_at_ms,
        pivot_ids: ['p1'],
        evidence_status: 'INSUFFICIENT_INDEPENDENT_TOUCHES',
        freshness_status: 'NOT_CLASSIFIED'
      },
      {
        candidate_id: 'candidate-s-p2',
        role: 'SUPPORT',
        lower_bound: 90,
        upper_bound: 90,
        representative_price: 90,
        touch_count: 1,
        required_touch_count: 2,
        first_touch_time_ms: p2.source_time_ms,
        last_touch_time_ms: p2.source_time_ms,
        available_at_ms: p2.available_at_ms,
        pivot_ids: ['p2'],
        evidence_status: 'INSUFFICIENT_INDEPENDENT_TOUCHES',
        freshness_status: 'NOT_CLASSIFIED'
      }
    ]
  };
  const b2e = {
    engine_version: '2.0.0-b2e',
    policy_version: 'b2e-retest-engine-v1',
    retest_policy_version: 'retest-policy-v1',
    status: 'VALID',
    admission: {
      status: 'ADMITTED',
      snapshot_id: snapshotId,
      b2c_engine_version: '2.0.0-b2c',
      b2c_policy_version: 'b2c-state-v1',
      b2d_engine_version: '2.0.0-b2d',
      b2d_policy_version: 'b2d-zone-engine-v1',
      b2d_zone_policy_version: 'b2d-absolute-span-v1',
      b1_validator_version: '1.1.0',
      b1_quality_policy_version: POLICY.b1_quality_policy_version
    },
    snapshot_id: snapshotId,
    symbol: 'BTC/USDT',
    timeframe: '1h',
    analysis_as_of_ms: AS_OF,
    lifecycles: [{
      lifecycle_id: 'lifecycle-event-1-zone',
      breakout_event_id: event.event_id,
      breakout_event_type: event.event_type,
      direction: 'BULLISH',
      original_role: 'RESISTANCE',
      proposed_role: 'SUPPORT',
      effective_role: 'SUPPORT',
      historical_zone: { historical_zone_id: 'hz1', role: 'RESISTANCE', lower_bound: 114, upper_bound: 115 },
      breakout_candle_open_time_ms: event.breaking_candle_open_time_ms,
      breakout_candle_close_time_ms: event.breaking_candle_close_time_ms,
      breakout_available_at_ms: event.available_at_ms,
      retest_window_bars: 3,
      confirmation_window_bars: 2,
      touch_tolerance_price: 0,
      success_buffer_price: 0,
      failure_buffer_price: 0,
      status: 'RETEST_SUCCESSFUL',
      role_transition_status: 'CONFIRMED',
      touch: {
        candle_open_time_ms: STEP * 9,
        candle_close_time_ms: STEP * 10,
        candle_low: 114,
        candle_high: 116,
        candle_close: 115.5,
        bars_after_break: 1
      },
      confirmation: {
        outcome: 'SUCCESS',
        candle_open_time_ms: STEP * 10,
        candle_close_time_ms: STEP * 11,
        candle_close: 116,
        available_at_ms: STEP * 11 + LAG,
        bars_after_touch: 1
      },
      bars_observed_after_break: 3
    }]
  };
  const b2f = {
    engine_version: '2.0.0-b2f',
    policy_version: 'b2f-mtf-confluence-v1',
    status: 'VALID',
    admission: {
      status: 'ADMITTED',
      b1_contract_version: '1.1.0',
      b1_validator_version: '1.1.0',
      b1_quality_policy_version: POLICY.b1_quality_policy_version,
      b2c_engine_version: '2.0.0-b2c',
      b2c_policy_version: 'b2c-state-v1',
      snapshot_ids: { '1d': 'snapshot-1d', '4h': 'snapshot-4h', '1h': snapshotId }
    },
    symbol: 'BTC/USDT',
    market_type: 'linear_perpetual',
    analysis_as_of_ms: AS_OF,
    structure_pattern: 'UP|UP|DOWN',
    alignment_status: 'MIXED',
    alignment_context: 'MIXED_STRUCTURE',
    hierarchical_interpretation: '1H_PULLBACK_AGAINST_BULLISH_1D_4H',
    lower_timeframe_consensus: 'CONFLICT',
    timeframes: {
      '1h': { timeframe: '1h', snapshot_id: snapshotId, structure_state: 'UP' }
    }
  };
  return {
    policy: { ...POLICY },
    chart_timeframe: '1h',
    snapshot,
    quality_report: report,
    b2a_result: b2a,
    b2c_result: b2c,
    b2d_result: b2d,
    b2e_result: b2e,
    b2f_result: b2f
  };
}

run('valid projection maps active pivots, events, zones, retests and MTF context', () => {
  const result = analyze(makeInput());
  assert.equal(result.status, 'VALID');
  assert.equal(result.swing_markers.length, 3);
  assert.equal(result.superseded_pivots.length, 1);
  assert.equal(result.structure_events.length, 1);
  assert.equal(result.zones.length, 1);
  assert.equal(result.candidate_levels.length, 2);
  assert.equal(result.retest_lifecycles.length, 1);
  assert.equal(result.mtf_context.structure_pattern, 'UP|UP|DOWN');
});
run('swing marker preserves source, confirmation and availability times', () => {
  const result = analyze(makeInput());
  const marker = result.swing_markers.find(x => x.id === 'p3');
  assert.equal(marker.anchor_time_ms, STEP * 5);
  assert.equal(marker.confirmed_at_ms, STEP * 7);
  assert.equal(marker.visible_at_ms, STEP * 7 + LAG);
});
run('superseded pivot is separated from active HH/HL sequence', () => {
  const result = analyze(makeInput());
  assert.equal(result.superseded_pivots[0].id, 'p4');
  assert.equal(result.superseded_pivots[0].label, 'SUPERSEDED_FOR_SEQUENCE');
  assert.equal(result.swing_markers.some(x => x.id === 'p4'), false);
});
run('BOS marker anchors to breaking candle but is visible only after close finality', () => {
  const result = analyze(makeInput());
  assert.equal(result.structure_events[0].anchor_time_ms, STEP * 8);
  assert.equal(result.structure_events[0].visible_at_ms, STEP * 9 + LAG);
});
run('confirmed zone begins at availability rather than first touch', () => {
  const result = analyze(makeInput());
  const zone = result.zones[0];
  assert.equal(zone.visible_from_ms, STEP * 8 + LAG);
  assert.notEqual(zone.visible_from_ms, zone.source_first_touch_time_ms);
  assert.equal(zone.visibility_rule, 'DO_NOT_BACKDATE_CONFIRMED_ZONE');
});
run('candidate levels remain distinct from confirmed zones', () => {
  const result = analyze(makeInput());
  assert.ok(result.candidate_levels.every(x => x.kind === 'CANDIDATE_LEVEL'));
  assert.ok(result.zones.every(x => x.kind === 'CONFIRMED_ZONE'));
});
run('successful retest becomes visible at confirmation availability', () => {
  const result = analyze(makeInput());
  assert.equal(result.retest_lifecycles[0].status, 'RETEST_SUCCESSFUL');
  assert.equal(result.retest_lifecycles[0].visible_at_ms, STEP * 11 + LAG);
});
run('pending retest becomes visible at touch finality', () => {
  const input = makeInput();
  const life = input.b2e_result.lifecycles[0];
  life.status = 'RETEST_PENDING_CONFIRMATION';
  life.role_transition_status = 'PENDING';
  life.effective_role = life.original_role;
  life.confirmation = null;
  const result = analyze(input);
  assert.equal(result.retest_lifecycles[0].visible_at_ms, STEP * 10 + LAG);
});
run('expired retest becomes visible at the end of its configured window', () => {
  const input = makeInput();
  const life = input.b2e_result.lifecycles[0];
  life.status = 'RETEST_EXPIRED';
  life.role_transition_status = 'UNCONFIRMED';
  life.effective_role = life.original_role;
  life.touch = null;
  life.confirmation = null;
  const result = analyze(input);
  assert.equal(result.retest_lifecycles[0].visible_at_ms, STEP * 12 + LAG);
});
run('unresolved retest becomes visible at the end of confirmation window', () => {
  const input = makeInput();
  const life = input.b2e_result.lifecycles[0];
  life.status = 'RETEST_UNRESOLVED';
  life.role_transition_status = 'UNCONFIRMED';
  life.effective_role = life.original_role;
  life.confirmation = null;
  const result = analyze(input);
  assert.equal(result.retest_lifecycles[0].visible_at_ms, STEP * 12 + LAG);
});
run('MTF context is copied without inventing a directional score', () => {
  const result = analyze(makeInput());
  assert.equal(result.mtf_context.alignment_status, 'MIXED');
  assert.equal(result.mtf_context.alignment_context, 'MIXED_STRUCTURE');
  assert.equal(Object.prototype.hasOwnProperty.call(result.mtf_context, 'score'), false);
});
run('B2F selected timeframe snapshot mismatch blocks', () => {
  const input = makeInput();
  input.b2f_result.admission.snapshot_ids['1h'] = 'wrong';
  assert.equal(analyze(input).admission.reasons[0].code, 'B2F_RESULT_MISMATCH');
});
run('non-VALID B2A blocks projection', () => {
  const input = makeInput();
  input.b2a_result.status = 'INVALID';
  assert.equal(analyze(input).admission.reasons[0].code, 'B2A_RESULT_MISMATCH');
});
run('non-VALID B2C blocks projection', () => {
  const input = makeInput();
  input.b2c_result.status = 'INVALID';
  assert.equal(analyze(input).admission.reasons[0].code, 'B2C_RESULT_MISMATCH');
});
run('non-VALID B2D blocks projection', () => {
  const input = makeInput();
  input.b2d_result.status = 'INVALID';
  assert.equal(analyze(input).admission.reasons[0].code, 'B2D_RESULT_MISMATCH');
});
run('non-VALID B2E blocks projection', () => {
  const input = makeInput();
  input.b2e_result.status = 'INVALID';
  assert.equal(analyze(input).admission.reasons[0].code, 'B2E_RESULT_MISMATCH');
});
run('non-VALID B2F blocks projection', () => {
  const input = makeInput();
  input.b2f_result.status = 'INVALID';
  assert.equal(analyze(input).admission.reasons[0].code, 'B2F_RESULT_MISMATCH');
});
run('future pivot availability blocks rather than silently filtering', () => {
  const input = makeInput();
  input.b2a_result.pivots[0].available_at_ms = AS_OF + 1;
  input.b2c_result.raw_pivots[0].available_at_ms = AS_OF + 1;
  input.b2c_result.pivots[0].available_at_ms = AS_OF + 1;
  assert.equal(analyze(input).admission.reasons[0].code, 'B2A_PIVOT_EVIDENCE_INVALID');
});
run('future structure event availability blocks', () => {
  const input = makeInput();
  input.b2c_result.events[0].available_at_ms = AS_OF + 1;
  assert.equal(analyze(input).admission.reasons[0].code, 'B2C_EVENT_INVALID');
});
run('future zone availability blocks', () => {
  const input = makeInput();
  input.b2d_result.zones[0].available_at_ms = AS_OF + 1;
  assert.equal(analyze(input).admission.reasons[0].code, 'B2D_ZONE_INVALID');
});
run('future retest confirmation blocks', () => {
  const input = makeInput();
  input.b2e_result.lifecycles[0].confirmation.available_at_ms = AS_OF + 1;
  assert.equal(analyze(input).admission.reasons[0].code, 'B2E_CONFIRMATION_INVALID');
});
run('active sequence must include every accepted raw pivot', () => {
  const input = makeInput();
  input.b2c_result.pivots.pop();
  assert.equal(analyze(input).admission.reasons[0].code, 'B2C_ACTIVE_PIVOT_SET_MISMATCH');
});
run('retest lifecycle must link to an actual B2-C event', () => {
  const input = makeInput();
  input.b2e_result.lifecycles[0].breakout_event_id = 'missing-event';
  assert.equal(analyze(input).admission.reasons[0].code, 'B2E_BREAKOUT_EVENT_LINK_MISMATCH');
});
run('duplicate zone IDs block projection', () => {
  const input = makeInput();
  input.b2d_result.zones.push({ ...input.b2d_result.zones[0] });
  assert.equal(analyze(input).admission.reasons[0].code, 'B2D_ZONE_INVALID');
});
run('projection is deterministic and deeply immutable', () => {
  const input = makeInput();
  const a = analyze(input);
  const b = analyze(input);
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.swing_markers));
  assert.ok(Object.isFrozen(a.swing_markers[0]));
});
run('projection does not mutate inputs or emit candle/trade-decision data', () => {
  const input = makeInput();
  const before = structuredClone(input);
  const result = analyze(input);
  assert.deepEqual(input, before);
  for (const key of ['candles', 'candle_series', 'long', 'short', 'wait', 'entry_price', 'stop_loss', 'take_profit', 'probability', 'confidence']) {
    assert.equal(Object.prototype.hasOwnProperty.call(result, key), false);
  }
});

console.log('B2-G TESTS: ' + passed + '/26 passed');
if (passed !== 26) process.exitCode = 1;
