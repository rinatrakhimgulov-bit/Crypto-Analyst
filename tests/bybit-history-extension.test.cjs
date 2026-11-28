'use strict';

const assert = require('node:assert/strict');
const { parseKline, validateRows, FINALITY_LAG_MS } = require('../tools/fetch_bybit_history_extension.cjs');

const STEP = 3600000;
const parsed = parseKline([
  String(1700000000000), '100', '105', '99', '103', '12.5', '1287.5'
], '1h');
assert.equal(parsed.open_time_ms, 1700000000000);
assert.equal(parsed.close_time_ms, 1700000000000 + STEP);
assert.equal(parsed.volume_base, 12.5);
assert.equal(parsed.volume_quote, 1287.5);

const rows = [
  { ...parsed },
  { ...parsed, open_time_ms: parsed.open_time_ms + STEP, close_time_ms: parsed.close_time_ms + STEP }
];
assert.doesNotThrow(() => validateRows(rows, '1h', 'fixture:valid'));

const gap = [rows[0], { ...rows[1], open_time_ms: rows[1].open_time_ms + STEP,
  close_time_ms: rows[1].close_time_ms + STEP }];
assert.throws(() => validateRows(gap, '1h', 'fixture:gap'), /EXTENSION_INTEGRITY_FAILED/);

const invalid = [rows[0], { ...rows[1], high: 1, low: 200 }];
assert.throws(() => validateRows(invalid, '1h', 'fixture:invalid'), /EXTENSION_INTEGRITY_FAILED/);

assert.equal(FINALITY_LAG_MS, 500);
process.stdout.write('PASS Bybit kline parsing and close-time normalization\n');
process.stdout.write('PASS extension OHLCV continuity and integrity validation\n');
