
# Crypto Analyst — Change Index

Индекс технической структуры проекта.

Назначение документа — быстро находить функции, классы, объекты, модули и изменения, а также понимать, на каком этапе они появились.

**Дата создания:** 2026-11-26.

---

## 1. Основной исходник

Файл:

`CryptoAnalyst_StageA_S6_updated.html`

Репозиторий:

`https://github.com/rinatrakhimgulov-bit/Crypto-Analyst`

Основная ветка: `main`.

Последняя проверенная версия:

- Git Blob SHA: `02cbfb60d1a562e7b73e2734d1ab49b4cf91e2bf`
- SHA-256: `8783eae2466b2452adda2c23f167a5a6a352f17a42a9605318feac5499519d17`

---

## 2. Stage A / S6 — известные технические элементы

| Название | Назначение | Этап |
|---|---|---|
| `_handlePong()` | Обработка WebSocket pong и сопоставление req_id | S6 |
| `_onPongTimeout()` | Обработка heartbeat timeout | S6 |
| `_pruneTimedOutPings()` | Очистка устаревших записей timeout | S6 |
| `lastNoEchoPongAt` | Время последнего pong без req_id | S6 |
| `unattributedTimeouts` | Счётчик неоднозначных timeout | S6 |
| `timedOutPings` | Хранение записей о timed-out ping | Stage A / S6 |
| `StageASelfTest` | Набор встроенных самотестов | Stage A / S6 |

Примечание: перечисление отражает известные по отчётам и проверкам элементы. Полная карта функций и их точные местоположения должны быть подтверждены архитектурным аудитом.

---

## 3. Логика WebSocket heartbeat

### Подтверждение ping

Точный `req_id` используется для подтверждения конкретного ping.

Pong без `req_id` не подтверждает конкретный запрос.

### Неоднозначные pong

При активном ожидании pong без req_id классифицируется как ambiguous.

Он не должен отменять таймер и сбрасывать ожидание конкретного ping.

### Поздние pong

Поздний pong без req_id может фиксироваться как late, но не должен удалять запись из `timedOutPings`.

Точное совпадение req_id позволяет сопоставить поздний ответ с конкретной записью.

### Неоднозначный timeout

Если в соответствующем временном интервале был no-echo pong, timeout классифицируется как unattributed.

Такой timeout не должен увеличивать статистику настоящих пропусков heartbeat.

---

## 4. Основные архитектурные области

Следующие области являются направлениями аудита. Их наличие в интерфейсе или проектной документации не подтверждает полноценную реализацию.

| Область | Назначение | Статус |
|---|---|---|
| Market Data | Получение рыночных данных | Требует полного аудита |
| Data Adapters | Подключение поставщиков данных | Требует полного аудита |
| Market Feature Engine | Расчёт рыночных признаков | Требует полного аудита |
| Market Regime Engine | Определение режима рынка | Проектное направление |
| Pattern Analysis | Поиск рыночных паттернов | Проектное направление |
| Market Research Engine | Исследование исторических закономерностей | Проектное направление |
| Validated Strategy Library | Библиотека проверенных стратегий | Проектное направление |
| Trade Decision Engine | Формирование торговых сценариев | Проектное направление |
| Trade Planning & Risk | Расчёт параметров сделки и риска | Требует полного аудита |
| Backtesting | Историческая проверка стратегий | Проектное направление |
| News and Macro Context | Фундаментальный контекст | Проектное направление |
| UI / Visualization | Пользовательский интерфейс | Требует полного аудита |

---

## 5. Будущая модульная структура

Предварительное архитектурное направление:

1. Data Layer.
2. Market Feature Engine.
3. Market Regime Engine.
4. Pattern Analysis.
5. Market Research Engine.
6. Strategy Library.
7. Trade Decision Engine.
8. Trade Planning & Risk.
9. News and Macro.
10. UI Layer.

Это предварительная схема. Окончательная структура должна быть определена после аудита существующего исходника.

---

## 6. История изменений

### Stage A

Создан базовый HTML-прототип Crypto Analyst.

Подробности: `DEVELOPMENT_LOG.md`.

### Stage S6

Уточнена обработка WebSocket heartbeat, ambiguous pong, late pong и unattributed timeout.

Подробности: `DEVELOPMENT_LOG.md`.

---

## 7. Правила обновления индекса

После каждого принятого изменения ChatGPT обновляет индекс.

Для каждой новой или изменённой функции фиксировать:

- Точное имя.
- Файл.
- Этап появления или изменения.
- Назначение.
- Входные параметры, если известны.
- Возвращаемые значения, если известны.
- Зависимости.
- Связанные тесты.
- Статус реализации.
- Точное местоположение в коде, если оно проверено.

Для удалённых функций фиксировать факт удаления и причину.

Для перемещённых функций обновлять местоположение.

Не придумывать номера строк и не указывать неподтверждённые зависимости.

---

## 8. Статусы элементов

Использовать следующие обозначения:

- IMPLEMENTED — реализовано.
- TESTED — проверено указанными тестами.
- PARTIALLY TESTED — проверено частично.
- PLANNED — запланировано, но не реализовано.
- UNDER AUDIT — находится на аудите.
- DEPRECATED — устарело, но ещё присутствует.
- REMOVED — удалено из исходника.

Нельзя присваивать статус TESTED без подтверждённых результатов проверки.


---

## Актуализация 2026-11-26 — Roadmap B0–B10

Добавлен единый план развития: [`docs/ROADMAP.md`](ROADMAP.md).

Основные направления:
- B0 — аудит существующего аналитического конвейера.
- B1 — надёжный аналитический набор данных.
- B2 — Market Structure Engine.
- B3 — Market Regime Engine.
- B4 — Pattern Analysis.
- B5 — Multi-Timeframe Analysis.
- B6 — Trade Scenario Engine.
- B7 — Market Research & Strategy Validation.
- B8 — Trade Planning & Risk Calculator.
- B9 — новости и макро-контекст.
- B10 — журнал, мониторинг и расширение.

**Ближайший этап: B1, IN RESEARCH. B0 audit — DONE.** До завершения аудита исходный код не менять. Данный индекс фиксирует навигацию по плану, а не наличие перечисленных функций в исходнике.

Канонический HTML в рамках этого документационного обновления не менялся.


## 9. Актуализация 2026-11-26 — B0 audit и внешний B2-кандидат

- `BasicAnalyticsEngine.calcEMA()` — сверена на одном фиксированном ряду с независимой рекуррентной реализацией; PARTIALLY TESTED.
- `BasicAnalyticsEngine.calcATR()` — сверена на одном фиксированном ряду с независимым Wilder smoothing; PARTIALLY TESTED.
- `BasicAnalyticsEngine.analyze()` — воспроизведено отсутствие quality gate: INVALID dataset допускает LONG; DEFECT CONFIRMED.
- `StageASelfTest.runAll()` — браузерный прогон на точной версии пока NOT RUN.

Внешний кандидат `pyvsmc` исследован для B2/B4, не интегрирован. Обнаружен потенциальный look-ahead timing в swing → structure. Подробности: `docs/research/B2_PYVSMC_CANDIDATE_AUDIT_2026-11-26.md`.


## 10. B0 acceptance / B1 handoff — 2026-11-26

- `StageASelfTest.runAll()` — 44/44 в изолированном DOM/runtime harness; PARTIALLY TESTED (не реальный браузер).
- `renderSuccess()` — UI mapping аналитических полей прослежен статически.
- `renderError()` — stale-cache путь подтверждён: cached LONG/SHORT повторно отображается при ошибке обновления; DEFECT CONFIRMED.
- `BasicAnalyticsEngine.analyze()` — INVALID quality reproducer возвращает LONG; DEFECT CONFIRMED.
- `calcEMA()` / `calcATR()` — независимая численная spot-check сверка PASS на фиксированных synthetic fixtures.

B0 завершён как аудит. B1 — следующий этап. Основной HTML не менялся.


## 11. B1 research — Data Layer candidates — 2026-11-26

- `rinng` Exchange Protocol / Binance / OKX adapters / canonical schemas — RESEARCHED, not integrated.
- `rinng.pipeline.validate.check_candles()` — candidate quality checker; issue found: `CandleReport.ok` ignores `missing` count.
- `rinng.store.resample.resample_ohlcv()` — candidate resampling logic; possible incomplete-window `is_closed` issue identified.
- `rinng.pipeline.run.analyze()` — no mandatory validation preflight found.
- `CCXT` Bybit `fetch_ohlcv()` — source adapter candidate; unified OHLCV transport, not data quality validation.

Research details: `docs/research/B1_DATA_LAYER_CANDIDATES_2026-11-26.md`. B1 remains IN RESEARCH. No application HTML changes.


## 12. B1 draft contract — 2026-11-26

