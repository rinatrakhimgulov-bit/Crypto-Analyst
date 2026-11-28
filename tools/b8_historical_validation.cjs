'use strict';

const fs = require('node:fs');
const { evaluateCandidate } = require('../src/research/b8-outcome-evaluator.js');
const { summarizeOutcomes } = require('../src/research/b8-statistics.js');
const { deduplicateCandidates, chronologicalSplit } = require('../src/research/b8-candidate-collection.js');

const REPOSITORY = 'mestoness/btc-eth-candles-history';
const DATASET_COMMIT = '9ca04178df06ce649f00779a49e11094fe5b1c70';
const RAW_BASE = 'https://raw.githubusercontent.com/' + REPOSITORY + '/' + DATASET_COMMIT + '/';
const LAG_MS = 500;
const TIMEFRAMES = {
  BTCUSDT: { '1h': ['BTCUSDT_60.csv', 3600000], '4h': ['BTCUSDT_240.csv', 14400000], '1d': ['BTCUSDT_D.csv', 86400000] },
  ETHUSDT: { '1h': ['ETHUSDT_60.csv', 3600000], '4h': ['ETHUSDT_240.csv', 14400000], '1d': ['ETHUSDT_D.csv', 86400000] }
};
function assert(condition, message) { if (!condition) throw new Error(message); }

async function loadSeries(symbol, timeframe, file, step) {
  const response = await fetch(RAW_BASE + file);
  assert(response.ok, 'B8_DATASET_DOWNLOAD_FAILED:' + file + ':' + response.status);
  const lines = (await response.text()).trim().split(/\r?\n/);
  const rows = lines.slice(1).filter(Boolean).map(line => {
    const p = line.split(',');
    const openTime = Number(p[0]);
    return {
      open_time_ms: openTime, close_time_ms: openTime + step,
      open: Number(p[1]), high: Number(p[2]), low: Number(p[3]), close: Number(p[4]),
      volume_base: Number(p[5]), volume_quote: Number(p[6]),
      canonical_symbol: symbol, market_type: 'linear_perpetual',
      timeframe, closed_state: 'TIME_DERIVED'
    };
  });
  assert(rows.length > 200, 'B8_DATASET_TOO_SHORT:' + file);
  let invalid = 0, duplicates = 0, gaps = 0, offGrid = 0;
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i];
    if (!Number.isSafeInteger(c.open_time_ms) ||
        ![c.open, c.high, c.low, c.close, c.volume_base, c.volume_quote].every(Number.isFinite) ||
        c.open_time_ms <= 0 || c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0 ||
        c.volume_base < 0 || c.volume_quote < 0 ||
        c.high < Math.max(c.open, c.close, c.low) || c.low > Math.min(c.open, c.close, c.high)) invalid++;
    if (c.open_time_ms % step !== 0) offGrid++;
    if (i) {
      const delta = c.open_time_ms - rows[i - 1].open_time_ms;
      if (delta === 0) duplicates++;
      else if (delta !== step) gaps++;
    }
  }
  assert(!invalid && !duplicates && !gaps && !offGrid,
    'B8_DATASET_INTEGRITY_FAILED:' + JSON.stringify({ symbol, timeframe, invalid, duplicates, gaps, offGrid }));
  return rows;
}

function collectSeriesEntries(replay) {
  const entries = [];
  for (const symbol of Object.keys(replay.symbols || {})) {
    const history = replay.symbols[symbol].history || {};
    for (const timeframe of Object.keys(history)) {
      const windows = history[timeframe]['160_candle_windows'] || [];
      entries.push({
        symbol, timeframe,
        windows: windows.map(window => ({
          quantile: window.quantile,
          candidates: window.b7 && Array.isArray(window.b7.candidates) ? window.b7.candidates : []
        }))
      });
    }
  }
  return entries;
}

