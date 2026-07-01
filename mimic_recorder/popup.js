
const viewIdle      = document.getElementById('viewIdle');
const viewRecording = document.getElementById('viewRecording');
const btnStart      = document.getElementById('btnStart');
const btnPause      = document.getElementById('btnPause');
const btnSnapBottom = document.getElementById('btnSnapBottom');
const btnUndo       = document.getElementById('btnUndo');
const btnBlurTool   = document.getElementById('btnBlurTool');
const btnDiscard    = document.getElementById('btnDiscard');
const btnFinish     = document.getElementById('btnFinish');
const recDot        = document.getElementById('recDot');
const recLabel      = document.getElementById('recLabel');
const recStepCount  = document.getElementById('recStepCount');
const stepCount     = document.getElementById('stepCount');
const stepsList     = document.getElementById('stepsList');
const emptyState    = document.getElementById('emptyState');
const btnSettings      = document.getElementById('btnSettings');
const settingsOverlay  = document.getElementById('settingsOverlay');
const btnBack          = document.getElementById('btnBack');
const settingHighlight = document.getElementById('settingHighlight');
const settingAutoNav   = document.getElementById('settingAutoNav');
const settingVoiceRecord = document.getElementById('settingVoiceRecord');
const settingSaveText    = document.getElementById('settingSaveText');

let isRecording  = false;
let isPaused     = false;
let _userIsPro   = false;   // 캡처별 음성 메모 게이팅 (GET_PLAN으로 갱신)
let _voiceEnabled = false;  // 설정의 음성 메모 사용 여부 (마이크 버튼 노출)
let capturedStepCount = 0;

// ── 설정 기본값 ──────────────────────────────────────────────────
const SETTINGS_DEFAULTS = {
  highlight:   true,
  autoNav:     true,
  autoZoom:    false,  // 선택영역 확대 — 매뉴얼 이미지에 클릭 영역 확대 선적용
  voiceRecord: false,  // 음성 설명 녹음 — 녹화 중 마이크로 설명 → 스텝 전사
  saveText:    false,  // 타이핑 텍스트 저장 — Live Guide Ctrl+V 자동입력용
};

// ── chrome.storage.local 프로미스 헬퍼 ──────────────────────────
function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

// ── 초기화 ───────────────────────────────────────────────────────
async function init() {
  const r = await storageGet(['isRecording', 'isPaused', 'steps', 'extensionToken', 'settings']);
  const initialSteps = r.steps || [];
  isRecording = !!r.isRecording;
  isPaused    = !!r.isPaused;
  capturedStepCount = initialSteps.length;
  _voiceEnabled = !!(r.settings && r.settings.voiceRecord);
  updateView();
  renderSteps(initialSteps);
  updateLoginState(!!r.extensionToken);
  loadSettingsUI(r.settings || {});
  // 플랜 조회 (캡처별 음성 메모 PRO 게이팅) — 연동돼 있을 때만
  if (r.extensionToken) {
    chrome.runtime.sendMessage({ type: 'GET_PLAN' }, (p) => {
      void chrome.runtime.lastError;
      _userIsPro = !!(p && p.isPro);
    });
  }
}

// 마이크 권한 확보 — 이미 허용이면 통과, 아니면 권한 창을 띄운다.
async function ensureMicPermission() {
  let state = 'prompt';
  try { state = (await navigator.permissions.query({ name: 'microphone' })).state; } catch { /* 미지원 */ }
  if (state === 'granted') return true;
  await chrome.storage.local.remove('micPermissionGranted');
  return openMicPermissionWindow();
}

// ── 설정 UI 로드 ──────────────────────────────────────────────────
function loadSettingsUI(saved) {
  const s = { ...SETTINGS_DEFAULTS, ...saved };
  settingHighlight.checked      = s.highlight;
  settingAutoZoom.checked       = s.autoZoom;
  settingAutoNav.checked        = s.autoNav;
  if (settingVoiceRecord) settingVoiceRecord.checked = s.voiceRecord;
  if (settingSaveText)    settingSaveText.checked    = s.saveText;
}

function saveSettings() {
  const s = {
    highlight:   settingHighlight.checked,
    autoZoom:    settingAutoZoom.checked,
    autoNav:     settingAutoNav.checked,
    voiceRecord: settingVoiceRecord ? settingVoiceRecord.checked : false,
    saveText:    settingSaveText    ? settingSaveText.checked    : false,
  };
  chrome.storage.local.set({ settings: s });
  storageGet('targetTabId').then(({ targetTabId }) => {
    if (!targetTabId) return;
    chrome.tabs.sendMessage(targetTabId, { type: 'UPDATE_SETTINGS', settings: s }, () => {
      void chrome.runtime.lastError;
    });
  });
}

// ── 설정 패널 열기/닫기 ───────────────────────────────────────────
btnSettings.addEventListener('click', () => settingsOverlay.classList.add('open'));
btnBack.addEventListener('click',     () => settingsOverlay.classList.remove('open'));
settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) settingsOverlay.classList.remove('open');
});

// 각 설정 변경 시 즉시 저장
settingHighlight.addEventListener('change',   saveSettings);
settingAutoZoom.addEventListener('change',    saveSettings);
settingAutoNav.addEventListener('change',     saveSettings);
if (settingSaveText) settingSaveText.addEventListener('change', saveSettings);

// 음성 녹음 토글 — 켤 때 마이크 권한을 먼저 확보한다.
// 사이드패널·offscreen은 마이크 프롬프트를 띄우지 못하고 즉시 거부되므로,
// 전용 페이지(request-mic.html)를 작은 창으로 띄워 거기서 권한을 받는다.
// 한 번 허용하면 확장 오리진 전체에 저장되어 이후 offscreen 녹음이 동작한다.
function openMicPermissionWindow() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => { if (settled) return; settled = true; chrome.storage.onChanged.removeListener(onChanged); resolve(ok); };
    const onChanged = (changes, area) => {
      if (area === 'local' && 'micPermissionGranted' in changes) finish(!!changes.micPermissionGranted.newValue);
    };
    chrome.storage.onChanged.addListener(onChanged);
    chrome.windows.create({ url: chrome.runtime.getURL('request-mic.html'), type: 'popup', width: 460, height: 340 });
    setTimeout(() => finish(false), 120000);  // 사용자가 방치하면 60초 후 실패 처리
  });
}

settingVoiceRecord?.addEventListener('change', async () => {
  if (settingVoiceRecord.checked) {
    // PRO 전용 — 플랜 확인
    const plan = await new Promise((res) => chrome.runtime.sendMessage({ type: 'GET_PLAN', refresh: true }, (p) => { void chrome.runtime.lastError; res(p); }));
    _userIsPro = !!(plan && plan.isPro);
    if (!_userIsPro) {
      settingVoiceRecord.checked = false;
      showToast('캡처별 음성 메모는 PRO 플랜 기능입니다', 3500);
      return;
    }
    // 마이크 권한 확보
    const ok = await ensureMicPermission();
    if (!ok) {
      settingVoiceRecord.checked = false;
      showToast('마이크 권한이 필요합니다 — 열린 창에서 허용해주세요', 3500);
      saveSettings();
      return;
    }
  }
  _voiceEnabled = settingVoiceRecord.checked;
  saveSettings();
});

