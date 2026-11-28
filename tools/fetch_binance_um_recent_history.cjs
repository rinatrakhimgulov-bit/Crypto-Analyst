'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const BASE = 'https://data.binance.vision';
const SYMBOLS = ['BTCUSDT', 'ETHUSDT'];
const TIMEFRAMES = {
  '1h': { step_ms: 3600000, archive_interval: '1h' },
  '4h': { step_ms: 14400000, archive_interval: '4h' },
  '1d': { step_ms: 86400000, archive_interval: '1d' }
};
const START_DATE = '2025-12-06';
const FINALITY_LAG_MS = 500;
const OUTPUT_PATH = 'binance_usdm_recent_history.json';

function utcDateString(date) {
  return date.toISOString().slice(0, 10);
}
function monthString(year, month) {
  return year + '-' + String(month).padStart(2, '0');
}
function monthRange(startYear, startMonth, endYear, endMonth) {
  const result = [];
  let year = startYear, month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(monthString(year, month));
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return result;
}
async function getBuffer(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/zip, application/octet-stream, text/plain' },
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) throw new Error('HTTP_' + response.status + ' ' + url);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}
function verifyChecksum(zipBuffer, checksumText, label) {
  const match = checksumText.match(/\b([a-f0-9]{64})\b/i);
  if (!match) throw new Error('CHECKSUM_FORMAT_INVALID:' + label);
  const actual = crypto.createHash('sha256').update(zipBuffer).digest('hex');
  if (actual.toLowerCase() !== match[1].toLowerCase()) {
    throw new Error('CHECKSUM_MISMATCH:' + label + ':expected=' + match[1] + ':actual=' + actual);
  }
  return actual;
}
function parseCsv(csv, timeframe) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) throw new Error('EMPTY_KLINE_CSV:' + timeframe);
  const firstCell = lines[0].split(',')[0].trim();
  const startIndex = Number.isFinite(Number(firstCell)) ? 0 : 1;
  const rows = [];
  for (const line of lines.slice(startIndex)) {
    const p = line.split(',');
    if (p.length < 8) throw new Error('BINANCE_KLINE_COLUMNS_INVALID:' + line.slice(0, 160));
    let openTime = Number(p[0]);
    if (openTime > 1e14) openTime = Math.floor(openTime / 1000);
    const open = Number(p[1]), high = Number(p[2]), low = Number(p[3]), close = Number(p[4]);
    const volumeBase = Number(p[5]), quoteVolume = Number(p[7]);
    if (!Number.isSafeInteger(openTime) ||
        ![open, high, low, close, volumeBase, quoteVolume].every(Number.isFinite)) {
      throw new Error('BINANCE_KLINE_ROW_INVALID:' + line.slice(0, 160));
    }
    rows.push({
      open_time_ms: openTime,
      close_time_ms: openTime + TIMEFRAMES[timeframe].step_ms,
      open, high, low, close, volume_base: volumeBase, volume_quote: quoteVolume
    });
  }
  return rows;
}
function validateRows(rows, timeframe, label, nowMs = Date.now()) {
  const step = TIMEFRAMES[timeframe].step_ms;
  let invalid = 0, duplicates = 0, gaps = 0, offGrid = 0, notClosed = 0;
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i];
    if (!Number.isSafeInteger(c.open_time_ms) ||
        ![c.open, c.high, c.low, c.close, c.volume_base, c.volume_quote].every(Number.isFinite) ||
        c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0 ||
        c.volume_base < 0 || c.volume_quote < 0 ||
        c.high < Math.max(c.open, c.close, c.low) ||
        c.low > Math.min(c.open, c.close, c.high)) invalid++;
    if (c.open_time_ms % step !== 0) offGrid++;
    if (c.close_time_ms + FINALITY_LAG_MS > nowMs) notClosed++;
    if (i) {
      const delta = c.open_time_ms - rows[i - 1].open_time_ms;
      if (delta === 0) duplicates++;
      else if (delta !== step) gaps++;
    }
  }
  if (!rows.length || invalid || duplicates || gaps || offGrid || notClosed) {
    throw new Error('BINANCE_DATA_INTEGRITY_FAILED:' + label + ':' +
      JSON.stringify({ rows: rows.length, invalid, duplicates, gaps, offGrid, notClosed }));
  }
}
async function fetchArchiveFile(url, tempDir, label) {
  const [zipBuffer, checksumText] = await Promise.all([
    getBuffer(url),
    getBuffer(url + '.CHECKSUM').then(b => b.toString('utf8'))
  ]);
  const sha256 = verifyChecksum(zipBuffer, checksumText, label);
  const zipPath = path.join(tempDir, label.replace(/[^a-z0-9.-]/gi, '_') + '.zip');
  fs.writeFileSync(zipPath, zipBuffer);
  const csv = execFileSync('unzip', ['-p', zipPath], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  });
  return { csv, sha256, bytes: zipBuffer.length };
}
async function fetchSeries(symbol, timeframe, months, dailyDates, nowMs, tempDir) {
  const interval = TIMEFRAMES[timeframe].archive_interval;
  const byOpenTime = new Map();
  const files = [];
  for (const month of months) {
    const filename = symbol + '-' + interval + '-' + month + '.zip';
    const url = BASE + '/data/futures/um/monthly/klines/' + symbol + '/' + interval + '/' + filename;
    const fetched = await fetchArchiveFile(url, tempDir, filename);
    const parsed = parseCsv(fetched.csv, timeframe);
    for (const row of parsed) byOpenTime.set(row.open_time_ms, row);
    files.push({ type: 'monthly', filename, sha256: fetched.sha256, bytes: fetched.bytes, rows: parsed.length });
  }
  for (const date of dailyDates) {
    const filename = symbol + '-' + interval + '-' + date + '.zip';
    const url = BASE + '/data/futures/um/daily/klines/' + symbol + '/' + interval + '/' + filename;
    const fetched = await fetchArchiveFile(url, tempDir, filename);
    const parsed = parseCsv(fetched.csv, timeframe);
    for (const row of parsed) byOpenTime.set(row.open_time_ms, row);
    files.push({ type: 'daily', filename, sha256: fetched.sha256, bytes: fetched.bytes, rows: parsed.length });
  }
  const startMs = Date.parse(START_DATE + 'T00:00:00.000Z');
  const rows = [...byOpenTime.values()]
    .filter(row => row.open_time_ms >= startMs && row.close_time_ms + FINALITY_LAG_MS <= nowMs)
    .sort((a, b) => a.open_time_ms - b.open_time_ms);
  validateRows(rows, timeframe, symbol + ':' + timeframe, nowMs);
  if (rows.length < 250) throw new Error('BINANCE_SERIES_TOO_SHORT:' + symbol + ':' + timeframe + ':' + rows.length);
  return {
    rows,
    metadata: {
      count: rows.length,
      first_open_time_ms: rows[0].open_time_ms,
      last_open_time_ms: rows[rows.length - 1].open_time_ms,
      last_close_time_ms: rows[rows.length - 1].close_time_ms,
      monthly_files: files.filter(x => x.type === 'monthly').length,
      daily_files: files.filter(x => x.type === 'daily').length,
      files
    }
  };
}
async function main() {
  const nowMs = Date.now();
  const today = new Date(nowMs);
  const currentMonth = today.getUTCMonth() + 1;
  const currentYear = today.getUTCFullYear();
  const previousMonthDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
  previousMonthDate.setUTCDate(0);
  const lastCompleteDay = new Date(Date.UTC(currentYear, currentMonth - 1, today.getUTCDate() - 1));
  const months = monthRange(2025, 12, previousMonthDate.getUTCFullYear(), previousMonthDate.getUTCMonth() + 1);
  const dailyDates = [];
  for (let day = 1; day <= lastCompleteDay.getUTCDate(); day++) {
    dailyDates.push(utcDateString(new Date(Date.UTC(currentYear, currentMonth - 1, day))));
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'binance-usdm-'));
  const output = {
    schema_version: 1,
    provider: 'Binance USD-M Futures public archive',
    market_type: 'linear_perpetual',
    generated_at: new Date(nowMs).toISOString(),
    finality_safety_lag_ms: FINALITY_LAG_MS,
    coverage_start: START_DATE,
    coverage_end: null,
    series: {},
    metadata: {}
  };
  let latestClose = 0;
  for (const symbol of SYMBOLS) {
    output.series[symbol] = {};
    output.metadata[symbol] = {};
    for (const timeframe of Object.keys(TIMEFRAMES)) {
      const fetched = await fetchSeries(symbol, timeframe, months, dailyDates, nowMs, tempDir);
      output.series[symbol][timeframe] = fetched.rows;
      output.metadata[symbol][timeframe] = fetched.metadata;
      latestClose = Math.max(latestClose, fetched.metadata.last_close_time_ms);
      process.stdout.write(symbol + ' ' + timeframe + ': ' + fetched.rows.length +
        ' closed candles, ' + fetched.metadata.monthly_files + ' monthly + ' +
        fetched.metadata.daily_files + ' daily files\n');
    }
  }
  output.coverage_end = new Date(latestClose).toISOString();
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output) + '\n');
  process.stdout.write('Wrote ' + OUTPUT_PATH + ' through ' + output.coverage_end + '\n');
}
if (require.main === module) {
  main().catch(error => {
    process.stderr.write((error && error.stack) || String(error));
    process.exitCode = 1;
  });
}
module.exports = { parseCsv, validateRows, verifyChecksum, TIMEFRAMES, START_DATE, OUTPUT_PATH, FINALITY_LAG_MS };
