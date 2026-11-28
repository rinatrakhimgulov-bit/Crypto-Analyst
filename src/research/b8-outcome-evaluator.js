'use strict';

const DEFAULT_HORIZONS = Object.freeze([1, 3, 6, 12]);

function finite(value) { return Number.isFinite(value); }
function assert(condition, message) { if (!condition) throw new Error(message); }

function validateCandles(candles) {
  assert(Array.isArray(candles) && candles.length >= 2, 'B8_CANDLES_INSUFFICIENT');
  let previousOpen = -Infinity;
  for (const candle of candles) {
    assert(candle && Number.isSafeInteger(candle.open_time_ms) &&
      Number.isSafeInteger(candle.close_time_ms) &&
      candle.close_time_ms > candle.open_time_ms &&
      candle.open_time_ms > previousOpen, 'B8_CANDLE_TIME_INVALID');
    assert(['open', 'high', 'low', 'close'].every(key => finite(candle[key]) && candle[key] > 0),
      'B8_CANDLE_PRICE_INVALID');
    assert(candle.high >= Math.max(candle.open, candle.close, candle.low) &&
      candle.low <= Math.min(candle.open, candle.close, candle.high), 'B8_CANDLE_OHLC_INVALID');
    previousOpen = candle.open_time_ms;
  }
}

function directionalReturn(entry, exit, direction) {
  return direction === 'LONG' ? (exit - entry) / entry : (entry - exit) / entry;
}

function excursion(entry, high, low, direction) {
  if (direction === 'LONG') return { mfe: (high - entry) / entry, mae: (entry - low) / entry };
  return { mfe: (entry - low) / entry, mae: (high - entry) / entry };
}

function findEntryIndex(candles, availableAtMs, lagMs) {
  // Entry is the close of the first candle whose finality/availability is strictly
  // later than the candidate. Never use a candle open that predates availability.
  return candles.findIndex(c => c.close_time_ms + lagMs > availableAtMs);
}
function findCandidateContextIndex(candles, availableAtMs, lagMs) {
  let index = -1;
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].close_time_ms + lagMs <= availableAtMs) index = i;
    else break;
  }
  return index;
}
function validateCostModel(costModel) {
  if (costModel == null) return;
  for (const key of ['entry_fee_bps', 'exit_fee_bps', 'entry_slippage_bps', 'exit_slippage_bps']) {
    if (costModel[key] != null && (!finite(costModel[key]) || costModel[key] < 0)) {
      throw new Error('B8_COST_MODEL_INVALID:' + key);
    }
  }
  if (costModel.funding_status != null &&
      !['UNKNOWN', 'OBSERVED', 'SCENARIO'].includes(costModel.funding_status)) {
    throw new Error('B8_FUNDING_STATUS_INVALID');
  }
}

function barrierResult({ candles, entryIndex, entryPrice, stop, direction, targetR, riskDistance, maxBars, costModel }) {
  const target = direction === 'LONG'
    ? entryPrice + riskDistance * targetR
    : entryPrice - riskDistance * targetR;
  const end = Math.min(candles.length - 1, entryIndex + maxBars);
  for (let i = entryIndex + 1; i <= end; i++) {
    const c = candles[i];
    const stopTouched = direction === 'LONG' ? c.low <= stop : c.high >= stop;
    const targetTouched = direction === 'LONG' ? c.high >= target : c.low <= target;
    if (!stopTouched && !targetTouched) continue;

    if (stopTouched && targetTouched) {
      const gapStop = direction === 'LONG' ? c.open <= stop : c.open >= stop;
      const fill = gapStop ? c.open : stop;
      return makeBarrierOutcome('STOP_FIRST_AMBIGUOUS', fill, i, entryPrice, direction, riskDistance, costModel);
    }
    if (stopTouched) {
      const gapStop = direction === 'LONG' ? c.open <= stop : c.open >= stop;
      return makeBarrierOutcome(gapStop ? 'STOP_GAP' : 'STOP', gapStop ? c.open : stop,
        i, entryPrice, direction, riskDistance, costModel);
    }
    // A target gap is capped at the target. No price improvement is assumed.
    return makeBarrierOutcome('TARGET', target, i, entryPrice, direction, riskDistance, costModel);
  }
  if (end < entryIndex + maxBars) return { status: 'UNAVAILABLE', reason: 'INSUFFICIENT_HORIZON' };
  const last = candles[end];
  return makeBarrierOutcome('TIMEOUT', last.close, end, entryPrice, direction, riskDistance, costModel);
}

function makeBarrierOutcome(status, exitPrice, exitIndex, entryPrice, direction, riskDistance, costModel) {
  const grossReturn = directionalReturn(entryPrice, exitPrice, direction);
  const grossR = grossReturn / (riskDistance / entryPrice);
  const costsKnown = costModel && ['entry_fee_bps', 'exit_fee_bps', 'entry_slippage_bps', 'exit_slippage_bps']
    .every(key => finite(costModel[key]) && costModel[key] >= 0);
  // Entry costs are charged on entry notional; exit costs on exit notional.
  const entryCostBps = costsKnown ? costModel.entry_fee_bps + costModel.entry_slippage_bps : null;
  const exitCostBps = costsKnown ? costModel.exit_fee_bps + costModel.exit_slippage_bps : null;
  const totalCostFraction = costsKnown
    ? (entryCostBps + exitCostBps * (exitPrice / entryPrice)) / 10000 : null;
  const totalCostBps = totalCostFraction == null ? null : totalCostFraction * 10000;
  const netReturn = costsKnown ? grossReturn - totalCostFraction : null;
  return {
    status, exit_index: exitIndex, exit_price: exitPrice,
    gross_return_pct: grossReturn * 100, gross_r: grossR,
    cost_bps: totalCostBps,
    net_return_pct: netReturn == null ? null : netReturn * 100,
    net_r: netReturn == null ? null : netReturn / (riskDistance / entryPrice),
    funding_status: costModel && costModel.funding_status === 'OBSERVED'
      ? 'OBSERVED_NOT_APPLIED' : (costModel && costModel.funding_status === 'SCENARIO'
        ? 'SCENARIO_NOT_APPLIED' : 'UNKNOWN_NOT_MODELED')
  };
}

