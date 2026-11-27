# OrderFlow live test from GitHub Codespaces

This test harness is isolated on branch `diagnostics/orderflow-cloud-probe-2026-11-27`.
It does not edit the Crypto Analyst application, `main`, or any existing PR.

## What it tests

- Starts the public OrderFlow Analysis Pro source at pinned commit `b2ff4ee9dcdf5adff8d7f73e875d23558f136611`.
- Runs only BTCUSDT and explicitly selects Bybit. The candidate defaults to MT5 and its normal instrument list contains many symbols that are not Bybit perpetuals; the runner avoids both traps without editing the candidate source.
- Captures real Bybit publicTrade ticks, exchange timestamps, local receive timestamps, trade IDs, and the CandleBuilder's current OHLCV state.
- Every five seconds, samples Bybit REST ticker fields (last/mark/index), Bybit 1-minute klines, and the candidate's latest closed/forming candles.
- Serves the candidate dashboard on port 8080 for visual inspection on the iPhone.
- Writes raw logs and a comparison report under `orderflow-cloud-test-output/`.

No API key, account login, order placement, or trading permission is used. The forwarded port is private by default. Dependency installation and the candidate process both run with a clean environment and temporary HOME, so third-party build/runtime code is not given the Codespaces GitHub token or your normal GitHub CLI credentials.

## Start it

1. Open this exact branch in GitHub Codespaces and create the environment:
   `https://codespaces.new/rinatrakhimgulov-bit/Crypto-Analyst/tree/diagnostics/orderflow-cloud-probe-2026-11-27`
2. Wait until the browser editor and terminal are ready.
3. In the terminal, run:

   ```bash
   bash tools/orderflow-cloud-test/start.sh
   ```

4. GitHub Codespaces should forward port 8080. Open the private forwarded URL from the **Ports** panel on the iPhone. Keep the Codespace running while viewing the dashboard.
5. Leave it running for at least 5 minutes. The test runner logs the feed continuously.
6. Stop the runner with Ctrl+C in the terminal.
7. Generate the summary and evidence ZIP:

   ```bash
   python tools/orderflow-cloud-test/analyze.py
   ```

The report prints in the terminal. Raw data is saved in `orderflow-cloud-test-output/`, and `orderflow-cloud-test-evidence.zip` is created in the repository root so it can be downloaded from the Codespaces file explorer.

## What counts as a successful test

A successful process start is not sufficient. We need all of these:

- WebSocket connection and subscription acknowledgement are visible in logs.
- Incoming publicTrade events continue for BTCUSDT.
- Local receive age and event-time ordering are measurable.
- REST ticker and kline requests succeed.
- Candidate 1m closed candles can be compared with Bybit's matching 1m candle.
- The browser dashboard shows a changing last price and a forming candle.
- The chart does not visually jump backwards or erase live movement during its periodic refresh.

If Codespaces cannot reach Bybit, the output must say so. No synthetic data is substituted and no live-test claim is made.

## Known test boundaries

This is a live diagnostic of the candidate's BTCUSDT Bybit feed and 1-minute CandleBuilder. The dashboard can display higher timeframes by aggregating its closed 1-minute history, but the candidate does not receive exchange-native 5m/15m/1h candles in this setup. Visual animation and iPhone Safari behavior must be observed in the forwarded browser session; the Python log alone cannot prove rendering behavior.
