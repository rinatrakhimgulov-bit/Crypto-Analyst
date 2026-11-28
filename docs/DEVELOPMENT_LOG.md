
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


## B2-B isolated causal swing sequence candidate — 2026-11-27

**Branch:** `feature/b2b-swing-sequence-2026-11-27`  
**PR:** https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/13 (draft, unmerged)  
**Base:** `feature/b2a-causal-swing-engine-2026-11-27`  
**Verified commit:** `eefa675c5cacab59e7d3aa0c25757dd1c22bbbc8`

### Work completed
- Added `src/analysis/b2b-swing-sequence-engine.js`, a pure B2-B consumer of VALID B2-A output.
- Bound B2-B admission to exact B2-A engine/policy identity and the exact B1 validator/quality-policy identity embedded in B2-A's admission record.
- Preserved all raw pivots and derived a separate alternating sequence in B2-A availability order.
- Implemented symmetric same-side replacement, equality retention, initial labels and HH/LH/EQH/HL/LL/EQL comparisons.
- Added comparison pivot IDs, absolute and relative price deltas, explicit sequence-order basis and immutable diagnostics.
- Added 19 deterministic tests covering sequence labels, both replacement directions, equality, availability ordering, malformed identities/timestamps, duplicate IDs, input immutability and deterministic output.

### Verification
GitHub Actions run [46011622297](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46011622297) completed successfully; all 19/19 tests passed.

### Scope and limits
- Research-only isolated module; no app HTML/UI, chart, MTF or LONG/SHORT integration.
- No BOS/CHoCH, protected-swing state, zones, retests or trade recommendations.
- No live Bybit or profitability claims.
- B1 remains NOT ACCEPTED; production integration is prohibited until B1 acceptance and explicit owner approval.


---

## 2026-11-27 — B2-A–B2-G causal research chain and historical replay

**Исполнитель:** ChatGPT (GitHub candidate branch; no external AI review claimed).

**Цель:** завершить исследовательскую цепочку структурного анализа и проверить её на исторических рыночных данных до решения об интеграции в приложение.

### Изменения

- B2-B upgraded to 2.2.0 / policy v3. Added immutable sequence_history entries captured at pivot availability time; final active sequence remains separate.
- B2-C upgraded to 2.1.0 / policy v2. Structure events are replayed from causal sequence history, preventing later same-side replacement from erasing earlier events.
- Same-source-candle high/low pairs are retained as ambiguous raw pivots but excluded from alternating sequence and BOS/CHoCH source admission.
- B2-D accepts these ambiguous pivots only as explicitly tagged S/R evidence.
- B2-E and B2-G validate historical event source pivots against accepted-at-availability sequence history.
- B2-F and B2-G bind to the updated B2-B/B2-C engine and policy versions.
- Added `tools/b2_historical_replay.cjs` and `.github/workflows/b2-historical-replay.yml`.

### Verification

- Integrated deterministic CI run 46031937203: 181/181 tests passed.
- Historical replay run 46032038435: passed.
- Six historical series: BTCUSDT/ETHUSDT 1H/4H/1D.
- Full B2-A/B/C replay, 30 sampled B2-A–B2-E windows, synchronized MTF B2-F/B2-G execution for both symbols.
- 18/18 prefix-invariance checks passed for B2-A pivot availability and B2-C event history.
- The historical replay report is stored in the CI artifact `b2-historical-replay-report` and summarized in the B2 preliminary replay audit.

### Problems found and corrected

1. Same-candle dual high/low pivots had been ordered by a deterministic type sort even though OHLC cannot reveal their intrabar order. Both are now marked AMBIGUOUS_FOR_SEQUENCE and excluded from the active structure sequence.
2. B2-C had consumed only B2-B's final active sequence, allowing future same-side replacement to alter earlier event history. B2-B now preserves sequence_history at availability time, and B2-C replays events from that history. B2-E/B2-G validate event sources against it.

### Limitations / acceptance

- Historical archive ends 2025-12-05 and is third-party data claiming Bybit USDT-M perpetual provenance.
- Replay uses synthetic B1-valid wrappers and synthetic zero MTF provider-time spread; it does not replace B1 live acceptance.
- Zone/retest settings and pivot strength are exploratory, not production-calibrated.
- Independent exact-source audit and iPhone/Safari verification remain open.
- B1 remains NOT ACCEPTED. No app HTML or main-branch changes. PR #20 remains draft/unmerged.



## 2026-11-27 — B2 app integration candidate

**Branch:** `integration/b2-market-structure-ui-2026-11-27`  
**Base:** B1-D candidate branch, not `main`.

### Implementation

- Inlined the B2-A…B2-G browser modules into the single-file HTML application.
- Added a separate B2 panel and chart overlays for swing pivots, BOS/CHoCH events and S/R zones.
- Added a fail-closed B2 runner: it requires the selected timeframe's B1 canonical snapshot and VALID quality report; B2-F MTF remains intentionally disconnected pending live provider-time calibration.
- Kept B2 out of the existing LONG/SHORT/WAIT calculation path.
- Fixed B2-D call wiring to pass `zone_policy: zonePolicy`.
- Fixed B2-G optional MTF projection handling so a single-timeframe chart projection can be VALID with explicit null MTF context.
- Fixed a chart look-ahead issue: confirmed S/R zones now begin at their causal `visible_from_ms` timestamp, not at the left edge of the chart.
- Added browser regression coverage for single-timeframe projection, B1 stale fail-closed behavior, mobile layout and causal zone start position.

