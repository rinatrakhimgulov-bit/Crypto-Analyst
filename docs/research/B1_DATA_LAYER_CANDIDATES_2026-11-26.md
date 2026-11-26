# B1 Research — provider-neutral market data layer candidates

**Дата:** 2026-11-26  
**Статус:** предварительное исследование исходников; интеграции нет.  
**Задача:** найти готовые компоненты для единого контракта данных, адаптеров источников, нормализации, исторической загрузки, resampling и data-quality validation.

## 1. Кандидат A: rinng — архитектура data pipeline

Репозиторий: https://github.com/RinNguyens/rinng  
Лицензия: MIT.  
Исследованные файлы:
- `src/rinng/exchanges/base.py` — `5581a1a6005af383909e1469e1843d12a71bdbb5`
- `src/rinng/exchanges/binance.py` — `4e3a4569677418b057aa0ddf5f084d9db9400ba7`
- `src/rinng/exchanges/okx.py` — `2f081bb6ed857a1025fb8c9b6cccfd7a3d0c54a3`
- `src/rinng/store/schemas.py` — `817e9a27e0bad213be1bc0532458bca99a219bde`
- `src/rinng/store/resample.py` — `a2eb5c022bdd4fb04490afc3ace7755b24c29cf2`
- `src/rinng/pipeline/validate.py` — `beb228a87dc17aeee24f140a1cbf4072f213b022`
- `src/rinng/pipeline/run.py` — `78249703f46265517e1602521ee1ed2465b8369b`
- `tests/test_store.py` — `fdcde41f4a570e9a8463ef646a9c8b7dd272c5d4`
- `tests/test_binance.py` — `5641700bd4f91c6e345e64405b20b6a71d4d54ab`
- `tests/test_okx.py` — `a784c157ce1700c65ec6cb900029e7b7d2ec4d54`

### Что полезно

1. **Provider Protocol.** `Exchange` — отдельный интерфейс с методами получения свечей, mark candles, funding, open interest, long/short и taker volume. Аналитический код не обязан знать API конкретной площадки.
2. **Единая схема OHLCV.** Канонические поля включают exchange, canonical symbol, timeframe, UTC open_time, OHLC, base volume, quote volume, trades, taker_buy_volume и is_closed.
3. **Временные соглашения.** В контракте явно указаны UTC milliseconds и диапазоны [start, end). Это полезно для устранения неоднозначности границ.
4. **Адаптерные различия.** Binance и OKX имеют разные направления пагинации, лимиты, error envelopes и правила timezone. В проекте эти различия локализованы в адаптерах.
5. **Историческая загрузка и polling.** Есть backfill, REST polling с перекрывающимся lookback, raw → curated pipeline, manifest и идемпотентное хранение.
6. **Раздельное хранение источников.** API и dump значения не смешиваются молча; source остаётся частью ключа для некоторых рядов.
7. **Тесты адаптеров.** `tests/test_binance.py` и `tests/test_okx.py` используют HTTP mock transport и проверяют пагинацию, границы диапазонов, незакрытые свечи, объёмные единицы, rate limits и ошибки.

### Найденные дефекты/ограничения

**B1-RINNG-01 — quality report считает gaps, но свойство ok их игнорирует.**  
В `pipeline/validate.py`, `CandleReport.ok` возвращает true, если нет duplicates, invalid_ohlc и negative_volume, но не проверяет `missing == 0`. Следовательно, ряд с пропущенными свечами может быть помечен как ok.

**B1-RINNG-02 — resample может пометить неполный агрегированный бар закрытым.**  
В `store/resample.py` закрытость вычисляется через `all_closed`, покрытие начала и конца диапазона. Не проверяется, что внутри окна присутствует ожидаемое количество минутных свечей. Если одна внутренняя 1m свеча отсутствует, но все существующие свечи закрыты и границы ряда покрывают окно, агрегат может получить `is_closed=True`. Нужен тест с пропуском внутри окна и проверка ожидаемого количества/непрерывности.

