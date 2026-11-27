# Independent B1-A/B/E audit — 2026-11-27

## Audited artifact

- Repository: `rinatrakhimgulov-bit/Crypto-Analyst`
- Branch: `impl/b1-quality-contract-2026-11-26`
- PR: #6 (draft; not merged)
- HTML blob: `842c361a8386c358a68f22407814c376fd3bde1b`
- B1-E specification blob: `0481400d46be50ff353b73783c769e220ca60bda`
- Prior audits do not count as approval of this exact candidate.

## Independent audit result

**External reviewer verdict: APPROVE WITH CONDITIONS.**

The reviewer independently fetched the exact HTML blob and ran the production implementations in Node.js + vm, without DOM, browser or network:

| Suite / probe | Result |
|---|---:|
| `B1EMtfSelfTest.runAll()` | 33/33 PASS |
| `B1QualitySelfTest.runAll()` | 65/65 PASS |
| V5-shaped rows → actual normalize → assemble | PASS |
| 1H boundary, short response, multiple forming | PASS |
| Deep freeze and missing expected-count probes | PASS |

No CRITICAL defect was found that currently permits `directionalAllowed: true` for a known misaligned or unclosed MTF snapshot.

## Findings and disposition

### HIGH

1. **Forming-candle OHLCV/alignment is not validated by the canonical Quality Gate.**
   - Accepted for the current B1-E library stage because forming candles are not consumed by the MTF directional pipeline, and MTF is not connected to directional decisions.
   - Before directional integration, either validate forming candles strictly or enforce and test an invariant that forming data cannot influence directional scoring.

2. **No live Bybit evidence or provider-time spread calibration.**
   - Remains an explicit release condition for directional MTF use.
   - Measure the actual provider-time spread across concurrent 1D/4H/1H requests, retain representative raw responses, verify coverage/overfetch behavior, and document a fail-closed `maxProviderTimeSpreadMs` policy.
   - No production default is to be guessed.

### MEDIUM

3. **Direct `assemble()` calls require `mtfExpectedClosedCount`.**
   - Missing target correctly fails closed as INVALID.
   - This is an explicit input contract, not a current correctness defect. A fallback to `coverage.requestedLimit` is not required unless direct external callers become a supported API. If added, it must be explicit and tested rather than silently inferred.

4. **Actual network abort behavior was not exercised by the external audit.**
   - Source inspection of the exact HTML blob confirms the signal chain:
     `fetchAndAssemble()` passes its controller signal to `fetchMarketSnapshot()`; the adapter passes it to `fetchJsonWithTimeout()`; that helper links the external signal to its own controller and supplies `controller.signal` to `fetch()`.
   - Therefore the source-level propagation is implemented. A transport-level abort test remains useful, but no architecture change is indicated.

5. **Aggregate forced-INVALID code list requires maintenance as new MTF reason codes are added.**
   - Current multiple-forming handling is included. Existing per-timeframe CRITICAL quality statuses also participate in aggregate status.
   - Add any future global CRITICAL MTF reason code to the forced-INVALID policy and test it.

## Accepted limitations

- Forming OHLCV validation is deferred until forming data is considered by directional analysis.
- MTF remains isolated and is not connected to UI, chart or LONG/SHORT decision path.
- No production spread default is supplied; missing/invalid spread configuration fails closed.
- The 1000-row Bybit cap is enforced; excessive spread/history requirements must fail rather than silently reduce requested history.

## Verification limits

The external audit used Node.js + vm with no DOM, browser or live network. It did not verify live Bybit jitter, recorded real HTTP payloads, Chrome/iPhone Safari, full `StageASelfTest` 44/44, or actual browser network-stack cancellation.

A direct attempt to access Bybit REST endpoints through the available web retrieval path was not supported. No live measurements are claimed here.

## Decision

- **Research/observability:** acceptable to proceed with controlled real-data observation, with MTF still disconnected from directional decisions.
- **Merge:** no source-level CRITICAL/HIGH correctness defect was identified in the exact candidate. Browser regression and the agreed merge policy remain to be completed before merging.
- **Directional MTF:** NOT APPROVED until live/recorded 1D/4H/1H integration evidence, measured and documented spread policy, and a forming-candle safety invariant are in place.

## Next sequence

1. Capture concurrent real Bybit 1D/4H/1H responses with provider timestamps and request/receive timestamps.
2. Run those recorded responses through the actual adapter normalization and MTF assembly; retain a reproducible cassette/fixture.
3. Derive and document a conservative, fail-closed spread policy from measurements.
4. Verify the browser regression suite and transport abort behavior.
5. Before directional integration, add forming-candle validation or a tested non-consumption invariant.
