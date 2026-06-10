// ── 설정 ────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://gqynptpjomcqzxyykqic.supabase.co';

// ── IndexedDB — 스크린샷 Blob 저장소 ────────────────────────────
// chrome.storage.local 5MB 한도 우회. 스텝 메타데이터는 storage.local,
// 이미지 Blob만 IndexedDB에 분리 보관.
const IDB_NAME    = 'mimic_screenshots';
const IDB_STORE   = 'screenshots';
const IDB_VERSION = 1;

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(IDB_STORE);
    };
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
// openPanelOnActionClick: true 설정 시 Chrome이 아이콘 클릭을 직접 처리하여
// action.onClicked 이벤트가 발생하지 않는다. onClicked 리스너는 불필요.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeW5wdHBqb21jcXp4eXlrcWljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTcyNzMsImV4cCI6MjA4NzEzMzI3M30.7OgewnWhbE2GK1k0tTuuegrKUVkHuJrW_cpvbVRcH1E';
const SUPABASE_BUCKET   = 'naviaction';
const WEBAPP_ORIGIN     = 'https://mimic-nine-ashen.vercel.app';
const JPEG_QUALITY_DEFAULT = 0.82;
const MAX_STEPS         = 30;

// ── 외부(웹페이지) 메시지 라우터 ────────────────────────────────
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.action === 'GET_TABS') {
    chrome.tabs.query({}).then(tabs => {
      const result = tabs
        .filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
        .map(t => ({
          id:         t.id,
          title:      t.title ?? '',
          url:        t.url ?? '',
          favIconUrl: t.favIconUrl ?? '',
        }));
      sendResponse({ tabs: result });
    }).catch(() => {
      sendResponse({ tabs: [] });
    });
    return true;
  }

  if (message.action === 'START_RECORDING') {
    const tabId = message.tabId;
    if (tabId) {
      const sessionId = crypto.randomUUID();
      // 1) targetTabId 먼저 저장 → _cachedTargetTabId 캐시 갱신 보장
      chrome.storage.local.set({ targetTabId: tabId, sessionId, stepNumber: 0, steps: [] }, () => {
        // 2) isRecording 세팅 — onChanged가 발화하지만 _directStartTabId로 중복 전송 차단
        _directStartTabId = tabId;
        chrome.storage.local.set({ isRecording: true }, () => {
          chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) { _directStartTabId = null; sendResponse({ ok: false }); return; }
            // 3) user gesture context 안에서 사이드패널 열기 (onChanged는 context 없어 실패)
            if (tab.windowId) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
            // 4) 탭 활성화 후 카운트다운 트리거
            chrome.tabs.update(tabId, { active: true }, () => {
              const sendToTab = () => {
                chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' }, () => {
                  void chrome.runtime.lastError;
                  _directStartTabId = null;
                  sendResponse({ ok: true });
                });
              };
              if (tab.windowId) {
                chrome.windows.update(tab.windowId, { focused: true }, sendToTab);
              } else {
                sendToTab();
              }
            });
          });
        });
      });
      return true;
    }
    sendResponse({ ok: true });
    return false;
  }

  // 웹앱에서 링크 토큰 전달 → 즉시 session_token으로 교환
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
        await chrome.storage.local.set({ extensionToken: session_token, webappOrigin: origin });
        sendResponse({ ok: true });
      } catch (err) {
        console.error('[MIMIC] redeem error:', err);
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

    getWebappOrigin().then(origin => fetch(`${origin}/api/guide/${share_token}`))
      .then((res) => {
        if (!res.ok) throw new Error(`guide fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const steps = data.steps || [];
        if (steps.length === 0) throw new Error('no steps');

        chrome.storage.local.set({ guideSteps: steps, guideCurrentStep: 0, guideModeActive: true }, () => {
          // 사이드패널 열기: sender.tab이 있으면 그 탭의 윈도우, 없으면 현재 활성 윈도우
          const openPanel = (windowId) => {
            chrome.sidePanel.open({ windowId }).catch(() => {});
          };

          if (sender.tab?.windowId) {
            openPanel(sender.tab.windowId);
          } else {
            chrome.windows.getCurrent((win) => { if (win?.id) openPanel(win.id); });
          }

          // 첫 스텝의 page_url로 탭 이동 후 오버레이 주입
          const firstStep = steps[0];
          if (firstStep.page_url) {
            chrome.tabs.query({ active: true }, (tabs) => {
              const tab = tabs.find(t => t.url?.startsWith('http://') || t.url?.startsWith('https://'));
              const targetTabId = tab?.id;
              if (!targetTabId) { sendResponse({ ok: true }); return; }

              const injectOverlay = (tabId) => {
                chrome.tabs.sendMessage(tabId, { type: 'SHOW_OVERLAY', step: firstStep }, () => {
                  void chrome.runtime.lastError;
                });
              };

              try {
                const currentUrl = new URL(tab.url);
                const targetUrl  = new URL(firstStep.page_url);
                if (currentUrl.origin + currentUrl.pathname === targetUrl.origin + targetUrl.pathname) {
                  injectOverlay(targetTabId);
                } else {
                  chrome.tabs.update(targetTabId, { url: firstStep.page_url }, () => {
                    // tabs.onUpdated에서 complete 이후 오버레이 주입
                    chrome.storage.local.set({ guidePendingOverlay: true });
                  });
                }
              } catch {
                injectOverlay(targetTabId);
              }
              sendResponse({ ok: true });
            });
          } else {
            sendResponse({ ok: true });
          }
        });
      })
      .catch((err) => {
        console.error('[MIMIC Guide] START_GUIDE error:', err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }
});

// ── 내부 메시지 라우터 ────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_SCREENSHOT') {
    const { stepData } = message;
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false }); return true; }

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) { sendResponse({ ok: false }); return; }

      const restore = () => chrome.tabs.sendMessage(tabId, { type: 'RESTORE_OVERLAY' }, () => { void chrome.runtime.lastError; });

      // HIDE_OVERLAY_FOR_CAPTURE 응답 타임아웃 — content.js가 응답 못해도 isCapturing stuck 방지
      let hideResponded = false;
      const hideTimeout = setTimeout(() => {
        if (!hideResponded) { restore(); sendResponse({ ok: false }); }
      }, 3000);

      // 1) hover overlay 포함 캡처: content.js에 오버레이 숨김 요청
      chrome.tabs.sendMessage(tabId, { type: 'HIDE_OVERLAY_FOR_CAPTURE' }, async (response) => {
        hideResponded = true;
        clearTimeout(hideTimeout);
        if (chrome.runtime.lastError) { restore(); sendResponse({ ok: false }); return; }

        // 2) rAF repaint 완료 대기 후 캡처
        await new Promise((r) => setTimeout(r, 50));

        chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, async (rawDataUrl) => {
          if (chrome.runtime.lastError || !rawDataUrl) {
            restore(); sendResponse({ ok: false }); return;
          }

          // 3) 검은 화면(캡처 차단) 감지
          const black = await isBlackScreen(rawDataUrl).catch(() => false);
          if (black) {
            restore();
            chrome.runtime.sendMessage({ type: 'CAPTURE_BLOCKED', stepNumber: stepData.stepNumber, stepData }, () => { void chrome.runtime.lastError; });
            sendResponse({ ok: false, blocked: true });
            return;
          }

          // 4) PII 픽셀 블러 적용
          const piiRegions = response?.piiRegions ?? [];
          let dataUrl = rawDataUrl;
          if (piiRegions.length > 0) {
            dataUrl = await applyPixelBlur(rawDataUrl, piiRegions, stepData.windowWidth || 1280, stepData.windowHeight || 800).catch(() => rawDataUrl);
          }

          // 5) 오버레이 복원 후 저장
          restore();
          handleCapture(dataUrl, stepData, tab)
            .then(() => { updateBadge(); sendResponse({ ok: true }); })
            .catch((err) => { console.error('[MIMIC] handleCapture error:', err); sendResponse({ ok: false }); });
        });
      });
    });
    return true;
  }

  // 수동 이미지 스텝 — 차단된 페이지에서 사용자가 직접 업로드/붙여넣기한 이미지
  if (message.type === 'MANUAL_IMAGE_STEP') {
    const { dataUrl, stepData } = message;
    if (!dataUrl || !stepData) { sendResponse({ ok: false }); return false; }

    chrome.storage.local.get(['targetTabId', 'stepNumber'], (r) => {
      const tabId   = r.targetTabId;
      // stepNumber는 background가 storage 기준으로 단일 결정 (popup/content 카운터와 diverge 방지)
      const stepNum = (r.stepNumber || 0) + 1;
      chrome.storage.local.set({ stepNumber: stepNum });

      const proceed = (tab) => {
        handleCapture(dataUrl, { ...stepData, stepNumber: stepNum }, tab || null)
          .then(() => { updateBadge(); sendResponse({ ok: true }); })
          .catch(() => sendResponse({ ok: false }));
      };

      if (tabId) {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) proceed(null);
          else proceed(tab);
        });
      } else {
        proceed(null);
      }
    });
    return true;
  }

  if (message.type === 'MANUAL_CAPTURE') {
    // content.js를 거치지 않고 직접 호출되는 fallback 경로 (현재는 미사용)
    // sender.tab이 있으면 해당 탭, 없으면 targetTabId에서 읽음
    const directTabId = sender.tab?.id;
    chrome.storage.local.get(['targetTabId', 'stepNumber'], (r) => {
      const tabId   = directTabId || r.targetTabId;
      const stepNum = (r.stepNumber || 0) + 1;
      if (!tabId) { sendResponse({ ok: false, error: 'no target tab' }); return; }
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) { sendResponse({ ok: false }); return; }
        chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError || !dataUrl) { sendResponse({ ok: false }); return; }
          const stepData = {
            url: tab.url, timestamp: Date.now(),
            clickX: 0, clickY: 0,
            windowWidth: tab.width || 1280, windowHeight: tab.height || 800,
            stepNumber: stepNum, manual: true,
          };
          chrome.storage.local.set({ stepNumber: stepNum });
          handleCapture(dataUrl, stepData, tab)
            .then(() => { updateBadge(); sendResponse({ ok: true }); })
            .catch(() => sendResponse({ ok: false }));
        });
      });
    });
    return true;
  }

  // content.js → 사이드패널로 실시간 타이핑 중계
  if (message.type === 'TYPING_PROGRESS') {
    chrome.runtime.sendMessage({ type: 'TYPING_PROGRESS', text: message.text, label: message.label, masked: message.masked }, () => {
      void chrome.runtime.lastError;
    });
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'DOWNLOAD_ZIP') {
    handleDownloadZip(message.filename)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => { console.error('[MIMIC] ZIP error:', err); sendResponse({ ok: false }); });
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
      .catch((err) => { console.error('[MIMIC] finalize error:', err); sendResponse({ ok: false }); });
    return true;
  }

  if (message.type === 'UNDO_STEP') {
    chrome.storage.local.get(['steps', 'stepNumber'], (r) => {
      const steps = r.steps || [];
      const n     = r.stepNumber || 0;
      if (n <= 0 || steps.length === 0) { sendResponse({ ok: false }); return; }
      const removed = steps.pop();
      if (removed?.stepNumber) idbDelete(removed.stepNumber).catch(() => {});
      chrome.storage.local.set({ steps, stepNumber: n - 1 }, () => { updateBadge(); sendResponse({ ok: true }); });
    });
    return true;
  }

  if (message.type === 'CLEAR_STEPS') {
    idbClear().catch(() => {});
    chrome.storage.local.set({ steps: [], stepNumber: 0 }, () => { updateBadge(); sendResponse({ ok: true }); });
    return true;
  }

  // ── 드래그 블러 ─────────────────────────────────────────────────
  // region: { x, y, w, h } 모두 0~1 정규화 비율
  if (message.type === 'APPLY_BLUR') {
    const { stepNumber, region } = message;
    if (!stepNumber || !region) { sendResponse({ ok: false }); return false; }

    (async () => {
      try {
        const blob = await idbGet(stepNumber);
        if (!blob) { sendResponse({ ok: false, error: 'blob not found' }); return; }

        const bmp = await createImageBitmap(blob);
        const iw = bmp.width, ih = bmp.height;

        // 0~1 정규화 → 실제 픽셀 좌표
        const rx = Math.round(region.x * iw);
        const ry = Math.round(region.y * ih);
        const rw = Math.round(region.w * iw);
        const rh = Math.round(region.h * ih);

        if (rw < 2 || rh < 2) { sendResponse({ ok: false, error: 'region too small' }); return; }

        // 픽셀화(모자이크) 블러 직접 적용
        const canvas = new OffscreenCanvas(iw, ih);
        const ctx = canvas.getContext('2d');
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
            r = Math.round(r / count);
            g = Math.round(g / count);
            b = Math.round(b / count);
            for (let dy = 0; dy < BLOCK && by + dy < rh; dy++) {
              for (let dx = 0; dx < BLOCK && bx + dx < rw; dx++) {
                const i = ((by + dy) * rw + (bx + dx)) * 4;
                d[i] = r; d[i+1] = g; d[i+2] = b;
              }
            }
          }
        }
        ctx.putImageData(imgData, rx, ry);

        const { settings } = await chrome.storage.local.get('settings');
        const quality = settings?.quality ? settings.quality / 100 : JPEG_QUALITY_DEFAULT;
        const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
        await idbPut(stepNumber, jpegBlob);

        // Supabase 재업로드 (imageUrl이 이미 있는 스텝)
        const { steps, sessionId } = await chrome.storage.local.get(['steps', 'sessionId']);
        const stepMeta = (steps || []).find(s => s.stepNumber === stepNumber);
        if (stepMeta?.imageUrl && sessionId) {
          const path = `${sessionId}/step_${String(stepNumber).padStart(2, '0')}.jpg`;
          uploadImage(path, jpegBlob).catch(() => {});
        }

        sendResponse({ ok: true });
      } catch (err) {
        console.error('[MIMIC] APPLY_BLUR error:', err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  // ── Guide Me 내부 메시지 ────────────────────────────────────────
  if (message.type === 'GET_GUIDE_STATE') {
    chrome.storage.local.get(['guideSteps', 'guideCurrentStep', 'guideModeActive'], (r) => {
      sendResponse({ steps: r.guideSteps || [], currentStep: r.guideCurrentStep || 0, active: !!r.guideModeActive });
    });
    return true;
  }

  if (message.type === 'GUIDE_NEXT' || message.type === 'GUIDE_PREV') {
    chrome.storage.local.get(['guideSteps', 'guideCurrentStep'], (r) => {
      const steps = r.guideSteps || [];
      let idx = r.guideCurrentStep || 0;
      if (message.type === 'GUIDE_NEXT') idx = Math.min(idx + 1, steps.length - 1);
      else idx = Math.max(idx - 1, 0);

      chrome.storage.local.set({ guideCurrentStep: idx }, () => {
        const step = steps[idx];
        sendResponse({ ok: true, currentStep: idx, step });

        // 오버레이 업데이트: 현재 활성 탭에 전송
        chrome.tabs.query({ active: true }, (tabs) => {
          const tab = tabs.find(t => t.url?.startsWith('http://') || t.url?.startsWith('https://'));
          if (!tab?.id) return;

          const injectOverlay = (tabId) => {
            chrome.tabs.sendMessage(tabId, { type: 'SHOW_OVERLAY', step }, () => {
              void chrome.runtime.lastError;
            });
          };

          if (step.page_url) {
            try {
              const currentUrl = new URL(tab.url);
              const targetUrl  = new URL(step.page_url);
              if (currentUrl.origin + currentUrl.pathname !== targetUrl.origin + targetUrl.pathname) {
                chrome.tabs.update(tab.id, { url: step.page_url }, () => {
                  chrome.storage.local.set({ guidePendingOverlay: true });
                });
                return;
              }
            } catch { /* same-tab fallback */ }
          }
          injectOverlay(tab.id);
        });
      });
    });
    return true;
  }

  if (message.type === 'EXIT_GUIDE') {
    chrome.storage.local.remove(['guideSteps', 'guideCurrentStep', 'guideModeActive', 'guidePendingOverlay'], () => {
      // 현재 탭의 오버레이 제거
      chrome.tabs.query({ active: true }, (tabs) => {
        const tab = tabs.find(t => t.url?.startsWith('http://') || t.url?.startsWith('https://'));
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'HIDE_OVERLAY' }, () => { void chrome.runtime.lastError; });
        }
      });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'DELETE_STEP') {
    chrome.storage.local.get(['steps', 'stepNumber'], (r) => {
      const target = (r.steps || []).find((s) => s.id === message.id);
      if (target?.stepNumber) idbDelete(target.stepNumber).catch(() => {});
      const steps = (r.steps || []).filter((s) => s.id !== message.id);
      chrome.storage.local.set({ steps, stepNumber: steps.length }, () => { updateBadge(); sendResponse({ ok: true }); });
    });
    return true;
  }
});

// ── 팝업 탭 녹화 대상 추가 ───────────────────────────────────────
// 녹화 중에 현재 targetTabId가 연 팝업(window.open)을 감지 →
// targetTabId를 팝업으로 임시 전환, 팝업 닫히면 원래 탭으로 복귀
chrome.tabs.onCreated.addListener((tab) => {
  if (!tab.openerTabId) return;
  chrome.storage.local.get(['isRecording', 'targetTabId'], (r) => {
    if (!r.isRecording) return;
    if (tab.openerTabId !== r.targetTabId) return;
    // 팝업이 http/https 페이지인지는 onUpdated에서 확인되므로 여기선 ID만 저장
    chrome.storage.local.set({ targetTabId: tab.id, _prevTargetTabId: r.targetTabId });
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get(['isRecording', 'targetTabId', '_prevTargetTabId'], (r) => {
    if (!r.isRecording) return;
    if (r.targetTabId !== tabId) return;
    if (!r._prevTargetTabId) return;
    // 팝업 닫힘 → 원래 탭으로 복귀
    chrome.storage.local.set({ targetTabId: r._prevTargetTabId, _prevTargetTabId: null });
  });
});

// ── URL 변경 탐지 (cross-origin 이동 캡처) ───────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url?.startsWith('http')) return;

  chrome.storage.local.get(['isRecording', 'isPaused', 'targetTabId', 'stepNumber', 'settings', 'pendingCapture', 'guidePendingOverlay', 'guideSteps', 'guideCurrentStep', 'spaNavCapturing', 'lastCaptureTime'], (r) => {
    // Guide Me 탭 이동 후 오버레이 주입
    if (r.guidePendingOverlay) {
      chrome.storage.local.remove('guidePendingOverlay');
      const step = (r.guideSteps || [])[r.guideCurrentStep || 0];
      if (step) {
        chrome.tabs.sendMessage(tabId, { type: 'SHOW_OVERLAY', step }, () => { void chrome.runtime.lastError; });
      }
    }

    if (!r.isRecording || r.isPaused) return;
    if (r.targetTabId !== tabId) return;

    // pendingCapture: 클릭 직후 페이지 이동으로 content.js가 unload된 경우
    // 클릭 당시 URL과 현재 URL이 달라야 실제 페이지 이동으로 판단
    const pending = r.pendingCapture ?? null;
    if (pending) {
      let pendingOriginPath = '';
      let currentOriginPath = '';
      try { pendingOriginPath = new URL(pending.url).origin + new URL(pending.url).pathname; } catch { /**/ }
      try { currentOriginPath = new URL(tab.url).origin + new URL(tab.url).pathname; } catch { /**/ }

      if (pendingOriginPath && pendingOriginPath === currentOriginPath) {
        // 같은 페이지 — content.js가 직접 캡처했을 것이므로 pending 제거만
        chrome.storage.local.remove('pendingCapture');
        return;
      }

      const pendingStepNum = (r.stepNumber || 0) + 1;
      // lastCaptureTime 즉시 세팅 — tabs.onUpdated 재발화로 autoNav 중복 캡처 방지
      chrome.storage.local.set({ stepNumber: pendingStepNum, lastCaptureTime: Date.now() });
      chrome.storage.local.remove('pendingCapture');
      captureWithPII(tabId, tab).then((dataUrl) => {
        if (!dataUrl) return;
        // 새 페이지 스크린샷 — 클릭 좌표는 이전 페이지 기준이므로 제거
        handleCapture(dataUrl, { ...pending, url: tab.url, clickX: 0, clickY: 0, stepNumber: pendingStepNum }, tab)
          .then(() => updateBadge())
          .catch((err) => console.warn('[MIMIC] pending capture failed:', err.message));
      });
      return; // autoNav 중복 캡처 방지
    }

    const autoNav = r.settings?.autoNav ?? false;
    if (!autoNav) return;
    // SPA 이동은 content.js MutationObserver가 단독 처리 중 — 중복 캡처 차단
    if (r.spaNavCapturing) return;
    // 클릭 캡처 직후(3초 이내) 페이지 이동 — 클릭이 이동을 유발한 것으로 간주, autoNav 생략
    if (r.lastCaptureTime && (Date.now() - r.lastCaptureTime) < 3000) return;

    const stepNum = (r.stepNumber || 0) + 1;
    // stepNumber를 먼저 올려 저장 — captureWithPII가 느릴 때 tabs.onUpdated 재발화로 중복 방지
    chrome.storage.local.set({ stepNumber: stepNum });
    captureWithPII(tabId, tab).then((dataUrl) => {
      if (!dataUrl) return;
      const stepData = {
        url: tab.url, timestamp: Date.now(),
        clickX: 0, clickY: 0,
        windowWidth: tab.width || 1280, windowHeight: tab.height || 800,
        stepNumber: stepNum,
        actionInfo: { type: 'navigate', label: tab.url },
      };
      handleCapture(dataUrl, stepData, tab)
        .then(() => updateBadge())
        .catch((err) => console.warn('[MIMIC] nav capture failed:', err.message));
    });
  });
});

// 탭이 실제로 보이는 콘텐츠를 그렸는지 확인 후 캡처.
// document.readyState + body에 텍스트/이미지 노드가 있는지를 탭에 물어보고,
// 준비됐으면 즉시 캡처, 아니면 intervalMs마다 재시도해 maxMs 안에 성공하면 반환.
async function waitForTabPaint(tabId, windowId, maxMs = 3000, intervalMs = 400) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const ready = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (document.readyState !== 'complete') return false;
        if (!document.body || document.body.innerHTML.length < 200) return false;
        // position:fixed로 전체를 덮는 로딩 오버레이 감지
        const vw = window.innerWidth, vh = window.innerHeight;
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
          if (st.position !== 'fixed' && st.position !== 'absolute') continue;
          const rect = el.getBoundingClientRect();
          // 뷰포트의 40% 이상을 덮는 fixed/absolute 레이어가 있으면 로딩 중으로 판단
          if (rect.width * rect.height < vw * vh * 0.40) continue;
          const text = (el.innerText || '').trim();
          if (/잠시만|기다려|loading|로딩|please wait|처리\s*중/i.test(text)) return false;
        }
        return true;
      },
    }).then((res) => res?.[0]?.result === true).catch(() => false);

    if (ready) {
      // 한 번 더 짧게 대기: 이미지/폰트 등 서브리소스 렌더 여유
      await new Promise((r) => setTimeout(r, 300));
      const dataUrl = await new Promise((resolve) => {
        chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (url) => {
          resolve(chrome.runtime.lastError ? null : url);
        });
      });
      if (dataUrl) return dataUrl;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  // 타임아웃: 그냥 한 번 찍어서 반환
  return new Promise((resolve) => {
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (url) => {
      resolve(chrome.runtime.lastError ? null : url);
    });
  });
}

// ── PII 블러 포함 캡처 (tabs.onUpdated 경로용) ───────────────────
// waitForTabPaint로 페이지 준비를 확인한 뒤,
// content.js에 HIDE_OVERLAY_FOR_CAPTURE → PII 좌표 수집 → 캡처 → 픽셀 블러 → 복원
async function captureWithPII(tabId, tab) {
  const rawDataUrl = await waitForTabPaint(tabId, tab.windowId, 3000);
  if (!rawDataUrl) return null;

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'HIDE_OVERLAY_FOR_CAPTURE' }, async (response) => {
      void chrome.runtime.lastError;

      // rAF 응답 후 한 틱 대기
      await new Promise((r) => setTimeout(r, 0));

      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, async (capturedUrl) => {
        chrome.tabs.sendMessage(tabId, { type: 'RESTORE_OVERLAY' }, () => { void chrome.runtime.lastError; });

        if (chrome.runtime.lastError || !capturedUrl) { resolve(rawDataUrl); return; }

        const piiRegions = response?.piiRegions ?? [];
        if (piiRegions.length === 0) { resolve(capturedUrl); return; }

        const blurred = await applyPixelBlur(
          capturedUrl, piiRegions,
          tab.width || 1280, tab.height || 800
        ).catch(() => capturedUrl);
        resolve(blurred);
      });
    });
  });
}

// ── 검은 화면(캡처 차단) 감지 ────────────────────────────────────
// DRM/보안 페이지에서 captureVisibleTab이 검은 화면을 반환하는 경우를 감지.
// 이미지 중앙 9개 샘플 픽셀의 평균 밝기가 임계값(12/255) 미만이면 차단된 것으로 판정.
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

    // 3×3 그리드 샘플링
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
    const avgBrightness = totalBrightness / (SAMPLES * SAMPLES);
    // 임계값 5: RGB(5,5,5) 이하만 차단 판정 — 다크 테마(#111 이상) 오탐 방지.
    // 완전한 DRM 검은 화면은 평균 0에 가깝고, 다크 테마는 최소 10 이상임.
    return avgBrightness < 5;
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

  const imgW = bmp.width;
  const imgH = bmp.height;

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

    // 10px 블록 단위 픽셀화
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
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
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
  return await blobToDataUrl(outBlob);
}

// ── 배지 업데이트 ─────────────────────────────────────────────────
function updateBadge() {
  chrome.storage.local.get(['stepNumber', 'isRecording', 'isPaused'], (r) => {
    const count     = r.stepNumber || 0;
    const recording = !!r.isRecording;
    const paused    = !!r.isPaused;

    if (!recording) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '●' });
    chrome.action.setBadgeBackgroundColor({ color: paused ? '#f59e0b' : '#EF4444' });
  });
}

// background SW 메모리 캐시 — storage remove 타이밍 경쟁 방지
let _cachedTargetTabId = null;
// onMessageExternal이 직접 START_RECORDING을 처리 중인 tabId — onChanged 중복 전송 차단용
let _directStartTabId = null;
// SW 시작 시 캐시 초기화
chrome.storage.local.get('targetTabId', (r) => { _cachedTargetTabId = r.targetTabId ?? null; });

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if ('isRecording' in changes || 'isPaused' in changes || 'stepNumber' in changes) {
    updateBadge();
  }

  // targetTabId 변경 시 메모리 캐시 갱신
  if ('targetTabId' in changes) {
    _cachedTargetTabId = changes.targetTabId.newValue ?? null;
  }

  // isRecording 변화 감지 → 캐시된 targetTabId로 탭에 직접 전달
  if ('isRecording' in changes) {
    const wasRecording = !!changes.isRecording.oldValue;
    const nowRecording = !!changes.isRecording.newValue;
    if (wasRecording === nowRecording) return;
    // onMessageExternal이 직접 처리 중 — 중복 START_RECORDING 전송 차단
    if (nowRecording && _directStartTabId) return;

    const msgType = nowRecording ? 'START_RECORDING' : 'STOP_RECORDING';

    if (!nowRecording) {
      // 녹화 종료 시 pendingCapture 즉시 제거 — 지연된 tabs.onUpdated가 유령 스텝 추가하는 것 방지
      chrome.storage.local.remove(['pendingCapture', 'spaNavCapturing']);
    }

    // 메모리 캐시 우선 사용 → storage.get보다 빠르고 remove 타이밍 경쟁 없음
    const tabId = _cachedTargetTabId;
    if (tabId) {
      // 녹화 시작 시 사이드패널 자동 열기
      // onChanged는 user gesture context 밖이므로 tabId 기반으로 열기 (Chrome 116+)
      if (nowRecording) {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError || !tab) return;
          chrome.sidePanel.open({ tabId }).catch(() => {
            // tabId 방식 실패 시 windowId fallback
            if (tab.windowId) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
          });
        });
      }
      chrome.tabs.sendMessage(tabId, { type: msgType }, () => { void chrome.runtime.lastError; });
    } else {
      // SW 재시작 후 캐시가 비어있을 경우 fallback
      chrome.storage.local.get('targetTabId', ({ targetTabId }) => {
        if (!targetTabId) return;
        if (nowRecording) {
          chrome.tabs.get(targetTabId, (tab) => {
            if (chrome.runtime.lastError || !tab) return;
            chrome.sidePanel.open({ tabId: targetTabId }).catch(() => {
              if (tab.windowId) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
            });
          });
        }
        chrome.tabs.sendMessage(targetTabId, { type: msgType }, () => { void chrome.runtime.lastError; });
      });
    }
  }
});

// ── 액션 레이블 생성 ─────────────────────────────────────────────
function makeActionLabel(actionInfo, stepNum, domainInfo) {
  if (!actionInfo) return `Step ${stepNum}`;
  const { type, label, text } = actionInfo;

  if (type === 'navigate') {
    // label이 있으면 사용, 없으면 도메인 서비스명 fallback
    // URL path(/new, /debate 등)는 절대 사용하지 않음
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
    default:            return name  ? name : `Step ${stepNum}`;
  }
}

// ── 도메인 정보 추출 ─────────────────────────────────────────────
// 스텝 URL에서 hostname + 표시명 + 파비콘 URL을 추출
// 웹앱 편집기가 이 값으로 Tango처럼 도메인별 섹션 헤더를 자동 생성함
function extractDomainInfo(url, tab) {
  let hostname = '';
  try { hostname = new URL(url).hostname; } catch { return null; }

  // 표시명: 탭 타이틀에서 브랜드/서비스명 추출
  // "새 토론 | Sparring AI" → "Sparring AI" (마지막 파트 = 브랜드명, 일관성 유지)
  // "GitHub" → "GitHub" (구분자 없으면 전체)
  // "네이버 - naver.com" → "네이버" (첫 파트가 브랜드인 경우)
  const tabTitle = (tab?.title || '').trim();
  let name = hostname;
  if (tabTitle) {
    const parts = tabTitle.split(/[|\-–—]/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      // 마지막 파트를 브랜드명으로 우선 사용 → 페이지가 바뀌어도 동일한 서비스명 유지
      // 단, 마지막 파트가 도메인 주소처럼 보이면 첫 파트 사용
      const last = parts[parts.length - 1];
      const first = parts[0];
      name = /\.(com|co\.kr|io|ai|net|org|kr)$/.test(last) ? first : last;
    } else {
      name = parts[0] || hostname;
    }
    name = name.slice(0, 40) || hostname;
  }

  // 파비콘: 탭에서 제공하는 URL 우선, 없으면 표준 경로
  const favicon = tab?.favIconUrl && !tab.favIconUrl.startsWith('chrome://')
    ? tab.favIconUrl
    : `https://${hostname}/favicon.ico`;

  return { hostname, name, favicon };
}

// ── 캡처 처리 ────────────────────────────────────────────────────
async function handleCapture(pngDataUrl, stepData, tab) {
  // 캡처 시각 기록 — tabs.onUpdated autoNav 쿨다운에서 사용
  chrome.storage.local.set({ lastCaptureTime: Date.now() });

  const { settings } = await chrome.storage.local.get('settings');
  const quality = settings?.quality ? settings.quality / 100 : JPEG_QUALITY_DEFAULT;
  const jpegBlob    = await compressToJpeg(pngDataUrl, quality);
  const jpegDataUrl = await blobToDataUrl(jpegBlob);
  const base64Image = jpegDataUrl.split(',')[1];

  const sessionId = await getOrCreateSessionId();
  const stepNum   = stepData.stepNumber;
  const imagePath = `${sessionId}/step_${String(stepNum).padStart(2, '0')}.jpg`;

  const winW   = stepData.windowWidth  || 1280;
  const winH   = stepData.windowHeight || 800;
  const clickX = (stepData.clickX && winW) ? Math.min(stepData.clickX / winW, 1) : 0;
  const clickY = (stepData.clickY && winH) ? Math.min(stepData.clickY / winH, 1) : 0;

  // 1단계: 이미지는 IndexedDB에, 메타데이터는 storage.local에 즉시 저장
  const domainInfo  = extractDomainInfo(stepData.url, tab);
  const actionLabel = makeActionLabel(stepData.actionInfo, stepNum, domainInfo);
  await idbPut(stepNum, jpegBlob);
  await saveStepLocally({ ...stepData, imageUrl: null, title: null, description: null, actionInfo: stepData.actionInfo ?? null, actionLabel, domainInfo, overwrite: !!stepData.overwrite });
  if (!stepData.overwrite) chrome.storage.local.set({ stepNumber: stepNum });
  updateBadge();

  // 2단계: 업로드 + AI 분석은 백그라운드에서 비동기 처리 (캡처 응답 블로킹 없음)
  (async () => {
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

    if (imageResult.status === 'rejected')    console.warn('[MIMIC] upload failed:', imageResult.reason.message);
    if (analysisResult.status === 'rejected') console.warn('[MIMIC] analyze failed:', analysisResult.reason.message);

    // 로컬 캐시 title/description/imageUrl 업데이트
    // 업로드 성공 시 IndexedDB의 임시 Blob도 삭제
    chrome.storage.local.get('steps', (r) => {
      const steps = r.steps || [];
      const idx   = steps.findIndex(s => s.stepNumber === stepNum);
      if (idx !== -1) {
        steps[idx].title       = title;
        steps[idx].description = description;
        steps[idx].imageUrl    = uploadedUrl;
        chrome.storage.local.set({ steps });
      }
    });
    if (uploadedUrl) idbDelete(stepNum).catch(() => {});

    if (uploadedUrl) {
      try {
        await saveStep({ sessionId, stepNumber: stepNum, screenshotUrl: uploadedUrl, clickX, clickY, title: title ?? '', description: description ?? '', url: stepData.url, domainInfo, viewportW: stepData.viewportW ?? stepData.windowWidth ?? null, viewportH: stepData.viewportH ?? stepData.windowHeight ?? null, elementSelector: stepData.elementSelector ?? null, elementRect: stepData.elementRect ?? null });
        console.log(`[MIMIC] saved step ${stepNum}: "${title}"`);
      } catch (err) {
        console.warn('[MIMIC] save-step failed:', err.message);
      }
    }
  })();
}

// ── 토큰 만료 처리 ───────────────────────────────────────────────
// 401 응답을 받으면 토큰을 삭제하고 팝업에 알린다.
// 녹화 중이었다면 강제 중단한다.
async function handleTokenExpired() {
  console.warn('[MIMIC] 토큰 만료 또는 무효 — 삭제 후 재연동 필요');
  await chrome.storage.local.remove('extensionToken');

  // 녹화 중이면 강제 중단
  const { isRecording } = await chrome.storage.local.get('isRecording');
  if (isRecording) {
    await chrome.storage.local.set({ isRecording: false, isPaused: false });
  }

  // 열려 있는 사이드패널에 알림
  chrome.runtime.sendMessage({ type: 'TOKEN_EXPIRED' }, () => { void chrome.runtime.lastError; });
}

// fetch 래퍼 — 401 시 handleTokenExpired 자동 호출
async function authedFetch(url, options = {}) {
  const { extensionToken } = await chrome.storage.local.get('extensionToken');
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
  const { webappOrigin } = await chrome.storage.local.get('webappOrigin');
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
      domain_hostname:  domainInfo?.hostname     ?? null,
      domain_name:      domainInfo?.name         ?? null,
      domain_favicon:   domainInfo?.favicon      ?? null,
      viewport_w:       viewportW                ?? null,
      viewport_h:       viewportH                ?? null,
      element_selector: elementSelector          ?? null,
      element_rect:     elementRect              ?? null,
    }),
  });
  if (!res.ok) throw new Error(`save-step failed: ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── 세션 완료 — 웹앱 API 경유 ───────────────────────────────────
async function finalizeSession(sessionId) {
  const { extensionToken } = await chrome.storage.local.get('extensionToken');
  if (!extensionToken) {
    console.warn('[MIMIC] extensionToken 없음 — /extension-link 에서 연동 필요');
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
    // 1회 재시도 (일시적 네트워크 오류 대응)
    await new Promise(r => setTimeout(r, 1500));
    res = await doUpload();
  }
  if (!res.ok) throw new Error(`Storage upload failed: ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
}

