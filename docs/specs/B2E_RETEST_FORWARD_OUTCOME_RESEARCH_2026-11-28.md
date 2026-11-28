# B2-E retest forward-outcome evaluation — 2026-11-28

## Question

After a B2-E lifecycle reaches a terminal state, does price continue in the original breakout direction or reverse?

## Method

- Six series: BTCUSDT and ETHUSDT, 1H / 4H / 1D.
- 260 closed candles per sampled snapshot, approximately 14-day stride.
- Zone width: 0.15 ATR; retest touch/success/failure buffers: 0.05 ATR.
- Evaluate only terminal states: RETEST_SUCCESSFUL, RETEST_FAILED, RETEST_EXPIRED and RETEST_UNRESOLVED.
- Outcome starts at the exact B2-E confirmation candle, retest-window expiry candle, or unresolved confirmation-window completion candle.
- Future candles are used only for post-resolution outcome metrics.
- Forward close return, favorable excursion and adverse excursion are normalized by ATR at the resolution cutoff.
- Both original breakout direction and reverse direction are measured.

## Preliminary aggregate result

2,633 unique lifecycles were evaluated:

| Retest state | Events | Median return in breakout direction at 5 bars | 10 bars | 20 bars |
|---|---:|---:|---:|---:|
| RETEST_SUCCESSFUL | 1,319 | -0.106 ATR | -0.100 ATR | -0.051 ATR |
| RETEST_FAILED | 928 | -0.088 ATR | -0.147 ATR | -0.078 ATR |
| RETEST_EXPIRED | 374 | -0.046 ATR | +0.025 ATR | +0.009 ATR |
| RETEST_UNRESOLVED | 12 | +0.721 ATR | +0.094 ATR | -0.678 ATR |

For RETEST_FAILED, reverse-direction median returns were +0.09 / +0.14 / +0.08 ATR at 5/10/20 bars. Positive-close rates were approximately 51–55%. This is weak evidence only. It does not establish a tradable reversal edge.

RETEST_SUCCESSFUL did not show strong continuation in the original breakout direction in this sample. RETEST_EXPIRED outcomes were close to flat. The unresolved group is too small to interpret.

## Critical consistency issue

The same breakout event can receive different terminal retest states or resolution timestamps in overlapping sampled windows. The replay recorded 247 duplicate-status conflicts.

The reason is architectural: the research runner derives zone span and retest buffers from ATR at each sampled snapshot cutoff. The same historical breakout can therefore be re-evaluated with different zone widths/buffers as volatility changes. The current snapshot-based policy does not guarantee a stable historical lifecycle label.

Before trusting lifecycle outcomes, the system must bind the policy inputs to the breakout event:
- store ATR at breakout time;
- store the exact zone bounds and policy version used for that event;
- store touch/success/failure buffers fixed from breakout-time ATR;
- never recalculate a historical event's policy from current ATR;
- preserve the exact confirmation candle and availability timestamp.

## Interpretation and limits

- These are post-resolution outcome summaries, not live prediction probabilities.
- The current ATR policy is snapshot-based, so duplicate-state conflicts make the aggregate terminal-state labels unstable.
- The archive ends 2025-12-05 and excludes 2026.
- Sampling is sparse and forward windows overlap.
- Daily and unresolved groups are small.
- No entries, exits, fees, funding, slippage, PnL, expectancy or drawdown are evaluated.

## Decision

Do not integrate retest states into LONG/SHORT/WAIT yet. First bind zone and retest policy to each breakout event and replay with stable event-time parameters. Then repeat denser historical and out-of-sample evaluation.
