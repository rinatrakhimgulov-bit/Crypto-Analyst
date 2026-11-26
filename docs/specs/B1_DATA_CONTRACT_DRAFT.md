# B1 Draft — Provider-neutral Data Contract & Quality Gate

**Дата:** 2026-11-26  
**Статус:** проект спецификации для review; не реализация.  
**Связанные документы:** ROADMAP.md, B0_AUDIT_2026-11-26.md, B1_DATA_LAYER_CANDIDATES_2026-11-26.md.

## 1. Цель B1

Создать единый слой рыночных данных, независимый от конкретной биржи или API-библиотеки. Аналитические модули должны получать одинаковый контракт независимо от того, пришли свечи из Bybit, Binance, OKX, CCXT или другого источника.

B1 также должен закрыть два подтверждённых дефекта Stage A:
- D0-01: INVALID quality сейчас не блокирует LONG/SHORT.
- D0-02: stale-cache path повторно отображает старый directional decision после ошибки обновления.

B1 не выбирает стратегию и не меняет правила анализа структуры рынка. Его задача — гарантировать, что аналитика получает корректный, синхронизированный и объяснимый набор данных.

## 2. Архитектурная граница

Предлагаемый pipeline:

Provider Adapter → Raw Provider Rows → Normalizer → Canonical Candles → Validator → Snapshot Assembler → Quality Gate → Analytics.

Обязанности разделяются:
- **Provider Adapter:** API, пагинация, лимиты, retry, timezone и provider-specific ошибки.
- **Normalizer:** символы, временные метки, единицы объёма и поля источника приводятся к единому контракту.
- **Validator:** проверяет корректность, полноту, последовательность, свежесть и временную сетку.
- **Snapshot Assembler:** собирает таймфреймы на едином cutoff.
- **Quality Gate:** решает, какие аналитические выводы разрешены.
- **Analytics:** не знает, какой биржевой API использовался.

Не требуется принимать CCXT или rinng целиком. Они остаются источниками готовых идей и компонентов.

## 3. Canonical Candle

Все временные метки хранятся как UTC Unix milliseconds. Для внутреннего контракта close_time_ms означает исключительную правую границу свечи: интервал [open_time_ms, close_time_ms).

| Поле | Тип | Правило |
|---|---|---|
| provider_id | string | Идентификатор адаптера/поставщика |
| venue | string | Торговая площадка, если применимо |
| market_type | enum/string | spot, linear_perpetual, inverse_perpetual и др. |
| canonical_symbol | string | Внутренний нормализованный инструмент |
| provider_symbol | string | Символ, который использует источник |
| timeframe | string | Например 1h, 4h, 1d |
| open_time_ms | integer | UTC начало свечи |
| close_time_ms | integer | UTC исключительная граница свечи |
| open/high/low/close | finite number | Положительные цены; OHLC consistency обязательна |
| volume_base | finite number or null | Объём в базовом активе |
| volume_quote | finite number or null | Объём в котируемом активе |
| trade_count | integer or null | Количество сделок, если доступно |
| taker_buy_volume_base | finite number or null | Если источник предоставляет и единицы подтверждены |
| closed_state | enum | CONFIRMED, TIME_DERIVED, OPEN, UNKNOWN |
| provider_event_time_ms | integer or null | Время события/снимка со стороны источника |
| received_at_ms | integer | Время получения данных приложением |
| source_reference | string/object or null | Ссылка на raw batch/идентификатор исходной записи |
| normalizer_version | string | Версия преобразования |

### Правила единиц

1. volume_base и volume_quote не взаимозаменяемы.
2. Объём в контрактах нельзя выдавать за базовый объём без instrument contract metadata и явного преобразования.
3. Если единица объёма неизвестна, поле остаётся null/unknown, а не угадывается.
4. Нельзя сравнивать объём между источниками до нормализации единиц.
5. Если источник не сообщает close confirmation, closed_state может быть TIME_DERIVED только при наличии надёжного provider/server time и явной политики задержки.

## 4. Canonical Snapshot

Snapshot относится к одному canonical_symbol и одному market_type, но может содержать несколько таймфреймов.

