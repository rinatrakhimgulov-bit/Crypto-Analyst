'use strict';

const fs = require('node:fs');
const {
  loadRows, FILES, STEP, DATASET_COMMIT
} = require('./b2_historical_replay.cjs');

const HOSTS = [
  'https://api.bybit.com',
  'https://api.bytick.com'
];
const FINALITY_LAG_MS = 500;
const LIMIT = 1000;
const OUTPUT_PATH = 'bybit_2026_history_extension.json';
const INTERVAL = { '1h': '60', '4h': '240', '1d': 'D' };

async function requestJson(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  const errors = [];
  for (const host of HOSTS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(host + path + (query ? '?' + query : ''), {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(20000)
        });
        const body = await response.text();
        let payload;
        try { payload = JSON.parse(body); }
        catch { throw new Error('NON_JSON_HTTP_' + response.status + ':' + body.slice(0, 160)); }
        if (!response.ok) throw new Error('HTTP_' + response.status + ':' + JSON.stringify(payload).slice(0, 240));
        if (payload.retCode !== 0) throw new Error('BYBIT_RET_' + payload.retCode + ':' + payload.retMsg);
        return { payload, host };
      } catch (error) {
        errors.push(host + ' attempt ' + (attempt + 1) + ': ' + (error && error.message || String(error)));
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }
  throw new Error('BYBIT_PUBLIC_API_UNAVAILABLE\n' + errors.join('\n'));
}

async function getServerTime() {
  const { payload, host } = await requestJson('/v5/market/time');
  const seconds = Number(payload.result && payload.result.timeSecond);
  const nanos = Number(payload.result && payload.result.timeNano);
  const ms = Number.isFinite(seconds) && seconds > 0
    ? seconds * 1000
    : Number.isFinite(nanos) && nanos > 0 ? Math.floor(nanos / 1e6) : NaN;
  if (!Number.isSafeInteger(ms) || ms <= 0) throw new Error('BYBIT_SERVER_TIME_INVALID');
  return { server_time_ms: ms, host };
}

function parseKline(row, timeframe) {
  if (!Array.isArray(row) || row.length < 7) throw new Error('BYBIT_KLINE_ROW_INVALID');
  const openTime = Number(row[0]);
  const open = Number(row[1]), high = Number(row[2]), low = Number(row[3]), close = Number(row[4]);
  const volumeBase = Number(row[5]), volumeQuote = Number(row[6]);
  return {
    open_time_ms: openTime,
    close_time_ms: openTime + STEP[timeframe],
    open, high, low, close,
    volume_base: volumeBase,
    volume_quote: volumeQuote
  };
}

function validateRows(rows, timeframe, label) {
  let invalid = 0, duplicates = 0, gaps = 0, offGrid = 0;
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i];
    if (!Number.isSafeInteger(c.open_time_ms) ||
        ![c.open, c.high, c.low, c.close, c.volume_base, c.volume_quote].every(Number.isFinite) ||
        c.open_time_ms <= 0 || c.open <= 0 || c.high <= 0 || c.close <= 0 ||
        c.volume_base < 0 || c.volume_quote < 0 ||
        c.low <= 0 || c.high < Math.max(c.open, c.close, c.low) ||
        c.low > Math.min(c.open, c.close, c.high)) invalid++;
    if (c.open_time_ms % STEP[timeframe] !== 0) offGrid++;
    if (i) {
      const delta = c.open_time_ms - rows[i - 1].open_time_ms;
      if (delta === 0) duplicates++;
      else if (delta !== STEP[timeframe]) gaps++;
    }
  }
  if (!rows.length || invalid || duplicates || gaps || offGrid) {
    throw new Error('EXTENSION_INTEGRITY_FAILED:' + label + ':' +
      JSON.stringify({ rows: rows.length, invalid, duplicates, gaps, offGrid }));
  }
}

