import assert from 'node:assert/strict';
import http from 'node:http';

import {
  createOwnedRecorderProfile,
  isOwnedRecorderExtensionFixture,
  isOwnedRecorderProfile,
  launchIsolatedRecorder,
  removeOwnedRecorderProfile,
} from './recorder-profile-harness.mjs';

const profileDir = createOwnedRecorderProfile();
const extensionFixturePath = process.env.PARRO_RECORDER_EXTENSION_PATH || null;
const expectedVersion = process.env.PARRO_RECORDER_EXPECTED_VERSION || null;
const allowedPorts = [3000, 3001];

let context = null;
let fixtureServer = null;
let extensionId = null;
let checkCount = 0;

function check(assertion) {
  assertion();
  checkCount += 1;
}

function fixtureHtml() {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Parro isolated capture fixture</title></head>
  <body>
    <button id="fixture-action" type="button">Fixture action</button>
    <button id="fixture-guide" type="button">Start fixture guide</button>
    <button id="fixture-missing-guide" type="button">Start missing-target guide</button>
    <script>
      const extensionId = ${JSON.stringify(extensionId)};
      window.sendToParro = (action, payload = {}) => new Promise((resolve) => {
        chrome.runtime.sendMessage(extensionId, { action, ...payload }, (response) => {
          resolve({
            response: response || null,
            error: chrome.runtime.lastError?.message || null,
          });
        });
      });
      document.getElementById('fixture-action').addEventListener('click', async () => {
        window.parroStartResult = await window.sendToParro('START_RECORDING', {
          tabId: window.parroFixtureTabId,
          url: window.location.href,
        });
      });
      document.getElementById('fixture-guide').addEventListener('click', async () => {
        window.parroGuideResult = await window.sendToParro('START_GUIDE', {
          share_token: 'synthetic-guide',
          webapp_origin: window.location.origin,
        });
      });
      document.getElementById('fixture-missing-guide').addEventListener('click', async () => {
        window.parroMissingGuideResult = await window.sendToParro('START_GUIDE', {
          share_token: 'synthetic-guide-missing',
          webapp_origin: window.location.origin,
        });
      });
    </script>
  </body>
</html>`;
}

async function listenOnAllowedPort() {
  for (const port of allowedPorts) {
    const server = http.createServer((request, response) => {
      if (request.url === '/api/guide/synthetic-guide') {
        response.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        });
        response.end(JSON.stringify({
          tutorial_id: 'synthetic-guide',
          steps: [{
            id: 'synthetic-guide-step-1',
            title: 'Fixture action',
            instruction: 'Select the fixture action button.',
            page_url: `http://localhost:${port}/`,
            element_selector: '#fixture-action',
            target_context: {
              accessibleName: 'Fixture action',
              selectorConfidence: 'high',
            },
          }],
        }));
        return;
      }
      if (request.url === '/api/guide/synthetic-guide-missing') {
        response.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        });
        response.end(JSON.stringify({
          tutorial_id: 'synthetic-guide-missing',
          steps: [{
            id: 'synthetic-guide-step-missing',
            title: 'Missing fixture action',
            instruction: 'Find an action that is intentionally absent.',
            page_url: `http://localhost:${port}/`,
            element_selector: '#fixture-action-missing',
            target_context: {
              accessibleName: 'Missing fixture action',
              selectorConfidence: 'high',
            },
          }],
        }));
        return;
      }
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(fixtureHtml());
    });

    const listening = await new Promise((resolve, reject) => {
      server.once('error', (error) => {
        if (error.code === 'EADDRINUSE') resolve(false);
        else reject(error);
      });
      server.listen(port, () => resolve(true));
    });

    if (listening) return { server, port };
  }

  throw new Error('Parro Recorder profile smoke requires free localhost port 3000 or 3001.');
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

