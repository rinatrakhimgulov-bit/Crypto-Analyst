'use strict';

const fs = require('node:fs');

// Research-only historical replay. The archive is fetched at runtime and is not committed.
const { analyze: analyzeA } = require('../src/analysis/b2-causal-swing-engine.js');
const { analyze: analyzeB } = require('../src/analysis/b2b-swing-sequence-engine.js');
const { analyze: analyzeC } = require('../src/analysis/b2c-swing-structure-engine.js');
const { analyze: analyzeD } = require('../src/analysis/b2d-support-resistance-engine.js');
const { analyze: analyzeE } = require('../src/analysis/b2e-breakout-retest-engine.js');
const { analyze: analyzeF } = require('../src/analysis/b2f-mtf-structure-confluence-engine.js');
const { analyze: analyzeG } = require('../src/analysis/b2g-chart-projection-engine.js');

const LAG = 500;
const QUALITY = 'b1-quality-policy-2026-11-27-v1';
const RAW_BASE = 'https://raw.githubusercontent.com/mestoness/btc-eth-candles-history/master/';
const FILES = {
  BTCUSDT: { '1h': 'BTCUSDT_60.csv', '4h': 'BTCUSDT_240.csv', '1d': 'BTCUSDT_D.csv' },
  ETHUSDT: { '1h': 'ETHUSDT_60.csv', '4h': 'ETHUSDT_240.csv', '1d': 'ETHUSDT_D.csv' }
};
const STEP = { '1h': 3600000, '4h': 14400000, '1d': 86400000 };
const REQUIRED = ['1d', '4h', '1h'];

const POLICY_A = {
  version: 'b2a-causal-swing-v1', b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0', b1_quality_policy_version: QUALITY,
  left_strength: 2, right_strength: 2, finality_safety_lag_ms: LAG,
  price_equality_policy: 'EXACT_PRICE_V1'
};
const POLICY_B = {
  version: 'b2b-swing-sequence-v3', same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
  b2a_engine_version: '2.0.0-b2a', b2a_policy_version: 'b2a-causal-swing-v1',
  b1_validator_version: '1.1.0', b1_quality_policy_version: QUALITY,
  price_equality_policy: 'EXACT_PRICE_V1'
};
const POLICY_C = {
  version: 'b2c-state-v2', b2b_engine_version: '2.2.0-b2b',
  b2b_policy_version: 'b2b-swing-sequence-v3',
  b2b_same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
  b2a_engine_version: '2.0.0-b2a', b2a_policy_version: 'b2a-causal-swing-v1',
  b1_contract_version: '1.1.0', b1_validator_version: '1.1.0',
  b1_quality_policy_version: QUALITY, finality_safety_lag_ms: LAG,
  price_equality_policy: 'EXACT_PRICE_V1', break_buffer_policy: 'ZERO_BUFFER_V1'
};
const POLICY_F = {
  version: 'b2f-mtf-confluence-v1', b1_mtf_contract_version: '1.0.0',
  b1_contract_version: '1.1.0', b1_validator_version: '1.1.0',
  b1_quality_policy_version: QUALITY,
  b2b_engine_version: '2.2.0-b2b', b2b_policy_version: 'b2b-swing-sequence-v3',
  b2b_same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
  b2c_engine_version: '2.1.0-b2c', b2c_policy_version: 'b2c-state-v2',
  finality_safety_lag_ms: LAG, max_provider_time_spread_ms: 0
};
const POLICY_G = {
  version: 'b2g-chart-projection-v1', b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0', b1_quality_policy_version: QUALITY,
  b2a_engine_version: '2.0.0-b2a', b2a_policy_version: 'b2a-causal-swing-v1',
  b2b_engine_version: '2.2.0-b2b', b2b_policy_version: 'b2b-swing-sequence-v3',
  b2b_same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
  b2c_engine_version: '2.1.0-b2c', b2c_policy_version: 'b2c-state-v2',
  b2d_engine_version: '2.0.0-b2d', b2d_policy_version: 'b2d-zone-engine-v1',
  b2d_zone_policy_version: 'b2d-absolute-span-v1',
  b2e_engine_version: '2.0.0-b2e', b2e_policy_version: 'b2e-retest-engine-v1',
  b2e_retest_policy_version: 'retest-policy-v1',
  b2f_engine_version: '2.0.0-b2f', b2f_policy_version: 'b2f-mtf-confluence-v1',
  finality_safety_lag_ms: LAG
};

