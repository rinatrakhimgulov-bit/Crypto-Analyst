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
**Статус: НА ПРОВЕРКЕ (B1-A/B/C реализованы в candidate branch; latest Chromium CI passed; iPhone Safari check of the new B1-C UI and fresh live REST evidence remain outstanding; merge in main not performed).**

- Единый provider-neutral dataset contract; canonical mapping сохраняет provenance, provider time, volume/turnover, finality state и raw diagnostics.
- Bybit V5 adapter требует строгую семипольную kline row schema; conflicting duplicates quarantine; local clock fallback не сертифицирует закрытые свечи.
- B1-B deterministic quality validator проверяет provenance, timestamps, OHLCV, finality, freshness, history coverage, gaps, duplicates и raw ordering.
- B1-C подключает validator к активному `BasicAnalyticsEngine.analyze()`: только `VALID` разрешает расчёт directional-признаков; остальные статусы и отсутствие отчёта дают WAIT без EMA/ATR и S/R.
- Gate требует совпадения `validator_version` и `policy_version` с текущими реализациями; несовпадение трактуется как INVALID.
- Cached data после REST refresh failure повторно валидируется и принудительно становится STALE (кроме INVALID); прежний LONG/SHORT не сохраняется как актуальный.
- Последняя Chromium CI-проверка: Stage A 44/44, B1 contract 32/32, B1 validator 63/63; VALID synthetic pipeline создал 159 closed candles и EMA20/EMA50/ATR14; negative volume → INVALID/WAIT; expired transport age → STALE/WAIT; gate identity mismatch tests passed; cleanup restored; zero page errors.
- Live Bybit CI probe не пройден и не считается успешным: GitHub runner получает HTTP 403 от `api.bybit.com` и `api.bytick.com`. Пользователь проверил предыдущую сборку на iPhone, но ещё не проверял новый B1-C status row и WAIT при заблокированном качестве.
- Кандидат находится в `b1/contract-review`; `main` не менялся.

Критерий завершения: аналитика получает согласованный и проверяемый набор данных, а дефекты качества невозможно незаметно превратить в торговый сигнал. До приёмки нужны независимая проверка B1-C, повторный Safari-тест последней сборки и свежий воспроизводимый REST-захват из среды, доступной Bybit.


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

Завершить приёмку candidate-ветки B1-A/B/C: проверить latest B1-C UI на iPhone Safari (B1 status row и WAIT при заблокированном качестве), провести независимый review интеграции quality gate и получить свежую воспроизводимую проверку REST Bybit из среды, которую провайдер не блокирует. После явного принятия перенести проверенный candidate в `main` и обновить этот Roadmap. До этого B2 не начинать.

**Текущая проверка не равна merge/acceptance: `main` остаётся нетронутым.**


### C1 — Chart visualization completion
**Статус: НА ПРОВЕРКЕ (candidate branch; CI passed, iPhone Safari retest pending).**

- Preserve existing EMA20/EMA50 and SH/SL overlays.
- Add EMA200 with sufficient closed-candle warm-up history.
- Add a synchronized lower volume histogram with forming-candle distinction.
- Keep visualization separate from trade-decision logic until the market-structure and scenario engines are developed.
- Validate EMA alignment, volume rendering, zoom/pan, and mobile layout.

C1 is a chart-visualization task, not a claim that the market-structure engine is complete. B2 remains unstarted until B1 acceptance criteria are met.


### B1-C UI observability closure — 2026-11-27

**Статус: НА ПРОВЕРКЕ.** Quality panel now exposes validator status/version, reason codes, and explicit analysis blocked/WAIT state. Chromium DOM regression test and full CI passed (44/44 Stage A, 32/32 contract, 63/63 validator, zero page errors). GitHub runner live Bybit probe remains blocked with HTTP 403. The latest panel-detail change awaits a brief iPhone Safari visual check; independent B1 review and explicit acceptance remain prerequisites before B2 and merge.




## Architecture closure and B1 branch consolidation — 2026-11-27

The global architecture baseline is recorded in `docs/ARCHITECTURE_DECISIONS_V1_2026-11-27.md`. It closes decisions that can be made without speculative infrastructure: provider-neutral data/analytics boundary, Bybit REST as the initial source, WebSocket LOG-only, 1D/4H/1H analytical scope, closed-candle causality, JavaScript runtime continuity, browser-first delivery, no backend until justified, no auto-trading, and evidence-based scenario validation. Server vendor, database vendor, framework migration and second provider remain intentionally deferred.

