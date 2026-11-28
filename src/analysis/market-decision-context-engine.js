(function attachMarketDecisionContextEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MarketDecisionContextEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMarketDecisionContextEngine() {
  'use strict';

  const ENGINE_VERSION = '1.0.0-market-decision-context';
  const REQUIRED = Object.freeze({
    b2c: '2.1.0-b2c',
    b2e: '2.0.0-b2e',
    zoneContext: '1.0.0-b2d-zone-context',
    breakoutQuality: '1.0.0-b2e-breakout-quality',
    regime: '1.0.0-market-regime',
    impulse: '1.0.0-market-impulse-event',
    b7: '1.0.0-b7'
  });
  const SETUP_TYPES = new Set([
    'BREAKOUT_RETEST',
    'FALSE_BREAKOUT_RECLAIM',
    'TREND_CONTINUATION_AFTER_CORRECTION'
  ]);
  const IMPULSE_CLASSES = new Set([
    'STRONG_SELL_OFF',
    'SELL_OFF_PARTIAL_EVIDENCE',
    'BEARISH_IMPULSE',
    'BULLISH_IMPULSE',
    'DIRECTIONAL_MOVE_UNCONFIRMED',
    'NO_IMPULSE'
  ]);

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
      decision: 'WAIT',
      decision_type: 'RESEARCH_CANDIDATE_ONLY',
      directional_bias: 'NONE',
      admission: { status: 'BLOCKED', reasons: [{ code, severity: 'CRITICAL' }] },
      snapshot_id: meta.snapshotId || null,
      symbol: meta.symbol || null,
      timeframe: meta.timeframe || null,
      analysis_as_of_ms: meta.asOf ?? null,
      selected_setup_ids: [],
      setup_candidates: [],
      context: null,
      gates: {},
      reasons: [{ code, severity: 'CRITICAL' }]
    });
  }
  function validatePolicy(p) {
    if (!isObject(p) || typeof p.version !== 'string' || !p.version.trim() ||
        typeof p.b1_contract_version !== 'string' || !p.b1_contract_version.trim() ||
        typeof p.b1_validator_version !== 'string' || !p.b1_validator_version.trim() ||
        typeof p.b1_quality_policy_version !== 'string' || !p.b1_quality_policy_version.trim() ||
        p.b2c_engine_version !== REQUIRED.b2c || typeof p.b2c_policy_version !== 'string' || !p.b2c_policy_version.trim() ||
        p.b2e_engine_version !== REQUIRED.b2e || typeof p.b2e_policy_version !== 'string' || !p.b2e_policy_version.trim() ||
        p.zone_context_engine_version !== REQUIRED.zoneContext || typeof p.zone_context_policy_version !== 'string' || !p.zone_context_policy_version.trim() ||
        p.breakout_quality_engine_version !== REQUIRED.breakoutQuality || typeof p.breakout_quality_policy_version !== 'string' || !p.breakout_quality_policy_version.trim() ||
        p.regime_engine_version !== REQUIRED.regime || typeof p.regime_policy_version !== 'string' || !p.regime_policy_version.trim() ||
        p.impulse_engine_version !== REQUIRED.impulse || typeof p.impulse_policy_version !== 'string' || !p.impulse_policy_version.trim() ||
        p.b7_engine_version !== REQUIRED.b7 || typeof p.b7_policy_version !== 'string' || !p.b7_policy_version.trim()) {
      return 'MARKET_DECISION_CONTEXT_POLICY_INVALID';
    }
    return null;
  }
  function matches(result, engineVersion, policyVersion, snapshot, timeframe, asOf) {
    return isObject(result) && result.status === 'VALID' &&
      result.engine_version === engineVersion && result.policy_version === policyVersion &&
      result.snapshot_id === snapshot.snapshot_id &&
      result.symbol === snapshot.canonical_symbol &&
      result.timeframe === timeframe && result.analysis_as_of_ms === asOf &&
      result.admission?.status === 'ADMITTED' &&
      result.admission.snapshot_id === snapshot.snapshot_id;
  }
  function findLifecycle(b2e, candidate) {
    const evidence = candidate.evidence || {};
    return b2e.lifecycles.find(l => l.lifecycle_id === evidence.lifecycle_id &&
      l.breakout_event_id === evidence.breakout_event_id);
  }
  function findBreakoutQuality(quality, candidate) {
    const evidence = candidate.evidence || {};
    return quality.breakouts.find(b => b.lifecycle_id === evidence.lifecycle_id &&
      b.breakout_event_id === evidence.breakout_event_id);
  }
  function candidateReason(candidate, b2e, breakoutQuality, asOf) {
    if (!isObject(candidate) || typeof candidate.setup_id !== 'string' || !candidate.setup_id ||
        !SETUP_TYPES.has(candidate.setup_type) ||
        !['LONG', 'SHORT'].includes(candidate.direction) ||
        candidate.status !== 'CONFIRMED' ||
        !Number.isSafeInteger(candidate.available_at_ms) || candidate.available_at_ms > asOf ||
        !Number.isFinite(candidate.invalidation_level) || candidate.invalidation_level <= 0 ||
        !isObject(candidate.evidence)) return 'B7_CONFIRMED_SETUP_INVALID_OR_NOT_CAUSAL';

    if (candidate.setup_type === 'BREAKOUT_RETEST') {
      const lifecycle = findLifecycle(b2e, candidate);
      if (!lifecycle || !['BULLISH', 'BEARISH'].includes(lifecycle.direction) ||
          candidate.direction !== (lifecycle.direction === 'BULLISH' ? 'LONG' : 'SHORT') ||
          lifecycle.status !== 'RETEST_SUCCESSFUL' ||
          !lifecycle.confirmation || lifecycle.confirmation.outcome !== 'SUCCESS' ||
          !Number.isSafeInteger(lifecycle.confirmation.available_at_ms) ||
          lifecycle.confirmation.available_at_ms > asOf) return 'B2E_BREAKOUT_RETEST_NOT_CONFIRMED';
      const quality = findBreakoutQuality(breakoutQuality, candidate);
      if (!quality || quality.direction !== lifecycle.direction || quality.quality_status !== 'STRONG_EVIDENCE') return 'BREAKOUT_QUALITY_NOT_STRONG';
    } else if (candidate.setup_type === 'FALSE_BREAKOUT_RECLAIM') {
      const lifecycle = findLifecycle(b2e, candidate);
      if (!lifecycle || !['BULLISH', 'BEARISH'].includes(lifecycle.direction) ||
          candidate.direction !== (lifecycle.direction === 'BULLISH' ? 'SHORT' : 'LONG') ||
          lifecycle.status !== 'RETEST_FAILED' ||
          !lifecycle.confirmation || lifecycle.confirmation.outcome !== 'FAILURE' ||
          !Number.isSafeInteger(lifecycle.confirmation.available_at_ms) ||
          lifecycle.confirmation.available_at_ms > asOf) return 'FALSE_BREAKOUT_RECLAIM_NOT_CONFIRMED';
    }
    return null;
  }
  function analyze(input) {
    const policy = input && input.policy;
    const snapshot = input && input.snapshot;
    const report = input && input.quality_report;
    const asOf = input && input.analysis_as_of_ms;
    const meta = {
      policyVersion: policy && policy.version,
      snapshotId: snapshot && snapshot.snapshot_id,
      symbol: snapshot && snapshot.canonical_symbol,
      timeframe: input && input.timeframe,
      asOf
    };
    if (!isObject(snapshot) || !isObject(report)) return blocked('MARKET_DECISION_CONTEXT_INPUT_MISSING', meta);
    const policyError = validatePolicy(policy);
    if (policyError) return blocked(policyError, meta);
    if (!Number.isSafeInteger(asOf) || asOf <= 0 ||
        snapshot.analysis_as_of_ms !== asOf || snapshot.provider_server_time_ms !== asOf ||
        !isObject(snapshot.provider_metadata) || snapshot.provider_metadata.time_source !== 'provider') {
      return blocked('B1_ANALYSIS_CUTOFF_INVALID', meta);
    }
    if (typeof snapshot.snapshot_id !== 'string' || !snapshot.snapshot_id ||
        snapshot.contract_version !== policy.b1_contract_version ||
        typeof snapshot.canonical_symbol !== 'string' || !snapshot.canonical_symbol ||
        typeof snapshot.market_type !== 'string' || !snapshot.market_type) {
      return blocked('B1_SNAPSHOT_IDENTITY_INVALID', meta);
    }
    const keys = Object.keys(snapshot.candles_by_timeframe || {});
    const timeframe = keys.length === 1 ? keys[0] : null;
    meta.timeframe = timeframe;
    if (!['1h', '4h', '1d'].includes(timeframe) || (input.timeframe && input.timeframe !== timeframe)) {
      return blocked('MARKET_DECISION_TIMEFRAME_INVALID', meta);
    }
    if (report.status !== 'VALID' || report.snapshot_id !== snapshot.snapshot_id ||
        report.symbol !== snapshot.canonical_symbol || report.timeframe !== timeframe ||
        report.analysis_as_of_ms !== asOf || report.validator_version !== policy.b1_validator_version ||
        report.policy_version !== policy.b1_quality_policy_version ||
        !Number.isSafeInteger(report.checked_at_ms) || report.checked_at_ms < 0) {
      return blocked('B1_QUALITY_REPORT_IDENTITY_MISMATCH', meta);
    }

    const b2c = input.b2c_result;
    const b2e = input.b2e_result;
    const zoneContext = input.zone_context_result;
    const breakoutQuality = input.breakout_quality_result;
    const regime = input.regime_result;
    const impulse = input.impulse_result;
    const b7 = input.b7_result;
    const identityChecks = [
      ['B2C_RESULT_IDENTITY_MISMATCH', b2c, REQUIRED.b2c, policy.b2c_policy_version],
      ['B2E_RESULT_IDENTITY_MISMATCH', b2e, REQUIRED.b2e, policy.b2e_policy_version],
      ['B2D_ZONE_CONTEXT_IDENTITY_MISMATCH', zoneContext, REQUIRED.zoneContext, policy.zone_context_policy_version],
      ['B2E_BREAKOUT_QUALITY_IDENTITY_MISMATCH', breakoutQuality, REQUIRED.breakoutQuality, policy.breakout_quality_policy_version],
      ['MARKET_REGIME_IDENTITY_MISMATCH', regime, REQUIRED.regime, policy.regime_policy_version],
      ['MARKET_IMPULSE_IDENTITY_MISMATCH', impulse, REQUIRED.impulse, policy.impulse_policy_version],
      ['B7_SETUP_IDENTITY_MISMATCH', b7, REQUIRED.b7, policy.b7_policy_version]
    ];
    for (const [code, result, version, policyVersion] of identityChecks) {
      if (!matches(result, version, policyVersion, snapshot, timeframe, asOf)) return blocked(code, meta);
    }
    if (!Array.isArray(b2e.lifecycles) || !Array.isArray(breakoutQuality.breakouts) ||
        !Array.isArray(b7.setup_candidates) || !isObject(impulse.event) ||
        !IMPULSE_CLASSES.has(impulse.event.classification) ||
        !['BULLISH', 'BEARISH', 'NEUTRAL'].includes(impulse.event.direction) ||
        !isObject(zoneContext.active_zone_selection) ||
        !['UPTREND', 'DOWNTREND', 'RANGE', 'IMPULSE', 'TRANSITION', 'UNKNOWN'].includes(regime.regime) ||
        !['UP', 'DOWN', 'UNESTABLISHED'].includes(b2c.structure_state) ||
        !['BULLISH', 'BEARISH', 'NEUTRAL', 'NONE'].includes(regime.directional_bias)) {
      return blocked('MARKET_DECISION_UPSTREAM_PAYLOAD_INVALID', meta);
    }
    if (regime.structure_state !== b2c.structure_state) return blocked('MARKET_REGIME_STRUCTURE_CONFLICT', meta);

    const validCandidates = [];
    const rejectedCandidates = [];
    for (const candidate of b7.setup_candidates) {
      if (!isObject(candidate) || candidate.status !== 'CONFIRMED') continue;
      const reason = candidateReason(candidate, b2e, breakoutQuality, asOf);
      if (reason) rejectedCandidates.push({ setup_id: candidate.setup_id || null, code: reason });
      else validCandidates.push(candidate);
    }
    const confirmedDirections = [...new Set(validCandidates.map(c => c.direction))];
    const regimeAlignment = regime.regime === 'UPTREND' && regime.directional_bias === 'BULLISH' &&
      b2c.structure_state === 'UP' ? 'BULLISH' :
      regime.regime === 'DOWNTREND' && regime.directional_bias === 'BEARISH' &&
      b2c.structure_state === 'DOWN' ? 'BEARISH' : 'NONE';
    const candidateDirection = confirmedDirections.length === 1 ? confirmedDirections[0] : 'NONE';
    const aligned = regimeAlignment === 'BULLISH' && candidateDirection === 'LONG' ? 'LONG' :
      regimeAlignment === 'BEARISH' && candidateDirection === 'SHORT' ? 'SHORT' : 'NONE';

    const impulseClass = impulse.event.classification;
    const impulseDirection = impulse.event.direction;
    const oppositeImpulse = aligned === 'LONG'
      ? ['BEARISH_IMPULSE', 'STRONG_SELL_OFF', 'SELL_OFF_PARTIAL_EVIDENCE', 'DIRECTIONAL_MOVE_UNCONFIRMED'].includes(impulseClass) && impulseDirection === 'BEARISH'
      : aligned === 'SHORT'
        ? ['BULLISH_IMPULSE', 'DIRECTIONAL_MOVE_UNCONFIRMED'].includes(impulseClass) && impulseDirection === 'BULLISH'
        : false;

    const gates = {
      data_quality: 'PASS',
      upstream_identity: 'PASS',
      regime_structure_alignment: regimeAlignment === 'NONE' ? 'BLOCK' : 'PASS',
      confirmed_setup: candidateDirection === 'NONE' ? 'BLOCK' : 'PASS',
      single_direction: confirmedDirections.length > 1 ? 'BLOCK' : 'PASS',
      impulse_conflict: oppositeImpulse ? 'BLOCK' : 'PASS'
    };
    let decision = 'WAIT';
    let decisionCode = 'NO_FULL_ALIGNMENT';
    if (confirmedDirections.length > 1) decisionCode = 'CONFLICTING_CONFIRMED_SETUPS';
    else if (candidateDirection === 'NONE') decisionCode = 'NO_CAUSAL_CONFIRMED_SETUP';
    else if (regimeAlignment === 'NONE') decisionCode = 'REGIME_AND_STRUCTURE_NOT_ALIGNED';
    else if (candidateDirection !== (regimeAlignment === 'BULLISH' ? 'LONG' : 'SHORT')) decisionCode = 'SETUP_OPPOSES_REGIME';
    else if (oppositeImpulse) decisionCode = 'OPPOSING_IMPULSE_CONTEXT';
    else {
      decision = aligned;
      decisionCode = 'ALL_DIRECTIONAL_GATES_PASSED';
    }

    const selected = decision === 'WAIT' ? [] : validCandidates.filter(c => c.direction === decision);
    const nearestSupport = zoneContext.active_zone_selection && zoneContext.active_zone_selection.nearest_support;
    const nearestResistance = zoneContext.active_zone_selection && zoneContext.active_zone_selection.nearest_resistance;
    const reasons = [{ code: decisionCode, severity: decision === 'WAIT' ? 'INFO' : 'INFO' }];
    for (const rejected of rejectedCandidates.slice(0, 10)) {
      reasons.push({ code: rejected.code, setup_id: rejected.setup_id, severity: 'WARN' });
    }
    if (decision === 'WAIT' && b7.setup_candidates.some(c => c.status === 'PENDING')) {
      reasons.push({ code: 'SETUP_PENDING_RETEST_OR_CONFIRMATION', severity: 'INFO' });
    }
    return freezeDeep({
      engine_version: ENGINE_VERSION,
      policy_version: policy.version,
      status: 'VALID',
      decision,
      decision_type: 'RESEARCH_CANDIDATE_ONLY',
      directional_bias: regime.directional_bias,
      admission: {
        status: 'ADMITTED',
        snapshot_id: snapshot.snapshot_id,
        upstream_engine_versions: {
          b2c: b2c.engine_version, b2e: b2e.engine_version,
          zone_context: zoneContext.engine_version,
          breakout_quality: breakoutQuality.engine_version,
          regime: regime.engine_version, impulse: impulse.engine_version, b7: b7.engine_version
        }
      },
      snapshot_id: snapshot.snapshot_id,
      symbol: snapshot.canonical_symbol,
      timeframe,
      analysis_as_of_ms: asOf,
      selected_setup_ids: selected.map(c => c.setup_id),
      setup_candidates: selected.map(c => ({
        setup_id: c.setup_id, setup_type: c.setup_type, direction: c.direction,
        available_at_ms: c.available_at_ms, setup_invalidation_level: c.invalidation_level,
        reason_codes: c.reason_codes, explanation: c.explanation
      })),
      context: {
        regime: regime.regime,
        structure_state: b2c.structure_state,
        impulse_classification: impulseClass,
        impulse_direction: impulseDirection,
        impulse_displacement_atr: impulse.event.metrics && impulse.event.metrics.displacement_atr,
        nearest_support: nearestSupport ? {
          zone_id: nearestSupport.zone_id, lower_bound: nearestSupport.lower_bound,
          upper_bound: nearestSupport.upper_bound, distance_atr: nearestSupport.distance_atr,
          freshness_status: nearestSupport.freshness_status
        } : null,
        nearest_resistance: nearestResistance ? {
          zone_id: nearestResistance.zone_id, lower_bound: nearestResistance.lower_bound,
          upper_bound: nearestResistance.upper_bound, distance_atr: nearestResistance.distance_atr,
          freshness_status: nearestResistance.freshness_status
        } : null,
        breakout_quality_counts: {
          strong: breakoutQuality.breakouts.filter(b => b.quality_status === 'STRONG_EVIDENCE').length,
          mixed: breakoutQuality.breakouts.filter(b => b.quality_status === 'MIXED_EVIDENCE').length,
          weak: breakoutQuality.breakouts.filter(b => b.quality_status === 'WEAK_EVIDENCE').length,
          partial: breakoutQuality.breakouts.filter(b => b.quality_status === 'PARTIAL_EVIDENCE').length
        }
      },
      gates,
      reasons
    });
  }

  return Object.freeze({ ENGINE_VERSION, REQUIRED, analyze });
});
