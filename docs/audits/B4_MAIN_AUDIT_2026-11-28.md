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
