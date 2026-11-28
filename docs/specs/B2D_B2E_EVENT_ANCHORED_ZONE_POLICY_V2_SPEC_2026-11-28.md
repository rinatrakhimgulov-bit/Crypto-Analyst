# B2D/B2E event-anchored relative zone policy v2

**Date:** 2026-11-28  
**Status:** opt-in research policy; v1 absolute-price behavior remains supported  
**Branch:** `feature/b2d-event-anchored-zone-policy-2026-11-28`

## Problem

The historical event study observed that the same B2-E breakout event could be reconstructed with different historical zone boundaries in later snapshots. The replay harness supplied `max_cluster_span_price = median(close over the full 260-candle snapshot) × ratio`. When the snapshot moved forward, the median changed, so the same past event could receive a different historical cluster width. The retest buffers were also absolute prices derived from that moving snapshot median.

This is undesirable for event-level historical research: the zone and retest tolerances for a past breakout should be anchored to information available at that breakout, not to the price scale of a later snapshot.

## V2 policy

### B2-D zone clustering
- Policy version: `b2d-relative-span-v2`.
- Cluster method: `MAX_TOTAL_SPAN_RELATIVE_V2`.
- Parameter: `max_cluster_span_ratio`, bounded to (0, 0.05].
- For current B2-D zones, the absolute clustering span is computed from the latest closed candle close × ratio.
- B2-D returns the ratio, basis price and resolved absolute span for auditability.

### B2-E historical zone reconstruction
- When the B2-D result declares `b2d-relative-span-v2`, B2-E reconstructs each historical zone with:
  `max_span = breakout_candle_close × max_cluster_span_ratio`.
- V1 absolute-span policy remains unchanged and backward compatible.
- The same event's historical zone should therefore be invariant across later snapshots when the event candle and policy ratio are unchanged.

### B2-E retest buffers
- Policy version: `retest-policy-relative-v2`.
- Touch tolerance, success buffer and failure buffer are explicit ratios.
- B2-E resolves each buffer from the breakout candle close, not the later snapshot median.
- Each lifecycle records the resolved absolute price thresholds.

## Research harness

- Existing `runZones` defaults to v1 for backward compatibility.
- The event outcome study opts into relative v2 explicitly.
- The event study records zone-boundary changes across repeated observations; expected result is zero.
- Retest status may still progress as future candles arrive. That is a legitimate lifecycle update, not policy drift.

## Acceptance tests

1. B2-D v2 resolves current span from latest closed close × ratio.
2. B2-D rejects out-of-range ratios and mismatched policy versions.
3. B2-E v2 uses breakout close × ratio for historical zones, ignoring a changed snapshot-level absolute span.
4. B2-E v2 resolves retest buffers from breakout close × ratio.
5. Existing v1 absolute-span and absolute-retest tests remain unchanged.
6. The unique breakout event outcome study must report zero historical zone-boundary changes across repeated observations.

## Boundaries

This policy does not assert that the selected ratio is optimal. It does not alter the app's live policy, LONG/SHORT/WAIT decision, or trading behavior. Historical B1 quality remains synthetic VALID and finality remains fixed at 500ms. No profitability claim is made.