**B1 remains НА ПРОВЕРКЕ / В РАБОТЕ, not accepted.** Two B1 candidate branches diverged. The current B1-A/B/C/C1 candidate is `b1/contract-review`; the older B1-A/B/E candidate is `impl/b1-quality-contract-2026-11-26`. The old B1-E module is coupled to a legacy DataQualityEngine and must be ported to the current B1DataContract/B1QualityValidator and B1-C gate. Do not merge the branches wholesale.

The exact older B1-E artifact received an external conditional review (33/33 MTF and 65/65 older quality tests), but live spread calibration and directional MTF approval were explicitly withheld. This review does not cover the latest B1-C/C1 artifact.

**Updated next sequence:**
1. Port common-cutoff MTF assembly to the current canonical contract on the integration branch.
2. Add and run deterministic integration tests against the current validator/policy identity and Stage A/browser suites.
3. Obtain an independent review of the exact consolidated artifact.
4. Capture real concurrent Bybit 1D/4H/1H responses and calibrate the spread policy; GitHub runner HTTP 403 is not a successful live test.
5. Check the latest quality-panel reason codes and blocked-WAIT state on iPhone Safari. User has already verified the C1 chart layout.
6. Obtain explicit owner acceptance before merging into main.
7. Only then begin B2 Market Structure implementation.

B2 remains **НЕ НАЧАТ**. Research notes and PR #7 are not an implementation. Main remains unchanged.




### B1-E — current-contract MTF common-cutoff implementation — 2026-11-27

**Статус: В РАБОТЕ (integration candidate; not accepted).**

Implemented isolated `B1MtfEngine` against current `B1DataContract` / `B1QualityValidator` rather than copying the legacy DataQualityEngine-dependent module. The engine coordinates 1D/4H/1H, selects minimum trusted provider time as common cutoff, applies 500 ms finality, excludes post-cutoff rows with explicit accounting, validates each TF, verifies exact closed-window coverage, and produces an immutable aggregate. Missing/invalid/stale/degraded TF, missing spread policy, or incomplete coverage blocks directional permission. Failed/superseded requests propagate cancellation at the adapter-signal level.

Canonical contract and validator versions are now 1.1.0. Latest CI run `45965680821`: Stage A 44/44, B1 contract 32/32, validator 64/64, MTF 12/12, UI/gate/chart checks passed, zero browser page errors. Live Bybit remains blocked by HTTP 403 from both hosts on GitHub Actions.

This is not yet B1 acceptance. Independent review of the exact port, live Bybit captures and measured provider-time spread policy, actual transport-level abort test, latest iPhone Safari quality-panel check, and explicit owner acceptance remain required. MTF is not connected to directional decisions. B2 remains **НЕ НАЧАТ** until B1 is accepted.

Specification: `docs/specs/B1E_MTF_CURRENT_CONTRACT_SPEC_2026-11-27.md`.




## Authoritative roadmap correction — 2026-11-27

This addendum supersedes older progress statements in this file that describe B1-E as not yet ported or the integration branch as only a documentation workspace.

The current integration branch `integration/b1-mtf-architecture-2026-11-27` contains B1-A/B/C, C1 and the current-contract B1-E MTF assembler. Candidate HTML blob: `3f1a739b90e3a187292b29cd9f0ca5c1beafbd5c`; branch is 48 commits ahead of `main`, 0 behind. `main` remains unchanged.

Latest completed browser CI run `45965680821`: Stage A 44/44, B1 contract 32/32, B1 validator 64/64, B1 MTF 12/12; quality gate/UI and C1 chart assertions passed, zero page errors. Live Bybit test was blocked by HTTP 403 from both public hosts on the GitHub runner.

**B1 status remains IN REVIEW / NOT ACCEPTED.** Outstanding: independent audit of the exact current candidate blob, live concurrent Bybit 1D/4H/1H capture and measured provider-time spread tolerance, actual transport-level cancellation verification, latest quality-panel Safari check, explicit owner approval. Do not merge to main until all gates pass.