### Verification

- B2 app integration run [46034275312](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46034275312) passed: B2-A…B2-G suites, browser integration and mobile layout checks.
- Synthetic browser result: 220 closed candles, B1 VALID, B2 VALID, 33 pivots, 65 structure events, 2 zones, 2 retest lifecycles; projection attached; stale B1 input blocked.
- Mobile viewport 390×844: B2 panel visible; no horizontal overflow; zero page errors.
- B1 browser/data suite [46034276646](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46034276646) passed. Live Bybit REST was skipped because GitHub Actions received HTTP 403 from both Bybit hosts.

### Limits

- Synthetic browser fixtures prove runtime wiring, not live market correctness or trading effectiveness.
- MTF remains disabled in the application until provider-time spread calibration.
- Zone/retest thresholds and pivot sensitivity remain exploratory.
- No iPhone/Safari verification has been performed on this integration branch yet.
- No merge to `main` was made.


## 2026-11-27 — B2 application integration preview

- Created isolated branch `integration/b2-market-structure-ui-2026-11-27`; did not modify `main`.
- Inlined B2-A through B2-G source modules into the single-file app so the prototype remains usable as one HTML file.
- Connected B2-A/B/C/D/E to the current B1 canonical snapshot and quality report for the selected chart timeframe.
- Connected B2-G to the chart as a causal projection DTO. Added HH/HL/LH/LL markers, BOS/CHoCH event labels, confirmed S/R zones, and a B2 summary panel.
- Added a fail-closed UI path: stale/non-valid B1 quality prevents B2 analysis; runtime exceptions are isolated from the existing Stage A render path.
- B2-G now accepts an explicit null B2-F result and emits `mtf_context: null`. B2-F remains disabled in the live UI pending empirical provider-time spread calibration.
- Added browser/mobile integration tests using synthetic B1-valid candles. The tests verify the complete B2 selected-timeframe pipeline, projection attachment, stale-quality blocking, and mobile overflow behavior.
- Provisional zone/retest thresholds are marked exploratory in the UI and are not used for trading decisions.

### Verification

- B2 research suite run 46034125614: 182/182 passed.
- B2 app integration run 46034125941: passed; 220 closed synthetic candles, 33 swing markers, 65 structure events, 2 zones, 2 retest lifecycles; stale quality blocked at B1.
- Mobile 390×844: no horizontal overflow.
- B1 browser suite run 46034125888: passed; live Bybit verification skipped due runner-side HTTP 403.
- Historical replay run 46032038435 remains a separate archive-based research result, not live Bybit proof.

### Remaining limitations

- iPhone/Safari visual and functional acceptance is pending.
- MTF provider-time spread has not been empirically calibrated; B2-F remains disabled in the app.
- Historical archive ends 2025-12-05 and uses a synthetic B1-valid wrapper.
- Pivot strength, zone span and retest tolerance are not production-calibrated.
- No B2 output is connected to LONG/SHORT/WAIT.


### Clean PR packaging

- Created `integration/b2-clean-preview-2026-11-27` from the current `main` tree and overlaid the integrated B1/B2 preview snapshot, preserving newer main-only documentation.
- Opened draft PR #22: https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/22.
- No merge performed. `main` remains unchanged.

### Latest clean-branch verification

- PR #22 clean branch head `3d6c721044118f5a04f5498e60f03c1e13b7597b`, based on current main commit `bc8af9270dfa5f3d475ae928731476b6dae87b2a`; 9 commits ahead, 0 behind.
- B2 integration workflow 46034803848 passed, including all module steps and Chromium/mobile integration.
- B2 research suite 46034803544 passed: 182/182 deterministic tests.
- B1 browser/data workflow 46034808544 passed; deterministic groups 50/50, 32/32, 72/72 and 20/20; zero page errors.
- Live Bybit REST probe was skipped because GitHub runner requests to api.bybit.com and api.bytick.com returned HTTP 403. This remains unverified on live exchange from this environment.
- Synthetic browser test covered 220 closed candles and 390px viewport without horizontal overflow. This is not a substitute for iPhone Safari owner verification.


### Clean PR #22 CI refresh

- B2 research suite run 46034803544: passed.
- B2 app integration run 46034803848: passed. Causal S/R zone start-position assertion passed; stale B1 quality blocked the B2 pipeline; mobile 390×844 layout passed without horizontal overflow.
- B1 browser run 46034803715: passed with zero page errors; live Bybit was skipped due runner HTTP 403.


- Final clean-branch historical replay run 46035136810: passed with the current B2-A–B2-G source set; report uploaded as the `b2-historical-replay-report` artifact. This remains archive-based synthetic-B1 replay, not live-provider validation.


### Full historical B2 replay

