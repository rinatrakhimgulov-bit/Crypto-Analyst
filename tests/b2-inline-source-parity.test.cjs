'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'CryptoAnalyst_StageA_S6_updated.html'), 'utf8');
const modules = [
  ['B2CausalSwingEngine', 'b2-causal-swing-engine.js', 'B2BSwingSequenceEngine'],
  ['B2BSwingSequenceEngine', 'b2b-swing-sequence-engine.js', 'B2CSwingStructureEngine'],
  ['B2CSwingStructureEngine', 'b2c-swing-structure-engine.js', 'B2DSupportResistanceEngine'],
  ['B2DSupportResistanceEngine', 'b2d-support-resistance-engine.js', 'B2EBreakoutRetestEngine'],
  ['B2EBreakoutRetestEngine', 'b2e-breakout-retest-engine.js', 'B2FMtfStructureConfluenceEngine'],
  ['B2FMtfStructureConfluenceEngine', 'b2f-mtf-structure-confluence-engine.js', 'B7ExplainableSetupEngine'],
  ['B7ExplainableSetupEngine', 'b7-explainable-setup-engine.js', 'B2GChartProjectionEngine'],
  ['B2GChartProjectionEngine', 'b2g-chart-projection-engine.js', null]
];

for (const [name, filename, nextName] of modules) {
  const source = fs.readFileSync(path.join(root, 'src', 'analysis', filename), 'utf8');
  const sourceStart = source.indexOf('function create' + name + '()');
  assert.notEqual(sourceStart, -1, name + ' source factory not found');
  const sourceEnd = source.lastIndexOf('});') + 3;
  const sourceBody = source.slice(sourceStart, sourceEnd).trim();

  const inlineStart = html.indexOf('function create' + name + '()');
  assert.notEqual(inlineStart, -1, name + ' inline factory not found');
  const marker = nextName
    ? '\n});\n\n\n(function attach' + nextName
    : '\n});';
  const inlineMarker = html.indexOf(marker, inlineStart);
  assert.notEqual(inlineMarker, -1, name + ' inline end marker not found');
  const inlineBody = html.slice(inlineStart, inlineMarker + 4).trim();

  assert.equal(inlineBody, sourceBody,
    name + ' inline production implementation differs from tested src/analysis module');
  console.log('PASS ' + name + ' source/inline parity (' + sourceBody.length + ' chars)');
}
