# B8 review follow-up — 2026-11-28

PR: #28  
Branch: `feature/b8-statistical-validation-2026-11-28`  
Reviewed implementation head: `8afa9085d059bf18311bc4253a09f9160e6fcd70`  
Exact-head workflow run: `46118732603` — SUCCESS  
Historical report artifact: `b8-historical-validation-report` (run `46118732603`)

## Current disposition

B8 is materially advanced, but it is **not accepted for production integration** and must remain research-only. The successful workflow proves that syntax checks, deterministic tests, pinned replay, outcome evaluation and artifact upload completed on the exact head. It does not prove profitability or validate a live prospective cohort.

## Independent review findings

| Finding | Current status | Evidence / limitation |
|---|---|---|
| R1 — chronological split contamination | Corrective implementation present; exact-head CI passes | The runner calculates the 12-bar outcome endpoint before split assignment and purges TRAIN/VALIDATION candidates whose endpoint reaches or crosses the next boundary. Purged records remain explicit and are not reassigned. |
| R2 — sparse five-window candidate population | Corrective implementation present; still a sampled census | B7 is now scanned on 160-candle windows at an 80-bar stride plus the final endpoint. This is denser, not exhaustive; events that form and disappear between cutoffs can still be missed. |
| R3 — dependence-aware uncertainty | First-pass weekly date-block bootstrap implemented | The report provides weekly block bootstrap intervals where enough calendar-week blocks exist and returns an insufficient-block status for sparse groups. These are exploratory intervals: residual serial dependence across adjacent weeks and cross-symbol/timeframe dependence are not captured. |
| R4 — prospective B5 cohort | Adapter/report implemented; real cohort not yet validated | The adapter validates and normalizes an explicit B5 JSON export, preserving WAIT/no-setup coverage and separating actual trades. No user export has been supplied, so no prospective outcome conclusion exists. B5 capture and follow-ups remain manual; no automatic capture is claimed. |
| R5 — costs and funding | Explicitly unresolved due unavailable observations | The historical run supplies no fee, spread, slippage or funding observations. Current forward-return/MFE/MAE results are gross path descriptors, not net performance or expectancy. |

## Exact-head historical report

Pinned dataset: `mestoness/btc-eth-candles-history` at commit `9ca04178df06ce649f00779a49e11094fe5b1c70`.

- 1,474 causal B7 scan windows across BTCUSDT/ETHUSDT and 1H/4H/1D.
- 3,272 candidate appearances deduplicated to 2,546 unique setup IDs.
- 2,403 confirmed and 143 pending candidates.
- 696 candidates had conflicting window-derived invalidation levels; those levels are nulled rather than choosing a favorable proxy, so barrier scoring is unavailable for them.
- One candidate had an availability-time conflict; the later timestamp is retained conservatively.
- The 1H TEST cohorts contain more observations than the 4H/1D cohorts, but several setup/direction groups remain small. The report's subgroup intervals frequently include zero.
- The archive ends on 2025-12-05. Replay uses a synthetic B1-VALID wrapper and fixed 500 ms time-derived finality, not observed provider finality.

No win-rate, accuracy, expectancy or profitability claim is supported by this report. Positive forward close returns are not trade wins. Barrier results are OHLC research simulations, not executable fills.

## Remaining acceptance gates

1. Reconcile this follow-up with a fresh independent source review of the exact current head, especially the weekly bootstrap assumptions, candidate identity/timestamp reconciliation, barrier math and split-purge boundary semantics.
2. Keep the weekly bootstrap caveat explicit; do not describe calendar weeks as truly independent market episodes.
3. Validate the B5 adapter against an actual owner-exported JSON file when available. Until then, B8-D is schema/coverage tooling only.
4. Keep cost/funding outputs unavailable unless defensible, timestamp-aligned inputs are supplied.
5. Run exact-head CI again after any corrective commit.
6. Preserve the stacked dependency order. PR #28 is based on B7 branch; it cannot be integrated into `main` ahead of B7/B6/B5/B4. Do not change production HTML or the LONG/SHORT/WAIT decision path from this research PR.

## Decision

**B8-C exploratory pipeline: implemented and exact-head CI passed.**  
**B8-D prospective evidence: awaiting an actual B5 export and future outcome observations.**  
**B8-E independent audit: not yet closed.**  
**PR #28: keep Draft / do not merge yet.**
