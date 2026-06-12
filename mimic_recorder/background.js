// ── 상수 ─────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://gqynptpjomcqzxyykqic.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeW5wdHBqb21jcXp4eXlrcWljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTcyNzMsImV4cCI6MjA4NzEzMzI3M30.7OgewnWhbE2GK1k0tTuuegrKUVkHuJrW_cpvbVRcH1E';
const SUPABASE_BUCKET   = 'naviaction';
const WEBAPP_ORIGIN     = 'https://mimic-nine-ashen.vercel.app';
const JPEG_QUALITY_DEFAULT = 0.82;
const MAX_STEPS         = 30;

// タイムアウト 상수
const CAPTURE_HIDE_TIMEOUT_MS = 3000;
const CAPTURE_RAF_DELAY_MS    = 50;
const UPLOAD_RETRY_DELAY_MS   = 1500;
const SW_KEEPALIVE_MS         = 20000;
const AUTONAV_COOLDOWN_MS     = 3000;
const DEDUP_HASH_THRESHOLD    = 6;     // aHash(256bit) 해밍거리 ≤ 6 이면 동일 이미지로 간주

// ── 로그 시스템 ──────────────────────────────────────────────────
const LOG_KEY      = '_mimicLogs';
const LOG_MAX      = 300;
const LOG_LEVELS   = { debug: 0, info: 1, warn: 2, error: 3 };

function log(level, source, ...args) {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  const entry = { t: Date.now(), level, source, msg };

  // 콘솔 출력
  const tag = `[MIMIC][${level.toUpperCase()}][${source}]`;
  if (level === 'error')      console.error(tag, msg);
  else if (level === 'warn')  console.warn(tag, msg);
  else if (level === 'debug') console.debug(tag, msg);
  else                        console.log(tag, msg);

  // storage 링버퍼 (fire-and-forget)
  chrome.storage.local.get(LOG_KEY, (r) => {
    const logs = Array.isArray(r[LOG_KEY]) ? r[LOG_KEY] : [];
    logs.push(entry);
    if (logs.length > LOG_MAX) logs.splice(0, logs.length - LOG_MAX);
    chrome.storage.local.set({ [LOG_KEY]: logs });
  });
}

// ── chrome.storage.local 프로미스 헬퍼 ──────────────────────────
function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

function storageRemove(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
}

// ── IndexedDB — 스크린샷 Blob 저장소 ────────────────────────────
const IDB_NAME    = 'mimic_screenshots';
const IDB_STORE   = 'screenshots';
const IDB_VERSION = 1;

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => { e.target.result.createObjectStore(IDB_STORE); };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function idbPut(key, blob) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = (e) => { db.close(); reject(e.target.error); };
  });
}

async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror   = (e) => { db.close(); reject(e.target.error); };
  });
}

async function idbDelete(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = (e) => { db.close(); reject(e.target.error); };
  });
}

async function idbClear() {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = (e) => { db.close(); reject(e.target.error); };
  });
}

// ── 아이콘 클릭 → 사이드패널 자동 열림 설정 ────────────────────
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ── 메모리 캐시 ──────────────────────────────────────────────────
let _cachedTargetTabId = null;  // storage remove 타이밍 경쟁 방지
let _directStartTabId  = null;  // onChanged 중복 START_RECORDING 차단
let _lastCaptureTime   = 0;     // autoNav 쿨다운 경쟁 방지
let _lastSavedHash     = null;  // 직전 저장 이미지 aHash (중복 캡처 디덥용)

// SW 시작 시 캐시 초기화
storageGet(['targetTabId', 'lastCaptureTime', 'lastStepHash']).then((r) => {
  _cachedTargetTabId = r.targetTabId ?? null;
  _lastCaptureTime   = r.lastCaptureTime ?? 0;
  _lastSavedHash     = r.lastStepHash ?? null;
});

// ── 유틸 ─────────────────────────────────────────────────────────
function sendTabMessage(tabId, msg) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, () => { void chrome.runtime.lastError; resolve(); });
  });
}

// ── Offscreen Document 관리 ──────────────────────────────────────
const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');
let _streamActive   = false;  // offscreen 스트림 보유 여부

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument().catch(() => false);
  if (!existing) {
    await chrome.offscreen.createDocument({
      url:    OFFSCREEN_URL,
      reasons: ['USER_MEDIA'],
      justification: 'Tab screen capture via getDisplayMedia',
    });
  }
}

async function startDisplayStream(tabId) {
  await ensureOffscreen();

  // tabCapture.getMediaStreamId는 extension이 해당 탭에서 invoke된 적이 있어야 동작
  // → 웹앱 원격 시작 구조에선 불가. desktopCapture로 picker를 띄워 사용자가 직접 선택.
  const streamId = await new Promise((resolve, reject) => {
    chrome.desktopCapture.chooseDesktopMedia(['tab', 'window', 'screen'], (id) => {
      if (!id) reject(new Error('사용자가 화면 공유를 취소했습니다'));
      else resolve(id);
    });
  });

  const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'START_STREAM', streamId });
  if (res?.ok) {
    _streamActive = true;
    log('info', 'bg', `display stream started tabId=${tabId}`);
  } else {
    _streamActive = false;
    log('warn', 'bg', 'display stream failed:', res?.error);
  }
  return !!res?.ok;
}

async function stopDisplayStream() {
  _streamActive = false;
  const existing = await chrome.offscreen.hasDocument().catch(() => false);
  if (existing) {
    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'STOP_STREAM' }).catch(() => {});
    await chrome.offscreen.closeDocument().catch(() => {});
  }
  log('info', 'bg', 'display stream stopped');
}

// captureTab: 스트림이 살아있으면 offscreen 프레임 추출, 아니면 captureVisibleTab 폴백
async function captureTab(windowId) {
  if (_streamActive) {
    try {
      await ensureOffscreen();
      const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'CAPTURE_FRAME' });
      if (res?.dataUrl) return res.dataUrl;
      log('warn', 'bg', 'offscreen frame null — falling back to captureVisibleTab');
    } catch (err) {
      log('warn', 'bg', 'offscreen capture error:', err.message);
    }
  }
  // fallback
  return new Promise((resolve) => {
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (url) => {
      resolve(chrome.runtime.lastError ? null : url);
    });
  });
}

// ── content.js 주입 보장 ─────────────────────────────────────────
// 확장 설치/리로드 전에 열려 있던 탭에는 content_script가 없을 수 있다.
// START_RECORDING/STOP/수동캡처 전에 호출해 메시지가 유실되지 않게 한다.
// content.js 상단의 window.__mimicContentLoaded 가드가 중복 초기화를 막는다.
function ensureContentScript(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, () => {
      void chrome.runtime.lastError;  // chrome:// 등 주입 불가 페이지는 무시
      resolve();
    });
  });
}