- Added `docs/audits/B2_HISTORICAL_REPLAY_RESULT_2026-11-27.md` based on successful workflow run 46035136810.
- Replayed full B2-A/B/C over BTCUSDT and ETHUSDT on 1H/4H/1D historical archive series.
- All six series passed archive integrity checks; 18/18 prefix-invariance checks passed.
- B2-D/E lifecycle behavior was exercised across five sampled 160-candle windows per series and a final synchronized MTF window. Do not describe this as a full-series B2-D/E replay.
- Synthetic MTF fixture used zero provider-time spread; this does not calibrate live Bybit timing.
- The archive ends 2025-12-05. No trading edge, profitability or 2026 adaptation has been established.


## 2026-11-27 — B3 chart UI redesign started

- Created branch `feature/b3-chart-ui-redesign-2026-11-27` from main after PR #22 merge commit `d2b8220572ec407a62c5a359af3c0264919932b1`.
- Updated `CryptoAnalyst_StageA_S6_updated.html`: responsive 440–640 px mobile chart area; Clean/Structure/Full display presets; independent controls for S/R zones, extrema, BOS/CHoCH, retests, EMA and volume; custom mode after manual layer changes.
- Clean preset hides EMA overlays and BOS/CHoCH/retest labels, limits recent B2 extrema to six and softens zone fills/labels. Structure limits extrema to 14 and events/retests to eight; Full exposes all supported overlays and legacy levels.
- Retest annotations are placed at the first candle at or after lifecycle `visible_at_ms`, preserving causal availability rather than backdating the status to breakout.
- Updated `tests/b2-app-browser-integration.cjs` with assertions for mobile chart height, all three presets, custom layer toggles and button state. Updated `.github/workflows/b2-app-integration.yml` to run on the B3 branch.
- Added `docs/specs/B3_CHART_UI_REDESIGN_SPEC_2026-11-27.md`.
- JavaScript syntax check: both inline scripts PASS. Browser test/CI and owner iPhone Safari review are not yet confirmed. Candidate only; no merge.


### B3 browser/CI verification — 2026-11-27

- B2 application integration workflow [46038517628](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46038517628): SUCCESS. B2-A…B2-G deterministic suites passed; browser integration and mobile chart UI assertions passed; zero browser page errors.
- B1 candidate browser/data workflow [46038517602](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46038517602): SUCCESS. Stage A 50/50, B1 contract 32/32, quality 72/72, MTF 20/20; browser chart/volume and mobile layout checks passed; zero page errors.
- B3 browser test verified Clean/Structure/Full presets, manual layer toggle/custom mode, 390×844 mobile viewport, chart height >=440 px, no horizontal overflow, and causal S/R zone positioning.
- Live Bybit REST probe was skipped as `SKIPPED_PROVIDER_BLOCKED`: GitHub Actions runner received HTTP 403 from both `api.bybit.com` and `api.bytick.com`. This is not a live Bybit pass or evidence of provider unavailability elsewhere.
- The first CI attempt exposed mobile horizontal overflow from chart controls and an old B1 visual test assumption that EMA200 was always visible. Both were corrected: chart grid/control containers now constrain width, and the EMA regression explicitly enables the EMA layer before testing it.
- Candidate remains in `feature/b3-chart-ui-redesign-2026-11-27`, draft PR #23. No merge. iPhone/Safari owner visual acceptance remains pending.


### B3 verification update

- Initial browser run exposed a real regression: the existing EMA200 visual regression test expected EMA overlays while the Clean preset intentionally hid them. The test was made explicit about enabling the EMA layer before checking EMA200 rendering; no production chart logic was weakened to satisfy the test.
- The first mobile browser run also exposed horizontal overflow from the new layer controls. CSS was corrected with min-width:0/minmax(0,1fr) constraints and a full-width horizontally scrollable layer strip.
- GitHub Actions on commit `c8a79a2429f10fafdca28987c28e384ecba467db`: B1 browser/live-data verification SUCCESS; B2 application integration SUCCESS. The latter includes B2-A…G deterministic suites and mobile browser integration/layout assertions.
- A follow-up test-only cleanup commit `931d29fea93dc144520a2a94db680b6a072963bd` removed temporary diagnostics while retaining an explicit assertion that EMA visibility is enabled during its regression check. Its workflow runs passed.
- The final PR HEAD `e65715efea1fa97527f03ccb7e883cc8d6737e58` contains only subsequent documentation updates beyond the tested code; B1 run `46039070502` and B2 run `46039070648` both completed SUCCESS on this exact HEAD.
- PR #23 was merged into `main` as `7d34a3539c9a655bca546bbb7b0c8ff2293b80ee`. iPhone/Safari visual acceptance remains pending after integration.


## 2026-11-27 — B3 completed and integrated

- Merged PR #23, `B3: Responsive chart UI and display layers`, into `main` using merge commit `7d34a3539c9a655bca546bbb7b0c8ff2293b80ee`.
- Final PR HEAD: `e65715efea1fa97527f03ccb7e883cc8d6737e58`. The two commits after the last application/test change were documentation-only.
- Exact final-HEAD CI: B1 browser/live-data run `46039070502` SUCCESS; B2 application integration run `46039070648` SUCCESS. B2-A…B2-G deterministic suites and browser/mobile integration completed successfully.
- Main HTML blob after merge: `6b5521195454bc3d3be3e18cc7f4fb10682ee48b` (511,597 bytes).
- Implemented: responsive 440–640 px mobile chart area; Clean/Structure/Full presets; independent layer controls; reduced label density; custom mode; causal retest marker placement; mobile overflow fixes.
- A real regression found during validation (EMA200 test assumed EMA was visible by default) was corrected in the test by explicitly enabling the EMA layer. A first-run mobile overflow issue was corrected in CSS and retained in browser assertions.
- Live Bybit REST verification was not completed: GitHub Actions runner returned HTTP 403 from both public REST hosts. No live-feed validation is claimed.
- B3 is integrated, but user iPhone/Safari visual acceptance is still pending. No claim is made that mobile rendering has been accepted by the user or that B3 changes trading performance.

