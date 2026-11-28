'use strict';

const fs = require('node:fs');
const {
  loadRows, runStructure, runZones, runAnalyticalContext,
  summarizeAnalyticalContext, FILES, STEP, LAG
} = require('./b2_historical_replay.cjs');

const WINDOW_BARS = 260; // Enough for EMA200 plus causal structure context.
const STRIDE_BARS = { '1h': 336, '4h': 84, '1d': 14 }; // Approximately every 14 calendar days.
const REPORT_PATH = 'analytical_context_historical_replay_report.json';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sampleEndIndices(length, timeframe) {
  const stride = STRIDE_BARS[timeframe];
  assert(Number.isInteger(stride) && stride > 0, 'INVALID_STRIDE:' + timeframe);
  const indices = [];
  for (let index = WINDOW_BARS - 1; index < length; index += stride) indices.push(index);
  if (indices.length && indices[indices.length - 1] !== length - 1) indices.push(length - 1);
  return indices;
}

function addCount(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function compactWindow(result, endRow, symbol, timeframe, index) {
  const summary = summarizeAnalyticalContext(result);
  const regime = summary.regime || {};
  const impulse = summary.impulse || {};
  const zones = summary.zones || {};
  const breakout = summary.breakout_quality || {};
  return {
    sample_index: index,
    cutoff_time: new Date(endRow.close_time_ms).toISOString(),
    cutoff_ms: endRow.close_time_ms + LAG,
    regime: regime.label || 'UNKNOWN',
    directional_bias: regime.directional_bias || 'UNKNOWN',
    evidence_alignment: regime.evidence_alignment || 'UNKNOWN',
    structure_state: regime.structure_state || 'UNKNOWN',
    support_available: Boolean(zones.nearest_support),
    resistance_available: Boolean(zones.nearest_resistance),
    active_zone_count: zones.active || 0,
    stale_zone_count: zones.stale || 0,
    breakout_count: breakout.evaluated_count || 0,
    breakout_quality_counts: breakout.quality_counts || {},
    latest_breakout: breakout.latest || null,
    impulse_classification: impulse.classification || 'UNKNOWN',
    impulse_direction: impulse.direction || 'UNKNOWN',
    displacement_atr: impulse.displacement_atr ?? null,
    range_expansion_atr: impulse.range_expansion_atr ?? null,
    directional_pressure: impulse.directional_pressure ?? null,
    volume_ratio: impulse.volume_ratio ?? null,
    bearish_breakout_context: impulse.bearish_breakout_context || null
  };
}

async function replaySeries(symbol, timeframe, file) {
  const loaded = await loadRows(file, timeframe);
  const rows = loaded.rows;
  const indices = sampleEndIndices(rows.length, timeframe);
  const distribution = {
    regimes: {}, directional_biases: {}, impulse_classifications: {},
    breakout_quality: {}, support_windows: 0, resistance_windows: 0,
    windows_with_breakouts: 0, total_breakout_events: 0
  };
  const windows = [];

  for (let n = 0; n < indices.length; n++) {
    const endIndex = indices[n];
    const slice = rows.slice(endIndex - WINDOW_BARS + 1, endIndex + 1);
    const end = slice[slice.length - 1];
    const asOf = end.close_time_ms + LAG;
    const id = ['analytical-replay', symbol, timeframe, end.open_time_ms].join(':');
    const structure = runStructure(slice, symbol, timeframe, asOf, id);
    const zones = runZones(structure, symbol, timeframe);
    const context = runAnalyticalContext(structure, zones, WINDOW_BARS);

    assert(context.regime.status === 'VALID', symbol + ' ' + timeframe + ' regime not VALID at ' + end.open_time_ms);
    assert(context.zoneContext.status === 'VALID', symbol + ' ' + timeframe + ' zone context not VALID at ' + end.open_time_ms);
    assert(context.breakoutQuality.status === 'VALID', symbol + ' ' + timeframe + ' breakout quality not VALID at ' + end.open_time_ms);
    assert(context.impulse.status === 'VALID', symbol + ' ' + timeframe + ' impulse not VALID at ' + end.open_time_ms);

    // Causal cutoff checks: no output may depend on a candle that had not closed at this snapshot.
    assert(context.zoneContext.zones.every(zone => zone.available_at_ms <= asOf),
      'ZONE_LOOKAHEAD:' + symbol + ':' + timeframe + ':' + end.open_time_ms);
    assert(context.breakoutQuality.breakouts.every(item =>
      item.breakout_candle_close_time_ms <= asOf - LAG),
      'BREAKOUT_LOOKAHEAD:' + symbol + ':' + timeframe + ':' + end.open_time_ms);
    assert(context.impulse.event.window_end_close_time_ms <= asOf - LAG,
      'IMPULSE_LOOKAHEAD:' + symbol + ':' + timeframe + ':' + end.open_time_ms);

    const item = compactWindow(context, end, symbol, timeframe, n);
    windows.push(item);
    addCount(distribution.regimes, item.regime);
    addCount(distribution.directional_biases, item.directional_bias);
    addCount(distribution.impulse_classifications, item.impulse_classification);
    for (const [key, value] of Object.entries(item.breakout_quality_counts)) {
      distribution.breakout_quality[key] = (distribution.breakout_quality[key] || 0) + value;
    }
    if (item.support_available) distribution.support_windows++;
    if (item.resistance_available) distribution.resistance_windows++;
    if (item.breakout_count > 0) distribution.windows_with_breakouts++;
    distribution.total_breakout_events += item.breakout_count;
  }

  return {
    symbol, timeframe,
    dataset_integrity: loaded.integrity,
    method: {
      lookback_bars: WINDOW_BARS,
      stride_bars: STRIDE_BARS[timeframe],
      approximate_calendar_stride_days: 14,
      sampled_windows: windows.length,
      first_sample: windows[0]?.cutoff_time || null,
      last_sample: windows[windows.length - 1]?.cutoff_time || null,
      cutoff_rule: 'closed candles only; analysis_as_of = final close_time + fixed 500ms research lag'
    },
    distribution,
    windows
  };
}

async function main() {
  const output = {
    report_version: 'analytical-context-historical-replay-v1',
    generated_at: new Date().toISOString(),
    dataset: {
      repository: 'mestoness/btc-eth-candles-history',
      commit: '9ca04178df06ce649f00779a49e11094fe5b1c70',
      venue_description: 'Bybit USDT-M perpetual historical OHLCV archive',
      coverage_end: '2025-12-05'
    },
    scope: 'Research-only causal replay of Market Regime, B2-D Zone Context, B2-E Breakout Quality and Market Impulse Event engines. Not a trading strategy backtest.',
    limitations: [
      'The historical archive ends on 2025-12-05 and does not include 2026 market data.',
      'B1 quality is represented by the existing synthetic VALID wrapper after CSV integrity checks; the live B1 validator and historical provider timestamps are not independently replayed.',
      'Candle finality uses a fixed 500ms time-derived research lag.',
      'Sampling is approximately every 14 calendar days, not every candle; short-lived regimes and events between samples can be missed.',
      'No entries, exits, fees, funding, slippage, realized PnL, expectancy, win rate or drawdown are evaluated.',
      'Thresholds are frozen engineering defaults for this run, not optimized or approved trading parameters.'
    ],
    series: {}
  };

  for (const symbol of Object.keys(FILES)) {
    output.series[symbol] = {};
    for (const timeframe of ['1h', '4h', '1d']) {
      output.series[symbol][timeframe] =
        await replaySeries(symbol, timeframe, FILES[symbol][timeframe]);
    }
  }

  const all = Object.values(output.series).flatMap(byTf => Object.values(byTf));
  output.summary = {
    series_count: all.length,
    total_sampled_windows: all.reduce((sum, series) => sum + series.method.sampled_windows, 0),
    regime_distribution: {},
    impulse_distribution: {},
    breakout_quality_distribution: {},
    support_available_windows: all.reduce((sum, series) => sum + series.distribution.support_windows, 0),
    resistance_available_windows: all.reduce((sum, series) => sum + series.distribution.resistance_windows, 0),
    windows_with_breakouts: all.reduce((sum, series) => sum + series.distribution.windows_with_breakouts, 0),
    total_breakout_events: all.reduce((sum, series) => sum + series.distribution.total_breakout_events, 0)
  };
  for (const series of all) {
    for (const [key, value] of Object.entries(series.distribution.regimes)) {
      output.summary.regime_distribution[key] = (output.summary.regime_distribution[key] || 0) + value;
    }
    for (const [key, value] of Object.entries(series.distribution.impulse_classifications)) {
      output.summary.impulse_distribution[key] = (output.summary.impulse_distribution[key] || 0) + value;
    }
    for (const [key, value] of Object.entries(series.distribution.breakout_quality)) {
      output.summary.breakout_quality_distribution[key] = (output.summary.breakout_quality_distribution[key] || 0) + value;
    }
  }

  assert(output.summary.series_count === 6, 'EXPECTED_SIX_SERIES');
  assert(output.summary.total_sampled_windows >= 500, 'HISTORICAL_SAMPLE_COUNT_TOO_LOW');
  fs.writeFileSync(REPORT_PATH, JSON.stringify(output, null, 2) + '\n');
  process.stdout.write(JSON.stringify(output.summary, null, 2) + '\n');
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write((error && error.stack) || String(error));
    process.exitCode = 1;
  });
}

module.exports = { sampleEndIndices, compactWindow, replaySeries, WINDOW_BARS, STRIDE_BARS };
