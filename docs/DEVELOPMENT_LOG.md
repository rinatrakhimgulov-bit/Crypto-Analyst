
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




## B1-E current-contract MTF port and regression verification — 2026-11-27

Ported the common-cutoff MTF assembler from the older candidate design to the current B1 canonical contract. The previous implementation was not copied wholesale because it depended on legacy `DataQualityEngine` methods and schema.

Implementation details:
- Added isolated `B1MtfEngine` for required 1D/4H/1H datasets.
- Concurrently fetches each timeframe through the existing Bybit adapter; raw request limit is desired closed count + provider-spread rows + two safety rows, with Bybit's 1000-row cap enforced.
- Requires trusted provider time for all TFs; common cutoff is the minimum provider time; spread policy must be explicitly supplied and has no guessed production default.
- Reclassifies each response against the common cutoff and 500 ms finality lag.
- Excludes post-cutoff rows from canonical TF snapshots and preserves the count in new required `source_diagnostics.excluded_after_cutoff_count`; raw-row accounting subtracts only explicitly recorded exclusions.
- Validates each TF using the current B1 validator/policy identity; verifies exact closed-window start/end/count/interval; keeps forming context separate from closed-only `analysis_candles`.
- Aggregate permission is fail-closed and requires every timeframe report/version and exact coverage to be VALID.
- Adds deep immutability, sibling abort propagation, superseded-generation suppression.
- MTF remains isolated from UI and existing directional decision path.

Canonical contract and validator were incremented to 1.1.0. The validator now rejects unsupported canonical contract versions. Added regression for unsupported contract version.

**GitHub Actions run 45965680821 passed:** Stage A 44/44; B1 contract 32/32; B1 quality validator 64/64; B1 MTF 12/12; B1 gate/UI and C1 chart checks passed; zero browser page errors. Live Bybit probe was skipped/blocked because both public REST hosts returned HTTP 403 to the GitHub runner. This does not constitute live verification.

Added `docs/specs/B1E_MTF_CURRENT_CONTRACT_SPEC_2026-11-27.md`. Main remains unchanged. B1 is not accepted pending exact-artifact independent review, real concurrent Bybit capture/spread calibration, transport-level abort verification, latest Safari quality-panel check, and explicit owner acceptance.




## B1-E MTF regression expansion — 2026-11-27

Expanded `B1MtfSelfTest` from 12 to 16 cases. New tests verify:
- forming and pending-finality candles never enter the closed-only `analysis_candles` slice;
- provider-time spread one millisecond above configured policy fails closed;
- multiple post-cutoff normalized rows fail closed;
- missing measured provider-time spread policy fails closed.


The suite also contains async tests for aborting sibling timeframe requests after a failure and preventing a superseded generation from publishing late results.

**Latest GitHub Actions run 45966127523 passed:** Stage A 44/44, B1 contract 32/32, B1 validator 64/64, B1 MTF 16/16, B1 gate/UI and C1 chart checks passed, zero browser page errors. Live Bybit remained skipped/blocked because both public REST hosts returned HTTP 403 to GitHub Actions. Exact current HTML blob: `4abb9936c96ae19ff231edd86088c1f1b62a2dd0`.

The exact-artifact independent audit prompt was updated to this blob. Main remains unchanged; no merge or B1 acceptance has occurred.




## B1 report/snapshot identity hardening and MTF edge cases — 2026-11-27

Internal review identified that the B1-C gate checked validator and policy versions plus VALID status but did not prove the quality report belonged to the exact canonical snapshot currently being analyzed. Closed this gap:
- canonical contract requires a non-empty `snapshot_id`;
- B1QualityValidator includes `snapshot_id` in every report;
- B1-C requires exact report-to-`dataset.canonicalSnapshot` identity and blocks mismatch with `QUALITY_REPORT_SNAPSHOT_MISMATCH`;
- B1-E requires exact report-to-per-timeframe snapshot identity before aggregate permission.

Additional MTF hardening:
- explicit `closedCandleCount` is mandatory in `fetchAndAssemble()`; missing value rejects before adapter/network requests;
- pending-finality candles are preserved in `pending_finality_context`, never in the closed-only `analysis_candles`;
- added deterministic regressions for missing history count and pending-finality separation.

Browser harness fixtures now bind reports to their canonical snapshots and include a deliberate snapshot-ID mismatch case. Latest completed GitHub Actions run `45966700299`: Stage A 44/44, B1 contract 32/32, B1 validator 65/65, B1 MTF 18/18, gate/UI and C1 chart checks passed, zero browser page errors. Total across named self-test suites: 159/159. Live Bybit remains blocked by HTTP 403 from both public REST hosts.

