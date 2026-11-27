
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


## 15. B1 implementation candidate — 2026-11-26 (draft PR #6)

Файл: `CryptoAnalyst_StageA_S6_updated.html`  
Ветка: `impl/b1-quality-contract-2026-11-26`.

| Элемент | Назначение | Статус |
|---|---|---|
| `DataQualityEngine` | Provider-neutral contract v1.0.0, Candle/Snapshot mapping, validation | IMPLEMENTED IN BRANCH |
| `DataQualityEngine.createSnapshot()` | Map adapter dataset to canonical snapshot | IMPLEMENTED IN BRANCH |
| `DataQualityEngine.validate()` | Deterministic OHLCV/time/coverage/freshness/history validation | 35 TESTS PASS |
| `DataQualityEngine.preflight()` | Build snapshot and quality report before analytics | IMPLEMENTED IN BRANCH |
| `DataQualityEngine.staleDecision()` | Convert cached directional decision to WAIT | IMPLEMENTED IN BRANCH |
| `window.B1QualitySelfTest.runAll()` | 35 deterministic quality-contract tests | 35/35 PASS |
| `BybitAdapter.normalize()` | Preserve provider-time provenance, duplicate classification and coverage | IMPLEMENTED IN BRANCH |
| `BasicAnalyticsEngine.analyze()` | Mandatory quality gate; only VALID reaches directional calculation | IMPLEMENTED IN BRANCH |
| `renderError()` | Suppress cached LONG/SHORT after refresh failure | IMPLEMENTED IN BRANCH |
| `renderSuccess()` | Display B1 Quality Gate status | IMPLEMENTED IN BRANCH |

Verified source locations in the candidate branch: DataQualityEngine line 2124; preflight line 2303; staleDecision line 2309; BasicAnalyticsEngine line 2434; B1QualitySelfTest line 2328; BybitAdapter.normalize line 705; renderError line 3293; loadAndAnalyze line 3329.

**Not implemented:** common-cutoff MTF snapshot assembly and second provider. Browser/live API verification remains pending. These statuses apply only to the draft branch, not `main`.


## 16. B1 quality-hardening patch — 2026-11-26

Файл: `CryptoAnalyst_StageA_S6_updated.html`, branch `impl/b1-quality-contract-2026-11-26`, draft PR #6.

| Изменение | Назначение | Статус |
|---|---|---|
| Strict adapter counter validation | Reject missing/string/negative/non-finite counters | IMPLEMENTED; regression-tested |
| Closed-candle finality check | Reject closed-array candles whose close + 500ms exceeds provider time | IMPLEMENTED; regression-tested |
| Strict coverage validation | Require complete, aligned and arithmetically consistent expected range | IMPLEMENTED; regression-tested |
| B1 quality suite | 11 new tests, 46 total | 46/46 PASS |
| Basic analytics gate probes | Four malformed datasets all return WAIT / INVALID | 4/4 PASS |

Ограничения: tests executed in isolated JS context, not in real browser; no live Bybit; no full StageASelfTest 44/44. Independent re-audit pending. No changes merged to main.


## 17. B1 strict consistency follow-up — 2026-11-26

Candidate branch `impl/b1-quality-contract-2026-11-26`, draft PR #6:
- Adapter counters validated strictly, including duplicate aggregate consistency.
- Provider-time and analysis-time coherence enforced; closed-candle finality uses earlier cutoff + 500 ms.
- Coverage metadata validated structurally and arithmetically.
- `B1QualitySelfTest.runAll()`: 54/54 PASS; 2 script blocks syntax-parse PASS; 4/4 integration gate probes block malformed data.
- Browser, live exchange and full StageASelfTest 44/44 remain outstanding. No main merge.


### Final B1 candidate verification refresh — 2026-11-26

Latest HTML blob: `6810d7366e834b35306c8cfbb58751f0189a1b46`. B1 suite 54/54 PASS; two inline script blocks syntax-parse; synthetic adapter-to-preflight fixture returns 60 closed + 1 forming candle and VALID; 4/4 direct analytics gate probes block malformed data with WAIT/INVALID. These are isolated tests, not live exchange/browser verification. StageASelfTest and independent re-audit remain pending.


### Latest candidate verification refresh (2026-11-26)

