(function attachB2FMtfStructureConfluenceEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B2FMtfStructureConfluenceEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createB2FMtfStructureConfluenceEngine() {
  'use strict';

  const ENGINE_VERSION = '2.0.0-b2f';
  const REQUIRED = Object.freeze(['1d', '4h', '1h']);
  const STEP = Object.freeze({ '1d': 86400000, '4h': 14400000, '1h': 3600000 });
  const CLOSED_KEYS = Object.freeze([
    'open_time_ms', 'close_time_ms', 'open', 'high', 'low', 'close',
    'volume_base', 'volume_quote'
  ]);

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
      symbol: meta.symbol || null,
      market_type: meta.marketType || null,
      analysis_as_of_ms: meta.analysisAsOfMs ?? null,
      timeframes: {},
      structure_pattern: null,
      alignment_status: 'BLOCKED',
      alignment_context: 'UNAVAILABLE',
      hierarchical_interpretation: 'BLOCKED',
      lower_timeframe_consensus: 'BLOCKED',
      diagnostics: { timeframe_count: 0, event_count: 0 }
    });
  }
  function validatePolicy(policy) {
    if (!isObject(policy) || typeof policy.version !== 'string' || !policy.version.trim()) return 'B2F_POLICY_INVALID';
    const required = {
      b1_mtf_contract_version: '1.0.0',
      b1_contract_version: '1.1.0',
      b1_validator_version: '1.1.0',
      b1_quality_policy_version: 'b1-quality-policy-2026-11-27-v1',
      b2b_engine_version: '2.0.0-b2b',
      b2b_policy_version: 'b2b-swing-sequence-v1',
      b2c_engine_version: '2.0.0-b2c',
      b2c_policy_version: 'b2c-state-v1'
    };
    for (const [key, value] of Object.entries(required)) {
      if (policy[key] !== value) return 'B2F_UPSTREAM_VERSION_BINDING_INVALID';
    }
    if (!Number.isSafeInteger(policy.finality_safety_lag_ms) || policy.finality_safety_lag_ms < 0) {
      return 'B2F_FINALITY_POLICY_INVALID';
    }
    return null;
  }
  function sameCandle(a, b) {
    return CLOSED_KEYS.every(key => a[key] === b[key]);
  }
  function summarizeEvent(event) {
    if (!event) return null;
    return {
      event_id: event.event_id,
      event_type: event.event_type,
      direction: event.direction,
      level_price: event.level_price,
      source_pivot_id: event.source_pivot_id,
      breaking_candle_close_time_ms: event.breaking_candle_close_time_ms,
      available_at_ms: event.available_at_ms
    };
  }
  function lowerConsensus(fourHour, oneHour) {
    if (fourHour === 'UP' && oneHour === 'UP') return 'BULLISH';
    if (fourHour === 'DOWN' && oneHour === 'DOWN') return 'BEARISH';
    if ((fourHour === 'UP' && oneHour === 'DOWN') || (fourHour === 'DOWN' && oneHour === 'UP')) return 'CONFLICT';
    if (fourHour === 'UNESTABLISHED' && oneHour === 'UNESTABLISHED') return 'UNESTABLISHED';
    return 'PARTIAL';
  }
  function alignment(states) {
    const values = REQUIRED.map(tf => states[tf]);
    const hasUp = values.includes('UP');
    const hasDown = values.includes('DOWN');
    const allUp = values.every(v => v === 'UP');
    const allDown = values.every(v => v === 'DOWN');
    const allUnestablished = values.every(v => v === 'UNESTABLISHED');
    if (allUp) return { status: 'FULL_BULLISH', context: 'BULLISH_STRUCTURE' };
    if (allDown) return { status: 'FULL_BEARISH', context: 'BEARISH_STRUCTURE' };
    if (hasUp && hasDown) return { status: 'MIXED', context: 'MIXED_STRUCTURE' };
    if (hasUp) return { status: 'PARTIAL_BULLISH', context: 'PARTIAL_BULLISH_STRUCTURE' };
    if (hasDown) return { status: 'PARTIAL_BEARISH', context: 'PARTIAL_BEARISH_STRUCTURE' };
    if (allUnestablished) return { status: 'UNESTABLISHED', context: 'UNESTABLISHED_STRUCTURE' };
    return { status: 'UNESTABLISHED', context: 'UNESTABLISHED_STRUCTURE' };
  }
  function interpretation(pattern, alignmentStatus) {
    const exact = {
      'UP|UP|DOWN': '1H_PULLBACK_AGAINST_BULLISH_1D_4H',
      'DOWN|DOWN|UP': '1H_BOUNCE_AGAINST_BEARISH_1D_4H',
      'UP|DOWN|DOWN': '4H_1H_COUNTERTREND_BEARISH_VS_1D',
      'DOWN|UP|UP': '4H_1H_COUNTERTREND_BULLISH_VS_1D'
    };
    if (exact[pattern]) return exact[pattern];
    if (alignmentStatus === 'MIXED') return 'MULTI_TIMEFRAME_CONFLICT';
    if (alignmentStatus === 'PARTIAL_BULLISH' || alignmentStatus === 'PARTIAL_BEARISH') return 'PARTIAL_CONTEXT';
    if (alignmentStatus === 'UNESTABLISHED') return 'NO_ESTABLISHED_STRUCTURE';
    return 'FULL_TIMEFRAME_ALIGNMENT';
  }

  function analyze(input) {
    const policy = input && input.policy;
    const mtf = input && input.mtf_result;
    const b2cByTf = input && input.b2c_by_timeframe;
    const meta = {
      policyVersion: policy && policy.version,
      symbol: mtf && mtf.symbol,
      marketType: mtf && mtf.market_type,
      analysisAsOfMs: mtf && mtf.analysis_as_of_ms
    };
    if (!isObject(mtf) || !isObject(b2cByTf)) return blocked('INVALID', 'B2F_INPUT_MISSING', meta);
    const policyError = validatePolicy(policy);
    if (policyError) return blocked('INVALID', policyError, meta);
    if (mtf.contract_version !== policy.b1_mtf_contract_version) return blocked('INVALID', 'B1_MTF_CONTRACT_VERSION_MISMATCH', meta);
    if (mtf.status !== 'VALID') return blocked('BLOCKED', 'B1_MTF_STATUS_NOT_VALID', meta);
    if (mtf.directional_allowed !== true) return blocked('BLOCKED', 'B1_MTF_DIRECTIONAL_PERMISSION_FALSE', meta);
    if (!Array.isArray(mtf.required_timeframes) ||
        mtf.required_timeframes.length !== REQUIRED.length ||
        REQUIRED.some((tf, i) => mtf.required_timeframes[i] !== tf)) {
      return blocked('INVALID', 'B1_MTF_REQUIRED_TIMEFRAMES_MISMATCH', meta);
    }
    if (typeof mtf.symbol !== 'string' || !mtf.symbol ||
        typeof mtf.market_type !== 'string' || !mtf.market_type ||
        !Number.isSafeInteger(mtf.analysis_as_of_ms) || mtf.analysis_as_of_ms <= 0 ||
        !Number.isSafeInteger(mtf.requested_closed_count) || mtf.requested_closed_count < 1 ||
        !Number.isSafeInteger(mtf.provider_time_spread_ms) || mtf.provider_time_spread_ms < 0 ||
        !Number.isSafeInteger(mtf.max_provider_time_spread_ms) || mtf.max_provider_time_spread_ms < 0 ||
        mtf.provider_time_spread_ms > mtf.max_provider_time_spread_ms) {
      return blocked('INVALID', 'B1_MTF_METADATA_INVALID', meta);
    }
    if (!isObject(mtf.timeframes) || !REQUIRED.every(tf => Object.prototype.hasOwnProperty.call(mtf.timeframes, tf)) ||
        Object.keys(mtf.timeframes).length !== REQUIRED.length) {
      return blocked('INVALID', 'B1_MTF_TIMEFRAME_COLLECTION_INVALID', meta);
    }
    if (!REQUIRED.every(tf => isObject(b2cByTf[tf])) || Object.keys(b2cByTf).length !== REQUIRED.length) {
      return blocked('INVALID', 'B2C_TIMEFRAME_COLLECTION_INVALID', meta);
    }

    const cutoff = mtf.analysis_as_of_ms;
    const providerTimes = [];
    let canonicalSymbol = null;
    let marketType = null;
    const states = {};
    const timeframeOutput = {};
    const snapshotIds = {};
    const seenSnapshotIds = new Set();
    let totalEvents = 0;

    for (const tf of REQUIRED) {
      const entry = mtf.timeframes[tf];
      const b2c = b2cByTf[tf];
      if (!isObject(entry) || entry.timeframe !== tf || entry.status !== 'VALID' ||
          !Number.isSafeInteger(entry.provider_time_ms) || entry.provider_time_ms <= 0 ||
          entry.provider_time_ms < cutoff ||
          !Number.isSafeInteger(entry.receive_time_ms) || entry.receive_time_ms <= 0) {
        return blocked('INVALID', 'B1_MTF_TIMEFRAME_ENTRY_INVALID', meta);
      }
      providerTimes.push(entry.provider_time_ms);

      const snapshot = entry.snapshot;
      const report = entry.quality_report;
      if (!isObject(snapshot) || !isObject(report) ||
          snapshot.contract_version !== policy.b1_contract_version ||
          typeof snapshot.snapshot_id !== 'string' || !snapshot.snapshot_id ||
          seenSnapshotIds.has(snapshot.snapshot_id) ||
          typeof snapshot.canonical_symbol !== 'string' || !snapshot.canonical_symbol ||
          typeof snapshot.market_type !== 'string' || !snapshot.market_type ||
          snapshot.analysis_as_of_ms !== cutoff || snapshot.provider_server_time_ms !== cutoff ||
          report.snapshot_id !== snapshot.snapshot_id ||
          report.symbol !== snapshot.canonical_symbol ||
          report.timeframe !== tf || report.analysis_as_of_ms !== cutoff ||
          report.validator_version !== policy.b1_validator_version ||
          report.policy_version !== policy.b1_quality_policy_version ||
          report.status !== 'VALID' || !Number.isSafeInteger(report.closed_count) ||
          !Number.isSafeInteger(report.valid_count) || report.closed_count < 1 ||
          report.valid_count < report.closed_count || report.insufficient_history === true) {
        return blocked('INVALID', 'B1_MTF_SNAPSHOT_QUALITY_MISMATCH', meta);
      }
      if (canonicalSymbol === null) canonicalSymbol = snapshot.canonical_symbol;
      if (marketType === null) marketType = snapshot.market_type;
      if (snapshot.canonical_symbol !== canonicalSymbol || snapshot.market_type !== marketType) {
        return blocked('INVALID', 'B1_MTF_CANONICAL_IDENTITY_MISMATCH', meta);
      }

      const closedMap = snapshot.candles_by_timeframe;
      if (!isObject(closedMap) || Object.keys(closedMap).length !== 1 || !Array.isArray(closedMap[tf]) ||
          !isObject(snapshot.forming_candle_by_timeframe) || Object.keys(snapshot.forming_candle_by_timeframe).length !== 1 ||
          !Object.prototype.hasOwnProperty.call(snapshot.forming_candle_by_timeframe, tf) ||
          !isObject(snapshot.unclassified_candles_by_timeframe) || Object.keys(snapshot.unclassified_candles_by_timeframe).length !== 1 ||
          !Array.isArray(snapshot.unclassified_candles_by_timeframe[tf])) {
        return blocked('INVALID', 'B1_MTF_CANONICAL_CANDLES_INVALID', meta);
      }
      const step = STEP[tf];
      const expectedEnd = Math.floor((cutoff - policy.finality_safety_lag_ms) / step) * step - step;
      const expectedStart = expectedEnd - (mtf.requested_closed_count - 1) * step;
      const selected = closedMap[tf].filter(c => c.open_time_ms >= expectedStart && c.open_time_ms <= expectedEnd);
      if (report.closed_count !== closedMap[tf].length ||
          selected.length !== mtf.requested_closed_count ||
          !Array.isArray(entry.analysis_candles) ||
          entry.analysis_candles.length !== selected.length ||
          selected.some((c, i) => !entry.analysis_candles[i] || !sameCandle(c, entry.analysis_candles[i]) ||
            c.open_time_ms !== expectedStart + i * step)) {
        return blocked('INVALID', 'B1_MTF_ANALYSIS_WINDOW_MISMATCH', meta);
      }
      seenSnapshotIds.add(snapshot.snapshot_id);
      snapshotIds[tf] = snapshot.snapshot_id;

      if (b2c.status !== 'VALID' || b2c.engine_version !== policy.b2c_engine_version ||
          b2c.policy_version !== policy.b2c_policy_version ||
          b2c.snapshot_id !== snapshot.snapshot_id ||
          b2c.symbol !== snapshot.canonical_symbol || b2c.timeframe !== tf ||
          b2c.analysis_as_of_ms !== cutoff || !isObject(b2c.admission) ||
          b2c.admission.status !== 'ADMITTED' || b2c.admission.snapshot_id !== snapshot.snapshot_id ||
          b2c.admission.b2b_engine_version !== policy.b2b_engine_version ||
          b2c.admission.b2b_policy_version !== policy.b2b_policy_version ||
          b2c.admission.b1_validator_version !== policy.b1_validator_version ||
          b2c.admission.b1_quality_policy_version !== policy.b1_quality_policy_version ||
          !['UP', 'DOWN', 'UNESTABLISHED'].includes(b2c.structure_state) ||
          !Array.isArray(b2c.events)) {
        return blocked('INVALID', 'B2C_TIMEFRAME_RESULT_MISMATCH', meta);
      }
      const eventIds = new Set();
      let previousClose = -1;
      for (const event of b2c.events) {
        if (!isObject(event) || typeof event.event_id !== 'string' || !event.event_id ||
            eventIds.has(event.event_id) ||
            !Number.isSafeInteger(event.breaking_candle_close_time_ms) ||
            !Number.isSafeInteger(event.available_at_ms) ||
            event.available_at_ms !== event.breaking_candle_close_time_ms + policy.finality_safety_lag_ms ||
            event.available_at_ms > cutoff ||
            event.breaking_candle_close_time_ms < previousClose) {
          return blocked('INVALID', 'B2C_EVENT_HISTORY_INVALID', meta);
        }
        eventIds.add(event.event_id);
        previousClose = event.breaking_candle_close_time_ms;
      }

      states[tf] = b2c.structure_state;
      const lastEvent = b2c.events.length ? b2c.events[b2c.events.length - 1] : null;
      timeframeOutput[tf] = {
        timeframe: tf,
        role: tf === '1d' ? 'HIGHER_TIMEFRAME_CONTEXT' : tf === '4h' ? 'INTERMEDIATE_STRUCTURE' : 'TACTICAL_STRUCTURE',
        structure_state: b2c.structure_state,
        last_event: summarizeEvent(lastEvent),
        event_count: b2c.events.length,
        snapshot_id: snapshot.snapshot_id,
        quality_status: report.status
      };
      totalEvents += b2c.events.length;
    }

    const actualSpread = Math.max(...providerTimes) - Math.min(...providerTimes);
    if (Math.min(...providerTimes) !== cutoff || actualSpread !== mtf.provider_time_spread_ms) {
      return blocked('INVALID', 'B1_MTF_PROVIDER_TIME_SPREAD_MISMATCH', meta);
    }

    const pattern = REQUIRED.map(tf => states[tf]).join('|');
    const aligned = alignment(states);
    const lower = lowerConsensus(states['4h'], states['1h']);
    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: policy.version,
      status: 'VALID',
      admission: {
        status: 'ADMITTED',
        b1_mtf_contract_version: mtf.contract_version,
        b1_contract_version: policy.b1_contract_version,
        b1_validator_version: policy.b1_validator_version,
        b1_quality_policy_version: policy.b1_quality_policy_version,
        b2c_engine_version: policy.b2c_engine_version,
        b2c_policy_version: policy.b2c_policy_version,
        analysis_as_of_ms: cutoff,
        snapshot_ids: snapshotIds
      },
      symbol: canonicalSymbol,
      market_type: marketType,
      source_market_type_label: mtf.market_type,
      analysis_as_of_ms: cutoff,
      required_timeframes: REQUIRED.slice(),
      timeframes: timeframeOutput,
      structure_pattern: pattern,
      alignment_status: aligned.status,
      alignment_context: aligned.context,
      hierarchical_interpretation: interpretation(pattern, aligned.status),
      lower_timeframe_consensus: lower,
      diagnostics: {
        timeframe_count: REQUIRED.length,
        up_count: REQUIRED.filter(tf => states[tf] === 'UP').length,
        down_count: REQUIRED.filter(tf => states[tf] === 'DOWN').length,
        unestablished_count: REQUIRED.filter(tf => states[tf] === 'UNESTABLISHED').length,
        event_count: totalEvents
      }
    });
  }

  return Object.freeze({ ENGINE_VERSION, REQUIRED_TIMEFRAMES: REQUIRED, analyze });
});