Добавлен `docs/specs/B1_DATA_CONTRACT_DRAFT.md` — проект контракта данных и quality gate. Статус: DRAFT / NOT IMPLEMENTED. Включает Candle/Snapshot/QualityReport, common cutoff для MTF, closed-state policy, freshness, validation rules, stale-cache gating и 25 acceptance fixtures.


## 13. B2 market structure candidate research — 2026-11-26

Добавлен `docs/research/B2_MARKET_STRUCTURE_CANDIDATES_2026-11-26.md`. Наиболее полезный causal reference — `market-mechanics-bot` (confirmed_idx, left-to-right structure state, body-close breaks), но лицензия не указана: direct code reuse prohibited pending permission. `pyvsmc` MIT remains ADAPT/HOLD due look-ahead timing defect. Другие SMC candidates have license/timing blockers. B2 не открыт; B1 остаётся текущим этапом.


## 14. B1 current adapter mapping — 2026-11-26

`docs/specs/B1_CURRENT_ADAPTER_MAPPING.md` maps Stage A `BybitAdapter` to the proposed provider-neutral contract and records 11 implementation gaps. Proposed minimal path: retain JS for B1 first pass; canonical mapping, pure validator, mandatory quality gate, stale-cache suppression, then MTF cutoff and second provider. Specification only; no code changes.



## 15. B1-A/B/C candidate implementation — 2026-11-27

* `CryptoAnalyst_StageA_S6_updated.html`: canonical B1 snapshot mapping, pure validator, mandatory fail-closed gate, stale-cache signal suppression, validator status UI, strengthened mock fixtures.
* `tests/b1-browser-live-check.cjs`: Playwright Chromium harness for Stage A, B1 contract, B1 validator, gate, cleanup restoration, and live provider probe.
* `.github/workflows/b1-candidate-verification.yml`: candidate-branch verification workflow.
* `docs/specs/B1C_ANALYTICS_QUALITY_GATE_SPEC_2026-11-27.md`: runtime policy, gate behavior, cache handling, recovery semantics, scope.
* `docs/specs/B1B_QUALITY_VALIDATOR_SPEC_2026-11-27.md`: appended B1-C integration section.

CI results: 44/44 Stage A, 32/32 B1 contract, 63/63 B1 validator; gate assertions passed. Live Bybit CI probe skipped because both public hosts returned HTTP 403 to GitHub runner. Candidate only; main unchanged.


### B1-C hardening — 2026-11-27

* `BasicAnalyticsEngine.analyze()`: requires exact active validator and policy version identity, otherwise fail-closed INVALID/WAIT.
* `tests/b1-browser-live-check.cjs`: end-to-end synthetic normalization/contract/validator/engine checks for VALID, INVALID, STALE; verifies indicator arrays only appear for VALID.
* Latest CI: Stage A 44/44, B1 contract 32/32, B1 validator 63/63, gate/cleanup checks passed; live Bybit probe skipped on runner HTTP 403.


## 16. Chart visualization C1 — 2026-11-27

- `BasicAnalyticsEngine.calcEMA()` is reused for EMA200; `analyze()` now returns `ema200` and `metrics.lastEma200`.
- Active `loadAndAnalyze()` requests 400 Bybit kline rows to supply EMA200 warm-up history.
- `CandleChart.render()` draws EMA200, scales/clips moving-average overlays to the price pane, and renders synchronized volume bars in a separate lower pane.
- Chart legend documents EMA200 and base-asset volume.
- `tests/b1-browser-live-check.cjs` adds EMA200 warm-up and chart-rendering assertions.
- Candidate branch only. CI run `45962613748` passed all suites and chart-specific desktop/mobile rendering assertions; live Bybit probe skipped on runner HTTP 403; iPhone Safari retest pending.


## 17. B1-C quality-panel transparency — 2026-11-27

- renderSuccess() now shows B1 status/version, validator reason codes, and explicit analysis admission/block status.
- Browser harness verifies an INVALID negative-volume fixture renders VOLUME_NEGATIVE, Заблокирована · WAIT, and decision badge WAIT.
- CI run 45963443614: Stage A 44/44, B1 contract 32/32, B1 validator 63/63, UI gate passed, no page errors.
- Latest panel-detail change awaits iPhone Safari visual check; independent B1 review and formal acceptance still pending.




## 18. Architecture baseline and B1 consolidation — 2026-11-27

