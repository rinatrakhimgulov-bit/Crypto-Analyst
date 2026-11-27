
# Crypto Analyst — Project State

**Дата актуализации:** 2026-11-26  
**Основная ветка:** `main`  
**Основной исходный файл:** `CryptoAnalyst_StageA_S6_updated.html`  
**Текущий этап:** Stage A / S6; B0 аудит завершён. B1 — исследование data layer и review draft-контракта. Основной HTML не изменён.

---

## 1. Назначение проекта

Crypto Analyst — аналитическая система для исследования криптовалютного рынка, выявления закономерностей и подготовки торговых сценариев.

Основная задача приложения:

- Автоматически собирать рыночные данные.
- Анализировать структуру рынка.
- Определять рыночные режимы.
- Выявлять и исследовать повторяющиеся рыночные закономерности.
- Проверять торговые гипотезы на исторических данных.
- Формировать сценарии LONG / SHORT / WAIT.
- Рассчитывать торговые риски и потенциальные параметры сделки.
- Объяснять пользователю основания аналитических выводов.

**Принципиальное ограничение:** окончательное решение о совершении сделки остаётся за пользователем. Приложение не является автотрейдером.

## 2. Продуктовые принципы

1. Приоритет — достоверность данных и проверяемость аналитики.
2. Не выдавать предположения за подтверждённые закономерности.
3. Не создавать стратегии без предварительного исследования исторических данных.
4. Учитывать комиссии, проскальзывание и другие торговые издержки.
5. Не использовать будущие данные при формировании исторических сигналов.
6. Разделять сбор данных, аналитическое ядро и интерфейс.
7. Сначала BTC и ETH, затем расширение списка активов.
8. Сохранять возможность замены поставщиков данных.
9. Не усложнять архитектуру без практической необходимости.
10. Завершать каждый технический этап интеграцией, тестированием и документированием.

## 3. Рабочий процесс разработки

### Роли

**Пользователь:**
- Владелец продукта.
- Определяет приоритеты.
- Утверждает существенные изменения.
- Принимает окончательные продуктовые решения.

**ChatGPT:**
- Технический куратор проекта.
- Разрабатывает архитектурные решения.
- Выбирает подходящего ИИ-исполнителя.
- Составляет предварительные вопросительные промпты.
- Проверяет результаты исполнения.
- Проводит независимый технический аудит.
- Координирует интеграцию изменений в GitHub.
- Ведёт проектную документацию.

**Внешние ИИ-исполнители:**
- Claude — основной исполнитель крупных изменений.
- Gemini — анализ и вспомогательная разработка.
- Grok — технические задачи и независимый аудит.
- DeepSeek — архитектура, алгоритмы и математические задачи.

### Обязательный порядок выполнения задач

1. Определить задачу и её практическую ценность.
2. Оценить сложность, риски, зависимости и реализуемость.
3. Выбрать подходящего исполнителя.
4. Отправить ему предварительный вопросительный промпт.
5. Оценить ответ и подтвердить возможность выполнения.
6. Передать актуальный исходник.
7. Получить результат исполнения.
8. Провести независимую проверку.
9. Выполнить интеграцию в GitHub.
10. Проверить итоговую сборку и зафиксировать результаты.

### Правила безопасности разработки

- Один ИИ-исполнитель одновременно изменяет конкретный исходник.
- Не допускать несогласованных изменений основной ветки `main`.
- По возможности использовать отдельные ветки и Pull Request.
- Не создавать параллельные версии основного HTML без необходимости.
- Перед существенными изменениями сохранять исходное состояние.
- Не интегрировать код без проверки.
- Не расширять задачу самостоятельно без согласования.
- Фиксировать полный SHA-256 проверенных файлов.

## 4. Текущая версия исходника

Основной файл:

`CryptoAnalyst_StageA_S6_updated.html`

Репозиторий:

`https://github.com/rinatrakhimgulov-bit/Crypto-Analyst`

Ветка: `main`

Последняя проверенная версия:

- Git Blob SHA: `02cbfb60d1a562e7b73e2734d1ab49b4cf91e2bf`
- SHA-256: `8783eae2466b2452adda2c23f167a5a6a352f17a42a9605318feac5499519d17`
- Размер при финальной сверке: 205755 bytes.
- Файл повторно прочитан через GitHub-интеграцию 26.11.2026.
- Полученный Git Blob SHA совпал с зафиксированным.

