
# Crypto Analyst — Development Log

Журнал истории разработки проекта. Здесь фиксируются завершённые технические этапы, изменения исходного кода, результаты тестирования и ограничения.

**Дата создания документа:** 2026-11-26

---

## 1. Правила ведения журнала

Каждая запись должна содержать:

- Дату выполнения.
- Название этапа.
- Цель задачи.
- ИИ-исполнителя.
- Исходную версию.
- Итоговую версию.
- Git commit SHA.
- SHA-256 исходного файла, если вычислен.
- Изменённые файлы.
- Изменённые, добавленные или удалённые функции, классы и объекты.
- Результаты тестирования.
- Обнаруженные проблемы.
- Непроверенные ограничения.
- Итоговое решение о приёмке.

Запрещено:
- Записывать неподтверждённые результаты тестирования.
- Считать наличие тестов доказательством их успешного прохождения.
- Записывать спроектированные функции как реализованные.
- Удалять сведения о предыдущих версиях и существенных изменениях.
- Подменять фактические результаты заявлениями исполнителя без проверки.

---

## 2. Stage A — создание базового прототипа

**Исполнитель:** Claude.

**Цель:** создание первой рабочей версии Crypto Analyst.

### Результат

Подготовлен базовый HTML-прототип приложения.

В отчёте исполнителя указывались:
- 3844 строки кода.
- 29/29 пройденных браузерных тестов.
- Проверки на симулированных WebSocket и REST.

### Ограничения

Тестирование проводилось на симулированных данных и соединениях.

Реальная работа с Bybit и полноценный жизненный цикл iPhone Safari в рамках этих проверок не подтверждены.

Пользователь открыл HTML-прототип и подтвердил его работоспособность.

---

## 3. Stage S6 — исправление обработки WebSocket heartbeat

**Дата фиксации:** 2026-11-26.

**Исполнитель:** Grok.

**Цель:** исправить обработку pong без req_id, неоднозначных ответов и timeout, которые нельзя однозначно приписать конкретному ping.

### Исходная версия

Файл: `CryptoAnalyst_StageA_S6_updated.html`

SHA-256 исходника до изменений:

`5d031732b0d4ed208e16b28667f7aeed56f3bce08021437df0accf7b63d9dbee`

Размер: 202178 bytes.

### Основные изменения

1. Уточнена логика `_handlePong()`.
2. Устранено подтверждение ping только по отсутствию других кандидатов.
3. Pong без req_id классифицируется как ambiguous при активном ожидании.
4. Pong без req_id классифицируется как late, если активного ожидания нет.
5. Добавлено обновление `lastNoEchoPongAt`.
6. Добавлен счётчик `unattributedTimeouts`.
7. Уточнена обработка timeout в `_onPongTimeout()`.
8. Уточнена очистка записей через `_pruneTimedOutPings()`.
9. Поздний pong без req_id больше не удаляет запись из `timedOutPings`.
10. Удаление записи допускается при точном совпадении req_id или штатной очистке по сроку хранения.

### Проверки, заявленные исполнителем

- Проверка неоднозначного pong.
- Проверка позднего pong.
- Проверка unattributed timeout.
- Проверка сохранения статистики настоящих пропусков.
- Проверка ACK и reconnect.
- Проверка очистки timedOutPings.
- Проверка восстановления после тестирования.

Исполнитель сообщал о браузерном результате 44/44.

### Финальная сверка

Итоговый файл:

`CryptoAnalyst_StageA_S6_updated.html`

SHA-256:

`8783eae2466b2452adda2c23f167a5a6a352f17a42a9605318feac5499519d17`

Git Blob SHA:

`02cbfb60d1a562e7b73e2734d1ab49b4cf91e2bf`

Размер: 205755 bytes.

При независимой сверке SHA-256 итогового файла совпал с заявленным.

### Статус тестирования

В коде присутствуют 44 теста `StageASelfTest`.

Однако сохранённый полный лог, подтверждающий прохождение 44/44 именно на окончательной версии файла, отсутствует.

Поэтому официальный статус:

**44 теста присутствуют. Успешный прогон 44/44 на финальной сборке документально не подтверждён.**

Реальный Bybit WebSocket и iPhone Safari lifecycle не проверялись.

### Итог

S6 принят по независимой проверке логики и сверке идентичности итогового файла.

Приёмка не означает подтверждение работы всех сценариев в реальной среде.

---

## 4. Следующий этап — архитектурный аудит

**Статус:** запланирован, не начат.

Предполагаемый исполнитель: DeepSeek.