function updateLoginState(hasToken, expired = false) {
  btnStart.disabled = !hasToken;

  let notice = document.getElementById('loginNotice');
  if (hasToken) {
    notice?.remove();
    return;
  }

  // 만료 케이스는 문구만 교체, 새로 생성하지 않음
  if (notice) {
    if (expired) {
      const msgEl = notice.querySelector('[data-msg]');
      if (msgEl) msgEl.textContent = '세션이 만료되었습니다. 다시 연동해 주세요.';
      Object.assign(notice.style, { background: '#FEF2F2', border: '1px solid #FECACA' });
      const msgStyle = notice.querySelector('[data-msg]');
      if (msgStyle) msgStyle.style.color = '#991B1B';
    }
    return;
  }

  notice = document.createElement('div');
  notice.id = 'loginNotice';
  Object.assign(notice.style, {
    margin: '10px 18px 4px',
    background: expired ? '#FEF2F2' : '#F5F3FF',
    border:     `1px solid ${expired ? '#FECACA' : '#DDD6FE'}`,
    borderRadius: '10px', padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: '8px',
  });

  const msgEl = document.createElement('div');
  msgEl.setAttribute('data-msg', '');
  Object.assign(msgEl.style, {
    fontSize: '12px', lineHeight: '1.5',
    color: expired ? '#991B1B' : '#5B21B6',
  });
  msgEl.textContent = expired
    ? '세션이 만료되었습니다. 다시 연동해 주세요.'
    : '녹화를 시작하려면 MIMIC 계정 연동이 필요합니다.';

  const btn = document.createElement('button');
  Object.assign(btn.style, {
    alignSelf: 'flex-start',
    background: '#4F46E5', color: '#fff',
    border: 'none', borderRadius: '7px',
    fontSize: '12px', fontWeight: '600',
    padding: '6px 14px', cursor: 'pointer',
  });
  btn.textContent = expired ? '다시 연동하기' : '로그인 / 연동하기';
  btn.addEventListener('click', () => {
    // 웹스토어 배포본=운영 / 개발자 언패킹=dev(Preview) — chrome.runtime.id로 자동 분기
    const origin = chrome.runtime.id === 'ehbhcdkapcbfehinjapabgoegcjmmbgd'
      ? 'https://mimic-nine-ashen.vercel.app'
      : 'https://mimic-git-dev-kinjungho-7735s-projects.vercel.app';
    chrome.tabs.create({ url: `${origin}/extension-link` });
  });

  notice.append(msgEl, btn);
  btnStart.closest('div').after(notice);
}

// ── 뷰 전환 ──────────────────────────────────────────────────────
function updateView() {
  if (isRecording) {
    viewIdle.style.display = 'none';
    viewRecording.style.display = 'block';
    if (isPaused) {
      recDot.classList.add('paused');
      recLabel.classList.add('paused');
      recLabel.textContent = 'PAUSE';
      btnPause.title = '재개';
      // pause 버튼 아이콘 → play
      const svgPlay = btnPause.querySelector('svg');
      svgPlay.replaceChildren();
      svgPlay.setAttribute('fill', 'currentColor');
      const playPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      playPath.setAttribute('d', 'M8 5.14v14l11-7-11-7z');
      svgPlay.appendChild(playPath);
    } else {
      recDot.classList.remove('paused');
      recLabel.classList.remove('paused');
      recLabel.textContent = 'REC';
      btnPause.title = '일시정지';
      // pause 버튼 아이콘 → pause
      const svgPause = btnPause.querySelector('svg');
      svgPause.replaceChildren();
      const rect1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect1.setAttribute('x', '5'); rect1.setAttribute('y', '3');
      rect1.setAttribute('width', '4'); rect1.setAttribute('height', '18'); rect1.setAttribute('rx', '1');
      const rect2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect2.setAttribute('x', '15'); rect2.setAttribute('y', '3');
      rect2.setAttribute('width', '4'); rect2.setAttribute('height', '18'); rect2.setAttribute('rx', '1');
      svgPause.append(rect1, rect2);
    }
  } else {
    viewIdle.style.display = 'block';
    viewRecording.style.display = 'none';
  }
  // 하단 액션 바: 녹화 중이 아니어도 스텝이 남아 있으면 완료/재시도를 보여준다.
  const bar = document.getElementById('bottomActionBar');
  if (bar) bar.style.display = (isRecording || capturedStepCount > 0) ? 'flex' : 'none';
}

// ── 스텝 카운트 동기화 ────────────────────────────────────────────
function updateStepCounts(count) {
  const text = `${count} step${count !== 1 ? 's' : ''}`;
  stepCount.textContent = text;
  recStepCount.textContent = text;
}

// ── 등록 도메인(eTLD+1) 추출 — 같은 서비스 서브도메인을 한 그룹으로 ──
// 예: www/cart/checkout.coupang.com → coupang.com (vercel.com vs github.com은 분리 유지)
const TWO_PART_TLDS = new Set(['co.kr', 'co.uk', 'co.jp', 'com.au', 'co.nz', 'or.kr', 'go.kr', 'ne.jp']);
function baseDomain(hostname) {
  if (!hostname) return null;
  if (/^[\d.]+$/.test(hostname) || !hostname.includes('.')) return hostname;
  const parts = hostname.split('.');
  const keep = TWO_PART_TLDS.has(parts.slice(-2).join('.')) ? 3 : 2;
  return parts.slice(-keep).join('.');
}

// ── 스텝 렌더 ────────────────────────────────────────────────────
let _prevStepCount = 0;  // 자동 스크롤 판정용 — 스텝이 늘어난 렌더만 맨 아래로

function scrollStepsToBottom() {
  window.scrollTo({ top: document.documentElement.scrollHeight });
}

function renderSteps(steps) {
  capturedStepCount = steps.length;
  updateView();
  stepsList.querySelectorAll('.step-card, .domain-header').forEach((c) => c.remove());
  updateStepCounts(steps.length);
  if (steps.length === 0) {
    emptyState.style.display = 'flex';
    expandedStepId = null;
    _prevStepCount = 0;
    return;
  }
  emptyState.style.display = 'none';

  expandedStepId = null;

  const domains = new Set(steps.map(s => baseDomain(s.domainInfo?.hostname)).filter(Boolean));
  const showDomainHeaders = domains.size > 1;

  let lastDomain = null;
  steps.forEach((step, i) => {
    const domainKey = baseDomain(step.domainInfo?.hostname);
    if (showDomainHeaders && domainKey && domainKey !== lastDomain) {
      stepsList.appendChild(buildDomainHeader(step.domainInfo));
      lastDomain = domainKey;
    }
    const card = buildStepCard(step, i + 1);
    // 모든 스텝 썸네일 즉시 펼침
    const tw = card.querySelector('.step-thumb');
    if (tw) tw.style.display = 'block';
    card.classList.add('expanded');
    stepsList.appendChild(card);
  });

  // 새 캡처가 추가되면 맨 아래로 자동 스크롤해 방금 찍힌 스텝을 바로 확인할 수 있게 한다.
  // 마지막 썸네일은 loadThumb(IndexedDB 조회)가 src를 늦게 설정하는 비동기 로드라
  // 높이가 나중에 늘어남 — 로드 완료 시 한 번 더 내림.
  if (steps.length > _prevStepCount) {
    requestAnimationFrame(scrollStepsToBottom);
    const lastImg = stepsList.lastElementChild?.querySelector('.step-thumb img');
    lastImg?.addEventListener('load', scrollStepsToBottom, { once: true });
  }
  _prevStepCount = steps.length;
}

function buildDomainHeader(domainInfo) {
  const header = document.createElement('div');
  header.className = 'domain-header';

  const favicon = document.createElement('img');
  favicon.className = 'domain-favicon';
  favicon.src = domainInfo.favicon || '';
  favicon.alt = '';
  favicon.width = 14;
  favicon.height = 14;
  favicon.onerror = () => { favicon.style.display = 'none'; };

  const name = document.createElement('span');
  name.className = 'domain-name';
  // 페이지 타이틀 기반 name은 동적이라 신뢰 불가 — 등록 도메인의 서비스명을 표시 (앱과 동일 규칙)
  const base = baseDomain(domainInfo.hostname);
  const service = base ? base.split('.')[0] : '';
  name.textContent = service
    ? service.charAt(0).toUpperCase() + service.slice(1)
    : (domainInfo.name || domainInfo.hostname);

  header.append(favicon, name);
  return header;
}

// 액션 타입별 아이콘
function getActionIcon(actionInfo) {
  if (!actionInfo) return '●';
  switch (actionInfo.type) {
    case 'click':       return '↖';
    case 'navigate':    return '→';
    case 'toggle':      return '☑';
    case 'select':      return '▾';
    case 'focus_input': return '✎';
    case 'type':        return '✎';
    default:            return '●';
  }
}

// 현재 펼쳐진 스텝 ID (최신 스텝 자동 펼침)
function getStepDisplayLabel(step, num) {
  const info = step.actionInfo || {};
  if (info.type === 'type' || info.type === 'focus_input' || step.typedText) {
    const label = (info.label || info.text || '').trim();
    return label && !label.startsWith('\uC785\uB825, "') ? `\uC785\uB825, ${label}` : '\uC785\uB825';
  }
  return step.actionLabel || step.title || `Step ${num}`;
}

let expandedStepId = null;

