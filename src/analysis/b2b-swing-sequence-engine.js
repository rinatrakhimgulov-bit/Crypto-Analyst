(function attachB2BSwingSequenceEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B2BSwingSequenceEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createB2BSwingSequenceEngine() {
  'use strict';

  const ENGINE_VERSION = '2.2.0-b2b';
  const REQUIRED_B2A_ENGINE_VERSION = '2.0.0-b2a';
  const VALID_TYPES = new Set(['SWING_HIGH', 'SWING_LOW']);

  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) freezeDeep(value[key]);
    return value;
  }

  function isObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function blocked(status, code, meta = {}) {
    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: meta.policyVersion || null,
      status,
      admission: { status: 'BLOCKED', reasons: [{ code, severity: 'CRITICAL' }] },
      snapshot_id: meta.snapshotId || null,
      symbol: meta.symbol || null,
      timeframe: meta.timeframe || null,
      analysis_as_of_ms: meta.analysisAsOfMs ?? null,
      raw_pivots: [],
      sequence: [],
      sequence_history: [],
      diagnostics: { raw_pivot_count: 0, sequence_pivot_count: 0, sequence_history_count: 0, superseded_count: 0 }
    });
  }

  function validatePivot(pivot, seen, asOf, equalityPolicy) {
    if (!isObject(pivot)) return 'PIVOT_NOT_OBJECT';
    if (typeof pivot.pivot_id !== 'string' || !pivot.pivot_id.trim()) return 'PIVOT_ID_INVALID';
    if (seen.has(pivot.pivot_id)) return 'PIVOT_ID_DUPLICATE';
    if (!VALID_TYPES.has(pivot.type)) return 'PIVOT_TYPE_INVALID';
    if (!Number.isFinite(pivot.price) || pivot.price <= 0) return 'PIVOT_PRICE_INVALID';
    for (const key of ['source_time_ms', 'confirmed_at_ms', 'available_at_ms']) {
      if (!Number.isSafeInteger(pivot[key]) || pivot[key] <= 0) return 'PIVOT_TIME_INVALID';
    }
    if (pivot.source_time_ms > pivot.confirmed_at_ms ||
        pivot.confirmed_at_ms > pivot.available_at_ms ||
        pivot.available_at_ms > asOf) return 'PIVOT_CAUSAL_TIME_INVALID';
    if (!isObject(pivot.confirmation) || pivot.confirmation.equality_policy !== equalityPolicy) {
      return 'PIVOT_POLICY_MISMATCH';
    }
    seen.add(pivot.pivot_id);
    return null;
  }

  function compareLabel(pivot, previous) {
    if (!previous) {
      return {
        structure_label: pivot.type === 'SWING_HIGH' ? 'INITIAL_HIGH' : 'INITIAL_LOW',
        comparison_pivot_id: null,
        price_delta: null,
        relative_delta_pct: null
      };
    }
    const delta = pivot.price - previous.price;
    if (pivot.type === 'SWING_HIGH') {
      return {
        structure_label: delta > 0 ? 'HH' : delta < 0 ? 'LH' : 'EQH',
        comparison_pivot_id: previous.pivot_id,
        price_delta: delta,
        relative_delta_pct: (delta / previous.price) * 100
      };
    }
    return {
      structure_label: delta > 0 ? 'HL' : delta < 0 ? 'LL' : 'EQL',
      comparison_pivot_id: previous.pivot_id,
      price_delta: delta,
      relative_delta_pct: (delta / previous.price) * 100
    };
  }

  function analyze(input) {
    const policy = input && input.policy;
    if (!isObject(policy) || typeof policy.version !== 'string' || !policy.version.trim()) {
      return blocked('INVALID', 'B2B_POLICY_INVALID', { policyVersion: policy && policy.version });
    }
    if (policy.b2a_engine_version !== REQUIRED_B2A_ENGINE_VERSION ||
        typeof policy.b2a_policy_version !== 'string' || !policy.b2a_policy_version.trim() ||
        typeof policy.b1_validator_version !== 'string' || !policy.b1_validator_version.trim() ||
        typeof policy.b1_quality_policy_version !== 'string' || !policy.b1_quality_policy_version.trim() ||
        policy.price_equality_policy !== 'EXACT_PRICE_V1' ||
        policy.same_candle_dual_pivot_policy !== 'EXCLUDE_BOTH_FROM_SEQUENCE_V1') {
      return blocked('INVALID', 'B2A_POLICY_BINDING_INVALID', { policyVersion: policy.version });
    }

    const source = input && input.b2a_result;
    const meta = {
      policyVersion: policy.version,
      snapshotId: source && source.snapshot_id,
      symbol: source && source.symbol,
      timeframe: source && source.timeframe,
      analysisAsOfMs: source && source.analysis_as_of_ms
    };

    if (!isObject(source)) return blocked('INVALID', 'B2A_RESULT_MISSING', meta);
    if (source.status !== 'VALID') return blocked('BLOCKED', 'B2A_RESULT_NOT_VALID', meta);
    if (source.engine_version !== REQUIRED_B2A_ENGINE_VERSION ||
        source.policy_version !== policy.b2a_policy_version ||
        !isObject(source.admission) || source.admission.status !== 'ADMITTED' ||
        source.admission.snapshot_id !== source.snapshot_id ||
        !isObject(source.admission.quality_report) ||
        source.admission.quality_report.snapshot_id !== source.snapshot_id ||
        source.admission.quality_report.validator_version !== policy.b1_validator_version ||
        source.admission.quality_report.policy_version !== policy.b1_quality_policy_version ||
        !Number.isSafeInteger(source.admission.quality_report.checked_at_ms) ||
        source.admission.quality_report.checked_at_ms < 0) {
      return blocked('INVALID', 'B2A_ADMISSION_IDENTITY_MISMATCH', meta);
    }
    if (typeof source.snapshot_id !== 'string' || !source.snapshot_id ||
        typeof source.symbol !== 'string' || !source.symbol ||
        typeof source.timeframe !== 'string' || !source.timeframe ||
        !Number.isSafeInteger(source.analysis_as_of_ms) || source.analysis_as_of_ms <= 0 ||
        !isObject(source.parameters) ||
        source.parameters.price_equality_policy !== policy.price_equality_policy ||
        !Array.isArray(source.pivots)) {
      return blocked('INVALID', 'B2A_RESULT_SHAPE_INVALID', meta);
    }

    const seen = new Set();
    let previousAvailableAt = -1;
    for (const pivot of source.pivots) {
      const error = validatePivot(pivot, seen, source.analysis_as_of_ms, policy.price_equality_policy);
      if (error) return blocked('INVALID', error, meta);
      if (pivot.available_at_ms < previousAvailableAt) {
        return blocked('INVALID', 'B2A_PIVOT_AVAILABILITY_ORDER_INVALID', meta);
      }
      previousAvailableAt = pivot.available_at_ms;
    }

    const typesBySourceTime = new Map();
    for (const pivot of source.pivots) {
      if (!typesBySourceTime.has(pivot.source_time_ms)) typesBySourceTime.set(pivot.source_time_ms, new Set());
      typesBySourceTime.get(pivot.source_time_ms).add(pivot.type);
    }
    const ambiguousSourceTimes = new Set([...typesBySourceTime.entries()]
      .filter(([, types]) => types.has('SWING_HIGH') && types.has('SWING_LOW'))
      .map(([sourceTime]) => sourceTime));

    const raw = source.pivots.map(pivot => ({
      ...pivot,
      confirmation: { ...pivot.confirmation },
      sequence_status: ambiguousSourceTimes.has(pivot.source_time_ms) ? 'AMBIGUOUS_FOR_SEQUENCE' : 'PENDING',
      exclusion_reason: ambiguousSourceTimes.has(pivot.source_time_ms) ? 'SIMULTANEOUS_HIGH_LOW_SAME_SOURCE_CANDLE' : null,
      structure_label: null,
      comparison_pivot_id: null,
      price_delta: null,
      relative_delta_pct: null,
      superseded_by: null
    }));
    const sequence = [];
    const sequenceHistory = [];

    for (let i = 0; i < raw.length; i++) {
      const current = raw[i];
      if (current.sequence_status === 'AMBIGUOUS_FOR_SEQUENCE') continue;
      const last = sequence.length ? sequence[sequence.length - 1] : null;

      if (last && last.type === current.type) {
        const moreExtreme = current.type === 'SWING_HIGH'
          ? current.price > last.price
          : current.price < last.price;

        if (!moreExtreme) {
          current.sequence_status = 'SUPERSEDED_FOR_SEQUENCE';
          current.superseded_by = last.pivot_id;
          continue;
        }

        last.sequence_status = 'SUPERSEDED_FOR_SEQUENCE';
        last.superseded_by = current.pivot_id;
        sequence.pop();
      }

      let previousSameType = null;
      for (let j = sequence.length - 1; j >= 0; j--) {
        if (sequence[j].type === current.type) {
          previousSameType = sequence[j];
          break;
        }
      }

      const label = compareLabel(current, previousSameType);
      current.sequence_status = 'ACCEPTED';
      current.structure_label = label.structure_label;
      current.comparison_pivot_id = label.comparison_pivot_id;
      current.price_delta = label.price_delta;
      current.relative_delta_pct = label.relative_delta_pct;
      sequence.push(current);
      sequenceHistory.push({
        ...current,
        confirmation: { ...current.confirmation },
        sequence_status: 'ACCEPTED_AT_AVAILABILITY',
        exclusion_reason: null,
        superseded_by: null,
        sequence_index_at_availability: sequence.length - 1
      });
    }

    const normalizedSequence = sequence.map((pivot, index) => ({
      ...pivot,
      sequence_index: index
    }));

    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: policy.version,
      status: 'VALID',
      admission: {
        status: 'ADMITTED',
        snapshot_id: source.snapshot_id,
        b2a_engine_version: source.engine_version,
        b2a_policy_version: source.policy_version,
        same_candle_dual_pivot_policy: policy.same_candle_dual_pivot_policy,
        b2a_quality_report: { ...source.admission.quality_report }
      },
      snapshot_id: source.snapshot_id,
      symbol: source.symbol,
      timeframe: source.timeframe,
      analysis_as_of_ms: source.analysis_as_of_ms,
      sequence_order_basis: 'B2A_AVAILABLE_AT_ORDER_STABLE_EXCLUDING_DUAL_PIVOTS_WITH_HISTORY',
      comparison_policy: policy.price_equality_policy,
      raw_pivots: raw,
      sequence: normalizedSequence,
      sequence_history: sequenceHistory,
      diagnostics: {
        raw_pivot_count: raw.length,
        sequence_pivot_count: normalizedSequence.length,
        sequence_history_count: sequenceHistory.length,
        superseded_count: raw.filter(p => p.sequence_status === 'SUPERSEDED_FOR_SEQUENCE').length,
        ambiguous_dual_pivot_count: raw.filter(p => p.sequence_status === 'AMBIGUOUS_FOR_SEQUENCE').length
      }
    });
  }

  return Object.freeze({ ENGINE_VERSION, REQUIRED_B2A_ENGINE_VERSION, analyze });
});