**B2 Market Structure remains NOT STARTED** until B1 acceptance. The global architecture decisions are recorded in `docs/ARCHITECTURE_DECISIONS_V1_2026-11-27.md`; do not reopen decisions without new evidence or a concrete requirement.




### B1-E test-matrix refresh — 2026-11-27

The current-contract MTF regression suite now contains 16 cases. Additional coverage verifies that forming/pending-finality candles never enter the closed-only analysis slice, spread one millisecond above policy fails closed, multiple post-cutoff rows fail closed, and missing measured spread policy fails closed. Async tests cover sibling abort and superseded generations.

Latest CI run `45966127523`: Stage A 44/44, B1 contract 32/32, validator 64/64, MTF 16/16, gate/UI/chart checks passed, zero browser page errors. Live Bybit remains blocked by HTTP 403 from both public hosts. Exact current HTML blob: `4abb9936c96ae19ff231edd86088c1f1b62a2dd0`.

This strengthens candidate evidence but does not close B1 acceptance. Independent review, recorded live capture and measured spread policy, transport-level abort verification, iPhone Safari check of the latest quality panel, and owner acceptance remain prerequisites. B2 stays not started.




## Latest integration verification — 2026-11-27

Additional safety hardening on the integration branch:
- B1 reports are bound to a non-empty canonical `snapshot_id`; B1-C and B1-E reject mismatched report/snapshot identity.
- MTF requires an explicit closed-candle history count and rejects omission before network requests.
- Pending-finality candles remain explicit context and cannot enter the closed-only analysis slice.

Latest completed CI run `45966700299`: Stage A 44/44, B1 contract 32/32, B1 validator 65/65, MTF 18/18, gate/UI/chart assertions passed, zero browser page errors. Live Bybit remains blocked by runner HTTP 403 from both public hosts. Exact current HTML blob `1cb41cfbc03534441774eeeaac08f36082f19ab9`.

B1 remains in review, not accepted. Independent exact-blob review, live spread calibration, actual network abort verification, latest Safari quality-panel check and owner approval remain mandatory. No merge to main; B2 remains gated.



### Verification refresh — 2026-11-27

Latest integration candidate HTML blob: `1cb41cfbc03534441774eeeaac08f36082f19ab9` (299,978 bytes). Latest completed CI run `45966502044`: Stage A 44/44, contract 32/32, validator 64/64, MTF 18/18; gate/UI and chart assertions passed; zero browser page errors. Total: 158/158 named self-tests. MTF now explicitly rejects omitted closed-candle count before any network request and tests that pending-finality candles remain context-only. Branch is 66 commits ahead, 0 behind main. Live Bybit remains unverified because GitHub Actions receives HTTP 403 from both REST hosts. B1 acceptance gates remain open.



## Latest verification supersession — 2026-11-27

Run `45966700299` supersedes earlier totals: Stage A 44/44, B1 contract 32/32, B1 validator 65/65, B1 MTF 18/18; gate/UI/chart assertions passed, zero browser page errors; 159/159 named tests. The quality-gate suite rejects a VALID-looking report with a mismatched `snapshot_id`. Candidate HTML blob `1cb41cfbc03534441774eeeaac08f36082f19ab9`; branch is 85 ahead / 0 behind main. Live Bybit remains blocked by HTTP 403 from both REST hosts. B1 acceptance gates remain open.




## Latest B1 completion work — 2026-11-27

- B1-C binds the quality report to the canonical snapshot ID and verifies the exact legacy closed-candle series and last-closed price consumed by analytics match that canonical validated series. Mismatch blocks with INVALID/WAIT; empty matching series preserve INSUFFICIENT.
- B1-E suite: 20 tests, including explicit history count, pending-finality separation, 1000-row cap, external cancellation, sibling abort and supersession.
- Added read-only Bybit live capture utility `tools/b1_live_probe.html` schema v3 and iPhone Safari procedure. CI smoke-checks the page without making external requests.

Latest CI `45967551538`: Stage A 44/44, contract 32/32, validator 65/65, MTF 20/20, gate/UI/chart/probe smoke passed, zero browser page errors. Live Bybit remains blocked by runner HTTP 403 from both public hosts. Exact current HTML blob `2af63d1bbfec766606325450819d8ddff14173a2`.

