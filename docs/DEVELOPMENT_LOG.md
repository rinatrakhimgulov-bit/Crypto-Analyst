
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


## 14. B1-A/B/C/D — canonical data contract, validator and quality gate

**Дата:** 2026-11-26. Ветка: `impl/b1-quality-contract-2026-11-26`. Draft PR #6; в `main` не влито.

### Реализовано в candidate branch

- Добавлен `DataQualityEngine` с canonical contract v1.0.0: Candle mapping, Snapshot, QualityReport, preflight.
- Bybit adapter теперь сохраняет `providerTimeMs` и `timeSource`; local Date.now fallback явно помечается как `LOCAL_FALLBACK`.
- Duplicate rows классифицируются как identical или conflicting; конфликтующая строка не перезаписывает предыдущую молча.
- Добавлен expected closed-candle coverage для запрошенного окна.
- Validator проверяет OHLCV finite values/invariants, volume, UTC alignment, порядок, gaps, future timestamps, freshness, достаточность истории и coverage.
- Future open timestamp более чем на 2 секунды впереди provider time отклоняется.
- `BasicAnalyticsEngine.analyze()` запускает quality preflight; только VALID допускает обычный анализ. DEGRADED/INVALID/STALE/INSUFFICIENT дают WAIT с причинами.
- `renderError()` больше не показывает cached LONG/SHORT как текущий вывод: stale decision переводится в WAIT, график сохраняется как справочный контекст.
- Панель качества показывает статус B1 Quality Gate.

### Проверки

- `B1QualitySelfTest.runAll()`: 35/35 PASS в изолированном JS execution.
- Два script blocks: syntax parse PASS.
- Отдельный integration probe для DEGRADED dataset: WAIT, directionalAllowed=false.
- Не запускались live Bybit, настоящий Chrome/iPhone Safari и полный StageASelfTest 44/44 в browser runtime.

### Оставшиеся части B1

- B1-E: общий analysis cutoff и сборка синхронизированного 1D/4H/1H snapshot.
- B1-F: сравнение второго provider.
- Независимый review и browser/runtime verification до merge.

B1 остаётся IN PROGRESS. Draft PR #6: https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/6.


## 15. B1 quality-hardening after independent audit — 2026-11-26

В candidate branch PR #6 внесены локальные исправления по трём подтверждённым дефектам:
1. Убрано молчаливое преобразование adapter counters через `Number(value || 0)`. Все восемь полей обязательны; проверяются тип, целочисленность, конечность и неотрицательность.
2. Добавлена повторная проверка закрытости каждой свечи: `closeTimeMs + 500ms <= providerTimeMs`. Незакрытая свеча в массиве closed candles блокирует направленный анализ.
3. Coverage metadata теперь валидируется структурно и математически: обязательные integer start/end/count, UTC alignment и согласованное число свечей в диапазоне. Missing/malformed/inconsistent coverage — CRITICAL.

### Regression verification
- B1QualitySelfTest: 46/46 PASS в isolated JavaScript execution.
- Оба inline script blocks прошли syntax parsing.
- 4/4 direct integration probes: malformed counter, negative counter, unclosed candle, missing coverage — все дали decision WAIT, status INVALID, directionalAllowed=false.
- Не выполнены: live Bybit, реальный браузер Chrome/iPhone Safari, полный StageASelfTest 44/44 в браузерном harness.
- Повторный независимый Grok review ещё не получен.

PR #6 остаётся draft и не слит в main. B1 остаётся IN PROGRESS; B1-E common MTF cutoff и B1-F второй provider ещё не реализованы.


## 16. B1 strict-consistency follow-up — 2026-11-26

Additional audit hardening in PR #6:
- Aggregate duplicate count is checked against identical + conflicting duplicate counts.
- Provider analysis time must agree with provider timestamp within the configured skew tolerance.
- Closed-candle finality is checked against the earlier of analysis and provider cutoffs, with the 500 ms buffer.
- Regression suite now contains 54 tests, all 49 PASS in isolated JS execution. Both inline scripts parse; 4/4 direct quality-gate probes block malformed datasets with WAIT/INVALID.

Real browser, live Bybit and full StageASelfTest 44/44 remain untested. Independent Grok re-audit pending. PR #6 remains draft and unmerged.


### Final B1 candidate verification refresh — 2026-11-26

Latest HTML blob: `6810d7366e834b35306c8cfbb58751f0189a1b46`. B1 quality suite: 54/54 PASS; both inline scripts syntax-parse. Synthetic adapter integration: `BybitAdapter.normalize()` → `DataQualityEngine.preflight()` produced 60 closed candles + 1 forming candle with VALID quality. Four direct BasicAnalyticsEngine gate probes returned WAIT / INVALID / directionalAllowed=false for malformed counters, negative counters, unclosed candle and missing coverage. This is isolated fixture testing, not live Bybit or browser runtime. StageASelfTest 44/44 and independent Grok re-audit remain pending.


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

