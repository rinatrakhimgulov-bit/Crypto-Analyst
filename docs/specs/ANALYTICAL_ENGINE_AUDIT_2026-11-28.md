# Analytical engine audit — 2026-11-28

**Branch:** `feature/market-regime-engine-2026-11-28`  
**Application baseline:** `CryptoAnalyst_StageA_S6_updated.html`  
**Purpose:** record what already exists before adding duplicate logic. This is a source-level audit, not a claim of historical predictive validity.

## Verified implementation map

| Component | Source | Current role | Status in app HTML |
|---|---|---|---|
| B2-A | `src/analysis/b2-causal-swing-engine.js` | Causally confirmed swing pivots | Inline implementation and called |
| B2-B | `src/analysis/b2b-swing-sequence-engine.js` | Swing sequence admission | Inline implementation and called |
| B2-C | `src/analysis/b2c-swing-structure-engine.js` | UP/DOWN/UNESTABLISHED structure and close-confirmed BOS/CHOCH events | Inline implementation and called |
| B2-D | `src/analysis/b2d-support-resistance-engine.js` | Support/resistance zones from independent swing-pivot touches | Inline implementation and called |
| B2-E | `src/analysis/b2e-breakout-retest-engine.js` | Zone breakout lifecycle, retest, role reversal, failure/expiry | Inline implementation and called |
| B2-F | `src/analysis/b2f-mtf-structure-confluence-engine.js` | Multi-timeframe structure confluence | Source exists; not embedded/called by current HTML path |
| B2-G | `src/analysis/b2g-chart-projection-engine.js` | Projects structure, zones and retest lifecycles to chart | Inline implementation and called; currently receives `b2f_result: null` |
| B7 | `src/analysis/b7-explainable-setup-engine.js` | Explainable setup candidates and candle/volume context | Inline implementation and called |
| Market Regime v1 | `src/analysis/market-regime-engine.js` | UPTREND/DOWNTREND/RANGE/IMPULSE/TRANSITION/UNKNOWN | Isolated source candidate; not yet embedded/called by HTML |

The current HTML's `runB2Analysis` executes B2-A → B2-B → B2-C → B2-D → B2-E → B2-G, then B7. The B2-F module is not wired into this path. The Market Regime Engine is also not wired into the HTML and does not affect LONG/SHORT/WAIT.

## B2-D support/resistance findings

### What is already sound in the current design
- Consumes the exact B1 snapshot/quality report and matching B2-C result.
- Uses only closed, provenance-checked candles and causally available pivots.
- Separates SUPPORT from RESISTANCE.
- Clusters by `MAX_TOTAL_SPAN_V1`, preventing transitive chaining beyond the configured total cluster span.
- Requires independent source-candle touches; a one-touch cluster remains a candidate rather than a confirmed zone.
- Preserves contributing pivot IDs and timestamps and makes output immutable.

### Gaps requiring a dedicated revision
- Zone width is configured in raw price units. The current HTML derives it as 0.1% of median close. This scales nominally across instruments, but does not adapt to volatility/ATR or regime.
- `freshness_status` is always `NOT_CLASSIFIED`. No explicit age/decay model is applied.
- No zone strength ranking combines independent touches, rejection quality, recency, approach velocity, or later successful/failed tests.
- All confirmed raw pivots are retained as touch evidence, including pivots superseded for sequence purposes. This is intentional in the current output contract but needs explicit validation as a zone-evidence choice.
- No active-zone selection contract defines nearest support/resistance relative to current price or handles overlapping/near-duplicate zones across timeframes.

## B2-E breakout/retest findings

### What is already present
- Consumes close-confirmed B2-C structural break events, not wick-only pierces.
- Reconstructs the historical zone using only pivots available before the break; later pivots are not retroactively added.
- Requires the breaking candle close to clear the full historical zone boundary.
- Tracks WAITING_RETEST, RETEST_SUCCESSFUL, RETEST_FAILED, RETEST_EXPIRED, RETEST_PENDING_CONFIRMATION and RETEST_UNRESOLVED.
- Confirms or rejects support/resistance role reversal using subsequent closed candles.
- Revalidates upstream identity and zone membership to fail closed on forged or mismatched evidence.