function assert(condition, message) { if (!condition) throw new Error(message); }
function median(values) {
  const a = values.slice().sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : 0;
}
async function loadRows(file, timeframe) {
  const response = await fetch(RAW_BASE + file);
  assert(response.ok, 'Dataset download failed: ' + file + ' HTTP ' + response.status);
  const lines = (await response.text()).trim().split(/\r?\n/);
  const rows = lines.slice(1).filter(Boolean).map(line => {
    const p = line.split(',');
    const openTime = Number(p[0]);
    return {
      open_time_ms: openTime, close_time_ms: openTime + STEP[timeframe],
      open: Number(p[1]), high: Number(p[2]), low: Number(p[3]), close: Number(p[4]),
      volume_base: Number(p[5]), volume_quote: Number(p[6])
    };
  });
  let invalid = 0, duplicates = 0, gaps = 0, offGrid = 0;
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i];
    if (!Number.isSafeInteger(c.open_time_ms) ||
        ![c.open, c.high, c.low, c.close, c.volume_base, c.volume_quote].every(Number.isFinite) ||
        c.low <= 0 || c.high < Math.max(c.open, c.close, c.low) ||
        c.low > Math.min(c.open, c.close, c.high)) invalid++;
    if (c.open_time_ms % STEP[timeframe] !== 0) offGrid++;
    if (i) {
      const delta = c.open_time_ms - rows[i - 1].open_time_ms;
      if (delta === 0) duplicates++;
      else if (delta !== STEP[timeframe]) gaps++;
    }
  }
  assert(rows.length > 200, 'Insufficient historical rows: ' + file);
  assert(!invalid && !duplicates && !gaps && !offGrid,
    'Dataset integrity failed for ' + file + ': ' + JSON.stringify({ invalid, duplicates, gaps, offGrid }));
  return { rows, integrity: { rows: rows.length, invalid, duplicates, gaps, offGrid,
    start: new Date(rows[0].open_time_ms).toISOString(),
    end: new Date(rows[rows.length - 1].open_time_ms).toISOString() } };
}
function makeCandle(row, symbol, timeframe) {
  return {
    ...row, canonical_symbol: symbol, market_type: 'linear_perpetual',
    timeframe, closed_state: 'TIME_DERIVED'
  };
}
function makeSnapshot(rows, symbol, timeframe, asOf, snapshotId) {
  const candles = rows.map(r => makeCandle(r, symbol, timeframe));
  const snapshot = {
    contract_version: '1.1.0', snapshot_id: snapshotId,
    canonical_symbol: symbol, market_type: 'linear_perpetual',
    analysis_as_of_ms: asOf, provider_server_time_ms: asOf, received_at_ms: asOf,
    provider_metadata: {
      provider_id: 'bybit-v5-rest-archive', venue: 'bybit',
      provider_symbol: symbol, market_type: 'linear_perpetual',
      host: 'archive-replay', time_source: 'provider'
    },
    candles_by_timeframe: { [timeframe]: candles },
    forming_candle_by_timeframe: { [timeframe]: null },
    unclassified_candles_by_timeframe: { [timeframe]: [] }
  };
  const quality = {
    validator_version: '1.1.0', policy_version: QUALITY,
    snapshot_id: snapshotId, status: 'VALID', reasons: [],
    symbol, timeframe, analysis_as_of_ms: asOf, received_at_ms: asOf,
    valid_count: candles.length, closed_count: candles.length,
    forming_count: 0, unknown_finality_count: 0,
    insufficient_history: false, checked_at_ms: asOf
  };
  return { snapshot, quality, candles };
}
function runStructure(rows, symbol, timeframe, asOf, id, strength = 2) {
  const { snapshot, quality } = makeSnapshot(rows, symbol, timeframe, asOf, id);
  const a = analyzeA({ snapshot, quality_report: quality, timeframe, analysis_as_of_ms: asOf, policy: { ...POLICY_A, left_strength: strength, right_strength: strength } });
  assert(a.status === 'VALID', 'B2-A blocked: ' + JSON.stringify(a.admission.reasons));
  const b = analyzeB({ b2a_result: a, policy: POLICY_B });
  assert(b.status === 'VALID', 'B2-B blocked: ' + JSON.stringify(b.admission.reasons));
  const c = analyzeC({ policy: POLICY_C, snapshot, quality_report: quality,
    b2a_result: a, b2b_result: b, analysis_as_of_ms: asOf, timeframe });
  assert(c.status === 'VALID', 'B2-C blocked: ' + JSON.stringify(c.admission.reasons));
  return { snapshot, quality, a, b, c };
}
function runZones(structure, symbol, timeframe, spanRatio = 0.001, retestRatio = 0.0005) {
  const priceScale = median(structure.snapshot.candles_by_timeframe[timeframe].map(c => c.close));
  const zonePolicy = {
    version: 'b2d-absolute-span-v1', instrument_symbol: symbol, timeframe,
    cluster_method: 'MAX_TOTAL_SPAN_V1', max_cluster_span_price: priceScale * spanRatio,
    min_independent_touches: 2
  };
  const policyD = {
    version: 'b2d-zone-engine-v1', b2c_engine_version: '2.1.0-b2c',
    b2c_policy_version: 'b2c-state-v2', b2b_engine_version: '2.2.0-b2b',
    b2b_policy_version: 'b2b-swing-sequence-v3',
    b2b_same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
    b2a_engine_version: '2.0.0-b2a', b2a_policy_version: 'b2a-causal-swing-v1',
    b1_contract_version: '1.1.0', b1_validator_version: '1.1.0',
    b1_quality_policy_version: QUALITY, finality_safety_lag_ms: LAG,
    price_equality_policy: 'EXACT_PRICE_V1'
  };
  const d = analyzeD({ policy: policyD, zone_policy: zonePolicy,
    snapshot: structure.snapshot, quality_report: structure.quality,
    b2c_result: structure.c, analysis_as_of_ms: structure.snapshot.analysis_as_of_ms,
    timeframe });
  assert(d.status === 'VALID', 'B2-D blocked: ' + JSON.stringify(d.admission.reasons));
  const retestPolicy = {
    version: 'retest-policy-v1', touch_method: 'RANGE_INTERSECTION_V1',
    touch_tolerance_price: priceScale * retestRatio,
    success_buffer_price: priceScale * retestRatio,
    failure_buffer_price: priceScale * retestRatio,
    retest_window_bars: 20, confirmation_window_bars: 3
  };
  const policyE = {
    version: 'b2e-retest-engine-v1', b2b_engine_version: '2.2.0-b2b',
    b2b_policy_version: 'b2b-swing-sequence-v3',
    b2b_same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
    b2c_engine_version: '2.1.0-b2c', b2c_policy_version: 'b2c-state-v2',
    b2d_engine_version: '2.0.0-b2d', b2d_policy_version: 'b2d-zone-engine-v1',
    b2d_zone_policy_version: zonePolicy.version,
    b1_contract_version: '1.1.0', b1_validator_version: '1.1.0',
    b1_quality_policy_version: QUALITY, finality_safety_lag_ms: LAG,
    price_equality_policy: 'EXACT_PRICE_V1', retest_policy: retestPolicy
  };
  const e = analyzeE({ policy: policyE, snapshot: structure.snapshot,
    quality_report: structure.quality, b2c_result: structure.c,
    b2d_result: d, analysis_as_of_ms: structure.snapshot.analysis_as_of_ms, timeframe });
  assert(e.status === 'VALID', 'B2-E blocked: ' + JSON.stringify(e.admission.reasons));
  return { d, e, zonePolicy, retestPolicy };
}
function comparePrefix(full, prefix, cutoff, label) {
  const fullPivots = full.a.pivots.filter(p => p.available_at_ms <= cutoff);
  assert(JSON.stringify(fullPivots) === JSON.stringify(prefix.a.pivots),
    label + ' B2-A prefix invariance failed');
  const fullSequenceHistory = full.b.sequence_history.filter(p => p.available_at_ms <= cutoff);
  assert(JSON.stringify(fullSequenceHistory) === JSON.stringify(prefix.b.sequence_history),
    label + ' B2-B sequence-history prefix invariance failed');
  const fullCSequenceHistory = full.c.sequence_history.filter(p => p.available_at_ms <= cutoff);
  assert(JSON.stringify(fullCSequenceHistory) === JSON.stringify(prefix.c.sequence_history),
    label + ' B2-C sequence-history prefix invariance failed');
  const fullEvents = full.c.events.filter(e => e.available_at_ms <= cutoff);
  const compact = events => events.map(e => ({ id: e.event_id, type: e.event_type,
    source: e.source_pivot_id, available: e.available_at_ms, level: e.level_price }));
  assert(JSON.stringify(compact(fullEvents)) === JSON.stringify(compact(prefix.c.events)),
    label + ' B2-C event prefix invariance failed: ' + JSON.stringify({
      fullCount: fullEvents.length, prefixCount: prefix.c.events.length,
      full: compact(fullEvents).slice(-20), prefix: compact(prefix.c.events).slice(-20)
    }));
}
function windowAt(rows, endIndex, count) {
  const start = Math.max(0, endIndex - count + 1);
  return rows.slice(start, endIndex + 1);
}
function countBy(items, key) {
  const counts = {};
  for (const item of items) counts[item[key]] = (counts[item[key]] || 0) + 1;
  return counts;
}
function eventFollowThrough(events, rows) {
  const indexByOpen = new Map(rows.map((row, index) => [row.open_time_ms, index]));
  const horizons = [5, 10, 20];
  const result = {};
  for (const horizon of horizons) {
    const grouped = new Map();
    const baseline = { BULLISH: [], BEARISH: [] };
    for (let i = 0; i + horizon < rows.length; i++) {
      const entry = rows[i].close;
      const futureClose = rows[i + horizon].close;
      if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(futureClose) || futureClose <= 0) continue;
      baseline.BULLISH.push((futureClose / entry - 1) * 100);
      baseline.BEARISH.push((entry / futureClose - 1) * 100);
    }
    const baselineSummary = Object.fromEntries(Object.entries(baseline).map(([direction, values]) => [direction, {
      n: values.length, median_forward_close_return_pct: median(values),
      favorable_close_pct: values.filter(x => x > 0).length / Math.max(1, values.length) * 100
    }]));
    for (const event of events) {
      const direction = event.direction === 'BULLISH' ? 1 : event.direction === 'BEARISH' ? -1 : 0;
      const index = indexByOpen.get(event.breaking_candle_open_time_ms);
      if (!direction || index === undefined || index + horizon >= rows.length) continue;
      const entry = rows[index].close;
      const future = rows.slice(index + 1, index + horizon + 1);
      if (!future.length || !Number.isFinite(entry) || entry <= 0) continue;
      const maxHigh = Math.max(...future.map(x => x.high));
      const minLow = Math.min(...future.map(x => x.low));
      const finalClose = future[future.length - 1].close;
      const closeReturn = direction > 0
        ? (finalClose / entry - 1) * 100
        : (entry / finalClose - 1) * 100;
      const mfe = direction > 0
        ? (maxHigh / entry - 1) * 100
        : (entry / minLow - 1) * 100;
      const mae = direction > 0
        ? (minLow / entry - 1) * 100
        : (entry / maxHigh - 1) * 100;
      if (!grouped.has(event.event_type)) grouped.set(event.event_type, []);
      grouped.get(event.event_type).push({ closeReturn, mfe, mae, source: event.source_pivot_id });
    }
    const byType = {};
    for (const [type, samples] of grouped) {
      const closes = samples.map(x => x.closeReturn);
      const mfes = samples.map(x => x.mfe);
      const maes = samples.map(x => x.mae);
      const direction = type.startsWith('BULLISH') ? 'BULLISH' : 'BEARISH';
      const base = baselineSummary[direction];
      byType[type] = {
        n: samples.length,
        baseline_median_forward_close_return_pct: base.median_forward_close_return_pct,
        baseline_favorable_close_pct: base.favorable_close_pct,
        excess_median_forward_close_return_pct: median(closes) - base.median_forward_close_return_pct,
        excess_favorable_close_pct: samples.filter(x => x.closeReturn > 0).length / samples.length * 100 - base.favorable_close_pct,
        unique_source_pivots: new Set(samples.map(x => x.source).filter(Boolean)).size,
        median_forward_close_return_pct: median(closes),
        median_mfe_pct: median(mfes),
        median_mae_pct: median(maes),
        favorable_close_pct: samples.filter(x => x.closeReturn > 0).length / samples.length * 100,
        mfe_at_least_0_25_pct: samples.filter(x => x.mfe >= 0.25).length / samples.length * 100,
        mfe_at_least_0_5_pct: samples.filter(x => x.mfe >= 0.5).length / samples.length * 100,
        mfe_at_least_1_pct: samples.filter(x => x.mfe >= 1).length / samples.length * 100
      };
    }
    result[horizon + '_bars'] = { ...byType, baseline_by_direction: baselineSummary };
  }
  return result;
}
function sweepStats(events) {
  const counts = new Map();
  for (const event of events) {
    if (!String(event.event_type).endsWith('_SWEEP') || !event.source_pivot_id) continue;
    const key = event.event_type + ':' + event.source_pivot_id;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const values = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    sweep_events: values.reduce((sum, item) => sum + item[1], 0),
    unique_level_events: values.length,
    repeated_levels: values.filter(item => item[1] > 1).length,
    events_on_repeated_levels: values.filter(item => item[1] > 1).reduce((sum, item) => sum + item[1], 0),
    max_events_per_level: values.length ? values[0][1] : 0,
    top_repeated_levels: values.filter(item => item[1] > 1).slice(0, 10).map(([key, count]) => ({ key, count }))
  };
}
function summarizeZones(result) {
  const statuses = countBy(result.e.lifecycles, 'status');
  return { zones: result.d.zones.length, candidates: result.d.candidate_levels.length,
    breakouts: result.e.lifecycles.length, retest_statuses: statuses };
}

