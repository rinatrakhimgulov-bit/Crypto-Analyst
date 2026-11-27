# B2-F Internal Implementation Review

**Date:** 2026-11-27  
**Review type:** Internal static source review and deterministic verification  
**Module:** `src/analysis/b2f-mtf-structure-confluence-engine.js`  
**Candidate head:** `4a2cf7fc621cb9120f7e5cd5cc10bab99aac3b32`  
**PR:** #19 (draft, unmerged)  
**Independent external review:** Not performed

## Scope reviewed

- B1-E MTF result contract and exact required timeframe order.
- Common cutoff, provider-time minimum and spread recomputation.
- Per-timeframe canonical snapshot, quality report and selected closed-candle window identity.
- Exact B2-C result identity for 1D, 4H and 1H.
- B2-C event uniqueness, chronological order, timeframe-aligned close timestamps and exact finality availability.
- Alignment classification, hierarchical interpretation and lower-timeframe consensus.
- Output immutability and absence of trade-decision fields.

## Findings and corrections

1. **Display market type vs canonical market type:** B1 MTF outer result uses a display label such as `Linear Perpetual`, while canonical snapshots use `linear_perpetual`. Comparing them directly would block valid real output. B2-F now uses the canonical per-timeframe snapshot for identity and preserves the display label separately.
2. **Actual B1 quality policy:** B1's actual policy version is `b1-quality-policy-2026-11-27-v1`; B2-F binds to this exact value, not the earlier synthetic fixture label.
3. **Provider spread policy:** B2-F now requires an explicit configured maximum provider-time spread and verifies the MTF result carries the same value. It independently recomputes the actual spread and verifies the minimum provider time equals the common cutoff.
4. **Snapshot isolation:** duplicate snapshot IDs and extra per-timeframe candle series are rejected.
5. **Event causality:** each B2-C event close must be positive and aligned to its timeframe, and availability must equal break close plus the exact B1 finality lag.

## Verification

- B2-F suite: **30/30** passed in GitHub Actions run [46020226993](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46020226993).
- Integrated B2-A through B2-F suite: **149/149** passed in [run 46020227119](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46020227119).

The latest docs-only candidate head was subsequently re-run: B2-F 30/30 in [run 46020226993](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46020226993), integrated 149/149 in [run 46020227119](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46020227119).

## Limitations and remaining gates

- The B1MtfEngine implementation is statically inspected; it is not invoked by this Node test suite. The three-timeframe integration uses actual B2-A/B/C engines over synthetic per-timeframe snapshots and a synthetic B1-E-shaped result.
- No live Bybit MTF data run or iPhone/Safari verification.
- B2-F does not aggregate B2-D zones or B2-E retest lifecycles across timeframes.
- It emits structural context only, not LONG/SHORT/WAIT, probability, confidence, SL/TP or profitability claims.
- B1 remains NOT ACCEPTED. B2-F is research-only and not imported into application HTML.
