# B9 — Automatic Market Journal Capture

Date: 2026-11-28
Status: implementation candidate; awaiting exact-head CI and owner device acceptance.

## Scope

B9 completes automatic journal capture while the HTML application is open and successfully completes a current market-analysis cycle. It does not add a server, worker, cloud storage, background execution, trade execution, or automatic trade records.

## Capture contract

- Capture after the current REST snapshot has passed request-generation/symbol/timeframe guards, analysis has completed, the snapshot is stored, and `renderSuccess` has completed.
- Capture LONG, SHORT, and WAIT. A quality-blocked analysis is recorded as WAIT with its quality status and reasons preserved.
- Capture valid B2/B7 output, including a valid B7 result with zero candidates. A blocked/unavailable B7 result is also retained in the B2 snapshot as a blocked/unavailable status; it must not be represented as a confirmed setup.
- Keep the immutable B1 quality report, analysis decision/reasons/metrics/levels, B2/B7 result and bounded candle window in the observation.
- Do not capture stale-cache rendering after a failed REST request, aborted requests, superseded requests, or a request for a different symbol/timeframe.
- Existing manual capture remains available. Automatic capture and manual capture share the same deduplication key, so pressing the manual button for an already captured unchanged snapshot does not create a second observation.

## Idempotency

A deterministic `captureKey` is derived from symbol, timeframe, quality status, decision, quality-gate state, and the last two candle tuples (timestamp, close timestamp, OHLCV/turnover). The key is persisted on each observation. A repeated analysis of the same unchanged snapshot returns the existing observation rather than appending a duplicate. A changed forming candle, new closed candle, changed decision, or changed quality state creates a distinct observation.

## Storage and lifecycle

- Use the existing validated, append-only localStorage journal and existing JSON export/import.
- Preserve compatibility with existing journal envelopes by adding optional observation fields only; do not change the envelope version or mutate prior records.
- Storage quota/corruption failures must be surfaced in the Journal status and must not break chart rendering or the analysis pipeline.
- The browser stores records only on the device/browser profile. No promise of synchronization or execution while the page is closed.

## Verification

Browser contract must cover:
1. first automatic capture persists an AUTO observation;
2. repeated identical capture is idempotent;
3. manual capture of the same snapshot does not duplicate it;
4. WAIT/no-setup cycles are captured;
5. quality-invalid cycles are retained as WAIT with reasons;
6. changed snapshot produces a new observation;
7. stale snapshots are not auto-captured;
8. existing B5 follow-up, trade, export/import, immutability, collision and corrupt-storage checks remain green;
9. zero browser page errors.

CI is necessary but not sufficient. Owner must open the B9 candidate on iPhone Safari, run an analysis cycle, open Journal and verify records appear and persist after page reload.

## Explicitly deferred

Running while the application is fully closed requires a future server-side worker and is outside B9. UX redesign is also outside scope.
