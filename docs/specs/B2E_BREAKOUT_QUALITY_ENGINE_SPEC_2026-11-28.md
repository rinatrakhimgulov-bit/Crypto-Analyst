# B2-E Breakout Quality Engine v1.0.0

## Purpose

Annotate existing B2-E breakout/retest lifecycles with measurable candle evidence. This is a quality-context layer, not a second breakout detector. It does not alter B2-C structural break events or B2-E retest lifecycle statuses.

## Evidence measured

For each matched B2-E lifecycle:
- ATR before the breakout candle, using only earlier closed candles.
- Breakout candle range divided by prior ATR.
- Breakout body-to-range ratio.
- Direction-aware close location within the candle.
- Breakout volume divided by the mean volume of the prior lookback candles.
- Close distance beyond the historical zone boundary in price and ATR units.
- Existing B2-E retest status, reported separately from breakout-candle quality.

## Quality labels

- \`STRONG_EVIDENCE\`: at least three available evidence flags are positive.
- \`MIXED_EVIDENCE\`: exactly two available evidence flags are positive.
- \`WEAK_EVIDENCE\`: at least three flags are available and no more than one is positive.
- \`PARTIAL_EVIDENCE\`: fewer than three flags can be evaluated.

Evidence flags: volume expansion, range expansion, directional body, and close quality. Missing volume or insufficient pre-break history is represented as unavailable, never silently converted to zero.

These labels are evidence summaries, not probabilities or guarantees. Thresholds are initial engineering defaults and require historical calibration.

## Anti-lookahead contract

ATR and volume baseline use candles strictly before the breakout candle. The breakout candle itself is used only for its range, body and close location. No candle after the breakout contributes to the quality label. Every breakout candle is bound to exact B2-E lifecycle timestamps and historical-zone role/bounds.

## Initial policy

- ATR period: 14.
- Volume lookback: 20.
- Volume expansion ratio: 1.5.
- Range expansion: 1.2 ATR.
- Directional body/range minimum: 0.5.
- Close-location threshold: 0.7 (mirrored for bearish breaks).

These defaults are not calibrated. Historical prefix replay and sensitivity analysis are mandatory before decision-path use.

## Non-goals

- No replacement of B2-C BOS/CHOCH or B2-E retest lifecycle.
- No automatic LONG/SHORT/WAIT changes.
- No UI integration or auto-trading.
- No profitability or predictive-probability claims.