function buildStepCard(step, num) {
  const card = document.createElement('div');
  card.className = 'step-card';
  card.dataset.stepId = step.id;

  const numBadge = document.createElement('div');
  numBadge.className = 'step-number';
  numBadge.textContent = String(num);

  const info = document.createElement('div');
  info.className = 'step-info';

  const actionRow = document.createElement('div');
  actionRow.className = 'step-action-row';

  const iconEl = document.createElement('span');
  iconEl.className = 'step-action-icon';
  iconEl.textContent = getActionIcon(step.actionInfo);

  const labelEl = document.createElement('span');
  labelEl.className = 'step-action-label';
  labelEl.dataset.stepLabel = '';
  labelEl.textContent = getStepDisplayLabel(step, num);

  actionRow.append(iconEl, labelEl);

  const typingPreview = document.createElement('div');
  typingPreview.className = 'step-typing-preview';
  typingPreview.style.display = 'none';

  const timeEl = document.createElement('div');
  timeEl.className = 'step-time';
  timeEl.textContent = formatTime(step.timestamp);

  info.append(actionRow, typingPreview, timeEl);

  // ── 썸네일 컨테이너 (접힘/펼침) ─────────────────────────────
  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'step-thumb';
  thumbWrap.style.display = 'none'; // 기본 접힘
  thumbWrap.style.position = 'relative';

  const thumbZoomLayer = document.createElement('div');
  thumbZoomLayer.className = 'step-thumb-zoom-layer';

  const thumbImg = document.createElement('img');
  thumbImg.alt = '';
  thumbImg.style.cssText = 'display:none;width:100%;border-radius:5px;display:block;';

  const thumbPlaceholder = document.createElement('div');
  thumbPlaceholder.className = 'step-thumb-placeholder';
  thumbPlaceholder.textContent = '로딩 중...';

  // ── 클릭포인트 + 하이라이트 오버레이 ─────────────────────────
  const thumbOverlay = document.createElement('div');
  thumbOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;border-radius:5px;overflow:hidden;z-index:2;';

  thumbWrap.append(thumbZoomLayer, thumbImg, thumbPlaceholder, thumbOverlay);

  // 썸네일 로드 후 오버레이 렌더
  loadThumb(step, thumbImg, thumbPlaceholder, thumbOverlay);

  // ── 카드 클릭 → 펼침 토글 ────────────────────────────────────
  const topRow = document.createElement('div');
  topRow.style.cssText = 'display:flex;align-items:flex-start;gap:10px;cursor:pointer;';
  topRow.append(numBadge, info);

  // 썸네일은 항상 펼쳐진 상태 — 클릭 토글 없음

  const delBtn = document.createElement('button');
  delBtn.className = 'step-delete';
  delBtn.title = '이 스텝 삭제';
  delBtn.textContent = '✕';
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'DELETE_STEP', id: step.id }, () => { void chrome.runtime.lastError; });
  });

  card.style.cssText = 'flex-direction:column;align-items:stretch;';
  card.append(topRow, thumbWrap, delBtn);

  // per-step 음성 버튼은 라이브 레코더에서 제거 — 연속 내레이션(Magic Mic식)이 주력.
  // (per-step 보정은 추후 에디터 재녹음으로 제공. buildStepVoiceButton은 그때 재사용)

  return card;
}

// 스텝 음성 메모 녹음 버튼 — 누르면 녹음 시작, 다시 누르면 정지·업로드.
function buildStepVoiceButton(step) {
  const btn = document.createElement('button');
  btn.dataset.recording = '0';
  const hasVoice = !!step.voiceAudioUrl;
  btn.textContent = hasVoice ? '🎙 음성 메모 ✓ (다시 녹음)' : '🎙 음성 메모 녹음';
  btn.style.cssText = [
    'margin-top:6px', 'width:100%', 'padding:7px',
    'border:1px solid #DDD6FE', 'border-radius:8px',
    'background:#f5f3ff', 'color:#4F46E5',
    'font-size:12px', 'font-weight:600', 'cursor:pointer',
  ].join(';');

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!_userIsPro) { showToast('음성 메모는 PRO 플랜 기능입니다', 3000); return; }

    if (btn.dataset.recording === '1') {
      // 정지
      btn.dataset.recording = '0';
      btn.textContent = '⏳ 저장 중…';
      btn.disabled = true;
      chrome.runtime.sendMessage({ type: 'STOP_STEP_VOICE' }, (res) => {
        void chrome.runtime.lastError;
        btn.disabled = false;
        btn.style.background = '#f5f3ff'; btn.style.color = '#4F46E5'; btn.style.borderColor = '#DDD6FE';
        btn.textContent = res?.ok ? '🎙 음성 메모 ✓ (다시 녹음)' : '🎙 음성 메모 녹음';
        showToast(res?.ok ? '음성 메모 저장됨 ✓' : (res?.error || '저장 실패'), 2500);
      });
      return;
    }

    // 시작 — 권한 확보 후 녹음
    const ok = await ensureMicPermission();
    if (!ok) { showToast('마이크 권한이 필요합니다', 3000); return; }
    btn.dataset.recording = '1';
    btn.textContent = '⏺ 녹음 중… (정지)';
    btn.style.background = '#fef2f2'; btn.style.color = '#dc2626'; btn.style.borderColor = '#fecaca';
    chrome.runtime.sendMessage({ type: 'START_STEP_VOICE', stepNumber: step.stepNumber }, (res) => {
      void chrome.runtime.lastError;
      if (!res?.ok) {
        btn.dataset.recording = '0';
        btn.textContent = '🎙 음성 메모 녹음';
        btn.style.background = '#f5f3ff'; btn.style.color = '#4F46E5'; btn.style.borderColor = '#DDD6FE';
        showToast(res?.error || '마이크 시작 실패', 3000);
      }
    });
  });

  return btn;
}

function collapseAllThumb() {
  stepsList.querySelectorAll('.step-card').forEach((c) => {
    c.classList.remove('expanded');
    const tw = c.querySelector('.step-thumb');
    if (tw) tw.style.display = 'none';
  });
}

// ── 썸네일 로드 (IndexedDB Blob → objectURL → elementRect 기준 크롭) ──
let _thumbObjectUrls = [];

async function loadThumb(step, imgEl, placeholder, overlayEl) {
  try {
    const blob = await idbGetScreenshot(step.stepNumber);
    let src = null;

    if (blob) {
      // 전체 스크린샷 그대로 표시 (크롭 없음)
      src = URL.createObjectURL(blob);
      _thumbObjectUrls.push(src);
    } else if (step.imageUrl) {
      src = step.imageUrl;
    }

    if (src) {
      imgEl.src = src;
      imgEl.style.display = 'block';
      imgEl.style.cursor = 'zoom-in';
      imgEl.onclick = () => {
        const zoomOverlay = document.getElementById('thumbZoomOverlay');
        const zoomImg     = document.getElementById('thumbZoomImg');
        if (!zoomOverlay || !zoomImg) return;
        if (step.imageUrl) {
          zoomImg.src = step.imageUrl;
          zoomOverlay.dataset.imageUrl = step.imageUrl;
        } else {
          const blobSrc = URL.createObjectURL(blob);
          _thumbObjectUrls.push(blobSrc);
          zoomImg.src = blobSrc;
          zoomOverlay.dataset.imageUrl = '';
          zoomOverlay._zoomUrl = blobSrc;
        }
        zoomOverlay._step = step;
        zoomOverlay._blob = blob;
        zoomOverlay.classList.add('open');
      };
      imgEl.parentElement.onclick = (e) => {
        if (e.target === imgEl.parentElement || e.target === imgEl || e.target === overlayEl) imgEl.onclick();
      };
      placeholder.style.display = 'none';
      applyThumbPreviewZoom(step, imgEl, overlayEl, src);
      // 전체 스크린샷 위에 클릭포인트/하이라이트 오버레이 렌더
      if (overlayEl) renderThumbOverlay(overlayEl, imgEl, step, null);
    } else {
      placeholder.textContent = '이미지 없음';
    }
  } catch {
    placeholder.textContent = '이미지 없음';
  }
}

// 썸네일 위에 클릭포인트(빨간 원) + 하이라이트 박스 오버레이 렌더
// 전체 스크린샷 기준 좌표 사용 (크롭 없음)
function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getNormalizedClick(step) {
  const sx = Number(step.click_x ?? step.clickX ?? 0);
  const sy = Number(step.click_y ?? step.clickY ?? 0);
  const vw = Number(step.windowWidth || step.viewportW || 0);
  const vh = Number(step.windowHeight || step.viewportH || 0);
  const x = sx > 1 && vw ? sx / vw : sx;
  const y = sy > 1 && vh ? sy / vh : sy;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 1 || y > 1 || (x === 0 && y === 0)) return null;
  return { x, y };
}