## 5. Stage A / S6 — текущее техническое состояние

### Что было сделано

Stage A создал базовую рабочую версию приложения.

S6 исправил обработку неоднозначных WebSocket pong и heartbeat timeout.

Основные изменения S6:

- Уточнена логика `_handlePong()`.
- Добавлена временная отметка `lastNoEchoPongAt`.
- Добавлен счётчик `unattributedTimeouts`.
- Уточнена логика `_onPongTimeout()`.
- Используется `_pruneTimedOutPings()` для штатной очистки устаревших записей.
- Pong без `req_id` больше не считается подтверждением конкретного ping.
- Поздний pong без `req_id` не удаляет запись из `timedOutPings`.
- Точное совпадение `req_id` позволяет сопоставить соответствующий поздний ответ.

### Логика heartbeat

- Точный `req_id` подтверждает конкретный ping.
- Pong без `req_id` свидетельствует об активности канала, но не подтверждает конкретный ping.
- Ambiguous pong не отменяет активный таймер и ожидание.
- При timeout проверяется наличие no-echo pong в соответствующем временном интервале.
- Unattributed timeout не увеличивает статистику настоящих пропусков heartbeat.
- Обычный timeout без признаков неоднозначности обрабатывается штатно.

### Что не следует считать реализованным

На основании имеющейся информации пока нельзя утверждать, что приложение содержит:

- Полноценный Market Regime Engine.
- Полноценный Market Research Engine.
- Библиотеку статистически проверенных стратегий.
- Полноценный мультитаймфреймовый аналитический движок.
- Полноценный риск-планировщик.
- Полноценный исторический бэктест.
- Полноценный order flow analysis.
- Полноценную новостную и макроэкономическую аналитику.

Эти направления остаются предметом последующего аудита и разработки.

## 6. Тестирование и ограничения

В коде присутствует набор `StageASelfTest`, содержащий 44 теста.

Важно различать наличие тестов и подтверждённое успешное прохождение.

- Исполнитель ранее сообщал о результате 44/44.
- При последующей сверке не удалось получить сохранённый полный лог, подтверждающий результат именно на окончательной версии файла с зафиксированным SHA-256.
- Поэтому корректный статус: 44 теста присутствуют, но прохождение 44/44 на финальной сборке документально не подтверждено.
- Тестирование использовало MockWebSocket и замоканные данные.
- Реальное подключение к Bybit WebSocket не подтверждено.
- Реальный жизненный цикл iPhone Safari и ограничения фонового режима ОС не проверены.

Не записывать неподтверждённые результаты как успешные.

## 7. Целевая архитектура

Следующие компоненты являются проектным направлением, а не утверждением об их текущей реализации.

1. Market Data / Data Adapters
2. Market Feature Engine
3. Market Regime Engine
4. Pattern Analysis
5. Market Research Engine
6. Validated Strategy Library
7. Trade Decision Engine
8. Trade Planning & Risk
9. News and Macro Context
10. UI / Visualization

### Принцип развития аналитики

Стратегии должны появляться в результате исследования исторических закономерностей, а не создаваться на основе субъективных предположений.

Market Research Engine должен:

- Исследовать исторические события.
- Извлекать измеримые признаки.
- Сравнивать похожие рыночные ситуации.
- Изучать последующее движение цены.
- Проверять достижение TP и SL.
- Учитывать торговые издержки.
- Рассчитывать математическое ожидание и просадки.
- Проверять результаты на независимых периодах.
- Выявлять переобучение и нестабильность закономерностей.

## 8. Приоритеты дальнейшего развития

### Первый приоритет

- Завершить B0: полный аудит конвейера от источника данных до UI.
- Подтвердить динамические/runtime результаты и уточнить спецификацию B1.
- Не менять основной HTML до принятия аудита и плана исправлений.

### Последовательность

Использовать `docs/ROADMAP.md` как единый план B0–B10. Начать B1 после завершения B0; затем B2 Market Structure, B3 Regime, B4 Pattern, B5 MTF, B6 Scenario, B7 validation, B8 risk, B9 news/macro, B10 monitoring.

