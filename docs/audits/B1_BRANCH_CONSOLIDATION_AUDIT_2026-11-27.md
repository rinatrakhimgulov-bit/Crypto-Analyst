# B1 Branch Consolidation Audit — 2026-11-27

**Status:** IN PROGRESS  
**Target branch:** `integration/b1-mtf-architecture-2026-11-27`  
**Base:** `b1/contract-review`  
**Main:** unchanged  
**Purpose:** determine how to consolidate the latest B1-A/B/C and the independently reviewed B1-E common-cutoff work without a wholesale merge of divergent branches.

## 1. Branch facts

The repository contains two B1 implementation candidates:

- `b1/contract-review`: current B1-A/B/C candidate plus C1 chart visualization and B1-C UI transparency hardening. Its current HTML blob is `1c32696a7aa0751a33e628853df1a780aad7f76b` (270,263 bytes).
- `impl/b1-quality-contract-2026-11-26`: earlier B1-A/B/E candidate. Its HTML blob is `842c361a8386c358a68f22407814c376fd3bde1b` (258,221 bytes), with an independent audit document for that exact blob.

Both branches share merge base `e53f74cf814638d70f775366e88b6754c95b9e51`. Comparing current B1/C1 against the B1-A/B/E branch shows divergence: B1/C1 is 21 commits behind and the B1-A/B/E branch is 132 commits ahead in the GitHub compare view. The branches must not be merged wholesale.

## 2. What is independently reviewed

The audit `docs/audits/B1_A_B_E_INDEPENDENT_AUDIT_2026-11-27.md` identifies exact audited HTML blob `842c361a8386c358a68f22407814c376fd3bde1b` and B1-E spec blob `0481400d46be50ff353b73783c769e220ca60bda`.

The external review reports:
- B1E MTF self-test 33/33;
- B1 quality self-test 65/65;
- actual Bybit V5-shaped rows through adapter normalization and MTF assembly;
- boundary, short-response, multiple-forming and deep-freeze probes;
- no identified critical defect allowing directional permission for known misaligned/unclosed MTF data in that audited artifact.

The audit is **conditional**, not production approval. It explicitly withholds directional MTF approval pending:
- live Bybit 1D/4H/1H captures;
- measured provider-time spread policy;
- replay of recorded responses through the exact adapter/assembler;
- transport-level abort testing;
- a tested invariant or strict validation preventing forming-candle data from influencing directional analysis.

The audit did not verify browser, iPhone Safari, live network behavior, full Stage A 44/44, or the newer B1-C/C1 artifact.

## 3. Why B1-E cannot be copied as-is

The B1-E implementation on the older branch is coupled to the older `DataQualityEngine` API:
- `DataQualityEngine.intervalToMs()`;
- `DataQualityEngine.createSnapshot()`;
- `DataQualityEngine.validate()`;
- legacy dataset and quality report field names.

The current B1/C1 branch uses the newer:
- `B1DataContract.toSnapshot()`;
- `B1QualityValidator.validate(snapshot, policy, validationNowMs)`;
- versioned `qualityReport` identity and policy gate;
- current canonical snapshot schema and adapter metadata.

Therefore, the older `MTFDataEngine` is a design/reference implementation, not a drop-in module. Copying it directly risks bypassing or breaking the current B1 quality contract. The correct operation is a controlled port of the MTF assembly semantics to the current canonical contract, preserving the fail-closed B1-C gate.

## 4. Confirmed B1-E semantics worth preserving

- Required TF set is 1D / 4H / 1H.
- All required requests are coordinated and cancellable as one generation.
- A common analysis cutoff is the minimum trusted provider time across all required responses.
- Provider timestamps and local receive timestamps remain distinct.
- Candles are reclassified at the common cutoff with the 500 ms finality buffer.
- Post-cutoff candles are excluded and counted.
- Coverage is recomputed against the common cutoff and desired closed-candle count.
- Missing, stale, invalid or insufficient TF blocks aggregate directional permission.
- Fresh and stale timeframes must never be mixed into one apparently valid snapshot.
- Aggregate snapshots are deeply immutable.
- Missing provider spread policy fails closed; no production spread default is guessed.

## 5. Integration risks that require explicit handling

1. **Schema translation:** map MTF results to the current B1 canonical contract; do not retain legacy field names as a second competing contract.
2. **Quality identity:** every per-TF report must carry the current validator and policy versions expected by B1-C.
3. **Common cutoff:** preserve each provider's original time and use common cutoff only as analysis-as-of metadata. Do not overwrite provider provenance.
4. **Coverage:** calculate exact expected closed start/end/count per timeframe; a short raw response must not be hidden by slicing.
5. **Finality:** distinguish closed, pending-finality and actively forming candles.
6. **Forming data:** no forming candle may influence directional features. Before later use, validate its OHLCV/alignment explicitly.
7. **Aggregate precedence:** define deterministic severity precedence and preserve timeframe-qualified reasons.
8. **Failure/cancellation:** one failed TF blocks the MTF set; superseded requests cannot publish; stale cached TF cannot be mixed with fresh TFs.
9. **Provider policy:** spread tolerance must be measured from real captures; unset/invalid policy blocks direction.
10. **Test portability:** preserve the older 33 MTF scenarios where relevant, but re-author tests against the current B1 contract and add integration cases for B1-C policy/version identity.

