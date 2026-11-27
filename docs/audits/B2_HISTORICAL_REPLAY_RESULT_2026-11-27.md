# B2 Historical Replay Result — 2026-11-27

## Verdict

**The historical harness completed successfully on the clean integration PR head.** It demonstrates that the B2-A/B/C causal swing and structure engines can process the available BTCUSDT and ETHUSDT historical candle series, preserve the tested prefix-invariance property, and produce reproducible structure events. It does **not** establish predictive edge, profitability, or that the selected parameters adapt to current market regimes.

Run: [GitHub Actions 46035136810](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46035136810)  
Artifact: `b2_historical_replay_report.zip` (workflow artifact ID 15216436698)  
Candidate commit: `64135fd28ebb62f79575cdcd22d2d30e702f9122`.

## Data and method

- Archive: `mestoness/btc-eth-candles-history`, described by the archive as Bybit USDT-M perpetual candles.
- BTCUSDT: 1H 49,957 rows; 4H 12,489; 1D 2,081.
- ETHUSDT: 1H 41,447 rows; 4H 10,361; 1D 1,726.
- Coverage: BTC from 2020-03-25 through 2025-12-05; ETH from 2021-03-15 through 2025-12-05.
- All six series passed the harness integrity checks: zero invalid OHLCV rows, duplicates, gaps, or off-grid timestamps.
- B2-A/B/C were run over each full series. Pivot-strength sensitivity was also checked at strengths 3 and 5, in addition to the baseline 2.
- Prefix invariance was checked at 25%, 50%, and 75% of each series (18/18 checks across six series).
- B2-D/B2-E were exercised on five sampled 160-candle windows per symbol/timeframe, with a 12-point grid of zone-span and retest-tolerance parameters.
- A final synchronized 160-candle 1D/4H/1H window was built per symbol and passed through B2-F/B2-G.

## Full-series B2-A/B/C results

| Symbol | TF | Rows | Raw pivots | Active sequence | Ambiguous dual pivots | Structure events | Final structure |
|---|---:|---:|---:|---:|---:|---:|---|
| BTCUSDT | 1H | 49,957 | 14,212 | 10,902 | 674 | 8,110 | DOWN |
| BTCUSDT | 4H | 12,489 | 3,587 | 2,640 | 226 | 2,058 | UP |
| BTCUSDT | 1D | 2,081 | 576 | 424 | 40 | 334 | UP |
| ETHUSDT | 1H | 41,447 | 11,771 | 8,992 | 550 | 7,049 | DOWN |
| ETHUSDT | 4H | 10,361 | 2,922 | 2,187 | 166 | 1,718 | DOWN |
| ETHUSDT | 1D | 1,726 | 475 | 369 | 24 | 272 | UP |

All six full-series runs completed their three prefix-invariance checks. The output shows why a fixed single-timeframe direction is insufficient: the structure state differs by timeframe and by historical sampling window.

## B2-D/B2-E sampled-window findings

The 160-candle window tests produced nonzero support/resistance zones, breakouts and several retest lifecycle outcomes across both symbols and all three timeframes. The sampled windows show UP and DOWN states at different points in the archive; retests include successful, failed, expired, and waiting states.

This is a functional lifecycle exercise, **not** a win-rate study. The 12-point parameter grid is diagnostic only. It has not selected an optimal parameter set and does not establish that any threshold generalizes.

## Synchronized MTF result at the archive's final daily boundary

Both symbols produced the same structure alignment pattern:

- 1D: UP
- 4H: UP
- 1H: DOWN
- B2-F: `UP|UP|DOWN`, `MIXED`, `MIXED_STRUCTURE`

B2-G emitted the causal projection for the selected 1H chart. This is a useful confirmation that the modules can be composed and that disagreement between timeframes is represented rather than hidden.

**Important synthetic condition:** the harness creates the synchronized MTF wrapper with provider-time spread set to zero. This validates B2-F/B2-G behavior under a deterministic aligned fixture. It does not empirically calibrate real Bybit provider-time spread and cannot authorize production MTF decisions.

## Limitations and next work

1. Archive ends 2025-12-05. It does not cover the current 2026 market.
2. Archive licensing/redistribution terms have not been independently established.
3. B1 quality/provenance is represented by a synthetic B1-valid wrapper for this historical harness; the original archive is not being re-queried from Bybit.
4. Full-series statistics are reported for B2-A/B/C. B2-D/B2-E use five sampled 160-candle windows per series plus one synchronized final MTF window, not a complete full-history zone/retest replay.
5. No forward returns, entry/exit simulation, fees, slippage, expectancy, win rate, drawdown, or regime-adaptive model were tested.
6. No parameter is approved for trading use. Zone/retest thresholds remain exploratory.
7. Live Bybit provider-time calibration and iPhone Safari verification remain outstanding.

## Conclusion

The B2 algorithm is now integrated into the single-file app candidate and has passed deterministic tests, browser integration, and this historical structural replay. It is ready for owner visual testing as a **research/visualization layer**, not as a validated trading strategy. The adaptive pattern-discovery system described separately by the owner remains a later project and was not introduced into this stage.
