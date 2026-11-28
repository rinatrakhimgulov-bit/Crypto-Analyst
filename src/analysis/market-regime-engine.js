(function attachMarketRegimeEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MarketRegimeEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMarketRegimeEngine() {
  'use strict';

  const ENGINE_VERSION = '1.0.0-market-regime';
  const TIMEFRAME_MS = Object.freeze({ '1h': 3600000, '4h': 14400000, '1d': 86400000 });
  const CLOSED_STATES = new Set(['CONFIRMED', 'TIME_DERIVED']);
  const REGIMES = Object.freeze(['UPTREND', 'DOWNTREND', 'RANGE', 'IMPULSE', 'TRANSITION', 'UNKNOWN']);
  const REQUIRED_STRUCTURE_ENGINE_VERSION = '2.1.0-b2c';
  const REQUIRED_STRUCTURE_POLICY_VERSION = 'b2c-state-v2';

  function isObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) freezeDeep(value[key]);
    return value;
  }

  function blocked(status, code, meta = {}) {
    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: meta.policyVersion || null,
      status,
      regime: 'UNKNOWN',
      directional_bias: 'NONE',
      evidence_alignment: 'NONE',
      admission: { status: 'BLOCKED', reasons: [{ code, severity: 'CRITICAL' }] },
      snapshot_id: meta.snapshotId || null,
      symbol: meta.symbol || null,
      timeframe: meta.timeframe || null,
      analysis_as_of_ms: meta.analysisAsOfMs ?? null,
      structure_state: 'UNAVAILABLE',
      features: null,
      reasons: [code],
      diagnostics: { candle_count: 0, required_candle_count: meta.requiredCandleCount ?? null }
    });
  }

  function validatePolicy(policy) {
    if (!isObject(policy) || typeof policy.version !== 'string' || !policy.version.trim()) return 'REGIME_POLICY_INVALID';
    const positiveIntegers = [
      'ema_fast_period', 'ema_mid_period', 'ema_slow_period', 'atr_period',
      'slope_lookback', 'range_lookback', 'impulse_lookback'
    ];
    for (const key of positiveIntegers) {
      if (!Number.isSafeInteger(policy[key]) || policy[key] < 2) return 'REGIME_POLICY_' + key.toUpperCase() + '_INVALID';
    }
    if (!(policy.ema_fast_period < policy.ema_mid_period && policy.ema_mid_period < policy.ema_slow_period)) return 'REGIME_POLICY_EMA_ORDER_INVALID';
    if (typeof policy.b1_contract_version !== 'string' || !policy.b1_contract_version.trim() ||
        typeof policy.b1_validator_version !== 'string' || !policy.b1_validator_version.trim() ||
        typeof policy.b1_quality_policy_version !== 'string' || !policy.b1_quality_policy_version.trim() ||
        policy.structure_engine_version !== REQUIRED_STRUCTURE_ENGINE_VERSION ||
        policy.structure_policy_version !== REQUIRED_STRUCTURE_POLICY_VERSION ||
        !Number.isSafeInteger(policy.finality_safety_lag_ms) || policy.finality_safety_lag_ms < 0) return 'REGIME_POLICY_B1_BINDING_INVALID';

    const positiveThresholds = [
      'trend_min_ema50_slope_atr', 'trend_min_ema200_slope_atr',
      'trend_min_fast_mid_spread_atr', 'trend_min_mid_slow_spread_atr',
      'range_max_width_atr', 'range_max_ema50_slope_atr',
      'range_max_mid_slow_spread_atr', 'impulse_min_move_atr',
      'impulse_min_range_expansion'
    ];
    for (const key of positiveThresholds) {
      if (!Number.isFinite(policy[key]) || policy[key] <= 0) return 'REGIME_POLICY_' + key.toUpperCase() + '_INVALID';
    }
    return null;
  }

  function validateCandle(candle, snapshot, timeframe, stepMs, asOf, lagMs) {
    if (!isObject(candle)) return 'CANDLE_NOT_OBJECT';
    if (!Number.isSafeInteger(candle.open_time_ms) || !Number.isSafeInteger(candle.close_time_ms)) return 'CANDLE_TIME_INVALID';
    if (candle.close_time_ms - candle.open_time_ms !== stepMs || candle.open_time_ms % stepMs !== 0) return 'CANDLE_ALIGNMENT_INVALID';
    if (candle.close_time_ms + lagMs > asOf) return 'CANDLE_NOT_FINAL_AT_ANALYSIS_CUTOFF';
    if (!CLOSED_STATES.has(candle.closed_state)) return 'CANDLE_NOT_CLOSED';
    if (candle.canonical_symbol !== snapshot.canonical_symbol || candle.market_type !== snapshot.market_type || candle.timeframe !== timeframe) return 'CANDLE_PROVENANCE_MISMATCH';
    if (['open', 'high', 'low', 'close'].some(key => !Number.isFinite(candle[key]) || candle[key] <= 0)) return 'CANDLE_PRICE_INVALID';
    if (candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close) || candle.high < candle.low) return 'CANDLE_OHLC_INVALID';
    if (!Number.isFinite(candle.volume_base) || candle.volume_base < 0 || !Number.isFinite(candle.volume_quote) || candle.volume_quote < 0) return 'CANDLE_VOLUME_INVALID';
    return null;
  }

  function ema(values, period) {
    if (values.length < period) return [];
    const out = new Array(values.length).fill(null);
    const multiplier = 2 / (period + 1);
    let seed = 0;
    for (let i = 0; i < period; i++) seed += values[i];
    let current = seed / period;
    out[period - 1] = current;
    for (let i = period; i < values.length; i++) {
      current = values[i] * multiplier + current * (1 - multiplier);
      out[i] = current;
    }
    return out;
  }

  function atr(candles, period) {
    if (candles.length < period + 1) return [];
    const tr = new Array(candles.length).fill(null);
    for (let i = 1; i < candles.length; i++) {
      const candle = candles[i];
      const previousClose = candles[i - 1].close;
      tr[i] = Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - previousClose),
        Math.abs(candle.low - previousClose)
      );
    }
    const out = new Array(candles.length).fill(null);
    let seed = 0;
    for (let i = 1; i <= period; i++) seed += tr[i];
    let current = seed / period;
    out[period] = current;
    for (let i = period + 1; i < candles.length; i++) {
      current = (current * (period - 1) + tr[i]) / period;
      out[i] = current;
    }
    return out;
  }

  function maxHigh(candles, start, end) {
    let value = -Infinity;
    for (let i = start; i <= end; i++) value = Math.max(value, candles[i].high);
    return value;
  }

  function minLow(candles, start, end) {
    let value = Infinity;
    for (let i = start; i <= end; i++) value = Math.min(value, candles[i].low);
    return value;
  }

  function validateStructure(structure, snapshot, timeframe, asOf) {
    if (structure == null) return { state: 'NOT_PROVIDED', reason: 'STRUCTURE_NOT_PROVIDED' };
    if (!isObject(structure) || structure.status !== 'VALID' ||
        structure.engine_version !== REQUIRED_STRUCTURE_ENGINE_VERSION ||
        structure.policy_version !== REQUIRED_STRUCTURE_POLICY_VERSION ||
        structure.snapshot_id !== snapshot.snapshot_id || structure.symbol !== snapshot.canonical_symbol ||
        structure.timeframe !== timeframe || structure.analysis_as_of_ms !== asOf ||
        !isObject(structure.admission) || structure.admission.status !== 'ADMITTED' ||
        structure.admission.snapshot_id !== snapshot.snapshot_id ||
        !['UP', 'DOWN', 'UNESTABLISHED'].includes(structure.structure_state)) {
      return { error: 'STRUCTURE_RESULT_IDENTITY_OR_STATUS_INVALID' };
    }
    return { state: structure.structure_state, reason: null };
  }

  function analyze(input) {
    const policy = input && input.policy;
    const policyError = validatePolicy(policy);
    if (policyError) return blocked('INVALID', policyError, { policyVersion: policy && policy.version });

    const snapshot = input && input.snapshot;
    const report = input && input.quality_report;
    const asOf = input && input.analysis_as_of_ms;
    const meta = {
      policyVersion: policy.version,
      snapshotId: snapshot && snapshot.snapshot_id,
      symbol: snapshot && snapshot.canonical_symbol,
      timeframe: input && input.timeframe,
      analysisAsOfMs: asOf
    };
    if (!isObject(snapshot) || !isObject(report)) return blocked('INVALID', 'REGIME_INPUT_MISSING', meta);
    if (!Number.isSafeInteger(asOf) || asOf <= 0 || snapshot.analysis_as_of_ms !== asOf ||
        snapshot.provider_server_time_ms !== asOf || !isObject(snapshot.provider_metadata) ||
        snapshot.provider_metadata.time_source !== 'provider') return blocked('INVALID', 'ANALYSIS_CUTOFF_INVALID', meta);
    if (typeof snapshot.snapshot_id !== 'string' || !snapshot.snapshot_id ||
        snapshot.contract_version !== policy.b1_contract_version ||
        typeof snapshot.canonical_symbol !== 'string' || !snapshot.canonical_symbol ||
        typeof snapshot.market_type !== 'string' || !snapshot.market_type) return blocked('INVALID', 'SNAPSHOT_IDENTITY_INVALID', meta);

    const timeframeKeys = Object.keys(snapshot.candles_by_timeframe || {});
    const timeframe = timeframeKeys.length === 1 ? timeframeKeys[0] : null;
    const stepMs = TIMEFRAME_MS[timeframe];
    meta.timeframe = timeframe;
    if (!stepMs || (input.timeframe && input.timeframe !== timeframe)) return blocked('INVALID', 'TIMEFRAME_SCOPE_INVALID', meta);

    const reportMatches = report.snapshot_id === snapshot.snapshot_id &&
      report.symbol === snapshot.canonical_symbol && report.timeframe === timeframe &&
      report.analysis_as_of_ms === asOf && report.validator_version === policy.b1_validator_version &&
      report.policy_version === policy.b1_quality_policy_version &&
      Number.isSafeInteger(report.checked_at_ms) && report.checked_at_ms >= 0;
    if (!reportMatches) return blocked('INVALID', 'QUALITY_REPORT_IDENTITY_MISMATCH', meta);
    if (report.status !== 'VALID') return blocked('BLOCKED', 'QUALITY_' + String(report.status || 'UNKNOWN'), meta);

    const closedMap = snapshot.candles_by_timeframe;
    const formingMap = snapshot.forming_candle_by_timeframe;
    const unknownMap = snapshot.unclassified_candles_by_timeframe;
    if (!isObject(closedMap) || !Array.isArray(closedMap[timeframe]) ||
        !isObject(formingMap) || !Object.prototype.hasOwnProperty.call(formingMap, timeframe) ||
        !isObject(unknownMap) || !Array.isArray(unknownMap[timeframe])) return blocked('INVALID', 'CANDLE_COLLECTION_INVALID', meta);

    const candles = closedMap[timeframe];
    if (report.closed_count !== candles.length || report.valid_count < candles.length || report.insufficient_history === true) {
      return blocked('INVALID', 'QUALITY_CANDLE_COUNT_MISMATCH', meta);
    }
    const requiredCount = Math.max(
      policy.ema_slow_period + policy.slope_lookback,
      policy.atr_period + 1,
      policy.range_lookback + 1,
      policy.impulse_lookback + 1
    );
    if (candles.length < requiredCount) {
      return blocked('INSUFFICIENT', 'HISTORY_TOO_SHORT_FOR_REGIME_FEATURES', {
        ...meta, timeframe, requiredCandleCount: requiredCount
      });
    }

    const seenTimes = new Set();
    for (let i = 0; i < candles.length; i++) {
      const error = validateCandle(candles[i], snapshot, timeframe, stepMs, asOf, policy.finality_safety_lag_ms);
      if (error) return blocked('INVALID', error, meta);
      if (seenTimes.has(candles[i].open_time_ms) ||
          (i > 0 && candles[i].open_time_ms - candles[i - 1].open_time_ms !== stepMs)) {
        return blocked('INVALID', 'CANDLE_ORDER_GAP_OR_DUPLICATE_INVALID', meta);
      }
      seenTimes.add(candles[i].open_time_ms);
    }
    const excluded = [formingMap[timeframe], ...unknownMap[timeframe]].filter(Boolean);
    for (const candle of excluded) {
      if (!isObject(candle) || seenTimes.has(candle.open_time_ms)) return blocked('INVALID', 'FORMING_OR_UNKNOWN_CANDLE_OVERLAP', meta);
    }

    const structure = validateStructure(input.structure_result, snapshot, timeframe, asOf);
    if (structure.error) return blocked('INVALID', structure.error, meta);

    const closes = candles.map(c => c.close);
    const emaFast = ema(closes, policy.ema_fast_period);
    const emaMid = ema(closes, policy.ema_mid_period);
    const emaSlow = ema(closes, policy.ema_slow_period);
    const atrValues = atr(candles, policy.atr_period);
    const last = candles.length - 1;
    const atrNow = atrValues[last];
    const slopeIndex = last - policy.slope_lookback;
    const ema50SlopeAtr = (emaMid[last] - emaMid[slopeIndex]) / atrNow;
    const ema200SlopeAtr = (emaSlow[last] - emaSlow[slopeIndex]) / atrNow;
    const fastMidSpreadAtr = (emaFast[last] - emaMid[last]) / atrNow;
    const midSlowSpreadAtr = (emaMid[last] - emaSlow[last]) / atrNow;
    const rangeStart = last - policy.range_lookback + 1;
    const rangeWidthAtr = (maxHigh(candles, rangeStart, last) - minLow(candles, rangeStart, last)) / atrNow;
    const impulseStart = last - policy.impulse_lookback;
    const impulseMoveAtr = (candles[last].close - candles[impulseStart].close) / atrNow;
    const recentRangeStart = Math.max(1, last - policy.impulse_lookback + 1);
    let recentRangeSum = 0;
    for (let i = recentRangeStart; i <= last; i++) recentRangeSum += candles[i].high - candles[i].low;
    const recentRangeExpansion = (recentRangeSum / (last - recentRangeStart + 1)) / atrNow;

    const bullishAlignment = emaFast[last] > emaMid[last] && emaMid[last] > emaSlow[last] &&
      closes[last] > emaFast[last] && ema50SlopeAtr >= policy.trend_min_ema50_slope_atr &&
      ema200SlopeAtr >= policy.trend_min_ema200_slope_atr &&
      fastMidSpreadAtr >= policy.trend_min_fast_mid_spread_atr &&
      midSlowSpreadAtr >= policy.trend_min_mid_slow_spread_atr;
    const bearishAlignment = emaFast[last] < emaMid[last] && emaMid[last] < emaSlow[last] &&
      closes[last] < emaFast[last] && ema50SlopeAtr <= -policy.trend_min_ema50_slope_atr &&
      ema200SlopeAtr <= -policy.trend_min_ema200_slope_atr &&
      fastMidSpreadAtr <= -policy.trend_min_fast_mid_spread_atr &&
      midSlowSpreadAtr <= -policy.trend_min_mid_slow_spread_atr;

    const impulse = Math.abs(impulseMoveAtr) >= policy.impulse_min_move_atr &&
      recentRangeExpansion >= policy.impulse_min_range_expansion;
    const narrowRange = rangeWidthAtr <= policy.range_max_width_atr &&
      Math.abs(ema50SlopeAtr) <= policy.range_max_ema50_slope_atr &&
      Math.abs(midSlowSpreadAtr) <= policy.range_max_mid_slow_spread_atr;

    let regime = 'TRANSITION';
    let bias = 'NEUTRAL';
    let evidenceAlignment = 'PARTIAL';
    const reasons = [];

    if (impulse) {
      regime = 'IMPULSE';
      bias = impulseMoveAtr > 0 ? 'BULLISH' : 'BEARISH';
      evidenceAlignment = 'PARTIAL';
      reasons.push('RANGE_EXPANSION_WITH_DIRECTIONAL_DISPLACEMENT');
    } else if (bullishAlignment && structure.state === 'UP') {
      regime = 'UPTREND';
      bias = 'BULLISH';
      evidenceAlignment = 'CONVERGENT';
      reasons.push('EMA_STACK_BULLISH', 'EMA_SLOPES_BULLISH', 'STRUCTURE_UP');
    } else if (bearishAlignment && structure.state === 'DOWN') {
      regime = 'DOWNTREND';
      bias = 'BEARISH';
      evidenceAlignment = 'CONVERGENT';
      reasons.push('EMA_STACK_BEARISH', 'EMA_SLOPES_BEARISH', 'STRUCTURE_DOWN');
    } else if (narrowRange && (structure.state === 'UNESTABLISHED' || structure.state === 'NOT_PROVIDED')) {
      regime = 'RANGE';
      bias = 'NEUTRAL';
      evidenceAlignment = structure.state === 'NOT_PROVIDED' ? 'PARTIAL' : 'CONVERGENT';
      reasons.push('RANGE_WIDTH_COMPRESSED', 'TREND_SLOPE_WEAK', 'EMA_SPREAD_COMPRESSED');
    } else {
      if (bullishAlignment || bearishAlignment) reasons.push('EMA_STRUCTURE_CONFLICT_OR_UNAVAILABLE');
      else reasons.push('NO_DOMINANT_REGIME_SIGNATURE');
      if (structure.state === 'NOT_PROVIDED') reasons.push('STRUCTURE_NOT_PROVIDED');
      else if (structure.state === 'UNESTABLISHED') reasons.push('STRUCTURE_UNESTABLISHED');
      else if ((structure.state === 'UP' && bearishAlignment) || (structure.state === 'DOWN' && bullishAlignment)) reasons.push('STRUCTURE_EMA_CONFLICT');
    }

    const features = {
      close: closes[last],
      ema_fast: emaFast[last],
      ema_mid: emaMid[last],
      ema_slow: emaSlow[last],
      atr: atrNow,
      ema50_slope_atr: ema50SlopeAtr,
      ema200_slope_atr: ema200SlopeAtr,
      fast_mid_spread_atr: fastMidSpreadAtr,
      mid_slow_spread_atr: midSlowSpreadAtr,
      range_width_atr: rangeWidthAtr,
      impulse_move_atr: impulseMoveAtr,
      recent_range_expansion: recentRangeExpansion
    };

    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: policy.version,
      status: 'VALID',
      regime,
      directional_bias: bias,
      evidence_alignment: evidenceAlignment,
      admission: {
        status: 'ADMITTED', snapshot_id: snapshot.snapshot_id,
        b1_validator_version: report.validator_version,
        b1_quality_policy_version: report.policy_version,
        structure_status: structure.state === 'NOT_PROVIDED' ? 'NOT_PROVIDED' : 'VALID'
      },
      snapshot_id: snapshot.snapshot_id,
      symbol: snapshot.canonical_symbol,
      timeframe,
      analysis_as_of_ms: asOf,
      structure_state: structure.state,
      features,
      reasons,
      diagnostics: {
        candle_count: candles.length,
        required_candle_count: requiredCount,
        used_closed_candles_only: true,
        forming_candle_excluded: true,
        quality_status: report.status
      }
    });
  }

  return Object.freeze({ ENGINE_VERSION, REGIMES, REQUIRED_STRUCTURE_ENGINE_VERSION, analyze });
});