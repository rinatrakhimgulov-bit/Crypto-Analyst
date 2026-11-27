# B2 Market Structure Engine — Technical Specification

**Date:** 2026-11-27  
**Status:** Design baseline; implementation is gated on formal B1 acceptance.  
**Working branch:** `integration/b1-mtf-architecture-2026-11-27`  
**Scope:** Deterministic, explainable market-structure analysis for the existing Bybit linear-futures prototype.

## 1. Purpose and non-goals

B2 converts validated closed-candle data into causal market-structure evidence. It must answer:

- Where are confirmed swing highs and lows?
- Is the sequence of swings making higher highs/higher lows, lower highs/lower lows, or equal levels?
- Has a confirmed structure level been broken by a closed candle?
- Is that break continuation (BOS) or a possible change of character (CHoCH)?
- Which support/resistance zones are supported by confirmed swing evidence?
- Has a break been retested, rejected, or invalidated?

B2 is an analytical evidence engine, not an automatic trading strategy. It does not place orders and does not independently emit a final LONG/SHORT recommendation. Until a separately validated scenario engine exists, the application-level decision remains WAIT or a human interpretation of displayed evidence.

Out of scope for the first B2 release:
- candlestick-pattern catalogues;
- news, macro, order-flow or funding-based signals;
- automatic entries, leverage, position sizing or order placement;
- claims of profitability or calibrated probability;
- use of forming candles in directional structure calculations;
- connecting the not-yet-accepted B1 MTF assembler to directional decisions.

## 2. Inputs and admission contract

The engine must consume a provider-neutral, versioned B1 canonical snapshot, never raw Bybit payloads and never UI chart arrays.

Required input:
- instrument identity and market identity;
- one selected timeframe;
- canonical ordered candle series;
- explicit closed-candle boundary and analysis as-of timestamp;
- B1 quality report and its policy/contract identity;
- snapshot identity and provenance.

Admission is fail-closed:
- Only a snapshot whose exact identity matches its quality report may be analyzed.
- Only B1 status VALID is admissible for directional structure events.
- STALE, INVALID, INSUFFICIENT, DEGRADED, missing, mismatched or unassessed input produces a blocked result with explicit reasons; it must not reuse prior BOS/CHoCH or directional conclusions as if current.
- Forming and pending-finality candles are excluded from every B2 calculation.
- The engine must verify candle ordering and closed-only boundaries rather than trusting a UI-provided array.

The first implementation should operate on one timeframe per invocation. B2 must not invent a common cutoff by combining independent timeframe snapshots. MTF synthesis is a later consumer of B1's accepted synchronized output.

## 3. Causality and event time

Every derived object must distinguish:

- `sourceTime`: open time of the candle where the visual pivot/level originates;
- `confirmedAt`: close time of the last candle required to confirm the object;
- `availableAt`: earliest analysis timestamp at which the engine is allowed to use it;
- `analysisAsOf`: cutoff of the snapshot being analyzed.

For a pivot at candle index `i` using right strength `R`, it cannot be emitted until the `R` candles to its right have closed. Its visual anchor may be drawn at `i`, but its metadata and tooltip must expose `confirmedAt`/ `availableAt`.

A replay at time T may consume only objects with `availableAt <= T`. No later candle, later-confirmed pivot, or retrospectively revised label may influence an earlier replay result.

The engine must be deterministic: same canonical input, same policy version and same as-of time produce byte-equivalent normalized output (excluding explicitly non-deterministic diagnostics, which should not exist in the pure engine).

## 4. Swing pivot detection

### 4.1 Initial algorithm

Use a configurable symmetric left/right pivot window:
- `leftStrength`: number of preceding closed candles required;
- `rightStrength`: number of following closed candles required.

A pivot high is a local maximum under the configured comparison and tie policy. A pivot low is the corresponding local minimum. The initial candidate policy may use a small symmetric window (for example 2/2) for research fixtures, but the production default must be frozen only after replay inspection across BTCUSDT and ETHUSDT on 1H/4H/1D. The policy is versioned and recorded with every result.

### 4.2 Equal highs/lows and plateaus

Tie handling must be explicit and tested. A flat/equal-price plateau must not create multiple duplicate pivots from the same plateau. The policy must choose a deterministic representative candle (initial candidate: rightmost candle in the plateau), while preserving the plateau's full source range in metadata if useful.