function isValidFrame(frame) {
  return frame && frame.width > 0.05 && frame.height > 0.05 && frame.width <= 1 && frame.height <= 1;
}

function computePreviewFrame(step) {
  if (isValidFrame(step.cropBox)) return step.cropBox;

  const er = step.elementRect;
  const click = getNormalizedClick(step);
  if (!er && !click) return null;

  const isType = step.actionInfo?.type === 'type' || step.actionInfo?.type === 'focus_input' || !!step.typedText;
  const pad = isType ? 0.08 : 0.10;
  const minW = isType ? 0.46 : 0.42;
  const minH = isType ? 0.30 : 0.32;

  const cx = click?.x ?? clamp01((er?.x ?? 0) + (er?.width ?? 0) / 2);
  const cy = click?.y ?? clamp01((er?.y ?? 0) + (er?.height ?? 0) / 2);
  let width = er ? Math.max(er.width + pad * 2, minW) : minW;
  let height = er ? Math.max(er.height + pad * 2, minH) : minH;

  width = Math.min(width, 0.82);
  height = Math.min(height, 0.72);

  const x = clamp(cx - width / 2, 0, 1 - width);
  const y = clamp(cy - height / 2, 0, 1 - height);
  return { x, y, width, height };
}

function backgroundPositionFor(start, size) {
  if (size >= 0.999) return 50;
  return clamp((start / (1 - size)) * 100, 0, 100);
}

function fitFrameToAspect(frame, imageAspect, targetAspect) {
  if (!frame || !imageAspect || !targetAspect) return frame;
  let { x, y, width, height } = frame;
  const currentAspect = (width * imageAspect) / height;

  if (currentAspect > targetAspect) {
    const nextHeight = Math.min(1, (width * imageAspect) / targetAspect);
    const centerY = y + height / 2;
    height = nextHeight;
    y = clamp(centerY - height / 2, 0, 1 - height);
  } else {
    const nextWidth = Math.min(1, (height * targetAspect) / imageAspect);
    const centerX = x + width / 2;
    width = nextWidth;
    x = clamp(centerX - width / 2, 0, 1 - width);
  }
  return { x, y, width, height };
}

function applyThumbPreviewZoom(step, imgEl, overlayEl, src) {
  const wrap = imgEl.closest('.step-thumb');
  const zoomLayer = wrap?.querySelector('.step-thumb-zoom-layer');
  let frame = computePreviewFrame(step);
  if (!wrap || !zoomLayer || !overlayEl || !isValidFrame(frame)) return;

  const vw = Number(step.windowWidth || step.viewportW || 1280);
  const vh = Number(step.windowHeight || step.viewportH || 800);
  const imageAspect = vw / Math.max(1, vh);
  const targetAspect = clamp((frame.width * vw) / Math.max(1, frame.height * vh), 1.12, 1.72);
  frame = fitFrameToAspect(frame, imageAspect, targetAspect);

  wrap.classList.add('preview-zoom');
  wrap.style.aspectRatio = String(targetAspect);
  zoomLayer.style.backgroundImage = `url(${JSON.stringify(src)})`;
  zoomLayer.style.backgroundSize = `${100 / frame.width}% auto`;
  zoomLayer.style.backgroundPosition = `${backgroundPositionFor(frame.x, frame.width)}% ${backgroundPositionFor(frame.y, frame.height)}%`;

  overlayEl.dataset.previewZoom = '1';
  overlayEl.style.transformOrigin = 'top left';
  overlayEl.style.transform = `translate(${-frame.x * 100}%, ${-frame.y * 100}%) scale(${1 / frame.width}, ${1 / frame.height})`;
  overlayEl.style.transition = 'transform 0.48s cubic-bezier(0.22,0.61,0.36,1)';
}

function renderThumbOverlay(overlayEl, imgEl, step, _unused) {
  overlayEl.replaceChildren();
  const thumbWrap = overlayEl.closest('.step-thumb');
  thumbWrap?.querySelector('.step-type-badge')?.remove();
  const er = step.elementRect;

  if (er && er.width > 0.002 && er.height > 0.002) {
    const hl = document.createElement('div');
    hl.style.cssText = [
      'position:absolute', 'box-sizing:border-box', 'pointer-events:none',
      `left:${er.x * 100}%`, `top:${er.y * 100}%`,
      `width:${er.width * 100}%`, `height:${er.height * 100}%`,
      'border:2px solid #EF4444',
      'background:transparent',
      'border-radius:4px',
      'box-shadow:0 0 0 2px rgba(239,68,68,0.18)',
    ].join(';');
    overlayEl.appendChild(hl);
  }
  renderTypingBadge(thumbWrap, step);
}

function renderTypingBadge(thumbWrap, step) {
  const typed = (step.typedText || step.actionInfo?.typedText || '').trim();
  if (!thumbWrap || !typed) return;
  const badge = document.createElement('div');
  badge.className = 'step-type-badge';
  badge.textContent = `${'\uC785\uB825'}: ${typed.length > 42 ? `${typed.slice(0, 42)}...` : typed}`;
  badge.style.cssText = [
    'position:absolute', 'left:8px', 'bottom:8px', 'max-width:calc(100% - 16px)',
    'padding:5px 8px', 'border-radius:8px',
    'background:rgba(17,24,39,0.82)', 'color:#fff',
    'font-size:11px', 'font-weight:700', 'line-height:1.35',
    'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis',
    'box-shadow:0 4px 14px rgba(0,0,0,0.30)',
    'z-index:3',
    'pointer-events:none',
  ].join(';');
  thumbWrap.appendChild(badge);
}

function closeZoomOverlay() {
  const overlay = document.getElementById('thumbZoomOverlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  const zoomImg = document.getElementById('thumbZoomImg');
  if (zoomImg) zoomImg.src = '';
  if (overlay._zoomUrl) { URL.revokeObjectURL(overlay._zoomUrl); overlay._zoomUrl = null; }
}

document.getElementById('thumbZoomOverlay')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeZoomOverlay();
});
document.getElementById('thumbZoomClose')?.addEventListener('click', closeZoomOverlay);
// thumbZoomImg 클릭으로 닫는 기능 제거 — 드래그 블러 mouseup 시 충돌해서 오버레이가 닫혀버림

// 줌 오버레이에서 블러 — 확대된 이미지 위에서 드래그 선택
document.getElementById('thumbZoomBlur')?.addEventListener('click', () => {
  const zoomOverlay = document.getElementById('thumbZoomOverlay');
  const zoomImg     = document.getElementById('thumbZoomImg');
  const step        = zoomOverlay?._step;
  if (!zoomImg || !step) return;
  // blob이 없어도 startBlurMode 진입 — APPLY_BLUR에서 imageUrl fallback 처리
  startBlurMode(step, zoomImg, zoomOverlay._blob ?? null);
});

// 새 탭에서 원본 열기 — imageUrl(Supabase) 우선, 없으면 현재 objectURL
document.getElementById('thumbZoomNewTab')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const overlay = document.getElementById('thumbZoomOverlay');
  const src = overlay?.dataset.imageUrl || document.getElementById('thumbZoomImg')?.src;
  if (src) chrome.tabs.create({ url: src });
});

// 요소 박스가 아니라 '실제 렌더된 이미지' 영역을 계산 (object-fit:contain 레터박스 보정).
// 세로로 긴 이미지는 max-height 제약으로 요소 박스 안에 여백이 생겨, 이를 보정하지 않으면
// 드래그 정규화가 어긋나 블러가 짧게/엉뚱하게 적용된다.
function renderedImageRect(imgEl) {
  const box = imgEl.getBoundingClientRect();
  const nw = imgEl.naturalWidth, nh = imgEl.naturalHeight;
  // right/bottom 포함 — onMouseDown의 insideImg 판정이 이 값들을 사용한다(없으면 항상 false)
  if (!nw || !nh) {
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
  }
  const scale = Math.min(box.width / nw, box.height / nh);
  const dw = nw * scale, dh = nh * scale;
  const left = box.left + (box.width - dw) / 2;
  const top  = box.top  + (box.height - dh) / 2;
  return { left, top, right: left + dw, bottom: top + dh, width: dw, height: dh };
}

