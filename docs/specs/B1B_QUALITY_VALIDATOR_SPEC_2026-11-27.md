# B1-B — Pure Data Quality Validator: Implementation Specification

**Date:** 2026-11-27  
**Status:** IMPLEMENTATION IN PROGRESS / NOT ACCEPTED  
**Branch:** `b1/contract-review`  
**Scope:** Deterministic validation of canonical market snapshots before any analytics gate is wired.

## 1. Objective

Implement a pure, deterministic validator that accepts a canonical B1 snapshot plus explicit validation policy and returns a machine-readable QualityReport. It must not fetch data, read browser state, inspect the DOM, mutate the snapshot, use local time implicitly, or make trading decisions.

B1-B does not yet authorize LONG/SHORT. Until B1-C wires and tests the mandatory gate, aggregate quality remains non-authorizing.

## 2. Validator API

Proposed API:

```js
B1QualityValidator.validate(snapshot, policy, validationNowMs)
  -> { report, normalizedSnapshot? }
```

Prefer no mutation and no hidden clock. `validationNowMs` is mandatory. Policy is explicit and versioned. The validator must fail closed on malformed arguments and return a structured INVALID report rather than throw for ordinary bad market data. Programming/configuration errors may throw a typed error.

Required report fields:
- `validator_version`, `policy_version`, `status`, `reasons[]`;
- `symbol`, `timeframe`, `analysis_as_of_ms`, `received_at_ms`;
- `expected_count`, `received_count`, `valid_count`, `missing_count`;
- `duplicate_count`, `conflicting_duplicate_count`, `out_of_order_count`;
- `invalid_ohlc_count`, `non_finite_count`, `negative_volume_count`;
- `misaligned_timestamp_count`, `future_timestamp_count`, `invalid_time_count`;
- `transport_age_ms`, `market_series_lag_ms`;
- `insufficient_history`, `minimum_required_count`;
- `closed_count`, `forming_count`, `unknown_finality_count`;
- `gap_ranges[]`, `checked_at_ms`.

Each reason is an object: `{ code, severity, timeframe, timestamp_ms?, details? }`. Codes must be stable constants, not UI strings.

## 3. Critical correction to B1-A finality mapping

The validator must NOT trust `closedCandles` membership as proof of finality. It must independently verify each candle using:
- the provider server time from the same data response;
- canonical `close_time_ms` as an exclusive interval boundary;
- an explicit `finality_safety_lag_ms` in policy.

A REST candle is `TIME_DERIVED` only when:

```
provider_server_time_ms >= close_time_ms + finality_safety_lag_ms
```

Otherwise it is OPEN if provider time is before close boundary, or UNKNOWN while it is inside the safety-lag window / provider time is absent or invalid. Never upgrade REST finality to CONFIRMED.

The current B1-A test fixture has provider time 7,200,100 ms and candle close boundary 7,200,000 ms, yet expects TIME_DERIVED. That expectation is not valid under a non-zero safety lag. Correct the fixture to use provider time beyond the explicit lag, and add tests immediately before, exactly at, and immediately after the threshold.

Also correct the implementation boundary: `toSnapshot()` currently derives finality by trusting the legacy `closedCandles` set. B1-B must derive it from canonical times/provider time, or B1-A must be revised so the adapter exposes enough unambiguous finality evidence. Do not silently use local fallback time.

## 4. Input provenance requirements / B1-A prerequisites

The current normalizer sorts and deduplicates before the canonical contract is built. That destroys evidence needed to validate raw order and conflicting duplicate rows.

Before B1-B can truthfully report these checks, B1-A must preserve pre-sort diagnostics and duplicate evidence:
- raw row count and raw-order sequence (or `out_of_order_count` calculated before sorting);
- duplicate timestamp count before deduplication;
- duplicate conflict count, comparing all OHLCV values for each timestamp;
- deterministic duplicate policy;
- malformed-row counts and rejected-row reason codes.

Identical duplicates may be collapsed deterministically but must remain visible in diagnostics. Conflicting duplicates must be quarantined or cause INVALID; never silently keep the last row. If raw duplicate evidence is unavailable, the validator must report the check as NOT_CHECKED / critical evidence missing, not claim zero duplicates.

