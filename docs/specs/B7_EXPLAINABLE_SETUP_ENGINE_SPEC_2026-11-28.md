# B7 Explainable Setup Engine Specification
Date: 2026-11-28
Status: Approved for implementation
Base: B6 candidate branch `feature/b6-analytics-audit-2026-11-28`

## 1. Purpose

Build a small deterministic setup-candidate layer on top of validated B1 data and B2 market-structure evidence. B7 identifies recognizable market situations and explains the evidence. It does not issue a trade instruction, calculate leverage, place orders, or claim a probability of success.

B7 outputs are research candidates for later B8 statistical evaluation and B9 decision integration.

## 2. Hard boundaries

- B7 may consume only B1-VALID, causally available, closed-candle snapshots and B2-A/B/C/D/E outputs that match the same snapshot, symbol, timeframe and analysis cutoff.
- Forming candles may be displayed as context but cannot confirm a setup.
- B2-F MTF confluence is optional context only. It is not a hard directional gate until live provider-time spread is calibrated.
- B7 must not modify B1/B2 results or existing LONG/SHORT/WAIT decisions.
- No confidence percentage, win probability, expected profit, leverage, entry order, SL/TP or auto-trading.
- Every candidate carries evidence references, policy versions, available-at time and blocking/invalidation conditions.
- All thresholds are explicit, versioned policy parameters. No hidden magic numbers.

## 3. Setup types

### 3.1 BREAKOUT_RETEST

Direction follows the original B2-C breakout.

Required:
- Valid B2-C breakout event with an available-at timestamp no later than the analysis cutoff.
- Matching B2-E lifecycle linked to that event and its historical zone.
- Lifecycle status `RETEST_SUCCESSFUL`, confirmation outcome `SUCCESS`, and confirmation available-at no later than the cutoff.
- The retest confirmation must use closed-candle evidence.

Output:
- Direction, breakout event ID/type, historical zone ID/role, touch candle, confirmation candle/close, available-at timestamp, proposed role transition, and invalidation boundary derived from the B2-E failure buffer.

Pending retests may be shown as `PENDING`, but are not confirmed setups and must not be presented as an actionable signal.

### 3.2 FALSE_BREAKOUT_RECLAIM

Direction is opposite the failed breakout.

Required:
- Valid B2-C breakout event and linked B2-E lifecycle.
- Lifecycle status `RETEST_FAILED` with confirmation outcome `FAILURE`.
- Failure confirmation closes beyond the opposite historical-zone boundary plus the declared failure buffer.
- Failure candle is closed and its available-at timestamp is no later than the cutoff.

Output:
- Original breakout direction, resulting opposite candidate direction, breakout event ID, historical zone ID, failure candle/close, available-at timestamp, and the boundary that invalidates the reclaim candidate.

A mere wick through a level or a close back inside the zone without crossing the failure boundary is not enough for a confirmed false-breakout candidate.

### 3.3 TREND_CONTINUATION_AFTER_CORRECTION

Direction follows the current B2-C structure state.

Required for LONG:
- B2-C structure state `UP` and a valid protected swing-low level.
- A B2-D support zone intersects the latest closed candle's range.
- A short correction is visible in the preceding closed candles.
- The latest closed candle shows bullish rejection (hammer-style lower wick) or bullish engulfing under the versioned candle-feature policy.
- The close remains above the protected swing-low invalidation level.

Required for SHORT is the exact mirror:
- Structure state `DOWN`, protected swing-high, resistance-zone intersection, preceding upward correction, bearish rejection or bearish engulfing, and close below protected high.

Volume ratio versus the previous 20 closed candles is recorded as supporting context. It is not a hard gate in B7 because the threshold is not calibrated yet.

Output:
- Structure state/protected level, matched zone ID, correction evidence, candle features, volume ratio when available, latest closed-candle close, and available-at timestamp.

If candle or volume history is insufficient, the feature is `UNAVAILABLE`; it must not be inferred.

## 4. Candle and volume evidence

For each closed candle, compute deterministic, explainable features:
- body size and body/range ratio;
- upper and lower wick size and ratios;
- close location within candle range;
- bullish/bearish engulfing;
- hammer-style lower-wick rejection;
- shooting-star-style upper-wick rejection;
- doji;
- volume ratio against the mean of the preceding 20 closed candles, excluding the current candle from the baseline.

Zero-range candles and insufficient volume history return explicit unavailable states. Candle patterns are evidence labels, not standalone trade signals.

## 5. Output contract

Top-level output:
- engine/policy version;
- status `VALID` or `BLOCKED`;
- snapshot ID, symbol, timeframe, analysis cutoff;
- ordered setup candidates;
- diagnostics and admission reasons.

Each candidate:
- stable deterministic ID;
- `setup_type`: one of the three types above;
- `direction`: LONG or SHORT;
- `status`: CONFIRMED, PENDING, EXPIRED or BLOCKED;
- `available_at_ms`;
- evidence references to B2 event/zone/candle IDs;
- concise reason codes and human-readable explanation;
- optional invalidation boundary;
- candle/volume feature snapshot when relevant.

No candidate means `NO_SETUP`; it does not mean the market is bearish or bullish.

## 6. Causality and duplicate prevention

- Only events and candles with `available_at_ms <= analysis_as_of_ms` may be consumed.
- Confirmation must be based on a closed candle; forming-candle values are never used.
- B2-E lifecycles are linked by stable breakout event and historical zone IDs.
- The same lifecycle must not emit duplicate candidates across repeated refreshes.
- A later candle may create a follow-up state, but cannot rewrite the original candidate evidence.
- Prefix replay must prove that adding future candles does not alter previously available candidates.

## 7. Integration

- B7 runs after B2-A/B/C/D/E validation and before chart projection presentation.
- It is rendered as a separate `Market Setups` evidence panel.
- The current LONG/SHORT/WAIT engine remains unchanged.
- B5 journal snapshots should preserve B7 candidate output, but B7 must not write to the journal automatically.
- B9 may later consume B7 outputs only after B8 validation.

## 8. Tests

- One positive and multiple negative fixtures for each setup type.
- B2 snapshot/policy mismatch blocks.
- B1 non-VALID or stale data blocks.
- B2-E failure/confirmation linkage and direction inversion for false breakout.
- Trend continuation requires structure, protected level, zone touch, correction and candle evidence together.
- Forming candle cannot confirm any setup.
- No future available-at timestamp can enter output.
- Prefix replay invariance and deterministic IDs.
- Duplicate lifecycle does not duplicate a setup.
- Missing volume history produces unavailable context, not fabricated values.
- Existing B1/B2 tests and source/inline parity remain green.

## 9. Acceptance gate

B7 is complete when all three setup types are explainable, causal, deterministic, covered by negative tests, visible in the app without changing current decisions, and validated on pinned historical replay. It is not a trading-signal release; B8/B9 remain separate.
