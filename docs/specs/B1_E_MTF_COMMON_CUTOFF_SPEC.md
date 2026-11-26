# B1-E — Multi-Timeframe Common-Cutoff Assembly Specification

**Status:** implementation candidate implemented in draft PR #6; not merged, browser-tested, or live-verified.  
**Scope:** one canonical instrument and market type, required timeframes 1D / 4H / 1H, initially one provider (Bybit).  
**Non-goal:** no market-structure signals, no trade scoring, no second provider, no UI redesign.

## 1. Why this stage is required

The current runtime fetches one selected timeframe per `loadAndAnalyze()` call. It calls `BybitAdapter.fetchMarketSnapshot(symbol, interval, ...)`, then immediately calls `BasicAnalyticsEngine.analyze(dataset)`. The cache is keyed by symbol + interval. There is no runtime assembler that creates one synchronized 1D/4H/1H analysis snapshot.

The current adapter classifies closed/forming candles using each response's own `serverTimeMs`. `DataQualityEngine.createSnapshot()` copies that value into `analysisAsOfMs`, while `validate()` currently requires `analysisAsOfMs` and `providerTimeMs` to differ by no more than the small clock-skew allowance. Therefore simply overwriting each dataset's `serverTimeMs` with a common cutoff would either leave candle partitions/coverage inconsistent or cause provider-time validation failures.

B1-E must introduce explicit common-cutoff semantics without weakening the existing provenance and finality protections.

## 2. Target flow

```text
MTF request (symbol, marketType, required TFs)
  -> fetch 1D + 4H + 1H concurrently from the selected provider
  -> retain per-response provider time, receive time, request metadata and raw normalized candles
  -> verify all required responses and provider clocks
  -> choose one common analysis_as_of_ms
  -> reclassify each TF's candles against that cutoff
  -> recompute expected coverage for each TF at that cutoff
  -> run per-timeframe DataQualityEngine validation
  -> aggregate quality (worst required TF governs directional permission)
  -> emit deeply immutable MTF snapshot with one shared analysis_as_of_ms
  -> only then allow the MTF analytics layer to consume it
```

The existing chart may continue displaying the user's selected timeframe. MTF assembly is a separate analytical data operation; it must not silently change the chart's selected interval.

## 3. Time model and common cutoff

Each provider response must retain at least:
- `providerTimeMs`: provider-supplied server time for that response;
- `receivedAtMs`: local receive timestamp;
- `requestStartedAtMs` and `requestCompletedAtMs` (or equivalent request timing);
- `timeSource`, which must be `PROVIDER` for a directional-eligible MTF snapshot.

Rules:

1. Do not substitute local device time for missing provider time and then treat the result as trusted.
2. Choose `analysisAsOfMs = min(providerTimeMs)` across all required timeframe responses, after confirming all clocks are trusted and within the configured collection-skew policy.
3. Preserve every original `providerTimeMs`; do not overwrite provider provenance with the common cutoff.
4. The common cutoff must not be later than any required response's provider time, except for an explicitly bounded clock tolerance.
5. The maximum permitted provider-time spread / collection window is a configurable policy. Its production default must be set from measured live-provider latency and clock behavior, not guessed. If the spread exceeds policy, aggregate quality blocks directional output.
6. All required timeframes must share exactly the same `analysisAsOfMs` in the assembled snapshot.
7. Local receive timestamps remain separate from provider timestamps and are used for receive-age / stale checks.

## 4. Candle reclassification at the common cutoff

The current per-response closed/forming split is not authoritative for an assembled MTF snapshot because each response may have a slightly different provider time.

For each timeframe with interval length `stepMs` and the existing 500 ms finality buffer:

- A candle is eligible for the closed set only when `closeTimeMs + 500 <= analysisAsOfMs`.
- Candles not meeting that condition must not enter closed-candle analytics.
- The latest eligible in-progress candle may be retained separately as forming context, but it must not enter closed historical calculations.
- A candle with an open time beyond the common cutoff must be excluded from the assembled as-of snapshot (and never enter closed or forming analytics). Its presence in a response is not by itself an error: a slightly later provider response can legitimately contain a newly opened candle. Record the excluded count. The configured provider-time spread policy bounds how far ahead the response may be; reject only when the time policy or remaining candle/coverage validation fails.
- Duplicate/conflicting rows, malformed OHLCV, misalignment, gaps and invalid adapter counters remain quality findings; reclassification must not erase or hide them.
- The forming candle remains outside the current B1 Quality Gate policy unless a separate explicit change is approved. B1-E must not claim that malformed forming OHLC is validated.

