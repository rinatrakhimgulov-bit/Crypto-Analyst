'use strict';
const assert = require('node:assert/strict');
const { calculateWilderAtr, sampleIndices } = require('../tools/zone_atr_sensitivity_replay.cjs');

function candles(closes) {
  return closes.map((close, i) => ({
    open: close, high: close + 1, low: close - 1, close
  }));
}
const series = candles(Array.from({ length: 20 }, (_, i) => 100 + i));
const atr = calculateWilderAtr(series, 14);
assert.ok(Number.isFinite(atr) && atr > 0);
assert.equal(calculateWilderAtr(series.slice(0, 10), 14), null);
assert.deepEqual(sampleIndices(600, '1h'), [259, 595, 599]);
assert.deepEqual(sampleIndices(280, '1d'), [259, 279]);
console.log('PASS ATR calculation and historical sampling boundary tests');
