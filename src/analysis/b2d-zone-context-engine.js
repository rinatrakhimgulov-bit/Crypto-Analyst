(function attachB2DZoneContextEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B2DZoneContextEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createB2DZoneContextEngine() {
  'use strict';

  const ENGINE_VERSION = '1.0.0-b2d-zone-context';
  const REQUIRED_B2D_ENGINE_VERSION = '2.0.0-b2d';
  const TIMEFRAME_MS = Object.freeze({ '1h': 3600000, '4h': 14400000, '1d': 86400000 });
  const CLOSED_STATES = new Set(['CONFIRMED', 'TIME_DERIVED']);

  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) freezeDeep(value[key]);
    return value;
  }
  function isObject(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
  function blocked(code, meta = {}) {
    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: meta.policyVersion || null,
      status: 'BLOCKED',
      admission: { status: 'BLOCKED', reasons: [{ code, severity: 'CRITICAL' }] },
      snapshot_id: meta.snapshotId || null,
      symbol: meta.symbol || null,
      timeframe: meta.timeframe || null,
      analysis_as_of_ms: meta.asOf ?? null,
      current_close: null,
      atr: null,
      zones: [],
      active_zone_selection: { nearest_support: null, nearest_resistance: null, intersecting_zone_ids: [] },
      diagnostics: { candle_count: 0, zone_count: 0 }
    });
  }
  function validatePolicy(policy) {
    if (!isObject(policy) || typeof policy.version !== 'string' || !policy.version.trim() ||
        !Number.isSafeInteger(policy.atr_period) || policy.atr_period < 2 || policy.atr_period > 100 ||
        !Number.isSafeInteger(policy.freshness_recent_bars) || policy.freshness_recent_bars < 1 ||
        !Number.isSafeInteger(policy.freshness_aging_bars) ||
        policy.freshness_aging_bars <= policy.freshness_recent_bars ||
        !Number.isFinite(policy.max_active_distance_atr) || policy.max_active_distance_atr <= 0 ||
        policy.max_active_distance_atr > 100 ||
        policy.b2d_engine_version !== REQUIRED_B2D_ENGINE_VERSION ||
        typeof policy.b2d_policy_version !== 'string' || !policy.b2d_policy_version.trim() ||
        typeof policy.b2d_zone_policy_version !== 'string' || !policy.b2d_zone_policy_version.trim() ||
        typeof policy.b1_contract_version !== 'string' || !policy.b1_contract_version.trim() ||
        typeof policy.b1_validator_version !== 'string' || !policy.b1_validator_version.trim() ||
        typeof policy.b1_quality_policy_version !== 'string' || !policy.b1_quality_policy_version.trim() ||
        !Number.isSafeInteger(policy.finality_safety_lag_ms) || policy.finality_safety_lag_ms < 0) return 'B2D_ZONE_CONTEXT_POLICY_INVALID';
    return null;
  }
  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  function calculateAtr(candles, period) {
    if (!Array.isArray(candles) || candles.length < period + 1) return null;
    const ranges = [];
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previousClose = candles[i - 1].close;
      ranges.push(Math.max(
        current.high - current.low,
        Math.abs(current.high - previousClose),
        Math.abs(current.low - previousClose)
      ));
    }
    let value = ranges.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
    for (let i = period; i < ranges.length; i++) value = ((value * (period - 1)) + ranges[i]) / period;
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  function validateCandles(candles, snapshot, timeframe, stepMs, asOf, lagMs) {
    if (!Array.isArray(candles) || candles.length < 2) return 'B1_CANDLE_COLLECTION_INVALID';
    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      if (!isObject(candle) || !Number.isSafeInteger(candle.open_time_ms) ||
          !Number.isSafeInteger(candle.close_time_ms)) return 'CANDLE_TIME_INVALID';
      if (candle.close_time_ms - candle.open_time_ms !== stepMs ||
          candle.open_time_ms % stepMs !== 0) return 'CANDLE_ALIGNMENT_INVALID';
      if (candle.close_time_ms + lagMs > asOf || !CLOSED_STATES.has(candle.closed_state)) return 'CANDLE_NOT_FINAL_CLOSED';
      if (candle.canonical_symbol !== snapshot.canonical_symbol ||
          candle.market_type !== snapshot.market_type || candle.timeframe !== timeframe) return 'CANDLE_PROVENANCE_MISMATCH';
      if (['open', 'high', 'low', 'close'].some(k => !Number.isFinite(candle[k]) || candle[k] <= 0) ||
          candle.high < Math.max(candle.open, candle.close, candle.low) ||
          candle.low > Math.min(candle.open, candle.close, candle.high)) return 'CANDLE_OHLC_INVALID';
      if (i > 0 && candle.open_time_ms - candles[i - 1].open_time_ms !== stepMs) return 'B1_CANDLE_ORDER_OR_GAP_INVALID';
    }
    return null;
  }
  function enrichZone(zone, atr, currentClose, currentOpenTimeMs, asOf, stepMs, policy) {
    const ageBars = Math.max(0, Math.floor((currentOpenTimeMs - zone.last_touch_time_ms) / stepMs));
    const freshnessStatus = ageBars <= policy.freshness_recent_bars
      ? 'FRESH'
      : ageBars <= policy.freshness_aging_bars ? 'AGING' : 'STALE';
    let relativePosition;
    let distancePrice;
    if (currentClose > zone.upper_bound) {
      relativePosition = 'BELOW_CURRENT_PRICE';
      distancePrice = currentClose - zone.upper_bound;
    } else if (currentClose < zone.lower_bound) {
      relativePosition = 'ABOVE_CURRENT_PRICE';
      distancePrice = zone.lower_bound - currentClose;
    } else {
      relativePosition = 'CONTAINS_CURRENT_PRICE';
      distancePrice = 0;
    }
    const distanceAtr = distancePrice / atr;
    const touches = Array.isArray(zone.touches) ? zone.touches : [];
    const recentTouchCount = touches.filter(t => Number.isSafeInteger(t.source_time_ms) &&
      Math.floor((currentOpenTimeMs - t.source_time_ms) / stepMs) <= policy.freshness_recent_bars).length;
    const evidence = {
      touch_count: Number.isSafeInteger(zone.touch_count) ? zone.touch_count : touches.length,
      recent_touch_count: recentTouchCount,
      accepted_touch_count: touches.filter(t => t.sequence_status === 'ACCEPTED').length,
      superseded_touch_count: touches.filter(t => t.sequence_status === 'SUPERSEDED_FOR_SEQUENCE').length,
      ambiguous_touch_count: touches.filter(t => t.sequence_status === 'AMBIGUOUS_FOR_SEQUENCE').length
    };
    return {
      ...zone,
      age_bars: ageBars,
      freshness_status: freshnessStatus,
      relative_position: relativePosition,
      distance_price: distancePrice,
      distance_atr: distanceAtr,
      is_active: freshnessStatus !== 'STALE' && distanceAtr <= policy.max_active_distance_atr,
      evidence
    };
  }
  function nearest(zones, role, currentClose) {
    const eligible = zones.filter(zone => zone.role === role &&
      (role === 'SUPPORT' ? zone.upper_bound <= currentClose : zone.lower_bound >= currentClose) &&
      zone.freshness_status !== 'STALE' && zone.is_active);
    eligible.sort((a, b) => a.distance_atr - b.distance_atr ||
      b.evidence.touch_count - a.evidence.touch_count || a.zone_id.localeCompare(b.zone_id));
    if (!eligible.length) return null;
    const zone = eligible[0];
    return {
      zone_id: zone.zone_id,
      role: zone.role,
      lower_bound: zone.lower_bound,
      upper_bound: zone.upper_bound,
      distance_price: zone.distance_price,
      distance_atr: zone.distance_atr,
      freshness_status: zone.freshness_status,
      evidence: zone.evidence
    };
  }

  function analyze(input) {
    const policy = input && input.policy;
    const snapshot = input && input.snapshot;
    const report = input && input.quality_report;
    const b2d = input && input.b2d_result;
    const asOf = input && input.analysis_as_of_ms;
    const meta = {
      policyVersion: policy && policy.version,
      snapshotId: snapshot && snapshot.snapshot_id,
      symbol: snapshot && snapshot.canonical_symbol,
      timeframe: input && input.timeframe,
      asOf
    };
    if (!isObject(snapshot) || !isObject(report) || !isObject(b2d)) return blocked('B2D_ZONE_CONTEXT_INPUT_MISSING', meta);
    if (!Number.isSafeInteger(asOf) || asOf <= 0 || snapshot.analysis_as_of_ms !== asOf ||
        snapshot.provider_server_time_ms !== asOf || !isObject(snapshot.provider_metadata) ||
        snapshot.provider_metadata.time_source !== 'provider') return blocked('B1_ANALYSIS_CUTOFF_INVALID', meta);
    if (typeof snapshot.snapshot_id !== 'string' || !snapshot.snapshot_id ||
        snapshot.contract_version !== (policy && policy.b1_contract_version) ||
        typeof snapshot.canonical_symbol !== 'string' || !snapshot.canonical_symbol ||
        typeof snapshot.market_type !== 'string' || !snapshot.market_type) return blocked('B1_SNAPSHOT_IDENTITY_INVALID', meta);
    const keys = Object.keys(snapshot.candles_by_timeframe || {});
    const timeframe = keys.length === 1 ? keys[0] : null;
    const stepMs = TIMEFRAME_MS[timeframe];
    meta.timeframe = timeframe;
    if (!stepMs || (input.timeframe && input.timeframe !== timeframe)) return blocked('B2D_TIMEFRAME_SCOPE_INVALID', meta);
    const policyError = validatePolicy(policy);
    if (policyError) return blocked(policyError, meta);
    if (report.status !== 'VALID' || report.snapshot_id !== snapshot.snapshot_id ||
        report.symbol !== snapshot.canonical_symbol || report.timeframe !== timeframe ||
        report.analysis_as_of_ms !== asOf || report.validator_version !== policy.b1_validator_version ||
        report.policy_version !== policy.b1_quality_policy_version ||
        !Number.isSafeInteger(report.checked_at_ms) || report.checked_at_ms < 0) return blocked('B1_QUALITY_REPORT_IDENTITY_MISMATCH_OR_INVALID', meta);
    if (b2d.status !== 'VALID' || b2d.engine_version !== policy.b2d_engine_version ||
        b2d.policy_version !== policy.b2d_policy_version ||
        b2d.zone_policy_version !== policy.b2d_zone_policy_version ||
        b2d.snapshot_id !== snapshot.snapshot_id || b2d.symbol !== snapshot.canonical_symbol ||
        b2d.timeframe !== timeframe || b2d.analysis_as_of_ms !== asOf ||
        b2d.admission?.status !== 'ADMITTED' || b2d.admission.snapshot_id !== snapshot.snapshot_id ||
        !Array.isArray(b2d.zones)) return blocked('B2D_RESULT_IDENTITY_MISMATCH', meta);
    const candles = snapshot.candles_by_timeframe[timeframe];
    const candleError = validateCandles(candles, snapshot, timeframe, stepMs, asOf,
      policy.finality_safety_lag_ms);
    if (candleError) return blocked(candleError, meta);
    if (report.closed_count !== candles.length || report.valid_count < candles.length ||
        report.insufficient_history === true) return blocked('B1_QUALITY_CANDLE_COUNT_MISMATCH', meta);
    const atr = calculateAtr(candles, policy.atr_period);
    if (!(atr > 0)) return blocked('ATR_INSUFFICIENT_OR_ZERO', meta);
    const currentClose = candles[candles.length - 1].close;
    const zones = [];
    for (const zone of b2d.zones) {
      if (!isObject(zone) || typeof zone.zone_id !== 'string' ||
          !['SUPPORT', 'RESISTANCE'].includes(zone.role) ||
          !Number.isFinite(zone.lower_bound) || !Number.isFinite(zone.upper_bound) ||
          zone.lower_bound <= 0 || zone.upper_bound < zone.lower_bound ||
          !Number.isSafeInteger(zone.last_touch_time_ms) || zone.last_touch_time_ms > asOf ||
          !Number.isSafeInteger(zone.available_at_ms) || zone.available_at_ms > asOf ||
          !Array.isArray(zone.touches) || zone.touches.length < 2) return blocked('B2D_ZONE_EVIDENCE_INVALID', meta);
      const touchTimes = new Set();
      let latestTouch = -1;
      let latestAvailability = -1;
      for (const touch of zone.touches) {
        if (!isObject(touch) || typeof touch.pivot_id !== 'string' || !touch.pivot_id ||
            !Number.isSafeInteger(touch.source_time_ms) || touch.source_time_ms > asOf ||
            !Number.isSafeInteger(touch.available_at_ms) || touch.available_at_ms > asOf ||
            touch.available_at_ms < touch.source_time_ms ||
            !['ACCEPTED', 'SUPERSEDED_FOR_SEQUENCE', 'AMBIGUOUS_FOR_SEQUENCE'].includes(touch.sequence_status) ||
            touchTimes.has(touch.source_time_ms)) return blocked('B2D_ZONE_TOUCH_EVIDENCE_INVALID', meta);
        touchTimes.add(touch.source_time_ms);
        latestTouch = Math.max(latestTouch, touch.source_time_ms);
        latestAvailability = Math.max(latestAvailability, touch.available_at_ms);
      }
      if (zone.touch_count !== touchTimes.size || zone.last_touch_time_ms !== latestTouch ||
          zone.available_at_ms < latestAvailability) return blocked('B2D_ZONE_TOUCH_EVIDENCE_INVALID', meta);
      zones.push(enrichZone(zone, atr, currentClose, candles[candles.length - 1].open_time_ms, asOf, stepMs, policy));
    }
    const intersecting = zones.filter(z => z.relative_position === 'CONTAINS_CURRENT_PRICE')
      .map(z => z.zone_id).sort();
    const activeZones = zones.filter(z => z.is_active).map(z => z.zone_id).sort();
    const output = {
      engine_version: ENGINE_VERSION,
      policy_version: policy.version,
      status: 'VALID',
      admission: {
        status: 'ADMITTED',
        snapshot_id: snapshot.snapshot_id,
        b2d_engine_version: b2d.engine_version,
        b2d_policy_version: b2d.policy_version,
        b2d_zone_policy_version: b2d.zone_policy_version
      },
      snapshot_id: snapshot.snapshot_id,
      symbol: snapshot.canonical_symbol,
      timeframe,
      analysis_as_of_ms: asOf,
      current_close: currentClose,
      atr,
      atr_period: policy.atr_period,
      freshness_policy: 'TOUCH_AGE_BARS_V1',
      zones: zones.sort((a, b) => a.role.localeCompare(b.role) ||
        a.lower_bound - b.lower_bound || a.zone_id.localeCompare(b.zone_id)),
      active_zone_selection: {
        max_active_distance_atr: policy.max_active_distance_atr,
        nearest_support: nearest(zones, 'SUPPORT', currentClose),
        nearest_resistance: nearest(zones, 'RESISTANCE', currentClose),
        intersecting_zone_ids: intersecting,
        active_zone_ids: activeZones
      },
      diagnostics: {
        candle_count: candles.length,
        zone_count: zones.length,
        active_zone_count: activeZones.length,
        stale_zone_count: zones.filter(z => z.freshness_status === 'STALE').length,
        intersecting_zone_count: intersecting.length
      }
    };
    return freezeDeep(output);
  }

  return Object.freeze({ ENGINE_VERSION, REQUIRED_B2D_ENGINE_VERSION, analyze });
});
