'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const recorderRoot = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(recorderRoot, file), 'utf8');

const background = read('background.js');
const popup = read('popup.js');
const content = read('content.js');
const manifest = JSON.parse(read('manifest.json'));
const runtimeSources = `${background}\n${popup}`;

const productionOrigin = 'https://parro-guide.vercel.app';
const developmentOrigin = 'https://parro-guide-dev.vercel.app';
const retiredOrigins = [
  'https://mimic-nine-ashen.vercel.app',
  'https://mimic-git-dev-kinjungho-7735s-projects.vercel.app',
  'https://mimicflow.com',
];

assert.match(runtimeSources, new RegExp(productionOrigin.replaceAll('.', '\\.')));
assert.match(runtimeSources, new RegExp(developmentOrigin.replaceAll('.', '\\.')));

for (const retiredOrigin of retiredOrigins) {
  assert.doesNotMatch(runtimeSources, new RegExp(retiredOrigin.replaceAll('.', '\\.')),
    `Recorder runtime must not use retired origin: ${retiredOrigin}`);
  assert.ok(
    !(manifest.externally_connectable?.matches || []).some((pattern) => pattern.startsWith(retiredOrigin)),
    `Retired origin must not be externally connectable: ${retiredOrigin}`,
  );
}

assert.match(background, /const WEBAPP_ORIGIN\s*=\s*IS_DEV\s*\? DEV_WEBAPP_ORIGIN\s*:\s*PROD_WEBAPP_ORIGIN/);
assert.match(background, /const origin = normalizeAllowedWebappOrigin\(sender\.origin\)/);
assert.match(background, /if \(!origin\) \{ sendResponse\(\{ ok: false, error: 'untrusted origin' \}\)/);
assert.match(background, /if \(IS_DEV\) return origin === 'https:\/\/parro-guide-dev\.vercel\.app' \? origin : null/);
assert.match(background, /return origin === 'https:\/\/parro-guide\.vercel\.app' \? origin : null/);
assert.match(popup, /function getDefaultWebappOrigin\(\)/);
assert.match(popup, /const origin = getDefaultWebappOrigin\(\)/);
assert.doesNotMatch(content, /host\.endsWith\('\.vercel\.app'\)/);
// Every external message must pass the origin gate before any handler runs.
assert.match(
  background,
  /chrome\.runtime\.onMessageExternal\.addListener\(\(message, sender, sendResponse\) => \{\s*(?:\/\/[^\n]*\n\s*)*if \(!resolveExternalSenderOrigin\(sender\)\) \{\s*sendResponse\(\{ ok: false, error: 'untrusted_sender' \}\);\s*return false;/,
  'onMessageExternal must reject untrusted senders before dispatching',
);
assert.ok(background.includes('if (IS_DEV && /^http:\\/\\/localhost'), 'localhost senders are accepted only by dev builds');
assert.doesNotMatch(content, /\}, '\*'\);\s*return;\s*\}\s*if \(data\.type === FRAME_GEOMETRY_RESPONSE/, 'frame geometry replies must target the requesting origin');

console.log(JSON.stringify({
  ok: true,
  scope: 'recorder-webapp-origin-contract',
  productionOrigin,
  developmentOrigin,
  retiredOriginsBlocked: retiredOrigins.length,
}));