Для каждого направления сначала исследовать существующие открытые алгоритмы и библиотеки, проверять математику, тесты, лицензии, causal timing и пригодность. Переписывать самостоятельно только при отсутствии качественного готового решения или необходимости адаптации.

## 9. Текущий этап — B1: надёжный аналитический набор данных

B0 завершён как аудит текущего исходника. Встроенный StageASelfTest выполнен на точном исходнике в изолированном DOM/runtime harness: 44/44. EMA/ATR сверены с независимыми расчётами на фиксированных рядах. UI mapping и stale-cache path прослежены статически. Реальный Chrome/Safari и live-source проверки не выполнялись. Подробности: `docs/audits/B0_AUDIT_2026-11-26.md`.

Подтверждены два дефекта, которые требуется устранить до доверия directional output: D0-01 — `BasicAnalyticsEngine.analyze()` возвращает LONG при `quality.status=INVALID`; D0-02 — stale-cache path может повторно отобразить прежний LONG/SHORT после ошибки обновления. См. B0 audit report.

B1: изучены `rinng` и `CCXT`; подготовлен draft provider-neutral data contract и quality gate (`docs/specs/B1_DATA_CONTRACT_DRAFT.md`). Текущий статус B1 — исследование и review спецификации; реализация не начата. Исследовательский отчёт: `docs/research/B1_DATA_LAYER_CANDIDATES_2026-11-26.md`.

Дополнительное предварительное исследование будущего B2 (без изменения последовательности roadmap): `docs/research/B2_PYVSMC_CANDIDATE_AUDIT_2026-11-26.md` и `docs/research/B2_MARKET_STRUCTURE_CANDIDATES_2026-11-26.md`.

## 10. Документация проекта

В репозитории используются три документа:

- `docs/PROJECT_STATE.md` — актуальное состояние проекта и принятые решения.
- `docs/DEVELOPMENT_LOG.md` — история завершённых этапов, изменения и результаты тестирования.
- `docs/CHANGE_INDEX.md` — навигация по функциям, классам, объектам и изменениям.

ChatGPT отвечает за подготовку и обновление документации после завершения и проверки технических этапов.

Документация должна отражать фактическое состояние GitHub, а не только содержание переписки.

## 11. Главное правило проекта

Мы не стремимся к максимальному количеству функций.

Наша цель — создать технически надёжную, проверяемую и действительно полезную аналитическую систему.

Каждый следующий этап должен опираться на проверенный результат предыдущего.


---

## Актуализация приоритетов — 2026-11-26

Этот раздел имеет приоритет над более ранними формулировками разделов 8–9 выше, если они расходятся с ним.

**Главный приоритет разработки — аналитическая часть Crypto Analyst.** Калькулятор риска обязателен как часть конечного торгового планирования, но не является первым самостоятельным этапом. Сначала необходимо улучшить способность приложения корректно анализировать рынок и формировать обоснованные сценарии.

Утверждён единый план работ: [`docs/ROADMAP.md`](ROADMAP.md), этапы B0–B10.

Актуальный статус на 26.11.2026:
- B0 — DONE (audit only; см. отчёт и ограничения).
- B1 — IN RESEARCH; draft provider-neutral data contract подготовлен, реализация не начата.
- B2–B7 — NOT STARTED; исследовательские заметки по отдельным B2-кандидатам не означают открытия этапа.
- B8 — после аналитического ядра.
- B9 — после устойчивого аналитического ядра.
- B10 — поздний этап.

Подтверждённое состояние Stage A/S6 не меняется этой записью. Планируемые компоненты не считаются реализованными. Калькулятор, Market Research Engine, Market Regime Engine, полноценный MTF и полноценный Trade Scenario Engine остаются целевыми компонентами, а не подтверждёнными функциями текущей сборки.

Документационный коммит с Roadmap не является реализацией аналитических функций и не меняет канонический HTML.


## Актуализация 26.11.2026 — provider-neutral аналитическая архитектура

Целевой продукт не привязан к Bybit. Bybit — текущий источник Stage A, но будущие данные могут поступать из любого подходящего провайдера через отдельные адаптеры. Аналитические алгоритмы должны получать единый нормализованный контракт и не зависеть от биржевого API.

