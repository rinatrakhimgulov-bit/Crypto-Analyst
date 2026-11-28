# B8 Historical Outcome Exploration
Date: 2026-11-28
Status: PASS — exploratory pipeline executed; insufficient sample for performance conclusions
PR: #28
Code head verified by CI: `cf16dd38e9b8cc7fb7f923d7999add2c4a46b0e5`
CI run: `46117156657`
Artifact: `b8-historical-validation-report` (workflow artifact ID `15251822484`)

## 1. Scope and provenance

The B8 workflow:
1. ran the existing pinned B2/B7 historical replay;
2. collected B7 candidates from five existing 160-candle windows per symbol/timeframe;
3. deduplicated by `symbol + timeframe + setup_id`, reconciling a pending-to-confirmed lifecycle by retaining the confirmed event and its confirmation availability time;
4. evaluated confirmed candidates against the full corresponding historical OHLCV series;
5. assigned chronological 60% train / 20% validation / 20% test splits independently per series;
6. generated forward return, MFE/MAE and optional 1R/2R barrier outcomes.

Dataset: `mestoness/btc-eth-candles-history`, immutable commit `9ca04178df06ce649f00779a49e11094fe5b1c70`.

Dataset periods:
- BTCUSDT: 2020-03-25 through 2025-12-05 (1h/4h/1d).
- ETHUSDT: 2021-03-15 through 2025-12-05 (1h/4h/1d).

Finality remains time-derived with a fixed 500ms research lag.

## 2. Candidate population

| Series | Unique sampled candidates | Confirmed | Pending | Confirmed outcomes evaluated |
|---|---:|---:|---:|---:|
| BTCUSDT 1h | 14 | 13 | 1 | 13 |
| BTCUSDT 4h | 9 | 7 | 2 | 7 |
| BTCUSDT 1d | 3 | 3 | 0 | 3 |
| ETHUSDT 1h | 8 | 8 | 0 | 8 |
| ETHUSDT 4h | 4 | 3 | 1 | 3 |
| ETHUSDT 1d | 2 | 2 | 0 | 2 |
| **Total** | **40** | **36** | **4** | **36** |

All 36 confirmed candidates had a causal entry proxy in the available archive. This does not mean all 36 had a usable invalidation barrier: some B7 invalidation levels were already on the wrong side of the delayed entry price, so forward-path metrics remained available while barrier scoring was unavailable.

Split population: 22 TRAIN, 8 VALIDATION, 6 TEST.

The 40 candidates are the stable IDs surfaced by the five sampled windows. This is not an exhaustive historical event census. The same 40 count as the prior B7 report does not imply the sampling is complete.

## 3. Descriptive forward outcomes

Entry proxy: close of the first fully closed candle whose finality availability is strictly later than candidate `available_at_ms`. The next candle's open is deliberately not used if it predates candidate availability.

Aggregate across the small sampled population (all symbols, timeframes, setup types and directions):

| Split | Horizon | N | Positive close returns | Mean directional return |
|---|---:|---:|---:|---:|
| TRAIN | 1 bar | 22 | 13/22 (59.1%) | +0.380% |
| TRAIN | 3 bars | 22 | 12/22 (54.5%) | +0.047% |
| TRAIN | 6 bars | 22 | 13/22 (59.1%) | +0.364% |
| TRAIN | 12 bars | 22 | 15/22 (68.2%) | +0.186% |
| VALIDATION | 1 bar | 8 | 3/8 (37.5%) | -0.004% |
| VALIDATION | 3 bars | 8 | 5/8 (62.5%) | +0.275% |
| VALIDATION | 6 bars | 8 | 5/8 (62.5%) | +0.535% |
| VALIDATION | 12 bars | 8 | 4/8 (50.0%) | +1.728% |
| TEST | 1 bar | 6 | 0/6 (0.0%) | -0.595% |
| TEST | 3 bars | 6 | 1/6 (16.7%) | -1.556% |
| TEST | 6 bars | 6 | 2/6 (33.3%) | -1.466% |
| TEST | 12 bars | 4 | 0/4 (0.0%) | -2.461% |

These are descriptive sample figures only. The test population is six candidates, and only four have a complete 12-bar horizon. It is far too small and too clustered to estimate general performance, compare setup families, or justify changing a trading decision.

## 4. Barrier exploration

Across the 36 confirmed candidates:
- 1R: 14 STOP, 12 TARGET, 2 STOP_FIRST_AMBIGUOUS; 8 candidates had no usable barrier result.
- 2R: 18 STOP, 10 TARGET; 8 candidates had no usable barrier result.

Same-bar ambiguity resolves stop-first. Gap-through-stop uses the adverse candle open. Target gaps are capped at target. These are bar-based research proxies, not executable fills.

No fee, slippage or funding assumptions were supplied. Therefore this report contains no net-of-cost result and no expectancy claim.

## 5. Statistical interpretation

The current sample is not suitable for statistical validation of profitability:
- only six candidates fall in TEST;
- no FALSE_BREAKOUT_RECLAIM candidate appears in TEST;
- candidates are sampled from five quantile windows, not exhaustively detected across every bar;
- candidates within the same symbol/timeframe and market move are correlated;
- Wilson intervals are labelled as naive-independence descriptors and are not cluster-aware;
- the B2 replay uses a synthetic B1-VALID wrapper; the actual B1 validator is not executed;
- no tick-level spread/fills, funding history, account fee schedule, slippage observations or actual trade outcomes exist.

The negative descriptive TEST returns are not proof that B7 is bad. Equally, positive TRAIN/VALIDATION observations are not evidence of an edge. This sample is too small to support either conclusion.

## 6. Decision and remaining work

**B8-C exploratory pipeline: PASS. B8-C statistical validation: NOT COMPLETE.**

Next required:
1. Replace the five-window candidate sample with a much denser or exhaustive causal event census; deduplicate stable IDs without losing lifecycle semantics.
2. Increase the chronological TEST population materially, especially for every setup type and direction.
3. Add cluster/block-aware uncertainty and report dependence by symbol, timeframe and date/regime.
4. Keep policy/thresholds frozen before test; do not tune on test.
5. Add explicit fee/slippage sensitivity and observed funding only when sourced.
6. Obtain a user-exported B5 journal for a separate prospective cohort. Do not mix it with historical replay or actual trades.
7. Complete independent review of timing, splits, leakage, arithmetic and statistical interpretation.

No production decision path, app HTML or UI was changed. No LONG/SHORT/WAIT integration is authorized by this report.
