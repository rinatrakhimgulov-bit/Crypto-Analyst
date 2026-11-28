'use strict';

const FORMAT = 'crypto-analyst-journal';
const FORMAT_VERSION = 1;
const MAX_OBSERVATIONS = 100;
const MAX_FOLLOWUPS = 500;
const MAX_TRADES = 100;
const MAX_CANDLES = 160;
const DECISIONS = new Set(['LONG', 'SHORT', 'WAIT']);
const FOLLOWUP_STATUSES = new Set(['setup_formed', 'triggered', 'invalidated', 'expired', 'missed', 'still_waiting', 'manual_note']);
const TIMEFRAMES = Object.freeze({ '60': '1h', '240': '4h', D: '1d', '1h': '1h', '4h': '4h', '1d': '1d' });

function fail(code) { throw new Error(code); }
function isObject(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function safeDatePair(iso, ms) {
  return typeof iso === 'string' && Number.isFinite(Date.parse(iso)) &&
    Number.isSafeInteger(ms) && Math.abs(Date.parse(iso) - ms) <= 1000;
}
function validateEnvelope(envelope) {
  if (!isObject(envelope) || envelope.format !== FORMAT || envelope.formatVersion !== FORMAT_VERSION ||
      !Array.isArray(envelope.observations) || !Array.isArray(envelope.followups) ||
      !Array.isArray(envelope.actualTrades)) fail('B8_JOURNAL_FORMAT_INVALID');
  if (envelope.observations.length > MAX_OBSERVATIONS ||
      envelope.followups.length > MAX_FOLLOWUPS || envelope.actualTrades.length > MAX_TRADES) {
    fail('B8_JOURNAL_LIMIT_EXCEEDED');
  }
  const ids = new Set();
  const observationIds = new Set();
  const checkId = (record, type) => {
    if (!isObject(record) || record.recordType !== type || record.schemaVersion !== 1 ||
        typeof record.id !== 'string' || record.id.length < 8 || ids.has(record.id)) {
      fail('B8_JOURNAL_RECORD_ID_OR_SCHEMA_INVALID:' + type);
    }
    ids.add(record.id);
  };
  for (const record of envelope.observations) {
    checkId(record, 'observation');
    if (!safeDatePair(record.capturedAt, record.capturedAtMs) ||
        !isObject(record.market) || typeof record.market.symbol !== 'string' ||
        typeof record.market.interval !== 'string' || !DECISIONS.has(record.decision) ||
        !isObject(record.priceContext) || typeof record.priceContext.source !== 'string' ||
        !isObject(record.dataQuality) || typeof record.dataQuality.status !== 'string' ||
        !Array.isArray(record.dataQuality.reasonCodes) || !isObject(record.analysisSnapshot) ||
        !Array.isArray(record.analysisSnapshot.reasons) ||
        !Array.isArray(record.candleWindow) || !record.candleWindow.length ||
        record.candleWindow.length > MAX_CANDLES) fail('B8_JOURNAL_OBSERVATION_INVALID');
    let previousTs = -Infinity;
    for (const candle of record.candleWindow) {
      if (!isObject(candle) || !Number.isSafeInteger(candle.ts) ||
          candle.ts <= previousTs || candle.ts > record.capturedAtMs ||
          !Number.isSafeInteger(candle.closeTs) || candle.closeTs <= candle.ts ||
          !['closed', 'forming'].includes(candle.finality) ||
          !['open', 'high', 'low', 'close', 'volume', 'turnover'].every(k => Number.isFinite(candle[k])) ||
          candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0 ||
          candle.volume < 0 || candle.turnover < 0 ||
          candle.high < Math.max(candle.open, candle.close, candle.low) ||
          candle.low > Math.min(candle.open, candle.close, candle.high)) {
        fail('B8_JOURNAL_CANDLE_INVALID');
      }
      previousTs = candle.ts;
    }
    observationIds.add(record.id);
  }
  for (const record of envelope.followups) {
    checkId(record, 'followup');
    if (!observationIds.has(record.observationId) || !safeDatePair(record.recordedAt, record.recordedAtMs) ||
        !FOLLOWUP_STATUSES.has(record.status) ||
        (record.observedPrice != null && (!Number.isFinite(record.observedPrice) || record.observedPrice <= 0)) ||
        (record.note != null && (typeof record.note !== 'string' || record.note.length > 500))) {
      fail('B8_JOURNAL_FOLLOWUP_INVALID');
    }
  }
  for (const record of envelope.actualTrades) {
    checkId(record, 'actual_trade');
    if (!observationIds.has(record.observationId) || !safeDatePair(record.recordedAt, record.recordedAtMs) ||
        !['LONG', 'SHORT'].includes(record.side) || !['open', 'closed', 'void'].includes(record.status) ||
        !Number.isFinite(record.entryPrice) || record.entryPrice <= 0) fail('B8_JOURNAL_TRADE_INVALID');
    if (record.status === 'closed' &&
        (!Number.isFinite(record.exitPrice) || record.exitPrice <= 0 ||
         !Number.isSafeInteger(record.entryAtMs) || !Number.isSafeInteger(record.exitAtMs) ||
         record.entryAtMs > record.exitAtMs || record.exitAtMs > record.recordedAtMs ||
         !safeDatePair(record.entryAt, record.entryAtMs) || !safeDatePair(record.exitAt, record.exitAtMs))) {
      fail('B8_JOURNAL_TRADE_CLOSE_INVALID');
    }
    if (record.quantity != null && (!Number.isFinite(record.quantity) || record.quantity <= 0)) fail('B8_JOURNAL_TRADE_QUANTITY_INVALID');
    if (record.fees != null && (!Number.isFinite(record.fees) || record.fees < 0)) fail('B8_JOURNAL_TRADE_FEES_INVALID');
    if (record.funding != null && !Number.isFinite(record.funding)) fail('B8_JOURNAL_TRADE_FUNDING_INVALID');
    if (record.netPnl != null && !Number.isFinite(record.netPnl)) fail('B8_JOURNAL_TRADE_PNL_INVALID');
  }
  return true;
}

function normalizeObservation(record) {
  const b2 = record.analysisSnapshot && record.analysisSnapshot.b2;
  const setups = b2 && b2.setups;
  const timeframe = TIMEFRAMES[record.market.interval] || null;
  const marketType = record.market.marketType || 'unknown';
  const closedCandles = record.candleWindow.filter(c => c.finality === 'closed').map(c => ({
    open_time_ms: c.ts, close_time_ms: c.closeTs,
    open: c.open, high: c.high, low: c.low, close: c.close,
    volume_base: c.volume, volume_quote: c.turnover,
    canonical_symbol: record.market.symbol, market_type: marketType,
    timeframe, closed_state: 'OBSERVED_CLOSED'
  }));
  const candidates = setups && setups.status === 'VALID' && Array.isArray(setups.setup_candidates)
    ? setups.setup_candidates.filter(c => c && c.status === 'CONFIRMED' &&
        (c.direction === 'LONG' || c.direction === 'SHORT') &&
        Number.isSafeInteger(c.available_at_ms) && c.available_at_ms <= record.capturedAtMs)
    : [];
  const setupStatus = setups && typeof setups.status === 'string' ? setups.status : 'UNAVAILABLE';
  return {
    observation_id: record.id,
    captured_at_ms: record.capturedAtMs,
    symbol: record.market.symbol,
    market_type: marketType,
    interval: record.market.interval,
    timeframe,
    decision: record.decision,
    data_quality_status: record.dataQuality.status,
    data_quality_reason_codes: record.dataQuality.reasonCodes.slice(),
    setup_engine_version: setups && setups.engine_version || null,
    setup_policy_version: setups && setups.policy_version || null,
    setup_status: setupStatus,
    setup_candidates: candidates.map(c => ({ ...c })),
    closed_candles: closedCandles,
    forming_candle_count: record.candleWindow.filter(c => c.finality === 'forming').length,
    excluded_candidate_count: setups && Array.isArray(setups.setup_candidates)
      ? setups.setup_candidates.length - candidates.length : 0
  };
}

function importJournalEnvelope(envelope) {
  validateEnvelope(envelope);
  const normalized = envelope.observations.map(normalizeObservation);
  return Object.freeze({
    format: FORMAT,
    format_version: FORMAT_VERSION,
    observation_count: normalized.length,
    followup_count: envelope.followups.length,
    actual_trade_count: envelope.actualTrades.length,
    decision_counts: envelope.observations.reduce((acc, record) => {
      acc[record.decision] = (acc[record.decision] || 0) + 1;
      return acc;
    }, {}),
    observations: normalized,
    followups: envelope.followups.map(record => ({ ...record })),
    actual_trades: envelope.actualTrades.map(record => ({ ...record }))
  });
}

module.exports = { validateEnvelope, importJournalEnvelope };