// ── 이미지 평균 해시(aHash) — 동일 이미지 중복 캡처 디덥 ─────────
async function computeAHash(dataUrl) {
  try {
    const res  = await fetch(dataUrl);
    const blob = await res.blob();
    const bmp  = await createImageBitmap(blob);
    const S = 16;
    const canvas = new OffscreenCanvas(S, S);
    const ctx    = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, S, S);
    const d = ctx.getImageData(0, 0, S, S).data;
    const g = new Array(S * S);
    let sum = 0;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      g[p] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      sum += g[p];
    }
    const avg = sum / g.length;
    let bits = '';
    for (let p = 0; p < g.length; p++) bits += g[p] >= avg ? '1' : '0';
    return bits;
  } catch {
    return null;
  }
}

function hammingDist(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

async function getLastSavedHash() {
  if (_lastSavedHash !== null) return _lastSavedHash;
  const { lastStepHash } = await storageGet('lastStepHash');
  _lastSavedHash = lastStepHash ?? null;
  return _lastSavedHash;
}

function setLastSavedHash(hash) {
  _lastSavedHash = hash;
  chrome.storage.local.set({ lastStepHash: hash });
}

function resetLastSavedHash() {
  _lastSavedHash = null;
  chrome.storage.local.remove('lastStepHash');
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror   = reject;
    reader.readAsDataURL(blob);
  });
}

async function compressToJpeg(pngDataUrl, quality = JPEG_QUALITY_DEFAULT) {
  const res  = await fetch(pngDataUrl);
  const blob = await res.blob();
  const bmp  = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx    = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0);
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}

