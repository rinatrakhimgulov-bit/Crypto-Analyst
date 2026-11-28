
# Crypto Analyst — Project State

**Дата актуализации:** 2026-11-27  
**Основная ветка:** `main`  
**Основной исходный файл:** `CryptoAnalyst_StageA_S6_updated.html`  
**Текущее состояние:** B2-A–B2-G интегрированы через PR #22; B3 chart UI интегрирован в `main` через PR #23 (merge commit `7d34a3539c9a655bca546bbb7b0c8ff2293b80ee`). B1/B2 аналитическое ядро и Stage A LONG/SHORT/WAIT не менялись в B3. Автоматические проверки на актуальном PR HEAD прошли; проверка владельцем на iPhone/Safari ожидается.

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



## CI record correction — 2026-11-27

A newer completed run, `45966700299`, supersedes the earlier run recorded above. It reports Stage A 44/44, B1 Data Contract 32/32, B1 Quality Validator 65/65, B1 MTF 18/18, B1 gate/UI and C1 chart assertions passed, zero browser page errors; 159/159 named deterministic self-tests. The gate harness now also exercises a VALID-looking report with a mismatched `snapshot_id` and verifies it is rejected. Exact HTML blob remains `1cb41cfbc03534441774eeeaac08f36082f19ab9` (299,978 bytes); current branch comparison is 85 ahead / 0 behind main. Live Bybit remains blocked by HTTP 403 from both REST hosts on GitHub Actions. This does not constitute live validation.




## Latest B1 integrity work — 2026-11-27

B1-C now verifies the exact legacy candle array used by the analytical engine is identical to the canonical closed-candle series validated by B1-B, including timestamps, OHLCV, quote turnover and last-closed price. Snapshot ID mismatch or candle-series mismatch blocks with INVALID/WAIT. A matching empty series preserves INSUFFICIENT. MTF suite is now 20 tests and covers the Bybit 1000-row cap and external cancellation.

Added `tools/b1_live_probe.html` schema v3 and `docs/specs/B1_LIVE_CAPTURE_PROCEDURE.md` with Windows-host/iPhone-Safari steps. The probe is read-only and stores captures locally. Chromium CI verifies its initial UI without contacting Bybit. Live capture is still pending because GitHub Actions receives HTTP 403 from both public hosts.

Latest CI run `45967551538`: Stage A 44/44, contract 32/32, validator 65/65, MTF 20/20, gate/UI/chart/probe smoke passed, zero page errors. Current HTML blob `2af63d1bbfec766606325450819d8ddff14173a2`, harness `a23585f9688b9a04336c7f99da7a972513882f8e`, probe `3b5df8f0feda730c7e6564808f40ad4526f0e44a`.

B1 remains not accepted: exact-blob independent review, real concurrent Bybit captures and spread calibration, real transport-level abort test, latest iPhone Safari quality panel check, and explicit owner acceptance remain open. Main unchanged; B2 not started.



## Latest candidate state — 2026-11-27 (supersedes prior artifact hashes/counts)

- PR #8 remains **DRAFT / NOT MERGED**; head commit `f6cc90e51096e30bd524a6e883f3ca0ad1273d79`.
- Current HTML blob: `2af63d1bbfec766606325450819d8ddff14173a2` (303,499 bytes).
- Current browser harness blob: `a23585f9688b9a04336c7f99da7a972513882f8e` (29,130 bytes).
- Branch comparison: 101 commits ahead, 0 behind main. Main HTML remains `02cbfb60d1a562e7b73e2734d1ab49b4cf91e2bf` (188,954 bytes), unchanged.
- Latest CI run `45967551538` passed: Stage A 44/44, B1 contract 32/32, B1 validator 65/65, B1 MTF 20/20; gate/UI/chart assertions passed, zero browser page errors; 161/161 named tests.
- Recent B1-C hardening: the legacy candle series and last-closed price consumed by the analytics engine must exactly match the canonical snapshot that passed validation; divergence forces WAIT. Empty but matching series preserve INSUFFICIENT status/reason rather than being mislabeled INVALID.
- MTF remains isolated from the chart and directional decision path. Live Bybit is blocked by HTTP 403 from both public hosts on the GitHub runner. Independent review, live concurrent capture/spread calibration, transport abort verification, Safari panel check, and explicit owner acceptance remain open. Main unchanged.



## Browser transport abort verification — 2026-11-27 (latest)

