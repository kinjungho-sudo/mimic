import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '..');
const read = (...parts) => fs.readFileSync(path.join(appRoot, ...parts), 'utf8');

const publicSurfaces = [
  ['app', 'home', 'page.tsx'],
  ['components', 'dashboard', 'RecordingModal.tsx'],
  ['app', 'extension-link', 'page.tsx'],
  ['app', 'settings', 'page.tsx'],
  ['app', 'help', 'page.tsx'],
  ['app', 'api', 'agent', 'chat', 'route.ts'],
  ['lib', 'faq-data.ts'],
  ['lib', 'product-plans.ts'],
];
const desktopExposure =
  /Desktop Companion|Desktop capture|Desktop recorder|\/desktop-setup|\/desktop-import|\/download\/desktop|\uB370\uC2A4\uD06C\uD1B1\s*(?:\uC124\uCE58|\uB179\uD654|\uCEA1\uCC98)/i;

for (const parts of publicSurfaces) {
  const source = read(...parts);
  assert.doesNotMatch(source, desktopExposure, `${parts.join('/')} must not expose Desktop in the public MVP`);
}

const releaseFeatures = read('lib', 'release-features.ts');
assert.match(releaseFeatures, /PUBLIC_DESKTOP_ENABLED\s*=\s*false/, 'Desktop must remain disabled for the main MVP');

const middleware = read('middleware.ts');
for (const route of ['/download/desktop', '/downloads/ParroDesktopSetup.exe', '/desktop-setup', '/desktop-import']) {
  assert.ok(middleware.includes(`'${route}'`), `middleware must block ${route}`);
}
assert.ok(
  middleware.indexOf('if (!PUBLIC_DESKTOP_ENABLED') < middleware.indexOf('createServerClient('),
  'Desktop route blocking must happen before auth or entitlement work',
);

for (const internalPath of [
  path.join(appRoot, 'app', 'desktop-setup', 'page.tsx'),
  path.join(repoRoot, 'mimic_recorder', 'desktop-bridge.js'),
  path.join(repoRoot, 'mimic_desktop', 'native-host'),
]) {
  assert.ok(fs.existsSync(internalPath), `internal Desktop implementation must be preserved: ${internalPath}`);
}

const publicExtensionId = 'lefkpmfgdbhckcemfghpegleknaepekm';
const productionOrigin = 'https://mimic-nine-ashen.vercel.app';
const brand = read('lib', 'brand.ts');
const extensionResolver = read('lib', 'extension-id.ts');
const recorderBackground = fs.readFileSync(path.join(repoRoot, 'mimic_recorder', 'background.js'), 'utf8');
const recorderPopup = fs.readFileSync(path.join(repoRoot, 'mimic_recorder', 'popup.js'), 'utf8');
const recorderManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'mimic_recorder', 'manifest.json'), 'utf8'));

assert.match(
  brand,
  new RegExp(`BRAND_EXTENSION_ID\\s*=\\s*'${publicExtensionId}'`),
  'public install links must use the stable Parro Web Store item',
);
assert.match(
  extensionResolver,
  /if \(!allowsDynamicExtensionId\(hostname\)\) return BRAND_EXTENSION_ID/,
  'production must ignore stale environment/query IDs and use the stable Web Store ID',
);
assert.ok(recorderBackground.includes(publicExtensionId), 'Recorder background must recognize the public Web Store ID');
assert.ok(recorderPopup.includes(publicExtensionId), 'Recorder popup must recognize the public Web Store ID');
assert.ok(
  recorderManifest.externally_connectable?.matches?.includes(`${productionOrigin}/*`),
  'Recorder must allow external messages from the production main origin',
);

console.log(JSON.stringify({
  ok: true,
  checks: publicSurfaces.length + 16,
  scope: 'main-mvp-release-candidate',
  desktopPublic: false,
  recorderSourceVersion: recorderManifest.version,
  recorderVersionPinnedToWebApp: false,
  publicExtensionId,
  productionOrigin,
}));