## 2026-11-27 — решение о следующих этапах после B3

По итогам пользовательского обсуждения и независимой инженерной оценки Grok зафиксировано изменение приоритетов. Это планирование, не реализация новых функций.

- B3 подтверждён пользователем как заметное улучшение читаемости графика и уже интегрирован в main.
- Следующим техническим этапом назначен B4 — надёжный Live Data Path: аудит фактического main-кода, согласование REST/WS, realtime last price и forming candle, finality/reconciliation, reconnect/fallback, fail-closed quality handling и реальная проверка на iPhone/Safari.
- Утверждён B5 Market Journal. Проектирование схемы может идти параллельно B4; первая версия предполагает локальное хранение и JSON export/import, без backend. Записывать полные snapshots, качество/происхождение данных, доступную на момент снимка структуру, решение LONG/SHORT/WAIT/skip, необязательный план и outcome.
- Журнал должен включать WAIT и пропущенные сценарии, а не только сделки; отличать paper observation от фактической сделки; pending outcome не считать результатом.
- Далее B6 аналитическое ядро, B7 ограниченные 2–3 setup-сценария, B8 статистическая проверка с out-of-sample и учётом издержек, B9 объяснимые решения/риск-контекст.
- Подчёркнуто: исторические/synthetic тесты не доказывают edge или live-connectivity; никакой автоторговли и необоснованного расширения фич.
- Принят архитектурный принцип постепенного разделения data, quality, analytics, journal и UI для возможной будущей миграции без потери проверенной логики.

Детальная спецификация планирования: docs/ROADMAP.md, актуализация от 2026-11-27.


## 2026-11-28 — B4 audit and first finality hardening

- Audited actual `main` HTML blob `6b5521195454bc3d3be3e18cc7f4fb10682ee48b`, 511,597 bytes / 9,514 lines.
- Confirmed current main already integrates Bybit ticker+kline WebSocket callbacks into live price and forming-candle UI, alongside REST bootstrap, 30-second polling, reconciliation and reconnect/recovery. Historical LOG-ONLY / unmerged statements in older handover sections are stale and must not be used as current state.
- Found a closed-candle immutability defect: between WS `confirm:true` and REST reconciliation, ticker and same-timestamp kline updates could still mutate the confirmed candle; chart styling also continued to call it forming.
- Opened draft PR #24, branch `feature/b4-live-data-hardening-2026-11-28`.
- Patched confirmed-candle immutability in ticker and kline upsert paths, exact duplicate handling, closed candle/volume styling, and extended Stage A B1-D regression coverage.
- B4 remains in progress pending exact-head deterministic/browser CI, further source audit, independent review and live iPhone/Safari acceptance. GitHub runner HTTP 403 does not count as a live-provider test.

- Второй найденный race: 30s REST refresh заменял chart candles и повторно применял только ticker price, теряя более свежие WS kline high/low/volume. Добавлен cache последней валидной kline с provider/receive timestamps и connGen; replay выполняется только при подтверждённой подписке и provider event time новее REST snapshot. Добавлен regression для replay и запрета старого WS поверх нового REST.

- Добавлена provider-time ordering защита между независимыми WS ticker и kline topics. Older ticker не заменяет более новую kline; older kline после более нового ticker обновляет cumulative OHLCV, затем сохраняет более новый ticker close. Regression добавлен в Stage A B1-D suite.

- Event ordering: отброшен out-of-order same-candle kline event по provider event time в рамках того же connection generation. Если kline приходит после более свежего ticker, OHLCV кумулятивно обновляется, затем более свежий ticker close применяется поверх. Если ticker приходит после более свежей kline, старый ticker отбрасывается.
- PR head 42f0511679167714e2a35c873ae0fc970502923c: B1 workflow 46102775403 SUCCESS, B2 workflow 46102775296 SUCCESS, browser pageErrors отсутствуют. Live Bybit check skipped due HTTP 403 on GitHub runner. PR #24 remains unmerged pending remaining audit and iPhone/Safari acceptance.


## Exact-head verification checkpoint — 2026-11-28

