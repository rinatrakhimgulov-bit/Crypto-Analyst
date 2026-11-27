# B1-E — MTF Common-Cutoff Assembly on Current B1 Contract

**Date:** 2026-11-27  
**Status:** Implemented on integration candidate; initial 30-sample BTCUSDT and 30-sample ETHUSDT live captures completed. Observed provider-time spread max 325 ms; 500 ms is a provisional test threshold only. Exact-code recorded-response replay, repeat-session calibration, independent review and owner acceptance remain open.  
**Implementation:** `B1MtfEngine` in `CryptoAnalyst_StageA_S6_updated.html`  
**Contract:** B1 canonical contract 1.1.0; validator 1.1.0; current quality policy remains version `b1-quality-policy-2026-11-27-v1`.  
**Branch:** `integration/b1-mtf-architecture-2026-11-27`  
**Not merged:** `main` unchanged.

## 1. Purpose and boundary

B1-E assembles 1D / 4H / 1H data into one synchronized, immutable MTF data snapshot. It does not calculate market structure, combine trading evidence, render a new UI, or alter the selected chart timeframe. It is not connected to the existing LONG/SHORT/WAIT decision path.

## 2. Current B1 contract compatibility

The earlier B1-E implementation was coupled to the legacy `DataQualityEngine`. The current port uses:
- `B1DataContract.toSnapshot()`;
- `B1QualityValidator.validate(snapshot, B1_QUALITY_POLICY, validationNowMs)`;
- the exact validator/policy identity required by the B1-C analytics gate.

The canonical contract was incremented to 1.1.0 and validator to 1.1.0 because the quality provenance schema now explicitly accounts for normalized rows excluded after the common cutoff. The validator rejects unsupported canonical contract versions.

### Exclusion accounting

`source_diagnostics.excluded_after_cutoff_count` is a required non-negative integer. The normalized-row accounting invariant is:

`raw_row_count - invalid_row_count - duplicate_count - conflicting_timestamp_group_count - excluded_after_cutoff_count === canonical_row_count`

This preserves the original raw response count while documenting rows that are deliberately excluded from the common as-of snapshot. It does not relabel post-cutoff candles as closed or forming context.

## 3. Time and finality

- Required timeframe set: `1d`, `4h`, `1h`.
- All three responses must have trusted provider time (`timeSource === 'provider'` and positive safe-integer `providerServerTimeMs`).
- `analysis_as_of_ms` is the minimum provider timestamp across all three responses.
- Original per-timeframe provider timestamps remain in the outer MTF provenance metadata.
- Provider-time spread is checked against an explicit `maxProviderTimeSpreadMs`. It must be a measured policy supplied by the caller. Missing or invalid policy fails closed; no production default is invented.
- Candle finality uses the current 500 ms safety lag.
- Rows whose candle open time is later than the common cutoff are excluded from that timeframe's canonical snapshot and counted.
- At most one post-cutoff normalized row per timeframe is tolerated. More than one blocks the aggregate.
- The canonical B1 validator independently checks closed/forming/unknown membership against the common provider time and finality lag.
- Forming and pending-finality candles are retained only as context. `analysis_candles` contains closed candles only.

## 4. Exact coverage

Caller must provide `closedCandleCount` as a positive safe integer and it must meet the B1 minimum history requirement for every timeframe.

For timeframe step `stepMs`:

- `expectedEndOpen = floor((analysisAsOfMs - 500) / stepMs) * stepMs - stepMs`
- `expectedStartOpen = expectedEndOpen - (closedCandleCount - 1) * stepMs`

The engine selects exactly the expected closed-candle window and verifies count, first/last timestamps, and every interval. Missing history or a gap in the requested window blocks directional permission. It does not silently reduce the requested history.

## 5. Per-timeframe and aggregate quality

Each timeframe is independently mapped to the current canonical contract and validated with the active B1 validator and policy. The MTF result includes:
- original provider time and local receive time;
- request start/completion times when fetched through the coordinator;
- excluded post-cutoff count and pending-finality count;
- canonical per-timeframe snapshot;
- exact closed-only analysis candle slice;
- forming context separately;
- B1 quality report and timeframe-qualified reasons.

Aggregate precedence is deterministic: `INVALID > STALE > INSUFFICIENT > DEGRADED > VALID`.

Directional permission is true only if all three timeframes:
- have a report with exact current validator and policy versions;
- have report status VALID;
- pass exact requested closed-window coverage;
- have no MTF-specific blocking reason.

