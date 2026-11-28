# Binance USD-M recent-history replay — 2026-11-28

## Purpose

Provide an independent, current-year futures-data validation sample after the Bybit public API returned HTTP 403 from the GitHub Actions region. The workflow does not attempt to bypass that restriction. It uses Binance's official public USD-M futures archive as a separate provider dataset.

## Source and packaging

- Provider: Binance USD-M Futures public archive at \`data.binance.vision\`.
- Market: USD-M futures, linear perpetual contracts BTCUSDT and ETHUSDT.
- Intervals: 1h, 4h, 1d.
- Archive packages: monthly ZIPs for completed months and daily ZIPs for the current month.
- Each ZIP is checked against its sibling \`.CHECKSUM\` SHA-256 file before parsing.
- The official archive documentation states that daily files become available the next day and monthly files on the first Monday of the month.

## Coverage

- Start: 2025-12-06 UTC.
- End: latest complete UTC candle available at workflow execution time.
- For the current month, daily packages are used through yesterday UTC. Forming candles are excluded using a 500ms safety lag against the runner clock.
- The exact per-series row counts, start/end times, file names and ZIP SHA-256 checksums are stored in the downloaded dataset artifact.

## Data mapping

USD-M futures kline CSV columns are mapped as:
- open time: column 0
- open/high/low/close: columns 1–4
- base volume: column 5
- quote asset volume: column 7

Timestamps are normalized to milliseconds. Canonical close time is represented as open time plus the interval duration.

## Replay

- 260 closed candles per rolling window.
- Approximately 14 calendar days between samples.
- The existing B2-A/B/C, B2-D, B2-E, Market Regime v1/v2, Zone Context, Breakout Quality and Market Impulse engines are run without changing LONG/SHORT/WAIT.
- Every sampled window checks zone availability, breakout finality and impulse cutoff.

## Important limitations

- This Binance sample is independent and is NOT concatenated with the older Bybit archive. Cross-provider price/volume differences remain explicit.
- B1 quality is a synthetic VALID research wrapper after archive checksum and OHLCV integrity checks.
- The sample is not every candle; short-lived events between snapshots may be missed.
- Classification counts are not predictive accuracy, trade PnL or profitability.
- Binance public archive files can be updated; per-file checksums and the raw dataset artifact preserve the exact inputs used for a given run.
