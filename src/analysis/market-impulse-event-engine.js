(function attachMarketImpulseEventEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MarketImpulseEventEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMarketImpulseEventEngine() {
  'use strict';

  const ENGINE_VERSION = '1.0.0-market-impulse-event';
  const REQUIRED_B2E_ENGINE_VERSION = '2.0.0-b2e';
  const REQUIRED_ZONE_CONTEXT_ENGINE_VERSION = '1.0.0-b2d-zone-context';
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
      engine_version: ENGINE_VERSION, policy_version: meta.policyVersion || null,
      status: 'BLOCKED',
      admission: { status: 'BLOCKED', reasons: [{ code, severity: 'CRITICAL' }] },
      snapshot_id: meta.snapshotId || null, symbol: meta.symbol || null,
      timeframe: meta.timeframe || null, analysis_as_of_ms: meta.asOf ?? null,
      event: null, diagnostics: { candle_count: 0 }
    });
  }
  function validatePolicy(policy) {
    if (!isObject(policy) || typeof policy.version !== 'string' || !policy.version.trim() ||
        !Number.isSafeInteger(policy.atr_period) || policy.atr_period < 2 || policy.atr_period > 100 ||
        !Number.isSafeInteger(policy.window_bars) || policy.window_bars < 2 || policy.window_bars > 20 ||
        !Number.isSafeInteger(policy.volume_lookback) || policy.volume_lookback < 2 || policy.volume_lookback > 200 ||
        !Number.isFinite(policy.impulse_displacement_atr) || policy.impulse_displacement_atr <= 0 ||
        !Number.isFinite(policy.selloff_displacement_atr) || policy.selloff_displacement_atr < policy.impulse_displacement_atr ||
        !Number.isFinite(policy.range_expansion_min_atr) || policy.range_expansion_min_atr <= 0 ||
        !Number.isFinite(policy.volume_expansion_min_ratio) || policy.volume_expansion_min_ratio <= 0 ||
        !Number.isFinite(policy.directional_pressure_min) || policy.directional_pressure_min < 0.5 ||
        policy.directional_pressure_min > 1 ||
        !Number.isFinite(policy.close_location_max) || policy.close_location_max <= 0 ||
        policy.close_location_max >= 0.5 ||
        !Number.isSafeInteger(policy.context_lookback_bars) || policy.context_lookback_bars < 0 ||
        policy.context_lookback_bars > 500 ||
        !['volume_base', 'volume_quote'].includes(policy.volume_field) ||
        typeof policy.b1_contract_version !== 'string' || !policy.b1_contract_version.trim() ||
        typeof policy.b1_validator_version !== 'string' || !policy.b1_validator_version.trim() ||
        typeof policy.b1_quality_policy_version !== 'string' || !policy.b1_quality_policy_version.trim() ||
        typeof policy.b2e_policy_version !== 'string' || !policy.b2e_policy_version.trim() ||
        typeof policy.zone_context_policy_version !== 'string' || !policy.zone_context_policy_version.trim() ||
        !Number.isSafeInteger(policy.finality_safety_lag_ms) || policy.finality_safety_lag_ms < 0) return 'MARKET_IMPULSE_POLICY_INVALID';
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
  function atrBefore(candles, startIndex, period) {
    const prior = candles.slice(0, startIndex);
    if (prior.length < period + 1) return null;
    const tr = [];
    for (let i = 1; i < prior.length; i++) {
      const c = prior[i], prev = prior[i - 1].close;
      tr.push(Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev)));
    }
    let atr = tr.slice(0, period).reduce((sum, x) => sum + x, 0) / period;
    for (let i = period; i < tr.length; i++) atr = ((atr * (period - 1)) + tr[i]) / period;
    return Number.isFinite(atr) && atr > 0 ? atr : null;
  }
  function volumeExpansion(candles, startIndex, windowBars, field, lookback) {
    if (startIndex < lookback) return null;
    const baseline = candles.slice(startIndex - lookback, startIndex).map(c => c[field]);
    const recent = candles.slice(startIndex, startIndex + windowBars).map(c => c[field]);
    if (baseline.length !== lookback || [...baseline, ...recent].some(v => !Number.isFinite(v) || v < 0)) return null;
    const baseAverage = baseline.reduce((s, x) => s + x, 0) / baseline.length;
    const recentAverage = recent.reduce((s, x) => s + x, 0) / recent.length;
    return baseAverage > 0 ? recentAverage / baseAverage : null;
  }
  function analyze(input) {
    const policy = input && input.policy;
    const snapshot = input && input.snapshot;
    const report = input && input.quality_report;
    const b2e = input && input.b2e_result;
    const zoneContext = input && input.zone_context_result;
    const asOf = input && input.analysis_as_of_ms;
    const meta = {
      policyVersion: policy && policy.version, snapshotId: snapshot && snapshot.snapshot_id,
      symbol: snapshot && snapshot.canonical_symbol, timeframe: input && input.timeframe, asOf
    };
    if (!isObject(snapshot) || !isObject(report) || !isObject(b2e)) return blocked('MARKET_IMPULSE_INPUT_MISSING', meta);
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
    if (!stepMs || (input.timeframe && input.timeframe !== timeframe)) return blocked('MARKET_IMPULSE_TIMEFRAME_INVALID', meta);
    const policyError = validatePolicy(policy);
    if (policyError) return blocked(policyError, meta);
    if (report.status !== 'VALID' || report.snapshot_id !== snapshot.snapshot_id ||
        report.symbol !== snapshot.canonical_symbol || report.timeframe !== timeframe ||
        report.analysis_as_of_ms !== asOf || report.validator_version !== policy.b1_validator_version ||
        report.policy_version !== policy.b1_quality_policy_version ||
        !Number.isSafeInteger(report.checked_at_ms) || report.checked_at_ms < 0) return blocked('B1_QUALITY_REPORT_IDENTITY_MISMATCH', meta);
    if (b2e.status !== 'VALID' || b2e.engine_version !== REQUIRED_B2E_ENGINE_VERSION ||
        b2e.policy_version !== policy.b2e_policy_version ||
        b2e.snapshot_id !== snapshot.snapshot_id || b2e.symbol !== snapshot.canonical_symbol ||
        b2e.timeframe !== timeframe || b2e.analysis_as_of_ms !== asOf ||
        b2e.admission?.status !== 'ADMITTED' || b2e.admission.snapshot_id !== snapshot.snapshot_id ||
        !Array.isArray(b2e.lifecycles) || b2e.lifecycles.some(l => !isObject(l) ||
          !['BULLISH', 'BEARISH'].includes(l.direction) ||
          !['RETEST_SUCCESSFUL', 'RETEST_FAILED', 'RETEST_EXPIRED', 'WAITING_RETEST',
            'RETEST_PENDING_CONFIRMATION', 'RETEST_UNRESOLVED'].includes(l.status))) return blocked('B2E_RESULT_IDENTITY_MISMATCH', meta);
    if (zoneContext != null && (zoneContext.status !== 'VALID' ||
        zoneContext.engine_version !== REQUIRED_ZONE_CONTEXT_ENGINE_VERSION ||
        zoneContext.policy_version !== policy.zone_context_policy_version ||
        zoneContext.snapshot_id !== snapshot.snapshot_id || zoneContext.symbol !== snapshot.canonical_symbol ||
        zoneContext.timeframe !== timeframe || zoneContext.analysis_as_of_ms !== asOf ||
        zoneContext.admission?.status !== 'ADMITTED')) return blocked('B2D_ZONE_CONTEXT_IDENTITY_MISMATCH', meta);
    const candles = snapshot.candles_by_timeframe[timeframe];
    if (!Array.isArray(candles) || candles.length !== report.closed_count ||
        report.valid_count < candles.length || report.insufficient_history === true) return blocked('B1_CANDLE_COUNT_MISMATCH', meta);
    for (let i = 0; i < candles.length; i++) {
      const error = validateCandle(candles[i], snapshot, timeframe, stepMs, asOf, policy.finality_safety_lag_ms);
      if (error) return blocked(error, meta);
      if (i > 0 && candles[i].open_time_ms - candles[i - 1].open_time_ms !== stepMs) return blocked('B1_CANDLE_ORDER_OR_GAP_INVALID', meta);
    }
    const windowStart = candles.length - policy.window_bars;
    if (windowStart < 0) return blocked('INSUFFICIENT_IMPULSE_WINDOW', meta);
    const atr = atrBefore(candles, windowStart, policy.atr_period);
    if (!(atr > 0)) return blocked('ATR_INSUFFICIENT_OR_ZERO', meta);
    const window = candles.slice(windowStart);
    const first = window[0], last = window[window.length - 1];
    const signedDisplacement = last.close - first.open;
    const direction = signedDisplacement < 0 ? 'BEARISH' : signedDisplacement > 0 ? 'BULLISH' : 'NEUTRAL';
    const displacementAtr = Math.abs(signedDisplacement) / atr;
    const ranges = window.map((c, i) => {
      const previousClose = i === 0 ? candles[windowStart - 1].close : window[i - 1].close;
      return Math.max(c.high - c.low, Math.abs(c.high - previousClose), Math.abs(c.low - previousClose));
    });
    const averageRange = ranges.reduce((sum, x) => sum + x, 0) / ranges.length;
    const rangeExpansionAtr = averageRange / atr;
    const directionalPressure = direction === 'NEUTRAL' ? 0 : window.filter(c => {
      const range = c.high - c.low;
      if (!(range > 0)) return false;
      const closeLocation = (c.close - c.low) / range;
      return direction === 'BEARISH'
        ? c.close < c.open && closeLocation <= policy.close_location_max
        : c.close > c.open && closeLocation >= (1 - policy.close_location_max);
    }).length / window.length;
    const volumeRatio = volumeExpansion(candles, windowStart, policy.window_bars, policy.volume_field, policy.volume_lookback);
    const flags = {
      displacement: displacementAtr >= policy.impulse_displacement_atr,
      range_expansion: rangeExpansionAtr >= policy.range_expansion_min_atr,
      directional_pressure: directionalPressure >= policy.directional_pressure_min,
      volume_expansion: volumeRatio === null ? null : volumeRatio >= policy.volume_expansion_min_ratio
    };
    const positive = Object.values(flags).filter(v => v === true).length;
    let classification = 'NO_IMPULSE';
    if (direction !== 'NEUTRAL' && flags.displacement && flags.directional_pressure) {
      if (direction === 'BEARISH' && displacementAtr >= policy.selloff_displacement_atr &&
          flags.range_expansion && flags.volume_expansion === true) classification = 'STRONG_SELL_OFF';
      else if (direction === 'BEARISH' && displacementAtr >= policy.selloff_displacement_atr &&
          flags.range_expansion && flags.volume_expansion === null) classification = 'SELL_OFF_PARTIAL_EVIDENCE';
      else if (direction === 'BEARISH') classification = 'BEARISH_IMPULSE';
      else classification = 'BULLISH_IMPULSE';
    } else if (direction !== 'NEUTRAL' && displacementAtr >= policy.impulse_displacement_atr) {
      classification = 'DIRECTIONAL_MOVE_UNCONFIRMED';
    }
    const contextCutoff = candles[windowStart].open_time_ms - policy.context_lookback_bars * stepMs;
    const bearishBreakouts = b2e.lifecycles.filter(l => l.direction === 'BEARISH' &&
      Number.isSafeInteger(l.breakout_candle_open_time_ms) &&
      l.breakout_candle_open_time_ms >= contextCutoff &&
      l.breakout_candle_open_time_ms <= last.open_time_ms).map(l => ({
        breakout_event_id: l.breakout_event_id,
        lifecycle_id: l.lifecycle_id,
        retest_status: l.status,
        interpretation: l.status === 'RETEST_SUCCESSFUL'
          ? 'BROKEN_SUPPORT_HELD_AS_RESISTANCE'
          : l.status === 'RETEST_FAILED'
            ? 'SUPPORT_RECLAIMED_BREAKDOWN_INVALIDATED'
            : 'BREAKDOWN_RETEST_UNRESOLVED'
      }));
    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: policy.version,
      status: 'VALID',
      admission: {
        status: 'ADMITTED',
        snapshot_id: snapshot.snapshot_id,
        b2e_engine_version: b2e.engine_version,
        b2e_policy_version: b2e.policy_version,
        zone_context_engine_version: zoneContext ? zoneContext.engine_version : null
      },
      snapshot_id: snapshot.snapshot_id,
      symbol: snapshot.canonical_symbol,
      timeframe,
      analysis_as_of_ms: asOf,
      event: {
        classification,
        direction,
        window_start_open_time_ms: first.open_time_ms,
        window_end_close_time_ms: last.close_time_ms,
        window_bars: policy.window_bars,
        metrics: {
          atr_before_window: atr,
          signed_displacement_price: signedDisplacement,
          displacement_atr: displacementAtr,
          average_true_range: averageRange,
          range_expansion_atr: rangeExpansionAtr,
          directional_pressure: directionalPressure,
          volume_ratio: volumeRatio
        },
        evidence_flags: flags,
        positive_evidence_count: positive,
        bearish_breakout_context: bearishBreakouts,
        zone_context: zoneContext ? zoneContext.active_zone_selection : null
      },
      diagnostics: {
        candle_count: candles.length,
        bearish_breakout_context_count: bearishBreakouts.length,
        volume_evidence_available: volumeRatio !== null
      }
    });
  }
  return Object.freeze({ ENGINE_VERSION, analyze });
});
