(function attachB2EBreakoutRetestEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B2EBreakoutRetestEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createB2EBreakoutRetestEngine() {
  'use strict';

  const ENGINE_VERSION = '2.0.0-b2e';
  const REQUIRED_B2D_ENGINE_VERSION = '2.0.0-b2d';
  const REQUIRED_B2C_ENGINE_VERSION = '2.0.0-b2c';
  const BREAK_TYPES = Object.freeze({
    INITIAL_BULLISH_BREAK: 'BULLISH',
    BULLISH_BOS: 'BULLISH',
    BULLISH_CHOCH: 'BULLISH',
    INITIAL_BEARISH_BREAK: 'BEARISH',
    BEARISH_BOS: 'BEARISH',
    BEARISH_CHOCH: 'BEARISH'
  });
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
      lifecycles: [], unmatched_breakouts: [],
      diagnostics: { breakout_event_count: 0, lifecycle_count: 0, unmatched_breakout_count: 0 }
    });
  }
  function validatePolicy(policy) {
    if (!isObject(policy) || typeof policy.version !== 'string' || !policy.version.trim()) return 'B2E_POLICY_INVALID';
    if (policy.b2d_engine_version !== REQUIRED_B2D_ENGINE_VERSION ||
        typeof policy.b2d_policy_version !== 'string' || !policy.b2d_policy_version.trim() ||
        typeof policy.b2d_zone_policy_version !== 'string' || !policy.b2d_zone_policy_version.trim() ||
        policy.b2c_engine_version !== REQUIRED_B2C_ENGINE_VERSION ||
        typeof policy.b2c_policy_version !== 'string' || !policy.b2c_policy_version.trim() ||
        typeof policy.b1_contract_version !== 'string' || !policy.b1_contract_version.trim() ||
        typeof policy.b1_validator_version !== 'string' || !policy.b1_validator_version.trim() ||
        typeof policy.b1_quality_policy_version !== 'string' || !policy.b1_quality_policy_version.trim() ||
        !Number.isSafeInteger(policy.finality_safety_lag_ms) || policy.finality_safety_lag_ms < 0 ||
        policy.price_equality_policy !== 'EXACT_PRICE_V1') return 'B2E_UPSTREAM_POLICY_BINDING_INVALID';
    const rp = policy.retest_policy;
    if (!isObject(rp) || typeof rp.version !== 'string' || !rp.version.trim() ||
        rp.touch_method !== 'RANGE_INTERSECTION_V1' ||
        !Number.isFinite(rp.touch_tolerance_price) || rp.touch_tolerance_price < 0 ||
        !Number.isFinite(rp.success_buffer_price) || rp.success_buffer_price < 0 ||
        !Number.isFinite(rp.failure_buffer_price) || rp.failure_buffer_price < 0 ||
        !Number.isSafeInteger(rp.retest_window_bars) || rp.retest_window_bars < 1 || rp.retest_window_bars > 500 ||
        !Number.isSafeInteger(rp.confirmation_window_bars) || rp.confirmation_window_bars < 1 || rp.confirmation_window_bars > 100) {
      return 'RETEST_POLICY_INVALID';
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
  function buildHistoricalZones(pivots, role, maxSpan, minTouches, cutoff) {
    const expectedType = role === 'RESISTANCE' ? 'SWING_HIGH' : 'SWING_LOW';
    const sorted = pivots.filter(p => p.type === expectedType && p.available_at_ms < cutoff)
      .sort((a, b) => a.price - b.price || a.source_time_ms - b.source_time_ms || a.pivot_id.localeCompare(b.pivot_id));
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
    return clusters.filter(cluster => new Set(cluster.map(p => p.source_time_ms)).size >= minTouches)
      .map(cluster => {
        const prices = cluster.map(p => p.price);
        const ids = cluster.map(p => p.pivot_id).sort();
        return {
          historical_zone_id: ['B2E-ZONE', role, ids[0], ids[ids.length - 1]].join(':'),
          role,
          lower_bound: Math.min(...prices),
          upper_bound: Math.max(...prices),
          representative_price: median(prices),
          cluster_span_price: Math.max(...prices) - Math.min(...prices),
          touch_count: new Set(cluster.map(p => p.source_time_ms)).size,
          first_touch_time_ms: Math.min(...cluster.map(p => p.source_time_ms)),
          last_touch_time_ms: Math.max(...cluster.map(p => p.source_time_ms)),
          available_at_ms: Math.max(...cluster.map(p => p.available_at_ms)),
          pivot_ids: ids
        };
      });
  }
  function outcome(direction, candle, zone, policy) {
    const rp = policy.retest_policy;
    if (direction === 'BULLISH') {
      if (candle.close > zone.upper_bound + rp.success_buffer_price) return 'SUCCESS';
      if (candle.close < zone.lower_bound - rp.failure_buffer_price) return 'FAILURE';
    } else {
      if (candle.close < zone.lower_bound - rp.success_buffer_price) return 'SUCCESS';
      if (candle.close > zone.upper_bound + rp.failure_buffer_price) return 'FAILURE';
    }
    return null;
  }
  function isTouch(candle, zone, policy) {
    const tolerance = policy.retest_policy.touch_tolerance_price;
    return candle.low <= zone.upper_bound + tolerance &&
      candle.high >= zone.lower_bound - tolerance;
  }
  function makeLifecycle(event, zone, candles, breakIndex, policy) {
    const rp = policy.retest_policy;
    let touchIndex = -1;
    const retestEnd = Math.min(candles.length - 1, breakIndex + rp.retest_window_bars);
    for (let i = breakIndex + 1; i <= retestEnd; i++) {
      if (isTouch(candles[i], zone, policy)) {
        touchIndex = i;
        break;
      }
    }

    const proposedRole = event.direction === 'BULLISH' ? 'SUPPORT' : 'RESISTANCE';
    const base = {
      lifecycle_id: ['B2E', event.event_id, zone.historical_zone_id].join(':'),
      breakout_event_id: event.event_id,
      breakout_event_type: event.event_type,
      direction: event.direction,
      original_role: zone.role,
      proposed_role: proposedRole,
      historical_zone: zone,
      breakout_candle_open_time_ms: event.breaking_candle_open_time_ms,
      breakout_candle_close_time_ms: event.breaking_candle_close_time_ms,
      breakout_available_at_ms: event.available_at_ms,
      retest_window_bars: rp.retest_window_bars,
      confirmation_window_bars: rp.confirmation_window_bars,
      touch_tolerance_price: rp.touch_tolerance_price,
      success_buffer_price: rp.success_buffer_price,
      failure_buffer_price: rp.failure_buffer_price
    };

    if (touchIndex < 0) {
      const windowComplete = candles.length - 1 >= breakIndex + rp.retest_window_bars;
      return {
        ...base,
        status: windowComplete ? 'RETEST_EXPIRED' : 'WAITING_RETEST',
        role_transition_status: windowComplete ? 'UNCONFIRMED' : 'PENDING',
        effective_role: zone.role,
        touch: null,
        confirmation: null,
        bars_observed_after_break: Math.max(0, candles.length - 1 - breakIndex)
      };
    }

    const touchCandle = candles[touchIndex];
    const immediateOutcome = outcome(event.direction, touchCandle, zone, policy);
    let result = immediateOutcome;
    let confirmationIndex = immediateOutcome ? touchIndex : -1;
    const confirmationEnd = Math.min(candles.length - 1, touchIndex + rp.confirmation_window_bars);
    if (!result) {
      for (let i = touchIndex + 1; i <= confirmationEnd; i++) {
        const candidate = outcome(event.direction, candles[i], zone, policy);
        if (candidate) {
          result = candidate;
          confirmationIndex = i;
          break;
        }
      }
    }

    let status;
    let roleTransitionStatus;
    let effectiveRole;
    if (result === 'SUCCESS') {
      status = 'RETEST_SUCCESSFUL';
      roleTransitionStatus = 'CONFIRMED';
      effectiveRole = proposedRole;
    } else if (result === 'FAILURE') {
      status = 'RETEST_FAILED';
      roleTransitionStatus = 'REJECTED';
      effectiveRole = zone.role;
    } else {
      const confirmationComplete = candles.length - 1 >= touchIndex + rp.confirmation_window_bars;
      status = confirmationComplete ? 'RETEST_UNRESOLVED' : 'RETEST_PENDING_CONFIRMATION';
      roleTransitionStatus = confirmationComplete ? 'UNCONFIRMED' : 'PENDING';
      effectiveRole = zone.role;
    }

    return {
      ...base,
      status,
      role_transition_status: roleTransitionStatus,
      effective_role: effectiveRole,
      touch: {
        candle_open_time_ms: touchCandle.open_time_ms,
        candle_close_time_ms: touchCandle.close_time_ms,
        candle_low: touchCandle.low,
        candle_high: touchCandle.high,
        candle_close: touchCandle.close,
        bars_after_break: touchIndex - breakIndex
      },
      confirmation: confirmationIndex >= 0 ? {
        outcome: result,
        candle_open_time_ms: candles[confirmationIndex].open_time_ms,
        candle_close_time_ms: candles[confirmationIndex].close_time_ms,
        candle_close: candles[confirmationIndex].close,
        available_at_ms: candles[confirmationIndex].close_time_ms + policy.finality_safety_lag_ms,
        bars_after_touch: confirmationIndex - touchIndex
      } : null,
      bars_observed_after_touch: Math.max(0, candles.length - 1 - touchIndex)
    };
  }

  function analyze(input) {
    const policy = input && input.policy;
    const snapshot = input && input.snapshot;
    const report = input && input.quality_report;
    const b2c = input && input.b2c_result;
    const b2d = input && input.b2d_result;
    const asOf = input && input.analysis_as_of_ms;
    const meta = {
      policyVersion: policy && policy.version,
      snapshotId: snapshot && snapshot.snapshot_id,
      symbol: snapshot && snapshot.canonical_symbol,
      timeframe: input && input.timeframe,
      analysisAsOfMs: asOf
    };
    if (!isObject(snapshot) || !isObject(report) || !isObject(b2c) || !isObject(b2d)) return blocked('INVALID', 'B2E_INPUT_MISSING', meta);
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
    if (!stepMs || (input.timeframe && input.timeframe !== timeframe)) return blocked('INVALID', 'B2E_TIMEFRAME_SCOPE_INVALID', meta);
    const policyError = validatePolicy(policy);
    if (policyError) return blocked('INVALID', policyError, meta);

    if (report.snapshot_id !== snapshot.snapshot_id || report.symbol !== snapshot.canonical_symbol ||
        report.timeframe !== timeframe || report.analysis_as_of_ms !== asOf ||
        report.validator_version !== policy.b1_validator_version ||
        report.policy_version !== policy.b1_quality_policy_version ||
        !Number.isSafeInteger(report.checked_at_ms) || report.checked_at_ms < 0) return blocked('INVALID', 'B1_QUALITY_REPORT_IDENTITY_MISMATCH', meta);
    if (report.status !== 'VALID') return blocked('BLOCKED', 'B1_QUALITY_STATUS_NOT_VALID', meta);

    if (b2c.status !== 'VALID' || b2c.engine_version !== policy.b2c_engine_version ||
        b2c.policy_version !== policy.b2c_policy_version || b2c.snapshot_id !== snapshot.snapshot_id ||
        b2c.symbol !== snapshot.canonical_symbol || b2c.timeframe !== timeframe ||
        b2c.analysis_as_of_ms !== asOf || !isObject(b2c.admission) ||
        b2c.admission.status !== 'ADMITTED' || b2c.admission.snapshot_id !== snapshot.snapshot_id ||
        b2c.admission.b1_validator_version !== policy.b1_validator_version ||
        b2c.admission.b1_quality_policy_version !== policy.b1_quality_policy_version ||
        !Array.isArray(b2c.raw_pivots) || !Array.isArray(b2c.events)) return blocked('INVALID', 'B2C_ADMISSION_IDENTITY_MISMATCH', meta);

    if (b2d.status !== 'VALID' || b2d.engine_version !== policy.b2d_engine_version ||
        b2d.policy_version !== policy.b2d_policy_version ||
        b2d.zone_policy_version !== policy.b2d_zone_policy_version ||
        b2d.snapshot_id !== snapshot.snapshot_id || b2d.symbol !== snapshot.canonical_symbol ||
        b2d.timeframe !== timeframe || b2d.analysis_as_of_ms !== asOf ||
        !isObject(b2d.admission) || b2d.admission.status !== 'ADMITTED' ||
        b2d.admission.snapshot_id !== snapshot.snapshot_id ||
        b2d.admission.b2c_engine_version !== policy.b2c_engine_version ||
        b2d.admission.b2c_policy_version !== policy.b2c_policy_version ||
        b2d.admission.b1_validator_version !== policy.b1_validator_version ||
        b2d.admission.b1_quality_policy_version !== policy.b1_quality_policy_version ||
        b2d.cluster_method !== 'MAX_TOTAL_SPAN_V1' ||
        !Number.isFinite(b2d.max_cluster_span_price) || b2d.max_cluster_span_price <= 0 ||
        !Number.isSafeInteger(b2d.min_independent_touches) || b2d.min_independent_touches < 2 ||
        !Array.isArray(b2d.zones)) return blocked('INVALID', 'B2D_ADMISSION_IDENTITY_MISMATCH', meta);

    const closedMap = snapshot.candles_by_timeframe;
    const formingMap = snapshot.forming_candle_by_timeframe;
    const unknownMap = snapshot.unclassified_candles_by_timeframe;
    if (!isObject(closedMap) || !Array.isArray(closedMap[timeframe]) ||
        !isObject(formingMap) || !Object.prototype.hasOwnProperty.call(formingMap, timeframe) ||
        !isObject(unknownMap) || !Array.isArray(unknownMap[timeframe])) return blocked('INVALID', 'B1_CANDLE_COLLECTION_INVALID', meta);
    const candles = closedMap[timeframe];
    if (report.closed_count !== candles.length || report.valid_count < candles.length || report.insufficient_history === true) return blocked('INVALID', 'B1_QUALITY_CANDLE_COUNT_MISMATCH', meta);
    const byOpen = new Map();
    const byClose = new Map();
    for (let i = 0; i < candles.length; i++) {
      const error = validateCandle(candles[i], snapshot, timeframe, stepMs, asOf, policy.finality_safety_lag_ms);
      if (error) return blocked('INVALID', error, meta);
      if (byOpen.has(candles[i].open_time_ms) ||
          (i > 0 && candles[i].open_time_ms - candles[i - 1].open_time_ms !== stepMs)) return blocked('INVALID', 'B1_CANDLE_ORDER_OR_GAP_INVALID', meta);
      byOpen.set(candles[i].open_time_ms, candles[i]);
      byClose.set(candles[i].close_time_ms, candles[i]);
    }
    const excluded = [formingMap[timeframe], ...unknownMap[timeframe]].filter(Boolean);
    for (const candle of excluded) if (!isObject(candle) || byOpen.has(candle.open_time_ms)) return blocked('INVALID', 'B1_FORMING_OR_UNKNOWN_OVERLAP', meta);

    const pivotIds = new Set();
    const pivotById = new Map();
    let previousAvailable = -1;
    for (const pivot of b2c.raw_pivots) {
      const error = validatePivot(pivot, pivotIds, asOf, policy.price_equality_policy);
      if (error) return blocked('INVALID', error, meta);
      if (pivot.available_at_ms < previousAvailable) return blocked('INVALID', 'B2C_PIVOT_ORDER_INVALID', meta);
      previousAvailable = pivot.available_at_ms;
      const sourceCandle = byOpen.get(pivot.source_time_ms);
      const confirmationCandle = byClose.get(pivot.confirmed_at_ms);
      const expectedPrice = sourceCandle && (pivot.type === 'SWING_HIGH' ? sourceCandle.high : sourceCandle.low);
      if (!sourceCandle || !confirmationCandle || expectedPrice !== pivot.price ||
          pivot.available_at_ms !== pivot.confirmed_at_ms + policy.finality_safety_lag_ms) return blocked('INVALID', 'B2C_PIVOT_PROVENANCE_MISMATCH', meta);
      pivotById.set(pivot.pivot_id, pivot);
    }

    const zoneIds = new Set();
    for (const zone of b2d.zones) {
      if (!isObject(zone) || typeof zone.zone_id !== 'string' || !zone.zone_id ||
          zoneIds.has(zone.zone_id) || !['SUPPORT', 'RESISTANCE'].includes(zone.role) ||
          !Array.isArray(zone.pivot_ids) || !Array.isArray(zone.touches) || zone.pivot_ids.length < b2d.min_independent_touches) {
        return blocked('INVALID', 'B2D_ZONE_SHAPE_INVALID', meta);
      }
      zoneIds.add(zone.zone_id);
      const members = zone.pivot_ids.map(id => pivotById.get(id));
      if (members.some(p => !p) || members.some(p => p.type !== (zone.role === 'SUPPORT' ? 'SWING_LOW' : 'SWING_HIGH'))) {
        return blocked('INVALID', 'B2D_ZONE_PIVOT_MEMBERSHIP_INVALID', meta);
      }
      const prices = members.map(p => p.price);
      const touchTimes = members.map(p => p.source_time_ms);
      const availableTimes = members.map(p => p.available_at_ms);
      if (new Set(touchTimes).size !== members.length ||
          zone.lower_bound !== Math.min(...prices) || zone.upper_bound !== Math.max(...prices) ||
          zone.representative_price !== median(prices) ||
          zone.cluster_span_price !== zone.upper_bound - zone.lower_bound ||
          zone.cluster_span_price > b2d.max_cluster_span_price ||
          zone.touch_count !== members.length ||
          zone.available_at_ms !== Math.max(...availableTimes) ||
          zone.touches.length !== members.length) return blocked('INVALID', 'B2D_ZONE_EVIDENCE_MISMATCH', meta);
    }

    const closeIndex = new Map(candles.map((c, i) => [c.close_time_ms, i]));
    const eventIds = new Set();
    const lifecycles = [];
    const unmatched = [];
    const breakEvents = b2c.events.filter(e => Object.prototype.hasOwnProperty.call(BREAK_TYPES, e.event_type));

    for (const event of breakEvents) {
      if (!isObject(event) || typeof event.event_id !== 'string' || !event.event_id || eventIds.has(event.event_id)) return blocked('INVALID', 'B2C_BREAK_EVENT_ID_INVALID', meta);
      eventIds.add(event.event_id);
      const direction = BREAK_TYPES[event.event_type];
      const pivot = pivotById.get(event.source_pivot_id);
      const candleIndex = closeIndex.get(event.breaking_candle_close_time_ms);
      const breakingCandle = candleIndex === undefined ? null : candles[candleIndex];
      if (!pivot || !breakingCandle || event.direction !== direction ||
          event.breaking_candle_open_time_ms !== breakingCandle.open_time_ms ||
          event.breaking_candle_close !== breakingCandle.close ||
          event.confirmed_at_ms !== breakingCandle.close_time_ms ||
          event.available_at_ms !== breakingCandle.close_time_ms + policy.finality_safety_lag_ms ||
          pivot.available_at_ms >= breakingCandle.close_time_ms ||
          event.level_price !== pivot.price ||
          (direction === 'BULLISH' && (pivot.type !== 'SWING_HIGH' || breakingCandle.close <= pivot.price)) ||
          (direction === 'BEARISH' && (pivot.type !== 'SWING_LOW' || breakingCandle.close >= pivot.price))) {
        return blocked('INVALID', 'B2C_BREAK_EVENT_PROVENANCE_MISMATCH', meta);
      }

      const role = direction === 'BULLISH' ? 'RESISTANCE' : 'SUPPORT';
      const historicalZones = buildHistoricalZones(
        b2c.raw_pivots, role, b2d.max_cluster_span_price,
        b2d.min_independent_touches, breakingCandle.close_time_ms
      );
      const zone = historicalZones.find(z => z.pivot_ids.includes(event.source_pivot_id));
      if (!zone) {
        unmatched.push({
          breakout_event_id: event.event_id,
          event_type: event.event_type,
          source_pivot_id: event.source_pivot_id,
          reason: 'ZONE_NOT_FORMED_BEFORE_BREAK',
          break_close_time_ms: breakingCandle.close_time_ms
        });
        continue;
      }
      lifecycles.push(makeLifecycle(event, zone, candles, candleIndex, policy));
    }

    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: policy.version,
      retest_policy_version: policy.retest_policy.version,
      status: 'VALID',
      admission: {
        status: 'ADMITTED',
        snapshot_id: snapshot.snapshot_id,
        b2c_engine_version: b2c.engine_version,
        b2c_policy_version: b2c.policy_version,
        b2d_engine_version: b2d.engine_version,
        b2d_policy_version: b2d.policy_version,
        b2d_zone_policy_version: b2d.zone_policy_version,
        b1_validator_version: report.validator_version,
        b1_quality_policy_version: report.policy_version
      },
      snapshot_id: snapshot.snapshot_id,
      symbol: snapshot.canonical_symbol,
      timeframe,
      analysis_as_of_ms: asOf,
      retest_policy: {
        version: policy.retest_policy.version,
        touch_method: policy.retest_policy.touch_method,
        touch_tolerance_price: policy.retest_policy.touch_tolerance_price,
        success_buffer_price: policy.retest_policy.success_buffer_price,
        failure_buffer_price: policy.retest_policy.failure_buffer_price,
        retest_window_bars: policy.retest_policy.retest_window_bars,
        confirmation_window_bars: policy.retest_policy.confirmation_window_bars
      },
      lifecycles,
      unmatched_breakouts: unmatched,
      diagnostics: {
        breakout_event_count: breakEvents.length,
        lifecycle_count: lifecycles.length,
        unmatched_breakout_count: unmatched.length,
        successful_retest_count: lifecycles.filter(l => l.status === 'RETEST_SUCCESSFUL').length,
        failed_retest_count: lifecycles.filter(l => l.status === 'RETEST_FAILED').length,
        pending_count: lifecycles.filter(l => l.status === 'WAITING_RETEST' || l.status === 'RETEST_PENDING_CONFIRMATION').length,
        expired_count: lifecycles.filter(l => l.status === 'RETEST_EXPIRED' || l.status === 'RETEST_UNRESOLVED').length
      }
    });
  }

  return Object.freeze({ ENGINE_VERSION, REQUIRED_B2D_ENGINE_VERSION, analyze });
});