## 5. Validation rules

### 5.1 Snapshot and schema
- Required snapshot identity and version fields must be present and correctly typed.
- Canonical symbol and timeframe must be supported and internally consistent.
- Candle arrays must be arrays; each candle must match snapshot symbol, market type, and timeframe.
- A missing QualityReport cannot bypass validation. The validator creates its own report.

### 5.2 OHLCV
- OHLC values must be finite numbers greater than zero.
- `high >= max(open, close, low)`; `low <= min(open, close, high)`.
- Base/quote volume, when present, must be finite and non-negative.
- Null optional volume fields are allowed and reported as unavailable; malformed non-null values are invalid.
- Do not infer trade count or taker-buy volume when the provider did not supply them.

### 5.3 Timestamps and grid
- `open_time_ms` and `close_time_ms` must be finite safe integers in milliseconds.
- `close_time_ms > open_time_ms` and duration must equal the configured timeframe duration.
- Open timestamps must align to the UTC timeframe grid (1d aligned to 00:00 UTC).
- No candle may start after provider time beyond the explicitly configured future tolerance.
- Candle order in the canonical array must be ascending and strictly increasing.
- Gap detection uses the timeframe step and records exact missing intervals.
- Do not infer missing leading candles for latest-N requests without an explicit requested start boundary.

### 5.4 Duplicates and raw ordering
- Use preserved raw diagnostics from B1-A.
- Identical duplicates: non-critical reason and deterministic count.
- Conflicting duplicates: INVALID.
- Out-of-order raw rows: DEGRADED only if the canonical sorted series is otherwise complete and raw ordering evidence exists; severity is policy-controlled.
- Canonical duplicate timestamps after normalization are INVALID.

### 5.5 Coverage and history
- Distinguish `requested_count`, `received_count`, and `minimum_required_count`.
- For latest-N mode, compare received count with the requested limit and validate internal gaps; do not invent a requested start.
- For explicit range mode, validate start/end boundary coverage and internal gaps.
- Required indicator history is consumer-specific. B1-B accepts `minimum_required_count` from caller/policy; it does not hardcode EMA50 or future strategy requirements.
- If below minimum, report INSUFFICIENT with required/available counts.

### 5.6 Freshness
Keep transport freshness separate from market-series freshness.

- `transport_age_ms = validationNowMs - received_at_ms`; negative age beyond configured tolerance is INVALID.
- `market_series_lag_ms` is based on provider time and expected latest closed boundary, not the age of the last closed candle alone.
- A forming 1d candle must not make a healthy daily dataset stale merely because the previous closed 1d candle is old.
- Policy supplies explicit maximum transport age and per-timeframe market-series lag thresholds.
- Equality boundaries must be fixture-tested.
- If provider time is absent/invalid, critical finality and market freshness are UNKNOWN and cannot pass as VALID.

### 5.7 Time-source and quote separation
- Local device fallback must never be treated as provider time.
- Quote/ticker is validated separately from OHLCV and cannot repair missing candles or finality.
- Quote age and quote validity are separate fields; ticker failure may be a warning if the analytical consumer does not require quote data.

## 6. Status aggregation

Per-timeframe status:
- INVALID: malformed OHLCV/timestamps, conflicting duplicates, duplicate canonical timestamps, impossible interval, or critical provenance missing.
- STALE: transport age or market-series lag exceeds configured threshold.
- INSUFFICIENT: required history not available.
- DEGRADED: non-critical defects such as identical duplicate evidence or raw-order anomaly, when policy explicitly permits it.
- VALID: all required checks pass and no warning condition remains.
- UNASSESSED is not a validator result; it is only the pre-validation mapping state.

Precedence for aggregate status:
`INVALID > STALE > INSUFFICIENT > DEGRADED > VALID`.
If critical time/finality evidence is unknown, status is INVALID (or a distinct BLOCKED status only if that status is added consistently to the contract); never VALID.

B1-B must not implement the directional decision gate. B1-C will enforce that only explicitly permitted reports can reach analytics.

## 7. Deterministic test matrix

Every rule must have a passing fixture and a failing/boundary fixture where applicable.