### Цель

Получить полную карту текущей архитектуры и подготовить безопасный план дальнейшего развития.

### Требования

- Инвентаризация всех функций, классов и объектов.
- Анализ зависимостей.
- Выявление дублирования и технического долга.
- Разделение фактически работающего функционала и элементов интерфейса.
- Предложение модульной архитектуры.
- План безопасной миграции.
- Оценка рисков и трудозатрат.

### Ограничения

На этапе аудита запрещено изменять исходник.

Сначала необходимо получить ответ на предварительный вопросительный промпт и оценить возможности исполнителя.

---

## 5. Последующие этапы

Пока не выполнены. Здесь будут появляться записи по мере фактического завершения работ.

Предполагаемые направления:

- Архитектурный аудит.
- Модульная архитектура.
- Унификация рыночных данных.
- Market Feature Engine.
- Market Regime Engine.
- Pattern Analysis.
- Market Research Engine.
- Validated Strategy Library.
- Trade Decision Engine.
- Trade Planning & Risk.
- Backtesting.
- News and Macro Context.

Наличие этих пунктов в журнале не означает, что соответствующие компоненты уже реализованы.

---

## 6. Обновление журнала

После каждого принятого технического этапа ChatGPT добавляет новую запись с проверенными сведениями.

Существующие записи не переписываются задним числом без явного исправления ошибки.

История должна оставаться последовательной и проверяемой.


---

## 4. Утверждение аналитически-ориентированного Roadmap

**Дата:** 2026-11-26  
**Тип изменения:** проектное решение и документация; исходный код приложения не изменялся.

### Решение

Утверждён единый план развития B0–B10 в файле `docs/ROADMAP.md`.

Главный приоритет — аналитическое ядро Crypto Analyst. Встроенный калькулятор риска обязателен, но переносится на этап B8 после основных аналитических этапов. Цель — сначала обеспечить качественные данные, анализ структуры и режимов рынка, паттерны, мультитаймфреймовый анализ, исследование исторических гипотез и формирование объяснимых торговых сценариев.

### Ближайшая задача

B0 — полный аудит существующего конвейера от рыночных данных до UI без изменения исходного кода. B0 должен определить фактическое состояние функций, дефекты, пробелы и точную спецификацию B1.

### Изменённые файлы

- Добавлен `docs/ROADMAP.md`.
- Обновлён `docs/PROJECT_STATE.md`.
- Обновлён `docs/DEVELOPMENT_LOG.md`.
- Обновлён `docs/CHANGE_INDEX.md`.
- Обновлён `docs/AI_HANDOVER.md`.

### Проверки и ограничения

- Это изменение документации и фиксация приоритетов.
- Исходный HTML не изменялся.
- Аналитические функции B0–B10 не реализованы этим коммитом.
- Тесты приложения не запускались, поскольку код приложения не менялся.
- Статусы Roadmap выставлены по имеющимся подтверждённым сведениям; B0 остаётся НЕ НАЧАТ.

**Итог:** документационный этап принят после проверки наличия файлов и коммита в отдельной ветке. Это не является технической приёмкой новых функций приложения.


## 7. B0 — предварительный аудит и изолированные вычислительные проверки

**Дата:** 2026-11-26. Исполнитель: ChatGPT (куратор/аудитор). Тип работы: аудит и документация; основной HTML не изменялся.

### Результаты
- Прослежен путь REST → нормализация → dataset → BasicAnalyticsEngine → UI.
- Зафиксированы отсутствие quality gate, stale-cache directional risk, отсутствие MTF, неполная структура рынка и необходимость causal timestamp для swing.
- Оба inline JavaScript script blocks канонического файла проходят синтаксический парсинг (2/2).
- Извлечённые из канонического исходника EMA и ATR исполнены на фиксированных синтетических данных и совпали с независимыми расчётами (максимальная абсолютная ошибка 0 для каждого тестового ряда).
- Прямой вызов BasicAnalyticsEngine с quality.status=INVALID, gaps=5, duplicates=2, invalidRows=3 вернул LONG. Отсутствие quality gate подтверждено исполнением функции.
- Полный браузерный StageASelfTest, UI и live REST пока не запускались.

### Документы
- `docs/audits/B0_AUDIT_2026-11-26.md`
- `docs/ROADMAP.md` (B0 — В РАБОТЕ)

### Статус
**B0 не завершён.** Изолированные проверки не заменяют полный браузерный runtime. Дефекты не исправлялись; основной HTML не менялся.

