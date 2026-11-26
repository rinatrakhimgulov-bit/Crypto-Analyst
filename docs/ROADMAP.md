# Crypto Analyst — Roadmap

**Дата утверждения:** 2026-11-26  
**Статус документа:** утверждённое направление развития; это план, а не отчёт о реализации.  
**Основная ветка:** `main`  
**Исходная версия:** `CryptoAnalyst_StageA_S6_updated.html`

## 1. Главная цель продукта

Crypto Analyst развивается как независимая от конкретной биржи аналитическая система для подготовки обоснованных торговых сценариев на криптовалютном рынке. Источники данных рассматриваются как заменяемые адаптеры; BTC и ETH остаются стартовыми инструментами, а не привязкой к одной площадке.

Система должна:
- получать и проверять рыночные данные;
- определять структуру и режим рынка;
- обнаруживать рыночные события и повторяющиеся ситуации;
- исследовать гипотезы на исторических данных;
- применять только проверенные модели в подходящих условиях;
- формировать объяснимые сценарии LONG / SHORT / WAIT;
- показывать условия активации, отмены и потенциальные цели;
- оценивать риск и параметры позиции;
- показывать неопределённость, ограничения и качество исходных данных.

**Главный приоритет — аналитическая способность приложения.** Встроенный калькулятор риска обязателен, но не является первым самостоятельным этапом и не должен вытеснять развитие аналитического ядра.

Приложение не исполняет сделки автоматически. Окончательное решение остаётся за пользователем.

## 2. Принципы и ограничения

1. Практическая ценность для анализа рынка важнее количества функций и визуальных эффектов.
2. Не выдавать предположение, индикатор или совпадение за статистически подтверждённое преимущество.
3. Не использовать будущие данные при историческом анализе (look-ahead bias).
4. Использовать закрытые свечи для подтверждённых решений; незакрытые данные явно маркировать.
5. Критически плохое или устаревшее качество данных должно блокировать directional-сценарии и приводить к WAIT с объяснением.
6. Разделять получение данных, аналитические движки, сценарии, риск-планирование и UI.
7. Сохранять работающий код; не переписывать приложение с нуля без доказанной причины.
8. Не мигрировать на React/TypeScript только ради моды или абстрактной чистоты.
9. Текущий прототип использует Bybit REST как основной источник, а WebSocket — для инфраструктуры/логирования. Целевая аналитическая архитектура должна быть независима от поставщика данных: источники подключаются через адаптеры к единому контракту.
10. Начальный охват — BTCUSDT и ETHUSDT, таймфреймы 1D / 4H / 1H. Расширение — после проверки базового конвейера.
11. Каждый этап завершается интеграцией, тестами, независимой проверкой и обновлением документации.
12. Ни один этап не считается выполненным только на основании отчёта ИИ-исполнителя.

## 3. Целевой аналитический конвейер

1. **Market Data** — получение исторических и текущих данных из источников.
2. **Data Quality & Normalization** — единый контракт, синхронизация, проверки целостности и свежести.
3. **Market Features** — индикаторы и измеряемые признаки.
4. **Market Structure** — swing high/low, HH/HL/LH/LL, BOS/CHoCH, зоны поддержки/сопротивления.
5. **Market Regime** — тренд, диапазон, импульс, переходное или неизвестное состояние.
6. **Pattern Analysis** — пробои, ложные пробои, ретесты, реакции от зон, свечи, объём и волатильность.
7. **Multi-Timeframe Analysis** — согласование 1D контекста, 4H структуры и 1H условий.
8. **Market Research & Validation** — исследование исторических событий и проверка гипотез.
9. **Validated Strategy Library** — только модели с воспроизводимыми результатами и описанными ограничениями.
10. **Trade Scenario Engine** — LONG / SHORT / WAIT, условия активации, отмена, цели, срок действия и объяснение.
11. **Trade Planning & Risk** — размер позиции, риск, маржа, плечо, SL/TP, издержки и ограничения биржи.
12. **Context & UI** — новости/макро-контекст, визуализация, журнал и мониторинг качества.

Компоненты являются целевой архитектурой. Их перечисление не означает, что они уже реализованы.

## 4. План работ B0–B10

### B0 — Аудит текущего аналитического конвейера
**Статус: ЗАВЕРШЁН (аудит исходника и изолированные runtime-проверки; реальный браузер/биржевой endpoint не тестировались).**

Цель: установить, что реально происходит в текущем коде от получения данных до отображения результата.

