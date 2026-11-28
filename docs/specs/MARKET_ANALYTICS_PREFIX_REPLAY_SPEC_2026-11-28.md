# Market Analytics Prefix Replay v1

## Purpose
Replay the new Market Regime, B2-D zone-context, B2-E breakout-quality and Market Impulse Event candidates on a pinned BTC/ETH USDT perpetual OHLCV archive using repeated causal prefixes.

## Dataset
- Repository: \`mestoness/btc-eth-candles-history\`
- Immutable commit: \`9ca04178df06ce649f00779a49e11094fe5b1c70\`
- Series: BTCUSDT and ETHUSDT, 1h/4h/1d.

## Method
- Every evaluation uses a 240-candle input prefix.
- Samples are taken every 250 candles, with the final archive candle always included.
- B2-A through B2-E are recomputed on each prefix using the same existing replay helper and policy family.
- Each prefix then runs B2-D Zone Context, B2-E Breakout Quality, Market Regime, Market Impulse Event Engine, B7 and the research-only Market Decision Context Engine.
- Every prefix is replayed twice; compact outputs must be byte-identical.
- All breakout and retest availability timestamps and impulse-window end times must be at or before the prefix cutoff.
- The replay reports regime labels, impulse labels, research-only LONG/SHORT/WAIT decision candidates, breakout evidence classes, bearish retest context and zone counts by series.
- One-factor impulse sensitivity varies displacement, selloff displacement, range expansion, volume expansion and directional-pressure thresholds while holding all other baseline parameters fixed. These are descriptive classification-frequency checks only; they do not select a new policy.

## Explicit limitations
- This is a regular-stride exploratory sample, not an exhaustive event census.
- B1 quality is a synthetic VALID wrapper after CSV integrity checks; the production B1 validator is not run.
- Historical finality is time-derived with a fixed 500ms lag.
- Current thresholds are uncalibrated engineering defaults. Sensitivity variants are not parameter optimization and must not be used to select thresholds on this same sample.
- No trade outcomes, returns, fees, funding, slippage, expectancy or profitability are measured.
- The output does not authorize changing the production LONG/SHORT/WAIT path.

## Acceptance gates
- Exact pinned dataset commit recorded.
- All 6 symbol/timeframe series load and pass CSV integrity checks.
- Every sampled prefix yields VALID outputs from all four analytical layers.
- Deterministic repeat check passes for every prefix.
- No breakout, retest or impulse output is available after its prefix cutoff.
- Workflow uploads the JSON report as an artifact.

## 2026-11-28 replay result

Exact-head GitHub Actions run 46167377937 passed on `5a2d0161c9f62636f8bb39f1ea2c7786abc1e3b3`. It evaluated 474 prefixes: BTCUSDT 1h/4h/1d (200/50/9) and ETHUSDT 1h/4h/1d (166/42/7). Deterministic repeat and cutoff checks passed for all 474.

After correcting the research policy's directional-pressure threshold from 0.67 to exact 2/3, the baseline classification counts were:
- STRONG_SELL_OFF: 17
- BEARISH_IMPULSE: 15
- BULLISH_IMPULSE: 34
- DIRECTIONAL_MOVE_UNCONFIRMED: 51
- NO_IMPULSE: 357

The one-factor sensitivity scan shows strong sensitivity to the directional-pressure threshold. These are overlapping, correlated prefix observations, not unique independent events and not trading outcomes. The report is a causal/engineering diagnostic only.
