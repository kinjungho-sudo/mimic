import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BRAND_EXTENSION_ID, BRAND_LEGACY_EXTENSION_ID } from '../lib/brand.ts';
import { selectPreferredExtensionId } from '../lib/extension-id.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '..');
const recorderRoot = path.join(repoRoot, 'mimic_recorder');
const background = fs.readFileSync(path.join(recorderRoot, 'background.js'), 'utf8');
const popup = fs.readFileSync(path.join(recorderRoot, 'popup.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(recorderRoot, 'manifest.json'), 'utf8'));
const devExtensionId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
let checks = 0;

function check(assertion) {
  assertion();
  checks += 1;
}

for (const hostname of ['mimic-nine-ashen.vercel.app', 'mimicflow.com', 'app.parro.example']) {
  check(() => {
    assert.equal(
      selectPreferredExtensionId({
        hostname,
        configured: BRAND_LEGACY_EXTENSION_ID,
        query: devExtensionId,
        stored: devExtensionId,
      }),
      BRAND_EXTENSION_ID,
      `${hostname} must always select the stable public Web Store ID`,
    );
  });
}

check(() => {
  assert.equal(
    selectPreferredExtensionId({
      hostname: 'localhost',
      configured: BRAND_LEGACY_EXTENSION_ID,
      query: `\uFEFF${devExtensionId}`,
    }),
    devExtensionId,
  );
});
check(() => {
  assert.equal(
    selectPreferredExtensionId({
      hostname: 'parro-guide.vercel.app',
      configured: BRAND_LEGACY_EXTENSION_ID,
      stored: devExtensionId,
    }),
    devExtensionId,
  );
});
check(() => {
  assert.equal(
    selectPreferredExtensionId({
      hostname: 'feature-preview.vercel.app',
      configured: devExtensionId,
    }),
    devExtensionId,
  );
});
check(() => {
  assert.equal(
    selectPreferredExtensionId({ hostname: 'localhost' }),
    '',
    'dev without a configured ID must wait for extension discovery',
  );
});

check(() => assert.ok(background.includes(BRAND_EXTENSION_ID)));
check(() => assert.ok(popup.includes(BRAND_EXTENSION_ID)));
check(() => assert.ok(manifest.externally_connectable?.matches?.includes('https://mimic-nine-ashen.vercel.app/*')));
check(() => assert.ok(manifest.externally_connectable?.matches?.includes('https://mimicflow.com/*')));

console.log(JSON.stringify({
  ok: true,
  checks,
  contract: 'stable-web-store-extension-id',
  publicExtensionId: BRAND_EXTENSION_ID,
  recorderSourceVersion: manifest.version,
  versionPinned: false,
}));
