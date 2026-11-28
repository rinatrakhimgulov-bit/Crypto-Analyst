'use strict';

const assert = require('node:assert/strict');
const { analyze, ENGINE_VERSION } = require('../src/analysis/b2d-zone-context-engine.js');

const STEP = 3600000;
const LAG = 500;
const AS_OF = 40 * STEP + STEP + LAG;
const POLICY = Object.freeze({
  version: 'b2d-zone-context-v1',
  atr_period: 14,
  freshness_recent_bars: 10,
  freshness_aging_bars: 20,
  max_active_distance_atr: 5
});

function makeCandle(i, close = 105) {
  const openTime = (i + 1) * STEP;
  return {
    open_time_ms: openTime,
    close_time_ms: openTime + STEP,
    canonical_symbol: 'BTCUSDT',
    market_type: 'LINEAR_PERPETUAL',
    timeframe: '1h',
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    closed_state: 'CONFIRMED'
  };
}
function makeZone(id, role, low, high, lastIndex, touches = 2) {
  const lastTouch = (lastIndex + 1) * STEP;
  const items = [];
  for (let i = 0; i < touches; i++) {
    const index = Math.max(0, lastIndex - i * 3);
    items.push({
      pivot_id: id + '-p' + i,
      price: role === 'SUPPORT' ? low : high,
      source_time_ms: (index + 1) * STEP,
      sequence_status: i === 0 ? 'ACCEPTED' : 'SUPERSEDED_FOR_SEQUENCE'
    });
  }
  return {
    zone_id: id, role, lower_bound: low, upper_bound: high,
    representative_price: (low + high) / 2,
    touch_count: touches,
    first_touch_time_ms: Math.min(...items.map(x => x.source_time_ms)),
    last_touch_time_ms: lastTouch,
    available_at_ms: lastTouch + STEP + LAG,
    touches: items
  };
}
function fixture(options = {}) {
  const candles = Array.from({ length: 40 }, (_, i) => makeCandle(i));
  const asOf = candles[candles.length - 1].close_time_ms + LAG;
  const snapshot = {
    snapshot_id: 'fixture:b2d-zone-context:btc:1h',
    canonical_symbol: 'BTCUSDT',
    market_type: 'LINEAR_PERPETUAL',
    analysis_as_of_ms: asOf,
    provider_server_time_ms: asOf,
    provider_metadata: { time_source: 'provider' },
    candles_by_timeframe: { '1h': candles }
  };
  const report = {
    status: 'VALID', snapshot_id: snapshot.snapshot_id,
    symbol: snapshot.canonical_symbol, timeframe: '1h',
    analysis_as_of_ms: asOf, checked_at_ms: asOf - 100,
    closed_count: candles.length, valid_count: candles.length,
    insufficient_history: false
  };
  const zones = options.zones || [
    makeZone('support-near', 'SUPPORT', 98, 99, 34, 3),
    makeZone('resistance-near', 'RESISTANCE', 110, 111, 35, 2),
    makeZone('support-stale', 'SUPPORT', 90, 91, 2, 2),
    makeZone('resistance-far', 'RESISTANCE', 130, 131, 30, 2)
  ];
  const b2d = {
    status: 'VALID', engine_version: '2.0.0-b2d',
    policy_version: 'b2d-zone-engine-v1',
    zone_policy_version: 'b2d-absolute-span-v1',
    snapshot_id: snapshot.snapshot_id, symbol: snapshot.canonical_symbol,
    timeframe: '1h', analysis_as_of_ms: asOf,
    admission: { status: 'ADMITTED', snapshot_id: snapshot.snapshot_id },
    zones
  };
  return {
    policy: { ...POLICY, ...(options.policy || {}) },
    snapshot, quality_report: { ...report, ...(options.report || {}) },
    b2d_result: { ...b2d, ...(options.b2d || {}) },
    analysis_as_of_ms: asOf, timeframe: '1h', finality_safety_lag_ms: LAG
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

run('calculates ATR and enriches support/resistance with distance and freshness', () => {
  const result = analyze(fixture());
  assert.equal(result.status, 'VALID');
  assert.ok(result.atr > 0);
  const support = result.zones.find(z => z.zone_id === 'support-near');
  assert.equal(support.freshness_status, 'FRESH');
  assert.equal(support.relative_position, 'BELOW_CURRENT_PRICE');
  assert.ok(support.distance_atr > 0);
  assert.equal(support.evidence.touch_count, 3);
  assert.equal(support.evidence.accepted_touch_count, 1);
  assert.equal(support.evidence.superseded_touch_count, 2);
});
run('selects the nearest active support and resistance separately', () => {
  const result = analyze(fixture());
  assert.equal(result.active_zone_selection.nearest_support.zone_id, 'support-near');
  assert.equal(result.active_zone_selection.nearest_resistance.zone_id, 'resistance-near');
});
run('marks old zones stale and excludes them from active selection', () => {
  const result = analyze(fixture());
  const stale = result.zones.find(z => z.zone_id === 'support-stale');
  assert.equal(stale.freshness_status, 'STALE');
  assert.equal(stale.is_active, false);
  assert.notEqual(result.active_zone_selection.nearest_support.zone_id, stale.zone_id);
});
run('zone containing current close is marked as intersecting, not mislabeled support/resistance distance', () => {
  const zone = makeZone('inside', 'SUPPORT', 104, 106, 36, 2);
  const result = analyze(fixture({ zones: [zone] }));
  assert.equal(result.zones[0].relative_position, 'CONTAINS_CURRENT_PRICE');
  assert.equal(result.zones[0].distance_price, 0);
  assert.deepEqual(result.active_zone_selection.intersecting_zone_ids, ['inside']);
});
run('distance is normalized by ATR, not raw instrument price', () => {
  const result = analyze(fixture());
  const zone = result.zones.find(z => z.zone_id === 'resistance-near');
  assert.equal(zone.distance_atr, zone.distance_price / result.atr);
});
run('active-zone eligibility is bounded by the explicit ATR-distance policy', () => {
  const result = analyze(fixture({ policy: { max_active_distance_atr: 1 } }));
  assert.equal(result.active_zone_selection.nearest_support, null);
  assert.equal(result.active_zone_selection.nearest_resistance, null);
});
run('invalid policy fails closed', () => {
  const result = analyze(fixture({ policy: { freshness_aging_bars: 5 } }));
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.admission.reasons[0].code, 'B2D_ZONE_CONTEXT_POLICY_INVALID');
});
run('B1 quality identity mismatch fails closed', () => {
  const result = analyze(fixture({ report: { snapshot_id: 'other' } }));
  assert.equal(result.status, 'BLOCKED');
});
run('B2-D snapshot mismatch fails closed', () => {
  const result = analyze(fixture({ b2d: { snapshot_id: 'other' } }));
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.admission.reasons[0].code, 'B2D_RESULT_IDENTITY_MISMATCH');
});
run('forming or unfinalized candles fail closed', () => {
  const input = fixture();
  input.snapshot.candles_by_timeframe['1h'][39].closed_state = 'FORMING';
  const result = analyze(input);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.admission.reasons[0].code, 'CANDLE_NOT_FINAL_CLOSED');
});
run('candle gaps fail closed', () => {
  const input = fixture();
  input.snapshot.candles_by_timeframe['1h'][20].open_time_ms += STEP;
  input.snapshot.candles_by_timeframe['1h'][20].close_time_ms += STEP;
  const result = analyze(input);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.admission.reasons[0].code, 'B1_CANDLE_ORDER_OR_GAP_INVALID');
});
run('invalid zone provenance fails closed', () => {
  const zone = makeZone('bad', 'SUPPORT', 98, 99, 34, 2);
  zone.available_at_ms = AS_OF + 1;
  const result = analyze(fixture({ zones: [zone] }));
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.admission.reasons[0].code, 'B2D_ZONE_EVIDENCE_INVALID');
});
run('insufficient ATR history fails closed', () => {
  const input = fixture();
  input.policy.atr_period = 100;
  const result = analyze(input);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.admission.reasons[0].code, 'ATR_INSUFFICIENT_OR_ZERO');
});
run('result is deeply immutable and inputs are not mutated', () => {
  const input = fixture();
  const before = JSON.stringify(input);
  const result = analyze(input);
  assert.equal(JSON.stringify(input), before);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.zones));
  assert.ok(Object.isFrozen(result.zones[0]));
  assert.ok(Object.isFrozen(result.zones[0].evidence));
});
run('same input and policy produce deterministic output', () => {
  const input = fixture();
  assert.deepEqual(analyze(input), analyze(input));
});

if (process.exitCode) process.exit(process.exitCode);