- `docs/ARCHITECTURE_DECISIONS_V1_2026-11-27.md`: product scope, layer boundaries, provider-neutral data contract, REST/WS roles, common-cutoff MTF requirements, causal/no-lookahead analytics, scenario evidence contract, runtime/deployment/storage choices, security, testing and deferred decisions.
- `docs/audits/B1_BRANCH_CONSOLIDATION_AUDIT_2026-11-27.md`: branch divergence, exact candidate HTML identities, external B1-E audit scope, integration incompatibility and controlled port plan.
- New integration branch: `integration/b1-mtf-architecture-2026-11-27`, based on `b1/contract-review`. No source code changed in this documentation-only step; main unchanged.




## 19. B1-E current-contract MTF implementation — 2026-11-27

- `CryptoAnalyst_StageA_S6_updated.html`: adds isolated `B1MtfEngine` for synchronized 1D/4H/1H assembly, common provider-time cutoff, 500 ms finality, post-cutoff exclusion accounting, exact closed-window coverage, per-timeframe current B1 validation, immutable aggregate, sibling abort and generation coordination.
- `B1DataContract.VERSION` and `B1QualityValidator.VERSION` incremented to 1.1.0; canonical schema identity is enforced. `source_diagnostics.excluded_after_cutoff_count` is mandatory and participates in raw-to-canonical row accounting.
- `window.B1MtfSelfTest`: 12 deterministic cases, including exact coverage/finality, provider spread, local-time rejection, stale/mixed identity, deep freeze, sibling abort and superseded request suppression.
- `tests/b1-browser-live-check.cjs`: awaits and asserts the MTF suite.
- `.github/workflows/b1-candidate-verification.yml`: candidate integration branch and PR workflow triggers.
- `docs/specs/B1E_MTF_CURRENT_CONTRACT_SPEC_2026-11-27.md`: current B1-E behavior and acceptance limits.

Latest CI run `45965680821`: Stage A 44/44, B1 contract 32/32, B1 validator 64/64, MTF 12/12; browser UI/chart/gate checks passed, zero page errors. Live Bybit blocked by runner HTTP 403. Integration candidate only; main unchanged.

Note: earlier entry saying no source code changed described the initial documentation-only setup before the subsequent MTF port commits. The source has since been changed on the integration branch.




### B1-E MTF test inventory refresh — 2026-11-27

`window.B1MtfSelfTest` now has 16 cases. Added no-forming/pending leakage, +1 ms spread rejection, multiple post-cutoff rejection, and missing-spread-policy rejection. Async cases verify sibling abort and superseded generation suppression. Latest CI run 45966127523: Stage A 44/44, B1 contract 32/32, B1 validator 64/64, MTF 16/16; UI/gate/chart checks passed, zero page errors. Live Bybit blocked by runner HTTP 403.

Latest candidate HTML blob: `4abb9936c96ae19ff231edd86088c1f1b62a2dd0`. Independent audit prompt is pinned to this exact blob.




## 20. B1 snapshot identity and MTF finality hardening — 2026-11-27

- `CryptoAnalyst_StageA_S6_updated.html`: B1 canonical snapshots require non-empty `snapshot_id`; quality reports carry that ID; B1-C and B1-E require exact report-to-snapshot identity before directional permission.
- `CryptoAnalyst_StageA_S6_updated.html`: MTF fetch requires explicit `closedCandleCount`, retains pending-finality candles in `pending_finality_context`, and excludes them from `analysis_candles`.
- `tests/b1-browser-live-check.cjs`: gate fixtures now carry matching canonical snapshot IDs and test a mismatched VALID report is blocked.
- MTF self-test suite: 18/18; B1 validator suite: 65/65.
- Latest CI run `45966700299`: Stage A 44/44, contract 32/32, validator 65/65, MTF 18/18, gate/UI/chart assertions passed, zero page errors. Live Bybit blocked by runner HTTP 403.
- Exact current HTML blob: `1cb41cfbc03534441774eeeaac08f36082f19ab9`. Main unchanged; integration candidate only.



## 20. B1-E MTF hardening follow-up — 2026-11-27

- `CryptoAnalyst_StageA_S6_updated.html`: removed implicit 400-candle fallback; explicit `closedCandleCount` is required. Added separate `pending_finality_context` output and regression proving pending-finality candles cannot enter `analysis_candles`.
- MTF self-tests: 18/18. Latest CI run `45966502044`: Stage A 44/44, contract 32/32, validator 64/64; total 158/158, gate/UI/chart assertions passed, zero page errors.
- Latest HTML blob: `1cb41cfbc03534441774eeeaac08f36082f19ab9`, 299,978 bytes. Live Bybit remains blocked by runner HTTP 403. Integration only; main unchanged.




