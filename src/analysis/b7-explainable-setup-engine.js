(function attachB7ExplainableSetupEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B7ExplainableSetupEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createB7ExplainableSetupEngine() {
  'use strict';

  const ENGINE_VERSION = '1.0.0-b7';
  const REQUIRED = Object.freeze({
    b2a: '2.0.0-b2a', b2b: '2.2.0-b2b', b2c: '2.1.0-b2c',
    b2d: '2.0.0-b2d', b2e: '2.0.0-b2e'
  });
  const CLOSED_STATES = new Set(['CONFIRMED', 'TIME_DERIVED']);
  const TIMEFRAME_MS = Object.freeze({ '1h': 3600000, '4h': 14400000, '1d': 86400000 });
  const FOLLOWUP_STATUSES = new Set(['RETEST_SUCCESSFUL', 'RETEST_FAILED', 'WAITING_RETEST',
    'RETEST_PENDING_CONFIRMATION', 'RETEST_EXPIRED', 'RETEST_UNRESOLVED']);

  function isObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }
  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) freezeDeep(value[key]);
    return value;
  }
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function blocked(code, meta = {}) {
    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: meta.policyVersion || null,
      status: 'BLOCKED',
      admission: { status: 'BLOCKED', reasons: [{ code, severity: 'CRITICAL' }] },
      snapshot_id: meta.snapshotId || null,
      symbol: meta.symbol || null,
      timeframe: meta.timeframe || null,
      analysis_as_of_ms: meta.analysisAsOfMs ?? null,
      setup_candidates: [],
      latest_candle_features: null,
      diagnostics: { candidate_count: 0, confirmed_count: 0, pending_count: 0, input_candle_count: 0 }
    });
  }
  function validatePolicy(policy) {
    if (!isObject(policy) || policy.version !== 'b7-explainable-setups-v1') return 'B7_POLICY_INVALID';
    if (policy.b1_contract_version !== '1.1.0' ||
        policy.b1_validator_version !== '1.1.0' ||
        typeof policy.b1_quality_policy_version !== 'string' || !policy.b1_quality_policy_version.trim()) return 'B7_B1_POLICY_BINDING_INVALID';
    if (policy.b2a_engine_version !== REQUIRED.b2a || policy.b2b_engine_version !== REQUIRED.b2b ||
        policy.b2c_engine_version !== REQUIRED.b2c || policy.b2d_engine_version !== REQUIRED.b2d ||
        policy.b2e_engine_version !== REQUIRED.b2e) return 'B7_B2_ENGINE_BINDING_INVALID';
    if (typeof policy.b2a_policy_version !== 'string' || !policy.b2a_policy_version.trim() ||
        typeof policy.b2b_policy_version !== 'string' || !policy.b2b_policy_version.trim() ||
        typeof policy.b2c_policy_version !== 'string' || !policy.b2c_policy_version.trim() ||
        typeof policy.b2d_policy_version !== 'string' || !policy.b2d_policy_version.trim() ||
        typeof policy.b2e_policy_version !== 'string' || !policy.b2e_policy_version.trim()) return 'B7_B2_POLICY_BINDING_INVALID';
    if (!Number.isSafeInteger(policy.finality_safety_lag_ms) || policy.finality_safety_lag_ms < 0) return 'B7_FINALITY_LAG_INVALID';
    const cp = policy.candle_feature_policy;
    if (!isObject(cp) || cp.version !== 'b7-candle-features-v1' ||
        !Number.isFinite(cp.rejection_wick_body_ratio) || cp.rejection_wick_body_ratio < 1 ||
        !Number.isFinite(cp.max_rejection_body_range_ratio) || cp.max_rejection_body_range_ratio <= 0 || cp.max_rejection_body_range_ratio > 1 ||
        !Number.isFinite(cp.bullish_close_location_min) || cp.bullish_close_location_min < 0 || cp.bullish_close_location_min > 1 ||
        !Number.isFinite(cp.bearish_close_location_max) || cp.bearish_close_location_max < 0 || cp.bearish_close_location_max > 1 ||
        !Number.isFinite(cp.doji_body_range_max) || cp.doji_body_range_max < 0 || cp.doji_body_range_max > 1 ||
        !Number.isSafeInteger(cp.volume_lookback) || cp.volume_lookback < 1 || cp.volume_lookback > 100 ||
        !Number.isSafeInteger(cp.correction_lookback_bars) || cp.correction_lookback_bars < 1 || cp.correction_lookback_bars > 10) {
      return 'B7_CANDLE_FEATURE_POLICY_INVALID';
    }
    if (!Number.isSafeInteger(policy.max_candidates) || policy.max_candidates < 1 || policy.max_candidates > 50) return 'B7_MAX_CANDIDATES_INVALID';
    return null;
  }
  function sameScope(result, snapshot, timeframe, asOf, engineVersion, policyVersion) {
    return isObject(result) && result.status === 'VALID' &&
      result.engine_version === engineVersion && result.policy_version === policyVersion &&
      result.snapshot_id === snapshot.snapshot_id && result.symbol === snapshot.canonical_symbol &&
      result.timeframe === timeframe && result.analysis_as_of_ms === asOf &&
      isObject(result.admission) && result.admission.status === 'ADMITTED' &&
      result.admission.snapshot_id === snapshot.snapshot_id;
  }
  function validateSnapshot(snapshot, report, timeframe, asOf, policy) {
    if (!isObject(snapshot) || !isObject(report)) return 'B7_B1_INPUT_MISSING';
    if (snapshot.contract_version !== policy.b1_contract_version ||
        typeof snapshot.snapshot_id !== 'string' || !snapshot.snapshot_id ||
        typeof snapshot.canonical_symbol !== 'string' || !snapshot.canonical_symbol ||
        snapshot.market_type !== 'linear_perpetual' ||
        snapshot.analysis_as_of_ms !== asOf || snapshot.provider_server_time_ms !== asOf ||
        !isObject(snapshot.provider_metadata) || snapshot.provider_metadata.time_source !== 'provider') return 'B7_SNAPSHOT_IDENTITY_INVALID';
    if (report.status !== 'VALID' || report.snapshot_id !== snapshot.snapshot_id ||
        report.symbol !== snapshot.canonical_symbol || report.timeframe !== timeframe ||
        report.analysis_as_of_ms !== asOf || report.validator_version !== policy.b1_validator_version ||
        report.policy_version !== policy.b1_quality_policy_version ||
        !Number.isSafeInteger(report.checked_at_ms)) return 'B7_QUALITY_REPORT_INVALID';
    const keys = Object.keys(snapshot.candles_by_timeframe || {});
    if (keys.length !== 1 || keys[0] !== timeframe || !TIMEFRAME_MS[timeframe]) return 'B7_TIMEFRAME_SCOPE_INVALID';
    const candles = snapshot.candles_by_timeframe[timeframe];
    if (!Array.isArray(candles) || candles.length < 25) return 'B7_INSUFFICIENT_CLOSED_CANDLES';
    const step = TIMEFRAME_MS[timeframe];
    let previousOpen = -1;
    for (const candle of candles) {
      if (!isObject(candle) || !Number.isSafeInteger(candle.open_time_ms) ||
          !Number.isSafeInteger(candle.close_time_ms) || candle.close_time_ms - candle.open_time_ms !== step ||
          candle.open_time_ms % step !== 0 || candle.close_time_ms + policy.finality_safety_lag_ms > asOf ||
          !CLOSED_STATES.has(candle.closed_state) ||
          candle.canonical_symbol !== snapshot.canonical_symbol || candle.market_type !== snapshot.market_type ||
          candle.timeframe !== timeframe || candle.open_time_ms <= previousOpen ||
          ['open', 'high', 'low', 'close'].some(key => !Number.isFinite(candle[key]) || candle[key] <= 0) ||
          candle.high < Math.max(candle.open, candle.close, candle.low) ||
          candle.low > Math.min(candle.open, candle.close, candle.high) || candle.high < candle.low) {
        return 'B7_CANDLE_NOT_CLOSED_OR_INVALID';
      }
      previousOpen = candle.open_time_ms;
      if (candle.volume_base != null && (!Number.isFinite(candle.volume_base) || candle.volume_base < 0)) return 'B7_VOLUME_INVALID';
    }
    return null;
  }
  function extractCandleFeatures(candles, index, policy) {
    const candle = candles[index];
    if (!isObject(candle)) return { status: 'UNAVAILABLE', reason: 'CANDLE_MISSING' };
    const range = candle.high - candle.low;
    if (!Number.isFinite(range) || range <= 0) return { status: 'UNAVAILABLE', reason: 'ZERO_OR_INVALID_RANGE' };
    const body = Math.abs(candle.close - candle.open);
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const bodyRangeRatio = body / range;
    const closeLocation = (candle.close - candle.low) / range;
    const previous = index > 0 ? candles[index - 1] : null;
    const bullish = candle.close > candle.open;
    const bearish = candle.close < candle.open;
    const previousBullish = previous ? previous.close > previous.open : false;
    const previousBearish = previous ? previous.close < previous.open : false;
    const bullishEngulfing = Boolean(previous && bullish && previousBearish &&
      candle.open <= previous.close && candle.close >= previous.open);
    const bearishEngulfing = Boolean(previous && bearish && previousBullish &&
      candle.open >= previous.close && candle.close <= previous.open);
    const cp = policy.candle_feature_policy;
    const hammer = body > 0 && lowerWick >= body * cp.rejection_wick_body_ratio &&
      upperWick <= body && bodyRangeRatio <= cp.max_rejection_body_range_ratio &&
      closeLocation >= cp.bullish_close_location_min;
    const shootingStar = body > 0 && upperWick >= body * cp.rejection_wick_body_ratio &&
      lowerWick <= body && bodyRangeRatio <= cp.max_rejection_body_range_ratio &&
      closeLocation <= cp.bearish_close_location_max;
    const doji = bodyRangeRatio <= cp.doji_body_range_max;
    let volumeRatio20 = null;
    let volumeStatus = 'UNAVAILABLE';
    if (index >= cp.volume_lookback && Number.isFinite(candle.volume_base)) {
      const prior = candles.slice(index - cp.volume_lookback, index).map(item => item.volume_base);
      if (prior.length === cp.volume_lookback && prior.every(Number.isFinite)) {
        const average = prior.reduce((sum, value) => sum + value, 0) / prior.length;
        if (average > 0) {
          volumeRatio20 = candle.volume_base / average;
          volumeStatus = 'AVAILABLE';
        } else volumeStatus = 'ZERO_BASELINE';
      } else volumeStatus = 'INVALID_BASELINE';
    } else if (index < cp.volume_lookback) volumeStatus = 'INSUFFICIENT_HISTORY';
    else volumeStatus = 'VOLUME_MISSING';
    return {
      status: 'VALID',
      body, range, upper_wick: upperWick, lower_wick: lowerWick,
      body_range_ratio: bodyRangeRatio, close_location: closeLocation,
      bullish, bearish, bullish_engulfing: bullishEngulfing,
      bearish_engulfing: bearishEngulfing, hammer, shooting_star: shootingStar,
      doji, volume_ratio_20: volumeRatio20, volume_status: volumeStatus
    };
  }
  function makeCandidate(fields) {
    return {
      setup_id: fields.setupId,
      setup_type: fields.setupType,
      direction: fields.direction,
      status: fields.status,
      available_at_ms: fields.availableAtMs,
      evidence: fields.evidence,
      reason_codes: fields.reasonCodes || [],
      explanation: fields.explanation,
      invalidation_level: fields.invalidationLevel == null ? null : fields.invalidationLevel
    };
  }
  function analyze(input) {
    const policy = input && input.policy;
    const snapshot = input && input.snapshot;
    const report = input && input.quality_report;
    const timeframe = input && input.timeframe;
    const asOf = input && input.analysis_as_of_ms;
    const meta = {
      policyVersion: policy && policy.version,
      snapshotId: snapshot && snapshot.snapshot_id,
      symbol: snapshot && snapshot.canonical_symbol,
      timeframe,
      analysisAsOfMs: asOf
    };
    if (!isObject(snapshot) || !isObject(report) || !isObject(input)) return blocked('B7_INPUT_MISSING', meta);
    if (!Number.isSafeInteger(asOf) || asOf <= 0) return blocked('B7_ANALYSIS_CUTOFF_INVALID', meta);
    const policyError = validatePolicy(policy);
    if (policyError) return blocked(policyError, meta);
    const snapshotError = validateSnapshot(snapshot, report, timeframe, asOf, policy);
    if (snapshotError) return blocked(snapshotError, meta);

    const b2a = input.b2a_result;
    const b2b = input.b2b_result;
    const b2c = input.b2c_result;
    const b2d = input.b2d_result;
    const b2e = input.b2e_result;
    if (!sameScope(b2a, snapshot, timeframe, asOf, REQUIRED.b2a, policy.b2a_policy_version) ||
        !Array.isArray(b2a.pivots)) return blocked('B7_B2A_BINDING_INVALID', meta);
    if (!sameScope(b2b, snapshot, timeframe, asOf, REQUIRED.b2b, policy.b2b_policy_version) ||
        !Array.isArray(b2b.sequence) || !Array.isArray(b2b.sequence_history)) return blocked('B7_B2B_BINDING_INVALID', meta);
    if (!sameScope(b2c, snapshot, timeframe, asOf, REQUIRED.b2c, policy.b2c_policy_version) ||
        !Array.isArray(b2c.events) || !['UP', 'DOWN', 'UNESTABLISHED'].includes(b2c.structure_state)) return blocked('B7_B2C_BINDING_INVALID', meta);
    if (!sameScope(b2d, snapshot, timeframe, asOf, REQUIRED.b2d, policy.b2d_policy_version) ||
        !Array.isArray(b2d.zones)) return blocked('B7_B2D_BINDING_INVALID', meta);
    if (!sameScope(b2e, snapshot, timeframe, asOf, REQUIRED.b2e, policy.b2e_policy_version) ||
        !Array.isArray(b2e.lifecycles)) return blocked('B7_B2E_BINDING_INVALID', meta);

    const candles = snapshot.candles_by_timeframe[timeframe];
    const lastIndex = candles.length - 1;
    const lastCandle = candles[lastIndex];
    const lastAvailableAt = lastCandle.close_time_ms + policy.finality_safety_lag_ms;
    if (lastAvailableAt > asOf) return blocked('B7_LATEST_CANDLE_NOT_AVAILABLE', meta);
    const latestFeatures = extractCandleFeatures(candles, lastIndex, policy);
    const setups = [];
    const seen = new Set();
    const add = candidate => {
      if (!candidate || !Number.isSafeInteger(candidate.available_at_ms) ||
          candidate.available_at_ms > asOf || seen.has(candidate.setup_id)) return;
      seen.add(candidate.setup_id);
      setups.push(candidate);
    };

    const breakoutEventsById = new Map();
    for (const event of b2c.events) {
      if (!isObject(event) || typeof event.event_id !== 'string' || !event.event_id) continue;
      if (!breakoutEventsById.has(event.event_id)) breakoutEventsById.set(event.event_id, event);
      else breakoutEventsById.set(event.event_id, null);
    }

    for (const lifecycle of b2e.lifecycles) {
      if (!isObject(lifecycle) || !FOLLOWUP_STATUSES.has(lifecycle.status) ||
          !isObject(lifecycle.historical_zone) || !isObject(lifecycle.confirmation) &&
          lifecycle.status !== 'WAITING_RETEST' && lifecycle.status !== 'RETEST_EXPIRED') continue;
      const zone = lifecycle.historical_zone;
      const event = breakoutEventsById.get(lifecycle.breakout_event_id);
      const expectedZoneRole = lifecycle.direction === 'BULLISH' ? 'RESISTANCE' :
        lifecycle.direction === 'BEARISH' ? 'SUPPORT' : null;
      if (!event || !expectedZoneRole || event.direction !== lifecycle.direction ||
          event.event_type !== lifecycle.breakout_event_type ||
          !Number.isSafeInteger(event.available_at_ms) || event.available_at_ms > asOf ||
          lifecycle.breakout_available_at_ms !== event.available_at_ms ||
          zone.role !== expectedZoneRole ||
          !Number.isFinite(lifecycle.failure_buffer_price) || lifecycle.failure_buffer_price < 0 ||
          !Number.isFinite(lifecycle.success_buffer_price) || lifecycle.success_buffer_price < 0 ||
          !Number.isFinite(zone.lower_bound) || !Number.isFinite(zone.upper_bound) ||
          zone.lower_bound <= 0 || zone.upper_bound < zone.lower_bound ||
          typeof zone.historical_zone_id !== 'string' || !zone.historical_zone_id ||
          typeof lifecycle.lifecycle_id !== 'string' || !lifecycle.lifecycle_id) continue;
      const confirmationCandle = lifecycle.confirmation && candles.find(candle =>
        candle.close_time_ms === lifecycle.confirmation.candle_close_time_ms);
      const confirmationIsCausal = Boolean(confirmationCandle &&
        confirmationCandle.close_time_ms + policy.finality_safety_lag_ms === lifecycle.confirmation.available_at_ms &&
        lifecycle.confirmation.available_at_ms <= asOf &&
        confirmationCandle.closed_state && CLOSED_STATES.has(confirmationCandle.closed_state) &&
        confirmationCandle.close === lifecycle.confirmation.candle_close);
      if (lifecycle.status === 'RETEST_SUCCESSFUL' && lifecycle.confirmation &&
          lifecycle.confirmation.outcome === 'SUCCESS' && confirmationIsCausal) {
        const bullish = lifecycle.direction === 'BULLISH';
        add(makeCandidate({
          setupId: 'B7:BREAKOUT_RETEST:' + lifecycle.lifecycle_id,
          setupType: 'BREAKOUT_RETEST',
          direction: bullish ? 'LONG' : 'SHORT',
          status: 'CONFIRMED',
          availableAtMs: lifecycle.confirmation.available_at_ms,
          invalidationLevel: bullish ? zone.lower_bound - lifecycle.failure_buffer_price :
            zone.upper_bound + lifecycle.failure_buffer_price,
          reasonCodes: ['B2E_RETEST_SUCCESSFUL'],
          explanation: 'Пробой подтверждён ретестом исторической зоны и закрытием свечи в направлении пробоя.',
          evidence: {
            lifecycle_id: lifecycle.lifecycle_id, breakout_event_id: lifecycle.breakout_event_id,
            breakout_event_type: lifecycle.breakout_event_type, historical_zone_id: zone.historical_zone_id,
            historical_zone_role: zone.role, touch: clone(lifecycle.touch),
            confirmation: clone(lifecycle.confirmation), direction: lifecycle.direction
          }
        }));
      } else if (lifecycle.status === 'RETEST_FAILED' && lifecycle.confirmation &&
          lifecycle.confirmation.outcome === 'FAILURE' && confirmationIsCausal) {
        const originalBullish = lifecycle.direction === 'BULLISH';
        add(makeCandidate({
          setupId: 'B7:FALSE_BREAKOUT_RECLAIM:' + lifecycle.lifecycle_id,
          setupType: 'FALSE_BREAKOUT_RECLAIM',
          direction: originalBullish ? 'SHORT' : 'LONG',
          status: 'CONFIRMED',
          availableAtMs: lifecycle.confirmation.available_at_ms,
          invalidationLevel: originalBullish ? zone.upper_bound + lifecycle.success_buffer_price :
            zone.lower_bound - lifecycle.success_buffer_price,
          reasonCodes: ['B2E_RETEST_FAILED', 'OPPOSITE_BOUNDARY_RECLAIMED'],
          explanation: 'Пробой не удержался: закрытая свеча прошла за противоположную границу исторической зоны.',
          evidence: {
            lifecycle_id: lifecycle.lifecycle_id, breakout_event_id: lifecycle.breakout_event_id,
            breakout_event_type: lifecycle.breakout_event_type, original_breakout_direction: lifecycle.direction,
            historical_zone_id: zone.historical_zone_id, historical_zone_role: zone.role,
            confirmation: clone(lifecycle.confirmation)
          }
        }));
      } else if (['WAITING_RETEST', 'RETEST_PENDING_CONFIRMATION'].includes(lifecycle.status)) {
        const pendingAt = lifecycle.confirmation && Number.isSafeInteger(lifecycle.confirmation.available_at_ms)
          ? lifecycle.confirmation.available_at_ms : lifecycle.breakout_available_at_ms;
        if (Number.isSafeInteger(pendingAt) && pendingAt <= asOf) {
          add(makeCandidate({
            setupId: 'B7:BREAKOUT_RETEST:' + lifecycle.lifecycle_id,
            setupType: 'BREAKOUT_RETEST',
            direction: lifecycle.direction === 'BULLISH' ? 'LONG' : 'SHORT',
            status: 'PENDING',
            availableAtMs: pendingAt,
            invalidationLevel: null,
            reasonCodes: ['B2E_RETEST_PENDING'],
            explanation: 'Пробой зафиксирован, но подтверждённый ретест ещё не завершён.',
            evidence: {
              lifecycle_id: lifecycle.lifecycle_id, breakout_event_id: lifecycle.breakout_event_id,
              breakout_event_type: lifecycle.breakout_event_type, historical_zone_id: zone.historical_zone_id,
              historical_zone_role: zone.role, touch: clone(lifecycle.touch || null),
              confirmation: clone(lifecycle.confirmation || null)
            }
          }));
        }
      }
    }

    const state = b2c.structure_state;
    const protectedLevel = b2c.protected_level;
    if ((state === 'UP' || state === 'DOWN') && isObject(protectedLevel) &&
        Number.isFinite(protectedLevel.price) && Number.isSafeInteger(protectedLevel.available_at_ms) &&
        protectedLevel.available_at_ms <= asOf && latestFeatures.status === 'VALID') {
      const isUp = state === 'UP';
      const correctionBars = candles.slice(Math.max(0, lastIndex - policy.candle_feature_policy.correction_lookback_bars), lastIndex);
      const hasCorrection = correctionBars.some(candle => isUp ? candle.close < candle.open : candle.close > candle.open);
      const rejection = isUp ? (latestFeatures.hammer || latestFeatures.bullish_engulfing) :
        (latestFeatures.shooting_star || latestFeatures.bearish_engulfing);
      const reclaimedZone = b2d.zones
        .filter(zone => isObject(zone) && zone.role === (isUp ? 'SUPPORT' : 'RESISTANCE') &&
          Number.isFinite(zone.lower_bound) && Number.isFinite(zone.upper_bound) &&
          Number.isSafeInteger(zone.available_at_ms) && zone.available_at_ms <= asOf &&
          lastCandle.low <= zone.upper_bound && lastCandle.high >= zone.lower_bound &&
          (isUp ? lastCandle.close > zone.upper_bound : lastCandle.close < zone.lower_bound) &&
          (isUp ? lastCandle.close > protectedLevel.price : lastCandle.close < protectedLevel.price))
        .sort((a, b) => Math.abs(lastCandle.close - a.representative_price) - Math.abs(lastCandle.close - b.representative_price))[0];
      if (hasCorrection && rejection && reclaimedZone) {
        add(makeCandidate({
          setupId: 'B7:TREND_CONTINUATION_AFTER_CORRECTION:' + timeframe + ':' +
            lastCandle.open_time_ms + ':' + reclaimedZone.zone_id,
          setupType: 'TREND_CONTINUATION_AFTER_CORRECTION',
          direction: isUp ? 'LONG' : 'SHORT',
          status: 'CONFIRMED',
          availableAtMs: lastAvailableAt,
          invalidationLevel: protectedLevel.price,
          reasonCodes: ['B2C_TREND_STATE', 'B2D_TREND_ZONE_RECLAIMED', 'CORRECTION_OBSERVED', 'CANDLE_REJECTION_CONFIRMED'],
          explanation: isUp
            ? 'Восходящая структура сохранила защищённый минимум; коррекция встретила поддержку и закрылась бычьей свечой.'
            : 'Нисходящая структура сохранила защищённый максимум; коррекция встретила сопротивление и закрылась медвежьей свечой.',
          evidence: {
            structure_state: state,
            protected_level: clone(protectedLevel),
            zone_id: reclaimedZone.zone_id,
            zone_role: reclaimedZone.role,
            zone_bounds: { lower: reclaimedZone.lower_bound, upper: reclaimedZone.upper_bound },
            correction_candles: correctionBars.map(candle => ({
              open_time_ms: candle.open_time_ms, close_time_ms: candle.close_time_ms,
              open: candle.open, close: candle.close
            })),
            confirmation_candle: {
              open_time_ms: lastCandle.open_time_ms, close_time_ms: lastCandle.close_time_ms,
              open: lastCandle.open, high: lastCandle.high, low: lastCandle.low, close: lastCandle.close
            },
            candle_features: clone(latestFeatures)
          }
        }));
      }
    }

    setups.sort((a, b) => a.available_at_ms - b.available_at_ms ||
      a.setup_type.localeCompare(b.setup_type) || a.setup_id.localeCompare(b.setup_id));
    const truncated = setups.length > policy.max_candidates;
    const selected = truncated ? setups.slice(-policy.max_candidates) : setups;
    const confirmed = selected.filter(item => item.status === 'CONFIRMED').length;
    const pending = selected.filter(item => item.status === 'PENDING').length;
    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: policy.version,
      status: 'VALID',
      admission: {
        status: 'ADMITTED', snapshot_id: snapshot.snapshot_id,
        b2a_engine_version: b2a.engine_version, b2b_engine_version: b2b.engine_version,
        b2c_engine_version: b2c.engine_version, b2d_engine_version: b2d.engine_version,
        b2e_engine_version: b2e.engine_version
      },
      snapshot_id: snapshot.snapshot_id, symbol: snapshot.canonical_symbol,
      timeframe, analysis_as_of_ms: asOf,
      summary: selected.length ? 'SETUPS_FOUND' : 'NO_SETUP',
      setup_candidates: selected,
      latest_candle_features: clone(latestFeatures),
      diagnostics: {
        candidate_count: selected.length, confirmed_count: confirmed, pending_count: pending,
        truncated, input_candle_count: candles.length,
        b2e_lifecycle_count: b2e.lifecycles.length, b2d_zone_count: b2d.zones.length
      }
    });
  }

  return Object.freeze({ ENGINE_VERSION, REQUIRED, analyze, extractCandleFeatures });
});
