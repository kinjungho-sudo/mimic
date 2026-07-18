import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  createOwnedRecorderProfile,
  isOwnedRecorderProfile,
  launchIsolatedRecorder,
  removeOwnedRecorderProfile,
} from './recorder-profile-harness.mjs';

const profileDir = createOwnedRecorderProfile();
const networkAttempts = [];
let context = null;
let checks = 0;

function check(assertion) {
  assertion();
  checks += 1;
}

function syntheticStep(stepNumber) {
  const clickX = 120 + stepNumber * 100;
  const clickY = 90 + stepNumber * 45;
  return {
    id: `parro-synthetic-step-${String(stepNumber).padStart(2, '0')}`,
    stepNumber,
    eventId: `parro-synthetic-event-${String(stepNumber).padStart(2, '0')}`,
    url: `https://example.invalid/parro-dev-fixture/step-${stepNumber}`,
    pageTitle: `Parro synthetic fixture ${stepNumber}`,
    timestamp: Date.parse(`2026-07-18T00:${String(stepNumber).padStart(2, '0')}:00.000Z`),
    clickX,
    clickY,
    windowWidth: 1000,
    windowHeight: 600,
    viewportW: 1000,
    viewportH: 600,
    elementSelector: `[data-parro-synthetic-step="${stepNumber}"]`,
    elementRect: {
      x: Math.min(0.82, clickX / 1000 - 0.04),
      y: Math.min(0.82, clickY / 600 - 0.05),
      width: 0.08,
      height: 0.10,
    },
    actionLabel: `Synthetic action ${stepNumber}`,
    actionInfo: {
      type: 'click',
      label: `Synthetic action ${stepNumber}`,
      targetContext: {
        schemaVersion: 1,
        coordinateSpace: 'top-viewport-css-px',
        captureSurface: 'browser',
        accessibleName: `Synthetic control ${stepNumber}`,
        pageTitle: `Parro synthetic fixture ${stepNumber}`,
      },
    },
    domainInfo: {
      hostname: 'example.invalid',
      name: 'Parro DEV Fixture',
      favicon: '',
    },
    imageUrl: null,
  };
}