## 8. B2 — предварительный аудит внешнего кандидата pyvsmc

**Дата:** 2026-11-26. Тип работы: исследование внешнего кода; интеграции нет.

Проверены README, MIT LICENSE, `src/pyvsmc/swings.py`, `src/pyvsmc/structure.py`, тесты swing/structure и `pyproject.toml` проекта `Khaymat/pyvsmc`.

Обнаружен потенциальный look-ahead в связке swing → structure: fractal swing требует N правых свечей, но структура начинает использовать уровень со следующего бара, а не с фактического момента подтверждения. Дополнительно зафиксированы default tie='all' и bullish приоритет при одновременных пробоях в нейтральном состоянии. Заявленные автором 92 теста нами не запускались.

**Решение:** кандидат полезен для исследования B2/B4, но прямая интеграция HOLD до причинной коррекции и независимых тестов.

Подробности: `docs/research/B2_PYVSMC_CANDIDATE_AUDIT_2026-11-26.md`.


## 9. B0 — аудит завершён; B1 открыт

**Дата:** 2026-11-26. Тип: аудит, без изменения исходного HTML.

### Итоговые проверки
- `StageASelfTest.runAll()` на точном исходнике выполнен в изолированном DOM/runtime harness: 44/44, setupError отсутствует, cleanupErrors пуст.
- `renderSuccess()` сопоставлен с фактическими полями `analysis` и `dataset`; отображаются decision, reasons, EMA, ATR, volume, уровни и quality metadata.
- `renderError()` при наличии cached snapshot повторно вызывает `renderSuccess(cached.dataset, cached.analysis)`, то есть сохраняет старый LONG/SHORT при сетевой ошибке. D0-02 подтверждён статической трассировкой.
- D0-01 подтверждён исполняемым reproducer: `quality.status=INVALID` при gaps/duplicates/invalidRows не блокирует LONG.
- Изолированные проверки EMA и ATR совпали с независимыми формулами на выбранных synthetic fixtures.

### Ограничения
Это не запуск в настоящем Chrome/Safari и не проверка живого REST endpoint. Основной HTML не менялся. B0 принят как аудит текущего конвейера; открытые дефекты переданы в требования B1.

### Решение
B0 — DONE (audit only). B1 — READY TO START. Внешние библиотеки не интегрированы.


## 10. B1 — исследование кандидатов для Data Layer

**Дата:** 2026-11-26. Тип: исследование исходного кода; интеграции нет.

### rinng

Проверены Exchange Protocol, Binance/OKX adapters, canonical schemas, resampling, validation, pipeline runner и тесты adapters/store. Полезные идеи: provider protocol, UTC milliseconds, явные [start,end) интервалы, canonical OHLCV schema, exchange-specific pagination/timezone/error handling, backfill, polling overlap, raw/curated storage и mock tests.

Обнаружены проблемы: `CandleReport.ok` не учитывает missing bars; `resample_ohlcv()` может отметить агрегат закрытым без проверки полноты внутренних 1m свечей; `pipeline.run.analyze()` не вызывает обязательную quality validation; отдельные тесты на `validate.py` и `resample.py` в дереве не найдены. Заявленные/имеющиеся тесты проекта нами не запускались.

### CCXT

Проверены MIT LICENSE, README и реализация Bybit `fetch_ohlcv()` в Python. CCXT предоставляет unified OHLCV API, market/timeframe mapping, pagination option и поддержку обычных/mark/index/premium candles. Но это транспортный слой, не quality engine; некоторые дополнительные OHLCV поля и exchange closed flag не входят в базовый унифицированный ряд.

### Решение

- rinng: KEEP/ADAPT как архитектурный источник, но не копировать data-quality/resample логику без исправлений.
- CCXT: shortlist для source adapters, но не считать заменой собственного canonical contract и quality gate.
- Собственный контракт Candle/Snapshot/QualityReport и обязательный preflight quality gate остаются необходимыми.

Подробности: `docs/research/B1_DATA_LAYER_CANDIDATES_2026-11-26.md`.

B1 находится в исследовании. Основной HTML не изменён.


## 11. B1 — draft Data Contract подготовлен

**Дата:** 2026-11-26. Тип: спецификация; код приложения не изменён.

Подготовлен `docs/specs/B1_DATA_CONTRACT_DRAFT.md`. Документ описывает provider-neutral Candle/Snapshot/QualityReport, UTC timestamp semantics, source provenance, volume units, common MTF cutoff, closed/forming state, quality statuses, mandatory quality gate, stale-cache policy, resampling completeness rules и deterministic test matrix из 25 случаев.