Minimum test groups:
1. Valid 1h / 4h / 1d snapshots.
2. OHLC finite/positive/consistency boundaries.
3. Base and quote volume: null, zero, negative, NaN, Infinity, string.
4. Timestamp integer, duration, UTC alignment, future tolerance.
5. Ascending order, reversed order, one missing candle, multiple gaps, irregular interval.
6. Identical duplicate and conflicting duplicate.
7. Latest-N coverage versus explicit-range coverage.
8. Finality immediately before, at, and after close boundary + safety lag.
9. Provider time absent, invalid, stale, and ahead of receive time.
10. Transport age below, exactly at, and above threshold.
11. 1d forming candle does not trigger false stale.
12. Insufficient history at minimum-1, minimum, minimum+1.
13. Ticker missing/stale/invalid does not alter candle validation.
14. Determinism: same input/policy/now produces byte-equivalent report.
15. Input immutability: validator does not mutate snapshot or policy.

All tests must run against the actual exported validator implementation, not a copied test-only function.

## 8. Acceptance criteria

B1-B is complete only when:
- B1-A provenance/finality prerequisites are corrected;
- validator implementation is integrated with the canonical contract on the candidate branch;
- all deterministic fixtures pass in an executable test harness;
- full StageASelfTest still passes after integration;
- source review confirms no implicit clock, mutation, provider-specific assumptions in the validator, or false VALID state;
- main remains unchanged until B1-A/B1-B/B1-C integration acceptance is separately decided.

## 9. Explicit non-goals
- No LONG/SHORT gate yet (B1-C).
- No analytics formula or strategy changes.
- No WebSocket use for candle decisions.
- No UI redesign.
- No second data provider.
- No claim of backtest profitability.

## 10. Initial implementation status (2026-11-27)

A first deterministic implementation is now present in the candidate HTML as `B1QualityValidator.validate(snapshot, policy, validationNowMs)`.

Implemented in this first pass:
- explicit versioned policy and explicit validation timestamp; no implicit clock;
- fail-closed handling for malformed policy/snapshot and missing raw diagnostics;
- per-timeframe candle-map shape and scope checks;
- OHLC and optional volume numeric checks;
- timestamp duration, UTC grid, future-time and canonical ordering checks;
- duplicate canonical timestamp detection and internal gap ranges;
- REST finality cross-check against provider time and configured safety lag;
- separate transport age and market-series lag;
- minimum-history check;
- source duplicate/conflict/raw-order diagnostics;
- deterministic report generation without mutating the input snapshot;
- ticker/quote kept outside candle quality decisions.

Candidate test results:
- JavaScript syntax compilation: 2/2 inline scripts passed.
- B1 canonical mapping tests: 23/23 passed.
- B1 quality validator tests: 12/12 passed, including a normalizer → canonical snapshot → validator integration scenario.

Latest follow-up implementation (2026-11-27):
- Aggregate status now follows the specified distinct states and precedence: `INVALID > STALE > INSUFFICIENT > DEGRADED > VALID`.
- Transport and market-series freshness reasons use `STALE` severity; history shortfall uses `INSUFFICIENT` severity.
- Added deterministic checks for negative/zero base volume and transport-age equality / one-millisecond-over boundaries.
- Isolated execution of the validator's non-integration self-test block: 16/16 passed after the status correction.

Latest count-provenance implementation (2026-11-27):
- `fetchMarketSnapshot(..., limit)` now passes the actual requested limit into the normalizer.
- The normalizer preserves `requestedCount` separately from `totalFetched`; canonical `source_diagnostics` exposes `requested_count`, `raw_row_count`, and `response_shortfall`.
- Validator reports `expected_count`/`requested_count`, `raw_received_count`, normalized `received_count`, and `response_shortfall` independently. A short response is `DEGRADED` evidence and does not fabricate internal candle gaps; a response exceeding the requested count is `INVALID`.
- Added a synthetic short-response test and adapter provenance assertion.
- Latest isolated test results after the count-provenance and matrix additions: B1 contract 24/24, quality validator 30/30; both inline script segments compile with `new Function`. The latest additions cover non-finite/string volume values and raw responses exceeding the requested count.

