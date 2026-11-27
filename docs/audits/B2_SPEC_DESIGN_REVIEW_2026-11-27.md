# B2 Market Structure Specification — Design Review

**Date:** 2026-11-27  
**Reviewed document:** `docs/specs/B2_MARKET_STRUCTURE_ENGINE_SPEC_2026-11-27.md`  
**Review type:** internal design review; not an independent external audit  
**Status:** implementation blockers identified; no application code changed

## 1. Executive result

The B2 specification has the correct architecture: provider-neutral validated input, closed candles only, causal pivot confirmation, explicit event timestamps, a pure engine, and staged implementation. It is not yet precise enough to implement safely.

The document intentionally leaves several rules open for implementation-time definition. That is acceptable during research, but it is not acceptable as the final implementation contract. Those rules affect where pivots appear, when structure changes, and whether BOS/CHoCH can repaint. They must be frozen before B2-A/B2-C code is written.

**Decision:** retain the current specification as the design baseline. Do not start production implementation or connect B2 to LONG/SHORT. Resolve the blockers below first. B1 acceptance remains a hard prerequisite for live-data integration.

## 2. Blocking ambiguities

### B2-R1 — Plateau and equal-pivot policy

The spec proposes the rightmost candle in a flat/equal-price plateau as the representative, but does not define the exact plateau boundaries or how right-strength confirmation is counted.

Required resolution:
- identify the contiguous equal-price plateau;
- select exactly one deterministic representative (proposed: rightmost candle);
- require the configured right-strength number of fully closed candles after the plateau ends, not merely after its first candle;
- preserve plateau start/end indices and the representative pivot index;
- ensure the pivot is unavailable before the confirmation candle closes.

Tests: plateau shorter than rightStrength, plateau longer than rightStrength, plateau at the end of history, equal highs separated by a lower high, and mirror cases for lows.

### B2-R2 — Same-side pivot replacement

The spec suggests retaining the more extreme pivot for structural sequencing while preserving all raw pivots, but does not specify when a pivot becomes superseded or whether a less-extreme later pivot can ever be retained.

Proposed v1 rule:
- retain every confirmed pivot as immutable raw evidence;
- for the alternating structural sequence, if consecutive same-type pivots occur before an opposite-type pivot, keep the more extreme one as the active sequence pivot (higher high for highs, lower low for lows);
- mark the other as `SUPERSEDED_FOR_SEQUENCE`, never delete it;
- equal/within-tolerance pivots follow the explicit plateau/equality policy and cannot arbitrarily replace each other.

This is a sequence rule only; it must not rewrite earlier event history.

### B2-R3 — Protected swing selection

This is the most important unresolved item. The spec correctly prohibits ad-hoc selection but does not yet provide an executable definition.

Proposed v1 state rule:
- On an initial bullish break or bullish CHoCH, protected low is the latest accepted confirmed swing low available before the transition.
- In an established uptrend, only a newly confirmed `HL` occurring after the last bullish transition may advance protected low. A `LL` does not lower it.
- Bearish behavior is symmetric: protected high initializes from the latest accepted confirmed swing high; only a post-transition `LH` may advance it; `HH` does not raise it.
- A protected level is tested only by a later closed candle. A pivot confirmed on the same candle is processed after break evaluation and cannot protect or invalidate that candle.

The implementation must expose protected-level provenance: pivot ID, pivot time, confirmation time, and the transition that activated it.

### B2-R4 — Initial trend and event naming

The spec distinguishes BOS/CHoCH but does not fully define the state before a trend is established.

Required resolution:
- initial close above a confirmed swing high: `INITIAL_BULLISH_BREAK`, state becomes UP;
- initial close below a confirmed swing low: `INITIAL_BEARISH_BREAK`, state becomes DOWN;
- only subsequent continuation breaks are BOS;
- a break of the protected opposing level is CHoCH;
- do not relabel an initial break as BOS retroactively.

### B2-R5 — Break buffer and equality boundary

