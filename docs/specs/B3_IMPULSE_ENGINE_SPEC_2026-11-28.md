# B3 Impulse and Sell-off Engine v1.0.0

## Purpose
Classify the latest closed-candle window as a confirmed directional impulse, a stronger bearish sell-off, or no confirmed impulse. Assess a support breakdown separately and require matching strong B2-E breakout evidence before calling it confirmed.

## Inputs
- One canonical B1 snapshot and its exact B1 quality report.
- Explicit versioned policy.
- Optional B2-D zone-context output.
- Optional B2-E breakout-quality output.

## Measurements
- Net close-to-close displacement over the configured impulse window, normalized by ATR calculated strictly before that window.
- Aggregate high-low range divided by prior ATR.
- Mean volume in the impulse window divided by mean volume in the preceding baseline window.
- Signed candle-body sum divided by total candle range.
- Fraction of candles aligned with the net direction.

## Classification
- \`BEARISH_IMPULSE\` / \`BULLISH_IMPULSE\`: displacement, range expansion, volume, directional body and candle alignment all meet policy thresholds.
- \`BEARISH_SELL_OFF\`: confirmed bearish impulse plus higher displacement and volume thresholds.
- \`NO_CONFIRMED_IMPULSE\`: directional movement exists but all required evidence does not.
- \`NO_DIRECTIONAL_IMPULSE\`: net displacement is zero.
- \`UNKNOWN\`: blocked or insufficient data.

A sell-off is an observed downside impulse, not a prediction and not automatically a trade signal.

## Support breakdown
A close below an active, non-stale support zone is initially labelled \`SUPPORT_CLOSE_BELOW_UNVERIFIED\`. It becomes \`CONFIRMED_BREAKDOWN\` only when an exact matching B2-E bearish support-break lifecycle has \`STRONG_EVIDENCE\` from the breakout-quality engine. This does not itself confirm a successful retest or a short entry.

## Anti-lookahead and safety
- Only final closed candles are accepted.
- ATR is calculated from candles strictly before the impulse window.
- Volume baseline is taken strictly before the impulse window.
- No future candle is used.
- Exact B1 snapshot/report identity and cutoff are required.
- Gaps, provenance mismatches, invalid OHLCV, forming candles and invalid policy fail closed.

## Initial policy defaults
All thresholds are engineering defaults. They have not been calibrated against historical data and are not evidence of predictive edge or profitability. Historical replay, sensitivity analysis and out-of-sample evaluation are required before the engine can influence LONG/SHORT/WAIT.

## Non-goals
No production UI integration, no auto-trading, no entry/SL/TP recommendations, and no modification of existing B2-C/B2-D/B2-E engines.
