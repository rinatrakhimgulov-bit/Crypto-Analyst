# B2 Research — Market Structure / BOS / CHoCH candidates

**Дата:** 2026-11-26  
**Статус:** предварительный source audit; B2 не открыт, интеграции нет.  
**Задача:** найти причинно корректные алгоритмы swing detection и market structure, пригодные для HH/HL/LH/LL, BOS/CHoCH и последующего MTF.

## 1. Кандидат A: market-mechanics-bot — наиболее сильная reference implementation

Репозиторий: https://github.com/nedu-m/market-mechanics-bot  
Описание проекта: mechanical implementation ICT/SMC strategy, backtest-first. README прямо сообщает, что стратегия проверена на шести основных FX-парах за шесть лет и не показала устойчивого edge.  
Проверенные файлы:
- `bot/structure.py` — blob `3d6cef436f2b2b466086847cddc58b6ee2c66c47`
- `tests/test_structure.py` — blob `f21c406ee8f76643c5c3fd126f36f41f9301c0b0`
- `tests/test_components.py` — blob `54578f93b41812ceeb11382894e7f20c1bba50e4`
- `bot/backtest.py` — blob `ec9636a8ecc5b38952cebf86ddc2bb1117d8a93a`
- `README.md` — blob `ba9384739881a5b55d62b67cacb9d5294e4bc315`

### Полезные решения

1. **Confirmed swing содержит два времени:** `idx` — где сформировался pivot, `confirmed_idx` — на каком баре он стал известен. Это именно та семантика, которая нужна для исключения look-ahead.
2. **Fractal pivots подтверждаются N свечами справа.** `find_fractals()` не делает pivot доступным сразу в момент его возникновения.
3. **Структура считается слева направо.** `compute_structure()` помещает swing в очередь на `confirmed_idx`, а состояние тренда и уровни обновляет последовательно по барам.
4. **Break по закрытию тела свечи.** Wick-only прокол не считается BOS/CHoCH при включённом `require_body_close`.
5. **Есть causal state per bar.** Engine возвращает тренд, активные swing high/low и события с индексом и временем фактического пробоя.
6. **Есть синтетические unit tests.** Отдельно проверяются wick-only против close-through и задержка подтверждения pivot.
7. **Есть осторожный backtest принцип:** стоп считается достигнутым первым, если одна младшая свеча пересекает и stop, и target; заявлены spread/slippage/commission и one-position-at-a-time.

### Ограничения и риски

- GitHub API сообщает `license=null`; явная лицензия в просмотренном дереве не найдена. **Код нельзя копировать или включать в Crypto Analyst без подтверждённой лицензии/разрешения.** Алгоритмические идеи можно использовать как независимую техническую спецификацию с собственной реализацией.
- Проект заточен под FX и стратегию из ICT/SMC курса, не под крипто-фьючерсы. Структурный модуль в основном работает с OHLC и переносим концептуально, но не доказывает пригодность всех правил для crypto.
- Тест `test_causality` проверяет равенство `confirmed_idx == idx + N`, но не полноценную prefix-invariance: результат на префиксе до T должен совпадать с соответствующим состоянием полного ряда на T.
- В `compute_structure()` при одновременном пробое protected high и protected low оба события пропускаются. Это безопаснее случайного directional выбора, но результат должен явно маркироваться как ambiguous/unknown и покрываться тестом.
- `prot_high` / `prot_low` обновляются последними подтверждёнными swing-ами. Правила выбора защищённого структурного экстремума требуют сверки с формальной спецификацией, особенно после BOS и при перекрывающихся pivots.
- В backtester найден отдельный повод для аудита: цикл проверки выхода идёт до конца массива, а не ограничивается expiry index; требуется проверить, может ли сделка оставаться открытой за пределами expiry. Это не дефект самого structure engine, но не позволяет принимать backtester без отдельного аудита.
- README сообщает отрицательный результат стратегии (нет устойчивого edge). Это важный пример: даже тщательно реализованные ICT/SMC правила не гарантируют торгового преимущества.

**Оценка:** лучший из просмотренных источников для причинного тайминга swing/BOS/CHoCH и набора тестовых идей. Не готов к прямому использованию из-за отсутствия лицензии и неполной тестовой матрицы.

## 2. Кандидат B: pyvsmc — MIT, но найден look-ahead риск

Репозиторий: https://github.com/Khaymat/pyvsmc  
Подробный аудит уже находится в `docs/research/B2_PYVSMC_CANDIDATE_AUDIT_2026-11-26.md`.

- Лицензия MIT.
- Векторизованные swings, BOS/CHoCH, FVG, OB, breaker zones, EQH/EQL, liquidity sweeps, premium/discount.
- Критическая проблема: swing, требующий N правых свечей, может стать доступным структуре уже на следующем баре из-за сдвига forward-filled mask только на один индекс.
- Нужна causal correction с `confirmed_index=i+N`, prefix-invariance и online-vs-batch tests.

**Оценка:** потенциально пригоден после исправления timing; нельзя интегрировать напрямую.

## 3. Кандидат C: Forex-wws2277 — полезные примитивы, но нет лицензии и timing gaps

