'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const report = JSON.parse(fs.readFileSync('b2e_breakout_event_outcome_report.json', 'utf8'));

assert.equal(report.report_version, 'b2e-breakout-event-outcomes-v1');
assert.equal(report.dataset.commit, '9ca04178df06ce649f00779a49e11094fe5b1c70');
assert.equal(report.summary.series_count, 6);
assert.ok(report.summary.sampled_windows >= 2500);
assert.ok(report.summary.unique_breakout_events > 0);

for (const symbol of ['BTCUSDT', 'ETHUSDT']) {
  for (const timeframe of ['1h', '4h', '1d']) {
    const series = report.series[symbol][timeframe];
    assert.ok(series, 'missing ' + symbol + ' ' + timeframe);
    assert.equal(series.dataset_integrity.invalid, 0);
    assert.equal(series.dataset_integrity.duplicates, 0);
    assert.equal(series.dataset_integrity.gaps, 0);
    assert.equal(series.dataset_integrity.offGrid, 0);
    assert.equal(series.events.length, series.method.unique_breakout_events);

    const ids = new Set();
    for (const event of series.events) {
      assert.ok(!ids.has(event.breakout_event_id), 'duplicate event ID within series');
      ids.add(event.breakout_event_id);
      assert.ok(event.first_seen_as_of_ms >= event.breakout_available_at_ms);
      assert.ok(event.last_seen_as_of_ms >= event.first_seen_as_of_ms);
      assert.ok(event.first_seen_delay_bars >= 0);
      assert.ok(['LONG', 'SHORT'].includes(event.direction));
      assert.ok(['STRONG_EVIDENCE', 'MIXED_EVIDENCE', 'WEAK_EVIDENCE', 'PARTIAL_EVIDENCE']
        .includes(event.quality_status_at_first_seen));
      if (event.outcome.status === 'EVALUATED') {
        assert.ok(event.outcome.entry.available_at_ms > event.first_seen_as_of_ms);
        assert.ok(event.outcome.entry.close_time_ms > event.breakout_candle_close_time_ms);
      }
    }
  }
}

assert.ok(report.summary.quality_outcomes.STRONG_EVIDENCE);
assert.ok(report.summary.quality_outcomes.WEAK_EVIDENCE);
assert.ok(Number.isInteger(report.summary.quality_status_changes));
assert.ok(Number.isInteger(report.summary.zone_boundary_changes));
assert.ok(Array.isArray(report.limitations) && report.limitations.length >= 6);

process.stdout.write('PASS six series and historical dataset integrity\n');
process.stdout.write('PASS unique breakout event IDs and first-observation availability\n');
process.stdout.write('PASS outcome entry is strictly after first observation cutoff\n');
process.stdout.write('PASS quality-group forward outcomes are present\n');
