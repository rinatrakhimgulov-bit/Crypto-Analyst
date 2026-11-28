'use strict';

function canonicalCandidate(candidate) {
  return JSON.stringify({
    setup_type: candidate.setup_type,
    direction: candidate.direction,
    status: candidate.status,
    available_at_ms: candidate.available_at_ms,
    invalidation_level: candidate.invalidation_level == null ? null : candidate.invalidation_level
  });
}

function deduplicateCandidates(seriesEntries) {
  const byKey = new Map();
  for (const series of seriesEntries) {
    for (const window of series.windows || []) {
      for (const candidate of window.candidates || []) {
        if (!candidate || typeof candidate.setup_id !== 'string' || !candidate.setup_id ||
            !Number.isSafeInteger(candidate.available_at_ms)) {
          throw new Error('B8_HISTORICAL_CANDIDATE_ID_OR_TIME_INVALID');
        }
        const key = series.symbol + '|' + series.timeframe + '|' + candidate.setup_id;
        const normalized = {
          ...candidate,
          symbol: series.symbol,
          timeframe: series.timeframe,
          first_seen_window_quantile: window.quantile
        };
        const prior = byKey.get(key);
        if (!prior) byKey.set(key, normalized);
        else if (canonicalCandidate(prior) !== canonicalCandidate(normalized)) {
          throw new Error('B8_HISTORICAL_DUPLICATE_ID_CONFLICT:' + key);
        }
      }
    }
  }
  return Array.from(byKey.values()).sort((a, b) =>
    a.symbol.localeCompare(b.symbol) || a.timeframe.localeCompare(b.timeframe) ||
    a.available_at_ms - b.available_at_ms || a.setup_id.localeCompare(b.setup_id));
}

function chronologicalSplit(candidate, startMs, endMs) {
  if (!Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs) || endMs <= startMs ||
      !Number.isSafeInteger(candidate.available_at_ms)) throw new Error('B8_SPLIT_BOUNDARY_INVALID');
  const trainEnd = startMs + (endMs - startMs) * 0.6;
  const validationEnd = startMs + (endMs - startMs) * 0.8;
  if (candidate.available_at_ms < trainEnd) return 'TRAIN';
  if (candidate.available_at_ms < validationEnd) return 'VALIDATION';
  return 'TEST';
}

module.exports = { deduplicateCandidates, chronologicalSplit };
