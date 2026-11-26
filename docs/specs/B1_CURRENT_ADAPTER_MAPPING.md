# B1 — Current Bybit Adapter Mapping and Implementation Gap Analysis

**Дата:** 2026-11-26  
**Исходник:** `CryptoAnalyst_StageA_S6_updated.html`, Git Blob `02cbfb60d1a562e7b73e2734d1ab49b4cf91e2bf`  
**Проверенный участок:** `BybitAdapter`, строки 546–857.  
**Статус:** source mapping; не реализация.

## 1. Что уже есть

Текущий `BybitAdapter` — это рабочая заготовка provider adapter, а не полностью отдельный слой.

| Текущая функция/поле | Реализация | B1 mapping |
|---|---|---|
| `source` | `Bybit` | `provider_id` / `venue` |
| `marketType` | `Linear Perpetual` | `market_type` |
| `symbol` | например BTCUSDT | `provider_symbol` + mapping в `canonical_symbol` |
| `interval` | 60 / 240 / D | `timeframe` |
| `ts` | raw open time ms | `open_time_ms` |
| `closeTs` | open time + timeframe duration | `close_time_ms` (exclusive boundary) |
| `open/high/low/close` | finite positive numbers | canonical OHLC |
| `volume` | raw row[5] | `volume_base`, единицы должны быть подтверждены source contract |
| `closedCandles` | time-derived using serverTime + 500ms buffer | `closed_state=TIME_DERIVED` |
| `formingCandle` | last open candle | separate forming candle |
| `serverTimeMs` | API time, fallback to local Date.now | provider time; fallback must not be silently treated as trusted |
| `fetchedAtLocalMs` | local receive time | `received_at_ms` |
| `hostUsed` | API hostname | provider provenance |
| `quality` | counters only | preliminary QualityReport, no status/severity |

## 2. Existing safeguards worth keeping

- REST response checks HTTP status and Bybit `retCode`.
- Timeout and external AbortSignal propagation.
- Host fallback between `api.bybit.com` and `api.bytick.com`.
- OHLC finite/positive and high/low consistency checks.
- Sorting by candle open time.
- Detection counters for duplicates, gaps, anomalous intervals and misaligned timestamps.
- Separate closed and forming candle arrays.
- Server-time estimate and 500ms finality buffer.
- Ticker kept separate from candle close, with fallback warnings.

These are useful building blocks. B1 should wrap/refactor them rather than discard them.

## 3. Exact gaps against B1 contract

### D1 — No canonical contract
Adapter returns a Bybit-shaped object with `ts`, `closeTs`, `source`, `interval`. Analytical engine consumes these fields directly. No provider-neutral snapshot abstraction exists.

### D2 — Quote volume/provenance incomplete
The normalizer reads row indices 0–5 and discards any additional provider fields. Source-specific quote turnover, trade count, taker volume and raw provenance are not carried into the canonical dataset. Do not invent missing fields; add them only after source semantics are verified.

### D3 — Duplicate conflict is silently resolved
After sorting, duplicate timestamps increment a counter and the later row overwrites the earlier row. The code does not distinguish identical duplicates from conflicting OHLCV rows, nor retain conflict details. Conflicting duplicates should be quarantined and surfaced in QualityReport.

### D4 — Future timestamp policy is too permissive
A timestamp is rejected only when it is more than 24 hours ahead of server time. A candle timestamp modestly ahead of provider time can remain in the normalized array. B1 should reject/quarantine any future open time beyond a narrowly defined clock-skew allowance and record the reason.

### D5 — Server-time fallback hides uncertainty
If Bybit time is missing/invalid, local `Date.now()` is used as `serverTimeMs`. That value is then used for closed/forming classification. The contract must preserve `time_source=provider|local_fallback|unknown`; local fallback cannot be represented as provider-confirmed time.

### D6 — Closed state is time-derived only
The current 500ms buffer classifies a candle as closed based on server time, not an exchange-provided confirmation flag. That may be acceptable as `TIME_DERIVED`, but must not be mislabeled as exchange-confirmed.

### D7 — Quality counters do not create a decision gate
`quality` contains counts, but no VALID/DEGRADED/INVALID/STALE/INSUFFICIENT state or severity-coded reasons. D0-01 proves the analytics engine can still return LONG on invalid data.

### D8 — No expected coverage contract
The adapter requests up to 160 bars but does not calculate the expected start/end coverage from the request and current time. A response with a short history or a missing leading/trailing range can look structurally clean if there are no internal gaps.

### D9 — No pagination / historical range
Current fetch requests a single latest kline page with a limit. It does not expose a range-based pagination contract suitable for historical backfill or cross-provider comparison.

### D10 — No shared multi-timeframe cutoff
Each timeframe is fetched independently. No snapshot assembler ensures 1D/4H/1H represent the same `analysis_as_of_ms`.

### D11 — Stale cache is not separated from live decision state
B0 confirmed that refresh failure can re-render the cached dataset and cached LONG/SHORT. A cached snapshot may remain visible as historical context, but its decision must be downgraded to STALE/WAIT until a new snapshot passes validation.

## 4. Recommended minimal B1 implementation path

Do not replace the current adapter or migrate languages as the first move.

1. Define canonical `Candle`, `Snapshot`, `QualityReport` and explicit contract version in JavaScript.
2. Keep the existing Bybit REST logic as the first adapter; write a small mapping function from current normalized fields to canonical contract.
3. Add a pure validator that takes canonical candles + expected coverage + provider time metadata and returns a deterministic QualityReport.
4. Add a single preflight quality gate before `BasicAnalyticsEngine.analyze()`.
5. Fix stale-cache behavior: render cached data as stale context, never as current LONG/SHORT.
6. Add fixtures for gaps, duplicates, conflicting duplicates, invalid OHLC, non-finite numbers, future timestamps, missing provider time, forming/closed boundaries, stale snapshots and insufficient coverage.
7. Only after this is stable, compare a second provider. CCXT remains a candidate transport library; it is not required for the first implementation.
8. Add common-cutoff snapshot assembly for 1D/4H/1H after single-timeframe quality validation is stable.

## 5. Runtime / language recommendation

**Recommendation for B1 first pass: stay in JavaScript.**

Reasons:
- Canonical Stage A is a 4,055-line single HTML/JavaScript prototype and currently runs in a browser.
- The first B1 changes are data contracts, validation and gating, not heavy numerical computation.
- A Python backend would add deployment, API boundary, hosting and client/server lifecycle work before we have proved it is necessary.
- The provider-neutral contract is language-agnostic. It can later be implemented server-side in Python without changing the conceptual schema.
- CCXT has JavaScript/TypeScript and browser support, but adding the whole dependency now would be premature; one reliable provider adapter is sufficient to implement and test the contract.

This is not a permanent ban on Python. Reconsider a Python service if historical backfills, Parquet/DuckDB storage, large research/backtesting workloads or multi-source ingestion make the browser runtime materially inadequate.

## 6. B1 implementation acceptance sequence

- B1-A: canonical schema + Bybit mapping, tests only; no analytics change.
- B1-B: deterministic quality validator + 25-case fixture matrix.
- B1-C: mandatory quality gate; invalid/stale/insufficient => WAIT with reason.
- B1-D: stale-cache directional suppression.
- B1-E: common-cutoff 1D/4H/1H snapshot assembly.
- B1-F: second provider comparison and source selection.

**Important:** this document is a proposal. It does not authorize or claim implementation. The HTML source remains unchanged.
