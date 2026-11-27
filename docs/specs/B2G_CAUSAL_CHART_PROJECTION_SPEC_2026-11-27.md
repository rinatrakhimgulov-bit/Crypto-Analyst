# B2-G — Causal Chart Projection Contract

**Date:** 2026-11-27  
**Status:** Research specification; projection DTO only, not UI integration  
**Depends on:** B1 valid per-timeframe snapshot; B2-A/B/C/D/E and B2-F outputs  
**Scope:** Selected chart timeframe from 1D/4H/1H.

## 1. Purpose

B2-G converts immutable analysis-engine outputs into a chart-neutral overlay projection. It does not draw anything, update candles, or call Lightweight Charts. The future UI layer will consume this DTO.

## 2. Inputs

- Selected `chart_timeframe`: `1d`, `4h` or `1h`.
- Exact B1 canonical snapshot and quality report for that timeframe.
- VALID B2-A raw swing result.
- VALID B2-C structure result.
- VALID B2-D support/resistance result.
- VALID B2-E breakout/retest lifecycle result.
- VALID B2-F MTF structure confluence result containing the selected timeframe.

B2-G does not need B2-B separately because B2-C carries both raw pivot evidence and the active alternating pivot sequence.

## 3. Admission

Fail closed unless every result:
- is VALID;
- matches the exact selected timeframe, canonical symbol, snapshot ID and analysis cutoff;
- binds the expected engine/policy versions and B1 validator/quality-policy versions;
- has no pivot, event, zone or lifecycle evidence available after the snapshot cutoff.

B2-F must have the same canonical symbol and common cutoff, and its selected timeframe snapshot ID must match the selected B1 snapshot ID.

## 4. Causal visibility contract

Every projected item has both an anchor time and an earliest visibility time.

- Swing marker: anchor at pivot `source_time_ms`; visible only at/after pivot `available_at_ms`. Preserve `confirmed_at_ms` separately.
- Ambiguous same-candle high/low pair: each raw pivot marker is visible at its own `available_at_ms`; the ambiguous status is visible only at `status_visible_at_ms = max(high.available_at_ms, low.available_at_ms)`. Before that time, the first confirmed member must not be labelled as an already-known ambiguous pair.
- Superseded raw pivot: marker is visible at its own pivot `available_at_ms`; the superseded status is visible only at `status_visible_at_ms = max(pivot.available_at_ms, superseding_pivot.available_at_ms)`. Preserve both times; never backdate the superseded label.
- BOS/CHoCH/sweep marker: anchor at the breaking candle open; visible only at/after event `available_at_ms`; preserve breaking candle close and source pivot time.
- Support/resistance zone: `visible_from_ms = zone.available_at_ms`. Do not backdate the confirmed zone to its first touch. Preserve first/last touch as evidence metadata.
- Retest lifecycle: visible after the breakout event becomes available; touch state visible after the touch candle finality time; success/failure visible only after its confirmation candle availability.
- MTF panel: visible at the exact B2-F common cutoff.

A historical chart may anchor an item to an earlier source candle, but it must never display that item as known before `visible_at_ms`. The future UI must disclose the source/confirmation/availability distinction in the tooltip or equivalent detail.

## 5. Output DTO

Return only overlay data:
- `swing_markers`: active sequence pivots with label, type, price, source/confirmation/availability times and sequence IDs;
- `superseded_pivots`: raw pivots excluded by same-side replacement, with both `visible_at_ms` (pivot availability) and `status_visible_at_ms` (when replacement makes the superseded status knowable);
- `ambiguous_pivots`: same-candle high/low pairs preserved as raw evidence but excluded from the active alternating sequence, with separate pivot and ambiguity visibility times;
- `structure_events`: B2-C event type, direction, level, source pivot, break candle and availability;
- `zones`: confirmed B2-D bounds, role, representative price, touch count, first/last touch, availability and freshness status;
- `candidate_levels`: optional B2-D candidates, clearly distinct from confirmed zones;
- `retest_lifecycles`: B2-E status, proposed/effective role, touch/confirmation details and visibility time;
- `mtf_context`: B2-F pattern, alignment status, hierarchical interpretation and lower-timeframe consensus;
- exact symbol, timeframe, snapshot ID, analysis cutoff and engine/policy versions.

Do not return candle arrays, price series, trade signals, entry/exit, probability, confidence, SL/TP or order parameters.

## 6. Deterministic requirements

- Output order is stable: time then item ID.
- No source object is mutated.
- Output is deeply immutable.
- Duplicate pivot/event/zone/lifecycle IDs block admission.
- Items with availability after cutoff block admission; they are not silently filtered.
- Zone visibility begins at zone availability, not first touch.
- Retest state visibility uses the exact evidence availability time.
- No second candle or structure state is constructed in B2-G.

## 7. Mandatory tests

1. Valid projection for each selected timeframe.
2. Snapshot/symbol/timeframe/cutoff mismatch blocks.
3. B2-A/C/D/E non-VALID result blocks.
4. B2-F mismatch or missing selected timeframe blocks.
5. Active pivots map with source, confirmation and availability times.
6. Superseded raw pivots remain separate; their status transition is not backdated before the superseding pivot is available.
6a. Ambiguous dual pivots preserve each pivot availability and pair-status availability separately.
7. No pivot/event/zone/lifecycle can be visible before availability.
8. BOS/CHoCH anchor and break-candle metadata are preserved.
9. Zone visible-from equals B2-D availability, not first touch.
10. Candidate levels remain distinct from confirmed zones.
11. Pending, successful, failed, expired and unresolved retest lifecycles map correctly.
12. MTF context preserves exact B2-F pattern and interpretation.
13. Duplicate IDs block.
14. Future availability blocks.
15. Deterministic order and deep immutability.
16. No input mutation.
17. No candle series or trade-decision fields are emitted.
18. Full B1 → B2-A/B/C/D/E/F → B2-G projection fixture.

## 8. Explicit non-goals

B2-G does not:
- invoke Lightweight Charts or manipulate DOM/canvas;
- update live or forming candles;
- create a second candle/analytics engine;
- decide which chart overlays are visually enabled;
- create LONG/SHORT/WAIT, entry, SL/TP or order instructions.

Actual chart rendering is a later B2-H UI integration step, gated by B1 acceptance and owner approval.

## 9. Release gates

B2-G is research-only. The DTO may be implemented and tested in isolation. No application HTML or chart integration until B1 is formally accepted, exact B2-A through B2-G source commits are independently reviewed, and the owner explicitly approves integration.
