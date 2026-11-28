'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const HTML = path.resolve('CryptoAnalyst_StageA_S6_updated.html');
const PORT = 4175;

async function main() {
  if (!fs.existsSync(HTML)) throw new Error('Missing integrated application HTML');
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    fs.createReadStream(HTML).pipe(res);
  });
  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    await page.goto(`http://127.0.0.1:${PORT}?test=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__CryptoAnalystTestHooks?.createMarketJournal &&
      document.getElementById('saveObservationBtn'), { timeout: 15000 });

    const result = await page.evaluate(() => {
      const hooks = window.__CryptoAnalystTestHooks;
      const { createMarketJournal, buildJournalObservation, state, MarketJournal } = hooks;
      const assert = (condition, message) => { if (!condition) throw new Error(message); };
      const expectThrow = (fn, message) => {
        let threw = false;
        try { fn(); } catch (_) { threw = true; }
        assert(threw, message);
      };
      const makeStorage = (initial = new Map()) => ({
        values: initial,
        getItem(key) { return this.values.has(key) ? this.values.get(key) : null; },
        setItem(key, value) { this.values.set(key, value); }
      });
      const makeFixture = (qualityStatus = 'VALID', decision = 'WAIT') => {
        const asOf = 1700000000000;
        const step = 14400000;
        const candles = [
          { ts: asOf - step * 3, closeTs: asOf - step * 2, open: 64000, high: 64500, low: 63900, close: 64300, volume: 10, turnover: 643000 },
          { ts: asOf - step * 2, closeTs: asOf - step, open: 64300, high: 65000, low: 64200, close: 64800, volume: 11, turnover: 712800 },
          { ts: asOf - step, closeTs: asOf, open: 64800, high: 65200, low: 64700, close: 65000, volume: 5, turnover: 325000 }
        ];
        const dataset = {
          symbol: 'BTCUSDT',
          interval: '240',
          source: 'bybit-v5-rest',
          marketType: 'linear_perpetual',
          fetchedAtLocalMs: asOf + 1000,
          providerServerTimeMs: asOf,
          canonicalSnapshot: {
            contract_version: '1.1.0',
            snapshot_id: 'snapshot-b5-001',
            canonical_symbol: 'BTCUSDT',
            analysis_as_of_ms: asOf
          },
          qualityReport: {
            status: qualityStatus,
            snapshot_id: 'snapshot-b5-001',
            symbol: 'BTCUSDT',
            timeframe: '4h',
            validator_version: '1.1.0',
            policy_version: 'b1-quality-policy-2026-11-27-v1',
            reasons: qualityStatus === 'VALID' ? [] : [{ code: 'TEST_QUALITY_BLOCK', severity: 'CRITICAL' }]
          },
          prices: { currentMarketPrice: 65000, currentPriceSource: 'Bybit REST', priceWarning: null },
          quality: { hasForming: true },
          allCandles: candles,
          closedCandles: candles.slice(0, 2)
        };
        const analysis = {
          decision,
          reasons: ['Нет подтверждённого торгового сценария'],
          qualityGate: { blocked: qualityStatus !== 'VALID', reasons: qualityStatus === 'VALID' ? [] : [{ code: 'TEST_QUALITY_BLOCK' }] },
          metrics: { lastEma20: 64800, lastEma50: 64700, lastAtr: 300, atrPct: 0.46, volRatio: 1.2, distEma20Pct: 0.31 },
          levels: { support: 64000, resistance: 66000 }
        };
        const projection = {
          engine_version: '2.0.0-b2g',
          policy_version: 'b2g-chart-projection-v1',
          status: 'VALID',
          timeframe: '4h',
          analysis_as_of_ms: asOf,
          swing_markers: [
            { id: 'pivot-visible', visible_at_ms: asOf - 100, price: 64000 },
            { id: 'pivot-future', visible_at_ms: asOf + 100, price: 68000 }
          ],
          superseded_pivots: [],
          ambiguous_pivots: [],
          structure_events: [
            { id: 'event-visible', visible_at_ms: asOf - 50, event_type: 'BOS' },
            { id: 'event-future', visible_at_ms: asOf + 50, event_type: 'CHoCH' }
          ],
          zones: [
            { id: 'zone-visible', visible_at_ms: asOf - 25, lower_bound: 63900, upper_bound: 64100 },
            { id: 'zone-future', visible_at_ms: asOf + 25, lower_bound: 67900, upper_bound: 68100 }
          ],
          candidate_levels: [],
          retest_lifecycles: [
            { id: 'retest-visible', visible_at_ms: asOf - 10, status: 'WAITING_RETEST' },
            { id: 'retest-future', visible_at_ms: asOf + 10, status: 'RETEST_SUCCESSFUL' }
          ],
          mtf_context: null
        };
        return { dataset, analysis, b2Result: { status: 'VALID', timeframe: '4h', asOf, b2a: { engine_version: '2.0.0-b2a' }, b2b: { engine_version: '2.2.0-b2b' }, b2c: { engine_version: '2.1.0-b2c' }, b2d: { engine_version: '2.0.0-b2d' }, b2e: { engine_version: '2.0.0-b2e' }, projection } };
      };

      const fixture = makeFixture();
      const capturedAt = 1700000005000;
      const observation = buildJournalObservation({
        ...fixture,
        decisionReasons: ['WAIT: сценарий не подтверждён']
      }, capturedAt, 'B5 immutable note');
      assert(observation.recordType === 'observation' && observation.observationType === 'PAPER_OBSERVATION',
        'Observation record type must be explicit');
      assert(observation.decision.value === 'WAIT' && observation.market.symbol === 'BTCUSDT',
        'Decision and market identity must be captured');
      assert(observation.analysisSnapshot.chartDataAsOfMs === observation.analysisSnapshot.analysisAsOfMs &&
        observation.dataQuality.analysisToChartLagMs === 0,
        'Analysis time and chart-data time must be recorded separately');
      assert(observation.candleWindow.length === 3 && observation.candleWindow[0].finality === 'CLOSED' &&
        observation.candleWindow[2].finality === 'FORMING', 'Closed and forming candle finality must be preserved');
      assert(observation.analysisSnapshot.structure.swingMarkers.length === 1 &&
        observation.analysisSnapshot.structure.structureEvents.length === 1 &&
        observation.analysisSnapshot.structure.zones.length === 1 &&
        observation.analysisSnapshot.structure.retestLifecycles.length === 1,
        'B2 evidence after analysis-as-of must be filtered out');
      assert(Object.isFrozen(observation) && Object.isFrozen(observation.candleWindow[0]),
        'Captured observation and nested candles must be immutable');

      const chartFixture = makeFixture();
      const savedChartCandles = hooks.chart.candles;
      const savedChartClosedCount = hooks.chart.closedCount;
      const savedChartIdentity = {
        symbol: state.chartDataSymbol, interval: state.chartDataInterval, snapshotId: state.chartDataSnapshotId
      };
      const displayedCandles = chartFixture.dataset.allCandles.map(candle => ({ ...candle }));
      displayedCandles[2].close = 65100;
      displayedCandles[2].high = 65300;
      displayedCandles[2].volume = 6;
      hooks.chart.candles = displayedCandles;
      hooks.chart.closedCount = 2;
      state.chartDataSymbol = 'BTCUSDT';
      state.chartDataInterval = '240';
      state.chartDataSnapshotId = chartFixture.dataset.canonicalSnapshot.snapshot_id;
      const displayedSnapshot = buildJournalObservation(chartFixture, capturedAt, 'chart state');
      assert(displayedSnapshot.candleWindow[2].close === 65100 &&
        displayedSnapshot.candleWindow[2].volume === 6 &&
        displayedSnapshot.candleWindow[2].finality === 'FORMING',
        'Journal must capture the current forming candle as displayed by the chart, not the older REST copy');
      hooks.chart.candles = savedChartCandles;
      hooks.chart.closedCount = savedChartClosedCount;
      state.chartDataSymbol = savedChartIdentity.symbol;
      state.chartDataInterval = savedChartIdentity.interval;
      state.chartDataSnapshotId = savedChartIdentity.snapshotId;

      const originalClose = observation.candleWindow[0].close;
      fixture.dataset.allCandles[0].close = 1;
      fixture.analysis.metrics.lastEma20 = 1;
      assert(observation.candleWindow[0].close === originalClose &&
        observation.analysisSnapshot.basic.lastEma20 === 64800,
        'Later source mutations must not change the stored snapshot');

      const localMap = new Map();
      const storage = makeStorage(localMap);
      const journal = createMarketJournal(() => storage);
      let envelope = journal.addObservation(observation);
      assert(envelope.observations.length === 1, 'Observation must persist');
      const immutableBeforeFollowup = JSON.stringify(envelope.observations[0]);
      const followupTime = 1700000010000;
      envelope = journal.addFollowup({
        id: journal.createId(), recordType: 'followup', schemaVersion: 1,
        observationId: observation.id,
        recordedAt: { epochMs: followupTime, iso: new Date(followupTime).toISOString() },
        status: 'missed', observedPrice: 64900, note: 'Сценарий был пропущен'
      });
      assert(envelope.followups.length === 1 && JSON.stringify(envelope.observations[0]) === immutableBeforeFollowup,
        'Follow-ups must append without mutating the original observation');
      const tradeTime = 1700000020000;
      envelope = journal.addActualTrade({
        id: journal.createId(), recordType: 'actual_trade', schemaVersion: 1,
        observationId: observation.id, recordedAtMs: tradeTime,
        side: 'LONG', status: 'closed',
        entry: { price: 65000, atMs: tradeTime - 1000 },
        exit: { price: 65200, atMs: tradeTime },
        quantity: 0.1, feesQuote: 1, fundingQuote: 0.2,
        grossPnlQuote: 20, realizedPnlQuote: 19.2, note: ''
      });
      assert(envelope.actualTrades.length === 1 && envelope.observations[0].decision.value === 'WAIT',
        'Actual trade must remain separate from the WAIT observation');
      assert(envelope.actualTrades[0].realizedPnlQuote === 19.2,
        'Net PnL should be recorded only when fees and funding are explicitly supplied');

      const exported = journal.exportJson();
      const secondStorage = makeStorage();
      const secondJournal = createMarketJournal(() => secondStorage);
      let imported = secondJournal.importJson(exported);
      assert(imported.observations.length === 1 && imported.followups.length === 1 && imported.actualTrades.length === 1,
        'Versioned JSON backup must round-trip all record types');
      imported = secondJournal.importJson(exported);
      assert(imported.observations.length === 1 && imported.followups.length === 1 && imported.actualTrades.length === 1,
        'Importing identical IDs/content must be idempotent');

      const beforeCollision = secondStorage.getItem(secondJournal.STORAGE_KEY);
      const collision = JSON.parse(exported);
      collision.observations[0].note = 'tampered duplicate ID';
      expectThrow(() => secondJournal.importJson(JSON.stringify(collision)), 'Conflicting duplicate IDs must be rejected');
      assert(secondStorage.getItem(secondJournal.STORAGE_KEY) === beforeCollision,
        'Collision rejection must not partially change local storage');
      const invalidReference = JSON.parse(exported);
      invalidReference.followups[0].observationId = 'missing-observation';
      expectThrow(() => secondJournal.validateEnvelope(invalidReference), 'Orphan follow-up reference must be rejected');
      const unsupported = JSON.parse(exported);
      unsupported.formatVersion = 99;
      expectThrow(() => secondJournal.validateEnvelope(unsupported), 'Unknown format version must be rejected');
      const oversized = journal.emptyEnvelope();
      oversized.observations = Array.from({ length: 101 }, (_, index) => ({ ...observation, id: 'oversized-' + index }));
      expectThrow(() => journal.validateEnvelope(oversized), 'Observation count limit must be enforced');
      const oversizedCandles = JSON.parse(JSON.stringify(observation));
      oversizedCandles.candleWindow = Array.from({ length: 161 }, (_, index) => ({
        ...observation.candleWindow[0], ts: observation.candleWindow[0].ts + index * 1000,
        closeTs: observation.candleWindow[0].closeTs + index * 1000
      }));
      expectThrow(() => journal.validateEnvelope({ ...journal.emptyEnvelope(), observations: [oversizedCandles] }),
        'Per-observation candle window limit must be enforced');

      const invalidDirectional = makeFixture('INVALID', 'LONG');
      expectThrow(() => buildJournalObservation(invalidDirectional, capturedAt, ''),
        'INVALID data must never produce a directional observation');
      const blockedWait = makeFixture('INVALID', 'WAIT');
      const blockedObservation = buildJournalObservation(blockedWait, capturedAt, 'quality-blocked WAIT');
      assert(blockedObservation.decision.value === 'WAIT' && blockedObservation.dataQuality.status === 'INVALID',
        'Quality-blocked WAIT observations must remain recordable with explicit quality status');
      const unassessed = makeFixture('UNASSESSED', 'WAIT');
      expectThrow(() => buildJournalObservation(unassessed, capturedAt, ''),
        'UNASSESSED data must fail closed');

      const beforeQuota = storage.getItem(journal.STORAGE_KEY);
      const originalSetItem = storage.setItem.bind(storage);
      storage.setItem = () => { throw new Error('quota exceeded'); };
      expectThrow(() => journal.addFollowup({
        id: journal.createId(), recordType: 'followup', schemaVersion: 1,
        observationId: observation.id,
        recordedAt: { epochMs: followupTime + 1, iso: new Date(followupTime + 1).toISOString() },
        status: 'manual_note', observedPrice: null, note: 'quota'
      }), 'Storage quota error must be surfaced');
      storage.setItem = originalSetItem;
      assert(storage.getItem(journal.STORAGE_KEY) === beforeQuota,
        'Failed storage write must preserve the previous valid envelope');

      const corruptMap = new Map([[journal.STORAGE_KEY, '{broken-json']]);
      const corruptJournal = createMarketJournal(() => makeStorage(corruptMap));
      expectThrow(() => corruptJournal.load(), 'Corrupt local journal must be reported');
      const recovered = corruptJournal.importJson(exported, { replaceCorrupt: true });
      assert(recovered.observations.length === 1, 'Explicit restore from a valid backup must recover corrupt storage');
      const unavailableJournal = createMarketJournal(() => { throw new Error('storage denied'); });
      expectThrow(() => unavailableJournal.load(), 'Unavailable local storage must be reported');

      // Exercise the real UI save action against the actual browser localStorage.
      localStorage.removeItem(MarketJournal.STORAGE_KEY);
      const uiFixture = makeFixture();
      state.latestJournalContext = { ...uiFixture, decisionReasons: ['UI observation'] };
      state.journalEnvelope = MarketJournal.load();
      state.journalError = null;
      document.getElementById('journalObservationNote').value = 'UI save test';
      document.getElementById('saveObservationBtn').disabled = false;
      document.getElementById('saveObservationBtn').click();
      const uiEnvelope = MarketJournal.load();
      assert(uiEnvelope.observations.length === 1 && uiEnvelope.observations[0].note === 'UI save test',
        'Save observation button must write an immutable record to browser localStorage');
      assert(document.getElementById('journalCount').textContent === '1 наблюдение',
        'Journal UI count must update after save');
      assert(document.getElementById('journalDetail').hidden === false,
        'Saved observation detail should open');

      return {
        observationId: observation.id,
        counts: { observations: envelope.observations.length, followups: envelope.followups.length, actualTrades: envelope.actualTrades.length },
        exportBytes: exported.length,
        noLookAhead: true,
        immutableSnapshot: true,
        blockedWaitAllowed: true,
        invalidDirectionalBlocked: true,
        collisionAtomic: true,
        quotaAtomic: true,
        corruptRestore: true,
        uiSave: true
      };
    });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#exportJournalBtn').click()
    ]);
    if (!download.suggestedFilename().startsWith('crypto-analyst-journal-') ||
        !download.suggestedFilename().endsWith('.json')) {
      throw new Error('Journal export download filename invalid: ' + download.suggestedFilename());
    }
    if (pageErrors.length) throw new Error('Browser page errors: ' + pageErrors.join(' | '));
    console.log(JSON.stringify({ b5: result, exportFilename: download.suggestedFilename(), pageErrors }, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