// ── ZIP 다운로드 ──────────────────────────────────────────────────
async function handleDownloadZip(filename) {
  const steps = await new Promise((resolve) => {
    chrome.storage.local.get('steps', (r) => resolve(r.steps || []));
  });
  if (steps.length === 0) return;

  const zipBytes = await buildZip(steps);

  const chunkSize = 0x8000;
  let base64 = '';
  for (let i = 0; i < zipBytes.length; i += chunkSize) {
    base64 += btoa(String.fromCharCode(...zipBytes.subarray(i, i + chunkSize)));
  }
  const url = `data:application/zip;base64,${base64}`;

  await new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename, saveAs: true }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(downloadId);
      }
    });
  });
}

async function buildZip(steps) {
  const files = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const name = `images/step_${String(i + 1).padStart(2, '0')}.jpg`;
    // IndexedDB에 Blob이 있으면 사용, 없으면 imageUrl에서 fetch
    let blob = await idbGet(step.stepNumber).catch(() => null);
    if (!blob && step.imageUrl) {
      try {
        const res = await fetch(step.imageUrl);
        blob = await res.blob();
      } catch { blob = null; }
    }
    if (blob) {
      const buf = await blob.arrayBuffer();
      files.push({ name, data: new Uint8Array(buf) });
    }
  }

  files.push({ name: 'report.html', data: strToBytes(buildHtmlReport(steps)) });
  return zipFiles(files);
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const bin    = atob(base64);
  const bytes  = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function strToBytes(str) {
  return new TextEncoder().encode(str);
}

