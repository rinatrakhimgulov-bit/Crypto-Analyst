# B2-D Zone Context policy sensitivity and forward outcome replay

## Purpose

Evaluate the existing B2-D Zone Context v1 freshness and active-distance defaults before changing them. This is a research-only policy sensitivity layer; it does not alter B2-D zone construction or the live app decision path.

## Current defaults

- Recent touch: 10 bars.
- Aging limit: 20 bars; older zones are STALE.
- Active distance: 5 ATR.
- Nearest active support and resistance are selected separately by distance, then touch count.

## Sensitivity variants

The Binance USD-M independent recent sample compares 11 variants:
- Aging horizon: 20, 40, 60, 100 bars.
- Recent-touch horizon: 10 or 20 bars.
- Maximum active distance: 5, 7.5 or 10 ATR.

All variants use the same raw B2-D zones and same 260-candle window. Only the read-only Zone Context policy changes.

## Forward outcome evaluation

For each nearest support/resistance selected at a historical cutoff:
- Observe the next 20 closed candles after the cutoff.
- A touch occurs when a future candle range intersects the zone.
- A break occurs when a close exceeds the far zone boundary by 0.25 ATR.
- A hold occurs when, within three bars of first touch, a close rejects away from the zone by 0.25 ATR and no later break occurs in the 20-bar horizon.
- Outcomes are NO_ZONE, CENSORED, NOT_TOUCHED, HELD, BROKEN or TESTED_UNRESOLVED.

Future candles are used only to score the selected zone retrospectively. They are not available to the zone engine at the cutoff and are not used to create or select the zone. This is not trade PnL.

## Interpretation rules

- Do not select the policy with the highest zone availability alone. More zones can mean more noise.
- Compare availability, distance, touch rate, resolved hold rate, and BROKEN counts separately for support and resistance.
- Keep the same policy across BTC/ETH and 1H/4H/1D unless an independently justified timeframe-specific policy is later validated.
- Overlapping windows can repeat the same zone and future outcome. Counts are window observations, not unique zone events.
- The sample uses 260-candle windows sampled about every 14 days. Short-lived events may be missed.
- No threshold is called calibrated or optimal from this one-year sample.

## Acceptance gate

Before changing B2-D Zone Context defaults:
1. Review the 11-variant sensitivity report.
2. Check consistency across symbols and timeframes.
3. Inspect false holds/breaks and censored outcomes.
4. Repeat on a second pinned period or independent data source.
5. Only then create a versioned B2-D Zone Context v2 candidate with its own tests and app integration review.
