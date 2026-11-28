'use strict';
const assert = require('node:assert/strict');
const {
  calculateWilderAtr, sampleIndices, computeForwardOutcomes, summarizeOutcomes
} = require('../tools/b2e_breakout_forward_outcomes.cjs');

const candles = Array.from({ length: 30 }, (_, i) => ({
  open_time_ms: i * 3600000,
  open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i
}));
assert.ok(calculateWilderAtr(candles, 14) > 0);
assert.equal(calculateWilderAtr(candles.slice(0, 10), 14), null);
assert.deepEqual(sampleIndices(600, '1h'), [259, 595, 599]);

const outcomes = computeForwardOutcomes(candles, 5, 'BULLISH', 2, [5, 10, 20]);
assert.ok(outcomes[5].direction_adjusted_return_atr > 0);
assert.ok(outcomes[5].favorable_excursion_atr >= 0);
assert.equal(outcomes[20], null);
assert.equal(computeForwardOutcomes(candles, 5, 'BEARISH', 0, [5]), null);

const events = [
  { quality_status: 'STRONG_EVIDENCE', forward_outcomes: { 5: { direction_adjusted_return_atr: 1, favorable_excursion_atr: 1.5, adverse_excursion_atr: 0.2, positive_close: true, move_at_least_0_5_atr: true, adverse_close_at_least_0_5_atr: false } } },
  { quality_status: 'STRONG_EVIDENCE', forward_outcomes: { 5: { direction_adjusted_return_atr: -0.5, favorable_excursion_atr: 0.2, adverse_excursion_atr: 0.7, positive_close: false, move_at_least_0_5_atr: false, adverse_close_at_least_0_5_atr: true } } }
];
const summary = summarizeOutcomes(events, 'quality_status');
assert.equal(summary.STRONG_EVIDENCE.event_count, 2);
assert.equal(summary.STRONG_EVIDENCE.horizons[5].evaluated_count, 2);
assert.equal(summary.STRONG_EVIDENCE.horizons[5].positive_close_rate, 0.5);
console.log('PASS breakout forward-outcome calculations and summary tests');
