'use strict';
const assert = require('node:assert/strict');
const {
  calculateWilderAtr, deriveEventTimePolicy, sampleIndices, resolveLifecycleIndex,
  computeForwardOutcomes
} = require('../tools/b2e_event_time_policy_replay.cjs');

const rows = Array.from({ length: 60 }, (_, i) => ({
  open_time_ms: i * 3600000,
  close_time_ms: (i + 1) * 3600000,
  open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i
}));
const timeToIndex = new Map(rows.map((r, i) => [r.open_time_ms, i]));
assert.ok(calculateWilderAtr(rows.slice(0, 20), 14) > 0);
assert.equal(calculateWilderAtr(rows.slice(0, 10), 14), null);
const policy = deriveEventTimePolicy(100);
assert.equal(policy.zone_span_price, 15);
assert.equal(policy.retest_buffer_price, 5);
assert.equal(deriveEventTimePolicy(0), null);
assert.deepEqual(sampleIndices(600, '1h'), [259, 595, 599]);

const success = { status: 'RETEST_SUCCESSFUL', confirmation: { candle_close_time_ms: rows[15].close_time_ms } };
assert.equal(resolveLifecycleIndex(success, rows, timeToIndex), 15);
const expired = { status: 'RETEST_EXPIRED', breakout_candle_open_time_ms: rows[5].open_time_ms, retest_window_bars: 20 };
assert.equal(resolveLifecycleIndex(expired, rows, timeToIndex), 25);
const unresolved = { status: 'RETEST_UNRESOLVED', touch: { candle_open_time_ms: rows[10].open_time_ms }, confirmation_window_bars: 3 };
assert.equal(resolveLifecycleIndex(unresolved, rows, timeToIndex), 13);
const forward = computeForwardOutcomes(rows, 45, 'BULLISH', 2, [5, 10, 20]);
assert.ok(forward[5].direction_adjusted_return_atr > 0);
assert.equal(forward[20], null);
console.log('PASS event-time ATR policy and retest outcome helper tests');