B1 remains in review. Independent exact-artifact review, live 1D/4H/1H capture and measured spread policy, transport-level abort verification, latest Safari quality-panel check and owner approval remain mandatory. No merge to main; B2 remains gated.



## Latest candidate refresh — 2026-11-27

Current PR #8 head: `f6cc90e51096e30bd524a6e883f3ca0ad1273d79` (draft, not merged). HTML blob `2af63d1bbfec766606325450819d8ddff14173a2` (303,499 bytes); browser harness blob `a23585f9688b9a04336c7f99da7a972513882f8e` (29,130 bytes). Branch 101 ahead / 0 behind main. Latest CI run `45967551538`: Stage A 44/44, contract 32/32, validator 65/65, MTF 20/20; gate/UI/chart assertions passed, zero page errors; 161/161 tests. B1-C now verifies canonical/legacy candle series and last-closed price equivalence, and preserves INSUFFICIENT for an empty matching series. Live Bybit remains blocked by HTTP 403 from both hosts on GitHub Actions. B1 acceptance gates remain open.



## Browser transport verification — 2026-11-27

Latest CI `45968566553` passed 161/161 named tests (Stage A 44, contract 32, validator 65, MTF 20), gate/UI/C1/probe checks and zero browser page errors. Added a real Chromium fetch cancellation test through `BybitAdapter.fetchMarketSnapshot`: external abort cancelled both parallel requests and the timeout cancelled a delayed request; local server observed 3/3 client sockets closed. This validates browser-side cancellation wiring, not live Bybit connectivity. Fetch deadlines now surface as `TimeoutError`. Live Bybit still returns HTTP 403 to the GitHub runner. Exact current HTML blob `3d6a2fea8c4724d47a4d91bb73a53c6dedecd8cf`; harness blob `70399a984b44f5f85024afcdf11289e4a73a6361`. Branch 124 ahead / 0 behind main. B1 acceptance remains open.



## Final branch-position refresh — 2026-11-27

PR #8 head `5e94c29d1f5734e8b46200c04b6da51996ca9726`, draft/unmerged. Branch 131 ahead / 0 behind main. The code artifact remains HTML blob `3d6a2fea8c4724d47a4d91bb73a53c6dedecd8cf` and harness `70399a984b44f5f85024afcdf11289e4a73a6361`; no code changed after successful CI `45968566553`, only documentation/PR metadata. Main remains unchanged.


## B1-D live market-data integration — 2026-11-27

Automated implementation is complete in draft PR #9, stacked on the B1 integration candidate. The existing Bybit WS client now feeds validated lastPrice and selected-timeframe kline updates into the chart; REST remains bootstrap/history/reconciliation and 30-second fallback. Closed-candle analytics remain isolated from unconfirmed WS data. Latest CI 45981507604: 174/174 deterministic tests passed, browser handler/UI integration and desktop/mobile chart checks passed, zero page errors.

Still pending: real iPhone/Safari Bybit WebSocket verification and independent exact-blob review. GitHub Actions cannot reach Bybit REST (HTTP 403), so no live exchange result is claimed. PR #8 and #9 remain draft; main unchanged. B2 remains gated.

---
# Актуализация продуктового направления и ближайших этапов — 2026-11-27

Этот раздел является актуальным решением владельца проекта и имеет приоритет над более ранними последовательностями этапов выше, если они расходятся с ним. Это план, а не отчёт о реализации.

## Принцип развития
Строить Crypto Analyst как долгосрочную систему: сначала достоверный и воспроизводимый поток данных, затем наблюдаемое принятие решений, затем аналитика, которую можно проверять на сохранённых результатах. Не добавлять функции ради количества и не путать визуальную выразительность с доказанной полезностью.

Целевой контур:
**Рыночные данные → контроль качества → анализ и объяснение → решение пользователя → запись в журнал → фиксация исхода → оценка качества аналитики → улучшение алгоритмов.**

## Утверждённая последовательность следующих этапов

### B3 — Читаемый график
**Статус: интегрирован в main через PR #23.** Пользователь подтвердил, что визуальная часть стала значительно лучше. B3 — слой отображения; он сам по себе не доказывает качество аналитики или live-feed.