// ── 드래그 블러 (줌 오버레이 기준) ──────────────────────────────
function startBlurMode(step, zoomImg, originalBlob) {
  if (zoomImg.dataset.blurMode === '1') return;
  zoomImg.dataset.blurMode = '1';
  zoomImg.draggable = false;  // 브라우저 기본 이미지 드래그(고스트) 차단 — 블러 드래그와 충돌 방지

  // 블러 모드 진입 시 블러 버튼 활성화 표시
  const blurBtn = document.getElementById('thumbZoomBlur');
  if (blurBtn) blurBtn.classList.add('active');

  showToast('드래그로 블러할 영역을 선택하세요  (Esc: 취소)', 4000);

  const sel = document.createElement('div');
  sel.style.cssText = [
    'position:fixed', 'border:2px dashed #4F46E5',
    'background:rgba(79,70,229,0.18)', 'pointer-events:none',
    'display:none', 'box-sizing:border-box', 'z-index:999999',
  ].join(';');
  document.body.appendChild(sel);

  let startX = 0, startY = 0, dragging = false, didDrag = false;
  let _imgRect = null; // mousedown 시점에 고정

  function onMouseDown(e) {
    const imgRect = renderedImageRect(zoomImg);  // 실제 렌더 이미지 영역 (레터박스 보정)
    const insideImg = (
      e.clientX >= imgRect.left && e.clientX <= imgRect.right &&
      e.clientY >= imgRect.top  && e.clientY <= imgRect.bottom
    );
    if (!insideImg) return;
    e.preventDefault();
    e.stopPropagation();
    _imgRect = imgRect; // mousedown 시점에 고정
    startX = e.clientX; startY = e.clientY;
    dragging = true; didDrag = false;
    sel.style.display = 'block';
    sel.style.left   = `${startX}px`;
    sel.style.top    = `${startY}px`;
    sel.style.width  = '0px';
    sel.style.height = '0px';
  }

  function onMouseMove(e) {
    if (!dragging) return;
    didDrag = true;
    const x = Math.min(startX, e.clientX);
    const y = Math.min(startY, e.clientY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    sel.style.left   = `${x}px`;
    sel.style.top    = `${y}px`;
    sel.style.width  = `${w}px`;
    sel.style.height = `${h}px`;
  }

  async function onMouseUp(e) {
    if (!dragging) return;
    dragging = false;
    sel.style.display = 'none';

    if (!didDrag || !_imgRect) { cleanup(); return; }

    // mousedown 시점에 고정된 imgRect로 비율 계산 (레이아웃 이동 무관)
    const imgRect = _imgRect;
    const rx = (Math.min(startX, e.clientX) - imgRect.left) / imgRect.width;
    const ry = (Math.min(startY, e.clientY) - imgRect.top)  / imgRect.height;
    const rw = Math.abs(e.clientX - startX) / imgRect.width;
    const rh = Math.abs(e.clientY - startY) / imgRect.height;

    cleanup();
    if (rw < 0.01 || rh < 0.01) { showToast('영역이 너무 작습니다'); return; }

    const region = {
      x: Math.max(0, rx), y: Math.max(0, ry),
      w: Math.min(1 - Math.max(0, rx), rw),
      h: Math.min(1 - Math.max(0, ry), rh),
    };

    showToast('블러 처리 중...');
    chrome.runtime.sendMessage({
      type: 'APPLY_BLUR',
      stepNumber: step.stepNumber,
      region,
    }, async (res) => {
      void chrome.runtime.lastError;
      if (!res?.ok) { showToast('블러 처리 실패'); return; }

      const newBlob = await idbGetScreenshot(step.stepNumber);
      if (newBlob) {
        const newSrc = URL.createObjectURL(newBlob);
        _thumbObjectUrls.push(newSrc);
        // 줌 오버레이 갱신
        zoomImg.src = newSrc;
        const zoomOverlay = document.getElementById('thumbZoomOverlay');
        if (zoomOverlay) { zoomOverlay._blob = newBlob; zoomOverlay._zoomUrl = newSrc; }
        // 스텝 카드 썸네일도 즉시 갱신
        const card = stepsList.querySelector(`.step-card[data-step-id="${step.id}"]`);
        if (card) {
          const cardImg = card.querySelector('.step-thumb img');
          if (cardImg) cardImg.src = newSrc;
        }
      }
      showToast('블러 처리 완료 ✓');
    });
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      dragging = false; sel.style.display = 'none'; cleanup(); showToast('취소됨');
    }
  }

  function cleanup() {
    zoomImg.dataset.blurMode = '';
    zoomImg.style.cursor = '';
    if (blurBtn) blurBtn.classList.remove('active');
    sel.remove();
    window.removeEventListener('mousedown', onMouseDown, true);
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('mouseup',   onMouseUp,   true);
    window.removeEventListener('keydown',   onKeyDown,   true);
  }

  zoomImg.style.cursor = 'crosshair';
  // capture phase로 등록해서 다른 핸들러보다 먼저 처리
  window.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('mouseup',   onMouseUp,   true);
  window.addEventListener('keydown',   onKeyDown,   true);
}

// 간단 토스트 (경량 버전)
let _toastTimer = null;
function showToast(msg, ms = 2000) {
  let toast = document.getElementById('mimicToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'mimicToast';
    toast.style.cssText = [
      'position:fixed', 'bottom:72px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(30,30,46,0.92)', 'color:#fff',
      'font-size:12px', 'font-weight:600',
      'padding:8px 16px', 'border-radius:20px',
      'pointer-events:none', 'z-index:99999',
      'white-space:nowrap', 'box-shadow:0 2px 12px rgba(0,0,0,0.3)',
      'transition:opacity 0.2s',
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, ms);
}

// ── IndexedDB 읽기 (팝업 컨텍스트) ──────────────────────────────
function idbGetScreenshot(stepNumber) {
  return new Promise((resolve) => {
    const req = indexedDB.open('mimic_screenshots', 1);
    req.onsuccess = (e) => {
      const db  = e.target.result;
      const tx  = db.transaction('screenshots', 'readonly');
      const get = tx.objectStore('screenshots').get(stepNumber);
      get.onsuccess = () => { db.close(); resolve(get.result ?? null); };
      get.onerror   = () => { db.close(); resolve(null); };
    };
    req.onerror = () => resolve(null);
  });
}

// ── 녹화 차단 페이지 감지 ────────────────────────────────────────
function isBlockedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('data:') ||
    url.startsWith('file://')
  );
}

function showBlockedBanner() {
  let banner = document.getElementById('blockedBanner');
  if (banner) return;
  banner = document.createElement('div');
  banner.id = 'blockedBanner';
  Object.assign(banner.style, {
    background: '#FEE2E2', color: '#991B1B',
    fontSize: '12px', padding: '10px 16px',
    lineHeight: '1.5',
    borderBottom: '1px solid #FECACA',
  });
  const strong = document.createElement('strong');
  strong.textContent = '이 페이지는 녹화를 차단하고 있습니다.';
  const br = document.createElement('br');
  const sub = document.createTextNode('일반 웹페이지(http/https)로 이동한 후 다시 시도해 주세요.');
  banner.append(strong, br, sub);
  document.body.insertBefore(banner, document.body.firstChild);
}

function hideBlockedBanner() {
  document.getElementById('blockedBanner')?.remove();
}

// ── 녹화 시작 공통 함수 ──────────────────────────────────────────
async function startRecording() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const targetTab = tabs.find(t => t.url?.startsWith('http://') || t.url?.startsWith('https://'));

  if (!targetTab || isBlockedUrl(targetTab.url)) {
    showBlockedBanner();
    return;
  }
  hideBlockedBanner();

  isRecording  = true;
  isPaused     = false;

  const sessionId = crypto.randomUUID();

  // 1) targetTabId 먼저 저장 → background _cachedTargetTabId 갱신 보장
  await storageSet({ targetTabId: targetTab.id });

  // 2) 나머지 상태 저장
  await storageSet({ sessionId, stepNumber: 0, steps: [] });

  // 3) isRecording:true → background onChanged가 단일 경로로 START_RECORDING 전달
  chrome.storage.local.set({ isRecording: true });

  updateView();
  renderSteps([]);
}

// ── 녹화 시작 버튼 ───────────────────────────────────────────────
btnStart.addEventListener('click', () => startRecording());

// ── 전체 페이지 캡처 (녹화와 별개 단독 기능) ─────────────────────
const btnFullPage = document.getElementById('btnFullPage');
btnFullPage?.addEventListener('click', () => {
  btnFullPage.disabled = true;
  showToast('전체 페이지 캡처 중... 탭을 조작하지 마세요', 60000);
  chrome.runtime.sendMessage({ type: 'FULL_PAGE_CAPTURE' }, (res) => {
    void chrome.runtime.lastError;
    btnFullPage.disabled = false;
    if (res?.ok) showToast('전체 페이지 캡처 완료 — 다운로드됨 ✓', 3000);
    else showToast(res?.error || '캡처 실패', 3000);
  });
});

