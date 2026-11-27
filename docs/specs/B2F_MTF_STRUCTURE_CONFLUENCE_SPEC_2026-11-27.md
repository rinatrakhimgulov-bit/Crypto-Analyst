# B2-F — Multi-Timeframe Structure Confluence Specification

**Date:** 2026-11-27  
**Status:** Isolated research specification; no production integration authorization  
**Depends on:** B1-E common-cutoff MTF result and VALID B2-C result for each timeframe  
**Required timeframes:** 1D, 4H, 1H  
**Scope:** Structural alignment/context only; no LONG/SHORT/WAIT decision.

## 1. Purpose

B2-F combines independently calculated B2-C structure states across 1D, 4H and 1H into one deterministic multi-timeframe context.

Timeframe roles are descriptive:
- 1D: higher-timeframe context;
- 4H: intermediate structure;
- 1H: tactical structure.

No timeframe receives a numeric weight. No score, probability, confidence percentage or trade recommendation is produced.

## 2. Inputs

- Exact B1-E MTF result from `B1MtfEngine.assemble()` or `fetchAndAssemble()`.
- One VALID B2-C result for each required timeframe: `1d`, `4h`, `1h`.
- Versioned B2-F policy with exact B1 contract, validator, quality-policy and B2-C engine/policy identities.

B2-F v1 consumes B2-C structure states only. B2-D zones and B2-E retest lifecycles remain separate contextual layers and are not required to calculate structural alignment.

## 3. Admission and common-cutoff invariants

Fail closed unless:
- B1-E aggregate `status === VALID` and `directional_allowed === true`;
- `required_timeframes` is exactly `['1d','4h','1h']`;
- the MTF result has one non-empty symbol, market type, positive safe-integer `analysis_as_of_ms`, and all three timeframe entries;
- each timeframe entry has `status === VALID`, a canonical snapshot and quality report;
- each per-timeframe snapshot and quality report matches the exact B1 validator/quality policy and common cutoff;
- each B2-C result is VALID and matches that timeframe's exact snapshot ID, symbol, timeframe, B1 report identity and common `analysis_as_of_ms`;
- each B2-C `structure_state` is exactly `UP`, `DOWN` or `UNESTABLISHED`;
- all B2-C events have unique IDs and are available no later than the common cutoff.

No mixing of snapshots from different refresh generations, provider cutoffs, symbols or markets is permitted. No partial result is emitted if one required timeframe fails admission.

## 4. Alignment model

Input order is fixed: `1d | 4h | 1h`.

The engine emits the exact state pattern, for example `UP|UP|DOWN`, and one categorical alignment status:

- `FULL_BULLISH`: all three states UP;
- `FULL_BEARISH`: all three states DOWN;
- `PARTIAL_BULLISH`: at least one UP and no DOWN, with one or more UNESTABLISHED;
- `PARTIAL_BEARISH`: at least one DOWN and no UP, with one or more UNESTABLISHED;
- `MIXED`: at least one UP and at least one DOWN, regardless of the third state;
- `UNESTABLISHED`: all three states UNESTABLISHED.

No percentage or weighted score is calculated.

## 5. Hierarchical interpretation

A second categorical field explains the relationship between daily context and lower timeframes. It is descriptive, not a directional trade instruction.

Explicit patterns:
- `UP|UP|DOWN` → `1H_PULLBACK_AGAINST_BULLISH_1D_4H`;
- `DOWN|DOWN|UP` → `1H_BOUNCE_AGAINST_BEARISH_1D_4H`;
- `UP|DOWN|DOWN` → `4H_1H_COUNTERTREND_BEARISH_VS_1D`;
- `DOWN|UP|UP` → `4H_1H_COUNTERTREND_BULLISH_VS_1D`;
- other patterns containing both UP and DOWN → `MULTI_TIMEFRAME_CONFLICT`;
- patterns with one direction and at least one UNESTABLISHED → `PARTIAL_CONTEXT`;
- all UNESTABLISHED → `NO_ESTABLISHED_STRUCTURE`;
- full alignment → `FULL_TIMEFRAME_ALIGNMENT`.

The output must always preserve the raw per-timeframe states so consumers can inspect the basis of the interpretation.

## 6. Lower-timeframe consensus

A separate field summarizes 4H and 1H:
- both UP → `BULLISH`;
- both DOWN → `BEARISH`;
- one UP and one DOWN → `CONFLICT`;
- one directional and one UNESTABLISHED → `PARTIAL`;
- both UNESTABLISHED → `UNESTABLISHED`.

This does not override the 1D context or the overall alignment status.

## 7. Event context

For each timeframe, include:
- structure state;
- last B2-C event (or null);
- event type, direction, level price, source pivot ID, breaking-candle close time and availability time.

The last event is selected from the B2-C append-only event array after validating unique IDs and chronological order. Events unavailable at the common cutoff are invalid input, not silently dropped.

No event is upgraded, downgraded or relabeled by B2-F.

## 8. Output contract

Return:
- B2-F engine/policy version;
- B1 MTF snapshot generation identity, symbol, market type and common cutoff;
- exact required timeframe order;
- per-timeframe state and last-event context;
- `structure_pattern`;
- `alignment_status`;
- `hierarchical_interpretation`;
- `lower_timeframe_consensus`;
- diagnostics for state counts and event counts;
- admission status and blocking reasons.

Do not emit LONG, SHORT, WAIT, entry price, probability, confidence, stop loss, take profit, position sizing or order parameters.

## 9. Mandatory deterministic test matrix

1. Full bullish alignment.
2. Full bearish alignment.
3. Partial bullish with one UNESTABLISHED timeframe.
4. Partial bearish with one UNESTABLISHED timeframe.
5. All UNESTABLISHED.
6. Mixed 1D/4H/1H patterns.
7. 1H pullback against bullish 1D/4H.
8. 1H bounce against bearish 1D/4H.
9. 4H/1H countertrend against 1D.
10. Lower-timeframe consensus symmetry.
11. Missing timeframe blocks all output.
12. B1 MTF status other than VALID blocks.
13. B1 directional_allowed false blocks.
14. MTF common cutoff mismatch blocks.
15. Snapshot/quality-report ID mismatch blocks.
16. B2-C symbol, market, timeframe or cutoff mismatch blocks.
17. B2-C non-VALID result blocks.
18. Invalid structure state blocks.
19. Duplicate or out-of-order B2-C event IDs/timestamps block.
20. Event available after common cutoff blocks.
21. Same inputs/policy produce deterministic identical output.
22. Inputs are not mutated and output is deeply immutable.
23. No score/probability/trade-decision fields are emitted.
24. Full three-timeframe B1-E fixture with three B2-C results produces the expected pattern.

## 10. Explicit non-goals

B2-F v1 does not:
- combine B2-D support/resistance zones across timeframes;
- combine B2-E retest lifecycle statuses;
- rank or weight timeframe signals;
- create a LONG/SHORT/WAIT decision;
- change the chart timeframe or draw overlays;
- infer market direction from forming candles;
- claim predictive accuracy or profitability.

These can be considered only after the structural context output is independently reviewed.

## 11. Release gates

B2-F is research-only. It may be implemented and tested as an isolated candidate, but it cannot be connected to the application or directional decision path until:
- B1 is formally accepted;
- B2-A/B/C/D/E exact source commits are independently reviewed and accepted;
- B2-F deterministic and integrated tests pass;
- live MTF common-cutoff data behavior is validated;
- the owner explicitly approves integration.

**Current status:** B2-F specification drafted. No production integration authorized.
