# Market Regime Engine v1 — initial analytical foundation

**Date:** 2026-11-28  
**Status:** isolated implementation candidate; research-only; not connected to the production LONG/SHORT/WAIT path.  
**Branch:** feature/market-regime-engine-2026-11-28

## 1. Purpose

Add a deterministic, explainable classification of the current market regime using the existing provider-neutral B1 candle snapshot and the causal B2-C market-structure result.

The first increment classifies one instrument and one timeframe at a time. It does not produce an entry, trade direction, probability, confidence percentage, strategy, stop or target.

## 2. Regime labels

- UPTREND: EMA20 > EMA50 > EMA200, price above EMA20, positive normalized EMA50/EMA200 slopes and a matching B2-C UP structure state.
- DOWNTREND: exact bearish mirror of UPTREND with B2-C DOWN structure.
- RANGE: compressed recent high-low width, weak EMA50 slope and compressed EMA50/EMA200 spread; B2-C must be UNESTABLISHED or not supplied. Missing structure lowers the evidence-alignment label.
- IMPULSE: recent directional displacement exceeds the configured ATR multiple and recent candle range expands relative to current ATR. Direction is reported separately as BULLISH or BEARISH.
- TRANSITION: no complete regime signature, conflicting EMA/structure evidence, or a state that does not satisfy the explicit rules.
- UNKNOWN: invalid, blocked or insufficient input. It must never be silently converted into a directional regime.

evidence_alignment is a qualitative description of feature agreement (CONVERGENT, PARTIAL, NONE), not a probability or calibrated confidence score.

## 3. Input contract

MarketRegimeEngine.analyze({ snapshot, quality_report, structure_result, policy, timeframe, analysis_as_of_ms })

- snapshot must be a single-timeframe B1 canonical snapshot with provider-derived analysis cutoff.
- quality_report must match the exact snapshot, symbol, timeframe, cutoff, validator version and quality-policy version, and status must be exactly VALID.
- Only snapshot.candles_by_timeframe[timeframe] is used. Forming and unclassified candles are never included in calculations.
- Every closed candle is rechecked for provenance, OHLCV validity, interval alignment, continuity, finality and duplicate timestamps.
- If supplied, structure_result must be a valid B2-C result for the exact same snapshot, symbol, timeframe and cutoff, with the pinned B2-C engine/policy identity. A missing structure result may support a low-evidence range/transition classification but cannot confirm a trend.
- The policy is mandatory, versioned and explicit. There are no hidden numeric defaults.

## 4. Initial policy parameters

The deterministic test policy uses:

| Parameter | Initial value |
|---|---:|
| EMA periods | 20 / 50 / 200 |
| ATR period | 14 |
| Slope lookback | 10 closed candles |
| Range lookback | 20 closed candles |
| Impulse lookback | 5 closed candles |
| Minimum EMA50 slope | 0.20 ATR |
| Minimum EMA200 slope | 0.08 ATR |
| Minimum EMA20/50 spread | 0.05 ATR |
| Minimum EMA50/200 spread | 0.10 ATR |
| Maximum range width | 5.0 ATR |
| Maximum absolute EMA50 slope for range | 0.12 ATR |
| Maximum EMA50/200 spread for range | 0.60 ATR |
| Minimum impulse displacement | 2.5 ATR |
| Minimum recent range expansion | 1.25 × ATR |

These values are initial engineering thresholds for deterministic fixtures only. They are not calibrated market parameters and must not be described as optimal, profitable or production-ready. They require sensitivity analysis and walk-forward evaluation across BTC/ETH and 1H/4H/1D before any decision-path integration.

The initial policy also pins B1 contract/validator/quality-policy identities, B2-C engine 2.1.0-b2c, B2-C policy b2c-state-v2, and the B1 finality safety lag.

## 5. Output

- Engine and policy versions.
- status: VALID, BLOCKED, INVALID or INSUFFICIENT.
- regime, directional_bias, evidence_alignment.
- Exact snapshot identity and analysis cutoff.
- structure_state and explicit reason codes.
- EMA20/50/200, ATR14, normalized slopes/spreads, range width and impulse metrics.
- Diagnostics confirming that only closed candles were used.

All output is deeply immutable. The engine does not mutate the snapshot or upstream structure result.

## 6. Safety boundaries

- Zero or unavailable ATR returns INSUFFICIENT/UNKNOWN; non-finite normalized features are never emitted.
- No forming candle input.
- No look-ahead: every candle must be closed and final by the declared analysis cutoff plus the pinned safety lag.
- No stale/degraded/invalid quality report can produce a regime.
- No mismatch between snapshot and quality report can produce a regime.
- No mismatched B2-C result can be consumed.
- No confidence percentage, win probability, expected return, trade signal or profitability claim.
- No integration into the existing LONG/SHORT/WAIT engine in this increment.

## 7. Verification

tests/market-regime-engine.test.cjs covers bullish/bearish trend, range, impulse, transition, missing structure, non-VALID quality, insufficient history, forming-candle exclusion, provenance mismatch, snapshot mismatch, candle finality, gaps, policy validation, immutability and non-mutation.

The current isolated local run passes 18/18 deterministic tests and the source parses successfully with Node/V8. These are synthetic tests, not historical calibration or live-market validation.

## 8. Next acceptance work

1. Independent review of the exact source and policy.
2. Replay against a pinned historical BTC/ETH OHLCV archive on 1H/4H/1D with prefix cutoffs.
3. Sensitivity analysis around every threshold and lookback.
4. Compare regime transitions with B2-C structure and B7 setup evidence; record false classifications and ambiguous periods.
5. Only after those checks, decide whether to add a read-only UI panel. Directional integration requires a separate approval and validation stage.