Exact current HTML blob: `1cb41cfbc03534441774eeeaac08f36082f19ab9`; browser harness blob: `8700f7ebedf6f4091b37d5e7d4c04ba22c2d92a8`. Main unchanged. B1 not accepted pending independent exact-blob review, live concurrent capture/spread calibration, transport abort verification, latest Safari panel check and owner approval.



## B1-E hardening follow-up — 2026-11-27

Added an explicit required `closedCandleCount` contract to `fetchAndAssemble()`; omission now throws before any adapter/network request. Added a regression proving pending-finality candles remain visible only as context and cannot enter the closed-only analysis slice. The MTF result now exposes `pending_finality_context` separately from `forming_context` and `analysis_candles`.

Latest completed CI run `45966502044`: Stage A 44/44, B1 contract 32/32, B1 validator 64/64, MTF 18/18, gate/UI/chart checks passed, zero browser page errors; 158/158 named self-tests. Exact current HTML blob: `1cb41cfbc03534441774eeeaac08f36082f19ab9`, 299,978 bytes. Live Bybit remains blocked by HTTP 403 from both hosts on GitHub Actions. This is not live exchange verification.



## Full-suite verification supersession — 2026-11-27

The newest completed run `45966700299` supersedes the earlier 158-test report: Stage A 44/44, B1 contract 32/32, B1 validator 65/65, MTF 18/18; gate/UI/chart assertions passed, zero browser page errors; 159/159 named tests. The gate suite includes rejection of a VALID-looking report with mismatched `snapshot_id`. Candidate HTML blob remains `1cb41cfbc03534441774eeeaac08f36082f19ab9`. Live Bybit remains blocked by runner HTTP 403.




## B1 analytics series integrity and live capture utility — 2026-11-27

Internal review found a second trust boundary: B1-B validated `canonicalSnapshot`, while the existing BasicAnalyticsEngine consumed the parallel legacy `dataset.closedCandles` and `prices.lastClosedPrice`. The two representations were normally generated from the same adapter response, but this was not enforced. B1-C now compares the complete series (count, timestamps, OHLC, base volume, quote turnover) and last-closed price against the canonical validated series before directional analysis. Mismatch blocks with INVALID/WAIT and `ANALYTICS_CANDLE_DATA_MISMATCH`. A matching empty series preserves INSUFFICIENT rather than being mislabelled INVALID.

Added/expanded browser gate assertions for series mismatch and empty insufficient history. MTF suite now 20/20, including 1000-row cap and external abort. B1 validator suite 65/65.

Ported and hardened `tools/b1_live_probe.html` schema v3: strict positive safe-integer provider time; per-host attempt records retain response-header/body timing and HTTP status even on failed attempts; read-only raw 1D/4H/1H captures. Added iPhone Safari procedure using a Windows PC as a local HTTP host. CI smoke-checks the probe UI and confirms it does not auto-request Bybit on load.

Latest CI run `45967551538`: Stage A 44/44, B1 contract 32/32, B1 validator 65/65, B1 MTF 20/20, gate/UI/chart and probe smoke passed, zero browser page errors. Live Bybit remains blocked by HTTP 403 from both public hosts on GitHub Actions.

Current HTML blob `2af63d1bbfec766606325450819d8ddff14173a2`; harness `a23585f9688b9a04336c7f99da7a972513882f8e`; probe `3b5df8f0feda730c7e6564808f40ad4526f0e44a`. Main unchanged. B1 acceptance gates remain open.



## B1-C analytics-input integrity hardening — 2026-11-27

Added a fail-closed equivalence check between the canonical closed-candle series that passed B1 validation and the legacy candle series/last-closed price consumed by `BasicAnalyticsEngine`. If timestamps, OHLCV, turnover, count or last-closed price diverge, the engine returns WAIT and does not calculate directional indicators. Added handling so an empty but internally matching candle series preserves the validator's INSUFFICIENT status and `INSUFFICIENT_HISTORY` reason rather than being mislabeled INVALID.

Latest CI run `45967551538`: Stage A 44/44, B1 contract 32/32, validator 65/65, MTF 20/20; gate/UI/chart checks passed, zero browser page errors; 161/161 named tests. Current HTML blob `2af63d1bbfec766606325450819d8ddff14173a2` (303,499 bytes); browser harness blob `a23585f9688b9a04336c7f99da7a972513882f8e` (29,130 bytes). PR #8 draft head `f6cc90e51096e30bd524a6e883f3ca0ad1273d79`; main unchanged. Live Bybit remains blocked by HTTP 403 from both public hosts on GitHub Actions.



## Real browser transport cancellation verification — 2026-11-27

