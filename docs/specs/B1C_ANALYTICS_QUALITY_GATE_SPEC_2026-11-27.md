# B1-C: Mandatory analytics quality gate

Date: 2026-11-27  
Status: Implemented on candidate branch `b1/contract-review`; not merged to `main`.

## Purpose

B1-A maps provider data into a canonical snapshot. B1-B validates that snapshot. B1-C makes that validation mandatory before directional analysis. A valid-looking chart is not sufficient evidence that the underlying candle series is safe to use for LONG/SHORT classification.

## Runtime flow

For each successful REST response, `loadAndAnalyze()` now performs the following sequence:

1. Fetch and normalize the Bybit V5 Linear dataset.
2. Build `dataset.canonicalSnapshot` through `B1DataContract.toSnapshot()`.
3. Run `B1QualityValidator.validate(snapshot, B1_QUALITY_POLICY, Date.now())`.
4. Store the report on `dataset.qualityReport`.
5. Call `BasicAnalyticsEngine.analyze(dataset)`.

The analytics engine is fail-closed. It permits directional calculations only when a quality report exists, its status is exactly `VALID`, and both `validator_version` and `policy_version` match the currently loaded validator and versioned runtime policy. Missing or mismatched report versions are treated as INVALID/UNASSESSED and blocked.

| Validator status | Analytics behavior |
|---|---|
| `VALID` | Normal heuristic analysis may run |
| `DEGRADED` | Directional analysis blocked; `WAIT` |
| `INSUFFICIENT` | Directional analysis blocked; `WAIT` |
| `STALE` | Directional analysis blocked; `WAIT` |
| `INVALID` | Directional analysis blocked; `WAIT` |
| Missing / `UNASSESSED` | Directional analysis blocked; `WAIT` |

Blocked results contain no EMA/ATR arrays or support/resistance calculations. The current price and available context may still be displayed, but they cannot create a LONG/SHORT result. The UI shows the B1 validator status and reason codes.

## Versioned policy

Policy identifier: `b1-quality-policy-2026-11-27-v1`

- Finality safety lag: 500 ms.
- Future timestamp tolerance: 30,000 ms.
- Maximum transport age: 120,000 ms.
- Maximum market-series lag: 2 intervals (2h / 8h / 48h for 1h / 4h / 1d).
- Minimum validated closed-candle history: 100 candles per timeframe.
- Identical duplicates: permitted as evidence, but validator status remains `DEGRADED`; the fail-closed gate therefore blocks directional analysis.
- Any validator result other than `VALID` blocks directional analysis.

The validator receives an explicit `Date.now()` value. The validator itself remains deterministic and does not read the clock internally.

## Cached data after a failed refresh

If a REST refresh fails while a cached snapshot exists:

- the cached chart may remain visible and is clearly marked as stale;
- the cached snapshot is revalidated against the current time;
- its report is forced to `STALE` unless it is already `INVALID`;
- reason `REST_REFRESH_FAILED` is appended;
- the analytics engine is rerun against the stale report and returns `WAIT`.

This prevents a previously valid cached LONG/SHORT result from remaining actionable after a failed refresh.

## Recovery semantics

WebSocket recovery completion and analytical data quality are separate concerns. A successful REST response can complete the transport synchronization handshake, while the quality gate independently decides whether directional analysis is allowed. A poor-quality response must not be presented as a valid signal merely because transport recovery completed.

## Verification

The browser verification harness runs in GitHub Actions with Chromium and executes:

- `StageASelfTest.runAll()`: 44/44.
- `B1DataContractSelfTest.runAll()`: 32/32.
- `B1QualityValidatorSelfTest.runAll()`: 63/63.
- Gate assertions: missing report and each non-VALID status must return WAIT; VALID is allowed through.
- Cleanup assertions: original fetch, hooks, configuration, snapshot map, timers, visibility descriptor, and online descriptor are restored.
- Live Bybit probe: GitHub-hosted runners were denied by both `api.bybit.com` and `api.bytick.com` with HTTP 403. This is recorded as `SKIPPED_PROVIDER_BLOCKED`, not counted as a passing live test. The app's live refresh was separately exercised by the user in iPhone Safari; earlier capture files also documented repeated successful Bybit REST responses.

The CI workflow does not claim that a GitHub runner has verified live Bybit access when the provider blocks that runner.

## Scope limits

- This gate protects the existing basic heuristic engine from unvalidated candle data.
- It does not turn the heuristic LONG/SHORT/WAIT output into a proven trading strategy.
- It does not validate profitability, backtest performance, slippage, fees, leverage, liquidation distance, or order execution.
- It does not enable automated trading.
- The candidate remains isolated from `main` pending final review and explicit acceptance.


**Final device-test note:** the recorded iPhone Safari check covered the preceding candidate build before B1-C introduced the validator status row and mandatory WAIT gate. The latest B1-C candidate still requires a brief iPhone Safari retest of the status display and blocked-data behavior before acceptance.


## 7. Report authenticity and integration regression tests

The engine does not accept a report solely because its `status` field says `VALID`. It also requires exact matches for both `validator_version === B1QualityValidator.VERSION` and `policy_version === B1_QUALITY_POLICY.version`. A missing report is `UNASSESSED`; a missing, outdated, or mismatched validator/policy identity is treated as `INVALID` with reason `QUALITY_REPORT_VERSION_MISMATCH`. This prevents a stale report shape or a hand-built/old report from bypassing the current policy contract.

The Chromium harness now exercises the real adapter normalization → canonical snapshot → validator → analytics-engine path using deterministic synthetic Bybit rows. It verifies:

- A VALID report produces EMA20, EMA50, and ATR14 arrays (159 closed candles in the fixture).
- A negative base-volume value is classified INVALID and the engine returns WAIT with no indicators.
- A report evaluated beyond the transport-age limit is STALE and the engine returns WAIT with no indicators.
- Every non-VALID status, missing report, and mismatched validator version is fail-closed.

Latest GitHub Actions run: Stage A 44/44; canonical contract 32/32; quality validator 63/63; real gate integration assertions passed; cleanup assertions passed; zero browser page errors. Live Bybit access remains skipped because the GitHub-hosted runner receives HTTP 403 from both public REST hosts.


## 8. UI reason visibility regression

The quality panel renders:
- validator status and version;
- up to five validator reason codes;
- explicit analysis admission or blocked-WAIT state.

A Chromium DOM integration assertion uses a synthetic INVALID negative-volume snapshot and confirms the panel displays INVALID, VOLUME_NEGATIVE, blocked state, and the WAIT decision badge. CI run 45963443614 passed all suites (Stage A 44/44, B1 contract 32/32, B1 validator 63/63), UI assertion passed, and browser page errors were zero.

The user confirmed the prior C1 candidate works in iPhone Safari. The newest reason-code panel addition needs a brief visual check on device. Independent review and formal acceptance are still required before merge.




## 9. Validator identity update — 2026-11-27

The canonical contract and quality validator have been incremented to 1.1.0 for the MTF cutoff-exclusion accounting extension. The analytics gate continues to require exact active `validator_version` and `policy_version`; reports produced by the previous validator version cannot pass the current gate. The active policy identifier remains `b1-quality-policy-2026-11-27-v1` because its thresholds did not change.

The isolated MTF assembler does not currently feed `BasicAnalyticsEngine.analyze()`. Existing selected-timeframe B1-C behavior remains unchanged. Do not interpret B1-E implementation as approval of directional MTF signals.
