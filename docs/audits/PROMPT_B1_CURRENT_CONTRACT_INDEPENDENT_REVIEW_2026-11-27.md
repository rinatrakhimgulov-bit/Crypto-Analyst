# Independent audit request — current B1-A/B/C/E candidate

**Repository:** https://github.com/rinatrakhimgulov-bit/Crypto-Analyst  
**Branch:** `integration/b1-mtf-architecture-2026-11-27`  
**Draft PR:** https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/8  
**Exact HTML blob:** `d9a20c7fd508b30bf1625aa1f3ab95308f84c44b` (306,725 bytes)  
**Browser harness blob:** `70399a984b44f5f85024afcdf11289e4a73a6361`  
**Read-only live probe blob:** `3b5df8f0feda730c7e6564808f40ad4526f0e44a`

## Independence requirement

Audit the exact HTML blob above. Do not rely on the previous B1-E audit as approval: that audit examined a different older blob (`842c361a8386c358a68f22407814c376fd3bde1b`) and a legacy `DataQualityEngine` implementation. The current port uses `B1DataContract` / `B1QualityValidator`.

Do not modify repository files. Do not assume the author's tests are correct. Independently inspect the implementation and run the actual self-tests if possible. If you cannot run them, state that explicitly.

## Scope

Review the complete B1-A/B/C/E path and its interaction with Stage A:

1. Bybit adapter normalization, raw-row accounting, provider-time provenance, local fallback, duplicates, malformed rows, order and gaps.
2. Canonical contract version 1.1.0 and validator version 1.1.0.
3. Required `source_diagnostics.excluded_after_cutoff_count` semantics and raw-to-canonical row accounting.
4. B1 quality validator fail-closed behavior, finality, freshness, timeframe maps, source metadata, coverage diagnostics and policy identity.
5. B1-C gate: current validator + current policy + VALID + matching snapshot identity + exact equivalence between the canonical validated candles and the legacy `dataset.closedCandles` / `prices.lastClosedPrice` consumed by analytics.
6. Stale cache after REST refresh failure must become STALE/WAIT; old LONG/SHORT must not survive as current.
7. B1-E MTF common cutoff across 1D/4H/1H, provider spread, 500 ms finality, post-cutoff row exclusion, exact closed-window coverage, forming/pending-finality separation, aggregate precedence and deep immutability.
8. Concurrent fetch, AbortSignal propagation, failed-timeframe sibling cancellation, external cancellation, coordinator supersession and stale/mixed-snapshot prevention.
9. Read-only live probe v3: strict provider-time parsing, raw response retention, failed-attempt timing/status, host fallback, timeout/stop behavior, no automatic network requests on page load, no upload or trading side effects.
10. Compatibility with Stage A and the existing chart path. MTF is intentionally isolated and must not silently affect existing LONG/SHORT/WAIT output.

## Specific adversarial cases

- Missing or local-fallback provider time in any timeframe.
- Provider spread exactly at the limit and one millisecond above.
- A response crossing an interval boundary while another response defines an earlier common cutoff.
- A candle that closed but is still inside the 500 ms finality buffer.
- A candle exactly at the 500 ms finality boundary.
- One and multiple post-cutoff normalized rows.
- Short raw response and missing leading/trailing closed candles.
- Duplicate, conflicting duplicate, malformed and misaligned rows combined with post-cutoff exclusions.
- Wrong canonical contract version; missing snapshot ID; mismatched validator, policy or snapshot report identity.
- A VALID report for one snapshot paired with a different legacy candle series or last-closed price.
- Empty but matching canonical/legacy series must preserve INSUFFICIENT rather than be mislabeled as an identity failure.
- One stale/invalid/degraded/missing timeframe among otherwise valid timeframes.
- Abort during each of the three concurrent requests.
- External AbortSignal cancellation reaches all three requests.
- A newer request superseding an older generation whose responses complete late.
- Missing `closedCandleCount` fails before any network request; no implicit history default.
- A pending-finality candle remains explicit context and never enters `analysis_candles`.
- No forming candle is present in `analysis_candles` or can influence directional analysis.
- Bybit's 1000-row limit fails explicitly rather than truncating requested history.

## Reproducible verification evidence

Latest completed candidate GitHub Actions run `45978061875` on the exact HTML blob above: Stage A 44/44, B1 Data Contract 32/32, B1 Quality Validator 72/72, B1 MTF 20/20 (168/168 total). Live Bybit was explicitly skipped because both public REST hosts returned HTTP 403 to the runner; do not treat it as a pass.
- Stage A: 44/44
- B1 Data Contract: 32/32
- B1 Quality Validator: 65/65
- B1 MTF: 20/20
- B1 gate/UI and C1 chart assertions passed
- live-probe page smoke check passed; page made no automatic Bybit requests
- zero browser page errors
- 161/161 named deterministic tests passed across the four suites.

Live Bybit probe was blocked because both public REST hosts returned HTTP 403 to the GitHub runner. This run does not establish live exchange availability, production spread calibration, or actual browser network-stack abort behavior.

These results are claims to verify, not assumptions.

## Required output

1. Exact artifact identity verified (yes/no and blob SHA).
2. Tests independently run, with counts and environment.
3. Findings grouped CRITICAL / HIGH / MEDIUM / LOW, each with exact file/line, impact, reproduction and fix.
4. Missing tests or unsafe assumptions.
5. Explicit statement whether forming/pending-finality candles can affect directional analysis.
6. Separate verdicts:
   - B1-A/B data contract and validator;
   - B1-C analytics quality gate;
   - B1-E MTF data assembly;
   - live probe utility;
   - readiness to merge into main;
   - readiness to connect MTF to directional analytics.
7. Final verdict: APPROVE, APPROVE WITH CONDITIONS, REQUEST CHANGES, or REJECT.

Do not call this profitable trading logic. Do not infer live exchange correctness from mocks or CI that cannot reach Bybit.

