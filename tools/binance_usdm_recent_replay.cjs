'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');
const {
  runStructure, runZones, runAnalyticalContext, summarizeAnalyticalContext,
  TIMEFRAMES: UNUSED_TIMEFRAMES
} = (() => {
  const replay = require('./b2_historical_replay.cjs');
  return { ...replay, TIMEFRAMES: null };
})();

const DATA_PATH = 'binance_usdm_recent_history.json';
const REPORT_PATH = 'binance_usdm_recent_replay_report.json';
const STRIDE = { '1h': 336, '4h': 84, '1d': 14 };
const PROVIDER_ID = 'binance-usdm-public-archive';
const VENUE = 'binance';
const FINALITY_LAG_MS = 500;

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item && item[key] ? item[key] : 'UNKNOWN';
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}
function runSeries(symbol, timeframe, rows) {
  const windows = [];
  const stride = STRIDE[timeframe];
  for (let endIndex = 259; endIndex < rows.length; endIndex += stride) {
    const slice = rows.slice(endIndex - 259, endIndex + 1);
    const last = slice[slice.length - 1];
    const asOf = last.close_time_ms + FINALITY_LAG_MS;
    const id = 'binance-recent:' + symbol + ':' + timeframe + ':' + last.open_time_ms;
    const structure = runStructure(slice, symbol, timeframe, asOf, id, 2, PROVIDER_ID, VENUE);
    assert.equal(structure.snapshot.provider_metadata.provider_id, PROVIDER_ID);
    const zones = runZones(structure, symbol, timeframe);
    const analytical = runAnalyticalContext(structure, zones);
    const summary = summarizeAnalyticalContext(analytical);

    assert(analytical.zoneContext.zones.every(zone => zone.available_at_ms <= asOf),
      'zone evidence exceeds cutoff ' + id);
    assert(analytical.breakoutQuality.breakouts.every(item =>
      item.breakout_candle_close_time_ms <= asOf - FINALITY_LAG_MS),
      'breakout evidence exceeds cutoff ' + id);
    assert(analytical.impulse.event.window_end_close_time_ms <= asOf - FINALITY_LAG_MS,
      'impulse window exceeds cutoff ' + id);
    assert.equal(analytical.regimeV2.status, 'VALID');

    windows.push({
      cutoff: new Date(asOf).toISOString(),
      bars: slice.length,
      regime_v1: {
        label: summary.regime.label,
        structure_state: summary.regime.structure_state
      },
      regime_v2: {
        label: summary.regime_v2.label,
        scope: summary.regime_v2.scope,
        directional_bias: summary.regime_v2.directional_bias,
        evidence_alignment: summary.regime_v2.evidence_alignment,
        structure_state: summary.regime_v2.structure_state,
        features: summary.regime_v2.features
      },
      zones: summary.zones,
      breakout_quality: summary.breakout_quality,
      impulse: summary.impulse
    });
  }
  assert(windows.length >= 5, 'insufficient 260-bar windows for ' + symbol + ':' + timeframe);
  return {
    provider_id: PROVIDER_ID,
    row_count: rows.length,
    start: new Date(rows[0].open_time_ms).toISOString(),
    end: new Date(rows[rows.length - 1].close_time_ms).toISOString(),
    windows,
    distributions: {
      regime_v1: countBy(windows.map(x => ({ label: x.regime_v1.label })), 'label'),
      regime_v2: countBy(windows.map(x => ({ label: x.regime_v2.label })), 'label'),
      regime_scope_v2: countBy(windows.map(x => ({ scope: x.regime_v2.scope })), 'scope'),
      impulse: countBy(windows.map(x => ({ classification: x.impulse.classification })), 'classification')
    }
  };
}
function main() {
  assert(fs.existsSync(DATA_PATH), 'Missing Binance recent history dataset');
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  assert.equal(data.provider, 'Binance USD-M Futures public archive');
  const series = {};
  const allWindows = [];
  for (const symbol of ['BTCUSDT', 'ETHUSDT']) {
    series[symbol] = {};
    for (const timeframe of ['1h', '4h', '1d']) {
      const rows = data.series && data.series[symbol] && data.series[symbol][timeframe];
      assert(Array.isArray(rows) && rows.length >= 250,
        'Missing/short Binance series ' + symbol + ':' + timeframe);
      const result = runSeries(symbol, timeframe, rows);
      series[symbol][timeframe] = result;
      for (const window of result.windows) allWindows.push({ symbol, timeframe, ...window });
    }
  }
  const report = {
    report_version: 'binance-usdm-recent-replay-v1',
    provider: data.provider,
    market_type: data.market_type,
    generated_at: new Date().toISOString(),
    coverage_start: data.coverage_start,
    coverage_end: data.coverage_end,
    finality_safety_lag_ms: data.finality_safety_lag_ms,
    series,
    summary: {
      window_count: allWindows.length,
      regime_v1_distribution: countBy(allWindows.map(x => ({ label: x.regime_v1.label })), 'label'),
      regime_v2_distribution: countBy(allWindows.map(x => ({ label: x.regime_v2.label })), 'label'),
      regime_scope_v2_distribution: countBy(allWindows.map(x => ({ scope: x.regime_v2.scope })), 'scope'),
      impulse_distribution: countBy(allWindows.map(x => ({ classification: x.impulse.classification })), 'classification')
    },
    limitations: [
      'This is an independent Binance USD-M futures sample. It is not concatenated with the Bybit archive.',
      'Windows contain 260 closed candles and are sampled approximately every 14 calendar days.',
      'B1 quality is a synthetic VALID research wrapper after source archive checksums and OHLCV integrity validation.',
      'This report measures classification behavior and causal cutoffs, not predictive accuracy, trade PnL or profitability.',
      'The report does not evaluate every candle; short-lived events between sampled cutoffs can be missed.'
    ]
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report) + '\n');
  process.stdout.write('Binance recent replay: ' + allWindows.length + ' windows across six series\n');
  process.stdout.write('v2 regimes: ' + JSON.stringify(report.summary.regime_v2_distribution) + '\n');
  process.stdout.write('v2 scopes: ' + JSON.stringify(report.summary.regime_scope_v2_distribution) + '\n');
  process.stdout.write('Wrote ' + REPORT_PATH + ' through ' + report.coverage_end + '\n');
}
if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write((error && error.stack) || String(error));
    process.exitCode = 1;
  }
}
module.exports = { runSeries, STRIDE, PROVIDER_ID, REPORT_PATH };
