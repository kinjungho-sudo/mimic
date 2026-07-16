// ── 환경 자동 판별 ────────────────────────────────────────────────
// 웹스토어 배포본(고정 ID)=운영 / 개발자 언패킹(다른 ID)=dev.
// chrome.runtime.id로 자동 구분 → 배포본이 실수로 dev를 가리킬 위험 없음.
importScripts('desktop-import.js', 'desktop-bridge.js');

const PROD_EXTENSION_ID = 'ehbhcdkapcbfehinjapabgoegcjmmbgd';
const IS_DEV = chrome.runtime.id !== PROD_EXTENSION_ID;

// ── 상수 (환경별) ─────────────────────────────────────────────────
const SUPABASE_URL      = IS_DEV
  ? 'https://dskphgxurxebblnpwhax.supabase.co'   // dev 전용 DB(도쿄)
  : 'https://gqynptpjomcqzxyykqic.supabase.co';  // 운영(싱가포르)
const SUPABASE_ANON_KEY = IS_DEV
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRza3BoZ3h1cnhlYmJsbnB3aGF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTUxNjcsImV4cCI6MjA5MjkzMTE2N30.xD80PAqMbzXX1Hdde1O0x2VpX8dXkNWum3jKhOml9ZM'
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeW5wdHBqb21jcXp4eXlrcWljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTcyNzMsImV4cCI6MjA4NzEzMzI3M30.7OgewnWhbE2GK1k0tTuuegrKUVkHuJrW_cpvbVRcH1E';
const SUPABASE_BUCKET   = 'naviaction';
const WEBAPP_ORIGIN     = IS_DEV
  ? 'https://parro-guide-dev.vercel.app'         // dev: Parro Preview alias
  : 'https://mimic-nine-ashen.vercel.app';        // 운영
if (IS_DEV) console.warn('[Parro Recorder] DEV 모드 — dev DB/Preview 연결 (id:', chrome.runtime.id, ')');
const JPEG_QUALITY_DEFAULT = 0.92;
const MAX_STEPS         = 30;

// タイムアウト 상수
const CAPTURE_HIDE_TIMEOUT_MS = 3000;
const CAPTURE_RAF_DELAY_MS    = 50;
const UPLOAD_RETRY_DELAY_MS   = 1500;
const SW_KEEPALIVE_MS         = 20000;
const AUTONAV_COOLDOWN_MS     = 3000;
const DEDUP_HASH_THRESHOLD    = 6;     // aHash(256bit) 해밍거리 ≤ 6 이면 동일 이미지로 간주
const NAV_URL_DEDUP_MS        = 5000;  // 같은 페이지(origin+pathname) '이동' 재캡처 금지 윈도우
const TYPED_LABEL_MAX         = 80;    // 이보다 짧은 입력은 라벨에 전문, 길면 프리뷰+총 글자수

// ── 로그 시스템 ──────────────────────────────────────────────────
const LOG_KEY      = '_mimicLogs';
const LOG_MAX      = 300;
const LOG_LEVELS   = { debug: 0, info: 1, warn: 2, error: 3 };
const _tabWindowIdCache = new Map();

function log(level, source, ...args) {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  const entry = { t: Date.now(), level, source, msg };

  // 콘솔 출력
  const tag = `[Parro][${level.toUpperCase()}][${source}]`;
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

// ── 실행 취소 스택 (Ctrl+Z 시맨틱) ──────────────────────────────
// 'add'    : 스텝 캡처됨   → undo = 해당 스텝 제거
// 'delete' : 스텝 삭제됨   → undo = 해당 스텝 복원
const UNDO_MAX = 30;

async function pushUndo(action) {
  const { _undoStack } = await storageGet('_undoStack');
  const stack = _undoStack || [];
  stack.push(action);
  if (stack.length > UNDO_MAX) stack.splice(0, stack.length - UNDO_MAX);
  await storageSet({ _undoStack: stack });
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

function openRecorderPanel(tabId, windowId) {
  if (tabId) {
    try {
      chrome.sidePanel.open({ tabId }).catch((err) => {
        log('warn', 'bg', 'sidePanel.open(tabId) failed:', err?.message || err);
      });
    } catch (err) {
      log('warn', 'bg', 'sidePanel.open(tabId) threw:', err?.message || err);
    }
  }
  if (windowId) {
    try {
      chrome.sidePanel.open({ windowId }).catch((err) => {
        log('warn', 'bg', 'sidePanel.open(windowId) failed:', err?.message || err);
      });
    } catch (err) {
      log('warn', 'bg', 'sidePanel.open(windowId) threw:', err?.message || err);
    }
  }
}

// ── 메모리 캐시 ──────────────────────────────────────────────────
let _cachedTargetTabId = null;  // storage remove 타이밍 경쟁 방지
let _directStartTabId  = null;  // onChanged 중복 START_RECORDING 차단
let _lastCaptureTime   = 0;     // autoNav 쿨다운 경쟁 방지
let _lastSavedHash     = null;  // 직전 저장 이미지 aHash (중복 캡처 디덥용)
let _lastNavKey        = null;  // 직전 '이동' 캡처 페이지 키 (origin+pathname)
let _lastNavKeyTime    = 0;
const _navBusyTabs     = new Set();          // onUpdated complete 동시(중복) 이벤트 차단
let _captureChain      = Promise.resolve();  // 캡처 디덥~로컬 저장 직렬화 큐
let _preCaptureFrame   = null;               // { dataUrl, time, tabId } — pointerdown 선캡처 프레임
const PRECAPTURE_MAX_AGE_MS = 1500;          // 이보다 오래된 선캡처는 폐기 (클릭과 무관)
const PRECAPTURE_WAIT_MS    = 500;           // 선캡처가 in-flight(쿼터 재시도)면 이만큼 기다려 받는다
let _typingFrame       = null;               // { dataUrl, time, tabId } — 타이핑 중 롤링 프레임 (전송 직전 화면)
const TYPING_FRAME_MAX_AGE_MS = 3000;        // 이보다 오래된 타이핑 프레임은 사용 안 함

// SW 시작 시 캐시 초기화
storageGet(['targetTabId', 'lastCaptureTime', 'lastStepHash', 'lastNavKey', 'lastNavKeyTime']).then((r) => {
  _cachedTargetTabId = r.targetTabId ?? null;
  _lastCaptureTime   = r.lastCaptureTime ?? 0;
  _lastSavedHash     = r.lastStepHash ?? null;
  _lastNavKey        = r.lastNavKey ?? null;
  _lastNavKeyTime    = r.lastNavKeyTime ?? 0;
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
      justification: 'Screen capture via getDisplayMedia and voice narration via microphone',
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
    // 음성 녹음이 같은 offscreen 문서에서 진행 중이면 문서를 닫지 않는다
    // (닫으면 녹음 blob이 유실됨 — 음성 정지는 finalize/discard가 직접 처리)
    if (!_audioActive) await chrome.offscreen.closeDocument().catch(() => {});
  }
  log('info', 'bg', 'display stream stopped');
}

// ── 음성 녹음 오케스트레이션 ─────────────────────────────────────
// offscreen MediaRecorder를 제어한다. 캡처 시각 오프셋 기준점(audioStartTime)을
// storage에 저장해, SW 재시작 후에도 각 캡처의 상대 시각을 계산할 수 있게 한다.
let _audioActive = false;

async function startVoiceRecording() {
  if (_audioActive) return;  // 중복 시작 방지 (직접/onChanged 경로 동시 발화)
  const { settings } = await storageGet('settings');
  if (!settings?.voiceRecord) return;
  // PRO 전용 — 플랜 확인 (아니면 조용히 미녹음)
  const plan = await getUserPlan();
  if (!plan?.isPro) { log('info', 'bg', 'voice skipped — not PRO'); return; }
  try {
    await ensureOffscreen();
    const startedAt = Date.now();
    const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'START_AUDIO' });
    if (res?.ok) {
      _audioActive = true;
      await storageSet({ audioStartTime: startedAt, audioRecording: true });
      log('info', 'bg', 'voice recording started');
    } else {
      log('warn', 'bg', 'voice recording failed:', res?.error);
    }
  } catch (err) {
    log('warn', 'bg', 'voice recording start error:', err.message);
  }
}

async function pauseVoiceRecording() {
  if (!_audioActive) return;
  await chrome.runtime.sendMessage({ target: 'offscreen', type: 'PAUSE_AUDIO' }).catch(() => {});
}

async function resumeVoiceRecording() {
  if (!_audioActive) return;
  await chrome.runtime.sendMessage({ target: 'offscreen', type: 'RESUME_AUDIO' }).catch(() => {});
}

// 녹음 정지 + Storage 업로드 → 공개 URL 반환 (없으면 null). 항상 _audioActive 해제.
async function stopAndUploadVoice(sessionId) {
  if (!_audioActive) return null;
  _audioActive = false;
  let dataUrl = null;
  try {
    const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'STOP_AUDIO' });
    dataUrl = res?.dataUrl ?? null;
  } catch (err) {
    log('warn', 'bg', 'stop audio error:', err.message);
  }
  // offscreen 문서 정리 (display stream이 없을 때만 — captureVisibleTab 경로 기본)
  if (!_streamActive) await chrome.offscreen.closeDocument().catch(() => {});
  await storageRemove(['audioRecording']);

  if (!dataUrl || !sessionId) return null;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${sessionId}/voice.webm`;
    const url  = await uploadImage(path, blob, 'audio/webm');
    log('info', 'bg', `voice uploaded: ${path} (${Math.round(blob.size / 1024)}KB)`);
    return url;
  } catch (err) {
    log('warn', 'bg', 'voice upload failed:', err.message);
    return null;
  }
}

async function discardVoiceRecording() {
  if (!_audioActive) return;
  _audioActive = false;
  _voiceStep = null;
  await chrome.runtime.sendMessage({ target: 'offscreen', type: 'STOP_AUDIO' }).catch(() => {});
  if (!_streamActive) await chrome.offscreen.closeDocument().catch(() => {});
  await storageRemove(['audioRecording', 'audioStartTime']);
}

// ── 캡처별 음성 메모 (PRO) ───────────────────────────────────────
// 사용자가 사이드패널 스텝 카드의 🎙 버튼으로 해당 스텝에만 음성을 녹음한다.
// 연속 녹음과 달리 명시적 start/stop, 스텝별 파일로 업로드 후 그 스텝에 URL 연결.
let _voiceStep = null;  // 현재 녹음 중인 스텝 번호

async function startStepVoice(stepNumber) {
  if (_audioActive) return { ok: false, error: '이미 녹음 중입니다' };
  try {
    await ensureOffscreen();
    const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'START_AUDIO' });
    if (!res?.ok) return { ok: false, error: res?.error || '마이크 시작 실패' };
    _audioActive = true;
    _voiceStep   = stepNumber;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function stopStepVoice() {
  if (!_audioActive) return { ok: false, error: 'not recording' };
  const stepNum = _voiceStep;
  _audioActive = false;
  _voiceStep   = null;

  let dataUrl = null;
  try {
    const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'STOP_AUDIO' });
    dataUrl = res?.dataUrl ?? null;
  } catch (err) {
    log('warn', 'bg', 'stop step voice error:', err.message);
  }
  if (!_streamActive) await chrome.offscreen.closeDocument().catch(() => {});

  if (!dataUrl || stepNum == null) return { ok: false, error: '녹음 데이터 없음' };
  try {
    const { sessionId, steps } = await storageGet(['sessionId', 'steps']);
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${sessionId}/voice_step_${String(stepNum).padStart(2, '0')}.webm`;
    const url  = await uploadImage(path, blob, 'audio/webm');
    const arr  = steps || [];
    const idx  = arr.findIndex(s => s.stepNumber === stepNum);
    if (idx >= 0) { arr[idx].voiceAudioUrl = url; await storageSet({ steps: arr }); }
    log('info', 'bg', `step voice uploaded: step ${stepNum} (${Math.round(blob.size / 1024)}KB)`);
    return { ok: true, url, stepNumber: stepNum };
  } catch (err) {
    log('warn', 'bg', 'step voice upload failed:', err.message);
    return { ok: false, error: err.message };
  }
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
// content.js 상단의 window.__parroContentLoaded / legacy __mimicContentLoaded 가드가 중복 초기화를 막는다.
function ensureContentScript(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['guide-engine.js', 'targeting.js', 'content.js'] }, () => {
      const error = chrome.runtime.lastError?.message || null;
      if (error) {
        log('warn', 'bg', 'content script injection failed:', { tabId, error });
        resolve({ ok: false, error });
        return;
      }
      resolve({ ok: true });
    });
  });
}

