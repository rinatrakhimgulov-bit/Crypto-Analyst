# B1 live Bybit capture procedure

## Purpose

Collect real, concurrent Bybit V5 Linear kline responses for 1D/4H/1H so the B1-E common-cutoff policy can be calibrated from measured provider-time spread rather than a guessed constant.

## Tool

Use `tools/b1_live_probe.html` from the integration candidate branch and serve it from a local HTTP origin. Do not open it directly as `file://`: browsers may treat that as an opaque origin and block cross-origin Bybit requests. The GitHub `blob` source-code page is not the running diagnostic page. The page is read-only and does not change the Crypto Analyst application or place orders.

## Recommended capture

- Symbol: BTCUSDT (repeat separately for ETHUSDT after the first capture).
- Samples: 30.
- Delay: 3000 ms.
- Raw rows per interval: 200.
- Each sample sends 1D, 4H and 1H requests concurrently.
- The probe tries `api.bybit.com` first and `api.bytick.com` if a request fails.
- Each raw response, provider timestamp, request start, response receive time, host, row count and error is retained locally in the exported JSON.

## Procedure

1. Use `tools/b1_live_probe.html` from `integration/b1-mtf-architecture-2026-11-27`. Do not try to run the GitHub `blob` source-code view.
2. Put the file in a folder on a computer with Python installed. Open a terminal in that folder and run `python -m http.server 8000` (on some Windows installations use `py -m http.server 8000`).
3. In the same computer's Chrome or Safari, open `http://localhost:8000/b1_live_probe.html`. Keep the terminal/server running. This avoids the opaque `file://` origin, but successful Bybit requests still depend on the exchange's CORS response headers; the first short test confirms whether this browser origin is accepted.
4. Keep the page in the foreground until capture completes. Do not put the browser tab in the background during the run.
5. Select BTCUSDT and run the recommended 30-sample capture.
6. Export the JSON file. Do not edit the file.
7. Repeat for ETHUSDT as a separate capture.
8. Bring both JSON files back into the project review.

If you press Stop during the three concurrent requests, the in-flight sample is discarded because it is incomplete. All previously completed samples remain in the capture and can be exported. A failed/aborted partial sample is not included in the provider-time spread statistics.

## What will be measured

- Per-sample provider-time spread: `max(kline.time) - min(kline.time)`.
- Maximum, median and percentile distribution across successful samples.
- Request duration and receive-time spread, to distinguish provider clock spread from transport jitter.
- Host-specific failures, incomplete responses, and returned row counts.
- Whether the captured raw rows are sufficient to replay the actual `BybitAdapter.normalize()` and `B1MtfEngine.assemble()` path at a common cutoff.

## Safety and interpretation

- This is observational data only. It does not create LONG/SHORT signals.
- Do not use the observed maximum as the production threshold without a safety margin and a documented policy.
- A capture with failed or missing provider timestamps is not evidence for a valid spread.
- A 30-sample run is an initial measurement, not a proof of long-term exchange behavior.
- Keep MTF disconnected from directional decisions until recorded-response integration, spread policy, browser regression and forming-candle safety checks are complete.
- The page stores data in the browser only; it does not upload the capture. Exported JSON contains market data and timestamps, not API credentials.


## Capture utility safeguards (v2)

- Each host attempt has a 15-second timeout. A timed-out primary host is recorded and the backup host is attempted.
- A user Stop action aborts active requests and interrupts the inter-sample wait.
- `responseHeadersReceivedAtMs` records when response headers arrive; `responseReceivedAtMs` records when the complete response body has been read. `headersLatencyMs` and `totalDurationMs` are kept separately.
- Request start time is recorded separately for each host attempt, so a failed primary-host attempt does not inflate the successful backup-host latency.
- Capture schema is now `crypto-analyst-b1-live-capture-v3`. Provider timestamps are accepted only as positive safe-integer milliseconds. Failed host attempts also retain HTTP status and response-header/body timing where available. Preserve the schema field when sharing the JSON cassette.




