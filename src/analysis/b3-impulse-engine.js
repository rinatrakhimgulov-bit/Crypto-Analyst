(function attachB3ImpulseEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B3ImpulseEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createB3ImpulseEngine() {
  'use strict';

  const ENGINE_VERSION = '1.0.0-b3-impulse';
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
      status: 'BLOCKED', admission: { status: 'BLOCKED', reasons: [{ code, severity: 'CRITICAL' }] },
      snapshot_id: meta.snapshotId || null, symbol: meta.symbol || null,
      timeframe: meta.timeframe || null, analysis_as_of_ms: meta.asOf ?? null,
      current_close: null, impulse: { status: 'UNAVAILABLE', classification: 'UNKNOWN' },
      diagnostics: { candle_count: 0 }
    });
  }
  function validatePolicy(p) {
    if (!isObject(p) || typeof p.version !== 'string' || !p.version.trim() ||
        typeof p.b1_contract_version !== 'string' || !p.b1_contract_version.trim() ||
        typeof p.b1_validator_version !== 'string' || !p.b1_validator_version.trim() ||
        typeof p.b1_quality_policy_version !== 'string' || !p.b1_quality_policy_version.trim() ||
        !Number.isSafeInteger(p.finality_safety_lag_ms) || p.finality_safety_lag_ms < 0 ||
        !Number.isSafeInteger(p.atr_period) || p.atr_period < 2 || p.atr_period > 100 ||
        !Number.isSafeInteger(p.impulse_lookback) || p.impulse_lookback < 2 || p.impulse_lookback > 20 ||
        !Number.isSafeInteger(p.volume_lookback) || p.volume_lookback < 5 || p.volume_lookback > 200 ||
        !['volume_base', 'volume_quote'].includes(p.volume_field) ||
        !Number.isFinite(p.min_displacement_atr) || p.min_displacement_atr <= 0 ||
        !Number.isFinite(p.min_range_expansion_atr) || p.min_range_expansion_atr <= 0 ||
        !Number.isFinite(p.min_volume_ratio) || p.min_volume_ratio <= 0 ||
        !Number.isFinite(p.min_directional_body_ratio) || p.min_directional_body_ratio < 0 || p.min_directional_body_ratio > 1 ||
        !Number.isFinite(p.selloff_displacement_atr) || p.selloff_displacement_atr < p.min_displacement_atr ||
        !Number.isFinite(p.selloff_volume_ratio) || p.selloff_volume_ratio < p.min_volume_ratio) {
      return 'B3_IMPULSE_POLICY_INVALID';
    }
    return null;
  }
  function validateCandle(c, snapshot, timeframe, step, asOf, lag) {
    if (!isObject(c) || !Number.isSafeInteger(c.open_time_ms) || !Number.isSafeInteger(c.close_time_ms)) return 'CANDLE_TIME_INVALID';
    if (c.close_time_ms - c.open_time_ms !== step || c.open_time_ms % step !== 0) return 'CANDLE_ALIGNMENT_INVALID';
    if (c.close_time_ms + lag > asOf || !CLOSED_STATES.has(c.closed_state)) return 'CANDLE_NOT_FINAL_CLOSED';
    if (c.canonical_symbol !== snapshot.canonical_symbol || c.market_type !== snapshot.market_type || c.timeframe !== timeframe) return 'CANDLE_PROVENANCE_MISMATCH';
    if (['open', 'high', 'low', 'close'].some(k => !Number.isFinite(c[k]) || c[k] <= 0) ||
        c.high < Math.max(c.open, c.close, c.low) || c.low > Math.min(c.open, c.close, c.high)) return 'CANDLE_OHLC_INVALID';
    return null;
  }
  function atrBefore(candles, endIndex, period) {
    const prior = candles.slice(0, endIndex);
    if (prior.length < period + 1) return null;
    const ranges = [];
    for (let i = 1; i < prior.length; i++) {
      const c = prior[i], prev = prior[i - 1].close;
      ranges.push(Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev)));
    }
    let value = ranges.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < ranges.length; i++) value = ((value * (period - 1)) + ranges[i]) / period;
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  function analyze(input) {
    const p = input && input.policy, snapshot = input && input.snapshot, report = input && input.quality_report;
    const asOf = input && input.analysis_as_of_ms;
    const meta = { policyVersion: p && p.version, snapshotId: snapshot && snapshot.snapshot_id,
      symbol: snapshot && snapshot.canonical_symbol, asOf, timeframe: input && input.timeframe };
    if (!isObject(snapshot) || !isObject(report)) return blocked('B3_IMPULSE_INPUT_MISSING', meta);
    if (!Number.isSafeInteger(asOf) || asOf <= 0 || snapshot.analysis_as_of_ms !== asOf ||
        snapshot.provider_server_time_ms !== asOf || !isObject(snapshot.provider_metadata) ||
        snapshot.provider_metadata.time_source !== 'provider') return blocked('B1_ANALYSIS_CUTOFF_INVALID', meta);
    if (typeof snapshot.snapshot_id !== 'string' || !snapshot.snapshot_id ||
        snapshot.contract_version !== (p && p.b1_contract_version) ||
        typeof snapshot.canonical_symbol !== 'string' || !snapshot.canonical_symbol ||
        typeof snapshot.market_type !== 'string' || !snapshot.market_type) return blocked('B1_SNAPSHOT_IDENTITY_INVALID', meta);
    const keys = Object.keys(snapshot.candles_by_timeframe || {});
    const timeframe = keys.length === 1 ? keys[0] : null, step = TIMEFRAME_MS[timeframe];
    meta.timeframe = timeframe;
    const policyError = validatePolicy(p);
    if (policyError) return blocked(policyError, meta);
    if (!step || (input.timeframe && input.timeframe !== timeframe)) return blocked('B3_TIMEFRAME_SCOPE_INVALID', meta);
    if (report.status !== 'VALID' || report.snapshot_id !== snapshot.snapshot_id ||
        report.symbol !== snapshot.canonical_symbol || report.timeframe !== timeframe ||
        report.analysis_as_of_ms !== asOf || report.validator_version !== p.b1_validator_version ||
        report.policy_version !== p.b1_quality_policy_version ||
        !Number.isSafeInteger(report.checked_at_ms) || report.checked_at_ms < 0) return blocked('B1_QUALITY_REPORT_IDENTITY_MISMATCH', meta);
    const candles = snapshot.candles_by_timeframe[timeframe];
    if (!Array.isArray(candles) || candles.length !== report.closed_count ||
        report.valid_count < candles.length || report.insufficient_history === true) return blocked('B1_CANDLE_COUNT_MISMATCH', meta);
    for (let i = 0; i < candles.length; i++) {
      const error = validateCandle(candles[i], snapshot, timeframe, step, asOf, p.finality_safety_lag_ms);
      if (error) return blocked(error, meta);
      if (i > 0 && candles[i].open_time_ms - candles[i - 1].open_time_ms !== step) return blocked('B1_CANDLE_ORDER_OR_GAP_INVALID', meta);
    }
    const end = candles.length - 1, start = end - p.impulse_lookback;
    if (start < p.volume_lookback || start < 1) {
      return freezeDeep({
        engine_version: ENGINE_VERSION, policy_version: p.version, status: 'VALID',
        admission: { status: 'ADMITTED', snapshot_id: snapshot.snapshot_id },
        snapshot_id: snapshot.snapshot_id, symbol: snapshot.canonical_symbol, timeframe,
        analysis_as_of_ms: asOf, current_close: candles[end].close,
        impulse: { status: 'INSUFFICIENT_HISTORY', classification: 'UNKNOWN', direction: 'UNKNOWN', evidence_flags: {} },
        diagnostics: { candle_count: candles.length, required_history: p.volume_lookback + p.impulse_lookback + p.atr_period + 1 }
      });
    }
    const atr = atrBefore(candles, end, p.atr_period);
    const priorVolumes = candles.slice(start - p.volume_lookback, start).map(c => c[p.volume_field]);
    const volumeValues = candles.slice(start, end + 1).map(c => c[p.volume_field]);
    if (!atr || priorVolumes.some(v => !Number.isFinite(v) || v < 0) ||
        volumeValues.some(v => !Number.isFinite(v) || v < 0)) {
      return freezeDeep({
        engine_version: ENGINE_VERSION, policy_version: p.version, status: 'VALID',
        admission: { status: 'ADMITTED', snapshot_id: snapshot.snapshot_id },
        snapshot_id: snapshot.snapshot_id, symbol: snapshot.canonical_symbol, timeframe,
        analysis_as_of_ms: asOf, current_close: candles[end].close,
        impulse: { status: 'INSUFFICIENT_DATA', classification: 'UNKNOWN', direction: 'UNKNOWN', evidence_flags: {} },
        diagnostics: { candle_count: candles.length }
      });
    }
    const window = candles.slice(start + 1, end + 1);
    const windowHigh = Math.max(...window.map(c => c.high));
    const windowLow = Math.min(...window.map(c => c.low));
    const displacement = candles[end].close - candles[start].close;
    const direction = displacement < 0 ? 'BEARISH' : displacement > 0 ? 'BULLISH' : 'NEUTRAL';
    const displacementAtr = Math.abs(displacement) / atr;
    const rangeAtr = (windowHigh - windowLow) / atr;
    const baselineVolume = priorVolumes.reduce((a, b) => a + b, 0) / priorVolumes.length;
    const currentVolume = volumeValues.reduce((a, b) => a + b, 0) / volumeValues.length;
    const volumeRatio = baselineVolume > 0 ? currentVolume / baselineVolume : null;
    const totalRange = window.reduce((sum, c) => sum + (c.high - c.low), 0);
    const signedBody = window.reduce((sum, c) => sum + (c.close - c.open), 0);
    const directionalBodyRatio = totalRange > 0 ? Math.abs(signedBody) / totalRange : null;
    const alignedBars = window.filter(c => direction === 'BEARISH' ? c.close < c.open :
      direction === 'BULLISH' ? c.close > c.open : false).length;
    const alignedBarRatio = window.length ? alignedBars / window.length : null;
    const flags = {
      displacement: displacementAtr >= p.min_displacement_atr,
      range_expansion: rangeAtr >= p.min_range_expansion_atr,
      volume_expansion: volumeRatio === null ? null : volumeRatio >= p.min_volume_ratio,
      directional_body: directionalBodyRatio !== null && directionalBodyRatio >= p.min_directional_body_ratio,
      candle_alignment: alignedBarRatio !== null && alignedBarRatio >= 0.6
    };
    const available = Object.values(flags).filter(v => v !== null).length;
    const positive = Object.values(flags).filter(v => v === true).length;
    const isImpulse = direction !== 'NEUTRAL' && available >= 4 && positive >= 4;
    const isSelloff = isImpulse && direction === 'BEARISH' &&
      displacementAtr >= p.selloff_displacement_atr && volumeRatio !== null &&
      volumeRatio >= p.selloff_volume_ratio;
    const classification = isSelloff ? 'BEARISH_SELL_OFF' :
      isImpulse ? (direction === 'BEARISH' ? 'BEARISH_IMPULSE' : 'BULLISH_IMPULSE') :
      direction === 'NEUTRAL' ? 'NO_DIRECTIONAL_IMPULSE' : 'NO_CONFIRMED_IMPULSE';
    const impulse = {
      status: isImpulse ? 'CONFIRMED' : 'NOT_CONFIRMED',
      classification, direction,
      window_start_open_time_ms: candles[start].open_time_ms,
      window_end_close_time_ms: candles[end].close_time_ms,
      metrics: {
        atr_before_window: atr, displacement_price: displacement, displacement_atr: displacementAtr,
        range_expansion_atr: rangeAtr, volume_ratio: volumeRatio,
        directional_body_ratio: directionalBodyRatio, aligned_bar_ratio: alignedBarRatio
      },
      evidence_flags: flags,
      evidence_positive_count: positive,
      evidence_available_count: available
    };
    let supportBreak = { status: 'NOT_ASSESSED', zone_id: null, boundary_price: null, breakout_quality: null };
    const zones = input.zone_context && input.zone_context.zones;
    const breakoutQuality = input.breakout_quality;
    if (isObject(input.zone_context) && input.zone_context.status === 'VALID' &&
        input.zone_context.snapshot_id === snapshot.snapshot_id &&
        input.zone_context.symbol === snapshot.canonical_symbol &&
        input.zone_context.timeframe === timeframe && input.zone_context.analysis_as_of_ms === asOf &&
        Array.isArray(zones)) {
      const broken = zones.filter(z => isObject(z) && z.role === 'SUPPORT' &&
        z.is_active === true && z.freshness_status !== 'STALE' &&
        Number.isFinite(z.lower_bound) && candles[end].close < z.lower_bound)
        .sort((a, b) => b.lower_bound - a.lower_bound);
      if (broken.length) {
        const zone = broken[0];
        const matched = isObject(breakoutQuality) && breakoutQuality.status === 'VALID' &&
          breakoutQuality.snapshot_id === snapshot.snapshot_id &&
          breakoutQuality.symbol === snapshot.canonical_symbol &&
          breakoutQuality.timeframe === timeframe && breakoutQuality.analysis_as_of_ms === asOf &&
          Array.isArray(breakoutQuality.breakouts)
          ? breakoutQuality.breakouts.find(b => b.direction === 'BEARISH' &&
              b.original_zone_role === 'SUPPORT' &&
              b.zone_lower_bound === zone.lower_bound && b.zone_upper_bound === zone.upper_bound &&
              b.quality_status === 'STRONG_EVIDENCE')
          : null;
        supportBreak = {
          status: matched ? 'CONFIRMED_BREAKDOWN' : 'SUPPORT_CLOSE_BELOW_UNVERIFIED',
          zone_id: zone.zone_id || null, boundary_price: zone.lower_bound,
          breakout_quality: matched ? matched.quality_status : null,
          breakout_event_id: matched ? matched.breakout_event_id : null
        };
      }
    }
    return freezeDeep({
      engine_version: ENGINE_VERSION, policy_version: p.version, status: 'VALID',
      admission: { status: 'ADMITTED', snapshot_id: snapshot.snapshot_id },
      snapshot_id: snapshot.snapshot_id, symbol: snapshot.canonical_symbol, timeframe,
      analysis_as_of_ms: asOf, current_close: candles[end].close,
      impulse, support_break: supportBreak,
      diagnostics: { candle_count: candles.length, window_candle_count: window.length,
        positive_evidence_count: positive, available_evidence_count: available }
    });
  }

  return Object.freeze({ ENGINE_VERSION, analyze });
});
