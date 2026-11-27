# B3 — Chart UI redesign specification

**Date:** 2026-11-27  
**Status:** implemented and merged into main; automated CI passed; owner iPhone/Safari acceptance pending  
**Base:** `main` at `d2b8220572ec407a62c5a359af3c0264919932b1`  
**Scope:** presentation and interaction only. B1/B2 analytical calculations and LONG/SHORT/WAIT decision logic are out of scope.

## 1. Problem

The integrated B2 overlays were added to a chart that previously had a fixed 320 px mobile height and no visibility management. Candles, EMA lines, volume, legacy extrema, B2 pivots, structure events and S/R zones can compete for the same visual space. The result is a dense chart that is difficult to interpret on a phone.

## 2. Product requirements

1. The chart is the primary workspace. On narrow screens its height must adapt to the viewport and remain at least 440 px.
2. The user can switch between three display presets:
   - **Clean:** candles, volume, confirmed S/R zones and a limited number of recent significant extrema. No BOS/CHoCH or retest labels; EMA overlays hidden by default.
   - **Structure:** S/R zones, more extrema, BOS/CHoCH, retest lifecycle markers, EMA and volume.
   - **Full:** all supported visual layers, including legacy Stage A levels.
3. Presets are starting configurations, not locked modes. Every visible layer can be toggled independently; a manual change switches the mode indicator to custom.
4. The chart renderer must use the same underlying analytical projection. Hiding a layer must never mutate B1/B2 output, candle data, quality state or directional decisions.
5. B2 event and retest annotations must respect their causal availability timestamps. Retest labels are placed at the first displayed candle at or after `visible_at_ms`, not retroactively on the breakout candle.
6. Zone fills are subdued. Only a small number of recent zone labels are shown to reduce label collisions.
7. Mobile controls must be touch-friendly, horizontally scrollable where needed, and must not introduce horizontal page overflow.

## 3. Display-layer contract

| Layer | Clean | Structure | Full |
|---|---:|---:|---:|
| Confirmed S/R zones | On | On | On |
| Significant B2 extrema | On, max 6 | On, max 14 | All visible |
| BOS / CHoCH | Off | On, max 8 | On, max 30 |
| Retest lifecycle | Off | On, max 8 | On, max 8 |
| EMA overlays | Off | On | On |
| Volume pane | On | On | On |
| Legacy Stage A S/R lines | Off | Off | On |

Manual layer controls override the preset and set the mode to `custom`.

## 4. Non-goals

- No changes to B1 data contracts, validation, finality or quality gates.
- No changes to B2-A…B2-G algorithms, parameters, event history or causal timestamps.
- No changes to Stage A LONG/SHORT/WAIT.
- No new trading strategy, signal, risk calculation or market-data source.
- No claim that visual cleanup improves trading profitability.

## 5. Verification gates

- JavaScript syntax check for every inline script.
- Browser integration with synthetic B1-valid data.
- Verify all three presets and independent layer toggles.
- Verify chart remains at least 440 px on a 390×844 mobile viewport and no horizontal overflow occurs.
- Verify confirmed S/R zones remain causally positioned.
- Verify B1/B2 deterministic suites remain unchanged and pass.
- Owner iPhone/Safari visual acceptance is the post-integration product check; it was intentionally deferred until the merged build was available.

## 6. Current implementation notes

The integrated implementation adds the three presets, six layer toggles, responsive chart height, reduced B2 label density and causal retest markers. Automated verification is recorded below. User iPhone/Safari visual acceptance remains pending.


## 7. Verification result

- B2 application integration run 46038517628: SUCCESS.
- B1 browser/data run 46038517602: SUCCESS; Stage A 50/50, B1 contract 32/32, quality 72/72, MTF 20/20; zero page errors.
- Browser checks passed for all display presets, custom layer toggles, mobile 390×844 layout, minimum 440 px chart height, no horizontal overflow and causal zone start position.
- Live Bybit REST probe was skipped due HTTP 403 from the GitHub runner on both public REST hosts. No live-market claim is made.
- Owner iPhone/Safari visual acceptance remains pending after integration.


## 7. Verification results (2026-11-27)

- JavaScript syntax compilation: both inline scripts PASS.
- Browser integration and mobile layout test on commit `c8a79a2429f10fafdca28987c28e384ecba467db`: PASS.
- B2-A, B2-B, B2-C, B2-D, B2-E, B2-F, B2-G deterministic suites: PASS.
- B1 browser/live-data verification workflow: PASS.
- Mobile viewport assertions include 390×844, minimum 440 px chart canvas, no horizontal overflow, three display presets and independent layer toggles.
- The final PR HEAD `e65715efea1fa97527f03ccb7e883cc8d6737e58` was verified by B1 workflow `46039070502` and B2 workflow `46039070648`; both completed SUCCESS.
- iPhone Safari visual acceptance remains outstanding after integration.


## 8. Final integration status (2026-11-27)

- PR #23 merged into `main`: https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/23.
- Merge commit: `7d34a3539c9a655bca546bbb7b0c8ff2293b80ee`.
- Final PR HEAD: `e65715efea1fa97527f03ccb7e883cc8d6737e58`.
- B1 browser/live-data workflow `46039070502`: SUCCESS.
- B2 application integration workflow `46039070648`: SUCCESS, including B2-A…B2-G deterministic suites and browser/mobile integration.
- Live Bybit REST probe did not pass; GitHub runner received HTTP 403 from both public REST hosts. No live-market claim is made.
- The remaining acceptance item is owner visual review on iPhone/Safari after integration.
