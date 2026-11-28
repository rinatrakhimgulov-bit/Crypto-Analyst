# B4 Main-source audit and first hardening patch — 2026-11-28

## Audited baseline

- Branch base: current `main` at PR base commit `fa73f857a0bbfeb1cb88ed6501069aa62e30dff2`.
- Canonical application: `CryptoAnalyst_StageA_S6_updated.html`.
- Audited HTML blob: `6b5521195454bc3d3be3e18cc7f4fb10682ee48b`.
- Source size: 511,597 bytes, 9,514 lines at audit time.

## Actual live-data architecture found in main

The current source already includes an integrated Bybit V5 Linear Perpetual WebSocket path; older handover/PR descriptions that call it LOG-ONLY or unmerged are stale.

- REST loads candle history and a REST ticker snapshot from the same selected host, with fallback from `api.bybit.com` to `api.bytick.com`.
- REST polling runs every 30 seconds; request generations and AbortController prevent superseded requests from rendering.
- WebSocket subscribes to `tickers.<symbol>` and `kline.<interval>.<symbol>`.
- Ticker messages are validated and only a valid `lastPrice` update refreshes the live-price freshness clock.
- Kline messages validate symbol/timeframe, timestamps, UTC alignment, OHLCV invariants and explicit `confirm`.
- Ticker updates the live price and can animate the forming candle without changing volume or the analytics closed-candle boundary.
- Kline updates use chart upsert rules; gaps, older/conflicting rows and invalid events request REST reconciliation.
- Provider confirmation schedules delayed REST reconciliation.
- The WS client includes subscribe ACK correlation, retries, heartbeat/watchdog, reconnect backoff, lifecycle resume and post-reconnect REST synchronization.
- The B1 quality validator is applied to REST snapshots before the existing analytics path. B2 remains display/research-only; B1 MTF is not enabled for directional decisions pending live provider-time spread calibration.

## Defect found

The chart used the REST `closedCount` index as the only criterion for whether the last candle was still forming. When a WebSocket kline arrived with `confirm: true`, the chart intentionally did not advance `closedCount` until REST reconciliation. During that gap:

1. `updateFormingCandleFromTicker()` could still change the just-confirmed candle's close/high/low.
2. A later same-timestamp kline delta could still replace the confirmed candle because upsert only checked the REST index boundary.
3. Rendering still styled that provider-confirmed candle as forming until REST caught up.

This violated the explicit closed-candle immutability requirement.

## Patch in B4 PR #24

- `updateFormingCandleFromTicker()` now refuses to mutate a candle whose provider `confirmed` flag is true.
- `upsertLiveCandle()` treats an exact repeat of a confirmed payload as a harmless duplicate and rejects any changed same-timestamp payload as `closed-candle`, which uses the existing REST reconciliation path.
- Candle and volume rendering now treat `confirmed: true` as closed even before REST advances the analytical boundary.
- Stage A B1-D regression now covers ticker-after-confirm, late same-candle delta and exact confirmed duplicate.

## Remaining B4 work / acceptance

This patch is the first B4 hardening increment, not B4 completion.

- Run deterministic and browser CI on the exact final PR head.
- Continue source audit for reconnect/resubscribe, REST/WS races, stale/fallback state, symbol/timeframe switches, background/foreground lifecycle and candle gap recovery.
- Add targeted regressions for every confirmed defect.
- Verify actual Bybit ticker and kline stream on iPhone/Safari, including forming-candle movement, confirmed-candle immutability, disconnect/reconnect, REST fallback and symbol/timeframe switches.
- GitHub Actions HTTP 403 from Bybit is a provider-blocked environment result, not a live Bybit pass or evidence of provider unavailability.
- Do not connect MTF to directional decisions until provider-time spread is measured and calibrated.
- Do not merge B4 until code, deterministic/browser CI, independent review of the exact source and owner iPhone acceptance are complete.

No trading execution, exchange credentials or auto-trading were introduced.


## Additional REST/WS race found and fixed in the same B4 branch

A 30-second REST refresh replaces the entire chart candle array. The existing code reapplied only the latest WS ticker price after this replacement; it did not replay the newer validated WS kline. Therefore high/low/volume information from the latest WS kline could be lost or snap back to an older REST candle.

The B4 branch now keeps the latest accepted kline event with its provider event time, local receive time and connection generation. After REST renders, it replays that kline only when the active kline topic is confirmed, the same connection generation is still open, the event is fresh, and its provider event time is newer than the REST snapshot's provider server time. It then applies the latest ticker lastPrice. Older WS kline events cannot overwrite a newer REST snapshot. Symbol/timeframe reset clears the cache.