// ── 외부(웹페이지) 메시지 라우터 ────────────────────────────────
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.action === 'GET_TABS') {
    chrome.tabs.query({}).then((tabs) => {
      const result = tabs
        .filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
        .map(t => ({ id: t.id, title: t.title ?? '', url: t.url ?? '', favIconUrl: t.favIconUrl ?? '' }));
      sendResponse({ tabs: result });
    }).catch(() => sendResponse({ tabs: [] }));
    return true;
  }

  if (message.action === 'START_RECORDING') {
    const tabId = message.tabId;
    if (!tabId) { sendResponse({ ok: true }); return false; }

    // ★ 사이드패널은 user gesture가 살아있는 지금(=await 이전) 동기 호출해야 열린다.
    //   웹앱이 클릭 핸들러에서 CONNECT 없이 바로 보낸 메시지라야 제스처가 유지됨.
    try { chrome.sidePanel.open({ tabId }).catch(() => {}); } catch { /* no gesture */ }

    (async () => {
      const sessionId = crypto.randomUUID();
      resetLastSavedHash();

      // 1) targetTabId 먼저 저장 → _cachedTargetTabId 캐시 갱신 보장
      await storageSet({ targetTabId: tabId, sessionId, stepNumber: 0, steps: [] });

      const tab = await new Promise((res) => chrome.tabs.get(tabId, (t) => {
        res(chrome.runtime.lastError ? null : t);
      }));
      if (!tab) { sendResponse({ ok: false }); return; }

      // 2) 보조 시도 (제스처 없으면 무시됨) — windowId 기준 한 번 더
      if (tab.windowId) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});

      // 3) 탭 활성화
      await new Promise((res) => chrome.tabs.update(tabId, { active: true }, res));
      if (tab.windowId) {
        await new Promise((res) => chrome.windows.update(tab.windowId, { focused: true }, res));
      }

      // 4) 탭 로드 완료 대기
      const freshTab = await new Promise((res) => chrome.tabs.get(tabId, (t) => {
        res(chrome.runtime.lastError ? null : t);
      }));
      if (!freshTab) { sendResponse({ ok: false }); return; }

      if (freshTab.status !== 'complete') {
        await new Promise((res) => {
          const onUpdated = (updatedTabId, changeInfo) => {
            if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
            chrome.tabs.onUpdated.removeListener(onUpdated);
            res();
          };
          chrome.tabs.onUpdated.addListener(onUpdated);
        });
      }

      // 5) content.js 주입 보장 후 START_RECORDING 전송 (1회 재시도)
      //    주입이 없으면 카운트다운 메시지가 유실되어 녹화가 안 시작된다 (#1)
      await ensureContentScript(tabId);
      const sent = await new Promise((res) => {
        const doSend = (retry) => {
          chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' }, () => {
            if (chrome.runtime.lastError && !retry) { setTimeout(() => doSend(true), 300); return; }
            void chrome.runtime.lastError;
            res(true);
          });
        };
        doSend(false);
      });
      if (!sent) { sendResponse({ ok: false }); return; }

      // 6) isRecording 세팅 — _directStartTabId로 onChanged 중복 차단
      //    (캡처는 captureVisibleTab 사용 — Gemini/Docs 포함 일반 https 페이지 모두 동작 확인됨.
      //     desktopCapture 스트림은 DRM 등 진짜 차단 페이지 대비용으로 코드만 유지)
      _directStartTabId = tabId;
      await storageSet({ isRecording: true });
      _directStartTabId = null;
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.action === 'LINK_USER') {
    const { token } = message;
    if (!token) { sendResponse({ ok: false, error: 'no token' }); return false; }

    const origin = sender.origin || WEBAPP_ORIGIN;
    (async () => {
      try {
        const res = await fetch(`${origin}/api/extension/redeem`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ link_token: token }),
        });
        if (!res.ok) throw new Error(`redeem failed: ${res.status}`);
        const { session_token } = await res.json();
        await storageSet({ extensionToken: session_token, webappOrigin: origin });
        sendResponse({ ok: true });
      } catch (err) {
        log('error', 'bg', 'redeem error:', err.message);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.action === 'CONNECT') {
    sendResponse({ ok: true });
    return false;
  }

  if (message.action === 'START_GUIDE') {
    const { share_token } = message;
    if (!share_token) { sendResponse({ ok: false, error: 'no share_token' }); return false; }

    (async () => {
      try {
        const origin = await getWebappOrigin();
        const res    = await fetch(`${origin}/api/guide/${share_token}`);
        if (!res.ok) throw new Error(`guide fetch failed: ${res.status}`);
        const data  = await res.json();
        const steps = data.steps || [];
        if (steps.length === 0) throw new Error('no steps');

        await storageSet({ guideSteps: steps, guideCurrentStep: 0, guideModeActive: true });

        const openPanel = (windowId) => chrome.sidePanel.open({ windowId }).catch(() => {});
        if (sender.tab?.windowId) {
          openPanel(sender.tab.windowId);
        } else {
          chrome.windows.getCurrent((win) => { if (win?.id) openPanel(win.id); });
        }

        const firstStep = steps[0];
        if (firstStep.page_url) {
          const tabs = await new Promise((res) => chrome.tabs.query({ active: true }, res));
          const tab  = tabs.find(t => t.url?.startsWith('http://') || t.url?.startsWith('https://'));
          if (tab?.id) {
            const injectOverlay = (tabId) => sendTabMessage(tabId, { type: 'SHOW_OVERLAY', step: firstStep });
            try {
              const currentUrl = new URL(tab.url);
              const targetUrl  = new URL(firstStep.page_url);
              if (currentUrl.origin + currentUrl.pathname === targetUrl.origin + targetUrl.pathname) {
                injectOverlay(tab.id);
              } else {
                chrome.tabs.update(tab.id, { url: firstStep.page_url });
                await storageSet({ guidePendingOverlay: true });
              }
            } catch {
              injectOverlay(tab.id);
            }
          }
        }
        sendResponse({ ok: true });
      } catch (err) {
        log('error', 'bg', 'START_GUIDE error:', err.message);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
});

// ── 내부 메시지 라우터 ────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_SCREENSHOT') {
    const { stepData } = message;
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false }); return true; }

    _lastCaptureTime = Date.now();
    chrome.storage.local.set({ lastCaptureTime: _lastCaptureTime });

    (async () => {
      const tab = await new Promise((res) => chrome.tabs.get(tabId, (t) => {
        res(chrome.runtime.lastError ? null : t);
      }));
      if (!tab) { sendResponse({ ok: false }); return; }

      const restore = () => sendTabMessage(tabId, { type: 'RESTORE_OVERLAY' });

      // HIDE_OVERLAY_FOR_CAPTURE 응답 타임아웃 — isCapturing stuck 방지
      let hideResponded = false;
      const hideTimeout = setTimeout(() => {
        if (!hideResponded) { restore(); sendResponse({ ok: false }); }
      }, CAPTURE_HIDE_TIMEOUT_MS);

      const response = await new Promise((res) => {
        chrome.tabs.sendMessage(tabId, { type: 'HIDE_OVERLAY_FOR_CAPTURE' }, (r) => {
          hideResponded = true;
          clearTimeout(hideTimeout);
          if (chrome.runtime.lastError) { res(null); return; }
          res(r);
        });
      });

      if (response === null) { restore(); sendResponse({ ok: false }); return; }

      await new Promise((r) => setTimeout(r, CAPTURE_RAF_DELAY_MS));

      const rawDataUrl = await captureTab(tab.windowId);
      if (!rawDataUrl) { restore(); sendResponse({ ok: false }); return; }

      const black = await isBlackScreen(rawDataUrl).catch(() => false);
      if (black) {
        restore();
        chrome.runtime.sendMessage({ type: 'CAPTURE_BLOCKED', stepNumber: stepData.stepNumber, stepData }, () => { void chrome.runtime.lastError; });
        sendResponse({ ok: false, blocked: true });
        return;
      }

      const piiRegions = response?.piiRegions ?? [];
      const dataUrl = piiRegions.length > 0
        ? await applyPixelBlur(rawDataUrl, piiRegions, stepData.windowWidth || 1280, stepData.windowHeight || 800).catch(() => rawDataUrl)
        : rawDataUrl;

      restore();
      sendResponse({ ok: true });
      handleCapture(dataUrl, stepData, tab)
        .then(() => updateBadge())
        .catch((err) => log('error', 'bg', 'handleCapture error:', err.message));
    })();
    return true;
  }

  if (message.type === 'MANUAL_IMAGE_STEP') {
    const { dataUrl, stepData } = message;
    if (!dataUrl || !stepData) { sendResponse({ ok: false }); return false; }

    (async () => {
      const { targetTabId, stepNumber } = await storageGet(['targetTabId', 'stepNumber']);
      const stepNum = (stepNumber || 0) + 1;
      await storageSet({ stepNumber: stepNum });

      let tab = null;
      if (targetTabId) {
        tab = await new Promise((res) => chrome.tabs.get(targetTabId, (t) => {
          res(chrome.runtime.lastError ? null : t);
        }));
      }
      await handleCapture(dataUrl, { ...stepData, stepNumber: stepNum }, tab);
      updateBadge();
      sendResponse({ ok: true });
    })().catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'MANUAL_CAPTURE') {
    // 수동 캡처는 content의 isRecording 상태에 의존하지 않고 background에서 직접 처리한다 (#6).
    const directTabId = sender.tab?.id;
    (async () => {
      const { targetTabId } = await storageGet(['targetTabId']);
      const tabId = directTabId || _cachedTargetTabId || targetTabId;
      if (!tabId) { sendResponse({ ok: false, error: 'no target tab' }); return; }

      const tab = await new Promise((res) => chrome.tabs.get(tabId, (t) => {
        res(chrome.runtime.lastError ? null : t);
      }));
      if (!tab) { sendResponse({ ok: false }); return; }

      // 캡처 대상 탭을 활성화해야 captureVisibleTab이 올바른 화면을 잡는다
      await new Promise((res) => chrome.tabs.update(tabId, { active: true }, () => { void chrome.runtime.lastError; res(); }));
      if (tab.windowId) await new Promise((res) => chrome.windows.update(tab.windowId, { focused: true }, () => { void chrome.runtime.lastError; res(); }));

      await ensureContentScript(tabId);

      // 오버레이 숨김 + PII 영역 수집 (HIDE 핸들러는 녹화중이 아니어도 동작)
      const response = await new Promise((res) => {
        let done = false;
        const to = setTimeout(() => { if (!done) res(null); }, CAPTURE_HIDE_TIMEOUT_MS);
        chrome.tabs.sendMessage(tabId, { type: 'HIDE_OVERLAY_FOR_CAPTURE' }, (r) => {
          done = true; clearTimeout(to);
          res(chrome.runtime.lastError ? null : r);
        });
      });
      await new Promise((r) => setTimeout(r, CAPTURE_RAF_DELAY_MS));

      const rawDataUrl = await captureTab(tab.windowId);
      sendTabMessage(tabId, { type: 'RESTORE_OVERLAY', flash: true });  // 캡처 플래시 피드백
      if (!rawDataUrl) { sendResponse({ ok: false }); return; }

      const piiRegions = response?.piiRegions ?? [];
      const dataUrl = piiRegions.length > 0
        ? await applyPixelBlur(rawDataUrl, piiRegions, tab.width || 1280, tab.height || 800).catch(() => rawDataUrl)
        : rawDataUrl;

      const { stepNumber } = await storageGet('stepNumber');
      const stepNum = (stepNumber || 0) + 1;
      const stepData = {
        url: tab.url, timestamp: Date.now(),
        clickX: 0, clickY: 0,
        windowWidth: tab.width || 1280, windowHeight: tab.height || 800,
        stepNumber: stepNum, manual: true,
      };
      await handleCapture(dataUrl, stepData, tab);
      updateBadge();
      sendResponse({ ok: true });
    })().catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'TYPING_PROGRESS') {
    chrome.runtime.sendMessage({ type: 'TYPING_PROGRESS', text: message.text, label: message.label, masked: message.masked }, () => {
      void chrome.runtime.lastError;
    });
    sendResponse({ ok: true });
    return false;
  }

  // 페이지 이동 후 content가 자기 탭의 녹화 상태를 복원할 때 사용 — 녹화 대상 탭에만 true 응답
  if (message.type === 'GET_TAB_RECORDING_STATE') {
    const tabId = sender.tab?.id;
    (async () => {
      const r = await storageGet(['isRecording', 'isPaused', 'stepNumber', 'targetTabId']);
      const isTarget = !!r.isRecording && tabId != null && tabId === (r.targetTabId ?? _cachedTargetTabId);
      sendResponse({ isRecording: isTarget, isPaused: !!r.isPaused, stepNumber: r.stepNumber || 0 });
    })();
    return true;
  }

  if (message.type === 'OPEN_TAB') {
    chrome.tabs.create({ url: message.url });
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'FINALIZE_SESSION') {
    finalizeSession(message.sessionId)
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((err) => { log('error', 'bg', 'finalize error:', err.message); sendResponse({ ok: false }); });
    return true;
  }

  if (message.type === 'UNDO_STEP') {
    (async () => {
      const { steps, stepNumber } = await storageGet(['steps', 'stepNumber']);
      const arr = steps || [];
      const n   = stepNumber || 0;
      if (n <= 0 || arr.length === 0) { sendResponse({ ok: false }); return; }
      const removed = arr.pop();
      if (removed?.stepNumber) idbDelete(removed.stepNumber).catch(() => {});
      await storageSet({ steps: arr, stepNumber: n - 1 });
      updateBadge();
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === 'CLEAR_STEPS') {
    idbClear().catch(() => {});
    resetLastSavedHash();
    storageSet({ steps: [], stepNumber: 0 }).then(() => { updateBadge(); sendResponse({ ok: true }); });
    return true;
  }

  if (message.type === 'APPLY_BLUR') {
    const { stepNumber, region } = message;
    if (!stepNumber || !region) { sendResponse({ ok: false }); return false; }

    (async () => {
      let blob = await idbGet(stepNumber);
      if (!blob) {
        const { steps } = await storageGet('steps');
        const meta = (steps || []).find(s => s.stepNumber === stepNumber);
        if (!meta?.imageUrl) { sendResponse({ ok: false, error: 'blob not found' }); return; }
        const fetchRes = await fetch(meta.imageUrl);
        if (!fetchRes.ok) { sendResponse({ ok: false, error: 'fetch failed' }); return; }
        blob = await fetchRes.blob();
        await idbPut(stepNumber, blob);
      }

      const bmp = await createImageBitmap(blob);
      const iw = bmp.width, ih = bmp.height;
      const rx = Math.round(region.x * iw);
      const ry = Math.round(region.y * ih);
      const rw = Math.round(region.w * iw);
      const rh = Math.round(region.h * ih);

      if (rw < 2 || rh < 2) { sendResponse({ ok: false, error: 'region too small' }); return; }

      const canvas = new OffscreenCanvas(iw, ih);
      const ctx    = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0);

      const BLOCK = Math.max(8, Math.round(Math.min(rw, rh) / 10));
      const imgData = ctx.getImageData(rx, ry, rw, rh);
      const d = imgData.data;
      for (let by = 0; by < rh; by += BLOCK) {
        for (let bx = 0; bx < rw; bx += BLOCK) {
          let r = 0, g = 0, b = 0, count = 0;
          for (let dy = 0; dy < BLOCK && by + dy < rh; dy++) {
            for (let dx = 0; dx < BLOCK && bx + dx < rw; dx++) {
              const i = ((by + dy) * rw + (bx + dx)) * 4;
              r += d[i]; g += d[i+1]; b += d[i+2]; count++;
            }
          }
          r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
          for (let dy = 0; dy < BLOCK && by + dy < rh; dy++) {
            for (let dx = 0; dx < BLOCK && bx + dx < rw; dx++) {
              const i = ((by + dy) * rw + (bx + dx)) * 4;
              d[i] = r; d[i+1] = g; d[i+2] = b;
            }
          }
        }
      }
      ctx.putImageData(imgData, rx, ry);

      const { settings } = await storageGet('settings');
      const quality  = settings?.quality ? settings.quality / 100 : JPEG_QUALITY_DEFAULT;
      const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      await idbPut(stepNumber, jpegBlob);

      const { steps, sessionId } = await storageGet(['steps', 'sessionId']);
      const stepMeta = (steps || []).find(s => s.stepNumber === stepNumber);
      if (stepMeta?.imageUrl && sessionId) {
        const path = `${sessionId}/step_${String(stepNumber).padStart(2, '0')}.jpg`;
        uploadImage(path, jpegBlob).catch(() => {});
      }
      sendResponse({ ok: true });
    })().catch((err) => {
      log('error', 'bg', 'APPLY_BLUR error:', err.message);
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }

  if (message.type === 'GET_GUIDE_STATE') {
    storageGet(['guideSteps', 'guideCurrentStep', 'guideModeActive']).then((r) => {
      sendResponse({ steps: r.guideSteps || [], currentStep: r.guideCurrentStep || 0, active: !!r.guideModeActive });
    });
    return true;
  }

  if (message.type === 'GUIDE_NEXT' || message.type === 'GUIDE_PREV') {
    (async () => {
      const { guideSteps, guideCurrentStep } = await storageGet(['guideSteps', 'guideCurrentStep']);
      const steps = guideSteps || [];
      let idx = guideCurrentStep || 0;
      if (message.type === 'GUIDE_NEXT') idx = Math.min(idx + 1, steps.length - 1);
      else idx = Math.max(idx - 1, 0);

      await storageSet({ guideCurrentStep: idx });
      const step = steps[idx];
      sendResponse({ ok: true, currentStep: idx, step });

      const tabs = await new Promise((res) => chrome.tabs.query({ active: true }, res));
      const tab  = tabs.find(t => t.url?.startsWith('http://') || t.url?.startsWith('https://'));
      if (!tab?.id) return;

      if (step.page_url) {
        try {
          const currentUrl = new URL(tab.url);
          const targetUrl  = new URL(step.page_url);
          if (currentUrl.origin + currentUrl.pathname !== targetUrl.origin + targetUrl.pathname) {
            chrome.tabs.update(tab.id, { url: step.page_url });
            await storageSet({ guidePendingOverlay: true });
            return;
          }
        } catch { /* same-tab fallback */ }
      }
      sendTabMessage(tab.id, { type: 'SHOW_OVERLAY', step });
    })();
    return true;
  }

  if (message.type === 'EXIT_GUIDE') {
    (async () => {
      await storageRemove(['guideSteps', 'guideCurrentStep', 'guideModeActive', 'guidePendingOverlay']);
      const tabs = await new Promise((res) => chrome.tabs.query({ active: true }, res));
      const tab  = tabs.find(t => t.url?.startsWith('http://') || t.url?.startsWith('https://'));
      if (tab?.id) sendTabMessage(tab.id, { type: 'HIDE_OVERLAY' });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === 'DELETE_STEP') {
    (async () => {
      const { steps, stepNumber } = await storageGet(['steps', 'stepNumber']);
      const arr    = steps || [];
      const target = arr.find((s) => s.id === message.id);
      if (target?.stepNumber) idbDelete(target.stepNumber).catch(() => {});
      const filtered = arr.filter((s) => s.id !== message.id);
      await storageSet({ steps: filtered, stepNumber: filtered.length });
      updateBadge();
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === 'STREAM_ENDED') {
    _streamActive = false;
    log('warn', 'bg', 'display stream ended by user — captureVisibleTab fallback active');
    return false;
  }

  if (message.type === 'RELAY_LOG') {
    const entry = { t: Date.now(), level: message.level, source: message.source, msg: message.msg };
    chrome.storage.local.get(LOG_KEY, (r) => {
      const logs = Array.isArray(r[LOG_KEY]) ? r[LOG_KEY] : [];
      logs.push(entry);
      if (logs.length > LOG_MAX) logs.splice(0, logs.length - LOG_MAX);
      chrome.storage.local.set({ [LOG_KEY]: logs });
    });
    return false;
  }

  if (message.type === 'GET_LOGS') {
    chrome.storage.local.get(LOG_KEY, (r) => {
      sendResponse({ logs: r[LOG_KEY] || [] });
    });
    return true;
  }

  if (message.type === 'CLEAR_LOGS') {
    chrome.storage.local.remove(LOG_KEY, () => sendResponse({ ok: true }));
    return true;
  }
});

// ── 팝업 탭 녹화 대상 추가 ───────────────────────────────────────
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab.openerTabId) return;
  const { isRecording, targetTabId } = await storageGet(['isRecording', 'targetTabId']);
  if (!isRecording) return;
  if (tab.openerTabId !== targetTabId) return;
  await storageSet({ targetTabId: tab.id, _prevTargetTabId: targetTabId });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { isRecording, targetTabId, _prevTargetTabId } = await storageGet(['isRecording', 'targetTabId', '_prevTargetTabId']);
  if (!isRecording) return;
  if (targetTabId !== tabId) return;
  if (!_prevTargetTabId) return;
  await storageSet({ targetTabId: _prevTargetTabId, _prevTargetTabId: null });
});

// ── URL 변경 탐지 (cross-origin 이동 캡처) ───────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url?.startsWith('http')) return;

  const r = await storageGet(['isRecording', 'isPaused', 'targetTabId', 'stepNumber', 'settings', 'pendingCapture', 'guidePendingOverlay', 'guideSteps', 'guideCurrentStep', 'spaNavCapturing', 'lastCaptureTime']);

  if (r.guidePendingOverlay) {
    await storageRemove('guidePendingOverlay');
    const step = (r.guideSteps || [])[r.guideCurrentStep || 0];
    if (step) sendTabMessage(tabId, { type: 'SHOW_OVERLAY', step });
  }

  if (!r.isRecording || r.isPaused) return;
  if (r.targetTabId !== tabId) return;

  const pending = r.pendingCapture ?? null;
  if (pending) {
    let pendingOriginPath = '', currentOriginPath = '';
    try { pendingOriginPath = new URL(pending.url).origin + new URL(pending.url).pathname; } catch { /**/ }
    try { currentOriginPath = new URL(tab.url).origin + new URL(tab.url).pathname; } catch { /**/ }

    if (pendingOriginPath && pendingOriginPath === currentOriginPath) {
      await storageRemove('pendingCapture');
      return;
    }

    // 이동 전 source 캡처가 방금 stepNumber를 올렸을 수 있으므로 최신값 재조회 (collision 방지)
    const { stepNumber: freshNum } = await storageGet('stepNumber');
    const pendingStepNum = (freshNum || 0) + 1;
    _lastCaptureTime = Date.now();
    await storageSet({ stepNumber: pendingStepNum, lastCaptureTime: _lastCaptureTime });
    await storageRemove('pendingCapture');

    const dataUrl = await captureWithPII(tabId, tab);
    if (!dataUrl) return;
    handleCapture(dataUrl, { ...pending, url: tab.url, clickX: 0, clickY: 0, stepNumber: pendingStepNum }, tab)
      .then(() => updateBadge())
      .catch((err) => log('warn', 'bg', 'pending capture failed:', err.message));
    return;
  }

  const autoNav = r.settings?.autoNav ?? false;
  if (!autoNav) return;
  if (r.spaNavCapturing) return;

  const lastCapture = Math.max(_lastCaptureTime, r.lastCaptureTime || 0);
  if (lastCapture && (Date.now() - lastCapture) < AUTONAV_COOLDOWN_MS) return;

  const { stepNumber: freshNum } = await storageGet('stepNumber');
  const stepNum = (freshNum || 0) + 1;
  await storageSet({ stepNumber: stepNum });

  const dataUrl = await captureWithPII(tabId, tab);
  if (!dataUrl) return;
  handleCapture(dataUrl, {
    url: tab.url, timestamp: Date.now(),
    clickX: 0, clickY: 0,
    windowWidth: tab.width || 1280, windowHeight: tab.height || 800,
    stepNumber: stepNum,
    actionInfo: { type: 'navigate', label: tab.url },
  }, tab)
    .then(() => updateBadge())
    .catch((err) => log('warn', 'bg', 'nav capture failed:', err.message));
});