function syntheticThumbnail(stepNumber) {
  const x = 55 + stepNumber * 18;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
    <rect width="320" height="180" fill="#E8FFF7"/>
    <rect x="18" y="18" width="284" height="144" rx="14" fill="#FFFFFF" stroke="#009B8E" stroke-width="3"/>
    <circle cx="${x}" cy="90" r="15" fill="#17C9B6"/>
    <text x="160" y="48" text-anchor="middle" font-family="sans-serif" font-size="17" fill="#102033">Parro synthetic step ${stepNumber}</text>
    <text x="160" y="142" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#52606D">artificial fixture only</text>
  </svg>`;
}

async function putSyntheticThumbnails(panel, steps) {
  await panel.evaluate(async (fixtures) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('mimic_screenshots', 1);
      request.onupgradeneeded = () => {
        const opened = request.result;
        if (!opened.objectStoreNames.contains('screenshots')) opened.createObjectStore('screenshots');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('screenshots', 'readwrite');
      const store = transaction.objectStore('screenshots');
      fixtures.forEach(({ stepNumber, svg }) => {
        store.put(new Blob([svg], { type: 'image/svg+xml' }), stepNumber);
      });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, steps.map((step) => ({ stepNumber: step.stepNumber, svg: syntheticThumbnail(step.stepNumber) })));
}

async function injectSteps(panel, steps) {
  await panel.evaluate((syntheticSteps) => new Promise((resolve) => {
    chrome.storage.local.set({ steps: syntheticSteps }, resolve);
  }), steps);
  await panel.waitForFunction((count) => document.querySelectorAll('.step-card').length === count, steps.length);
}

try {
  check(() => assert.equal(isOwnedRecorderProfile(profileDir), true));

  const recorder = await launchIsolatedRecorder(profileDir);
  context = recorder.context;
  const { worker, extensionId } = recorder;
  check(() => assert.match(extensionId, /^[a-p]{32}$/));

  await context.route(/^https?:\/\//, async (route) => {
    networkAttempts.push({ method: route.request().method(), url: route.request().url() });
    await route.abort('blockedbyclient');
  });

  const panel = await context.newPage();
  await panel.setViewportSize({ width: 420, height: 360 });
  await panel.addInitScript(() => {
    window.__parroSyntheticRuntimeMessages = [];
    const originalSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.runtime.sendMessage = (...args) => {
      const message = args.find((arg) => arg && typeof arg === 'object' && !Array.isArray(arg));
      if (message) window.__parroSyntheticRuntimeMessages.push(JSON.parse(JSON.stringify(message)));
      return originalSendMessage(...args);
    };
  });
  await panel.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
  await panel.waitForFunction(() => document.body.innerText.includes('Parro'));

  const emptyState = await panel.evaluate(() => ({
    count: document.querySelectorAll('.step-card').length,
    countText: document.getElementById('stepCount')?.textContent,
    emptyDisplay: getComputedStyle(document.getElementById('emptyState')).display,
  }));
  check(() => {
    assert.deepEqual(emptyState, { count: 0, countText: '0 steps', emptyDisplay: 'flex' });
  });

  const firstStep = syntheticStep(1);
  await putSyntheticThumbnails(panel, [firstStep]);
  await injectSteps(panel, [firstStep]);
  await panel.waitForSelector('.step-thumb img[src^="blob:"]');
  await panel.waitForSelector('.step-thumb-highlight', { state: 'attached' });

  const oneStepState = await panel.evaluate(() => {
    const card = document.querySelector('.step-card');
    const thumb = card.querySelector('.step-thumb');
    const image = thumb.querySelector('img');
    const highlight = thumb.querySelector('.step-thumb-highlight');
    return {
      countText: document.getElementById('stepCount')?.textContent,
      cardId: card.dataset.stepId,
      number: card.querySelector('.step-number')?.textContent,
      label: card.querySelector('.step-action-label')?.textContent,
      expanded: card.classList.contains('expanded'),
      ariaExpanded: card.querySelector('.step-card-toggle')?.getAttribute('aria-expanded'),
      thumbDisplay: getComputedStyle(thumb).display,
      thumbnailSource: image.src,
      thumbnailWidth: image.naturalWidth,
      placeholderDisplay: getComputedStyle(thumb.querySelector('.step-thumb-placeholder')).display,
      highlightStyle: {
        left: highlight.style.left,
        top: highlight.style.top,
        width: highlight.style.width,
        height: highlight.style.height,
      },
    };
  });
  check(() => {
    assert.equal(oneStepState.countText, '1 step');
    assert.equal(oneStepState.cardId, firstStep.id);
    assert.equal(oneStepState.number, '1');
    assert.equal(oneStepState.label, firstStep.actionLabel);
    assert.equal(oneStepState.expanded, true);
    assert.equal(oneStepState.ariaExpanded, 'true');
  });
  check(() => {
    assert.equal(oneStepState.thumbDisplay, 'block');
    assert.match(oneStepState.thumbnailSource, /^blob:chrome-extension:\/\//);
    assert.equal(oneStepState.thumbnailWidth, 320);
    assert.equal(oneStepState.placeholderDisplay, 'none');
  });
  check(() => {
    Object.values(oneStepState.highlightStyle).forEach((value) => assert.match(value, /%$/));
  });

  const toggle = panel.locator('.step-card-toggle');
  await toggle.click();
  await panel.waitForFunction(() => {
    const card = document.querySelector('.step-card');
    return !card.classList.contains('expanded')
      && getComputedStyle(card.querySelector('.step-thumb')).display === 'none'
      && card.querySelector('.step-card-toggle').getAttribute('aria-expanded') === 'false';
  });
  const collapsedState = await panel.evaluate(() => {
    const card = document.querySelector('.step-card');
    return {
      expanded: card.classList.contains('expanded'),
      thumbDisplay: getComputedStyle(card.querySelector('.step-thumb')).display,
      ariaExpanded: card.querySelector('.step-card-toggle').getAttribute('aria-expanded'),
    };
  });
  check(() => assert.deepEqual(collapsedState, {
    expanded: false,
    thumbDisplay: 'none',
    ariaExpanded: 'false',
  }));
  await toggle.press('Enter');
  await panel.waitForFunction(() => {
    const card = document.querySelector('.step-card');
    return card.classList.contains('expanded')
      && getComputedStyle(card.querySelector('.step-thumb')).display === 'block'
      && card.querySelector('.step-card-toggle').getAttribute('aria-expanded') === 'true';
  });
  const expandedState = await panel.evaluate(() => {
    const card = document.querySelector('.step-card');
    return {
      expanded: card.classList.contains('expanded'),
      thumbDisplay: getComputedStyle(card.querySelector('.step-thumb')).display,
      ariaExpanded: card.querySelector('.step-card-toggle').getAttribute('aria-expanded'),
    };
  });
  check(() => assert.deepEqual(expandedState, {
    expanded: true,
    thumbDisplay: 'block',
    ariaExpanded: 'true',
  }));

  const steps = Array.from({ length: 7 }, (_value, index) => syntheticStep(index + 1));
  await putSyntheticThumbnails(panel, steps);
  await injectSteps(panel, steps);
  await panel.waitForFunction((count) => {
    const images = [...document.querySelectorAll('.step-thumb img')];
    return images.length === count && images.every((image) => image.naturalWidth === 320);
  }, steps.length);
  await panel.waitForFunction(() => {
    const cards = [...document.querySelectorAll('.step-card')];
    const latest = cards[cards.length - 1]?.getBoundingClientRect();
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
    return window.scrollY > 0 && atBottom && latest && latest.top < window.innerHeight && latest.bottom > 0;
  });

  const multiStepState = await panel.evaluate(() => ({
    countText: document.getElementById('stepCount')?.textContent,
    ids: [...document.querySelectorAll('.step-card')].map((card) => card.dataset.stepId),
    numbers: [...document.querySelectorAll('.step-number')].map((node) => node.textContent),
    labels: [...document.querySelectorAll('.step-action-label')].map((node) => node.textContent),
    scrollY: window.scrollY,
    atBottom: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4,
  }));
  check(() => {
    assert.equal(multiStepState.countText, '7 steps');
    assert.deepEqual(multiStepState.ids, steps.map((step) => step.id));
    assert.deepEqual(multiStepState.numbers, steps.map((step) => String(step.stepNumber)));
    assert.deepEqual(multiStepState.labels, steps.map((step) => step.actionLabel));
    assert.ok(multiStepState.scrollY > 0);
    assert.equal(multiStepState.atBottom, true);
  });

  const runtimeMessages = await panel.evaluate(() => window.__parroSyntheticRuntimeMessages);
  const forbiddenCommands = new Set([
    'START_RECORDING',
    'CAPTURE_SCREENSHOT',
    'FINALIZE_SESSION',
    'START_DESKTOP_RECORDING',
    'START_CAPTURE_SESSION',
    'IMPORT_DESKTOP_CAPTURE',
  ]);
  check(() => {
    assert.equal(runtimeMessages.some((message) => forbiddenCommands.has(message.type || message.action)), false);
    assert.deepEqual(networkAttempts, []);
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
    assert.equal(captureState.steps.length, steps.length);
  });
} finally {
  try {
    if (context) await context.close();
  } finally {
    removeOwnedRecorderProfile(profileDir);
  }
}

check(() => assert.equal(fs.existsSync(profileDir), false));

console.log(JSON.stringify({
  ok: true,
  checks,
  steps: 7,
  thumbnail: 'synthetic-svg',
  profile: 'isolated-temporary-removed',
  externalNetworkRequests: networkAttempts.length,
  captureStarted: false,
  desktopCaptureStarted: false,
  apiMutation: false,
}));
