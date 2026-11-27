const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const HTML = path.resolve('CryptoAnalyst_StageA_S6_updated.html');
const PROBE_HTML = path.resolve('tools/b1_live_probe.html');
const PORT = 4173;
const transportProbe = { started: 0, closed: 0 };

async function getBybitKlines(symbol, interval) {
  const failures = [];
  for (const host of ['https://api.bybit.com', 'https://api.bytick.com']) {
    const url = new URL('/v5/market/kline', host);
    url.searchParams.set('category', 'linear');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', interval);
    url.searchParams.set('limit', '200');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (response.status === 403) {
        failures.push(`${new URL(host).host}: HTTP 403`);
        continue;
      }
      if (!response.ok) throw new Error(`Bybit HTTP ${response.status} for ${symbol}/${interval} at ${host}`);
      const json = await response.json();
      if (json.retCode !== 0 || !Array.isArray(json.result?.list) || !Number.isSafeInteger(Number(json.time))) {
        throw new Error(`Invalid Bybit payload for ${symbol}/${interval}: ${JSON.stringify(json).slice(0, 500)}`);
      }
      return {
        symbol, interval, rows: json.result.list,
        providerServerTimeMs: Number(json.time),
        hostUsed: new URL(host).host
      };
    } catch (error) {
      if (error && error.message && /HTTP 403/.test(error.message)) {
        failures.push(error.message);
        continue;
      }
      throw error;
    }
  }
  const blocked = new Error(`Bybit denied GitHub Actions runner on both public REST hosts: ${failures.join('; ')}`);
  blocked.code = 'PROVIDER_BLOCKED';
  throw blocked;
}