The Stage A B1-D regression now also checks replay of newer WS OHLCV after an older REST replacement and refusal to replay a WS event older than REST provider time. Exact-head CI is still required; no live Bybit or iPhone acceptance is claimed.


## Cross-topic ordering hardening

Ticker and kline are separate WebSocket topics, so arrival order is not guaranteed to match provider event time. The branch now compares their provider timestamps: an older ticker cannot overwrite a newer kline state; when an older kline arrives after a newer ticker, cumulative OHLCV is still accepted but the forming candle close is restored to the newer ticker price. Confirmed candles remain immutable. Regression coverage exercises both orderings.


## Event-order hardening and B4 branch CI — 2026-11-28

The next review found that ticker and kline topics can be observed at different event timestamps. The bridge now keeps the forming candle monotonic with respect to provider event time:

- An older same-candle kline event is discarded before it can roll back accepted OHLCV.
- If a kline arrives after a newer ticker, cumulative kline high/low/volume can still be applied, then the newer ticker close is restored to the forming candle.
- If a ticker arrives after a newer kline, the older ticker event is discarded rather than rolling back the forming close or live price.
- Regression coverage exercises both delivery orders and same-candle event-time rollback.

The B1 and B2 workflow push filters now include `feature/b4-live-data-hardening-2026-11-28`, so subsequent commits to this branch run both verification workflows rather than depending only on pull-request event delivery. Exact-head workflow results must be checked before merge.


## Verification checkpoint — PR head 42f0511679167714e2a35c873ae0fc970502923c

- B1 browser/live-data workflow run 46102775403: SUCCESS; browser/self-test completed with no page errors.
- B2 application integration workflow run 46102775296: SUCCESS; B2-A…B2-G suites and mobile browser integration passed; no horizontal overflow; no page errors.
- Live Bybit REST check: SKIPPED_PROVIDER_BLOCKED because both public REST hosts returned HTTP 403 to the GitHub Actions runner. This is not a live Bybit pass and not evidence that the user's iPhone cannot connect.
- The tested PR merge ref includes exact branch head 42f0511679167714e2a35c873ae0fc970502923c.
- PR #24 remains open and unmerged. B4 still requires remaining reconnect/fallback/lifecycle audit, independent review and real iPhone/Safari acceptance.


## Final B4 hardening details

- REST replay is fail-closed when the REST snapshot has no provider server time; without comparable provider timestamps, a cached WS kline is not replayed over REST.
- When a REST provider timestamp catches up to or passes the cached WS kline event time, the cache is discarded rather than retained for a future replay.
- A ticker older than the latest current-generation kline event is not considered fresh for the price label or forming candle. If the ticker timestamp is missing while a newer kline timestamp exists, it is rejected for the same reason.
- Same-candle kline event-time ordering is scoped to the same WebSocket connection generation, so a reconnect does not compare a new session's provider event time against a stale prior-session cache.


## Exact-head verification checkpoint — 2026-11-28

- Current tested application source blob: `c9711ffdd65c9667bfa7447b92ec05d73e60135f` in commit `01068b47736e9e1d9a206ae919accd8a6cea7255` (PR #24).
- B1 browser/live-data workflow run `46103008965`: SUCCESS. Stage A 50/50, B1 contract 32/32, B1 quality 72/72, B1 MTF 20/20; browser page errors 0.
- B2 application integration workflow run `46103008967`: SUCCESS. B2-A through B2-G and browser/mobile integration all completed successfully.
- Live Bybit REST verification was `SKIPPED_PROVIDER_BLOCKED`: GitHub Actions runner received HTTP 403 from both `api.bybit.com` and `api.bytick.com`. This is not a live Bybit pass and does not prove that the user's iPhone is blocked.
- Current remaining acceptance: real Bybit WebSocket + REST behavior on iPhone/Safari, including live lastPrice, forming-candle OHLCV, closed-candle immutability, REST reconciliation, disconnect/reconnect, stale fallback, BTC/ETH and 1H/4H/1D switching, background/foreground recovery.
- PR #24 remains open and unmerged. Do not merge before owner iPhone/Safari acceptance and exact-source review.


## Lifecycle regression added — 2026-11-28

A deterministic Stage A regression (`16d`) now exercises the actual registered `pagehide` and `pageshow` listeners: `pagehide` invalidates the old connection generation, clears confirmed topics and closes the active socket; `pageshow` creates a fresh WebSocket generation, begins recovery, and requires fresh topic ACKs before subscriptions are considered confirmed. This closes a test-coverage gap in the previously implemented lifecycle handlers. It does not replace real Safari/iPhone background-resume acceptance.