Near-equal prices are not silently treated as exact equals. They use a versioned price-comparison tolerance policy. That policy must be instrument-aware where tick size is available and must not be an unversioned magic constant. If the required precision metadata is missing, the result must expose the fallback/tolerance used.

### 4.3 Pivot lifecycle

A pivot transitions through:
- candidate (internal only; not available to consumers);
- confirmed (right-side closed bars satisfied);
- superseded/filtered only under an explicit deterministic rule.

Do not rewrite a confirmed pivot because later candles make it look less important. Any later filtering or clustering is a separate derived object and must retain the original pivot evidence.

### 4.4 Minimum history

If the input does not contain enough closed candles for the configured left/right window and downstream warm-up, return INSUFFICIENT with required/received counts. Never fabricate a pivot at the beginning or end of the available series.

## 5. Swing sequence and structure labels

After pivot confirmation, build an ordered sequence of alternating swing highs and lows using a documented same-side replacement rule.

For each new confirmed high, compare it with the preceding accepted confirmed high:
- HH: materially higher than the prior high under the configured tolerance;
- LH: materially lower;
- EQH: within the equality tolerance.

For each new confirmed low:
- HL: materially higher than the prior low;
- LL: materially lower;
- EQL: within the equality tolerance.

The output must retain the compared pivot IDs, price delta, normalized delta and tolerance used. Labels are evidence, not trade signals.

If two same-direction pivots arrive before an opposite pivot, the engine must apply one deterministic rule (initial candidate: retain the more extreme pivot for structural sequencing while preserving both raw confirmed pivots in the evidence list). This rule must be tested for highs and lows symmetrically.

## 6. BOS and CHoCH events

BOS/CHoCH must be evaluated only against structure levels that were confirmed and available before the breaking candle closed.

Initial event definitions:
- **Bullish BOS:** a closed candle confirms a break above the currently relevant confirmed swing-high level while the established structure context is bullish.
- **Bearish BOS:** a closed candle confirms a break below the currently relevant confirmed swing-low level while the established structure context is bearish.
- **Bullish CHoCH:** a closed candle confirms a break above the protected opposing swing-high level while the prior established context was bearish.
- **Bearish CHoCH:** a closed candle confirms a break below the protected opposing swing-low level while the prior established context was bullish.

The protected-swing selection rule must be specified in code and fixtures before implementation; it must not be inferred ad hoc from whichever pivot makes a chart look persuasive.

A break is not confirmed by an intrabar wick alone. The initial policy requires a candle close beyond the level plus an explicit configurable break buffer. The buffer policy must be versioned and instrument-aware; if unavailable, the engine must not silently substitute an arbitrary value.

Each event records:
- event type and direction;
- broken level and source pivot ID;
- breaking candle timestamp and close;
- confirmation/availability time;
- prior structure context;
- confirmation method and buffer;
- invalidation or follow-through state, if later established.

A single candle must not create duplicate events for the same level. Re-crossings and repeated closes require a documented event lifecycle.

## 7. Support/resistance zones

Zones are derived from confirmed pivot evidence, not hand-drawn chart coordinates or arbitrary fixed-dollar bands.

The first zone builder should:
- cluster compatible confirmed pivot prices using a versioned tolerance policy;
- preserve every contributing pivot ID and touch timestamp;
- distinguish support/resistance role by context without pretending a level is immutable;
- expose lower/upper bounds, representative price, touch count, first/last touch and freshness;
- avoid merging unrelated price regions merely because a broad tolerance overlaps them.

Zone strength must not be represented as a probability. If a ranking is shown, it must be a transparent deterministic evidence summary (for example touch count, recency and reaction magnitude), with each component visible and tested.

A broken support zone may later act as resistance, and vice versa, but role reversal is a separate event/state transition requiring a confirmed close and must retain its prior role history.

## 8. Breakout, retest and failed-breakout evidence

These classifications are downstream of confirmed BOS/CHoCH and zone evidence. They are not inferred from a single candle shape.

