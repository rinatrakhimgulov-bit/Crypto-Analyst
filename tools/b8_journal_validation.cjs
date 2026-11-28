'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildJournalReport } = require('../src/research/b8-journal-report.js');

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error('B8_JOURNAL_EXPORT_PATH_REQUIRED');
  const resolved = path.resolve(inputPath);
  const envelope = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const report = buildJournalReport(envelope);
  const base = path.basename(resolved, path.extname(resolved));
  const jsonPath = base + '.b8-report.json';
  const mdPath = base + '.b8-report.md';
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
  const lines = [
    '# B8 Prospective Journal Coverage Report', '',
    'Observations: **' + report.observation_count + '**',
    'Decisions: ' + JSON.stringify(report.decision_counts),
    'Confirmed B7 candidates in compatible snapshots: **' + report.candidate_count + '**',
    'Follow-ups: **' + report.followup_count + '** (' + JSON.stringify(report.followup_counts_by_status) + ')',
    'Actual trades: **' + report.actual_trade_count + '**',
    '',
    '## Limitations', '',
    ...report.limitations.map(item => '- ' + item), ''
  ];
  fs.writeFileSync(mdPath, lines.join('\n'));
  console.log(JSON.stringify({ json_report: jsonPath, markdown_report: mdPath,
    observations: report.observation_count, candidates: report.candidate_count,
    followups: report.followup_count, actual_trades: report.actual_trade_count }, null, 2));
}
try { main(); } catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
}