Still outstanding before B1-B acceptance:
- remaining coverage includes additional malformed-volume variants (Infinity/string/null), explicit raw-response-over-request rejection, and more 4h/1d edge-boundary fixtures;
- preserve and report `requested_count`/`expected_count` from the actual fetch request; current report deliberately leaves `expected_count: null` rather than inventing it;
- independently review policy thresholds and status semantics against actual capture/fetch timing;
- run the full browser-based `StageASelfTest.runAll()`;
- test candidate in iPhone Safari lifecycle and perform fresh live Bybit fetches;
- review UI behavior and verify that the validator's output is not yet mistaken for an enforced analytics gate.

The validator is not wired into the live analytics decision path. Existing Stage A heuristic LONG/SHORT/WAIT output remains outside this B1 quality gate until B1-C. This candidate must not be used as a live trading authorization system.

## 11. Follow-up hardening — raw count provenance (2026-11-27)

A focused source review found that the validator checked whether the raw response exceeded the requested count, but did not verify that the reported shortfall matched the two underlying counts. It also accepted negative integer diagnostic counters and did not require explicit identical/conflicting duplicate counters as part of the critical provenance set.

Candidate branch correction:
- Raw diagnostic counters must be safe, non-negative integers.
- identical_duplicate_count and conflicting_duplicate_count are now required before the raw diagnostics are considered complete.
- The validator independently checks response_shortfall === max(0, requested_count - raw_row_count).
- Any mismatch returns INVALID with RAW_COUNT_PROVENANCE_INCONSISTENT.
- Added self-test cases for inconsistent shortfall arithmetic and a negative raw row count.

This is a candidate-branch hardening change only. It has not yet been accepted. The newly added browser self-tests have not been executed in a full browser run; the full Stage A suite and live Bybit/Safari checks remain outstanding.

## 12. Follow-up hardening — provenance arithmetic and candle partitions (2026-11-27)

A second source review found two additional fail-closed requirements that were not enforced:

- `invalid_row_count` must not exceed `raw_row_count`.
- The adapter defines `duplicate_count` as duplicate *extra rows*, partitioned into identical and conflicting duplicate extra rows. Therefore the validator now requires:
  `duplicate_count === identical_duplicate_count + conflicting_duplicate_count`.
- Candle finality state and collection membership must agree. A candle with provider-time-derived state `TIME_DERIVED` belongs only in the closed collection; `OPEN` belongs only in the forming collection; `UNKNOWN` belongs only in the unclassified collection. Mismatch produces `CANDLE_COLLECTION_STATE_MISMATCH` with CRITICAL severity. This prevents a forming/unknown candle from being counted as closed for market freshness.

Regression coverage added for invalid-row overflow, duplicate-count arithmetic mismatch, a valid identical-duplicate breakdown, and OPEN/TIME_DERIVED/UNKNOWN candles placed in the wrong collection. Existing daily and 4h fixtures were updated to include the now-required `identical_duplicate_count` provenance field.

Verification on the candidate branch after these changes:
- Both inline JavaScript blocks compile with `new Function`: 2/2.
- Executed the actual `B1QualityValidatorSelfTest.runAll()` against the extracted adapter, canonical contract, and validator implementations: 42/42 passed.
- This is an isolated JavaScript execution of the B1 validator suite. It is not the full browser `StageASelfTest.runAll()`, not an iPhone Safari lifecycle test, and not a fresh live Bybit request.

Additional provenance checks added in the same pass:
- `analysis_as_of_ms` must equal the provider server timestamp used by the validator.
- Every canonical candle must match the snapshot's canonical symbol, market type, timeframe, provider ID, provider event time, and receive time. A mismatch is CRITICAL (`CANDLE_PROVENANCE_MISMATCH` or `ANALYSIS_TIME_PROVENANCE_MISMATCH`).
- Test fixtures now explicitly preserve candle-level provider/receive timestamps when simulating changed fetch times.

Updated isolated verification after these additions: B1 canonical contract 24/24, B1 quality validator 45/45, JavaScript syntax 2/2. Full Stage A browser tests, Safari, and live Bybit checks remain outstanding.

## 13. Closed-candle history requirement (2026-11-27)