## 17. Независимый аудит B1-A/B — 2026-11-26

Grok проверил полный candidate HTML blob `e92c44d1397a8499a5a5adac7c12294923e3f494` и подтвердил его SHA. Самостоятельно исполнил `B1QualitySelfTest.runAll()`: **65/65 PASS**. Вердикт: **APPROVE**, новых CRITICAL/HIGH дефектов нет.

LOW-наблюдения: F1 boundary tests проверяют status и directionalAllowed, но не конкретный reason code; forming candle остаётся вне Quality Gate, что честно зафиксировано characterization tests; stale recovery не включает реальный UI/renderError путь. Эти пункты не блокируют unit/static approval.

Ограничения остаются: полный browser `StageASelfTest` 44/44, Chrome/iPhone Safari, live Bybit request и UI stale-badge не проверялись. PR #6 остаётся draft и unmerged; main не изменён; B1 не завершён.

## B1-E source audit and specification — 2026-11-26

Inspected the current `BybitAdapter.normalize()`, `DataQualityEngine.createSnapshot()/validate()`, `BasicAnalyticsEngine.analyze()` and `loadAndAnalyze()` flow. Confirmed one-timeframe-at-a-time fetch/analysis and no shared 1D/4H/1H assembly. Identified that the current per-response closed/forming partition and provider-time consistency check make a naive common-cutoff override unsafe.

Added `docs/specs/B1_E_MTF_COMMON_CUTOFF_SPEC.md`: target MTF orchestration, common-cutoff selection, reclassification of candles, coverage recalculation, aggregate quality rules, cache/concurrency safety and 23 deterministic acceptance tests. The live provider-time spread limit is intentionally not guessed; it must be calibrated from live measurements.

No application code changed. B1-E remains specification-only / NOT IMPLEMENTED.

## B1-E MTF implementation candidate — 2026-11-26

Added an isolated `MTFDataEngine` to the PR #6 candidate HTML. The module supports coordinated concurrent 1D/4H/1H fetching, minimum trusted provider-time common cutoff, closed/forming reclassification, per-TF coverage recalculation, per-TF validation, aggregate quality, request supersession and sibling cancellation on failure. Existing selected-timeframe chart and analysis flow are not connected to this module.

Added an explicit `providerTimeToleranceMs` validator override, defaulting to null (therefore existing single-timeframe validation continues to use the original 2-second skew limit). MTF passes its explicit measured spread policy; no production policy value has been selected pending live timing measurements.

Tests on latest candidate blob: B1-E **23/23 PASS**, existing B1 quality suite **65/65 PASS**, both inline script blocks syntax-parse. Isolated V8 execution used test doubles for browser AbortController/DOMException/timer globals. No live HTTP, browser UI, mobile Safari or full StageASelfTest browser run. Candidate only; not merged.

B1-E audit refinement: a candle whose open time is later than the common cutoff is now excluded from the as-of snapshot and counted in `excludedAfterCutoffCount`; its mere presence no longer invalidates a coherent snapshot. This handles ordinary response-time differences across an interval boundary. B1-E remains 23/23 PASS and B1 remains 65/65 PASS after this correction.


## 16. B1-E common-cutoff coverage correction and adapter integration fixtures — 2026-11-26

