'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const HTML = path.resolve('CryptoAnalyst_StageA_S6_updated.html');
const PORT = 4174;

async function main() {
  if (!fs.existsSync(HTML)) throw new Error('Missing integrated application HTML');
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    fs.createReadStream(HTML).pipe(res);
  });
  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    await page.goto(`http://127.0.0.1:${PORT}?test=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__CryptoAnalystTestHooks?.runB2Analysis, { timeout: 15000 });
    const result = await page.evaluate(() => {
      const hooks = window.__CryptoAnalystTestHooks;
      const step = 3600000;
      const providerTime = Date.now();
      const lastClosedOpen = Math.floor(providerTime / step) * step - 2 * step;
      const count = 220;
      const rows = [];
      for (let i = 0; i < count; i++) {
        const ts = lastClosedOpen - (count - 1 - i) * step;
        const wave = Math.sin(i * 0.47) * 1.7 + Math.sin(i * 0.13) * 2.4;
        const trend = i * 0.035;
        const close = 50000 + trend + wave;
        const open = close - Math.sin(i * 0.31) * 0.8;
        const high = Math.max(open, close) + 0.7 + Math.abs(Math.sin(i * 0.17)) * 1.2;
        const low = Math.min(open, close) - 0.7 - Math.abs(Math.cos(i * 0.19)) * 1.1;
        rows.push([String(ts), open.toFixed(6), high.toFixed(6), low.toFixed(6), close.toFixed(6), String(10 + (i % 7)), String((10 + (i % 7)) * close)]);
      }
      rows.reverse(); // Bybit V5 returns newest first.
      const dataset = BybitAdapter.normalize(rows, {
        symbol: 'BTCUSDT', interval: '60', hostUsed: 'api.bybit.com',
        serverTimeMs: providerTime, providerServerTimeMs: providerTime,
        timeSource: 'provider', clockSkewMs: 0, requestedCount: count,
        tickerStatus: { available: false, price: null, timeMs: null, hostUsed: 'api.bybit.com', error: 'Synthetic browser fixture' }
      });
      dataset.canonicalSnapshot = B1DataContract.toSnapshot(dataset);
      dataset.qualityReport = B1QualityValidator.validate(dataset.canonicalSnapshot, B1_QUALITY_POLICY, Date.now()).report;
      const analysis = hooks.runB2Analysis(dataset);
      hooks.renderB2Panel(analysis);
      hooks.renderB7Panel(analysis.status === 'VALID' ? analysis.setups : null);
      if (analysis.status === 'VALID') {
        hooks.chart.setData(dataset.allCandles, dataset.closedCandles.length, {
          closedCandlesRef: dataset.closedCandles, ema20: [], ema50: [], ema200: [],
          swings: { highs: [], lows: [] }, levels: { support: null, resistance: null }
        }, dataset.prices.currentMarketPrice);
        hooks.chart.setMarketStructure(analysis.projection);
      }
      const blockedDataset = {
        ...dataset,
        qualityReport: { ...dataset.qualityReport, status: 'STALE' }
      };
      const blocked = hooks.runB2Analysis(blockedDataset);
      const chart = hooks.chart;
      const zone = analysis.projection.zones[0] || null;
      let zoneDraw = { count: 0, x: null, expectedX: null, visibleFromMs: zone?.visible_from_ms ?? null };
      if (zone) {
        const ctx = chart.ctx;
        const originalFillRect = ctx.fillRect.bind(ctx);
        const metrics = chart.getPlotMetrics();
        const endIdx = Math.max(1, chart.candles.length - chart.offsetFromEnd);
        const startIdx = Math.max(0, endIdx - chart.visibleCount);
        const firstVisible = chart.candles.findIndex(c => c.ts >= zone.visible_from_ms);
        const visibleIdx = Math.max(startIdx, firstVisible);
        const stepX = metrics.plotW / (endIdx - startIdx);
        zoneDraw.expectedX = metrics.padLeft + (visibleIdx - startIdx) * stepX;
        ctx.fillRect = function(x, y, w, height) {
          if (String(this.fillStyle).includes('0.055')) {
            zoneDraw.count++;
            zoneDraw.x = x;
          }
          return originalFillRect(x, y, w, height);
        };
        try { chart.render(); } finally { ctx.fillRect = originalFillRect; }
      }
      return {
        qualityStatus: dataset.qualityReport.status,
        closedCount: dataset.closedCandles.length,
        status: analysis.status,
        stage: analysis.stage || null,
        reasons: analysis.reasons || [],
        pivots: analysis.projection?.swing_markers?.length ?? 0,
        events: analysis.projection?.structure_events?.length ?? 0,
        zones: analysis.projection?.zones?.length ?? 0,
        retests: analysis.projection?.retest_lifecycles?.length ?? 0,
        mtfContext: analysis.projection && Object.prototype.hasOwnProperty.call(analysis.projection, 'mtf_context') ? analysis.projection.mtf_context : 'MISSING',
        chartProjectionAttached: hooks.chart.marketStructure?.status === 'VALID',
        zoneDraw,
        panelStatus: document.getElementById('b2Status')?.textContent,
        setupStatus: analysis.setups?.status || null,
        setupCount: analysis.setups?.setup_candidates?.length ?? null,
        setupPanelStatus: document.getElementById('b7Status')?.textContent,
        setupEngineAvailable: typeof hooks.B7ExplainableSetupEngine?.analyze === 'function',
        blockedQualityStatus: blocked.status,
        blockedStage: blocked.stage
      };
    });
    if (result.qualityStatus !== 'VALID' || result.closedCount < 100 ||
        result.status !== 'VALID' || result.chartProjectionAttached !== true ||
        result.panelStatus !== 'VALID · 1H' ||
        result.setupStatus !== 'VALID' ||
        !String(result.setupPanelStatus || '').startsWith('VALID · ') ||
        result.setupEngineAvailable !== true ||
        result.blockedQualityStatus !== 'BLOCKED' || result.blockedStage !== 'B1' ||
        result.mtfContext !== null ||
        (result.zones > 0 && (result.zoneDraw.count < 1 ||
          Math.abs(result.zoneDraw.x - result.zoneDraw.expectedX) > 0.75))) {
      throw new Error('B2 browser integration assertions failed: ' + JSON.stringify(result));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => {
      const card = document.getElementById('b2StructureCard');
      const setupCard = document.getElementById('b7SetupCard');
      const chart = document.getElementById('chartCanvas');
      return {
        cardVisible: Boolean(card && card.getBoundingClientRect().height > 0),
        setupCardVisible: Boolean(setupCard && setupCard.getBoundingClientRect().height > 0),
        cardWidth: card?.getBoundingClientRect().width ?? 0,
        chartWidth: chart?.getBoundingClientRect().width ?? 0,
        chartHeight: chart?.getBoundingClientRect().height ?? 0,
        viewportWidth: window.innerWidth,
        noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1
      };
    });
    if (!layout.cardVisible || !layout.setupCardVisible || layout.cardWidth < 250 || layout.chartWidth < 250 || !layout.noHorizontalOverflow || layout.chartHeight < 440) {
      throw new Error('B2/B3 mobile layout assertions failed: ' + JSON.stringify(layout));
    }
    const displayChecks = await page.evaluate(async () => {
      const chart = window.__CryptoAnalystTestHooks.chart;
      const modes = [...document.querySelectorAll('[data-chart-mode]')];
      const layers = [...document.querySelectorAll('[data-chart-layer]')];
      const initial = {
        mode: chart.displayMode,
        zones: chart.displayLayers.zones,
        pivots: chart.displayLayers.pivots,
        events: chart.displayLayers.events,
        retests: chart.displayLayers.retests,
        emas: chart.displayLayers.emas,
        activeMode: document.querySelector('[data-chart-mode="clean"]')?.getAttribute('aria-pressed')
      };
      document.querySelector('[data-chart-mode="structure"]').click();
      const structure = {
        mode: chart.displayMode,
        events: chart.displayLayers.events,
        retests: chart.displayLayers.retests,
        activeMode: document.querySelector('[data-chart-mode="structure"]')?.getAttribute('aria-pressed')
      };
      document.querySelector('[data-chart-layer="events"]').click();
      const custom = {
        mode: chart.displayMode,
        events: chart.displayLayers.events,
        eventsPressed: document.querySelector('[data-chart-layer="events"]')?.getAttribute('aria-pressed')
      };
      document.querySelector('[data-chart-mode="full"]').click();
      const full = {
        mode: chart.displayMode,
        legacyLevels: chart.displayLayers.legacyLevels,
        events: chart.displayLayers.events,
        retests: chart.displayLayers.retests
      };
      document.querySelector('[data-chart-mode="clean"]').click();
      const cleanHeight = document.getElementById('chartCanvas').getBoundingClientRect().height;
      return { initial, structure, custom, full, cleanHeight, layerButtons: layers.length, modeButtons: modes.length };
    });
    if (displayChecks.initial.mode !== 'clean' || displayChecks.initial.zones !== true ||
        displayChecks.initial.pivots !== true || displayChecks.initial.events !== false || displayChecks.initial.emas !== false ||
        displayChecks.initial.activeMode !== 'true' ||
        displayChecks.structure.mode !== 'structure' || displayChecks.structure.events !== true ||
        displayChecks.structure.retests !== true || displayChecks.structure.activeMode !== 'true' ||
        displayChecks.custom.mode !== 'custom' || displayChecks.custom.events !== false ||
        displayChecks.custom.eventsPressed !== 'false' ||
        displayChecks.full.mode !== 'full' || displayChecks.full.legacyLevels !== true ||
        displayChecks.full.events !== true || displayChecks.full.retests !== true ||
        displayChecks.layerButtons !== 6 || displayChecks.modeButtons !== 3 ||
        displayChecks.cleanHeight < 440) {
      throw new Error('B3 chart display control assertions failed: ' + JSON.stringify(displayChecks));
    }
    if (pageErrors.length) throw new Error('Browser page errors: ' + pageErrors.join(' | '));
    console.log(JSON.stringify({ b2: result, mobileLayout: layout, pageErrors }, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