async function fetchSeries(symbol, timeframe, archiveLastOpen, serverTimeMs) {
  const stepMs = STEP[timeframe];
  let cursor = serverTimeMs;
  const collected = [];
  let pages = 0;
  let selectedHost = null;

  while (cursor > archiveLastOpen + stepMs) {
    const { payload, host } = await requestJson('/v5/market/kline', {
      category: 'linear',
      symbol,
      interval: INTERVAL[timeframe],
      end: String(cursor),
      limit: String(LIMIT)
    });
    selectedHost = selectedHost || host;
    const raw = payload.result && payload.result.list;
    if (!Array.isArray(raw) || raw.length === 0) break;
    const page = raw.map(row => parseKline(row, timeframe));
    collected.push(...page);
    const oldest = Math.min(...page.map(row => row.open_time_ms));
    if (!Number.isSafeInteger(oldest) || oldest >= cursor) throw new Error('BYBIT_PAGINATION_STALLED:' + symbol + ':' + timeframe);
    if (oldest <= archiveLastOpen + stepMs) break;
    cursor = oldest - 1;
    pages++;
    if (pages > 100) throw new Error('BYBIT_PAGINATION_LIMIT:' + symbol + ':' + timeframe);
  }

  const byOpenTime = new Map();
  for (const row of collected) {
    if (row.open_time_ms > archiveLastOpen &&
        row.close_time_ms + FINALITY_LAG_MS <= serverTimeMs) {
      byOpenTime.set(row.open_time_ms, row);
    }
  }
  const rows = [...byOpenTime.values()].sort((a, b) => a.open_time_ms - b.open_time_ms);
  if (!rows.length) throw new Error('NO_CLOSED_EXTENSION_ROWS:' + symbol + ':' + timeframe);
  if (rows[0].open_time_ms !== archiveLastOpen + stepMs) {
    throw new Error('EXTENSION_START_GAP:' + symbol + ':' + timeframe + ':' +
      JSON.stringify({ expected: archiveLastOpen + stepMs, actual: rows[0].open_time_ms }));
  }
  validateRows(rows, timeframe, symbol + ':' + timeframe);
  return {
    rows,
    meta: {
      pages, count: rows.length, api_host: selectedHost,
      archive_last_open_time_ms: archiveLastOpen,
      extension_first_open_time_ms: rows[0].open_time_ms,
      extension_last_open_time_ms: rows[rows.length - 1].open_time_ms,
      extension_last_close_time_ms: rows[rows.length - 1].close_time_ms
    }
  };
}

async function main() {
  const time = await getServerTime();
  const output = {
    schema_version: 1,
    provider: 'Bybit V5 public market kline',
    category: 'linear',
    archive_repository_commit: DATASET_COMMIT,
    generated_at: new Date().toISOString(),
    server_time_ms: time.server_time_ms,
    api_time_host: time.host,
    finality_safety_lag_ms: FINALITY_LAG_MS,
    coverage_end: null,
    series: {},
    metadata: {}
  };

  let latestClosed = 0;
  for (const symbol of Object.keys(FILES)) {
    output.series[symbol] = {};
    output.metadata[symbol] = {};
    for (const timeframe of ['1h', '4h', '1d']) {
      const archive = await loadRows(FILES[symbol][timeframe], timeframe);
      const lastArchive = archive.rows[archive.rows.length - 1];
      const fetched = await fetchSeries(symbol, timeframe, lastArchive.open_time_ms, time.server_time_ms);
      output.series[symbol][timeframe] = fetched.rows;
      output.metadata[symbol][timeframe] = {
        archive_rows: archive.rows.length,
        archive_last_open_time_ms: lastArchive.open_time_ms,
        ...fetched.meta
      };
      latestClosed = Math.max(latestClosed, fetched.meta.extension_last_close_time_ms);
      process.stdout.write(symbol + ' ' + timeframe + ': ' + fetched.rows.length +
        ' new closed candles across ' + fetched.meta.pages + ' pages\n');
    }
  }
  output.coverage_end = new Date(latestClosed).toISOString();
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output) + '\n');
  process.stdout.write('Wrote ' + OUTPUT_PATH + ' through ' + output.coverage_end + '\n');
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write((error && error.stack) || String(error));
    process.exitCode = 1;
  });
}

module.exports = { parseKline, validateRows, fetchSeries, OUTPUT_PATH, FINALITY_LAG_MS };
