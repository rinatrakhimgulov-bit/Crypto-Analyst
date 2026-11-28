'use strict';

const assert = require('node:assert/strict');
const { deduplicateCandidates, chronologicalSplit } = require('../src/research/b8-candidate-collection.js');

const a = { setup_id: 'setup-A', setup_type: 'BREAKOUT_RETEST', direction: 'LONG',
  status: 'CONFIRMED', available_at_ms: 300, invalidation_level: 90 };
const duplicate = { ...a, first_seen_window_quantile: 0.4 };
const b = { setup_id: 'setup-B', setup_type: 'FALSE_BREAKOUT_RECLAIM', direction: 'SHORT',
  status: 'CONFIRMED', available_at_ms: 850, invalidation_level: 110 };
const entries = [
  { symbol: 'BTCUSDT', timeframe: '1h', windows: [
    { quantile: 0.2, end_time_ms: 200, candidates: [a] },
    { quantile: 0.4, end_time_ms: 400, candidates: [duplicate, b] }
  ] }
];
const deduped = deduplicateCandidates(entries);
assert.equal(deduped.length, 2);
assert.equal(deduped[0].setup_id, 'setup-A');
assert.equal(deduped[0].first_seen_window_quantile, 0.2);
assert.equal(deduped[0].first_seen_window_end_ms, 200);
assert.equal(deduped[1].setup_id, 'setup-B');
const pending = { ...a, status: 'PENDING', available_at_ms: 250 };
const confirmedLater = { ...a, status: 'CONFIRMED', available_at_ms: 300 };
const lifecycle = deduplicateCandidates([{ symbol: 'BTCUSDT', timeframe: '1h',
  windows: [{ quantile: 0.2, candidates: [pending] }, { quantile: 0.4, candidates: [confirmedLater] }] }]);
assert.equal(lifecycle.length, 1);
assert.equal(lifecycle[0].status, 'CONFIRMED');
assert.equal(lifecycle[0].available_at_ms, 300);
assert.equal(lifecycle[0].first_seen_window_end_ms, null);
assert.equal(lifecycle[0].confirmation_observed_window_end_ms, null);
assert.equal(lifecycle[0].availability_time_conflict, false, 'pending-to-confirmed availability is an expected lifecycle transition');
const availabilityDrift = deduplicateCandidates([{ symbol: 'BTCUSDT', timeframe: '1h', windows: [
  { end_time_ms: 400, candidates: [{ ...a, available_at_ms: 300 }] },
  { end_time_ms: 500, candidates: [{ ...a, available_at_ms: 350 }] }
] }]);
assert.equal(availabilityDrift[0].available_at_ms, 350, 'use latest sampled availability conservatively');
assert.equal(availabilityDrift[0].availability_time_conflict, true);
assert.equal(availabilityDrift[0].availability_time_variant_count, 2);

assert.throws(() => deduplicateCandidates([{ symbol: 'BTCUSDT', timeframe: '1h', windows: [
  { candidates: [{ ...pending, direction: 'LONG' }] },
  { candidates: [{ ...confirmedLater, direction: 'SHORT' }] }
] }]), /B8_HISTORICAL_DUPLICATE_ID_CONFLICT/);

const drift = deduplicateCandidates([{ symbol: 'BTCUSDT', timeframe: '1h', windows: [
  { end_time_ms: 400, candidates: [{ ...a, invalidation_level: 90 }] },
  { end_time_ms: 500, candidates: [{ ...a, invalidation_level: 91 }] }
] }]);
assert.equal(drift.length, 1);
assert.equal(drift[0].invalidation_level, null, 'drifting stop proxy must not be selected');
assert.equal(drift[0].invalidation_level_conflict, true);
assert.equal(drift[0].invalidation_level_variant_count, 2);

assert.equal(chronologicalSplit({ available_at_ms: 59 }, 0, 100), 'TRAIN');
assert.equal(chronologicalSplit({ available_at_ms: 60 }, 0, 100), 'VALIDATION');
assert.equal(chronologicalSplit({ available_at_ms: 80 }, 0, 100), 'TEST');
assert.equal(chronologicalSplit({ available_at_ms: 59 }, 0, 100, 59), 'TRAIN');
assert.equal(chronologicalSplit({ available_at_ms: 59 }, 0, 100, 60), 'PURGED_TRAIN_BOUNDARY');
assert.equal(chronologicalSplit({ available_at_ms: 60 }, 0, 100, 79), 'VALIDATION');
assert.equal(chronologicalSplit({ available_at_ms: 60 }, 0, 100, 80), 'PURGED_VALIDATION_BOUNDARY');
assert.equal(chronologicalSplit({ available_at_ms: 80 }, 0, 100, 99), 'TEST');
assert.throws(() => chronologicalSplit({ available_at_ms: 59 }, 0, 100, NaN), /B8_SPLIT_OUTCOME_END_INVALID/);
assert.throws(() => deduplicateCandidates([{ symbol: 'BTCUSDT', timeframe: '1h',
  windows: [{ candidates: [a, { ...a, direction: 'SHORT' }] }] }]), /B8_HISTORICAL_DUPLICATE_ID_CONFLICT/);
console.log('B8 candidate collection: deterministic assertions PASS');