## iPhone Safari using a Windows PC as the local host

The probe can be viewed and operated on the iPhone while the file is served by a Windows PC on the same Wi-Fi network:

1. Put the repository folder on the PC and open PowerShell in the repository root.
2. Start the server with `py -m http.server 8000 --bind 0.0.0.0` (or `python -m http.server 8000 --bind 0.0.0.0`). Keep the terminal open.
3. Run `ipconfig` and note the PC's IPv4 address for the active Wi-Fi/Ethernet adapter. Do not use `127.0.0.1` or `localhost` on the iPhone.
4. If Windows Firewall asks, allow Python on the private network. The iPhone and PC must be on the same non-guest Wi-Fi network.
5. On the iPhone, open Safari and visit `http://PC_IPV4:8000/tools/b1_live_probe.html`, replacing `PC_IPV4` with the address from step 3.
6. Run a short 5-sample BTCUSDT test first. If all three timeframes return provider timestamps, run the full 30-sample capture. Repeat for ETHUSDT.
7. Export the JSON. Safari should place the file in Downloads/Files; do not edit it before sharing it for analysis.

The local server only serves the static HTML page. The iPhone browser still sends public read-only requests directly to Bybit. This depends on Bybit CORS behavior and the network used by the phone. If the short test fails with a browser CORS/network error, that is not proof that the exchange REST API itself is unavailable. Do not bypass browser security or install certificates to force it.

The probe does not upload data to the repository or to ChatGPT. The user manually shares the exported JSON when ready. Keep Safari in the foreground and prevent the phone from locking during the capture.


## Completed capture results — 2026-11-27

The user completed and supplied two schema-v2 captures from iPhone Safari:
- BTCUSDT: 30/30 concurrent 1D/4H/1H samples, finished 2026-11-27T04:53:54.371Z.
- ETHUSDT: 30/30 concurrent 1D/4H/1H samples, finished 2026-11-27T04:58:52.740Z.

Per symbol, all 90 timeframe requests returned HTTP 200, Bybit retCode 0, 200 rows each, and no errors before success. Across both symbols: 180 successful timeframe responses and 36,000 raw candle rows. All successful requests used api.bybit.com; api.bytick.com fallback was not exercised.

Provider-time spread results:
- BTCUSDT: min 0 ms, median 1 ms, p95 6 ms, max 140 ms.
- ETHUSDT: min 0 ms, median 1 ms, p95 324 ms, max 325 ms.
- Combined 60 samples: min 0 ms, median 1 ms, p95 321 ms, max 325 ms; 7/60 samples exceeded 100 ms, 5/60 exceeded 250 ms, none exceeded 500 ms.

Request duration:
- BTCUSDT: median 419 ms, p95 537 ms, max 931 ms.
- ETHUSDT: median 485.5 ms, p95 891 ms, max 943 ms.

An independent offline check of the captured raw rows applied the common cutoff (minimum of the three provider timestamps) and the 500 ms finality lag. For all 60 samples × 3 timeframes, the last 160 closed candles were present, contiguous and correctly aligned; the latest closed candle matched the expected common-cutoff boundary. All 36,000 rows passed OHLCV sanity and timestamp-grid checks: zero violations.

**Interpretation:** a provisional `maxProviderTimeSpreadMs = 500` candidate would have admitted all 60 observed samples, leaving 175 ms above the observed maximum. This is evidence for a candidate test policy, not a production guarantee. The 500 ms candle-finality lag is a separate control and must not be treated as interchangeable with the provider-time spread threshold. The capture is one short session; repeat captures at different times/network conditions are still required before production calibration.

**Next validation:** replay selected recorded raw responses through the exact current `BybitAdapter`, `B1DataContract`, `B1QualityValidator` and `B1MtfEngine` path. The offline Python integrity check above is not a substitute for that exact-code replay.
