# B2 preliminary historical replay — 2026-11-27

**Status:** Preliminary data-quality and pivot-sensitivity replay. Not a final algorithm audit, not a profitability test, and not an integration approval.

## Dataset and scope

Exploratory replay used the public repository [mestoness/btc-eth-candles-history](https://github.com/mestoness/btc-eth-candles-history), whose README identifies the files as Bybit USDT-M perpetual OHLCV for BTCUSDT and ETHUSDT. The repository exposes 1H, 4H and 1D CSV files. No candle files were copied into this repository.

Coverage:
- BTCUSDT: 2020-03-25 through 2025-12-05.
- ETHUSDT: 2021-03-15 through 2025-12-05.

This is third-party archived data, not a fresh capture from Bybit. The source repository has no visible licence declaration. The replay is for internal research only; do not redistribute its data.

## Input integrity checks

All six files were checked for parseable timestamps, finite positive OHLC values, OHLC envelope consistency, timeframe-grid alignment, duplicate timestamps and missing intervals.

| Symbol | TF | Rows | Invalid OHLC | Duplicates | Gaps | Off-grid |
|---|---:|---:|---:|---:|---:|---:|
| BTCUSDT | 1H | 49,957 | 0 | 0 | 0 | 0 |
| BTCUSDT | 4H | 12,489 | 0 | 0 | 0 | 0 |
| BTCUSDT | 1D | 2,081 | 0 | 0 | 0 | 0 |
| ETHUSDT | 1H | 41,447 | 0 | 0 | 0 | 0 |
| ETHUSDT | 4H | 10,361 | 0 | 0 | 0 | 0 |
| ETHUSDT | 1D | 1,726 | 0 | 0 | 0 | 0 |

These checks establish internal consistency of the downloaded CSV rows only. They do not prove the third-party archive is byte-for-byte identical to Bybit's current REST output.

## Pivot sensitivity: symmetric exact-price windows

A standalone replay of the B2-A candidate's symmetric left/right window, exact-price plateau handling and rightmost plateau representative was run with equal strengths 2, 3 and 5. This was a pivot-count/sensitivity diagnostic, not execution of the complete B2-A→B2-G module chain.

| Symbol | TF | Strength | High pivots | Low pivots | Dual high+low on same candle | Total raw pivots |
|---|---:|---:|---:|---:|---:|---:|
| BTCUSDT | 1H | 2/2 | 7,138 | 7,074 | 337 | 14,212 |
| BTCUSDT | 1H | 3/3 | 5,122 | 5,050 | 154 | 10,172 |
| BTCUSDT | 1H | 5/5 | 3,295 | 3,246 | 60 | 6,541 |
| BTCUSDT | 4H | 2/2 | 1,818 | 1,769 | 113 | 3,587 |
| BTCUSDT | 4H | 3/3 | 1,293 | 1,297 | 45 | 2,590 |
| BTCUSDT | 4H | 5/5 | 832 | 809 | 8 | 1,641 |
| BTCUSDT | 1D | 2/2 | 289 | 287 | 20 | 576 |
| BTCUSDT | 1D | 3/3 | 205 | 204 | 9 | 409 |
| BTCUSDT | 1D | 5/5 | 127 | 139 | 3 | 266 |
| ETHUSDT | 1H | 2/2 | 5,814 | 5,957 | 275 | 11,771 |
| ETHUSDT | 1H | 3/3 | 4,178 | 4,215 | 103 | 8,393 |
| ETHUSDT | 1H | 5/5 | 2,617 | 2,678 | 33 | 5,295 |
| ETHUSDT | 4H | 2/2 | 1,458 | 1,464 | 83 | 2,922 |
| ETHUSDT | 4H | 3/3 | 1,046 | 1,048 | 40 | 2,094 |
| ETHUSDT | 4H | 5/5 | 680 | 660 | 7 | 1,340 |
| ETHUSDT | 1D | 2/2 | 228 | 247 | 12 | 475 |
| ETHUSDT | 1D | 3/3 | 165 | 183 | 4 | 348 |
| ETHUSDT | 1D | 5/5 | 105 | 123 | 1 | 228 |

The 2/2 setting produces a large number of pivots, especially on 1H. Increasing strength materially reduces pivot density. No strength is selected as production policy by this replay alone; the choice must be judged against chart readability, event stability and later out-of-sample behavior.

## Finding B2-A/B-REPLAY-001 — simultaneous dual pivots have no valid chronological order

**Severity:** HIGH — sequence integrity.

The replay found same-candle swing highs and swing lows under the current 2/2 pivot definition:
- BTCUSDT: 337 on 1H, 113 on 4H, 20 on 1D.
- ETHUSDT: 275 on 1H, 83 on 4H, 12 on 1D.

The current B2-A output sorts pivots sharing the same availability and source timestamp by pivot type. B2-B then treats that stable sort order as if it were a chronological alternating swing sequence. OHLC candles do not reveal whether the high or low occurred first inside that candle. Alphabetical/type ordering is deterministic, but it is not market evidence.

**Required correction before integration:** preserve both raw pivot observations, but do not admit either member of a same-source-candle high/low pair into the alternating B2-B sequence. Mark the pair explicitly as ambiguous for sequence purposes, preserve the reason in raw evidence, and ensure B2-C cannot use either ambiguous pivot as a BOS/CHoCH source level. B2-D may still retain their high/low prices as separate S/R evidence only if the policy explicitly allows same-candle dual-role evidence; otherwise exclude them there too. Add end-to-end regressions through B2-B, B2-C, B2-D, B2-E and B2-G.

**Correction implemented on the B2-G candidate branch** (commit `541498ca3ca755fdb49198dcddc5cfd8058a5082`): B2-B is now engine `2.1.0-b2b` / policy `b2b-swing-sequence-v2`; same-source high/low pairs are retained as `AMBIGUOUS_FOR_SEQUENCE` with an explicit exclusion reason and omitted from the active sequence. B2-C independently reconstructs and validates this status and cannot use either member as a structure level. B2-D/B2-E/B2-F bind to the new B2-B identity. B2-G exposes these observations in a separate `ambiguous_pivots` collection, never as active swing markers.

**Verification:** GitHub Actions integrated B2-A→B2-G suite `46030400410` passed 180/180 tests: B2-A 21, B2-B 21, B2-C 34, B2-D 21, B2-E 24, B2-F 30, B2-G 29. Standalone B2-G run `46030400495` also passed. This closes the deterministic regression for the identified defect, but does not replace the pending full historical module replay or independent audit.

## Remaining audit work

1. Implement and test the simultaneous dual-pivot policy, then rerun the full B2-A→B2-G suite.
2. Execute the actual engine chain on the historical candles, not only a standalone pivot-count replay.
3. Inspect event lifecycle quality, zone clustering and retest classification across trend, range, impulse, reversal and false-breakout periods.
4. Test prefix invariance and batch/online equivalence against historical prefixes.
5. Calibrate pivot strength, zone span and retest tolerances per symbol/timeframe. Current absolute-price and retest parameters are research inputs, not calibrated market facts.
6. Obtain an exact-source independent review.
7. Complete B1 formal acceptance: live concurrent Bybit 1D/4H/1H capture and provider-time spread calibration, exact current-candidate review, browser/iPhone acceptance and owner approval.
8. Only after all gates pass, prepare a separate integration candidate. No main HTML or main-branch change is authorized by this report.

## Explicit limitations

- The data ends on 2025-12-05 and does not cover current 2026 market behavior.
- The source is a third-party archive claiming Bybit perpetual provenance; no live Bybit cross-check was possible in this replay.
- This report does not claim that the B2-A through B2-G modules were executed against these full historical rows.
- No LONG/SHORT decision, win rate, expectancy, drawdown or profitability result was measured.
- B1 remains NOT ACCEPTED. Production integration remains blocked.
