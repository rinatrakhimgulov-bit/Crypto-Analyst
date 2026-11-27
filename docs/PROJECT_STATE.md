
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


## Current stage decision — 2026-11-27 (latest; supersedes older priority text)

The owner approved pausing Stage 1 visual/live-chart polish and prioritizing the fundamental analytical stage.

### Stage 1 status
- Stage 1 is **FROZEN FOR FEATURE WORK**, not abandoned.
- Deferred: smooth forming-candle animation, precise live-price comparison against Bybit, remaining real iPhone/Safari live-feed diagnostics and visual polish.
- These items must be revisited later. Do not spend the current development cycle on chart cosmetics.
- Data integrity is not deferred: analytical modules must consume validated, closed-only B1 data and fail closed on non-VALID input.

### B1 status
- B1 remains **NOT ACCEPTED** and has not been merged into `main`.
- PR #8 (B1 canonical/quality/MTF candidate) and PR #9 (B1-D live ticker/kline candidate) remain draft/unmerged; real Bybit verification and other acceptance gates remain open.
- No B2 candidate may be connected to the running application or directional LONG/SHORT path until B1 acceptance and explicit owner approval.

### Stage 2 / B2 status
- Stage 2 / Market Structure is the active research-development priority.
- B2 design policy is frozen in `docs/specs/B2_MARKET_STRUCTURE_ENGINE_SPEC_2026-11-27.md` and the internal review `docs/audits/B2_SPEC_DESIGN_REVIEW_2026-11-27.md`.
- B2-A isolated raw causal swing engine: PR #12, draft/unmerged. Expanded deterministic suite **20/20 passed** in GitHub Actions run [46010999225](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46010999225), tested code commit `8583d5d58158a183a3185fb1397abb3cbe8cb233`.
- B2-B isolated swing-sequence engine: PR #13, draft/unmerged, based on the B2-A candidate branch. Deterministic suite **19/19 passed** in run [46011622297](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46011622297), tested code commit `eefa675c5cacab59e7d3aa0c25757dd1c22bbbc8`.
- Both candidates are research-only. Neither is imported by the application HTML. No B2-C BOS/CHoCH, protected-swing state, zones, retests, MTF decision path, chart integration or LONG/SHORT connection is implemented.
- The next B2 increment is an independent exact-source review of B2-A/B2-B, followed by B2-C as a separate isolated candidate. Production integration remains blocked by B1 acceptance.

### Source-of-truth protection
- `main` and the canonical HTML remain unchanged by the Stage 2 candidate work.
- PRs #8–#13 are not to be merged automatically. Explicit owner acceptance is required for any merge or production integration.


### B2-B integrated verification refresh — 2026-11-27

B2-B now has 20 deterministic tests, including a direct integration fixture that executes the actual B2-A engine and feeds its VALID output into B2-B. GitHub Actions run 46012201698 passed 20/20 on code commit `9c102e8f3984daccf0d7d94bcb8807c549e0dcf1`. This remains deterministic research verification only; no live Bybit or production-app validation.


## Stage 2 current state — 2026-11-27 (supersedes earlier status entries)

Stage 1 visual/live-chart refinement is frozen temporarily. The deferred items remain forming-candle animation, exact live-price comparison against the exchange chart, and remaining real iPhone/Safari live-feed lifecycle verification. B1 data-quality/finality controls remain mandatory; only visual polish is deferred.

B1 is **NOT ACCEPTED** and remains unmerged. PR #8 and #9 remain draft candidates. B2 candidates are permitted only as isolated research modules; no B2 code may be connected to the running application or LONG/SHORT path before B1 acceptance and explicit owner approval.

### B2-A
- Isolated causal raw swing engine in `src/analysis/b2-causal-swing-engine.js`.
- 20/20 deterministic tests passed in GitHub Actions run [46010999225](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46010999225), tested commit `8583d5d58158a183a3185fb1397abb3cbe8cb233`.
- PR #12 remains draft/unmerged.

### B2-B
- Isolated alternating swing sequence with same-side replacement and HH/HL/LH/LL/EQH/EQL labels.
- 20/20 deterministic tests, including actual B2-A → B2-B integration, passed in run [46012309171](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46012309171).
- PR #13 remains draft/unmerged.

### B2-C
- Isolated structure-state engine: initial bullish/bearish breaks, BOS, protected-swing CHoCH, wick sweeps, gap-through annotation, strict zero-buffer close boundary and consumed-level deduplication.
- Revalidates B1/B2 version and snapshot identity, candle continuity/provenance/finality, source-candle pivot prices, and independently reconstructs B2-B sequence from raw pivots.
- 28/28 deterministic tests passed in run [46013846058](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46013846058) on exact head commit `a58441aa4f39aa6e3b98650624f07a2041e7152a`.
- Includes a full deterministic B1 snapshot → B2-A → B2-B → B2-C integration fixture.
- PR #15 is draft/unmerged.

