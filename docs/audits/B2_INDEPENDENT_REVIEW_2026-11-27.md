# B2 Independent Review — 2026-11-27

## Scope and evidence

This review was performed against the B2-G candidate tree at commit `2a235ec9a74305bf2ee9ab47a4780226035c2cc3`, currently represented by draft PR #20. The review inspected the B2-A through B2-G implementation files, their deterministic test files, the B2-F and B2-G workflow definitions, and the current project-state documentation.

This is a source-level review. It is not a live Bybit validation, a historical-market-data run, a browser/Safari test, or a profitability assessment.

## Verified repository state

The following draft PRs exist and remain unmerged:

- #12 B2-A causal swing pivot engine
- #13 B2-B swing sequence engine
- #15 B2-C BOS/CHoCH state machine
- #16 B2-D support/resistance zone engine
- #17 B2-E breakout/retest lifecycle
- #19 B2-F multi-timeframe structure confluence
- #20 B2-G causal chart projection contract

The B2-G candidate tree contains all seven corresponding source modules and deterministic test files.

Previously reported CI counts are confirmed in the repository's run metadata:
- B2-A through B2-E: 119/119 deterministic tests
- B2-A through B2-F: 149/149 deterministic tests

These counts establish only that the synthetic test suites passed in their recorded CI runs. They do not establish correctness on real market history.

## Positive findings

1. B2-A uses symmetric pivot confirmation and records source, confirmation, and availability timestamps.
2. The current B2-B candidate excludes simultaneous same-candle high/low pivot pairs from the alternating sequence while preserving raw evidence. B2-C verifies this policy; B2-D rejects ambiguous pivots as zone inputs.
3. B2-B derives alternating swing sequence labels and rejects invalid pivot availability ordering.
4. B2-C evaluates closed candles chronologically, admits pivots only according to their availability time, and evaluates a candle's break before admitting pivots that become available at that candle close.
5. B2-C includes explicit gap rejection and prefix-replay tests.
6. B2-D and B2-E validate pivot provenance against source candles and reject candle gaps.
7. B2-E records breakout, retest, and confirmation lifecycle timestamps rather than backdating confirmation.
8. B2-F requires a common MTF cutoff, checks provider-time spread against a configured maximum, and validates timeframe snapshot/quality identity.
9. B2-G separates chart anchor time from visible/available time and blocks future-dated pivots, events, zones, and retest confirmations.

## Blocking gaps before production integration

### BLOCKER-1: complete historical-market-data validation is not yet demonstrated

A preliminary historical replay report already exists at `docs/audits/B2_PRELIMINARY_HISTORICAL_REPLAY_2026-11-27.md`. It checks third-party archived BTCUSDT/ETHUSDT OHLCV integrity and pivot sensitivity, but explicitly does not execute the complete B2-A→B2-G chain on the historical rows. The inspected CI workflows still run deterministic synthetic fixtures. A full historical engine-chain replay over BTCUSDT and ETHUSDT, 1H/4H/1D, remains outstanding.

Required before integration:
- fetch reproducible historical windows from Bybit V5 Linear Kline;
- preserve raw response and capture metadata;
- normalize through the actual B1 contract and quality validator;
- execute B2-A through B2-G without hand-crafted intermediate outputs;
- report rejected windows, gaps, and quality failures;
- compare results across trending, ranging, impulsive, reversal, and false-breakout periods;
- save input hashes and output summaries for repeatability.

### HIGH: simultaneous dual-pivot correction needs full historical regression

The preliminary replay identified same-source-candle high+low pivots as ambiguous because OHLCV does not reveal intrabar order. The current B2-B candidate now implements `EXCLUDE_BOTH_FROM_SEQUENCE_V1`, preserves both raw observations with `AMBIGUOUS_FOR_SEQUENCE`, and B2-C independently verifies and excludes those pivots from the structure sequence. B2-D rejects ambiguous sequence statuses for zone construction. This is a substantive correction to the earlier replay report, not an unresolved code omission. However, the correction still needs a full B2-A→B2-G replay against the historical dataset, with explicit counts proving that no ambiguous pivot becomes a BOS/CHoCH source or S/R zone. Add regression coverage through B2-E and B2-G as well.

### BLOCKER-2: MTF provider-time spread is not empirically calibrated

B2-F gates on `max_provider_time_spread_ms`, but its deterministic fixture uses a configured 50 ms threshold and synthetic provider-time offsets. This is not empirical calibration of the actual Bybit REST acquisition path. The B2-F directional permission must remain disabled for production until repeated concurrent 1D/4H/1H captures establish an evidence-based spread policy and its failure behavior.

### BLOCKER-3: end-to-end B1-to-B2 runtime integration is not demonstrated

The inspected B2 modules accept canonical B1 snapshots and quality reports, but the candidate chain has not yet been demonstrated end-to-end against live B1 acquisition, validation, cancellation/supersession, and stale/failure paths in the target browser runtime.

### BLOCKER-4: B2-G is a projection contract, not UI integration

B2-G produces causally timed chart projection data. It does not itself wire swing markers, BOS/CHoCH, zones, retest states, or MTF context into the existing application UI. The actual UI integration must be performed only after the analytical gates above pass.

## Important limitations and interpretation

- HH/HL/LH/LL, BOS/CHoCH, support/resistance zones, and retest states are deterministic structural descriptions under the selected policies. They are not independently validated trading edges.
- A successful historical structural classification does not prove that a trade should be opened.
- No LONG/SHORT/WAIT decision, probability, confidence, entry, stop, or take-profit should be derived from B2 alone.
- The 50 ms MTF spread value is a configured policy input, not a proven market-data quality threshold.

## Decision

**NOT READY FOR MAIN-APPLICATION INTEGRATION.**

Continue with a dedicated historical-data validation harness and live MTF acquisition calibration. Keep all B2 code isolated from `main`. Do not merge PRs #12–#20 or enable B2 directional decisions until the blockers above are closed and the target runtime is verified.
