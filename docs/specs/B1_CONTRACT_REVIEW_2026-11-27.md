# B1 — Review of the Data Contract Draft

**Date:** 2026-11-27  
**Status:** B1-A/B1-B CANDIDATE IMPLEMENTED ON REVIEW BRANCH / NOT ACCEPTED  
**Base:** `main` at `e53f74cf814638d70f775366e88b6754c95b9e51`  
**Scope:** Review of `docs/specs/B1_DATA_CONTRACT_DRAFT.md`, `docs/specs/B1_CURRENT_ADAPTER_MAPPING.md`, and the current Stage A source.  
**Important:** This review does not modify the canonical application HTML and does not claim B1 implementation.

## 1. Decisions confirmed

1. Keep the first B1 implementation in JavaScript and retain the existing Bybit REST adapter as the first provider. Do not introduce Python, CCXT, a server, or a framework migration before a measured need exists.
2. Keep the provider-neutral contract independent of Bybit field names and API response shape.
3. Keep closed candles and the forming candle separate. Only validated closed candles may feed confirmed indicator/scenario calculations.
4. Keep source provenance, provider time, local receive time, and time-source confidence explicit.
5. Quality validation must run before analytics. A quality failure must not be reduced to a UI warning.
6. Cached data may remain visible as historical context, but a failed refresh must never present its old LONG/SHORT as a current decision.
7. Do not add a second provider merely to claim provider neutrality. First prove that the canonical contract and adapter boundary work; compare another provider only when it answers a concrete validation question.

## 2. Required contract clarifications

### 2.1 Bybit REST volume mapping

For Bybit V5 `/v5/market/kline`, the row fields are:

- `[0]`: candle start time in milliseconds;
- `[1..4]`: OHLC;
- `[5]`: volume;
- `[6]`: turnover.

For USDT/USDC linear contracts, Bybit documents volume in base-coin units and turnover in quote-coin units. The current adapter reads only indices 0–5 and therefore discards quote turnover. B1 mapping should preserve `volume_base` and `volume_quote` separately. It must not infer trade count or taker-buy volume because these fields are not present in this REST response.

Reference: https://bybit-exchange.github.io/docs/v5/market/kline

### 2.2 Closed-state semantics

The REST Kline response does not provide the WebSocket `confirm` flag. Bybit documents `confirm=true/false` on the public WebSocket Kline stream.

Therefore:

- Bybit REST candles must use `TIME_DERIVED`, never `CONFIRMED`;
- `CONFIRMED` is reserved for providers/endpoints with an explicitly documented finality flag;
- the time-derived rule must use provider time plus a configurable safety lag;
- if provider time is unavailable or invalid, closed-state is `UNKNOWN`; local device time must not silently upgrade it to provider-confirmed time.

Reference: https://bybit-exchange.github.io/docs/v5/websocket/public/kline

### 2.3 Preserve raw-order diagnostics before sorting

The current adapter sorts rows into ascending order before downstream quality checks. Once sorted, a validator cannot reconstruct whether the provider returned rows out of order.

The adapter must capture raw ordering diagnostics before sorting, including `out_of_order_count`. The canonical candle array can then be sorted ascending for analytics.

### 2.4 Duplicate handling

Duplicate timestamps must be examined before deduplication:

- identical OHLCV duplicates may be collapsed deterministically, while incrementing a duplicate counter and recording a non-critical reason;
- conflicting duplicates must be quarantined and must not be silently resolved by keeping whichever row happened to appear last;
- the chosen policy and reason must be deterministic and fixture-tested.

### 2.5 Coverage must match the request mode

A latest-N request and an explicit time-range request do not provide the same completeness evidence.

- For explicit `start_ms/end_ms` requests, validate expected boundary coverage and internal gaps.
- For latest-N requests, validate the returned count against the requested limit where applicable, internal gaps, and the expected latest candle boundary.
- Do not claim that a missing leading candle was detected when the request did not define a start boundary.
- Separate `requested_count`, `received_count`, and downstream `minimum_required_count`.

### 2.6 Freshness has two different meanings

Do not classify a dataset as stale merely because its latest *closed* 1D candle began or ended many hours ago; that is normal while the current daily candle is forming.

