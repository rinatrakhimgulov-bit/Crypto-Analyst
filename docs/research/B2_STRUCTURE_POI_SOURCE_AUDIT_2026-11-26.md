# B2 Candidate Audit: Market Structure + POI/Liquidity

**Date:** 2026-11-26  
**Type:** Static source and test review of public repositories. No code copied or integrated. No tests were executed in this audit environment.  
**Crypto Analyst status:** B1 remains the active implementation stage. B2 remains NOT STARTED. This report is candidate research only.

## Executive decision

- **market-structure-engine:** **ADAPT / CONDITIONAL CANDIDATE** for the B2 structural core. Its causal swing confirmation and prefix-property tests make it the strongest currently inspected TypeScript candidate. Do not integrate as-is before resolving the ambiguity and input-contract issues below.
- **poi-liquidity-detector:** **ADAPT / HOLD** as a possible B4 feature layer built on the structural core. It offers useful OB/FVG/EQH/EQL/sweep mechanics and causal event timestamps, but one concrete identity bug and missing input/config validation need correction first.
- **Do not import both packages into Stage A now.** First finish B1, then validate the structure core independently, then add POI features incrementally.

## 1. Candidate repositories and provenance

### 1.1 market-structure-engine

Repository: https://github.com/kayasolomon/market-structure-engine  
License: MIT. Runtime dependencies: none. TypeScript source; package build requires Node >=20.  
Inspected default-branch tree SHA: `426b99fe9bfd09a09544759b99f5c77c82246e05`.

Inspected source blobs:
- `src/engine.ts`: `a8d7424810200735888612d6d6cc2523c215e47e`
- `src/fractals.ts`: `80d1ecb36f88caf2dd51485236f041ee36c7ddac`
- `src/resample.ts`: `860cde6f24dfabbf27c2a97699deac00d4972d13`
- `src/types.ts`: `1d5643c5987ce67fa3149bd90e9ea70b54287811`
- `test/engine.test.ts`: `9a5d7e4fa168ac9ce360579d5c6817cf246e04eb`
- `test/invariants.test.ts`: `17366beb2135d2db43765efe6ac7a87dff9026db`
- `test/resample.test.ts`: `8e93919e2fd5c5f75e7ba8d34dfbacfeaeabbbfc`

### 1.2 poi-liquidity-detector

Repository: https://github.com/kayasolomon/poi-liquidity-detector  
License: MIT. Runtime dependency: `market-structure-engine` via GitHub dependency. TypeScript source; package build requires Node >=20.  
Inspected default-branch tree SHA: `951304b33c71ad6fedcabf957de6ab40134d5670`.

Inspected source blobs:
- `src/detector.ts`: `a214f3a0e67f83c2e9aa51ad7c7658d76e30a78c`
- `src/equalLevels.ts`: `79a67b8857b6fc11f55b39f4549c4f8bfabaebd9`
- `src/fvg.ts`: `d4383a5df5eee6a8c29baf8e346ec7a3513a4d07`
- `src/atr.ts`: `1dda3e25a2247a7bd96d625d84303e3f9f964d6b`
- `src/zones.ts`: `b298447a54148f22fd38403a8b0ef2c795e77209`
- `test/invariants.test.ts`: `d3f14cfcf684a978d28c28322651a30f81fd7359`

## 2. market-structure-engine: findings

### Strengths

1. **Causal fractal confirmation.** A pivot at index `i` with half-width `k` is emitted only after bar `i+k` is processed. The result exposes both pivot index and `confirmedAtIndex`.
2. **Close-based BOS/CHoCH by default.** Intrabar wicks do not trigger structural breaks unless `wickMode` is explicitly enabled.
3. **Single-use broken levels.** A confirmed swing reference can be broken at most once.
4. **Batch/stream API.** `process()` delegates to repeated `update()`, and tests compare batch with incremental output.
5. **Prefix-property tests.** Tests compare prefix outputs with the subset of full-run outputs that should already have been known at the cut. This is meaningful evidence against repainting for tested fixtures and options, not a proof of trading edge.
6. **Small integration surface.** No runtime dependencies; plain typed results and chart-overlay mappers.

### Findings / limitations

