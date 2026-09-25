import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  pilotVersionManifest,
  pilotVersionManifestMarkdown,
} from '../src/pilot-version-manifest';

const fullSha = (): string => {
  const envSha = process.env.PILOT_GIT_SHA ?? process.env.GITHUB_SHA;
  if (envSha?.trim()) return envSha.trim();
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
};

const outputDir = resolve(process.argv[2] ?? 'review/pilot-version');
const manifest = pilotVersionManifest(fullSha());

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  join(outputDir, 'pilot-version-manifest-v1.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
writeFileSync(
  join(outputDir, 'pilot-version-manifest-v1.md'),
  pilotVersionManifestMarkdown(manifest),
);

console.log(`Pilot Version Manifest v${manifest.manifestVersion} written to ${outputDir}`);
console.log(`Source git SHA: ${manifest.sourceGitSha}`);
console.log(
  `Contracts: consent ${manifest.contracts.consentVersion}; intelligence v${manifest.contracts.learningIntelligenceVersion}; evidence v${manifest.contracts.pilotEvidenceVersion}; analytics v${manifest.contracts.pilotAnalyticsVersion}`,
);
console.log(
  `Curriculum: ${manifest.curriculum.id} v${manifest.curriculum.version} (${manifest.curriculum.jurisdiction})`,
);