Track separately:

- transport/snapshot age: time since the data was received;
- market-series freshness: whether the expected latest candle for the timeframe is present and whether its state is valid.

Freshness thresholds must be explicit per timeframe/provider and tested at boundary values. A stale snapshot must block directional output.

### 2.7 Quality scope and insufficient history

`INSUFFICIENT` should be tied to the downstream consumer's requirements, not treated as an unexplained global defect. For example, EMA50 needs at least 50 closed observations; other future modules may require more.

The report should preserve the measured available history and identify which requested calculation is blocked. The decision gate must still return WAIT whenever a required calculation lacks its minimum history.

### 2.8 Quote/ticker data remains separate

Ticker price is not a candle close and must not be folded into OHLCV. Preserve it as a separately sourced quote/current-price object with its own provider, receive time, and warning state.

## 3. B1 implementation order

The following sequence is approved as the low-risk implementation order, subject to fixture results:

1. **B1-A — Canonical types and adapter mapping:** define versioned Candle, Snapshot, Quote, and QualityReport shapes; map Bybit REST fields without changing analytics decisions.
2. **B1-B — Pure quality validator:** validate OHLCV, timestamps, alignment, raw ordering, duplicates/conflicts, coverage, closed/forming state, provider time, and freshness using deterministic fixtures.
3. **B1-C — Quality gate:** place one mandatory gate before `BasicAnalyticsEngine.analyze()`; INVALID, STALE, UNKNOWN critical finality, and required-history failures must return WAIT with reason codes.
4. **B1-D — Stale-cache suppression:** preserve chart/history context if useful, but render the decision as STALE/WAIT and never reuse cached LONG/SHORT as current.
5. **B1-E — Common-cutoff MTF snapshot:** fetch 1D/4H/1H and assemble one analysis snapshot with a shared `analysis_as_of_ms`; forming candles remain separate.
6. **B1-F — Second-provider comparison:** defer until the first pipeline passes its own acceptance tests; this is a validation exercise, not a prerequisite for the first working data-quality gate.

## 4. Explicit non-goals for the first B1 pass

- No automatic trading or order placement.
- No strategy/pattern/market-structure rules.
- No Python backend or hosting deployment.
- No mandatory CCXT dependency.
- No WebSocket-driven candle decisions; existing WebSocket remains LOG-ONLY.
- No resampling from 1m data while native 1H/4H/1D candles are available and no demonstrated need exists.
- No UI redesign beyond showing the quality state and its reason when the gate is integrated.

## 5. Acceptance principles

- Every validator rule has at least one passing fixture and one failing/boundary fixture where applicable.
- Tests prove both the reported quality state and whether directional output is allowed.
- A malicious or malformed dataset cannot bypass the gate by omitting its QualityReport.
- A stale cache cannot preserve a current LONG/SHORT decision after refresh failure.
- The same canonical fixture produces the same QualityReport regardless of provider-specific field names.
- No B1 substage is marked complete from an AI report alone; source review and executable test results are required.

## 6. Current status

The BTCUSDT and ETHUSDT live REST capture reports are useful evidence that the tested Bybit endpoint returned successful data under the observed test conditions. They do not prove fallback-host behavior, historical pagination, all failure/recovery cases, or the correctness of the future quality gate.

A B1-A candidate implementation has now been added on branch `b1/contract-review` to `CryptoAnalyst_StageA_S6_updated.html`; `main` remains unchanged.

Candidate changes:
- Add a versioned provider-neutral snapshot mapping while preserving legacy dataset fields consumed by the existing analytics.
- Preserve Bybit linear `volume` and `turnover` separately.
- Preserve provider-time availability and label local-clock fallback explicitly.
- Keep candles with unknown finality out of the closed-candle set and place them in `unclassified_candles_by_timeframe`.
- Keep ticker/current quote data separate from OHLCV candles.
- Add `window.B1DataContractSelfTest.runAll()`.

Checks completed against the branch candidate:
- Both inline script blocks pass JavaScript syntax parsing (2/2).
- Canonical mapping self-tests: 16/16 pass in an isolated JavaScript runtime.
- Synthetic integration check using the actual `BybitAdapter.normalize()` and `B1DataContract.toSnapshot()`: 5/5 assertions pass.

