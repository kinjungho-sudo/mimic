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
const desktopImport = read('mimic_app/app/desktop-import/page.tsx');
const desktopDownload = read('mimic_app/app/download/desktop/DownloadButton.tsx');
const desktopClient = read('mimic_app/lib/desktop-companion-client.ts');
const middleware = read('mimic_app/middleware.ts');
const nextConfig = read('mimic_app/next.config.mjs');
const manifest = JSON.parse(read('mimic_recorder/manifest.json'));
const background = read('mimic_recorder/background.js');
const content = read('mimic_recorder/content.js');
const popup = read('mimic_recorder/popup.js');
const desktopBridge = read('mimic_recorder/desktop-bridge.js');
const nativeHost = read('mimic_desktop/native-host/src/host.js');
const desktopLauncher = read('mimic_desktop/native-host/installer/launcher/ParroDesktop.cs');
const captureAgent = read('mimic_desktop/native-host/src/capture-agent.ps1');

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
  assert.doesNotMatch(block, /notifyDesktopCaptureStarted/);
  assert.doesNotMatch(block, /START_CAPTURE_SESSION/);
});

check(() => {
  const start = background.indexOf("chrome.storage.onChanged.addListener");
  const end = background.indexOf('// ── 액션 레이블 생성', start);
  const block = background.slice(start, end);
  assert.ok(start >= 0 && end > start, 'browser recording storage listener must be present');
  assert.doesNotMatch(block, /notifyDesktopCaptureStarted/);
  assert.doesNotMatch(block, /notifyDesktopCaptureStopped/);
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
  const captureStart = background.indexOf("if (message.type === 'CAPTURE_SCREENSHOT')");
  const captureEnd = background.indexOf("if (message.type === 'MANUAL_IMAGE_STEP')", captureStart);
  const captureBlock = background.slice(captureStart, captureEnd);
  assert.match(captureBlock, /captureState\.targetTabId !== tabId/);
  assert.match(captureBlock, /inactive_recording_target/);

  const stateStart = background.indexOf("if (message.type === 'GET_TAB_RECORDING_STATE')");
  const stateEnd = background.indexOf("if (message.type === 'OPEN_TAB')", stateStart);
  const stateBlock = background.slice(stateStart, stateEnd);
  assert.match(stateBlock, /tabId === r\.targetTabId/);

  const followStart = background.indexOf('async function followActiveTab');
  const followEnd = background.indexOf('chrome.tabs.onActivated.addListener', followStart);
  const followBlock = background.slice(followStart, followEnd);
  assert.match(followBlock, /if \(tabId !== targetTabId\)/);
  assert.match(followBlock, /type: 'STOP_RECORDING'/);
  assert.doesNotMatch(followBlock, /storageSet\(\{ targetTabId: tabId \}\)/);

  const focusoutStart = content.indexOf("document.addEventListener('focusout'");
  const focusoutEnd = content.indexOf("document.addEventListener('change'", focusoutStart);
  const focusoutBlock = content.slice(focusoutStart, focusoutEnd);
  assert.match(focusoutBlock, /const blurredTypingTarget = typingTarget/);
  assert.match(focusoutBlock, /setTimeout\(\(\) => \{/);
  assert.match(focusoutBlock, /typingTarget !== blurredTypingTarget/);
  assert.match(focusoutBlock, /flushTyping\(blurredTypingTarget/);
});

check(() => {
  assert.match(popup, /function renderSteps\(steps\)/);
  assert.match(popup, /setStepCardExpanded\(card, true\)/);
  assert.match(popup, /topRow\.addEventListener\('click', toggleExpanded\)/);
  assert.match(popup, /setAttribute\('aria-expanded', String\(expanded\)\)/);
  assert.match(popup, /requestAnimationFrame\(scrollStepsToBottom\)/);
});

check(() => {
  assert.match(popup, /type: 'FINALIZE_SESSION'/);
  assert.match(popup, /function showFinalizingError\(detail\)/);
  assert.match(popup, /btn\.textContent = '다시 시도'/);
  assert.match(popup, /btnFinish\.click\(\)/);
  assert.match(background, /\/manual\/\$\{data\.tutorial_id\}\/editor\?from=recording/);
});

check(() => {
  assert.match(desktopSetup, /sendDesktopExtensionMessage\('START_DESKTOP_RECORDING'\)/);
  assert.match(desktopSetup, /sendDesktopExtensionMessage\('STOP_DESKTOP_RECORDING'/);
  assert.match(desktopSetup, /window\.location\.replace\(`\/desktop-import\?source=desktop-app&session=/);
  assert.match(desktopImport, /sendDesktopExtensionMessage\(\s*'IMPORT_DESKTOP_CAPTURE'/);
  assert.match(desktopImport, /window\.location\.replace\(response\.editorUrl\)/);
});

check(() => {
  assert.match(desktopClient, /for \(const extensionId of extensionIds\)/);
  assert.match(desktopClient, /if \(!isExtensionConnectionError\(response\?\.error\)\) return response/);
  assert.match(desktopClient, /resolveDesktopCaptureEntry/);
  assert.match(desktopClient, /desktopCompanionCompatibility/);
  assert.match(desktopDownload, /최신 버전으로 업데이트/);
  assert.match(desktopDownload, /바로 데스크톱 녹화 시작/);
  assert.match(middleware, /PAID_DESKTOP_PATHS/);
  assert.match(middleware, /hasEntitlement\(profile\?\.plan, 'desktop_companion'\)/);
  assert.match(nextConfig, /source: '\/downloads\/ParroDesktopSetup\.exe'/);
  assert.match(nextConfig, /Content-Disposition'[\s\S]*attachment; filename="ParroDesktopSetup\.exe"/);
});

check(() => {
  const start = background.indexOf("if (message.action === 'START_DESKTOP_RECORDING')");
  const end = background.indexOf("if (message.action === 'PAUSE_DESKTOP_RECORDING'", start);
  const block = background.slice(start, end);
  assert.ok(start >= 0 && end > start, 'explicit desktop recording handlers must be present');
  assert.match(block, /notifyDesktopCaptureStarted\(/);
  assert.match(block, /notifyDesktopCaptureStopped\(/);
  assert.match(background, /desktop_paid_plan_required/);
  assert.match(background, /recorderVersion: chrome\.runtime\.getManifest\(\)\.version/);
  assert.match(background, /async function importDesktopCaptureSession\(nativeSessionId\)/);
  assert.match(background, /editorUrl: `\$\{imported\.webapp_origin\}\/manual\/\$\{imported\.tutorial_id\}\/editor`/);
});

check(() => {
  assert.match(desktopBridge, /type: 'START_CAPTURE_SESSION'/);
  assert.match(desktopBridge, /type: 'STOP_CAPTURE_SESSION'/);
  assert.match(desktopBridge, /type: 'READ_CAPTURE_IMAGE_CHUNK'/);
  assert.match(desktopBridge, /version: _desktopVersion/);
});

check(() => {
  assert.match(nativeHost, /message\.type === "START_CAPTURE_SESSION"/);
  assert.match(nativeHost, /message\.type === "STOP_CAPTURE_SESSION"/);
  assert.match(nativeHost, /message\.type === "READ_CAPTURE_IMAGE_CHUNK"/);
  assert.match(nativeHost, /version: DESKTOP_COMPANION_VERSION/);
});

check(() => {
  assert.match(desktopLauncher, /new CountdownForm\(Screen\.FromPoint\(Cursor\.Position\)\)/);
  assert.match(desktopLauncher, /internal sealed class CapturePreviewForm/);
  assert.match(desktopLauncher, /previewForm\.RefreshSession\(files\)/);
  assert.match(desktopLauncher, /json\.Append\("\{\\"regions\\":\["\)/);
  assert.match(desktopLauncher, /captureProcess\.WaitForExit\(5000\)/);
  assert.match(desktopLauncher, /\/desktop-import\?source=desktop-app&session=/);
});

check(() => {
  assert.match(captureAgent, /public static class ParroDesktopClickHighlight/);
  assert.match(captureAgent, /\[ParroDesktopClickHighlight\]::ShowAt\(\$point\.X, \$point\.Y\)/);
  assert.match(captureAgent, /WdaExcludeFromCapture/);
  assert.match(captureAgent, /foreach \(\$region in \$regions\)/);
});

console.log(JSON.stringify({
  ok: true,
  checks,
  scope: 'read-only-source-contract',
  liveCapture: false,
  osMutation: false,
}));