**MS-01 — Wick mode can emit two contradictory structural events on one OHLC candle (HIGH).**  
In `src/engine.ts`, wick mode checks both high and low extremes. If one wide-range candle pierces both the active swing high and swing low, the implementation orders the checks according to candle direction (close >= open or close < open). OHLC does not reveal the chronological order in which the high and low occurred. The engine can therefore emit two events and select a final trend state using an arbitrary candle-colour tie-break.  
**Required treatment:** Crypto Analyst baseline must use confirmed-close mode. If wick-mode analysis is ever retained, dual-side penetration must produce an explicit AMBIGUOUS/UNKNOWN result or require lower-timeframe/tick sequencing. Do not infer event order from candle colour.

**MS-02 — The engine trusts its Candle input and does not validate it (HIGH integration requirement).**  
Neither `StructureEngine.update()` nor `FractalTracker.update()` validates finite OHLCV values, OHLC relationships, timestamp monotonicity, duplicate times, candle interval alignment, or closed-candle status. Invalid or out-of-order input can contaminate internal state.  
**Required treatment:** Feed only B1-approved canonical closed candles. Add defensive assertions at the adapter boundary or a small engine precondition layer; do not duplicate the full B1 validator inside every analytics module.

**MS-03 — Resampler can emit incomplete buckets as completed (HIGH if used).**  
`Resampler.update()` emits the current bucket whenever a candle from a later bucket arrives. It checks strictly ascending timestamps, but does not check source interval alignment, expected source-candle count, or internal gaps. For example, missing one 15-minute candle in a 1-hour bucket does not prevent the bucket from being emitted when the next hour begins.  
**Required treatment:** Do not use this resampler for canonical MTF data as-is. Either rely on provider-native 1H/4H/1D candles or add explicit source interval, expected count, gap and boundary validation before emitting a completed aggregate.

**MS-04 — Fractal sensitivity is fixed by bar count, not volatility/significance (MEDIUM).**  
The default `fractalK=2` detects local pivots without a minimum ATR-normalized prominence or distance filter. On noisy crypto markets this may create many low-significance swings.  
**Required treatment:** Keep the base detector mechanically simple, but test several `fractalK` values and add a separate, explicitly measured significance filter only if out-of-sample validation shows value. Do not hide filtering inside swing confirmation.

**MS-05 — Test gaps (MEDIUM).**  
The inspected tests cover clean synthetic structure chains, close-vs-wick behaviour, prefix property, batch/incremental equivalence and resampling cross-checks. They do not appear to cover dual-side wick breaks, malformed candles, duplicate/out-of-order times at the structure-engine boundary, or incomplete resample buckets.  
**Required tests:** dual-side wick ambiguity; malformed OHLCV; duplicate and out-of-order timestamps; missing source candles in a resample bucket; prefix invariance across these edge cases.

### Assessment

Keep as the leading B2 core candidate, but use confirmed-close mode and B1-gated data. The current algorithm is a deterministic structural classifier, not a complete market model and not evidence of profitable entries.

## 3. poi-liquidity-detector: findings

### Useful capabilities

- Order blocks are derived from a confirmed structure break, search backward for the last opposite-colour candle, and apply an ATR impulse threshold.
- FVG is detected from the first and third candles of a three-candle pattern and becomes known on the third candle.
- Equal highs/lows cluster confirmed swings using an ATR-scaled tolerance.
- Liquidity sweeps distinguish wick-through/close-back from a close-through break.
- Zone lifecycle records creation, mitigation and invalidation indices.
- Sweep-to-CHoCH composites carry causal event indices.
- Prefix-property and batch/incremental tests cover multiple detectors.

### Findings / limitations

**POI-01 — Equal-level membership identifies a swing by pivot index only (HIGH correctness defect).**  
In `src/equalLevels.ts`, `isMemberOfLevel(swing)` checks whether any level member has the same `index`, but does not compare swing kind (`high` versus `low`). The structure engine explicitly permits one wide-range candle to confirm both a swing high and a swing low at the same pivot index. If one side joins a reported EQH/EQL cluster, the opposite-kind swing at that same index can incorrectly be treated as part of the cluster. In `PoiDetector.detectSwingSweeps()`, that can suppress a valid lone-swing liquidity-sweep check.  
**Required fix:** Membership identity must include at least `kind + pivot index` (or use a stable swing ID). Add a regression test where a single candle confirms both high and low, only one side joins an equal-level cluster, and the other side remains eligible for a lone-swing sweep.

**POI-02 — Detector trusts candle order and candle validity (HIGH integration requirement).**  
`PoiDetector.update()` appends the candle and updates ATR, structure, zones, FVG and liquidity state without validating timestamps or OHLCV. It must receive B1-approved closed candles only.