- Current tested application source blob: `c9711ffdd65c9667bfa7447b92ec05d73e60135f` in commit `01068b47736e9e1d9a206ae919accd8a6cea7255` (PR #24).
- B1 browser/live-data workflow run `46103008965`: SUCCESS. Stage A 50/50, B1 contract 32/32, B1 quality 72/72, B1 MTF 20/20; browser page errors 0.
- B2 application integration workflow run `46103008967`: SUCCESS. B2-A through B2-G and browser/mobile integration all completed successfully.
- Live Bybit REST verification was `SKIPPED_PROVIDER_BLOCKED`: GitHub Actions runner received HTTP 403 from both `api.bybit.com` and `api.bytick.com`. This is not a live Bybit pass and does not prove that the user's iPhone is blocked.
- Current remaining acceptance: real Bybit WebSocket + REST behavior on iPhone/Safari, including live lastPrice, forming-candle OHLCV, closed-candle immutability, REST reconciliation, disconnect/reconnect, stale fallback, BTC/ETH and 1H/4H/1D switching, background/foreground recovery.
- PR #24 remains open and unmerged. Do not merge before owner iPhone/Safari acceptance and exact-source review.


- B4 lifecycle coverage: added Stage A test `16d` for actual `pagehide`/`pageshow` listeners. It verifies old-socket invalidation, clean close state, fresh connection/recovery generations, and that new topics are not marked confirmed until ACK. Code commit: `1783a8e0b8294973366a61d32e75bb40458e338a`. CI for this exact code commit is pending; no real iPhone/Safari acceptance is claimed.

- B4 fail-closed metadata fix: kline messages without a valid provider `msg.ts` are now rejected before entering the chart bridge, because they cannot be ordered against REST or ticker events. Added Stage A regression for missing `msg.ts`. Code commit: `730917fb52a33064b204f425dfd57bd9ab2f0490`. Exact-head CI pending; real Bybit/iPhone acceptance remains outstanding.

- B4 ticker metadata guard: ticker `msg.ts` is now required and validated before any ticker-state mutation or live-price callback. Added Stage A regression proving missing provider time is rejected without changing readiness/state. Code commit: `c5be074817dcee28cb7a7df3e095939150579de7`. Exact-head CI pending.

- Updated valid ticker integration fixtures to include provider `ts` after introducing the fail-closed ticker timestamp contract; the dedicated missing-timestamp regression remains intentionally timestamp-free. Source commit `109048c38bcaaabf18663e3897e87ecfdbe313d4`; exact-head CI pending.

- B4 stale-stream coverage: added deterministic regression for stale ticker/kline rejection and REST price fallback with an explicit WS-stale label. Source commit: `4f5e369b52b4262dbad88d9ba54a3fc6d7378301`. Exact-head B1/B2 CI pending.

- B4 subscription transition coverage: added deterministic integration regression for in-flight ticker/kline messages arriving from the previous timeframe or symbol after same-socket subscription changes. Old topics must be dropped; new ETHUSDT/60 topics must work after ACK. Source commit: `67dfd2f36d46c58e66b5fcb2f233cca61626da69`. Exact-head CI pending.

- B4 recovery-cycle isolation: live ticker/kline events and caches now carry both connection and recovery generations. Freshness, bridge acceptance and same-candle/cross-topic ordering reject caches from a prior recovery cycle, including normal automatic reconnects that retain `connGen`. Added deterministic regression for this case. Code commits: `6e06eb472d9fb750fc9c8a9bacc2575b7768a5bb`, `d916e9a05b38ccb12758225e28f0a03fb82da3fe`. Exact-head CI pending.

- Recovery-generation test fixture corrected to establish a valid ticker snapshot/readiness before testing prior-cycle cache invalidation. Source commit `40a36c90233c5bcd5186f1d0322620f99bd78939`; exact-head CI pending.

- Recovery regression setup now explicitly initializes its ticker entry through `_getTickerEntry` before setting snapshot readiness. Source commit `a822133fc1b58356d39c2814a462314aa70fcb17`; exact-head CI pending.

- Added `recoveryGen` to invalid-kline callbacks as well as valid events, preserving the generation guard while allowing invalid events to trigger REST reconciliation. Source commit `ff3fa83f59883fbe8f32864369dec7e5b697bc95`; exact-head CI pending.

- Updated B1 Playwright live-UI synthetic ticker/kline events to include both current `connGen` and `recoveryGen`, matching the production event contract. The prior browser test failure was a fixture mismatch, not a runtime regression. Test commit `d5979626c38b51cd20decd5ab58cb92b510462c5`; exact-head CI pending.

## B4 exact-head verification checkpoint — 2026-11-28

- PR #24 head: `94513b348a36ed3a91385d56ef52f4df4569326d`.
- Application HTML blob: `fffaa8c6c7448350c6db81bbdf6bee4d3a34504d`.
- B1 browser/live-data CI run `46105030207`: SUCCESS. Stage A 58/58, B1 contract 32/32, B1 quality 72/72, B1 MTF 20/20; browser page errors 0.
- B2 application integration CI run `46105030212`: SUCCESS. B2-A through B2-G and browser/mobile integration passed.
- Live Bybit probe: `SKIPPED_PROVIDER_BLOCKED`; GitHub Actions received HTTP 403 from `api.bybit.com` and `api.bytick.com`. Do not treat this as live-provider verification.
- PR #24 remains open and unmerged. Remaining acceptance: real Bybit REST/WS behavior on iPhone/Safari, including timestamp payloads, forming candle, confirmed candle finality, REST/WS reconciliation, reconnect and prior-recovery cache invalidation, stale REST fallback, BTC/ETH plus 1H/4H/1D switching, and background/foreground recovery. Independent review of exact source also remains required.

- B4 second-pass audit found that invalid kline events did not invalidate the previous WS candle cache. Fixed in fb3152f1a1d778f6f95f246fd1c77a0ef90fbf60; added Stage A regression. Exact-head B1/B2 workflows passed (runs 46109011261 and 46109011273). Live Bybit probe remains provider-blocked by Actions HTTP 403; iPhone/Safari acceptance is pending.


- Extended B4 cache invalidation from malformed kline events to structural continuity failures (gap/conflict/closed candle/unconfirmed predecessor/no base/invalid). Older out-of-order events preserve the latest accepted cache. Source commit 86bf04418a9f270755a86c6e400565f0b6398978; B1 59/59 and B2 integration passed on exact head.

## B5 Market Journal — 2026-11-28

- Added B5 spec and local-first journal UI on branch `feature/b5-market-journal-2026-11-28`.
- Observation capture preserves LONG/SHORT/WAIT, data-quality reasons, B2 snapshot and up to 160 candles with explicit closed/forming status; future candles are excluded.
- Added append-only follow-up records and separate manually entered completed actual trades with entry/exit timestamps, prices, quantity, fees, funding and optional net PnL.
- Added localStorage persistence, schema validation, JSON export/import, merge-by-ID, idempotent duplicates, collision rejection, corrupt-storage read-only handling and write-failure preservation.
- Dedicated B5 browser contract run `46106254098` SUCCESS; B1 `46106254092` SUCCESS; B2 `46106254088` SUCCESS on code head `6eca8e06e1c0d9f0e8b1059113998a9b4d8092da`. Latest head adds explicit corrupt-storage recovery coverage and must retain green exact-head CI. iPhone Safari acceptance remains pending.

### B5 exact-head verification — 2026-11-28

- B5 PR #25 head `8f77ff6427e5c5d8021286d971c6a82bfc7f41b5` is stacked on B4 PR #24 candidate branch.
- B5 browser contract run `46106500180` SUCCESS: immutable observation snapshot, LONG/WAIT/quality-blocked WAIT, no future candle inclusion, follow-up and completed trade linkage, PnL arithmetic, import validation/collision/idempotency, storage write failure, JSON export/file import and corrupt-storage recovery all passed; pageErrors 0.
- B1 run `46106500094` SUCCESS: Stage A 58/58, contract 32/32, quality 72/72, MTF 20/20; GitHub runner Bybit probe blocked by HTTP 403 on both public REST hosts.
- B2 run `46106500087` SUCCESS: B2-A…B2-G and browser/mobile integration passed.
- Remaining: iPhone Safari acceptance and independent review. B5 is still draft; open-position tracking deferred.

## B6 Analytics Core Audit — 2026-11-28

- Added exact source/inline parity test for B2-A..G; all seven production HTML modules match their tested `src/analysis` implementations.
- Pinned B2 historical archive to immutable source commit `9ca04178df06ce649f00779a49e11094fe5b1c70` and made synthetic B1/MTF assumptions explicit in replay output.
- Added 160/400/800/1600 candle lookback sensitivity. At the archive final cutoff, all 24 symbol/timeframe/lookback combinations matched the full-history B2-C state. Longer windows accumulate substantially more zones, so keep production 160-bar limit until zone freshness/relevance exists.
- Audit report: `docs/audits/B6_ANALYTICS_CORE_AUDIT_2026-11-28.md`.
- B2 app/parity run `46107248773` SUCCESS; historical replay run `46107248819` SUCCESS. Historical archive ends 2025-12-05 and does not prove current live-market accuracy or trading edge.

## B7 Explainable Setup Engine — 2026-11-28

- Implemented `src/analysis/b7-explainable-setup-engine.js` and synchronized the exact implementation into `CryptoAnalyst_StageA_S6_updated.html`.
- Added three deterministic setup families: breakout + retest; false breakout + reclaim (direction opposite the failed breakout); trend continuation after correction (structure + protected level + zone interaction + closed-candle rejection).
- Added strict B1/B2 version and snapshot binding, closed-candle/finality checks, B2-C event-to-B2-E lifecycle provenance checks, causal confirmation timestamps, deterministic IDs, duplicate suppression, immutable evidence output, and explicit unavailable candle/volume features.
- Added separate B7 panel. B7 does not modify BasicAnalyticsEngine LONG/SHORT/WAIT, does not use B2-F as a hard gate, and does not produce probabilities, leverage, entry/SL/TP or orders.
- Added 22 deterministic B7 tests and expanded source/inline parity. Browser integration checks B7 admission/panel and mobile layout. CI run `46115303655` SUCCESS: B2-A..G + B7 parity, 22 B7 tests, B2 regression suite, pinned historical replay, browser/mobile integration, pageErrors 0. Synthetic browser fixture returned B7 VALID / 0 candidates, which is an expected neutral result, not a setup-generation positive test.
- Historical replay passed on pinned archive commit `9ca04178df06ce649f00779a49e11094fe5b1c70`: 30 production-equivalent 160-bar windows and 18 cutoff replays across BTC/ETH 1H/4H/1D; all candidates and confirmations were causal at cutoff and repeated prefix outputs deterministic. Remaining: independent review and iPhone Safari owner acceptance. B7 is not a validated trading strategy.


## B7 pinned historical replay — 2026-11-28

- Added B7 to the pinned B2 historical replay workflow. Each of six BTC/ETH timeframe series was checked across five 160-candle rolling windows and three historical prefix cutoffs.
- CI `46115303655` SUCCESS. 30 rolling windows produced 40 research candidates (36 confirmed, 4 pending): 20 breakout+retest and 20 false-breakout+reclaim. No trend-continuation candidate occurred in this sample; this is not evidence that the scenario is profitable or invalid.
- All 18 prefix runs passed deterministic repeatability and candidate/confirmation cutoff checks. B2 prefix invariance, B2 regression suite, 22 B7 unit tests, source/inline parity, browser/mobile integration all passed.
- Detailed report: `docs/audits/B7_HISTORICAL_REPLAY_2026-11-28.md`. Historical wrapper/finality limitations remain; no fees, slippage, trade outcomes or expectancy are measured.


## Owner acceptance and UI scope decision — 2026-11-28

The owner tested the B7 application branch on the target device and confirmed that the application works and the new B7 panel provides detailed explanations. This is functional owner acceptance of the current B7 presentation, not a final UX/UI sign-off.

Usability, wording refinement, menu structure, navigation model and visual redesign are explicitly deferred. They will be handled together in a dedicated UX/UI design stage, when the menu and overall interaction model can be redesigned coherently. Do not spend current analytics-engineering time polishing or restructuring the existing menu/panel UI, and do not treat the current layout as the final product design.

Current development priority remains analytical functionality, correctness, validation and evidence quality. Keep the interface changes minimal where needed to expose and test analytical capabilities. Revisit UX/UI as a consolidated later stage.


## B8 opening — schema audit and first evaluator implementation — 2026-11-28

Branch: `feature/b8-statistical-validation-2026-11-28` (draft; based on B7 head `46820a743fc1c08eb34b6c1851315d8b57ef8e1d`).

- Audited B5 journal specification and actual capture implementation. Confirmed B5 stores the B7 result at `analysisSnapshot.b2.setups`, and the B7 candidate list at `analysisSnapshot.b2.setups.setup_candidates`.
- Confirmed B5 candle window uses `ts`, `closeTs`, OHLCV, and explicit `finality`; B8 must exclude `forming` candles.
- Added B8 methodology specification and opening schema audit.
- Added pure causal outcome evaluator: post-availability closed-candle entry proxy, directional forward return, MFE/MAE, optional invalidation/target barriers, conservative stop-first same-bar ambiguity and adverse gap-stop proxy.
- Added descriptive statistics with Wilson proportion intervals explicitly labelled as naive-independence intervals.
- Added deterministic tests and a dedicated GitHub Actions workflow.
- No production HTML, B1/B2/B7 engine, live decision path or UI was changed.

Current limitations: historical candidate census/deduplication and chronological out-of-sample report are not implemented yet; prospective B5 validation requires explicit JSON export; funding is not applied; current historical archive ends 2025-12-05. This work does not establish profitability.


### B8-B deterministic evaluator and journal adapter checkpoint — 2026-11-28

- PR #28 opened as draft, stacked on B7 branch.
- CI run `46116869096`: evaluator/statistics syntax and deterministic tests SUCCESS.
- CI run `46116871532`: evaluator + B5 journal adapter syntax and deterministic tests SUCCESS.
- Corrected test fixtures after CI exposed two mistakes: the forward-return fixture expected the wrong candle close, and barrier fixtures initially placed touches inside the entry candle. The evaluator's causal entry rule was retained; test data was moved to candles after entry.
- Cost arithmetic now charges entry costs on entry notional and exit costs on exit notional.
- B5 importer validates journal envelope/reference structure, preserves WAIT and no-setup coverage, filters candidates against both capturedAt and B7 analysis cutoff, excludes forming candles, keeps actual trades separate, and deep-clones/freezes its normalized output.
- Historical candidate census, deduplication, chronological OOS, cluster-aware uncertainty and prospective journal outcome study are still NOT IMPLEMENTED.


### B8-C first historical outcome exploration — 2026-11-28

- Added stable `setup_id` to compact B7 historical replay output.
- Added deterministic candidate deduplication by symbol/timeframe/setup ID and explicit pending-to-confirmed lifecycle reconciliation.
- Added chronological 60/20/20 TRAIN/VALIDATION/TEST assignment per historical series.
- Added `tools/b8_historical_validation.cjs` and artifact generation in the B8 workflow.
- Exact CI run `46117156657` on code head `cf16dd38e9b8cc7fb7f923d7999add2c4a46b0e5`: SUCCESS. B7 pinned replay, B8 deterministic tests, historical outcome generation and artifact upload all passed.
- Result: 40 unique sampled candidates, 36 confirmed, 4 pending. All 36 confirmed candidates received a causal entry proxy. Split counts: TRAIN 22, VALIDATION 8, TEST 6.
- The TEST cohort is too small to support inference. Its descriptive returns are negative, but no conclusion about setup quality is justified. No fees/funding/slippage are observed or applied. The five-window candidate population is not exhaustive.
- Detailed audit: `docs/audits/B8_HISTORICAL_OUTCOME_EXPLORATION_2026-11-28.md`.

B8-C exploratory pipeline passed; B8-C statistical validation is still incomplete. B8-D prospective journal outcomes and B8-E independent audit remain open.


## B9 Automatic Market Journal Capture — 2026-11-28

- Opened isolated candidate branch `feature/b9-automatic-market-journal-2026-11-28` on top of B8. No merge to main.
- Added deterministic observation capture keys and duplicate suppression shared by automatic and manual capture.
- Added automatic capture after a current, non-superseded REST analysis cycle completes and renders successfully. Stale-cache/error/aborted paths are excluded.
- Captures LONG/SHORT/WAIT and retains B1 quality state plus B2/B7 result, including zero-candidate/no-setup outcomes. Invalid quality is retained as WAIT with reasons.
- Preserved local-only storage, manual trade/follow-up workflows, and JSON envelope version. Background operation while the page is closed remains explicitly deferred.
- Extended the Playwright journal contract to test AUTO capture, repeated-snapshot idempotency, WAIT/no-setup, and invalid-quality capture. CI status is pending at this documentation checkpoint; do not claim tests passed until exact-head runs are read.
- iPhone Safari acceptance remains required before merge.
- Specification: `docs/specs/B9_AUTOMATIC_MARKET_JOURNAL_SPEC_2026-11-28.md`.


### B9 exact-head verification checkpoint — 2026-11-28

Candidate head: `42d4e6b64cf1622d1937d03af67113dead19b34d`.

- B5 Market Journal browser contract run `46122848453`: SUCCESS. AUTO capture, duplicate suppression, WAIT capture, invalid-quality WAIT capture, existing manual/follow-up/trade workflows, JSON export/import, storage corruption recovery and zero page errors passed.
- B2 application integration run `46122848390`: SUCCESS. B2-A..G regression and browser/mobile integration passed; B7 panel was VALID with zero candidates in the deterministic fixture, which is a valid no-setup result.
- B7 setup engine run `46122848466`: SUCCESS. B1/B2/B7 source parity, deterministic B7 tests, B2 regression and pinned historical replay passed.
- B1 browser/live-data run `46122848461`: SUCCESS. Browser/self-test and data-quality checks passed with zero page errors. Live Bybit probe was explicitly skipped because GitHub Actions received HTTP 403 from both public REST hosts; this is not a live-provider success claim.
- B8 statistical workflow run `46122848380`: still in progress at this checkpoint; syntax and deterministic evaluator tests passed, pinned replay generation remained active.
- No merge performed. Owner iPhone Safari acceptance remains mandatory.


## B10 Supabase Cloud Journal Sync — 2026-11-28

- Opened dependent branch `feature/b10-supabase-journal-sync-2026-11-28` from the current B9 candidate head; no changes to `main`.
- Audited the live Supabase project: project is ACTIVE_HEALTHY; the three journal tables exist with RLS enabled; authenticated-only grants and owner-scoped policies are present; record tables are empty; Security Advisor returned no lints.
- Confirmed a modern Supabase publishable key exists. No secret/service-role key is needed or permitted in the browser app.
- Defined B10 architecture in `docs/specs/B10_SUPABASE_CLOUD_JOURNAL_SYNC_SPEC_2026-11-28.md`.
- Authentication is a separate app-level Supabase Auth session. The owner's preferred GitHub OAuth sign-in requires a configured GitHub OAuth App in Supabase Auth Providers; the repository's GitHub App connection is not proof this is configured.
- Critical storage constraint: B9's localStorage envelope is capped at 3.8 MB and the owner already encountered iPhone quota errors. Full cloud history must not be blindly loaded into localStorage. B10 requires an offline outbox, bounded cache and full-cloud export before any local cleanup.
- Owner must export the current iPhone JSON journal before first migration. Existing browser-local records are not visible to GitHub CI or the Supabase connector.
- B10 implementation and live sync have NOT started. No rows were written to Supabase. B9 remains unmerged and still requires owner iPhone Safari acceptance.


## B10-A — GitHub OAuth client bootstrap (2026-11-28)

**Status:** implementation committed to the B10 candidate branch; static checks passed; live OAuth not yet accepted.

- Branch: `feature/b10-supabase-journal-sync-2026-11-28`.
- Commit: `683529dc10a2495bf2b310d2fe464f3cc7e3a4bd`.
- Updated file: `CryptoAnalyst_StageA_S6_updated.html`.
- Added a minimal GitHub sign-in/sign-out panel to the B9 journal UI.
- Added pinned Supabase JS UMD CDN dependency `@supabase/supabase-js@2.119.2`.
- Initialized Supabase Auth with PKCE, persisted session, auto refresh and URL callback detection.
- Embedded only the modern publishable key. No service-role/secret key is present.
- OAuth redirect target is the exact current HTTPS app URL; non-HTTPS origins cannot initiate sign-in.
- Auth state is displayed separately from the journal status. The UI explicitly says cloud journal sync is not connected yet.
- No database writes, device registration, journal push/pull, localStorage migration or local journal cleanup were added.

**Verification:** GitHub read-back returned blob `296e21794fbf0697bf0f06ec944bb59f583a1d0e`; all 3 inline script blocks passed V8 syntax parsing; auth UI/CDN/OAuth call presence confirmed; no service-role/secret key markers or journal table write calls found. No Actions run was returned. Browser/iPhone OAuth, callback restoration and actual provider credentials remain unverified.

**Deployment distinction:** GitHub Pages currently serves the `main` file, which was independently checked and contains neither the B9 journal nor Supabase Auth. B9 PR #29 and B10 PR #30 remain draft; no merge or production deployment was performed.