A further review found that `valid_count` and minimum-history sufficiency previously included forming and unclassified candles. That is unsafe for an analytical pipeline whose indicators and decisions must use closed candles only. The validator now increments `valid_count` only for valid candles in the closed collection; forming and unknown candles remain visible in their own counts but cannot satisfy `minimum_required_count`. Added tests cover an UNKNOWN candle immediately before the finality threshold, a TIME_DERIVED candle exactly at the threshold, and a forming-only dataset that must remain INSUFFICIENT when market-lag policy is otherwise satisfied.

Latest isolated verification after this correction:
- B1 canonical contract: 24/24 passed.
- B1 quality validator: 45/45 passed.
- Inline JavaScript syntax: 2/2 passed.
- The complete browser `StageASelfTest.runAll()`, iPhone Safari lifecycle, and fresh live Bybit requests remain unrun.


## 14. Follow-up hardening — closed-candle validity and empty-series freshness (2026-11-27)

A further source review identified two report-semantics defects:

1. `valid_count` was incremented after OHLC validation but before optional volume validation. A closed candle with a negative, non-finite, or malformed supplied volume could therefore increase the count used for the minimum-history check even though the same candle generated a CRITICAL quality reason.
2. When the closed-candle collection was empty, market-series lag was calculated against a synthetic zero timestamp. This produced a very large artificial lag and classified an empty-but-current collection as STALE, even though no closed candle existed from which to measure series freshness.

Candidate branch corrections:
- A closed candle increments `valid_count` only after its provenance, timestamp, finality/collection membership, OHLC, and any supplied volume fields pass validation.
- Invalid supplied volume now excludes that candle from valid closed history; null/absent optional volume remains permitted.
- Market-series lag is left `null` when there are no closed candles. The minimum closed-history rule then reports `INSUFFICIENT` instead of fabricating a stale lag. This does not authorize analytics: B1-C remains the required decision gate.

Regression coverage added:
- Negative base volume does not count toward valid closed history.
- Non-finite base volume does not count toward valid closed history.
- An empty closed series with otherwise current provider/transport metadata reports `INSUFFICIENT` and `market_series_lag_ms: null`.

Verification against the actual candidate HTML modules:
- B1 canonical contract: 24/24 passed.
- B1 quality validator: 48/48 passed.
- The adapter, canonical contract, validator, and both self-test suites were extracted from the candidate HTML and executed together in an isolated JavaScript runtime.
- This remains an isolated module run, not the full browser `StageASelfTest.runAll()`, not an iPhone Safari lifecycle test, and not a fresh live Bybit request.

Implementation detail: the current validator returns `{ report }`; the optional `normalizedSnapshot` in the proposed API above is not implemented and must not be assumed by callers. In the report, `expected_count` and `requested_count` both reflect the actual request limit; `raw_received_count` reflects raw provider rows; `received_count` reflects canonical candles across finality collections; `missing_count` reflects internal timestamp gaps, not response shortfall.


## 15. Follow-up hardening — duplicate policy and malformed entries (2026-11-27)

A further edge-case review found two fail-open/robustness defects.

### 15.1 Identical duplicates when policy disallows them

Previously, `allow_identical_duplicates: false` did not generate a validation reason for an otherwise consistently classified identical-duplicate group. Such a snapshot could therefore pass as `VALID`, contradicting the explicit policy.

Correction:
- If identical duplicates exist and the policy permits them, the report is `DEGRADED` with `IDENTICAL_DUPLICATES_COLLAPSED`.
- If identical duplicates exist and the policy disallows them, the report is `INVALID` with `IDENTICAL_DUPLICATES_NOT_ALLOWED`.
- Conflicting duplicates remain `INVALID` independently of this policy.

Regression test confirms the policy is enforced.

### 15.2 Malformed entries inside candle arrays

A null candle entry previously could reach later freshness reduction logic and throw a TypeError. The validator now:
- emits critical `CANDLE_ENTRY_INVALID` for null, non-object, or array entries;
- excludes malformed entries from subsequent gap analysis;
- guards latest-closed freshness reduction against malformed entries;
- preserves malformed fixture values instead of accidentally converting null to an empty object.

