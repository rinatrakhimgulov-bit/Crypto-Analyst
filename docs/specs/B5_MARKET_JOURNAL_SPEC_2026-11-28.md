# B5 Market Journal Specification
Date: 2026-11-28
Status: Approved for implementation
Base: B4 candidate branch `feature/b4-live-data-hardening-2026-11-28`, PR #24 head `94513b348a36ed3a91385d56ef52f4df4569326d`

## 1. Purpose

Create a private, local-first journal that preserves the exact analytical context visible when an observation is recorded. The journal is the evidence layer for later setup evaluation and statistical validation.

It must record all decision states, including LONG, SHORT and WAIT. A WAIT observation is not a failed or empty record: it preserves what the system saw when it correctly declined to form a directional conclusion.

## 2. Product boundaries

- Personal-use tool only; no account system, backend, cloud sync or remote telemetry.
- Browser-local persistence using a versioned storage adapter. Initial implementation uses localStorage.
- Export and import are explicit user actions using a versioned JSON format.
- No automatic order placement, trade execution, exchange API keys or position management.
- No automatic inference that a signal was traded.
- An observation is immutable after capture. Follow-up assessments and actual trades are separate linked records.
- The journal must not modify or influence the live analysis engine.

## 3. Core record types

### 3.1 Observation (immutable)

Required fields:
- `id`: stable UUID.
- `recordType`: `observation`.
- `schemaVersion`: integer.
- `capturedAt`: UTC ISO timestamp and epoch milliseconds.
- `market`: source, market type, symbol, interval.
- `priceContext`: last traded price, source, provider event time, local receive time, and freshness status when available.
- `dataQuality`: B1 status, reason codes, closed-candle count, forming-candle status, provider-time spread when applicable.
- `decision`: LONG, SHORT or WAIT, plus the exact reasons and blocking conditions shown at capture time.
- `analysisSnapshot`: selected timeframe indicators and levels, B2 structure result, zones, break/retest lifecycle, and MTF context only when each source is valid and available.
- `candleWindow`: bounded, immutable OHLCV window ending at the latest candle available at capture time. Store only the minimum fields needed to reproduce the captured analysis; include explicit finality for the forming candle.
- `appVersion` and `engineVersions`: reproducibility metadata.

Capture must fail closed if there is no coherent snapshot, if required timestamps are invalid, or if the UI is displaying an unassessed/stale/invalid data state. The user may still save an explicit WAIT observation when the market data itself is valid but the setup is absent. A data-quality-blocked WAIT can also be saved, but its quality status and blocking reason must remain explicit.

### 3.2 Follow-up (append-only)

A follow-up is a separate immutable event linked to an observation:
- `id`, `recordType: followup`, `schemaVersion`, `observationId`, `recordedAt`.
- `status`: `setup_formed`, `triggered`, `invalidated`, `expired`, `missed`, `still_waiting`, or `manual_note`.
- Optional note and optional observed price.
- Optional evidence timestamp and source.

Follow-ups never rewrite the original observation. A user may record a missed setup or a later invalidation without changing what was known at capture time.

### 3.3 Actual trade (separate from observation)

Actual execution is an optional, manually entered record linked to an observation:
- `id`, `recordType: actual_trade`, `schemaVersion`, `observationId`, `recordedAt`.
- Side, entry/exit timestamps and prices, quantity, fees and optional funding.
- Optional realized PnL if sufficient values are supplied.
- Explicit status for open/closed/void.

A saved LONG/SHORT observation must never be treated as an actual trade. Paper observation and actual execution remain distinct in UI, export and later statistics.

## 4. Causal and no-look-ahead rules

- Capture uses only candles and provider events available at `capturedAt`.
- The forming candle is marked unconfirmed and cannot be silently treated as closed.
- Later candles, future pivots, later zones, or future retest outcomes must not be inserted into the observation snapshot.
- Follow-ups and trades may reference later timestamps, but must remain separate records.
- Historical replay and evaluation must use the original observation snapshot, not current chart state.
- If the app cannot prove when an event became available, it must omit that event or mark the observation non-reproducible. It must not guess.

