'use strict';

const assert = require('node:assert/strict');
const {
  runStructure, runZones, runAnalyticalContext, summarizeAnalyticalContext, STEP, LAG
} = require('../tools/b2_historical_replay.cjs');

function makeRows(count) {
  const start = 1609459200000;
  const rows = [];
  let previous = 200;
  for (let i = 0; i < count; i++) {
    const close = 200 + i * 0.025 + 10 * Math.sin(i * Math.PI * 2 / 36) +
      3 * Math.sin(i * Math.PI * 2 / 9);
    const open = previous + 0.2 * Math.sin(i * Math.PI / 5);
    const high = Math.max(open, close) + 1.2 + (i % 4) * 0.1;
    const low = Math.min(open, close) - 1.1 - (i % 3) * 0.1;
    const openTime = start + i * STEP['1h'];
    rows.push({
      open_time_ms: openTime, close_time_ms: openTime + STEP['1h'],
      open, high, low, close,
      volume_base: 100 + (i % 17) * 3,
      volume_quote: (100 + (i % 17) * 3) * close
    });
    previous = close;
  }
  return rows;
}
function runAt(rows, label) {
  const last = rows[rows.length - 1];
  const asOf = last.close_time_ms + LAG;
  const structure = runStructure(rows, 'BTCUSDT', '1h', asOf, 'replay-test:' + label);
  const zones = runZones(structure, 'BTCUSDT', '1h');
  const analytical = runAnalyticalContext(structure, zones);
  return { asOf, structure, zones, analytical };
}

const rows = makeRows(320);
const full = runAt(rows, 'full');
assert.equal(full.analytical.regime.status, 'VALID');
assert.equal(full.analytical.zoneContext.status, 'VALID');
assert.equal(full.analytical.breakoutQuality.status, 'VALID');
assert.equal(full.analytical.impulse.status, 'VALID');
assert.ok(full.analytical.zoneContext.zones.every(zone => zone.available_at_ms <= full.asOf));
assert.ok(full.analytical.breakoutQuality.breakouts.every(item =>
  item.breakout_candle_close_time_ms <= full.asOf - LAG));
assert.equal(full.analytical.impulse.event.window_end_close_time_ms,
  rows[rows.length - 1].close_time_ms);

const summary = summarizeAnalyticalContext(full.analytical);
assert.ok(summary.regime.label);
assert.ok(summary.zones);
assert.ok(summary.breakout_quality);
assert.ok(summary.impulse.classification);

const prefix = runAt(rows.slice(0, 270), 'prefix-270');
assert.equal(prefix.analytical.regime.status, 'VALID');
assert.ok(prefix.analytical.zoneContext.zones.every(zone => zone.available_at_ms <= prefix.asOf));
assert.ok(prefix.analytical.breakoutQuality.breakouts.every(item =>
  item.breakout_candle_close_time_ms <= prefix.asOf - LAG));
assert.equal(prefix.analytical.impulse.event.window_end_close_time_ms,
  rows[269].close_time_ms);

const repeated = runAt(rows.slice(0, 270), 'prefix-270');
assert.deepEqual(prefix.analytical, repeated.analytical);

process.stdout.write('PASS full 320-bar pipeline runs all four research engines\n');
process.stdout.write('PASS prefix-only 270-bar replay respects the analysis cutoff\n');
process.stdout.write('PASS analytical context is deterministic on repeated prefix replay\n');