All three B2 increments remain research-only. None is imported by the application HTML. No MTF directional integration, zones, retests, chart overlays, trade scenarios or LONG/SHORT recommendations are implemented. The tests are deterministic fixtures, not live Bybit evidence or proof of trading profitability.

Next: independent review of exact B2-A/B/C source blobs and tests. Only after that should B2-D support/resistance zones be designed as a separate increment. Do not merge PRs #8–#15 without explicit owner approval.


### B2-D — Support/resistance zones (2026-11-27)
- Isolated zone engine in `src/analysis/b2d-support-resistance-engine.js`, consuming VALID B2-C output and exact upstream identities.
- Groups swing lows as SUPPORT and swing highs as RESISTANCE. The roles remain separate.
- Requires an explicit instrument/timeframe-scoped absolute max-span policy; no guessed default, ATR fallback or implicit percentage tolerance.
- Uses MAX_TOTAL_SPAN_V1 so total cluster span cannot exceed the configured value; no transitive chaining.
- Requires independent source-candle touches; single-touch groups remain candidate levels.
- Preserves observed bounds, median representative, pivot IDs, touch times and zone availability; no probability-like strength score.
- 20/20 deterministic tests passed in GitHub Actions run [46014759139](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46014759139) on commit `0574858db12dd2082d7449f5512fa8461fceac63`, including full B1 → B2-A → B2-B → B2-C → B2-D fixture.
- PR #16 is draft/unmerged. The absolute-span policy is not yet calibrated on live BTC/ETH market data.


## Stage 2 audit and hardening update — 2026-11-27 (current)

This entry supersedes earlier candidate counts and records additional defects found during internal review.

### Current isolated candidates and exact CI evidence
- **B2-A:** head `bb13960e647d399b6b05ee12c21f5a2fdeb8265d`; 21/21 deterministic tests passed in [run 46014698432](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46014698432). New hardening rejects missing candle intervals before pivot detection.
- **B2-B:** head `b209293212ac1bd910939eed465f140514b9e959`; 20/20 passed in [run 46015818149](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46015818149), including actual B2-A → B2-B execution.
- **B2-C:** head `e9590ddb65c9f3a09a28279efdb064b6caa6a4a2`; 33/33 passed in [run 46015831238](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46015831238), including full B1 → B2-A → B2-B → B2-C chain.
- **B2-D:** head `9012e514a29b755ac9208f1f495c3f560638b0a1`; 21/21 passed in [run 46015873986](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46015873986), including full B1 → B2-A → B2-B → B2-C → B2-D chain.

### Defects found and corrected
1. B2-A accepted sorted candle arrays containing a missing interval. It now distinguishes duplicate timestamps, out-of-order candles and missing intervals; missing intervals fail closed.
2. B2-C previously allowed any post-transition swing high/low to become a BOS continuation level. A lower high in UP or higher low in DOWN could create a false BOS. Continuation now requires HH in UP and LL in DOWN.
3. B2-C's global consumed-pivot set could prevent a previously consumed pivot from serving as the protected reversal level after a state transition. A protected pivot is now re-armed in its new structural role, with symmetric reversal tests.
4. B2-C previously reconstructed B2-B sequence only from B2-B's own raw list. It now requires the exact B2-A result and verifies B2-B's raw pivot set against B2-A, rejecting a pivot omitted from both B2-B raw evidence and sequence.

### B2-D explicit limitations
- Cluster tolerance is absolute price span and must be calibrated separately per instrument/timeframe.
- Last-touch age is exposed, but freshness is deliberately NOT_CLASSIFIED. No zone is described as currently active based on age.
- Zone IDs are membership-derived and are not guaranteed persistent across changing snapshots. B2-E must not assume these IDs are stable lifecycle keys.
- Raw confirmed pivot evidence is preserved, including pivots superseded for the alternating sequence.

### Release boundary
All B2 candidates remain research-only, draft and unmerged. They are not imported into application HTML and do not feed chart, MTF or LONG/SHORT/WAIT. B1 remains NOT ACCEPTED. Deterministic fixtures are not live Bybit evidence. Independent external review and explicit owner acceptance remain outstanding.


## B2-E next increment — 2026-11-27

Draft research specification is available in PR #18:
https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/18

B2-E uses B2-C event IDs as stable lifecycle identity, not B2-D membership-derived zone IDs. It defines pivot-level retest tolerance, a maximum closed-bar window, touch/success/failure/expiry states, strict equality handling, same-candle no-lookahead and prefix replay. B2-D zone membership is contextual only in v1; full zone-edge breakouts and role reversal are deferred.

B2-E is specification only; no implementation or app integration. B1 remains NOT ACCEPTED.


