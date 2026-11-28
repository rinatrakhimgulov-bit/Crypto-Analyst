# Market Analytics Prefix Replay — 2026-11-28

**Status:** PASS — causal prefix and deterministic checks; no profitability validation  
**PR:** #36  
**Exact-head replay run:** 46167521434  
**Exact-head source commit:** \`e45d1f67c0faca30a983ab890000cb0b51394b08\`  
**Dataset:** \`mestoness/btc-eth-candles-history\`  
**Pinned dataset commit:** \`9ca04178df06ce649f00779a49e11094fe5b1c70\`

## 1. Method

- BTCUSDT and ETHUSDT, each on 1h, 4h and 1d.
- 240-candle prefixes, sampled every 250 candles, with the final available candle included.
- B2-A through B2-E recomputed per prefix.
- B2-D Zone Context, B2-E Breakout Quality, Market Regime and Market Impulse Event Engine evaluated against the same exact prefix and cutoff.
- Each prefix evaluated twice; compact outputs had to match.
- Breakout, retest and impulse timestamps were checked against the prefix cutoff.

Total: **474 prefixes** across six series. This is a regular-stride exploratory sample, not an exhaustive event census.

## 2. Dataset integrity

| Series | Rows | Invalid | Duplicates | Gaps | Off-grid |
|---|---:|---:|---:|---:|---:|
| BTCUSDT 1h | 49,957 | 0 | 0 | 0 | 0 |
| BTCUSDT 4h | 12,489 | 0 | 0 | 0 | 0 |
| BTCUSDT 1d | 1,716 | 0 | 0 | 0 | 0 |
| ETHUSDT 1h | 41,435 | 0 | 0 | 0 | 0 |
| ETHUSDT 4h | 10,360 | 0 | 0 | 0 | 0 |
| ETHUSDT 1d | 1,431 | 0 | 0 | 0 | 0 |

## 3. Regime and impulse classification

The impulse policy was corrected to use exact \`2 / 3\` directional pressure. The earlier decimal \`0.67\` was greater than 2/3 and effectively required all 3 candles to align in a 3-candle window.

| Series | Prefixes | UPTREND | DOWNTREND | TRANSITION | Regime IMPULSE | Bullish impulse | Bearish impulse | Strong sell-off | Directional unconfirmed | No impulse |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| BTC 1h | 200 | 43 | 31 | 111 | 15 | 15 | 7 | 5 | 19 | 154 |
| BTC 4h | 50 | 8 | 8 | 31 | 3 | 2 | 2 | 2 | 8 | 36 |
| BTC 1d | 9 | 1 | 0 | 8 | 0 | 2 | 0 | 0 | 1 | 6 |
| ETH 1h | 166 | 26 | 27 | 100 | 13 | 10 | 4 | 8 | 16 | 128 |
| ETH 4h | 42 | 11 | 10 | 19 | 2 | 4 | 2 | 1 | 6 | 29 |
| ETH 1d | 7 | 3 | 1 | 1 | 2 | 1 | 0 | 1 | 1 | 4 |
| **Total** | **474** | **92** | **77** | **270** | **35** | **34** | **15** | **17** | **51** | **357** |

The Market Regime \`IMPULSE\` label and the Market Impulse Event labels are separate definitions; their counts should not be expected to match.

## 4. One-factor threshold sensitivity

Each row changes one threshold only, leaving the other baseline parameters fixed. These counts describe classification frequency on the same 474 prefixes. They are not a method for selecting an optimal threshold.

| Variant | Strong sell-off | Bearish impulse | Bullish impulse | Directional unconfirmed | No impulse |
|---|---:|---:|---:|---:|---:|
| Previous decimal pressure 0.67 | 0 | 1 | 6 | 110 | 357 |
| Corrected baseline pressure 2/3 | 17 | 15 | 34 | 51 | 357 |
| Impulse displacement 1.0 ATR | 17 | 23 | 37 | 68 | 329 |
| Impulse displacement 1.5 ATR | 17 | 9 | 5 | 34 | 390 |
| Sell-off displacement 1.5 ATR | 21 | 11 | 34 | 51 | 357 |
| Sell-off displacement 2.5 ATR | 14 | 18 | 34 | 51 | 357 |
| Range expansion 1.0 ATR | 17 | 15 | 34 | 51 | 357 |
| Range expansion 1.5 ATR | 16 | 16 | 34 | 51 | 357 |
| Volume expansion 1.2x | 18 | 14 | 34 | 51 | 357 |
| Volume expansion 2.0x | 13 | 19 | 34 | 51 | 357 |
| Directional pressure 0.5 | 17 | 15 | 34 | 51 | 357 |
| Directional pressure 0.8 | 0 | 1 | 6 | 110 | 357 |

The 0.5 and 2/3 variants produce the same counts because a 3-candle window has discrete directional-pressure values in thirds. A threshold of 0.8 effectively requires 3/3 alignment. This is why 0.67 was a material specification/implementation mismatch.

## 5. Breakout and retest context

Across overlapping windows, the replay observed the following B2-E breakout-quality labels:

- STRONG_EVIDENCE: 1,345
- MIXED_EVIDENCE: 531
- WEAK_EVIDENCE: 258
- PARTIAL_EVIDENCE: 8

Bearish retest lifecycle appearances:

- RETEST_SUCCESSFUL: 29
- RETEST_FAILED: 22
- WAITING_RETEST: 27
- RETEST_PENDING_CONFIRMATION: 3

These are **lifecycle appearances across overlapping prefixes**, not unique breakouts or independent events. Do not interpret them as a sample-size estimate.

## 6. Limitations

- The production B1 validator is not executed; replay constructs a synthetic VALID quality wrapper after CSV structural integrity checks.
- Historical candle finality is time-derived with a fixed 500ms lag.
- The replay uses a fixed pinned archive ending 2025-12-05.
- The 474 prefixes overlap and are statistically dependent.
- The scan stride is 250 bars; events between sampled cutoffs can be missed.
- Policy thresholds remain uncalibrated. Sensitivity counts do not measure which setting predicts outcomes best.
- No entries, exits, forward returns, MFE/MAE, fees, funding, slippage, expectancy or actual trades were evaluated.
- No production HTML, UI or LONG/SHORT/WAIT behavior was changed.

## 7. Decision

The candidate engines pass deterministic and causal prefix checks on the pinned archive. This supports continued research and source review only. It does not establish a trading edge or authorize live decision-path integration.

Next gates: independent code review, denser event census, chronological out-of-sample evaluation with adequate sample size, and prospective observation tracking. Keep PR #36 Draft and unmerged.