Репозиторий: https://github.com/Jony-wws/Forex-wws2277  
Файл `app/smc.py`, blob `de8b37e7785ca25a0c847174c5006b4275f4fcb9`.

Полезно:
- простые fractal pivots;
- BOS/CHoCH на последних high/low;
- FVG;
- liquidity sweep.

Проблемы:
- license=null;
- pivot не содержит confirm index/time;
- `detect_order_blocks()` использует три будущих close для подтверждения импульса, но возвращает OB с исходным индексом без `known_at`;
- FVG использует третью свечу, но не возвращает отдельный момент доступности;
- `smc_score()` добавляет очки за последний OB/FVG без достаточной проверки mitigation/proximity.

**Оценка:** REJECT as-is; можно использовать только как перечень гипотез, не как код.

## 4. Кандидат D: ICT_V4 — сложный engine, но нет лицензии и нужен глубокий аудит

Репозиторий: https://github.com/sameeaamee16-dot/ICT_V4  
Файл `ict_engine.py`, blob `0b4402a9e7e3f2a59324429c148740b35ed34037`.

Полезные идеи:
- Swing содержит `pivot_time` и `confirm_time`;
- BOS/CHoCH требуют close beyond swing;
- FVG freshness/touch penalties;
- OB retest/mitigation scoring;
- displacement + volume confirmation.

Проблемы:
- license=null;
- README/кодовые заявления об улучшении win rate не являются доказательством;
- структура в основном вычисляет последние события по полному переданному dataframe; для backtest нужно проверить prefix/online causal consistency;
- сложная конфигурация и много heuristic scores затрудняют независимую валидацию.

**Оценка:** RESEARCH ONLY; не интегрировать без лицензии, тестов и полного timing audit.

## 5. Кандидат E: TradingAPP LuxAlgo SMC port — исключить для прямого копирования

Репозиторий: https://github.com/DmitryJbanov/TradingAPP  
Файл `src/indicators/smc.ts`, blob `b06dae37e2bbb131d83072fb9aecca486ff19966`.

Файл явно указывает адаптацию LuxAlgo SMC под **CC BY-NC-SA-4.0**. Это non-commercial/share-alike лицензия; она не подходит для свободной интеграции в проект с неопределённым будущим способом распространения. Не копировать код и не переносить производные фрагменты без отдельного юридического решения.

Технически интересно:
- TypeScript реализация;
- internal/swing structure;
- BOS/CHoCH;
- order blocks и FVG;
- MTF FVG с режимом confirmed и явным предупреждением о Pine lookahead в альтернативном режиме.

**Оценка:** REJECT for integration due to license constraints. Может использоваться только как концептуальный reference после отдельной правовой оценки, не как источник копируемого кода.

## 6. Сравнение

| Критерий | market-mechanics-bot | pyvsmc | Forex-wws2277 | ICT_V4 | TradingAPP port |
|---|---|---|---|---|---|
| Язык | Python | Python | Python | Python | TypeScript |
| Явный confirmation time | Да | Нет в найденной связке | Нет | Да для swings | Внутренний causal event flow, нужен тест |
| Causal structure | Сильная основа | Найден timing defect | Недостаточно доказано | Не доказано для replay | Нужно тестировать |
| Body-close break | Да | Требует проверки | Да по close_now | Да | Да |
| Тесты | Есть, ограниченные | README заявляет 92, нами не запускались | Не проверены | Не проверены | Проектные tests не изучены |
| Лицензия | Не указана | MIT | Не указана | Не указана | CC BY-NC-SA-4.0 в исходном файле |
| Решение | Reference only | ADAPT/HOLD | REJECT as-is | Research only | REJECT for direct integration |

## 7. Что должно стать нашим собственным алгоритмом

Не копировать чью-либо терминологию без точных правил. Для B2 требуется собственная проверяемая спецификация:

1. Swing high/low: параметры left/right, strict/tie policy, минимальная значимость (например, ATR threshold), pivot index и confirmed index.
2. HH/HL/LH/LL: сравнение последовательных подтверждённых swing одного типа, правила равных/почти равных экстремумов.
3. Protected high/low: формальная логика выбора структурных уровней после смены направления.
4. BOS/CHoCH: close-based default; wick sweep отдельно; level consumed once; gap-through; simultaneous break = ambiguous.
5. Causal event timestamp: время доступности события, не pivot time.
6. Prefix invariance: данные после T не могут менять state/events, которые уже были доступны на T.
7. Batch/online equivalence: последовательный пересчёт по одной закрытой свече должен давать те же результаты, что полный batch на том же cutoff.
8. Tests: flat ties, outside bars, missing candles, wick-only, body close, gap-through, simultaneous breaks, pivot confirmation, repeated break, state transition.

**Рекомендация:** использовать market-mechanics-bot как наиболее полезный reference для причинного тайминга и тестов, но не копировать код из-за отсутствия лицензии. pyvsmc оставить MIT-кандидатом после исправления look-ahead. Все SMC scoring weights и торговые сигналы не принимать без отдельного B7 historical validation.

**Статус B2:** research notes only; B2 не начат и не меняет последовательность B0 → B1 → B2.
