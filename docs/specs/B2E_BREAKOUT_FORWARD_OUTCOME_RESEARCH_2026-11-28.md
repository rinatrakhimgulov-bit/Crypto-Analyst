# B2-E breakout forward-outcome evaluation — 2026-11-28

## Question

Do B2-E breakout-candle evidence labels (STRONG / MIXED / WEAK) correspond to directional follow-through after a close-confirmed structural break?

## Signal construction

For each candidate event:
1. Discover B2-C close-confirmed BOS/CHOCH events from six BTCUSDT/ETHUSDT series on 1H/4H/1D.
2. Reconstruct the event using exactly 260 closed candles ending at the breakout candle.
3. Re-run B2-A/B/C, B2-D and B2-E at that event-time cutoff.
4. Use B2-E quality features from the breakout candle and strictly prior candles. ATR and zone/retest policy are measured at the event-time cutoff.
5. Only evaluate events that match a historical B2-D zone and create a B2-E lifecycle.
6. Measure future candles only in the evaluation stage, never as signal input.

Policy for this candidate: 0.15 ATR zone span, 0.05 ATR retest touch/success/failure buffer.

## Outcome metrics

At 5, 10 and 20 bars after the breakout:
- direction-adjusted close return / ATR-before-break;
- maximum favorable excursion / ATR-before-break;
- maximum adverse excursion / ATR-before-break;
- positive direction-adjusted close rate;
- rate of at least +0.5 ATR;
- rate of at least -0.5 ATR adverse close.

A positive direction-adjusted return means price moved in the breakout direction. A negative return means it moved against it.

## Preliminary aggregate result

The replay evaluated 2,980 zone-matched breakouts:

| Quality label | Events | Median return 5 bars | 10 bars | 20 bars |
|---|---:|---:|---:|---:|
| STRONG_EVIDENCE | 1,886 | -0.183 ATR | -0.198 ATR | -0.143 ATR |
| MIXED_EVIDENCE | 731 | -0.226 ATR | -0.150 ATR | -0.218 ATR |
| WEAK_EVIDENCE | 363 | -0.113 ATR | -0.158 ATR | -0.170 ATR |

Positive close rates across aggregate labels were approximately 41–49% depending on horizon. Strong evidence did not outperform the other labels consistently in median directional return or positive-close rate.

## Interpretation

The current B2-E evidence labels do not demonstrate a clear directional follow-through edge in this pinned historical sample. In particular, STRONG_EVIDENCE must not be interpreted as a probability, a high-confidence LONG/SHORT signal, or proof that the breakout will continue.

This does not prove the breakout engine is useless. The result is limited by sparse event discovery, timeframe effects, overlapping forward windows and old data. It does mean the evidence labels are not validated as predictive confidence and should remain outside the decision path.

## Coverage diagnostics

Across all six series, 8,091 unique B2-C break events were discovered in sampled windows:
- 920 could not be reconstructed because the required event-time history was unavailable at the archive boundary;
- 4,191 reconstructed events did not match a B2-D zone / B2-E lifecycle at event time;
- 2,980 were evaluated as zone-matched breakouts.

Daily samples are much smaller than intraday samples, and some daily quality groups contain very few events.

## Limitations

- Archive ends 2025-12-05 and excludes 2026.
- Discovery uses approximately 14-day-spaced snapshots; events between samples are missed.
- Forward horizons overlap and observations are not statistically independent.
- This is not a trading strategy backtest. No entries, exits, stop-loss, take-profit, fees, funding, slippage, PnL, expectancy or drawdown are evaluated.
- No confidence intervals, hypothesis correction or independent holdout period are included.
- The evaluation uses event-time ATR and causal signal reconstruction, but still depends on the existing B2-C/B2-D/B2-E event definitions.

## Decision

- Keep B2-E quality labels as descriptive evidence only.
- Do not connect them to LONG/SHORT/WAIT as predictive confidence.
- Next research should investigate false-break/reclaim behavior, event-type and timeframe stratification, denser event discovery, confidence intervals, and a fresh 2026 archive.
- PR #47 remains Draft.
