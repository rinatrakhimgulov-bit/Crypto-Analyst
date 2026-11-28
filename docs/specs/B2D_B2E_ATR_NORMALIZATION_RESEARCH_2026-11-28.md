# B2-D / B2-E ATR normalization sensitivity — 2026-11-28

## Question

The app currently derives B2-D zone cluster width and B2-E retest touch/success/failure buffers from median close:
- maximum zone span = median close × 0.10%;
- each retest buffer = median close × 0.05%.

This is instrument-price-relative, but it does not adapt to the volatility of the selected timeframe. The research replay compares that baseline with current-snapshot ATR-normalized candidates.

## Method

- Pinned archive: \`mestoness/btc-eth-candles-history\`, commit \`9ca04178df06ce649f00779a49e11094fe5b1c70\`, coverage ends 2025-12-05.
- Six series: BTCUSDT and ETHUSDT, 1H / 4H / 1D.
- 780 chronological snapshots total, each using 260 closed candles and approximately 14-day stride.
- ATR(14) calculated with Wilder smoothing from the 260 closed candles available at each cutoff.
- Compared baseline against zone widths 0.10 / 0.15 / 0.20 / 0.25 ATR and retest buffers 0.05 / 0.10 / 0.15 ATR.
- The same buffer is used for retest touch tolerance, success buffer and failure buffer.
- Existing B2-D and B2-E engines are reused. The policy values change; the engine algorithms do not.
- Causal cutoff assertions passed for every sampled candidate window.

## Aggregate findings

| Policy | Support available | Resistance available | Mean active zones/window | Confirmed zones/window | B2-E lifecycles |
|---|---:|---:|---:|---:|---:|
| Current price-ratio baseline | 35.5% | 35.4% | 1.23 | 10.24 | 2,658 |
| 0.10 ATR / 0.05 ATR | 46.3% | 46.4% | 1.59 | 14.07 | 3,887 |
| 0.15 ATR / 0.05 ATR | 56.3% | 56.5% | 2.06 | 17.12 | 4,930 |
| 0.20 ATR / 0.05 ATR | 63.2% | 63.2% | 2.43 | 18.80 | 5,675 |
| 0.25 ATR / 0.05 ATR | 67.2% | 66.4% | 2.64 | 19.71 | 6,313 |

The baseline's effective ATR-normalized price ratios across the 780 windows were:
- zone span: p10 0.0123 ATR, median 0.0192 ATR, p90 0.0300 ATR;
- retest buffer: p10 0.0062 ATR, median 0.0096 ATR, p90 0.0150 ATR.

This shows why the fixed price percentage behaves differently across timeframes. Baseline support/resistance availability was only 8–20% on the two daily series, while the 0.15 ATR candidate produced 50–59% availability on both daily series.

## Provisional engineering candidate

Use \`0.15 ATR\` for zone cluster span and \`0.05 ATR\` for retest touch/success/failure buffers as the next candidate for deeper validation.

Why this candidate:
- It raises aggregate support/resistance availability by about 21 percentage points over the baseline.
- It is less expansive than 0.20 / 0.25 ATR, which create substantially more zones and breakout lifecycles.
- Its availability is more even across all six symbol/timeframe series than the current fixed price-ratio baseline.

This is an engineering compromise for the next research stage, not a proven optimum and not approved for production decisions.

## Retest buffer observations

At 0.15 ATR zone width, increasing retest buffer from 0.05 to 0.10 to 0.15 ATR changed lifecycle label proportions:
- successful retests: 48.3%, 49.9%, 52.1%;
- failed retests: 33.9%, 32.8%, 30.5%;
- waiting / pending / unresolved: 3.1%, 3.9%, 5.4%.

These are descriptive lifecycle labels, not predictive success rates. A wider buffer changes the classification boundary itself, so a higher successful-label share is not evidence of better prediction. Keep 0.05 ATR as the conservative candidate pending forward-outcome validation.

## Critical limitation

The replay applies ATR measured at the current snapshot cutoff to that snapshot's historical pivot clustering and retest policy. It is not per-pivot or per-breakout ATR normalization. This is useful for a first sensitivity comparison but is not sufficient for final production policy.

Before production integration:
1. Evaluate pivot-time ATR for B2-D cluster normalization.
2. Evaluate breakout-time ATR for B2-E touch and outcome buffers.
3. Add forward outcome evaluation after each breakout and retest, using future windows that are kept separate from signal construction.
4. Review false-break and successful-break cases on actual charts.
5. Refresh the historical archive through 2026 and repeat out-of-sample checks.

## Scope and safety

- No changes to the current app HTML or LONG/SHORT/WAIT path in this PR.
- No autotrading.
- No profitability, win-rate or calibrated-probability claim.
- Historical data ends 2025-12-05; 2026 data is not represented.
- PR #44 remains Draft pending the next validation stage and owner review.