Поиск готовых алгоритмов ведётся по функциональным задачам B0–B10, а не по брендам приложений или конкретным биржам. Внешний код сначала проходит аудит, затем решение KEEP / ADAPT / REWRITE / REJECT. Никакой внешний модуль не считается пригодным только на основании README или числа заявленных тестов.


B0 acceptance: StageASelfTest 44/44 в изолированном harness; EMA/ATR numerical spot-checks PASS; invalid-quality reproducer подтверждает блокирующий дефект; UI mapping и stale cache traced. Настоящий браузер и live exchange API не проверялись. Это ограничение явно сохранено в B0 audit report.


## B1 specification draft — 2026-11-26

Подготовлен `docs/specs/B1_DATA_CONTRACT_DRAFT.md`: provider-neutral Candle/Snapshot/QualityReport, closed/forming policy, MTF common cutoff, quality states, stale-cache gating, resampling completeness rules и 25 deterministic acceptance cases. Это draft для review, не реализация. Runtime/language choice (JS/TS vs Python backend) и конкретный provider adapter остаются открытыми решениями.


## B1 current adapter mapping — 2026-11-26

Подготовлен `docs/specs/B1_CURRENT_ADAPTER_MAPPING.md`: сопоставление BybitAdapter с canonical Candle/Snapshot/QualityReport и 11 конкретных разрывов (canonical contract, duplicates, future timestamps, provider-time fallback, closed-state, quality gate, coverage, pagination, MTF cutoff, stale cache). Предложен минимальный план B1 без переписывания приложения и предварительная рекомендация сохранить JavaScript на первом проходе; Python backend оставить открытой опцией при доказанной необходимости. Это спецификация, не реализация.



## Актуальное состояние B1 — 2026-11-27 (candidate, не слит в main)

* Ветка реализации и проверки: `b1/contract-review`. `main` не изменялся.
* B1-A: canonical snapshot mapping, provider provenance/time, closed/open/unknown candle states, raw-order diagnostics, duplicate conflict quarantine, strict Bybit 7-field row schema, no local-clock certification of closed candles.
* B1-B: deterministic pure validator with explicit policy and validation time; 63 regression cases. Canonical contract suite: 32 cases.
* B1-C: mandatory fail-closed gate is now connected to `BasicAnalyticsEngine.analyze()`. Only `VALID` with matching validator and policy versions permits directional calculation. Missing/mismatched report, `UNASSESSED`, `DEGRADED`, `INSUFFICIENT`, `STALE`, and `INVALID` produce WAIT.
* Cached snapshot after REST refresh failure is revalidated and forced to STALE (unless INVALID); stale chart may remain visible, directional analysis is suppressed.
* GitHub Actions Chromium run: Stage A 44/44, B1 contract 32/32, B1 validator 63/63; gate assertions pass; no page errors; cleanup restoration assertions pass.
* CI live Bybit requests were blocked by HTTP 403 from both public REST hosts on GitHub runner. This is recorded as skipped, not passed. User manually verified iPhone Safari BTC/ETH and 1H/4H/1D switching and refresh on the pre-B1-C candidate. The latest B1-C build still needs a short iPhone retest of the new B1 status row and WAIT behavior. Earlier capture artifacts documented 180 successful REST samples, but those captures predate the final candidate hardening.
* Candidate still requires independent code review and explicit acceptance before merge to main. Do not start B2 or claim trading-signal validation.

Canonical implementation spec: `docs/specs/B1C_ANALYTICS_QUALITY_GATE_SPEC_2026-11-27.md`.


### B1-C additional hardening and latest CI — 2026-11-27

* Gate verifies not only `status === VALID`, but also exact validator and policy versions. Missing/old/mismatched report identity is treated as INVALID (`QUALITY_REPORT_VERSION_MISMATCH`).
* Browser integration harness now tests the actual adapter → canonical snapshot → validator → engine path with synthetic Bybit rows. VALID produced 159 closed candles and populated EMA20/EMA50/ATR14; negative volume → INVALID/WAIT/no indicators; expired transport age → STALE/WAIT/no indicators.
* Latest Actions run passed: Stage A 44/44, B1 contract 32/32, B1 validator 63/63, gate tests, cleanup restoration, zero page errors.
* Live Bybit remains unverified from GitHub Actions because both hosts return HTTP 403 to the runner. Latest B1-C UI still needs the user's iPhone Safari retest of the new status row and blocked-data WAIT behavior.


