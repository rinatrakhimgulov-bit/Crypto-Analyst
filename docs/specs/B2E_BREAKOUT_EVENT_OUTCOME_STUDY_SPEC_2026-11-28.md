# B2-E breakout event outcome study v1

**Date:** 2026-11-28  
**Status:** research-only event study; no trading decision integration  
**Branch:** `feature/b2e-breakout-event-outcomes-2026-11-28`

## Purpose

Evaluate whether B2-E breakout-quality evidence labels (STRONG / MIXED / WEAK / PARTIAL) are associated with different causal forward candle outcomes. This is not a strategy backtest and does not assume that a breakout is tradable.

## Data and sampling

- Pinned archive: `mestoness/btc-eth-candles-history`, commit `9ca04178df06ce649f00779a49e11094fe5b1c70`.
- BTCUSDT and ETHUSDT on 1h, 4h and 1d.
- 260-candle analysis windows; breakout-quality lookback 160 candles.
- Sampling stride: 80 bars (1h), 20 bars (4h), 3 bars (1d), approximately 3.3 calendar days.
- Breakout events are deduplicated by stable `breakout_event_id` within each symbol/timeframe series.

## Causal event availability and entry

A breakout may be discovered by the sampled replay after its original breakout candle. The event's study availability is therefore the first sampled analysis cutoff at which the event is actually observed, not the breakout candle close. The outcome evaluator enters at the close of the first candle whose finality availability is strictly later than that first-observation cutoff.

This avoids crediting the study with information before the event was observed. It also means the study measures delayed sampled detection, not the app's real-time latency.

## Outcomes

For each unique event, evaluate directional close return, MFE and MAE over 1, 3, 6 and 12 bars after the causal entry proxy. Summaries are grouped by the quality status at first observation and direction.

Retest status is recorded as a lifecycle observation and may progress between snapshots. It is not used to assign the breakout's initial quality group.

No stop/target barrier is supplied because the current breakout quality output does not provide an independently validated invalidation level for this event study.

## Stability diagnostics

The replay records:
- quality-status changes for the same breakout event across later snapshots;
- historical zone-boundary changes for the same event;
- retest lifecycle status progression;
- repeated observations versus unique event count.

This matters because the existing research harness derives the B2-D zone-span amount from the median price of each 260-candle window. The same historical breakout can therefore be reconstructed with slightly different zone boundaries in later snapshots. The event study uses the first observation for the outcome cohort and reports later boundary changes rather than hiding them.

## Limitations

- Archive ends 2025-12-05; no 2026 data.
- B1 quality wrapper is synthetic VALID; candle finality uses fixed 500ms time-derived lag.
- OHLCV bar outcomes are not executable fills.
- No fees, funding, slippage, stop/target fills, net return, expectancy, drawdown or account PnL.
- Events are correlated by symbol, timeframe and nearby dates; raw positive rates are descriptive, not independent-trial probabilities.
- This does not prove predictive edge or authorize LONG/SHORT/WAIT integration.