### B2-E — Breakout/retest/failure lifecycle (2026-11-27)
- Isolated engine in `src/analysis/b2e-breakout-retest-engine.js`, consuming VALID B2-C events, B2-D zones and the exact B1 snapshot.
- Reconstructs the historical zone using only pivots available strictly before the breakout candle close. Later pivots cannot create or widen a zone retroactively.
- Maps bullish breaks to resistance zones and bearish breaks to support zones; unmatched events are explicitly reported if no zone existed at break time.
- Uses explicit retest policy values: touch tolerance, success/failure close buffers, retest window and confirmation window. No hidden defaults.
- Separates successful, failed, expired, unresolved and pending retests. Role reversal is confirmed only after a successful retest.
- Independently validates B2-C break semantics and B2-D zone evidence.
- 22/22 deterministic tests passed in GitHub Actions run [46016401705](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46016401705) on commit `493a15e8006784d2b78262770725c26bd05c2e85`, including full B1 → B2-A → B2-B → B2-C → B2-D → B2-E execution.
- PR #17 is draft/unmerged. Retest thresholds are synthetic explicit inputs, not calibrated market facts.


## Latest verified candidate heads — 2026-11-27 (supersedes earlier test-count snapshots)

The current open PR head commits have been checked against GitHub Actions:

| Increment | PR | Exact head commit | Tests | Passing run |
|---|---:|---|---:|---|
| B2-A | #12 | `bb13960e647d399b6b05ee12c21f5a2fdeb8265d` | 21/21 | [46014698432](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46014698432) |
| B2-B | #13 | `b209293212ac1bd910939eed465f140514b9e959` | 20/20 | [46015826502](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46015826502) |
| B2-C | #15 | `e9590ddb65c9f3a09a28279efdb064b6caa6a4a2` | 33/33 | [46015831238](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46015831238) |
| B2-D | #16 | `9012e514a29b755ac9208f1f495c3f560638b0a1` | 21/21 | [46015873986](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46015873986) |
| B2-E | #17 | `493a15e8006784d2b78262770725c26bd05c2e85` | 22/22 | [46016401705](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46016401705) |

All five are draft/unmerged research candidates. PR #8/#9 B1 candidates remain draft/unmerged. The main branch is still `8acb6fddaf454e9f2a4bdf3564ad70408d1a5456`; no B2 candidate has been merged or connected to the application HTML.


## Final integrated B2 verification snapshot — 2026-11-27

Current open candidate heads and their individual CI results:
- B2-A PR #12: 21/21, head `bb13960e647d399b6b05ee12c21f5a2fdeb8265d`, run [46014698432](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46014698432).
- B2-B PR #13: 20/20, head `127815d7b29a3c35316a319b7450cc95c52cb0b5`, run [46017296248](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46017296248).
- B2-C PR #15: 33/33, head `e9590ddb65c9f3a09a28279efdb064b6caa6a4a2`, run [46015831238](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46015831238).
- B2-D PR #16: 21/21, head `9012e514a29b755ac9208f1f495c3f560638b0a1`, run [46015873986](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46015873986).
- B2-E PR #17: 24/24, head `b7fccbc232c8a2de573cbfb053ef06b10b2cf834`, run [46017280509](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46017280509).

**Combined integrated verification:** [119/119 tests passed](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46017280701) on B2-E integrated head `b7fccbc232c8a2de573cbfb053ef06b10b2cf834`. The combined workflow runs all five test files in one checkout, in dependency order B2-A → B2-B → B2-C → B2-D → B2-E.

All PRs #8–#17 remain draft/unmerged. Main remains `8acb6fddaf454e9f2a4bdf3564ad70408d1a5456`. No B2 candidate is imported into application HTML or connected to LONG/SHORT. B1 remains NOT ACCEPTED. Deterministic CI does not replace independent review, live Bybit validation or owner acceptance.


## Current B2 research state — 2026-11-27 (latest exact heads)

| Module | PR | Current head | Tests | GitHub Actions |
|---|---:|---|---:|---|
| B2-A | #12 | `bb13960e647d399b6b05ee12c21f5a2fdeb8265d` | 21/21 | [46014698432](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46014698432) |
| B2-B | #13 | `127815d7b29a3c35316a319b7450cc95c52cb0b5` | 20/20 | [46017296248](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46017296248) |
| B2-C | #15 | `e9590ddb65c9f3a09a28279efdb064b6caa6a4a2` | 33/33 | [46015831238](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46015831238) |
| B2-D | #16 | `9012e514a29b755ac9208f1f495c3f560638b0a1` | 21/21 | [46015873986](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46015873986) |
| B2-E | #17 | `b7fccbc232c8a2de573cbfb053ef06b10b2cf834` | 24/24 | [46017280509](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46017280509) |

Integrated B2 research suite: **119/119** passed in [run 46017280701](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46017280701).

B2-E hardening: gap-through failure before any retest is now detected; a pivot break must also close strictly beyond the full historical zone boundary. Its role-reversal output is per breakout event, not a persistent zone-role state across future breakouts. Same-candle range-touch plus close beyond the success boundary is an explicit OHLC bar-level convention, not intrabar tick-path evidence.

PR #18 was closed as a duplicate/superseded design draft; PR #17 is the active B2-E candidate. PRs #12/#13/#15/#16/#17 remain draft/unmerged. B1 PRs #8/#9 remain draft/unmerged. Main remains `8acb6fddaf454e9f2a4bdf3564ad70408d1a5456`; no B2 candidate is imported into application HTML.
