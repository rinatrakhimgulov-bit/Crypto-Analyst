# B2-E — Break-Level Retest and Failed-Breakout Lifecycle Specification

**Date:** 2026-11-27  
**Status:** Research specification, not implementation authorization  
**Depends on:** B1 accepted canonical snapshots; B2-A/B/C; B2-D zone evidence  
**Scope:** Single timeframe per invocation (1H, 4H or 1D). No MTF decisions, no trade recommendations.

## 1. Purpose

B2-E converts confirmed B2-C break events into a causal, replayable lifecycle:
- waiting for a retest;
- retest touched;
- successful hold after retest;
- failed breakout;
- expiry without resolution.

It describes evidence around a broken swing level. It does not claim that a retest is profitable or that a direction should be traded.

## 2. Inputs and admission

The pure engine receives:
1. exact B1 canonical snapshot and matching B1 quality report;
2. exact B2-C result generated from that snapshot;
3. exact B2-D result generated from that snapshot;
4. explicit versioned B2-E policy.

Fail closed unless:
- B1 report is VALID and exact snapshot/validator/quality-policy identity matches;
- B2-C and B2-D are VALID and match the exact snapshot, symbol, timeframe and analysis cutoff;
- B2-C event provenance resolves to an actual raw pivot with the same pivot ID, type, price, source time and availability time;
- break event's breaking candle exists in the canonical closed-candle set and the event's confirmation/availability timestamps are correct;
- candle history is ordered, contiguous, closed and final under the B1 cutoff;
- policy is scoped to the exact instrument and timeframe.

Only these B2-C event types create lifecycle candidates:
- INITIAL_BULLISH_BREAK
- INITIAL_BEARISH_BREAK
- BULLISH_BOS
- BEARISH_BOS
- BULLISH_CHOCH
- BEARISH_CHOCH

Sweeps, ambiguous breaks and diagnostic events do not start a retest lifecycle.

## 3. Stable lifecycle identity

- The lifecycle key is derived from the immutable B2-C `event_id`, not the B2-D `zone_id`.
- B2-D zone IDs are membership-derived and may change when cluster membership changes. B2-E must never treat them as persistent lifecycle identifiers.
- A matching B2-D zone may be attached as contextual evidence by finding the event's `source_pivot_id` in the zone's `pivot_ids`.
- If more than one eligible zone claims the same source pivot, the lifecycle is BLOCKED as ambiguous.
- Zone context is metadata only in v1. The retest boundary is the broken B2-C pivot price, not the zone's outer edge. This prevents a cluster from silently changing the meaning of an already emitted B2-C event.

## 4. Retest policy

Policy fields:
- `version`: required non-empty identifier;
- `instrument_symbol` and `timeframe`: exact scope;
- `retest_tolerance_price`: positive absolute price distance, explicitly calibrated per instrument/timeframe;
- `max_retest_bars`: integer from 1 to 1000, counting closed candles strictly after the breaking candle;
- `finality_safety_lag_ms`: exact B1 finality lag.

No implicit ATR, percentage, tick-size or dollar tolerance is allowed in v1. A missing or mismatched policy blocks the engine. Absolute tolerance is a temporary explicit contract, not a claim that one value works for BTC and ETH or all timeframes.

For a break level (L) and tolerance (d), the retest band is:
[
[L-d, L+d]
]

A subsequent closed candle touches the band iff its range intersects the band:
[
low le L+d quad land quad high ge L-d
]

The breaking candle itself is never a retest candle. Only candles whose close boundary is strictly later than the breaking candle close can be evaluated.

## 5. Lifecycle states and transitions

Each qualifying B2-C break event receives one lifecycle record.

### States
- `AWAITING_RETEST`
- `RETEST_TOUCHED`
- `SUCCESSFUL_RETEST`
- `FAILED_BREAKOUT`
- `EXPIRED`

### Bullish lifecycle
- Starts at `AWAITING_RETEST` after the B2-C event becomes available.
- A later candle whose range intersects the retest band moves it to `RETEST_TOUCHED`.
- A later candle close strictly above (L), after a retest touch, moves it to `SUCCESSFUL_RETEST`.
- A candle close strictly below (L), before or after a retest touch, moves it to `FAILED_BREAKOUT`.
- A close exactly at (L) is neutral and cannot confirm success or failure.
- If neither success nor failure occurs within `max_retest_bars`, it moves to `EXPIRED`.

