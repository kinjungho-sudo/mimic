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

async function sendToTab(worker, tabId, message) {
  return worker.evaluate(({ targetTabId, payload }) => new Promise((resolve) => {
    chrome.tabs.sendMessage(targetTabId, payload, (response) => {
      resolve({ response: response || null, error: chrome.runtime.lastError?.message || null });
    });
  }), { targetTabId: tabId, payload: message });
}

try {
  server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(`<!doctype html>
      <html lang="ko">
        <head>
          <meta charset="utf-8">
          <title>Parro Live Guide fixture</title>
          <style>
            body { margin: 0; font-family: sans-serif; }
            #target { position: absolute; left: 40px; top: 40px; width: 140px; height: 44px; }
            #screenshot-card { position: absolute; left: 280px; top: 180px; width: 620px; height: 360px; background: #eee; }
            #signup { position: absolute; left: 40px; top: 120px; display: flex; gap: 8px; }
          </style>
        </head>
        <body>
          <button class="guide-target" id="target" aria-label="새로 만들기">새로 만들기</button>
          <form id="signup" novalidate>
            <input id="email" type="email" required aria-label="이메일" />
            <button id="submit-email" type="submit">알림 신청</button>
            <span id="email-error" role="alert" hidden></span>
          </form>
          <div class="guide-target" id="screenshot-card">워크스페이스 스크린샷 썸네일</div>
          <script>
            document.querySelector('#target').addEventListener('click', () => { window.targetClicks = (window.targetClicks || 0) + 1; });
            document.querySelector('#signup').addEventListener('submit', (event) => {
              event.preventDefault();
              const input = document.querySelector('#email');
              const error = document.querySelector('#email-error');
              if (!input.validity.valid) {
                error.hidden = false;
                error.textContent = '올바른 이메일 형식을 입력해주세요.';
                return;
              }
              error.hidden = true;
              error.textContent = '';
              window.validSubmissions = (window.validSubmissions || 0) + 1;
            });
          </script>
        </body>
      </html>`);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const currentUrl = `${origin}/workspace`;

  const recorder = await launchIsolatedRecorder(profileDir);
  context = recorder.context;
  const { worker } = recorder;
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(currentUrl, { waitUntil: 'domcontentloaded' });

  const tabId = await worker.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((tab) => tab.url === url)?.id || null;
  }, currentUrl);
  assert.ok(tabId, 'fixture tab was not visible to the Recorder');

  const validStep = {
    id: 'live-guide-valid-target',
    page_url: currentUrl,
    title: '새로 만들기 클릭',
    instruction: '새로 만들기를 클릭합니다.',
    kind: 'click',
    element_selector: '.guide-target',
    click_x: 860,
    click_y: 860,
    target_context: {
      accessibleName: '새로 만들기',
      contextLabel: null,
      pageTitle: 'Parro Live Guide fixture',
      selectorConfidence: 'low',
    },
  };

  await sendToTab(worker, tabId, { type: 'SHOW_OVERLAY', step: validStep, index: 0, total: 1 });
  await page.waitForSelector('#parro-overlay-root');
  check(() => assert.equal(page.url(), currentUrl));

  await page.click('#target');
  await page.waitForSelector('#parro-overlay-root', { state: 'detached' });
  check(() => assert.equal(page.url(), currentUrl));
  const completedOverlayCount = await page.locator('#parro-overlay-root').count();
  const targetClicks = await page.evaluate(() => window.targetClicks);
  check(() => assert.equal(completedOverlayCount, 0));
  check(() => assert.equal(targetClicks, 1));

  await sendToTab(worker, tabId, {
    type: 'SHOW_OVERLAY',
    step: {
      ...validStep,
      id: 'missing-target',
      element_selector: '#not-present',
      target_context: { ...validStep.target_context, accessibleName: '존재하지 않는 대상' },
    },
    index: 0,
    total: 1,
  });
  await page.waitForTimeout(1300);
  const missingTargetOverlayCount = await page.locator('#parro-overlay-root').count();
  check(() => assert.equal(missingTargetOverlayCount, 0));

  await sendToTab(worker, tabId, {
    type: 'SHOW_OVERLAY',
    step: { ...validStep, id: 'wrong-page', page_url: `${origin}/different-page` },
    index: 0,
    total: 1,
  });
  await page.waitForTimeout(300);
  const wrongPageOverlayCount = await page.locator('#parro-overlay-root').count();
  check(() => assert.equal(wrongPageOverlayCount, 0));

  await sendToTab(worker, tabId, {
    type: 'SHOW_OVERLAY',
    step: { ...validStep, id: 'wrong-workspace', page_url: `${currentUrl}?workspace=other` },
    index: 0,
    total: 1,
  });
  await page.waitForTimeout(300);
  const wrongWorkspaceOverlayCount = await page.locator('#parro-overlay-root').count();
  check(() => assert.equal(wrongWorkspaceOverlayCount, 0));

  await sendToTab(worker, tabId, {
    type: 'SHOW_OVERLAY',
    step: {
      ...validStep,
      id: 'validated-submit',
      title: '알림 신청하기',
      instruction: '이메일을 입력한 뒤 알림 신청을 누릅니다.',
      element_selector: '#submit-email',
      target_context: { ...validStep.target_context, accessibleName: '알림 신청', selectorConfidence: 'high' },
    },
    index: 0,
    total: 1,
  });
  await page.waitForSelector('#parro-overlay-root');
  await page.click('#submit-email');
  await page.waitForTimeout(850);
  const invalidSubmitOverlayCount = await page.locator('#parro-overlay-root').count();
  const validationNotice = await page.locator('#parro-overlay-root').getAttribute('data-validation-error');
  check(() => assert.equal(invalidSubmitOverlayCount, 1));
  check(() => assert.match(validationNotice || '', /올바른 이메일 형식을 입력해주세요/));

  await page.fill('#email', 'tester@example.com');
  await page.click('#submit-email');
  await page.waitForSelector('#parro-overlay-root', { state: 'detached' });
  const validSubmissions = await page.evaluate(() => window.validSubmissions || 0);
  check(() => assert.equal(validSubmissions, 1));

  console.log(JSON.stringify({
    ok: true,
    checks,
    browser: 'playwright-chromium',
    target: 'evidence-selected',
    missingTargetUi: false,
    wrongPageUi: false,
    completionUi: false,
    invalidSubmitBlocked: true,
  }));
} finally {
  if (context) await context.close();
  await closeServer();
  removeOwnedRecorderProfile(profileDir);
}
