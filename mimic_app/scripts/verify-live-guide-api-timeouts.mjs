import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_EXTENSION_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const storage = new Map();
globalThis.window = {
  location: {
    hostname: 'localhost',
    origin: 'http://localhost:3000',
    search: '',
  },
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
  addEventListener() {},
  removeEventListener() {},
  postMessage() {},
  setTimeout,
  clearTimeout,
  chrome: {
    runtime: {
      lastError: undefined,
      sendMessage() {},
    },
  },
};

const {
  listLiveGuideTargetTabs,
  pickLiveGuideTarget,
  startLiveGuide,
} = await import('../lib/api/liveGuide.ts');

let checks = 0;
const check = assertion => {
  assertion();
  checks += 1;
};

const [tabsTimeout, pickTimeout, startTimeout] = await Promise.all([
  listLiveGuideTargetTabs(20),
  pickLiveGuideTarget(7, 20),
  startLiveGuide('share-token', 20),
]);
check(() => assert.deepEqual({ ok: tabsTimeout.ok, reason: tabsTimeout.reason }, { ok: false, reason: 'timeout' }));
check(() => assert.deepEqual({ ok: pickTimeout.ok, reason: pickTimeout.reason }, { ok: false, reason: 'timeout' }));
check(() => assert.deepEqual({ ok: startTimeout.ok, reason: startTimeout.reason }, { ok: false, reason: 'timeout' }));

let startGuideMessage = null;
window.chrome.runtime.sendMessage = (_extensionId, message, callback) => {
  startGuideMessage = message;
  callback({ ok: true });
};
const startSuccess = await startLiveGuide('fresh-share-token', 100);
check(() => assert.equal(startSuccess.ok, true));
check(() => assert.equal(startGuideMessage?.webapp_origin, 'http://localhost:3000'));

window.chrome.runtime.sendMessage = (_extensionId, message, callback) => {
  if (message.action !== 'GET_TABS') return;
  callback({
    ok: true,
    tabs: [
      { id: 10, title: 'Foal AI', url: 'https://faolai-landingpage.pages.dev/#early-adopter', urlAccess: true },
      { id: 11, title: 'Parro dev', url: 'https://parro-guide-dev.vercel.app/home', urlAccess: true },
      { id: 12, title: 'Settings', url: 'chrome://settings', urlAccess: false },
    ],
  });
};
const tabsResult = await listLiveGuideTargetTabs(100);
check(() => assert.equal(tabsResult.ok, true));
if (!tabsResult.ok) throw new Error(tabsResult.message);
check(() => assert.deepEqual(tabsResult.tabs.map(tab => tab.id), [10]));

console.log(JSON.stringify({ ok: true, checks, scope: 'live-guide-runtime-timeouts' }));