Спецификация остаётся draft. Решения по runtime, второму provider adapter и точным freshness thresholds не приняты. B1 implementation не начата.


## 12. Предварительное исследование B2 — Market Structure candidates

**Дата:** 2026-11-26. Тип: source audit; B2 не открыт, приложение не менялось.

Изучен `market-mechanics-bot`: causal swing timing через `confirmed_idx`, left-to-right state, BOS/CHoCH по body close и тесты wick-only/body-close. Важное ограничение: GitHub license metadata отсутствует; код нельзя копировать без подтверждения лицензии. README проекта сообщает, что его механическая FX-стратегия не показала устойчивого edge.

Сопоставлены pyvsmc (MIT, но найден look-ahead risk), Forex-wws2277 (нет лицензии и нет confirm timestamp для pivot/OB/FVG), ICT_V4 (нет лицензии, causal replay требует отдельной проверки) и TradingAPP LuxAlgo port (CC BY-NC-SA-4.0, исключён для прямого копирования).

Подробности: `docs/research/B2_MARKET_STRUCTURE_CANDIDATES_2026-11-26.md`. B2 остаётся NOT STARTED; это подготовительный research only. Текущий этап — B1.


## 13. B1 — mapping текущего BybitAdapter к canonical contract

**Дата:** 2026-11-26. Тип: source mapping/specification; HTML не изменён.

Просмотрен `BybitAdapter` (строки 546–857). Подтверждено, что уже есть HTTP/API response checks, timeout/AbortSignal, host fallback, OHLC sanity checks, sort, quality counters, closed/forming split и server-time estimate.

Зафиксированы 11 разрывов: отсутствие canonical contract; неполная volume/provenance metadata; молчаливое разрешение duplicate conflicts; слишком широкое допущение future timestamps; fallback provider time к local Date.now без маркировки; time-derived closed state без отдельного типа; counters без quality status/gate; отсутствие expected coverage; нет pagination; нет общего MTF cutoff; stale cache может повторно показать старое directional решение.

Предложен минимальный план B1: сохранить текущий JS adapter как первый provider, добавить canonical mapping + pure validator + mandatory gate + stale suppression, затем common cutoff и только потом второй provider. Предварительная рекомендация: не мигрировать на Python backend до доказанной необходимости.

Подробности: `docs/specs/B1_CURRENT_ADAPTER_MAPPING.md`. Код приложения не изменён.


## Stage 2 transition and isolated B2-A/B candidates — 2026-11-27

The owner approved freezing Stage 1 visual/live-chart feature work temporarily and prioritizing the analytical Market Structure stage. The first-stage issues (live forming-candle animation, precise live-price comparison and remaining real iPhone/Safari market-data diagnostics) are deferred, not discarded. B1 data-quality requirements remain mandatory.

### B2-A
- Isolated pure causal raw swing-high/swing-low engine in `src/analysis/b2-causal-swing-engine.js`.
- Exact B1 snapshot/report and version binding; closed-candle provenance, timeframe alignment, finality, ordering and OHLC checks; plateau-aware pivots with rightmost representative and causal timestamps.
- Expanded deterministic tests: 20/20 passed in GitHub Actions run [46010999225](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46010999225), code commit `8583d5d58158a183a3185fb1397abb3cbe8cb233`.
- PR #12 is draft/unmerged and not connected to the application.

### B2-B
- Isolated pure swing-sequence engine in `src/analysis/b2b-swing-sequence-engine.js`.
- Consumes only VALID B2-A output; preserves raw pivots; builds availability-ordered alternating sequence; implements symmetric same-side replacement and HH/LH/EQH/HL/LL/EQL labels.
- Exact B2-A and B1 identity binding; deep immutable output without freezing upstream-owned objects.
- Deterministic tests: 19/19 passed in GitHub Actions run [46011622297](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46011622297), code commit `eefa675c5cacab59e7d3aa0c25757dd1c22bbbc8`.
- PR #13 is draft/unmerged and based on the B2-A candidate branch.

### Acceptance boundary
B1 remains NOT ACCEPTED. B2-A/B are isolated research candidates only. No application HTML, `main`, chart, MTF directional path or LONG/SHORT decision logic changed. No live Bybit or profitability claim is made. B2-C and later increments remain separate work and must not be connected to the app before B1 acceptance and explicit owner approval.


### B2-A → B2-B deterministic contract integration — 2026-11-27

