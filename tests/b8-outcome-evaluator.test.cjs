'use strict';

const assert = require('node:assert/strict');
const { evaluateCandidate } = require('../src/research/b8-outcome-evaluator.js');
const { wilsonInterval, summarizeOutcomes } = require('../src/research/b8-statistics.js');

function candles(rows, step = 60000) {
  return rows.map((r, i) => ({
    open_time_ms: i * step, close_time_ms: (i + 1) * step,
    open: r[0], high: r[1], low: r[2], close: r[3]
  }));
}
function candidate(overrides = {}) {
  return { setup_id: 'candidate-1', setup_type: 'BREAKOUT_RETEST',
    direction: 'LONG', status: 'CONFIRMED', available_at_ms: 60500,
    invalidation_level: 95, ...overrides };
}

{
  const cs = candles([[100,102,99,101],[101,103,100,102],[102,104,101,103],[103,105,102,104],[104,106,103,105]]);
  const r = evaluateCandidate({ candidate: candidate(), candles: cs, horizons: [1,2] });
  assert.equal(r.entry.index, 1, 'entry must not use the candle open that predates candidate availability');
  assert.equal(r.entry.price, 102);
  assert.equal(r.entry.available_at_ms, 120500);
  assert.equal(r.entry.delay_bars, 1);
  assert.equal(r.horizons[1].forward_return_pct, (103-102)/102*100);
}
{
  const cs = candles([[100,101,99,100],[100,101,98,99],[99,100,95,96],[96,98,94,97]]);
  const r = evaluateCandidate({ candidate: candidate({ available_at_ms: 60500 }), candles: cs, horizons: [1] });
  assert.equal(r.entry.index, 1);
  assert.equal(r.horizons[1].mfe_pct >= 0, true);
  assert.equal(r.horizons[1].mae_pct >= 0, true);
}
{
  const cs = candles([[100,101,99,100],[100,102,98,101],[101,103,99,102]]);
  const r = evaluateCandidate({ candidate: candidate({ available_at_ms: 60500, invalidation_level: 95 }), candles: cs, horizons: [1], barrierMaxBars: 1 });
  assert.equal(r.barriers['1R'].status, 'TIMEOUT');
}
{
  const cs = candles([[100,101,99,100],[100,110,90,100],[100,101,99,100]]);
  const r = evaluateCandidate({ candidate: candidate({ available_at_ms: 60500, invalidation_level: 95 }), candles: cs, horizons: [1], barrierMaxBars: 1 });
  assert.equal(r.barriers['1R'].status, 'STOP_FIRST_AMBIGUOUS');
}
{
  const cs = candles([[100,101,99,100],[100,101,94,96],[96,97,95,96]]);
  const r = evaluateCandidate({ candidate: candidate({ available_at_ms: 60500, invalidation_level: 95 }), candles: cs, horizons: [1], barrierMaxBars: 1 });
  assert.equal(r.barriers['1R'].status, 'STOP');
}
{
  const cs = candles([[100,101,99,100],[90,92,89,91],[91,92,90,91]]);
  const r = evaluateCandidate({ candidate: candidate({ available_at_ms: 60500, invalidation_level: 95 }), candles: cs, horizons: [1], barrierMaxBars: 1 });
  assert.equal(r.barriers['1R'].status, 'STOP_GAP');
}
{
  const cs = candles([[100,101,99,100],[100,102,99,101],[101,103,100,102]]);
  const r = evaluateCandidate({ candidate: candidate({ available_at_ms: 60500, invalidation_level: null }), candles: cs, horizons: [1] });
  assert.equal(r.invalidation.status, 'UNAVAILABLE');
  assert.equal(r.horizons[1].status, 'AVAILABLE');
}
{
  const cs = candles([[100,101,99,100],[100,102,99,101]]);
  const r = evaluateCandidate({ candidate: candidate({ available_at_ms: 60500 }), candles: cs, horizons: [1,2] });
  assert.equal(r.horizons[2].status, 'UNAVAILABLE');
}
{
  const cs = candles([[100,101,99,100],[100,102,99,101],[101,103,100,102]]);
  const r = evaluateCandidate({ candidate: candidate({ available_at_ms: 60500, direction: 'SHORT', invalidation_level: 105 }), candles: cs, horizons: [1] });
  assert.equal(r.direction, 'SHORT');
  assert.equal(r.horizons[1].mfe_pct >= 0, true);
  assert.equal(r.horizons[1].mae_pct >= 0, true);
}
assert.deepEqual(wilsonInterval(0, 0), null);
assert.equal(wilsonInterval(8, 10).lower < 0.8, true);
assert.equal(wilsonInterval(8, 10).upper > 0.8, true);
const summary = summarizeOutcomes([
  { status: 'EVALUATED', horizons: { 1: { status: 'AVAILABLE', forward_return_pct: 1, mfe_pct: 2, mae_pct: 0.5 } } },
  { status: 'EVALUATED', horizons: { 1: { status: 'AVAILABLE', forward_return_pct: -1, mfe_pct: 1, mae_pct: 2 } } }
], 1);
assert.equal(summary.n, 2);
assert.equal(summary.positive_close_count, 1);
assert.equal(summary.positive_close_rate, 0.5);
{
  const cs = candles([[100,101,99,100],[100,102,99,101],[101,110,100,109],[109,111,108,110]]);
  const r = evaluateCandidate({
    candidate: candidate({ available_at_ms: 60500, invalidation_level: 95 }),
    candles: cs, horizons: [1], barrierMaxBars: 1,
    costModel: { entry_fee_bps: 5, exit_fee_bps: 5, entry_slippage_bps: 5, exit_slippage_bps: 5, funding_status: 'UNKNOWN' }
  });
  assert.equal(r.barriers['1R'].status, 'TARGET');
  assert.equal(r.barriers['1R'].cost_bps, 20);
  assert.equal(r.barriers['1R'].funding_status, 'UNKNOWN_NOT_MODELED');
  assert.ok(r.barriers['1R'].net_r < r.barriers['1R'].gross_r);
}
{
  const cs = candles([[100,101,99,100],[100,101,99,100]]);
  const r = evaluateCandidate({ candidate: candidate({ available_at_ms: 999999 }), candles: cs, horizons: [1] });
  assert.equal(r.status, 'EXCLUDED');
  assert.equal(r.reason, 'NO_CAUSAL_ENTRY_CANDLE');
}
{
  const cs = candles([[100,101,99,100],[100,102,99,101],[101,103,100,102]]);
  assert.throws(() => evaluateCandidate({
    candidate: candidate(), candles: cs, horizons: [1],
    costModel: { entry_fee_bps: -1 }
  }), /B8_COST_MODEL_INVALID/);
  assert.throws(() => evaluateCandidate({
    candidate: candidate(), candles: cs, horizons: [1], analysisAsOfMs: 60000
  }), /B8_CANDIDATE_AFTER_ANALYSIS_CUTOFF/);
}
console.log('B8 evaluator/statistics: deterministic assertions PASS');