// ── 페이지 렌더 완료 확인 후 캡처 ───────────────────────────────
async function waitForTabPaint(tabId, windowId, maxMs = 3000, intervalMs = 400) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const ready = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (document.readyState !== 'complete') return false;
        if (!document.body || document.body.innerHTML.length < 200) return false;
        const vw = window.innerWidth, vh = window.innerHeight;
        for (const el of document.querySelectorAll('*')) {
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
          if (st.position !== 'fixed' && st.position !== 'absolute') continue;
          const rect = el.getBoundingClientRect();
          if (rect.width * rect.height < vw * vh * 0.40) continue;
          const text = (el.innerText || '').trim();
          if (/잠시만|기다려|loading|로딩|please wait|처리\s*중/i.test(text)) return false;
        }
        return true;
      },
    }).then((res) => res?.[0]?.result === true).catch(() => false);

    if (ready) {
      await new Promise((r) => setTimeout(r, 300));
      const dataUrl = await captureTab(windowId);
      if (dataUrl) return dataUrl;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return captureTab(windowId);
}

// ── PII 블러 포함 캡처 (tabs.onUpdated 경로용) ───────────────────
async function captureWithPII(tabId, tab) {
  const rawDataUrl = await waitForTabPaint(tabId, tab.windowId, 3000);
  if (!rawDataUrl) return null;

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'HIDE_OVERLAY_FOR_CAPTURE' }, async (response) => {
      void chrome.runtime.lastError;
      await new Promise((r) => setTimeout(r, 0));

      const capturedUrl = await captureTab(tab.windowId);
      sendTabMessage(tabId, { type: 'RESTORE_OVERLAY' });

      if (!capturedUrl) { resolve(rawDataUrl); return; }

      const piiRegions = response?.piiRegions ?? [];
      if (piiRegions.length === 0) { resolve(capturedUrl); return; }

      const blurred = await applyPixelBlur(capturedUrl, piiRegions, tab.width || 1280, tab.height || 800).catch(() => capturedUrl);
      resolve(blurred);
    });
  });
}

