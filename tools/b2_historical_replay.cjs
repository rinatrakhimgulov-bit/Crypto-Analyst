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
const { analyze: analyzeB7 } = require('../src/analysis/b7-explainable-setup-engine.js');

const LAG = 500;
const QUALITY = 'b1-quality-policy-2026-11-27-v1';
const DATASET_REPOSITORY = 'mestoness/btc-eth-candles-history';
const DATASET_COMMIT = '9ca04178df06ce649f00779a49e11094fe5b1c70';
const RAW_BASE = 'https://raw.githubusercontent.com/' + DATASET_REPOSITORY + '/' + DATASET_COMMIT + '/';
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
const POLICY_B7 = {
  version: 'b7-explainable-setups-v1',
  b1_contract_version: '1.1.0',
  b1_validator_version: '1.1.0',
  b1_quality_policy_version: QUALITY,
  b2a_engine_version: '2.0.0-b2a', b2a_policy_version: POLICY_A.version,
  b2b_engine_version: '2.2.0-b2b', b2b_policy_version: POLICY_B.version,
  b2c_engine_version: '2.1.0-b2c', b2c_policy_version: POLICY_C.version,
  b2d_engine_version: '2.0.0-b2d', b2d_policy_version: 'b2d-zone-engine-v1',
  b2e_engine_version: '2.0.0-b2e', b2e_policy_version: 'b2e-retest-engine-v1',
  finality_safety_lag_ms: LAG,
  max_candidates: 20,
  candle_feature_policy: {
    version: 'b7-candle-features-v1',
    rejection_wick_body_ratio: 2,
    max_rejection_body_range_ratio: 0.45,
    bullish_close_location_min: 0.65,
    bearish_close_location_max: 0.35,
    doji_body_range_max: 0.1,
    volume_lookback: 20,
    correction_lookback_bars: 3
  }
};
function runSetups(structure, zones) {
  const { snapshot, quality, a, b, c } = structure;
  const result = analyzeB7({
    policy: POLICY_B7, snapshot, quality_report: quality,
    timeframe: Object.keys(snapshot.candles_by_timeframe)[0],
    analysis_as_of_ms: snapshot.analysis_as_of_ms,
    b2a_result: a, b2b_result: b, b2c_result: c,
    b2d_result: zones.d, b2e_result: zones.e
  });
  assert(result.status === 'VALID', 'B7 blocked: ' + JSON.stringify(result.admission.reasons));
  return result;
}
function compactSetups(result) {
  return result.setup_candidates.map(item => ({
    setup_type: item.setup_type, direction: item.direction, status: item.status,
    available_at_ms: item.available_at_ms, invalidation_level: item.invalidation_level,
    breakout_event_id: item.evidence.breakout_event_id || null,
    lifecycle_id: item.evidence.lifecycle_id || null,
    zone_id: item.evidence.zone_id || item.evidence.historical_zone_id || null
  }));
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
function summarizeZones(result) {
  const statuses = countBy(result.e.lifecycles, 'status');
  return { zones: result.d.zones.length, candidates: result.d.candidate_levels.length,
    breakouts: result.e.lifecycles.length, retest_statuses: statuses };
}

async function main() {
  const datasets = {};
  const output = {
    dataset_source: DATASET_REPOSITORY + ' (Bybit USDT-M perpetual archive)',
    dataset_commit: DATASET_COMMIT,
    replay_mode: 'synthetic B1-valid wrapper; full B2 engines; no live provider or trading-edge claim',
    replay_assumptions: {
      b1_quality: 'synthetic VALID wrapper after structural CSV integrity checks; actual B1 validator is not run',
      candle_finality: 'TIME_DERIVED with fixed 500ms research lag; historical provider finality is not independently observed',
      mtf_provider_time: 'synthetic common cutoff with zero provider-time spread; this does not calibrate live B1 MTF',
      trading_edge: 'not evaluated; no entries, fees, funding, slippage, or trade outcomes are measured',
      b7_replay: 'B7 is evaluated on each 160-candle rolling window and at three historical prefix cutoffs. Each prefix run asserts deterministic output and that every candidate and confirmation is available by that cutoff. This is causal consistency testing, not strategy profitability validation.'
    },
    symbols: {}
  };
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
          event_types: countBy(result.c.events, 'event_type') });
      }
      const lookbackSensitivity = [];
      for (const count of [160, 400, 800, 1600]) {
        if (rows.length < count) continue;
        const slice = windowAt(rows, rows.length - 1, count);
        const windowStart = slice[0].open_time_ms;
        const recentStart = rows[Math.max(0, rows.length - 160)].open_time_ms;
        const structure = runStructure(slice, symbol, tf, asOf,
          'historical:' + symbol + ':' + tf + ':lookback:' + count);
        const zones = runZones(structure, symbol, tf);
        const recentEvents = structure.c.events.filter(event => event.available_at_ms >= recentStart);
        const recentPivots = structure.a.pivots.filter(pivot => pivot.available_at_ms >= recentStart);
        lookbackSensitivity.push({
          lookback_candles: count,
          history_days: Number(((rows[rows.length - 1].close_time_ms - windowStart) / 86400000).toFixed(2)),
          structure_state: structure.c.structure_state,
          matches_full_history_state: structure.c.structure_state === full.c.structure_state,
          pivots_in_recent_160: recentPivots.length,
          structure_events_in_recent_160: recentEvents.length,
          recent_event_types: countBy(recentEvents, 'event_type'),
          zones: zones.d.zones.length,
          retest_statuses: countBy(zones.e.lifecycles, 'status')
        });
      }
      const prefixChecks = [];
      for (const q of [0.25, 0.5, 0.75]) {
        const index = Math.floor((rows.length - 1) * q);
        const prefixRows = rows.slice(0, index + 1);
        const cutoff = prefixRows[prefixRows.length - 1].close_time_ms + LAG;
        const prefix = runStructure(prefixRows, symbol, tf, cutoff, 'historical:' + symbol + ':' + tf + ':prefix:' + q);
        comparePrefix(full, prefix, cutoff, symbol + ' ' + tf + ' q=' + q);
        const prefixZones = runZones(prefix, symbol, tf);
        const prefixSetups = runSetups(prefix, prefixZones);
        const repeatedPrefixSetups = runSetups(prefix, prefixZones);
        assert(JSON.stringify(prefixSetups) === JSON.stringify(repeatedPrefixSetups),
          symbol + ' ' + tf + ' B7 deterministic prefix replay failed at q=' + q);
        for (const candidate of prefixSetups.setup_candidates) {
          assert(candidate.available_at_ms <= cutoff,
            symbol + ' ' + tf + ' B7 candidate available after prefix cutoff at q=' + q);
          const evidence = candidate.evidence || {};
          if (evidence.confirmation) {
            assert(evidence.confirmation.available_at_ms <= cutoff &&
              evidence.confirmation.candle_close_time_ms <= cutoff - LAG,
              symbol + ' ' + tf + ' B7 confirmation leaks beyond prefix cutoff at q=' + q);
          }
          if (evidence.confirmation_candle) {
            assert(evidence.confirmation_candle.close_time_ms + LAG <= cutoff,
              symbol + ' ' + tf + ' B7 trend confirmation leaks beyond prefix cutoff at q=' + q);
          }
        }
        prefixChecks.push({ quantile: q, b2_prefix_invariance: true,
          b7_prefix_replay: 'PASS', candidate_count: prefixSetups.diagnostics.candidate_count,
          confirmed_count: prefixSetups.diagnostics.confirmed_count,
          pending_count: prefixSetups.diagnostics.pending_count,
          all_evidence_causal_at_cutoff: true, deterministic_repeat: true });
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
        const setups = runSetups(structure, zones);
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
          ambiguous_pivot_count: structure.b.diagnostics.ambiguous_dual_pivot_count,
          ...summarizeZones(zones),
          b7: {
            status: setups.status, summary: setups.summary,
            candidate_count: setups.diagnostics.candidate_count,
            confirmed_count: setups.diagnostics.confirmed_count,
            pending_count: setups.diagnostics.pending_count,
            setup_types: countBy(setups.setup_candidates, 'setup_type'),
            directions: countBy(setups.setup_candidates, 'direction'),
            candidates: compactSetups(setups)
          },
          parameter_grid: parameterGrid });
      }
      byTf[tf] = {
        integrity: data.integrity,
        full_history: { raw_pivots: full.a.pivots.length,
          active_sequence: full.b.sequence.length,
          ambiguous_dual_pivots: full.b.diagnostics.ambiguous_dual_pivot_count,
          structure_events: full.c.events.length,
          event_types: countBy(full.c.events, 'event_type'),
          structure_state: full.c.structure_state,
          sequence_history: full.b.sequence_history.length,
          prefix_invariance_checks: prefixChecks.length,
          strength_sensitivity: strengthSensitivity,
          lookback_sensitivity: lookbackSensitivity },
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