### Chart visualization C1 — in progress (2026-11-27)

- Existing chart already rendered EMA20/EMA50 and local SH/SL markers; these were retained.
- Candidate branch now adds EMA200 to the analytical output and chart overlay. EMA200 is calculated from closed candles and has a 200-candle SMA seed; the active REST request is 400 rows to provide warm-up history.
- Candidate chart now has a lower volume histogram synchronized to the same candle slice. It uses Bybit linear base-asset `volume`; the forming candle's bar is visually muted.
- EMA lines are clipped to the price pane, and visible EMA values participate in price-axis scaling.
- This visualization work does not yet change the LONG/SHORT/WAIT decision rules and does not make the analytics a validated trading strategy.
- Candidate only: `b1/contract-review`; `main` remains unchanged. GitHub Actions run `45962613748` passed: Stage A 44/44, B1 contract 32/32, B1 validator 63/63, EMA200 warm-up, closed-candle line alignment, volume histogram and mobile layout checks all passed; zero browser page errors. Mobile CI viewport was 390 px with a 334×318 px chart canvas and no horizontal chart overflow. GitHub runner still cannot reach Bybit (HTTP 403 on both public REST hosts), so live provider verification is not claimed. User-side iPhone Safari verification of the new chart remains pending; C1 is under review, not accepted.


### B1-C UI transparency update — 2026-11-27

The candidate quality panel now exposes B1 status/version, up to five validator reason codes, and whether directional analysis is admitted or blocked with WAIT. A Chromium DOM test injects an INVALID negative-volume report and verifies the user-visible panel shows INVALID, VOLUME_NEGATIVE, blocked state, and WAIT. CI run 45963443614 passed: Stage A 44/44, B1 contract 32/32, B1 validator 63/63, UI gate checks passed, zero browser page errors. Live Bybit probe remains blocked on GitHub runners by HTTP 403. The user has confirmed the preceding C1 candidate works on iPhone; the latest added quality-panel detail row still needs a brief Safari visual check. Independent B1 review and formal acceptance remain outstanding; main is unchanged.




## Architecture baseline and B1 consolidation — 2026-11-27

**Current working branch:** `integration/b1-mtf-architecture-2026-11-27` (created from `b1/contract-review`). **Main remains unchanged.**

The global architecture decisions are now recorded in `docs/ARCHITECTURE_DECISIONS_V1_2026-11-27.md`. This is the baseline for product scope, data contracts, MTF synchronization, causal analytics, scenario output, testing, runtime, storage, deployment and deferred decisions. It does not claim planned features are implemented.

The branch comparison found two divergent B1 candidates. The current `b1/contract-review` HTML blob is `1c32696a7aa0751a33e628853df1a780aad7f76b`. The older B1-A/B/E HTML blob is `842c361a8386c358a68f22407814c376fd3bde1b`. They share merge base `e53f74cf814638d70f775366e88b6754c95b9e51`, but the older B1-E branch has a much larger divergent history. No wholesale branch merge is planned.

The older B1-E implementation depends on the legacy `DataQualityEngine` API and is not drop-in compatible with the current `B1DataContract` / `B1QualityValidator` / versioned B1-C gate. Its common-cutoff semantics will be ported deliberately into the current contract. The exact older B1-E artifact received an external conditional review (33/33 MTF tests, 65/65 older quality tests), but that review does not certify the current B1-C/C1 artifact or approve directional MTF use.

**Current evidence and remaining gates:**
- Candidate B1-A/B/C/C1 browser CI: Stage A 44/44, B1 contract 32/32, B1 validator 63/63, UI gate checks passed, no browser page errors in the recorded run.
- C1 chart display (EMA200 and synchronized volume pane) was subsequently checked by the user on iPhone and reported working. The latest B1-C quality-panel reason-code / blocked-WAIT detail row still needs a visual Safari check.
- GitHub Actions live Bybit probe is blocked by HTTP 403 from both public REST hosts. No current live verification is claimed.
- B1-E live provider-time spread calibration, replay of recorded responses, and transport-level cancellation testing remain open.
- B1 is not accepted; B2 implementation has not started; no merge to main is authorized or performed.

