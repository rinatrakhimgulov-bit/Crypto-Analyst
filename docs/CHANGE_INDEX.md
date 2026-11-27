
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


## Stage 2 / B2 Market Structure candidates — 2026-11-27
- `docs/specs/B2_MARKET_STRUCTURE_ENGINE_SPEC_2026-11-27.md`: frozen causal B2 policy and B2-A/B isolated candidate status.
- `docs/audits/B2_SPEC_DESIGN_REVIEW_2026-11-27.md`: internal design review and resolution of seven implementation ambiguities.
- `src/analysis/b2-causal-swing-engine.js`: B2-A raw causal swing pivots; exact B1 identity/finality admission.
- `tests/b2a-causal-swing-engine.test.cjs`: 20 deterministic tests; run `46010999225` passed.
- `src/analysis/b2b-swing-sequence-engine.js`: B2-B alternating sequence and HH/LH/EQH/HL/LL/EQL labels; exact upstream identity binding.
- `tests/b2b-swing-sequence-engine.test.cjs`: 19 deterministic tests; run `46011622297` passed.
- PR #12 and #13 remain draft/unmerged, research-only. B1 remains NOT ACCEPTED; no application or `main` integration.


### B2-A → B2-B contract integration verification — 2026-11-27
- B2-B suite: 20/20 deterministic cases, including actual B2-A engine output passed into B2-B.
- GitHub Actions run `46012201698` passed on code commit `9c102e8f3984daccf0d7d94bcb8807c549e0dcf1`.
- This confirms deterministic module contract only; no live Bybit or app integration.


### B2-C causal BOS/CHoCH state machine — 2026-11-27
- `src/analysis/b2c-swing-structure-engine.js`: isolated UNESTABLISHED/UP/DOWN state machine; initial breaks, BOS, protected-swing CHoCH, wick sweeps, gap-through, strict zero-buffer close and one-time level consumption.
- B1/B2 identity binding, candle and pivot source provenance, continuity/finality checks, independent reconstruction of B2-B sequence from raw pivots, append-only immutable output.
- `tests/b2c-swing-structure-engine.test.cjs`: 28 deterministic tests including end-to-end B1 → B2-A → B2-B → B2-C flow.
- GitHub Actions run `46013846058` passed 28/28 on commit `a58441aa4f39aa6e3b98650624f07a2041e7152a`.
- PR #15 is draft/unmerged. Research-only; no main/app integration. B1 acceptance remains mandatory.

- `docs/audits/B2C_IMPLEMENTATION_REVIEW_2026-11-27.md`: internal exact-source review notes for B2-C candidate commit `a58441aa4f39aa6e3b98650624f07a2041e7152a`; explicitly not an independent external audit.


### B2-D support/resistance zones — 2026-11-27
- `src/analysis/b2d-support-resistance-engine.js`: isolated support/resistance clustering from confirmed raw swing pivots.
- Explicit instrument/timeframe-scoped absolute max-span policy; MAX_TOTAL_SPAN_V1; independent source-candle touch counting; candidate levels for insufficient touches.
- `tests/b2d-support-resistance-engine.test.cjs`: 20 deterministic tests including full B1 → B2-A → B2-B → B2-C → B2-D execution.
- GitHub Actions run `46014759139` passed 20/20 on commit `0574858db12dd2082d7449f5512fa8461fceac63`.
- PR #16 remains draft/unmerged. No app/main integration; B1 acceptance remains mandatory.

- `docs/audits/B2D_IMPLEMENTATION_REVIEW_2026-11-27.md`: internal exact-source review notes for B2-D candidate commit `0574858db12dd2082d7449f5512fa8461fceac63`; explicitly not an independent external audit.


### Stage 2 hardening and B2-D update — 2026-11-27
- B2-A: candle-gap rejection added; 21/21 passed (run 46014698432).
- B2-B: current branch includes B2-A gap fix; 20/20 passed (run 46015818149).
- B2-C: HH/LL-only continuation, protected-pivot re-arming on state transition, exact B2-A pivot-set binding; 33/33 passed (run 46015831238).
- B2-D: isolated S/R zone engine; 21/21 passed (run 46015873986). Absolute tolerance needs per-instrument/timeframe calibration; freshness unclassified; IDs membership-derived.
- All remain research-only, draft and unmerged; B1 remains NOT ACCEPTED.