// ── 일시정지 / 재개 ───────────────────────────────────────────────
btnPause.addEventListener('click', () => {
  isPaused = !isPaused;
  chrome.storage.local.set({ isPaused });
  updateView();
});

// ── 수동 캡처 ────────────────────────────────────────────────────
// background가 직접 캡처(activate→hide→PII→capture→restore)하므로
// content의 isRecording 상태와 무관하게 동작한다 (#6).
function triggerManualCapture() {
  if (btnSnapBottom) btnSnapBottom.disabled = true;
  chrome.runtime.sendMessage({ type: 'MANUAL_CAPTURE' }, (res) => {
    void chrome.runtime.lastError;
    if (btnSnapBottom) btnSnapBottom.disabled = false;
    if (!res?.ok) showToast('캡처 실패 — 페이지를 확인해주세요');
  });
}

btnSnapBottom?.addEventListener('click', triggerManualCapture);

// ── 실행취소 ─────────────────────────────────────────────────────
btnUndo.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'UNDO_STEP' }, () => { void chrome.runtime.lastError; });
});

// ── 블러 도구 — 마지막 스텝 이미지를 줌 오버레이에 열고 블러 모드 진입 ─
btnBlurTool?.addEventListener('click', async () => {
  const { steps } = await storageGet('steps');
  if (!steps || steps.length === 0) { showToast('블러할 스텝이 없습니다'); return; }
  const lastStep = steps[steps.length - 1];

  const zoomOverlay = document.getElementById('thumbZoomOverlay');
  const zoomImg     = document.getElementById('thumbZoomImg');
  if (!zoomOverlay || !zoomImg) return;

  let blob = await idbGetScreenshot(lastStep.stepNumber);
  if (blob) {
    const blobSrc = URL.createObjectURL(blob);
    _thumbObjectUrls.push(blobSrc);
    zoomImg.src = blobSrc;
    zoomOverlay.dataset.imageUrl = '';
    zoomOverlay._zoomUrl = blobSrc;
  } else if (lastStep.imageUrl) {
    // IndexedDB에 없으면 imageUrl로 표시 (APPLY_BLUR에서 fetch 처리)
    zoomImg.src = lastStep.imageUrl;
    zoomOverlay.dataset.imageUrl = lastStep.imageUrl;
  } else {
    showToast('이미지를 불러올 수 없습니다'); return;
  }
  zoomOverlay._step = lastStep;
  zoomOverlay._blob = blob;
  zoomOverlay.classList.add('open');

  // 오버레이가 렌더된 후 블러 모드 진입
  requestAnimationFrame(() => startBlurMode(lastStep, zoomImg, blob));
});

// ── 중지 (저장 없이) ─────────────────────────────────────────────
btnDiscard.addEventListener('click', async () => {
  isRecording = false;
  isPaused    = false;
  hideCaptureBlockedToast();
  // 서버 staging(mm_capture_events + Storage 이미지) 정리 — sessionId는 지우기 전에 확보
  const { sessionId } = await storageGet('sessionId');
  if (sessionId) {
    chrome.runtime.sendMessage({ type: 'DISCARD_SESSION', sessionId }, () => { void chrome.runtime.lastError; });
  }
  chrome.runtime.sendMessage({ type: 'CLEAR_STEPS' }, () => { void chrome.runtime.lastError; });
  // isRecording: false 먼저 세팅 → background가 targetTabId로 STOP_RECORDING 전송
  storageSet({ isRecording: false }).then(() => {
    chrome.storage.local.remove(['targetTabId', 'steps', 'stepNumber', 'sessionId']);
  });
  updateView();
  renderSteps([]);
});

// ── 완료 및 편집 ─────────────────────────────────────────────────
btnFinish.addEventListener('click', async () => {
  btnFinish.disabled = true;

  // steps는 storage에서 지우기 전에 읽어 살아남은 stepNumber 목록을 확보
  const { sessionId, steps } = await storageGet(['sessionId', 'steps']);
  const stepNumbers = (steps || []).map(s => s.stepNumber).filter(n => n > 0);

  // 패널에 남은 스텝이 없으면 finalize 중단 — 빈 목록을 보내면 서버 필터가
  // 비활성화되어 삭제했던 이벤트 전체가 매뉴얼에 포함되는 사고가 난다.
  if (stepNumbers.length === 0) {
    showToast('남은 스텝이 없습니다 — 캡처 후 완료해주세요', 3000);
    btnFinish.disabled = false;
    return;
  }

  isPaused    = false;
  hideCaptureBlockedToast();

  // isRecording: false 먼저 세팅 → background가 targetTabId로 STOP_RECORDING 전송
  storageSet({ isRecording: false }).then(() => {
    chrome.storage.local.remove(['targetTabId', 'lastStepHash']);
  });

  // 매뉴얼 생성 중 — 사용자 대기 UI
  showFinalizingOverlay();

  // 매뉴얼 상세 탭은 background가 연다 — 패널/탭이 닫혀도 생성 완료 후 정상 이동
  chrome.runtime.sendMessage({ type: 'FINALIZE_SESSION', sessionId, stepNumbers }, (res) => {
    const runtimeError = chrome.runtime.lastError?.message;
    hideFinalizingOverlay();
    btnFinish.disabled = false;  // window.close() 실패해도 버튼 항상 재활성화
    if (res?.ok && res?.tutorial_id) {
      isRecording = false;
      updateView();
      renderSteps([]);             // window.close() 실패해도 성공 시에만 스텝 목록 초기화
      showToast('매뉴얼이 생성되었습니다! 매뉴얼 페이지가 열립니다.', 2500);
      window.close();
    } else {
      // 실패 시 에러 안내
      showFinalizingError(res?.error || runtimeError);
    }
  });
});

// ── 매뉴얼 생성 중 오버레이 ──────────────────────────────────────
function showFinalizingOverlay() {
  let ov = document.getElementById('finalizingOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'finalizingOverlay';
    ov.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9000',
      'background:rgba(255,255,255,0.97)',
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'gap:16px',
    ].join(';');

    const spinner = document.createElement('div');
    spinner.style.cssText = [
      'width:40px', 'height:40px', 'border-radius:50%',
      'border:3px solid rgba(79,70,229,0.18)',
      'border-top-color:#4F46E5',
      'animation:popupSpin 0.9s linear infinite',
    ].join(';');

    const msg = document.createElement('p');
    msg.id = 'finalizingMsg';
    msg.style.cssText = 'font-size:14px;font-weight:600;color:#1F2937;margin:0;';
    msg.textContent = '매뉴얼을 생성하고 있습니다...';

    const sub = document.createElement('p');
    sub.style.cssText = 'font-size:12px;color:#6B7280;margin:0;';
    sub.textContent = 'AI 분석 중 — 잠시만 기다려 주세요';

    const style = document.createElement('style');
    style.textContent = '@keyframes popupSpin { to { transform: rotate(360deg); } }';

    ov.append(style, spinner, msg, sub);
    document.body.appendChild(ov);
  }
  // 에러 상태 초기화
  const msgEl = document.getElementById('finalizingMsg');
  if (msgEl) msgEl.textContent = '매뉴얼을 생성하고 있습니다...';
  ov.style.display = 'flex';
}

function hideFinalizingOverlay() {
  const ov = document.getElementById('finalizingOverlay');
  if (ov) ov.style.display = 'none';
}

function showFinalizingError(detail) {
  const ov = document.getElementById('finalizingOverlay');
  if (!ov) return;

  ov.replaceChildren();
  ov.style.display = 'flex';
  const icon = document.createElement('div');
  icon.style.cssText = 'font-size:32px;';
  icon.textContent = '⚠️';

  const msg = document.createElement('p');
  msg.style.cssText = 'font-size:14px;font-weight:600;color:#1F2937;margin:0;text-align:center;';
  msg.textContent = '생성 실패 — 다시 시도해주세요';

  const sub = document.createElement('p');
  sub.style.cssText = 'font-size:12px;color:#6B7280;margin:0;text-align:center;max-width:280px;line-height:1.4;';
  sub.textContent = detail || '네트워크 연결을 확인하고 다시 시도해 주세요';

  const btn = document.createElement('button');
  btn.style.cssText = [
    'margin-top:4px', 'padding:8px 20px',
    'background:#4F46E5', 'color:#fff',
    'border:none', 'border-radius:8px',
    'font-size:13px', 'font-weight:600', 'cursor:pointer',
  ].join(';');
  btn.textContent = '닫기';
  btn.addEventListener('click', hideFinalizingOverlay);

  ov.append(icon, msg, sub, btn);
}