B2-B test suite expanded to 20/20 with a direct fixture that instantiates the actual B2-A engine using a canonical B1 snapshot and matching quality report, then passes the resulting VALID pivot output to B2-B. The test verifies the causal sequence labels `INITIAL_HIGH`, `INITIAL_LOW`, `HH`, `HL`, `LH`, `LL`. GitHub Actions run [46012201698](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46012201698) passed on commit `9c102e8f3984daccf0d7d94bcb8807c549e0dcf1`. This is deterministic contract verification only.


## B2-C isolated structure-state engine — 2026-11-27

**Branch:** `feature/b2c-bos-choch-state-machine-2026-11-27`  
**PR:** https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/15 (draft, unmerged)  
**Verified head:** `a58441aa4f39aa6e3b98650624f07a2041e7152a`

### Work completed
- Added `src/analysis/b2c-swing-structure-engine.js`, a pure consumer of a VALID B2-B result plus the exact B1 snapshot and quality report.
- Revalidates B1 snapshot/report identity, B2-A/B engine and policy identities, candle provenance/finality/order/continuity/OHLC, forming/unknown isolation, and each pivot's actual source candle, confirmation candle and finality availability.
- Independently reconstructs B2-B same-side replacement and sequence labels from raw pivots; rejects omitted pivots, forged labels and forged supersession metadata.
- Implements UNESTABLISHED / UP / DOWN, initial breaks, bullish/bearish BOS, protected HL/LH advancement, bullish/bearish CHoCH, wick-only sweep evidence, gap-through annotation and consumed-level deduplication.
- Uses strict close beyond level with ZERO_BUFFER_V1; equality is not a break.
- Evaluates breaks before admitting pivots that become available at the same candle close, preventing same-candle hindsight.
- Preserves raw pivot evidence and emits deeply immutable event history.

### Verification
GitHub Actions run [46013846058](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46013846058) passed **28/28** deterministic tests on exact commit `a58441aa4f39aa6e3b98650624f07a2041e7152a`. Coverage includes bullish/bearish initial breaks, BOS/CHoCH symmetry, protected swing behavior, wick sweeps, equality, same-candle no-lookahead, duplicate-level suppression, prefix replay, malformed provenance and an end-to-end B1 → B2-A → B2-B → B2-C fixture.

### Limits and acceptance boundary
- Research-only module; not imported into application HTML.
- No live Bybit test, MTF, S/R zones, retests, chart overlays or LONG/SHORT connection.
- B1 remains NOT ACCEPTED. Production integration remains blocked until B1 acceptance and explicit owner approval.
- This is an internal implementation review, not an independent external audit.


## B2-D isolated support/resistance zone engine — 2026-11-27

**Branch:** `feature/b2d-support-resistance-zones-2026-11-27`  
**PR:** https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/16 (draft, unmerged)  
**Verified head:** `0574858db12dd2082d7449f5512fa8461fceac63`

### Work completed
- Added `src/analysis/b2d-support-resistance-engine.js`, consuming VALID B2-C output with exact B1/B2-A/B2-B/B2-C identity binding.
- Revalidates candle continuity/finality/provenance, forming/unknown isolation and source/confirmation candle provenance for every raw pivot.
- Builds support clusters from swing lows and resistance clusters from swing highs; roles are never merged.
- Requires an explicit instrument/timeframe-scoped absolute max-span policy. No hidden default or guessed ATR/percentage fallback.
- Uses MAX_TOTAL_SPAN_V1, which bounds the full cluster span and prevents transitive chaining.
- Requires independent source-candle touches; insufficient clusters remain candidate levels.
- Emits observed bounds, median representative, touch count, first/last touch, age, zone availability and all contributing pivot IDs/timestamps.
- Deliberately excludes probability-like strength, role reversal and retest lifecycle.

### Verification
GitHub Actions run [46014759139](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46014759139) passed **20/20** deterministic tests on exact commit `0574858db12dd2082d7449f5512fa8461fceac63`. The suite includes an end-to-end B1 snapshot → B2-A → B2-B → B2-C → B2-D fixture.

### Limits and acceptance boundary
- Research-only; not imported into application HTML.
- The absolute zone-span parameter has not been calibrated against live BTC/ETH data.
- No B2-E retest/failure lifecycle, MTF, chart overlays or LONG/SHORT connection.
- B1 remains NOT ACCEPTED; production integration is blocked until B1 acceptance and explicit owner approval.


## Stage 2 audit hardening and B2-D — 2026-11-27

