# B2-F — Multi-Timeframe Structure Confluence

**Date:** 2026-11-27  
**Status:** Research specification only; no production integration authorization.  
**Inputs:** B1-E common-cutoff MTF result and one VALID B2-C result per timeframe.  
**Timeframes:** 1D, 4H, 1H.

## Purpose

Combine independently calculated B2-C structure states across 1D/4H/1H into one deterministic context summary. The timeframe roles are descriptive: 1D higher-timeframe context, 4H intermediate structure, 1H tactical structure. No weights or scores.

## Admission

Fail closed unless:
- B1-E aggregate status is VALID and directional_allowed is true;
- required_timeframes is exactly [1d, 4h, 1h];
- symbol, market type and analysis_as_of_ms are valid and common;
- every timeframe entry is VALID and contains a canonical snapshot and quality report matching the exact B1 validator, policy and common cutoff;
- each B2-C result is VALID and matches that timeframe's exact snapshot_id, symbol, timeframe, B1 report identity and common cutoff;
- each structure_state is UP, DOWN or UNESTABLISHED;
- all B2-C event IDs are unique, events are chronological, and every event is available no later than the common cutoff.

No mixed refresh generations, provider cutoffs, symbols or markets. One invalid/missing timeframe blocks the aggregate; no partial directional context is emitted.

## Alignment

Fixed input order: 1D | 4H | 1H.

- FULL_BULLISH: all UP.
- FULL_BEARISH: all DOWN.
- PARTIAL_BULLISH: at least one UP, no DOWN, and one or more UNESTABLISHED.
- PARTIAL_BEARISH: at least one DOWN, no UP, and one or more UNESTABLISHED.
- MIXED: at least one UP and at least one DOWN.
- UNESTABLISHED: all three UNESTABLISHED.

Also emit the exact structure pattern, e.g. UP|UP|DOWN. No numeric score or confidence.

## Hierarchical interpretation

- UP|UP|DOWN: 1H_PULLBACK_AGAINST_BULLISH_1D_4H.
- DOWN|DOWN|UP: 1H_BOUNCE_AGAINST_BEARISH_1D_4H.
- UP|DOWN|DOWN: 4H_1H_COUNTERTREND_BEARISH_VS_1D.
- DOWN|UP|UP: 4H_1H_COUNTERTREND_BULLISH_VS_1D.
- Other mixed patterns: MULTI_TIMEFRAME_CONFLICT.
- Partial patterns: PARTIAL_CONTEXT.
- All UNESTABLISHED: NO_ESTABLISHED_STRUCTURE.
- Full alignment: FULL_TIMEFRAME_ALIGNMENT.

Also summarize 4H/1H consensus as BULLISH, BEARISH, CONFLICT, PARTIAL or UNESTABLISHED. Preserve raw per-timeframe states; this interpretation never overrides the daily context.

## Event context and output

For each timeframe return structure state and last B2-C event (or null), with event type, direction, level, source pivot ID, break close time and availability time.

Return B1 MTF identity/common cutoff, B2-F engine/policy version, per-timeframe context, structure pattern, alignment status, hierarchical interpretation, lower-timeframe consensus and diagnostics. Do not emit LONG/SHORT/WAIT, entry, probability, confidence, SL/TP or order parameters.

## Mandatory tests

1. Full bullish and bearish alignment.
2. Partial bullish/bearish with UNESTABLISHED timeframe.
3. All UNESTABLISHED.
4. Mixed patterns.
5. Both 1H pullback/bounce patterns.
6. Both lower-timeframe countertrend patterns.
7. Lower-timeframe consensus symmetry.
8. Missing timeframe blocks.
9. B1 MTF non-VALID or directional_allowed false blocks.
10. Common cutoff mismatch blocks.
11. Snapshot/quality-report ID mismatch blocks.
12. B2-C symbol, market, timeframe or cutoff mismatch blocks.
13. Non-VALID B2-C blocks.
14. Invalid structure state blocks.
15. Duplicate/out-of-order event IDs/timestamps block.
16. Event availability after common cutoff blocks.
17. Deterministic output and deep immutability.
18. No input mutation.
19. No probability/trade-decision fields.
20. Full three-timeframe integration fixture.

## Non-goals

B2-F v1 does not combine S/R zones or B2-E retest lifecycles across timeframes, weight signals, draw charts or create a trade decision. Those remain separate increments.

B2-F may be developed as an isolated research candidate only. B1 formal acceptance, independent exact-source review and explicit owner approval remain mandatory before production integration.


## 12. Implementation candidate and contract audit — 2026-11-27

The isolated implementation is in `src/analysis/b2f-mtf-structure-confluence-engine.js`, draft PR #19.

Implementation-specific binding:
- B1 MTF contract: `1.0.0`.
- B1 canonical snapshot contract: `1.1.0`.
- B1 validator: `1.1.0`.
- Actual B1 quality policy: `b1-quality-policy-2026-11-27-v1`.
- B2-B engine/policy: `2.2.0-b2b` / `b2b-swing-sequence-v3`.
- B2-C engine/policy: `2.1.0-b2c` / `b2c-state-v2`.

The B1 MTF outer `market_type` is a display label (currently `Linear Perpetual`), while each canonical snapshot uses `linear_perpetual`. B2-F preserves the display label separately and uses the canonical snapshot market type for identity checks. The outer raw symbol is likewise not substituted for the canonical snapshot symbol.

B2-F validates unique per-timeframe snapshot IDs, exact per-timeframe candle maps, selected analysis-window candle equality, provider-time spread recomputation, B2-C event uniqueness/order and exact finality availability (`break close + 500 ms`). The output uses `alignment_context` values such as `BULLISH_STRUCTURE`, not a LONG/SHORT recommendation.

## 13. Verification and limitations

- 28/28 B2-F deterministic tests passed in GitHub Actions run [46019688038](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46019688038) on head `df1170785112ca7f2f513788ab69c86358b6f4b4`.
- Integrated B2-A through B2-F suite: 147/147 passed in run [46019688084](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46019688084).
- The full three-timeframe fixture uses actual B2-A/B/C engines over synthetic per-timeframe snapshots and a synthetic B1-E-shaped common-cutoff result. The actual B1MtfEngine is statically inspected but not invoked by this Node test suite.
- No live Bybit MTF data run, iPhone/Safari integration, MTF zone/retest confluence, chart overlay or directional trade decision is included.
- B1 remains NOT ACCEPTED. B2-F is research-only and not imported into application HTML.


## 14. Final policy hardening — 2026-11-27

B2-F policy now requires an explicit `max_provider_time_spread_ms` and verifies that the B1-E result carries the exact same maximum. The actual provider-time spread is recomputed from all three per-timeframe provider timestamps; a forged or overly permissive aggregate value is rejected. The output preserves the measured and configured spread in its admission record.

The exposed overall context is categorical structure context (for example `BULLISH_STRUCTURE`, `PARTIAL_BEARISH_STRUCTURE`, `MIXED_STRUCTURE`), not an order direction.


## 15. Final deterministic verification — 2026-11-27

Latest B2-F head: `db81a06d992a89bfaa7a5c60f7266f679f4fcd90`.

- B2-F: **30/30** deterministic tests passed in [run 46020155711](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46020155711).
- Integrated B2-A through B2-F research suite: **149/149** passed in [run 46020155690](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46020155690).

Final additional guard: every B2-C event close timestamp must be positive, aligned to its own timeframe boundary, and its availability must equal the close timestamp plus the exact B1 finality lag.