// ── 검은 화면(캡처 차단) 감지 ────────────────────────────────────
async function isBlackScreen(pngDataUrl) {
  try {
    const res  = await fetch(pngDataUrl);
    const blob = await res.blob();
    const bmp  = await createImageBitmap(blob);
    const w = bmp.width, h = bmp.height;
    if (w === 0 || h === 0) return true;

    const canvas = new OffscreenCanvas(w, h);
    const ctx    = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0);

    let totalBrightness = 0;
    const SAMPLES = 3;
    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        const px = Math.floor(w * (sx + 1) / (SAMPLES + 1));
        const py = Math.floor(h * (sy + 1) / (SAMPLES + 1));
        const d  = ctx.getImageData(px, py, 1, 1).data;
        totalBrightness += (d[0] + d[1] + d[2]) / 3;
      }
    }
    return (totalBrightness / (SAMPLES * SAMPLES)) < 5;
  } catch {
    return false;
  }
}

// ── PII 영역 픽셀 블러 — OffscreenCanvas 사용 ───────────────────
async function applyPixelBlur(pngDataUrl, piiRegions, viewportWidth, viewportHeight) {
  if (!piiRegions || piiRegions.length === 0) return pngDataUrl;

  const res  = await fetch(pngDataUrl);
  const blob = await res.blob();
  const bmp  = await createImageBitmap(blob);
  const imgW = bmp.width, imgH = bmp.height;

  const canvas = new OffscreenCanvas(imgW, imgH);
  const ctx    = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0);

  const scaleX = imgW / (viewportWidth  || imgW);
  const scaleY = imgH / (viewportHeight || imgH);

  for (const region of piiRegions) {
    const rx = Math.max(0, Math.floor(region.x      * scaleX));
    const ry = Math.max(0, Math.floor(region.y      * scaleY));
    const rw = Math.min(imgW - rx, Math.ceil(region.width  * scaleX) + 2);
    const rh = Math.min(imgH - ry, Math.ceil(region.height * scaleY) + 2);
    if (rw <= 0 || rh <= 0) continue;

    const PIXEL = 10;
    const imgData = ctx.getImageData(rx, ry, rw, rh);
    const d = imgData.data;
    for (let py = 0; py < rh; py += PIXEL) {
      for (let px2 = 0; px2 < rw; px2 += PIXEL) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let dy = 0; dy < PIXEL && py + dy < rh; dy++) {
          for (let dx = 0; dx < PIXEL && px2 + dx < rw; dx++) {
            const i = ((py + dy) * rw + (px2 + dx)) * 4;
            r += d[i]; g += d[i+1]; b += d[i+2]; count++;
          }
        }
        r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
        for (let dy = 0; dy < PIXEL && py + dy < rh; dy++) {
          for (let dx = 0; dx < PIXEL && px2 + dx < rw; dx++) {
            const i = ((py + dy) * rw + (px2 + dx)) * 4;
            d[i] = r; d[i+1] = g; d[i+2] = b;
          }
        }
      }
    }
    ctx.putImageData(imgData, rx, ry);
  }

  const outBlob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(outBlob);
}

