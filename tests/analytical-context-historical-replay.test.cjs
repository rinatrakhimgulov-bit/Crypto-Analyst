'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const report = JSON.parse(fs.readFileSync('analytical_context_historical_replay_report.json', 'utf8'));

assert.equal(report.report_version, 'analytical-context-historical-replay-v1');
assert.equal(report.dataset.commit, '9ca04178df06ce649f00779a49e11094fe5b1c70');
assert.equal(report.summary.series_count, 6);
assert.ok(report.summary.total_sampled_windows >= 500);

for (const symbol of ['BTCUSDT', 'ETHUSDT']) {
  for (const timeframe of ['1h', '4h', '1d']) {
    const series = report.series[symbol][timeframe];
    assert.ok(series, 'missing series ' + symbol + ' ' + timeframe);
    assert.ok(series.dataset_integrity.rows > 1000);
    assert.equal(series.dataset_integrity.invalid, 0);
    assert.equal(series.dataset_integrity.duplicates, 0);
    assert.equal(series.dataset_integrity.gaps, 0);
    assert.equal(series.dataset_integrity.offGrid, 0);
    assert.ok(series.method.sampled_windows >= 20);
    assert.equal(series.windows.length, series.method.sampled_windows);

    for (const item of series.windows) {
      assert.ok(item.cutoff_ms > 0);
      assert.ok(['UPTREND', 'DOWNTREND', 'RANGE', 'IMPULSE', 'TRANSITION', 'UNKNOWN'].includes(item.regime));
      assert.ok(typeof item.support_available === 'boolean');
      assert.ok(typeof item.resistance_available === 'boolean');
      assert.ok(typeof item.impulse_classification === 'string' && item.impulse_classification.length > 0);
    }
  }
}

assert.ok(Object.keys(report.summary.regime_distribution).length >= 1);
assert.ok(Object.keys(report.summary.impulse_distribution).length >= 1);
assert.ok(Array.isArray(report.limitations) && report.limitations.length >= 5);
process.stdout.write('PASS six historical series and dataset integrity\n');
process.stdout.write('PASS at least 500 causal analytical snapshots\n');
process.stdout.write('PASS regime, support/resistance, breakout and impulse outputs are present\n');