// ── storage 변경 감지 ─────────────────────────────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.steps) {
    renderSteps(changes.steps.newValue || []);
  }
  if (changes.isPaused) {
    isPaused = !!changes.isPaused.newValue;
    updateView();
  }
  if (changes.isRecording && !!changes.isRecording.newValue !== isRecording) {
    isRecording = !!changes.isRecording.newValue;
    updateView();
  }
  if (changes.extensionToken) {
    updateLoginState(!!changes.extensionToken.newValue);
  }
});

// ── background → popup 메시지 수신 ───────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  // 토큰 만료: 버튼 비활성화 + 재연동 안내
  if (msg.type === 'TOKEN_EXPIRED') {
    isRecording = false;
    isPaused    = false;
    updateView();
    renderSteps([]);
    updateLoginState(false, true); // expired=true → 빨간 안내
    return;
  }

  // 캡처 차단 (DRM/보안 페이지) — 수동 업로드 토스트 표시
  if (msg.type === 'CAPTURE_BLOCKED') {
    showCaptureBlockedToast(msg.stepData);
    return;
  }

  // 업로드 실패 — 사용자에게 토스트 알림
  if (msg.type === 'UPLOAD_FAILED') {
    showToast('이미지 업로드 실패 — 다시 시도해주세요', 3500);
    return;
  }

  // 실시간 타이핑 반영
  // content.js → background.js → popup.js 경로로 전달된 입력값을
  // 마지막 스텝 카드의 타이핑 미리보기에 표시
  if (msg.type !== 'TYPING_PROGRESS') return;

  // 현재 진행 중인 입력 스텝 카드 찾기 (마지막 카드)
  let liveCard = document.querySelector('.step-card.live-typing');

  if (!liveCard) {
    // 마지막 카드를 live-typing으로 지정
    const cards = document.querySelectorAll('.step-card');
    if (cards.length === 0) return;
    liveCard = cards[cards.length - 1];
    liveCard.classList.add('live-typing');
  }

  const preview = liveCard.querySelector('.step-typing-preview');
  const labelEl = liveCard.querySelector('.step-action-label');
  const value   = msg.text  || '';
  const label   = msg.label || '';
  const masked  = !!msg.masked;

  if (preview) {
    if (masked) {
      preview.style.display = 'none';
    } else if (value) {
      preview.textContent = `"${value}"`;
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
  }
  if (labelEl) {
    if (masked) {
      labelEl.textContent = '비밀번호 입력 중...';
    } else {
      const fieldName = label || '텍스트';
      labelEl.textContent = value
        ? `${fieldName}: ${value.slice(0, 28)}${value.length > 28 ? '…' : ''}`
        : `${fieldName} 입력 중...`;
    }
  }
});

// ── 캡처 차단 토스트 ─────────────────────────────────────────────
// DRM/보안 페이지에서 captureVisibleTab이 검은 화면을 반환했을 때
// 사용자에게 수동 업로드 또는 클립보드 붙여넣기 옵션을 제시한다.
let _blockedStepData = null;

function showCaptureBlockedToast(stepData) {
  _blockedStepData = stepData || null;
  const toast = document.getElementById('captureBlockedToast');
  if (!toast) return;
  toast.style.display = 'block';
}

function hideCaptureBlockedToast() {
  const toast = document.getElementById('captureBlockedToast');
  if (toast) toast.style.display = 'none';
  _blockedStepData = null;
}

// 파일 선택 또는 클립보드에서 받은 이미지 Blob을 수동 스텝으로 처리
// stepNumber는 background가 storage 기준으로 단일 결정하므로 여기서는 포함하지 않음
async function handleManualImage(blob) {
  hideCaptureBlockedToast();
  if (!blob || !isRecording) return;

  const stepData = _blockedStepData || {};
  const reader = new FileReader();
  reader.onloadend = () => {
    chrome.runtime.sendMessage({
      type: 'MANUAL_IMAGE_STEP',
      dataUrl:  reader.result,
      stepData: {
        url:          stepData.url || '',
        timestamp:    Date.now(),
        clickX:       0,
        clickY:       0,
        windowWidth:  stepData.windowWidth  || 1280,
        windowHeight: stepData.windowHeight || 800,
        manual:       true,
        actionInfo:   { type: 'click', label: '수동 캡처 (차단된 페이지)' },
      },
    }, () => { void chrome.runtime.lastError; });
  };
  reader.readAsDataURL(blob);
}

// 파일 input 핸들러
document.getElementById('blockedFileInput')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handleManualImage(file);
  e.target.value = '';
});

// 클립보드 붙여넣기 버튼 핸들러
document.getElementById('blockedPasteBtn')?.addEventListener('click', async () => {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find(t => t.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        await handleManualImage(blob);
        return;
      }
    }
    // 클립보드에 이미지가 없으면 안내
    alert('클립보드에 이미지가 없습니다.\nWin+Shift+S 또는 PrtSc로 스크린샷을 찍은 후 시도하세요.');
  } catch {
    alert('클립보드 접근 권한이 필요합니다.\n이미지 파일을 직접 업로드해 주세요.');
  }
});

// 무시 버튼
document.getElementById('blockedDismissBtn')?.addEventListener('click', hideCaptureBlockedToast);

// ── 유틸 ─────────────────────────────────────────────────────────
function truncateUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 28 ? u.pathname.slice(0, 28) + '...' : u.pathname;
    return u.hostname + path;
  } catch { return url.slice(0, 45); }
}

function formatTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

// ── Guide Me 뷰 ──────────────────────────────────────────────────
const viewGuide       = document.getElementById('viewGuide');
const guideExitBtn    = document.getElementById('guideExitBtn');
const guidePrevBtn    = document.getElementById('guidePrevBtn');
const guideNextBtn    = document.getElementById('guideNextBtn');
const guideStepLabel  = document.getElementById('guideStepLabel');
const guidePctLabel   = document.getElementById('guidePctLabel');
const guideProgressBar = document.getElementById('guideProgressBar');
const guideStepTitle  = document.getElementById('guideStepTitle');
const guideStepInstr  = document.getElementById('guideStepInstruction');
const guideStepDots   = document.getElementById('guideStepDots');

let guideSteps = [];
let guideCurrentStep = 0;

// Live Guide는 녹화 UI와 완전히 분리해 단독으로 보이게 한다 —
// 헤더(스텝 카운트·전체캡처·설정), '캡처된 스텝' 목록, 하단 액션 바를 모두 숨긴다.
function setRecorderChromeHidden(hidden) {
  const disp = hidden ? 'none' : '';
  document.querySelectorAll('.header, .divider, .steps-header').forEach(el => { el.style.display = disp; });
  if (stepsList) stepsList.style.display = disp;
  const bar = document.getElementById('bottomActionBar');
  if (bar && hidden) bar.style.display = 'none';  // 표시는 updateView가 녹화 상태에 맞게 복원
}

function showGuideView() {
  viewIdle.style.display      = 'none';
  viewRecording.style.display = 'none';
  setRecorderChromeHidden(true);   // 녹화 모드 UI 전부 숨김 → Live Guide 단독
  viewGuide.style.display = 'flex';
}

function hideGuideView() {
  viewGuide.style.display = 'none';
  setRecorderChromeHidden(false);  // 녹화 UI 복원
  // 녹화 상태에 맞게 원래 뷰로 복원
  updateView();
}

