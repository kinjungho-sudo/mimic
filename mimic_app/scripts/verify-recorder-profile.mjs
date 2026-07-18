import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const extensionPath = path.resolve(appRoot, '..', 'mimic_recorder');
const tempRoot = path.resolve(os.tmpdir());
const profileDir = fs.mkdtempSync(path.join(tempRoot, 'Parro-BrowserProfile-'));
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

function removeOwnedProfile() {
  const resolvedProfile = path.resolve(profileDir);
  const expectedPrefix = `${tempRoot}${path.sep}`;
  const ownedName = path.basename(resolvedProfile).startsWith('Parro-BrowserProfile-');
  if (!resolvedProfile.startsWith(expectedPrefix) || !ownedName) {
    throw new Error(`Refusing to remove unexpected browser profile path: ${resolvedProfile}`);
  }
  fs.rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function resolvePlaywrightChromium() {
  const requested = chromium.executablePath();
  if (fs.existsSync(requested)) return requested;

  const cacheRoot = process.env.PLAYWRIGHT_BROWSERS_PATH
    ? path.resolve(process.env.PLAYWRIGHT_BROWSERS_PATH)
    : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!cacheRoot || !fs.existsSync(cacheRoot)) {
    throw new Error('Playwright Chromium is not installed. Run `npx playwright install chromium` explicitly.');
  }

  const executableSuffix = process.platform === 'win32'
    ? path.join('chrome-win64', 'chrome.exe')
    : process.platform === 'darwin'
      ? path.join('chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
      : path.join('chrome-linux', 'chrome');
  const candidates = fs.readdirSync(cacheRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
    .map((entry) => ({
      revision: Number(entry.name.slice('chromium-'.length)),
      executable: path.join(cacheRoot, entry.name, executableSuffix),
    }))
    .filter((candidate) => fs.existsSync(candidate.executable))
    .sort((a, b) => b.revision - a.revision);

  if (!candidates.length) {
    throw new Error('Playwright Chromium is not installed. Run `npx playwright install chromium` explicitly.');
  }
  return candidates[0].executable;
}

try {
  check(() => {
    assert.ok(profileDir.startsWith(`${tempRoot}${path.sep}`));
    assert.match(path.basename(profileDir), /^Parro-BrowserProfile-/);
  });

  const fixture = await listenOnAllowedPort();
  fixtureServer = fixture.server;

  context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    executablePath: resolvePlaywrightChromium(),
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  extensionId = new URL(worker.url()).host;

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
  removeOwnedProfile();
}