- Fixed fetch deadline classification: `fetchJsonWithTimeout` now aborts with `DOMException('Таймаут запроса', 'TimeoutError')`, distinguishing deadline expiry from user/supersession cancellation.
- Browser CI now exercises the actual Chromium `fetch` stack against a delayed local HTTP endpoint and the actual `BybitAdapter.fetchMarketSnapshot` path. It confirms external cancellation aborts both parallel kline/ticker requests and the timeout aborts the pending request; Node HTTP server observed all 3 client sockets close.
- Latest CI run `45968566553` passed: Stage A 44/44, B1 contract 32/32, validator 65/65, MTF 20/20; 161/161 named tests, gate/UI/C1/probe checks passed, zero browser page errors. Transport cancellation: 3 requests started / 3 sockets closed. Live Bybit remains SKIPPED because both public hosts return HTTP 403 to GitHub Actions.
- Current HTML blob `3d6a2fea8c4724d47a4d91bb73a53c6dedecd8cf` (303,522 bytes); test harness blob `70399a984b44f5f85024afcdf11289e4a73a6361` (32,071 bytes); probe blob `3b5df8f0feda730c7e6564808f40ad4526f0e44a` (12,446 bytes). Current branch head `c9d207d6dd3f8194bcc97a4d600e284a85594e04`, 124 ahead / 0 behind main. Main HTML unchanged at `02cbfb60d1a562e7b73e2734d1ab49b4cf91e2bf`.
- PR #8 remains draft and unmerged. Independent review, live Bybit captures/spread calibration, iPhone Safari panel check, and explicit owner acceptance remain open. MTF remains isolated from UI/directional decisions.



## Final branch-position refresh — 2026-11-27

After the documentation sync, PR #8 head is `5e94c29d1f5734e8b46200c04b6da51996ca9726`, still DRAFT / NOT MERGED. The code artifact remains HTML blob `3d6a2fea8c4724d47a4d91bb73a53c6dedecd8cf` (303,522 bytes); test harness `70399a984b44f5f85024afcdf11289e4a73a6361`. Branch comparison is now 131 ahead / 0 behind main (the additional commits are documentation/PR metadata refreshes; no change to the tested HTML/harness after CI run `45968566553`). Main HTML remains `02cbfb60d1a562e7b73e2734d1ab49b4cf91e2bf` (188,954 bytes), unchanged.


## B1-D live market-data integration — 2026-11-27 (latest)

- New draft PR #9: https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/9. Base is the B1 integration candidate branch; PR #8 remains a dependency and is still draft/unmerged. PR #9 is also draft/unmerged. No merge was performed.
- Implementation branch: feature/b1-d-live-market-data-2026-11-27; tested source commit 1b013781a8a7e507915bf73ae760d6ecbbbca0be; subsequent PR commits are documentation-only. Use PR #9 for the current branch head.
- Candidate HTML blob: 39e42c223419bd8a599f6c513ef6e269df120fcc (329,008 bytes; 6,166 lines). Browser harness blob: 44b492f92ffbbbb58f6cb830375b6330a556d5c4 (35,635 bytes). B1-D spec blob: 459d94bc05cbf226f7abd40f9c2d50a2ff702256.
- B1-D promotes the existing Bybit V5 public WS client from connection-health/log-only to validated ticker/kline callbacks. Ticker uses lastPrice only; non-price-only deltas do not refresh lastPrice freshness. Kline validates active symbol/timeframe, aligned timestamps, OHLCV invariants and explicit confirm. Live chart updates do not recalculate closed-candle analytics. REST remains history/bootstrap/reconciliation/recovery with the existing 30-second background poll.
- Closed REST candles cannot be mutated by WS events. A forming candle can be updated; a next candle can be appended only after its predecessor is confirmed. Gaps, conflicts, older events and invalid payloads trigger REST reconciliation. Confirmed candles schedule delayed REST refresh after the 500 ms finality lag plus 250 ms; WS confirm never directly promotes data into B1 analytics.
- Latest CI run 45981507604 passed: Stage A 50/50, B1 contract 32/32, B1 quality 72/72, B1 MTF 20/20; 174/174 deterministic tests. Browser-level live-handler-to-UI checks, desktop/mobile chart checks, transport cancellation/timeout checks and zero-page-error assertion passed.
- Real exchange connectivity is still NOT VERIFIED. GitHub Actions REST requests to both public Bybit hosts are blocked with HTTP 403; CI reports SKIPPED_PROVIDER_BLOCKED. The new browser test uses controlled events and does not prove a real Bybit WebSocket session. A real iPhone/Safari run must confirm live lastPrice and forming-candle updates, symbol/timeframe switching and reconnect/fallback behavior.
- main remains unchanged. Do not merge PR #8 or #9 automatically. B1-D automated implementation is complete; live browser acceptance and independent review remain open. B2 remains gated.


## Current verified status — 2026-11-27 (supersedes older status text above)

