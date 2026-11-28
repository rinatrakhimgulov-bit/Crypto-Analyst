'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const path = 'binance_usdm_recent_replay_report.json';
assert.ok(fs.existsSync(path), 'Binance replay report is missing');
const report = JSON.parse(fs.readFileSync(path, 'utf8'));
assert.equal(report.report_version, 'binance-usdm-recent-replay-v1');
assert.equal(report.provider, 'Binance USD-M Futures public archive');
assert.equal(report.market_type, 'linear_perpetual');
assert.ok(Date.parse(report.coverage_end) >= Date.parse('2026-11-26T00:00:00.000Z'));
assert.ok(report.summary.window_count >= 30);

const allowedRegimes = ['UPTREND', 'DOWNTREND', 'RANGE', 'IMPULSE', 'TRANSITION', 'UNKNOWN'];
const allowedScopes = ['MARKET_TREND', 'MARKET_RANGE', 'LOCAL_CONSOLIDATION',
  'MARKET_IMPULSE', 'MARKET_TRANSITION'];
for (const symbol of ['BTCUSDT', 'ETHUSDT']) {
  for (const timeframe of ['1h', '4h', '1d']) {
    const series = report.series[symbol][timeframe];
    assert.equal(series.provider_id, 'binance-usdm-public-archive');
    assert.ok(series.row_count >= 250);
    assert.ok(series.windows.length >= 5);
    for (const window of series.windows) {
      assert.equal(window.bars, 260);
      assert.ok(Date.parse(window.cutoff) <= Date.parse(report.coverage_end));
      assert.ok(allowedRegimes.includes(window.regime_v1.label));
      assert.ok(allowedRegimes.includes(window.regime_v2.label));
      assert.ok(allowedScopes.includes(window.regime_v2.scope));
      assert.ok(window.regime_v2.features);
      assert.ok(window.impulse.classification);
    }
  }
}
const regimeTotal = Object.values(report.summary.regime_v2_distribution).reduce((a, b) => a + b, 0);
assert.equal(regimeTotal, report.summary.window_count);
process.stdout.write('PASS Binance recent replay covers all six futures series through 2026\n');
process.stdout.write('PASS all sampled windows have valid v1/v2 regime and causal evidence\n');
