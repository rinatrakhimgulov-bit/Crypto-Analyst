# B2-E event-time ATR policy replay — 2026-11-28

## Purpose

Eliminate the snapshot-volatility drift found in the previous retest replay. Each historical breakout must retain the same zone width and retest buffers for its entire lifecycle, regardless of later volatility changes.

## Event-time policy

For each B2-C break event:
- ATR(14) is calculated using only candles strictly before the breakout candle.
- B2-D historical zone cluster span is fixed at 0.15 × ATR-before-break.
- B2-E touch tolerance, success buffer and failure buffer are fixed at 0.05 × ATR-before-break.
- The policy is stored in the research output with its event-specific price values.
- Up to 23 closed candles after the breakout are supplied only to resolve the retest lifecycle (20-bar retest window + 3-bar confirmation window).
- Forward outcome candles begin after the exact lifecycle resolution candle.

A dedicated B2-D zone policy version and B2-E retest policy version are used by the research adapter. The production engine and app are not changed in this PR.

## Replay coverage

- 8,091 unique B2-C break events discovered across six BTCUSDT/ETHUSDT series on 1H/4H/1D.
- 2,855 matched B2-D/B2-E lifecycle events evaluated:
  - RETEST_SUCCESSFUL: 1,401
  - RETEST_FAILED: 1,051
  - RETEST_EXPIRED: 401
  - RETEST_UNRESOLVED: 2
- Most unmatched events had no historical zone formed before the break. This is not automatically an engine defect; a structural break is not always a confirmed support/resistance-zone breakout.

## Preliminary post-resolution outcomes

Median direction-adjusted returns in the original breakout direction:

| State | 5 bars | 10 bars | 20 bars |
|---|---:|---:|---:|
| RETEST_SUCCESSFUL | -0.160 ATR | -0.106 ATR | -0.141 ATR |
| RETEST_FAILED | -0.079 ATR | -0.111 ATR | -0.081 ATR |
| RETEST_EXPIRED | -0.012 ATR | +0.049 ATR | +0.001 ATR |

For RETEST_FAILED, reverse-direction median returns were +0.079 / +0.111 / +0.081 ATR at 5/10/20 bars. Positive-close rates were around 51–53%. This is weak evidence only.

The event-time policy removes the snapshot-volatility drift observed in the earlier replay, but it does not create a strong continuation or reversal edge. The breakout quality labels also remain weak in the event-time replay: STRONG_EVIDENCE median direction-adjusted returns were -0.101 / -0.092 / -0.081 ATR at 5/10/20 bars.

## Interpretation

- RETEST_SUCCESSFUL is a structural role-transition confirmation, not a promise of immediate continuation.
- RETEST_FAILED is an invalidation/rejection state, but the measured reverse-direction effect is small.
- RETEST_EXPIRED is close to neutral in this sample.
- These lifecycle states must not be converted into LONG/SHORT probabilities or confidence percentages.

## Limitations

- Archive ends 2025-12-05 and excludes 2026.
- Discovery uses approximately 14-day-spaced snapshots; events between samples can be missed.
- Forward horizons overlap and are not independent observations.
- Daily samples are smaller than intraday samples.
- No entries, exits, fees, funding, slippage, PnL, expectancy or drawdown are evaluated.
- The adapter is research-only; no app HTML or decision path is changed.

## Next requirements

1. Refresh historical data through 2026.
2. Increase event discovery density.
3. Inspect representative successful/failed/expired events on actual charts.
4. Add confidence intervals and independent chronological holdout.
5. Only after validation, consider implementing event-time policy persistence in the production B2E engine.