**POI-03 — Most POI options are not validated (MEDIUM).**  
The nested fractal and ATR constructors validate their own periods, but detector options such as negative `minImpulseATR`, negative `equalTolATR`, negative `obLookback`, and negative `sweepReversalMaxBars` are not rejected centrally. These values can silently disable filters or change behaviour.  
**Required fix:** Validate all numeric options as finite and within documented domains; validate enum options at runtime for JavaScript consumers.

**POI-04 — Performance is not characterised (MEDIUM).**  
The detector retains all candles and historical zones; each update advances all existing zones and FVGs. This is simple and transparent, but no benchmark was found for long 1H histories or simultaneous 1H/4H/1D processing.  
**Required treatment:** Benchmark representative histories (e.g. 10k, 50k, 100k bars) before choosing whole-history retention or pruning/caching.

**POI-05 — Heuristic parameters are not trading evidence (HIGH research caveat).**  
OB selection, ATR impulse threshold, equal-level tolerance, sweep-reversal window and FVG fill mode are explicit heuristics. Unit tests prove deterministic implementation of the chosen definitions; they do not prove that the resulting zones predict profitable moves.  
**Required treatment:** Treat every POI output as a descriptive feature. Only promote it to a scenario factor after B7 walk-forward/out-of-sample testing with fees, slippage and funding.

### Assessment

Retain as a useful B4 candidate, but do not integrate before B2 core acceptance and POI-01/02/03 fixes. Start with FVG and sweep features as separately inspectable outputs; add order-block scoring only after its assumptions are validated.

## 4. Integration architecture for Crypto Analyst

Recommended eventual pipeline:

1. B1 canonical snapshot + mandatory quality gate.
2. B2 `StructureEngine` in confirmed-close mode, consuming only closed canonical candles.
3. B4 `PoiDetector` as a feature layer using the same structure events and candle stream; avoid maintaining a second independent structure implementation.
4. B3 Market Regime Engine remains a separate candidate and must not be inferred solely from BOS/CHoCH.
5. B5 MTF consumes aligned snapshots with a common as-of cutoff. Do not use the candidate resampler until MS-03 is resolved.
6. B6 combines feature evidence into LONG/SHORT/WAIT scenarios only after feature definitions and conflicts are explicit.
7. B7 validates whether any feature or combination adds out-of-sample value.

### Language and packaging

Both candidates are TypeScript with MIT licenses. Their source can be built into browser-compatible JavaScript, but Crypto Analyst currently remains a single-file HTML prototype. Do not migrate the entire application to React or a server just to use these modules. Once B1 is accepted, perform a small integration spike: compile/bundle the structure engine into a browser-compatible module and verify it against the current app's canonical candle schema. Pin dependency versions/commit SHAs rather than depending on a moving GitHub `main` branch.

## 5. Acceptance checklist before integration

### B2 structure core
- [ ] B1 gate is mandatory and receives only canonical closed candles.
- [ ] Confirmed-close mode is the default and wick mode is disabled for directional decisions.
- [ ] Dual-side wick penetration is explicitly ambiguous if wick mode is retained.
- [ ] Invalid, duplicate and out-of-order candles are rejected before state mutation.
- [ ] Prefix-invariance and batch/stream equivalence pass on synthetic and historical BTC/ETH fixtures.
- [ ] Tests cover ties, outside bars, gaps, simultaneous pivots and repeated breaks.
- [ ] Sensitivity of `fractalK` is measured across 1H/4H/1D, not guessed.
- [ ] Browser bundle integration spike passes without rewriting the app architecture.

### B4 POI layer
- [ ] Fix POI-01 with kind-aware swing identity.
- [ ] Validate all `PoiOptions`.
- [ ] Enforce B1-approved candles.
- [ ] Add regression tests for dual high/low pivot identity, sweep bookkeeping and zone lifecycle.
- [ ] Benchmark long histories.
- [ ] Keep POI features descriptive until B7 demonstrates incremental out-of-sample value.

## 6. Verification limits

This was a static source and test review using the repository's current default-branch files and committed test source. The tests were inspected but **not executed** in this environment. No live exchange data, independent backtest, profitability test, browser bundle test, or runtime performance benchmark was performed. Repository README claims and committed fixtures are not treated as independent proof of trading edge.

**Final decision:** `market-structure-engine = ADAPT / CONDITIONAL CANDIDATE`; `poi-liquidity-detector = ADAPT / HOLD`. B1 remains active; B2 implementation has not started; no Crypto Analyst application code was changed.