### B4 — Надёжный Live Data Path
**Следующий этап разработки.** До реализации провести аудит фактического состояния main и текущих Bybit REST/WS компонентов, не исходить только из старых описаний. Цель — единый согласованный поток рыночных данных:
- REST bootstrap/history и WebSocket live updates с чётким разделением ответственности;
- актуальная last traded price и обновление формирующейся свечи без ручного refresh;
- неизменяемость подтверждённых закрытых свечей;
- finality-aware reconciliation REST/WS и устранение дублей/пропусков;
- reconnect/resubscribe, heartbeat и fallback;
- quality/freshness gate сохраняет fail-closed поведение: сомнительные или устаревшие данные не дают directional-сценарий;
- измеримые логи/диагностика, чтобы отличать задержку провайдера, транспортную задержку и ошибку отображения.

Приёмка: реальные проверки на iPhone/Safari и доступной сети пользователя; сверка цены и движущейся свечи с Bybit; BTC/ETH и основные таймфреймы; переключение символов/ТФ, потеря и восстановление соединения, REST fallback. GitHub runner HTTP 403 не считать доказательством отказа Bybit и не выдавать синтетический тест за live-проверку.

### B5 — Market Journal (журнал наблюдений и решений)
**Утверждён как следующий продуктовый этап после B4; проектирование схемы можно вести параллельно с B4, но не мешать live-работам.** Первая версия — локальное хранение в браузере с явным экспортом/импортом JSON; без backend и без автоматического исполнения сделок.

Журнал должен фиксировать не только совершённые сделки, но и наблюдения, WAIT и пропущенные сценарии, чтобы избежать selection bias. Минимальная запись:
- уникальный ID, время снимка, инструмент, таймфрейм(ы), цена;
- источник данных, provider/event timestamps, quality status и reason codes;
- версия схемы, версии алгоритмов и состояние закрытой/формирующейся свечи;
- снимок доступной на тот момент структуры: подтверждённые pivots, BOS/CHoCH, зоны, retests и другие события с временными отметками доступности;
- решение пользователя: LONG / SHORT / WAIT / пропуск; комментарий;
- необязательный план: предполагаемый вход, invalidation/SL, TP и риск;
- последующее наблюдение/исход: цель, стоп, отмена, ручное закрытие или итог сценария; время и способ фиксации результата.

Обязательные правила:
1. Снимок хранит только информацию, доступную на момент записи; последующее развитие рынка не должно задним числом менять исходный snapshot.
2. Различать paper observation и фактическую сделку. Не выводить PnL, если нет реальных данных о сделке и издержках.
3. Сохранять отрицательные исходы, WAIT и пропуски наравне с успешными сценариями.
4. Показывать отсутствие результата как pending, а не считать его успехом или неудачей.
5. Предусмотреть экспорт/импорт, версионирование схемы и защиту от случайной потери локальных данных.
6. Не делать журнал условием совершения сделки и не превращать его в автотрейдер.

### B6 — Аналитическое ядро
Развивать и проверять рыночную структуру и измеримые признаки: swing highs/lows, HH/HL/LH/LL, BOS/CHoCH, S/R, пробои/ложные пробои, ретесты, реакции от зон, свечные признаки и объём. Сначала аудит уже интегрированных B2-A…B2-G и их ограничений; не переписывать существующее и не активировать неподтверждённые MTF-выводы без live provider-time calibration. Сохранять causal timing и не допускать look-ahead.

### B7 — Ограниченный набор объяснимых сценариев
Начать максимум с 2–3 воспроизводимых setup-классов, например: пробой + ретест; ложный пробой + возврат; продолжение тренда после коррекции. Для каждого определить условия формирования, подтверждения, отмены и WAIT. Никаких обещаний прибыльности.

### B8 — Валидация и обратная связь
Использовать Market Journal и независимые исторические периоды для оценки сигналов и сценариев. Метрики должны учитывать издержки, пропуски, просадки, expectancy, частоту ложных сигналов, sample size и неопределённость. Отделять in-sample, validation и out-of-sample; не подгонять параметры под небольшой набор наблюдений. Вперёд-смотрящая проверка обязательна до заявления об edge.

### B9 — Объяснимые решения и риск-контекст
Показывать LONG / SHORT / WAIT только при выполнении условий качества данных и правил setup. Всегда показывать причины, противоречащие факторы, условия активации/отмены и неопределённость. Риск-планирование дополняет анализ, но не заменяет его.

