# Market Regime Engine v2.0.0 — local consolidation scope

## Why v2 exists

The v1 replay was run over 780 chronological snapshots across BTCUSDT and ETHUSDT on 1H/4H/1D. It produced no RANGE classifications. Two separate constraints caused this:
1. Range required B2-C structure state UNESTABLISHED, but none of the sampled windows had that state.
2. The v1 slope and mid/slow EMA spread limits were far below the observed sample distribution.

The v2 candidate separates broad structural direction from local compression. B2-C remains authoritative for macro swing structure; local compression may be detected while that structure remains UP or DOWN.

## Classification model

- UPTREND / DOWNTREND: retain the v1 rule. EMA stack and slopes must align with B2-C structure.
- IMPULSE: retain the v1 displacement and range-expansion rule.
- RANGE: use local compression:
  - range width <= 5.0 ATR;
  - absolute EMA50 slope <= 0.30 ATR over the configured slope lookback;
  - absolute EMA20/EMA50 spread <= 0.50 ATR.
- TRANSITION: conflicting or insufficient evidence outside the above states.

Trend and impulse checks take precedence over RANGE. The local-range test does not overwrite B2-C structure.

## Range scope

- \`MARKET_RANGE\`: local compression and B2-C state UNESTABLISHED.
- \`LOCAL_CONSOLIDATION\`: local compression while B2-C remains UP or DOWN, or structure is not supplied.
- \`MARKET_TREND\`, \`MARKET_IMPULSE\`, \`MARKET_TRANSITION\`: other states.

For LOCAL_CONSOLIDATION, directional bias is NEUTRAL and evidence alignment is PARTIAL. The separate \`structure_state\` continues to show the residual UP/DOWN structure. This prevents a local pause from being misrepresented as a confirmed macro trend reversal.

## Historical rationale and limits

The first 780-window sample found:
- v1 RANGE labels: 0;
- current v1 range thresholds without the structure gate: 10/780;
- exploratory local-range candidate A: 179/780;
- broader candidates B/C: 279/780 and 352/780.

Candidate A is selected as a conservative engineering test, not as an optimized or validated trading threshold. The sample is approximately one snapshot every 14 days and uses an archive ending 2025-12-05. It misses short-lived ranges between snapshots and excludes 2026 data.

## Safety and validation

- Uses the same B1 snapshot, quality report, closed-candle and B2-C identity contracts as v1.
- No future candles are used.
- v1 remains available for side-by-side replay comparison.
- v2 is not connected to LONG/SHORT/WAIT.
- Historical label frequency is not a measure of prediction accuracy or profitability.
- More recent data, denser replay, threshold sensitivity, chart review and out-of-sample outcome evaluation are required before any decision-path use.
