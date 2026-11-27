# B1-D Live Market Data Integration

Date: 2026-11-27
Base: `integration/b1-mtf-architecture-2026-11-27`
Implementation branch: `feature/b1-d-live-market-data-2026-11-27`
Status: IMPLEMENTED — automated verification passed; live browser acceptance pending

## Goal

Promote the existing Bybit V5 public linear WebSocket client from connection-health/log-only mode to a validated live-data transport for the selected symbol and timeframe. The chart must update without waiting for the 30-second REST polling interval or manual refresh.

## Preserve

- Bybit remains the market-data provider.
- REST remains the authoritative bootstrap, history, reconciliation, and recovery path.
- Existing B1 canonical contract, quality validator, quality gate, and MTF engine are not bypassed or weakened.
- Existing WebSocket connection lifecycle, ping/pong accounting, reconnect, subscription acknowledgement, and stale-generation protections remain in place.
- Closed-candle analytics continue to be driven by REST snapshots that pass the existing B1 quality gate. An unconfirmed WebSocket candle must never enter LONG/SHORT analysis.
- No trading API keys, order placement, or automatic trading.

## Live data responsibilities

1. **Ticker stream**
   - Consume validated Bybit linear ticker snapshot/delta messages.
   - Display `lastPrice` as the live last-traded price.
   - Preserve ticker freshness metadata: provider event time, local receive time, connection generation, symbol, and sequence (`cs`, when supplied).
   - Never treat `markPrice` or `indexPrice` as `lastPrice`.
   - Reject malformed, out-of-order, duplicate, stale-generation, wrong-symbol, or pre-snapshot delta messages.

2. **Kline stream**
   - Consume validated messages for the currently selected timeframe only.
   - Validate topic symbol/interval, timestamps, OHLCV values, candle alignment, and OHLC invariants before chart mutation.
   - Upsert only the current candle or append exactly the next candle.
   - If a gap, conflicting duplicate, or unexpected older candle is detected, do not guess or silently patch history; request REST reconciliation.
   - Use `confirm` only as a provider finality event for scheduling REST reconciliation. It must not directly certify B1 analytics finality.

3. **Chart/UI**
   - Update live price label and horizontal price line from ticker events.
   - Update the forming candle from kline events.
   - Do not recompute indicators, support/resistance, or directional decisions on every ticker tick.
   - Preserve the user's chart zoom/pan state when applying live updates.
   - Show whether live ticker/kline data is connected, fresh, or stale, with receive age.
   - Keep REST status separate from WebSocket status.

4. **Reconciliation and recovery**
   - Keep REST polling as a background reconciliation path.
   - On confirmed candle, schedule a deduplicated REST refresh after the existing 500 ms finality safety lag.
   - On reconnect, symbol/timeframe change, stream gap, invalid kline, or stale feed, use REST to re-establish canonical chart state.
   - Never allow late events from a previous connection generation or previous symbol/timeframe to mutate the active chart.
   - If WS is unavailable, the application must continue to work through REST and visibly report that live streaming is unavailable.

## Initial thresholds

- Ticker freshness warning: 10 seconds without a valid ticker event while the socket is subscribed/connected.
- Kline freshness warning: based on the selected timeframe's expected update cadence; do not infer a kline outage solely from the absence of an update between provider pushes.
- REST reconciliation cadence remains 30 seconds initially.
- Confirmed-candle REST reconciliation delay: at least 500 ms plus a small scheduling margin.
- Thresholds are observability policies, not claims about guaranteed exchange delivery latency.

## Required tests

- Ticker snapshot accepted and emitted; delta merges partial fields.
- Delta before snapshot rejected.
- Wrong symbol, malformed lastPrice, invalid sequence, duplicate sequence, and older sequence rejected.
- Mark/index price never substitutes for lastPrice.
- Kline valid forming update upserts chart candle without changing closed-candle analysis count.
- Confirmed kline triggers one deduplicated REST reconciliation, not direct analytics promotion.
- Wrong symbol/interval, malformed OHLCV, misaligned timestamp, older candle, duplicate conflict, and candle gap trigger rejection/reconciliation.
- Old connection generation and stale symbol/timeframe messages cannot update chart.
- REST refresh supersedes stream-only chart state.
- REST remains functional when WebSocket is unavailable.
- No duplicate timers/subscriptions/sockets after repeated start, reconnect, or instrument changes.
- Existing Stage A and B1 suites remain green.

## Acceptance gates

- Deterministic automated tests pass.
- Exact source blob and CI run recorded.
- Real browser test confirms ticker and forming candle update without manual refresh, and compares displayed `lastPrice` with Bybit's last traded price.
- Test symbol and timeframe switches, background/foreground recovery, and network interruption.
- No merge until explicit owner acceptance.
- Live Bybit verification is separate from deterministic mocks; never claim it passed without a real browser/network capture.

## Explicit non-goals

- Replacing Bybit with another exchange or chart provider.
- Wiring B1 MTF into directional decisions.
- Recalculating indicators from every tick.
- Adding server infrastructure or MCP solely to proxy around provider geo restrictions.
- Changing the REST primary contract or removing the existing REST polling fallback.


## Implementation record — 2026-11-27

- PR #9: https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/9 (draft, unmerged).
- Exact HTML blob: 3421588fa85c47c72b1b3aa6fadfb8aef0608518; browser harness blob: 44b492f92ffbbbb58f6cb830375b6330a556d5c4.
- CI run 45981279187: Stage A 50/50, contract 32/32, quality 72/72, MTF 20/20; 174/174 deterministic tests. Browser live-handler/UI integration, desktop/mobile chart, REST cancellation/timeout and zero-page-error checks passed.
- Real Bybit WebSocket remains unverified from iPhone/Safari. GitHub Actions REST is blocked by HTTP 403; synthetic browser events are not live exchange evidence.
- Acceptance remains pending real iPhone/Safari verification and independent review. No merge; main unchanged.
