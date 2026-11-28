'use strict';

const assert = require('node:assert/strict');
const { blockBootstrapMeanInterval, summarizeClusteredOutcomes } = require('../src/research/b8-statistics.js');

const rows = [];
for (let week = 0; week < 10; week++) {
  rows.push({ available_at_ms: week * 7 * 86400000 + 1000, value: week - 4 });
  rows.push({ available_at_ms: week * 7 * 86400000 + 2000, value: week - 3 });
}
const a = blockBootstrapMeanInterval(rows, row => row.value, { repetitions: 500, seed: 123 });
const b = blockBootstrapMeanInterval(rows, row => row.value, { repetitions: 500, seed: 123 });
assert.deepEqual(a, b, 'bootstrap must be deterministic');
assert.equal(a.status, 'AVAILABLE');
assert.equal(a.independent_blocks, 10);
assert.ok(a.interval_95.lower <= a.interval_95.upper);

const sparse = blockBootstrapMeanInterval(rows.slice(0, 4), row => row.value, { repetitions: 500 });
assert.equal(sparse.status, 'INSUFFICIENT_INDEPENDENT_BLOCKS');
assert.equal(sparse.interval_95, null);

const outcomes = rows.map(row => ({
  available_at_ms: row.available_at_ms,
  outcome: { status: 'EVALUATED', horizons: { 1: { status: 'AVAILABLE', forward_return_pct: row.value, mfe_pct: 1, mae_pct: 1 } } }
}));
const summary = summarizeClusteredOutcomes(outcomes, 1, { repetitions: 500, seed: 456 });
assert.equal(summary.independent_week_blocks, 10);
assert.equal(summary.block_bootstrap_mean_return_95.status, 'AVAILABLE');
console.log('B8 block bootstrap: deterministic assertions PASS');
