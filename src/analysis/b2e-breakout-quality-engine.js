(function attachB2EBreakoutQualityEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B2EBreakoutQualityEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createB2EBreakoutQualityEngine() {
  'use strict';

  const ENGINE_VERSION = '1.0.0-b2e-breakout-quality';
  const REQUIRED_B2E_ENGINE_VERSION = '2.0.0-b2e';
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
      breakouts: [],
      diagnostics: { lifecycle_count: 0, evaluated_count: 0, insufficient_count: 0 }
    });
  }
  function validatePolicy(policy) {
    if (!isObject(policy) || typeof policy.version !== 'string' || !policy.version.trim() ||
        policy.b2e_engine_version !== REQUIRED_B2E_ENGINE_VERSION ||
        typeof policy.b2e_policy_version !== 'string' || !policy.b2e_policy_version.trim() ||
        typeof policy.b1_contract_version !== 'string' || !policy.b1_contract_version.trim() ||
        typeof policy.b1_validator_version !== 'string' || !policy.b1_validator_version.trim() ||
        typeof policy.b1_quality_policy_version !== 'string' || !policy.b1_quality_policy_version.trim() ||
        !Number.isSafeInteger(policy.finality_safety_lag_ms) || policy.finality_safety_lag_ms < 0 ||
        !Number.isSafeInteger(policy.atr_period) || policy.atr_period < 2 || policy.atr_period > 100 ||
        !Number.isSafeInteger(policy.volume_lookback) || policy.volume_lookback < 2 || policy.volume_lookback > 200 ||
        !Number.isFinite(policy.volume_expansion_min_ratio) || policy.volume_expansion_min_ratio <= 0 ||
        !Number.isFinite(policy.range_expansion_min_atr) || policy.range_expansion_min_atr <= 0 ||
        !Number.isFinite(policy.directional_body_min_ratio) || policy.directional_body_min_ratio < 0 ||
        policy.directional_body_min_ratio > 1 ||
        !Number.isFinite(policy.close_location_min) || policy.close_location_min < 0.5 ||
        policy.close_location_min > 1 ||
        !['volume_base', 'volume_quote'].includes(policy.volume_field)) return 'B2E_BREAKOUT_QUALITY_POLICY_INVALID';
    return null;
  }
  function validateCandle(candle, snapshot, timeframe, stepMs, asOf, lagMs) {
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
    return null;
  }
  function calculateAtrBefore(candles, breakIndex, period) {
    const prior = candles.slice(0, breakIndex);
    if (prior.length < period + 1) return null;
    const ranges = [];
    for (let i = 1; i < prior.length; i++) {
      const current = prior[i];
      const previousClose = prior[i - 1].close;
      ranges.push(Math.max(current.high - current.low,
        Math.abs(current.high - previousClose), Math.abs(current.low - previousClose)));
    }
    let atr = ranges.slice(0, period).reduce((sum, x) => sum + x, 0) / period;
    for (let i = period; i < ranges.length; i++) atr = ((atr * (period - 1)) + ranges[i]) / period;
    return Number.isFinite(atr) && atr > 0 ? atr : null;
  }
  function calculateVolumeRatio(candles, breakIndex, field, lookback) {
    if (breakIndex < lookback) return null;
    const prior = candles.slice(breakIndex - lookback, breakIndex)
      .map(c => c[field]).filter(v => Number.isFinite(v) && v >= 0);
    const current = candles[breakIndex][field];
    if (prior.length !== lookback || !Number.isFinite(current) || current < 0) return null;
    const average = prior.reduce((sum, value) => sum + value, 0) / prior.length;
    return average > 0 ? current / average : null;
  }
  function classify(flags) {
    const available = Object.values(flags).filter(value => value !== null);
    const positives = available.filter(Boolean).length;
    if (available.length < 3) return 'PARTIAL_EVIDENCE';
    if (positives >= 3) return 'STRONG_EVIDENCE';
    if (positives === 2) return 'MIXED_EVIDENCE';
    return 'WEAK_EVIDENCE';
  }

  function analyze(input) {
    const policy = input && input.policy;
    const snapshot = input && input.snapshot;
    const report = input && input.quality_report;
    const b2e = input && input.b2e_result;
    const asOf = input && input.analysis_as_of_ms;
    const meta = {
      policyVersion: policy && policy.version,
      snapshotId: snapshot && snapshot.snapshot_id,
      symbol: snapshot && snapshot.canonical_symbol,
      timeframe: input && input.timeframe,
      asOf
    };
    if (!isObject(snapshot) || !isObject(report) || !isObject(b2e)) return blocked('B2E_BREAKOUT_QUALITY_INPUT_MISSING', meta);
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
    if (!stepMs || (input.timeframe && input.timeframe !== timeframe)) return blocked('B2E_TIMEFRAME_SCOPE_INVALID', meta);
    const policyError = validatePolicy(policy);
    if (policyError) return blocked(policyError, meta);
    if (report.status !== 'VALID' || report.snapshot_id !== snapshot.snapshot_id ||
        report.symbol !== snapshot.canonical_symbol || report.timeframe !== timeframe ||
        report.analysis_as_of_ms !== asOf || report.validator_version !== policy.b1_validator_version ||
        report.policy_version !== policy.b1_quality_policy_version ||
        !Number.isSafeInteger(report.checked_at_ms) || report.checked_at_ms < 0) return blocked('B1_QUALITY_REPORT_IDENTITY_MISMATCH_OR_INVALID', meta);
    if (b2e.status !== 'VALID' || b2e.engine_version !== policy.b2e_engine_version ||
        b2e.policy_version !== policy.b2e_policy_version ||
        b2e.snapshot_id !== snapshot.snapshot_id || b2e.symbol !== snapshot.canonical_symbol ||
        b2e.timeframe !== timeframe || b2e.analysis_as_of_ms !== asOf ||
        b2e.admission?.status !== 'ADMITTED' || b2e.admission.snapshot_id !== snapshot.snapshot_id ||
        !Array.isArray(b2e.lifecycles)) return blocked('B2E_RESULT_IDENTITY_MISMATCH', meta);
    const candles = snapshot.candles_by_timeframe[timeframe];
    if (!Array.isArray(candles) || candles.length !== report.closed_count ||
        report.valid_count < candles.length || report.insufficient_history === true) return blocked('B1_QUALITY_CANDLE_COUNT_MISMATCH', meta);
    for (let i = 0; i < candles.length; i++) {
      const error = validateCandle(candles[i], snapshot, timeframe, stepMs, asOf, policy.finality_safety_lag_ms);
      if (error) return blocked(error, meta);
      if (i > 0 && candles[i].open_time_ms - candles[i - 1].open_time_ms !== stepMs) return blocked('B1_CANDLE_ORDER_OR_GAP_INVALID', meta);
    }
    const indexByOpen = new Map(candles.map((c, i) => [c.open_time_ms, i]));
    const breakouts = [];
    for (const lifecycle of b2e.lifecycles) {
      if (!isObject(lifecycle) || typeof lifecycle.breakout_event_id !== 'string' ||
          !['BULLISH', 'BEARISH'].includes(lifecycle.direction) ||
          !Number.isSafeInteger(lifecycle.breakout_candle_open_time_ms) ||
          !Number.isSafeInteger(lifecycle.breakout_candle_close_time_ms) ||
          !Number.isSafeInteger(lifecycle.breakout_available_at_ms) ||
          !isObject(lifecycle.historical_zone) ||
          !Number.isFinite(lifecycle.historical_zone.lower_bound) ||
          !Number.isFinite(lifecycle.historical_zone.upper_bound) ||
          lifecycle.historical_zone.upper_bound < lifecycle.historical_zone.lower_bound) {
        return blocked('B2E_BREAKOUT_LIFECYCLE_INVALID', meta);
      }
      const index = indexByOpen.get(lifecycle.breakout_candle_open_time_ms);
      const candle = index === undefined ? null : candles[index];
      const zone = lifecycle.historical_zone;
      if (!candle || candle.close_time_ms !== lifecycle.breakout_candle_close_time_ms ||
          lifecycle.breakout_available_at_ms !== candle.close_time_ms + policy.finality_safety_lag_ms ||
          (lifecycle.direction === 'BULLISH' &&
            (zone.role !== 'RESISTANCE' || candle.close <= zone.upper_bound)) ||
          (lifecycle.direction === 'BEARISH' &&
            (zone.role !== 'SUPPORT' || candle.close >= zone.lower_bound))) {
        return blocked('B2E_BREAKOUT_CANDLE_OR_ZONE_PROVENANCE_INVALID', meta);
      }
      const atr = calculateAtrBefore(candles, index, policy.atr_period);
      const range = candle.high - candle.low;
      const bodyRatio = range > 0 ? Math.abs(candle.close - candle.open) / range : null;
      const closeLocation = range > 0 ? (candle.close - candle.low) / range : null;
      const volumeRatio = calculateVolumeRatio(candles, index, policy.volume_field, policy.volume_lookback);
      const rangeAtr = atr && range > 0 ? range / atr : null;
      const breakDistance = lifecycle.direction === 'BULLISH'
        ? candle.close - zone.upper_bound
        : zone.lower_bound - candle.close;
      const breakDistanceAtr = atr ? breakDistance / atr : null;
      const directionalBody = bodyRatio === null ? null :
        (lifecycle.direction === 'BULLISH' ? candle.close > candle.open : candle.close < candle.open) &&
        bodyRatio >= policy.directional_body_min_ratio;
      const closeQuality = closeLocation === null ? null :
        (lifecycle.direction === 'BULLISH'
          ? closeLocation >= policy.close_location_min
          : closeLocation <= (1 - policy.close_location_min));
      const flags = {
        volume_expansion: volumeRatio === null ? null : volumeRatio >= policy.volume_expansion_min_ratio,
        range_expansion: rangeAtr === null ? null : rangeAtr >= policy.range_expansion_min_atr,
        directional_body: directionalBody,
        close_quality: closeQuality
      };
      const evidenceAvailable = Object.values(flags).filter(v => v !== null).length;
      const evidencePositive = Object.values(flags).filter(v => v === true).length;
      breakouts.push({
        breakout_event_id: lifecycle.breakout_event_id,
        lifecycle_id: lifecycle.lifecycle_id,
        direction: lifecycle.direction,
        breakout_candle_open_time_ms: candle.open_time_ms,
        breakout_candle_close_time_ms: candle.close_time_ms,
        retest_status: lifecycle.status,
        original_zone_role: zone.role,
        zone_lower_bound: zone.lower_bound,
        zone_upper_bound: zone.upper_bound,
        metrics: {
          atr_before_break: atr,
          candle_range: range,
          range_atr: rangeAtr,
          body_ratio: bodyRatio,
          close_location: closeLocation,
          volume_ratio: volumeRatio,
          break_distance_price: breakDistance,
          break_distance_atr: breakDistanceAtr
        },
        evidence_flags: flags,
        evidence_available_count: evidenceAvailable,
        evidence_positive_count: evidencePositive,
        quality_status: classify(flags)
      });
    }
    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: policy.version,
      status: 'VALID',
      admission: {
        status: 'ADMITTED',
        snapshot_id: snapshot.snapshot_id,
        b2e_engine_version: b2e.engine_version,
        b2e_policy_version: b2e.policy_version,
        b1_validator_version: report.validator_version,
        b1_quality_policy_version: report.policy_version
      },
      snapshot_id: snapshot.snapshot_id,
      symbol: snapshot.canonical_symbol,
      timeframe,
      analysis_as_of_ms: asOf,
      breakouts,
      diagnostics: {
        lifecycle_count: b2e.lifecycles.length,
        evaluated_count: breakouts.length,
        insufficient_count: breakouts.filter(b => b.quality_status === 'PARTIAL_EVIDENCE').length,
        strong_evidence_count: breakouts.filter(b => b.quality_status === 'STRONG_EVIDENCE').length,
        mixed_evidence_count: breakouts.filter(b => b.quality_status === 'MIXED_EVIDENCE').length,
        weak_evidence_count: breakouts.filter(b => b.quality_status === 'WEAK_EVIDENCE').length
      }
    });
  }

  return Object.freeze({ ENGINE_VERSION, REQUIRED_B2E_ENGINE_VERSION, analyze });
});