See `docs/audits/B1_BRANCH_CONSOLIDATION_AUDIT_2026-11-27.md` and `docs/ARCHITECTURE_DECISIONS_V1_2026-11-27.md`.




## B1-E current-contract MTF implementation — 2026-11-27

The integration branch now contains an isolated `B1MtfEngine` ported to the current B1 contract. It fetches 1D/4H/1H concurrently through the current Bybit adapter, uses the minimum trusted provider timestamp as the common analysis cutoff, applies the 500 ms finality lag, excludes post-cutoff rows with explicit raw-row accounting, validates each timeframe through the current `B1QualityValidator`, checks exact closed-candle coverage, and blocks aggregate directional permission unless all three reports and coverage checks are VALID. The result is deeply immutable. A request coordinator aborts superseded generations; a failed timeframe aborts sibling adapter requests.

The canonical contract and validator were incremented to 1.1.0. The canonical validator now rejects unsupported contract versions. `source_diagnostics.excluded_after_cutoff_count` is required and included in normalized-row accounting. The quality policy thresholds/version remain unchanged.

**Latest GitHub Actions run:** `45965680821` completed successfully on the integration candidate:
- Stage A: 44/44;
- B1 Data Contract: 32/32;
- B1 Quality Validator: 64/64 (one added unsupported-contract-version regression);
- B1 MTF: 12/12 (common cutoff, spread, trust, coverage, finality, immutability, sibling abort and superseded generation);
- B1 gate/UI and C1 chart assertions passed; zero browser page errors.
- Live Bybit remains SKIPPED/BLOCKED: both public REST hosts return HTTP 403 to GitHub Actions.

The MTF engine remains isolated: it is not connected to the chart, existing selected-timeframe analysis, or LONG/SHORT/WAIT decision path. The exact current-contract port has not yet received independent review. Live concurrent captures and spread calibration remain outstanding. Latest quality-panel reason-code/blocked-WAIT detail still needs Safari visual verification. B1 is not accepted; B2 has not started; main remains unchanged.

Specification: `docs/specs/B1E_MTF_CURRENT_CONTRACT_SPEC_2026-11-27.md`.




## CURRENT AUTHORITATIVE STATE — 2026-11-27 (supersedes stale header/status above)

**Current integration branch:** `integration/b1-mtf-architecture-2026-11-27`  
**Main:** unchanged; HTML blob `02cbfb60d1a562e7b73e2734d1ab49b4cf91e2bf`, 188,954 bytes.  
**Integration candidate HTML:** blob `3f1a739b90e3a187292b29cd9f0ca5c1beafbd5c`, 295,555 bytes.  
**Branch comparison:** 48 commits ahead of main, 0 behind.  
**Draft PR:** #8, integration consolidation; not merged.

### Implemented on the integration candidate
- B1-A canonical data contract and Bybit adapter.
- B1-B deterministic quality validator, current version 1.1.0.
- B1-C fail-closed analytics quality gate and visible reason/status panel.
- C1 EMA overlays and volume pane on the chart.
- B1-E isolated current-contract MTF assembler for 1D/4H/1H with common provider-time cutoff, 500 ms finality lag, explicit post-cutoff row accounting, exact closed-window coverage, per-timeframe validation, aggregate fail-closed status, deep immutability and request-generation cancellation.
- Architecture decision register and current-contract MTF specification.

### Latest recorded CI evidence
GitHub Actions run `45965680821`: Stage A 44/44; B1 contract 32/32; B1 validator 64/64; B1 MTF 12/12; B1 gate/UI and C1 chart assertions passed; zero browser page errors. The live Bybit check was blocked by HTTP 403 from both public REST hosts in GitHub Actions. This is a successful synthetic/browser regression run, not a live-exchange verification.

