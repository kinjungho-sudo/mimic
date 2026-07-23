import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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

// SHA-256 values are computed from the public 1.7.2 package after normalizing
// text files to LF. The source manifest's "(dev)" suffix is removed exactly as
// the store packaging scripts do before its hash is checked.
const approvedRecorderHashes = {
  'manifest.json': '59f8c46f1aa4d50575f5f9988dc7ba8744db4f8d3b1d89e394e8586f91417da5',
  'background.js': 'ee0ec1d7a5dbceb838fb2eca01b17110515809d15af3cef41c085882e16dc3fc',
  'content.js': '8a0958b6dc7d557ab627ab0cc9429b2439d9b1ff9ff465c40b19113ae66fa5c0',
  'guide-engine.js': 'ac3c2dcbf0773dc01d00e430cfca5d0da54d9a355fdded56ebbf7938f2c00c4f',
  'desktop-bridge.js': '2f61092ce262594bab879cd8b7a925310333fcbd924e332553a71e72da9f908b',
  'desktop-import.js': 'a75aaac97e631f50951cc4323d94fb764ce6c1b3ce280fac6772035512695548',
  'targeting.js': '262dd70d198e57dfad00bb6618ae13a54fbc24843399afa8d408f03ce05c8922',
  'popup.js': '70de8c29af0037140259e34897c38993121e25956b5a7f0f48afe18904392963',
  'popup.html': 'b77085aaaa8049c424a5ccabb396e8f5c73adb731db21333cc69aa15edbdccac',
  'offscreen.html': '04de67046e82e2f7122725b0b60f6ca5d20592cb86e35dfcf1f9422d41c925cb',
  'offscreen.js': '731160db62ea21f84c8c237c37d2d4de6c39973b88c55e911ec37b9d1765c9bf',
  'request-mic.html': '8464c611098223247501651ff5d0d18adee81ce4565afa03e6e90350b1af9289',
  'request-mic.js': '30d6afc008a7afab3e12c4efa6024aaaf929259bbfa727ef678b9a0888079058',
  'icons/icon16.png': 'd725ea52f610510443292d38b54326ba8e4377c7a155180be531b72ff830bffe',
  'icons/icon48.png': '8f8f3e6084ca3d373b92ac310a00a4ad2a5266459a97d44879d4c0cc3f68ba9d',
  'icons/icon128.png': '8a70b5bb33a5af1a1382647dc56e828e2895ba96d5f3f7bc343e0bd6aeb2c1f5',
};

for (const [relativePath, approvedHash] of Object.entries(approvedRecorderHashes)) {
  const filePath = path.join(repoRoot, 'mimic_recorder', ...relativePath.split('/'));
  let bytes = fs.readFileSync(filePath);

  if (/\.(?:html|js|json)$/.test(relativePath)) {
    let text = bytes.toString('utf8').replace(/\r\n/g, '\n');
    if (relativePath === 'manifest.json') {
      text = text.replace('Parro Recorder (dev)', 'Parro Recorder');
    }
    bytes = Buffer.from(text, 'utf8');
  }

  const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(actualHash, approvedHash, `${relativePath} must match the approved Recorder 1.7.2 package`);
}

const recorderManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'mimic_recorder', 'manifest.json'), 'utf8'));
assert.equal(recorderManifest.version, '1.7.2', 'Recorder manifest version must remain 1.7.2');

const brand = read('lib', 'brand.ts');
assert.match(
  brand,
  /BRAND_EXTENSION_ID\s*=\s*'lefkpmfgdbhckcemfghpegleknaepekm'/,
  'public install links must use the approved Parro Web Store listing',
);

console.log(JSON.stringify({
  ok: true,
  checks: publicSurfaces.length + 28,
  scope: 'main-mvp-release-candidate',
  desktopPublic: false,
  recorderVersion: recorderManifest.version,
  recorderPackageFilesMatched: Object.keys(approvedRecorderHashes).length,
  publicExtensionId: 'lefkpmfgdbhckcemfghpegleknaepekm',
}));
