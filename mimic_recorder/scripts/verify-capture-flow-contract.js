'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const recorderRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(recorderRoot, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const recordingModal = read('mimic_app/components/dashboard/RecordingModal.tsx');
const desktopSetup = read('mimic_app/app/desktop-setup/page.tsx');
const manifest = JSON.parse(read('mimic_recorder/manifest.json'));
const background = read('mimic_recorder/background.js');
const content = read('mimic_recorder/content.js');
const popup = read('mimic_recorder/popup.js');
const desktopBridge = read('mimic_recorder/desktop-bridge.js');
const nativeHost = read('mimic_desktop/native-host/src/host.js');

let checks = 0;
function check(assertion) {
  assertion();
  checks += 1;
}

check(() => {
  assert.match(recordingModal, /wakeAndSend\('GET_TABS'\)/);
  assert.match(recordingModal, /wakeAndSend\('LINK_USER'/);
});

check(() => {
  const start = recordingModal.indexOf('async function sendStartRecording');
  const direct = recordingModal.indexOf("sendMessage('START_RECORDING'", start);
  const fallback = recordingModal.indexOf("wakeAndSend('START_RECORDING'", start);
  assert.ok(start >= 0 && direct > start && fallback > direct, 'direct user-gesture start must precede wake fallback');
});

check(() => {
  const start = background.indexOf("if (message.action === 'START_RECORDING')");
  const end = background.indexOf("if (message.action === 'LINK_USER')", start);
  const block = background.slice(start, end);
  assert.ok(block.indexOf('openRecorderPanel(') < block.indexOf("storageGet('extensionToken')"));
  assert.match(block, /ensureContentScript\(tabId\)/);
  assert.match(block, /chrome\.tabs\.sendMessage\(tabId, \{ type: 'START_RECORDING' \}/);
  assert.match(block, /storageSet\(\{ isRecording: true \}\)/);
});

check(() => {
  assert.equal(manifest.side_panel?.default_path, 'popup.html');
  assert.equal(manifest.background?.service_worker, 'background.js');
});

check(() => {
  assert.match(content, /if \(msg\.type === 'START_RECORDING'\)/);
  assert.match(background, /if \(message\.type === 'CAPTURE_SCREENSHOT'\)/);
});

check(() => {
  assert.match(popup, /function renderSteps\(steps\)/);
  assert.match(popup, /card\.classList\.add\('expanded'\)/);
  assert.match(popup, /requestAnimationFrame\(scrollStepsToBottom\)/);
});

check(() => {
  assert.match(popup, /type: 'FINALIZE_SESSION'/);
  assert.match(background, /\/manual\/\$\{data\.tutorial_id\}\/editor\?from=recording/);
});

check(() => {
  assert.match(desktopSetup, /sendExtensionMessage\('START_DESKTOP_RECORDING'\)/);
  assert.match(desktopSetup, /sendExtensionMessage\('STOP_DESKTOP_RECORDING'/);
  assert.match(desktopSetup, /sendExtensionMessage\('IMPORT_DESKTOP_CAPTURE'/);
  assert.match(desktopSetup, /window\.location\.assign\(response\.editorUrl\)/);
});

check(() => {
  assert.match(background, /if \(message\.action === 'START_DESKTOP_RECORDING'\)/);
  assert.match(background, /if \(message\.action === 'STOP_DESKTOP_RECORDING'\)/);
  assert.match(background, /async function importDesktopCaptureSession\(nativeSessionId\)/);
  assert.match(background, /editorUrl: `\$\{imported\.webapp_origin\}\/manual\/\$\{imported\.tutorial_id\}\/editor`/);
});

check(() => {
  assert.match(desktopBridge, /type: 'START_CAPTURE_SESSION'/);
  assert.match(desktopBridge, /type: 'STOP_CAPTURE_SESSION'/);
  assert.match(desktopBridge, /type: 'READ_CAPTURE_IMAGE_CHUNK'/);
});

check(() => {
  assert.match(nativeHost, /message\.type === "START_CAPTURE_SESSION"/);
  assert.match(nativeHost, /message\.type === "STOP_CAPTURE_SESSION"/);
  assert.match(nativeHost, /message\.type === "READ_CAPTURE_IMAGE_CHUNK"/);
});

console.log(JSON.stringify({
  ok: true,
  checks,
  scope: 'read-only-source-contract',
  liveCapture: false,
  osMutation: false,
}));