### Source of truth and branch status
- `main` remains unchanged.
- PR #8 (`integration/b1-mtf-architecture-2026-11-27`) is the B1 canonical contract / quality / MTF candidate; draft and unmerged.
- PR #9 (`feature/b1-d-live-market-data-2026-11-27`) is the B1-D live Bybit ticker/kline candidate stacked on PR #8; draft and unmerged.
- Latest PR #9 diagnostic patch commit: `0b4fdc9a4e6e837d144690854e4a87a4dcae6cbd`.
- Latest fetched HTML blob on that branch: `bb31ad9a7bc1f2ae0d4d55fc6fe423543b230baa`.
- PR #10 (`research/b2-market-structure-spec-2026-11-27`) is a documentation-only B2 design-review branch stacked on PR #9; draft and unmerged.

### B1 candidate status
- Candidate implementation includes provider-neutral canonical data, quality validation/gating, synchronized MTF assembly, and live Bybit WS ticker/kline chart updates.
- Latest recorded CI run for the diagnostic patch: `45987648219`; 174/174 deterministic tests passed and browser pageErrors were 0.
- GitHub Actions could not perform live Bybit REST verification because its runner received HTTP 403. This does not establish an exchange outage.
- User-provided iPhone diagnostics on 2026-11-27 show WS lastPrice freshness age 0.0s, a REST/WS price delta of 5.7 USDT at the captured instant, forming-candle OHLC, and `ticker→свеча UPDATED`. This supports that the handler applied a ticker update; it does not prove complete live-feed acceptance.
- User reports that price changes and candle color changes, but smooth visible OHLC animation is absent. This is explicitly deferred as non-critical; do not spend the next implementation cycle polishing animation.
- B1 is **NOT ACCEPTED**. Remaining gates: independent review of exact candidate source; real concurrent Bybit 1D/4H/1H captures with measured provider-time spread and documented fail-closed policy; real iPhone/Safari switch/reconnect/background/fallback verification; explicit owner acceptance.
- No B1 candidate has been merged into `main`.

### B2 Market Structure
- Existing design baseline: `docs/specs/B2_MARKET_STRUCTURE_ENGINE_SPEC_2026-11-27.md`.
- Internal design review: `docs/audits/B2_SPEC_DESIGN_REVIEW_2026-11-27.md`.
- Review identified unresolved implementation rules for plateau confirmation, same-side pivot replacement, protected swings, initial trend semantics, break buffer, event ordering, and S/R/retest policies.
- B2 production code and UI integration have **NOT STARTED**. B2 remains blocked from implementation/live integration until B1 acceptance.
- The next permitted B2 step after B1 acceptance is B2-A: pure causal swing detection with explicit pivot/confirmation/availability timestamps, prefix-invariance, and batch/online equivalence tests.

### Current operating rule
Do not merge PR #8, #9, or #10 automatically. Keep `main` untouched. Treat all branch candidates as unaccepted until their stated gates are closed.

## B2 design policy freeze — 2026-11-27 (latest; supersedes prior B2 blocker status)

The B2 specification now has Section 15, "Frozen implementation policy — v1", resolving the seven design ambiguities recorded in the internal review:
- plateau detection uses a maximal contiguous equal-price run, rightmost representative, and right-strength candles counted after the plateau ends;
- exact-price equality is explicitly versioned as EXACT_PRICE_V1; no guessed tick/ATR/percentage tolerance;
- raw pivots remain immutable; same-side sequence replacement is deterministic and symmetric;
- initial trend state, initial break naming, protected swing initialization/advancement, and provenance are explicit;
- break policy is ZERO_BUFFER_V1, strict close beyond level; equality is not a break;
- fixed per-candle event order prevents same-candle hindsight; consumed levels cannot emit duplicate break events;
- S/R zones and retest/failure logic are explicitly deferred beyond B2-A/B/C.

The design review has a resolution pass mapping R1–R7 to the new policy. This is an internal design closure, NOT an independent external audit and not empirical validation. Exact equality and zero buffer are baseline choices to be examined in replay fixtures.

Current status remains unchanged at the release boundary:
- B1 is NOT ACCEPTED. Its exact-source independent review, real concurrent Bybit 1D/4H/1H capture and spread calibration, actual iPhone/Safari lifecycle verification, and explicit owner acceptance remain open.
- B2 production implementation remains NOT STARTED and blocked by B1 acceptance. After B1 acceptance, B2-A/B/C can be proposed as separate increments; no B2-D/E/F scope is bundled.
- PR #10 remains documentation-only, draft and unmerged. main and the application HTML are unchanged.

## B2-A isolated implementation candidate — 2026-11-27 (latest)

The user explicitly directed work to move beyond repeated B1 UI checks. Do not ask the user to repeat timeframe-switching or live-price checks already completed. Candle animation polish is deferred to the chart UI stage.

An isolated B2-A candidate has now been created on branch feature/b2a-causal-swing-engine-2026-11-27:
- src/analysis/b2-causal-swing-engine.js — pure, provider-neutral causal raw swing-high/swing-low detector.
- tests/b2a-causal-swing-engine.test.cjs — deterministic regression fixtures.
- .github/workflows/b2a-causal-pivots.yml — dedicated Node test workflow.
- B2 spec clarification: pivot confirmedAt is the right-window candle close boundary; availableAt includes the explicit B1 finality safety lag and must be <= analysis_as_of_ms.

