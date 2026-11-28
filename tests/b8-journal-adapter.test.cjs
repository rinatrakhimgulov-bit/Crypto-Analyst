'use strict';

const assert = require('node:assert/strict');
const { validateEnvelope, importJournalEnvelope } = require('../src/research/b8-journal-adapter.js');

function makeObservation(id, decision, withSetup = true) {
  const capturedAtMs = 180500;
  const candidate = {
    setup_id: 'B7:BREAKOUT_RETEST:1h:60000:zone-1',
    setup_type: 'BREAKOUT_RETEST', direction: 'LONG', status: 'CONFIRMED',
    available_at_ms: 60500, invalidation_level: 95
  };
  return {
    id, recordType: 'observation', schemaVersion: 1,
    capturedAt: new Date(capturedAtMs).toISOString(), capturedAtMs,
    market: { source: 'test', marketType: 'linear_perpetual', symbol: 'BTCUSDT', interval: '60' },
    priceContext: { lastPrice: 100, source: 'test' },
    dataQuality: { status: decision === 'WAIT' ? 'INVALID' : 'VALID', reasonCodes: ['TEST'] },
    decision,
    analysisSnapshot: {
      reasons: ['fixture'],
      b2: { status: 'VALID', setups: withSetup ? {
        engine_version: '1.0.0-b7', policy_version: 'b7-explainable-setups-v1',
        status: 'VALID', analysis_as_of_ms: 120500, setup_candidates: [candidate]
      } : { status: 'VALID', analysis_as_of_ms: 120500, setup_candidates: [] } }
    },
    candleWindow: [
      { ts: 0, closeTs: 60000, open: 100, high: 101, low: 99, close: 100, volume: 10, turnover: 1000, finality: 'closed' },
      { ts: 60000, closeTs: 120000, open: 100, high: 102, low: 99, close: 101, volume: 11, turnover: 1111, finality: 'closed' },
      { ts: 120000, closeTs: 180000, open: 101, high: 103, low: 100, close: 102, volume: 12, turnover: 1224, finality: 'forming' }
    ]
  };
}
function envelope(observations) {
  return { format: 'crypto-analyst-journal', formatVersion: 1, exportedAt: null,
    observations, followups: [], actualTrades: [] };
}

{
  const source = envelope([makeObservation('observation-1', 'LONG'), makeObservation('observation-2', 'WAIT', false)]);
  const before = JSON.stringify(source);
  const result = importJournalEnvelope(source);
  assert.equal(result.observation_count, 2);
  assert.deepEqual(result.decision_counts, { LONG: 1, WAIT: 1 });
  assert.equal(result.observations[0].setup_candidates.length, 1);
  assert.equal(result.observations[0].closed_candles.length, 2);
  assert.equal(result.observations[0].forming_candle_count, 1);
  assert.equal(result.observations[1].setup_candidates.length, 0);
  assert.equal(JSON.stringify(source), before, 'import must not mutate source envelope');
  assert.equal(Object.isFrozen(result.observations[0].setup_candidates[0].evidence), true);
}
{
  const source = envelope([makeObservation('observation-3', 'SHORT')]);
  source.observations[0].analysisSnapshot.b2.setups.setup_candidates[0].available_at_ms = 999999;
  const result = importJournalEnvelope(source);
  assert.equal(result.observations[0].setup_candidates.length, 0);
  assert.equal(result.observations[0].excluded_candidate_count, 1);
}
{
  const source = envelope([makeObservation('observation-unsupported-b7', 'LONG')]);
  source.observations[0].analysisSnapshot.b2.setups.engine_version = '2.0.0-b7';
  const result = importJournalEnvelope(source);
  assert.equal(result.observations[0].setup_status, 'UNSUPPORTED_VERSION');
  assert.equal(result.observations[0].setup_candidates.length, 0);
}
{
  const source = envelope([makeObservation('observation-future-cutoff', 'LONG')]);
  source.observations[0].analysisSnapshot.b2.setups.analysis_as_of_ms = 240000;
  const result = importJournalEnvelope(source);
  assert.equal(result.observations[0].setup_candidates.length, 0,
    'future analysis cutoff must not be accepted for a past journal capture');
  assert.equal(result.observations[0].excluded_candidate_count, 1);
}
{
  const source = envelope([makeObservation('observation-4', 'LONG')]);
  source.observations[0].candleWindow[1].finality = 'future';
  assert.throws(() => validateEnvelope(source), /B8_JOURNAL_CANDLE_INVALID/);
}
{
  const source = envelope([makeObservation('observation-6', 'LONG')]);
  source.observations[0].priceContext.lastPrice = NaN;
  assert.throws(() => validateEnvelope(source), /B8_JOURNAL_OBSERVATION_INVALID/);
}
{
  const source = envelope([makeObservation('observation-5', 'LONG'), makeObservation('observation-5', 'WAIT')]);
  assert.throws(() => validateEnvelope(source), /B8_JOURNAL_RECORD_ID_OR_SCHEMA_INVALID/);
}
{
  const source = envelope([makeObservation('observation-7', 'LONG')]);
  source.observations[0].candleWindow[0].closeTs = 200000;
  assert.throws(() => validateEnvelope(source), /B8_JOURNAL_CANDLE_INVALID/);
}
{
  const observation = makeObservation('observation-8', 'LONG');
  const source = envelope([observation]);
  source.followups.push({
    id: 'followup-0008', recordType: 'followup', schemaVersion: 1,
    observationId: observation.id, recordedAt: new Date(100000).toISOString(),
    recordedAtMs: 100000, status: 'missed'
  });
  assert.throws(() => validateEnvelope(source), /B8_JOURNAL_FOLLOWUP_INVALID/);
}
{
  const observation = makeObservation('observation-9', 'LONG');
  const source = envelope([observation]);
  source.actualTrades.push({
    id: 'trade-00009', recordType: 'actual_trade', schemaVersion: 1,
    observationId: observation.id, recordedAt: new Date(200000).toISOString(),
    recordedAtMs: 200000, side: 'LONG', status: 'closed',
    entryAt: new Date(100000).toISOString(), entryAtMs: 100000,
    exitAt: new Date(150000).toISOString(), exitAtMs: 150000,
    entryPrice: 100, exitPrice: 101
  });
  assert.throws(() => validateEnvelope(source), /B8_JOURNAL_TRADE_CLOSE_INVALID/);
}
console.log('B8 journal adapter: deterministic assertions PASS');