function classifyRecordableUrl(url) {
  if (!url) return { ok: true };
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return { ok: true };
    return { ok: false, reason: 'unsupported_url', message: `${parsed.protocol} 페이지는 녹화할 수 없습니다.` };
  } catch {
    return { ok: false, reason: 'unsupported_url', message: '지원하지 않는 탭 주소입니다.' };
  }
}

// page_url이 http(s):// 인지 확인 — file:// · javascript: 등을 chrome.tabs.update에 넘기지 않음
function isSafeNavUrl(url) {
  try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch { return false; }
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
  _lastSavedHash  = null;
  _lastNavKey     = null;
  _lastNavKeyTime = 0;
  chrome.storage.local.remove(['lastStepHash', 'lastNavKey', 'lastNavKeyTime']);
}

// ── '이동' 캡처 URL 중복 가드 ────────────────────────────────────
// 한 번의 이동에 onUpdated complete가 여러 번 오거나(리다이렉트/iframe 로드),
// 사이트가 쿼리만 replaceState로 다시 쓰는 경우(쿠팡 checkout의 clientWidth 등)
// 같은 화면이 2~4회 찍힌다. 같은 origin+pathname은 윈도우 내 1회만 캡처한다.
function navUrlKey(url) {
  try { const u = new URL(url); return u.origin + u.pathname; } catch { return url || ''; }
}

function isRecentNavDup(url) {
  const key = navUrlKey(url);
  return !!key && key === _lastNavKey && (Date.now() - _lastNavKeyTime) < NAV_URL_DEDUP_MS;
}

function markNavCaptured(url) {
  _lastNavKey     = navUrlKey(url);
  _lastNavKeyTime = Date.now();
  chrome.storage.local.set({ lastNavKey: _lastNavKey, lastNavKeyTime: _lastNavKeyTime });
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

const _desktopImports = new Map();

async function importDesktopCaptureSession(nativeSessionId) {
  if (_desktopImports.has(nativeSessionId)) return _desktopImports.get(nativeSessionId);
  const work = (async () => {
    const { extensionToken, desktopImportedSessions } = await storageGet(['extensionToken', 'desktopImportedSessions']);
    if (!extensionToken) throw new Error('not_linked');
    const prior = desktopImportedSessions?.[nativeSessionId];
    if (prior?.tutorial_id) return { ...prior, reused: true };

    const capture = await getDesktopCaptureSession(nativeSessionId);
    const events = Array.isArray(capture.events)
      ? capture.events.filter(event => event?.step_number && event?.screenshot_size > 0).slice(0, 200)
      : [];
    if (!events.length) throw new Error('desktop_capture_empty');

    const sessionId = crypto.randomUUID();
    resetLastSavedHash();
    await storageSet({
      sessionId,
      stepNumber: 0,
      steps: [],
      _undoStack: [],
      contentMode: 'action',
      desktopImportProgress: { nativeSessionId, status: 'processing', completed: 0, total: events.length },
    });

    const completedSteps = [];
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const pngBlob = await readDesktopCaptureImage(nativeSessionId, event.step_number, event.screenshot_size);
      const pngDataUrl = await blobToDataUrl(pngBlob);
      const stepData = ParroDesktopImport.buildStepData(event, index);
      const prepared = await prepareCapture(pngDataUrl, stepData, null);
      if (!prepared) continue;
      await processStepUpload(prepared);
      completedSteps.push(stepData.stepNumber);
      await storageSet({
        desktopImportProgress: {
          nativeSessionId,
          status: 'processing',
          completed: index + 1,
          total: events.length,
        },
      });
    }

    if (!completedSteps.length) throw new Error('desktop_import_no_steps');
    const finalized = await finalizeSession(sessionId, completedSteps);
    if (!finalized?.tutorial_id) throw new Error('desktop_finalize_failed');
    const result = {
      tutorial_id: finalized.tutorial_id,
      step_count: finalized.step_count || completedSteps.length,
      webapp_origin: finalized.webapp_origin || await getWebappOrigin(),
    };
    const imported = { ...(desktopImportedSessions || {}) };
    imported[nativeSessionId] = result;
    const recentEntries = Object.entries(imported).slice(-20);
    await storageSet({
      desktopImportedSessions: Object.fromEntries(recentEntries),
      desktopImportProgress: { nativeSessionId, status: 'complete', completed: events.length, total: events.length, ...result },
    });
    return result;
  })();
  _desktopImports.set(nativeSessionId, work);
  try {
    return await work;
  } finally {
    _desktopImports.delete(nativeSessionId);
  }
}

