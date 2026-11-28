# B2-E retest forward-outcome evaluation — 2026-11-28

## Question

After a B2-E lifecycle reaches a terminal state, does price continue in the original breakout direction or reverse?

## Method

- Six series: BTCUSDT and ETHUSDT, 1H / 4H / 1D.
- 260 closed candles per sampled snapshot, approximately 14-day stride.
- Zone width: 0.15 ATR at the breakout candle close; retest touch/success/failure buffers: 0.05 ATR at the same event-time cutoff.
- The absolute price thresholds are frozen per breakout event and are not recalculated from later snapshot ATR.
- Each discovered breakout is replayed with its own frozen event-time policy before its terminal lifecycle status is accepted.
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

## Critical consistency issue and correction

The first snapshot-based replay recorded 247 duplicate-status conflicts. The cause was that zone width and retest buffers were recalculated from ATR at each sampled snapshot cutoff. A single historical breakout could therefore be classified under different thresholds as volatility changed.

The event-time replay now:
- calculates ATR through the breakout candle close;
- freezes zone-span and retest buffers as absolute prices for that breakout;
- rebuilds the historical zone/retest lifecycle with those frozen thresholds;
- records the breakout ATR, frozen thresholds, policy version, and exact terminal resolution timestamp;
- keeps later candles strictly in the post-resolution outcome window.

The replay must be accepted only if duplicate event status/time conflicts are zero. Missing event-specific replays are counted separately and cannot silently be treated as valid outcomes.

## Interpretation and limits

- These are post-resolution outcome summaries, not live prediction probabilities.
- Event-time thresholds are now frozen per breakout. A zero duplicate-conflict count is a required acceptance condition for this replay version.
- The archive ends 2025-12-05 and excludes 2026.
- Sampling is sparse and forward windows overlap.
- Daily and unresolved groups are small.
- No entries, exits, fees, funding, slippage, PnL, expectancy or drawdown are evaluated.

## Decision

Do not integrate retest states into LONG/SHORT/WAIT yet. The event-time policy correction is implemented in the research replay branch. Accept this research stage only after GitHub Actions confirms the replay completes, all duplicate status/time conflicts are zero, and no event-policy replay failures remain. A denser, out-of-sample replay and actual trade simulation remain separate future validation stages.
