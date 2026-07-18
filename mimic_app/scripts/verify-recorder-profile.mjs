import assert from 'node:assert/strict';
import http from 'node:http';

import {
  createOwnedRecorderProfile,
  isOwnedRecorderProfile,
  launchIsolatedRecorder,
  removeOwnedRecorderProfile,
} from './recorder-profile-harness.mjs';

const profileDir = createOwnedRecorderProfile();
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
    </script>
  </body>
</html>`;
}

async function listenOnAllowedPort() {
  for (const port of allowedPorts) {
    const server = http.createServer((_request, response) => {
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

  const fixture = await listenOnAllowedPort();
  fixtureServer = fixture.server;

  const recorder = await launchIsolatedRecorder(profileDir);
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
  });

  const fixtureUrl = `http://localhost:${fixture.port}/`;
  const page = await context.newPage();
  await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded' });

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

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
  await panel.waitForFunction(() => document.body.innerText.includes('Parro'));
  check(() => {
    assert.match(panel.url(), new RegExp(`^chrome-extension://${extensionId}/popup\\.html`));
  });

  console.log(JSON.stringify({
    ok: true,
    checks: checkCount,
    browser: 'playwright-chromium',
    profile: 'isolated-temporary',
    network: 'localhost-only',
    captureStarted: false,
  }));
} finally {
  if (context) await context.close();
  await closeServer(fixtureServer);
  removeOwnedRecorderProfile(profileDir);
}