## Отложенные направления
- Дополнительные индикаторы и десятки стратегий — до появления доказанной потребности.
- Универсальная multi-exchange платформа и тяжёлый orderflow — не текущий приоритет.
- Автоторговля и one-click execution — вне текущей цели.
- Публичный релиз, backend и миграция на React/TypeScript — только при обоснованной практической необходимости.

## Архитектурный принцип
Продолжать развивать существующий репозиторий и текущую HTML-версию. Постепенно отделять data adapters, quality contracts, аналитические движки, журнал и UI через стабильные интерфейсы. Не допускать дальнейшего связывания аналитики с DOM. В перспективе это позволит заменить HTML UI на TypeScript/React или добавить сервер, сохранив и адаптировав проверенные алгоритмы, контракты и тесты. Полная переносимость не предполагается автоматически: UI и интеграционный код могут потребовать переписывания.

## Критерий полезного прогресса
Успех этапа измеряется не количеством экранов или линий на графике, а тем, что система получает достоверные данные, сохраняет контекст решения, позволяет воспроизвести его и объективно измерить результат.


## B4 implementation progress — 2026-11-28

B4 is active in draft PR #24: https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/24. Audit the actual current main, not historical handover text. Main already contains a working Bybit ticker+kline WebSocket integration alongside REST bootstrap, 30-second polling, reconciliation and reconnect/recovery. The first audit found that a WS-confirmed candle could still be mutated by ticker or a late same-timestamp kline delta before REST advanced `closedCount`; B4 now blocks those mutations and renders provider-confirmed candles as closed. Exact audit: `docs/audits/B4_MAIN_AUDIT_2026-11-28.md`. The first hardening increments now cover confirmed-candle immutability, replay of a newer WS kline after a REST refresh, and provider-time ordering across ticker/kline topics, with connection-generation checks. This is not B4 completion. Continue reconnect, fallback, stale-state, switching and lifecycle audit; require deterministic/browser CI on the exact final head, exact-source review and real iPhone/Safari acceptance. Runner HTTP 403 is not live-provider verification.


B4 checkpoint: PR #24 head 42f0511679167714e2a35c873ae0fc970502923c has B1 browser/live-data CI SUCCESS (46102775403) and B2 application/mobile integration CI SUCCESS (46102775296), with no browser page errors. Live Bybit REST probe remains unverified because GitHub runner receives HTTP 403. PR remains unmerged. Continue remaining reconnect, fallback, stale-state and lifecycle audit; independent review and actual iPhone/Safari acceptance remain required.


### B4 exact-head checkpoint — 2026-11-28

The current B4 application source blob `c9711ffdd65c9667bfa7447b92ec05d73e60135f` has passed B1 browser/live-data and B2 application integration CI (runs 46103008965 and 46103008967). Stage A 50/50, B1 contract 32/32, B1 quality 72/72, B1 MTF 20/20; B2-A…B2-G and browser/mobile integration passed; no browser page errors. Live Bybit was skipped because GitHub Actions received HTTP 403 from both REST hosts. Remaining B4 acceptance is real Bybit REST/WS behavior on iPhone/Safari, reconnect/fallback and instrument/timeframe/lifecycle switching. PR #24 remains unmerged.


### B4 additional verification — lifecycle

Added deterministic `pagehide`/`pageshow` regression `16d` to verify old socket invalidation and a fresh recovery/subscription generation after page restoration. Keep real iPhone/Safari background/foreground testing as a separate required acceptance gate; automated browser coverage is not a substitute.

### B4 additional data-quality gate — provider event time

Kline events without a valid provider event timestamp (`msg.ts`) are rejected before chart mutation. Keep this fail-closed contract covered by regression tests and verify that actual Bybit messages on iPhone/Safari supply the expected timestamp.

Ticker messages now follow the same provider event-time gate as kline messages: invalid/missing `msg.ts` is rejected before ticker state mutation. Keep both contracts covered by deterministic tests and verify actual provider payloads in Safari.

Valid ticker integration fixtures now carry provider event timestamps; the negative test deliberately omits `msg.ts` to preserve coverage of the fail-closed rule.

Stale-stream fallback now has a deterministic regression: stale WS ticker/kline data is rejected, REST price fallback is displayed, and stale WS status is explicit. Actual Safari behavior remains a separate acceptance gate.

