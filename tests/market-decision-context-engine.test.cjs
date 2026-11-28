'use strict';

const assert = require('node:assert/strict');
const { analyze } = require('../src/analysis/market-decision-context-engine.js');

const AS_OF = 1700000000500;
const POLICY = {
  version: 'market-decision-context-v1',
  b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: 'b1-quality-v1',
  b2c_engine_version: '2.1.0-b2c', b2c_policy_version: 'b2c-state-v2',
  b2e_engine_version: '2.0.0-b2e', b2e_policy_version: 'b2e-retest-engine-v1',
  zone_context_engine_version: '1.0.0-b2d-zone-context', zone_context_policy_version: 'b2d-zone-context-v1',
  breakout_quality_engine_version: '1.0.0-b2e-breakout-quality', breakout_quality_policy_version: 'b2e-breakout-quality-v1',
  regime_engine_version: '1.0.0-market-regime', regime_policy_version: 'market-regime-policy-v1-initial',
  impulse_engine_version: '1.0.0-market-impulse-event', impulse_policy_version: 'market-impulse-event-v1',
  b7_engine_version: '1.0.0-b7', b7_policy_version: 'b7-explainable-setups-v1'
};
const SNAPSHOT = {
  snapshot_id: 'fixture:decision-context:btc:1h',
  contract_version: '1.1.0', canonical_symbol: 'BTCUSDT', market_type: 'linear_perpetual',
  analysis_as_of_ms: AS_OF, provider_server_time_ms: AS_OF,
  provider_metadata: { time_source: 'provider' }, candles_by_timeframe: { '1h': [{}] }
};
const REPORT = {
  status: 'VALID', snapshot_id: SNAPSHOT.snapshot_id, symbol: 'BTCUSDT',
  timeframe: '1h', analysis_as_of_ms: AS_OF, checked_at_ms: AS_OF - 10,
  validator_version: '1.1.0', policy_version: 'b1-quality-v1'
};
function upstream(engine_version, policy_version, extra = {}) {
  return {
    status: 'VALID', engine_version, policy_version,
    snapshot_id: SNAPSHOT.snapshot_id, symbol: 'BTCUSDT', timeframe: '1h',
    analysis_as_of_ms: AS_OF,
    admission: { status: 'ADMITTED', snapshot_id: SNAPSHOT.snapshot_id },
    ...extra
  };
}
function lifecycle(id, status='RETEST_SUCCESSFUL') {
  return {
    lifecycle_id: id, breakout_event_id: 'break:' + id,
    direction: 'BULLISH', status,
    confirmation: {
      outcome: status === 'RETEST_FAILED' ? 'FAILURE' : 'SUCCESS',
      available_at_ms: AS_OF - 100
    }
  };
}
function candidate(type='BREAKOUT_RETEST', direction='LONG', status='CONFIRMED') {
  const id = 'life-1';
  return {
    setup_id: 'setup-1', setup_type: type, direction, status,
    available_at_ms: AS_OF - 100, invalidation_level: 98,
    reason_codes: ['FIXTURE'], explanation: 'Fixture setup',
    evidence: {
      lifecycle_id: id, breakout_event_id: 'break:' + id
    }
  };
}
function fixture(options={}) {
  const b2cState = options.structure || 'UP';
  const regime = options.regime || (b2cState === 'UP' ? 'UPTREND' : 'DOWNTREND');
  const bias = options.bias || (b2cState === 'UP' ? 'BULLISH' : 'BEARISH');
  const lifeStatus = options.lifecycleStatus || 'RETEST_SUCCESSFUL';
  const setup = options.candidate || candidate(options.setupType || 'BREAKOUT_RETEST',
    options.direction || (b2cState === 'UP' ? 'LONG' : 'SHORT'),
    options.setupStatus || 'CONFIRMED');
  const b2e = upstream('2.0.0-b2e', POLICY.b2e_policy_version, {
    lifecycles: [lifecycle('life-1', lifeStatus)]
  });
  const breakoutQuality = upstream('1.0.0-b2e-breakout-quality', POLICY.breakout_quality_policy_version, {
    breakouts: [{
      lifecycle_id: 'life-1', breakout_event_id: 'break:life-1',
      quality_status: options.breakoutQuality || 'STRONG_EVIDENCE'
    }]
  });
  return {
    policy: { ...POLICY, ...(options.policy || {}) },
    snapshot: SNAPSHOT, quality_report: REPORT,
    analysis_as_of_ms: AS_OF, timeframe: '1h',
    b2c_result: upstream('2.1.0-b2c', POLICY.b2c_policy_version, { structure_state: b2cState }),
    b2e_result: b2e,
    zone_context_result: upstream('1.0.0-b2d-zone-context', POLICY.zone_context_policy_version, {
      zones: [], active_zone_selection: { nearest_support: null, nearest_resistance: null }
    }),
    breakout_quality_result: breakoutQuality,
    regime_result: upstream('1.0.0-market-regime', POLICY.regime_policy_version, {
      regime, directional_bias: bias, structure_state: b2cState
    }),
    impulse_result: upstream('1.0.0-market-impulse-event', POLICY.impulse_policy_version, {
      event: {
        classification: options.impulseClass || 'NO_IMPULSE',
        direction: options.impulseDirection || 'NEUTRAL',
        metrics: { displacement_atr: 0.4 }
      }
    }),
    b7_result: upstream('1.0.0-b7', POLICY.b7_policy_version, {
      setup_candidates: options.candidates || [setup]
    })
  };
}
function run(name, fn) {
  try { fn(); process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + ': ' + error.message + '\n'); process.exitCode = 1; }
}

