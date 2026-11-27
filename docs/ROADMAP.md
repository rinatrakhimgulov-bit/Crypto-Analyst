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
**Статус: В ИССЛЕДОВАНИИ (rinng/CCXT проверены; draft data contract подготовлен; реализация не начата).**

- Единый контракт dataset, независимый от конкретной биржи/поставщика данных (draft: `docs/specs/B1_DATA_CONTRACT_DRAFT.md`).
- Адаптеры источников с обязательными метаданными provenance, временем биржи/получения и правилами преобразования.
- Синхронизированное получение 1D / 4H / 1H.
- Разделение закрытых и формирующихся свечей.
- Проверка пропусков, дубликатов, сортировки, временных границ, аномалий и свежести.
- Явный quality status и причины проблем.
- Запрет LONG/SHORT при критических дефектах данных; WAIT с понятной причиной.
- Тесты на фиксированных известных наборах и граничных случаях.
- Устранение D0-01: INVALID quality не может пропустить LONG/SHORT.
- Устранение D0-02: stale cache не может отображать старый LONG/SHORT как актуальный сигнал.

Критерий завершения: аналитика получает согласованный и проверяемый набор данных, а дефекты качества невозможно незаметно превратить в торговый сигнал.

### B2 — Market Structure Engine
**Статус: ИЗОЛИРОВАННАЯ ИССЛЕДОВАТЕЛЬСКАЯ РЕАЛИЗАЦИЯ B2-A/B; production integration заблокирована до принятия B1.**

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


## 9. Current priority update — 2026-11-27 (supersedes earlier stage ordering)

**Active priority: Stage 2 / B2 Market Structure research.** Stage 1 visual/live-chart refinement is temporarily frozen, not cancelled. Data-quality/finality requirements remain mandatory.

- B1 is NOT ACCEPTED; its draft candidates remain unmerged.
- B2-A isolated raw pivots: 20/20 deterministic tests passed; PR #12 draft.
- B2-B isolated alternating sequence: 20/20 deterministic tests passed, including actual B2-A integration; PR #13 draft.
- B2-C isolated BOS/CHoCH state machine: 28/28 deterministic tests passed, including full B1 → B2-A → B2-B → B2-C fixture; PR #15 draft.
- None of these candidates is imported into the application HTML or connected to LONG/SHORT.
- No production integration until B1 acceptance and explicit owner approval.
- Next work: independent exact-source review of B2-A/B/C. After review, proceed to B2-D support/resistance zones as a separate increment.


### B2-D — Support/resistance zones
**Статус: ИЗОЛИРОВАННЫЙ ИССЛЕДОВАТЕЛЬСКИЙ КАНДИДАТ; production integration заблокирована до принятия B1.**

- Separate pure zone engine from confirmed B2-C raw pivot evidence.
- Support and resistance remain separate roles.
- Explicit absolute max-span policy scoped to instrument/timeframe; no implicit tolerance.
- 20/20 deterministic tests passed in run 46014759139, including full B1 → B2-A → B2-B → B2-C → B2-D fixture.
- PR #16 draft/unmerged. Absolute tolerance calibration against live market data remains outstanding.


## 10. Stage 2 progress update — 2026-11-27

Current isolated research candidates:
- B2-A causal swing pivots: 21/21 tests, run 46014698432.
- B2-B alternating sequence: 20/20 tests, run 46015818149.
- B2-C structure/BOS/CHoCH: 33/33 tests, run 46015831238.
- B2-D support/resistance zones: 21/21 tests, run 46015873986.

Internal review fixes: B2-A candle-gap admission; B2-C HH/LL-only BOS continuation; protected-pivot re-arming for opposite CHoCH; exact B2-A-to-B2-B pivot-set binding. B2-D exposes freshness as unclassified and zone IDs as membership-derived; absolute tolerance requires per-instrument/timeframe calibration.

All candidates are isolated, draft and unmerged. B1 remains NOT ACCEPTED. Next: finish B2-D design review, then specify B2-E breakout/retest/failure lifecycle with stable level lineage before implementation. No production integration until B1 acceptance and explicit owner approval.


### B2-E — Breakout/retest/failure lifecycle
**Статус: ИЗОЛИРОВАННЫЙ ИССЛЕДОВАТЕЛЬСКИЙ КАНДИДАТ; production integration заблокирована до принятия B1.**

- Historical zones are reconstructed from only pivots available strictly before breakout close.
- Retest states: successful, failed, expired, unresolved and pending.
- Role reversal is confirmed only after a successful retest.
- Explicit policy thresholds; no implicit defaults.
- 22/22 deterministic tests passed in run 46016401705, including full B1 → B2-A → B2-B → B2-C → B2-D → B2-E execution.
- PR #17 draft/unmerged. Threshold calibration and independent review remain outstanding.


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