**Branch:** `impl/b1-quality-contract-2026-11-26` (draft PR #6)  
**Latest HTML blob:** `d9bb093001299ef8a835fc01dcaa6fb87e0425cd`  
**Latest branch commit after spec update:** `4e7668f098427acbd033a0bb9acc41a9714353b6`

### Problem addressed

Independent review identified that retaining each response's original `expectedClosedStartMs` while moving only the end to the common cutoff could create a hybrid coverage window. At an interval boundary, a later response can spend one of its raw Bybit rows on a candle opened after the common cutoff. Simply excluding that candle then leaves too few rows for the common-cutoff target history.

### Implementation changes

1. Split MTF `desiredClosedCount` from provider `rawLimit`.
2. Calculate per-timeframe raw request limit as desired closed count + ceiling of permitted provider-time spread divided by timeframe duration + one forming-row allowance.
3. Reject raw limits above Bybit V5's documented maximum of 1000.
4. Recalculate expected end and start from the common cutoff and explicit desired closed count.
5. Keep exactly the newest target number of eligible closed candles; do not hide short responses by trimming missing data.
6. Preserve adapter quality findings and report missing leading/count coverage when a response is short.
7. Do not publish a forming candle when multiple forming candidates make the partition ambiguous.
8. Add stable per-timeframe diagnostic objects for missing/invalid assembly paths.
9. Add actual adapter integration fixtures: V5-shaped newest-first raw rows -> production `BybitAdapter.normalize()` -> `MTFDataEngine.assemble()`, covering 1H, 4H and 1D boundary rollovers and short response behavior.
10. Update `docs/specs/B1_E_MTF_COMMON_CUTOFF_SPEC.md` with explicit raw-row and closed-history semantics.

### Verification

- `B1EMtfSelfTest.runAll()`: **31/31 PASS**.
- `B1QualitySelfTest.runAll()`: **65/65 PASS**.
- Both inline JavaScript blocks: syntax parse PASS.
- Tests ran in isolated V8 against the extracted production implementations. Concurrency tests used controlled test doubles; this is not a browser or live-network test.

### Limitations / acceptance status

- No live Bybit HTTP request or provider-time spread calibration.
- No browser DOM/UI, Chrome/iPhone Safari, full `StageASelfTest` 44/44, or actual HTTP abort verification.
- MTFDataEngine remains isolated and is not connected to UI or directional decision logic.
- PR #6 remains draft and unmerged. `main` unchanged. B1 remains IN PROGRESS; no production readiness claim.


### Follow-up: post-boundary pending-finality classification — 2026-11-26

A further edge case was found during review of the 500 ms finality buffer. Immediately after an interval boundary, the prior candle may have a close time at or before the common cutoff but still be inside the finality buffer, while the new interval candle is actively forming. Treating both as forming would incorrectly label this ordinary short transition as ambiguous.

Correction:
- Active forming now requires closeTimeMs > analysisAsOfMs.
- Pending finality is tracked separately when closeTimeMs <= analysisAsOfMs and closeTimeMs + 500 > analysisAsOfMs.
- Only multiple active forming candidates block as ambiguous; no arbitrary forming candle is published in that case.
- Raw-row reserve increased to desired closed count + ceil(maxProviderTimeSpreadMs / stepMs) + 2.
- Added test 32 for the normal post-boundary state.

Latest suites: B1-E 32/32 PASS, B1 Quality 65/65 PASS; both inline scripts parse. Browser/live checks remain pending.


### Final B1-E immutability update — 2026-11-26

The assembled MTF result and failure results are now deeply frozen, including nested per-timeframe diagnostics, canonical candle arrays, candle objects and quality reports. The provider-time-spread failure path was adjusted to preserve the immutable result contract.

Latest HTML blob: 842c361a8386c358a68f22407814c376fd3bde1b. Final isolated V8 verification: B1-E 33/33 PASS; B1 Quality 65/65 PASS; both inline JavaScript blocks parse. This remains a candidate only: no live Bybit, browser/UI, Chrome/iPhone Safari or full StageASelfTest verification. MTFDataEngine is not connected to the UI/decision pipeline. PR #6 remains draft and unmerged; main unchanged.


### Independent B1-A/B/E audit — 2026-11-27

- Exact candidate audited: HTML blob `842c361a8386c358a68f22407814c376fd3bde1b`; spec blob `0481400d46be50ff353b73783c769e220ca60bda`.
- External verdict: **APPROVE WITH CONDITIONS**.
- Independent execution: B1-E 33/33 PASS; B1 Quality 65/65 PASS; V5-shaped normalize→assemble probes, boundary/short-response/multiple-forming/deep-freeze probes passed.
- No CRITICAL defect found for current isolated MTF API.
- Confirmed source-level AbortSignal path reaches `fetch(url, { signal: controller.signal })`; transport-level cancellation still needs a test.
- Outstanding: live/recorded Bybit 1D/4H/1H integration, measured spread policy, browser regression, full Stage A self-test. Forming-candle validation/invariant is required before directional integration, not for current isolated library stage.
- PR #6 remains draft/unmerged. MTF is not connected to directional decisions. Directional MTF remains blocked pending live validation and policy.
- Full report: `docs/audits/B1_A_B_E_INDEPENDENT_AUDIT_2026-11-27.md`.


### B1 live capture probe hardening — 2026-11-27

- Added per-host 15-second request timeout with recorded timeout and backup-host fallback.
- Stop now cancels active fetches and wakes the inter-sample delay immediately.
- Separated response-header timestamp from full response-body receipt; records header latency and total duration.
- Corrected request-start measurement to be per host attempt, so fallback does not contaminate successful-host latency.
- Capture schema advanced to v2.
- Source review completed; real browser/network execution is still pending.