Regression test confirms null candle entries produce an `INVALID` report without crashing.

### Latest isolated verification

Against the actual candidate HTML modules:
- B1 canonical contract: 24/24.
- B1 quality validator: 50/50.
- Both inline script blocks are syntax-compiled separately as part of the current review.
- No full browser `StageASelfTest.runAll()`, iPhone Safari lifecycle, or fresh live Bybit request has been performed in this step.

## 16. Follow-up hardening — malformed raw rows and raw-to-canonical accounting (2026-11-27)

### 16.1 Malformed raw Bybit kline entries

The adapter previously indexed each raw row before verifying that it was an array. A null row could throw and abort normalization of the entire response.

Correction:
- Require each raw kline entry to be an array with the seven fields defined by the Bybit V5 REST kline response.
- Count malformed or truncated entries as invalid rows and invalid timestamps.
- Continue processing the remaining rows instead of aborting the entire normalization pass.

Regression coverage includes null, object, and truncated-array entries.

### 16.2 Raw-to-normalized row accounting

The validator now cross-checks raw response evidence against the normalized canonical candle collections.

For a valid diagnostic set:

`normalizedCount = rawRowCount - invalidRowCount - duplicateCount - conflictingTimestampGroupCount`

The conflicting timestamp group count is the number of timestamp groups quarantined in full. This additional subtraction is necessary because duplicate count records only extra rows in each group, while the normalizer removes the entire conflicting group rather than retaining one representative.

The validator now:
- requires a valid, unique array of positive conflicting-duplicate timestamps, including an empty array when there are no conflicts;
- rejects conflicting duplicate counts without timestamp-level quarantine evidence;
- rejects more conflicting timestamp groups than conflicting duplicate rows;
- rejects any mismatch between the computed normalized row count and the combined closed/forming/unclassified collections;
- retains the existing checks that duplicate count equals identical plus conflicting duplicate rows.

Regression coverage includes inconsistent raw/normalized totals, absent conflict timestamp evidence, and conflicting rows without timestamp-level evidence.

### Latest isolated verification (2026-11-27)

Against the latest candidate HTML from b1/contract-review:
- B1 canonical contract: 25/25.
- B1 quality validator: 53/53.
- Combined isolated suite: 78/78.
- Both inline script blocks syntax-compiled: 2/2.

These are isolated module/self-test and syntax results, not a full browser run. Full StageASelfTest.runAll(), iPhone Safari lifecycle, and a fresh live Bybit request from the candidate remain outstanding.

## 17. Captured Bybit response-shape cross-check (2026-11-27)

The BTCUSDT and ETHUSDT live-capture documents were parsed and checked against the adapter's expected REST kline shape.

Observed across both captures:
- 30 samples per symbol and 3 intervals per sample (D, 240, 60).
- 200 raw kline rows per interval response.
- Each row is a seven-element array of numeric strings: start time, OHLC, base volume, and quote turnover.
- The response envelope has retCode=0, category=linear, and an integer provider time.
- All 180 interval responses were newest-first, with no duplicate timestamps, UTC-grid misalignment, or internal interval gaps.
- All 36,000 raw candle rows passed numeric/OHLCV structural checks.
- In all 180 samples, the latest candle had not yet crossed the configured 500 ms finality safety lag; it must not be used as a closed decision candle.
- api.bybit.com succeeded for every captured request. The api.bytick.com fallback was therefore not exercised.

This is a static validation of the saved capture set, not a new live request and not a test of host failover, timeout, retry, or recovery behavior. The observed capture shape agrees with the current Bybit V5 REST Kline documentation.

## 18. Strict raw numeric field validation (2026-11-27)

The adapter previously relied on JavaScript Number() coercion for all raw kline fields. That could accept malformed non-string values (for example booleans) or non-decimal string forms, and invalid turnover was silently converted to null even though Bybit V5 supplies turnover in the seven-field kline row.

Correction:
- Require the timestamp field to be a decimal digit string and convert it only after the lexical check.
- Require OHLC, base volume, and quote turnover to be decimal numeric strings before conversion.
- Require the timestamp to be a positive safe integer.
- Require quote turnover to be finite and non-negative; invalid turnover now rejects the raw row rather than disappearing as null.
- Keep malformed-row accounting explicit so the B1 validator can reconcile raw and normalized counts.