If a provider response is too far ahead of the common cutoff to produce a coherent forming/closed partition, reject the MTF assembly rather than silently splice unrelated states.

## 5. Coverage recalculation

Coverage is recomputed against the common cutoff. The request contract distinguishes the desired number of closed candles from the raw provider-row limit.

**Definitions**
- `desiredClosedCount` is the number of closed historical candles the MTF consumer requires per timeframe. `fetchAndAssemble()` receives it through `options.limit` (default 160).
- Bybit V5 `limit` counts raw response rows, not closed candles. The response list is newest-first and may contain a forming candle whose close field is the latest traded price. Official endpoint: https://bybit-exchange.github.io/docs/v5/market/kline
- For each timeframe, `rawLimit = desiredClosedCount + ceil(maxProviderTimeSpreadMs / stepMs) + 2`. The extra rows cover possible interval-boundary rollover across the permitted provider-time spread, the active forming row, and a candle whose close time has passed but whose 500 ms finality buffer has not yet elapsed.
- The raw request limit must not exceed Bybit's maximum of 1000. Exceeding it fails the MTF request instead of silently reducing the requested history.
- The adapter's original raw request window remains provenance metadata. It is not reused as the expected common-cutoff closed window.

For each timeframe:
1. Compute `lastExpectedClosedOpenMs = floor((analysisAsOfMs - 500) / stepMs) * stepMs - stepMs`.
2. Compute `expectedClosedStartMs = lastExpectedClosedOpenMs - (desiredClosedCount - 1) * stepMs`.
3. Set `expectedClosedCount = desiredClosedCount` and validate that the canonical closed series begins and ends at the expected timestamps and contains exactly that count.
4. Reclassify all normalized candles at the common cutoff before selecting the newest `desiredClosedCount` closed candles. A candle with `closeTimeMs <= analysisAsOfMs` but `closeTimeMs + 500 > analysisAsOfMs` is pending finality, not actively forming. An active forming candle has `closeTimeMs > analysisAsOfMs`. Older excess rows may be trimmed; missing rows must not be hidden.
5. If the response is short, or the boundary rollover consumed rows so that the target window is incomplete, report coverage start/count findings and block directional permission.
6. Preserve adapter-level gap, duplicate, malformed-row and alignment counters.

The implementation must not infer that the requested raw limit equals the returned row count. It must also not assume that `requestedLimit - 1` is the expected number of closed candles. The desired closed count is an explicit MTF contract field.

## 6. Per-timeframe and aggregate quality

Each TF receives its own `QualityReport` evaluated against the common cutoff.

Aggregate quality:
- is VALID only when every required timeframe is VALID;
- is DEGRADED/INVALID/STALE/INSUFFICIENT when any required TF has that blocking state, using deterministic severity precedence;
- includes timeframe-qualified reason codes, so the UI and later analytics can explain which TF failed;
- blocks all directional MTF output if any required TF is unavailable or not directionally eligible;
- must not treat three timeframes as three statistically independent confirmations.

A missing 1D, 4H or 1H response is not silently replaced by an old cached timeframe. Cached data may be shown as historical context, but a mixed-age MTF set must not be presented as one fresh synchronized snapshot.

## 7. Failure, cancellation and cache rules

- The three requests belong to one MTF request generation / request ID.
- If the user changes symbol or starts a newer MTF request, all older responses are ignored; abort signals should cancel outstanding requests where supported.
- One failed timeframe makes the assembled MTF snapshot unavailable for directional analysis.
- Do not combine fresh 1H with stale cached 4H/1D and label the result VALID.
- A previous complete MTF snapshot may be shown as stale context, but its decision must be WAIT and its aggregate quality STALE.
- A later successful refresh must rebuild all required TFs under a new common cutoff before directional permission returns.

## 8. Required deterministic tests

