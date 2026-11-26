
# Crypto Analyst — Project State

**Дата актуализации:** 2026-11-26  
**Основная ветка:** `main`  
**Основной исходный файл:** `CryptoAnalyst_StageA_S6_updated.html`  
**Текущий этап:** B1 implementation in draft PR #6. B0 audit завершён; B1-A/B/C/D внесены в отдельную ветку. `main` не изменён.

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

B1: изучены `rinng` и `CCXT`; draft provider-neutral contract и mapping подготовлены. B1-A/B/C/D теперь реализованы в draft PR #6; MTF common cutoff и второй provider остаются незавершёнными. Исследовательский отчёт: `docs/research/B1_DATA_LAYER_CANDIDATES_2026-11-26.md`.

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


## Актуальное состояние B1 — 2026-11-26, draft PR #6

Ветка: `impl/b1-quality-contract-2026-11-26`  
PR: https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/6  
Статус: draft, не влито в `main`.

В канонический HTML в ветке добавлены:
- `DataQualityEngine`: canonical contract v1.0.0, snapshot mapping и QualityReport;
- явная provenance provider time vs local fallback;
- подсчёт identical/conflicting duplicate candles без молчаливого перезаписывания конфликта;
- expected coverage для закрытого диапазона свечей;
- validation OHLCV, finite values, volume, UTC alignment, order, gaps, future timestamps, snapshot freshness и minimum history;
- 2-секундный допуск для future open timestamps;
- обязательный preflight quality gate перед `BasicAnalyticsEngine`: directional output разрешён только при VALID;
- stale-cache suppression: cached LONG/SHORT преобразуется в WAIT после ошибки обновления;
- отображение B1 Quality Gate в панели качества.

Тестирование:
- `window.B1QualitySelfTest.runAll()`: 35/35 PASS в изолированном JavaScript execution;
- оба script blocks прошли syntax parse;
- отдельная изолированная проверка интеграции показала WAIT при DEGRADED quality.

Не выполнены: live Bybit, Chrome/iPhone Safari runtime, полный StageASelfTest 44/44 в browser harness. MTF common cutoff (B1-E) и второй provider (B1-F) ещё не реализованы. Поэтому B1 остаётся IN PROGRESS, не DONE.


## Актуальное состояние B1 — 2026-11-26, draft PR #6

Ветка: `impl/b1-quality-contract-2026-11-26`  
PR: https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/6  
Статус: draft, не влито в `main`.

В канонический HTML в ветке добавлены:
- `DataQualityEngine`: canonical contract v1.0.0, snapshot mapping и QualityReport;
- явная provenance provider time vs local fallback;
- подсчёт identical/conflicting duplicate candles без молчаливого перезаписывания конфликта;
- expected coverage для закрытого диапазона свечей;
- validation OHLCV, finite values, volume, UTC alignment, order, gaps, future timestamps, snapshot freshness и minimum history;
- 2-секундный допуск для future open timestamps;
- обязательный preflight quality gate перед `BasicAnalyticsEngine`: directional output разрешён только при VALID;
- stale-cache suppression: cached LONG/SHORT преобразуется в WAIT после ошибки обновления;
- отображение B1 Quality Gate в панели качества.

Тестирование:
- `window.B1QualitySelfTest.runAll()`: 35/35 PASS в изолированном JavaScript execution;
- оба script blocks прошли syntax parse;
- отдельная изолированная проверка интеграции показала WAIT при DEGRADED quality.

Не выполнены: live Bybit, Chrome/iPhone Safari runtime, полный StageASelfTest 44/44 в browser harness. MTF common cutoff (B1-E) и второй provider (B1-F) ещё не реализованы. Поэтому B1 остаётся IN PROGRESS, не DONE.


## B1 quality-hardening status — 2026-11-26 (latest candidate branch state)

PR #6 / branch `impl/b1-quality-contract-2026-11-26` обновлены после замечаний независимого Grok-аудита:
- `createSnapshot()` сохраняет исходные значения adapter counters; отсутствующие значения остаются null, строки/NaN/отрицательные значения не маскируются.
- `validate()` требует все восемь обязательных счётчиков как неотрицательные safe integers.
- Добавлена повторная проверка candle close time против provider time с finality buffer 500 ms.
- Coverage теперь требует expected start/end/count, integer + UTC alignment + математическую согласованность диапазона.
- Новые regression tests расширили B1 suite с 35 до 46.

Последняя проверка: 46/46 B1 tests PASS в isolated JS execution; два inline script blocks syntax-parse PASS; четыре direct integration probes вернули WAIT / INVALID при каждом из четырёх дефектных наборов. Не проверены live Bybit, Chrome/iPhone Safari runtime и полный StageASelfTest 44/44 в реальном браузере. Независимый повторный аудит после исправлений ожидается. PR draft, main не изменён, B1 не завершён.


## B1 latest verification — 2026-11-26

Latest candidate HTML blob: `4c6b1e02f16edb879913ded39c0312dc068cef82`.
- Strict adapter counters: all eight required values must be non-negative safe integers; malformed/missing values block.
- Aggregate `duplicates` must equal `identicalDuplicates + conflictingDuplicates`.
- `analysisAsOfMs` must agree with provider time within the allowed skew; candle finality uses the earlier cutoff and 500 ms buffer.
- Coverage requires complete integer/aligned start, end and count with consistent arithmetic.
- B1 suite: 50/50 PASS; both inline scripts parse; 4/4 direct gate probes return WAIT/INVALID for the four malformed cases.

No live Bybit, browser/iPhone Safari or full StageASelfTest 44/44 run. Grok re-audit pending. PR #6 remains draft; main unchanged; B1 not complete.