The engine requires a VALID B1 quality report whose snapshot_id, symbol, timeframe, analysis_as_of_ms and B1 policy version exactly match the canonical snapshot and explicit B2 policy. It rejects non-VALID/mismatched input, invalid provenance, out-of-order/duplicate/misaligned candles, non-closed candles, and forming/unknown overlap. It emits only confirmed raw pivots, with rightmost plateau representative and causal timestamps. No swing sequence, BOS/CHoCH, zones, retests, chart integration or LONG/SHORT connection is included.

Local deterministic harness verification in the development environment: 11/11 B2-A tests passed. This is not yet a reported GitHub Actions run. The PR remains draft/unmerged; no application HTML or main branch changed.

B1 release acceptance is still a separate gate for production integration. This isolated B2-A candidate is research/verification code only; it does not activate B2 in the running app.


## B2-A version-binding hardening and CI verification — 2026-11-27

The isolated B2-A candidate now requires exact B1 version identity, not merely non-empty strings:
- policy declares `b1_contract_version`, `b1_validator_version`, and `b1_quality_policy_version`;
- canonical snapshot `contract_version` must match the declared B1 contract version;
- quality report `validator_version` and `policy_version` must match the declared accepted B1 versions exactly;
- missing or mismatched versions fail closed.

The B2-A input remains one canonical timeframe snapshot per invocation. This is intentional and matches the B2 design contract; it does not mean the engine accepts an unsynchronized outer MTF object. MTF synthesis remains gated on B1 acceptance.

Regression suite: 13/13. GitHub Actions run [46005202794](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46005202794) completed successfully on commit `f41c85a3d09cbbec602fe1eaef8902b5f52de685`. Candidate remains isolated, draft and unmerged. No application HTML or `main` changes.


## Stage transition decision — 2026-11-27 (latest)

The owner approved deferring Stage 1 visual/live-chart polish and prioritizing the fundamental analytical stage.

- Stage 1 is **FROZEN FOR FEATURE WORK**, not abandoned. The live chart animation, exact live-price comparison, and remaining iPhone/Safari market-data diagnostics are deferred for a later return.
- Data-integrity safeguards are not deferred: analytical modules must continue to require validated, closed-only B1 input and fail closed on non-VALID data.
- Stage 2 / B2 Market Structure is the active research-development priority.
- B1 remains **NOT ACCEPTED**. B2 candidates may be developed and tested in isolated research branches only; they must not be wired into the live app or directional LONG/SHORT path until B1 acceptance and explicit owner approval.
- B2-A remains isolated in PR #12, draft and unmerged. Its 13-test baseline was expanded with seven edge-case regressions. GitHub Actions run 46010999225 passed **20/20** on commit `8583d5d58158a183a3185fb1397abb3cbe8cb233`.
- The expanded B2-A suite now explicitly checks longer plateaus, equal highs in non-contiguous left/right windows, incomplete right confirmation, deep immutability, duplicate timestamps, and out-of-order candles.
- No application HTML, main branch, live decision path, or production analytics was changed by this test expansion.

Next B2 work must remain staged: independently review B2-A's exact source and tests; only after that, develop B2-B swing-sequence labels as an isolated consumer of immutable B2-A pivots. BOS/CHoCH, zones, retests, MTF decision integration and UI remain later increments.


## B2-B isolated swing-sequence candidate — 2026-11-27

- New pure module: `src/analysis/b2b-swing-sequence-engine.js`.
- Consumes only a VALID B2-A result and requires exact B2-A engine/policy identity plus the exact B1 validator and quality-policy identities carried by B2-A admission.
- Retains every raw pivot. Produces a separate alternating sequence in B2-A `available_at_ms` order; it rejects non-monotonic availability rather than sorting by visual source time.
- Implements symmetric same-side replacement: higher highs and lower lows replace the active same-side sequence pivot; less-extreme/equal pivots remain in raw evidence as `SUPERSEDED_FOR_SEQUENCE`.
- Emits `INITIAL_HIGH`, `INITIAL_LOW`, `HH`, `LH`, `EQH`, `HL`, `LL`, `EQL`, comparison pivot IDs, price delta and relative delta percentage.
- Output is deeply immutable without freezing nested objects owned by the upstream B2-A input.
- GitHub Actions run 46011622297 passed **19/19** deterministic B2-B tests on commit `eefa675c5cacab59e7d3aa0c25757dd1c22bbbc8`.
- PR #13 is draft and unmerged, based on the B2-A candidate branch. This code is research-only; it is not wired into the app or LONG/SHORT path. B1 remains NOT ACCEPTED.

Next: independent review of exact B2-A/B2-B source and tests; then B2-C protected swings and BOS/CHoCH only as a separate isolated increment, still gated from production by B1 acceptance.