Not yet verified:
- The complete `StageASelfTest.runAll()` in a real browser after this change.
- iPhone Safari lifecycle and UI behavior after this change.
- A live Bybit request using the candidate HTML.
- The B1 quality validator and mandatory gate; these are later B1-B/B1-C tasks.

Therefore B1-A is a candidate, not yet accepted. Do not merge this branch into `main` until the integrated browser test and source review pass.

## 7. B1-B preparation findings (2026-11-27)

A dedicated B1-B validator specification was added:
`docs/specs/B1B_QUALITY_VALIDATOR_SPEC_2026-11-27.md`.

Source inspection identified two prerequisites that must be corrected before the validator can claim full coverage:

1. **Finality evidence:** `B1DataContract.toSnapshot()` currently assigns `TIME_DERIVED` by trusting membership in the legacy `closedCandles` array. The canonical layer must independently derive REST finality from provider server time, exclusive `close_time_ms`, and an explicit safety lag. The existing B1 mapping fixture expects a candle closed only 100 ms after its boundary; this fixture must be revised to test the configured safety-lag boundary.
2. **Raw diagnostics lost before validation:** `BybitAdapter.normalize()` sorts and deduplicates rows before B1 receives `allCandles`. It currently keeps the last row for a duplicate timestamp. This prevents B1-B from detecting raw out-of-order rows and conflicting duplicates. B1-A must preserve raw-order and duplicate-conflict diagnostics before sorting/deduplication, and conflicting duplicates must not be silently resolved.

No validator implementation or quality gate has been added yet. B1-B remains in specification/preparation, and B1-A remains a candidate. The main branch is unchanged.

## 8. B1-A prerequisite correction implemented (2026-11-27)

Candidate-only changes in `CryptoAnalyst_StageA_S6_updated.html`:

- Added shared `B1_FINALITY_SAFETY_LAG_MS = 500`.
- Canonical REST finality now derives from provider server time and exclusive `close_time_ms`; it no longer trusts legacy `closedCandles` membership.
- A candle is `OPEN` before its close boundary, `TIME_DERIVED` only at/after close boundary plus 500 ms, and `UNKNOWN` inside the safety-lag interval or without provider time.
- The adapter now captures source ordering before sorting. Bybit newest-first (descending) ordering is the expected source order; violations are retained in diagnostics.
- Identical duplicate rows are counted and deterministically collapsed.
- Conflicting duplicate timestamp groups are counted and quarantined from `allCandles`; the normalizer no longer silently keeps the last conflicting row.
- Canonical snapshots expose a `source_diagnostics` object with raw row, invalid row, duplicate, conflict, and raw ordering evidence where available.

### Candidate verification

- Both inline scripts pass JavaScript syntax compilation: 2/2.
- `B1DataContractSelfTest.runAll()`: 23/23 passed, including immediately-before / exactly-at / immediately-after finality boundary cases.
- Synthetic normalizer checks confirm identical duplicate collapse, conflicting duplicate quarantine, and raw ordering anomaly retention.
- No full browser `StageASelfTest.runAll()` has been run after these edits.
- No iPhone Safari lifecycle test or fresh live Bybit request against this candidate has been run.
- No B1 quality validator or mandatory analytics gate exists yet.

**Status:** B1-A prerequisite fixes are implemented on `b1/contract-review`, but candidate integration is not accepted. The main branch remains unchanged. Existing Stage A heuristic UI output is not yet protected by the future B1-C quality gate; do not treat this candidate as ready for live trade decisions.


## 9. B1-B implementation and latest review status (2026-11-27)

The earlier status notes in Sections 6–8 are historical checkpoints. They describe the implementation state at the time each section was written. The current candidate has progressed beyond the initial B1-B preparation described in those sections.

