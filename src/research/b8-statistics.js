'use strict';

function wilsonInterval(successes, total, z = 1.959963984540054) {
  if (!Number.isSafeInteger(successes) || !Number.isSafeInteger(total) ||
      successes < 0 || total < 0 || successes > total) throw new Error('B8_BINOMIAL_COUNTS_INVALID');
  if (total === 0) return null;
  const p = successes / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) / total) + (z2 / (4 * total * total))) / denominator;
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin), method: 'WILSON_95_NAIVE_INDEPENDENCE' };
}

function summarize(values) {
  const finiteValues = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!finiteValues.length) return { n: 0, mean: null, median: null, min: null, max: null };
  const sum = finiteValues.reduce((a, b) => a + b, 0);
  const mid = Math.floor(finiteValues.length / 2);
  const median = finiteValues.length % 2
    ? finiteValues[mid] : (finiteValues[mid - 1] + finiteValues[mid]) / 2;
  return {
    n: finiteValues.length, mean: sum / finiteValues.length, median,
    min: finiteValues[0], max: finiteValues[finiteValues.length - 1]
  };
}

function summarizeOutcomes(results, horizon) {
  const available = results.filter(r => r && r.status === 'EVALUATED' &&
    r.horizons && r.horizons[horizon] && r.horizons[horizon].status === 'AVAILABLE');
  const returns = available.map(r => r.horizons[horizon].forward_return_pct);
  const favorable = returns.filter(value => value > 0).length;
  return {
    n: available.length,
    positive_close_count: favorable,
    positive_close_rate: available.length ? favorable / available.length : null,
    positive_close_rate_wilson_95: wilsonInterval(favorable, available.length),
    forward_return_pct: summarize(returns),
    mfe_pct: summarize(available.map(r => r.horizons[horizon].mfe_pct)),
    mae_pct: summarize(available.map(r => r.horizons[horizon].mae_pct)),
    interval_warning: 'Wilson interval assumes independent observations; overlapping/correlated candidates require cluster-aware inference.'
  };
}


const DEFAULT_BLOCK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_INDEPENDENT_BLOCKS = 8;

function seededRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
function percentile(sorted, p) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index), hi = Math.ceil(index);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}
function blockBootstrapMeanInterval(rows, valueSelector, options = {}) {
  const blockMs = options.blockMs == null ? DEFAULT_BLOCK_MS : options.blockMs;
  const repetitions = options.repetitions == null ? 1000 : options.repetitions;
  const minimumBlocks = options.minimumBlocks == null ? MIN_INDEPENDENT_BLOCKS : options.minimumBlocks;
  const seed = options.seed == null ? 20261128 : options.seed;
  if (!Array.isArray(rows) || !Number.isSafeInteger(blockMs) || blockMs <= 0 ||
      !Number.isSafeInteger(repetitions) || repetitions < 100 ||
      !Number.isSafeInteger(minimumBlocks) || minimumBlocks < 2 ||
      !Number.isSafeInteger(seed)) throw new Error('B8_BLOCK_BOOTSTRAP_OPTIONS_INVALID');
  const blocks = new Map();
  for (const row of rows) {
    if (!row || !Number.isSafeInteger(row.available_at_ms)) continue;
    const value = valueSelector(row);
    if (!Number.isFinite(value)) continue;
    const key = Math.floor(row.available_at_ms / blockMs);
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key).push(value);
  }
  const values = Array.from(blocks.values());
  const n = values.reduce((sum, block) => sum + block.length, 0);
  if (values.length < minimumBlocks) {
    return { status: 'INSUFFICIENT_INDEPENDENT_BLOCKS', n, independent_blocks: values.length,
      block_ms: blockMs, interval_95: null, method: 'WEEKLY_CLUSTER_BOOTSTRAP' };
  }
  const random = seededRandom(seed);
  const means = [];
  for (let rep = 0; rep < repetitions; rep++) {
    let sum = 0, count = 0;
    for (let draw = 0; draw < values.length; draw++) {
      const block = values[Math.floor(random() * values.length)];
      for (const value of block) { sum += value; count++; }
    }
    if (count) means.push(sum / count);
  }
  means.sort((a, b) => a - b);
  return { status: 'AVAILABLE', n, independent_blocks: values.length, block_ms: blockMs,
    interval_95: { lower: percentile(means, 0.025), upper: percentile(means, 0.975) },
    method: 'WEEKLY_CLUSTER_BOOTSTRAP', repetitions, seed };
}
function summarizeClusteredOutcomes(rows, horizon, options = {}) {
  const availableRows = rows.filter(row => row && row.outcome && row.outcome.status === 'EVALUATED' &&
    row.outcome.horizons && row.outcome.horizons[horizon] &&
    row.outcome.horizons[horizon].status === 'AVAILABLE');
  const meanReturn = blockBootstrapMeanInterval(availableRows,
    row => row.outcome.horizons[horizon].forward_return_pct, options);
  const positiveRate = blockBootstrapMeanInterval(availableRows,
    row => row.outcome.horizons[horizon].forward_return_pct > 0 ? 1 : 0, options);
  return { independent_week_blocks: meanReturn.independent_blocks,
    block_bootstrap_mean_return_95: meanReturn,
    block_bootstrap_positive_rate_95: positiveRate,
    dependence_note: 'Within-series weekly date-block bootstrap. Cross-symbol and cross-timeframe dependence is not captured when groups are reported separately.' };
}

module.exports = { wilsonInterval, summarize, summarizeOutcomes, blockBootstrapMeanInterval, summarizeClusteredOutcomes };