async function main() {
  const replayPath = 'b2_historical_replay_report.json';
  assert(fs.existsSync(replayPath), 'B8_REQUIRES_B2_HISTORICAL_REPLAY_REPORT');
  const replay = JSON.parse(fs.readFileSync(replayPath, 'utf8'));
  assert(replay.dataset_commit === DATASET_COMMIT, 'B8_B2_REPLAY_DATASET_COMMIT_MISMATCH');
  const candidates = deduplicateCandidates(collectSeriesEntries(replay));
  const datasets = {};
  const results = [];
  const seriesSummary = [];

  for (const symbol of Object.keys(TIMEFRAMES)) {
    datasets[symbol] = {};
    for (const timeframe of Object.keys(TIMEFRAMES[symbol])) {
      const [file, step] = TIMEFRAMES[symbol][timeframe];
      const rows = await loadSeries(symbol, timeframe, file, step);
      datasets[symbol][timeframe] = rows;
      const startMs = rows[0].open_time_ms;
      const endMs = rows[rows.length - 1].close_time_ms;
      const selected = candidates.filter(c => c.symbol === symbol && c.timeframe === timeframe);
      const statusCounts = selected.reduce((acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      }, {});
      let evaluated = 0, excluded = 0, purged = 0;
      for (const candidate of selected) {
        if (candidate.status !== 'CONFIRMED') continue;
        const entryIndex = rows.findIndex(c => c.close_time_ms + LAG_MS > candidate.available_at_ms);
        const maxOutcomeIndex = entryIndex < 0 ? -1 : entryIndex + 12;
        const maxOutcomeAvailableAt = maxOutcomeIndex >= 0 && maxOutcomeIndex < rows.length
          ? rows[maxOutcomeIndex].close_time_ms + LAG_MS : null;
        const split = chronologicalSplit(candidate, startMs, endMs, maxOutcomeAvailableAt);
        if (split.startsWith('PURGED_')) {
          purged++;
          results.push({
            symbol, timeframe, split, setup_type: candidate.setup_type,
            direction: candidate.direction, setup_id: candidate.setup_id,
            available_at_ms: candidate.available_at_ms,
            first_seen_window_quantile: candidate.first_seen_window_quantile,
            outcome: { status: 'PURGED', reason: split }
          });
          continue;
        }
        const outcome = evaluateCandidate({
          candidate, candles: rows, finalitySafetyLagMs: LAG_MS,
          horizons: [1, 3, 6, 12], targetRMultiples: [1, 2], barrierMaxBars: 12
        });
        if (outcome.status === 'EVALUATED') evaluated++;
        else excluded++;
        results.push({
          symbol, timeframe, split, setup_type: candidate.setup_type,
          direction: candidate.direction, setup_id: candidate.setup_id,
          available_at_ms: candidate.available_at_ms, first_seen_window_quantile: candidate.first_seen_window_quantile,
          outcome
        });
      }
      seriesSummary.push({
        symbol, timeframe, dataset_start: new Date(startMs).toISOString(),
        dataset_end: new Date(endMs).toISOString(), unique_candidate_count: selected.length,
        status_counts: statusCounts, confirmed_evaluated: evaluated,
        confirmed_excluded: excluded, confirmed_purged_at_split_boundary: purged,
        split_boundaries: {
          train_end_exclusive: new Date(startMs + (endMs - startMs) * 0.6).toISOString(),
          validation_end_exclusive: new Date(startMs + (endMs - startMs) * 0.8).toISOString()
        }
      });
    }
  }

  const groups = new Map();
  for (const row of results) {
    for (const horizon of [1, 3, 6, 12]) {
      const key = [row.symbol, row.timeframe, row.split, row.setup_type, row.direction, horizon].join('|');
      if (!groups.has(key)) groups.set(key, { symbol: row.symbol, timeframe: row.timeframe,
        split: row.split, setup_type: row.setup_type, direction: row.direction, horizon, results: [] });
      groups.get(key).results.push(row.outcome);
    }
  }
  const metrics = Array.from(groups.values()).sort((a,b) =>
    a.symbol.localeCompare(b.symbol) || a.timeframe.localeCompare(b.timeframe) ||
    a.split.localeCompare(b.split) || a.setup_type.localeCompare(b.setup_type) ||
    a.direction.localeCompare(b.direction) || a.horizon - b.horizon
  ).map(group => ({ ...group, ...summarizeOutcomes(group.results, group.horizon), results: undefined }));

  const report = {
    report_version: 'b8-historical-validation-v1',
    generated_at: new Date().toISOString(),
    dataset: { repository: REPOSITORY, commit: DATASET_COMMIT,
      finality: 'TIME_DERIVED with fixed 500ms research lag; not observed provider finality' },
    candidate_source: 'Deduplicated stable candidate IDs surfaced by the five existing 160-candle windows per symbol/timeframe. This is a sparse exploratory sample, not an exhaustive historical event census.',
    candidate_count: candidates.length,
    candidate_status_counts: candidates.reduce((acc,c) => {
      acc[c.status] = (acc[c.status] || 0) + 1; return acc;
    }, {}),
    series: seriesSummary,
    metrics,
    caveats: [
      'B2 replay uses a synthetic B1-VALID wrapper; the real B1 validator is not executed on this archive.',
      'The B7 candidate population is sampled from five quantile windows per series and is not exhaustive.',
      'TRAIN and VALIDATION candidates whose 12-bar outcome endpoint crosses the next split boundary are purged; purged candidates are not reassigned.',
      'Overlapping candidates and common market moves are correlated; Wilson intervals are naive-independence descriptors, not cluster-aware inference.',
      'Entry is a bar-close proxy after candidate availability, not an executable exchange fill.',
      'No tick data, spread, fees, funding, slippage observations or actual trade outcomes are available.',
      'Positive forward close returns are not trade wins. Barrier outcomes are research simulations only.',
      'No threshold tuning or profitability conclusion is performed.'
    ],
    evaluations: results
  };
  fs.writeFileSync('b8_historical_validation_report.json', JSON.stringify(report, null, 2) + '\n');
  const lines = [
    '# B8 Historical Outcome Exploration',
    '',
    'Status: exploratory research only; not a profitability backtest.',
    '',
    'Dataset: `' + REPOSITORY + '` at commit `' + DATASET_COMMIT + '`.',
    'Unique sampled candidates: **' + candidates.length + '**.',
    '',
    '| Symbol | TF | Unique candidates | Confirmed evaluated | Confirmed excluded | Confirmed purged |',
    '|---|---:|---:|---:|---:|---:|'
  ];
  for (const s of seriesSummary) lines.push('| ' + s.symbol + ' | ' + s.timeframe + ' | ' +
    s.unique_candidate_count + ' | ' + s.confirmed_evaluated + ' | ' + s.confirmed_excluded + ' | ' + s.confirmed_purged_at_split_boundary + ' |');
  lines.push('', '## Metrics', '',
    '| Symbol | TF | Split | Setup | Side | Horizon bars | N | Positive close rate | Mean return % | Mean MFE % | Mean MAE % |',
    '|---|---:|---|---|---|---:|---:|---:|---:|---:|---:|');
  for (const m of metrics) lines.push('| ' + [m.symbol,m.timeframe,m.split,m.setup_type,m.direction,m.horizon,m.n,
    m.positive_close_rate == null ? '—' : (m.positive_close_rate*100).toFixed(1)+'%',
    m.forward_return_pct.mean == null ? '—' : m.forward_return_pct.mean.toFixed(3),
    m.mfe_pct.mean == null ? '—' : m.mfe_pct.mean.toFixed(3),
    m.mae_pct.mean == null ? '—' : m.mae_pct.mean.toFixed(3)].join(' | ') + ' |');
  lines.push('', '## Limitations', '', ...report.caveats.map(x => '- ' + x), '');
  fs.writeFileSync('b8_historical_validation_report.md', lines.join('\n'));
  console.log(JSON.stringify({
    report: 'b8_historical_validation_report.json',
    candidate_count: report.candidate_count,
    candidate_status_counts: report.candidate_status_counts,
    series: seriesSummary,
    metric_groups: metrics.length,
    caveats: report.caveats
  }, null, 2));
}
main().catch(error => { console.error(error && error.stack ? error.stack : error); process.exitCode = 1; });