## 5. Storage and retention

- Storage key: `cryptoAnalyst.marketJournal.v1`.
- Storage adapter is isolated from UI and analysis code.
- Writes are atomic at the envelope level: validate the new envelope before replacing stored content.
- Keep a bounded record count and bounded candle window. Initial targets: at most 100 observations and 160 candles per observation, configurable only after measuring actual payload size.
- Before an operation that may exceed browser quota, show a clear warning and preserve the previous valid journal.
- No silent deletion or automatic trimming of user records. If the configured limit is reached, ask the user to export/archive records before accepting more.
- If local storage is unavailable or corrupt, journal actions fail visibly without affecting chart or analysis.

## 6. Export and import

Export:
- Explicit user action.
- JSON envelope contains `format: crypto-analyst-journal`, `formatVersion: 1`, `exportedAt`, observations, follow-ups and actual trades.
- Export is a full backup, not a partial screenshot or summary.
- Export must not mutate stored records.

Import:
- Explicit user action from a selected JSON file.
- Validate format, version, record shapes, references, timestamps, enum values, limits and referential integrity before any write.
- Merge by record ID. Exact duplicate IDs with identical content are ignored; same ID with different content rejects the import as a collision.
- Imported observations remain immutable. No imported record may overwrite an existing record.
- Unknown future schema versions are rejected with an actionable message; never silently downgrade.
- Import is all-or-nothing. A failed import leaves the existing journal unchanged.

## 7. UI scope

Initial UI:
- A clear `Save observation` action near the current analysis.
- A journal view showing captured time, symbol/timeframe, LONG/SHORT/WAIT, quality status and concise reason.
- Observation detail view with captured snapshot, chart candle window, data quality and engine versions.
- Follow-up action for setup formed/triggered/invalidated/expired/missed/still waiting/manual note.
- Actual trade entry is separate and visually distinct from paper observations.
- Export and import controls with clear success/failure feedback.
- No decorative dashboards or performance claims in B5.

All visible labels should be Russian, consistent with the existing app.

## 8. Test requirements

- Capture LONG, SHORT and WAIT observations.
- Capture a quality-blocked WAIT and preserve reason codes.
- Snapshot is immutable after later chart updates and REST refreshes.
- Forming candle remains explicitly unconfirmed.
- Follow-up and actual trade creation do not mutate the observation.
- No future candle or future B2 event enters a prior observation.
- Export/import round-trip preserves every record exactly.
- Duplicate import is idempotent; conflicting ID rejects the whole import.
- Invalid JSON, unsupported schema, malformed references and quota failures preserve prior data.
- Storage corruption is reported and does not break chart startup.
- Journal has no effect on B1/B2 outputs or LONG/SHORT/WAIT decisions.

## 9. Acceptance gate

B5 is complete only when the journal is usable on iPhone Safari, records are reproducible and immutable, import/export is round-trip safe, storage failure is fail-closed, and the full B1/B2 regression suite remains green.


## 10. B5 UI implementation notes

The first browser implementation now includes:
- Save immutable LONG/SHORT/WAIT observations from the currently assessed snapshot.
- A compact list and expandable JSON detail view for the latest observations.
- Append-only follow-up marks, including `missed`, `invalidated`, `triggered`, and `still_waiting`, with optional observed price and note.
- Separate manually entered completed actual trades linked to an observation. Entry and exit timestamps/prices are recorded independently from the signal. Quantity is optional; when supplied, gross PnL is calculated for linear USDT contracts, then fees and signed funding are deducted. Funding is positive when paid and negative when received. This is a journal calculation only, not an execution or margin calculator.
- Versioned JSON export/import with merge-by-ID, idempotent duplicate handling, and all-or-nothing collision rejection.

The initial UI records completed actual trades only. Open-position tracking and trade lifecycle updates are deferred; no observation or trade record is edited in place. B5 browser contract tests cover immutable snapshots, WAIT and quality-blocked WAIT, no future candle inclusion, follow-up/trade linkage, PnL arithmetic, import collision handling, idempotent restore, and storage failure preservation.
