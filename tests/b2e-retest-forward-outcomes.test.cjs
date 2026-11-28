'use strict';
const assert = require('node:assert/strict');
const {
  calculateWilderAtr, sampleIndices, computeForwardOutcomes, resolveLifecycleIndex
} = require('../tools/b2e_retest_forward_outcomes.cjs');

const rows = Array.from({ length: 40 }, (_, i) => ({
  open_time_ms: i * 3600000,
  close_time_ms: (i + 1) * 3600000,
  open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i
}));
const index = new Map(rows.map((r, i) => [r.open_time_ms, i]));
assert.ok(calculateWilderAtr(rows.slice(0, 20), 14) > 0);
assert.equal(calculateWilderAtr(rows.slice(0, 10), 14), null);
assert.deepEqual(sampleIndices(600, '1h'), [259, 595, 599]);

const success = {
  status: 'RETEST_SUCCESSFUL',
  confirmation: { candle_close_time_ms: rows[15].close_time_ms }
};
assert.equal(resolveLifecycleIndex(success, rows, index), 14);
const failed = {
  status: 'RETEST_FAILED',
  confirmation: { candle_close_time_ms: rows[18].close_time_ms }
};
assert.equal(resolveLifecycleIndex(failed, rows, index), 17);
const expired = {
  status: 'RETEST_EXPIRED',
  breakout_candle_open_time_ms: rows[5].open_time_ms,
  retest_window_bars: 20
};
assert.equal(resolveLifecycleIndex(expired, rows, index), 25);
const unresolved = {
  status: 'RETEST_UNRESOLVED',
  touch: { candle_open_time_ms: rows[10].open_time_ms },
  confirmation_window_bars: 3
};
assert.equal(resolveLifecycleIndex(unresolved, rows, index), 13);

const forward = computeForwardOutcomes(rows, 10, 'BULLISH', 2, [5, 10, 20]);
assert.ok(forward[5].direction_adjusted_return_atr > 0);
assert.equal(forward[20], null);
console.log('PASS retest resolution timestamps and post-resolution outcome tests');