function renderGuideStep(steps, idx) {
  const step = steps[idx];
  if (!step) return;

  const total = steps.length;
  const num   = idx + 1;
  const pct   = Math.round((num / total) * 100);

  guideStepLabel.textContent    = `Step ${num} / ${total}`;
  guidePctLabel.textContent     = `${pct}%`;
  guideProgressBar.style.width  = `${pct}%`;
  guideStepTitle.textContent    = step.title || `Step ${num}`;
  guideStepInstr.textContent    = step.instruction || '';

  // 스텝 스크린샷
  const imgEl = document.getElementById('guideStepImage');
  if (imgEl) {
    if (step.screenshot_url) {
      imgEl.src = step.screenshot_url;
      imgEl.style.display = 'block';
    } else {
      imgEl.style.display = 'none';
    }
  }

  // type_text 복사 영역
  const copyArea    = document.getElementById('guideStepCopyArea');
  const copyContent = document.getElementById('guideStepCopyContent');
  if (copyArea && copyContent) {
    if (step.type_text) {
      copyContent.textContent  = step.type_text;
      copyArea.style.display   = 'flex';
    } else {
      copyArea.style.display   = 'none';
    }
  }

  guidePrevBtn.disabled         = idx === 0;
  guidePrevBtn.style.opacity    = idx === 0 ? '0.4' : '1';
  guidePrevBtn.style.cursor     = idx === 0 ? 'not-allowed' : 'pointer';

  const isLast = idx === total - 1;
  guideNextBtn.textContent      = isLast ? '완료 ✓' : '다음 →';

  // 스텝 도트 렌더
  guideStepDots.replaceChildren();
  steps.forEach((_, i) => {
    const dot = document.createElement('div');
    const done = i < idx;
    const curr = i === idx;
    Object.assign(dot.style, {
      width: curr ? '28px' : '22px',
      height: '22px',
      borderRadius: '11px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '10px',
      fontWeight: '700',
      cursor: 'pointer',
      transition: 'all 0.15s',
      background: done ? '#10B981' : curr ? '#4F46E5' : '#f0f0f8',
      color: (done || curr) ? '#fff' : '#bbb',
    });
    dot.textContent = done ? '✓' : i + 1;
    dot.addEventListener('click', () => {
      guideCurrentStep = i;
      chrome.storage.local.set({ guideCurrentStep: i });
      renderGuideStep(guideSteps, i);
      chrome.runtime.sendMessage({ type: 'SHOW_OVERLAY_FOR_STEP', stepIndex: i }, () => {
        void chrome.runtime.lastError;
      });
    });
    guideStepDots.appendChild(dot);
  });
}

document.getElementById('guideStepCopyBtn')?.addEventListener('click', () => {
  const text = document.getElementById('guideStepCopyContent')?.textContent;
  const btn  = document.getElementById('guideStepCopyBtn');
  if (!text || !btn) return;
  navigator.clipboard.writeText(text)
    .then(() => { btn.textContent = '✓'; setTimeout(() => { if (btn.isConnected) btn.textContent = '복사'; }, 1500); })
    .catch(() => {});
});

guideExitBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'EXIT_GUIDE' }, () => {
    void chrome.runtime.lastError;
    guideSteps = [];
    guideCurrentStep = 0;
    hideGuideView();
  });
});

guidePrevBtn.addEventListener('click', () => {
  if (guideCurrentStep <= 0) return;
  chrome.runtime.sendMessage({ type: 'GUIDE_PREV' }, (res) => {
    if (res?.ok) {
      guideCurrentStep = res.currentStep;
      renderGuideStep(guideSteps, guideCurrentStep);
    }
  });
});

guideNextBtn.addEventListener('click', () => {
  const isLast = guideCurrentStep >= guideSteps.length - 1;
  if (isLast) {
    // 가이드 완료
    chrome.runtime.sendMessage({ type: 'EXIT_GUIDE' }, () => {
      void chrome.runtime.lastError;
      guideSteps = [];
      guideCurrentStep = 0;
      hideGuideView();
    });
    return;
  }
  chrome.runtime.sendMessage({ type: 'GUIDE_NEXT' }, (res) => {
    if (res?.ok) {
      guideCurrentStep = res.currentStep;
      renderGuideStep(guideSteps, guideCurrentStep);
    }
  });
});

// Guide Me 활성화 여부 초기 체크 (사이드패널이 열릴 때)
// background가 고정 탭 생존을 검증 — 탭이 닫힌 유령 상태면 정리되고 active:false가 와서 안 뜬다.
chrome.runtime.sendMessage({ type: 'GUIDE_VALIDATE' }, (r) => {
  void chrome.runtime.lastError;
  if (r?.active && r.steps?.length > 0) {
    guideSteps = r.steps;
    guideCurrentStep = r.currentStep || 0;
    showGuideView();
    renderGuideStep(guideSteps, guideCurrentStep);
  }
});

// storage 변화 감지: START_GUIDE 이후 guideModeActive가 세팅되면 Guide Me 뷰로 전환
chrome.storage.onChanged.addListener((changes) => {
  if (changes.guideModeActive?.newValue === true) {
    storageGet(['guideSteps', 'guideCurrentStep']).then((r) => {
      guideSteps = r.guideSteps || [];
      guideCurrentStep = r.guideCurrentStep || 0;
      if (guideSteps.length > 0) {
        showGuideView();
        renderGuideStep(guideSteps, guideCurrentStep);
      }
    });
  }
  if (changes.guideModeActive?.newValue === undefined && changes.guideModeActive?.oldValue) {
    hideGuideView();
  }
  // 오버레이에서 스텝 이동 시 사이드패널 동기화
  if (changes.guideCurrentStep !== undefined && guideSteps.length > 0) {
    const idx = changes.guideCurrentStep.newValue;
    if (idx !== undefined && idx !== guideCurrentStep) {
      guideCurrentStep = idx;
      renderGuideStep(guideSteps, guideCurrentStep);
    }
  }
});

// guide-engine.js → 긴 텍스트 즉시입력 후 복사 힌트 표시
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_COPY_HINT' && msg.text) {
    const copyContent = document.getElementById('guideStepCopyContent');
    const copyArea    = document.getElementById('guideStepCopyArea');
    if (copyContent && copyArea) {
      copyContent.textContent = msg.text;
      copyArea.style.display  = 'flex';
    }
  }
});

// ── 로고 더블클릭 → 디버그 패널 ─────────────────────────────────
document.getElementById('logoArea')?.addEventListener('dblclick', () => openDebugPanel());

// ── 디버그 로그 뷰어 ─────────────────────────────────────────────
const debugPanel    = document.getElementById('debugPanel');
const debugLogList  = document.getElementById('debugLogList');
const btnDebugClose = document.getElementById('btnDebugClose');
const btnDebugCopy  = document.getElementById('btnDebugCopy');
const btnDebugClear = document.getElementById('btnDebugClear');

function openDebugPanel() {
  chrome.runtime.sendMessage({ type: 'GET_LOGS' }, (r) => {
    const logs = r?.logs || [];
    renderDebugLogs(logs);
    debugPanel.style.display = 'flex';
  });
}

function renderDebugLogs(logs) {
  if (!debugLogList) return;
  debugLogList.textContent = '';
  if (logs.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:#666;font-size:11px;padding:8px 0;';
    empty.textContent = '로그 없음';
    debugLogList.appendChild(empty);
    return;
  }
  const LEVEL_COLOR = { error: '#f87171', warn: '#fbbf24', info: '#60a5fa', debug: '#9ca3af' };
  logs.slice().reverse().forEach(entry => {
    const d = new Date(entry.t);
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}.${String(d.getMilliseconds()).padStart(3,'0')}`;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;padding:3px 0;border-bottom:1px solid #2a2a3e;font-size:10.5px;line-height:1.4;';

    const tSpan = document.createElement('span');
    tSpan.style.cssText = 'color:#555;flex-shrink:0;font-size:10px;';
    tSpan.textContent = time;

    const lSpan = document.createElement('span');
    lSpan.style.cssText = `color:${LEVEL_COLOR[entry.level] || '#ccc'};flex-shrink:0;font-weight:600;min-width:36px;`;
    lSpan.textContent = entry.level.toUpperCase();

    const sSpan = document.createElement('span');
    sSpan.style.cssText = 'color:#aaa;flex-shrink:0;min-width:48px;';
    sSpan.textContent = `[${entry.source}]`;

    const mSpan = document.createElement('span');
    mSpan.style.cssText = 'color:#e2e2e2;word-break:break-all;';
    mSpan.textContent = entry.msg;

    row.appendChild(tSpan);
    row.appendChild(lSpan);
    row.appendChild(sSpan);
    row.appendChild(mSpan);
    debugLogList.appendChild(row);
  });
}

if (btnDebugClose) btnDebugClose.addEventListener('click', () => { debugPanel.style.display = 'none'; });
if (btnDebugCopy) btnDebugCopy.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'GET_LOGS' }, (r) => {
    const logs = r?.logs || [];
    const text = logs.map(e => `[${new Date(e.t).toISOString()}][${e.level.toUpperCase()}][${e.source}] ${e.msg}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      btnDebugCopy.textContent = '복사됨!';
      setTimeout(() => { btnDebugCopy.textContent = '복사'; }, 1500);
    });
  });
});
if (btnDebugClear) btnDebugClear.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'CLEAR_LOGS' }, () => {
    renderDebugLogs([]);
  });
});

init();