- Breakout: confirmed close beyond a known level/zone under the break policy.
- Retest: subsequent price returns to the broken level/zone within a versioned distance and time window.
- Successful retest: retest is followed by a confirmed close that holds the new side of the level.
- Failed breakout: price returns through the level and closes back inside/through it under an explicit invalidation rule.

Every state transition must be timestamped and replayable. Until the retest rules are independently tested, the UI must label the result as provisional evidence rather than a validated setup.

## 9. Output contract

The pure engine returns a versioned result containing:
- input snapshot ID, quality report ID/version, instrument, timeframe and analysis-as-of;
- algorithm/policy version and effective parameters;
- admission status and blocking reasons;
- confirmed pivots with source and availability times;
- swing sequence and HH/HL/LH/LL/EQH/EQL labels;
- BOS/CHoCH events;
- support/resistance zones and contributing pivot IDs;
- breakout/retest/failure lifecycle events when enabled;
- diagnostics such as history shortfall and tolerance policy used.

No confidence percentage, profitability claim, LONG/SHORT signal or order parameters are part of the B2 contract.

The engine must be pure and must not:
- fetch network data;
- read the system clock implicitly;
- mutate input snapshots;
- access or modify the DOM;
- draw directly on the chart;
- depend on provider-specific payload fields.

The UI consumes the normalized output and renders it. Chart rendering must not recalculate pivots, labels or events.

## 10. Implementation sequence

B2 is divided into independently testable increments:

### B2-A — Causal swing engine
- B1 input admission;
- pivot high/low detection;
- plateau/equality policy;
- confirmedAt/availableAt metadata;
- deterministic pivot lifecycle;
- no-lookahead replay tests.

### B2-B — Swing structure
- alternating sequence;
- same-side replacement;
- HH/HL/LH/LL/EQH/EQL labels;
- comparison metadata and boundary tests.

### B2-C — BOS/CHoCH
- protected swing selection;
- closed-candle break confirmation;
- break buffer policy;
- duplicate/re-cross/invalidation lifecycle;
- replay and no-future-leakage tests.

### B2-D — Support/resistance zones
- pivot clustering;
- zone boundaries and evidence;
- touch/freshness metrics;
- role reversal history.

### B2-E — Breakout/retest/failure
- event state machine;
- retest windows and distance policy;
- successful/failed retest confirmation;
- deterministic replay.

### B2-F — Chart integration
- render only engine output;
- pivot markers anchored at source candles with confirmation metadata;
- structure labels and BOS/CHoCH annotations;
- S/R zones and event markers;
- mobile Safari layout, visibility and performance checks.

Do not combine all increments into one large patch. Each increment must be reviewed, tested and integrated end-to-end before the next begins.

## 11. Mandatory test matrix

At minimum:

1. Pivot confirmation delay: a pivot is absent until all right-side candles are closed.
2. No future leakage: appending future candles cannot change outputs that were already available at an earlier as-of time.
3. Forming candle isolation: changing a forming candle does not change any B2 result.
4. Plateau tie policy: equal adjacent highs/lows produce exactly the documented representative.
5. Equal-price tolerance: just below, exactly at and just above tolerance.
6. Same-side pivot replacement: higher-high/lower-low sequences and duplicate candidates.
7. Alternation and ordering: malformed or duplicate timestamps are blocked upstream or rejected.
8. Missing bars: no synthetic candles or false confirmation across gaps.
9. Insufficient history: exact boundary counts.
10. HH/HL/LH/LL/EQH/EQL: all directional and equality cases.
11. BOS/CHoCH: wick-only break does not confirm; close beyond buffer does; close exactly on boundary follows documented rule.
12. Protected swing selection: bullish and bearish symmetry.
13. Duplicate/re-cross behavior: no duplicate event spam.
14. Zone clustering: distinct levels do not merge; same level evidence clusters deterministically.
15. Zone role reversal: support/resistance transition retains history.
16. Retest lifecycle: success, failure, expiry and incomplete retest.
17. Input quality gate: INVALID/STALE/INSUFFICIENT/DEGRADED/mismatched report blocks analysis and cannot preserve old directional events.
18. Determinism: identical input and policy produce identical output.
19. Multi-timeframe isolation: no accidental use of unaccepted/unsynchronized MTF results.
20. Chart alignment: source candle anchor and later confirmation timestamp both remain correct.
21. Mobile: no chart overflow, labels remain legible, overlays do not make candle interaction unusable.