// ── 배지 업데이트 ─────────────────────────────────────────────────
function updateBadge() {
  storageGet(['stepNumber', 'isRecording', 'isPaused']).then((r) => {
    if (!r.isRecording) { chrome.action.setBadgeText({ text: '' }); return; }
    const count = r.stepNumber || 0;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '●' });
    chrome.action.setBadgeBackgroundColor({ color: r.isPaused ? '#f59e0b' : '#EF4444' });
  });
}

// ── storage onChanged ─────────────────────────────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  if ('isRecording' in changes || 'isPaused' in changes || 'stepNumber' in changes) {
    updateBadge();
  }
  if ('targetTabId' in changes) {
    _cachedTargetTabId = changes.targetTabId.newValue ?? null;
  }

  if ('isRecording' in changes) {
    const wasRecording = !!changes.isRecording.oldValue;
    const nowRecording = !!changes.isRecording.newValue;
    if (wasRecording === nowRecording) return;
    if (nowRecording && _directStartTabId) return;  // onMessageExternal이 직접 처리 중

    if (nowRecording) {
      resetLastSavedHash();  // 새 녹화 → 디덥 기준 해시 초기화
    } else {
      chrome.storage.local.remove(['pendingCapture', 'spaNavCapturing']);
      stopDisplayStream().catch(() => {});
    }

    const msgType = nowRecording ? 'START_RECORDING' : 'STOP_RECORDING';

    const sendMsgToTab = (tabId) => {
      if (!tabId) return;
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) return;

        if (nowRecording) {
          chrome.sidePanel.open({ tabId }).catch(() => {
            if (tab.windowId) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
          });
        }

        // content.js 주입 보장 후 메시지 전송 (#1 카운트다운 유실 방지)
        const doSend = () => ensureContentScript(tabId).then(() => sendTabMessage(tabId, { type: msgType }));

        if (nowRecording) {
          chrome.tabs.update(tabId, { active: true }, doSend);
        } else {
          doSend();
        }
      });
    };

    const tabId = _cachedTargetTabId;
    if (tabId) {
      sendMsgToTab(tabId);
    } else {
      storageGet('targetTabId').then(({ targetTabId }) => sendMsgToTab(targetTabId));
    }
  }
});

