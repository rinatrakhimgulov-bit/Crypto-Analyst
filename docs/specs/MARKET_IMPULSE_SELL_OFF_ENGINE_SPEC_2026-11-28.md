# Market Impulse / Selloff Engine v1.0.0

## Purpose

Classify a recent closed-candle sequence as a directional impulse, with a stricter label for a strong bearish selloff. It is separate from the Market Regime Engine's broad market-state classification.

## Measurements

- Net displacement across the configured closed-candle window, normalized by ATR measured strictly before the window.
- Average true range expansion across the window, relative to the pre-window ATR.
- Directional pressure: share of window candles that close in the direction of displacement and near the relevant candle extreme.
- Recent window volume divided by the mean volume of the prior lookback.
- Existing bearish B2-E breakout/retest context, with distinct interpretations for a support retest that held as resistance versus a support reclaim.
- Optional exact-identity B2-D zone context.

## Classification

- \`STRONG_SELL_OFF\`: bearish displacement threshold, directional pressure, range expansion and volume expansion all confirm.
- \`SELL_OFF_PARTIAL_EVIDENCE\`: the same structural evidence is present but volume is unavailable.
- \`BEARISH_IMPULSE\`: bearish displacement and directional pressure confirm, but the full strong-selloff evidence set does not.
- \`BULLISH_IMPULSE\`: symmetric bullish displacement and pressure.
- \`DIRECTIONAL_MOVE_UNCONFIRMED\`: displacement threshold reached without enough directional pressure.
- \`NO_IMPULSE\`: the configured impulse conditions are not met.

A selloff is not synonymous with a support break. B2-E retest status is reported as separate context:
- A successful bearish retest means the broken support held as resistance.
- A failed bearish retest means price reclaimed support and the breakdown was invalidated.

## Anti-lookahead

ATR and volume baselines use candles strictly before the event window. The event window itself is composed only of closed candles. No candle after the window affects the classification.

## Initial policy

- Window: 3 closed candles.
- ATR period: 14.
- Volume baseline: 20 prior candles.
- Impulse displacement: 1.2 ATR.
- Selloff displacement: 2.0 ATR.
- Average range expansion: 1.2 ATR.
- Volume expansion: 1.5x.
- Directional pressure: 2/3 of candles close directionally near their extremes.

These are engineering defaults, not calibrated thresholds. Historical replay and sensitivity analysis are required before decision-path use.

## Non-goals

- No replacement of Market Regime Engine, B2-C structural break events, B2-D zones or B2-E retest lifecycle.
- No automatic trading decisions, UI integration or autotrading.
- No profitability or probability claims.
