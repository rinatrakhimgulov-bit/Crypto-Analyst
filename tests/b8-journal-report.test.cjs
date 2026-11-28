'use strict';

const assert = require('node:assert/strict');
const { buildJournalReport } = require('../src/research/b8-journal-report.js');

const capturedAtMs = 1000000;
const observation = {
  id: 'observation-0001', recordType: 'observation', schemaVersion: 1,
  capturedAt: new Date(capturedAtMs).toISOString(), capturedAtMs,
  market: { source: 'test', marketType: 'linear_perpetual', symbol: 'BTCUSDT', interval: '60' },
  priceContext: { lastPrice: 100, source: 'test' },
  dataQuality: { status: 'VALID', reasonCodes: [] },
  decision: 'WAIT',
  analysisSnapshot: { reasons: ['no confirmed direction'], b2: { setups: {
    status: 'VALID', engine_version: '1.0.0-b7', policy_version: 'b7-explainable-setups-v1',
    analysis_as_of_ms: 1000000,
    setup_candidates: [{
      setup_id: 'candidate-0001', setup_type: 'BREAKOUT_RETEST',
      direction: 'LONG', status: 'CONFIRMED', available_at_ms: 999000,
      invalidation_level: 95, evidence: {}
    }]
  } } },
  candleWindow: [
    { ts: 900000, closeTs: 960000, open: 99, high: 101, low: 98, close: 100, volume: 1, turnover: 100, finality: 'closed' },
    { ts: 960000, closeTs: 1020000, open: 100, high: 101, low: 99, close: 100, volume: 1, turnover: 100, finality: 'forming' }
  ]
};
const envelope = {
  format: 'crypto-analyst-journal', formatVersion: 1, exportedAt: null,
  observations: [observation],
  followups: [{
    id: 'followup-0001', recordType: 'followup', schemaVersion: 1,
    observationId: observation.id, recordedAt: new Date(1060000).toISOString(),
    recordedAtMs: 1060000, status: 'missed', observedPrice: 101
  }],
  actualTrades: []
};
const report = buildJournalReport(envelope);
assert.equal(report.observation_count, 1);
assert.deepEqual(report.decision_counts, { WAIT: 1 });
assert.equal(report.candidate_count, 1);
assert.equal(report.unique_candidate_count, 1);
assert.equal(report.candidate_appearance_count, 1);
assert.equal(report.duplicate_candidate_appearance_count, 0);
assert.deepEqual(report.followup_counts_by_status, { missed: 1 });
assert.equal(report.observations_with_followup_count, 1);
assert.equal(report.actual_trade_count, 0);
assert.equal(report.actual_closed_trade_net_pnl.n, 0);
assert.ok(report.limitations.some(x => x.includes('user-triggered snapshots')));
assert.equal(envelope.observations[0].candleWindow.length, 2, 'source envelope must remain unchanged');
{
  const second = JSON.parse(JSON.stringify(observation));
  second.id = 'observation-0002';
  second.capturedAtMs = capturedAtMs + 60000;
  second.capturedAt = new Date(second.capturedAtMs).toISOString();
  const repeated = buildJournalReport({
    ...envelope,
    observations: [observation, second],
    followups: []
  });
  assert.equal(repeated.candidate_appearance_count, 2,
    'same setup observed in two snapshots remains two appearances');
  assert.equal(repeated.unique_candidate_count, 1,
    'same setup ID in same symbol/timeframe counts once as a unique candidate');
  assert.equal(repeated.duplicate_candidate_appearance_count, 1);
  const conflicting = JSON.parse(JSON.stringify(second));
  conflicting.id = 'observation-0003';
  conflicting.analysisSnapshot.b2.setups.setup_candidates[0].direction = 'SHORT';
  const conflictReport = buildJournalReport({
    ...envelope,
    observations: [observation, conflicting],
    followups: []
  });
  assert.equal(conflictReport.candidate_identity_conflict_count, 1);
  assert.equal(conflictReport.unique_candidate_count, 0,
    'conflicting directions for one stable setup ID must not be silently counted');
}
console.log('B8 journal report: deterministic assertions PASS');
