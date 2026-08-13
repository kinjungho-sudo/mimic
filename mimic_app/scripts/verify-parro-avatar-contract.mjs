import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, '..');
const repoDir = path.resolve(appDir, '..');
const webBrandDir = path.join(appDir, 'public', 'brand');
const recorderDir = path.join(repoDir, 'mimic_recorder');
const recorderAssetDir = path.join(recorderDir, 'assets');
const canonicalName = 'parro-3d-neutral.png';
const avatarNamePattern = /^parro-(?:3d-(?:neutral|point|success|talk)|ai-avatar(?:-(?:blocked|clarify|error|listen|neutral|point|search|success|talk|think|warning))?)\.png$/;

function digest(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const canonicalPath = path.join(webBrandDir, canonicalName);
assert.equal(fs.existsSync(canonicalPath), true, 'Canonical Parro avatar is missing');
const canonicalDigest = digest(canonicalPath);

for (const assetDir of [webBrandDir, recorderAssetDir]) {
  const avatarNames = fs.readdirSync(assetDir).filter(name => avatarNamePattern.test(name)).sort();
  assert.ok(avatarNames.length >= 16, `Expected the complete Parro avatar set in ${assetDir}`);
  for (const name of avatarNames) {
    assert.equal(
      digest(path.join(assetDir, name)),
      canonicalDigest,
      `${path.relative(repoDir, path.join(assetDir, name))} is not the approved front-facing Parro avatar`,
    );
  }
}

const sourceFiles = [
  path.join(appDir, 'components', 'brand', 'ParroMascot.tsx'),
  path.join(appDir, 'components', 'chat', 'AgentChat.tsx'),
  path.join(appDir, 'components', 'landing', 'ProductDemo.tsx'),
  path.join(appDir, 'components', 'viewer', 'FollowStage.tsx'),
  path.join(appDir, 'public', 'sdk.js'),
  path.join(recorderDir, 'guide-engine.js'),
  path.join(recorderDir, 'popup.html'),
];
const activeSource = sourceFiles.map(filePath => fs.readFileSync(filePath, 'utf8')).join('\n');

assert.doesNotMatch(activeSource, /(?:robot|bot)[-_ ]?(?:avatar|mascot)|(?:avatar|mascot)[-_ ]?(?:robot|bot)/i);
assert.match(activeSource, /parro-3d-neutral\.png/);
assert.match(activeSource, /ParroMascot/);

const manifest = JSON.parse(fs.readFileSync(path.join(recorderDir, 'manifest.json'), 'utf8'));
assert.equal(manifest.version, '1.7.23');
assert.deepEqual(
  manifest.web_accessible_resources[0].resources,
  [`assets/${canonicalName}`],
  'Recorder must expose only the approved front-facing Parro avatar',
);

console.log(JSON.stringify({
  ok: true,
  canonicalAsset: canonicalName,
  sha256: canonicalDigest,
  recorderVersion: manifest.version,
  checkedSurfaces: sourceFiles.length,
}));
