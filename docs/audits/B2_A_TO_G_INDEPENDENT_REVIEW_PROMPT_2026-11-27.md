# Independent exact-source audit prompt — B2-A through B2-G

**Target repository:** rinatrakhimgulov-bit/Crypto-Analyst  
**Target branch:** feature/b2g-chart-projection-contract-2026-11-27  
**Draft PR:** #20 — B2-A–B2-G: causal market-structure research chain and historical replay  
**Target head at prompt creation:** deff5e4d8f65b1c67f82989725af0a45227f7100  
**Mode:** independent audit only. Do not modify files, push commits, or merge the PR.

## Required approach

Review the exact source files on the target branch, not this prompt, README summaries, or prior AI conclusions. If the branch head differs from the target SHA above, report the actual SHA you audited and stop if the source changed during review.

Read the complete files:
- src/analysis/b2-causal-swing-engine.js
- src/analysis/b2b-swing-sequence-engine.js
- src/analysis/b2c-swing-structure-engine.js
- src/analysis/b2d-support-resistance-engine.js
- src/analysis/b2e-breakout-retest-engine.js
- src/analysis/b2f-mtf-structure-confluence-engine.js
- src/analysis/b2g-chart-projection-engine.js
- tools/b2_historical_replay.cjs
- .github/workflows/b2-research-suite.yml
- .github/workflows/b2g-chart-projection.yml
- .github/workflows/b2-historical-replay.yml
- the matching tests/b2a through tests/b2g files
- docs/specs/B2_MARKET_STRUCTURE_ENGINE_SPEC_2026-11-27.md
- docs/specs/B2F_MTF_STRUCTURE_CONFLUENCE_SPEC_2026-11-27.md
- docs/specs/B2G_CAUSAL_CHART_PROJECTION_SPEC_2026-11-27.md
- docs/audits/B2_PRELIMINARY_HISTORICAL_REPLAY_2026-11-27.md

Run the deterministic B2-A–B2-G suite and historical replay independently if the environment allows. Verify the exact workflow run and commit SHA rather than trusting the reported counts.

## High-risk review checklist

### B2-A — causal swing detection
- Symmetric left/right pivot confirmation, plateau handling and rightmost representative.
- Exact equality policy and OHLC consistency.
- Source, confirmation and availability timestamps.
- Closed-candle admission and no-lookahead behavior.
- Prefix invariance and malformed input rejection.

### B2-B — sequence contract
- Same-source high/low pair policy and equal confirmation-time requirement.
- Same-side replacement and tie/equality handling.
- Final active sequence versus immutable sequence_history at availability time.
- Sequence-history ordering, labels, indices and deep immutability.
- Whether raw status changes can ever rewrite historical records.

### B2-C — structure state and events
- HH/HL/LH/LL classification and protected/continuation level selection.
- Initial break, BOS, CHoCH and sweep event semantics.
- Event evaluation order around candle close and pivot availability.
- Historical sequence replay, event source provenance and prefix invariance.
- Repeated sweep behavior: can one source level emit many nearly duplicate events, and is that correct by a clearly specified rule?

### B2-D — support/resistance
- Clustering span semantics, overlap/merge rules and independent touch counting.
- Whether same-candle ambiguous pivots can be used as tagged S/R evidence without leaking into directional structure.
- Zone availability time, constituent pivot provenance and no-lookahead behavior.
- Sensitivity to price scale and absolute versus percentage-based span.

### B2-E — breakout/retest lifecycle
- Breakout source validation against accepted-at-availability history.
- False breakout, retest, success/failure, expiration and pending states.
- Whether every lifecycle transition becomes visible only when knowable.
- Correct behavior with multiple zones, repeated touches, gaps and out-of-order events.

### B2-F — multi-timeframe confluence
- Common provider-time cutoff and exact candle coverage.
- Fail-closed behavior for missing, stale, partial, misaligned or inconsistent timeframes.
- Directional interpretation of 1D/4H/1H states and whether MIXED/CONFLICT states are handled safely.
- Whether the historical harness's synthetic zero provider-time spread overstates confidence.

### B2-G — chart projection
- Separation of active, superseded and ambiguous pivots.
- visible_at_ms versus status_visible_at_ms semantics.
- Superseding pivot references and same-source ambiguous-pair timing.
- Event-source validation against sequence history.
- No backdated zones, events, pivot labels or retest statuses.
- DTO immutability and deterministic ordering.

### Historical harness and evidence quality
- Dataset provenance, schema and data-integrity checks.
- Whether the synthetic B1-valid wrapper is clearly separated from actual B1 validation.
- Whether the 18 prefix cutoffs and 72 comparisons cover meaningful edge cases.
- Whether the sampled windows cover trends, ranges, impulses, false breakouts and reversals.
- Whether the parameter grid is sufficient to assess sensitivity.
- Do not infer profitability, win rate or trading edge from structural event counts.

## Required output format

Return a concise but technically detailed audit with:

1. Exact branch and commit SHA audited.
2. Whether you independently ran tests and historical replay; include exact commands and results.
3. Findings grouped as CRITICAL / HIGH / MEDIUM / LOW / NO FINDING.
4. For every finding: exact file and line range, why it is wrong, a minimal reproducible input, expected versus actual behavior, and a minimal correction.
5. Any missing tests or untested edge cases.
6. A final verdict: APPROVE, APPROVE WITH CONDITIONS, or REJECT for **research-candidate integration readiness**.

Do not judge whether the strategy is profitable. Do not propose a rewrite or new architecture unless a concrete defect requires it. Do not change repository contents.
