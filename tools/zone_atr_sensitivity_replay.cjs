'use strict';

const fs = require('node:fs');
const {
  loadRows, runStructure, runZones, runAnalyticalContext,
  FILES, STEP, LAG
} = require('./b2_historical_replay.cjs');

const WINDOW_BARS = 260;
const STRIDE_BARS = { '1h': 336, '4h': 84, '1d': 14 };
const ATR_PERIOD = 14;
const ZONE_WIDTH_ATR = [0.10, 0.15, 0.20, 0.25];
const RETEST_BUFFER_ATR = [0.05, 0.10, 0.15];
const REPORT_PATH = 'zone_atr_sensitivity_report.json';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function calculateWilderAtr(candles, period = ATR_PERIOD) {
  if (!Array.isArray(candles) || candles.length < period + 1) return null;
  const ranges = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], previousClose = candles[i - 1].close;
    ranges.push(Math.max(c.high - c.low, Math.abs(c.high - previousClose),
      Math.abs(c.low - previousClose)));
  }
  let atr = ranges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let i = period; i < ranges.length; i++) {
    atr = (atr * (period - 1) + ranges[i]) / period;
  }
  return Number.isFinite(atr) && atr > 0 ? atr : null;
}
function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}
function sampleIndices(length, timeframe) {
  const stride = STRIDE_BARS[timeframe];
  const indices = [];
  for (let i = WINDOW_BARS - 1; i < length; i += stride) indices.push(i);
  if (indices.length && indices[indices.length - 1] !== length - 1) indices.push(length - 1);
  return indices;
}
function newAccumulator(config) {
  return {
    config, windows: 0, support_available_windows: 0, resistance_available_windows: 0,
    active_zone_total: 0, stale_zone_total: 0, confirmed_zone_total: 0,
    candidate_cluster_total: 0, breakout_total: 0, unmatched_breakout_total: 0,
    retest_status_counts: {}, breakout_quality_counts: {}, impulse_counts: {},
    effective_zone_span_atr_values: [], effective_retest_buffer_atr_values: []
  };
}
function increment(target, key, amount = 1) {
  target[key] = (target[key] || 0) + amount;
}
function addContext(acc, structure, zones) {
  const context = runAnalyticalContext(structure, zones, WINDOW_BARS);
  assert(context.zoneContext.status === 'VALID', 'ZONE_CONTEXT_BLOCKED');
  assert(context.breakoutQuality.status === 'VALID', 'BREAKOUT_QUALITY_BLOCKED');
  assert(context.impulse.status === 'VALID', 'IMPULSE_BLOCKED');
  const selection = context.zoneContext.active_zone_selection;
  acc.windows++;
  if (selection.nearest_support) acc.support_available_windows++;
  if (selection.nearest_resistance) acc.resistance_available_windows++;
  acc.active_zone_total += context.zoneContext.diagnostics.active_zone_count;
  acc.stale_zone_total += context.zoneContext.diagnostics.stale_zone_count;
  acc.confirmed_zone_total += zones.d.zones.length;
  acc.candidate_cluster_total += zones.d.candidate_levels.length;
  acc.breakout_total += zones.e.lifecycles.length;
  acc.unmatched_breakout_total += zones.e.unmatched_breakouts.length;
  for (const lifecycle of zones.e.lifecycles) increment(acc.retest_status_counts, lifecycle.status);
  for (const item of context.breakoutQuality.breakouts) increment(acc.breakout_quality_counts, item.quality_status);
  increment(acc.impulse_counts, context.impulse.event.classification);
}
function finalize(acc) {
  const { effective_zone_span_atr_values, effective_retest_buffer_atr_values, ...base } = acc;
  return {
    ...base,
    baseline_effective_atr_distribution: acc.config.mode === 'PRICE_RATIO' ? {
      zone_span_atr: { p10: percentile(effective_zone_span_atr_values, 0.10), p50: percentile(effective_zone_span_atr_values, 0.50), p90: percentile(effective_zone_span_atr_values, 0.90) },
      retest_buffer_atr: { p10: percentile(effective_retest_buffer_atr_values, 0.10), p50: percentile(effective_retest_buffer_atr_values, 0.50), p90: percentile(effective_retest_buffer_atr_values, 0.90) }
    } : null,
    support_availability_rate: acc.windows ? acc.support_available_windows / acc.windows : 0,
    resistance_availability_rate: acc.windows ? acc.resistance_available_windows / acc.windows : 0,
    mean_active_zones_per_window: acc.windows ? acc.active_zone_total / acc.windows : 0,
    mean_stale_zones_per_window: acc.windows ? acc.stale_zone_total / acc.windows : 0,
    mean_confirmed_zones_per_window: acc.windows ? acc.confirmed_zone_total / acc.windows : 0,
    mean_candidate_clusters_per_window: acc.windows ? acc.candidate_cluster_total / acc.windows : 0
  };
}