run('aligned bullish regime, structure, strong retest and B7 setup produce LONG', () => {
  const r = analyze(fixture());
  assert.equal(r.status, 'VALID');
  assert.equal(r.decision, 'LONG');
  assert.equal(r.decision_type, 'RESEARCH_CANDIDATE_ONLY');
  assert.deepEqual(r.selected_setup_ids, ['setup-1']);
});
run('aligned bearish regime, structure, strong retest and B7 setup produce SHORT', () => {
  const r = analyze(fixture({ structure: 'DOWN', direction: 'SHORT' }));
  assert.equal(r.decision, 'SHORT');
});
run('transition regime fails closed to WAIT', () => {
  const r = analyze(fixture({ regime: 'TRANSITION', bias: 'NONE' }));
  assert.equal(r.decision, 'WAIT');
  assert.equal(r.reasons[0].code, 'REGIME_AND_STRUCTURE_NOT_ALIGNED');
});
run('B7 pending setup cannot produce a directional decision', () => {
  const r = analyze(fixture({ setupStatus: 'PENDING' }));
  assert.equal(r.decision, 'WAIT');
  assert.equal(r.reasons[0].code, 'NO_CAUSAL_CONFIRMED_SETUP');
});
run('breakout retest without strong breakout evidence remains WAIT', () => {
  const r = analyze(fixture({ breakoutQuality: 'MIXED_EVIDENCE' }));
  assert.equal(r.decision, 'WAIT');
  assert.ok(r.reasons.some(x => x.code === 'BREAKOUT_QUALITY_NOT_STRONG'));
});
run('failed bearish breakout can produce LONG only as a matching reclaim candidate', () => {
  const item = candidate('FALSE_BREAKOUT_RECLAIM', 'LONG');
  const r = analyze(fixture({
    lifecycleStatus: 'RETEST_FAILED', setupType: 'FALSE_BREAKOUT_RECLAIM',
    direction: 'LONG', candidates: [item]
  }));
  assert.equal(r.decision, 'LONG');
});
run('confirmed opposing bearish impulse blocks LONG', () => {
  const r = analyze(fixture({ impulseClass: 'STRONG_SELL_OFF', impulseDirection: 'BEARISH' }));
  assert.equal(r.decision, 'WAIT');
  assert.equal(r.reasons[0].code, 'OPPOSING_IMPULSE_CONTEXT');
});
run('confirmed opposing bullish impulse blocks SHORT', () => {
  const r = analyze(fixture({
    structure: 'DOWN', direction: 'SHORT',
    impulseClass: 'BULLISH_IMPULSE', impulseDirection: 'BULLISH'
  }));
  assert.equal(r.decision, 'WAIT');
});
run('opposite confirmed setup directions are a conflict', () => {
  const a = candidate('TREND_CONTINUATION_AFTER_CORRECTION', 'LONG');
  const b = { ...candidate('TREND_CONTINUATION_AFTER_CORRECTION', 'SHORT'), setup_id: 'setup-2' };
  const r = analyze(fixture({ candidates: [a, b] }));
  assert.equal(r.decision, 'WAIT');
  assert.equal(r.reasons[0].code, 'CONFLICTING_CONFIRMED_SETUPS');
});
run('trend continuation can qualify without a breakout lifecycle', () => {
  const item = candidate('TREND_CONTINUATION_AFTER_CORRECTION', 'LONG');
  const r = analyze(fixture({ candidates: [item] }));
  assert.equal(r.decision, 'LONG');
});
run('regime and B2-C structure mismatch is blocked', () => {
  const input = fixture({ structure: 'UP', regime: 'DOWNTREND', bias: 'BEARISH' });
  input.regime_result.structure_state = 'DOWN';
  const r = analyze(input);
  assert.equal(r.status, 'BLOCKED');
});
run('upstream snapshot mismatch fails closed', () => {
  const input = fixture();
  input.impulse_result.snapshot_id = 'other';
  const r = analyze(input);
  assert.equal(r.status, 'BLOCKED');
});
run('future setup availability is rejected and does not produce LONG', () => {
  const item = candidate('TREND_CONTINUATION_AFTER_CORRECTION', 'LONG');
  item.available_at_ms = AS_OF + 1;
  const r = analyze(fixture({ candidates: [item] }));
  assert.equal(r.decision, 'WAIT');
});
run('invalid invalidation level is rejected', () => {
  const item = candidate('TREND_CONTINUATION_AFTER_CORRECTION', 'LONG');
  item.invalidation_level = null;
  const r = analyze(fixture({ candidates: [item] }));
  assert.equal(r.decision, 'WAIT');
});
run('identical inputs produce deterministic immutable output without mutation', () => {
  const input = fixture();
  const before = JSON.stringify(input);
  const a = analyze(input), b = analyze(input);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.context));
});
if (process.exitCode) process.exit(process.exitCode);