No fresh/stale cache mixing is supported. A failed timeframe request rejects the coordinated request. The coordinator suppresses superseded generations.

## 6. Fetch and cancellation

`fetchAndAssemble()` concurrently requests all three timeframes through the existing provider adapter. Raw request limit is:

`closedCandleCount + ceil(maxProviderTimeSpreadMs / timeframeStepMs) + 2`

The Bybit V5 1000-row limit is enforced. All requests share an AbortController. A failed timeframe aborts sibling requests. An optional external signal is propagated. `createCoordinator()` aborts an older generation when a newer request begins and prevents an obsolete result from being published.

The deterministic cancellation tests verify propagation to the adapter's AbortSignal. They do not prove the browser's real network stack cancels a live Bybit request.

## 7. Verification

The integration browser suite currently includes:
- Stage A: 44 tests;
- B1 Data Contract: 32 tests;
- B1 Quality Validator: 63 tests;
- B1 MTF current-contract suite: 12 tests (common cutoff, spread policy, provider-time trust, missing TF, stale TF, symbol mismatch, exact coverage, finality boundary, deep immutability, sibling abort and superseded generation).

Latest completed run before the contract-version hardening: GitHub Actions run `45965559146` passed Stage A 44/44, contract 32/32, validator 63/63, MTF 12/12, B1 gate/UI checks, chart checks, zero page errors. A subsequent run is required for the 1.1.0 contract/validator version hardening.

GitHub Actions live Bybit checks remain blocked by HTTP 403 from both public REST hosts. No live MTF capture or production spread calibration is claimed.

## 8. Explicitly not accepted yet

- Independent review of this exact current-contract MTF implementation.
- Recorded concurrent live Bybit 1D/4H/1H responses and measured spread policy.
- Actual transport-level abort test against a real browser network request.
- Latest B1 quality reason-code / blocked-WAIT panel visual check on iPhone Safari.
- Owner acceptance and merge to main.

Until those gates are satisfied, MTF remains an isolated data assembly capability and cannot authorize a trade decision.




## Verification record correction — 2026-11-27

The current completed GitHub Actions run is `45965680821` (not the earlier pre-hardening run cited above). It reports Stage A 44/44, B1 Data Contract 32/32, B1 Quality Validator 64/64, B1 MTF 12/12, B1 gate/UI and C1 chart assertions passed, zero browser page errors. The extra validator case rejects unsupported canonical contract versions.

Exact current candidate HTML blob: `3f1a739b90e3a187292b29cd9f0ca5c1beafbd5c`, 295,555 bytes, branch `integration/b1-mtf-architecture-2026-11-27`. The current branch is 48 commits ahead and 0 behind main; main remains unchanged.

The CI live Bybit check is blocked by HTTP 403 from both public REST hosts. No live MTF capture, measured production spread tolerance, or real browser network-stack abort behavior is established by this run.


## Verification refresh — 2026-11-27

The MTF suite was expanded with explicit assertions that forming/pending-finality candles never enter the closed-only analysis slice, provider-time spread one millisecond above policy fails closed, multiple post-cutoff rows fail closed, and missing spread policy fails closed. Async tests cover sibling abort and superseded generation.

Latest run: GitHub Actions `45966127523` passed Stage A 44/44, B1 Data Contract 32/32, B1 Quality Validator 64/64, B1 MTF 16/16, UI/gate/chart checks, zero browser page errors. Live Bybit remained blocked by HTTP 403 from both public REST hosts.

Exact current HTML blob: `4abb9936c96ae19ff231edd86088c1f1b62a2dd0`.




## Current hardening and verification — 2026-11-27

- `fetchAndAssemble()` now requires an explicit positive safe-integer `closedCandleCount`; it no longer silently substitutes a default history length. Missing count is rejected before any adapter/network request.
- Pending-finality candles are preserved in `pending_finality_context`; they are not included in `analysis_candles`. The closed-only slice is checked against the common cutoff and finality lag.
- Per-timeframe quality admission additionally requires `quality_report.snapshot_id === snapshot.snapshot_id`.
- The current B1 validator requires a non-empty canonical `snapshot_id` and places it into the quality report. B1-C checks that the report snapshot ID matches the exact dataset canonical snapshot before allowing directional analysis.
- MTF suite: 18 deterministic tests. B1 validator suite: 65 tests.

**Latest completed run:** GitHub Actions `45966700299` passed Stage A 44/44, B1 Data Contract 32/32, B1 Quality Validator 65/65, B1 MTF 18/18, B1 gate/UI and C1 chart assertions, with zero browser page errors. Live Bybit remained blocked by HTTP 403 from both public REST hosts.