## 12. Release gates

An increment is not accepted merely because its tests pass. Acceptance requires:
- exact source blob/commit identity;
- deterministic tests and recorded fixtures;
- independent review of the exact candidate;
- no-lookahead evidence;
- browser verification for integration changes;
- iPhone Safari verification for visible chart changes;
- documented limitations and explicit owner acceptance.

B2 implementation may begin only after B1's outstanding gates are closed and the owner explicitly accepts the B1 candidate. The B2 specification can be prepared and reviewed in advance; this document does not authorize bypassing B1 release gates.

## 13. Current dependency and risk register

| Risk | Control |
|---|---|
| Pivots appear historically before they were knowable | Store sourceTime separately from confirmedAt/availableAt; replay as-of tests |
| Equal highs/lows create duplicate or unstable structure | Versioned tie and tolerance policy; plateau fixtures |
| BOS/CHoCH labels are subjective | Explicit protected-swing and close-confirmation definitions |
| Zones merge unrelated prices | Versioned instrument-aware clustering tolerance; preserve source pivots |
| UI and engine disagree | Pure engine output is the sole source for annotations |
| Stale or mismatched input creates convincing false structure | Exact B1 identity/quality admission; fail closed |
| MTF mixes timeframes from different moments | Keep B2 single-timeframe until B1 MTF is accepted and calibrated |
| Historical labels repaint | Immutable confirmed events; later state changes are appended, not retroactively rewritten |

## 14. Definition of done for B2

B2 is complete only when all B2-A through B2-F increments are accepted, the engine is reproducible from versioned inputs and policies, historical replay shows no lookahead, and the UI presents the evidence and its confirmation timing without implying guaranteed trade outcomes.

**Current status:** Specification drafted. No B2 production code has been added. B1 remains a prerequisite for implementation and merge.


---

## 15. Frozen implementation policy — v1 (2026-11-27)

This section resolves the implementation ambiguities identified in the B2 design review. It applies only to the first causal swing/structure/BOS increments. It does **not** waive the B1 acceptance gate.

### 15.1 Price equality and pivot comparison

- v1 uses `EXACT_PRICE_V1`: equality means numerically identical canonical prices after parsing the provider's decimal representation. No implicit percentage, ATR, or dollar tolerance is permitted.
- A value that differs by even one representable price unit is not equal under this policy. Instrument tick-size-aware tolerance is deferred until tick-size metadata is part of the accepted canonical contract.
- The policy ID and comparison values must be present in every result. Missing/invalid price values reject the input; the engine must not guess a tolerance.

### 15.2 Plateau pivot detection

- A plateau is a maximal contiguous run of candles whose candidate high (for pivot highs) or low (for pivot lows) is exactly equal under `EXACT_PRICE_V1`.
- The representative is the **rightmost candle** in that contiguous run. The raw pivot retains plateau start/end timestamps and indices.
- A pivot-high plateau is valid only when its price is strictly greater than every one of the `leftStrength` closed candles immediately preceding the plateau start and every one of the `rightStrength` closed candles immediately following the plateau end. Pivot lows use the strict inverse.
- Confirmation occurs only after all `rightStrength` candles following the **end** of the plateau have closed. `sourceTime` points to the representative candle; `confirmedAt` is the exclusive close boundary of the final required right-side candle. `availableAt` is `confirmedAt + finality_safety_lag_ms`, using the explicit B1 finality-safety-lag policy version supplied to the engine. A pivot is emitted only when `availableAt <= analysisAsOf`. This preserves B1's rule that a candle is not admitted as time-derived closed until the safety lag has elapsed.
- A plateau touching either edge of available history is not confirmed unless the full left and right windows exist. No partial-window pivot is emitted.

### 15.3 Raw pivots and alternating structural sequence

- Every confirmed raw pivot is immutable and retained in evidence.
- The structural sequence alternates high/low. If a second same-type pivot arrives before an opposite-type pivot, compare it with the current sequence pivot:
  - highs: retain the higher pivot;
  - lows: retain the lower pivot;
  - exact equality: retain the earlier pivot.