- HTML blob: `6810d7366e834b35306c8cfbb58751f0189a1b46`.
- `B1QualitySelfTest.runAll()`: 54/54 PASS in isolated JavaScript execution.
- Both inline script blocks syntax-parse successfully.
- Synthetic `BybitAdapter.normalize()` → `DataQualityEngine.preflight()`: 60 closed candles + 1 forming candle, status VALID.
- Four direct quality-gate probes block malformed counters, negative counters, unclosed candles and missing coverage with WAIT / INVALID.
- These are isolated JavaScript/fixture checks, not a live Bybit request or real browser runtime. Full StageASelfTest 44-case browser harness and independent Grok re-audit remain pending. PR #6 remains draft and unmerged; main is unchanged.


### B1 adapter integration regression refresh (2026-11-26)

- Latest HTML blob: `6810d7366e834b35306c8cfbb58751f0189a1b46`.
- `B1QualitySelfTest.runAll()`: **54/54 PASS**; both inline script blocks syntax-parse.
- Four new end-to-end fixture tests now exercise actual `BybitAdapter.normalize()` → `DataQualityEngine.preflight()`: valid reversed rows and 60/1 closed/forming split; invalid row rejection; identical duplicate classification; conflicting duplicate classification.
- Browser/Chrome/iPhone Safari runtime, live Bybit, StageASelfTest 44/44 and independent Grok re-audit remain pending. PR #6 remains draft; main unchanged.


### B1 regression expansion: finality, forming characterization and recovery (2026-11-26)

- Latest candidate HTML blob: `e92c44d1397a8499a5a5adac7c12294923e3f494`.
- `B1QualitySelfTest.runAll()`: **65/65 PASS** in an isolated V8 execution harness using the actual extracted production implementations of `BybitAdapter`, `DataQualityEngine` and `BasicAnalyticsEngine`.
- Added exact finality boundary cases F1a-F1d (T−501/T−500 VALID; T−499/T INVALID).
- Added FM2-FM4 characterization tests. They explicitly document current behavior: forming-candle gap, duplicate timestamp and malformed OHLC are not currently validated by the Quality Gate. These tests do not change that policy.
- Added a shuffled-timestamp Bybit V5-shaped fixture exercising `normalize() → preflight() → analyze()`, plus stale LONG and SHORT conversion to WAIT/STALE followed by fresh valid re-analysis.
- Both inline script blocks syntax-parse successfully.
- Verification remains isolated and deterministic: no browser DOM/runtime, no live Bybit HTTP request, no Chrome/iPhone Safari run, and no full `StageASelfTest` run. The stale recovery tests validate engine-level recovery, not the rendered UI badge.
- PR #6 remains draft and unmerged; `main` is unchanged. These checks do not complete B1 or authorize merging yet.

## 18. Независимый аудит B1 candidate — 2026-11-26

- Candidate HTML blob: `e92c44d1397a8499a5a5adac7c12294923e3f494`.
- Независимый запуск `B1QualitySelfTest.runAll()`: **65/65 PASS**.
- Grok verdict: **APPROVE**; новых CRITICAL/HIGH дефектов не обнаружено.
- LOW: отсутствует assert конкретного finality reason code; forming candle не валидируется (известное ограничение, зафиксированное characterization-тестами); stale recovery проверен без полного UI/renderError цикла.
- Browser `StageASelfTest` 44/44, Chrome/iPhone Safari, live Bybit и UI badge verification остаются pending. PR #6 остаётся draft, main не изменён.

## B1-E MTF common-cutoff specification — 2026-11-26

- Added `docs/specs/B1_E_MTF_COMMON_CUTOFF_SPEC.md`.
- Source audit confirmed no coordinated 1D/4H/1H assembler in the current runtime.
- Documented why a common cutoff requires explicit provider-time and candle-reclassification semantics.
- Added 23 deterministic acceptance tests and stale/concurrency/coverage requirements.
- Documentation only; no production code changed. B1-E is not implemented.

## B1-E implementation candidate — 2026-11-26

- Added isolated `MTFDataEngine` and `B1EMtfSelfTest` (23 tests) to the candidate HTML.
- Added optional `providerTimeToleranceMs` override to DataQualityEngine; null preserves existing single-timeframe tolerance.
- Added concurrent 1D/4H/1H fetch, common cutoff, candle reclassification, coverage recomputation, aggregate quality and request-generation cancellation.
- Latest isolated checks: B1-E 23/23, B1 suite 65/65, both inline scripts parse.
- Not connected to UI or trade decisions; no browser/live Bybit verification. PR remains draft.