---

## 18. Current verified state — B2-A through B2-G (2026-11-27)

**Candidate branch:** `feature/b2g-chart-projection-contract-2026-11-27`  
**Draft PR:** #20, base `feature/b2f-mtf-structure-confluence-2026-11-27`  
**Scope:** isolated analytical modules and research harness only. No application HTML or `main` changes.

### Implemented candidate modules

- B2-A: causal swing pivot detection, exact-price plateau policy, rightmost plateau representative, availability timestamps and fail-closed B1 admission.
- B2-B 2.2.0: alternating swing sequence, explicit same-candle dual-pivot exclusion, immutable sequence history at availability time, final active sequence kept separately.
- B2-C 2.1.0: HH/HL/LH/LL state, BOS/CHoCH/sweep event replay from causal sequence history, final active pivots separated from historical event pivots.
- B2-D: support/resistance zones and candidate levels, with ambiguous dual pivots allowed only as explicitly tagged raw S/R evidence.
- B2-E: breakout/retest lifecycle; source pivot provenance validated against accepted-at-availability history.
- B2-F: 1D/4H/1H structure confluence against an MTF snapshot contract.
- B2-G: causal chart-neutral projection DTOs; active, superseded and ambiguous pivots are distinct; event sources are checked against sequence history.

### Verified test and historical replay evidence

- Integrated GitHub Actions run `46031937203`: **181/181** deterministic tests passed (B2-A 21, B2-B 21, B2-C 35, B2-D 21, B2-E 24, B2-F 30, B2-G 29).
- Historical replay run `46032038435`: full B2-A/B/C on BTCUSDT and ETHUSDT 1H/4H/1D archive series; 30 sampled 160-candle B2-A–B2-E windows; synchronized MTF B2-F/B2-G execution for both symbols.
- Prefix invariance: 18/18 checks passed across the six symbol/timeframe series, comparing B2-A pivot availability and B2-C event history at three historical cutoffs.
- The historical report is recorded in `docs/audits/B2_PRELIMINARY_HISTORICAL_REPLAY_2026-11-27.md`; CI artifact name: `b2-historical-replay-report`.

### Critical limitations

- Archive ends 2025-12-05; it is not current 2026 market data.
- Historical replay used a synthetic B1-valid wrapper, not the production B1 REST/WS adapters.
- MTF provider-time spread was synthetic zero; live Bybit spread calibration is still open.
- Zone/retest tolerances and 2/2 pivot strength are exploratory settings, not calibrated production parameters.
- Exact-source independent audit and iPhone/Safari acceptance remain outstanding.
- B1 remains NOT ACCEPTED. B2 is not approved for production or app integration.
- Do not merge PR #20 or change `main` without explicit owner approval.

### Next gates before app integration

1. Independent exact-source review of the current B2-A–B2-G branch and historical harness.
2. Review and calibrate pivot strength, zone span and retest parameters on additional/out-of-sample data.
3. Complete B1 live concurrent Bybit 1D/4H/1H capture and provider-time spread policy.
4. Verify the current candidate on iPhone/Safari, including symbol/timeframe switches, reconnect and stale/fallback handling.
5. Prepare a separate integration candidate only after all gates pass.



## 19. B2 application integration candidate — 2026-11-27

**Integration branch:** `integration/b2-market-structure-ui-2026-11-27`  
**Base for the integration candidate:** B1-D candidate `feature/b1-d-live-market-data-2026-11-27` (not `main`).  
**Current integration commit:** `32bb3a875c4031bb171b935120ef174b68b828cc`.

### App changes

- Inlined B2-A through B2-G browser-compatible modules into the single-file HTML prototype, preserving the existing single-file delivery model.
- Added a B2 Market Structure panel with structure state, active/ambiguous pivots, last BOS/CHoCH event, confirmed/candidate S/R counts, retest lifecycle summary and explicit MTF-disabled status.
- Added chart overlays for causal swing markers, structure events and confirmed S/R zones.
- Confirmed zones are rendered only from the first chart candle at or after `visible_from_ms`; they are not backdated onto candles that predate confirmation.
- B2 remains display-only. It does not modify the existing LONG/SHORT/WAIT decision path.
- B2-F MTF is deliberately not called by the app until live provider-time spread is measured and calibrated. B2-G emits an explicit null MTF context for this single-timeframe view.
- Zone span and retest tolerances are explicitly exploratory display parameters, not calibrated trading settings.

### Verified CI

