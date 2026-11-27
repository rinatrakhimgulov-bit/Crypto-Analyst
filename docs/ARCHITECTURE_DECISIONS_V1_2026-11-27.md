# Architecture Decisions — Crypto Analyst v1.0

**Date:** 2026-11-27  
**Status:** Proposed baseline for owner review; implementation remains incremental.  
**Canonical product roadmap:** `docs/ROADMAP.md`  
**Current integration branch:** `integration/b1-mtf-architecture-2026-11-27`  
**Main branch:** unchanged.

This document closes the major product/architecture questions that can be decided now. It does not claim that planned modules are already implemented. Decisions may be revised only when measurements, tests, provider constraints, or a concrete product requirement justify the change.

## 1. Product definition

Crypto Analyst is a personal research and decision-support application for crypto perpetual futures. Its job is to convert reliable market data into explainable, testable market context and trade scenarios.

The application is not:
- an exchange;
- an automatic order executor;
- a guaranteed signal or profit generator;
- a collection of indicators without a validated decision process;
- a public multi-tenant SaaS product in the current scope.

The user retains final control over every trade. The application may recommend LONG, SHORT, or WAIT only when the data and analytical prerequisites are satisfied.

## 2. Initial market scope

- Venue/provider for the first production-like workflow: Bybit V5.
- Market: linear USDT perpetuals.
- Initial instruments: BTCUSDT and ETHUSDT.
- Core timeframes: 1D, 4H, 1H.
- Closed candles are the only source for directional calculations. Forming candles may be displayed as live context, but must not silently affect closed-candle indicators, pivots, structure breaks, historical labels, or backtests.
- Additional symbols, venues, spot markets, equities, and altcoin breadth are deferred until the initial pipeline is validated.

## 3. Architectural boundaries

The application is organized into replaceable layers:

1. **Provider adapters** — exchange-specific transport, parsing, rate limits, retries, and raw provenance.
2. **Canonical data contract** — provider-neutral candles, snapshots, time/finality metadata, coverage, and quality reports.
3. **Data quality and synchronization** — fail-closed validation, freshness, gaps, duplicate handling, common as-of cutoff, and MTF completeness.
4. **Feature and analytics engines** — deterministic calculations that consume canonical closed data, not provider payloads.
5. **Scenario engine** — combines validated evidence into LONG/SHORT/WAIT, reasons, invalidation conditions, and expiry.
6. **Research/validation layer** — historical replay, event labels, backtests, out-of-sample and walk-forward evaluation.
7. **Risk planning** — position sizing, stop/target, fees, funding, slippage, leverage and liquidation distance.
8. **Presentation layer** — chart, status, evidence, diagnostics and user controls. UI must not own business calculations.

No analytical engine may call Bybit APIs directly. No UI component may independently recalculate a decision. A provider adapter may not decide whether a setup is bullish or bearish.

## 4. Data and synchronization decisions

- REST remains the authoritative source for the initial snapshot and refresh workflow.
- WebSocket remains LOG-ONLY until a measured requirement justifies a role change. It must not silently override REST candles or authorize a directional decision.
- All timestamps are UTC epoch milliseconds internally.
- Provider time, local receive time, request start/completion time, and analysis cutoff are distinct fields. They must never be substituted for one another.
- Missing/untrusted provider time cannot be promoted to trusted directional data by using the device clock.
- Every analysis snapshot has an explicit as-of time and provenance.
- MTF analysis requires all required timeframes to be assembled against one trusted common cutoff. Mixing fresh and stale timeframes is prohibited.
- A provider-time spread policy must be measured from live captures. No arbitrary production default is permitted. Until calibrated, MTF may run in observation/test mode but must fail closed for directional decisions.
- Cache may preserve a chart for context. A failed refresh or expired cache must suppress direction and show WAIT/STALE.
- A forming candle must remain isolated from closed-candle calculations. Before it can influence any directional feature, its own schema, alignment and OHLCV validation must be explicitly specified and tested.

## 5. Analytics decisions

The analytical sequence is:

1. Data quality and synchronized as-of snapshot.
2. Causal swing/pivot detection.
3. Market structure: HH, HL, LH, LL.
4. Structure events: BOS and CHoCH with confirmed levels and closed-candle confirmation.
5. Support/resistance zones derived from confirmed evidence.
6. Breakout, retest and failed-breakout classification.
7. Volatility/regime context.
8. Pattern/volume evidence.
9. Multi-timeframe synthesis.
10. Scenario output LONG/SHORT/WAIT.
11. Historical validation and calibration.
12. Risk plan.

This is a dependency order, not a promise that each item will become a separate large software subsystem.

### Causality and no-lookahead rules

- A swing is not available at its visual pivot candle until the required right-side confirmation bars have closed.
- Every derived event must retain both its source candle time and the time it became knowable (`confirmedAt` / `availableAt`).
- BOS/CHoCH must use only levels that were already confirmed at the decision timestamp.
- Historical backtests must replay information in the order it became available. No future candle, revised label, or future-confirmed pivot may leak into an earlier decision.
- A chart may visually anchor a confirmed pivot at its historical pivot bar, but the tooltip/metadata must expose the later confirmation time to prevent false interpretation.
- Equal highs/lows, duplicate pivots, missing bars, session boundaries and insufficient lookback must have explicit deterministic rules.

## 6. Decision and evidence contract

Every scenario must contain:
- decision: LONG, SHORT, or WAIT;
- instrument and market;
- analysis as-of timestamp;
- data-quality and synchronization status;
- timeframe context;
- supporting evidence with source references;
- conflicting evidence;
- activation condition;
- invalidation condition;
- stop/target proposal only when supported by a defined method;
- scenario expiry or invalidation time;
- reasons for WAIT when no directional scenario is permitted.

A score is not a probability unless calibrated against out-of-sample outcomes. The UI must not display arbitrary confidence percentages.

A valid data snapshot is necessary but not sufficient for a trade signal. Analytics quality and strategy validation are separate release gates.

## 7. Language, runtime and deployment

- Keep the existing JavaScript implementation for the current prototype and near-term integration.
- Do not rewrite the application in React, TypeScript, Python, or another stack merely for fashion.
- TypeScript may be adopted incrementally if module boundaries and static contracts become a demonstrated maintenance benefit; it is not a prerequisite for B2.
- Python may be used separately for offline research, data analysis and backtesting if it materially improves those tasks. The runtime app remains provider-neutral and consumes documented outputs.
- No always-on backend is required for the current single-user local prototype.
- Browser-first delivery is the target. iPhone Safari and desktop browser are required user environments.
- A hosted backend becomes justified only when there is a concrete need for cross-device persistence, scheduled/background collection, centralized history, notifications, or compute that cannot reliably run in the browser.
- Backend, database, authentication and hosting provider remain intentionally unselected until those requirements exist. Do not invent infrastructure before the product needs it.

## 8. Storage decisions

- Current prototype: lightweight browser-local settings/cache only where necessary; cache is never a substitute for fresh validated market data.
- Research datasets and reproducible captures should be stored as versioned files/fixtures in the repository or a separate dataset store, with source, capture time, schema version and integrity hash.
- If persistent multi-session market history is required, choose a server-side database after measuring data volume and query patterns. Do not prematurely lock into a specific vendor.
- Derived analytics must be reproducible from raw/canonical inputs and versioned algorithm parameters.

## 9. Testing and release gates

Each module requires:
- deterministic unit tests for mathematical rules and boundaries;
- property/invariant tests where practical;
- regression fixtures from synthetic and recorded provider data;
- no-lookahead tests;
- integration tests from adapter through canonical data to the consuming engine;
- browser tests for actual UI rendering and state transitions;
- mobile Safari checks for changes that affect the user-facing interface;
- explicit disclosure when live provider tests are blocked or skipped.

A passing mock test does not prove live exchange connectivity. A passing browser test does not prove analytical edge. A profitable-looking backtest does not prove future profitability.

No stage is accepted merely because its code exists or its author reports success. Acceptance requires source identity, reproducible tests, documented limitations and review of the exact candidate artifact.