**B1-RINNG-03 — quality validation не встроена как обязательный precondition аналитики.**  
`pipeline.run.analyze()` загружает только `is_closed` свечи и запускает модули; вызова `check_candles()` или проверки `CandleReport.ok` перед расчётами нет. Validation запускается отдельной CLI-командой. Это не обеспечивает автоматический quality gate.

**B1-RINNG-04 — отсутствует тестовый файл, явно покрывающий validate.py/resample.py.**  
В просмотренном дереве тестов есть adapter/store/pipeline tests, но нет отдельного `test_validate.py` или `test_resample.py`. В `tests/test_store.py` найдены проверки хранения и gap metadata, но не обнаружены тесты на CandleReport.ok с missing bars или на неполные resampled windows.

**B1-RINNG-05 — ограниченный набор источников и Python-ориентированная архитектура.**  
В проверенном проекте реализованы Binance и OKX. Прямой интеграции в наш текущий single-file HTML нет. Использование требует либо Python backend, либо переноса нужных идей/алгоритмов в JavaScript/TypeScript.

**Важно:** исходники и тесты изучены, но тестовый набор rinng нами не запускался. Нельзя считать заявленное автором поведение подтверждённым запуском.

## 2. Кандидат B: CCXT — универсальные exchange adapters

Репозиторий: https://github.com/ccxt/ccxt  
Лицензия: MIT.  
README проекта заявляет поддержку более 100 бирж и языков JavaScript/TypeScript/Python и других. В исходнике Bybit найден конкретный `fetch_ohlcv()`:
- `python/ccxt/bybit.py`, blob `49b48f17e78b7422da3ef74103a0ddd7b51c22e2`;
- унифицированные symbol/timeframe/since/limit параметры;
- обработка Bybit linear/inverse/spot категорий;
- выбор обычных, mark, index и premium-index свечей;
- опциональная детерминированная пагинация;
- выравнивание `since` по границе интервала для Bybit.

### Что полезно

CCXT может стать готовым транспортным слоем, если мы хотим подключать и менять множество бирж без написания каждого REST адаптера вручную. Он нормализует базовые OHLCV поля и закрывает часть сложности symbol mapping, timeframe mapping, API маршрутов и пагинации.

### Ограничения

1. CCXT не является data-quality engine: он не заменяет проверку gaps, duplicates, freshness, timestamp alignment, bad OHLC и синхронизации таймфреймов.
2. Унифицированный OHLCV формат обычно содержит только timestamp/OHLCV. Дополнительные поля (quote volume, trade count, taker buy volume, exchange close flag) могут быть недоступны и потребуют расширенного raw metadata/специализированного адаптера.
3. Флаг закрытости свечи нужно проверять отдельно: через exchange-provided confirmation flag, если доступен, либо причинно выводить из exchange time и close boundary с safety margin.
4. CCXT — крупная зависимость. Перед выбором нужно проверить актуальные методы, лимиты, конкретные market types и поведение pagination на выбранных источниках.
5. README/поддержка 100+ бирж не означает одинаковое покрытие всех endpoints и рынков у каждой биржи.

**Рекомендация:** использовать CCXT как возможный transport/adapters layer, а не как canonical data contract и не как validation engine.

## 3. Сравнение

| Задача B1 | rinng | CCXT | Что нужно Crypto Analyst |
|---|---|---|---|
| Единый provider interface | Есть | Унифицированный API | Взять интерфейсный принцип |
| Несколько бирж | Binance + OKX в проверенном коде | 100+ заявлено | Адаптеры должны быть заменяемыми |
| OHLCV normalization | Есть schema/rows_to_frame | Есть базовый unified OHLCV | Свой canonical contract |
| Historical pagination | Есть | Есть методы/параметры, зависит от exchange | Проверить границы и дубликаты |
| Closed/forming candles | Есть exchange flags | Не всегда унифицировано | Собственная явная политика |
| Gaps/duplicates/OHLC checks | Отдельный validate модуль, но найдены проблемы | Не является целью | Свой quality engine |
| Resampling | Есть 1m → higher TF, найден риск incomplete window | Не основной функционал | Тестируемая причинная реализация |
| Raw/curated storage | Есть Parquet/catalog | Нет как цель библиотеки | Решить отдельно по нуждам проекта |
| Встроенный quality gate | Не встроен в analyze | Нет | Обязательное требование B1 |

