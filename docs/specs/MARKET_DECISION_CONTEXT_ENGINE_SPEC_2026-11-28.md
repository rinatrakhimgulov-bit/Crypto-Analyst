# Market Decision Context Engine v1.0.0

## Purpose

Create a conservative, explainable research-only LONG/SHORT/WAIT candidate from existing validated analytics. This is a context-fusion layer, not a new indicator and not a production trade signal.

## Inputs and exact identity

Requires one B1 snapshot/quality report and exact matching outputs from:
- B2-C structure,
- B2-E breakout/retest lifecycle,
- B2-D zone context,
- B2-E breakout quality,
- Market Regime,
- Market Impulse Event,
- B7 explainable setup candidates.

Every upstream output must be VALID, match the same snapshot ID, symbol, timeframe and analysis cutoff, and match the explicitly versioned engine/policy in the decision policy. Any mismatch fails closed.

## Directional gates

LONG is emitted only when all are true:
1. Market Regime is UPTREND with BULLISH directional bias.
2. B2-C structure is UP and agrees with the regime.
3. At least one causal B7 CONFIRMED LONG setup exists.
4. A BREAKOUT_RETEST candidate must match a B2-E RETEST_SUCCESSFUL lifecycle and a B2-E Breakout Quality STRONG_EVIDENCE result.
5. A FALSE_BREAKOUT_RECLAIM candidate must match a B2-E RETEST_FAILED lifecycle and its causal failure confirmation.
6. No confirmed candidate points the opposite direction.
7. No confirmed bearish impulse/sell-off or unconfirmed bearish displacement conflicts with LONG.

SHORT is symmetric: DOWNTREND + BEARISH bias + DOWN structure + confirmed B7 SHORT setup, with the same breakout-quality/retest checks and no opposing bullish impulse context.

TREND_CONTINUATION_AFTER_CORRECTION candidates are eligible only after B7 has already confirmed them and regime/structure alignment agrees.

## WAIT conditions

WAIT is returned when:
- no causal confirmed setup exists;
- a setup is pending;
- regime is RANGE, IMPULSE, TRANSITION or UNKNOWN;
- regime and structure disagree;
- setup direction opposes regime/structure;
- confirmed candidates conflict by direction;
- breakout/retest or breakout-quality evidence is incomplete;
- an opposing impulse conflicts with the candidate.

## Output

- \`decision\`: LONG / SHORT / WAIT.
- \`decision_type\`: always \`RESEARCH_CANDIDATE_ONLY\`.
- \`directional_bias\`, regime, structure, impulse classification and displacement.
- nearest support/resistance with ATR distance and freshness.
- breakout quality counts, selected B7 setup IDs and invalidation levels.
- named gates and reason codes.

No probability, confidence score, entry price, stop-loss, take-profit, leverage, position sizing or execution instruction is produced.

## Boundaries

- Does not modify the existing HTML or BasicAnalyticsEngine LONG/SHORT/WAIT path.
- Does not use B2-F MTF as a directional gate; live provider-time calibration remains outstanding.
- Does not change upstream B2/B7 modules.
- All thresholds are inherited from versioned upstream policies and remain uncalibrated.
- No profitability or predictive-edge claims. Historical prefix replay is required before considering UI integration.


## 2026-11-28 prefix replay result

On the pinned BTC/ETH archive, the decision candidate produced 23 LONG, 11 SHORT and 440 WAIT results across 474 regular-stride prefixes. Every prefix passed deterministic repeat and cutoff assertions. This is only signal-frequency distribution; prefixes overlap and no trade outcome was evaluated. The module remains research-only and is not connected to the production HTML decision path.