Обязательные поля:
- snapshot_id;
- canonical_symbol, market_type;
- analysis_as_of_ms — общий временной cutoff;
- provider metadata и список использованных источников;
- provider_server_time_ms (если доступен);
- received_at_ms;
- candles_by_timeframe;
- forming_candle_by_timeframe (отдельно, не смешивается с закрытыми);
- quality_by_timeframe;
- aggregate_quality;
- normalizer_version и contract_version.

### Единый cutoff для MTF

1. Snapshot получает один analysis_as_of_ms.
2. В закрытый набор TF попадают только свечи с close_time_ms <= analysis_as_of_ms и допустимым closed_state.
3. Формирующаяся свеча хранится отдельно и не участвует в закрытом историческом расчёте.
4. 1D, 4H и 1H должны отражать один и тот же момент анализа, даже если последние закрытые свечи имеют разные close_time.
5. Ни один TF не может включать данные позже analysis_as_of_ms.
6. Локальные часы устройства не являются единственным источником истины для определения закрытости.

## 5. Data Quality Report

Для каждого timeframe Validator формирует отчёт:

- status;
- reasons[];
- expected_count, received_count, valid_count;
- missing_count и gap ranges;
- duplicate_count;
- out_of_order_count;
- invalid_ohlc_count;
- non_finite_count;
- negative_volume_count;
- misaligned_timestamp_count;
- future_timestamp_count;
- stale_age_ms;
- first_open_time_ms, last_open_time_ms;
- expected_start_ms, expected_end_ms;
- provider_time_skew_ms;
- insufficient_history flag.

Каждая причина должна иметь machine-readable code, severity, timeframe и при необходимости timestamp свечи.

### Статусы

| Статус | Значение | Допуск |
|---|---|---|
| VALID | Все критические проверки пройдены | Аналитика разрешена |
| DEGRADED | Есть некритические проблемы или неполные optional fields | Разрешены только модули, которые явно поддерживают эти ограничения; directional output по умолчанию блокируется до явного правила |
| INVALID | Повреждённые/противоречивые данные или критическая неполнота | Только WAIT |
| STALE | Snapshot старше установленного для TF/provider порога | Только WAIT |
| INSUFFICIENT | Недостаточно истории для требуемых вычислений | Только WAIT для сценариев, требующих недостающей истории |

Точные freshness thresholds и severity rules утверждаются в implementation spec после проверки поведения источников. Не задавать один фиксированный порог для всех таймфреймов и провайдеров.

## 6. Обязательные validation rules

### OHLCV
- Все обязательные числовые поля конечные (не NaN/Infinity).
- open/high/low/close > 0.
- high >= max(open, close).
- low <= min(open, close).
- high >= low.
- volume неотрицателен, если известен.
- Временные метки соответствуют ожидаемой сетке timeframe.
- close_time_ms > open_time_ms и длительность соответствует timeframe.

### Последовательность
- Ряд отсортирован по open_time_ms.
- Дубликаты определяются по ключу provider/market/symbol/timeframe/open_time.
- Идентичные дубликаты можно детерминированно схлопнуть с сохранением счётчика.
- Конфликтующие дубликаты не перезаписываются молча: сохраняется конфликт и выставляется DEGRADED/INVALID согласно severity policy.
- Пропуски рассчитываются по ожидаемой сетке, а не только по количеству полученных строк.
- Future timestamps помещаются в quarantine и не участвуют в анализе.
- Недостающие свечи не создаются искусственно и не заполняются forward-fill для OHLC.

### Closed / forming
- Приоритет имеет явный confirmation flag источника, если его семантика проверена.
- Иначе закрытость вычисляется по provider/server time и close_time_ms с настроенным safety lag.
- При отсутствии надёжного времени состояние UNKNOWN, directional output блокируется.
- Forming candle не смешивается с closedCandles.

### Resampling
- Для агрегирования lower TF в higher TF заранее вычисляется ожидаемое количество компонентных свечей.
- Higher-TF candle получает CONFIRMED/CLOSED только если все ожидаемые интервалы присутствуют, валидны и закрыты.
- Любой внутренний gap делает агрегат неполным.
- UTC границы 1h/4h/1d/1w должны быть детерминированы и покрыты тестами.
- Прямые exchange candles и resampled candles должны хранить provenance и могут сравниваться, но не смешиваться без политики.

