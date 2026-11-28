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
    { quantile: 0.2, candidates: [a] },
    { quantile: 0.4, candidates: [duplicate, b] }
  ] }
];
const deduped = deduplicateCandidates(entries);
assert.equal(deduped.length, 2);
assert.equal(deduped[0].setup_id, 'setup-A');
assert.equal(deduped[0].first_seen_window_quantile, 0.2);
assert.equal(deduped[1].setup_id, 'setup-B');
assert.equal(chronologicalSplit({ available_at_ms: 59 }, 0, 100), 'TRAIN');
assert.equal(chronologicalSplit({ available_at_ms: 60 }, 0, 100), 'VALIDATION');
assert.equal(chronologicalSplit({ available_at_ms: 80 }, 0, 100), 'TEST');
assert.throws(() => deduplicateCandidates([{ symbol: 'BTCUSDT', timeframe: '1h',
  windows: [{ candidates: [a, { ...a, direction: 'SHORT' }] }] }]), /B8_HISTORICAL_DUPLICATE_ID_CONFLICT/);
console.log('B8 candidate collection: deterministic assertions PASS');