## 10. Security and operational constraints

- No API trading keys are required for the current read-only product.
- Never store exchange secrets in client-side HTML or repository files.
- If authenticated endpoints are ever needed, secrets belong on a server-side secret store, not in browser code.
- No order placement or auto-trading without a separately approved product scope and security review.
- External provider failures, rate limits, clock anomalies and stale data must be visible and fail closed.
- Diagnostics must avoid leaking secrets or private account data.

## 11. Deferred decisions

The following are deliberately not decided now:
- server vendor and deployment topology;
- database vendor;
- TypeScript/React migration;
- second exchange/provider;
- WebSocket promotion to authoritative data;
- public multi-user access;
- news/macro integration;
- order-flow/footprint data;
- automated order execution.

These are not unanswered blockers. They are decisions deferred until a real requirement and evidence exist.

## 12. Current release gates and next sequence

1. Consolidate B1-A/B/C with the reviewed B1-E common-cutoff design without merging divergent branches wholesale.
2. Independently review the exact consolidated candidate.
3. Capture real Bybit 1D/4H/1H provider-time and latency data; calibrate common-cutoff spread policy.
4. Test current candidate on iPhone Safari, including visible quality reasons and blocked WAIT.
5. Complete all regression and browser checks; obtain explicit owner acceptance before main merge.
6. Only then open B2 Market Structure implementation.
7. B2 must begin with a written causal specification and deterministic no-lookahead test matrix before code integration.

**Current truth:** B1/C1 candidate exists on a non-main branch. B1-E exists as a separate older candidate and must be adapted to the current B1 contract. MTF is not yet connected to directional decisions. Main remains unchanged.




## 13. Owner-facing decision register — consolidated status

This section is the current decision register. It supersedes any older status wording elsewhere in the repository that describes B1-E as merely a future port. The implementation status is recorded separately from the architectural decision so a design choice is not mistaken for completed code.

| Question | Decision | Status |
|---|---|---|
| What is the product? | Personal read-only crypto-futures analysis and scenario-support tool; user makes the trade decision. | DECIDED |
| Initial exchange and market? | Bybit V5 linear USDT perpetuals. | DECIDED |
| Initial symbols? | BTCUSDT and ETHUSDT. | DECIDED |
| Primary timeframes? | 1D / 4H / 1H. | DECIDED |
| Primary data transport? | REST snapshots and refresh; WebSocket LOG-ONLY. | DECIDED |
| Candle policy? | Closed candles only for directional calculations. | DECIDED |
| Data architecture? | Provider adapter → versioned canonical contract → quality/synchronization → feature engines → scenario engine → research validation → risk plan → UI. | DECIDED |
| MTF policy? | One trusted common provider-time cutoff; no stale/fresh mixing; measured spread policy; fail closed if missing. | DECIDED |
| Analytical order? | Causal swings → HH/HL/LH/LL → BOS/CHoCH → zones → breakout/retest/failure → regime/volume/pattern context → MTF synthesis → scenario. | DECIDED |
| Signal behavior? | LONG/SHORT only when all prerequisites pass; otherwise WAIT with explicit reasons. | DECIDED |
| Confidence display? | No probability/confidence percentage until calibrated out-of-sample. | DECIDED |
| Execution? | No automatic order placement. | DECIDED / OUT OF SCOPE |
| Runtime language? | Keep current JavaScript/HTML prototype; no rewrite without measured reason. | DECIDED |
| UI target? | Browser-first, desktop and iPhone Safari. | DECIDED |
| Backend now? | No always-on backend for the current single-user prototype. | DECIDED |
| Hosting/database vendor? | Not selected until persistence, scheduled jobs, notifications or remote compute are genuinely required. | DEFERRED BY DESIGN |
| TypeScript/React migration? | Not a prerequisite; reconsider only if module complexity justifies it. | DEFERRED BY DESIGN |
| Second exchange, spot, equities, broad altcoin universe? | Not in initial scope. | DEFERRED BY DESIGN |
| News/macro and order-flow? | Later, only after price-structure analytics is validated. | DEFERRED BY DESIGN |