Internal review identified and fixed four issues across isolated candidate branches:
- B2-A now rejects candle gaps before pivot detection.
- B2-C BOS continuation requires HH in UP / LL in DOWN; LH/HL are not valid continuation break levels.
- B2-C re-arms a previously consumed pivot when it becomes the protected reversal level in the new state, enabling valid opposite CHoCH.
- B2-C now consumes the exact B2-A result and verifies B2-B raw pivot set completeness, not just sequence self-consistency.

Current CI:
- B2-A 21/21, run 46014698432, head bb13960e647d399b6b05ee12c21f5a2fdeb8265d.
- B2-B 20/20, run 46015818149, head b209293212ac1bd910939eed465f140514b9e959.
- B2-C 33/33, run 46015831238, head e9590ddb65c9f3a09a28279efdb064b6caa6a4a2.
- B2-D 21/21, run 46015873986, head 9012e514a29b755ac9208f1f495c3f560638b0a1.

B2-D builds support/resistance clusters from all confirmed raw pivots, keeps superseded-pivot status visible, exposes freshness age without classifying freshness, and uses an explicit absolute-price-span policy scoped to instrument/timeframe. Zone identity is membership-derived, not guaranteed stable across snapshots.

PRs #12, #13, #15, #16 remain draft/unmerged. B1 remains NOT ACCEPTED. No production app integration or main branch changes.


## B2-E isolated breakout/retest/failure lifecycle — 2026-11-27

**Branch:** `feature/b2e-breakout-retest-lifecycle-2026-11-27`  
**PR:** https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/17 (draft, unmerged)  
**Verified head:** `493a15e8006784d2b78262770725c26bd05c2e85`

### Work completed
- Added `src/analysis/b2e-breakout-retest-engine.js`.
- Consumes only VALID B2-C events and B2-D zones with exact B1/B2-B/B2-C/B2-D identity binding.
- Revalidates candle, pivot, event and current B2-D zone evidence, including B2-C accepted source pivot, prior state, transition flag, close confirmation and ZERO_BUFFER_V1.
- Reconstructs a historical zone from only raw pivots available strictly before the breakout candle close. This prevents future pivots from retroactively creating/widening the breakout zone.
- Maps bullish breakouts to resistance zones and bearish breakouts to support zones.
- Uses explicit retest touch tolerance, success/failure close buffers, retest window and confirmation window.
- Emits RETEST_SUCCESSFUL, RETEST_FAILED, RETEST_EXPIRED, RETEST_UNRESOLVED, WAITING_RETEST and RETEST_PENDING_CONFIRMATION.
- Confirms role reversal only after a successful retest; failed/expired/unresolved outcomes preserve the original role.
- Records unmatched breakouts where a qualifying historical zone did not exist.

### Verification
GitHub Actions run [46016401705](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46016401705) passed **22/22** deterministic tests on exact commit `493a15e8006784d2b78262770725c26bd05c2e85`, including a full B1 snapshot → B2-A → B2-B → B2-C → B2-D → B2-E fixture.

### Limits and acceptance boundary
- Research-only; not imported into application HTML.
- Retest thresholds are explicit synthetic configuration inputs, not calibrated market facts.
- No MTF, chart overlays, trade scenarios or LONG/SHORT connection.
- B1 remains NOT ACCEPTED; production integration is blocked until B1 acceptance and explicit owner approval.
- Internal review is not an independent external audit.


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


## Latest Stage 2 status — 2026-11-27

B2-E candidate hardening completed:
- Rejects a gap-through close beyond the failure boundary before any later retest can be considered.
- Requires the breakout candle to clear the full historical zone outer boundary, not merely one pivot inside that zone.
- Candidate branch synchronized with current B2-A/B/C/D modules and test suites; full B2-A result is passed into B2-C in the integrated fixture.
- B2-E 24/24 tests passed in run 46017280509 on head b7fccbc232c8a2de573cbfb053ef06b10b2cf834.
- Integrated B2 research suite 119/119 passed in run 46017280701.

B2-E v1 produces one lifecycle per breakout event; it does not persist zone-role state across later breakouts or invalidate a prior successful role reversal. Same-candle range-touch plus close beyond the success boundary is accepted as an OHLC bar-level convention, not intrabar tick-path evidence. Thresholds remain uncalibrated synthetic inputs.

PR #18 was closed as a duplicate design draft. PR #17 is the active B2-E candidate. All B2 PRs #12/#13/#15/#16/#17 remain draft/unmerged; B1 PRs #8/#9 remain draft/unmerged. Main unchanged; no app HTML integration.