## 7. Quality Gate и stale-cache policy

1. Analytics получает Snapshot вместе с QualityReport, не отдельный массив свечей без контекста качества.
2. INVALID / STALE / INSUFFICIENT запрещают LONG/SHORT и возвращают WAIT с конкретными reason codes.
3. DEGRADED по умолчанию также не разрешает directional output, пока не утверждены явные исключения для конкретных дефектов/модулей.
4. Ошибка обновления при наличии cache не должна показывать старый LONG/SHORT как текущий сигнал.
5. UI может показывать старый snapshot как историческую справку, но decision state обязан быть STALE/WAIT; старый directional decision должен быть визуально и логически отделён от актуального.
6. Восстановление связи не снимает stale state, пока не получен и не прошёл validation новый snapshot.
7. Все причины WAIT должны быть объяснимыми и доступны UI.

## 8. Provider Adapter contract

Минимальные операции:
- get_server_time();
- get_market_metadata(symbol);
- fetch_ohlcv(symbol, timeframe, start_ms, end_ms, cursor/limit);
- optional fetch_ticker(symbol).

Adapter должен:
- документировать pagination order, inclusive/exclusive boundaries и максимальный limit;
- обрабатывать rate limits/retries без дублирования страниц;
- возвращать provider metadata и original raw reference;
- явно описывать volume units;
- не считать успешный HTTP status доказательством успешного API ответа (некоторые API кодируют ошибки в body);
- быть заменяемым без изменений аналитических модулей.

## 9. Test matrix / acceptance

Обязательные deterministic fixtures:
1. Полный корректный ряд.
2. Пропущена первая свеча.
3. Пропущена внутренняя свеча.
4. Пропущена последняя свеча.
5. Идентичный дубликат.
6. Конфликтующий дубликат.
7. Out-of-order candles.
8. Неверный OHLC: high ниже close/open.
9. Неверный OHLC: low выше close/open.
10. NaN / Infinity / отрицательный объём.
11. Неверная UTC сетка.
12. Future timestamp.
13. Stale snapshot.
14. Insufficient history.
15. Forming candle и закрытая свеча рядом.
16. Источник сообщает close confirmation.
17. Источник не сообщает close confirmation; time-derived policy.
18. Resampled higher-TF window полностью заполнен.
19. Resampled window с одним внутренним пропуском.
20. Разные источники с разными volume units.
21. Разные страницы пагинации с overlap.
22. 1D/4H/1H на одном analysis_as_of_ms.
23. Invalid/STALE dataset не может вернуть LONG/SHORT.
24. Stale-cache fallback не может показать старый directional output как актуальный.
25. Новый валидный snapshot снимает stale state только после validation.

Для каждого теста фиксируются входные fixtures, ожидаемый status, reasons и разрешённость directional output.

## 10. Интеграционный план после принятия контракта

1. Сохранить текущий BybitAdapter как первый provider adapter, не меняя его поведение без тестов.
2. Вынести нормализацию и quality validation в независимый слой.
3. Добавить fixtures и tests до изменения UI.
4. Встроить Quality Gate перед BasicAnalyticsEngine.
5. Исправить stale-cache decision policy.
6. Добавить provider-neutral snapshot assembly и синхронизацию 1D/4H/1H.
7. Сравнить второй источник (CCXT adapter или отдельный adapter) на одинаковом историческом интервале.
8. После проверки обновить UI, чтобы показывать provider, data freshness, quality state и причины WAIT.

## 11. Открытые решения

- Выбрать runtime для data layer: сохранить JS/TS на первом шаге или позже вынести ingestion в Python backend. Решение не принимается до сравнения стоимости интеграции.
- Выбрать источник/библиотеку для второго adapter: CCXT или отдельная реализация. Решение после fixture comparison.
- Утвердить точные freshness thresholds и safety lag для каждого timeframe/provider.
- Утвердить severity mapping для каждого типа дефекта.
- Решить, нужна ли 1m canonical base для resampling или достаточно нативных 1H/4H/1D с cross-check.

**Текущий статус:** draft specification. Не считать B1 реализованным; не менять основной HTML до принятия контракта и тестовой матрицы.