- A non-retained raw pivot is marked `SUPERSEDED_FOR_SEQUENCE`; it is not deleted and cannot retroactively alter an already emitted event.
- A pivot can enter the sequence only after its `availableAt`. The engine must not reorder pivots by source candle time in a way that makes a later-confirmed pivot appear available earlier.

### 15.4 Initial trend and structure state

The state machine starts at `UNESTABLISHED`.

- A closed candle strictly above the latest eligible confirmed swing-high level emits `INITIAL_BULLISH_BREAK` and moves state to `UP`.
- A closed candle strictly below the latest eligible confirmed swing-low level emits `INITIAL_BEARISH_BREAK` and moves state to `DOWN`.
- If the same candle qualifies for both directions because the input/levels are contradictory, emit a blocked `AMBIGUOUS_BREAK` diagnostic and do not choose a direction.
- Initial breaks are never relabeled as BOS after more history arrives.
- In `UP`, a close above a new eligible continuation swing-high level emits bullish BOS. In `DOWN`, a close below a new eligible continuation swing-low level emits bearish BOS.
- A close through the active protected opposing swing emits CHoCH and changes the state to the opposite direction.

### 15.5 Protected swing selection

- On transition into `UP`, initialize protected low from the latest accepted confirmed swing low whose `availableAt` is strictly earlier than the transition candle close. On transition into `DOWN`, initialize protected high symmetrically.
- While in `UP`, only an accepted `HL` confirmed after the last transition may advance protected low. An `LL` never lowers it. While in `DOWN`, only a post-transition `LH` may advance protected high; an `HH` never raises it.
- A pivot confirmed on candle T is processed **after** break evaluation for T. It cannot protect, invalidate, or trigger a break on T.
- Every protected level exposes its source pivot ID, source time, confirmation/availability time, and the transition that activated it.
- If no eligible protected swing exists, the engine must expose `PROTECTED_LEVEL_UNAVAILABLE`; it must not substitute a visually convenient pivot.

### 15.6 Break boundary, wick sweeps and event lifecycle

- v1 uses `ZERO_BUFFER_V1`: bullish break iff `close > level`; bearish break iff `close < level`. A close exactly equal to the level is not a break.
- Intrabar wick penetration without a qualifying close emits `SWEEP` evidence only; it is not BOS/CHoCH.
- If the candle opens beyond the level and closes beyond it, set `gapThrough=true`; the event remains close-confirmed and records the gap condition.
- Each source level can produce at most one initial/continuation break event. Once consumed, repeated closes beyond it do not create duplicate events.
- Re-crossing a consumed level may create a separate return/retest observation in a later increment, but cannot recreate the original break.
- Per-candle processing order is fixed:
  1. evaluate breaks/sweeps using levels available before this candle;
  2. emit at most one directional transition; contradictory candidates produce an ambiguity diagnostic;
  3. consume a broken level and update state/protected-level transition metadata;
  4. confirm pivots whose required right-side window ends on this candle;
  5. update the structural sequence and protected levels for subsequent candles.
- Event history is append-only. Later candles may add follow-through or invalidation events, but cannot rewrite the original event type, timestamp, level, or source pivot ID.

### 15.7 Scope boundary for v1

The first production implementation scope, after B1 acceptance, is limited to:
1. B2-A: validated input admission and causal raw pivot detection;
2. B2-B: immutable alternating sequence and swing labels;
3. B2-C: explicit structure state, protected swings, initial breaks, BOS/CHoCH and wick-sweep evidence.

B2-D zones, B2-E retest/failure lifecycle, and B2-F chart integration remain separate later increments. No zone clustering, touch score, retest window, confidence percentage, or trade recommendation may be smuggled into B2-A/B/C.

### 15.8 Additional mandatory regression properties

- Plateau confirmation uses the end of the plateau, not its first candle.
- Exact equality at a break level is not a break; one representable unit beyond is.
- Same-side replacement is symmetric for highs/lows and retains superseded raw evidence.
- A pivot confirmed on the same candle as a break cannot participate in that break.
- Initial breaks remain initial events in every longer-history replay.
- Consumed levels cannot emit duplicate BOS/CHoCH on repeated closes.
- A contradictory candle cannot arbitrarily choose bullish or bearish direction.
- Protected swing metadata always resolves to a pivot available before the transition that activated it.