## 21. B1 analytics-series binding and live capture probe — 2026-11-27

- `CryptoAnalyst_StageA_S6_updated.html`: B1-C compares the legacy candle series and last-closed price actually consumed by analytics against the exact canonical validated closed series; mismatch blocks with `ANALYTICS_CANDLE_DATA_MISMATCH` and WAIT.
- `CryptoAnalyst_StageA_S6_updated.html`: empty matching series preserve INSUFFICIENT status; MTF suite now 20 cases, including external cancellation and Bybit 1000-row cap.
- `tools/b1_live_probe.html`: schema v3 read-only concurrent Bybit 1D/4H/1H capture with strict provider-time parsing and failed-attempt timing/status evidence.
- `docs/specs/B1_LIVE_CAPTURE_PROCEDURE.md`: Windows local host + iPhone Safari instructions.
- `tests/b1-browser-live-check.cjs`: live-probe initial UI smoke check, no automatic external requests; quality gate series mismatch and empty-insufficient assertions.
- Latest CI `45967551538`: Stage A 44/44, contract 32/32, validator 65/65, MTF 20/20; gate/UI/chart/probe smoke passed, zero page errors. Live Bybit blocked by runner HTTP 403.
- Exact current HTML blob `2af63d1bbfec766606325450819d8ddff14173a2`; main unchanged.



## 22. B1-C analytics-input integrity guard — 2026-11-27

- `BasicAnalyticsEngine.analyze()` now verifies the legacy closed-candle series and last-closed price consumed by indicators match the exact canonical snapshot that passed B1 validation. Divergence forces WAIT.
- Empty but matching candle series preserve INSUFFICIENT status and `INSUFFICIENT_HISTORY` rather than being mislabeled INVALID.
- Latest CI `45967551538`: Stage A 44/44, contract 32/32, validator 65/65, MTF 20/20; 161/161 named tests, UI/chart checks passed, zero browser page errors.
- Current candidate HTML blob `2af63d1bbfec766606325450819d8ddff14173a2`; PR #8 draft, main unchanged. Live Bybit remains blocked by runner HTTP 403.


## 23. B1-D live Bybit market-data integration — 2026-11-27

- CryptoAnalyst_StageA_S6_updated.html: existing Bybit V5 WS client now emits validated live ticker and kline events. Ticker display uses lastPrice only, ignores non-price-only deltas for freshness, and enforces acknowledged subscription + snapshot readiness + 10-second freshness.
- CryptoAnalyst_StageA_S6_updated.html: live price line and forming candle update without recalculating closed-candle analytics. Closed REST candles cannot be mutated; appending a next candle requires a confirmed predecessor. Invalid/gapped/conflicting/older data requests REST reconciliation.
- CryptoAnalyst_StageA_S6_updated.html: REST remains bootstrap/history/recovery/reconciliation and retains 30-second background polling. WS confirm schedules delayed REST verification; it cannot bypass B1 finality/quality validation.
- tests/b1-browser-live-check.cjs: six deterministic B1-D regressions plus browser-level live handler-to-DOM/chart integration.
- Latest CI 45981507604: Stage A 50/50, contract 32/32, quality 72/72, MTF 20/20; 174/174 deterministic tests, desktop/mobile chart, transport cancellation, zero page errors.
- Exact candidate HTML blob 39e42c223419bd8a599f6c513ef6e269df120fcc; harness blob 44b492f92ffbbbb58f6cb830375b6330a556d5c4. PR #9 draft, based on B1 integration branch; PR #8 remains draft. Main unchanged.
- Live Bybit remains unverified: CI REST access is HTTP 403 and browser test uses controlled events, not a live exchange WebSocket. iPhone/Safari live verification and independent review remain required.


### B2 Market Structure design artifacts
- `docs/specs/B2_MARKET_STRUCTURE_ENGINE_SPEC_2026-11-27.md` — B2 design baseline and staged implementation scope.
- `docs/audits/B2_SPEC_DESIGN_REVIEW_2026-11-27.md` — unresolved design decisions and causal release gates.