function buildHtmlReport(steps) {
  const rows = steps.map((step, i) => {
    const ext     = step.screenshot?.startsWith('data:image/jpeg') ? 'jpg' : 'png';
    const imgName = `images/step_${String(i + 1).padStart(2, '0')}.${ext}`;
    const safeUrl = step.url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const title   = step.title ? step.title.replace(/</g, '&lt;') : `Step ${i + 1}`;
    const desc    = step.description ? step.description.replace(/</g, '&lt;') : '';
    const time    = formatTime(step.timestamp);
    return `<div class="step">
  <div class="step-header">
    <span class="num">${i + 1}</span>
    <div class="meta">
      <strong class="title">${title}</strong>
      <span class="desc">${desc}</span>
    </div>
    <a class="link" href="${safeUrl}" target="_blank">${new URL(step.url).hostname}</a>
    <span class="time">${time}</span>
  </div>
  <img src="${imgName}" alt="Step ${i + 1}"/>
</div>`;
  }).join('\n');

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"/>
<title>MIMIC Report</title>
<style>
body{font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;padding:24px}
h1{color:#4F46E5;margin-bottom:8px}
.generated{color:#999;font-size:13px;margin-bottom:24px}
.step{background:#fff;border-radius:12px;padding:16px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.step-header{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.num{background:#4F46E5;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0}
.meta{flex:1;min-width:0}
.title{display:block;font-size:14px;color:#222;margin-bottom:2px}
.desc{display:block;font-size:12px;color:#666}
.link{font-size:12px;color:#4F46E5;text-decoration:none;white-space:nowrap}
.link:hover{text-decoration:underline}
.time{color:#aaa;font-size:12px;white-space:nowrap;margin-left:auto}
img{width:100%;border-radius:8px;border:1px solid #e8e8f0;display:block}
</style></head><body>
<h1>MIMIC Report</h1>
<p class="generated">생성일: ${new Date().toLocaleString('ko-KR')}</p>
${rows}
</body></html>`;
}

function formatTime(ts) {
  const d  = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// ── ZIP 바이너리 빌더 ─────────────────────────────────────────────
function zipFiles(files) {
  const parts = [], centralDir = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = strToBytes(file.name);
    const data      = file.data;
    const crc       = crc32(data);
    const dt        = dosDateTime();

    const lfh  = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(lfh.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0,  true);
    view.setUint16(8, 0,  true);
    view.setUint16(10, dt.time, true);
    view.setUint16(12, dt.date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    lfh.set(nameBytes, 30);
    parts.push(lfh, data);

    const cde    = new Uint8Array(46 + nameBytes.length);
    const cdView = new DataView(cde.buffer);
    cdView.setUint32(0,  0x02014b50, true);
    cdView.setUint16(4,  20, true);
    cdView.setUint16(6,  20, true);
    cdView.setUint16(8,  0,  true);
    cdView.setUint16(10, 0,  true);
    cdView.setUint16(12, dt.time, true);
    cdView.setUint16(14, dt.date, true);
    cdView.setUint32(16, crc, true);
    cdView.setUint32(20, data.length, true);
    cdView.setUint32(24, data.length, true);
    cdView.setUint16(28, nameBytes.length, true);
    cdView.setUint32(38, 0,      true);
    cdView.setUint32(42, offset, true);
    cde.set(nameBytes, 46);
    centralDir.push(cde);

    offset += lfh.length + data.length;
  }

  const cdBytes  = concatArrays(centralDir);
  const eocd     = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0,  0x06054b50, true);
  eocdView.setUint16(4,  0, true);
  eocdView.setUint16(6,  0, true);
  eocdView.setUint16(8,  files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, cdBytes.length, true);
  eocdView.setUint32(16, offset, true);
  eocdView.setUint16(20, 0, true);

  return concatArrays([...parts, cdBytes, eocd]);
}

function concatArrays(arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out   = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

function dosDateTime() {
  const d    = new Date();
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  return { date, time };
}

function crc32(bytes) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── 유틸 ─────────────────────────────────────────────────────────
async function compressToJpeg(pngDataUrl, quality = JPEG_QUALITY_DEFAULT) {
  const res    = await fetch(pngDataUrl);
  const blob   = await res.blob();
  const bmp    = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  canvas.getContext('2d').drawImage(bmp, 0, 0);
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function getOrCreateSessionId() {
  return new Promise((resolve) => {
    chrome.storage.local.get('sessionId', (r) => {
      if (r.sessionId) { resolve(r.sessionId); return; }
      const id = crypto.randomUUID();
      chrome.storage.local.set({ sessionId: id }, () => resolve(id));
    });
  });
}

function saveStepLocally(step) {
  return new Promise((resolve) => {
    chrome.storage.local.get('steps', (r) => {
      let steps = r.steps || [];

      if (step.overwrite) {
        // focus_input → type 덮어쓰기: 같은 stepNumber 스텝을 교체
        const idx = steps.findIndex(s => s.stepNumber === step.stepNumber);
        const entry = {
          id:          idx !== -1 ? steps[idx].id : Date.now(),
          timestamp:   step.timestamp,
          url:         step.url,
          clickX:      step.clickX,
          clickY:      step.clickY,
          stepNumber:  step.stepNumber,
          imageUrl:    null,
          title:       null,
          description: null,
          actionInfo:  step.actionInfo  ?? null,
          actionLabel: step.actionLabel ?? null,
          domainInfo:  step.domainInfo  ?? null,
        };
        if (idx !== -1) steps[idx] = entry;
        else steps.push(entry);
      } else {
        steps.push({
          id:          Date.now(),
          timestamp:   step.timestamp,
          url:         step.url,
          clickX:      step.clickX,
          clickY:      step.clickY,
          stepNumber:  step.stepNumber,
          imageUrl:    step.imageUrl   ?? null,
          title:       step.title      ?? null,
          description: step.description ?? null,
          actionInfo:  step.actionInfo  ?? null,
          actionLabel: step.actionLabel ?? null,
          domainInfo:  step.domainInfo  ?? null,
        });
      }

      if (steps.length > MAX_STEPS) steps = steps.slice(-MAX_STEPS);
      chrome.storage.local.set({ steps }, resolve);
    });
  });
}
