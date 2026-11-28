# B6 Analytics Core Audit
Date: 2026-11-28
Status: PASS WITH CONDITIONS
Candidate: `feature/b6-analytics-audit-2026-11-28`

## 1. Executive result

The B2-A through B2-G market-structure core is internally consistent, deterministic under its declared contracts, and protected by strong causal/admission tests. The production HTML implementations and the separately tested `src/analysis` modules were byte-for-byte identical at audit time. A CI parity test now prevents those copies from drifting.

Historical replay passed on BTCUSDT and ETHUSDT 1H/4H/1D data. The current 160-candle production window reproduced the full-history structure state at the archive's final cutoff across all six symbol/timeframe combinations. This supports retaining the current 160-bar window for now; it does not prove that 160 bars is universally sufficient in every market regime.

**Important boundary:** B2 is a market-structure evidence/projection layer, not a validated trade-signal engine. It does not establish LONG/SHORT profitability. B2-F MTF confluence remains disconnected from the directional decision path until real provider-time spread calibration is available.

## 2. Source and production parity

Before this audit, B2 unit tests imported `src/analysis/*.js`, while the app executes inline copies embedded in `CryptoAnalyst_StageA_S6_updated.html`. Static comparison found all seven implementations identical at the audit baseline. This was a potential future drift risk because no automated parity gate existed.

Added `tests/b2-inline-source-parity.test.cjs` and integrated it into B2 CI. Exact parity passed for all seven engines:

| Engine | Source/inline characters | Result |
|---|---:|---|
| B2-A Causal Swing | 12,512 | PASS |
| B2-B Swing Sequence | 10,253 | PASS |
| B2-C Swing Structure | 29,953 | PASS |
| B2-D Support/Resistance | 17,130 | PASS |
| B2-E Breakout/Retest | 31,551 | PASS |
| B2-F MTF Confluence | 16,024 | PASS |
| B2-G Chart Projection | 31,951 | PASS |

## 3. Algorithm contract review

### B2-A — causal swing detection

- Uses closed-candle inputs and explicit B1 snapshot/quality identity.
- Pivot availability is delayed until the right-side confirmation window and finality safety lag are satisfied.
- Plateau handling, duplicate timestamps, gaps, alignment, invalid candle values and as-of boundaries are covered.
- A pivot is not available merely because its source candle has occurred; its confirmation time matters.

**Assessment:** PASS. The pivot strength policy remains a sensitivity parameter, not a calibrated optimum.

### B2-B — swing sequence

- Consumes B2-A raw pivot evidence and validates upstream engine/policy/snapshot identity.
- Preserves availability order rather than silently sorting by source-candle time.
- Same-candle dual pivots are excluded from directional sequence under an explicit policy.
- Sequence labels and provenance are reconstructed/validated; input mutation and forged metadata are rejected.

**Assessment:** PASS.

### B2-C — structure state machine

- Independently reconstructs B2-B evidence and rejects omitted/forged pivots.
- BOS/CHOCH/sweep transitions are causal and tied to levels available before the break candle.
- Same-candle pivots cannot retroactively authorize a break.
- Consumed levels and protected structure are handled by explicit state transitions.

**Assessment:** PASS. The zero-buffer break policy is intentionally strict and should remain visible as a policy choice, not be presented as a universal market truth.

### B2-D — support/resistance zones

- Zones are built from validated historical swing evidence.
- Clustering uses an explicit maximum-total-span rule and independent-touch minimum.
- Raw evidence membership and zone provenance are retained.
- Freshness/decay is not classified by the engine; it returns historical zones within the supplied input window.

**Assessment:** PASS WITH CONDITION. Zone span materially changes the number of displayed levels. A future relevance/freshness policy is needed before increasing the production lookback.

### B2-E — breakout/retest lifecycle

- Reconstructs the zone as it existed at the breakout time, rather than using a later zone that could introduce look-ahead.
- Retest touch, success/failure buffers and observation windows are explicit policy inputs.
- Pending, successful, failed and expired lifecycle outcomes are distinguished.
- Lifecycle events link to actual B2-C structure events.

**Assessment:** PASS. The default retest and zone thresholds are exploratory display parameters, not empirically optimized trading thresholds.

### B2-F — MTF structure confluence

- Requires a common analysis cutoff across required timeframes.
- Recomputes and checks provider-time spread against the declared policy.
- Rejects non-VALID timeframe inputs, unknown states, duplicate events and future-dated evidence.
- Produces alignment context, not an entry instruction.

**Assessment:** PASS AS AN ISOLATED ENGINE. Live directional use remains gated on provider-time spread calibration. The historical replay uses a synthetic zero-spread common cutoff and is not evidence of live MTF freshness.

### B2-G — chart projection

- Validates upstream B2 results and projects swing markers, structure events, zones and retest lifecycles.
- Preserves causal timestamps and explicit ambiguity.
- Does not produce an independent trade decision.

**Assessment:** PASS.

## 4. Historical replay

The replay script now pins its external archive to immutable Git commit `9ca04178df06ce649f00779a49e11094fe5b1c70`; it no longer reads a moving `master` branch.

