# Market Regime Engine v2 — local consolidation research candidate

**Date:** 2026-11-28  
**Status:** isolated research candidate; v1 remains the compatibility default  
**Branch:** `feature/market-regime-v2-local-consolidation-2026-11-28`

## 1. Finding that motivated v2

The pinned historical sample evaluated 780 snapshots across BTCUSDT and ETHUSDT on 1h/4h/1d. V1 produced zero RANGE labels. Only 10/780 snapshots passed its range feature thresholds even when the structure-state gate was ignored, and B2-C was UP or DOWN in all 780 snapshots. V1's requirement that B2-C be UNESTABLISHED or absent therefore prevented any historical RANGE classification in this sample.

The sampled median absolute EMA50/EMA200 spread was 2.82 ATR, while v1 required at most 0.60 ATR. This long-horizon spread is not a good sole gate for identifying a local consolidation inside an established macro structure.

## 2. V2 interpretation

V2 treats RANGE as a **local consolidation state**, not proof that the entire higher-level market has become directionless.

- Trend labels retain the existing strict EMA20/50/200 + B2-C agreement.
- IMPULSE retains priority over trend/range.
- Local RANGE uses recent 20-bar high-low compression, weak normalized EMA50 slope, and compressed EMA20/EMA50 spread.
- A prior B2-C UP or DOWN structure does not block local RANGE. It is retained as macro context in reason codes.
- When B2-C is UP/DOWN, RANGE evidence alignment is PARTIAL, not CONVERGENT. The engine does not erase the macro structure.
- If structure is UNESTABLISHED, RANGE may be CONVERGENT. If structure is missing, it remains PARTIAL.
- V1 behavior remains the default when `range_detection_mode` is omitted. V2 requires an explicit mode and an explicit `range_max_fast_mid_spread_atr`.

## 3. Candidate parameters

| Parameter | V2 research value |
|---|---:|
| Range lookback | 20 closed candles |
| Maximum range width | 5.0 ATR |
| Maximum absolute EMA50 slope | 0.30 ATR |
| Maximum absolute EMA20/EMA50 spread | 0.50 ATR |
| Structure gate | none for local range; preserve UP/DOWN as context |

These are initial research values informed by the observed feature distribution, not optimized parameters. They are not approved for production or trading use.

## 4. Output reasons

V2 local range adds:
- `LOCAL_EMA20_50_SPREAD_COMPRESSED`
- `MACRO_STRUCTURE_UP_CONTEXT` or `MACRO_STRUCTURE_DOWN_CONTEXT` when B2-C remains directional.

Directional bias remains NEUTRAL for RANGE. No LONG/SHORT recommendation is emitted.

## 5. Validation plan

1. Preserve v1 and v2 outputs side-by-side on the exact same 780 historical snapshots.
2. Check v2 distribution by symbol and timeframe, not only aggregate counts.
3. Inspect representative RANGE, TRANSITION, UPTREND and DOWNTREND samples against the actual OHLCV chart.
4. Run threshold sensitivity without selecting thresholds on the eventual out-of-sample cohort.
5. Add a newer 2026 data cohort before any claim of current-market applicability.
6. Keep v2 outside the production LONG/SHORT/WAIT path until independent review and owner acceptance.

## 6. Boundaries

This is classification research, not a trading strategy backtest. The historical B1 wrapper remains synthetic VALID and finality remains time-derived with a fixed 500ms lag. No entry/exit simulation, fees, funding, slippage, expectancy, drawdown or profitability is measured. The app's existing decision engine is not changed by this branch.
