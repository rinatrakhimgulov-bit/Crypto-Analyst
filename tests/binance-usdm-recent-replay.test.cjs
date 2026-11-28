'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { parseCsv, validateRows, verifyChecksum, TIMEFRAMES, FINALITY_LAG_MS } =
  require('../tools/fetch_binance_um_recent_history.cjs');

const step = TIMEFRAMES['1h'].step_ms;
const start = Math.floor(1700000000000 / step) * step;
const csvWithHeader = [
  'open_time,open,high,low,close,volume,close_time,quote_volume,count,taker_buy_base,taker_buy_quote,ignore',
  [start, '100', '105', '99', '103', '12.5', start + step - 1, '1287.5', '25', '6', '618', '0'].join(','),
  [start + step, '103', '106', '101', '104', '11', start + 2 * step - 1, '1144', '20', '5', '520', '0'].join(',')
].join('\n');
const rows = parseCsv(csvWithHeader, '1h');
assert.equal(rows.length, 2);
assert.equal(rows[0].open_time_ms, start);
assert.equal(rows[0].close_time_ms, start + step);
assert.equal(rows[0].volume_base, 12.5);
assert.equal(rows[0].volume_quote, 1287.5);
assert.doesNotThrow(() => validateRows(rows, '1h', 'header-fixture', start + 4 * step));

const csvNoHeader = [
  [start, '100', '105', '99', '103', '12.5', start + step - 1, '1287.5', '25', '6', '618', '0'].join(',')
].join('\n');
assert.equal(parseCsv(csvNoHeader, '1h').length, 1);

const bad = [rows[0], { ...rows[1], open_time_ms: rows[1].open_time_ms + step,
  close_time_ms: rows[1].close_time_ms + step }];
assert.throws(() => validateRows(bad, '1h', 'gap-fixture', start + 4 * step), /BINANCE_DATA_INTEGRITY_FAILED/);

const payload = Buffer.from('binance-checksum-fixture');
const digest = crypto.createHash('sha256').update(payload).digest('hex');
assert.equal(verifyChecksum(payload, digest + ' fixture.zip', 'checksum-fixture'), digest);
assert.equal(FINALITY_LAG_MS, 500);
process.stdout.write('PASS Binance futures CSV parsing with and without header\n');
process.stdout.write('PASS timestamp, OHLCV, continuity and checksum validation\n');
