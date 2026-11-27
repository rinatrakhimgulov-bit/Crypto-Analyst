(function attachB2CausalSwingEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B2CausalSwingEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createB2CausalSwingEngine() {
  'use strict';
  const ENGINE_VERSION = '2.0.0-b2a';
  const TIMEFRAME_MS = Object.freeze({ '1h': 3600000, '4h': 14400000, '1d': 86400000 });
  const CLOSED_STATES = new Set(['CONFIRMED', 'TIME_DERIVED']);

  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) freezeDeep(value[key]);
    return value;
  }
  function blocked(status, reasons, meta = {}) {
    return freezeDeep({
      engine_version: ENGINE_VERSION, policy_version: meta.policyVersion || null, status,
      admission: { status: 'BLOCKED', reasons }, snapshot_id: meta.snapshotId || null,
      symbol: meta.symbol || null, timeframe: meta.timeframe || null,
      analysis_as_of_ms: meta.analysisAsOfMs ?? null, pivots: [], diagnostics: meta.diagnostics || {}
    });
  }
  function isObject(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
  function validatePolicy(policy) {
    if (!isObject(policy)) return 'POLICY_MISSING';
    if (typeof policy.version !== 'string' || !policy.version.trim()) return 'POLICY_VERSION_INVALID';
    if (typeof policy.b1_quality_policy_version !== 'string' || !policy.b1_quality_policy_version.trim()) return 'B1_QUALITY_POLICY_VERSION_MISSING';
    if (!Number.isSafeInteger(policy.left_strength) || policy.left_strength < 1 || policy.left_strength > 50) return 'LEFT_STRENGTH_INVALID';
    if (!Number.isSafeInteger(policy.right_strength) || policy.right_strength < 1 || policy.right_strength > 50) return 'RIGHT_STRENGTH_INVALID';
    if (!Number.isSafeInteger(policy.finality_safety_lag_ms) || policy.finality_safety_lag_ms < 0) return 'FINALITY_LAG_INVALID';
    if (policy.price_equality_policy !== 'EXACT_PRICE_V1') return 'PRICE_EQUALITY_POLICY_UNSUPPORTED';
    return null;
  }
  function timeframeFor(snapshot, requested) {
    const keys = Object.keys(snapshot.candles_by_timeframe || {});
    if (keys.length !== 1) return null;
    if (requested && requested !== keys[0]) return null;
    return keys[0];
  }
  function validateCandle(candle, snapshot, timeframe, stepMs, analysisAsOfMs, lagMs) {
    if (!isObject(candle)) return 'CANDLE_NOT_OBJECT';
    if (!Number.isSafeInteger(candle.open_time_ms) || !Number.isSafeInteger(candle.close_time_ms)) return 'CANDLE_TIME_INVALID';
    if (candle.close_time_ms - candle.open_time_ms !== stepMs) return 'CANDLE_DURATION_INVALID';
    if (candle.open_time_ms % stepMs !== 0) return 'CANDLE_ALIGNMENT_INVALID';
    if (candle.close_time_ms > analysisAsOfMs) return 'CANDLE_AFTER_ANALYSIS_CUTOFF';
    if (candle.close_time_ms + lagMs > analysisAsOfMs) return 'CANDLE_NOT_FINAL_AT_ANALYSIS_CUTOFF';
    if (!CLOSED_STATES.has(candle.closed_state)) return 'CANDLE_NOT_CLOSED';
    if (candle.canonical_symbol !== snapshot.canonical_symbol || candle.market_type !== snapshot.market_type || candle.timeframe !== timeframe) return 'CANDLE_PROVENANCE_MISMATCH';
    if (['open', 'high', 'low', 'close'].some(k => !Number.isFinite(candle[k]) || candle[k] <= 0)) return 'CANDLE_PRICE_INVALID';
    if (candle.high < Math.max(candle.open, candle.close, candle.low) || candle.low > Math.min(candle.open, candle.close, candle.high) || candle.high < candle.low) return 'CANDLE_OHLC_INVALID';
    return null;
  }
  function detectType(candles, type, leftStrength, rightStrength, asOf, lagMs, timeframe) {
    const key = type === 'SWING_HIGH' ? 'high' : 'low';
    const moreExtreme = type === 'SWING_HIGH' ? (a, b) => a > b : (a, b) => a < b;
    const pivots = [];
    let i = 0;
    while (i < candles.length) {
      const price = candles[i][key];
      let end = i;
      while (end + 1 < candles.length && candles[end + 1][key] === price) end++;
      const rightEnd = end + rightStrength;
      if (i - leftStrength >= 0 && rightEnd < candles.length) {
        let qualifies = true;
        for (let j = i - leftStrength; j < i && qualifies; j++) if (!moreExtreme(price, candles[j][key])) qualifies = false;
        for (let j = end + 1; j <= rightEnd && qualifies; j++) if (!moreExtreme(price, candles[j][key])) qualifies = false;
        if (qualifies) {
          const representative = candles[end];
          const confirmedAt = candles[rightEnd].close_time_ms;
          const availableAt = confirmedAt + lagMs;
          if (availableAt <= asOf) pivots.push({
            pivot_id: ['B2A', timeframe, type, candles[i].open_time_ms, representative.open_time_ms, String(price)].join(':'),
            type, price, source_time_ms: representative.open_time_ms, source_index: end,
            plateau_start_time_ms: candles[i].open_time_ms, plateau_end_time_ms: representative.open_time_ms,
            plateau_start_index: i, plateau_end_index: end,
            confirmed_at_ms: confirmedAt, available_at_ms: availableAt,
            confirmation: {
              method: 'CLOSED_CANDLE_SYMMETRIC_WINDOW', left_strength: leftStrength,
              right_strength: rightStrength, equality_policy: 'EXACT_PRICE_V1', finality_safety_lag_ms: lagMs
            }
          });
        }
      }
      i = end + 1;
    }
    return pivots;
  }
  function analyze(input) {
    const policy = input && input.policy;
    const policyError = validatePolicy(policy);
    if (policyError) return blocked('INVALID', [{ code: policyError, severity: 'CRITICAL' }], { policyVersion: policy && policy.version });
    const snapshot = input && input.snapshot;
    const report = input && input.quality_report;
    const requestedTf = input && input.timeframe;
    const asOf = input && input.analysis_as_of_ms;
    const meta = { policyVersion: policy.version, snapshotId: snapshot && snapshot.snapshot_id, symbol: snapshot && snapshot.canonical_symbol, timeframe: requestedTf, analysisAsOfMs: asOf };
    if (!isObject(snapshot) || !isObject(report)) return blocked('INVALID', [{ code: 'SNAPSHOT_OR_QUALITY_REPORT_MISSING', severity: 'CRITICAL' }], meta);
    if (!Number.isSafeInteger(asOf) || asOf <= 0 || snapshot.analysis_as_of_ms !== asOf || snapshot.provider_server_time_ms !== asOf || !snapshot.provider_metadata || snapshot.provider_metadata.time_source !== 'provider') {
      return blocked('INVALID', [{ code: 'ANALYSIS_CUTOFF_INVALID', severity: 'CRITICAL' }], meta);
    }
    if (typeof snapshot.snapshot_id !== 'string' || !snapshot.snapshot_id || typeof snapshot.contract_version !== 'string' ||
        typeof snapshot.canonical_symbol !== 'string' || !snapshot.canonical_symbol || typeof snapshot.market_type !== 'string' || !snapshot.market_type) {
      return blocked('INVALID', [{ code: 'SNAPSHOT_IDENTITY_INVALID', severity: 'CRITICAL' }], meta);
    }
    const timeframe = timeframeFor(snapshot, requestedTf);
    const stepMs = TIMEFRAME_MS[timeframe];
    meta.timeframe = timeframe || requestedTf;
    if (!stepMs) return blocked('INVALID', [{ code: 'TIMEFRAME_SCOPE_INVALID', severity: 'CRITICAL' }], meta);
    const reportMatches = report.snapshot_id === snapshot.snapshot_id && report.symbol === snapshot.canonical_symbol &&
      report.timeframe === timeframe && report.analysis_as_of_ms === asOf && report.policy_version === policy.b1_quality_policy_version &&
      typeof report.validator_version === 'string' && report.validator_version.length > 0 &&
      typeof report.policy_version === 'string' && report.policy_version.length > 0 &&
      Number.isSafeInteger(report.checked_at_ms) && report.checked_at_ms >= 0;
    if (!reportMatches) return blocked('INVALID', [{ code: 'QUALITY_REPORT_IDENTITY_MISMATCH', severity: 'CRITICAL' }], meta);
    if (report.status !== 'VALID') return blocked('BLOCKED', [{ code: 'QUALITY_STATUS_NOT_VALID', severity: 'CRITICAL', quality_status: report.status || 'MISSING' }], meta);
    const closedMap = snapshot.candles_by_timeframe;
    const formingMap = snapshot.forming_candle_by_timeframe;
    const unknownMap = snapshot.unclassified_candles_by_timeframe;
    if (!isObject(closedMap) || !isObject(formingMap) || !isObject(unknownMap) ||
        !Object.prototype.hasOwnProperty.call(formingMap, timeframe) || !Object.prototype.hasOwnProperty.call(unknownMap, timeframe) ||
        !Array.isArray(closedMap[timeframe]) || !(formingMap[timeframe] === null || isObject(formingMap[timeframe])) || !Array.isArray(unknownMap[timeframe])) {
      return blocked('INVALID', [{ code: 'CANDLE_COLLECTION_INVALID', severity: 'CRITICAL' }], meta);
    }
    const candles = closedMap[timeframe];
    if (report.closed_count !== candles.length || report.valid_count < candles.length || report.insufficient_history === true) {
      return blocked('INVALID', [{ code: 'QUALITY_CANDLE_COUNT_MISMATCH', severity: 'CRITICAL' }], meta);
    }
    const seen = new Set();
    for (let i = 0; i < candles.length; i++) {
      const error = validateCandle(candles[i], snapshot, timeframe, stepMs, asOf, policy.finality_safety_lag_ms);
      if (error) return blocked('INVALID', [{ code: error, severity: 'CRITICAL', index: i }], meta);
      if (seen.has(candles[i].open_time_ms)) return blocked('INVALID', [{ code: 'CANDLE_DUPLICATE_TIMESTAMP', severity: 'CRITICAL', timestamp_ms: candles[i].open_time_ms }], meta);
      if (i > 0 && candles[i].open_time_ms <= candles[i - 1].open_time_ms) return blocked('INVALID', [{ code: 'CANDLE_ORDER_INVALID', severity: 'CRITICAL', index: i }], meta);
      seen.add(candles[i].open_time_ms);
    }
    const excluded = [formingMap[timeframe], ...unknownMap[timeframe]].filter(Boolean);
    for (const candle of excluded) if (!isObject(candle) || seen.has(candle.open_time_ms)) {
      return blocked('INVALID', [{ code: 'FORMING_OR_UNKNOWN_CANDLE_OVERLAPS_CLOSED_SET', severity: 'CRITICAL' }], meta);
    }
    const required = policy.left_strength + policy.right_strength + 1;
    if (candles.length < required) return blocked('INSUFFICIENT', [{
      code: 'INSUFFICIENT_PIVOT_HISTORY', severity: 'INSUFFICIENT', required_count: required, received_count: candles.length
    }], { ...meta, diagnostics: { required_history_count: required, received_history_count: candles.length } });
    const pivots = [
      ...detectType(candles, 'SWING_HIGH', policy.left_strength, policy.right_strength, asOf, policy.finality_safety_lag_ms, timeframe),
      ...detectType(candles, 'SWING_LOW', policy.left_strength, policy.right_strength, asOf, policy.finality_safety_lag_ms, timeframe)
    ].sort((a, b) => a.available_at_ms - b.available_at_ms || a.source_time_ms - b.source_time_ms || a.type.localeCompare(b.type));
    return freezeDeep({
      engine_version: ENGINE_VERSION, policy_version: policy.version, status: 'VALID',
      admission: { status: 'ADMITTED', snapshot_id: snapshot.snapshot_id, quality_report: {
        snapshot_id: report.snapshot_id, validator_version: report.validator_version,
        policy_version: report.policy_version, checked_at_ms: report.checked_at_ms
      }},
      snapshot_id: snapshot.snapshot_id, symbol: snapshot.canonical_symbol, timeframe, analysis_as_of_ms: asOf,
      parameters: { left_strength: policy.left_strength, right_strength: policy.right_strength,
        finality_safety_lag_ms: policy.finality_safety_lag_ms, price_equality_policy: policy.price_equality_policy },
      pivots,
      diagnostics: { closed_candle_count: candles.length, forming_candle_excluded: Boolean(formingMap[timeframe]),
        unknown_finality_count: unknownMap[timeframe].length, pivot_high_count: pivots.filter(p => p.type === 'SWING_HIGH').length,
        pivot_low_count: pivots.filter(p => p.type === 'SWING_LOW').length }
    });
  }
  return Object.freeze({ ENGINE_VERSION, TIMEFRAME_MS, analyze });
});