### Bearish lifecycle
The exact inverse:
- retest touch uses the same range-intersection rule;
- a later close strictly below (L) after touch confirms `SUCCESSFUL_RETEST`;
- a close strictly above (L) marks `FAILED_BREAKOUT`;
- equality is neutral;
- unresolved lifecycle expires at the configured bar limit.

### Same-candle rule
The first retest-touch candle cannot also confirm a successful retest. It only changes the state to `RETEST_TOUCHED`. A later closed candle must confirm the hold. This removes hindsight ambiguity.

### Ordering
For every closed candle, process existing lifecycles in deterministic order:
1. break event availability time;
2. event ID lexicographically as tie-breaker.
A lifecycle may transition at most once per candle. Terminal states do not transition again.

## 6. Causality and event history

- A lifecycle cannot start before its B2-C break event `available_at_ms`.
- A retest candle must be strictly later than the break candle.
- Only closed candles that passed the B1 finality lag are considered.
- Every lifecycle transition records source break event ID, source pivot ID, break level, transition candle, transition close, confirmation time and availability time.
- Lifecycle history is append-only. Later candles add transitions; they never rewrite prior events or timestamps.
- A later state change in B2-C does not retroactively erase an already emitted B2-E lifecycle event. Any invalidation is represented by a new explicit event in a later increment, not by mutation.

## 7. B2-D zone context

B2-D zones are optional contextual metadata:
- match by exact `source_pivot_id` membership in `zone.pivot_ids`;
- store zone role, bounds, touch count, last-touch age and contributing pivot IDs as captured in the current snapshot;
- do not use `zone_id` as lifecycle identity;
- do not infer freshness or active status from B2-D because B2-D v1 deliberately reports freshness as NOT_CLASSIFIED;
- do not move the retest boundary from the B2-C pivot level to zone bounds.

If no confirmed zone contains the pivot, the lifecycle still operates on the explicit pivot-level retest band and labels zone context as unavailable.

## 8. Output contract

Return:
- B1/B2 version identities and exact snapshot ID;
- policy version and scoped tolerance/window;
- admission status and blocking reasons;
- one lifecycle record per qualifying B2-C break event;
- current state and append-only transition history;
- pivot-level retest band;
- optional snapshot-local B2-D zone context;
- diagnostics: number of qualifying breaks, touched retests, successes, failures, expiries and unresolved records.

No probability, confidence percentage, LONG/SHORT recommendation, position sizing, SL/TP or order parameters.

## 9. Mandatory deterministic test matrix

1. No lifecycle before break event availability.
2. Breaking candle cannot be counted as a retest.
3. Bullish and bearish retest-band intersection symmetry.
4. Wick/range touch followed by later close on the breakout side succeeds.
5. First touch candle cannot self-confirm success.
6. Close exactly at level is neutral.
7. Close through level before touch is failed breakout.
8. Close through level after touch is failed breakout.
9. No touch by exact bar-window boundary expires.
10. Touch on the last allowed bar is processed before expiry.
11. Duplicate B2-C event IDs are rejected.
12. Multiple events on one candle are processed deterministically.
13. Missing source pivot or mismatched pivot price blocks admission.
14. Mismatched B1/B2 snapshot, symbol, timeframe or cutoff blocks admission.
15. Invalid/stale/insufficient B1 report blocks all lifecycle output.
16. Forming and unknown-finality candles never affect retest state.
17. Candle gap/order/finality defects fail closed.
18. Zone membership is attached by pivot ID, not price proximity alone.
19. B2-D zone ID changes do not change B2-E lifecycle identity.
20. Multiple matching zones are ambiguous and fail closed.
21. Missing zone context falls back to the pivot-level retest band.
22. Prefix replay preserves every lifecycle transition already available at the earlier cutoff.
23. Repeated evaluation is deterministic and does not mutate inputs.
24. Terminal lifecycle states never transition again.

## 10. Explicit non-goals

B2-E v1 does not implement:
- zone breakout confirmation beyond the B2-C pivot break;
- retest of the full B2-D zone outer boundary;
- support/resistance role reversal;
- multi-timeframe confluence;
- volume, order-flow or candle-pattern scoring;
- confidence/probability or strategy ranking;
- trade entry/exit recommendations.

Those require separate evidence contracts and review.

## 11. Release gates

This is a research specification only. Implementation may be developed as an isolated candidate for deterministic review, but it cannot be integrated into the application or used for directional decisions until:
- B1 is formally accepted;
- B2-A/B/C/D exact source commits are reviewed and accepted;
- B2-E tests and independent exact-source review pass;
- the owner explicitly approves integration.

**Current status:** B2-E design drafted. No production integration authorized.
