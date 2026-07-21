import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createOwnedRecorderExtensionFixture,
  createOwnedRecorderProfile,
  isOwnedRecorderExtensionFixture,
  isOwnedRecorderProfile,
  launchIsolatedRecorder,
  removeOwnedRecorderExtensionFixture,
  removeOwnedRecorderProfile,
} from './recorder-profile-harness.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const recorderRoot = path.resolve(scriptDir, '..', '..', 'mimic_recorder');
const profileDir = createOwnedRecorderProfile();
const fixtureExtensionPath = createOwnedRecorderExtensionFixture();
const sessionId = 'session_dev_fixture_001';
const tutorialId = 'tutorial_dev_fixture_001';
const syntheticError = 'Synthetic completion failed; retry is safe.';
const externalNetworkAttempts = [];
const localEditorRequests = [];
let context = null;
let server = null;
let editorOrigin = null;
let checks = 0;

function check(assertion) {
  assertion();
  checks += 1;
}

function syntheticStep() {
  return {
    id: 'parro-synthetic-finish-step-01',
    stepNumber: 1,
    eventId: 'parro-synthetic-finish-event-01',
    url: 'https://example.invalid/parro-dev-fixture/finish',
    pageTitle: 'Parro synthetic finish fixture',
    timestamp: Date.parse('2026-07-18T04:00:00.000Z'),
    actionLabel: 'Synthetic finish action',
    domainInfo: {
      hostname: 'example.invalid',
      name: 'Parro DEV Fixture',
      favicon: '',
    },
    imageUrl: null,
  };
}

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    } else {
      throw new Error(`Unsupported Recorder fixture entry: ${sourcePath}`);
    }
  }
}

