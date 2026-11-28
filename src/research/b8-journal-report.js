'use strict';

const { importJournalEnvelope } = require('./b8-journal-adapter.js');

function countBy(items, selector) {
  const counts = {};
  for (const item of items) {
    const key = selector(item) || 'UNKNOWN';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}
function summarize(values) {
  const a = values.filter(Number.isFinite).slice().sort((x, y) => x - y);
  if (!a.length) return { n: 0, mean: null, median: null, min: null, max: null };
  const mid = Math.floor(a.length / 2);
  return { n: a.length, mean: a.reduce((sum, x) => sum + x, 0) / a.length,
    median: a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2,
    min: a[0], max: a[a.length - 1] };
}
function buildJournalReport(envelope) {
  const normalized = importJournalEnvelope(envelope);
  const observationById = new Map(envelope.observations.map(row => [row.id, row]));
  const candidates = normalized.observations.flatMap(observation =>
    observation.setup_candidates.map(candidate => ({
      ...candidate, symbol: observation.symbol, timeframe: observation.timeframe,
      observation_id: observation.observation_id
    })));
  const candidateKey = candidate => [candidate.symbol, candidate.timeframe || 'UNKNOWN', candidate.setup_id].join('|');
  const uniqueCandidateMap = new Map();
  for (const candidate of candidates) {
    if (typeof candidate.setup_id !== 'string' || !candidate.setup_id) continue;
    const key = candidateKey(candidate);
    if (!uniqueCandidateMap.has(key)) uniqueCandidateMap.set(key, candidate);
  }
  const uniqueCandidates = Array.from(uniqueCandidateMap.values());
  const followups = envelope.followups.map(row => {
    const observation = observationById.get(row.observationId);
    return { id: row.id, observation_id: row.observationId, status: row.status,
      delay_ms: observation ? row.recordedAtMs - observation.capturedAtMs : null,
      observed_price: row.observedPrice == null ? null : row.observedPrice };
  });
  const trades = normalized.actual_trades;
  const netPnlValues = trades.filter(t => t.status === 'closed' && Number.isFinite(t.netPnl))
    .map(t => t.netPnl);
  return {
    report_version: 'b8-prospective-journal-report-v1',
    format_version: normalized.format_version,
    observation_count: normalized.observation_count,
    decision_counts: normalized.decision_counts,
    quality_status_counts: countBy(normalized.observations, o => o.data_quality_status),
    setup_snapshot_status_counts: countBy(normalized.observations, o => o.setup_status),
    candidate_count: uniqueCandidates.length,
    unique_candidate_count: uniqueCandidates.length,
    candidate_appearance_count: candidates.length,
    duplicate_candidate_appearance_count: candidates.length - uniqueCandidates.length,
    candidate_counts_by_setup: countBy(uniqueCandidates, c => c.setup_type),
    candidate_counts_by_direction: countBy(uniqueCandidates, c => c.direction),
    candidate_appearance_counts_by_setup: countBy(candidates, c => c.setup_type),
    candidate_appearance_counts_by_direction: countBy(candidates, c => c.direction),
    candidate_status_appearance_counts: countBy(normalized.observations.flatMap(o =>
      Object.entries(o.setup_candidate_status_counts).flatMap(([status, count]) =>
        Array.from({ length: count }, () => ({ status })))), c => c.status),
    followup_count: followups.length,
    followup_counts_by_status: countBy(followups, f => f.status),
    observations_with_followup_count: new Set(followups.map(f => f.observation_id)).size,
    followup_delay_ms: summarize(followups.map(f => f.delay_ms)),
    actual_trade_count: trades.length,
    actual_trade_status_counts: countBy(trades, t => t.status),
    actual_closed_trade_net_pnl: summarize(netPnlValues),
    actual_trade_net_pnl_note: 'Only manually recorded netPnl values are summarized. Missing PnL, fees or funding are not inferred.',
    limitations: [
      'B5 observations are user-triggered snapshots, not automatic capture of every analysis cycle.',
      'Follow-ups are manually appended and link to an observation, not to a specific B7 setup candidate.',
      'The observation candle window is historical context at capture time; it does not contain future OHLCV.',
      'No MFE/MAE, fill, win-rate or simulated profitability result is inferred from sparse follow-up marks.',
      'Actual trades remain separate from paper observations and are summarized only from explicitly recorded fields.'
    ]
  };
}

module.exports = { buildJournalReport };