// ── 액션 레이블 생성 ─────────────────────────────────────────────
function makeActionLabel(actionInfo, stepNum, domainInfo) {
  if (!actionInfo) return `Step ${stepNum}`;
  const { type, label, text } = actionInfo;

  if (type === 'navigate') {
    const dest = (label && !label.startsWith('/') && !label.startsWith('http')) ? label : (domainInfo?.name || domainInfo?.hostname || '');
    return dest ? `이동, ${dest.slice(0, 30)}` : '페이지 이동';
  }

  const name = (label || text || '').trim().slice(0, 30);
  switch (type) {
    case 'click':       return name ? `클릭, ${name}` : '클릭';
    case 'toggle':      return name ? `선택, ${name}` : '선택';
    case 'select':      return name ? `선택, ${name}` : '드롭다운 선택';
    case 'focus_input': return name ? `입력, ${name}` : '입력 필드';
    case 'type':        return actionInfo.masked ? '비밀번호 입력' : (name ? `입력, ${name}` : '텍스트 입력');
    default:            return name ? name : `Step ${stepNum}`;
  }
}

// ── 도메인 정보 추출 ─────────────────────────────────────────────
function extractDomainInfo(url, tab) {
  let hostname = '';
  try { hostname = new URL(url).hostname; } catch { return null; }

  const tabTitle = (tab?.title || '').trim();
  let name = hostname;
  if (tabTitle) {
    const parts = tabTitle.split(/[|\-–—]/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const last  = parts[parts.length - 1];
      const first = parts[0];
      name = /\.(com|co\.kr|io|ai|net|org|kr)$/.test(last) ? first : last;
    } else {
      name = parts[0] || hostname;
    }
    name = name.slice(0, 40) || hostname;
  }

  const favicon = tab?.favIconUrl && !tab.favIconUrl.startsWith('chrome://')
    ? tab.favIconUrl
    : `https://${hostname}/favicon.ico`;

  return { hostname, name, favicon };
}

// ── 캡처 처리 ────────────────────────────────────────────────────
async function handleCapture(pngDataUrl, stepData, tab) {
  // ── 동일 이미지 중복 캡처 디덥 (#4) ───────────────────────────
  //   '페이지 이동' 캡처에만 적용한다. (클릭/타이핑은 같은 화면에서 미세 변화만 있어도
  //   서로 다른 스텝이므로 디덥하면 안 됨 — 사용자 요청은 "이동 시" 중복 제거였음.)
  //   해시는 모든 저장 캡처에 대해 갱신해 다음 이동 캡처가 직전 화면과 비교되게 한다.
  const isNavCapture = stepData.actionInfo?.type === 'navigate';
  const candHash     = await computeAHash(pngDataUrl);
  if (candHash && isNavCapture && !stepData.manual && !stepData.overwrite) {
    const prev = await getLastSavedHash();
    if (prev && hammingDist(candHash, prev) <= DEDUP_HASH_THRESHOLD) {
      log('debug', 'bg', `dedup skip nav capture step ${stepData.stepNumber}`);
      return;
    }
  }

  _lastCaptureTime = Date.now();
  chrome.storage.local.set({ lastCaptureTime: _lastCaptureTime });

  const { settings } = await storageGet('settings');
  const quality    = settings?.quality ? settings.quality / 100 : JPEG_QUALITY_DEFAULT;
  const jpegBlob   = await compressToJpeg(pngDataUrl, quality);
  const jpegDataUrl = await blobToDataUrl(jpegBlob);
  const base64Image = jpegDataUrl.split(',')[1];

  const sessionId = await getOrCreateSessionId();
  const stepNum   = stepData.stepNumber;
  const imagePath = `${sessionId}/step_${String(stepNum).padStart(2, '0')}.jpg`;
  log('debug', 'bg', `capture step ${stepNum} action=${stepData.actionInfo?.type ?? 'click'} url=${stepData.url}`);

  const winW   = stepData.windowWidth  || 1280;
  const winH   = stepData.windowHeight || 800;
  const clickX = (stepData.clickX && winW) ? Math.min(stepData.clickX / winW, 1) : 0;
  const clickY = (stepData.clickY && winH) ? Math.min(stepData.clickY / winH, 1) : 0;

  const domainInfo  = extractDomainInfo(stepData.url, tab);
  const actionLabel = makeActionLabel(stepData.actionInfo, stepNum, domainInfo);

  await idbPut(stepNum, jpegBlob);
  if (!stepData.overwrite) await storageSet({ stepNumber: stepNum });
  if (candHash) setLastSavedHash(candHash);  // 다음 캡처 디덥 기준 갱신

  await processStepUpload({ sessionId, stepNum, imagePath, jpegBlob, base64Image, stepData, clickX, clickY, domainInfo, actionLabel });
}

// ── 스텝 업로드 처리 (SW keepalive 포함) ─────────────────────────
async function processStepUpload({ sessionId, stepNum, imagePath, jpegBlob, base64Image, stepData, clickX, clickY, domainInfo, actionLabel }) {
  const keepaliveInterval = setInterval(() => {
    chrome.storage.local.set({ _swKeepalive: Date.now() });
  }, SW_KEEPALIVE_MS);

  try {
    const [imageResult, analysisResult] = await Promise.allSettled([
      uploadImage(imagePath, jpegBlob),
      analyzeWithClaude(base64Image, stepData.url, stepData.actionInfo, {
        clickX:          stepData.clickX && stepData.windowWidth  ? stepData.clickX  / stepData.windowWidth  : null,
        clickY:          stepData.clickY && stepData.windowHeight ? stepData.clickY  / stepData.windowHeight : null,
        elementRect:     stepData.elementRect     ?? null,
        viewportW:       stepData.windowWidth     ?? null,
        viewportH:       stepData.windowHeight    ?? null,
        elementSelector: stepData.elementSelector ?? null,
      }),
    ]);

    const uploadedUrl = imageResult.status === 'fulfilled' ? imageResult.value : null;
    const { title, description } = analysisResult.status === 'fulfilled'
      ? analysisResult.value
      : { title: null, description: null };

    if (imageResult.status === 'rejected')    log('error', 'bg', `upload failed step ${stepNum}:`, imageResult.reason.message);
    if (analysisResult.status === 'rejected') log('warn',  'bg', `analyze failed step ${stepNum}:`, analysisResult.reason.message);

    if (!uploadedUrl) {
      if (!stepData.overwrite) await storageSet({ stepNumber: stepNum - 1 });
      chrome.runtime.sendMessage({ type: 'UPLOAD_FAILED', stepNumber: stepNum }, () => { void chrome.runtime.lastError; });
      return;
    }

    await saveStepLocally({ ...stepData, imageUrl: uploadedUrl, title, description, actionInfo: stepData.actionInfo ?? null, actionLabel, domainInfo, overwrite: !!stepData.overwrite });
    updateBadge();
    idbDelete(stepNum).catch(() => {});

    try {
      await saveStep({ sessionId, stepNumber: stepNum, screenshotUrl: uploadedUrl, clickX, clickY, title: title ?? '', description: description ?? '', url: stepData.url, domainInfo, viewportW: stepData.viewportW ?? stepData.windowWidth ?? null, viewportH: stepData.viewportH ?? stepData.windowHeight ?? null, elementSelector: stepData.elementSelector ?? null, elementRect: stepData.elementRect ?? null });
      log('info', 'bg', `saved step ${stepNum}: "${title}"`);
    } catch (err) {
      log('warn', 'bg', `save-step API failed step ${stepNum}:`, err.message);
    }
  } finally {
    clearInterval(keepaliveInterval);
  }
}

