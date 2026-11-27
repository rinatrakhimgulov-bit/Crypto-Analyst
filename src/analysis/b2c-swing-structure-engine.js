(function attachB2CSwingStructureEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B2CSwingStructureEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createB2CSwingStructureEngine() {
  'use strict';

  const ENGINE_VERSION = '2.1.0-b2c';
  const REQUIRED_B2B_ENGINE_VERSION = '2.2.0-b2b';
  const REQUIRED_B2B_POLICY_VERSION = 'b2b-swing-sequence-v3';
  const REQUIRED_POLICY_VERSION = 'b2c-state-v2';
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
      structure_state: 'UNESTABLISHED', events: [], pivots: [],
      diagnostics: { candle_count: 0, pivot_count: 0, event_count: 0 }
    });
  }
  function validatePolicy(policy) {
    if (!isObject(policy) || policy.version !== REQUIRED_POLICY_VERSION) return 'B2C_POLICY_INVALID';
    if (policy.b2b_engine_version !== REQUIRED_B2B_ENGINE_VERSION ||
        policy.b2b_policy_version !== REQUIRED_B2B_POLICY_VERSION ||
        policy.b2a_engine_version !== REQUIRED_B2A_ENGINE_VERSION ||
        typeof policy.b2a_policy_version !== 'string' || !policy.b2a_policy_version.trim() ||
        typeof policy.b1_contract_version !== 'string' || !policy.b1_contract_version.trim() ||
        typeof policy.b1_validator_version !== 'string' || !policy.b1_validator_version.trim() ||
        typeof policy.b1_quality_policy_version !== 'string' || !policy.b1_quality_policy_version.trim() ||
        policy.price_equality_policy !== 'EXACT_PRICE_V1' ||
        policy.b2b_same_candle_dual_pivot_policy !== 'EXCLUDE_BOTH_FROM_SEQUENCE_V1' ||
        policy.break_buffer_policy !== 'ZERO_BUFFER_V1' ||
        !Number.isSafeInteger(policy.finality_safety_lag_ms) || policy.finality_safety_lag_ms < 0) {
      return 'B2C_POLICY_BINDING_INVALID';
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
    if (['open', 'high', 'low', 'close'].some(k => !Number.isFinite(candle[k]) || candle[k] <= 0)) return 'CANDLE_PRICE_INVALID';
    if (candle.high < Math.max(candle.open, candle.close, candle.low) || candle.low > Math.min(candle.open, candle.close, candle.high) || candle.high < candle.low) return 'CANDLE_OHLC_INVALID';
    return null;
  }
  function validatePivot(pivot, ids, asOf, equalityPolicy) {
    if (!isObject(pivot) || typeof pivot.pivot_id !== 'string' || !pivot.pivot_id.trim() || ids.has(pivot.pivot_id)) return 'B2B_PIVOT_ID_INVALID';
    if (!['SWING_HIGH', 'SWING_LOW'].includes(pivot.type) || !Number.isFinite(pivot.price) || pivot.price <= 0) return 'B2B_PIVOT_VALUE_INVALID';
    for (const key of ['source_time_ms', 'confirmed_at_ms', 'available_at_ms']) {
      if (!Number.isSafeInteger(pivot[key]) || pivot[key] <= 0) return 'B2B_PIVOT_TIME_INVALID';
    }
    if (pivot.source_time_ms > pivot.confirmed_at_ms || pivot.confirmed_at_ms > pivot.available_at_ms || pivot.available_at_ms > asOf) return 'B2B_PIVOT_CAUSAL_TIME_INVALID';
    if (!isObject(pivot.confirmation) || pivot.confirmation.equality_policy !== equalityPolicy) return 'B2B_PIVOT_POLICY_MISMATCH';
    ids.add(pivot.pivot_id);
    return null;
  }
  function analyze(input) {
    const policy = input && input.policy;
    const policyError = validatePolicy(policy);
    if (policyError) return blocked('INVALID', policyError, { policyVersion: policy && policy.version });

    const snapshot = input && input.snapshot;
    const report = input && input.quality_report;
    const source = input && input.b2b_result;
    const b2aSource = input && input.b2a_result;
    const asOf = input && input.analysis_as_of_ms;
    const meta = {
      policyVersion: policy.version,
      snapshotId: snapshot && snapshot.snapshot_id,
      symbol: snapshot && snapshot.canonical_symbol,
      timeframe: input && input.timeframe,
      analysisAsOfMs: asOf
    };
    if (!isObject(snapshot) || !isObject(report) || !isObject(source) || !isObject(b2aSource)) return blocked('INVALID', 'B2C_INPUT_MISSING', meta);
    if (!Number.isSafeInteger(asOf) || asOf <= 0 || snapshot.analysis_as_of_ms !== asOf ||
        snapshot.provider_server_time_ms !== asOf || !isObject(snapshot.provider_metadata) ||
        snapshot.provider_metadata.time_source !== 'provider') return blocked('INVALID', 'B1_ANALYSIS_CUTOFF_INVALID', meta);
    if (typeof snapshot.snapshot_id !== 'string' || !snapshot.snapshot_id ||
        snapshot.contract_version !== policy.b1_contract_version ||
        typeof snapshot.canonical_symbol !== 'string' || !snapshot.canonical_symbol ||
        typeof snapshot.market_type !== 'string' || !snapshot.market_type) return blocked('INVALID', 'B1_SNAPSHOT_IDENTITY_INVALID', meta);

    const keys = Object.keys(snapshot.candles_by_timeframe || {});
    const timeframe = keys.length === 1 ? keys[0] : null;
    const stepMs = TIMEFRAME_MS[timeframe];
    meta.timeframe = timeframe;
    if (!stepMs || (input.timeframe && input.timeframe !== timeframe)) return blocked('INVALID', 'B2C_TIMEFRAME_SCOPE_INVALID', meta);

    const reportMatches = report.snapshot_id === snapshot.snapshot_id &&
      report.symbol === snapshot.canonical_symbol && report.timeframe === timeframe &&
      report.analysis_as_of_ms === asOf && report.validator_version === policy.b1_validator_version &&
      report.policy_version === policy.b1_quality_policy_version &&
      Number.isSafeInteger(report.checked_at_ms) && report.checked_at_ms >= 0;
    if (!reportMatches) return blocked('INVALID', 'B1_QUALITY_REPORT_IDENTITY_MISMATCH', meta);
    if (report.status !== 'VALID') return blocked('BLOCKED', 'B1_QUALITY_STATUS_NOT_VALID', meta);

    if (b2aSource.status !== 'VALID' || b2aSource.engine_version !== REQUIRED_B2A_ENGINE_VERSION ||
        b2aSource.policy_version !== policy.b2a_policy_version ||
        b2aSource.snapshot_id !== snapshot.snapshot_id || b2aSource.symbol !== snapshot.canonical_symbol ||
        b2aSource.timeframe !== timeframe || b2aSource.analysis_as_of_ms !== asOf ||
        !isObject(b2aSource.admission) || b2aSource.admission.status !== 'ADMITTED' ||
        b2aSource.admission.snapshot_id !== snapshot.snapshot_id ||
        !isObject(b2aSource.admission.quality_report) ||
        b2aSource.admission.quality_report.snapshot_id !== snapshot.snapshot_id ||
        b2aSource.admission.quality_report.validator_version !== policy.b1_validator_version ||
        b2aSource.admission.quality_report.policy_version !== policy.b1_quality_policy_version ||
        b2aSource.admission.quality_report.checked_at_ms !== report.checked_at_ms ||
        !Array.isArray(b2aSource.pivots)) {
      return blocked('INVALID', 'B2A_ADMISSION_IDENTITY_MISMATCH', meta);
    }

    if (source.status !== 'VALID' || source.engine_version !== REQUIRED_B2B_ENGINE_VERSION ||
        source.policy_version !== policy.b2b_policy_version ||
        source.snapshot_id !== snapshot.snapshot_id || source.symbol !== snapshot.canonical_symbol ||
        source.timeframe !== timeframe || source.analysis_as_of_ms !== asOf ||
        source.comparison_policy !== policy.price_equality_policy ||
        source.sequence_order_basis !== 'B2A_AVAILABLE_AT_ORDER_STABLE_EXCLUDING_DUAL_PIVOTS_WITH_HISTORY' ||
        !isObject(source.admission) || source.admission.same_candle_dual_pivot_policy !== policy.b2b_same_candle_dual_pivot_policy || source.admission.status !== 'ADMITTED' ||
        source.admission.snapshot_id !== snapshot.snapshot_id ||
        source.admission.b2a_engine_version !== policy.b2a_engine_version ||
        source.admission.b2a_policy_version !== policy.b2a_policy_version ||
        !isObject(source.admission.b2a_quality_report) ||
        source.admission.b2a_quality_report.snapshot_id !== snapshot.snapshot_id ||
        source.admission.b2a_quality_report.validator_version !== policy.b1_validator_version ||
        source.admission.b2a_quality_report.policy_version !== policy.b1_quality_policy_version ||
        source.admission.b2a_quality_report.checked_at_ms !== report.checked_at_ms) {
      return blocked('INVALID', 'B2B_ADMISSION_IDENTITY_MISMATCH', meta);
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
      if (seenTimes.has(candles[i].open_time_ms) || (i > 0 && candles[i].open_time_ms - candles[i - 1].open_time_ms !== stepMs)) {
        return blocked('INVALID', 'B1_CANDLE_ORDER_OR_DUPLICATE_INVALID', meta);
      }
      seenTimes.add(candles[i].open_time_ms);
    }
    const excluded = [formingMap[timeframe], ...unknownMap[timeframe]].filter(Boolean);
    for (const candle of excluded) if (!isObject(candle) || seenTimes.has(candle.open_time_ms)) {
      return blocked('INVALID', 'B1_FORMING_OR_UNKNOWN_OVERLAP', meta);
    }

    if (!Array.isArray(source.raw_pivots) || !Array.isArray(source.sequence) || !Array.isArray(source.sequence_history)) return blocked('INVALID', 'B2B_SEQUENCE_SHAPE_INVALID', meta);
    if (source.raw_pivots.length !== b2aSource.pivots.length) {
      return blocked('INVALID', 'B2A_PIVOT_SET_MISMATCH', meta);
    }
    for (let i = 0; i < b2aSource.pivots.length; i++) {
      const expected = b2aSource.pivots[i];
      const actual = source.raw_pivots[i];
      if (!actual || actual.pivot_id !== expected.pivot_id || actual.type !== expected.type ||
          actual.price !== expected.price || actual.source_time_ms !== expected.source_time_ms ||
          actual.source_index !== expected.source_index || actual.confirmed_at_ms !== expected.confirmed_at_ms ||
          actual.available_at_ms !== expected.available_at_ms ||
          !isObject(actual.confirmation) || !isObject(expected.confirmation) ||
          actual.confirmation.method !== expected.confirmation.method ||
          actual.confirmation.left_strength !== expected.confirmation.left_strength ||
          actual.confirmation.right_strength !== expected.confirmation.right_strength ||
          actual.confirmation.equality_policy !== expected.confirmation.equality_policy ||
          actual.confirmation.finality_safety_lag_ms !== expected.confirmation.finality_safety_lag_ms) {
        return blocked('INVALID', 'B2A_PIVOT_SET_MISMATCH', meta);
      }
    }
    const rawIds = new Set();
    let previousAvailable = -1;
    for (const pivot of source.raw_pivots) {
      const error = validatePivot(pivot, rawIds, asOf, policy.price_equality_policy);
      if (error) return blocked('INVALID', error, meta);
      if (pivot.available_at_ms < previousAvailable) return blocked('INVALID', 'B2B_RAW_PIVOT_ORDER_INVALID', meta);
      previousAvailable = pivot.available_at_ms;
    }
    const typesBySourceTime = new Map();
    for (const pivot of source.raw_pivots) {
      if (!typesBySourceTime.has(pivot.source_time_ms)) typesBySourceTime.set(pivot.source_time_ms, new Set());
      typesBySourceTime.get(pivot.source_time_ms).add(pivot.type);
    }
    const ambiguousSourceTimes = new Set([...typesBySourceTime.entries()]
      .filter(([, types]) => types.has('SWING_HIGH') && types.has('SWING_LOW'))
      .map(([sourceTime]) => sourceTime));
    const expectedSequence = [];
    const expectedHistory = [];
    const expectedRawStatus = new Map();
    for (const rawPivot of source.raw_pivots) {
      if (ambiguousSourceTimes.has(rawPivot.source_time_ms)) {
        expectedRawStatus.set(rawPivot.pivot_id, { status: 'AMBIGUOUS_FOR_SEQUENCE', superseded_by: null });
        continue;
      }
      const last = expectedSequence.length ? expectedSequence[expectedSequence.length - 1] : null;
      if (last && last.type === rawPivot.type) {
        const moreExtreme = rawPivot.type === 'SWING_HIGH'
          ? rawPivot.price > last.price
          : rawPivot.price < last.price;
        if (!moreExtreme) {
          expectedRawStatus.set(rawPivot.pivot_id, { status: 'SUPERSEDED_FOR_SEQUENCE', superseded_by: last.pivot_id });
          continue;
        }
        expectedRawStatus.set(last.pivot_id, { status: 'SUPERSEDED_FOR_SEQUENCE', superseded_by: rawPivot.pivot_id });
        expectedSequence.pop();
      }
      const previousSameSide = [...expectedSequence].reverse().find(p => p.type === rawPivot.type) || null;
      const delta = previousSameSide ? rawPivot.price - previousSameSide.price : null;
      const expectedLabel = !previousSameSide
        ? (rawPivot.type === 'SWING_HIGH' ? 'INITIAL_HIGH' : 'INITIAL_LOW')
        : rawPivot.type === 'SWING_HIGH'
          ? (delta > 0 ? 'HH' : delta < 0 ? 'LH' : 'EQH')
          : (delta > 0 ? 'HL' : delta < 0 ? 'LL' : 'EQL');
      const expectedComparisonId = previousSameSide ? previousSameSide.pivot_id : null;
      const expectedRelativeDelta = previousSameSide ? (delta / previousSameSide.price) * 100 : null;
      expectedSequence.push({
        pivot_id: rawPivot.pivot_id,
        type: rawPivot.type,
        price: rawPivot.price,
        structure_label: expectedLabel,
        comparison_pivot_id: expectedComparisonId,
        price_delta: delta,
        relative_delta_pct: expectedRelativeDelta
      });
      expectedHistory.push({
        ...rawPivot,
        confirmation: { ...rawPivot.confirmation },
        sequence_status: 'ACCEPTED_AT_AVAILABILITY',
        exclusion_reason: null,
        structure_label: expectedLabel,
        comparison_pivot_id: expectedComparisonId,
        price_delta: delta,
        relative_delta_pct: expectedRelativeDelta,
        superseded_by: null,
        sequence_index_at_availability: expectedSequence.length - 1
      });
      expectedRawStatus.set(rawPivot.pivot_id, { status: 'ACCEPTED', superseded_by: null });
    }
    for (const rawPivot of source.raw_pivots) {
      const expectedStatus = expectedRawStatus.get(rawPivot.pivot_id);
      if (!expectedStatus || rawPivot.sequence_status !== expectedStatus.status ||
          (rawPivot.superseded_by ?? null) !== expectedStatus.superseded_by ||
          (rawPivot.exclusion_reason ?? null) !== (expectedStatus.status === 'AMBIGUOUS_FOR_SEQUENCE' ? 'SIMULTANEOUS_HIGH_LOW_SAME_SOURCE_CANDLE' : null)) {
        return blocked('INVALID', 'B2B_RAW_SEQUENCE_STATUS_MISMATCH', meta);
      }
    }
    if (source.sequence.length !== expectedSequence.length) return blocked('INVALID', 'B2B_SEQUENCE_DERIVATION_MISMATCH', meta);
    if (source.sequence_history.length !== expectedHistory.length) return blocked('INVALID', 'B2B_SEQUENCE_HISTORY_DERIVATION_MISMATCH', meta);

    const historyIds = new Set();
    let historyAvailableAt = -1;
    for (let i = 0; i < expectedHistory.length; i++) {
      const actual = source.sequence_history[i];
      const expected = expectedHistory[i];
      if (!actual || historyIds.has(actual.pivot_id) ||
          actual.pivot_id !== expected.pivot_id || actual.type !== expected.type ||
          actual.price !== expected.price || actual.source_time_ms !== expected.source_time_ms ||
          actual.confirmed_at_ms !== expected.confirmed_at_ms || actual.available_at_ms !== expected.available_at_ms ||
          actual.sequence_status !== 'ACCEPTED_AT_AVAILABILITY' || actual.exclusion_reason !== null ||
          actual.structure_label !== expected.structure_label ||
          actual.comparison_pivot_id !== expected.comparison_pivot_id ||
          actual.price_delta !== expected.price_delta ||
          actual.relative_delta_pct !== expected.relative_delta_pct ||
          actual.superseded_by !== null ||
          actual.sequence_index_at_availability !== expected.sequence_index_at_availability ||
          actual.available_at_ms < historyAvailableAt ||
          !isObject(actual.confirmation) ||
          actual.confirmation.equality_policy !== expected.confirmation.equality_policy ||
          actual.confirmation.finality_safety_lag_ms !== expected.confirmation.finality_safety_lag_ms) {
        return blocked('INVALID', 'B2B_SEQUENCE_HISTORY_DERIVATION_MISMATCH', meta);
      }
      historyIds.add(actual.pivot_id);
      historyAvailableAt = actual.available_at_ms;
    }

    const sequenceIds = new Set();
    let lastSequenceType = null;
    previousAvailable = -1;
    for (const pivot of source.sequence) {
      if (!rawIds.has(pivot.pivot_id) || sequenceIds.has(pivot.pivot_id) ||
          pivot.sequence_status !== 'ACCEPTED' ||
          (pivot.type === lastSequenceType) ||
          pivot.available_at_ms < previousAvailable) return blocked('INVALID', 'B2B_SEQUENCE_PIVOT_INVALID', meta);
      sequenceIds.add(pivot.pivot_id);
      lastSequenceType = pivot.type;
      previousAvailable = pivot.available_at_ms;
    }

    const candleByOpen = new Map(candles.map(c => [c.open_time_ms, c]));
    const candleByClose = new Map(candles.map(c => [c.close_time_ms, c]));
    for (const pivot of source.raw_pivots) {
      const sourceCandle = candleByOpen.get(pivot.source_time_ms);
      const confirmationCandle = candleByClose.get(pivot.confirmed_at_ms);
      const expectedPrice = sourceCandle && (pivot.type === 'SWING_HIGH' ? sourceCandle.high : sourceCandle.low);
      if (!sourceCandle || !confirmationCandle || expectedPrice !== pivot.price ||
          pivot.available_at_ms !== pivot.confirmed_at_ms + policy.finality_safety_lag_ms) {
        return blocked('INVALID', 'B2B_PIVOT_CANDLE_PROVENANCE_MISMATCH', meta);
      }
    }

    for (let i = 0; i < expectedSequence.length; i++) {
      const expected = expectedSequence[i];
      const actual = source.sequence[i];
      if (!actual || actual.pivot_id !== expected.pivot_id ||
          actual.structure_label !== expected.structure_label ||
          actual.comparison_pivot_id !== expected.comparison_pivot_id ||
          actual.price_delta !== expected.price_delta ||
          actual.relative_delta_pct !== expected.relative_delta_pct) {
        return blocked('INVALID', 'B2B_SEQUENCE_DERIVATION_MISMATCH', meta);
      }
    }

    const rawById = new Map(source.raw_pivots.map(p => [p.pivot_id, p]));
    const priorSameSide = { SWING_HIGH: null, SWING_LOW: null };
    for (const pivot of source.sequence) {
      const raw = rawById.get(pivot.pivot_id);
      if (!raw || raw.type !== pivot.type || raw.price !== pivot.price ||
          raw.available_at_ms !== pivot.available_at_ms || raw.source_time_ms !== pivot.source_time_ms) {
        return blocked('INVALID', 'B2B_SEQUENCE_RAW_EVIDENCE_MISMATCH', meta);
      }
      const previous = priorSameSide[pivot.type];
      const expectedLabel = !previous
        ? (pivot.type === 'SWING_HIGH' ? 'INITIAL_HIGH' : 'INITIAL_LOW')
        : pivot.type === 'SWING_HIGH'
          ? (pivot.price > previous.price ? 'HH' : pivot.price < previous.price ? 'LH' : 'EQH')
          : (pivot.price > previous.price ? 'HL' : pivot.price < previous.price ? 'LL' : 'EQL');
      if (pivot.structure_label !== expectedLabel ||
          pivot.comparison_pivot_id !== (previous ? previous.pivot_id : null)) {
        return blocked('INVALID', 'B2B_SEQUENCE_LABEL_MISMATCH', meta);
      }
      priorSameSide[pivot.type] = pivot;
    }

    const pivots = source.sequence.map(p => ({ ...p, confirmation: { ...p.confirmation } }));
    const eventPivots = source.sequence_history.map(p => ({ ...p, confirmation: { ...p.confirmation } }));
    const events = [];
    const consumed = new Set();
    let state = 'UNESTABLISHED';
    let latestHigh = null;
    let latestLow = null;
    let continuationLevel = null;
    let protectedLevel = null;
    let transitionAvailableAt = -1;
    let pivotCursor = 0;

    function addPivot(pivot) {
      if (pivot.type === 'SWING_HIGH') latestHigh = pivot;
      else latestLow = pivot;

      if (state === 'UP' && pivot.type === 'SWING_LOW' &&
          pivot.structure_label === 'HL' && pivot.available_at_ms > transitionAvailableAt) {
        protectedLevel = { ...pivot, activated_by_transition_id: events.filter(e => e.direction === 'BULLISH' && e.transition).at(-1)?.event_id || null };
      } else if (state === 'DOWN' && pivot.type === 'SWING_HIGH' &&
          pivot.structure_label === 'LH' && pivot.available_at_ms > transitionAvailableAt) {
        protectedLevel = { ...pivot, activated_by_transition_id: events.filter(e => e.direction === 'BEARISH' && e.transition).at(-1)?.event_id || null };
      }

      if (state === 'UP' && pivot.type === 'SWING_HIGH' && pivot.structure_label === 'HH' && pivot.available_at_ms > transitionAvailableAt) continuationLevel = pivot;
      if (state === 'DOWN' && pivot.type === 'SWING_LOW' && pivot.structure_label === 'LL' && pivot.available_at_ms > transitionAvailableAt) continuationLevel = pivot;
    }
    function emit(type, direction, candle, pivot, extra = {}) {
      const eventId = ['B2C', type, candle.close_time_ms, pivot ? pivot.pivot_id : 'NO_LEVEL'].join(':');
      const event = {
        event_id: eventId, event_type: type, direction,
        level_price: pivot ? pivot.price : null,
        source_pivot_id: pivot ? pivot.pivot_id : null,
        source_time_ms: pivot ? pivot.source_time_ms : null,
        pivot_confirmed_at_ms: pivot ? pivot.confirmed_at_ms : null,
        pivot_available_at_ms: pivot ? pivot.available_at_ms : null,
        breaking_candle_open_time_ms: candle.open_time_ms,
        breaking_candle_close_time_ms: candle.close_time_ms,
        breaking_candle_close: candle.close,
        confirmed_at_ms: candle.close_time_ms,
        available_at_ms: candle.close_time_ms + policy.finality_safety_lag_ms,
        prior_state: state,
        transition: type === 'INITIAL_BULLISH_BREAK' || type === 'INITIAL_BEARISH_BREAK' || type === 'BULLISH_CHOCH' || type === 'BEARISH_CHOCH',
        confirmation_method: 'CLOSED_CANDLE_CLOSE',
        break_buffer_policy: policy.break_buffer_policy,
        break_buffer: 0,
        ...extra
      };
      events.push(event);
      return event;
    }

    for (const candle of candles) {
      // Only pivots available strictly before this candle closes can influence its break test.
      while (pivotCursor < eventPivots.length && eventPivots[pivotCursor].available_at_ms < candle.close_time_ms) {
        addPivot(eventPivots[pivotCursor++]);
      }

      let bullishLevel = null;
      let bearishLevel = null;
      if (state === 'UNESTABLISHED') {
        bullishLevel = latestHigh && !consumed.has(latestHigh.pivot_id) ? latestHigh : null;
        bearishLevel = latestLow && !consumed.has(latestLow.pivot_id) ? latestLow : null;
      } else if (state === 'UP') {
        bullishLevel = continuationLevel && !consumed.has(continuationLevel.pivot_id) ? continuationLevel : null;
        bearishLevel = protectedLevel && !consumed.has(protectedLevel.pivot_id) ? protectedLevel : null;
      } else if (state === 'DOWN') {
        bearishLevel = continuationLevel && !consumed.has(continuationLevel.pivot_id) ? continuationLevel : null;
        bullishLevel = protectedLevel && !consumed.has(protectedLevel.pivot_id) ? protectedLevel : null;
      }

      const bullBreak = Boolean(bullishLevel && candle.close > bullishLevel.price);
      const bearBreak = Boolean(bearishLevel && candle.close < bearishLevel.price);
      if (bullBreak && bearBreak) {
        emit('AMBIGUOUS_BREAK', 'NONE', candle, null, { diagnostic: 'CONTRADICTORY_DIRECTIONAL_LEVELS' });
      } else if (bullBreak || bearBreak) {
        const pivot = bullBreak ? bullishLevel : bearishLevel;
        const direction = bullBreak ? 'BULLISH' : 'BEARISH';
        let eventType;
        if (state === 'UNESTABLISHED') eventType = bullBreak ? 'INITIAL_BULLISH_BREAK' : 'INITIAL_BEARISH_BREAK';
        else if (state === 'UP' && bearBreak) eventType = 'BEARISH_CHOCH';
        else if (state === 'DOWN' && bullBreak) eventType = 'BULLISH_CHOCH';
        else eventType = bullBreak ? 'BULLISH_BOS' : 'BEARISH_BOS';

        const event = emit(eventType, direction, candle, pivot, {
          gap_through: bullBreak ? candle.open > pivot.price : candle.open < pivot.price
        });
        consumed.add(pivot.pivot_id);

        if (event.transition) {
          const priorState = state;
          state = direction === 'BULLISH' ? 'UP' : 'DOWN';
          transitionAvailableAt = event.available_at_ms;
          continuationLevel = null;
          if (state === 'UP') {
            protectedLevel = latestLow && latestLow.available_at_ms < candle.close_time_ms
              ? { ...latestLow, activated_by_transition_id: event.event_id }
              : null;
          } else {
            protectedLevel = latestHigh && latestHigh.available_at_ms < candle.close_time_ms
              ? { ...latestHigh, activated_by_transition_id: event.event_id }
              : null;
          }
          // A pivot consumed in the prior regime may become the protected reversal level
          // in the new regime. It must be eligible once in this new structural role.
          if (protectedLevel) consumed.delete(protectedLevel.pivot_id);
          event.prior_state = priorState;
        } else {
          continuationLevel = null;
        }
      } else {
        if (bullishLevel && candle.high > bullishLevel.price && candle.close <= bullishLevel.price) {
          emit('BULLISH_SWEEP', 'BULLISH', candle, bullishLevel, { wick_only: true, gap_through: false });
        }
        if (bearishLevel && candle.low < bearishLevel.price && candle.close >= bearishLevel.price) {
          emit('BEARISH_SWEEP', 'BEARISH', candle, bearishLevel, { wick_only: true, gap_through: false });
        }
      }

      // Pivots becoming available at this candle close are admitted only after break evaluation.
      while (pivotCursor < eventPivots.length && eventPivots[pivotCursor].available_at_ms <= candle.close_time_ms) {
        addPivot(pivots[pivotCursor++]);
      }
    }

    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: policy.version,
      status: 'VALID',
      admission: {
        status: 'ADMITTED', snapshot_id: snapshot.snapshot_id,
        b2b_engine_version: source.engine_version, b2b_policy_version: source.policy_version,
        b2b_same_candle_dual_pivot_policy: policy.b2b_same_candle_dual_pivot_policy,
        b1_validator_version: report.validator_version, b1_quality_policy_version: report.policy_version
      },
      snapshot_id: snapshot.snapshot_id, symbol: snapshot.canonical_symbol, timeframe,
      analysis_as_of_ms: asOf, structure_state: state,
      state_policy: 'PROTECTED_SWING_HL_LH_V1',
      break_buffer_policy: policy.break_buffer_policy,
      price_equality_policy: policy.price_equality_policy,
      events, raw_pivots: source.raw_pivots.map(p => ({ ...p, confirmation: { ...p.confirmation } })), pivots,
      protected_level: protectedLevel ? {
        pivot_id: protectedLevel.pivot_id, price: protectedLevel.price,
        source_time_ms: protectedLevel.source_time_ms,
        confirmed_at_ms: protectedLevel.confirmed_at_ms,
        available_at_ms: protectedLevel.available_at_ms,
        activated_by_transition_id: protectedLevel.activated_by_transition_id
      } : null,
      continuation_level: continuationLevel ? {
        pivot_id: continuationLevel.pivot_id, price: continuationLevel.price,
        type: continuationLevel.type, available_at_ms: continuationLevel.available_at_ms
      } : null,
      diagnostics: {
        candle_count: candles.length, pivot_count: pivots.length, event_pivot_count: eventPivots.length, event_count: events.length,
        consumed_level_count: consumed.size,
        protected_level_unavailable: state !== 'UNESTABLISHED' && !protectedLevel,
        protected_level_status: state === 'UNESTABLISHED' ? 'NOT_APPLICABLE' : protectedLevel ? 'AVAILABLE' : 'PROTECTED_LEVEL_UNAVAILABLE'
      }
    });
  }

  return Object.freeze({ ENGINE_VERSION, REQUIRED_B2B_ENGINE_VERSION, analyze });
});