Changed fetch deadline abort reason from a generic Error to a named `TimeoutError`. Expanded the Playwright harness with a delayed local HTTP endpoint and exercised the real Chromium fetch stack through the actual `BybitAdapter.fetchMarketSnapshot` method. External AbortSignal cancels the concurrent kline and ticker requests; the independent deadline cancels the delayed request. The server observed 3 requests and 3 closed client connections. This is a real browser transport test, but it does not test the exchange's network or a live Bybit connection.

CI run `45968566553` passed: Stage A 44/44, B1 contract 32/32, validator 65/65, MTF 20/20; 161/161 named self-tests, gate/UI/C1/probe checks passed, zero browser page errors. Live Bybit remains blocked by HTTP 403 from both public hosts on GitHub Actions.

Current HTML blob `3d6a2fea8c4724d47a4d91bb73a53c6dedecd8cf` (303,522 bytes); test harness blob `70399a984b44f5f85024afcdf11289e4a73a6361` (32,071 bytes). PR #8 remains draft; main unchanged.


## B1-D live ticker and kline integration — 2026-11-27

Promoted the existing Bybit V5 WebSocket client from connection-health/log-only behavior to a live market-data transport for the currently selected symbol and timeframe.

- Ticker snapshot/delta callbacks emit validated lastPrice only when a snapshot or delta actually contains lastPrice; non-price-only deltas cannot refresh the last-price freshness clock. Events preserve provider event time, local receive time, sequence and connection generation. Mark/index prices are never substituted. The app requires an acknowledged active ticker subscription and a fresh snapshot before treating the WS price as live. The 10-second receive-age threshold causes an explicit stale indication and REST fallback.
- Kline callbacks validate topic symbol/interval, timestamp grid and interval end, positive OHLC prices, volume/turnover, OHLC relationships and boolean confirm. Invalid messages fail closed and request REST reconciliation.
- Chart now has dedicated live-price and live-candle update methods. Ticker updates the displayed price and horizontal price line; kline updates the forming candle without recalculating indicators or advancing the closed-candle analysis boundary. Closed REST candles are immutable to WS updates. A new candle is appended only after the prior forming candle is explicitly confirmed. Gaps, older candles, conflicts and missing base history request REST reconciliation.
- Confirmed kline schedules REST reconciliation after the existing 500 ms finality safety lag plus 250 ms. WS finality does not itself certify B1 analytics. REST remains the history/bootstrap/reconciliation/recovery source and keeps its 30-second background poll.
- Symbol/timeframe switches clear live display state. Switching symbols resets any previously cached ticker snapshot so an old delta cannot be mistaken for a fresh quote.
- Added six B1-D deterministic Stage A tests and browser-level integration checks that exercise the live ticker and kline handlers through the actual DOM and chart. Existing desktop/mobile chart, B1 gate and transport tests remain active.

Latest CI run 45981507604 passed: Stage A 50/50, B1 contract 32/32, B1 quality 72/72, B1 MTF 20/20; 174/174 deterministic tests, browser live-handler/UI integration, desktop/mobile chart checks, REST cancellation/timeout checks, zero page errors. Live Bybit remains SKIPPED_PROVIDER_BLOCKED because GitHub Actions receives HTTP 403 from both public REST hosts; no live WebSocket success is claimed.

Exact candidate artifacts: HTML blob 39e42c223419bd8a599f6c513ef6e269df120fcc (329,008 bytes); browser harness blob 44b492f92ffbbbb58f6cb830375b6330a556d5c4 (35,635 bytes). PR #9 is draft and targets the B1 integration branch; PR #8 remains draft. Main unchanged. Real iPhone/Safari stream verification and independent review remain open.


## B2 — Market Structure specification design review

**Date:** 2026-11-27  
**Type:** documentation/research review; no application code changed  
**Branch:** `research/b2-market-structure-spec-2026-11-27`  
**PR:** https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/10  
**Base:** PR #9 branch `feature/b1-d-live-market-data-2026-11-27`

### Work completed
- Reviewed the existing B2 Market Structure Engine design baseline.
- Recorded unresolved rules that must be frozen before implementation: plateau handling, same-side pivot replacement, protected swing selection, initial trend state, break buffer, event order/lifecycle, and S/R/retest policy.
- Defined release-blocking causal invariants: prefix invariance, batch/online equivalence, availability-time correctness, no same-candle hindsight, immutable event history, forming-candle isolation, and fail-closed input quality.
- Recommended staged B2-A/B2-C implementation only after B1 acceptance.