Dataset integrity after parsing:

| Symbol | Timeframe | Rows | Invalid | Duplicates | Gaps | Off-grid |
|---|---|---:|---:|---:|---:|---:|
| BTCUSDT | 1H | 49,957 | 0 | 0 | 0 | 0 |
| BTCUSDT | 4H | 12,489 | 0 | 0 | 0 | 0 |
| BTCUSDT | 1D | 2,081 | 0 | 0 | 0 | 0 |
| ETHUSDT | 1H | 41,447 | 0 | 0 | 0 | 0 |
| ETHUSDT | 4H | 10,361 | 0 | 0 | 0 | 0 |
| ETHUSDT | 1D | 1,726 | 0 | 0 | 0 | 0 |

Archive coverage ends on 2025-12-05. This is a historical structural replay, not a current-market validation.

### Lookback sensitivity

At the archive's final cutoff, all 24 combinations (2 symbols × 3 timeframes × 160/400/800/1600 candles) produced the same final B2-C structure state as the full-history run.

| Symbol | TF | Final state | 160 bars | 400 bars | 800 bars | 1600 bars |
|---|---|---|---|---|---|---|
| BTCUSDT | 1H | DOWN | DOWN | DOWN | DOWN | DOWN |
| BTCUSDT | 4H | UP | UP | UP | UP | UP |
| BTCUSDT | 1D | UP | UP | UP | UP | UP |
| ETHUSDT | 1H | DOWN | DOWN | DOWN | DOWN | DOWN |
| ETHUSDT | 4H | DOWN | DOWN | DOWN | DOWN | DOWN |
| ETHUSDT | 1D | UP | UP | UP | UP | UP |

Recent event counts in the last 160 candles were also broadly stable from 400 bars onward. This supports keeping the app's current 160-candle input limit for now, while retaining lookback sensitivity as a future regression metric.

However, the number of historical zones grows sharply as more candles are supplied. Example: BTCUSDT 1H returned 14 zones at 160 bars, 32 at 400, 57 at 800 and 121 at 1600. Therefore, increasing lookback without a zone relevance/freshness policy would add clutter rather than automatically improve the chart.

### Parameter sensitivity

- Swing strength 2/3/5 materially changes pivot and structure-event counts. It must not be described as an optimized setting.
- Across the 160-candle parameter grid, zone span ratios of 0.05%, 0.10%, 0.25% and 0.50% produced median zone counts of approximately 2, 4, 7.5 and 10 respectively.
- Retest tolerance changes had smaller effects on aggregate lifecycle counts in this sample.
- The app's current 0.10% zone span and 0.05% retest tolerance are exploratory display thresholds only.

### Synchronized MTF replay

At the final synchronized archive cutoff, both BTCUSDT and ETHUSDT produced `UP|UP|DOWN` (1D/4H/1H) and `MIXED_STRUCTURE`. This is a useful demonstration that MTF confluence can correctly preserve disagreement instead of forcing a directional label.

The replay constructs a synthetic B1-valid wrapper after CSV integrity checks. It does **not** run the actual B1 validator, observe historical provider finality, or calibrate live provider-time spread. The report now states these assumptions explicitly.

## 5. Integration boundary and remaining risks

1. **B2 is not the LONG/SHORT decision engine.** `runB2Analysis` currently builds the B2-A/B/C/D/E/G structure projection; B2-F is deliberately passed as unavailable in the normal app path. Existing LONG/SHORT/WAIT logic is not yet driven by B2 structure. That integration belongs to later setup/decision stages.
2. **Zone freshness is not classified.** The 160-bar window currently bounds the number of historical levels. Do not increase it until relevance/decay rules are specified and tested.
3. **Display thresholds are not calibrated.** Swing strength, zone span and retest tolerance are sensitivity inputs. Historical replay counts do not prove predictive value.
4. **Archive freshness is limited.** The pinned dataset ends 2025-12-05; real 2026 chart comparison remains a later acceptance task.
5. **No trading edge is claimed.** Replay does not simulate entries, missed signals, fees, funding, slippage, drawdown or expectancy. Those belong to B5 journal collection and B8 statistical validation.
6. **Candlestick and volume participation features remain separate future work.** B2 structure alone does not replace those inputs.

## 6. CI evidence

- B2 application integration and source/inline parity: run `46107248773`, SUCCESS.
- Historical BTC/ETH replay with pinned archive and lookback sensitivity: run `46107248819`, SUCCESS.
- Historical report artifact: `b2-historical-replay-report`.

## 7. Verdict

**B2-A through B2-G are suitable as a deterministic, explainable market-structure evidence layer, subject to the conditions above.** Keep the current 160-bar input limit for now, keep B2-F out of directional decisions until live timing is calibrated, and do not convert these structure outputs directly into trading signals.

The next meaningful work is to define and validate a small number of setups on top of this evidence, then use B5 observations and actual-trade records to measure outcomes. The real graph comparison on iPhone/Safari remains a separate human acceptance gate.
