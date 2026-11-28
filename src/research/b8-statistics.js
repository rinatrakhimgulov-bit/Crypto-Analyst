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

module.exports = { wilsonInterval, summarize, summarizeOutcomes };