- B2 application integration run [46034275312](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46034275312): all seven B2 module suites and the browser/mobile integration job passed.
- Browser fixture: 220 closed synthetic 1H candles; B1 quality VALID; B2 output VALID; 33 swing markers, 65 structure events, 2 confirmed zones and 2 retest lifecycles; MTF context null as intended; projection attached to chart; B1 STALE input correctly blocked at B1 admission.
- Mobile viewport check at 390×844: B2 panel visible, card width 366 px, chart width 334 px, no horizontal overflow; zero browser page errors.
- B1 browser/data verification run [46034276646](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46034276646) passed. Live Bybit REST check was explicitly SKIPPED_PROVIDER_BLOCKED because both public REST hosts returned HTTP 403 from the GitHub runner. This is not a live Bybit success.
- B2 research suite run [46034274801](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46034274801) passed all seven module test steps.

### Remaining gates before owner iPhone review / production acceptance

1. Re-run the exact latest integration commit through CI after the final chart availability-time overlay regression.
2. Provide an iPhone/Safari preview of this branch and verify the actual Bybit feed, chart overlays, symbol/timeframe switching and reconnect/fallback behavior.
3. Calibrate MTF provider-time spread from concurrent live Bybit 1D/4H/1H captures before enabling B2-F in the app.
4. Review/calibrate 2/2 pivot strength, S/R zone span and retest tolerances on current and out-of-sample market data.
5. Keep B2 display-only until a separate validation supports any later connection to directional decisions.

No merge to `main` has been made. The integration branch and any PR remain unmerged pending owner review.


## 2026-11-27 — B2 application integration preview

A separate integration-preview branch now embeds B2-A through B2-G into the single-file HTML prototype. This is a research/visualization preview, not production acceptance.

- Branch: `integration/b2-market-structure-ui-2026-11-27`.
- B2-A/B/C/D/E run against the existing B1 canonical snapshot and quality report for the selected chart timeframe.
- B2-G creates the chart projection. The UI renders causal swing labels, structure events, and confirmed support/resistance zones; a separate panel summarizes structure, events, zones, and retest lifecycle.
- B2-F remains embedded as a research module but is not invoked in the live UI. The B2-G projection contract now permits an explicit null MTF result and returns `mtf_context: null`; this is not MTF approval and does not create directional permission.
- Zone span (0.1% of median close) and retest tolerance/buffers (0.05%) are provisional visualization parameters only. They are not optimized or validated trading parameters.
- B2 output does not feed the Stage A LONG/SHORT/WAIT decision. The panel explicitly identifies the B2 layer as research-only.

### Verified integration evidence

- B2 research suite run `46034125614`: 182/182 deterministic tests passed (B2-A 21, B2-B 21, B2-C 35, B2-D 21, B2-E 24, B2-F 30, B2-G 30).
- B2 app integration run `46034125941`: passed. Browser fixture used 220 closed synthetic candles and produced 33 active swing markers, 65 structure events, 2 confirmed zones and 2 retest lifecycles. Invalid/stale B1 quality blocked B2 at the B1 admission gate.
- Mobile viewport check at 390×844: B2 card visible, chart width 334 px, no horizontal overflow.
- B1 browser suite run `46034125888`: passed with zero browser page errors. Live Bybit capture was explicitly skipped because the GitHub runner was denied by the provider (HTTP 403); this is not a live-market pass.
- Historical replay remains separate: run `46032038435`, six BTC/ETH timeframe series, 18/18 prefix-invariance checks. Archive ends 2025-12-05 and the replay uses a synthetic B1-valid wrapper.

### Remaining acceptance gates

1. Owner visual/functional verification on iPhone Safari.
2. Live concurrent Bybit 1D/4H/1H provider-time capture and measured spread policy before enabling B2-F.
3. Independent exact-source review of the final integrated HTML and modules.
4. Calibration/out-of-sample review of pivot, zone and retest parameters before any trading-decision use.

`main` remains unchanged. No PR has been merged. This preview must not be treated as an approved trading signal source.


### Clean integration PR snapshot

- Clean preview branch based directly on current `main`: `integration/b2-clean-preview-2026-11-27`.
- Draft PR #22: https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/22
- PR base is current `main`; branch is one snapshot commit ahead before CI workflow updates, with no main changes or merges.
- This clean branch preserves the newer main-branch B2-F spec and the main `docs/Screenshots.md` file.
- PR #22 remains draft. Merge only after iPhone/Safari acceptance, live MTF calibration, independent review and explicit owner approval.

### Clean integration branch verification (latest)

- Current draft PR #22 head: `3d6c721044118f5a04f5498e60f03c1e13b7597b`.
- Base `main`: `bc8af9270dfa5f3d475ae928731476b6dae87b2a`; comparison is 9 commits ahead / 0 behind.
- B2 app integration run 46034803848: success; all seven B2 module test steps and Chromium/mobile integration passed.
- B2 suite run 46034803544: success, 182/182 deterministic tests.
- B1 browser/data run 46034808544: success; deterministic groups 50/50, 32/32, 72/72, 20/20; zero browser page errors.
- Live Bybit REST was skipped as `SKIPPED_PROVIDER_BLOCKED` because GitHub runner requests to both public REST hosts received HTTP 403. No live Bybit pass is claimed.
- Synthetic mobile viewport 390px: no horizontal overflow. iPhone Safari remains untested.
- PR #22 is still draft and unmerged. `main` is unchanged.