async function main() {
  if (!fs.existsSync(HTML)) throw new Error(`Missing candidate HTML: ${HTML}`);
  if (!fs.existsSync(PROBE_HTML)) throw new Error(`Missing live probe HTML: ${PROBE_HTML}`);
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, `http://127.0.0.1:${PORT}`).pathname;
    if (pathname === '/slow' || pathname.startsWith('/v5/market/')) {
      transportProbe.started++;
      const timer = setTimeout(() => {
        if (!res.destroyed) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ retCode: 0, result: { list: [] }, time: Date.now() }));
        }
      }, 2000);
      res.on('close', () => {
        clearTimeout(timer);
        if (res.destroyed) transportProbe.closed++;
      });
      return;
    }
    const file = pathname === '/tools/b1_live_probe.html' ? PROBE_HTML : HTML;
    if (!fs.existsSync(file)) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  try {
    await page.goto(`http://127.0.0.1:${PORT}?test=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() =>
      window.StageASelfTest &&
      window.B1DataContractSelfTest &&
      window.B1QualityValidatorSelfTest &&
      window.B1MtfSelfTest,
      { timeout: 15000 }
    );

    const suites = await page.evaluate(async () => {
      const stage = await window.StageASelfTest.runAll();
      const contract = window.B1DataContractSelfTest.runAll();
      const quality = window.B1QualityValidatorSelfTest.runAll();
      const mtf = await window.B1MtfSelfTest.runAll();
      return { stage, contract, quality, mtf };
    });

    for (const [name, result] of Object.entries(suites)) {
      if (result.rejected) throw new Error(`${name}: test run was rejected`);
      if (result.setupError) throw new Error(`${name}: setup error: ${result.setupError}`);
      if (result.cleanupErrors && result.cleanupErrors.length) {
        throw new Error(`${name}: cleanup errors: ${result.cleanupErrors.join('; ')}`);
      }
      if (!result.totals || result.totals.failed !== 0) {
        const failed = (result.results || []).filter(x => !x.passed);
        throw new Error(`${name}: ${JSON.stringify(result.totals)}; failed: ${JSON.stringify(failed)}`);
      }
    }

    // Exercise the real browser fetch stack and the real Bybit adapter's abort wiring
    // against a deliberately delayed local HTTP endpoint (no external network involved).
    const transportAbort = await page.evaluate(async () => {
      const originalHosts = BybitAdapter.hosts;
      BybitAdapter.hosts = [window.location.origin];
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
      try {
        const controller = new AbortController();
        const startedAt = performance.now();
        const pending = BybitAdapter.fetchMarketSnapshot('BTCUSDT', '60', controller.signal, 100)
          .then(() => ({ resolved: true }))
          .catch(error => ({ resolved: false, name: error.name, message: error.message }));
        await delay(75);
        controller.abort(new Error('synthetic browser transport cancellation'));
        const outcome = await pending;
        const elapsedMs = performance.now() - startedAt;

        const timeoutStartedAt = performance.now();
        let timeoutOutcome;
        try {
          await BybitAdapter.fetchJsonWithTimeout(window.location.origin + '/slow', null, 75);
          timeoutOutcome = { aborted: false };
        } catch (error) {
          timeoutOutcome = { aborted: error.name === 'TimeoutError', name: error.name, message: error.message };
        }
        const timeoutElapsedMs = performance.now() - timeoutStartedAt;
        return { adapterAbort: outcome, adapterElapsedMs: elapsedMs, timeout: timeoutOutcome, timeoutElapsedMs };
      } finally {
        BybitAdapter.hosts = originalHosts;
      }
    });
    if (transportAbort.adapterAbort.resolved !== false ||
        transportAbort.adapterAbort.name !== 'AbortError' ||
        transportAbort.adapterElapsedMs > 1500 ||
        transportAbort.timeout.aborted !== true ||
        transportAbort.timeoutElapsedMs > 1500) {
      throw new Error(`Browser transport cancellation checks failed: ${JSON.stringify(transportAbort)}`);
    }
    // Allow the Node HTTP server to observe browser-side socket closure.
    await new Promise(resolve => setTimeout(resolve, 200));
    if (transportProbe.started < 3 || transportProbe.closed < 3) {
      throw new Error(`Browser transport requests were not all aborted at the HTTP layer: ${JSON.stringify(transportProbe)}`);
    }

    const gate = await page.evaluate(() => {
      const candles = Array.from({ length: 120 }, (_, i) => {
        const close = 100 + i * 0.2 + Math.sin(i / 3);
        return {
          ts: 1700000000000 + i * 3600000,
          closeTs: 1700000000000 + (i + 1) * 3600000,
          open: close - 0.1, high: close + 1, low: close - 1,
          close, volume: 100 + (i % 7) * 3, turnover: close * (100 + (i % 7) * 3)
        };
      });
      const toCanonicalCandles = list => list.map(c => ({
        open_time_ms: c.ts, close_time_ms: c.closeTs,
        open: c.open, high: c.high, low: c.low, close: c.close,
        volume_base: c.volume, volume_quote: c.turnover
      }));
      const base = {
        interval: '60',
        canonicalSnapshot: { snapshot_id: 'gate-test-snapshot', candles_by_timeframe: { '1h': toCanonicalCandles(candles) } },
        closedCandles: candles,
        prices: {
          lastClosedPrice: candles[candles.length - 1].close,
          formingClosePrice: null, tickerLastPrice: null,
          currentMarketPrice: candles[candles.length - 1].close,
          currentPriceSource: 'gate-test', priceWarning: null
        }
      };
      const blockedStatuses = ['UNASSESSED', 'INVALID', 'STALE', 'INSUFFICIENT', 'DEGRADED'];
      const blocked = blockedStatuses.map(status => {
        const analysis = BasicAnalyticsEngine.analyze({
          ...base,
          qualityReport: {
            status, validator_version: B1QualityValidator.VERSION,
            policy_version: B1_QUALITY_POLICY.version, snapshot_id: 'gate-test-snapshot',
            reasons: [{ code: 'GATE_TEST_' + status }]
          }
        });
        return {
          status, decision: analysis.decision,
          blocked: analysis.qualityGate && analysis.qualityGate.blocked,
          gateStatus: analysis.qualityGate && analysis.qualityGate.status,
          emptyIndicators: analysis.ema20.length === 0 && analysis.ema50.length === 0 && analysis.ema200.length === 0 && analysis.atr14.length === 0,
          emptyLevels: analysis.levels.resistance === null && analysis.levels.support === null
        };
      });
      const emptyInsufficient = BasicAnalyticsEngine.analyze({
        interval: '60',
        canonicalSnapshot: { snapshot_id: 'empty-snapshot', candles_by_timeframe: { '1h': [] } },
        closedCandles: [],
        prices: { lastClosedPrice: null, formingClosePrice: null, tickerLastPrice: null, currentMarketPrice: null, currentPriceSource: 'none', priceWarning: null },
        qualityReport: {
          status: 'INSUFFICIENT', validator_version: B1QualityValidator.VERSION,
          policy_version: B1_QUALITY_POLICY.version, snapshot_id: 'empty-snapshot',
          reasons: [{ code: 'INSUFFICIENT_HISTORY' }]
        }
      });
      const missing = BasicAnalyticsEngine.analyze(base);
      const valid = BasicAnalyticsEngine.analyze({
        ...base, qualityReport: {
          status: 'VALID', validator_version: B1QualityValidator.VERSION,
          policy_version: B1_QUALITY_POLICY.version, snapshot_id: 'gate-test-snapshot', reasons: []
        }
      });
      const longCandles = Array.from({ length: 260 }, (_, i) => {
        const close = 200 + i * 0.15 + Math.sin(i / 7);
        return {
          ts: 1701000000000 + i * 3600000,
          closeTs: 1701000000000 + (i + 1) * 3600000,
          open: close - 0.2, high: close + 0.8, low: close - 0.9,
          close, volume: 80 + (i % 11) * 4, turnover: close * (80 + (i % 11) * 4)
        };
      });
      const ema200Probe = BasicAnalyticsEngine.analyze({
        ...base,
        closedCandles: longCandles,
        canonicalSnapshot: { snapshot_id: 'gate-test-ema200', candles_by_timeframe: { '1h': toCanonicalCandles(longCandles) } },
        prices: {
          ...base.prices,
          lastClosedPrice: longCandles[259].close,
          currentMarketPrice: longCandles[259].close
        },
        qualityReport: {
          status: 'VALID', validator_version: B1QualityValidator.VERSION,
          policy_version: B1_QUALITY_POLICY.version, snapshot_id: 'gate-test-ema200', reasons: []
        }
      });
      const mismatched = BasicAnalyticsEngine.analyze({
        ...base, qualityReport: {
          status: 'VALID', validator_version: 'old-validator',
          policy_version: B1_QUALITY_POLICY.version, snapshot_id: 'gate-test-snapshot', reasons: []
        }
      });
      const policyMismatched = BasicAnalyticsEngine.analyze({
        ...base, qualityReport: {
          status: 'VALID', validator_version: B1QualityValidator.VERSION,
          policy_version: 'old-policy', snapshot_id: 'gate-test-snapshot', reasons: []
        }
      });
      const seriesMismatched = BasicAnalyticsEngine.analyze({
        ...base,
        closedCandles: base.closedCandles.map((c, i) => i === base.closedCandles.length - 1 ? { ...c, close: c.close + 1 } : c),
        qualityReport: {
          status: 'VALID', validator_version: B1QualityValidator.VERSION,
          policy_version: B1_QUALITY_POLICY.version, snapshot_id: 'gate-test-snapshot', reasons: []
        }
      });
      const snapshotMismatched = BasicAnalyticsEngine.analyze({
        ...base, qualityReport: {
          status: 'VALID', validator_version: B1QualityValidator.VERSION,
          policy_version: B1_QUALITY_POLICY.version, snapshot_id: 'different-snapshot', reasons: []
        }
      });
      const now = Date.now();
      const step = 3600000;
      const lastOpen = Math.floor(now / step) * step;
      const rows = [];
      for (let i = 0; i < 160; i++) {
        const ts = lastOpen - i * step;
        const close = 50000 + (159 - i) * 2 + Math.sin((159 - i) / 5);
        const open = close - 0.4;
        const high = close + 2;
        const low = open - 2;
        const volume = 100 + (i % 9);
        rows.push([String(ts), open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2), String(volume), (volume * close).toFixed(2)]);
      }
      const normalized = BybitAdapter.normalize(rows, {
        symbol: 'BTCUSDT', interval: '60', hostUsed: 'api.bybit.com',
        serverTimeMs: now, providerServerTimeMs: now, timeSource: 'provider',
        clockSkewMs: 0, requestedCount: 160,
        tickerStatus: { available: false, price: null, timeMs: null, hostUsed: 'api.bybit.com', error: 'gate fixture' }
      });
      const normalizedSnapshot = B1DataContract.toSnapshot(normalized);
      const normalizedReport = B1QualityValidator.validate(normalizedSnapshot, B1_QUALITY_POLICY, Date.now()).report;
      const normalizedAnalysis = BasicAnalyticsEngine.analyze({ ...normalized, canonicalSnapshot: normalizedSnapshot, qualityReport: normalizedReport });

      const badSnapshot = structuredClone(normalizedSnapshot);
      badSnapshot.candles_by_timeframe['1h'][0].volume_base = -1;
      const invalidReport = B1QualityValidator.validate(badSnapshot, B1_QUALITY_POLICY, Date.now()).report;
      const invalidAnalysis = BasicAnalyticsEngine.analyze({ ...normalized, canonicalSnapshot: badSnapshot, qualityReport: invalidReport });

      const staleReport = B1QualityValidator.validate(normalizedSnapshot, B1_QUALITY_POLICY, Date.now() + 121000).report;
      const staleAnalysis = BasicAnalyticsEngine.analyze({ ...normalized, canonicalSnapshot: normalizedSnapshot, qualityReport: staleReport });

      // Exercise the real DOM renderer with an invalid report. The panel must explain
      // why the quality gate blocked directional analysis, not merely show INVALID.
      renderSuccess({ ...normalized, canonicalSnapshot: badSnapshot, qualityReport: invalidReport }, invalidAnalysis);
      const qualityPanelText = document.getElementById('dataQualityList').textContent;
      const decisionBadgeText = document.getElementById('decisionBadge').textContent;
      const uiGate = {
        statusVisible: qualityPanelText.includes('INVALID'),
        reasonVisible: qualityPanelText.includes('VOLUME_NEGATIVE'),
        blockedVisible: qualityPanelText.includes('Заблокирована'),
        waitVisible: decisionBadgeText === 'WAIT',
        panelText: qualityPanelText
      };

      return {
        blocked,
        emptyInsufficient: { decision: emptyInsufficient.decision, status: emptyInsufficient.qualityGate && emptyInsufficient.qualityGate.status, blocked: emptyInsufficient.qualityGate && emptyInsufficient.qualityGate.blocked, reasonCodes: emptyInsufficient.qualityGate && emptyInsufficient.qualityGate.reasonCodes },
        missing: { decision: missing.decision, blocked: missing.qualityGate && missing.qualityGate.blocked },
        valid: {
          decision: valid.decision, blocked: valid.qualityGate && valid.qualityGate.blocked,
          status: valid.qualityGate && valid.qualityGate.status,
          ema20Count: valid.ema20.length, ema50Count: valid.ema50.length, atr14Count: valid.atr14.length
        },
        ema200Probe: {
          count: ema200Probe.ema200.length,
          warmupNull: ema200Probe.ema200[198] === null,
          firstValueFinite: Number.isFinite(ema200Probe.ema200[199]),
          lastValueFinite: Number.isFinite(ema200Probe.ema200[259])
        },
        mismatched: { decision: mismatched.decision, blocked: mismatched.qualityGate && mismatched.qualityGate.blocked, status: mismatched.qualityGate && mismatched.qualityGate.status, reasonCodes: mismatched.qualityGate && mismatched.qualityGate.reasonCodes },
        seriesMismatched: {
          decision: seriesMismatched.decision,
          blocked: seriesMismatched.qualityGate && seriesMismatched.qualityGate.blocked,
          status: seriesMismatched.qualityGate && seriesMismatched.qualityGate.status,
          reasonCodes: seriesMismatched.qualityGate && seriesMismatched.qualityGate.reasonCodes
        },
        snapshotMismatched: {
          decision: snapshotMismatched.decision,
          blocked: snapshotMismatched.qualityGate && snapshotMismatched.qualityGate.blocked,
          status: snapshotMismatched.qualityGate && snapshotMismatched.qualityGate.status,
          reasonCodes: snapshotMismatched.qualityGate && snapshotMismatched.qualityGate.reasonCodes
        },
        policyMismatched: {
          decision: policyMismatched.decision,
          blocked: policyMismatched.qualityGate && policyMismatched.qualityGate.blocked,
          status: policyMismatched.qualityGate && policyMismatched.qualityGate.status,
          reasonCodes: policyMismatched.qualityGate && policyMismatched.qualityGate.reasonCodes
        },
        normalized: {
          status: normalizedReport.status, validCount: normalizedReport.valid_count,
          rawCount: normalized.quality.totalFetched, invalidRows: normalized.quality.invalidRows,
          blocked: normalizedAnalysis.qualityGate && normalizedAnalysis.qualityGate.blocked,
          ema20Count: normalizedAnalysis.ema20.length,
          ema50Count: normalizedAnalysis.ema50.length,
          atr14Count: normalizedAnalysis.atr14.length
        },
        invalid: {
          status: invalidReport.status, decision: invalidAnalysis.decision,
          blocked: invalidAnalysis.qualityGate && invalidAnalysis.qualityGate.blocked,
          ema20Count: invalidAnalysis.ema20.length
        },
        uiGate,
        stale: {
          status: staleReport.status, decision: staleAnalysis.decision,
          blocked: staleAnalysis.qualityGate && staleAnalysis.qualityGate.blocked,
          ema20Count: staleAnalysis.ema20.length
        }
      };
    });
    const gateFailures = [
      ...gate.blocked.filter(x =>
        x.decision !== 'WAIT' || x.blocked !== true || x.gateStatus !== x.status ||
        x.emptyIndicators !== true || x.emptyLevels !== true
      ),
      ...(gate.emptyInsufficient.decision !== 'WAIT' || gate.emptyInsufficient.status !== 'INSUFFICIENT' || gate.emptyInsufficient.blocked !== true || !gate.emptyInsufficient.reasonCodes.includes('INSUFFICIENT_HISTORY') ? [{ case: 'empty-insufficient-series', ...gate.emptyInsufficient }] : []),
      ...(gate.missing.decision !== 'WAIT' || gate.missing.blocked !== true ? [{ case: 'missing-report', ...gate.missing }] : []),
      ...(gate.valid.blocked !== false || gate.valid.status !== 'VALID' ||
          gate.valid.ema20Count === 0 || gate.valid.ema50Count === 0 || gate.valid.atr14Count === 0
        ? [{ case: 'valid-report', ...gate.valid }] : []),
      ...(gate.ema200Probe.count !== 260 || gate.ema200Probe.warmupNull !== true ||
          gate.ema200Probe.firstValueFinite !== true || gate.ema200Probe.lastValueFinite !== true
        ? [{ case: 'ema200-calculation', ...gate.ema200Probe }] : []),
      ...(gate.mismatched.decision !== 'WAIT' || gate.mismatched.blocked !== true ||
          gate.mismatched.status !== 'INVALID' || !gate.mismatched.reasonCodes.includes('QUALITY_REPORT_VERSION_MISMATCH')
          ? [{ case: 'validator-version-mismatch', ...gate.mismatched }] : []),
      ...(gate.seriesMismatched.decision !== 'WAIT' || gate.seriesMismatched.blocked !== true ||
          !gate.seriesMismatched.reasonCodes.includes('ANALYTICS_CANDLE_DATA_MISMATCH')
        ? [{ case: 'analytics-candles-mismatch', ...gate.seriesMismatched }] : []),
      ...(gate.snapshotMismatched.decision !== 'WAIT' ||
          !gate.snapshotMismatched.reasonCodes.includes('QUALITY_REPORT_SNAPSHOT_MISMATCH')
        ? [{ case: 'snapshot-mismatched-report', ...gate.snapshotMismatched }] : []),
      ...(gate.policyMismatched.decision !== 'WAIT' ||
          gate.policyMismatched.status !== 'INVALID' || !gate.policyMismatched.reasonCodes.includes('QUALITY_REPORT_VERSION_MISMATCH')
          ? [{ case: 'policy-version-mismatch', ...gate.policyMismatched }] : []),
      ...(gate.normalized.status !== 'VALID' || gate.normalized.validCount < 100 ||
          gate.normalized.rawCount !== 160 || gate.normalized.invalidRows !== 0 ||
          gate.normalized.blocked !== false || gate.normalized.ema20Count === 0 ||
          gate.normalized.ema50Count === 0 || gate.normalized.atr14Count === 0
        ? [{ case: 'normalized-valid-fixture', ...gate.normalized }] : []),
      ...(gate.invalid.status !== 'INVALID' || gate.invalid.decision !== 'WAIT' ||
          gate.invalid.blocked !== true || gate.invalid.ema20Count !== 0
        ? [{ case: 'invalid-validation-gate', ...gate.invalid }] : []),
      ...(gate.uiGate.statusVisible !== true || gate.uiGate.reasonVisible !== true ||
          gate.uiGate.blockedVisible !== true || gate.uiGate.waitVisible !== true
        ? [{ case: 'quality-gate-ui', ...gate.uiGate }] : []),
      ...(gate.stale.status !== 'STALE' || gate.stale.decision !== 'WAIT' ||
          gate.stale.blocked !== true || gate.stale.ema20Count !== 0
        ? [{ case: 'stale-validation-gate', ...gate.stale }] : [])
    ];
    if (gateFailures.length) throw new Error(`B1 mandatory gate failures: ${JSON.stringify(gateFailures)}`);

    const liveUiIntegration = await page.evaluate(() => {
      const h = window.__CryptoAnalystTestHooks;
      if (!h || !h.handleLiveTicker || !h.handleLiveKline) throw new Error('B1-D live UI hooks unavailable');
      const { chart, state, BybitWsClient, handleLiveTicker, handleLiveKline, clearLiveDataState } = h;
      const savedChart = {
        candles: chart.candles.slice(), closedCount: chart.closedCount, analysis: chart.analysis,
        marketPrice: chart.marketPrice, visibleCount: chart.visibleCount, offsetFromEnd: chart.offsetFromEnd
      };
      const savedSelection = { symbol: state.symbol, interval: state.interval };
      const savedClient = {
        status: BybitWsClient.state.status,
        confirmedTopics: BybitWsClient.state.confirmedTopics,
        tickerBySymbol: BybitWsClient.state.tickerBySymbol
      };
      try {
        state.symbol = 'BTCUSDT';
        state.interval = '240';
        BybitWsClient.state.status = 'open';
        BybitWsClient.state.confirmedTopics = new Set(['tickers.BTCUSDT', 'kline.240.BTCUSDT']);
        BybitWsClient.state.tickerBySymbol = new Map([['BTCUSDT', {
          symbol: 'BTCUSDT', ready: true, snapshotReceived: true,
          state: { symbol: 'BTCUSDT', lastPrice: '65000' }
        }]]);
        const base = [
          { ts: 1000, closeTs: 2000, open: 65000, high: 65001, low: 64999, close: 65000, volume: 1, turnover: 65000 },
          { ts: 2000, closeTs: 3000, open: 65000, high: 65001, low: 64999, close: 65000, volume: 1, turnover: 65000 }
        ];
        chart.setData(base, 1, null, 100);
        handleLiveTicker({
          symbol: 'BTCUSDT', lastPrice: 65001.5, providerEventTimeMs: Date.now(),
          receivedAtMs: Date.now(), cs: 123, type: 'delta', connGen: BybitWsClient.state.connGen
        });
        const tickerUi = {
          price: document.getElementById('livePrice').textContent,
          source: document.getElementById('priceSourceLabel').textContent,
          chartPrice: chart.marketPrice
        };
        handleLiveKline({
          valid: true, symbol: 'BTCUSDT', interval: '240', receivedAtMs: Date.now(),
          candle: {
            ts: 2000, closeTs: 3000, open: 65000, high: 65002, low: 64999,
            close: 65001.5, volume: 2, turnover: 130003, confirmed: false
          }
        });
        const klineUi = {
          close: chart.candles[1].close,
          volume: chart.candles[1].volume,
          closedCount: chart.closedCount
        };
        return { tickerUi, klineUi };
      } finally {
        clearLiveDataState();
        chart.setData(savedChart.candles, savedChart.closedCount, savedChart.analysis, savedChart.marketPrice);
        chart.visibleCount = savedChart.visibleCount;
        chart.offsetFromEnd = savedChart.offsetFromEnd;
        chart.render();
        state.symbol = savedSelection.symbol;
        state.interval = savedSelection.interval;
        BybitWsClient.state.status = savedClient.status;
        BybitWsClient.state.confirmedTopics = savedClient.confirmedTopics;
        BybitWsClient.state.tickerBySymbol = savedClient.tickerBySymbol;
      }
    });
    if (liveUiIntegration.tickerUi.price !== '65001.5' ||
        !liveUiIntegration.tickerUi.source.includes('Bybit WS lastPrice') ||
        liveUiIntegration.tickerUi.chartPrice !== 65001.5 ||
        liveUiIntegration.klineUi.close !== 65001.5 ||
        liveUiIntegration.klineUi.volume !== 2 ||
        liveUiIntegration.klineUi.closedCount !== 1) {
      throw new Error(`B1-D live UI integration failed: ${JSON.stringify(liveUiIntegration)}`);
    }

    const chartVisual = await page.evaluate(() => {
      const chart = window.__CryptoAnalystTestHooks && window.__CryptoAnalystTestHooks.chart;
      if (!chart) throw new Error('Chart test hook was not exposed');
      const closed = Array.from({ length: 260 }, (_, i) => {
        const close = 300 + i * 0.1 + Math.sin(i / 5);
        return {
          ts: 1710000000000 + i * 3600000,
          closeTs: 1710000000000 + (i + 1) * 3600000,
          open: close - 0.15, high: close + 0.7, low: close - 0.8,
          close, volume: 100 + (i % 9) * 10, turnover: close * (100 + (i % 9) * 10)
        };
      });
      const formingClose = closed[259].close + 0.3;
      const forming = {
        ts: closed[259].ts + 3600000, closeTs: closed[259].closeTs + 3600000,
        open: closed[259].close, high: formingClose + 0.4,
        low: closed[259].close - 0.3, close: formingClose,
        volume: 145, turnover: formingClose * 145
      };
      const ema = (offset, start) => closed.map((c, i) => i < start ? null : c.close + offset);
      const canvas = chart.canvas;
      const ctx = chart.ctx;
      const originalFillRect = ctx.fillRect.bind(ctx);
      const originalStroke = ctx.stroke.bind(ctx);
      const originalLineTo = ctx.lineTo.bind(ctx);
      const stats = { volumeBars: 0, formingVolumeMuted: 0, ema200Strokes: 0, ema200MaxX: -Infinity };
      ctx.fillRect = function(x, y, w, h) {
        const style = String(this.fillStyle);
        if (style.includes('34, 197, 94') || style.includes('239, 68, 68')) stats.volumeBars++;
        if (style.includes('148, 163, 184, 0.35')) stats.formingVolumeMuted++;
        return originalFillRect(x, y, w, h);
      };
      ctx.stroke = function() {
        if (this.strokeStyle === '#eab308') stats.ema200Strokes++;
        return originalStroke();
      };
      ctx.lineTo = function(x, y) {
        if (this.strokeStyle === '#eab308') stats.ema200MaxX = Math.max(stats.ema200MaxX, x);
        return originalLineTo(x, y);
      };
      // This chart-render regression specifically verifies EMA200. The app's
      // Clean preset intentionally hides EMA overlays, so enable them for this test.
      chart.setDisplayLayer('emas', true);
      chart.visibleCount = 80;
      chart.offsetFromEnd = 0;
      chart.setData([...closed, forming], closed.length, {
        closedCandlesRef: closed,
        ema20: ema(-1.5, 19),
        ema50: ema(-0.5, 49),
        ema200: ema(0.5, 199),
        swings: { highs: [], lows: [] },
        levels: { support: null, resistance: null }
      }, forming.close);
      ctx.fillRect = originalFillRect;
      ctx.stroke = originalStroke;
      ctx.lineTo = originalLineTo;
      const metrics = chart.getPlotMetrics();
      const stepX = metrics.plotW / 80;
      const lastClosedCenterX = metrics.padLeft + 78.5 * stepX;
      return {
        ...stats,
        expectedMinimumVolumeBars: 70,
        ema200StayedOnClosedCandles: stats.ema200MaxX <= lastClosedCenterX + 0.5,
        canvasWidth: canvas.clientWidth,
        canvasHeight: canvas.clientHeight
      };
    });
    if (chartVisual.volumeBars < chartVisual.expectedMinimumVolumeBars ||
        chartVisual.formingVolumeMuted < 1 ||
        chartVisual.ema200Strokes < 1 ||
        chartVisual.ema200StayedOnClosedCandles !== true ||
        chartVisual.canvasWidth < 100 || chartVisual.canvasHeight < 100) {
      throw new Error(`Chart overlay/volume visual checks failed: ${JSON.stringify(chartVisual)}`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileChartVisual = await page.evaluate(() => {
      const chart = window.__CryptoAnalystTestHooks && window.__CryptoAnalystTestHooks.chart;
      if (!chart) throw new Error('Chart test hook unavailable in mobile viewport');
      chart.render();
      const rect = chart.canvas.getBoundingClientRect();
      const metrics = chart.getPlotMetrics();
      const pricePlotH = Math.max(50, metrics.plotH * 0.72);
      const volumeTop = 16 + pricePlotH + 10;
      const volumeBottom = 16 + metrics.plotH - 12;
      return {
        viewportWidth: window.innerWidth,
        canvasWidth: chart.canvas.clientWidth,
        canvasHeight: chart.canvas.clientHeight,
        canvasRight: rect.right,
        plotWidth: metrics.plotW,
        volumePaneHeight: Math.max(10, volumeBottom - volumeTop)
      };
    });
    if (mobileChartVisual.viewportWidth !== 390 ||
        mobileChartVisual.canvasWidth < 280 ||
        mobileChartVisual.canvasHeight < 280 ||
        mobileChartVisual.canvasRight > mobileChartVisual.viewportWidth + 1 ||
        mobileChartVisual.plotWidth < 200 ||
        mobileChartVisual.volumePaneHeight < 30) {
      throw new Error(`Mobile chart layout checks failed: ${JSON.stringify(mobileChartVisual)}`);
    }

    const post = suites.stage.post || {};
    const requiredRestoration = [
      'fetchRestored', 'hooksRestored', 'configRestored',
      'snapshotsRestored', 'clockRestored', 'visibilityRestored', 'onLineRestored'
    ];
    const unrestored = requiredRestoration.filter(key => post[key] !== true);
    if (unrestored.length) throw new Error(`Stage A cleanup did not restore: ${unrestored.join(', ')}`);

    const probePage = await browser.newPage();
    probePage.on('pageerror', error => pageErrors.push('live-probe: ' + error.message));
    const probeExternalRequests = [];
    probePage.on('request', request => {
      if (/^https:\/\/(api\.bybit\.com|api\.bytick\.com)\//.test(request.url())) probeExternalRequests.push(request.url());
    });
    await probePage.goto(`http://127.0.0.1:${PORT}/tools/b1_live_probe.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const liveProbeUi = await probePage.evaluate(() => ({
      title: document.title,
      ready: document.getElementById('status')?.textContent,
      startEnabled: !document.getElementById('start')?.disabled,
      stopDisabled: document.getElementById('stop')?.disabled,
      exportDisabled: document.getElementById('export')?.disabled,
      copyDisabled: document.getElementById('copy')?.disabled,
      schemaV3Present: document.documentElement.innerHTML.includes('crypto-analyst-b1-live-capture-v3')
    }));
    if (!liveProbeUi.title.includes('B1 Live Data Probe v3') ||
        !liveProbeUi.ready.includes('No requests have been made') ||
        !liveProbeUi.startEnabled || !liveProbeUi.stopDisabled ||
        !liveProbeUi.exportDisabled || !liveProbeUi.copyDisabled ||
        !liveProbeUi.schemaV3Present || probeExternalRequests.length !== 0) {
      throw new Error(`Live probe initial UI checks failed: ${JSON.stringify({ liveProbeUi, probeExternalRequests })}`);
    }

    // GitHub-hosted runners may be denied by Bybit. Record this as an explicit
    // environment limitation, never as a successful live-data test.
    const browserFetchProbe = await page.evaluate(async () => {
      try {
        const response = await fetch('https://api.bybit.com/v5/market/time', { cache: 'no-store' });
        return { ok: response.ok, status: response.status };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    });

    let liveBybit;
    try {
      const inputs = [];
      for (const symbol of ['BTCUSDT', 'ETHUSDT']) {
        for (const interval of ['60', '240', 'D']) inputs.push(await getBybitKlines(symbol, interval));
      }
      const checks = await page.evaluate(items => {
        const policy = {
          version: 'ci-live-smoke-2026-11-27',
          finality_safety_lag_ms: 500,
          future_tolerance_ms: 30000,
          max_transport_age_ms: 120000,
          max_market_series_lag_ms_by_timeframe: {
            '1h': 7200000, '4h': 28800000, '1d': 172800000
          },
          minimum_required_count_by_timeframe: {
            '1h': 100, '4h': 100, '1d': 100
          },
          allow_identical_duplicates: true
        };
        return items.map(input => {
          const providerTime = input.providerServerTimeMs;
          const dataset = BybitAdapter.normalize(input.rows, {
            symbol: input.symbol, interval: input.interval,
            hostUsed: input.hostUsed, serverTimeMs: providerTime,
            providerServerTimeMs: providerTime, timeSource: 'provider',
            clockSkewMs: providerTime - Date.now(), requestedCount: 200,
            tickerStatus: {
              available: false, price: null, timeMs: null,
              hostUsed: input.hostUsed, error: 'Ticker excluded from kline quality smoke test'
            }
          });
          const snapshot = B1DataContract.toSnapshot(dataset);
          const report = B1QualityValidator.validate(snapshot, policy, Date.now()).report;
          return {
            symbol: input.symbol, interval: input.interval, host: dataset.hostUsed,
            timeSource: dataset.timeSource, rawRows: dataset.quality.totalFetched,
            invalidRows: dataset.quality.invalidRows, candles: dataset.allCandles.length,
            closedCandles: dataset.closedCandles.length, status: report.status,
            reasons: report.reasons.map(reason => reason.code)
          };
        });
      });
      const bad = checks.filter(x =>
        !['api.bybit.com', 'api.bytick.com'].includes(x.host) ||
        x.timeSource !== 'provider' || x.rawRows !== 200 || x.invalidRows !== 0 ||
        x.candles < 100 || x.closedCandles < 100 ||
        !['VALID', 'DEGRADED'].includes(x.status)
      );
      if (bad.length) throw new Error(`Live Bybit data-quality checks failed: ${JSON.stringify(bad)}`);
      liveBybit = { status: 'PASS', checks };
    } catch (error) {
      if (error && error.code === 'PROVIDER_BLOCKED') {
        liveBybit = { status: 'SKIPPED_PROVIDER_BLOCKED', reason: error.message };
      } else {
        throw error;
      }
    }

    if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
    console.log(JSON.stringify({
      stageA: suites.stage.totals,
      b1Contract: suites.contract.totals,
      b1Quality: suites.quality.totals,
      b1Mtf: suites.mtf.totals,
      liveProbeUi,
      b1Gate: gate,
      chartVisual,
      mobileChartVisual,
      transportAbort: { ...transportAbort, server: transportProbe },
      cleanup: post, browserFetchProbe, liveBybit, pageErrors
    }, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
