import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  analysePilotCsv,
  pilotAnalysisMarkdown,
  type PilotCsvBundle,
} from '../src/pilot-analytics';

const inputDir = resolve(process.argv[2] ?? 'pilot-export');
const outputDir = resolve(process.argv[3] ?? 'review/pilot-analytics');

const read = (name: string) => readFileSync(join(inputDir, name), 'utf8');

const bundle: PilotCsvBundle = {
  events: read('events.csv'),
  checkpoints: read('checkpoints.csv'),
  supportPreferences: read('support-preferences.csv'),
  supportOutcomes: read('support-outcomes.csv'),
  engagement: read('engagement.csv'),
};

const analysis = analysePilotCsv(bundle);
const markdown = pilotAnalysisMarkdown(analysis);

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  join(outputDir, 'pilot-analytics-v1.json'),
  JSON.stringify(analysis, null, 2) + '\n',
);
writeFileSync(
  join(outputDir, 'pilot-analytics-v1.md'),
  markdown.endsWith('\n') ? markdown : markdown + '\n',
);

console.log(`Pilot Analytics v1 written to ${outputDir}`);
console.log(`Practice rows: ${analysis.integrity.eventRows}`);
console.log(`Learners in practice events: ${analysis.integrity.learnersInEvents}`);
console.log(`Paired learner-subject checkpoints: ${analysis.learning.pairedLearnerSubjects}`);
if (analysis.integrity.warnings.length > 0) {
  console.log('Warnings:');
  for (const warning of analysis.integrity.warnings) console.log(`- ${warning}`);
}


if (!analysis.integrity.stage0.pass) {
  console.error('Stage-0 evidence integrity: FAIL');
  for (const failure of analysis.integrity.stage0.failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Stage-0 evidence integrity: PASS');
}
