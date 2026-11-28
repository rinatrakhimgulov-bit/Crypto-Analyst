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
assert.equal(report.zone_outcome_policy.horizon_bars, 20);
assert.equal(report.summary.zone_context_sensitivity.length, 11);

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
for (const variant of report.summary.zone_context_sensitivity) {
  assert.equal(variant.window_count, report.summary.window_count);
  assert.ok(variant.active_zone_total >= 0);
  assert.ok((variant.support_outcomes.NO_ZONE || 0) + (variant.support_outcomes.CENSORED || 0) +
    (variant.support_outcomes.NOT_TOUCHED || 0) + (variant.support_outcomes.HELD || 0) +
    (variant.support_outcomes.BROKEN || 0) + (variant.support_outcomes.TESTED_UNRESOLVED || 0) === report.summary.window_count);
  assert.ok((variant.resistance_outcomes.NO_ZONE || 0) + (variant.resistance_outcomes.CENSORED || 0) +
    (variant.resistance_outcomes.NOT_TOUCHED || 0) + (variant.resistance_outcomes.HELD || 0) +
    (variant.resistance_outcomes.BROKEN || 0) + (variant.resistance_outcomes.TESTED_UNRESOLVED || 0) === report.summary.window_count);
}
const baseVariant = report.summary.zone_context_sensitivity.find(x => x.variant === 'base_r10_a20_d5');
assert.ok(baseVariant);
assert.ok(baseVariant.support_available_rate >= 0 && baseVariant.support_available_rate <= 1);
assert.ok(baseVariant.resistance_available_rate >= 0 && baseVariant.resistance_available_rate <= 1);

const regimeTotal = Object.values(report.summary.regime_v2_distribution).reduce((a, b) => a + b, 0);
assert.equal(regimeTotal, report.summary.window_count);
process.stdout.write('PASS Binance recent replay covers all six futures series through 2026\n');
process.stdout.write('PASS all sampled windows have valid v1/v2 regime and causal evidence\n');
process.stdout.write('PASS 11 zone freshness/distance policies are compared with forward hold/break outcomes\n');