### B2 policy freeze update — 2026-11-27
- docs/specs/B2_MARKET_STRUCTURE_ENGINE_SPEC_2026-11-27.md Section 15: frozen v1 policies for causal pivots, equality, plateaus, same-side replacement, structure state, protected swings, BOS/CHoCH boundary and event lifecycle.
- docs/audits/B2_SPEC_DESIGN_REVIEW_2026-11-27.md Section 7: resolution matrix for design blockers R1–R7. Internal design resolution only; not independent audit.
- No application code changed. B2 remains gated on B1 acceptance.

### B2-A isolated implementation candidate — 2026-11-27
- src/analysis/b2-causal-swing-engine.js — pure causal raw pivot detector with exact B1 quality identity admission.
- tests/b2a-causal-swing-engine.test.cjs — deterministic B2-A regression tests (11 cases).
- .github/workflows/b2a-causal-pivots.yml — isolated Node test workflow.
- B2 spec clarification: availableAt includes the B1 finality safety lag.
- Candidate is not wired into the application; B1 production acceptance gate remains.


## 24. B2-A isolated causal swing engine — 2026-11-27

- `src/analysis/b2-causal-swing-engine.js`: isolated pure engine for closed-candle swing highs/lows; maximal equal-price plateau with rightmost representative; exact-price v1 equality; source, confirmation and availability timestamps; B1 finality safety lag.
- Admission requires an exact matching `VALID` B1 quality report and policy version. Invalid provenance, timestamp grid/order, OHLC, finality, forming/unknown overlap, or insufficient history fails closed.
- `tests/b2a-causal-swing-engine.test.cjs`: 13 deterministic tests; GitHub Actions run 46005202794 passed.
- `.github/workflows/b2a-causal-pivots.yml`: dedicated Node CI workflow; run 46005202794 passed on candidate commit `f41c85a3d09cbbec602fe1eaef8902b5f52de685`.
- Research candidate only. No UI/HTML, swing sequence, BOS/CHoCH, S/R, retests, directional decision, or main branch changes.


### B2-A exact B1 version binding — 2026-11-27
- Exact B1 contract (1.1.0), validator (1.1.0) and quality-policy version are now required by candidate policy.
- Snapshot contract and quality report validator/policy identities are checked exactly; mismatches fail closed.
- Added regression tests for stale validator and unsupported contract versions; suite 13/13, GitHub Actions run 46005202794 passed.
- Candidate remains isolated and unmerged; no application HTML or `main` changes.


### B2-A causal pivot edge-case hardening — 2026-11-27
- `tests/b2a-causal-swing-engine.test.cjs`: expanded deterministic suite from 13 to 20 cases.
- Added regression coverage for longer plateaus/right-window counting, non-contiguous equal highs, incomplete right confirmation, deeply immutable pivot evidence, duplicate timestamps, and out-of-order candles.
- GitHub Actions run `46010999225` passed on commit `8583d5d58158a183a3185fb1397abb3cbe8cb233`.
- No engine source, application HTML, or main branch changed. Research-only; B1 acceptance remains required before production integration.


### B2-B isolated swing sequence candidate — 2026-11-27
- `src/analysis/b2b-swing-sequence-engine.js`: pure consumer of VALID B2-A raw pivots; exact B2-A/B1 identity binding; availability-order processing; immutable alternating sequence; same-side replacement; HH/LH/EQH/HL/LL/EQL labels.
- `tests/b2b-swing-sequence-engine.test.cjs`: 19 deterministic cases covering sequence behavior, replacement symmetry, equality, causal ordering, fail-closed admission, immutability and determinism.
- `.github/workflows/b2b-swing-sequence.yml`: isolated B2-B CI workflow. Run `46011622297` passed 19/19 on commit `eefa675c5cacab59e7d3aa0c25757dd1c22bbbc8`.
- PR #13 is draft/unmerged and based on B2-A candidate. No main/app changes; B1 acceptance remains required before production integration.


## 2026-11-27 — B2 full-chain deterministic verification

- Added audit-only workflow `.github/workflows/b2-audit-full-suite.yml`.
- Corrected stale B2 test fixture expectations/policy bindings and B2-G test assertion count.
- Verified 180/180 deterministic tests across B2-A through B2-G in GitHub Actions run [#46032422972](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46032422972).
- Updated `docs/audits/B2_INDEPENDENT_REVIEW_2026-11-27.md`, `docs/PROJECT_STATE.md`, and `docs/DEVELOPMENT_LOG.md`.
- No production HTML changes, no `main` changes, and no PR merges. Historical validation and runtime/UI integration remain blockers.
