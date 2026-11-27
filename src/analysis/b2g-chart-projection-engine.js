(function attachB2GChartProjectionEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B2GChartProjectionEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createB2GChartProjectionEngine() {
  'use strict';

  const ENGINE_VERSION = '2.0.0-b2g';
  const STEP = Object.freeze({ '1h': 3600000, '4h': 14400000, '1d': 86400000 });

  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) freezeDeep(value[key]);
    return value;
  }
  function isObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }
  function blocked(code, meta = {}) {
    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: meta.policyVersion || null,
      status: 'BLOCKED',
      admission: { status: 'BLOCKED', reasons: [{ code, severity: 'CRITICAL' }] },
      symbol: meta.symbol || null,
      timeframe: meta.timeframe || null,
      snapshot_id: meta.snapshotId || null,
      analysis_as_of_ms: meta.analysisAsOfMs ?? null,
      swing_markers: [],
      superseded_pivots: [],
      ambiguous_pivots: [],
      structure_events: [],
      zones: [],
      candidate_levels: [],
      retest_lifecycles: [],
      mtf_context: null
    });
  }
  function policyError(policy) {
    if (!isObject(policy) || typeof policy.version !== 'string' || !policy.version.trim()) return 'B2G_POLICY_INVALID';
    const required = {
      b1_contract_version: '1.1.0',
      b1_validator_version: '1.1.0',
      b2a_engine_version: '2.0.0-b2a',
      b2a_policy_version: 'b2a-causal-swing-v1',
      b2b_engine_version: '2.1.0-b2b',
      b2b_policy_version: 'b2b-swing-sequence-v2',
      b2b_same_candle_dual_pivot_policy: 'EXCLUDE_BOTH_FROM_SEQUENCE_V1',
      b2c_engine_version: '2.0.0-b2c',
      b2c_policy_version: 'b2c-state-v1',
      b2d_engine_version: '2.0.0-b2d',
      b2d_policy_version: 'b2d-zone-engine-v1',
      b2d_zone_policy_version: 'b2d-absolute-span-v1',
      b2e_engine_version: '2.0.0-b2e',
      b2e_policy_version: 'b2e-retest-engine-v1',
      b2e_retest_policy_version: 'retest-policy-v1',
      b2f_engine_version: '2.0.0-b2f',
      b2f_policy_version: 'b2f-mtf-confluence-v1'
    };
    for (const [key, expected] of Object.entries(required)) {
      if (policy[key] !== expected) return 'B2G_UPSTREAM_VERSION_BINDING_INVALID';
    }
    if (typeof policy.b1_quality_policy_version !== 'string' || !policy.b1_quality_policy_version.trim() ||
        !Number.isSafeInteger(policy.finality_safety_lag_ms) || policy.finality_safety_lag_ms < 0) {
      return 'B2G_B1_POLICY_INVALID';
    }
    return null;
  }
  function samePivot(a, b) {
    return a.pivot_id === b.pivot_id && a.type === b.type && a.price === b.price &&
      a.source_time_ms === b.source_time_ms && a.confirmed_at_ms === b.confirmed_at_ms &&
      a.available_at_ms === b.available_at_ms;
  }
  function sortByTimeAndId(items, timeKey, idKey) {
    return items.slice().sort((a, b) => a[timeKey] - b[timeKey] || String(a[idKey]).localeCompare(String(b[idKey])));
  }
  function lifecycleVisibleAt(item, step, lag) {
    if (item.confirmation) return item.confirmation.available_at_ms;
    if (item.status === 'RETEST_UNRESOLVED') {
      return item.touch.candle_close_time_ms + item.confirmation_window_bars * step + lag;
    }
    if (item.touch) return item.touch.candle_close_time_ms + lag;
    if (item.status === 'RETEST_EXPIRED') return item.breakout_candle_close_time_ms + item.retest_window_bars * step + lag;
    return item.breakout_available_at_ms;
  }

  function analyze(input) {
    const policy = input && input.policy;
    const timeframe = input && input.chart_timeframe;
    const snapshot = input && input.snapshot;
    const report = input && input.quality_report;
    const b2a = input && input.b2a_result;
    const b2c = input && input.b2c_result;
    const b2d = input && input.b2d_result;
    const b2e = input && input.b2e_result;
    const b2f = input && input.b2f_result;
    const meta = {
      policyVersion: policy && policy.version,
      symbol: snapshot && snapshot.canonical_symbol,
      timeframe,
      snapshotId: snapshot && snapshot.snapshot_id,
      analysisAsOfMs: snapshot && snapshot.analysis_as_of_ms
    };
    if (!['1h', '4h', '1d'].includes(timeframe) || !isObject(snapshot) || !isObject(report) ||
        !isObject(b2a) || !isObject(b2c) || !isObject(b2d) || !isObject(b2e) || !isObject(b2f)) {
      return blocked('B2G_INPUT_MISSING_OR_INVALID', meta);
    }
    const error = policyError(policy);
    if (error) return blocked(error, meta);
    const asOf = snapshot.analysis_as_of_ms;
    const symbol = snapshot.canonical_symbol;
    const step = STEP[timeframe];
    if (snapshot.contract_version !== policy.b1_contract_version ||
        typeof snapshot.snapshot_id !== 'string' || !snapshot.snapshot_id ||
        typeof symbol !== 'string' || !symbol ||
        !Number.isSafeInteger(asOf) || asOf <= 0 ||
        snapshot.provider_server_time_ms !== asOf ||
        !isObject(snapshot.candles_by_timeframe) ||
        !Array.isArray(snapshot.candles_by_timeframe[timeframe]) || snapshot.candles_by_timeframe[timeframe].length < 1 ||
        typeof snapshot.market_type !== 'string' || !snapshot.market_type ||
        !isObject(snapshot.forming_candle_by_timeframe) ||
        !Object.prototype.hasOwnProperty.call(snapshot.forming_candle_by_timeframe, timeframe) ||
        !isObject(snapshot.unclassified_candles_by_timeframe) ||
        !Array.isArray(snapshot.unclassified_candles_by_timeframe[timeframe])) {
      return blocked('B1_SNAPSHOT_INVALID', meta);
    }
    if (report.status !== 'VALID' || report.snapshot_id !== snapshot.snapshot_id ||
        report.symbol !== symbol || report.timeframe !== timeframe ||
        report.analysis_as_of_ms !== asOf ||
        report.validator_version !== policy.b1_validator_version ||
        report.policy_version !== policy.b1_quality_policy_version ||
        report.closed_count !== snapshot.candles_by_timeframe[timeframe].length ||
        !Number.isSafeInteger(report.valid_count) || report.valid_count < report.closed_count ||
        report.insufficient_history === true) {
      return blocked('B1_QUALITY_REPORT_MISMATCH', meta);
    }
    const baseIdentity = (result, engineVersion, policyVersion) =>
      result.status === 'VALID' && result.engine_version === engineVersion &&
      result.policy_version === policyVersion && result.snapshot_id === snapshot.snapshot_id &&
      result.symbol === symbol && result.timeframe === timeframe &&
      result.analysis_as_of_ms === asOf;
    if (!baseIdentity(b2a, policy.b2a_engine_version, policy.b2a_policy_version) ||
        !isObject(b2a.admission) || b2a.admission.status !== 'ADMITTED' ||
        b2a.admission.snapshot_id !== snapshot.snapshot_id ||
        !isObject(b2a.admission.quality_report) ||
        b2a.admission.quality_report.snapshot_id !== snapshot.snapshot_id ||
        b2a.admission.quality_report.validator_version !== policy.b1_validator_version ||
        b2a.admission.quality_report.policy_version !== policy.b1_quality_policy_version ||
        !Array.isArray(b2a.pivots)) return blocked('B2A_RESULT_MISMATCH', meta);
    if (!baseIdentity(b2c, policy.b2c_engine_version, policy.b2c_policy_version) ||
        !isObject(b2c.admission) || b2c.admission.status !== 'ADMITTED' ||
        b2c.admission.snapshot_id !== snapshot.snapshot_id ||
        b2c.admission.b2b_engine_version !== policy.b2b_engine_version ||
        b2c.admission.b2b_policy_version !== policy.b2b_policy_version ||
        b2c.admission.b2b_same_candle_dual_pivot_policy !== policy.b2b_same_candle_dual_pivot_policy ||
        b2c.admission.b1_validator_version !== policy.b1_validator_version ||
        b2c.admission.b1_quality_policy_version !== policy.b1_quality_policy_version ||
        !Array.isArray(b2c.raw_pivots) || !Array.isArray(b2c.pivots) ||
        !Array.isArray(b2c.events)) return blocked('B2C_RESULT_MISMATCH', meta);
    if (!baseIdentity(b2d, policy.b2d_engine_version, policy.b2d_policy_version) ||
        b2d.zone_policy_version !== policy.b2d_zone_policy_version ||
        !isObject(b2d.admission) || b2d.admission.status !== 'ADMITTED' ||
        b2d.admission.snapshot_id !== snapshot.snapshot_id ||
        b2d.admission.b2c_engine_version !== policy.b2c_engine_version ||
        b2d.admission.b2c_policy_version !== policy.b2c_policy_version ||
        b2d.admission.b1_validator_version !== policy.b1_validator_version ||
        b2d.admission.b1_quality_policy_version !== policy.b1_quality_policy_version ||
        !Array.isArray(b2d.zones) || !Array.isArray(b2d.candidate_levels)) {
      return blocked('B2D_RESULT_MISMATCH', meta);
    }
    if (!baseIdentity(b2e, policy.b2e_engine_version, policy.b2e_policy_version) ||
        b2e.retest_policy_version !== policy.b2e_retest_policy_version ||
        !isObject(b2e.admission) || b2e.admission.status !== 'ADMITTED' ||
        b2e.admission.snapshot_id !== snapshot.snapshot_id ||
        b2e.admission.b2c_engine_version !== policy.b2c_engine_version ||
        b2e.admission.b2c_policy_version !== policy.b2c_policy_version ||
        b2e.admission.b2d_engine_version !== policy.b2d_engine_version ||
        b2e.admission.b2d_policy_version !== policy.b2d_policy_version ||
        b2e.admission.b2d_zone_policy_version !== policy.b2d_zone_policy_version ||
        b2e.admission.b1_validator_version !== policy.b1_validator_version ||
        b2e.admission.b1_quality_policy_version !== policy.b1_quality_policy_version ||
        !Array.isArray(b2e.lifecycles)) return blocked('B2E_RESULT_MISMATCH', meta);
    if (b2f.status !== 'VALID' || b2f.engine_version !== policy.b2f_engine_version ||
        b2f.policy_version !== policy.b2f_policy_version ||
        b2f.symbol !== symbol || b2f.analysis_as_of_ms !== asOf ||
        !isObject(b2f.admission) || b2f.admission.status !== 'ADMITTED' ||
        b2f.admission.b1_contract_version !== policy.b1_contract_version ||
        b2f.admission.b1_validator_version !== policy.b1_validator_version ||
        b2f.admission.b1_quality_policy_version !== policy.b1_quality_policy_version ||
        b2f.admission.b2c_engine_version !== policy.b2c_engine_version ||
        b2f.admission.b2c_policy_version !== policy.b2c_policy_version ||
        b2f.market_type !== snapshot.market_type ||
        !isObject(b2f.admission.snapshot_ids) ||
        b2f.admission.snapshot_ids[timeframe] !== snapshot.snapshot_id ||
        !isObject(b2f.timeframes) || !isObject(b2f.timeframes[timeframe]) ||
        b2f.timeframes[timeframe].snapshot_id !== snapshot.snapshot_id ||
        b2f.timeframes[timeframe].structure_state !== b2c.structure_state) {
      return blocked('B2F_RESULT_MISMATCH', meta);
    }

    const b2aById = new Map();
    for (const pivot of b2a.pivots) {
      if (!isObject(pivot) || typeof pivot.pivot_id !== 'string' || !pivot.pivot_id || b2aById.has(pivot.pivot_id) ||
          !['SWING_HIGH', 'SWING_LOW'].includes(pivot.type) || !Number.isFinite(pivot.price) ||
          !Number.isSafeInteger(pivot.source_time_ms) || pivot.source_time_ms <= 0 || pivot.source_time_ms % step !== 0 ||
          !Number.isSafeInteger(pivot.confirmed_at_ms) || pivot.confirmed_at_ms <= 0 || pivot.confirmed_at_ms % step !== 0 ||
          !Number.isSafeInteger(pivot.available_at_ms) ||
          pivot.available_at_ms !== pivot.confirmed_at_ms + policy.finality_safety_lag_ms ||
          pivot.available_at_ms > asOf) return blocked('B2A_PIVOT_EVIDENCE_INVALID', meta);
      b2aById.set(pivot.pivot_id, pivot);
    }
    if (b2c.raw_pivots.length !== b2a.pivots.length) return blocked('B2C_RAW_PIVOT_SET_MISMATCH', meta);
    const rawIds = new Set();
    for (const pivot of b2c.raw_pivots) {
      const original = pivot && b2aById.get(pivot.pivot_id);
      if (!original || rawIds.has(pivot.pivot_id) || !samePivot(original, pivot) ||
          !['ACCEPTED', 'SUPERSEDED_FOR_SEQUENCE', 'AMBIGUOUS_FOR_SEQUENCE'].includes(pivot.sequence_status) ||
          (pivot.sequence_status === 'AMBIGUOUS_FOR_SEQUENCE' && pivot.exclusion_reason !== 'SIMULTANEOUS_HIGH_LOW_SAME_SOURCE_CANDLE') ||
          pivot.available_at_ms > asOf) return blocked('B2C_RAW_PIVOT_SET_MISMATCH', meta);
      rawIds.add(pivot.pivot_id);
    }

    const activeIds = new Set();
    const swingMarkers = [];
    for (const pivot of b2c.pivots) {
      if (!isObject(pivot) || typeof pivot.pivot_id !== 'string' || !pivot.pivot_id ||
          activeIds.has(pivot.pivot_id) || !rawIds.has(pivot.pivot_id) ||
          !Number.isFinite(pivot.price) || !Number.isSafeInteger(pivot.source_time_ms) ||
          !Number.isSafeInteger(pivot.confirmed_at_ms) || !Number.isSafeInteger(pivot.available_at_ms) ||
          pivot.available_at_ms !== pivot.confirmed_at_ms + policy.finality_safety_lag_ms ||
          pivot.available_at_ms > asOf || !['INITIAL_HIGH', 'INITIAL_LOW', 'HH', 'HL', 'LH', 'LL', 'EQH', 'EQL'].includes(pivot.structure_label)) {
        return blocked('B2C_ACTIVE_PIVOT_INVALID', meta);
      }
      activeIds.add(pivot.pivot_id);
      swingMarkers.push({
        id: pivot.pivot_id,
        kind: 'SWING_PIVOT',
        label: pivot.structure_label,
        pivot_type: pivot.type,
        price: pivot.price,
        anchor_time_ms: pivot.source_time_ms,
        source_time_ms: pivot.source_time_ms,
        confirmed_at_ms: pivot.confirmed_at_ms,
        visible_at_ms: pivot.available_at_ms,
        visibility_rule: 'SHOW_ONLY_AT_OR_AFTER_VISIBLE_AT'
      });
    }

    const expectedActiveIds = b2c.raw_pivots.filter(p => p.sequence_status === 'ACCEPTED').map(p => p.pivot_id).sort();
    const actualActiveIds = [...activeIds].sort();
    if (expectedActiveIds.length !== actualActiveIds.length || expectedActiveIds.some((id, i) => id !== actualActiveIds[i])) {
      return blocked('B2C_ACTIVE_PIVOT_SET_MISMATCH', meta);
    }
    const superseded = b2c.raw_pivots.filter(p => p.sequence_status === 'SUPERSEDED_FOR_SEQUENCE');
    const supersededPivots = superseded.map(p => ({
      id: p.pivot_id,
      kind: 'SUPERSEDED_RAW_PIVOT',
      label: 'SUPERSEDED_FOR_SEQUENCE',
      pivot_type: p.type,
      price: p.price,
      anchor_time_ms: p.source_time_ms,
      source_time_ms: p.source_time_ms,
      confirmed_at_ms: p.confirmed_at_ms,
      visible_at_ms: p.available_at_ms,
      superseded_by: p.superseded_by || null,
      visibility_rule: 'SHOW_ONLY_AT_OR_AFTER_VISIBLE_AT'
    }));

    const ambiguousPivots = b2c.raw_pivots.filter(p => p.sequence_status === 'AMBIGUOUS_FOR_SEQUENCE').map(p => ({
      id: p.pivot_id, kind: 'AMBIGUOUS_DUAL_PIVOT', label: 'AMBIGUOUS_FOR_SEQUENCE',
      pivot_type: p.type, price: p.price, anchor_time_ms: p.source_time_ms,
      source_time_ms: p.source_time_ms, confirmed_at_ms: p.confirmed_at_ms,
      visible_at_ms: p.available_at_ms, exclusion_reason: p.exclusion_reason,
      visibility_rule: 'SHOW_ONLY_AT_OR_AFTER_VISIBLE_AT'
    }));

    const eventIds = new Set();
    const structureEvents = [];
    for (const event of b2c.events) {
      if (!isObject(event) || typeof event.event_id !== 'string' || !event.event_id ||
          eventIds.has(event.event_id) || !Number.isSafeInteger(event.available_at_ms) ||
          event.available_at_ms !== event.breaking_candle_close_time_ms + policy.finality_safety_lag_ms ||
          event.available_at_ms > asOf || !Number.isSafeInteger(event.breaking_candle_open_time_ms) ||
          !Number.isSafeInteger(event.breaking_candle_close_time_ms) ||
          event.breaking_candle_open_time_ms <= 0 || event.breaking_candle_open_time_ms % step !== 0 ||
          event.breaking_candle_close_time_ms - event.breaking_candle_open_time_ms !== step ||
          (event.source_pivot_id !== null && event.source_pivot_id !== undefined && !rawIds.has(event.source_pivot_id))) {
        return blocked('B2C_EVENT_INVALID', meta);
      }
      eventIds.add(event.event_id);
      structureEvents.push({
        id: event.event_id,
        kind: 'STRUCTURE_EVENT',
        event_type: event.event_type,
        direction: event.direction,
        level_price: event.level_price,
        source_pivot_id: event.source_pivot_id,
        source_time_ms: event.source_time_ms,
        anchor_time_ms: event.breaking_candle_open_time_ms,
        breaking_candle_close_time_ms: event.breaking_candle_close_time_ms,
        visible_at_ms: event.available_at_ms,
        visibility_rule: 'SHOW_ONLY_AT_OR_AFTER_VISIBLE_AT'
      });
    }

    const zoneIds = new Set();
    const zones = [];
    for (const zone of b2d.zones) {
      if (!isObject(zone) || typeof zone.zone_id !== 'string' || !zone.zone_id ||
          zoneIds.has(zone.zone_id) || !Number.isFinite(zone.lower_bound) ||
          !Number.isFinite(zone.upper_bound) || zone.lower_bound > zone.upper_bound ||
          !Number.isSafeInteger(zone.available_at_ms) || zone.available_at_ms <= 0 || zone.available_at_ms > asOf ||
          !Array.isArray(zone.pivot_ids) || zone.pivot_ids.length < 2 || zone.freshness_status !== 'NOT_CLASSIFIED' ||
          !['SUPPORT', 'RESISTANCE'].includes(zone.role)) {
        return blocked('B2D_ZONE_INVALID', meta);
      }
      const zonePivots = zone.pivot_ids.map(id => b2c.raw_pivots.find(p => p.pivot_id === id));
      if (new Set(zone.pivot_ids).size !== zone.pivot_ids.length || zone.evidence_status !== 'CONFIRMED_CLUSTER' || zonePivots.some(p => !p || (zone.role === 'SUPPORT' ? p.type !== 'SWING_LOW' : p.type !== 'SWING_HIGH')) ||
          Math.min(...zonePivots.map(p => p.price)) !== zone.lower_bound ||
          Math.max(...zonePivots.map(p => p.price)) !== zone.upper_bound ||
          Math.max(...zonePivots.map(p => p.available_at_ms)) !== zone.available_at_ms ||
          new Set(zonePivots.map(p => p.source_time_ms)).size !== zone.touch_count) {
        return blocked('B2D_ZONE_EVIDENCE_MISMATCH', meta);
      }
      zoneIds.add(zone.zone_id);
      zones.push({
        id: zone.zone_id,
        kind: 'CONFIRMED_ZONE',
        role: zone.role,
        lower_bound: zone.lower_bound,
        upper_bound: zone.upper_bound,
        representative_price: zone.representative_price,
        touch_count: zone.touch_count,
        pivot_ids: zone.pivot_ids.slice(),
        source_first_touch_time_ms: zone.first_touch_time_ms,
        source_last_touch_time_ms: zone.last_touch_time_ms,
        visible_from_ms: zone.available_at_ms,
        visible_at_ms: zone.available_at_ms,
        end_time_ms: asOf,
        freshness_status: zone.freshness_status,
        visibility_rule: 'DO_NOT_BACKDATE_CONFIRMED_ZONE'
      });
    }

    const candidateIds = new Set();
    const candidateLevels = [];
    for (const candidate of b2d.candidate_levels) {
      if (!isObject(candidate) || typeof candidate.candidate_id !== 'string' || !candidate.candidate_id ||
          candidateIds.has(candidate.candidate_id) || !Number.isFinite(candidate.lower_bound) ||
          !Number.isFinite(candidate.upper_bound) || candidate.lower_bound > candidate.upper_bound ||
          !Number.isSafeInteger(candidate.available_at_ms) || candidate.available_at_ms <= 0 || candidate.available_at_ms > asOf) {
        return blocked('B2D_CANDIDATE_INVALID', meta);
      }
      if (!Array.isArray(candidate.pivot_ids) || candidate.pivot_ids.length < 1 ||
          new Set(candidate.pivot_ids).size !== candidate.pivot_ids.length ||
          !['SUPPORT', 'RESISTANCE'].includes(candidate.role) ||
          !Number.isSafeInteger(candidate.touch_count) || candidate.touch_count < 1 ||
          !Number.isSafeInteger(candidate.required_touch_count) || candidate.required_touch_count <= candidate.touch_count ||
          candidate.evidence_status !== 'INSUFFICIENT_INDEPENDENT_TOUCHES') return blocked('B2D_CANDIDATE_EVIDENCE_MISMATCH', meta);
      const candidatePivots = candidate.pivot_ids.map(id => b2c.raw_pivots.find(p => p.pivot_id === id));
      if (candidatePivots.some(p => !p || (candidate.role === 'SUPPORT' ? p.type !== 'SWING_LOW' : p.type !== 'SWING_HIGH')) ||
          Math.min(...candidatePivots.map(p => p.price)) !== candidate.lower_bound ||
          Math.max(...candidatePivots.map(p => p.price)) !== candidate.upper_bound ||
          Math.max(...candidatePivots.map(p => p.available_at_ms)) !== candidate.available_at_ms ||
          new Set(candidatePivots.map(p => p.source_time_ms)).size !== candidate.touch_count) {
        return blocked('B2D_CANDIDATE_EVIDENCE_MISMATCH', meta);
      }
      candidateIds.add(candidate.candidate_id);
      candidateLevels.push({
        id: candidate.candidate_id,
        kind: 'CANDIDATE_LEVEL',
        role: candidate.role,
        lower_bound: candidate.lower_bound,
        upper_bound: candidate.upper_bound,
        representative_price: candidate.representative_price,
        touch_count: candidate.touch_count,
        required_touch_count: candidate.required_touch_count,
        visible_at_ms: candidate.available_at_ms,
        visibility_rule: 'SHOW_ONLY_AT_OR_AFTER_VISIBLE_AT'
      });
    }

    const lifecycleIds = new Set();
    const retestLifecycles = [];
    for (const lifecycle of b2e.lifecycles) {
      if (!isObject(lifecycle) || typeof lifecycle.lifecycle_id !== 'string' || !lifecycle.lifecycle_id ||
          lifecycleIds.has(lifecycle.lifecycle_id) ||
          !['RETEST_SUCCESSFUL', 'RETEST_FAILED', 'RETEST_EXPIRED', 'RETEST_UNRESOLVED', 'WAITING_RETEST', 'RETEST_PENDING_CONFIRMATION'].includes(lifecycle.status) ||
          !['BULLISH', 'BEARISH'].includes(lifecycle.direction) ||
          !['SUPPORT', 'RESISTANCE'].includes(lifecycle.original_role) ||
          !['SUPPORT', 'RESISTANCE'].includes(lifecycle.proposed_role) ||
          lifecycle.proposed_role !== (lifecycle.direction === 'BULLISH' ? 'SUPPORT' : 'RESISTANCE') ||
          lifecycle.original_role !== (lifecycle.direction === 'BULLISH' ? 'RESISTANCE' : 'SUPPORT') ||
          !isObject(lifecycle.historical_zone) || lifecycle.historical_zone.role !== lifecycle.original_role ||
          !Number.isFinite(lifecycle.historical_zone.lower_bound) || !Number.isFinite(lifecycle.historical_zone.upper_bound) ||
          !Number.isSafeInteger(lifecycle.breakout_available_at_ms) ||
          lifecycle.breakout_available_at_ms > asOf ||
          lifecycle.breakout_available_at_ms !== lifecycle.breakout_candle_close_time_ms + policy.finality_safety_lag_ms ||
          !Number.isSafeInteger(lifecycle.breakout_candle_close_time_ms) ||
          lifecycle.breakout_candle_close_time_ms <= 0 || lifecycle.breakout_candle_close_time_ms % step !== 0 ||
          !Number.isSafeInteger(lifecycle.retest_window_bars) || lifecycle.retest_window_bars < 1 ||
          !Number.isSafeInteger(lifecycle.confirmation_window_bars) || lifecycle.confirmation_window_bars < 1) {
        return blocked('B2E_LIFECYCLE_INVALID', meta);
      }
      const breakoutEvent = b2c.events.find(event => event.event_id === lifecycle.breakout_event_id);
      if (!breakoutEvent || breakoutEvent.direction !== lifecycle.direction ||
          breakoutEvent.breaking_candle_open_time_ms !== lifecycle.breakout_candle_open_time_ms ||
          breakoutEvent.breaking_candle_close_time_ms !== lifecycle.breakout_candle_close_time_ms ||
          breakoutEvent.available_at_ms !== lifecycle.breakout_available_at_ms) {
        return blocked('B2E_BREAKOUT_EVENT_LINK_MISMATCH', meta);
      }
      lifecycleIds.add(lifecycle.lifecycle_id);
      if (lifecycle.touch && (!Number.isSafeInteger(lifecycle.touch.candle_close_time_ms) ||
          lifecycle.touch.candle_close_time_ms <= lifecycle.breakout_candle_close_time_ms ||
          lifecycle.touch.candle_close_time_ms + policy.finality_safety_lag_ms > asOf ||
          lifecycle.touch.candle_close_time_ms % step !== 0)) {
        return blocked('B2E_TOUCH_INVALID', meta);
      }
      if (lifecycle.confirmation && (!Number.isSafeInteger(lifecycle.confirmation.candle_close_time_ms) ||
          !Number.isSafeInteger(lifecycle.confirmation.available_at_ms) ||
          lifecycle.confirmation.available_at_ms !== lifecycle.confirmation.candle_close_time_ms + policy.finality_safety_lag_ms ||
          lifecycle.confirmation.candle_close_time_ms % step !== 0 ||
          lifecycle.confirmation.available_at_ms > asOf ||
          (lifecycle.touch && lifecycle.confirmation.candle_close_time_ms < lifecycle.touch.candle_close_time_ms) ||
          (!lifecycle.touch && lifecycle.confirmation.candle_close_time_ms <= lifecycle.breakout_candle_close_time_ms))) {
        return blocked('B2E_CONFIRMATION_INVALID', meta);
      }
      const expectedRoleStatus = lifecycle.status === 'RETEST_SUCCESSFUL' ? 'CONFIRMED' :
        lifecycle.status === 'RETEST_FAILED' ? 'REJECTED' :
        lifecycle.status === 'RETEST_EXPIRED' || lifecycle.status === 'RETEST_UNRESOLVED' ? 'UNCONFIRMED' : 'PENDING';
      const expectedEffectiveRole = lifecycle.status === 'RETEST_SUCCESSFUL' ? lifecycle.proposed_role : lifecycle.original_role;
      if (lifecycle.role_transition_status !== expectedRoleStatus || lifecycle.effective_role !== expectedEffectiveRole ||
          (lifecycle.status === 'RETEST_SUCCESSFUL' && (!lifecycle.touch || !lifecycle.confirmation || lifecycle.confirmation.outcome !== 'SUCCESS')) ||
          (lifecycle.status === 'RETEST_FAILED' && (!lifecycle.confirmation || lifecycle.confirmation.outcome !== 'FAILURE')) ||
          (['RETEST_EXPIRED', 'WAITING_RETEST'].includes(lifecycle.status) && (lifecycle.touch || lifecycle.confirmation)) ||
          (['RETEST_UNRESOLVED', 'RETEST_PENDING_CONFIRMATION'].includes(lifecycle.status) && (!lifecycle.touch || lifecycle.confirmation))) {
        return blocked('B2E_LIFECYCLE_STATE_MISMATCH', meta);
      }
      const visibleAt = lifecycleVisibleAt(lifecycle, step, policy.finality_safety_lag_ms);
      if (!Number.isSafeInteger(visibleAt) || visibleAt > asOf) return blocked('B2E_LIFECYCLE_FUTURE_VISIBILITY', meta);
      retestLifecycles.push({
        id: lifecycle.lifecycle_id,
        kind: 'RETEST_LIFECYCLE',
        breakout_event_id: lifecycle.breakout_event_id,
        breakout_event_type: lifecycle.breakout_event_type,
        direction: lifecycle.direction,
        status: lifecycle.status,
        role_transition_status: lifecycle.role_transition_status,
        original_role: lifecycle.original_role,
        proposed_role: lifecycle.proposed_role,
        effective_role: lifecycle.effective_role,
        zone_lower_bound: lifecycle.historical_zone && lifecycle.historical_zone.lower_bound,
        zone_upper_bound: lifecycle.historical_zone && lifecycle.historical_zone.upper_bound,
        breakout_available_at_ms: lifecycle.breakout_available_at_ms,
        touch: lifecycle.touch ? { ...lifecycle.touch } : null,
        confirmation: lifecycle.confirmation ? { ...lifecycle.confirmation } : null,
        visible_at_ms: visibleAt,
        visibility_rule: 'SHOW_ONLY_AFTER_EVIDENCE_AVAILABLE'
      });
    }

    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: policy.version,
      status: 'VALID',
      admission: {
        status: 'ADMITTED',
        snapshot_id: snapshot.snapshot_id,
        b1_validator_version: report.validator_version,
        b1_quality_policy_version: report.policy_version,
        b2a_engine_version: b2a.engine_version,
        b2c_engine_version: b2c.engine_version,
        b2d_engine_version: b2d.engine_version,
        b2e_engine_version: b2e.engine_version,
        b2f_engine_version: b2f.engine_version
      },
      symbol,
      market_type: snapshot.market_type,
      timeframe,
      snapshot_id: snapshot.snapshot_id,
      analysis_as_of_ms: asOf,
      swing_markers: sortByTimeAndId(swingMarkers, 'anchor_time_ms', 'id'),
      superseded_pivots: sortByTimeAndId(supersededPivots, 'anchor_time_ms', 'id'),
      ambiguous_pivots: sortByTimeAndId(ambiguousPivots, 'visible_at_ms', 'id'),
      structure_events: sortByTimeAndId(structureEvents, 'anchor_time_ms', 'id'),
      zones: sortByTimeAndId(zones, 'visible_from_ms', 'id'),
      candidate_levels: sortByTimeAndId(candidateLevels, 'visible_at_ms', 'id'),
      retest_lifecycles: sortByTimeAndId(retestLifecycles, 'visible_at_ms', 'id'),
      mtf_context: {
        structure_pattern: b2f.structure_pattern,
        alignment_status: b2f.alignment_status,
        alignment_context: b2f.alignment_context,
        hierarchical_interpretation: b2f.hierarchical_interpretation,
        lower_timeframe_consensus: b2f.lower_timeframe_consensus,
        visible_at_ms: b2f.analysis_as_of_ms
      },
      diagnostics: {
        swing_marker_count: swingMarkers.length,
        superseded_pivot_count: supersededPivots.length,
        structure_event_count: structureEvents.length,
        confirmed_zone_count: zones.length,
        candidate_level_count: candidateLevels.length,
        retest_lifecycle_count: retestLifecycles.length
      }
    });
  }

  return Object.freeze({ ENGINE_VERSION, TIMEFRAME_MS: STEP, analyze });
});