Current candidate state on `b1/contract-review`:
- B1-A canonical mapping and raw-source diagnostics are implemented in the application HTML.
- B1-B pure deterministic validator is implemented as `B1QualityValidator.validate(snapshot, policy, validationNowMs)`.
- The validator checks raw count provenance, duplicate arithmetic, invalid-row bounds, canonical candle provenance, finality/collection partition consistency, closed-candle history, OHLCV, timestamps, gaps, transport age, and market-series freshness.
- `valid_count` includes only closed candles whose provenance, timestamps, finality, OHLC, and any supplied volume values pass validation.
- If the closed collection is empty, market-series lag is reported as unknown (`null`) rather than being calculated from a synthetic zero timestamp; the minimum-history result is `INSUFFICIENT`.
- B1-B remains a pure validator. It is not connected to the live analytics decision path. B1-C is still required before quality can authorize or block the Stage A LONG/SHORT/WAIT output.
- The current fetch flow does call `B1DataContract.toSnapshot(dataset)` and stores the result as `dataset.canonicalSnapshot`, but then calls `BasicAnalyticsEngine.analyze(dataset)` with the legacy dataset. There is no call to `B1QualityValidator.validate()` in the live fetch/analysis path. This is intentional at this stage, but it means the B1 validator currently provides no protection to the displayed decision.

Latest isolated verification from the actual candidate HTML:
- Inline JavaScript syntax: 2/2.
- B1 canonical contract tests: 24/24.
- B1 quality validator tests: 48/48.
- The adapter, canonical contract, validator, and both test suites were extracted from the candidate HTML and executed together in an isolated JavaScript runtime.

Still outstanding:
- Full browser-based `StageASelfTest.runAll()`.
- iPhone Safari lifecycle and UI verification.
- Fresh live Bybit requests from the candidate HTML.
- Independent review of fallback-host, timeout/retry, and recovery behavior.
- B1-C mandatory analytics gate and its integration tests.

The candidate branch remains separate from `main`. Do not merge or describe B1-A/B1-B as accepted until the outstanding checks and explicit user acceptance are complete. Existing heuristic output must not be used as a live trade authorization system.

## 10. Post-review hardening addendum (2026-11-27)

Following the prior checkpoint, additional defects were found and corrected on the candidate branch:
- Non-integral canonical candle interval deltas now produce a CRITICAL `IRREGULAR_CANDLE_INTERVAL` instead of being silently represented as a zero-sized gap.
- Snapshot receive timestamps must be positive safe integers; provider metadata and canonical identity fields are shape-checked.
- Policy versions must be non-empty; raw-order diagnostics must declare `descending`.
- Canonical timeframe maps must explicitly contain the selected timeframe and use strict collection shapes.
- Multiple forming candles for one timeframe are rejected instead of silently selecting one.
- The Bybit raw kline parser now requires exactly seven fields and strict decimal-string OHLCV/turnover values.
- Provider timestamps are parsed strictly; ticker price is strict numeric-string input and ticker response symbol must match the requested instrument.
- Most importantly, legacy `closedCandles` are no longer certified using local wall-clock fallback. If provider time is unavailable, the legacy analytics consumer receives no closed candles and remains WAIT.

Latest isolated verification from the actual candidate HTML:
- B1 canonical contract tests: 32/32.
- B1 quality validator tests: 63/63.
- Combined isolated suite: 95/95.
- Both inline script blocks syntax-compiled: 2/2.

Acceptance remains deliberately separate from isolated verification. Full browser `StageASelfTest.runAll()`, iPhone Safari lifecycle/UI, and a fresh live Bybit request from the candidate are still required. B1-B is not connected to the live decision gate; B1-C remains a separate future stage. The candidate must not be merged into `main` before those checks and explicit user acceptance.



## Current implementation supersession note — 2026-11-27

This review document records an earlier B1 contract review state. The current integration candidate has since advanced to canonical contract 1.1.0, validator 1.1.0, B1-C fail-closed analytics gate, and an isolated B1-E common-cutoff assembler. The authoritative current MTF specification is `docs/specs/B1E_MTF_CURRENT_CONTRACT_SPEC_2026-11-27.md`; current project state and branch consolidation are recorded in `docs/PROJECT_STATE.md` and `docs/audits/B1_BRANCH_CONSOLIDATION_AUDIT_2026-11-27.md`.

Do not use the historical acceptance statements in this file as evidence that the current integration candidate is accepted. Current acceptance gates remain open.
