import assert from 'node:assert/strict';
import http from 'node:http';

import {
  createOwnedRecorderProfile,
  launchIsolatedRecorder,
  removeOwnedRecorderProfile,
} from './recorder-profile-harness.mjs';

const profileDir = createOwnedRecorderProfile();
let context = null;
let server = null;
let checks = 0;

function check(assertion) {
  assertion();
  checks += 1;
}

async function closeServer() {
  if (!server) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

try {
  server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(`<!doctype html>
      <html lang="ko">
        <head><meta charset="utf-8"><title>Parro target picker fixture</title></head>
        <body><button id="target" aria-label="알림 신청">알림 신청</button></body>
      </html>`);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const targetUrl = `http://localhost:${address.port}/target`;

  const recorder = await launchIsolatedRecorder(profileDir);
  context = recorder.context;
  const { worker } = recorder;
  const page = await context.newPage();
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  const { tabId, extensionId } = await worker.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    return {
      tabId: tabs.find((tab) => tab.url === url)?.id || null,
      extensionId: chrome.runtime.id,
    };
  }, targetUrl);
  assert.ok(tabId, 'fixture tab was not visible to the Recorder');
  assert.ok(extensionId, 'Recorder extension id is required');

  const readiness = await worker.evaluate((targetTabId) => new Promise((resolve) => {
    chrome.tabs.sendMessage(targetTabId, { type: 'PARRO_CONTENT_READY' }, { frameId: 0 }, (response) => {
      resolve({ response: response || null, error: chrome.runtime.lastError?.message || null });
    });
  }), tabId);
  check(() => assert.equal(readiness.error, null));
  check(() => assert.equal(readiness.response?.ready, true));

  const startedAt = Date.now();
  const pickPromise = page.evaluate(({ recorderId, targetTabId }) => new Promise((resolve) => {
    chrome.runtime.sendMessage(recorderId, { action: 'PICK_LIVE_TARGET', tab_id: targetTabId }, (response) => {
      resolve({ response: response || null, error: chrome.runtime.lastError?.message || null });
    });
  }), { recorderId: extensionId, targetTabId: tabId });

  await page.waitForSelector('#parro-live-target-picker', { state: 'visible', timeout: 5_000 });
  check(() => assert.ok(Date.now() - startedAt < 5_000, 'picker readiness must not wait for the outer timeout'));
  const pickerMarker = await page.locator('#parro-live-target-picker').getAttribute('data-parro-live-target-picker');
  check(() => assert.equal(pickerMarker, 'true'));

  await page.locator('#target').click({ position: { x: 10, y: 10 } });
  const picked = await pickPromise;
  check(() => assert.equal(picked.error, null));
  check(() => assert.equal(picked.response?.ok, true));
  check(() => assert.match(picked.response?.element_selector || '', /#target|button/));
  check(() => assert.equal(picked.response?.label, '알림 신청'));
  check(() => assert.ok(Date.now() - startedAt < 10_000, 'target selection must complete promptly'));

  console.log(JSON.stringify({ ok: true, checks, browser: 'playwright-chromium', scope: 'target-picker-readiness' }));
} finally {
  if (context) await context.close();
  await closeServer();
  removeOwnedRecorderProfile(profileDir);
}
