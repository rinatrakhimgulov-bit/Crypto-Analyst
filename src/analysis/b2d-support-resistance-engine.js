(function attachB2DSupportResistanceEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B2DSupportResistanceEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createB2DSupportResistanceEngine() {
  'use strict';

  const ENGINE_VERSION = '2.0.0-b2d';
  const REQUIRED_B2C_ENGINE_VERSION = '2.1.0-b2c';
  const REQUIRED_B2B_ENGINE_VERSION = '2.2.0-b2b';
  const REQUIRED_B2A_ENGINE_VERSION = '2.0.0-b2a';
  const TIMEFRAME_MS = Object.freeze({ '1h': 3600000, '4h': 14400000, '1d': 86400000 });
  const CLOSED_STATES = new Set(['CONFIRMED', 'TIME_DERIVED']);

  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) freezeDeep(value[key]);
    return value;
  }
  function isObject(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
  function blocked(status, code, meta = {}) {
    return freezeDeep({
      engine_version: ENGINE_VERSION, policy_version: meta.policyVersion || null, status,
      admission: { status: 'BLOCKED', reasons: [{ code, severity: 'CRITICAL' }] },
      snapshot_id: meta.snapshotId || null, symbol: meta.symbol || null,
      timeframe: meta.timeframe || null, analysis_as_of_ms: meta.analysisAsOfMs ?? null,
      zones: [], candidate_levels: [],
      diagnostics: { raw_pivot_count: 0, zone_count: 0, candidate_cluster_count: 0 }
    });
  }
  function validatePolicy(policy, zonePolicy, symbol, timeframe) {
    if (!isObject(policy) || typeof policy.version !== 'string' || !policy.version.trim()) return 'B2D_POLICY_INVALID';
    if (policy.b2c_engine_version !== REQUIRED_B2C_ENGINE_VERSION ||
        typeof policy.b2c_policy_version !== 'string' || !policy.b2c_policy_version.trim() ||
        policy.b2b_engine_version !== REQUIRED_B2B_ENGINE_VERSION ||
        typeof policy.b2b_policy_version !== 'string' || !policy.b2b_policy_version.trim() ||
        policy.b2a_engine_version !== REQUIRED_B2A_ENGINE_VERSION ||
        typeof policy.b2a_policy_version !== 'string' || !policy.b2a_policy_version.trim() ||
        typeof policy.b1_contract_version !== 'string' || !policy.b1_contract_version.trim() ||
        typeof policy.b1_validator_version !== 'string' || !policy.b1_validator_version.trim() ||
        typeof policy.b1_quality_policy_version !== 'string' || !policy.b1_quality_policy_version.trim() ||
        !Number.isSafeInteger(policy.finality_safety_lag_ms) || policy.finality_safety_lag_ms < 0 ||
        policy.price_equality_policy !== 'EXACT_PRICE_V1' ||
        policy.b2b_same_candle_dual_pivot_policy !== 'EXCLUDE_BOTH_FROM_SEQUENCE_V1') return 'B2D_UPSTREAM_POLICY_BINDING_INVALID';
    const absoluteSpanPolicy = isObject(zonePolicy) &&
      zonePolicy.cluster_method === 'MAX_TOTAL_SPAN_V1' &&
      Number.isFinite(zonePolicy.max_cluster_span_price) && zonePolicy.max_cluster_span_price > 0;
    const relativeSpanPolicy = isObject(zonePolicy) &&
      zonePolicy.cluster_method === 'MAX_TOTAL_SPAN_RELATIVE_V2' &&
      Number.isFinite(zonePolicy.max_cluster_span_ratio) &&
      zonePolicy.max_cluster_span_ratio > 0 && zonePolicy.max_cluster_span_ratio <= 0.05;
    if (!isObject(zonePolicy) || typeof zonePolicy.version !== 'string' || !zonePolicy.version.trim() ||
        zonePolicy.instrument_symbol !== symbol || zonePolicy.timeframe !== timeframe ||
        !(absoluteSpanPolicy || relativeSpanPolicy) ||
        !Number.isSafeInteger(zonePolicy.min_independent_touches) ||
        zonePolicy.min_independent_touches < 2 || zonePolicy.min_independent_touches > 20) {
      return 'ZONE_POLICY_INVALID_OR_UNSCOPED';
    }
    return null;
  }
  function validateCandle(candle, snapshot, timeframe, stepMs, asOf, lagMs) {
    if (!isObject(candle) || !Number.isSafeInteger(candle.open_time_ms) || !Number.isSafeInteger(candle.close_time_ms)) return 'CANDLE_TIME_INVALID';
    if (candle.close_time_ms - candle.open_time_ms !== stepMs || candle.open_time_ms % stepMs !== 0) return 'CANDLE_ALIGNMENT_INVALID';
    if (candle.close_time_ms + lagMs > asOf || !CLOSED_STATES.has(candle.closed_state)) return 'CANDLE_NOT_FINAL_CLOSED';
    if (candle.canonical_symbol !== snapshot.canonical_symbol || candle.market_type !== snapshot.market_type || candle.timeframe !== timeframe) return 'CANDLE_PROVENANCE_MISMATCH';
    if (['open', 'high', 'low', 'close'].some(k => !Number.isFinite(candle[k]) || candle[k] <= 0) ||
        candle.high < Math.max(candle.open, candle.close, candle.low) ||
        candle.low > Math.min(candle.open, candle.close, candle.high) || candle.high < candle.low) return 'CANDLE_OHLC_INVALID';
    return null;
  }
  function validatePivot(pivot, ids, asOf, equalityPolicy) {
    if (!isObject(pivot) || typeof pivot.pivot_id !== 'string' || !pivot.pivot_id.trim() || ids.has(pivot.pivot_id)) return 'PIVOT_ID_INVALID';
    if (!['ACCEPTED', 'SUPERSEDED_FOR_SEQUENCE', 'AMBIGUOUS_FOR_SEQUENCE'].includes(pivot.sequence_status) ||
        (pivot.sequence_status === 'AMBIGUOUS_FOR_SEQUENCE' && pivot.exclusion_reason !== 'SIMULTANEOUS_HIGH_LOW_SAME_SOURCE_CANDLE') ||
        (pivot.sequence_status !== 'AMBIGUOUS_FOR_SEQUENCE' && pivot.exclusion_reason != null)) return 'PIVOT_SEQUENCE_STATUS_INVALID';
    if (!['SWING_HIGH', 'SWING_LOW'].includes(pivot.type) || !Number.isFinite(pivot.price) || pivot.price <= 0) return 'PIVOT_VALUE_INVALID';
    for (const key of ['source_time_ms', 'confirmed_at_ms', 'available_at_ms']) {
      if (!Number.isSafeInteger(pivot[key]) || pivot[key] <= 0) return 'PIVOT_TIME_INVALID';
    }
    if (pivot.source_time_ms > pivot.confirmed_at_ms || pivot.confirmed_at_ms > pivot.available_at_ms ||
        pivot.available_at_ms > asOf) return 'PIVOT_CAUSAL_TIME_INVALID';
    if (!isObject(pivot.confirmation) || pivot.confirmation.equality_policy !== equalityPolicy) return 'PIVOT_POLICY_MISMATCH';
    ids.add(pivot.pivot_id);
    return null;
  }
  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  function buildClusters(pivots, role, maxSpan, minTouches, asOf) {
    const sorted = [...pivots].sort((a, b) =>
      a.price - b.price || a.source_time_ms - b.source_time_ms || a.pivot_id.localeCompare(b.pivot_id));
    const clusters = [];
    let current = [];
    let minPrice = null;
    for (const pivot of sorted) {
      if (!current.length) {
        current = [pivot];
        minPrice = pivot.price;
      } else if (pivot.price - minPrice <= maxSpan) {
        current.push(pivot);
      } else {
        clusters.push(current);
        current = [pivot];
        minPrice = pivot.price;
      }
    }
    if (current.length) clusters.push(current);

    const zones = [];
    const candidates = [];
    for (const cluster of clusters) {
      const prices = cluster.map(p => p.price);
      const sourceTimes = cluster.map(p => p.source_time_ms);
      const availableTimes = cluster.map(p => p.available_at_ms);
      const pivotIds = cluster.map(p => p.pivot_id).sort();
      const touches = [...cluster].sort((a, b) =>
        a.source_time_ms - b.source_time_ms || a.pivot_id.localeCompare(b.pivot_id))
        .map(p => ({
          pivot_id: p.pivot_id,
          price: p.price,
          source_time_ms: p.source_time_ms,
          confirmed_at_ms: p.confirmed_at_ms,
          available_at_ms: p.available_at_ms,
          sequence_status: p.sequence_status
        }));
      const base = {
        role,
        lower_bound: Math.min(...prices),
        upper_bound: Math.max(...prices),
        representative_price: median(prices),
        cluster_span_price: Math.max(...prices) - Math.min(...prices),
        touch_count: new Set(sourceTimes).size,
        first_touch_time_ms: Math.min(...sourceTimes),
        last_touch_time_ms: Math.max(...sourceTimes),
        last_touch_age_ms: asOf - Math.max(...sourceTimes),
        available_at_ms: Math.max(...availableTimes),
        pivot_ids: pivotIds,
        touches
      };
      if (base.touch_count >= minTouches) {
        zones.push({
          zone_id: ['B2D', role, pivotIds[0], pivotIds[pivotIds.length - 1]].join(':'),
          ...base,
          evidence_status: 'CONFIRMED_CLUSTER',
        freshness_status: 'NOT_CLASSIFIED'
        });
      } else {
        candidates.push({
          candidate_id: ['B2D-CANDIDATE', role, pivotIds[0]].join(':'),
          ...base,
          evidence_status: 'INSUFFICIENT_INDEPENDENT_TOUCHES',
          required_touch_count: minTouches,
          freshness_status: 'NOT_CLASSIFIED'
        });
      }
    }
    return { zones, candidates };
  }

  function analyze(input) {
    const policy = input && input.policy;
    const zonePolicy = input && input.zone_policy;
    const snapshot = input && input.snapshot;
    const report = input && input.quality_report;
    const source = input && input.b2c_result;
    const asOf = input && input.analysis_as_of_ms;
    const meta = {
      policyVersion: policy && policy.version,
      snapshotId: snapshot && snapshot.snapshot_id,
      symbol: snapshot && snapshot.canonical_symbol,
      timeframe: input && input.timeframe,
      analysisAsOfMs: asOf
    };
    if (!isObject(snapshot) || !isObject(report) || !isObject(source)) return blocked('INVALID', 'B2D_INPUT_MISSING', meta);
    if (!Number.isSafeInteger(asOf) || asOf <= 0 || snapshot.analysis_as_of_ms !== asOf ||
        snapshot.provider_server_time_ms !== asOf || !isObject(snapshot.provider_metadata) ||
        snapshot.provider_metadata.time_source !== 'provider') return blocked('INVALID', 'B1_ANALYSIS_CUTOFF_INVALID', meta);
    if (typeof snapshot.snapshot_id !== 'string' || !snapshot.snapshot_id ||
        snapshot.contract_version !== (policy && policy.b1_contract_version) ||
        typeof snapshot.canonical_symbol !== 'string' || !snapshot.canonical_symbol ||
        typeof snapshot.market_type !== 'string' || !snapshot.market_type) return blocked('INVALID', 'B1_SNAPSHOT_IDENTITY_INVALID', meta);

    const keys = Object.keys(snapshot.candles_by_timeframe || {});
    const timeframe = keys.length === 1 ? keys[0] : null;
    const stepMs = TIMEFRAME_MS[timeframe];
    meta.timeframe = timeframe;
    if (!stepMs || (input.timeframe && input.timeframe !== timeframe)) return blocked('INVALID', 'B2D_TIMEFRAME_SCOPE_INVALID', meta);
    const policyError = validatePolicy(policy, zonePolicy, snapshot.canonical_symbol, timeframe);
    if (policyError) return blocked('INVALID', policyError, meta);

    if (report.snapshot_id !== snapshot.snapshot_id || report.symbol !== snapshot.canonical_symbol ||
        report.timeframe !== timeframe || report.analysis_as_of_ms !== asOf ||
        report.validator_version !== policy.b1_validator_version ||
        report.policy_version !== policy.b1_quality_policy_version ||
        !Number.isSafeInteger(report.checked_at_ms) || report.checked_at_ms < 0) {
      return blocked('INVALID', 'B1_QUALITY_REPORT_IDENTITY_MISMATCH', meta);
    }
    if (report.status !== 'VALID') return blocked('BLOCKED', 'B1_QUALITY_STATUS_NOT_VALID', meta);

    if (source.status !== 'VALID' || source.engine_version !== policy.b2c_engine_version ||
        source.policy_version !== policy.b2c_policy_version ||
        source.snapshot_id !== snapshot.snapshot_id || source.symbol !== snapshot.canonical_symbol ||
        source.timeframe !== timeframe || source.analysis_as_of_ms !== asOf ||
        !isObject(source.admission) || source.admission.status !== 'ADMITTED' ||
        source.admission.snapshot_id !== snapshot.snapshot_id ||
        source.admission.b1_validator_version !== policy.b1_validator_version ||
        source.admission.b1_quality_policy_version !== policy.b1_quality_policy_version ||
        source.admission.b2b_engine_version !== policy.b2b_engine_version ||
        source.admission.b2b_policy_version !== policy.b2b_policy_version ||
        source.admission.b2b_same_candle_dual_pivot_policy !== policy.b2b_same_candle_dual_pivot_policy) {
      return blocked('INVALID', 'B2C_ADMISSION_IDENTITY_MISMATCH', meta);
    }

    const closedMap = snapshot.candles_by_timeframe;
    const formingMap = snapshot.forming_candle_by_timeframe;
    const unknownMap = snapshot.unclassified_candles_by_timeframe;
    if (!isObject(closedMap) || !Array.isArray(closedMap[timeframe]) ||
        !isObject(formingMap) || !Object.prototype.hasOwnProperty.call(formingMap, timeframe) ||
        !isObject(unknownMap) || !Array.isArray(unknownMap[timeframe])) return blocked('INVALID', 'B1_CANDLE_COLLECTION_INVALID', meta);
    const candles = closedMap[timeframe];
    if (report.closed_count !== candles.length || report.valid_count < candles.length || report.insufficient_history === true) {
      return blocked('INVALID', 'B1_QUALITY_CANDLE_COUNT_MISMATCH', meta);
    }
    const seenTimes = new Set();
    for (let i = 0; i < candles.length; i++) {
      const error = validateCandle(candles[i], snapshot, timeframe, stepMs, asOf, policy.finality_safety_lag_ms);
      if (error) return blocked('INVALID', error, meta);
      if (seenTimes.has(candles[i].open_time_ms) ||
          (i > 0 && candles[i].open_time_ms - candles[i - 1].open_time_ms !== stepMs)) {
        return blocked('INVALID', 'B1_CANDLE_ORDER_OR_GAP_INVALID', meta);
      }
      seenTimes.add(candles[i].open_time_ms);
    }
    const excluded = [formingMap[timeframe], ...unknownMap[timeframe]].filter(Boolean);
    for (const candle of excluded) if (!isObject(candle) || seenTimes.has(candle.open_time_ms)) {
      return blocked('INVALID', 'B1_FORMING_OR_UNKNOWN_OVERLAP', meta);
    }

    if (!Array.isArray(source.raw_pivots)) return blocked('INVALID', 'B2C_RAW_PIVOT_COLLECTION_INVALID', meta);
    const byOpen = new Map(candles.map(c => [c.open_time_ms, c]));
    const byClose = new Map(candles.map(c => [c.close_time_ms, c]));
    const ids = new Set();
    let previousAvailable = -1;
    const eligible = [];
    for (const pivot of source.raw_pivots) {
      const error = validatePivot(pivot, ids, asOf, policy.price_equality_policy);
      if (error) return blocked('INVALID', error, meta);
      if (pivot.available_at_ms < previousAvailable) return blocked('INVALID', 'B2C_PIVOT_ORDER_INVALID', meta);
      previousAvailable = pivot.available_at_ms;
      const sourceCandle = byOpen.get(pivot.source_time_ms);
      const confirmationCandle = byClose.get(pivot.confirmed_at_ms);
      const expectedPrice = sourceCandle && (pivot.type === 'SWING_HIGH' ? sourceCandle.high : sourceCandle.low);
      if (!sourceCandle || !confirmationCandle || expectedPrice !== pivot.price ||
          pivot.available_at_ms !== pivot.confirmed_at_ms + policy.finality_safety_lag_ms) {
        return blocked('INVALID', 'B2C_PIVOT_PROVENANCE_MISMATCH', meta);
      }
      if (pivot.available_at_ms <= asOf) eligible.push(pivot);
    }

    for (const type of ['SWING_LOW', 'SWING_HIGH']) {
      const sourceTimes = new Set();
      for (const pivot of eligible.filter(p => p.type === type)) {
        if (sourceTimes.has(pivot.source_time_ms)) {
          return blocked('INVALID', 'DUPLICATE_PIVOT_TOUCH_SOURCE_TIME', meta);
        }
        sourceTimes.add(pivot.source_time_ms);
      }
    }

    const zoneSpanBasisPrice = candles[candles.length - 1].close;
    const maxClusterSpanPrice = zonePolicy.cluster_method === 'MAX_TOTAL_SPAN_RELATIVE_V2'
      ? zoneSpanBasisPrice * zonePolicy.max_cluster_span_ratio
      : zonePolicy.max_cluster_span_price;
    const support = buildClusters(eligible.filter(p => p.type === 'SWING_LOW'), 'SUPPORT',
      maxClusterSpanPrice, zonePolicy.min_independent_touches, asOf);
    const resistance = buildClusters(eligible.filter(p => p.type === 'SWING_HIGH'), 'RESISTANCE',
      maxClusterSpanPrice, zonePolicy.min_independent_touches, asOf);
    const zones = [...support.zones, ...resistance.zones].sort((a, b) =>
      a.role.localeCompare(b.role) || a.lower_bound - b.lower_bound || a.zone_id.localeCompare(b.zone_id));
    const candidates = [...support.candidates, ...resistance.candidates].sort((a, b) =>
      a.role.localeCompare(b.role) || a.lower_bound - b.lower_bound || a.candidate_id.localeCompare(b.candidate_id));

    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: policy.version,
      zone_policy_version: zonePolicy.version,
      status: 'VALID',
      admission: {
        status: 'ADMITTED',
        snapshot_id: snapshot.snapshot_id,
        b2c_engine_version: source.engine_version,
        b2c_policy_version: source.policy_version,
        b1_validator_version: report.validator_version,
        b1_quality_policy_version: report.policy_version
      },
      snapshot_id: snapshot.snapshot_id,
      symbol: snapshot.canonical_symbol,
      timeframe,
      analysis_as_of_ms: asOf,
      cluster_method: zonePolicy.cluster_method,
      max_cluster_span_price: maxClusterSpanPrice,
      max_cluster_span_ratio: zonePolicy.cluster_method === 'MAX_TOTAL_SPAN_RELATIVE_V2' ? zonePolicy.max_cluster_span_ratio : null,
      zone_span_basis_price: zoneSpanBasisPrice,
      min_independent_touches: zonePolicy.min_independent_touches,
      zone_identity_scope: 'MEMBERSHIP_DERIVED_V1',
      freshness_policy: 'NOT_CLASSIFIED_V1',
      touch_evidence_basis: 'ALL_CONFIRMED_RAW_PIVOTS_V1',
      zones,
      candidate_levels: candidates,
      diagnostics: {
        raw_pivot_count: source.raw_pivots.length,
        eligible_pivot_count: eligible.length,
        support_zone_count: support.zones.length,
        resistance_zone_count: resistance.zones.length,
        candidate_cluster_count: candidates.length,
        support_pivot_count: eligible.filter(p => p.type === 'SWING_LOW').length,
        resistance_pivot_count: eligible.filter(p => p.type === 'SWING_HIGH').length
      }
    });
  }

  return Object.freeze({ ENGINE_VERSION, REQUIRED_B2C_ENGINE_VERSION, analyze });
});