B1-E audit refinement: a candle whose open time is later than the common cutoff is now excluded from the as-of snapshot and counted in `excludedAfterCutoffCount`; its mere presence no longer invalidates a coherent snapshot. This handles ordinary response-time differences across an interval boundary. B1-E remains 23/23 PASS and B1 remains 65/65 PASS after this correction.


## 17. B1-E common-cutoff implementation candidate update — 2026-11-26

| Element | Purpose | Status |
|---|---|---|
| `MTFDataEngine.fetchAndAssemble()` | Concurrent 1D/4H/1H requests with explicit spread-based raw-row overfetch | IMPLEMENTED IN PR #6 BRANCH |
| `MTFDataEngine.assemble()` | Common cutoff, candle reclassification, explicit closed-history window and per-TF quality | IMPLEMENTED IN PR #6 BRANCH |
| `mtfExpectedClosedCount` | Explicit desired number of closed candles, independent of provider raw-row limit | IMPLEMENTED IN PR #6 BRANCH |
| `mtfRequestedRawLimit` | Records the actual per-TF raw-row request limit | IMPLEMENTED IN PR #6 BRANCH |
| Forming-candle ambiguity guard | Blocks directional permission and does not publish an arbitrary forming candle when multiple candidates exist | IMPLEMENTED IN PR #6 BRANCH |
| Per-timeframe diagnostics | Stable failure shape for missing timeframe, mismatch, missing target and missing normalized candles | IMPLEMENTED IN PR #6 BRANCH |
| `B1EMtfSelfTest` | V5-shaped adapter integration, 1H/4H/1D boundary rollover, short-response and ambiguity tests | 31/31 PASS |
| `B1QualitySelfTest` | Existing canonical data quality suite | 65/65 PASS |

Latest HTML blob: `d9bb093001299ef8a835fc01dcaa6fb87e0425cd`. Both inline scripts parse. This is isolated V8 verification, not browser/live verification. MTFDataEngine is not yet wired into UI or directional decisions. PR #6 remains draft/unmerged; main unchanged.


### B1-E post-boundary finality refinement — 2026-11-26

- MTFDataEngine distinguishes active forming candles from candles pending the 500 ms finality buffer.
- Per-timeframe diagnostics expose pendingFinalityCount.
- Multiple active forming candidates remain blocking; the normal just-after-boundary state is no longer misclassified as multiple forming candles.
- Raw-row overfetch reserve is now desired closed count + spread-derived rollover rows + 2 boundary/finality rows.
- B1EMtfSelfTest: 32/32 PASS; B1QualitySelfTest: 65/65 PASS; both scripts parse.


### Final B1-E immutability update — 2026-11-26

The assembled MTF result and failure results are now deeply frozen, including nested per-timeframe diagnostics, canonical candle arrays, candle objects and quality reports. The provider-time-spread failure path was adjusted to preserve the immutable result contract.

Latest HTML blob: 842c361a8386c358a68f22407814c376fd3bde1b. Final isolated V8 verification: B1-E 33/33 PASS; B1 Quality 65/65 PASS; both inline JavaScript blocks parse. This remains a candidate only: no live Bybit, browser/UI, Chrome/iPhone Safari or full StageASelfTest verification. MTFDataEngine is not connected to the UI/decision pipeline. PR #6 remains draft and unmerged; main unchanged.


## 18. Independent B1-A/B/E audit — 2026-11-27

| Item | Result / status |
|---|---|
| Exact candidate blob `842c361a8386c358a68f22407814c376fd3bde1b` | Independently audited |
| B1-E suite | 33/33 PASS |
| B1 Quality suite | 65/65 PASS |
| External verdict | APPROVE WITH CONDITIONS |
| CRITICAL defects | None found for current isolated MTF API |
| AbortSignal source path | Verified through to `fetch()`; transport-level test pending |
| Live Bybit 1D/4H/1H and spread calibration | NOT VERIFIED / REQUIRED before directional MTF |
| Forming-candle validation/invariant | Required before directional integration |
| MTF directional integration | BLOCKED; remains disconnected |

Detailed findings: `docs/audits/B1_A_B_E_INDEPENDENT_AUDIT_2026-11-27.md`.