try {
  check(() => {
    assert.equal(isOwnedRecorderProfile(profileDir), true);
  });
  if (extensionFixturePath) {
    check(() => {
      assert.equal(
        isOwnedRecorderExtensionFixture(extensionFixturePath),
        true,
        'PARRO_RECORDER_EXTENSION_PATH must be an owned temporary extension fixture',
      );
    });
  }

  const fixture = await listenOnAllowedPort();
  fixtureServer = fixture.server;

  const recorder = await launchIsolatedRecorder(
    profileDir,
    extensionFixturePath ? { extensionPath: extensionFixturePath } : {},
  );
  context = recorder.context;
  const worker = recorder.worker;
  extensionId = recorder.extensionId;

  check(() => {
    assert.match(extensionId, /^[a-p]{32}$/);
  });

  const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
  check(() => {
    assert.match(manifest.name, /^Parro Recorder/);
    assert.equal(manifest.side_panel?.default_path, 'popup.html');
    if (expectedVersion) assert.equal(manifest.version, expectedVersion);
  });

  const fixtureUrl = `http://localhost:${fixture.port}/`;
  const page = await context.newPage();
  await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded' });

  const connectResult = await page.evaluate(() => window.sendToParro('CONNECT'));
  check(() => {
    assert.equal(connectResult.error, null);
    assert.equal(connectResult.response?.ok, true);
    assert.equal(connectResult.response?.linked, false);
    assert.equal(connectResult.response?.recorderVersion, manifest.version);
  });

  const fixtureTabId = await worker.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((tab) => tab.url === url)?.id || null;
  }, fixtureUrl);
  assert.ok(fixtureTabId, 'isolated fixture tab was not visible to the Recorder');
  await page.evaluate((tabId) => {
    window.parroFixtureTabId = tabId;
  }, fixtureTabId);

  const contentStatus = await worker.evaluate(async (tabId) => new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'GET_STATUS' }, (response) => {
      resolve({
        response: response || null,
        error: chrome.runtime.lastError?.message || null,
      });
    });
  }), fixtureTabId);
  check(() => {
    assert.equal(contentStatus.error, null);
    assert.deepEqual(contentStatus.response, { isRecording: false, isPaused: false });
  });

  const tabsResult = await page.evaluate(() => window.sendToParro('GET_TABS'));
  check(() => {
    assert.equal(tabsResult.error, null);
    assert.equal(tabsResult.response?.ok, true);
    assert.ok(tabsResult.response.tabs.some((tab) => tab.id === fixtureTabId));
  });

  await page.click('#fixture-action');
  await page.waitForFunction(() => window.parroStartResult !== undefined);
  const startResult = await page.evaluate(() => window.parroStartResult);
  check(() => {
    assert.equal(startResult.error, null);
    assert.equal(startResult.response?.ok, false);
    assert.equal(startResult.response?.reason, 'not_linked');
  });

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
  await panel.waitForFunction(() => document.body.innerText.includes('Parro'));
  const panelTitle = await panel.title();
  check(() => {
    assert.match(panel.url(), new RegExp(`^chrome-extension://${extensionId}/popup\\.html`));
    assert.equal(panelTitle, 'Parro Recorder');
  });

  const previewStepNumber = 999001;
  const previewKey = 'parroImagePreview:profile-smoke';
  await panel.evaluate(async ({ stepNumber, key }) => {
    const bytes = Uint8Array.from(atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    ), char => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'image/png' });
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('mimic_screenshots', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('screenshots');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('screenshots', 'readwrite');
      tx.objectStore('screenshots').put(blob, stepNumber);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    await chrome.storage.local.set({
      [key]: { stepNumber, screenshotUrl: '', title: 'Local preview smoke' },
    });
  }, { stepNumber: previewStepNumber, key: previewKey });

  const previewPagePromise = context.waitForEvent('page');
  await panel.evaluate((key) => new Promise((resolve) => {
    chrome.windows.create({
      url: chrome.runtime.getURL(`guide-preview.html?key=${encodeURIComponent(key)}`),
      type: 'popup',
      width: 760,
      height: 600,
    }, () => resolve());
  }), previewKey);
  const previewPage = await previewPagePromise;
  await previewPage.waitForLoadState('domcontentloaded');
  await previewPage.waitForFunction(() => document.querySelector('#previewImage')?.naturalWidth === 1);
  const previewState = await previewPage.evaluate(() => ({
    title: document.querySelector('#previewTitle')?.textContent,
    naturalWidth: document.querySelector('#previewImage')?.naturalWidth,
    errorVisible: getComputedStyle(document.querySelector('#error')).display !== 'none',
  }));
  check(() => {
    assert.deepEqual(previewState, {
      title: 'Local preview smoke',
      naturalWidth: 1,
      errorVisible: false,
    });
  });
  await previewPage.close();
  await panel.evaluate(async (stepNumber) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('mimic_screenshots', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('screenshots', 'readwrite');
      tx.objectStore('screenshots').delete(stepNumber);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, previewStepNumber);

  const guidePagePromise = context.waitForEvent('page');
  await page.click('#fixture-guide');
  const guidePage = await guidePagePromise;
  await page.waitForFunction(() => window.parroGuideResult !== undefined);
  const guideResult = await page.evaluate(() => window.parroGuideResult);
  check(() => {
    assert.equal(guideResult.error, null);
    assert.equal(guideResult.response?.ok, true);
    assert.ok(Number.isInteger(guideResult.response?.tabId));
  });

  await guidePage.waitForLoadState('domcontentloaded');
  await guidePage.waitForSelector('#parro-overlay-root', { state: 'attached', timeout: 5_000 });
  await guidePage.waitForFunction(() => (
    document.getElementById('parro-overlay-root')?.getAttribute('data-coach-avatar-status') === 'loaded'
  ), null, { timeout: 5_000 });
  const guideOverlay = await guidePage.evaluate(() => {
    const overlay = document.getElementById('parro-overlay-root');
    return {
      count: document.querySelectorAll('#parro-overlay-root').length,
      targetText: document.getElementById('fixture-action')?.textContent?.trim() || null,
      coachAvatarStatus: overlay?.getAttribute('data-coach-avatar-status') || null,
      coachAvatarSize: overlay?.getAttribute('data-coach-avatar-size') || null,
    };
  });
  check(() => {
    assert.equal(guidePage.url(), fixtureUrl);
    assert.deepEqual(guideOverlay, {
      count: 1,
      targetText: 'Fixture action',
      coachAvatarStatus: 'loaded',
      coachAvatarSize: '136',
    });
  });

  const guideState = await worker.evaluate(async () => chrome.storage.local.get([
    'guideModeActive',
    'guideTabId',
    'guidePendingOverlay',
    'guideSteps',
  ]));
  check(() => {
    assert.equal(guideState.guideModeActive, true);
    assert.equal(guideState.guideTabId, guideResult.response.tabId);
    assert.equal(guideState.guidePendingOverlay, undefined);
    assert.equal(guideState.guideSteps?.length, 1);
  });

  await panel.evaluate(() => new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'EXIT_GUIDE' }, () => resolve());
  }));
  await guidePage.close();

  const missingGuidePagePromise = context.waitForEvent('page');
  await page.click('#fixture-missing-guide');
  const missingGuidePage = await missingGuidePagePromise;
  await page.waitForFunction(() => window.parroMissingGuideResult !== undefined);
  const missingGuideResult = await page.evaluate(() => window.parroMissingGuideResult);
  check(() => {
    assert.equal(missingGuideResult.error, null);
    assert.equal(missingGuideResult.response?.ok, true);
  });

  await missingGuidePage.waitForLoadState('domcontentloaded');
  // The first guide step intentionally waits for the 3, 2, 1, START sequence
  // before beginning the existing 8-second target recovery window.
  await panel.locator('#guideTargetRetry').waitFor({ state: 'visible', timeout: 18_000 });
  const missingTargetState = await Promise.all([
    panel.locator('#guideTargetStatus').innerText(),
    missingGuidePage.locator('#parro-overlay-root').count(),
  ]);
  check(() => {
    assert.match(missingTargetState[0], /대상을 찾지 못했습니다/);
    assert.equal(
      missingTargetState[1],
      1,
      'missing targets must retain the recovery prompt overlay',
    );
  });

  await panel.locator('#guideTargetRetry').click();
  await panel.waitForFunction(() => document.querySelector('#guideTargetStatus')?.textContent?.includes('정확한 대상을 찾는 중'));
  const retryHidden = await panel.locator('#guideTargetRetry').isHidden();
  check(() => {
    assert.equal(retryHidden, true);
  });

  const captureState = await worker.evaluate(async () => chrome.storage.local.get([
    'extensionToken',
    'sessionId',
    'targetTabId',
    'isRecording',
    'steps',
  ]));
  check(() => {
    assert.equal(captureState.extensionToken, undefined);
    assert.equal(captureState.sessionId, undefined);
    assert.equal(captureState.targetTabId, undefined);
    assert.notEqual(captureState.isRecording, true);
    assert.ok(!Array.isArray(captureState.steps) || captureState.steps.length === 0);
  });

  console.log(JSON.stringify({
    ok: true,
    checks: checkCount,
    browser: 'playwright-chromium',
    profile: 'isolated-temporary',
    extensionSource: extensionFixturePath ? 'extracted-store-package' : 'source-directory',
    recorderVersion: manifest.version,
    network: 'localhost-only',
    captureStarted: false,
    liveGuideOverlay: true,
    missingTargetRecovery: true,
  }));
} finally {
  if (context) await context.close();
  await closeServer(fixtureServer);
  removeOwnedRecorderProfile(profileDir);
}