## 6. Current B1/C1 candidate evidence

For `b1/contract-review`:
- Stage A: 44/44;
- B1 Data Contract: 32/32;
- B1 Quality Validator: 63/63;
- UI quality-gate DOM assertions passed;
- C1 chart checks passed in the documented CI run;
- no browser page errors in the recorded Chromium CI runs;
- GitHub Actions live Bybit probe was blocked by HTTP 403 from both public REST hosts;
- latest B1-C panel reason-code change still awaits user-side iPhone Safari visual check.

These results apply to the candidate branch and the relevant recorded CI commits. They do not prove live Bybit availability or trading edge.

## 7. Immediate work plan

1. Keep `main` unchanged.
2. Use this integration branch as the single consolidation workspace.
3. Preserve current B1/C1 source as the baseline.
4. Port only the B1-E semantics into the current B1 contract; do not merge the old branch wholesale.
5. Add deterministic tests for provider time spread, common cutoff, finality boundary, exact coverage, missing TF, stale mixing, cancellation, superseded generations, deep immutability and B1-C identity binding.
6. Re-run Stage A, B1 contract, B1 validator, MTF and browser suites together.
7. Run independent review against the exact consolidated HTML blob.
8. Capture live Bybit data and calibrate spread policy before directional MTF integration.
9. Obtain owner acceptance before main merge.

## 8. Scope boundary

This consolidation does not start B2 Market Structure. It removes the remaining data synchronization and architecture uncertainty so B2 can consume a stable, synchronized, provider-neutral closed-candle dataset.

No code in `main` was changed by this audit.




## Integration execution update — 2026-11-27

The controlled port described above has now been implemented on `integration/b1-mtf-architecture-2026-11-27`. This supersedes the earlier "Immediate work plan" item that described the port as future work.

- Current candidate HTML blob: `3f1a739b90e3a187292b29cd9f0ca5c1beafbd5c` (295,555 bytes).
- The current implementation is `B1MtfEngine` and uses B1 canonical contract 1.1.0 / B1QualityValidator 1.1.0, not legacy DataQualityEngine.
- Explicit `excluded_after_cutoff_count` accounting is part of the versioned canonical schema.
- The MTF self-test suite is wired into the browser CI harness and currently reports 12/12.
- Latest completed CI run `45965680821`: Stage A 44/44, contract 32/32, validator 64/64, MTF 12/12, gate/UI/chart assertions passed, zero browser page errors.
- Live Bybit is not verified: GitHub runner receives HTTP 403 from both REST hosts.

The current branch is 48 commits ahead of main and 0 behind. Main HTML blob remains `02cbfb60d1a562e7b73e2734d1ab49b4cf91e2bf`. No merge has occurred.

**Current audit status: implementation port complete; integration review still open.** The older independent review does not cover this current blob. The exact-artifact review request is in `docs/audits/PROMPT_B1_CURRENT_CONTRACT_INDEPENDENT_REVIEW_2026-11-27.md`. Remaining gates: independent review, live concurrent capture and spread calibration, browser transport abort verification, latest iPhone Safari panel check, owner acceptance. B2 remains gated.



## Latest verification refresh — 2026-11-27

The current HTML candidate blob is `1cb41cfbc03534441774eeeaac08f36082f19ab9` (299,978 bytes). Latest completed CI run `45966502044`: Stage A 44/44, contract 32/32, validator 64/64, MTF 18/18, gate/UI/chart checks passed, zero browser page errors; 158/158 named self-tests. The new MTF tests ensure missing history depth fails before network calls and pending-finality candles remain context-only. Branch is 66 ahead / 0 behind main. Live Bybit is still blocked by HTTP 403 from both public hosts on GitHub Actions. No independent audit or owner acceptance has been received; main remains unchanged.



## Current candidate verification — 2026-11-27

PR #8 draft head `f6cc90e51096e30bd524a6e883f3ca0ad1273d79`; HTML blob `2af63d1bbfec766606325450819d8ddff14173a2` (303,499 bytes); browser harness `a23585f9688b9a04336c7f99da7a972513882f8e`. Latest CI `45967551538`: Stage A 44/44, contract 32/32, validator 65/65, MTF 20/20; 161/161 tests, UI/chart assertions passed, zero page errors. B1-C blocks divergence between validated canonical candles and the legacy analysis input. Live Bybit remains blocked by HTTP 403. PR remains draft; independent review and acceptance remain open; main unchanged.



## Transport test addendum — 2026-11-27

The actual Chromium fetch stack and actual Bybit adapter path are now exercised against a delayed local HTTP server. External cancellation stops concurrent kline/ticker requests; timeout aborts a pending request with `TimeoutError`; server observes 3/3 client connections closed. CI `45968566553` passed 161/161 tests, UI/chart/probe checks, zero page errors. This is not a live Bybit test. Current HTML blob `3d6a2fea8c4724d47a4d91bb73a53c6dedecd8cf`, harness `70399a984b44f5f85024afcdf11289e4a73a6361`. PR #8 draft; main unchanged. Remaining acceptance gates: independent review, live concurrent captures/spread calibration, iPhone Safari panel check, owner acceptance.
