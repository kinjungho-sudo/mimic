import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createOwnedRecorderExtensionFixture,
  removeOwnedRecorderExtensionFixture,
} from './recorder-profile-harness.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const recorderDir = path.resolve(scriptDir, '..', '..', 'mimic_recorder');
const sourceManifest = JSON.parse(
  fs.readFileSync(path.join(recorderDir, 'manifest.json'), 'utf8'),
);
const archivePath = path.resolve(
  process.argv[2] || path.join(recorderDir, `parro-recorder-v${sourceManifest.version}.zip`),
);
const fixtureDir = createOwnedRecorderExtensionFixture();

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: path.resolve(scriptDir, '..', '..'),
    encoding: 'utf8',
    stdio: 'inherit',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

try {
  assert.equal(fs.existsSync(archivePath), true, `Recorder ZIP not found: ${archivePath}`);
  run('tar', ['-xf', archivePath, '-C', fixtureDir]);

  const packagedManifestPath = path.join(fixtureDir, 'manifest.json');
  const packagedBufferPath = path.join(fixtureDir, 'pre-capture-buffer.js');
  const packagedDesktopBridgePath = path.join(fixtureDir, 'desktop-bridge.js');
  const packagedDesktopImportPath = path.join(fixtureDir, 'desktop-import.js');
  const packagedPreviewPagePath = path.join(fixtureDir, 'guide-preview.html');
  const packagedPreviewScriptPath = path.join(fixtureDir, 'guide-preview.js');
  assert.equal(fs.existsSync(packagedManifestPath), true, 'Packaged manifest.json is missing');
  assert.equal(
    fs.existsSync(packagedBufferPath),
    true,
    'Packaged pre-capture-buffer.js is missing',
  );
  assert.equal(
    fs.existsSync(packagedPreviewPagePath) && fs.existsSync(packagedPreviewScriptPath),
    true,
    'Packaged detached image preview runtime is missing',
  );

  const packagedManifest = JSON.parse(fs.readFileSync(packagedManifestPath, 'utf8'));
  assert.equal(packagedManifest.version, sourceManifest.version);
  const includesNativeMessaging = packagedManifest.permissions?.includes('nativeMessaging') === true;
  assert.equal(fs.existsSync(packagedDesktopBridgePath), includesNativeMessaging);
  assert.equal(fs.existsSync(packagedDesktopImportPath), includesNativeMessaging);

  run(process.execPath, [path.join(scriptDir, 'verify-recorder-profile.mjs')], {
    env: {
      ...process.env,
      PARRO_RECORDER_EXTENSION_PATH: fixtureDir,
      PARRO_RECORDER_EXPECTED_VERSION: packagedManifest.version,
    },
  });

  console.log(JSON.stringify({
    ok: true,
    archive: path.basename(archivePath),
    recorderVersion: packagedManifest.version,
    browser: 'playwright-chromium',
    extensionSource: 'extracted-store-package',
  }));
} finally {
  removeOwnedRecorderExtensionFixture(fixtureDir);
}