## 4. Предлагаемый контракт Crypto Analyst

Не копировать чужую схему буквально. Зафиксировать минимальный provider-neutral контракт:

### Candle
- `provider` / `venue` и `market_type`;
- `canonical_symbol` и `provider_symbol`;
- `timeframe`;
- `open_time_ms`, `close_time_ms` в UTC;
- `open`, `high`, `low`, `close`;
- `volume_base`, `volume_quote` (nullable, если источник не даёт);
- `trade_count`, `taker_buy_volume` (nullable);
- `is_closed` и `closed_status_source` (exchange-confirmed / time-derived);
- `received_at_ms`, `provider_event_time_ms`;
- `raw_source_id` или provenance metadata.

### Snapshot / dataset
- provider, market type, symbol, timeframe;
- exchange/server time и receivedAt;
- диапазон запрошенных данных и фактическое покрытие;
- closed candles и forming candle отдельно;
- quality report с severity/reasons;
- версия нормализатора/контракта;
- единый cutoff для набора 1D/4H/1H.

### Quality states
- VALID — нет критических проблем;
- DEGRADED — есть известные некритические проблемы, требующие ограничения отдельных расчётов;
- INVALID — критическая ошибка OHLC/time/order/duplicates/missing required coverage;
- STALE — данные старше заданного порога;
- INSUFFICIENT — недостаточная история для требуемого анализа.

Directional output запрещён для INVALID/STALE/INSUFFICIENT; при DEGRADED допускаются только те модули, которые явно объявили, что могут работать с соответствующим ограничением.

## 5. Предварительное решение для B1

**KEEP / ADAPT:**
- Взять идею Exchange Protocol и изоляции provider-specific pagination/timezone/error handling из rinng.
- Взять CCXT на shortlist для готовых source adapters, но не принимать до проверки на fixtures и сравнения с прямым REST adapter.
- Взять схему provenance и раздельное хранение источников.
- Рассмотреть 1m base + resampling только после исправления проверки полноты каждого окна.

**REWRITE / OWN:**
- Единый контракт Candle/Snapshot/QualityReport.
- Обязательный quality gate до аналитических модулей.
- Политику freshness и закрытости свечей.
- Детерминированную синхронизацию 1D/4H/1H.
- Проверку полноты resampled windows.

**REJECT AS-IS:**
- `CandleReport.ok` без проверки missing bars.
- Resample closed-state без подсчёта ожидаемых входных баров.
- Запуск аналитики без обязательного preflight validation.

## 6. Следующие B1 проверки

1. Сравнить CCXT и прямые API adapters на одном историческом fixture по timestamps/OHLCV/volume units/closed state.
2. Добавить fixture cases: пропуск первой/внутренней/последней свечи, дубликат, out-of-order, malformed OHLC, negative/NaN/Infinity volume, future timestamp, stale snapshot, insufficient history.
3. Проверить resampling: полное окно, пропуск внутри, частичное начало/конец, границы UTC/дня/недели.
4. Синхронизировать 1D/4H/1H на одном cutoff и проверить отсутствие будущей свечи в одном из TF.
5. Установить provider-neutral контракт и только затем выбрать конкретные adapters/storage.
6. Не менять основной HTML до принятия спецификации B1 и плана интеграции.

**Вывод:** rinng — полезный архитектурный источник идей для data pipeline, но его quality validation нельзя принимать без исправлений. CCXT — сильный кандидат на транспортный слой, но не на обработку качества данных. Crypto Analyst должен иметь собственный единый контракт и quality gate.