### Why some global questions remain deferred

A sound architecture does not require guessing a server vendor, database, framework or hosting plan before there is a measured need. Those choices do not affect the current analytical core and premature selection would add cost and migration risk without improving market analysis. They are explicitly deferred decisions, not forgotten questions. When a concrete requirement appears, the decision must be based on workload, cost, reliability, security and measured constraints.

### Implementation status correction — 2026-11-27

The integration branch now contains the current-contract B1-E MTF implementation. Current candidate HTML blob: `3f1a739b90e3a187292b29cd9f0ca5c1beafbd5c` (295,555 bytes). Candidate branch: `integration/b1-mtf-architecture-2026-11-27`. Comparison to main: 48 commits ahead, 0 behind. Main HTML blob remains `02cbfb60d1a562e7b73e2734d1ab49b4cf91e2bf` (188,954 bytes).

GitHub Actions run `45965680821` passed Stage A 44/44, B1 Data Contract 32/32, B1 Quality Validator 64/64, B1 MTF 12/12, quality-gate/UI and chart assertions, with zero browser page errors. The live Bybit probe was blocked by HTTP 403 from both REST hosts in the GitHub runner. This does not prove live exchange availability or production MTF calibration.

B1-E remains isolated from the existing directional decision path. The current-contract implementation still requires an independent review of this exact blob, recorded concurrent live Bybit 1D/4H/1H captures and measured provider-time spread policy, transport-level cancellation verification, latest quality-panel Safari visual check, and explicit owner acceptance. No merge to main has occurred. B2 Market Structure remains gated on B1 acceptance.




## 14. Latest quality identity hardening and verification — 2026-11-27

The canonical quality report is now bound to the exact canonical snapshot. A non-empty `snapshot_id` is required by the B1 validator, emitted in every report, and checked by both B1-C and B1-E. A version-correct `VALID` report for another snapshot is not admissible and results in WAIT. This closes a report/snapshot association gap found during internal review.

B1-E also requires an explicit `closedCandleCount` in `fetchAndAssemble()`; there is no silent default. Pending-finality candles are retained in a dedicated context collection and remain outside the closed-only analysis slice.

Latest candidate HTML blob: `1cb41cfbc03534441774eeeaac08f36082f19ab9` (299,978 bytes). Latest completed CI run `45966700299`: Stage A 44/44, contract 32/32, validator 65/65, MTF 18/18, gate/UI and C1 chart assertions passed, zero browser page errors. Live Bybit remains blocked by HTTP 403 from both public hosts on the runner. This does not certify live market connectivity or strategy performance.

The current candidate is more thoroughly regression-tested, but still not accepted: exact-artifact independent review, live concurrent provider-time capture and spread calibration, transport-level abort verification, latest iPhone Safari panel check, and explicit owner acceptance remain open. Main remains unchanged.



## Latest MTF implementation evidence — 2026-11-27

The isolated MTF assembler now has 18 regression tests, including no implicit history-depth default and pending-finality context isolation. Latest completed CI run `45966502044`: Stage A 44/44, contract 32/32, validator 64/64, MTF 18/18; gate/UI/chart assertions passed, zero browser page errors; 158/158 named tests. Candidate HTML blob `1cb41cfbc03534441774eeeaac08f36082f19ab9`, 299,978 bytes. Branch is 66 commits ahead, 0 behind main. Live Bybit is still not verified because the GitHub runner receives HTTP 403 from both REST hosts. The architectural decisions above remain unchanged; B1 acceptance gates remain open.



## Latest evidence supersession — 2026-11-27

Latest completed run `45966700299`: Stage A 44/44, contract 32/32, validator 65/65, MTF 18/18; gate/UI/chart assertions passed, zero browser page errors; 159/159 named tests. Gate tests reject a VALID-looking report with mismatched `snapshot_id`. Candidate HTML blob `1cb41cfbc03534441774eeeaac08f36082f19ab9`. Branch comparison is 85 ahead / 0 behind main. Live Bybit remains blocked by HTTP 403 from both REST hosts on GitHub Actions. Decisions unchanged; B1 remains unaccepted.
