# B8 Independent Review Findings
Date: 2026-11-28
Status: BLOCKED — corrective work required before B8 acceptance
PR: #28
Reviewed head: f163bb863110edb6c56acf93298ce6088dd5043d
Exact-head CI: run 46117452387 SUCCESS

## Scope
Read-only review of the B8 evaluator, statistics, B5 journal adapter, candidate collection, historical runner, current report and workflow. This review is not a profitability assessment.

## Findings

### B8-R1 — Chronological split outcome contamination (BLOCKER)
Candidate assignment currently uses available_at_ms in chronologicalSplit(). The historical runner then evaluates the candidate's 1/3/6/12-bar outcomes against the full series without checking whether those future bars remain inside the candidate's assigned split.

Consequently, a TRAIN candidate near the 60% boundary can consume VALIDATION candles, and a VALIDATION candidate near the 80% boundary can consume TEST candles. This contaminates split isolation even though candidate timestamps themselves are assigned chronologically.

Required correction:
- compute the first causal entry candle and the maximum outcome endpoint (12 bars) before scoring;
- purge a TRAIN candidate if its scored endpoint reaches or crosses the TRAIN boundary;
- purge a VALIDATION candidate if its scored endpoint reaches or crosses the VALIDATION boundary;
- retain explicit PURGED_TRAIN_BOUNDARY / PURGED_VALIDATION_BOUNDARY counts and reasons;
- never move purged candidates into a later split;
- add deterministic boundary fixtures, including exact-boundary cases;
- report per-horizon availability separately. A shorter horizon may be available even when the full 12-bar candidate is purged, but the primary split-isolation policy must be declared and consistent.

### B8-R2 — Historical candidate population is sparse (BLOCKER for B8-C completion)
The current 40 unique candidates are deduplicated only from five quantile windows per series. This is explicitly not an exhaustive event census and can miss candidates that form and expire between sampled cutoffs.

Required correction:
- run B7 on a denser sequence of causal 160-candle prefixes/windows across the pinned archive;
- preserve stable setup_id, first-seen timestamp/window and confirmation availability;
- reconcile PENDING-to-CONFIRMED transitions without replacing the true confirmation timestamp;
- deduplicate by symbol/timeframe/setup ID;
- publish scan stride, number of evaluated prefixes, candidate appearances, unique candidates and duplicate counts;
- keep the dataset commit pinned and report the synthetic B1 wrapper and time-derived finality limitations.

### B8-R3 — Dependence-aware uncertainty not implemented (BLOCKER for statistical claims)
Current Wilson intervals assume independent observations. Candidates can cluster in the same symbol/timeframe and market episode. The report correctly warns about this, but the required block/cluster-aware uncertainty is not implemented.

Required correction:
- define a defensible resampling unit (at minimum symbol/timeframe/date block or non-overlapping market episode);
- implement deterministic block bootstrap for descriptive return/MFE/MAE summaries where sample size supports it;
- if a subgroup has too few independent blocks, return INSUFFICIENT_INDEPENDENT_BLOCKS, not a misleading interval;
- report raw N and independent block count side by side;
- retain naive Wilson only as a clearly labelled reference, never as primary inference.

### B8-R4 — Prospective B5 observations are not yet an outcome cohort
The current journal adapter validates and normalizes the explicitly exported B5 envelope, but it does not establish a complete prospective outcome stream. The observation's candle window is a snapshot at capture time, so it cannot by itself provide future OHLCV. Follow-up records currently provide status/optional observed price, not a guaranteed continuous future price path.

Required correction:
- keep imported B5 observations, follow-ups and actual trades as separate populations;
- report coverage and explicit follow-up outcomes without fabricating missing MFE/MAE or fills;
- identify missing follow-up/outcome data as pending or unavailable;
- if automated future path tracking is required, define a separate, append-only follow-up capture contract and obtain owner approval before changing B5 production behavior;
- require an explicit user-exported JSON file; no background access to browser localStorage.

### B8-R5 — Cost/funding model remains sensitivity-only
The evaluator supports explicit fee/slippage inputs, but the historical runner supplies none and funding is not applied. Do not call any current metric net performance or expectancy.

Required correction:
- keep gross path metrics separate from any explicitly named cost scenario;
- source the fee assumptions or label them purely illustrative;
- apply funding only with an observed or explicitly scenario-defined series and timestamp alignment;
- never silently substitute zero for unknown costs/funding.

## Verified positive points
- Exact current PR head CI run 46117452387 passed syntax, deterministic evaluator/journal/candidate tests, pinned replay, historical report generation and artifact upload.
- Evaluator does not use a next-candle open that predates candidate availability.
- Forming journal candles are excluded from closed-candle evaluation.
- B5 source envelope is deep-cloned before normalized output is frozen.
- WAIT/no-setup coverage is retained, and actual trades are kept separate.
- Same-bar stop/target ambiguity is handled conservatively as stop-first; gap-through-stop uses the adverse open proxy.

## Acceptance decision
B8 is NOT ready to merge or integrate into the production decision path. R1 and R2 must be corrected before B8-C can be considered complete. R3 is required before making inferential/statistical claims. R4 must be completed as a truthful prospective journal pathway, subject to the limits of the existing B5 schema. R5 remains a limitation until defensible inputs exist.

No changes to production HTML, B1/B2/B7 engines, current LONG/SHORT/WAIT path, B2-F gating, B4/Live Price or UX/UI are authorized by this review.
