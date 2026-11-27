# Independent audit request — current B1-A/B/C/E candidate

**Repository:** https://github.com/rinatrakhimgulov-bit/Crypto-Analyst  
**Branch:** `integration/b1-mtf-architecture-2026-11-27`  
**Draft PR:** https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/8  
**Exact HTML blob to audit:** `1cb41cfbc03534441774eeeaac08f36082f19ab9`  
**File:** `CryptoAnalyst_StageA_S6_updated.html`  
**Current test harness:** `tests/b1-browser-live-check.cjs`

## Independence requirement

Audit the exact HTML blob above. Do not rely on the previous B1-E audit as approval: that audit examined a different older blob (`842c361a8386c358a68f22407814c376fd3bde1b`) and a legacy `DataQualityEngine` implementation. The current port uses B1DataContract/B1QualityValidator.

Do not modify repository files. Do not assume the author’s tests are correct. Independently inspect the implementation and run the actual self-tests if possible.

## Scope

Review the complete B1-A/B/C/E path and its interaction with Stage A:

1. Bybit adapter normalization, raw-row accounting, provider-time provenance, local fallback, duplicates, malformed rows, order and gaps.
2. Canonical contract version 1.1.0 and validator version 1.1.0.
3. Required `source_diagnostics.excluded_after_cutoff_count` semantics and the raw-to-canonical row accounting invariant.
4. B1 quality validator fail-closed behavior, finality, freshness, timeframe maps, source metadata, coverage diagnostics and policy identity.
5. B1-C gate: only current validator + current policy + VALID may admit directional calculations; stale cache must become WAIT.
6. B1-E MTF common cutoff across 1D/4H/1H, provider spread, 500 ms finality, post-cutoff row exclusion, exact closed-window coverage, forming/pending-finality separation, aggregate precedence and deep immutability.
7. Concurrent fetch, AbortSignal propagation, failed-timeframe sibling cancellation, coordinator supersession and stale/mixed-snapshot prevention.
8. Compatibility with Stage A and the existing chart path. MTF is intentionally isolated and must not silently affect existing LONG/SHORT/WAIT output.

## Specific adversarial cases

- Missing or local-fallback provider time in any timeframe.
- Provider spread exactly at the limit and one millisecond above.
- A response crossing an interval boundary while another response defines an earlier common cutoff.
- A candle that closed but is still inside the 500 ms finality buffer.
- A candle that is exactly at the 500 ms finality boundary.
- One and multiple post-cutoff normalized rows.
- Short raw response and missing leading/trailing closed candles.
- Duplicate, conflicting duplicate, malformed and misaligned rows combined with post-cutoff exclusions.
- Wrong canonical contract version and mismatched validator/policy report identity and mismatched snapshot identity.
- One stale/invalid/degraded/missing timeframe among otherwise valid timeframes.
- Abort during each of the three concurrent requests.
- A newer request superseding an older generation whose responses complete late.
- Missing `closedCandleCount` must fail before any network request; no implicit history default.
- A pending-finality candle must remain explicit context and never enter `analysis_candles`.
- A `VALID` report whose `snapshot_id` differs from the dataset's canonical snapshot must be rejected by the B1-C gate.
- Confirm that no forming candle is present in `analysis_candles` or can influence directional analysis.
- Confirm the 1000-row provider limit fails explicitly rather than truncating requested history.

## Reproducible test evidence reported by the implementation author

Latest GitHub Actions run `45966700299`:
- Stage A: 44/44
- B1 Data Contract: 32/32
- B1 Quality Validator: 65/65
- B1 MTF: 18/18
- B1 gate/UI and C1 chart assertions passed
- zero browser page errors
- live Bybit probe skipped/blocked because both public REST hosts returned HTTP 403 to the GitHub runner.

These results are claims to verify, not assumptions. The run did not establish live Bybit behavior, a production provider-time spread value, or actual browser network-stack cancellation.

## Required output

Return:
1. Exact artifact identity verified (yes/no and blob SHA).
2. Tests independently run, with counts and environment.
3. Findings grouped CRITICAL / HIGH / MEDIUM / LOW, each with exact file/line, impact, reproduction and fix.
4. Any missing tests or unsafe assumptions.
5. Explicit statement whether forming/pending candles can affect directional analysis.
6. Separate verdicts:
   - B1-A/B data contract and validator;
   - B1-C analytics quality gate;
   - B1-E MTF data assembly;
   - readiness to merge into main;
   - readiness to connect MTF to directional analytics.
7. Final verdict: APPROVE, APPROVE WITH CONDITIONS, REQUEST CHANGES, or REJECT.

Do not call this profitable trading logic. Do not infer live exchange correctness from mocks or CI that cannot reach Bybit.

## Test suite expansion — 2026-11-27

The current HTML blob includes 18 MTF tests. Additional cases assert: forming and pending-finality candles never enter the closed-only analysis slice; provider-time spread one millisecond above policy fails closed; multiple post-cutoff rows fail closed; missing measured spread policy fails closed; missing closed-candle count fails before network requests; and superseded requests cannot publish. The B1 validator now requires a stable canonical `snapshot_id`, includes it in each quality report, and the analytics gate checks that the report belongs to the exact dataset snapshot. Latest run 45966700299 passed Stage A 44/44, B1 contract 32/32, B1 validator 65/65, MTF 18/18, gate/UI/chart checks, with zero browser page errors. Live Bybit remains blocked by HTTP 403 from both public REST hosts.



## Artifact/test refresh — 2026-11-27

The exact candidate HTML blob to audit is now `1cb41cfbc03534441774eeeaac08f36082f19ab9` (299,978 bytes). The latest completed CI run is `45966502044`: Stage A 44/44, contract 32/32, validator 64/64, MTF 18/18; 158/158 total named self-tests, gate/UI/chart assertions passed, zero page errors. The new MTF tests cover omitted closed-history count and pending-finality context separation. Please audit this newer exact blob, not the older SHA in the original prompt body. Live Bybit remains blocked from GitHub Actions by HTTP 403 from both REST hosts.
