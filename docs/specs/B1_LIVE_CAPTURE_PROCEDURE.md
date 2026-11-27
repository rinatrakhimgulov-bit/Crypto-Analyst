# B1 live Bybit capture procedure

## Purpose

Collect real, concurrent Bybit V5 Linear kline responses for 1D/4H/1H so the B1-E common-cutoff policy can be calibrated from measured provider-time spread rather than a guessed constant.

## Tool

Download `tools/b1_live_probe.html` from the repository and serve it from a local HTTP origin. Do not open it directly as `file://`: browsers may treat that as an opaque origin and block cross-origin Bybit requests. The GitHub `blob` source-code page is not the running diagnostic page. The page is read-only and does not change the Crypto Analyst application or place orders.

## Recommended capture

- Symbol: BTCUSDT (repeat separately for ETHUSDT after the first capture).
- Samples: 30.
- Delay: 3000 ms.
- Raw rows per interval: 200.
- Each sample sends 1D, 4H and 1H requests concurrently.
- The probe tries `api.bybit.com` first and `api.bytick.com` if a request fails.
- Each raw response, provider timestamp, request start, response receive time, host, row count and error is retained locally in the exported JSON.

## Procedure

1. Download `tools/b1_live_probe.html` from the PR branch. Do not try to run the GitHub `blob` source-code view.
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
- Whether the captured raw rows are sufficient to replay the actual `BybitAdapter.normalize()` and `MTFDataEngine.assemble()` path at a common cutoff.

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
- Capture schema is now `crypto-analyst-b1-live-capture-v2`. Preserve the schema field when sharing the JSON cassette.