### Remaining B1 acceptance gates
1. Independent review of exact candidate HTML blob `3f1a739b90e3a187292b29cd9f0ca5c1beafbd5c` (review prompt saved under `docs/audits/PROMPT_B1_CURRENT_CONTRACT_INDEPENDENT_REVIEW_2026-11-27.md`).
2. Recorded concurrent live Bybit 1D/4H/1H responses and measured provider-time spread policy.
3. Actual browser transport-level abort/cancellation verification.
4. iPhone Safari visual check of the latest quality reason-code and blocked-WAIT panel. C1 chart layout was previously user-verified.
5. Explicit owner acceptance before merge to main.

**B1 is not yet accepted. B2 Market Structure has not started.** MTF is not connected to LONG/SHORT/WAIT and must not be described as a completed trading signal engine.

### Global product architecture decisions
The authoritative decision register is `docs/ARCHITECTURE_DECISIONS_V1_2026-11-27.md`. It fixes the initial product scope, Bybit/USDT linear market, BTC/ETH, 1D/4H/1H, REST-first + WS LOG-ONLY, closed-candle directional analysis, provider-neutral layered architecture, causal market-structure sequence, browser-first JavaScript runtime and no auto-execution. Backend/database/hosting vendor, framework migration, additional exchanges, news and order-flow are explicitly deferred until justified by a real requirement. These are deliberate deferrals, not blockers to building the analytical core.




### B1-E regression expansion — latest verification 2026-11-27

The MTF test suite was expanded from 12 to 16 cases. New assertions cover closed-only analysis slices (no forming/pending-finality candle leakage), provider-time spread exactly one millisecond above policy, multiple post-cutoff rows, and missing measured spread policy. Async tests cover sibling abort and superseded generation.

Latest GitHub Actions run `45966127523` passed: Stage A 44/44, B1 Data Contract 32/32, B1 Quality Validator 64/64, B1 MTF 16/16, B1 gate/UI and C1 chart assertions passed, zero browser page errors. Live Bybit remains skipped/blocked by HTTP 403 from both public REST hosts.

Exact current candidate HTML blob: `4abb9936c96ae19ff231edd86088c1f1b62a2dd0`. Independent audit prompt has been pinned to this exact blob. No code change was made to main. B1 remains unaccepted; independent review, live spread calibration, actual network abort verification, latest quality-panel Safari check and owner acceptance remain open.




## Latest B1 hardening — 2026-11-27

The current integration candidate adds exact quality-report-to-snapshot binding. Canonical snapshots require a non-empty `snapshot_id`; the validator records it in the report; B1-C rejects a VALID report whose ID differs from the dataset's canonical snapshot; B1-E applies the same per-timeframe check. Missing MTF `closedCandleCount` now fails before network access instead of defaulting silently. Pending-finality candles are exposed separately as context and excluded from `analysis_candles`.

Latest completed GitHub Actions run `45966700299`: Stage A 44/44, B1 contract 32/32, B1 validator 65/65, B1 MTF 18/18, B1 gate/UI and C1 chart assertions passed, zero browser page errors. Live Bybit remains blocked by HTTP 403 from both public REST hosts. Exact current HTML blob: `1cb41cfbc03534441774eeeaac08f36082f19ab9` (299,978 bytes). Test harness blob: `8700f7ebedf6f4091b37d5e7d4c04ba22c2d92a8`.

This does not change release status: B1 remains unaccepted pending independent review of this exact blob, recorded live concurrent Bybit capture and spread calibration, transport-level abort test, latest iPhone Safari quality-panel check, and explicit owner acceptance. Main is unchanged; B2 remains not started.



## Latest verification refresh — 2026-11-27

After the preceding state entry, the MTF suite was expanded with explicit tests for required closed-candle history count and pending-finality context isolation. Latest candidate HTML blob is now `1cb41cfbc03534441774eeeaac08f36082f19ab9` (299,978 bytes). Latest completed CI run `45966502044`: Stage A 44/44, B1 Data Contract 32/32, B1 Quality Validator 64/64, B1 MTF 18/18, B1 gate/UI and C1 chart assertions passed, zero browser page errors. Total named self-tests: 158/158. Live Bybit remains blocked by HTTP 403 from both public REST hosts on GitHub Actions. Current branch comparison: 66 commits ahead, 0 behind main. Main remains unchanged.