async function main() {
  const datasets = {};
  const output = { dataset_source: 'mestoness/btc-eth-candles-history (Bybit USDT-M perpetual archive)',
    replay_mode: 'synthetic B1-valid wrapper; full B2 engines; no live provider or trading-edge claim',
    symbols: {} };
  for (const symbol of Object.keys(FILES)) {
    datasets[symbol] = {};
    for (const tf of REQUIRED.slice().reverse()) {
      datasets[symbol][tf] = await loadRows(FILES[symbol][tf], tf);
    }
    const byTf = {};
    for (const tf of ['1h', '4h', '1d']) {
      const data = datasets[symbol][tf];
      const rows = data.rows;
      const last = rows[rows.length - 1];
      const asOf = last.close_time_ms + LAG;
      const full = runStructure(rows, symbol, tf, asOf, 'historical:' + symbol + ':' + tf + ':full', 2);
      const strengthSensitivity = [];
      for (const strength of [3, 5]) {
        const result = runStructure(rows, symbol, tf, asOf,
          'historical:' + symbol + ':' + tf + ':strength:' + strength, strength);
        strengthSensitivity.push({ strength, raw_pivots: result.a.pivots.length,
          active_sequence: result.b.sequence.length,
          sequence_history: result.b.sequence_history.length,
          ambiguous_pivots: result.b.diagnostics.ambiguous_dual_pivot_count,
          structure_events: result.c.events.length,
          event_types: countBy(result.c.events, 'event_type'),
          event_follow_through: eventFollowThrough(result.c.events, rows) });
      }
      const prefixChecks = [];
      for (const q of [0.25, 0.5, 0.75]) {
        const index = Math.floor((rows.length - 1) * q);
        const prefixRows = rows.slice(0, index + 1);
        const cutoff = prefixRows[prefixRows.length - 1].close_time_ms + LAG;
        const prefix = runStructure(prefixRows, symbol, tf, cutoff, 'historical:' + symbol + ':' + tf + ':prefix:' + q);
        comparePrefix(full, prefix, cutoff, symbol + ' ' + tf + ' q=' + q);
        prefixChecks.push(q);
      }
      const windowResults = [];
      for (const q of [0.2, 0.4, 0.6, 0.8, 1]) {
        const index = Math.floor((rows.length - 1) * q);
        const slice = windowAt(rows, index, 160);
        const end = slice[slice.length - 1];
        const windowAsOf = end.close_time_ms + LAG;
        const structure = runStructure(slice, symbol, tf, windowAsOf,
          'historical:' + symbol + ':' + tf + ':window:' + q);
        const zones = runZones(structure, symbol, tf, 0.001, 0.0005);
        const parameterGrid = [];
        for (const spanRatio of [0.0005, 0.001, 0.0025, 0.005]) {
          for (const retestRatio of [0.00025, 0.0005, 0.001]) {
            const candidate = runZones(structure, symbol, tf, spanRatio, retestRatio);
            parameterGrid.push({ span_ratio: spanRatio, retest_ratio: retestRatio, ...summarizeZones(candidate) });
          }
        }
        windowResults.push({ quantile: q, end: new Date(end.close_time_ms).toISOString(),
          structure_state: structure.c.structure_state,
          pivot_count: structure.a.pivots.length,
          active_sequence_count: structure.b.sequence.length,
          sequence_history_count: structure.b.sequence_history.length,
          event_count: structure.c.events.length,
          event_types: countBy(structure.c.events, 'event_type'),
          sweep_stats: sweepStats(structure.c.events),
          ambiguous_pivot_count: structure.b.diagnostics.ambiguous_dual_pivot_count,
          ...summarizeZones(zones), parameter_grid: parameterGrid });
      }
      byTf[tf] = {
        integrity: data.integrity,
        full_history: { raw_pivots: full.a.pivots.length,
          active_sequence: full.b.sequence.length,
          ambiguous_dual_pivots: full.b.diagnostics.ambiguous_dual_pivot_count,
          structure_events: full.c.events.length,
          event_types: countBy(full.c.events, 'event_type'),
          event_follow_through: eventFollowThrough(full.c.events, rows),
          sweep_stats: sweepStats(full.c.events),
          structure_state: full.c.structure_state,
          sequence_history: full.b.sequence_history.length,
          prefix_invariance_checks: prefixChecks.length,
          strength_sensitivity: strengthSensitivity },
        '160_candle_windows': windowResults
      };
    }

    // Build a synchronized 1D/4H/1H historical window at the last completed daily boundary.
    const dailyRows = datasets[symbol]['1d'].rows;
    const cutoff = dailyRows[dailyRows.length - 1].close_time_ms + LAG;
    const mtfEntries = {};
    const b2cByTf = {};
    const recent = {};
    for (const tf of REQUIRED) {
      const end = Math.floor((cutoff - LAG) / STEP[tf]) * STEP[tf] - STEP[tf];
      const eligible = datasets[symbol][tf].rows.filter(r => r.open_time_ms <= end && r.close_time_ms + LAG <= cutoff);
      const slice = eligible.slice(-160);
      assert(slice.length === 160, symbol + ' ' + tf + ' MTF window does not contain 160 candles');
      const structure = runStructure(slice, symbol, tf, cutoff, 'mtf:' + symbol + ':' + tf + ':' + cutoff);
      const zones = runZones(structure, symbol, tf);
      const candles = structure.snapshot.candles_by_timeframe[tf];
      mtfEntries[tf] = {
        timeframe: tf, provider_time_ms: cutoff, receive_time_ms: cutoff + 100,
        status: 'VALID', snapshot: structure.snapshot,
        analysis_candles: candles.map(c => ({ ...c })),
        quality_report: structure.quality
      };
      b2cByTf[tf] = structure.c;
      recent[tf] = { structure, zones };
    }
    const mtf = {
      contract_version: '1.0.0', status: 'VALID', directional_allowed: true,
      required_timeframes: REQUIRED.slice(), analysis_as_of_ms: cutoff,
      symbol, market_type: 'linear_perpetual', provider_time_spread_ms: 0,
      max_provider_time_spread_ms: 0, requested_closed_count: 160,
      timeframes: mtfEntries
    };
    const b2f = analyzeF({ policy: POLICY_F, mtf_result: mtf, b2c_by_timeframe: b2cByTf });
    assert(b2f.status === 'VALID', symbol + ' B2-F blocked: ' + JSON.stringify(b2f.admission.reasons));
    const selected = recent['1h'].structure;
    const selectedZones = recent['1h'].zones;
    const b2g = analyzeG({
      policy: POLICY_G, snapshot: selected.snapshot, quality_report: selected.quality,
      b2a_result: selected.a, b2c_result: selected.c,
      b2d_result: selectedZones.d, b2e_result: selectedZones.e,
      b2f_result: b2f, analysis_as_of_ms: cutoff, chart_timeframe: '1h'
    });
    assert(b2g.status === 'VALID', symbol + ' B2-G blocked: ' + JSON.stringify(b2g.admission.reasons));
    output.symbols[symbol] = {
      history: byTf,
      synchronized_mtf_window: {
        cutoff: new Date(cutoff).toISOString(),
        timeframes: Object.fromEntries(REQUIRED.map(tf => [tf, {
          structure_state: recent[tf].structure.c.structure_state,
          events: recent[tf].structure.c.events.length,
          zones: recent[tf].zones.d.zones.length,
          retest_lifecycles: recent[tf].zones.e.lifecycles.length
        }])),
        b2f: { structure_pattern: b2f.structure_pattern, alignment_status: b2f.alignment_status,
          alignment_context: b2f.alignment_context },
        b2g: { swing_markers: b2g.swing_markers.length, ambiguous_pivots: b2g.ambiguous_pivots.length,
          structure_events: b2g.structure_events.length, zones: b2g.zones.length,
          retest_lifecycles: b2g.retest_lifecycles.length }
      }
    };
  }
  const report = JSON.stringify(output, null, 2);
  fs.writeFileSync('b2_historical_replay_report.json', report + '\n');
  console.log(report);
}
main().catch(error => { console.error(error && error.stack ? error.stack : error); process.exitCode = 1; });
