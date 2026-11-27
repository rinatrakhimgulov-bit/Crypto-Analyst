# B1 internal audit — 2026-11-27

## Scope and artifact identity

This is an internal source review and adversarial regression pass, not an independent third-party audit.

- Repository: `rinatrakhimgulov-bit/Crypto-Analyst`
- Branch: `integration/b1-mtf-architecture-2026-11-27`
- Exact candidate HTML blob: `d9a20c7fd508b30bf1625aa1f3ab95308f84c44b`
- File: `CryptoAnalyst_StageA_S6_updated.html`
- Size: 306,725 bytes; 5,762 lines
- Main branch was not changed.
- PR #8 remains draft and unmerged.

## Findings discovered and fixed

### B1-IA-001 — Canonical candle provenance was under-validated

**Severity:** HIGH (data-integrity control gap)

The validator checked candle canonical symbol, market type, timeframe, provider ID, provider event time and receive time. It did not verify that:
- candle `provider_symbol` matched `snapshot.provider_metadata.provider_symbol`;
- candle `venue` matched provider metadata;
- candle `normalizer_version` matched the current canonical normalizer;
- candle source-reference endpoint and host matched the provider metadata;
- the snapshot canonical symbol was consistent with its provider symbol.

A malformed or mixed-provenance canonical snapshot could therefore pass the prior identity checks if the other fields were made internally consistent.

**Fix:** Added these identity checks to B1QualityValidator. Mismatches now produce CRITICAL `CANDLE_PROVENANCE_MISMATCH` or `PROVIDER_METADATA_INVALID` and fail closed.

**Regression coverage:** five adversarial cases added:
1. mismatched candle provider symbol;
2. mismatched venue;
3. unknown normalizer version;
4. source-reference host mismatch;
5. snapshot canonical symbol/provider symbol mismatch.

Code locations in the current artifact: provider metadata mapping check around line 1,137; candle identity checks around line 1,351.

### B1-IA-002 — Provider server time had no future-skew bound

**Severity:** HIGH (finality and freshness could be misclassified if provider time is implausibly ahead)

The validator required a positive safe provider timestamp and checked its consistency with `analysis_as_of_ms`, but did not compare it with the explicit `validationNowMs` using the policy's `future_tolerance_ms`. A badly skewed or corrupted provider timestamp far ahead of local validation time could incorrectly classify candles as final.

**Fix:** Provider time ahead of `validationNowMs` by more than `future_tolerance_ms` now produces CRITICAL `PROVIDER_TIME_IN_FUTURE`. The exact tolerance boundary remains accepted.

**Regression coverage:** provider time exactly at the configured future tolerance is accepted; one millisecond beyond is rejected.

Code location in the current artifact: around line 1,314.

### Test fixture correction

The MTF coordinator supersession test used a fixed timestamp in January 2027. Once provider future-skew validation was added, that hard-coded fixture correctly failed against the actual 2026 validation clock. The fixture is now anchored to the current UTC day, keeping the test meaningful across future dates. This changes test data only, not production behavior.

Code location: around line 1,763.

## Current deterministic test inventory

The candidate embeds these named suites:
- Stage A: 44 tests (existing baseline)
- B1 Data Contract: 32 tests
- B1 Quality Validator: 72 tests (65 previous + 7 new)
- B1 MTF: 20 tests

Expected total after the latest code changes: **168 named deterministic tests**. The latest workflow run for the final candidate must be green before this report is treated as test-verified.

## What this audit does not establish

- It does not prove trading-signal profitability.
- It does not establish live Bybit availability or production provider-time spread calibration.
- It does not replace an independent review of the exact blob above.
- It does not approve merging PR #8 into `main`.
- MTF remains isolated from the existing LONG/SHORT/WAIT decision path.

## Remaining B1 acceptance gates

1. Green CI on exact blob `d9a20c7fd508b30bf1625aa1f3ab95308f84c44b`.
2. Independent review of that exact blob (use the current independent-review prompt in this folder).
3. Live concurrent Bybit 1D/4H/1H captures and measured provider-time spread policy.
4. Explicit owner acceptance before merge.