### Clean PR #22 verification refresh

- Clean-branch B2 research suite: run `46034803544`, passed.
- Clean-branch B2 app browser/mobile integration: run `46034803848`, passed. The browser test also verifies that a confirmed S/R zone starts at its causal `visible_from_ms` position rather than being backdated across the chart.
- Clean-branch B1 browser suite: run `46034803715`, passed with zero page errors. Live Bybit capture was skipped due GitHub runner HTTP 403.


- Clean-branch full historical replay: run `46035136810`, passed on the final B2 module set. The report explicitly identifies the replay as archive-based with a synthetic B1-valid wrapper and no live-provider or trading-edge claim.


### Full B2 historical replay completed

- Report: `docs/audits/B2_HISTORICAL_REPLAY_RESULT_2026-11-27.md`.
- Workflow: [46035136810](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46035136810), successful; artifact ID 15216436698.
- Full-series B2-A/B/C replay completed on six BTCUSDT/ETHUSDT 1H/4H/1D series; integrity checks found zero invalid rows, duplicates, gaps or off-grid timestamps.
- 18/18 prefix-invariance checks passed.
- B2-D/B2-E were tested on five sampled 160-candle windows per series plus final synchronized MTF windows; this was not a full-series zone/retest replay.
- Synthetic synchronized MTF outputs were UP|UP|DOWN / MIXED for BTC and ETH. Provider-time spread was artificially set to zero in the historical wrapper; live spread calibration remains open.
- No profitability, expectancy, win-rate or current-2026 regime adaptation was tested. Archive ends 2025-12-05.


## 2026-11-27 — B2 merge и старт B3

- Исправлена устаревшая запись в заголовке документа: PR #22 действительно merged в `main`; merge commit `d2b8220572ec407a62c5a359af3c0264919932b1`.
- Main HTML включает B2-A…B2-G и B2 chart projection. B2-F остаётся отключённым до live provider-time calibration; B2 не подключён к LONG/SHORT/WAIT.
- B3 начат в ветке `feature/b3-chart-ui-redesign-2026-11-27`, созданной от merge commit выше.
- Цель B3: увеличить мобильную рабочую область графика, добавить режимы Clean/Structure/Full и независимые переключатели слоёв, снизить плотность меток без изменения B1/B2 output.
- Спецификация: `docs/specs/B3_CHART_UI_REDESIGN_SPEC_2026-11-27.md`.
- Ветка-кандидат содержит изменения HTML, browser integration test и workflow trigger. Оба inline JavaScript script проходят syntax check. На commit `c8a79a2429f10fafdca28987c28e384ecba467db` GitHub Actions прошёл: B1 browser/live-data verification SUCCESS, B2 application integration SUCCESS (включая B2-A…G и мобильные browser assertions). После небольшой очистки диагностического тестового вывода повторный CI для текущего HEAD ожидается. iPhone Safari acceptance пока не подтверждён.
- B3 не merged; `main` остаётся неизменным относительно merge commit #22.


### B3 browser/CI verification — 2026-11-27

- B2 application integration workflow [46038517628](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46038517628): SUCCESS. B2-A…B2-G deterministic suites passed; browser integration and mobile chart UI assertions passed; zero browser page errors.
- B1 candidate browser/data workflow [46038517602](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46038517602): SUCCESS. Stage A 50/50, B1 contract 32/32, quality 72/72, MTF 20/20; browser chart/volume and mobile layout checks passed; zero page errors.
- B3 browser test verified Clean/Structure/Full presets, manual layer toggle/custom mode, 390×844 mobile viewport, chart height >=440 px, no horizontal overflow, and causal S/R zone positioning.
- Live Bybit REST probe was skipped as `SKIPPED_PROVIDER_BLOCKED`: GitHub Actions runner received HTTP 403 from both `api.bybit.com` and `api.bytick.com`. This is not a live Bybit pass or evidence of provider unavailability elsewhere.
- The first CI attempt exposed mobile horizontal overflow from chart controls and an old B1 visual test assumption that EMA200 was always visible. Both were corrected: chart grid/control containers now constrain width, and the EMA regression explicitly enables the EMA layer before testing it.
- PR #23 was merged into `main` as `7d34a3539c9a655bca546bbb7b0c8ff2293b80ee`. iPhone/Safari owner visual acceptance remains pending after integration.


## B3 — завершение реализации и интеграция (2026-11-27)