### Gaps requiring a dedicated revision
- Break buffer is currently `ZERO_BUFFER_V1` in the B2-C event contract.
- Retest tolerance and success/failure buffers are absolute prices; current HTML derives them as 0.05% of median close rather than from ATR.
- Breakout quality does not itself require volume expansion, relative range expansion, body/close-location quality, or follow-through strength.
- A failed retest is represented, but the system does not yet provide a unified, separately validated false-breakout quality score or classify post-break downside acceleration as a selloff.
- Gap-through, wick interaction and intrabar path uncertainty require explicit scenario labels; OHLC candles cannot reveal the exact path taken inside a candle.

## Immediate analytical priorities

1. Complete Market Regime Engine v1 validation. Its GitHub Actions run on exact head `a8b1f4bc1bb7a96801a52317a303716129ac1ed3` completed successfully; all 19 deterministic tests and syntax parsing passed. These tests are synthetic and do not calibrate thresholds.
2. Revise B2-D with volatility-normalized zone width, explicit freshness/decay, active-zone selection and explainable strength evidence. Preserve causal timestamps and the existing raw evidence.
3. Revise B2-E to use volatility-normalized buffers and add volume/range/close-quality evidence without converting a single threshold into a guaranteed breakout.
4. Add a dedicated bearish impulse/selloff classifier. A selloff should require a strong bearish displacement and expansion evidence; support breakdown/reclaim failure are separate contextual facts, not synonyms.
5. Connect the validated regime, zones, breakout lifecycle, impulse evidence and B2-F MTF context into a unified, explainable LONG/SHORT/WAIT decision layer.
6. Historical prefix replay and sensitivity analysis must precede production decision-path use. Synthetic unit tests alone are not sufficient.

## Non-goals for this analytical stage

- No autotrading or order placement.
- No new cloud-storage, OAuth, Supabase or backup work.
- No merging into `main` or publishing a new app build before tests and owner acceptance.
- No claims of profitability, calibrated probability or predictive edge without out-of-sample and forward validation.


## 2026-11-28 — analytical candidates and prefix replay checkpoint

- B2-D zone-context candidate PR #34: exact-head CI passed; 15 new tests plus 21 B2-D and 24 B2-E regression tests.
- B2-E breakout-quality candidate PR #35: exact-head CI passed; 16 new tests plus 15 B2-D and 24 B2-E regression tests.
- Market Impulse Event candidate PR #36: exact-head CI passed; 16 impulse tests plus 15 B2-D and 16 B2-E quality regression tests.
- Prefix replay exact-head run 46167377937 passed on pinned BTC/ETH archive commit `9ca04178df06ce649f00779a49e11094fe5b1c70`: 474 regular-stride 240-candle prefixes across six symbol/timeframe series, deterministic repeats and cutoff assertions passed.
- Sensitivity exposed `0.67 > 2/3` for a 3-candle directional-pressure window. Research/test policy corrected to exact `2 / 3`; no engine code or production policy was changed.
- Corrected research baseline across the 474 sampled prefixes: 17 STRONG_SELL_OFF, 15 BEARISH_IMPULSE, 34 BULLISH_IMPULSE, 51 DIRECTIONAL_MOVE_UNCONFIRMED, 357 NO_IMPULSE.
- This is classification frequency, not a trade backtest. Prefixes overlap, events are not independent, B1 is a synthetic VALID wrapper, finality is time-derived with 500ms lag, and thresholds are uncalibrated.
- Keep PRs #34, #35 and #36 Draft and unmerged. Do not integrate these outputs into production LONG/SHORT/WAIT until independent review and stronger out-of-sample evaluation.