### Assembly and time
1. Three valid TF responses produce one shared cutoff equal to the minimum trusted provider time.
2. Provider times in different order still produce the same cutoff.
3. Missing provider time in any required TF blocks directional permission.
4. Provider-time spread within configured policy is accepted.
5. Provider-time spread beyond policy blocks the aggregate.
6. Common cutoff is never later than a required TF's trusted provider time.
7. Local fallback time cannot make an MTF snapshot directional-eligible.

### Candle finality
8. For each TF, exact boundary at cutoff minus 501 ms is closed-eligible.
9. Exact boundary at cutoff minus 500 ms is closed-eligible under the current `>` rejection predicate.
10. Cutoff minus 499 ms is not closed-eligible.
11. A candle closed according to a later TF response but not final at common cutoff is moved out of the closed set.
12. No candle later than the common cutoff enters closed analytics.
13. Reclassification preserves duplicate, malformed-row and gap findings.

### Coverage and quality
14. Coverage is recalculated from the common cutoff for 1H, 4H and 1D.
15. Short response / missing leading candle blocks according to the agreed coverage severity.
16. One invalid TF blocks aggregate directional output and reports the exact TF.
17. Missing TF blocks aggregate directional output.
18. A stale cached TF cannot be mixed with fresh TFs to produce VALID.
19. Fresh complete refresh after stale state restores eligibility only after all three TFs validate.

### Concurrency and determinism
20. Out-of-order HTTP completion does not change the assembled result.
21. Superseded request responses cannot mutate the current MTF snapshot.
22. One request failure cancels or safely ignores the other outstanding results.
23. Repeated execution on identical fixtures produces byte-equivalent canonical MTF content (excluding intentionally variable receive timestamps / IDs).
24. A response that legitimately contains a candle opened after the common cutoff excludes that candle without invalidating otherwise coherent MTF data; the excluded count is reported.
25. Actual Bybit V5-shaped rows pass through `BybitAdapter.normalize()` and then MTF assembly across 1H, 4H and 1D boundary rollovers.
26. The fetch path requests sufficient raw rows for the configured provider-time spread and forming row; the assembled common-cutoff series contains exactly the requested closed-candle count.
27. A short raw response is detected as incomplete coverage and cannot qualify for directional analysis.
28. Multiple active forming candidates produce an ambiguity reason and do not publish an arbitrary `formingCandle`.
29. Missing closed-count target, missing timeframe, interval mismatch or missing normalized candles produce stable per-timeframe diagnostics.
30. Immediately after an interval boundary, the just-closed candle is tracked as pending finality, the new interval candle remains the sole forming candle, and the MTF set is not rejected merely because both rows are not yet final.
31. Successful and failed assembled MTF snapshots are deeply immutable, including nested per-timeframe snapshots, candle arrays and quality reports.

All tests must assert status, directional permission, common cutoff, closed/forming membership and machine-readable reason codes where relevant.

## 9. Integration boundaries

- Keep `BybitAdapter` provider-specific. Add an MTF assembler above provider adapters; do not put MTF orchestration inside the Bybit-specific normalizer.
- Extend the canonical contract with an explicit MTF snapshot/assembler contract rather than overloading one-timeframe `Snapshot`.
- Keep per-timeframe validation reusable for a future second provider.
- Do not modify the existing chart's selected-timeframe flow until the MTF assembler has deterministic tests and a clear consumer.
- Do not add a second provider in this stage. B1-F will compare providers after B1-E is stable.
- Keep implementation in the current JavaScript architecture for this stage. A language migration is not justified by this requirement.

## 10. Acceptance criteria

B1-E is complete only when:
- the app can fetch 1D/4H/1H as one coordinated request;
- all three datasets are rebased to one trusted common cutoff;
- per-TF coverage and quality are recalculated/validated consistently;
- aggregate quality blocks directional output if any required TF is invalid, stale, missing or insufficient;
- stale/failure recovery cannot mix incompatible snapshots;
- all deterministic tests pass;
- integration with the future MTF analytics consumer is documented.

The current candidate implements the isolated MTF assembler and deterministic fixtures (32 MTF tests passing). This does not claim browser/live verification or production readiness. Live provider measurements are still required to finalize the provider-time spread policy before enabling directional use.