The spec requires an instrument-aware buffer but B1 does not yet guarantee that tick-size metadata is part of every accepted snapshot.

Proposed v1:
- use zero absolute buffer initially;
- bullish break requires `close > level`; bearish break requires `close < level`;
- `close === level` is not a break;
- record `buffer_policy=ZERO_V1` in every result;
- add tick-size-aware buffers only in a separately versioned policy after market metadata is validated.

Do not insert an arbitrary percentage or ATR fraction in v1.

### B2-R6 — Break evaluation order and event lifecycle

Required deterministic order for each closed candle:
1. Evaluate breaks against levels already available before this candle.
2. Emit at most one accepted directional transition for the candle; if state/levels are internally contradictory, emit an ambiguity/blocked reason.
3. Consume the broken level exactly once.
4. Confirm pivots whose right-side confirmation completes on this candle.
5. Update swing sequence and eligible protected levels for subsequent candles.

A wick-only penetration emits sweep evidence, not BOS/CHoCH. A gap-through is tagged when the candle opens beyond the level and closes beyond it. Repeated closes beyond an already consumed level do not emit duplicate events.

### B2-R7 — Support/resistance and retest policy

These features are too underspecified for implementation:
- zone clustering distance and whether it is absolute, tick-size based, or volatility normalized;
- minimum number of independent pivots;
- touch deduplication (one candle must not count as multiple touches);
- zone invalidation and support/resistance role reversal;
- retest distance, expiry window, and close-based success/failure.

Recommendation: keep zones (B2-D) and retests (B2-E) out of the first causal swing/BOS implementation. Define and test them only after B2-A/B2-C are stable. Never add a visual strength score that resembles a probability.

## 3. Required causal invariants

These are release-blocking properties, not optional test extras:

1. **Prefix invariance:** for every prefix ending at T, output through T is identical to the same prefix of a full-history run.
2. **Batch/online equivalence:** incremental one-candle processing equals a batch replay of the same closed candles.
3. **Availability-time correctness:** a pivot's availability is no earlier than the close of its required right-side confirmation candle(s).
4. **No same-candle hindsight:** a pivot confirmed on candle T cannot be used to classify a break on candle T.
5. **Immutable event history:** later data may append events or update current state, but cannot rewrite past event types, timestamps, or source pivot IDs.
6. **Forming-candle isolation:** changes to ticker or forming OHLCV do not affect B2 output.
7. **Quality fail-closed:** non-VALID or identity-mismatched input returns no current structural conclusion and cannot reuse prior directional state as current.

## 4. Recommended implementation order after B1 acceptance

1. **B2-A:** input admission + causal pivots + plateau policy + availability timestamps.
2. **B2-B:** immutable raw pivots + deterministic alternating sequence + HH/HL/LH/LL/EQH/EQL.
3. **B2-C:** explicit state machine + protected swings + initial breaks/BOS/CHoCH + wick sweeps.
4. Independent source review and prefix/online tests.
5. Only then B2-D zones, B2-E breakout/retest lifecycle, and B2-F chart integration.

Keep each increment in a separate reviewable commit. Do not bundle zones, retests, chart drawing, and decision scoring into the first implementation.

## 5. B1 dependency status

The current B1 candidate branches and PRs remain unmerged. Automated deterministic tests are useful but do not replace:
- independent review of the exact current candidate blob;
- real Bybit 1D/4H/1H captures with measured provider-time spread and a documented fail-closed policy;
- real iPhone/Safari validation of the live stream lifecycle;
- explicit owner acceptance.

The user's latest iPhone diagnostic text confirms a fresh WS lastPrice event and that the ticker-to-forming-candle update handler returned UPDATED. It does not by itself establish the full B1 acceptance gates above.

## 6. Final decision

- B2 design review: **completed with blockers**.
- B2 production implementation: **not started**.
- B2 live-data or directional integration: **blocked by B1 acceptance**.
- Application code and `main`: **unchanged**.

This review is a design-hardening artifact, not evidence that Market Structure Engine exists or that the application can yet identify profitable market structure.