Regression tests cover boolean numeric fields, hexadecimal-looking price strings, negative quote turnover, and the earlier malformed row shapes.

The saved BTCUSDT and ETHUSDT captures were independently checked against the strict lexical rules: all 36,000 rows passed, with all seven fields represented as strings and no parser-format exceptions.

### Latest isolated verification (2026-11-27)

- B1 canonical contract: 27/27.
- B1 quality validator: 53/53.
- Combined isolated suite: 80/80.
- Both inline script blocks syntax-compiled: 2/2.
- Full browser StageASelfTest, iPhone Safari lifecycle, and a fresh live Bybit request from the candidate remain outstanding.

## 19. Final audit hardening — interval integrity, provenance, and legacy finality (2026-11-27)

### 19.1 Canonical interval deltas

The gap scanner previously treated every delta larger than one timeframe as a normal gap. For a non-integral multiple of the timeframe, `floor(delta / step) - 1` could be zero and no critical reason was emitted.

Correction: only integral multiples greater than one interval are reported as missing-candle gaps. Any non-integral delta is `IRREGULAR_CANDLE_INTERVAL` with CRITICAL severity. Regression coverage confirms it cannot pass as a zero-sized gap.

### 19.2 Receive timestamp and provider metadata

- Snapshot `received_at_ms` must be a positive safe integer. Zero and negative values are invalid provenance, not ordinary stale ages.
- Snapshot identity fields must be non-empty strings.
- Provider metadata must be a non-array object with non-empty `provider_id`, `venue`, `provider_symbol`, and `host`, plus a recognized `time_source` (`provider` or `local_fallback`).
- Policy version must be a non-empty identifier.
- Raw source diagnostics must explicitly state the expected Bybit row order (`descending`); an unlabelled order count is not interpretable evidence.
- Every canonical timeframe map must explicitly define the selected timeframe. Closed and unclassified collections must be arrays; forming must be null or one object.

Regression tests cover zero/negative receive times, incomplete and array provider metadata, empty policy version, wrong/missing raw order expectation, missing timeframe map keys, null closed arrays, and array-valued forming entries.

### 19.3 Multiple forming candles

The canonical snapshot contract supports at most one forming candle per timeframe. The mapper now rejects multiple OPEN candles instead of selecting the first and silently dropping the rest.

### 19.4 Local-clock finality bypass closed

A critical path was found in the legacy Stage A consumer: the normalizer used local `Date.now()` as a fallback to populate legacy `closedCandles`, and the existing heuristic engine consumes that legacy array. Although B1-A correctly marked those candles UNKNOWN, the legacy engine could still see them as closed.

Correction: the normalizer now classifies candles into legacy `closedCandles` only when a valid provider timestamp is present. With local fallback, no candle is certified closed, so the existing analytics remains WAIT rather than making a directional decision from local-clock finality.

Regression coverage verifies that local fallback leaves `closedCandles` empty even when the local clock would otherwise place the candles beyond the close boundary.

### 19.5 Strict provider timestamps and ticker identity

- Provider time accepts only positive safe-integer milliseconds supplied as a number or digit string; booleans, decimal strings, zero, and unsafe integers are rejected.
- Ticker `lastPrice` must be a decimal numeric string.
- The ticker response must contain exactly one item whose `symbol` matches the requested instrument; an unexpected or mismatched item is not used as the current quote.

### Latest isolated verification (2026-11-27)

- B1 canonical contract: 32/32.
- B1 quality validator: 63/63.
- Combined isolated suite: 95/95.
- Both inline script blocks syntax-compiled: 2/2.
- Full browser `StageASelfTest.runAll()` and user-side iPhone Safari lifecycle/live Bybit verification remain the acceptance checks before merging to main.


## 20. B1-C mandatory analytics gate (2026-11-27)

The validator is now connected to the active analysis path. `loadAndAnalyze()` creates the canonical snapshot, invokes `B1QualityValidator.validate(snapshot, B1_QUALITY_POLICY, Date.now())`, and stores the report on the dataset before calling `BasicAnalyticsEngine.analyze()`.