Проверить:
- путь данных Bybit REST/WS до адаптера, аналитики и UI;
- получение и синхронизацию 1D / 4H / 1H;
- закрытые и формирующиеся свечи;
- обработку пропусков, дубликатов, порядка времени, свежести и stale cache;
- математику EMA, ATR, локальных экстремумов, уровней и объёмных признаков;
- точные условия LONG / SHORT / WAIT;
- проверку quality status перед выдачей directional-решения;
- соответствие отображаемого результата фактическим расчётам.

Результат: матрица «реализовано / частично / отсутствует / не подтверждено», ссылки на функции и строки, список дефектов и технических рисков, спецификация B1. На этапе B0 исходный код не менять.

Критерий завершения: аудит покрывает полный путь данных и все используемые в UI аналитические выводы; спорные выводы имеют воспроизводимые доказательства.

### B1 — Надёжный аналитический набор данных
**Статус: В РЕАЛИЗАЦИИ (B1-A/B/C/D внесены в draft PR #6; ожидают независимой проверки и runtime-валидации).**

- Единый контракт dataset, независимый от конкретной биржи/поставщика данных (draft: `docs/specs/B1_DATA_CONTRACT_DRAFT.md`).
- Адаптеры источников с обязательными метаданными provenance, временем биржи/получения и правилами преобразования.
- Синхронизированное получение 1D / 4H / 1H.
- Разделение закрытых и формирующихся свечей.
- Проверка пропусков, дубликатов, сортировки, временных границ, аномалий и свежести.
- Явный quality status и причины проблем.
- Запрет LONG/SHORT при статусах качества, отличных от VALID; WAIT с machine-readable причинами (реализовано в draft PR #6).
- Тесты на фиксированных известных наборах и граничных случаях.
- Устранение D0-01: INVALID/DEGRADED/STALE/INSUFFICIENT quality не может пропустить LONG/SHORT (внесено в draft PR #6; требуется runtime-подтверждение).
- Устранение D0-02: stale cache не может отображать старый LONG/SHORT как актуальный сигнал (внесено в draft PR #6; требуется runtime-подтверждение).

Критерий завершения: аналитика получает согласованный и проверяемый набор данных, а дефекты качества невозможно незаметно превратить в торговый сигнал.

### B2 — Market Structure Engine
**Статус: НЕ НАЧАТ.**

Предварительные source-audit заметки (не означают начало B2): `docs/research/B2_PYVSMC_CANDIDATE_AUDIT_2026-11-26.md`, `docs/research/B2_MARKET_STRUCTURE_CANDIDATES_2026-11-26.md`.

- Подтверждённые swing high / swing low.
- HH / HL / LH / LL.
- Структурное направление.
- BOS / CHoCH с формальными правилами.
- Поддержка/сопротивление как зоны, а не только одиночные цены.
- Защита от look-ahead bias: swing подтверждается только после требуемых последующих свечей.

Критерий завершения: детерминированные правила, тесты на эталонных рядах, корректные временные метки подтверждения.

### B3 — Market Regime Engine
**Статус: НЕ НАЧАТ.**

- Классификация: uptrend, downtrend, range, impulse, transition, unknown.
- Измеряемые признаки: структура, волатильность, диапазон и динамика.
- Статус режима, confidence и объяснение факторов.
- Устойчивость классификации на разных инструментах и периодах.

Критерий завершения: режим определяется воспроизводимо, неизвестное/переходное состояние не маскируется уверенным прогнозом.

### B4 — Pattern Analysis
**Статус: НЕ НАЧАТ.**

- Пробой и ложный пробой.
- Ретесты уровней/зон.
- Реакция цены от зон.
- Свечные модели как контекст, а не самостоятельные сигналы.
- Взаимосвязь объёма и движения цены.
- ATR и волатильностные условия.

Критерий завершения: события имеют формальные определения, временные границы и тесты; паттерн сам по себе не считается доказательством прибыльности.

### B5 — Multi-Timeframe Analysis
**Статус: НЕ НАЧАТ.**

- 1D — глобальный контекст.
- 4H — рабочая структура.
- 1H — поиск условий сценария.
- Явное отображение согласованности и конфликтов таймфреймов.
- Не считать три таймфрейма независимыми подтверждениями, если они отражают один и тот же рыночный импульс.

Критерий завершения: единый MTF-вывод с объяснением вкладов каждого таймфрейма и тестами конфликтных состояний.

### B6 — Trade Scenario Engine
**Статус: НЕ НАЧАТ.**

- Итог LONG / SHORT / WAIT.
- Основания: режим, структура, паттерны, MTF и качество данных.
- Условия активации и предполагаемая область входа.
- Подтверждающие и противоречащие факторы.
- Условие отмены сценария.
- Потенциальные цели и срок действия.
- Объяснение WAIT, а не только отсутствие сигнала.

Критерий завершения: сценарий воспроизводим, объясним, ограничен по времени и не выдаётся при критических проблемах данных.

### B7 — Market Research & Strategy Validation
**Статус: НЕ НАЧАТ.**

- Исторический набор событий без утечки будущих данных.
- Формализация гипотез до тестирования.
- Сравнение похожих рыночных ситуаций.
- Walk-forward и out-of-sample проверка.
- Комиссии, проскальзывание и funding.
- Expectancy, win rate, payoff, drawdown и другие релевантные метрики.
- Анализ устойчивости, чувствительности и переобучения.

Критерий завершения: исследование воспроизводимо; отчёт показывает ограничения и не скрывает отрицательные результаты.

### B8 — Trade Planning & Risk Calculator
**Статус: ЗАПЛАНИРОВАН ПОСЛЕ АНАЛИТИЧЕСКОГО ЯДРА; НЕ ПЕРВЫЙ ПРИОРИТЕТ.**

- Баланс и режим маржи.
- Риск в процентах и USDT.
- Размер позиции из допустимого убытка и расстояния до стопа.
- Номинал, initial margin и плечо.
- SL/TP в цене, процентах и денежном выражении.
- Комиссии, проскальзывание и R:R.
- Оценка liquidation price и запаса до ликвидации.
- Актуальные Bybit instrument filters: tickSize, qtyStep, min/max qty, minNotionalValue.
- Явное разделение риска позиции, требуемой маржи и номинала.

Критерий завершения: расчёты проверены на эталонных примерах и граничных случаях, ограничения биржи учтены. Калькулятор не исполняет ордера.

### B9 — Новости и макро-контекст
**Статус: ОТЛОЖЕН ДО ПОЯВЛЕНИЯ УСТОЙЧИВОГО АНАЛИТИЧЕСКОГО ЯДРА.**

- Надёжные источники и временные метки.
- Свежесть и происхождение информации.
- Классификация событий и связанных активов.
- Разделение фактов и интерпретаций.
- Влияние на сценарий только при проверяемом основании.

Критерий завершения: контекст не подменяет ценовые данные и не создаёт неподтверждённые причинно-следственные выводы.

### B10 — Журнал, мониторинг и расширение
**Статус: ПОЗДНИЙ ЭТАП.**

- Журнал сценариев и последующих результатов.
- Мониторинг качества данных и аналитических компонентов.
- Отслеживание изменений эффективности моделей.
- BTC/ETH как стартовый набор.
- Новые криптоактивы только после устойчивой проверки базового конвейера.

Критерий завершения: история решений воспроизводима, качество отслеживается, расширение не ухудшает базовую надёжность.

## 5. Что не входит в текущий приоритет

- Автоматическое исполнение ордеров.
- Полная миграция на React/TypeScript без технического обоснования.
- Усложнение WebSocket без измеримой пользы.
- Коммерческий запуск и публичная инфраструктура.
- Акции и широкий список альткоинов до устойчивости ядра.
- Новостной модуль до базовой аналитики.
- UI-эффекты и функции, не улучшающие анализ.
- Переписывание приложения с нуля без доказанной необходимости.

## 6. Текущее подтверждённое состояние на 2026-11-26

### Реализовано в прототипе (с ограничениями)
- HTML-прототип Stage A.
- Bybit V5 Linear REST-адаптер для BTCUSDT/ETHUSDT и интервалов 1H/4H/1D.
- REST polling; WebSocket-инфраструктура работает отдельно от аналитического конвейера и используется как LOG-ONLY.
- Базовые EMA20, EMA50, ATR14, локальные SH/SL, простые S/R и volume ratio.
- Базовая логика LONG / SHORT / WAIT по выбранному таймфрейму, не полноценный MTF.
- S6: уточнена обработка неоднозначных pong/heartbeat timeout.

### Не считать полноценной реализацией
- Market Structure Engine, Market Regime Engine, полноценный Pattern Analysis.
- Полноценный MTF-конвейер.
- Market Research, исторический backtest и проверенная библиотека стратегий.
- Полноценный Trade Scenario Engine.
- Trade Planning & Risk Calculator.
- Новости/макро и order flow.

### Проверки и ограничения
- Для S6 сообщался результат 44/44 self-tests, но сохранённый полный лог прохождения именно на окончательной версии не подтверждён в текущей документации.
- MockWebSocket и симулированные данные не подтверждают реальную работу с Bybit.
- Реальный Bybit runtime, iPhone Safari lifecycle и поведение в фоне не подтверждены.
- Текущий код является прототипом сбора данных и базовой технической аналитики, а не готовой комплексной аналитической системой.

## 7. Правило управления статусами

Использовать только следующие статусы:
- **НЕ НАЧАТ** — реализация не выполнялась.
- **В РАБОТЕ** — есть активная реализация, но критерии приёмки не выполнены.
- **НА ПРОВЕРКЕ** — реализация завершена исполнителем, идёт независимая проверка.
- **ПРИНЯТ** — интегрировано в канонический исходник, тесты и независимая проверка пройдены, документация обновлена.
- **ЗАБЛОКИРОВАН** — есть конкретная внешняя/техническая зависимость, указанная в записи.

Статус повышается только по фактическим доказательствам. Проектирование, промпт, отчёт исполнителя или наличие UI не равны реализации.

После каждого принятого этапа обновлять:
1. этот Roadmap — статус, фактический результат и отклонения;
2. `PROJECT_STATE.md` — актуальное состояние;
3. `DEVELOPMENT_LOG.md` — выполненная работа и результаты тестов;
4. `CHANGE_INDEX.md` — затронутые функции и файлы;
5. `AI_HANDOVER.md` — только если изменились фундаментальные решения или правила передачи проекта.

## 8. Ближайшее действие

Начать с B0: провести полный аудит текущего аналитического конвейера без изменения исходника. На выходе получить проверяемую карту фактической реализации и точную спецификацию B1.

**Не переходить к реализации B1, пока B0 не завершён, не проверен и не принят.**


## Актуализация B1 — 2026-11-26 (draft PR #6)

B1-A/B/C/D реализованы в отдельной ветке `impl/b1-quality-contract-2026-11-26`, PR: https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/6.

- Provider-neutral canonical snapshot/candle contract v1.0.0.
- Provider-time provenance; local fallback не считается доверенным временем.
- Duplicate classification: identical vs conflicting.
- Expected closed-candle coverage for requested kline window.
- Deterministic OHLCV/time/order/gap/freshness/history/coverage validator.
- Future open timestamps beyond 2 seconds of provider time are rejected by the adapter.
- Mandatory quality gate перед BasicAnalyticsEngine: только VALID допускает расчёт направленного решения; прочие статусы дают WAIT.
- Stale-cache fallback преобразует старый LONG/SHORT в WAIT; старый график остаётся только справочным контекстом.
- Embedded B1 quality suite: 35/35 passed; оба script blocks syntax-parse PASS; отдельная проверка gate на degraded dataset вернула WAIT.

**Ограничения:** PR остаётся draft. Не выполнены live Bybit, реальный Chrome/iPhone Safari и полный StageASelfTest 44/44 в браузерном harness. MTF common cutoff и второй provider ещё не реализованы. B1 не завершён.


### B1 quality-hardening update — 2026-11-26

В candidate branch PR #6 исправлены три дефекта, подтверждённые независимым аудитом:
- Счётчики адаптера больше не приводятся к нулю через coercion. Все восемь обязательных счётчиков проверяются как неотрицательные safe integers; отсутствующее или malformed значение даёт CRITICAL.
- Validator повторно проверяет закрытость каждой canonical candle по provider time и finality buffer 500 ms.
- Coverage требует три целых поля, UTC alignment и согласованную арифметику start/end/count. Отсутствующее или противоречивое coverage даёт CRITICAL. Дополнительно проверяются равенство aggregate duplicates сумме identical/conflicting и согласованность analysis time с provider time.

Проверки candidate branch: B1 suite 54/54 PASS в isolated JavaScript execution; оба inline script blocks syntax-parse PASS; 4/4 direct integration probes подтвердили WAIT/INVALID при malformed counter, negative counter, unclosed candle и missing coverage. Реальный браузер, live Bybit и полный StageASelfTest 44/44 пока не выполнены. PR #6 остаётся draft, B1 остаётся IN PROGRESS.


Дополнительная runtime-проверка в isolated JS: синтетический набор прошёл полный путь `BybitAdapter.normalize()` → `DataQualityEngine.preflight()`: 60 закрытых свечей + 1 формирующаяся свеча, Quality VALID. Это проверка адаптерной логики на фикстуре, не live Bybit.


### B1 finality regression test update — 2026-11-26

Latest HTML blob: `6810d7366e834b35306c8cfbb58751f0189a1b46`. Added a dedicated regression test proving candle finality is checked against the earlier analysis-time cutoff as well as provider time. B1 suite now passes 54/54; both inline scripts parse. Browser/live exchange checks and independent Grok re-audit remain pending.


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

### Независимый аудит B1 candidate — 2026-11-26 (Grok)

- Проверен HTML blob `e92c44d1397a8499a5a5adac7c12294923e3f494`; head PR на момент аудита: `d67749b255957175efb4576dc55f60c057bb510f`.
- Независимый запуск `B1QualitySelfTest.runAll()`: **65/65 PASS**.
- Вердикт: **APPROVE**. Новых CRITICAL/HIGH дефектов не выявлено.
- LOW: F1-тесты не проверяют конкретный reason code; forming candle остаётся вне Quality Gate (поведение явно зафиксировано characterization-тестами); stale recovery проверен на уровне engine, не через UI.
- Эти замечания не блокируют unit/static approval. Браузерный `StageASelfTest` 44/44, реальный Chrome/iPhone Safari, live Bybit и UI stale-badge остаются невыполненными.
- PR #6 остаётся draft и не слит. B1 остаётся IN PROGRESS; этот аудит не подтверждает полный runtime и не закрывает B1-E common MTF cutoff или B1-F второй provider.

### B1-E source audit and implementation specification — 2026-11-26

- Audited the current candidate runtime: `loadAndAnalyze()` fetches and analyzes one selected timeframe; no coordinated 1D/4H/1H assembler exists.
- Found an important integration constraint: each adapter response is currently split into closed/forming using its own `serverTimeMs`; canonical `analysisAsOfMs` is copied from that value, and validator currently requires close agreement with provider time. A common cutoff therefore needs explicit contract/validator semantics, not just overwriting timestamps.
- Added `docs/specs/B1_E_MTF_COMMON_CUTOFF_SPEC.md` with common-cutoff selection, candle reclassification, coverage recalculation, aggregate quality, stale/concurrency policy and 23 deterministic acceptance tests.
- Status: specification only. No application code changed for B1-E. Provider-time spread policy remains pending live latency measurement. B1-E is NOT IMPLEMENTED.

### B1-E implementation candidate — 2026-11-26

- Added an isolated `MTFDataEngine` to the candidate HTML. It fetches 1D/4H/1H concurrently, retains provider/receive/request timing provenance, selects the minimum trusted provider time as the common cutoff, reclassifies candles using the 500 ms finality buffer, recalculates coverage, validates each TF and produces aggregate quality.
- Added request-generation coordination: newer requests supersede older ones; one fetch failure aborts sibling requests; stale/missing/invalid TFs block directional eligibility.
- Provider-time tolerance is an explicit required option. No production default is guessed; the runtime must remain disconnected from directional consumers until live provider timing is measured and a policy is approved.
- Verification in isolated V8 harness using extracted production code: B1-E 23/23 PASS; existing B1 quality suite 65/65 PASS; both inline scripts syntax-parse PASS.
- Harness supplied test doubles for AbortController/DOMException/timer APIs because the isolated runner has no browser globals. This is not browser verification.
- No UI or existing selected-timeframe chart flow is connected to MTF yet. No live Bybit request, Chrome/iPhone Safari runtime or full StageASelfTest browser run. B1-E remains IN PROGRESS; PR #6 remains draft.

B1-E audit refinement: a candle whose open time is later than the common cutoff is now excluded from the as-of snapshot and counted in `excludedAfterCutoffCount`; its mere presence no longer invalidates a coherent snapshot. This handles ordinary response-time differences across an interval boundary. B1-E remains 23/23 PASS and B1 remains 65/65 PASS after this correction.


### B1-E common-cutoff implementation correction — 2026-11-26 (latest candidate update)

The B1-E candidate in draft PR #6 now separates desired closed-candle history from Bybit raw-row request limit. Per-TF raw limit is calculated as desired closed count + `ceil(maxProviderTimeSpreadMs / stepMs) + 1`, reserving for interval-boundary rollover and a forming row. Bybit's 1000-row maximum is enforced. Expected coverage start/end/count are derived from the shared cutoff and explicit target count. Excess older eligible candles may be trimmed; missing history is reported and blocks directional permission.

Multiple forming candidates no longer publish an arbitrary forming candle. Missing target/timeframe, interval mismatch and missing normalized rows produce stable per-TF diagnostics. Integration fixtures run V5-shaped raw rows through the actual adapter normalizer and MTF assembler across 1H, 4H and 1D boundaries, plus short-response coverage failure.

Verification in isolated V8: B1-E 31/31 PASS; B1 Quality 65/65 PASS; both inline scripts parse. This is not live Bybit or browser verification. Production provider-time spread policy remains uncalibrated. MTFDataEngine is not wired into UI/decision logic. PR #6 remains draft/unmerged; main unchanged; B1 remains IN PROGRESS.