// ── 외부(웹페이지) 메시지 라우터 ────────────────────────────────
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.action === 'DESKTOP_COMPANION_STATUS') {
    (async () => {
      const pong = await pingDesktopCompanion().catch((error) => ({ ok: false, error: error?.message }));
      sendResponse({ ok: !!pong?.ok, desktop: desktopBridgeStatus(), error: pong?.error });
    })();
    return true;
  }

  if (message.action === 'START_DESKTOP_RECORDING') {
    (async () => {
      const sessionId = crypto.randomUUID();
      const result = await notifyDesktopCaptureStarted({
        sessionId,
        targetTabId: null,
        source: 'desktop_setup',
      });
      const desktop = desktopBridgeStatus();
      sendResponse({
        ok: !!result?.ok && !!desktop.connected,
        sessionId,
        desktop,
        error: result?.error || (desktop.connected ? undefined : desktop.lastError || 'desktop_host_unavailable'),
      });
    })();
    return true;
  }

  if (message.action === 'STOP_DESKTOP_RECORDING') {
    (async () => {
      const sessionId = message.sessionId || null;
      try {
        const stopped = await notifyDesktopCaptureStopped({
          sessionId,
          reason: 'desktop_setup_stop',
        });
        if (!stopped?.ok) throw new Error(stopped?.error || 'desktop_stop_failed');
        const imported = await importDesktopCaptureSession(sessionId);
        sendResponse({
          ok: true,
          sessionId,
          desktop: desktopBridgeStatus(),
          tutorialId: imported.tutorial_id,
          stepCount: imported.step_count,
          editorUrl: `${imported.webapp_origin}/manual/${imported.tutorial_id}/editor`,
        });
      } catch (error) {
        sendResponse({
          ok: false,
          sessionId,
          desktop: desktopBridgeStatus(),
          error: error?.message || 'desktop_import_failed',
        });
      }
    })();
    return true;
  }

  if (message.action === 'PAUSE_DESKTOP_RECORDING' || message.action === 'RESUME_DESKTOP_RECORDING') {
    (async () => {
      try {
        const paused = message.action === 'PAUSE_DESKTOP_RECORDING';
        const result = await setDesktopCapturePaused({ sessionId: message.sessionId || null, paused });
        sendResponse({ ok: !!result?.ok, sessionId: message.sessionId || null, paused, error: result?.error });
      } catch (error) {
        sendResponse({ ok: false, sessionId: message.sessionId || null, error: error?.message || 'desktop_pause_failed' });
      }
    })();
    return true;
  }

  if (message.action === 'UNDO_DESKTOP_CAPTURE') {
    (async () => {
      try {
        const result = await undoDesktopCaptureStep(message.sessionId || null);
        sendResponse({
          ok: !!result?.ok,
          sessionId: message.sessionId || null,
          capturedSteps: Number(result?.captured_steps) || 0,
          error: result?.error,
        });
      } catch (error) {
        sendResponse({ ok: false, sessionId: message.sessionId || null, error: error?.message || 'desktop_undo_failed' });
      }
    })();
    return true;
  }

  if (message.action === 'IMPORT_DESKTOP_CAPTURE') {
    (async () => {
      const sessionId = message.sessionId || null;
      try {
        const imported = await importDesktopCaptureSession(sessionId);
        sendResponse({
          ok: true,
          sessionId,
          desktop: desktopBridgeStatus(),
          tutorialId: imported.tutorial_id,
          stepCount: imported.step_count,
          editorUrl: `${imported.webapp_origin}/manual/${imported.tutorial_id}/editor`,
        });
      } catch (error) {
        sendResponse({
          ok: false,
          sessionId,
          desktop: desktopBridgeStatus(),
          error: error?.message || 'desktop_import_failed',
        });
      }
    })();
    return true;
  }

  if (message.action === 'GET_TABS') {
    const toRecordableTab = (t) => {
      if (!t || typeof t.id !== 'number') return null;

      const url = typeof t.url === 'string' ? t.url : '';
      if (
        url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') ||
        url.startsWith('about:')
      ) {
        return null;
      }

      if (t.windowId) _tabWindowIdCache.set(t.id, t.windowId);
      return {
        id: t.id,
        title: t.title || (url ? url : '브라우저 탭'),
        url,
        favIconUrl: typeof t.favIconUrl === 'string' ? t.favIconUrl : '',
        urlAccess: Boolean(url),
      };
    };

    chrome.tabs.query({}).then((tabs) => {
      const result = tabs.map(toRecordableTab).filter(Boolean);
      sendResponse({
        ok: true,
        tabs: result,
        diagnostics: {
          total: tabs.length,
          returned: result.length,
          missingUrl: result.filter(t => !t.urlAccess).length,
        },
      });
    }).catch((error) => {
      log('warn', 'bg', 'GET_TABS failed:', error?.message || error);
      sendResponse({
        ok: false,
        tabs: [],
        error: error?.message || 'tabs_query_failed',
      });
    });
    return true;
  }

  if (message.action === 'PICK_LIVE_TARGET') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          sendResponse({ ok: false, reason: 'tab_not_found', error: '활성 탭을 찾지 못했습니다.' });
          return;
        }

        const urlCheck = classifyRecordableUrl(tab.url || '');
        if (!urlCheck.ok) {
          sendResponse(urlCheck);
          return;
        }

        const injection = await ensureContentScript(tab.id);
        if (!injection?.ok) {
          sendResponse({ ok: false, reason: 'content_script_failed', error: injection?.error || 'Recorder를 대상 탭에 연결하지 못했습니다.' });
          return;
        }

        chrome.tabs.sendMessage(tab.id, { type: 'LIVE_TARGET_PICK' }, (response) => {
          const error = chrome.runtime.lastError?.message;
          if (error) {
            sendResponse({ ok: false, reason: 'content_script_unreachable', error });
            return;
          }
          sendResponse(response || { ok: false, reason: 'empty_response', error: '대상 선택 응답이 없습니다.' });
        });
      } catch (error) {
        sendResponse({ ok: false, reason: 'error', error: error?.message || String(error) });
      }
    })();
    return true;
  }

  if (message.action === 'START_RECORDING') {
    const tabId = message.tabId;
    if (!tabId) {
      sendResponse({ ok: false, reason: 'missing_tab', message: '녹화할 탭을 찾지 못했습니다.' });
      return false;
    }

    // ★ 사이드패널은 user gesture가 살아있는 지금(= 어떤 await보다도 먼저, 동기) 호출해야 열린다.
    //   await가 한 번이라도 끼면 MV3 제스처가 끊겨 sidePanel.open()이 조용히 실패한다.
    //   → 연동 검사(storageGet)보다 앞서 호출한다. 미연동이면 패널이 잠깐 열려도
    //     패널 자체가 연동 게이트를 보여주므로 무해하다.
    openRecorderPanel(tabId, _tabWindowIdCache.get(tabId));

    (async () => {
      // ★ 연동 검사 — 미연동 상태에서는 한 스텝도 캡처하지 않고 즉시 반환.
      //   sessionId 생성·targetTabId 저장·steps 초기화 등 사이드이펙트 절대 금지.
      const { extensionToken } = await storageGet('extensionToken');
      if (!extensionToken) {
        sendResponse({ ok: false, reason: 'not_linked' });
        return;
      }

      const sessionId = crypto.randomUUID();
      resetLastSavedHash();

      // 1) targetTabId 먼저 저장 → _cachedTargetTabId 캐시 갱신 보장
      // contentMode: 웹앱에서 선택한 매뉴얼 유형 ('action' | 'education'), 미전달 시 'action'
      const contentMode = message.contentMode === 'education' ? 'education' : 'action';
      await storageSet({ targetTabId: tabId, sessionId, stepNumber: 0, steps: [], _undoStack: [], contentMode });

      const tab = await new Promise((res) => chrome.tabs.get(tabId, (t) => {
        res(chrome.runtime.lastError ? null : t);
      }));
      if (!tab) {
        sendResponse({ ok: false, reason: 'tab_not_found', message: '선택한 탭을 찾지 못했습니다.' });
        return;
      }
      const initialUrlCheck = classifyRecordableUrl(tab.url || message.url || '');
      if (!initialUrlCheck.ok) {
        sendResponse(initialUrlCheck);
        return;
      }
      if (tab.windowId) _tabWindowIdCache.set(tabId, tab.windowId);

      // 2) 보조 시도 (제스처 없으면 무시됨) — windowId 기준 한 번 더
      openRecorderPanel(tabId, tab.windowId);

      // 3) 탭 활성화
      await new Promise((res) => chrome.tabs.update(tabId, { active: true }, res));
      if (tab.windowId) {
        await new Promise((res) => chrome.windows.update(tab.windowId, { focused: true }, res));
      }

      // 4) 탭 로드 완료 대기
      const freshTab = await new Promise((res) => chrome.tabs.get(tabId, (t) => {
        res(chrome.runtime.lastError ? null : t);
      }));
      if (!freshTab) {
        sendResponse({ ok: false, reason: 'tab_not_found', message: '선택한 탭을 다시 확인하지 못했습니다.' });
        return;
      }
      const freshUrlCheck = classifyRecordableUrl(freshTab.url || message.url || '');
      if (!freshUrlCheck.ok) {
        sendResponse(freshUrlCheck);
        return;
      }

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
      const injection = await ensureContentScript(tabId);
      if (!injection?.ok) {
        sendResponse({
          ok: false,
          reason: 'content_script_failed',
          message: injection?.error || '선택한 페이지에 녹화 스크립트를 주입하지 못했습니다.',
        });
        return;
      }
      const sent = await new Promise((res) => {
        const doSend = (retry) => {
          chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' }, () => {
            if (chrome.runtime.lastError && !retry) { setTimeout(() => doSend(true), 300); return; }
            const error = chrome.runtime.lastError?.message || null;
            res(error ? { ok: false, error } : { ok: true });
          });
        };
        doSend(false);
      });
      if (!sent?.ok) {
        sendResponse({
          ok: false,
          reason: 'content_script_unreachable',
          message: sent?.error || '선택한 페이지가 녹화 시작 메시지에 응답하지 않았습니다.',
        });
        return;
      }

      // 6) isRecording 세팅 — _directStartTabId로 onChanged 중복 차단
      //    (캡처는 captureVisibleTab 사용 — Gemini/Docs 포함 일반 https 페이지 모두 동작 확인됨.
      //     desktopCapture 스트림은 DRM 등 진짜 차단 페이지 대비용으로 코드만 유지)
      _directStartTabId = tabId;
      await storageSet({ isRecording: true });
      notifyDesktopCaptureStarted({ sessionId, targetTabId: tabId, source: 'external_start' }).catch((err) => {
        log('warn', 'desktop', 'desktop start notify failed:', err?.message || err);
      });
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
    (async () => {
      const { extensionToken } = await storageGet('extensionToken');
      sendResponse({ ok: true, linked: !!extensionToken });
    })();
    return true;
  }

  if (message.action === 'START_GUIDE') {
    const rawToken = message.tutorial_id || message.share_token;
    if (!rawToken) { sendResponse({ ok: false, error: 'no token' }); return false; }

    // 경로 삽입 방지: UUID 또는 URL-안전 alphanumeric(1~80자)만 허용
    const UUID_RE    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const SHARE_RE   = /^[A-Za-z0-9_-]{1,80}$/;
    if (!UUID_RE.test(rawToken) && !SHARE_RE.test(rawToken)) {
      sendResponse({ ok: false, error: 'invalid token format' });
      return false;
    }
    const guideToken = rawToken;
    const isUuid = UUID_RE.test(guideToken);

    // ★ await 이전에 동기 캡처 — async IIFE 안에서는 sender가 변질될 수 있음
    const senderTabId    = sender.tab?.id    ?? null;
    const senderWindowId = sender.tab?.windowId ?? null;

    // ★ user gesture 살아있는 지금(= await 이전) 동기 호출 — await 후에는 제스처 소멸
    const openPanel = (windowId) => chrome.sidePanel.open({ windowId }).catch(() => {});
    if (senderWindowId) {
      openPanel(senderWindowId);
    } else {
      chrome.windows.getCurrent((win) => { if (win?.id) openPanel(win.id); });
    }

    (async () => {
      try {
        const origin = await getWebappOrigin();
        // UUID(소유자 미리보기)는 쿠키 필요; share_token(공개)은 불필요
        const fetchOpts = isUuid ? { credentials: 'include' } : {};
        const res    = await fetch(`${origin}/api/guide/${encodeURIComponent(guideToken)}`, fetchOpts);
        if (!res.ok) throw new Error(`guide fetch failed: ${res.status}`);
        const data  = await res.json();
        // 라이브 가이드 유료 게이팅 — 소유자 무료 한도(5회) 소진 시
        if (data.gated) {
          log('info', 'bg', `live guide gated (free limit ${data.limit})`);
          sendResponse({ ok: false, gated: true, limit: data.limit, upgradeUrl: data.upgradeUrl });
          return;
        }
        const steps = data.steps || [];
        if (steps.length === 0) throw new Error('no steps');
        const guideSurvey = data.survey?.enabled ? {
          enabled: true,
          tutorialId: data.tutorial_id,
          viewerSessionId: `live_guide:${data.tutorial_id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        } : null;

        // sender 탭에 직접 카운트다운 전송 — active tab query는 다중창/탭전환 시 엉뚱한 탭을 잡음
        if (senderTabId) {
          await ensureContentScript(senderTabId);
          sendTabMessage(senderTabId, { type: 'SHOW_GUIDE_COUNTDOWN' });
        }

        await storageSet({ guideSteps: steps, guideCurrentStep: 0, guideModeActive: true, guideSurvey });

        sendResponse({ ok: true });

        // 카운트다운 완료 후 오버레이 주입 (+200ms 여유)
        setTimeout(async () => {
          try {
            // sender 탭을 직접 사용 — active tab query 대신 (타이밍 경쟁 방지)
            if (!senderTabId) return;
            const tab = await new Promise((resolve) => chrome.tabs.get(senderTabId, (t) => {
              resolve(chrome.runtime.lastError ? null : t);
            }));
            if (!tab?.id) return;

            // 가이드를 이 탭에 고정 — 이후 단계 전환이 활성 탭이 아니라 이 탭에서만 동작한다.
            await storageSet({ guideTabId: tab.id });

            const firstStep = steps[0];
            await ensureContentScript(tab.id);
            const injectOverlay = (tabId) => sendTabMessage(tabId, { type: 'SHOW_OVERLAY', step: firstStep, index: 0, total: steps.length, survey: guideSurvey });

            if (!firstStep.page_url || !isSafeNavUrl(firstStep.page_url)) {
              // page_url 없음 또는 비안전 프로토콜 → 현재 탭에 바로 오버레이 주입
              injectOverlay(tab.id);
            } else {
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
          } catch (err) {
            log('error', 'bg', 'guide overlay inject error:', err.message);
          }
        }, 3600);
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
  if (message.type === 'DESKTOP_COMPANION_STATUS') {
    pingDesktopCompanion().catch(() => {});
    sendResponse({ ok: true, desktop: desktopBridgeStatus() });
    return false;
  }

  // pointerdown 선캡처 — 클릭으로 화면이 바뀌기 전 프레임을 미리 잡아 버퍼에 보관
  if (message.type === 'PRECAPTURE_FRAME') {
    const tabId = sender.tab?.id;
    if (tabId) {
      (async () => {
        const tab = await new Promise((res) => chrome.tabs.get(tabId, (t) => res(chrome.runtime.lastError ? null : t)));
        if (!tab) return;
        // captureVisibleTab 쿼터(초당 2회) 초과로 실패하면 짧게 재시도 — 선캡처가 비면 클릭 후
        // 라이브 폴백이 전환 중간 화면을 잡으므로(이슈 #3·#6), 선캡처를 최대한 확보한다.
        for (let i = 0; i < 3; i++) {
          const url = await captureTab(tab.windowId).catch(() => null);
          if (url) { _preCaptureFrame = { dataUrl: url, time: Date.now(), tabId }; return; }
          await new Promise((r) => setTimeout(r, 240));
        }
      })();
    }
    return false;  // 응답 불필요
  }

  // 타이핑 롤링 프레임 — 입력 중 '전송 직전' 화면을 주기적으로 버퍼에 보관 (소비하지 않음)
  if (message.type === 'TYPING_FRAME') {
    const tabId = sender.tab?.id;
    if (tabId) {
      (async () => {
        const tab = await new Promise((res) => chrome.tabs.get(tabId, (t) => res(chrome.runtime.lastError ? null : t)));
        if (!tab) return;
        const url = await captureTab(tab.windowId).catch(() => null);
        if (url) _typingFrame = { dataUrl: url, time: Date.now(), tabId };
      })();
    }
    return false;  // 응답 불필요
  }

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

      // 선캡처가 아직 도착 안 했으면(쿼터로 재시도 중) 잠깐 기다린다 — 곧바로 라이브 폴백하면
      // 클릭 후 전환 중간/이미 사라진 화면을 잡으므로(이슈 #3·#6), in-flight 선캡처를 받아낸다.
      if (stepData.usePrecapture) {
        const deadline = Date.now() + PRECAPTURE_WAIT_MS;
        const ready = () => _preCaptureFrame && _preCaptureFrame.tabId === tabId
          && (Date.now() - _preCaptureFrame.time) < PRECAPTURE_MAX_AGE_MS;
        while (!ready() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 30));
      }

      // 선캡처(pointerdown) 프레임이 있으면 그걸 사용 — 클릭 전 화면이라 좌표/하이라이트가 일치한다.
      // 없거나 오래됐으면 지금 캡처 (기존 동작 폴백).
      let capturedRaw = null;
      if (stepData.usePrecapture && _preCaptureFrame
          && _preCaptureFrame.tabId === tabId
          && (Date.now() - _preCaptureFrame.time) < PRECAPTURE_MAX_AGE_MS) {
        capturedRaw = _preCaptureFrame.dataUrl;
      }
      // 기본은 1회용(소비 후 폐기). peek은 폐기하지 않고 둬, 같은 액션의 후속 클릭 스텝이
      // 동일 프레임을 재사용하게 한다(타이핑 확정 → 그 클릭 캡처가 같은 '액션 직전' 화면 공유).
      if (!stepData.peekPrecapture) _preCaptureFrame = null;
      // 타이핑 확정: 전송 직전 롤링 프레임 사용 (비동기 캡처가 전송 후 빈 입력창을 잡는 문제 방지).
      // 소비하지 않는다 — 같은 입력 세션의 여러 flush(soft/final)가 최신 프레임을 공유.
      if (!capturedRaw && stepData.useTypingFrame && _typingFrame
          && _typingFrame.tabId === tabId
          && (Date.now() - _typingFrame.time) < TYPING_FRAME_MAX_AGE_MS) {
        capturedRaw = _typingFrame.dataUrl;
      }
      if (!capturedRaw) capturedRaw = await captureTab(tab.windowId);
      if (!capturedRaw) { restore(); sendResponse({ ok: false }); return; }

      const black = await isBlackScreen(capturedRaw).catch(() => false);
      if (black) {
        restore();
        chrome.runtime.sendMessage({ type: 'CAPTURE_BLOCKED', stepNumber: stepData.stepNumber, stepData }, () => { void chrome.runtime.lastError; });
        sendResponse({ ok: false, blocked: true });
        return;
      }

      // 기기 에뮬레이션 레터박스 제거 — PII 블러 좌표 매핑 전에 수행해야 한다
      const rawDataUrl = await normalizeCaptureGeometry(capturedRaw, stepData.windowWidth, stepData.windowHeight);

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

      const capturedRaw = await captureTab(tab.windowId);
      if (capturedRaw) sendTabMessage(tabId, { type: 'MANUAL_CAPTURE_FLASH' });
      sendTabMessage(tabId, { type: 'RESTORE_OVERLAY' });
      if (!capturedRaw) { sendResponse({ ok: false }); return; }

      // viewport는 content가 보고한 값 우선 — 기기 에뮬레이션에서는 tab.width(실제 창)와 다르다
      const vpW = response?.viewportW || tab.width || 1280;
      const vpH = response?.viewportH || tab.height || 800;

      // 기기 에뮬레이션 레터박스 제거 — PII 블러 좌표 매핑 전에 수행해야 한다
      const rawDataUrl = await normalizeCaptureGeometry(capturedRaw, vpW, vpH);

      const piiRegions = response?.piiRegions ?? [];
      const dataUrl = piiRegions.length > 0
        ? await applyPixelBlur(rawDataUrl, piiRegions, vpW, vpH).catch(() => rawDataUrl)
        : rawDataUrl;

      const { stepNumber } = await storageGet('stepNumber');
      const stepNum = (stepNumber || 0) + 1;
      const stepData = {
        url: tab.url, timestamp: Date.now(),
        clickX: 0, clickY: 0,
        windowWidth: vpW, windowHeight: vpH,
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

  // 페이지 이동/로드 후 content가 자기 탭의 녹화 상태를 복원할 때 사용.
  // 크로스 사이트 녹화: 단일 targetTabId 고정을 버리고, 녹화 중이면 로드되는 모든 http(s)
  // 탭이 자가 무장한다(사용자가 새 탭·다른 도메인으로 가도 클릭/타이핑이 캡처됨).
  // 실제 이벤트는 포커스된 탭에서만 발생하고, stepNumber는 storage.onChanged로 모든 탭이
  // 동기화하므로 다중 탭 동시 무장은 충돌을 일으키지 않는다.
  if (message.type === 'GET_TAB_RECORDING_STATE') {
    const tabId = sender.tab?.id;
    (async () => {
      const r = await storageGet(['isRecording', 'isPaused', 'stepNumber']);
      const isTarget = !!r.isRecording && tabId != null;
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
    (async () => {
      try {
        // 연속 내레이션 정지 + 업로드 → finalize에 audio_url 전달 (서버에서 Whisper 전사·구간 배분)
        const audioUrl = await stopAndUploadVoice(message.sessionId);
        const data = await finalizeSession(message.sessionId, message.stepNumbers, audioUrl);
        // 매뉴얼 상세 탭은 background가 직접 연다 — 사용자가 패널/탭을 닫아도
        // service worker는 살아 있으므로 매뉴얼 생성 완료 후 정상 이동된다.
        if (data?.tutorial_id) {
          const origin = data.webapp_origin || await getWebappOrigin();
          chrome.tabs.create({ url: `${origin}/manual/${data.tutorial_id}/editor?from=recording` });
          await storageSet({ isRecording: false, isPaused: false, stepNumber: 0, steps: [], sessionId: null, _undoStack: [] });
        }
        sendResponse({ ok: true, ...data });
      } catch (err) {
        log('error', 'bg', 'finalize error:', err.message);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  // 실행 취소 — 마지막 행동(캡처 추가/스텝 삭제)을 역으로 되돌린다 (Ctrl+Z 시맨틱)
  if (message.type === 'UNDO_STEP') {
    (async () => {
      const { _undoStack, steps } = await storageGet(['_undoStack', 'steps']);
      const stack = _undoStack || [];
      const action = stack.pop();
      if (!action) { sendResponse({ ok: false, reason: 'nothing-to-undo' }); return; }

      let arr = steps || [];
      if (action.type === 'add') {
        // 캡처 추가의 취소 → 그 스텝 제거
        const removed = arr.find((s) => s.id === action.stepId);
        arr = arr.filter((s) => s.id !== action.stepId);
        if (removed?.stepNumber) idbDelete(removed.stepNumber).catch(() => {});
      } else if (action.type === 'delete') {
        // 스텝 삭제의 취소 → 복원
        arr.push(action.step);
        arr.sort((a, b) => a.stepNumber - b.stepNumber);
      }

      const maxNum = arr.reduce((m, s) => Math.max(m, s.stepNumber || 0), 0);
      await storageSet({ steps: arr, stepNumber: maxNum, _undoStack: stack });
      updateBadge();
      sendResponse({ ok: true, undone: action.type });
    })();
    return true;
  }

  if (message.type === 'DISCARD_SESSION') {
    // 중지(저장 없이) 시 서버 staging 정리 — events 행 + Storage 이미지 삭제.
    // 실패해도 무시한다 (주기 cron 청소가 보완).
    discardVoiceRecording().catch(() => {});  // 음성 녹음 폐기
    const discardId = message.sessionId;
    if (discardId) {
      (async () => {
        try {
          const origin = await getWebappOrigin();
          await authedFetch(`${origin}/api/capture/discard`, {
            method: 'POST',
            body: JSON.stringify({ session_id: discardId }),
          });
          log('info', 'bg', `session discarded: ${discardId}`);
        } catch (err) {
          log('warn', 'bg', 'discard cleanup failed (cron이 보완):', err.message);
        }
      })();
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'FULL_PAGE_CAPTURE') {
    (async () => {
      const { isRecording } = await storageGet('isRecording');
      if (isRecording) { sendResponse({ ok: false, error: '녹화 중에는 사용할 수 없습니다' }); return; }

      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tab  = tabs.find(t => t.url?.startsWith('http://') || t.url?.startsWith('https://'));
      if (!tab?.id) { sendResponse({ ok: false, error: '캡처 가능한 탭이 없습니다 (http/https 페이지에서 사용)' }); return; }

      const dataUrl = await captureFullPage(tab);

      let hostname = 'page';
      try { hostname = new URL(tab.url).hostname.replace(/^www\./, ''); } catch { /**/ }
      const d  = new Date();
      const p2 = (n) => String(n).padStart(2, '0');
      const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
      await chrome.downloads.download({ url: dataUrl, filename: `parro_fullpage_${hostname}_${stamp}.png` });
      sendResponse({ ok: true });
    })().catch((err) => {
      log('error', 'bg', 'full page capture error:', err.message);
      sendResponse({ ok: false, error: '캡처 실패 — 페이지를 확인해주세요' });
    });
    return true;
  }

  if (message.type === 'CLEAR_STEPS') {
    idbClear().catch(() => {});
    resetLastSavedHash();
    storageSet({ steps: [], stepNumber: 0, _undoStack: [] }).then(() => { updateBadge(); sendResponse({ ok: true }); });
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

      const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY_DEFAULT });
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

  // 사이드패널 오픈 시 가이드 유효성 검증 — 고정 탭이 이미 닫혔으면(브라우저 재시작 등으로
  // onRemoved가 못 돈 경우) 유령 상태를 정리하고 active:false 반환 → 죽은 스텝이 안 뜬다.
  if (message.type === 'GUIDE_VALIDATE') {
    (async () => {
      const { guideModeActive, guideSteps, guideCurrentStep, guideTabId } =
        await storageGet(['guideModeActive', 'guideSteps', 'guideCurrentStep', 'guideTabId']);
      if (!guideModeActive || !(guideSteps?.length)) { sendResponse({ active: false }); return; }
      // guideTabId가 아직 미지정이면 가이드 시작 직후(고정 전) — 정리하지 말고 그대로 둔다.
      if (guideTabId != null) {
        const tab = await getGuideTab();
        if (!tab?.id) {
          await storageRemove(['guideSteps', 'guideCurrentStep', 'guideModeActive', 'guidePendingOverlay', 'guideTabId', 'guideSurvey']);
          sendResponse({ active: false });
          return;
        }
      }
      sendResponse({ active: true, steps: guideSteps, currentStep: guideCurrentStep || 0 });
    })();
    return true;
  }

  if (message.type === 'GUIDE_NEXT' || message.type === 'GUIDE_PREV') {
    (async () => {
      const { guideSteps, guideCurrentStep, guideSurvey } = await storageGet(['guideSteps', 'guideCurrentStep', 'guideSurvey']);
      const steps = guideSteps || [];
      let idx = guideCurrentStep || 0;
      if (message.type === 'GUIDE_NEXT') idx = Math.min(idx + 1, steps.length - 1);
      else idx = Math.max(idx - 1, 0);

      await storageSet({ guideCurrentStep: idx });
      const step = steps[idx];
      sendResponse({ ok: true, currentStep: idx, step });

      // 가이드 시작 탭으로 고정 — 활성 탭(예: 다른 사이트)을 건드리지 않는다.
      const tab = await getGuideTab();
      if (!tab?.id) return;

      if (step && step.page_url) {
        try {
          const currentUrl = new URL(tab.url);
          const targetUrl  = new URL(step.page_url);
          if (currentUrl.origin + currentUrl.pathname !== targetUrl.origin + targetUrl.pathname) {
            await storageSet({ guidePendingOverlay: true });
            // 자동진행(타깃 클릭)이면 클릭 자체가 이동을 유발하므로 중복 내비 방지.
            // 수동 '다음'이면 직접 이동시킨다. (둘 다 onUpdated에서 오버레이 재주입)
            if (!message.viaClick && isSafeNavUrl(step.page_url)) chrome.tabs.update(tab.id, { url: step.page_url });
            return;
          }
        } catch { /* same-tab fallback */ }
      }
      sendTabMessage(tab.id, { type: 'SHOW_OVERLAY', step, index: idx, total: steps.length, survey: guideSurvey || null });
    })();
    return true;
  }

  // 사이드패널에서 특정 스텝 도트를 클릭 → 해당 인덱스로 점프
  if (message.type === 'SHOW_OVERLAY_FOR_STEP') {
    (async () => {
      const { guideSteps, guideSurvey } = await storageGet(['guideSteps', 'guideSurvey']);
      const steps = guideSteps || [];
      const idx = Math.max(0, Math.min(message.stepIndex || 0, steps.length - 1));
      await storageSet({ guideCurrentStep: idx });
      const step = steps[idx];
      sendResponse({ ok: true, currentStep: idx, step });
      if (!step) return;

      const tab = await getGuideTab();  // 가이드 고정 탭
      if (!tab?.id) return;

      if (step.page_url) {
        try {
          const currentUrl = new URL(tab.url);
          const targetUrl  = new URL(step.page_url);
          if (currentUrl.origin + currentUrl.pathname !== targetUrl.origin + targetUrl.pathname) {
            await storageSet({ guidePendingOverlay: true });
            if (isSafeNavUrl(step.page_url)) chrome.tabs.update(tab.id, { url: step.page_url });  // 수동 점프 → 직접 이동
            return;
          }
        } catch { /* same-tab fallback */ }
      }
      sendTabMessage(tab.id, { type: 'SHOW_OVERLAY', step, index: idx, total: steps.length, survey: guideSurvey || null });
    })();
    return true;
  }

  if (message.type === 'SUBMIT_GUIDE_SURVEY') {
    (async () => {
      try {
        const payload = message.payload || {};
        const tutorialId = payload.tutorial_id;
        const viewerSessionId = payload.viewer_session_id;
        if (!tutorialId || !viewerSessionId) {
          sendResponse({ ok: false, error: 'missing survey identifiers' });
          return;
        }
        const origin = await getWebappOrigin();
        const res = await fetch(`${origin}/api/survey`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        sendResponse({ ok: res.ok });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message.type === 'EXIT_GUIDE') {
    (async () => {
      const tab = await getGuideTab();  // 고정 탭의 오버레이를 정리
      await storageRemove(['guideSteps', 'guideCurrentStep', 'guideModeActive', 'guidePendingOverlay', 'guideTabId', 'guideSurvey']);
      if (tab?.id) sendTabMessage(tab.id, { type: 'HIDE_OVERLAY' });
      // 혹시 다른 탭(메시지 발신 탭)에 남은 오버레이도 정리
      if (sender.tab?.id && sender.tab.id !== tab?.id) sendTabMessage(sender.tab.id, { type: 'HIDE_OVERLAY' });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === 'AI_REGROUND') {
    (async () => {
      try {
        // 공개/미연동 시청자(share_token, extensionToken 없음)는 AI 재탐색(비용) 생략 —
        // 기존 best-effort 오버레이/대기 유지. doomed authedFetch·스크린샷 캡처 자체를 사전 차단.
        // (연동된 소유자는 토큰이 있으므로 아래 정상 reground 경로로 진행)
        const { extensionToken } = await storageGet('extensionToken');
        if (!extensionToken) { sendResponse({ found: false }); return; }

        const winId = sender.tab?.windowId;
        const dataUrl = await new Promise((resolve) => {
          chrome.tabs.captureVisibleTab(winId, { format: 'png' }, (u) => {
            resolve(chrome.runtime.lastError ? null : u);
          });
        });
        if (!dataUrl) { sendResponse({ found: false }); return; }
        const image = String(dataUrl).replace(/^data:image\/\w+;base64,/, '');

        const origin = await getWebappOrigin();
        const res = await authedFetch(`${origin}/api/guide/reground`, {
          method: 'POST',
          body: JSON.stringify({
            image, mediaType: 'image/png',
            title:       message.title       ?? null,
            instruction: message.instruction ?? null,
            elementText: message.elementText ?? null,
            actionType:  message.actionType  ?? null,
          }),
        });
        if (!res.ok) { sendResponse({ found: false }); return; }
        sendResponse(await res.json());
      } catch (err) {
        log('warn', 'bg', 'AI_REGROUND failed:', err.message);
        sendResponse({ found: false });
      }
    })();
    return true;
  }

  if (message.type === 'DELETE_STEP') {
    (async () => {
      const { steps } = await storageGet(['steps']);
      const arr    = steps || [];
      const target = arr.find((s) => s.id === message.id);
      // idb Blob은 undo 복원 가능성 때문에 즉시 삭제하지 않는다 (녹화 종료 시 일괄 정리)
      const filtered = arr.filter((s) => s.id !== message.id);
      const maxNum = filtered.reduce((m, s) => Math.max(m, s.stepNumber || 0), 0);
      if (target) await pushUndo({ type: 'delete', step: target });
      await storageSet({ steps: filtered, stepNumber: maxNum });
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

  // ── 플랜 조회 (PRO 게이팅) ───────────────────────────────────────
  if (message.type === 'GET_PLAN') {
    getUserPlan(!!message.refresh).then((p) => sendResponse(p));
    return true;
  }

  // ── 캡처별 음성 메모 (PRO) ───────────────────────────────────────
  if (message.type === 'START_STEP_VOICE') {
    startStepVoice(message.stepNumber).then((r) => sendResponse(r));
    return true;
  }
  if (message.type === 'STOP_STEP_VOICE') {
    stopStepVoice().then((r) => sendResponse(r));
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
  // 가이드 고정 탭이 닫히면 라이브 가이드 상태를 정리 — 안 그러면 다음 사이드패널 오픈 시
  // guideModeActive가 남아 죽은 스텝(유령)이 뜬다. storage 변경이 popup의 onChanged를 깨워 뷰를 닫는다.
  const { guideModeActive, guideTabId } = await storageGet(['guideModeActive', 'guideTabId']);
  if (guideModeActive && guideTabId === tabId) {
    await storageRemove(['guideSteps', 'guideCurrentStep', 'guideModeActive', 'guidePendingOverlay', 'guideTabId', 'guideSurvey']);
  }

  const { isRecording, targetTabId, _prevTargetTabId } = await storageGet(['isRecording', 'targetTabId', '_prevTargetTabId']);
  if (!isRecording) return;
  if (targetTabId !== tabId) return;
  if (!_prevTargetTabId) return;
  await storageSet({ targetTabId: _prevTargetTabId, _prevTargetTabId: null });
});

// ── 크로스 사이트 녹화: 사용자가 활성화/전환한 탭을 세션에 편입 ──────────
// 단일 targetTabId 고정 대신, 녹화 중 사용자가 실제로 보는 탭을 따라간다.
//  - 새 탭·네비게이션: content.js 로드 시 GET_TAB_RECORDING_STATE로 자가 무장(위 핸들러).
//  - 녹화 전부터 열려 있던(재로드 안 된) 탭: 활성화 시 여기서 RESYNC_RECORDING으로 무장.
// 또 활성 탭을 targetTabId로 동기화해 수동 캡처·가이드·사이드패널이 올바른 탭을 가리키게 한다.
async function followActiveTab(tabId) {
  if (tabId == null) return;
  const { isRecording, isPaused, stepNumber } = await storageGet(['isRecording', 'isPaused', 'stepNumber']);
  if (!isRecording) return;
  const tab = await new Promise((res) => chrome.tabs.get(tabId, (t) => res(chrome.runtime.lastError ? null : t)));
  if (!tab || !tab.url?.startsWith('http')) return;  // chrome://·확장 페이지 등은 녹화 대상 아님
  await storageSet({ targetTabId: tabId });
  await ensureContentScript(tabId);  // 멱등 — 이미 주입돼 있으면 early-return
  sendTabMessage(tabId, { type: 'RESYNC_RECORDING', isPaused: !!isPaused, stepNumber: stepNumber || 0 });
}

chrome.tabs.onActivated.addListener(({ tabId }) => { followActiveTab(tabId); });

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;  // 모든 창이 포커스 잃음(다른 앱)
  chrome.tabs.query({ active: true, windowId }, (tabs) => {
    void chrome.runtime.lastError;
    if (tabs && tabs[0]) followActiveTab(tabs[0].id);
  });
});

// ── URL 변경 탐지 (cross-origin 이동 캡처) ───────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url?.startsWith('http')) return;

  // 한 번의 이동에 complete가 여러 번 와도(리다이렉트/iframe 로드) 첫 이벤트만 처리
  if (_navBusyTabs.has(tabId)) {
    log('debug', 'bg', `onUpdated skip — tab ${tabId} nav handling in flight url=${tab.url}`);
    return;
  }
  _navBusyTabs.add(tabId);

  try {
    const r = await storageGet(['isRecording', 'isPaused', 'targetTabId', 'stepNumber', 'settings', 'pendingCapture', 'guideModeActive', 'guidePendingOverlay', 'guideSteps', 'guideCurrentStep', 'guideTabId', 'guideSurvey', 'spaNavCapturing', 'lastCaptureTime']);

    // 가이드 재주입은 '고정 탭'에서 로드가 끝났을 때만 — 다른 탭 로드에는 반응하지 않는다.
    // (a) 가이드가 의도한 이동(guidePendingOverlay): 페이지 정착 후 주입.
    // (b) 그 외 임의 이동(외부 링크·OAuth 리다이렉트 등)도 가이드 활성 탭이면 현재 스텝 복원 —
    //     일회성 플래그에 의존하지 않는다. 도착지가 스텝 page_url이 아니면 guide-engine의
    //     pageMatches()가 막아 조용히 대기(오버레이 없음), 스텝 페이지로 복귀하면 자동 표시.
    if (r.guideModeActive && r.guideTabId === tabId && r.guideSteps?.length) {
      const intended = !!r.guidePendingOverlay;
      if (intended) await storageRemove('guidePendingOverlay');
      const gSteps = r.guideSteps;
      const gIdx = r.guideCurrentStep || 0;
      const step = gSteps[gIdx];
      if (step) {
        // 새 도메인엔 manifest content_scripts 주입이 늦거나 누락될 수 있어 보장(멱등).
        await ensureContentScript(tabId);
        // 페이지 정착(특히 SPA) 후 오버레이 주입 — 요소 매칭 확률 ↑
        setTimeout(() => sendTabMessage(tabId, { type: 'SHOW_OVERLAY', step, index: gIdx, total: gSteps.length, survey: r.guideSurvey || null }), intended ? 500 : 400);
      }
    }

    // 페이지 이동 자동 캡처(도착 페이지 / 풀로드 / SPA)는 제거됨.
    // 사용자 클릭·타이핑만 스텝으로 담는다. onUpdated는 가이드 오버레이 재주입만 담당.
    // (녹화 상태는 content.js의 GET_TAB_RECORDING_STATE로 이동 후에도 복원되어 후속 클릭이 캡처됨)
  } finally {
    _navBusyTabs.delete(tabId);
  }
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
  const firstPaint = await waitForTabPaint(tabId, tab.windowId, 3000);
  if (!firstPaint) return null;

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'HIDE_OVERLAY_FOR_CAPTURE' }, async (response) => {
      void chrome.runtime.lastError;
      await new Promise((r) => setTimeout(r, 0));

      const capturedRaw = await captureTab(tab.windowId);
      sendTabMessage(tabId, { type: 'RESTORE_OVERLAY' });

      // viewport는 content가 보고한 값 우선 — 기기 에뮬레이션에서는 tab.width(실제 창)와 다르다
      const vpW = response?.viewportW || tab.width || 1280;
      const vpH = response?.viewportH || tab.height || 800;

      // 기기 에뮬레이션 레터박스 제거 — PII 블러 좌표 매핑 전에 수행해야 한다
      const capturedUrl = await normalizeCaptureGeometry(capturedRaw || firstPaint, vpW, vpH);
      if (!capturedUrl) { resolve(null); return; }

      const piiRegions = response?.piiRegions ?? [];
      if (piiRegions.length === 0) { resolve(capturedUrl); return; }

      const blurred = await applyPixelBlur(capturedUrl, piiRegions, vpW, vpH).catch(() => capturedUrl);
      resolve(blurred);
    });
  });
}

// ── 전체 페이지 스크롤 캡처 (녹화와 별개 단독 기능) ──────────────
const FULLPAGE_MAX_HEIGHT_PX = 20000; // CSS px — OffscreenCanvas 높이 한계(65535) 내 dpr 여유 확보
const FULLPAGE_SETTLE_MS     = 550;   // 스크롤 후 렌더 대기 + captureVisibleTab 쿼터(초당 2회) 준수

async function captureFullPage(tab) {
  const tabId = tab.id;

  const [{ result: m } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      scrollHeight: Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0
      ),
      viewportH: window.innerHeight,
      viewportW: window.innerWidth,
      originalY: window.scrollY,
    }),
  });
  if (!m || !m.viewportH) throw new Error('페이지 정보를 읽을 수 없습니다');

  const totalH   = Math.max(m.viewportH, Math.min(m.scrollHeight, FULLPAGE_MAX_HEIGHT_PX));
  const segments = Math.ceil(totalH / m.viewportH);

  const restore = () => chrome.scripting.executeScript({
    target: { tabId },
    args: [m.originalY],
    func: (origY) => {
      const hiddenFixed = window.__parroFixedHidden || window.__mimicFixedHidden;
      if (hiddenFixed) {
        for (const { el, vis } of hiddenFixed) el.style.visibility = vis;
        delete window.__parroFixedHidden;
        delete window.__mimicFixedHidden;
      }
      window.scrollTo(0, origY);
    },
  }).catch(() => {});

  const parts = [];
  try {
    for (let i = 0; i < segments; i++) {
      const y = Math.max(0, Math.min(i * m.viewportH, totalH - m.viewportH));
      await chrome.scripting.executeScript({
        target: { tabId },
        args: [y, i > 0],
        func: (scrollY, hideFixed) => {
          // 두 번째 조각부터 fixed/sticky 요소 숨김 — 고정 헤더가 조각마다 반복되는 것 방지
          // (visibility는 레이아웃을 유지하므로 스크롤 좌표가 어긋나지 않는다)
          if (hideFixed && !window.__parroFixedHidden && !window.__mimicFixedHidden) {
            window.__parroFixedHidden = [];
            for (const el of document.querySelectorAll('body *')) {
              const pos = getComputedStyle(el).position;
              if (pos === 'fixed' || pos === 'sticky') {
                window.__parroFixedHidden.push({ el, vis: el.style.visibility });
                el.style.visibility = 'hidden';
              }
            }
          }
          window.scrollTo(0, scrollY);
        },
      });
      await new Promise((r) => setTimeout(r, FULLPAGE_SETTLE_MS));

      const url = await new Promise((resolve) => {
        chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (u) => {
          resolve(chrome.runtime.lastError ? null : u);
        });
      });
      if (!url) throw new Error(`조각 ${i + 1}/${segments} 캡처 실패`);
      parts.push({ y, url });
    }
  } finally {
    await restore();
  }

  // 스티칭 — 실제 비트맵 폭 / 뷰포트 CSS 폭 비율로 dpr·브라우저 줌 보정
  const bitmaps = [];
  for (const p of parts) {
    const blob = await (await fetch(p.url)).blob();
    bitmaps.push(await createImageBitmap(blob));
  }
  const scale  = bitmaps[0].width / m.viewportW;
  const canvas = new OffscreenCanvas(bitmaps[0].width, Math.round(totalH * scale));
  const ctx    = canvas.getContext('2d');
  parts.forEach((p, i) => ctx.drawImage(bitmaps[i], 0, Math.round(p.y * scale)));

  const outBlob = await canvas.convertToBlob({ type: 'image/png' });
  log('info', 'bg', `full page captured: ${segments} segments, ${canvas.width}x${canvas.height}px`);
  return blobToDataUrl(outBlob);
}

// ── 캡처 기하 보정 — DevTools 기기 에뮬레이션 레터박스 제거 ──────
// 모바일(기기 모드) 녹화 시 captureVisibleTab은 에뮬레이션 화면 '주변 여백'(어두운
// DevTools 배경)까지 통째로 찍는다. 그 결과:
//   1) 세로 페이지가 검은 띠 낀 가로 이미지로 저장됨 (슬라이드 비율 깨짐)
//   2) PII 블러가 viewport→이미지 비율로 좌표를 환산하므로 엉뚱한 위치에 찍힘
// 이미지 비율이 viewport 비율과 다르면 가장자리 균일색 띠를 감지해 잘라낸다.
async function normalizeCaptureGeometry(dataUrl, viewportW, viewportH) {
  if (!dataUrl || !viewportW || !viewportH) return dataUrl;
  try {
    const res  = await fetch(dataUrl);
    const blob = await res.blob();
    const bmp  = await createImageBitmap(blob);
    const iw = bmp.width, ih = bmp.height;

    const imgAspect = iw / ih;
    const vpAspect  = viewportW / viewportH;
    if (Math.abs(imgAspect - vpAspect) / vpAspect < 0.08) return dataUrl;  // 정상 캡처

    const canvas = new OffscreenCanvas(iw, ih);
    const ctx    = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, iw, ih).data;

    const px   = (x, y) => { const i = (y * iw + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 30;

    const SAMPLES = 24;
    const colUniform = (x, ref) => {
      for (let s = 0; s < SAMPLES; s++) {
        if (!near(px(x, Math.floor(ih * (s + 0.5) / SAMPLES)), ref)) return false;
      }
      return true;
    };
    const rowUniform = (y, ref, x0, x1) => {
      for (let s = 0; s < SAMPLES; s++) {
        if (!near(px(Math.floor(x0 + (x1 - x0) * (s + 0.5) / SAMPLES), y), ref)) return false;
      }
      return true;
    };

    const corner = px(0, 0);
    let left = 0, right = iw - 1, top = 0, bottom = ih - 1;
    while (left  < iw * 0.45 && colUniform(left, corner))  left++;
    while (right > iw * 0.55 && colUniform(right, corner)) right--;
    while (top    < ih * 0.45 && rowUniform(top, corner, left, right))    top++;
    while (bottom > ih * 0.55 && rowUniform(bottom, corner, left, right)) bottom--;

    const cw = right - left + 1, ch = bottom - top + 1;
    if (cw < 100 || ch < 100) return dataUrl;                     // 과도 트림 방어
    if ((iw * ih - cw * ch) / (iw * ih) < 0.04) return dataUrl;   // 의미 있는 여백 없음
    // A real device viewport keeps the requested aspect ratio after the emulator
    // bars are removed. If it does not, the uniform area was probably legitimate
    // page whitespace; trimming it would shift every saved annotation.
    const croppedAspect = cw / ch;
    if (Math.abs(croppedAspect - vpAspect) / vpAspect >= 0.08) return dataUrl;

    const out = new OffscreenCanvas(cw, ch);
    out.getContext('2d').drawImage(bmp, left, top, cw, ch, 0, 0, cw, ch);
    const outBlob = await out.convertToBlob({ type: 'image/png' });
    log('info', 'bg', `letterbox trim: ${iw}x${ih} → ${cw}x${ch} (vp ${viewportW}x${viewportH})`);
    return blobToDataUrl(outBlob);
  } catch {
    return dataUrl;
  }
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

    // 진짜 차단 화면은 "균일한 완전 검정". 다크 테마(Gemini 등)는 텍스트/패널 등
    // 밝은 픽셀이 섞여 있으므로 평균이 아닌 '최대 밝기'로 판정해야 오탐이 없다.
    const SAMPLES = 8;
    let maxBrightness = 0;
    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        const px = Math.floor(w * (sx + 1) / (SAMPLES + 1));
        const py = Math.floor(h * (sy + 1) / (SAMPLES + 1));
        const d  = ctx.getImageData(px, py, 1, 1).data;
        const b  = (d[0] + d[1] + d[2]) / 3;
        if (b > maxBrightness) maxBrightness = b;
        if (maxBrightness >= 8) return false;  // 밝은 픽셀 발견 → 정상 화면
      }
    }
    return maxBrightness < 8;
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

  // 음성: 연속 내레이션(Magic Mic식)이 주력. 녹화 시작 시 자동 녹음(PRO+설정),
  //   일시정지 연동. 정지(false) 시 정지/업로드는 finalize/discard가 담당(blob 보존).
  if ('isRecording' in changes) {
    const was = !!changes.isRecording.oldValue;
    const now = !!changes.isRecording.newValue;
    if (was !== now && now) startVoiceRecording().catch(() => {});
  }
  if ('isPaused' in changes && _audioActive) {
    (changes.isPaused.newValue ? pauseVoiceRecording() : resumeVoiceRecording()).catch(() => {});
  }

  if ('isRecording' in changes) {
    const wasRecording = !!changes.isRecording.oldValue;
    const nowRecording = !!changes.isRecording.newValue;
    if (wasRecording === nowRecording) return;
    if (nowRecording && _directStartTabId) return;  // onMessageExternal이 직접 처리 중

    if (nowRecording) {
      resetLastSavedHash();  // 새 녹화 → 디덥 기준 해시 초기화
      storageGet(['sessionId', 'targetTabId']).then(({ sessionId, targetTabId }) => {
        notifyDesktopCaptureStarted({ sessionId, targetTabId, source: 'storage_start' }).catch((err) => {
          log('warn', 'desktop', 'desktop start notify failed:', err?.message || err);
        });
      });
    } else {
      storageGet('sessionId').then(({ sessionId }) => {
        notifyDesktopCaptureStopped({ sessionId, reason: 'storage_stop' }).catch((err) => {
          log('warn', 'desktop', 'desktop stop notify failed:', err?.message || err);
        });
      });
      chrome.storage.local.remove(['pendingCapture', 'spaNavCapturing']);
      stopDisplayStream().catch(() => {});
    }

    const msgType = nowRecording ? 'START_RECORDING' : 'STOP_RECORDING';

    const sendMsgToTab = (tabId) => {
      if (!tabId) return;
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) return;

        if (nowRecording) {
          openRecorderPanel(tabId, tab.windowId);
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
// ── 캡처 단계 확대 영역(crop_box) 계산 ──────────────────────────
// 클릭 요소(elementRect, 0~1) 기준으로 확대해서 보여줄 영역을 정한다(Tango식 프레이밍).
// 반환: 원본 이미지 기준 0~1 {x,y,width,height}, 또는 null(요소 없음 → 확대 안 함).
// 주의: 이미지를 자르는 게 아니라 "확대 영역"을 정의하는 메타데이터다.
function computeCropBox(elementRect, clickX, clickY, actionInfo) {
  if (!elementRect) return null;
  const actionType = actionInfo?.type;
  const isTyping = actionType === 'type' || actionType === 'focus_input';
  const isLarge = elementRect.width > 0.34 || elementRect.height > 0.16 || elementRect.width * elementRect.height > 0.055;
  if (isLarge && clickX > 0 && clickY > 0) {
    const width = isTyping
      ? Math.max(0.46, Math.min(0.62, elementRect.width * 0.7))
      : Math.max(0.38, Math.min(0.54, elementRect.width * 0.56));
    const height = isTyping
      ? Math.max(0.28, Math.min(0.44, elementRect.height * 0.7))
      : Math.max(0.26, Math.min(0.40, elementRect.height * 0.56));
    const x = Math.max(0, Math.min(1 - width, clickX - width / 2));
    const y = Math.max(0, Math.min(1 - height, clickY - height / 2));
    return {
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      width: Math.round(Math.min(1 - x, width) * 1000) / 1000,
      height: Math.round(Math.min(1 - y, height) * 1000) / 1000,
    };
  }
  const size = Math.max(elementRect.width, elementRect.height);
  // 요소가 작을수록 더 넓은 패딩(컨텍스트 확보), 클수록 좁게
  const PAD = size < 0.05 ? 0.15 : size > 0.3 ? 0.05 : 0.10;
  const MIN_W = 0.35;   // 너무 작게 확대돼 글씨가 깨지지 않도록 최소 영역 보장
  const MIN_H = 0.25;
  // 확대 중심: 클릭 지점 우선, 없으면 요소 중심
  let cx = elementRect.x + elementRect.width / 2;
  let cy = elementRect.y + elementRect.height / 2;
  if (clickX > 0 && clickY > 0) { cx = clickX; cy = clickY; }
  const w = Math.max(elementRect.width + PAD * 2, MIN_W);
  const h = Math.max(elementRect.height + PAD * 2, MIN_H);
  const x = Math.max(0, Math.min(1 - w, cx - w / 2));
  const y = Math.max(0, Math.min(1 - h, cy - h / 2));
  return {
    x: Math.round(x * 1000) / 1000,
    y: Math.round(y * 1000) / 1000,
    width: Math.round(Math.min(1 - x, w) * 1000) / 1000,
    height: Math.round(Math.min(1 - y, h) * 1000) / 1000,
  };
}

function denormalizeRectForAnalyze(elementRect, viewportW, viewportH) {
  if (!elementRect || !viewportW || !viewportH) return elementRect ?? null;
  return {
    x: elementRect.x * viewportW,
    y: elementRect.y * viewportH,
    width: elementRect.width * viewportW,
    height: elementRect.height * viewportH,
  };
}

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
    case 'type': {
      if (actionInfo.masked) return '비밀번호 입력';
      // 입력 내용 우선 — 짧으면 '입력, "내용"', 길면 앞부분 프리뷰 + 총 글자수.
      const typed = (actionInfo.typedText || '').trim().replace(/\s+/g, ' ');
      if (typed) {
        return typed.length <= TYPED_LABEL_MAX
          ? `입력, "${typed}"`
          : `입력, "${typed.slice(0, 40)}…" (총 ${typed.length}자)`;
      }
      return name ? `입력, ${name}` : '텍스트 입력';
    }
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

  const fallbackFavicon = hostname ? `https://${hostname}/favicon.ico` : null;
  const favicon = normalizeFaviconUrl(tab?.favIconUrl) ?? fallbackFavicon;

  return { hostname, name, favicon };
}

function normalizeFaviconUrl(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > 500) return null;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? value : null;
  } catch {
    return null;
  }
}

// ── 캡처 처리 ────────────────────────────────────────────────────
// 디덥 판정~로컬 저장(prepareCapture)은 _captureChain으로 직렬화한다.
// 동시 nav 캡처 2건이 같은 lastStepHash/lastNavKey와 비교해 둘 다 통과하는 경쟁 방지.
// 업로드(processStepUpload)는 종전대로 병렬 수행.
async function handleCapture(pngDataUrl, stepData, tab) {
  const queued = _captureChain.then(() => prepareCapture(pngDataUrl, stepData, tab));
  _captureChain = queued.then(() => {}, () => {});
  const prepared = await queued;
  if (!prepared) return;  // 중복으로 스킵됨
  await processStepUpload(prepared);
}

async function prepareCapture(pngDataUrl, stepData, tab) {
  // ── '이동' 캡처 중복 디덥 (#4) ────────────────────────────────
  //   클릭/타이핑은 같은 화면에서 미세 변화만 있어도 서로 다른 스텝이므로 디덥하면 안 됨.
  //   1) URL 가드: 같은 페이지(origin+pathname)를 NAV_URL_DEDUP_MS 내 재캡처 금지
  //   2) 이미지 가드: 직전 저장 캡처와 시각적으로 동일하면 스킵
  //   해시는 모든 저장 캡처에 대해 갱신해 다음 이동 캡처가 직전 화면과 비교되게 한다.
  const isNavCapture = stepData.actionInfo?.type === 'navigate';
  if (isNavCapture && !stepData.manual && !stepData.overwrite) {
    if (isRecentNavDup(stepData.url)) {
      log('info', 'bg', `nav dedup(url) skip step ${stepData.stepNumber} url=${stepData.url}`);
      return null;
    }
    markNavCaptured(stepData.url);
  }

  const candHash = await computeAHash(pngDataUrl);
  if (candHash && isNavCapture && !stepData.manual && !stepData.overwrite) {
    const prev = await getLastSavedHash();
    if (prev && hammingDist(candHash, prev) <= DEDUP_HASH_THRESHOLD) {
      log('info', 'bg', `nav dedup(image) skip step ${stepData.stepNumber}`);
      return null;
    }
  }

  _lastCaptureTime = Date.now();
  chrome.storage.local.set({ lastCaptureTime: _lastCaptureTime });

  const jpegBlob   = await compressToJpeg(pngDataUrl, JPEG_QUALITY_DEFAULT);
  const jpegDataUrl = await blobToDataUrl(jpegBlob);
  const base64Image = jpegDataUrl.split(',')[1];

  const sessionId = await getOrCreateSessionId();
  const stepNum   = stepData.stepNumber;
  const imagePath = `${sessionId}/step_${String(stepNum).padStart(2, '0')}.jpg`;
  log('debug', 'bg', `capture step ${stepNum} action=${stepData.actionInfo?.type ?? 'click'} url=${stepData.url}`);

  const winW   = stepData.windowWidth  || 1280;
  const winH   = stepData.windowHeight || 800;
  const coordinateSpace = stepData.actionInfo?.targetContext?.coordinateSpace;
  const clickX = normalizeCoord(stepData.clickX, winW, coordinateSpace);
  const clickY = normalizeCoord(stepData.clickY, winH, coordinateSpace);

  const domainInfo  = extractDomainInfo(stepData.url, tab);
  const actionLabel = makeActionLabel(stepData.actionInfo, stepNum, domainInfo);

  // 행동 없음(이동/빈영역/요소 없음)에는 확대 영역을 만들지 않는다.
  const cropBox = stepData.elementRect
    ? computeCropBox(stepData.elementRect, clickX, clickY, stepData.actionInfo)
    : null;

  await idbPut(stepNum, jpegBlob);
  if (!stepData.overwrite) await storageSet({ stepNumber: stepNum });
  if (candHash) setLastSavedHash(candHash);  // 다음 캡처 디덥 기준 갱신

  return { sessionId, stepNum, imagePath, jpegBlob, base64Image, stepData, clickX, clickY, domainInfo, actionLabel, cropBox };
}

// ── 스텝 업로드 처리 (SW keepalive 포함) ─────────────────────────
async function processStepUpload({ sessionId, stepNum, imagePath, jpegBlob, base64Image, stepData, clickX, clickY, domainInfo, actionLabel, cropBox }) {
  const keepaliveInterval = setInterval(() => {
    chrome.storage.local.set({ _swKeepalive: Date.now() });
  }, SW_KEEPALIVE_MS);

  try {
    const [imageResult, analysisResult] = await Promise.allSettled([
      uploadImage(imagePath, jpegBlob),
      analyzeWithClaude(base64Image, stepData.url, stepData.actionInfo, {
        clickX:          clickX || null,
        clickY:          clickY || null,
        elementRect:     denormalizeRectForAnalyze(stepData.elementRect, stepData.windowWidth, stepData.windowHeight),
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
      try {
        await saveStep({
          sessionId,
          stepNumber: stepNum,
          screenshotUrl: null,
          clickX: null,
          clickY: null,
          title: actionLabel || '수동으로 진행할 단계',
          description: '자동 캡처를 저장하지 못한 단계입니다. 실제 화면에서 필요한 작업을 완료한 뒤 다음을 눌러주세요.',
          url: stepData.url,
          domainInfo,
          viewportW: stepData.viewportW ?? stepData.windowWidth ?? null,
          viewportH: stepData.viewportH ?? stepData.windowHeight ?? null,
          elementSelector: null,
          elementXPath: null,
          elementRect: null,
          actionInfo: stepData.actionInfo ?? null,
          typedText: null,
          cropBox: null,
          audioOffsetMs: null,
          stepType: 'blocked_step',
          captureSource: 'none',
          captureFailureReason: 'upload_failed',
        });
      } catch (err) {
        log('warn', 'bg', `blocked save-step API failed step ${stepNum}:`, err.message);
      }
      chrome.runtime.sendMessage({ type: 'UPLOAD_FAILED', stepNumber: stepNum }, () => { void chrome.runtime.lastError; });
      return;
    }

    await saveStepLocally({ ...stepData, imageUrl: uploadedUrl, title, description, actionInfo: stepData.actionInfo ?? null, actionLabel, domainInfo, cropBox, overwrite: !!stepData.overwrite });
    updateBadge();
    idbDelete(stepNum).catch(() => {});

    try {
      // 음성 녹음 기준점 대비 이 캡처의 상대 시각 — Whisper 전사 구간 배분에 사용
      const { audioStartTime } = await storageGet('audioStartTime');
      const audioOffsetMs = audioStartTime
        ? Math.max(0, (stepData.timestamp || Date.now()) - audioStartTime)
        : null;
      await saveStep({ sessionId, stepNumber: stepNum, screenshotUrl: uploadedUrl, clickX, clickY, title: title ?? '', description: description ?? '', url: stepData.url, domainInfo, viewportW: stepData.viewportW ?? stepData.windowWidth ?? null, viewportH: stepData.viewportH ?? stepData.windowHeight ?? null, elementSelector: stepData.elementSelector ?? null, elementXPath: stepData.elementXPath ?? null, elementRect: stepData.elementRect ?? null, actionInfo: stepData.actionInfo ?? null, typedText: stepData.typedText || null, cropBox, audioOffsetMs });
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
    typedText:   stepData.typedText    || null,  // 입력 원문(매뉴얼 생성 참고·Live Guide 자동입력). 마스킹/빈값은 null
    domainInfo:  stepData.domainInfo   ?? null,
    elementRect: stepData.elementRect  ?? null,
    clickX:      stepData.clickX       ?? 0,
    clickY:      stepData.clickY       ?? 0,
    windowWidth: stepData.windowWidth  ?? 1280,
    windowHeight:stepData.windowHeight ?? 800,
    elementSelector: stepData.elementSelector ?? null,
    elementXPath:    stepData.elementXPath    ?? null,
    cropBox:         stepData.cropBox         ?? null,
    manual:      !!stepData.manual,
  };

  if (stepData.overwrite) {
    const idx = steps.findIndex(s => s.stepNumber === stepNum);
    if (idx >= 0) steps[idx] = { ...steps[idx], ...newStep };
    else steps.push(newStep);
  } else {
    steps.push(newStep);
  }

  // 업로드 완료 순서가 아닌 행동(stepNumber) 순서로 정렬 유지 — 1-3-2 순서 뒤바뀜 방지
  steps.sort((a, b) => a.stepNumber - b.stepNumber);

  await storageSet({ steps });
  if (!stepData.overwrite) await pushUndo({ type: 'add', stepId: newStep.id });
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

  const requestOptions = {
    ...options,
    headers: {
      'Authorization': `Bearer ${extensionToken}`,
      'Content-Type':  'application/json',
      ...(options.headers || {}),
    },
  };

  let res;
  try {
    res = await fetch(url, requestOptions);
  } catch (err) {
    const fallbackUrl = getWebappFallbackUrl(url);
    if (!fallbackUrl) throw err;
    log('warn', 'bg', `fetch failed for ${url}; retrying ${fallbackUrl}:`, err.message);
    res = await fetch(fallbackUrl, requestOptions);
  }

  if (res.status === 401) {
    await handleTokenExpired();
    throw new Error('TOKEN_EXPIRED');
  }
  return res;
}

function getWebappFallbackUrl(url) {
  try {
    const current = new URL(url);
    const fallback = new URL(WEBAPP_ORIGIN);
    if (current.origin === fallback.origin) return null;
    return `${fallback.origin}${current.pathname}${current.search}`;
  } catch {
    return null;
  }
}

async function getWebappOrigin() {
  const { webappOrigin } = await storageGet('webappOrigin');
  return webappOrigin || WEBAPP_ORIGIN;
}

// 가이드 고정 탭 조회 — START_GUIDE에서 저장한 guideTabId의 탭. 없거나 닫혔으면 null.
// 활성 탭이 아니라 이 탭에서만 가이드가 동작해, 다른 탭으로 새거나 가로채는 것을 막는다.
async function getGuideTab() {
  const { guideTabId } = await storageGet('guideTabId');
  if (!guideTabId) return null;
  return new Promise((res) => chrome.tabs.get(guideTabId, (t) => res(chrome.runtime.lastError ? null : t)));
}

// ── 사용자 플랜 조회 (PRO 기능 게이팅) ───────────────────────────
// /api/extension/me를 호출해 플랜을 받아 짧은 TTL로 캐시한다 (업그레이드 즉시 반영 위해
// 영구 저장 대신 on-demand 조회+캐시). 오프라인/실패 시 마지막 캐시 또는 free로 폴백.
const PLAN_CACHE_TTL_MS = 10 * 60 * 1000;
async function getUserPlan(forceRefresh = false) {
  if (!forceRefresh) {
    const { _planCache } = await storageGet('_planCache');
    if (_planCache && (Date.now() - _planCache.time) < PLAN_CACHE_TTL_MS) return _planCache;
  }
  try {
    const origin = await getWebappOrigin();
    const res = await authedFetch(`${origin}/api/extension/me`, { method: 'GET' });
    if (!res.ok) throw new Error(`me failed: ${res.status}`);
    const data  = await res.json();
    const cache = { plan: data.plan || 'free', isPro: !!data.isPro, time: Date.now() };
    await storageSet({ _planCache: cache });
    return cache;
  } catch (err) {
    log('warn', 'bg', 'getUserPlan failed:', err.message);
    const { _planCache } = await storageGet('_planCache');
    return _planCache || { plan: 'free', isPro: false, time: 0 };
  }
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
async function saveStep({ sessionId, stepNumber, screenshotUrl, clickX, clickY, title, description, url, domainInfo, viewportW, viewportH, elementSelector, elementXPath, elementRect, actionInfo, typedText, cropBox, audioOffsetMs, stepType, captureSource, captureFailureReason }) {
  const origin = await getWebappOrigin();
  const payload = {
    session_id:       sessionId,
    step_number:      stepNumber,
    screenshot_url:   screenshotUrl,
    click_x:          clickX,
    click_y:          clickY,
    step_type:        stepType ?? 'normal_interactive_step',
    capture_source:   captureSource ?? (screenshotUrl ? 'auto' : 'none'),
    capture_failure_reason: captureFailureReason ?? null,
    title:            title ?? '',
    description:      description ?? '',
    url,
    domain_hostname:  domainInfo?.hostname  ?? null,
    domain_name:      domainInfo?.name      ?? null,
    domain_favicon:   domainInfo?.favicon   ?? null,
    viewport_w:       viewportW             ?? null,
    viewport_h:       viewportH             ?? null,
    element_selector: elementSelector       ?? null,
    element_xpath:    elementXPath          ?? null,
    element_rect:     elementRect           ?? null,
    action_info:      actionInfo            ?? null,
    type_text:        typedText             || null,
    crop_box:         cropBox               ?? null,
    ...(audioOffsetMs != null ? { audio_offset_ms: audioOffsetMs } : {}),
  };
  const labelDebug = payload.action_info?.labelDebug ?? {};
  log('info', 'bg', 'save-step payload:', {
    step_number: payload.step_number,
    action_info: payload.action_info,
    chosenLabel: labelDebug.chosenLabel ?? payload.action_info?.label ?? null,
    rawText: labelDebug.rawText ?? null,
    ariaLabel: labelDebug.ariaLabel ?? null,
    title: labelDebug.title ?? null,
    role: labelDebug.role ?? payload.action_info?.role ?? null,
    selector: labelDebug.selector ?? payload.element_selector,
    fallbackReason: labelDebug.fallbackReason ?? null,
    type_text: payload.type_text,
    click_x: payload.click_x,
    click_y: payload.click_y,
    element_rect: payload.element_rect,
    element_selector: payload.element_selector,
    element_xpath: payload.element_xpath,
    domain_favicon: payload.domain_favicon,
  });

  const res = await authedFetch(`${origin}/api/capture/save-step`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`save-step failed: ${res.status}: ${await res.text()}`);
  return res.json();
}

function normalizeCoord(value, size, coordinateSpace) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (coordinateSpace === 'top-viewport-css-px') {
    return size ? Math.max(0, Math.min(n / size, 1)) : 0;
  }
  if (n === 0) return 0;
  const normalized = n <= 1 ? n : (size ? n / size : 0);
  return Math.max(0, Math.min(normalized, 1));
}

async function syncLocalStepsBeforeFinalize(sessionId, stepNumbers, localSteps) {
  const wanted = new Set(stepNumbers || []);
  const stepsToSync = (localSteps || [])
    .filter((step) => step?.stepNumber && (!wanted.size || wanted.has(step.stepNumber)))
    .sort((a, b) => a.stepNumber - b.stepNumber);

  for (const step of stepsToSync) {
    if (!step.imageUrl) {
      throw new Error(`step ${step.stepNumber} has no uploaded image`);
    }

    const viewportW = step.windowWidth || step.viewportW || 1280;
    const viewportH = step.windowHeight || step.viewportH || 800;
    const coordinateSpace = step.actionInfo?.targetContext?.coordinateSpace;
    const clickX = normalizeCoord(step.clickX, viewportW, coordinateSpace);
    const clickY = normalizeCoord(step.clickY, viewportH, coordinateSpace);
    const cropBox = step.cropBox ?? computeCropBox(step.elementRect, clickX, clickY, step.actionInfo);

    await saveStep({
      sessionId,
      stepNumber: step.stepNumber,
      screenshotUrl: step.imageUrl,
      clickX,
      clickY,
      title: step.title ?? '',
      description: step.description ?? '',
      url: step.url,
      domainInfo: step.domainInfo ?? null,
      viewportW,
      viewportH,
      elementSelector: step.elementSelector ?? null,
      elementXPath: step.elementXPath ?? null,
      elementRect: step.elementRect ?? null,
      actionInfo: step.actionInfo ?? null,
      typedText: step.typedText || null,
      cropBox,
      audioOffsetMs: null,
    });
  }
}

// ── 세션 완료 — 웹앱 API 경유 ───────────────────────────────────
async function finalizeSession(sessionId, stepNumbers, audioUrl = null) {
  const { extensionToken, contentMode, settings, steps } = await storageGet(['extensionToken', 'contentMode', 'settings', 'steps']);
  if (!extensionToken) {
    log('warn', 'bg', 'extensionToken 없음 — /extension-link 에서 연동 필요');
    return { tutorial_id: null, step_count: 0 };
  }

  // per-step 음성 보정(향후 에디터 재녹음용) — 현재는 비어 있을 수 있음
  const stepVoice = {};
  (steps || []).forEach(s => { if (s.voiceAudioUrl) stepVoice[s.stepNumber] = s.voiceAudioUrl; });

  await syncLocalStepsBeforeFinalize(sessionId, stepNumbers, steps);

  const origin = await getWebappOrigin();
  const res = await authedFetch(`${origin}/api/capture/finalize`, {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      // 패널에서 삭제/실행취소되지 않고 남은 스텝만 매뉴얼에 포함
      ...(stepNumbers?.length ? { step_numbers: stepNumbers } : {}),
      // 웹앱에서 선택한 매뉴얼 유형 ('action' | 'education')
      ...(contentMode && contentMode !== 'action' ? { content_mode: contentMode } : {}),
      // 선택영역 확대 설정 — 스텝 이미지에 클릭 영역 확대(image_zoom) 선적용
      ...(settings?.autoZoom ? { auto_zoom: true } : {}),
      // 연속 내레이션 음성 — 서버에서 Whisper 전사 후 스텝별 구간 배분
      ...(audioUrl ? { audio_url: audioUrl } : {}),
      // per-step 음성 보정(있을 때만) — 해당 스텝은 이 클립으로 덮어씀
      ...(Object.keys(stepVoice).length ? { step_voice: stepVoice } : {}),
    }),
  });
  if (!res.ok) throw new Error(`finalize failed: ${res.status}: ${await res.text()}`);
  await storageRemove(['audioStartTime']);
  const data = await res.json();
  const webappOrigin = new URL(res.url).origin;
  await storageSet({ webappOrigin });
  return { ...data, webapp_origin: webappOrigin };
}

// ── Supabase Storage 업로드 (실패 시 1회 재시도) ─────────────────
// extensionToken은 웹앱 자체 토큰(Supabase JWT 아님)이라 쓸 수 없다 — anon key 고정.
// x-upsert:true는 INSERT + UPDATE 정책 둘 다 필요 (naviaction에 anon 정책 적용됨)
async function uploadImage(path, blob, contentType = 'image/jpeg') {
  const doUpload = () => fetch(
    `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${path}`,
    {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type':  contentType,
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