async function startFakeEditor() {
  server = http.createServer((request, response) => {
    localEditorRequests.push({ method: request.method, url: request.url });
    const requestUrl = new URL(request.url, editorOrigin);
    const expectedPath = `/manual/${tutorialId}/editor`;
    if (request.method === 'GET' && requestUrl.pathname === expectedPath) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><title>Parro synthetic editor fixture</title><main>Local synthetic editor only</main>');
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  editorOrigin = `http://127.0.0.1:${address.port}`;
}

function createSyntheticFinishExtension() {
  for (const fileName of ['manifest.json', 'popup.html', 'popup.js']) {
    fs.copyFileSync(
      path.join(recorderRoot, fileName),
      path.join(fixtureExtensionPath, fileName),
    );
  }
  copyDirectory(
    path.join(recorderRoot, 'icons'),
    path.join(fixtureExtensionPath, 'icons'),
  );
  const manifestPath = path.join(fixtureExtensionPath, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.name = 'Parro Synthetic Finish Fixture';
  manifest.background = { service_worker: 'synthetic-finish-background.js' };
  manifest.permissions = ['storage', 'tabs'];
  manifest.host_permissions = [`${editorOrigin}/*`];
  delete manifest.content_scripts;
  delete manifest.externally_connectable;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const config = JSON.stringify({ editorOrigin, sessionId, tutorialId, syntheticError });
  const backgroundSource = `'use strict';
const CONFIG = ${config};

function readAudit(callback) {
  chrome.storage.local.get('__parroSyntheticFinishAudit', (state) => {
    callback(state.__parroSyntheticFinishAudit || {
      syntheticFinalizeIntercepts: 0,
      realFinalizeSessionCalls: 0,
      nativeHostInvocations: 0,
      captureStartInvocations: 0,
      readOnlyMessages: [],
      unexpectedMessages: [],
      attempts: [],
    });
  });
}

function writeAudit(audit, callback) {
  chrome.storage.local.set({ __parroSyntheticFinishAudit: audit }, callback);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  readAudit((audit) => {
    if (message?.type === 'GUIDE_VALIDATE') {
      audit.readOnlyMessages.push(message.type);
      writeAudit(audit, () => sendResponse({ active: false }));
      return;
    }
    if (message?.type !== 'FINALIZE_SESSION') {
      audit.unexpectedMessages.push(message?.type || message?.action || 'unknown');
      writeAudit(audit, () => sendResponse({ ok: false, error: 'Unexpected synthetic fixture message.' }));
      return;
    }

    audit.syntheticFinalizeIntercepts += 1;
    const attempt = audit.syntheticFinalizeIntercepts;
    audit.attempts.push({
      attempt,
      sessionId: message.sessionId,
      stepNumbers: message.stepNumbers,
      handler: 'synthetic-only',
    });

    if (attempt === 1) {
      setTimeout(() => {
        audit.lastResult = { ok: false, error: CONFIG.syntheticError };
        writeAudit(audit, () => sendResponse(audit.lastResult));
      }, 350);
      return;
    }

    const editorUrl = new URL(
      '/manual/' + encodeURIComponent(CONFIG.tutorialId) + '/editor?from=recording',
      CONFIG.editorOrigin,
    ).href;
    const parsedEditorUrl = new URL(editorUrl);
    if (parsedEditorUrl.origin !== CONFIG.editorOrigin) {
      audit.lastResult = { ok: false, error: 'Synthetic editor origin rejected.' };
      writeAudit(audit, () => sendResponse(audit.lastResult));
      return;
    }

    setTimeout(() => {
      chrome.tabs.create({ url: editorUrl }, (tab) => {
        audit.editorUrl = editorUrl;
        audit.openedTabId = tab?.id ?? null;
        audit.lastResult = {
          ok: true,
          tutorial_id: CONFIG.tutorialId,
          session_id: CONFIG.sessionId,
          webapp_origin: CONFIG.editorOrigin,
        };
        writeAudit(audit, () => sendResponse(audit.lastResult));
      });
    }, 350);
  });
  return true;
});
`;
  fs.writeFileSync(
    path.join(fixtureExtensionPath, 'synthetic-finish-background.js'),
    backgroundSource,
    'utf8',
  );
  return manifest;
}

try {
  check(() => assert.equal(isOwnedRecorderProfile(profileDir), true));
  check(() => assert.equal(isOwnedRecorderExtensionFixture(fixtureExtensionPath), true));
  await startFakeEditor();
  const fixtureManifest = createSyntheticFinishExtension();
  check(() => {
    assert.equal(fixtureManifest.background.service_worker, 'synthetic-finish-background.js');
    assert.deepEqual(fixtureManifest.permissions, ['storage', 'tabs']);
    assert.equal(fixtureManifest.permissions.includes('nativeMessaging'), false);
    assert.equal(fixtureManifest.permissions.includes('desktopCapture'), false);
    assert.deepEqual(fixtureManifest.host_permissions, [`${editorOrigin}/*`]);
  });

  const recorder = await launchIsolatedRecorder(profileDir, { extensionPath: fixtureExtensionPath });
  context = recorder.context;
  const { worker, extensionId } = recorder;
  check(() => assert.match(extensionId, /^[a-p]{32}$/));

  await context.route(/^https?:\/\//, async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === editorOrigin) {
      await route.continue();
      return;
    }
    externalNetworkAttempts.push({ method: route.request().method(), url: route.request().url() });
    await route.abort('blockedbyclient');
  });

  await worker.evaluate(async ({ syntheticSessionId }) => {
    await chrome.storage.local.set({
      isRecording: true,
      isPaused: false,
      sessionId: syntheticSessionId,
      steps: [],
      stepNumber: 0,
    });
  }, { syntheticSessionId: sessionId });

  const panel = await context.newPage();
  await panel.setViewportSize({ width: 420, height: 640 });
  await panel.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
  await panel.waitForFunction(() => document.body.innerText.includes('Parro'));

  const finish = panel.locator('#btnFinish');
  await finish.waitFor({ state: 'visible' });
  const initialFinishState = await panel.evaluate(() => ({
    actionBarDisplay: getComputedStyle(document.getElementById('bottomActionBar')).display,
    finishDisplay: getComputedStyle(document.getElementById('btnFinish')).display,
    finishDisabled: document.getElementById('btnFinish').disabled,
  }));
  check(() => assert.deepEqual(initialFinishState, {
    actionBarDisplay: 'flex',
    finishDisplay: 'flex',
    finishDisabled: false,
  }));
  await finish.click();
  await panel.waitForFunction(() => {
    const toast = document.getElementById('parroToast');
    return toast && toast.style.opacity === '1';
  });
  const guardedEmptyState = await panel.evaluate(async () => {
    const audit = await chrome.storage.local.get('__parroSyntheticFinishAudit');
    return {
      finishDisabled: document.getElementById('btnFinish').disabled,
      overlayExists: !!document.getElementById('finalizingOverlay'),
      toastText: document.getElementById('parroToast')?.textContent || '',
      intercepts: audit.__parroSyntheticFinishAudit?.syntheticFinalizeIntercepts || 0,
    };
  });
  check(() => {
    assert.equal(guardedEmptyState.finishDisabled, false);
    assert.equal(guardedEmptyState.overlayExists, false);
    assert.match(guardedEmptyState.toastText, /스텝|캡처/);
    assert.equal(guardedEmptyState.intercepts, 0);
  });

  const step = syntheticStep();
  await panel.evaluate(async (syntheticCapturedStep) => {
    await chrome.storage.local.set({ steps: [syntheticCapturedStep], stepNumber: 1 });
  }, step);
  await panel.waitForFunction(() => document.querySelectorAll('.step-card').length === 1);
  const readyState = await panel.evaluate(() => ({
    finishVisible: getComputedStyle(document.getElementById('btnFinish')).display !== 'none',
    finishDisabled: document.getElementById('btnFinish').disabled,
    countText: document.getElementById('stepCount')?.textContent,
    actionLabel: document.querySelector('.step-action-label')?.textContent,
  }));
  check(() => assert.deepEqual(readyState, {
    finishVisible: true,
    finishDisabled: false,
    countText: '1 step',
    actionLabel: step.actionLabel,
  }));

  await finish.click();
  await panel.waitForFunction(() => {
    const overlay = document.getElementById('finalizingOverlay');
    return overlay && getComputedStyle(overlay).display === 'flex'
      && document.getElementById('btnFinish').disabled
      && document.getElementById('finalizingMsg');
  });
  const firstLoadingState = await panel.evaluate(() => ({
    overlayDisplay: getComputedStyle(document.getElementById('finalizingOverlay')).display,
    loadingMessage: document.getElementById('finalizingMsg')?.textContent,
    finishDisabled: document.getElementById('btnFinish').disabled,
  }));
  check(() => {
    assert.equal(firstLoadingState.overlayDisplay, 'flex');
    assert.match(firstLoadingState.loadingMessage, /생성하고 있습니다/);
    assert.equal(firstLoadingState.finishDisabled, true);
  });

  await panel.waitForFunction((errorText) => {
    const overlay = document.getElementById('finalizingOverlay');
    return overlay && overlay.textContent.includes(errorText);
  }, syntheticError);
  const errorState = await panel.evaluate(() => ({
    overlayText: document.getElementById('finalizingOverlay')?.textContent || '',
    finishDisabled: document.getElementById('btnFinish').disabled,
    errorAction: document.querySelector('#finalizingOverlay button')?.textContent || '',
  }));
  check(() => {
    assert.match(errorState.overlayText, /Synthetic completion failed/);
    assert.equal(errorState.finishDisabled, false);
    assert.match(errorState.errorAction, /다시 시도/);
  });

  const editorPagePromise = context.waitForEvent('page');
  await panel.locator('#finalizingOverlay button').click();
  await panel.waitForFunction(() => {
    const overlay = document.getElementById('finalizingOverlay');
    return overlay && getComputedStyle(overlay).display === 'flex'
      && document.getElementById('btnFinish').disabled
      && document.getElementById('finalizingMsg');
  });
  const retryLoadingState = await panel.evaluate(() => ({
    overlayDisplay: getComputedStyle(document.getElementById('finalizingOverlay')).display,
    loadingMessage: document.getElementById('finalizingMsg')?.textContent,
    finishDisabled: document.getElementById('btnFinish').disabled,
  }));
  check(() => {
    assert.equal(retryLoadingState.overlayDisplay, 'flex');
    assert.match(retryLoadingState.loadingMessage, /생성하고 있습니다/);
    assert.equal(retryLoadingState.finishDisabled, true);
  });

  const editorPage = await editorPagePromise;
  await editorPage.waitForLoadState('domcontentloaded');
  const expectedEditorUrl = `${editorOrigin}/manual/${tutorialId}/editor?from=recording`;
  check(() => {
    assert.equal(editorPage.url(), expectedEditorUrl);
    assert.equal(new URL(editorPage.url()).origin, editorOrigin);
  });
  const editorTitle = await editorPage.title();
  check(() => assert.equal(editorTitle, 'Parro synthetic editor fixture'));

  const audit = await worker.evaluate(async () => {
    const state = await chrome.storage.local.get('__parroSyntheticFinishAudit');
    return state.__parroSyntheticFinishAudit;
  });
  check(() => {
    assert.equal(audit.syntheticFinalizeIntercepts, 2);
    assert.equal(audit.realFinalizeSessionCalls, 0);
    assert.equal(audit.nativeHostInvocations, 0);
    assert.equal(audit.captureStartInvocations, 0);
    assert.deepEqual(audit.readOnlyMessages, ['GUIDE_VALIDATE']);
    assert.deepEqual(audit.unexpectedMessages, []);
    assert.deepEqual(audit.attempts.map((attempt) => attempt.sessionId), [sessionId, sessionId]);
    assert.deepEqual(audit.attempts.map((attempt) => attempt.stepNumbers), [[1], [1]]);
    assert.equal(audit.lastResult.ok, true);
    assert.equal(audit.lastResult.tutorial_id, tutorialId);
    assert.equal(audit.editorUrl, expectedEditorUrl);
  });
  check(() => {
    assert.deepEqual(externalNetworkAttempts, []);
    assert.ok(localEditorRequests.some((request) => request.method === 'GET'
      && request.url === `/manual/${tutorialId}/editor?from=recording`));
    assert.equal(localEditorRequests.some((request) => request.method !== 'GET'), false);
  });
} finally {
  try {
    if (context) await context.close();
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    removeOwnedRecorderExtensionFixture(fixtureExtensionPath);
    removeOwnedRecorderProfile(profileDir);
  }
}

check(() => {
  assert.equal(fs.existsSync(fixtureExtensionPath), false);
  assert.equal(fs.existsSync(profileDir), false);
});

console.log(JSON.stringify({
  ok: true,
  checks,
  sessionId,
  tutorialId,
  editorRoute: `/manual/${tutorialId}/editor?from=recording`,
  completionAttempts: 2,
  syntheticFinalizeIntercepts: 2,
  realFinalizeSessionCalls: 0,
  externalNetworkRequests: externalNetworkAttempts.length,
  apiMutation: false,
  browserCaptureStarted: false,
  desktopCaptureStarted: false,
  nativeHostInvocations: 0,
  profile: 'isolated-temporary-removed',
}));