// ── 로컬 스텝 저장 ───────────────────────────────────────────────
async function saveStepLocally(stepData) {
  const { steps: existing, sessionId } = await storageGet(['steps', 'sessionId']);
  const steps = existing || [];
  const stepNum = stepData.stepNumber;

  const newStep = {
    id:          `step_${stepNum}_${Date.now()}`,
    stepNumber:  stepNum,
    url:         stepData.url,
    timestamp:   stepData.timestamp || Date.now(),
    title:       stepData.title       ?? null,
    description: stepData.description ?? null,
    imageUrl:    stepData.imageUrl     ?? null,
    actionLabel: stepData.actionLabel  ?? null,
    actionInfo:  stepData.actionInfo   ?? null,
    domainInfo:  stepData.domainInfo   ?? null,
    elementRect: stepData.elementRect  ?? null,
    clickX:      stepData.clickX       ?? 0,
    clickY:      stepData.clickY       ?? 0,
    windowWidth: stepData.windowWidth  ?? 1280,
    windowHeight:stepData.windowHeight ?? 800,
    manual:      !!stepData.manual,
  };

  if (stepData.overwrite) {
    const idx = steps.findIndex(s => s.stepNumber === stepNum);
    if (idx >= 0) steps[idx] = { ...steps[idx], ...newStep };
    else steps.push(newStep);
  } else {
    steps.push(newStep);
  }

  await storageSet({ steps });
}

// ── sessionId 가져오기 (없으면 생성) ─────────────────────────────
async function getOrCreateSessionId() {
  const { sessionId } = await storageGet('sessionId');
  if (sessionId) return sessionId;
  const newId = crypto.randomUUID();
  await storageSet({ sessionId: newId });
  return newId;
}

// ── 토큰 만료 처리 ───────────────────────────────────────────────
async function handleTokenExpired() {
  log('warn', 'bg', '토큰 만료 또는 무효 — 재연동 필요');
  await storageRemove('extensionToken');
  const { isRecording } = await storageGet('isRecording');
  if (isRecording) await storageSet({ isRecording: false, isPaused: false });
  chrome.runtime.sendMessage({ type: 'TOKEN_EXPIRED' }, () => { void chrome.runtime.lastError; });
}

// ── fetch 래퍼 — 401 시 handleTokenExpired 자동 호출 ────────────
async function authedFetch(url, options = {}) {
  const { extensionToken } = await storageGet('extensionToken');
  if (!extensionToken) throw new Error('Not linked — extensionToken 없음');

  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${extensionToken}`,
      'Content-Type':  'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    await handleTokenExpired();
    throw new Error('TOKEN_EXPIRED');
  }
  return res;
}

async function getWebappOrigin() {
  const { webappOrigin } = await storageGet('webappOrigin');
  return webappOrigin || WEBAPP_ORIGIN;
}

// ── AI 분석 — 웹앱 API 경유 ──────────────────────────────────────
async function analyzeWithClaude(base64Image, url, actionInfo, elementContext = {}) {
  const origin = await getWebappOrigin();
  const res = await authedFetch(`${origin}/api/capture/analyze`, {
    method: 'POST',
    body: JSON.stringify({ image: base64Image, url, actionInfo, ...elementContext }),
  });
  if (!res.ok) throw new Error(`analyze failed: ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── 스텝 저장 — 웹앱 API 경유 ───────────────────────────────────
async function saveStep({ sessionId, stepNumber, screenshotUrl, clickX, clickY, title, description, url, domainInfo, viewportW, viewportH, elementSelector, elementRect }) {
  const origin = await getWebappOrigin();
  const res = await authedFetch(`${origin}/api/capture/save-step`, {
    method: 'POST',
    body: JSON.stringify({
      session_id:       sessionId,
      step_number:      stepNumber,
      screenshot_url:   screenshotUrl,
      click_x:          clickX,
      click_y:          clickY,
      title:            title ?? '',
      description:      description ?? '',
      url,
      domain_hostname:  domainInfo?.hostname  ?? null,
      domain_name:      domainInfo?.name      ?? null,
      domain_favicon:   domainInfo?.favicon   ?? null,
      viewport_w:       viewportW             ?? null,
      viewport_h:       viewportH             ?? null,
      element_selector: elementSelector       ?? null,
      element_rect:     elementRect           ?? null,
    }),
  });
  if (!res.ok) throw new Error(`save-step failed: ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── 세션 완료 — 웹앱 API 경유 ───────────────────────────────────
async function finalizeSession(sessionId) {
  const { extensionToken } = await storageGet('extensionToken');
  if (!extensionToken) {
    log('warn', 'bg', 'extensionToken 없음 — /extension-link 에서 연동 필요');
    return { tutorial_id: null, step_count: 0 };
  }
  const origin = await getWebappOrigin();
  const res = await authedFetch(`${origin}/api/capture/finalize`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) throw new Error(`finalize failed: ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Supabase Storage 업로드 (실패 시 1회 재시도) ─────────────────
// extensionToken은 웹앱 자체 토큰(Supabase JWT 아님)이라 쓸 수 없다 — anon key 고정.
// x-upsert:true는 INSERT + UPDATE 정책 둘 다 필요 (naviaction에 anon 정책 적용됨)
async function uploadImage(path, blob) {
  const doUpload = () => fetch(
    `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${path}`,
    {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type':  'image/jpeg',
        'x-upsert':      'true',
      },
      body: blob,
    }
  );
  let res = await doUpload();
  if (!res.ok) {
    await new Promise(r => setTimeout(r, UPLOAD_RETRY_DELAY_MS));
    res = await doUpload();
  }
  if (!res.ok) throw new Error(`Storage upload failed: ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
}

