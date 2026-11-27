# B1 live Bybit capture procedure

## Purpose

Collect real, concurrent Bybit V5 Linear kline responses for 1D/4H/1H so the B1-E common-cutoff policy can be calibrated from measured provider-time spread rather than a guessed constant.

## Tool

Download `tools/b1_live_probe.html` from the repository to the device that will run the capture, then open the downloaded `.html` file in a full browser (Chrome or Safari). The GitHub `blob` source-code page is not the running diagnostic page. If GitHub displays the source, use its Raw/download option or download the repository archive and extract the file. It is a standalone read-only page and does not change the Crypto Analyst application or place orders.

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
2. Open the downloaded HTML file in a full Chrome or Safari browser. If the browser only displays source text or refuses local HTML execution, use a desktop browser rather than treating that as a failed Bybit test.
3. Keep the page in the foreground until capture completes.
4. Select BTCUSDT and run the recommended 30-sample capture.
5. Export the JSON file. Do not edit the file.
6. Repeat for ETHUSDT as a separate capture.
7. Bring both JSON files back into the project review.

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