Subscription-switch coverage now verifies that in-flight messages from the previous symbol/timeframe cannot mutate the active chart after a same-socket subscription update, while the new subscription becomes usable after ACK.

Live data freshness now requires both connection and recovery-cycle generation equality. This is specifically tested against automatic reconnects where the previous socket's connection generation may otherwise be retained. Keep this guard in B4 acceptance.

Recovery-generation regression explicitly distinguishes subscription ACK from ticker snapshot readiness; ACK alone does not make ticker data ready.

## B4 exact-head verification checkpoint — 2026-11-28

- PR #24 head: `94513b348a36ed3a91385d56ef52f4df4569326d`.
- Application HTML blob: `fffaa8c6c7448350c6db81bbdf6bee4d3a34504d`.
- B1 browser/live-data CI run `46105030207`: SUCCESS. Stage A 58/58, B1 contract 32/32, B1 quality 72/72, B1 MTF 20/20; browser page errors 0.
- B2 application integration CI run `46105030212`: SUCCESS. B2-A through B2-G and browser/mobile integration passed.
- Live Bybit probe: `SKIPPED_PROVIDER_BLOCKED`; GitHub Actions received HTTP 403 from `api.bybit.com` and `api.bytick.com`. Do not treat this as live-provider verification.
- PR #24 remains open and unmerged. Remaining acceptance: real Bybit REST/WS behavior on iPhone/Safari, including timestamp payloads, forming candle, confirmed candle finality, REST/WS reconciliation, reconnect and prior-recovery cache invalidation, stale REST fallback, BTC/ETH plus 1H/4H/1D switching, and background/foreground recovery. Independent review of exact source also remains required.

B4 second-pass hardening: invalid WS kline events now clear the previously accepted WS candle cache before REST reconciliation. Exact-head B1/B2 CI passed at commit fb3152f1a1d778f6f95f246fd1c77a0ef90fbf60. This does not replace real iPhone/Safari provider acceptance; Actions REST probe remains blocked by HTTP 403.


B4 continuity-failure hardening: invalid or structurally unapplyable WS kline events clear the previous WS kline cache before REST reconciliation; an explicitly older out-of-order event does not clear a newer cache. Exact-head B1/B2 passed at source commit 86bf04418a9f270755a86c6e400565f0b6398978. Real iPhone/Safari provider acceptance remains outstanding.

## B5 Market Journal — implementation in progress

B5 spec: `docs/specs/B5_MARKET_JOURNAL_SPEC_2026-11-28.md`. Implemented first vertical slice: immutable LONG/SHORT/WAIT observations, localStorage persistence, explicit versioned JSON export/import, append-only follow-ups, and separate completed actual trades. Dedicated browser tests cover immutable snapshots, quality-blocked WAIT, no-look-ahead candle window, record linkage, PnL arithmetic, import collision/idempotency, storage failure and corrupt-storage recovery. Keep B5 stacked on B4 candidate PR #24, not merged to main independently. Remaining gates: exact-head CI, independent source review, and iPhone Safari acceptance. Open-position tracking is deferred.

### B5 verification checkpoint — 2026-11-28

B5 PR #25 head `8f77ff6427e5c5d8021286d971c6a82bfc7f41b5` has passed its dedicated browser contract run `46106500180`, B1 run `46106500094`, and B2 run `46106500087`. Contract coverage includes immutable observation capture, LONG/SHORT/WAIT, quality-blocked WAIT, causal candle window, follow-ups, completed actual trades, JSON backup/restore, import conflicts, storage failure and corruption recovery. Remaining acceptance: iPhone Safari persistence/export/import and independent source review. B5 remains stacked on B4 PR #24 and must not merge to main first.

## B6 Analytics Core Audit — checkpoint

B2-A..G audit is PASS WITH CONDITIONS. Source/inline parity is enforced; historical replay is pinned and includes lookback sensitivity. 160 bars reproduced full-history structure state at the archive's final cutoff across BTC/ETH 1H/4H/1D. Keep the production window at 160 until zone freshness is defined. Do not connect B2-F to LONG/SHORT until real provider-time spread is calibrated. See `docs/audits/B6_ANALYTICS_CORE_AUDIT_2026-11-28.md`. Next: B7 define a small number of explainable setups on top of B2 evidence; B8 use B5 journal for statistical validation.