async function main() {
  const results = {};
  let totalWindows = 0;
  for (const [symbol, frames] of Object.entries(FILES)) {
    results[symbol] = {};
    for (const [timeframe, file] of Object.entries(frames)) {
      const loaded = await loadRows(file, timeframe);
      const rows = loaded.rows;
      const indices = sampleIndices(rows.length, timeframe);
      const configs = [
        { name: 'CURRENT_PRICE_RATIO_BASELINE', mode: 'PRICE_RATIO', zone_span_price_ratio: 0.001, retest_buffer_price_ratio: 0.0005 }
      ];
      for (const zoneAtr of ZONE_WIDTH_ATR) {
        for (const retestAtr of RETEST_BUFFER_ATR) {
          configs.push({
            name: 'ATR_ZONE_' + zoneAtr.toFixed(2) + '_RETEST_' + retestAtr.toFixed(2),
            mode: 'ATR_NORMALIZED', zone_span_atr: zoneAtr, retest_buffer_atr: retestAtr
          });
        }
      }
      const accumulators = new Map(configs.map(c => [c.name, newAccumulator(c)]));
      const diagnostics = { sampled_windows: indices.length, invalid_atr_windows: 0, causal_cutoff_checks: 0 };
      for (let n = 0; n < indices.length; n++) {
        const endIndex = indices[n];
        const slice = rows.slice(endIndex - WINDOW_BARS + 1, endIndex + 1);
        const end = slice[slice.length - 1];
        const asOf = end.close_time_ms + LAG;
        const structure = runStructure(slice, symbol, timeframe, asOf,
          ['zone-atr-replay', symbol, timeframe, end.open_time_ms].join(':'));
        const atr = calculateWilderAtr(structure.snapshot.candles_by_timeframe[timeframe]);
        const priceScale = median(slice.map(c => c.close));
        if (!(atr > 0) || !(priceScale > 0)) {
          diagnostics.invalid_atr_windows++;
          continue;
        }
        for (const config of configs) {
          const spanRatio = config.mode === 'ATR_NORMALIZED'
            ? atr * config.zone_span_atr / priceScale : config.zone_span_price_ratio;
          const retestRatio = config.mode === 'ATR_NORMALIZED'
            ? atr * config.retest_buffer_atr / priceScale : config.retest_buffer_price_ratio;
          const zones = runZones(structure, symbol, timeframe, spanRatio, retestRatio);
          const acc = accumulators.get(config.name);
          acc.effective_zone_span_atr_values.push(priceScale * spanRatio / atr);
          acc.effective_retest_buffer_atr_values.push(priceScale * retestRatio / atr);
          addContext(acc, structure, zones);
          if (zones.d.zones.some(z => z.available_at_ms > asOf) ||
              zones.e.lifecycles.some(l => l.breakout_available_at_ms > asOf)) {
            throw new Error('CAUSAL_CUTOFF_VIOLATION:' + symbol + ':' + timeframe + ':' + end.open_time_ms);
          }
          diagnostics.causal_cutoff_checks++;
          if (n === 0) {
            acc.example_conversion = {
              atr, median_close: priceScale,
              max_cluster_span_price: priceScale * spanRatio,
              retest_buffer_price: priceScale * retestRatio,
              span_atr_effective: priceScale * spanRatio / atr,
              retest_atr_effective: priceScale * retestRatio / atr
            };
          }
        }
      }
      results[symbol][timeframe] = {
        dataset_integrity: loaded.integrity,
        method: { lookback_bars: WINDOW_BARS, stride_bars: STRIDE_BARS[timeframe],
          approximate_stride_days: 14, atr_period: ATR_PERIOD },
        diagnostics,
        candidates: Object.fromEntries([...accumulators.entries()].map(([name, acc]) => [name, finalize(acc)]))
      };
      totalWindows += diagnostics.sampled_windows;
    }
  }
  const report = {
    report_version: 'zone-atr-sensitivity-replay-v2',
    generated_at: new Date().toISOString(),
    dataset: {
      repository: 'mestoness/btc-eth-candles-history',
      commit: '9ca04178df06ce649f00779a49e11094fe5b1c70',
      coverage_end: '2025-12-05'
    },
    scope: 'Research-only comparison of price-percent and current-ATR-normalized zone clustering/retest tolerances. Not a predictive or profitability backtest.',
    limitations: [
      'The archive ends 2025-12-05 and excludes 2026 data.',
      'Sampling is approximately every 14 days; short-lived zones and retests can be missed.',
      'ATR is measured at each snapshot cutoff and applied to that snapshot zone clustering and retest policy. This is not per-pivot or per-breakout historical ATR normalization.',
      'No trade entries, exits, fees, funding, slippage, PnL, expectancy, win rate or drawdown are evaluated.',
      'Candidate multipliers are engineering sensitivity values, not optimized parameters.'
    ],
    total_sampled_windows: totalWindows,
    zone_width_atr_candidates: ZONE_WIDTH_ATR,
    retest_buffer_atr_candidates: RETEST_BUFFER_ATR,
    baseline_price_ratio: { zone_span: 0.001, retest_buffer: 0.0005 },
    results
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    report_version: report.report_version,
    total_sampled_windows: totalWindows,
    report_path: REPORT_PATH,
    series: Object.fromEntries(Object.entries(results).map(([symbol, frames]) => [symbol,
      Object.fromEntries(Object.entries(frames).map(([tf, data]) => [tf, {
        windows: data.diagnostics.sampled_windows,
        candidates: Object.fromEntries(Object.entries(data.candidates).map(([name, value]) => [name, {
          support_rate: value.support_availability_rate,
          resistance_rate: value.resistance_availability_rate,
          mean_active_zones: value.mean_active_zones_per_window,
          breakouts: value.breakout_total,
          retests: value.retest_status_counts
        }]))
      }]))
    ]))
  }, null, 2));
}
if (require.main === module) main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
module.exports = { calculateWilderAtr, sampleIndices, ZONE_WIDTH_ATR, RETEST_BUFFER_ATR };
