# B2-D Zone Context Engine v1.0.0

## Purpose

Add a read-only context layer over the existing B2-D support/resistance zones. It does not rebuild zones, alter B2-D membership, or change breakout admission. It answers four narrower questions:

1. How old is the latest confirmed touch, measured in bars?
2. Is the zone fresh, aging, or stale under an explicit versioned policy?
3. How far is the current closed price from the zone, normalized by ATR?
4. Which support and resistance zones are the nearest eligible active zones?

## Inputs and identity

- B1 canonical snapshot and matching VALID quality report.
- Existing B2-D result with exact snapshot, symbol, timeframe and cutoff identity.
- Explicit versioned policy.
- Closed candles only; no forming or unclassified candle is used.
- Only 1h, 4h and 1d are accepted.

The component fails closed on identity mismatch, invalid candle provenance, gaps, non-final candles, invalid zone evidence, insufficient ATR history, or invalid policy.

## Outputs

Each zone receives:
- \`age_bars\`: floor of elapsed time from the latest source-touch candle to the analysis cutoff, divided by timeframe duration.
- \`freshness_status\`: FRESH, AGING, or STALE using policy bar limits.
- \`relative_position\`: BELOW_CURRENT_PRICE, ABOVE_CURRENT_PRICE, or CONTAINS_CURRENT_PRICE.
- \`distance_price\` and \`distance_atr\`.
- \`is_active\`: non-stale and within the configured maximum ATR distance.
- \`evidence\`: raw touch count and accepted/superseded/ambiguous touch counts, plus recent touch count.

The selection summary returns the nearest active support below price, nearest active resistance above price, zones intersecting current price, and active zone IDs. No scalar strength score is produced: touch count and recency are evidence, not calibrated odds of a bounce.

## Initial policy

- ATR period: 14.
- Fresh: latest touch no more than 10 bars ago.
- Aging: latest touch no more than 20 bars ago.
- Stale: older than 20 bars.
- Active distance: at most 5 ATR from current close.

These are explicit engineering defaults, not calibrated market thresholds. Historical replay and sensitivity analysis are required before decision-path use.

## Non-goals

- No changes to existing B2-D zone clustering or B2-E breakout/retest contracts.
- No UI or LONG/SHORT/WAIT integration.
- No claims of predictive accuracy or profitability.
- No merging into main.