function evaluateCandidate(input) {
  assert(input && input.candidate, 'B8_CANDIDATE_MISSING');
  const candidate = input.candidate;
  const candles = input.candles;
  validateCandles(candles);
  assert(candidate.status === 'CONFIRMED', 'B8_CANDIDATE_NOT_CONFIRMED');
  assert(candidate.direction === 'LONG' || candidate.direction === 'SHORT', 'B8_DIRECTION_INVALID');
  assert(Number.isSafeInteger(candidate.available_at_ms) && candidate.available_at_ms > 0,
    'B8_CANDIDATE_TIME_INVALID');
  const lag = input.finalitySafetyLagMs == null ? 500 : input.finalitySafetyLagMs;
  assert(Number.isSafeInteger(lag) && lag >= 0, 'B8_FINALITY_LAG_INVALID');
  const horizons = input.horizons || DEFAULT_HORIZONS;
  validateCostModel(input.costModel || null);
  if (input.analysisAsOfMs != null && (!Number.isSafeInteger(input.analysisAsOfMs) ||
      candidate.available_at_ms > input.analysisAsOfMs)) throw new Error('B8_CANDIDATE_AFTER_ANALYSIS_CUTOFF');
  assert(Array.isArray(horizons) && horizons.length > 0 &&
    horizons.every(n => Number.isSafeInteger(n) && n > 0), 'B8_HORIZONS_INVALID');

  const entryIndex = findEntryIndex(candles, candidate.available_at_ms, lag);
  if (entryIndex < 0) return {
    status: 'EXCLUDED', reason: 'NO_CAUSAL_ENTRY_CANDLE',
    candidate_id: candidate.setup_id || null
  };
  const entry = candles[entryIndex];
  const entryPrice = entry.close;
  const candidateContextIndex = findCandidateContextIndex(candles, candidate.available_at_ms, lag);
  const result = {
    status: 'EVALUATED',
    candidate_id: candidate.setup_id || null,
    setup_type: candidate.setup_type || null,
    direction: candidate.direction,
    available_at_ms: candidate.available_at_ms,
    entry: {
      index: entryIndex, price: entryPrice,
      close_time_ms: entry.close_time_ms,
      available_at_ms: entry.close_time_ms + lag,
      delay_ms: entry.close_time_ms + lag - candidate.available_at_ms,
      delay_bars: entryIndex - candidateContextIndex
    },
    horizons: {},
    invalidation: { status: 'UNAVAILABLE', reason: 'INVALIDATION_LEVEL_MISSING' },
    barriers: {}
  };

  for (const horizon of horizons) {
    const endIndex = entryIndex + horizon;
    if (endIndex >= candles.length) {
      result.horizons[horizon] = { status: 'UNAVAILABLE', reason: 'INSUFFICIENT_HORIZON' };
      continue;
    }
    const slice = candles.slice(entryIndex + 1, endIndex + 1);
    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    const last = candles[endIndex];
    const ex = excursion(entryPrice, high, low, candidate.direction);
    result.horizons[horizon] = {
      status: 'AVAILABLE',
      bars: horizon,
      end_close_time_ms: last.close_time_ms,
      forward_return_pct: directionalReturn(entryPrice, last.close, candidate.direction) * 100,
      mfe_pct: ex.mfe * 100,
      mae_pct: ex.mae * 100
    };
  }

  const stop = candidate.invalidation_level;
  const validStop = finite(stop) && stop > 0 &&
    (candidate.direction === 'LONG' ? stop < entryPrice : stop > entryPrice);
  if (validStop) {
    const riskDistance = Math.abs(entryPrice - stop);
    result.invalidation = {
      status: 'AVAILABLE', level: stop,
      risk_distance_pct: riskDistance / entryPrice * 100
    };
    const maxBars = input.barrierMaxBars || Math.max(...horizons);
    const targets = input.targetRMultiples || [1, 2];
    for (const targetR of targets) {
      assert(finite(targetR) && targetR > 0, 'B8_TARGET_R_INVALID');
      result.barriers[String(targetR) + 'R'] = barrierResult({
        candles, entryIndex, entryPrice, stop, direction: candidate.direction,
        targetR, riskDistance, maxBars, costModel: input.costModel || null
      });
    }
  } else {
    result.invalidation = {
      status: 'UNAVAILABLE',
      reason: stop == null ? 'INVALIDATION_LEVEL_MISSING' : 'INVALIDATION_LEVEL_WRONG_SIDE'
    };
  }
  return result;
}

module.exports = { DEFAULT_HORIZONS, evaluateCandidate, directionalReturn, excursion };