- PR #23 merged в `main`: https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/23.
- Merge commit: `7d34a3539c9a655bca546bbb7b0c8ff2293b80ee`; проверенный PR HEAD: `e65715efea1fa97527f03ccb7e883cc8d6737e58`.
- Основной HTML в `main`: blob `6b5521195454bc3d3be3e18cc7f4fb10682ee48b`, 511,597 bytes. B3 UI присутствует в основном файле.
- На точном PR HEAD успешно завершились B1 browser/live-data workflow `46039070502` и B2 application integration workflow `46039070648`. B2 job включает B2-A…B2-G deterministic suites и Chromium/mobile browser checks; B1 job завершился SUCCESS.
- Проверки включали 390×844 mobile viewport, высоту canvas не менее 440 px, отсутствие горизонтального переполнения, Clean/Structure/Full presets, ручное переключение слоёв и причинное позиционирование S/R.
- Live Bybit REST probe пропущен/заблокирован на GitHub runner из-за HTTP 403 от `api.bybit.com` и `api.bytick.com`. Это не подтверждает live Bybit connectivity.
- iPhone/Safari acceptance остаётся следующим пользовательским этапом после интеграции. B3 меняет представление графика; B1/B2 engine и LONG/SHORT/WAIT не подключались к новым UI переключателям.

---
## Актуальное продуктовое решение и план после B3 — 2026-11-27

Этот раздел — актуальная фиксация решения владельца проекта и имеет приоритет над более ранними, неактуальными статусами и очередностью этапов в этом документе. Фактический код и merge-статусы сверять с GitHub main.

- B3 интегрирован в main через PR #23; пользователь сообщил, что график стал значительно лучше.
- Следующий технический этап — **B4: надёжный Live Data Path**. До изменения кода провести аудит текущего main; обеспечить согласованный REST/WS, обновление last price и forming candle, finality/reconciliation, reconnect/fallback и fail-closed quality gate. Синтетические проверки не заменяют реальную проверку Bybit на iPhone/Safari.
- **Market Journal утверждён как B5**, проектирование его схемы допускается параллельно B4. Первая версия: локальное хранение + JSON export/import, без backend. Журнал записывает market snapshot, data quality/provenance, структуру и доступные на момент снимка события, решение LONG/SHORT/WAIT/skip, необязательный план и последующий исход. Записывать также WAIT и пропуски, не только сделки. Различать paper observations и реальные сделки; неизвестный исход хранить как pending.
- После этого: B6 — развитие/проверка аналитического ядра; B7 — максимум 2–3 объяснимых setup-сценария; B8 — проверка на журнале и независимых исторических/out-of-sample данных; B9 — объяснимые решения и риск-контекст.
- Не добавлять много индикаторов, не строить автотрейдинг и не мигрировать стек ради моды. Сначала доказать практическую необходимость.
- Архитектурная цель: отделять data, quality, analytics, journal и UI, чтобы будущий переход на TypeScript/React и/или backend не требовал выбрасывать проверенные алгоритмы и тесты. Переписывание интерфейса при миграции возможно.

Единая актуальная дорожная карта: docs/ROADMAP.md, раздел «Актуализация продуктового направления и ближайших этапов — 2026-11-27».


## 2026-11-28 — B4 начат, аудит фактического main

- Создана draft PR #24: `B4: harden live candle finality and REST/WS reconciliation`; ветка `feature/b4-live-data-hardening-2026-11-28`.
- Аудированный main HTML blob до изменений: `6b5521195454bc3d3be3e18cc7f4fb10682ee48b` (511,597 bytes, 9,514 lines).
- Важное уточнение: текущий main уже содержит реальную интеграцию Bybit ticker+kline WebSocket в UI, REST bootstrap/history, 30s polling, REST reconciliation и reconnect. Старые описания LOG-ONLY / unmerged для этого кода устарели.
- Найден и исправляется дефект finality: подтверждённая WS-свеча могла измениться до REST reconciliation. Патч запрещает ticker и поздним same-ts WS delta менять `confirmed:true`; точный повтор считается duplicate; подтверждённая свеча отображается как закрытая.
- Stage A B1-D тест расширен на ticker-after-confirm, late delta и exact duplicate.
- B4 остаётся IN PROGRESS. CI на точном финальном PR HEAD, полный аудит race/recovery/fallback и реальный iPhone/Safari acceptance ещё обязательны. Live Bybit на GitHub runner не подтверждён.
- Подробности: `docs/audits/B4_MAIN_AUDIT_2026-11-28.md`.

- Дополнительно закрывается REST/WS race: REST refresh раньше восстанавливал только ticker lastPrice, теряя более свежий WS kline OHLCV. Добавлен versioned/freshness-aware replay последней kline только если она новее provider time REST snapshot; добавлен детерминированный regression. См. B4 audit.

- Добавлена защита от межтопикового out-of-order: provider timestamps не позволяют старому ticker перезаписать более новую kline; старая kline может обновить накопленный OHLCV, но не регрессировать close относительно более нового ticker. Regression проверяет оба порядка.
