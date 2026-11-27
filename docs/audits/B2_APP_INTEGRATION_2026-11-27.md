# B2 Application Integration Preview — 2026-11-27

## Status

**Browser integration passed. iPhone/Safari acceptance pending. Not approved for production trading decisions.**

Candidate branch: `integration/b2-market-structure-ui-2026-11-27`.

## What is integrated

- B2-A causal swing pivots.
- B2-B swing sequence and HH/HL/LH/LL labels.
- B2-C structure state, BOS and CHoCH events.
- B2-D confirmed support/resistance zones and candidate levels.
- B2-E breakout/retest lifecycles.
- B2-G causal chart projection.
- UI panel for structure, pivot counts, latest event, zones, retests and MTF status.
- Chart overlay for swing labels, structure events and confirmed zones.

The modules are inlined into the single-file HTML prototype. The original B1 quality report and canonical snapshot are the admission boundary. Non-VALID or stale B1 quality blocks the B2 pipeline. B2 runtime errors are isolated from the Stage A rendering path.

## Deliberate MTF limitation

B2-F is embedded in the application candidate but not invoked by the live UI. B2-G now accepts an explicit null B2-F result and returns `mtf_context: null`. A supplied B2-F result still undergoes the original strict validation.

Reason: the configured provider-time spread threshold has not been empirically calibrated from concurrent live Bybit 1D/4H/1H captures. No MTF confluence or directional permission is shown as valid in the app until that calibration is complete.

## Provisional display parameters

- Swing pivot strength: 2 left / 2 right candles.
- Maximum S/R cluster span: 0.1% of median close.
- Retest touch tolerance and success/failure buffers: 0.05% of median close.
- These are research-preview defaults, not optimized or validated trading parameters.

## Verification evidence

- B2 research suite: [run 46034125614](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46034125614), 182/182 tests passed.
- B2 browser integration: [run 46034125941](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46034125941), passed.
- Synthetic browser fixture: 220 closed candles; 33 swing markers; 65 structure events; 2 confirmed zones; 2 retest lifecycles.
- Stale B1 quality: B2 blocked at stage B1.
- Mobile viewport: 390×844; B2 card visible; chart 334 px wide; no horizontal overflow.
- B1 browser suite: [run 46034125888](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46034125888), passed with zero page errors. Live Bybit capture was skipped because the GitHub runner received HTTP 403.
- Historical replay: [run 46032038435](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46032038435), 18/18 prefix checks. It uses a third-party archive ending 2025-12-05 and a synthetic B1-valid wrapper; it is not a live 2026 Bybit validation.

## Remaining gates

1. Owner checks the integrated app on iPhone Safari.
2. Capture live concurrent Bybit 1D/4H/1H provider times and calibrate the MTF spread policy.
3. Independent exact-source review of the integrated HTML and B2 modules.
4. Calibrate pivot/zone/retest parameters on out-of-sample data before considering any use in trade decisions.

## Repository safety

- `main` was not modified.
- No PR has been merged.
- This is an integration preview only. B2 output is not connected to LONG/SHORT/WAIT and is not a trading signal.


## Clean PR snapshot

The integration preview was repackaged on a branch directly based on current `main` to avoid carrying the entire research branch ancestry into the application PR.

- Branch: `integration/b2-clean-preview-2026-11-27`
- Draft PR #22: https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/pull/22
- `main` is unchanged and the PR is not merged.

## Final clean-branch verification update

The clean PR head was re-run after the branch packaging and workflow updates.

- B2 application integration: [run 46034803848](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46034803848), success. All seven module test steps and the Chromium/mobile integration step completed successfully.
- B2 deterministic suite: [run 46034803544](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46034803544), success. The suite contains 182 tests across B2-A through B2-G.
- B1 browser/data suite: [run 46034808544](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46034808544), success. B1 deterministic groups reported 50/50, 32/32, 72/72 and 20/20; browser pageErrors were zero.
- Live Bybit REST check in that B1 run was **not executed successfully**: the runner received HTTP 403 from both `api.bybit.com` and `api.bytick.com`, recorded as `SKIPPED_PROVIDER_BLOCKED`. This is an environment restriction, not a Bybit production outage and not live-market verification.
- Synthetic B2 browser fixture: 220 closed candles; chart projection produced two zones and two retest lifecycles; mobile viewport width 390px reported no horizontal overflow.
- Main comparison: PR branch is 9 commits ahead, 0 behind, based on the exact current main commit. No merge was performed.

These checks establish deterministic and synthetic browser integration only. They do not establish iPhone Safari behavior, live provider timing, trading profitability, or production-ready thresholds.


## Clean PR #22 CI refresh

- B2 research suite: [run 46034803544](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46034803544), passed.
- B2 browser/mobile integration: [run 46034803848](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46034803848), passed. The chart renderer test confirms that the confirmed-zone fill begins at the projection's causal `visible_from_ms` x-position (observed x=250, expected x=250), not at the left edge of earlier candles.
- B1 browser/live-data suite: [run 46034803715](https://github.com/rinatrakhimgulov-bit/Crypto-Analyst/actions/runs/46034803715), passed with zero page errors; live Bybit capture was skipped due runner HTTP 403.
