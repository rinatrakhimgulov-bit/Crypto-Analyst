# B8 Opening Schema Audit
Date: 2026-11-28
Status: PASS WITH CONDITIONS — B8-A schema mapping established; outcome validation not yet complete
Base B7 head: `46820a743fc1c08eb34b6c1851315d8b57ef8e1d`

## Scope

Read-only inspection of:
- `docs/specs/B5_MARKET_JOURNAL_SPEC_2026-11-28.md`
- `docs/specs/B7_EXPLAINABLE_SETUP_ENGINE_SPEC_2026-11-28.md`
- B5 capture implementation in `CryptoAnalyst_StageA_S6_updated.html`
- B7 source module `src/analysis/b7-explainable-setup-engine.js`
- B7 historical replay `tools/b2_historical_replay.cjs`
- B5 browser contract test `tests/b5-market-journal-browser-check.cjs`
- B7 historical report `docs/audits/B7_HISTORICAL_REPLAY_2026-11-28.md`

No production HTML or B1/B2/B7 logic was changed.

## Confirmed B5 mapping

The B5 capture implementation:
- writes to `cryptoAnalyst.marketJournal.v1`;
- stores observations in a versioned `crypto-analyst-journal` envelope;
- stores up to 100 observations and 160 candles per observation;
- captures immutable LONG/SHORT/WAIT decision, B1 quality metadata, analysis snapshot, B2 result and candle window;
- marks candle finality as `closed` or `forming`;
- captures B2 by calling `runB2Analysis(dataset)` at observation time;
- stores that return value under `analysisSnapshot.b2`.

The actual `runB2Analysis()` return object includes:
- B2-A/B/C/D/E results;
- B2-G projection;
- `setups`, which is the B7 result from `B7ExplainableSetupEngine.analyze()`;
- snapshot analysis cutoff and timeframe.

Therefore the B7 journal path is `observation.analysisSnapshot.b2.setups.setup_candidates`. B8 must bind to this exact captured payload and must not rerun B7 against a later chart snapshot when evaluating a prospective observation.

B5 candle window fields are `ts`, `closeTs`, `open`, `high`, `low`, `close`, `volume`, `turnover`, and `finality`. Conversion to the evaluator's canonical OHLCV shape must preserve timestamps and exclude any `forming` candle from closed-bar outcomes.

## Confirmed B7 mapping

B7 candidate fields include:
- `setup_id`, `setup_type`, `direction`, `status`;
- `available_at_ms`;
- `evidence`, `reason_codes`, `explanation`;
- `invalidation_level`.

The evaluator must only score `CONFIRMED` candidates. Pending and blocked states remain coverage diagnostics.

## Historical replay limitations

The current B7 replay:
- loads the immutable dataset commit `9ca04178df06ce649f00779a49e11094fe5b1c70` from `mestoness/btc-eth-candles-history`;
- covers BTCUSDT and ETHUSDT on 1h, 4h and 1d;
- runs five 160-candle windows per series plus three prefix cutoffs per series;
- uses a synthetic B1-VALID wrapper and fixed 500ms time-derived finality;
- does not model entries, exits, fees, funding, slippage, trade outcomes or expectancy;
- ends on 2025-12-05.

The 40 candidate appearances in the B7 report are not yet a deduplicated event population. B8 must not present them as 40 independent trades or compute a win rate from them.

## Methodology decisions fixed for B8

1. Baseline historical entry is the close of the first candle whose finality availability is strictly later than candidate `available_at_ms`. This avoids using a candle open that predates the candidate's availability.
2. Forward-return, MFE and MAE metrics are descriptive price-path outcomes, not simulated trade wins.
3. Barrier simulation is secondary, parameterized and conservative. Same-bar stop/target ambiguity resolves stop-first; gap-through-stop uses the adverse open proxy.
4. Net cost-adjusted results are shown only when all fee/slippage assumptions are explicitly supplied. Funding remains unknown unless an observed series is supplied and actually applied.
5. Historical research candidates, prospective B5 observations and actual B5 trades remain separate populations.
6. Chronological split and candidate deduplication are mandatory; random splitting and duplicate appearances across overlapping windows are prohibited.

## Initial implementation checkpoint

B8 branch `feature/b8-statistical-validation-2026-11-28` adds:
- `docs/specs/B8_STATISTICAL_VALIDATION_SPEC_2026-11-28.md`;
- pure causal outcome evaluator `src/research/b8-outcome-evaluator.js`;
- descriptive statistics `src/research/b8-statistics.js`;
- deterministic unit fixtures `tests/b8-outcome-evaluator.test.cjs`;
- GitHub Actions workflow `.github/workflows/b8-statistical-validation.yml`.

The evaluator selects a post-availability closed-candle entry proxy, computes directional forward returns/MFE/MAE, evaluates explicit invalidation/target barriers, applies stop-first handling to same-bar ambiguity, and leaves net results unavailable unless all four fee/slippage inputs are present. Funding is explicitly not applied by this initial evaluator.

## Open work

- Confirm exact-head CI and review arithmetic with independent hand calculations.
- Add a dedicated B8 historical candidate generator with stable-ID deduplication and pinned provenance.
- Add chronological train/validation/test or walk-forward reporting, coverage/exclusion accounting and dependence-aware uncertainty.
- Add strict B5 JSON import/normalization that never mutates the source envelope.
- Validate actual-trade records separately from paper observations.
- Conduct independent review of timing, leakage, cost assumptions and statistics.

## Decision

B8-A schema mapping is complete with conditions. B8-B evaluator implementation is in progress. No profitability conclusion is possible at this checkpoint, and no production decision path or UI has changed.


## Verification update — 2026-11-28

Initial deterministic implementation CI passed:
- evaluator/statistics run `46116869096` — SUCCESS;
- evaluator + journal adapter run `46116871532` — SUCCESS.

The first CI iterations exposed incorrect fixture expectations, not syntax defects: one forward-return expected value pointed to the wrong close, and barrier fixtures had placed the touch in the entry candle. The fixtures were corrected to test post-entry outcomes. Cost arithmetic was also tightened to apply exit costs to exit notional rather than entry notional.

B8-B is therefore implemented with passing deterministic unit coverage, subject to independent review. Historical census/OOS and prospective journal validation remain incomplete.