Exact current HTML blob: `1cb41cfbc03534441774eeeaac08f36082f19ab9` (299,978 bytes). Browser harness blob: `8700f7ebedf6f4091b37d5e7d4c04ba22c2d92a8`. Main remains unchanged. Independent review, live concurrent capture/spread calibration, transport-level abort verification, latest Safari quality-panel check and owner acceptance remain open.



## Latest test expansion — 2026-11-27

The MTF self-test suite now contains 18 cases (previously 12). Added:
- missing `closedCandleCount` is rejected before any adapter/network call;
- pending-finality candles are retained in `pending_finality_context` and excluded from `analysis_candles`.

Latest completed CI run `45966502044`: Stage A 44/44, contract 32/32, validator 64/64, MTF 18/18, gate/UI/chart checks passed, zero browser page errors. Total: 158/158 named self-tests. Exact candidate HTML blob: `1cb41cfbc03534441774eeeaac08f36082f19ab9` (299,978 bytes). GitHub Actions still cannot verify live Bybit: both public REST hosts return HTTP 403 to the runner.



## Latest full-suite verification supersession — 2026-11-27

Run `45966700299` supersedes earlier counts: Stage A 44/44, contract 32/32, validator 65/65, MTF 18/18; gate/UI/chart checks passed, zero browser page errors; 159/159 named tests total. The gate harness includes a mismatched-`snapshot_id` regression. Exact HTML blob remains `1cb41cfbc03534441774eeeaac08f36082f19ab9`. Live Bybit remains blocked by HTTP 403 from the GitHub runner.




## Current MTF acceptance hardening — 2026-11-27

The deterministic MTF suite now contains 20 tests. In addition to common-cutoff, finality, coverage, provenance, immutable output and supersession, it verifies:
- missing `closedCandleCount` fails before adapter/network requests;
- a request that would exceed Bybit's 1000-row cap fails before adapter/network requests rather than being truncated;
- an external AbortSignal reaches all three timeframe requests;
- a failed timeframe aborts sibling requests;
- pending-finality candles are retained separately and never enter the closed-only analysis slice.

Each per-timeframe quality report must match both the current validator/policy versions and the exact canonical snapshot ID. The B1-C consumer separately verifies its legacy analysis candle array and last-closed price exactly match the canonical validated closed series; MTF already consumes canonical closed candles directly.

Latest completed CI run `45967551538`: Stage A 44/44, contract 32/32, validator 65/65, MTF 20/20; B1 gate/UI, chart, and live-probe page smoke checks passed, zero browser page errors. Live Bybit is blocked by HTTP 403 from both public hosts on the runner.

Current exact HTML blob: `2af63d1bbfec766606325450819d8ddff14173a2` (303,499 bytes). Browser harness: `a23585f9688b9a04336c7f99da7a972513882f8e`. Live probe tool: `3b5df8f0feda730c7e6564808f40ad4526f0e44a`.



## Current full-suite verification — 2026-11-27

Latest CI run `45967551538`: Stage A 44/44, B1 contract 32/32, B1 validator 65/65, B1 MTF 20/20; UI/gate/chart checks passed, zero browser page errors; 161/161 named tests. Current PR #8 draft head `f6cc90e51096e30bd524a6e883f3ca0ad1273d79`; HTML blob `2af63d1bbfec766606325450819d8ddff14173a2` (303,499 bytes). Live Bybit remains blocked by HTTP 403 from both public REST hosts on GitHub Actions. The MTF implementation remains isolated and not connected to directional output.


## 9. Initial live spread evidence (2026-11-27)

The supplied iPhone Safari captures completed 30 concurrent 1D/4H/1H samples for BTCUSDT and 30 for ETHUSDT. All 180 timeframe requests returned HTTP 200 and retCode 0; every response contained 200 rows. Provider-time spread was 0–140 ms for BTCUSDT (median 1 ms, p95 6 ms) and 0–325 ms for ETHUSDT (median 1 ms, p95 324 ms). Combined maximum was 325 ms. A provisional 500 ms max-spread test threshold would admit all 60 observed samples, but this single short capture session is not sufficient for a production guarantee.

The raw capture rows independently passed common-cutoff/finality checks for 160 contiguous closed candles per timeframe, but this check has not yet run through the exact production adapter/contract/validator/MTF engine path. See B1_LIVE_CAPTURE_PROCEDURE.md for full capture statistics and limitations.