The engine fails closed: only status `VALID` with matching `validator_version` and `policy_version` permits directional calculations. `DEGRADED`, `INSUFFICIENT`, `STALE`, `INVALID`, missing reports, and `UNASSESSED` all produce `WAIT` with no EMA/ATR arrays or calculated S/R levels. The UI displays the validator status.

The versioned runtime policy is `b1-quality-policy-2026-11-27-v1`: 500 ms finality safety lag, 30 s future tolerance, 120 s transport-age limit, two-interval market-series lag limits, 100 required closed candles per timeframe, and identical duplicates permitted as evidence (but still `DEGRADED`, therefore blocked by the gate).

A failed REST refresh with cached data triggers revalidation; cached analysis is forced to `STALE` (unless already `INVALID`) and receives reason `REST_REFRESH_FAILED`. The chart may remain visible, but the analysis returns `WAIT`.

See `B1C_ANALYTICS_QUALITY_GATE_SPEC_2026-11-27.md` for full flow, recovery semantics, test coverage, and scope limits.


**Final device-test note:** the recorded iPhone Safari check covered the preceding candidate build before B1-C introduced the validator status row and mandatory WAIT gate. The latest B1-C candidate still requires a brief iPhone Safari retest of the status display and blocked-data behavior before acceptance.


### 20.1 B1-C report identity binding and latest integration tests

The analytics gate additionally verifies exact `validator_version` and `policy_version` values against the active validator and policy. Missing or mismatched identity is treated as INVALID with `QUALITY_REPORT_VERSION_MISMATCH`; a manually constructed report containing only `status: VALID` cannot pass.

The latest Chromium harness validates the real synthetic adapter → canonical contract → validator → engine path. A VALID fixture produced 159 validated closed candles and non-empty EMA20/EMA50/ATR14 arrays. Negative volume produced INVALID and WAIT with no indicators. An expired transport-age report produced STALE and WAIT with no indicators. Latest totals remain Stage A 44/44, contract 32/32, validator 63/63, with gate and cleanup assertions passing. Live Bybit probe is skipped due HTTP 403 from both hosts on GitHub Actions.




## 21. B1-E common-cutoff integration addendum — 2026-11-27

The canonical data contract and validator are now version 1.1.0. The validator requires the exact supported `contract_version`; unsupported versions fail closed with `SNAPSHOT_SCHEMA_INVALID`.

Canonical `source_diagnostics` now requires non-negative integer `excluded_after_cutoff_count`. This is used by MTF common-cutoff assembly when a later provider response contains a normalized candle whose open time is after the selected common cutoff. The raw-row accounting invariant now subtracts this explicit exclusion count in addition to invalid rows, duplicate extras, and one quarantined representative per conflicting timestamp group. The raw response count itself is preserved and is not rewritten to make the filtered snapshot appear complete.

B1 validator version is 1.1.0. The quality policy thresholds and policy identifier remain unchanged. Current MTF integration and acceptance gates are documented in `docs/specs/B1E_MTF_CURRENT_CONTRACT_SPEC_2026-11-27.md`.

Latest candidate CI run 45965680821: validator 64/64, MTF 12/12, Stage A 44/44, contract 32/32, browser gate/chart checks passed, zero page errors. Live Bybit remains blocked from GitHub Actions by HTTP 403; no live MTF calibration is claimed.




## Snapshot identity binding — 2026-11-27

Canonical snapshots now require a non-empty `snapshot_id` in addition to the supported contract version, symbol and market identity. Every B1 quality report carries the exact `snapshot_id` it validated. A missing snapshot ID fails closed with `SNAPSHOT_SCHEMA_INVALID`.

The report identity is not merely the validator/policy version pair: consumers must also bind the report to the exact canonical snapshot. B1-C now rejects a report if its `snapshot_id` does not match `dataset.canonicalSnapshot.snapshot_id`; B1-E requires the same match for every timeframe before aggregate directional permission.

Latest CI run `45966700299`: B1 validator 65/65, MTF 18/18, Stage A 44/44, contract 32/32; gate/UI/chart checks passed, zero browser page errors. Live Bybit remains blocked by HTTP 403 from both public REST hosts.
