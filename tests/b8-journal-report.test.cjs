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
assert.deepEqual(report.followup_counts_by_status, { missed: 1 });
assert.equal(report.observations_with_followup_count, 1);
assert.equal(report.actual_trade_count, 0);
assert.equal(report.actual_closed_trade_net_pnl.n, 0);
assert.ok(report.limitations.some(x => x.includes('user-triggered snapshots')));
assert.equal(envelope.observations[0].candleWindow.length, 2, 'source envelope must remain unchanged');
console.log('B8 journal report: deterministic assertions PASS');
