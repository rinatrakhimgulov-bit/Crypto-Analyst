
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



## 14. B1-A/B/C implementation and candidate verification — 2026-11-27

**Branch:** `b1/contract-review` (candidate only; `main` untouched).

**B1-A:** provider-neutral canonical snapshot mapping; explicit provenance and provider-time semantics; 500 ms finality safety lag; OPEN/TIME_DERIVED/UNKNOWN states; raw source-order evidence; identical duplicate counting; conflicting duplicate timestamp quarantine; strict seven-field Bybit V5 kline row validation; local fallback cannot certify legacy closed candles.

**B1-B:** pure deterministic `B1QualityValidator.validate(snapshot, policy, validationNowMs)`; explicit policy and clock; provenance/schema/OHLCV/time/finality/freshness/history/gap/duplicate/order checks; fail-closed status precedence. Latest suites: canonical contract 32/32 and validator 63/63.

**B1-C:** versioned policy `b1-quality-policy-2026-11-27-v1`; validation inserted between canonical mapping and analytics; only VALID permits directional calculations; all other/missing statuses produce WAIT. Cached data on failed REST refresh is revalidated, forced STALE unless INVALID, and cannot retain LONG/SHORT. UI exposes B1 status.

**Verification:** GitHub Actions Chromium run passed: StageASelfTest 44/44, B1 contract 32/32, B1 validator 63/63, B1 gate cases (five non-VALID statuses + missing report + VALID pass-through), cleanup restoration assertions, zero page errors. Manual iPhone Safari check by user passed for BTCUSDT/ETHUSDT and 1H/4H/1D switching and refresh.

**Live API limitation:** GitHub-hosted runner received HTTP 403 from both `api.bybit.com` and `api.bytick.com`; browser fetch also failed in that runner. Workflow reports `SKIPPED_PROVIDER_BLOCKED` rather than claiming live verification. The user's iPhone UI check (BTC/ETH, 1H/4H/1D, refresh) was performed before the B1-C gate/UI change; the latest B1-C build needs a final iPhone retest. CI has not independently sampled live Bybit candles.

Candidate not merged. Remaining acceptance work: independent review of B1-C diff and a fresh reproducible live REST capture from an environment not blocked by Bybit. No B2 work started.

Details: `docs/specs/B1C_ANALYTICS_QUALITY_GATE_SPEC_2026-11-27.md`.


### B1-C gate identity binding and end-to-end regression hardening — 2026-11-27

The mandatory gate now requires the current validator version and current policy version as well as status VALID. Mismatched or missing report identity fails closed as INVALID. The Playwright harness now exercises real normalization → canonical snapshot → validator → engine using deterministic synthetic Bybit-format rows: VALID yields 159 closed candles and populated EMA20/EMA50/ATR14; negative volume yields INVALID/WAIT with empty indicators; expired transport age yields STALE/WAIT with empty indicators. Latest Actions run passed Stage A 44/44, contract 32/32, validator 63/63, gate assertions, cleanup restoration, and zero page errors. Live API check was skipped because GitHub Actions receives HTTP 403 from both Bybit hosts. Candidate remains unmerged; latest UI still needs iPhone Safari verification.


### Chart visualization C1 — EMA200 and volume pane — 2026-11-27

**Branch:** `b1/contract-review` (candidate only; `main` untouched).

- Source inspection found EMA20/EMA50 overlays and SH/SL markers were already drawn by `CandleChart`; these were preserved rather than duplicated.
- Added EMA200 calculation to `BasicAnalyticsEngine` using closed candles only. The series is returned separately and does not alter existing LONG/SHORT/WAIT rules.
- Increased the active REST kline request from 160 to 400 rows so the app can obtain at least 200 closed candles for EMA200 initialization and additional smoothing history.
- Added EMA200 to the chart with its own legend entry. Visible EMA values are included in the price scale; EMA lines are clipped to the price pane.
- Added a synchronized lower volume pane using Bybit linear base-asset `volume`; bar direction follows candle direction and the forming candle is muted. Volume bars use the same visible candle slice and horizontal positions as price candles.
- Added Playwright checks for EMA200 warm-up (first valid value at index 199), EMA200 calculation, volume-bar rendering, muted forming-candle volume, and EMA200 alignment that excludes the forming candle.
- No changes to the quality gate, existing trade-decision conditions, WebSocket behavior, or `main`.

**Verification:** GitHub Actions run `45962613748` passed on the candidate: Stage A 44/44, B1 contract 32/32, B1 quality validator 63/63, EMA200 warm-up assertions passed (260 values; first valid index 199), chart renderer drew 79 closed-candle volume bars plus one muted forming-candle bar, EMA200 line was drawn only against closed-candle timestamps, mobile viewport 390 px rendered a 334×318 px canvas with 256 px plot width and 55.28 px volume pane, no page errors, cleanup restored. Live Bybit probe was skipped because both public hosts returned HTTP 403 to the GitHub runner. iPhone Safari verification of the new chart layout remains pending. Do not mark C1 accepted until CI and user-side Safari checks pass.


### B1-C UI transparency hardening — 2026-11-27

A source/spec consistency review found that the quality panel showed only validator status/version, while the B1-C specification promised visible reason codes. Corrected the candidate UI to show:
- B1 status and validator version;
- up to five validator reason codes (or an explicit no-reason/unknown-reason label);
- whether directional analysis is admitted or blocked with WAIT.

Added a real Chromium DOM-renderer assertion using an INVALID negative-volume fixture. It verifies the panel visibly contains INVALID, VOLUME_NEGATIVE, Заблокирована, and the decision badge WAIT.

CI run 45963443614 passed on candidate commit 4e5adf44.
- Stage A: 44/44.
- B1 Data Contract: 32/32.
- B1 Quality Validator: 63/63.
- UI gate assertions: all passed.
- Browser page errors: 0.
- Live Bybit probe: skipped because GitHub runner received HTTP 403 from both public hosts.

This fixes an observability gap; it does not change validation rules or signal logic. The newest panel-detail change still needs a brief iPhone Safari visual check. Independent review remains outstanding; do not merge B1 into main yet.




## Architecture baseline and B1 branch consolidation — 2026-11-27

Created `docs/ARCHITECTURE_DECISIONS_V1_2026-11-27.md` to fix the product/architecture baseline and close decisions that do not require speculative infrastructure. Created `docs/audits/B1_BRANCH_CONSOLIDATION_AUDIT_2026-11-27.md` after comparing the current B1/C1 candidate with the separate B1-A/B/E candidate.

Key finding: the older B1-E MTF implementation depends on legacy `DataQualityEngine` methods and schema. It cannot safely be copied into the current B1-A/B/C candidate, which uses `B1DataContract`, `B1QualityValidator`, and versioned B1-C report identity. The MTF semantics must be ported and tested against the current contract. No source HTML was modified in this documentation step.

The exact older B1-E artifact has an external conditional audit (33/33 MTF and 65/65 legacy quality tests). The reviewer withheld directional MTF approval pending real Bybit time-spread measurements, recorded response replay, abort testing, and a forming-candle non-consumption invariant. That review does not certify the newer B1/C1 artifact.

Working branch `integration/b1-mtf-architecture-2026-11-27` was created from `b1/contract-review`. Main remains unchanged. The user had previously confirmed the C1 chart on iPhone; the newest quality-panel detail row remains pending Safari visual verification. Live Bybit from GitHub Actions remains blocked by HTTP 403. B1 is not accepted and B2 has not started.
