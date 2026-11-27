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