### Verification and limitations
- Review is internal; no independent external reviewer was used.
- Documentation only. No application HTML, JavaScript, UI, or decision logic changed.
- B1 remains unaccepted; its live concurrent MTF capture and independent review gates remain open.
- No B2 production code or trading signals were added.

### Result
B2 design review is recorded with blockers. Production implementation remains NOT STARTED and is gated on B1 acceptance.

## B2 design policy freeze — 2026-11-27

### Work completed
- Added Section 15 to the B2 specification, freezing v1 rules for exact price equality, plateau confirmation, raw/sequence pivot handling, initial trend state, protected swings, strict close-based breaks, event order and consumed-level lifecycle.
- Explicitly limited the first implementation proposal to B2-A/B/C. Support/resistance zones, retests and chart integration remain separate later increments.
- Added a resolution pass to the internal design review mapping all seven blockers (R1–R7) to the frozen specification.

### Result and limits
- The seven previously identified design ambiguities are resolved at specification level.
- This remains an internal design review, not an independent external audit. The policy choices still require deterministic fixtures and historical replay before chart-facing use.
- No application code, HTML, UI, analytical decision path, or main branch changed.
- B1 acceptance gates remain open; B2 implementation remains blocked until explicit B1 acceptance.
- Changes are on research/b2-market-structure-spec-2026-11-27, in documentation-only PR #10 (draft, unmerged).

## B2-A isolated causal swing candidate — 2026-11-27

### Implemented
- Added a pure B2-A module at src/analysis/b2-causal-swing-engine.js.
- Added exact B1 snapshot/quality-report identity admission and required B1 quality-policy version binding.
- Added closed-candle, provenance, ordering, timestamp-grid, OHLC and finality-safety checks.
- Added symmetric plateau-aware swing-high/swing-low detection with rightmost plateau representative.
- Added source, plateau, confirmation and availability timestamps; availability includes the explicit B1 finality safety lag.
- Added deterministic tests for plateau handling, causal timestamps, prefix replay invariance, quality blocking, identity mismatch, forming-candle overlap, malformed time bounds, insufficient history, immutability and unsupported equality policy.
- Added a dedicated GitHub Actions workflow for the B2-A Node test file.

### Verification and limits
- 13/13 deterministic test cases passed.
- GitHub Actions run 46005202794 passed on commit f41c85a3d09cbbec602fe1eaef8902b5f52de685.
- This is isolated B2-A research code. It is not imported by the app HTML and does not affect current analytics or decisions.
- B2-B sequence labels, B2-C BOS/CHoCH, zones, retests and chart integration are not implemented.
- B1 formal acceptance remains required before production integration. No main branch changes or merges.


### B2-A exact B1 version-binding hardening — 2026-11-27

- Added explicit policy bindings for B1 canonical contract version 1.1.0 and validator version 1.1.0, alongside the exact B1 quality-policy version.
- The engine now rejects snapshots with a different contract version and reports with a different validator version. This closes the gap where any non-empty validator version could previously pass admission.
- Added two regression cases: unsupported canonical contract and mismatched validator version. Total B2-A tests: 13/13.
- GitHub Actions run 46005202794 passed on commit `f41c85a3d09cbbec602fe1eaef8902b5f52de685`.
- B2-A remains one-timeframe-per-invocation, isolated research code. No UI/HTML or LONG/SHORT connection. B1 formal acceptance remains mandatory before production integration.


## B2-A causal pivot edge-case hardening — 2026-11-27

**Branch:** `feature/b2a-causal-swing-engine-2026-11-27`  
**PR:** #12 (draft, unmerged)  
**Starting candidate commit:** `c7912236a819913f198a99d0570d9aeb3120f424`  
**Resulting commit:** `8583d5d58158a183a3185fb1397abb3cbe8cb233`

### Work completed
Expanded `tests/b2a-causal-swing-engine.test.cjs` from 13 to 20 deterministic cases. Added checks for:
- right-strength counting after the final candle of a longer equal-price plateau;
- equal highs in non-contiguous left and right comparison windows;
- no pivot emission before a complete right confirmation window;
- deep immutability of returned pivot evidence;
- duplicate candle timestamps;
- out-of-order closed candles.

### Verification
GitHub Actions run [46010999225](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46010999225) completed successfully. Job `b2a-unit-tests` passed. The test command completed successfully with the expanded suite (20 cases).

### Scope and limits
- Test-only change plus documentation updates; B2-A engine source and application HTML were not changed.
- No live Bybit, browser, or profitability test was performed.
- B1 remains NOT ACCEPTED. B2-A is isolated research code and is not connected to the running application or LONG/SHORT decisions.
- Stage 1 visual chart polish is deferred by owner decision; data-quality gates remain mandatory.
