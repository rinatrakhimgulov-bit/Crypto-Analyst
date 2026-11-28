'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const report = JSON.parse(fs.readFileSync('analytical_context_historical_replay_report.json', 'utf8'));

assert.equal(report.report_version, 'analytical-context-historical-replay-v3');
assert.equal(report.dataset.commit, '9ca04178df06ce649f00779a49e11094fe5b1c70');
assert.ok(report.dataset.extension_rows_total > 0);
assert.ok(Date.parse(report.dataset.coverage_end) >= Date.parse('2026-11-27T00:00:00.000Z'));
assert.equal(report.dataset.extension_provider, 'Bybit V5 public market kline');
assert.equal(report.summary.series_count, 6);
assert.ok(report.summary.total_sampled_windows >= 500);

for (const symbol of ['BTCUSDT', 'ETHUSDT']) {
  for (const timeframe of ['1h', '4h', '1d']) {
    const series = report.series[symbol][timeframe];
    assert.ok(series, 'missing series ' + symbol + ' ' + timeframe);
    assert.ok(series.dataset_integrity.rows > 1000);
    assert.ok(series.dataset_integrity.extension_rows > 0);
    assert.ok(series.dataset_integrity.archive_rows > 1000);
    assert.equal(series.dataset_integrity.invalid, 0);
    assert.equal(series.dataset_integrity.duplicates, 0);
    assert.equal(series.dataset_integrity.gaps, 0);
    assert.equal(series.dataset_integrity.offGrid, 0);
    assert.ok(series.method.sampled_windows >= 20);
    assert.equal(series.windows.length, series.method.sampled_windows);

    for (const item of series.windows) {
      assert.ok(item.cutoff_ms > 0);
      assert.ok(['UPTREND', 'DOWNTREND', 'RANGE', 'IMPULSE', 'TRANSITION', 'UNKNOWN'].includes(item.regime));
      assert.ok(['MARKET_TREND', 'MARKET_RANGE', 'LOCAL_CONSOLIDATION', 'MARKET_IMPULSE', 'MARKET_TRANSITION'].includes(item.regime_scope));
      assert.ok(['UPTREND', 'DOWNTREND', 'RANGE', 'IMPULSE', 'TRANSITION', 'UNKNOWN'].includes(item.regime_v1));
      assert.ok(typeof item.support_available === 'boolean');
      assert.ok(typeof item.resistance_available === 'boolean');
      assert.ok(typeof item.impulse_classification === 'string' && item.impulse_classification.length > 0);
    }
  }
}

assert.ok(Object.keys(report.summary.regime_distribution).length >= 1);
assert.ok(Object.keys(report.summary.regime_v1_distribution).length >= 1);
assert.ok(Object.keys(report.summary.regime_scope_distribution).length >= 1);
assert.ok((report.summary.regime_distribution.RANGE || 0) > 0,
  'v2 must identify at least some local or market range windows in the pinned sample');
assert.ok((report.summary.regime_scope_distribution.LOCAL_CONSOLIDATION || 0) > 0,
  'v2 must distinguish local consolidation from a market-wide range');
assert.ok(Object.keys(report.summary.impulse_distribution).length >= 1);
assert.ok(Number.isInteger(report.summary.range_thresholds_pass_windows));
assert.ok(Number.isInteger(report.summary.range_structure_eligible_windows));
assert.ok(Array.isArray(report.summary.range_threshold_sensitivity));
assert.ok(report.summary.range_threshold_sensitivity.length >= 4);
assert.ok(Array.isArray(report.limitations) && report.limitations.length >= 5);
process.stdout.write('PASS six historical series and dataset integrity\n');
process.stdout.write('PASS at least 500 causal analytical snapshots\n');
process.stdout.write('PASS v1/v2 regime comparison, local consolidation, support/resistance, breakout and impulse outputs are present\n');
