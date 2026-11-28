'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const HTML = path.resolve('CryptoAnalyst_StageA_S6_updated.html');
const PORT = 4176;

async function main() {
  if (!fs.existsSync(HTML)) throw new Error('Missing integrated application HTML');
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    fs.createReadStream(HTML).pipe(res);
  });
  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    await page.route(/https:\/\/(api\.bybit\.com|api\.bytick\.com)\/.*/, route =>
      route.fulfill({ status: 503, contentType: 'application/json', body: '{"retCode":10000,"retMsg":"test blocked"}' }));
    await page.goto(`http://127.0.0.1:${PORT}?test=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__CryptoAnalystTestHooks?.journal, { timeout: 15000 });

    const setup = await page.evaluate(() => {
      const h = window.__CryptoAnalystTestHooks;
      const { state, journal } = h;
      state.symbol = 'BTCUSDT';
      state.interval = '240';
      const now = Date.now();
      const step = 4 * 60 * 60 * 1000;
      const first = Math.floor(now / step) * step - 160 * step;
      const allCandles = [];
      for (let i = 0; i < 160; i++) {
        const ts = first + i * step;
        const close = 60000 + i * 2;
        allCandles.push({
          ts, closeTs: ts + step, open: close - 1, high: close + 2,
          low: close - 2, close, volume: 10 + i, turnover: (10 + i) * close
        });
      }
      allCandles.push({
        ts: now + step, closeTs: now + 2 * step, open: 60400, high: 60410,
        low: 60390, close: 60405, volume: 170, turnover: 10268850
      });
      const dataset = {
        symbol: 'BTCUSDT', interval: '240', source: 'Bybit', marketType: 'Linear Perpetual',
        hostUsed: 'api.bybit.com', fetchedAtLocalMs: now, providerServerTimeMs: now,
        prices: { currentMarketPrice: 60320, currentPriceSource: 'Bybit REST', tickerLastPrice: 60320 },
        quality: { gaps: 0, duplicates: 0, invalidRows: 0, invalidTimestamps: 0 },
        qualityReport: { status: 'VALID', validator_version: '1.1.0', reasons: [] },
        allCandles, closedCandles: allCandles.slice(0, 159),
        canonicalSnapshot: { symbol: 'BTCUSDT', interval: '240', candles: [] }
      };
      const analysis = {
        decision: 'LONG',
        reasons: ['Тестовое условие LONG', 'Подтверждение по структуре'],
        metrics: { lastEma20: 60200, lastEma50: 60100, atrPct: 1.2 },
        levels: { support: 59800, resistance: 61000 },
        qualityGate: { blocked: false, status: 'VALID', reasons: [] }
      };
      state.snapshotsByKey.set('BTCUSDT:240', { symbol: 'BTCUSDT', interval: '240', dataset, analysis });
      window.localStorage.removeItem('cryptoAnalyst.marketJournal.v1');
      journal.initialize();
      return {
        canCapture: journal.canCapture(),
        buttonEnabled: document.getElementById('journalSaveBtn').disabled === false,
        allCandles: dataset.allCandles.length
      };
    });
    if (!setup.canCapture || !setup.buttonEnabled || setup.allCandles !== 161) {
      throw new Error('B5 capture setup failed: ' + JSON.stringify(setup));
    }

    const initialTabs = await page.evaluate(() => ({
      analysisVisible: document.getElementById('analysisTabContent').hidden === false,
      journalHidden: document.getElementById('journalCard').hidden === true,
      analysisTabSelected: document.getElementById('analysisTabBtn').getAttribute('aria-selected') === 'true'
    }));
    if (!initialTabs.analysisVisible || !initialTabs.journalHidden || !initialTabs.analysisTabSelected) {
      throw new Error('B5 must open on the Analysis tab with Journal separated and hidden');
    }
    await page.locator('#journalTabBtn').click();
    const journalTabActive = await page.evaluate(() => ({
      journalVisible: document.getElementById('journalCard').hidden === false,
      analysisHidden: document.getElementById('analysisTabContent').hidden === true,
      roadmapHidden: document.getElementById('analysisRoadmap').hidden === true,
      selected: document.getElementById('journalTabBtn').getAttribute('aria-selected') === 'true'
    }));
    if (!journalTabActive.journalVisible || !journalTabActive.analysisHidden ||
        !journalTabActive.roadmapHidden || !journalTabActive.selected) {
      throw new Error('Journal tab did not isolate the journal panel');
    }
    await page.locator('#analysisTabBtn').click();
    const analysisRestored = await page.evaluate(() =>
      document.getElementById('analysisTabContent').hidden === false &&
      document.getElementById('journalCard').hidden === true);
    if (!analysisRestored) throw new Error('Analysis tab did not restore the analysis panel');
    await page.locator('#journalTabBtn').click();

    const autoCaptureCheck = await page.evaluate(() => {
      const journal = window.__CryptoAnalystTestHooks.journal;
      const first = journal.autoCapture();
      const duplicate = journal.autoCapture();
      const cached = state.snapshotsByKey.get('BTCUSDT:240');
      cached.dataset.allCandles[159].close += 0.25;
      const changedSnapshot = journal.autoCapture();
      const records = journal.state.envelope.observations;
      return { first, duplicate, changedSnapshot, count: records.length,
        mode: records[0] && records[0].captureMode,
        changedMode: records[1] && records[1].captureMode,
        hasCaptureKey: Boolean(records[0] && records[0].captureKey),
        changedCaptureKey: Boolean(records[1] && records[1].captureKey && records[1].captureKey !== records[0].captureKey) };
    });
    if (!autoCaptureCheck.first || !autoCaptureCheck.duplicate || !autoCaptureCheck.changedSnapshot ||
        autoCaptureCheck.count !== 2 || autoCaptureCheck.mode !== 'AUTO' || autoCaptureCheck.changedMode !== 'AUTO' ||
        !autoCaptureCheck.hasCaptureKey || !autoCaptureCheck.changedCaptureKey) {
      throw new Error('B9 automatic capture/idempotency failed: ' + JSON.stringify(autoCaptureCheck));
    }
    await page.locator('#journalSaveBtn').click();
    const afterButtonCapture = await page.evaluate(() => window.__CryptoAnalystTestHooks.journal.state.envelope.observations.length);
    if (afterButtonCapture !== 2) throw new Error('Save observation button did not persist an observation');

    await page.locator('#journalFollowupStatus').selectOption('missed');
    await page.locator('#journalFollowupPrice').fill('60300');
    await page.locator('#journalFollowupNote').fill('Сценарий появился после наблюдения');
    await page.locator('#journalAddFollowup').click();
    await page.locator('.journal-trade-details summary').click();
    await page.locator('#journalTradeEntry').fill('60000');
    await page.locator('#journalTradeExit').fill('60100');
    const tradeTimes = await page.evaluate(() => {
      const format = (date) => {
        const p = (value) => String(value).padStart(2, '0');
        return date.getFullYear() + '-' + p(date.getMonth() + 1) + '-' + p(date.getDate()) +
          'T' + p(date.getHours()) + ':' + p(date.getMinutes());
      };
      const now = Date.now();
      return { entry: format(new Date(now - 60000)), exit: format(new Date(now - 30000)) };
    });
    await page.locator('#journalTradeEntryAt').fill(tradeTimes.entry);
    await page.locator('#journalTradeExitAt').fill(tradeTimes.exit);
    await page.locator('#journalTradeQuantity').fill('0.5');
    await page.locator('#journalTradeFees').fill('5');
    await page.locator('#journalTradeFunding').fill('1');
    await page.locator('#journalAddTrade').click();

    const checks = await page.evaluate(() => {
      const h = window.__CryptoAnalystTestHooks;
      const { state, journal } = h;
      const firstRecord = journal.state.envelope.observations[0];
      const firstClose = firstRecord.candleWindow[0].close;
      const frozen = Object.isFrozen(firstRecord) && Object.isFrozen(firstRecord.candleWindow);
      const followup = journal.state.envelope.followups[0];
      const trade = journal.state.envelope.actualTrades[0];
      const followupTradeChecks = journal.state.envelope.followups.length === 1 &&
        followup.observationId === firstRecord.id && followup.status === 'missed' &&
        followup.observedPrice === 60300 && followup.note === 'Сценарий появился после наблюдения' &&
        journal.state.envelope.actualTrades.length === 1 && trade.observationId === firstRecord.id &&
        trade.status === 'closed' && trade.side === 'LONG' && trade.grossPnl === 50 && trade.netPnl === 44 &&
        Number.isSafeInteger(trade.entryAtMs) && Number.isSafeInteger(trade.exitAtMs) &&
        trade.entryAtMs <= trade.exitAtMs && trade.exitAtMs <= trade.recordedAtMs;
      const cached = state.snapshotsByKey.get('BTCUSDT:240');
      cached.dataset.allCandles[1].close = -999;
      cached.analysis.reasons[0] = 'MUTATED AFTER CAPTURE';
      const immutable = firstRecord.candleWindow[0].close === firstClose &&
        firstRecord.analysisSnapshot.reasons[0] !== 'MUTATED AFTER CAPTURE';
      const hasFuture = firstRecord.candleWindow.some(c => c.ts > firstRecord.capturedAtMs);
      const forming = firstRecord.candleWindow[firstRecord.candleWindow.length - 1].finality;
      cached.dataset.allCandles[1].close = firstClose;
      cached.analysis.reasons[0] = 'Тестовое условие LONG';

      cached.analysis.decision = 'WAIT';
      cached.analysis.reasons = ['Нет подтверждённого сценария'];
      const waitAutoFirst = journal.autoCapture();
      const waitAutoDuplicate = journal.autoCapture();
      cached.dataset.qualityReport = {
        status: 'INVALID', validator_version: '1.1.0',
        reasons: [{ code: 'VOLUME_NEGATIVE', severity: 'error', detail: 'fixture invalid' }]
      };
      cached.analysis.decision = 'LONG';
      cached.analysis.qualityGate = { blocked: true, status: 'INVALID', reasons: ['VOLUME_NEGATIVE'] };
      const invalidAuto = journal.autoCapture();
      const decisions = journal.state.envelope.observations.map(r => r.decision);
      const invalidStatus = journal.state.envelope.observations[2].dataQuality.status;
      cached.dataset.qualityReport.status = 'STALE';
      const staleBlocked = journal.canCapture() === false;
      cached.dataset.qualityReport.status = 'VALID';
      cached.analysis.qualityGate = { blocked: false, status: 'VALID', reasons: [] };

      const envelope = JSON.parse(JSON.stringify(journal.state.envelope));
      const countBeforeCollision = journal.state.envelope.observations.length;
      let invalidFollowupRejected = false;
      try { journal.addFollowup({ observationId: 'missing-observation-id', status: 'missed' }); }
      catch (_) { invalidFollowupRejected = true; }
      let invalidTradeRejected = false;
      try {
        journal.addActualTrade({ observationId: firstRecord.id, side: 'LONG',
          entryPrice: 60000, exitPrice: 60100, quantity: -1 });
      } catch (_) { invalidTradeRejected = true; }
      const invalidLinkedRecordsPreserved = journal.state.envelope.followups.length === 1 &&
        journal.state.envelope.actualTrades.length === 1;
      const collision = JSON.parse(JSON.stringify(envelope));
      collision.observations[0].decision = collision.observations[0].decision === 'LONG' ? 'SHORT' : 'LONG';
      let collisionRejected = false;
      try { journal.importEnvelope(collision); } catch (_) { collisionRejected = true; }
      const collisionPreserved = journal.state.envelope.observations.length === countBeforeCollision &&
        journal.state.envelope.observations[0].decision !== collision.observations[0].decision;

      let invalidRejected = false;
      try { journal.importEnvelope({ format: 'wrong', formatVersion: 1, observations: [], followups: [], actualTrades: [] }); }
      catch (_) { invalidRejected = true; }
      const invalidPreserved = journal.state.envelope.observations.length === countBeforeCollision;
      const missingFields = JSON.parse(JSON.stringify(envelope));
      delete missingFields.observations[0].priceContext;
      let missingFieldsRejected = false;
      try { journal.importEnvelope(missingFields); } catch (_) { missingFieldsRejected = true; }
      const missingFieldsPreserved = journal.state.envelope.observations.length === countBeforeCollision;

      const originalSetItem = Storage.prototype.setItem;
      let storageFailureRejected = false;
      try {
        Storage.prototype.setItem = function () { throw new Error('quota test'); };
        cached.analysis.decision = 'SHORT';
        journal.capture();
      } catch (_) { storageFailureRejected = true; }
      finally { Storage.prototype.setItem = originalSetItem; }
      const storagePreserved = journal.state.envelope.observations.length === countBeforeCollision;

      window.localStorage.removeItem('cryptoAnalyst.marketJournal.v1');
      journal.initialize();
      const emptyBeforeImport = journal.state.envelope.observations.length === 0;
      journal.importEnvelope(envelope);
      const importedCount = journal.state.envelope.observations.length;
      journal.importEnvelope(envelope);
      const duplicateIdempotent = journal.state.envelope.observations.length === importedCount;

      return {
        frozen, immutable, hasFuture, forming, decisions, invalidStatus, staleBlocked, followupTradeChecks,
        waitAutoFirst, waitAutoDuplicate, invalidAuto, autoModes: journal.state.envelope.observations.map(r => r.captureMode),
        collisionRejected, collisionPreserved, invalidRejected, invalidPreserved,
        missingFieldsRejected, missingFieldsPreserved, invalidFollowupRejected, invalidTradeRejected, invalidLinkedRecordsPreserved,
        storageFailureRejected, storagePreserved, emptyBeforeImport, importedCount, duplicateIdempotent,
        followupsAfterImport: journal.state.envelope.followups.length,
        tradesAfterImport: journal.state.envelope.actualTrades.length
      };
    });

    const expected = checks.frozen && checks.immutable && !checks.hasFuture && checks.forming === 'forming' &&
      checks.decisions.join('|') === 'LONG|LONG|WAIT|WAIT' && checks.invalidStatus === 'INVALID' &&
      checks.waitAutoFirst && checks.waitAutoDuplicate && checks.invalidAuto &&
      checks.autoModes.every(mode => mode === 'AUTO') &&
      checks.staleBlocked && checks.followupTradeChecks && checks.collisionRejected && checks.collisionPreserved &&
      checks.invalidRejected && checks.invalidPreserved && checks.missingFieldsRejected &&
      checks.missingFieldsPreserved && checks.invalidFollowupRejected &&
      checks.invalidTradeRejected && checks.invalidLinkedRecordsPreserved && checks.storageFailureRejected &&
      checks.storagePreserved && checks.emptyBeforeImport && checks.importedCount === 4 && checks.duplicateIdempotent &&
      checks.followupsAfterImport === 1 && checks.tradesAfterImport === 1;
    if (!expected) throw new Error('B5 journal contract assertions failed: ' + JSON.stringify(checks));

    const downloadPromise = page.waitForEvent('download');
    await page.evaluate(() => window.__CryptoAnalystTestHooks.journal.export());
    const download = await downloadPromise;
    const downloadPath = await download.path();
    const exported = JSON.parse(fs.readFileSync(downloadPath, 'utf8'));
    if (download.suggestedFilename().indexOf('crypto-analyst-journal-') !== 0 ||
        exported.format !== 'crypto-analyst-journal' || exported.observations.length !== 4 ||
        exported.followups.length !== 1 || exported.actualTrades.length !== 1) {
      throw new Error('B5 JSON export failed');
    }

    await page.evaluate(() => {
      window.localStorage.removeItem('cryptoAnalyst.marketJournal.v1');
      window.__CryptoAnalystTestHooks.journal.initialize();
    });
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#journalImportBtn').click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'crypto-analyst-journal-test.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(exported))
    });
    await page.waitForFunction(() => {
      const e = window.__CryptoAnalystTestHooks.journal.state.envelope;
      return e.observations.length === 4 && e.followups.length === 1 && e.actualTrades.length === 1;
    }, { timeout: 5000 });

    const corruption = await page.evaluate(() => {
      const key = 'cryptoAnalyst.marketJournal.v1';
      const raw = localStorage.getItem(key);
      localStorage.setItem(key, '{broken-json');
      const journal = window.__CryptoAnalystTestHooks.journal;
      journal.initialize();
      const readOnlyOnCorrupt = journal.state.readOnly === true && Boolean(journal.state.error);
      const corruptBytesPreserved = localStorage.getItem(key) === '{broken-json';
      localStorage.setItem(key, raw);
      journal.initialize();
      const recovered = journal.state.readOnly === false && journal.state.envelope.observations.length === 4;
      return { readOnlyOnCorrupt, corruptBytesPreserved, recovered };
    });
    if (!corruption.readOnlyOnCorrupt || !corruption.corruptBytesPreserved || !corruption.recovered) {
      throw new Error('B5 corrupt-storage recovery assertions failed: ' + JSON.stringify(corruption));
    }
    if (pageErrors.length) throw new Error('Browser page errors: ' + pageErrors.join(' | '));
    console.log(JSON.stringify({ b5: checks, b9: autoCaptureCheck, exportFilename: download.suggestedFilename(), corruption, pageErrors }, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
