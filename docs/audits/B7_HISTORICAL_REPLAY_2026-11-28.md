# B7 Historical Replay Report
Date: 2026-11-28
Status: PASS — causal replay checks passed; no profitability evaluation
Branch: `feature/b7-setup-engine-2026-11-28`
PR: #27
CI run: `46115303655`
Dataset: `mestoness/btc-eth-candles-history`
Pinned dataset commit: `9ca04178df06ce649f00779a49e11094fe5b1c70`

## Scope

B7 was replayed on five 160-candle rolling windows for each of six symbol/timeframe series (BTCUSDT and ETHUSDT on 1h, 4h and 1d), for 30 windows total. Three historical prefix cutoffs were also run for each series, for 18 prefix runs. Every prefix run asserted deterministic repeatability and that all candidate and confirmation availability timestamps were at or before that prefix cutoff.

## Rolling-window results

| Symbol | Timeframe | Windows | Candidates | Confirmed | Pending | Breakout + retest | False breakout + reclaim |
|---|---:|---:|---:|---:|---:|---:|---:|
| BTCUSDT | 1h | 5 | 14 | 13 | 1 | 8 | 6 |
| BTCUSDT | 4h | 5 | 9 | 7 | 2 | 4 | 5 |
| BTCUSDT | 1d | 5 | 3 | 3 | 0 | 1 | 2 |
| ETHUSDT | 1h | 5 | 8 | 8 | 0 | 3 | 5 |
| ETHUSDT | 4h | 5 | 4 | 3 | 1 | 3 | 1 |
| ETHUSDT | 1d | 5 | 2 | 2 | 0 | 1 | 1 |
| **Total** | | **30** | **40** | **36** | **4** | **20** | **20** |

No trend-continuation-after-correction candidate occurred in these 30 historical windows. Its positive/negative logic is covered by deterministic synthetic unit tests, but its historical occurrence has not been demonstrated by this sample. Do not infer that the scenario is invalid or profitable from this result.

## CI gates

Run `46115303655` completed SUCCESS:
- B2-A/B/C/D/E/F/G and B7 source-to-production-inline parity.
- 22 deterministic B7 unit tests, including positive LONG/SHORT breakout-retest cases, direction-inverted false-breakout cases, pending lifecycle, cutoff/finality, quality gates, provenance, immutable/deterministic output and trend-continuation requirements.
- B2-A through B2-G regression tests.
- Historical B2+B7 replay, 30 rolling windows and 18 prefix-cutoff checks.
- Browser integration and mobile layout: B7 engine present, panel visible, B7 result VALID with zero candidates in the neutral browser fixture, no horizontal overflow at 390px viewport, no page errors.

## Limitations

This replay is not a backtest of a trading strategy:
- Historical CSV integrity is checked, but the actual B1 validator is not executed. A synthetic B1-VALID wrapper is used.
- Candle finality is time-derived with a fixed 500ms research lag; historical provider finality is not independently observed.
- Historical archive ends at 2025-12-05.
- No entry/exit simulation, fees, funding, slippage, trade outcomes, drawdown or expectancy is measured.
- The 40 detected candidates are event detections, not 40 winning trades or evidence of positive expectancy.
- B7 does not alter LONG/SHORT/WAIT. B8 statistical validation remains necessary before any B9 directional integration.

## Decision

B7 passes deterministic, provenance, parity, historical prefix-cutoff and browser/mobile integration gates for research use. Remaining acceptance is owner testing in iPhone Safari and independent review of live behavior. Do not merge PR #27 directly to `main` ahead of its B4/B5/B6 dependency chain.
