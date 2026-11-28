'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('CryptoAnalyst_StageA_S6_updated.html', 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());

assert.ok(scripts.length >= 2, 'expected inline application scripts');
for (let i = 0; i < scripts.length; i++) {
  assert.doesNotThrow(() => new vm.Script(scripts[i], { filename: 'inline-script-' + i + '.js' }),
    'inline script ' + i + ' must parse');
}

const requiredSymbols = [
  'MarketRegimeEngine.analyze',
  'B2DZoneContextEngine.analyze',
  'B2EBreakoutQualityEngine.analyze',
  'MarketImpulseEventEngine.analyze',
  'renderAdvancedAnalyticsPanel(b2Result)'
];
for (const symbol of requiredSymbols) assert.ok(html.includes(symbol), 'missing integration symbol: ' + symbol);

for (const id of ['advancedAnalyticsCard', 'advancedAnalyticsStatus', 'advancedAnalyticsList']) {
  assert.ok(html.includes('id="' + id + '"'), 'missing read-only analytics UI element: ' + id);
}

assert.ok(html.includes('Влияние на решение') &&
  html.includes('LONG/SHORT/WAIT не изменяется'),
  'the UI must explicitly state that the new research layer does not change the existing decision');

assert.ok(html.includes('Интерпретация ретеста') &&
  html.includes('не самостоятельный сигнал LONG/SHORT'),
  'the UI must distinguish retest structure state from a standalone trade signal');

const runStart = html.indexOf('function runB2Analysis(dataset)');
const runEnd = html.indexOf('// 2. БАЗОВОЕ АНАЛИТИЧЕСКОЕ ЯДРО', runStart);
assert.ok(runStart >= 0 && runEnd > runStart, 'could not isolate runB2Analysis');
const runB2 = html.slice(runStart, runEnd);
assert.ok(runB2.includes('regime, zoneContext, breakoutQuality, impulse'),
  'runB2Analysis must return all four analytical context results');

const decisionStart = html.indexOf('const BasicAnalyticsEngine =');
const decisionEnd = html.indexOf('function renderB2Panel', decisionStart);
assert.ok(decisionStart >= 0 && decisionEnd > decisionStart, 'could not isolate basic decision engine');
const basicDecision = html.slice(decisionStart, decisionEnd);
assert.ok(basicDecision.includes("decision: decision") || basicDecision.includes("decision,"),
  'the existing basic decision output must remain present');
assert.ok(!basicDecision.includes('result.regime') && !basicDecision.includes('result.impulse'),
  'research context must not be wired into the existing LONG/SHORT/WAIT decision engine');

process.stdout.write('PASS all inline scripts parse\n');
process.stdout.write('PASS all four research engines are wired into runB2Analysis\n');
process.stdout.write('PASS read-only analytical context panel is present\n');
process.stdout.write('PASS research layer is not wired into the existing basic decision engine\n');
