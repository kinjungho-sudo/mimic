
const viewIdle      = document.getElementById('viewIdle');
const viewRecording = document.getElementById('viewRecording');
const btnStart      = document.getElementById('btnStart');
const btnPause      = document.getElementById('btnPause');
const btnSnap       = document.getElementById('btnSnap');
const btnUndo       = document.getElementById('btnUndo');
const btnBlurTool   = document.getElementById('btnBlurTool');
const btnDiscard    = document.getElementById('btnDiscard');
const btnFinish     = document.getElementById('btnFinish');
const pauseLabel    = document.getElementById('pauseLabel');
const recDot        = document.getElementById('recDot');
const recLabel      = document.getElementById('recLabel');
const recStepCount  = document.getElementById('recStepCount');
const stepCount     = document.getElementById('stepCount');
const stepsList     = document.getElementById('stepsList');
const emptyState    = document.getElementById('emptyState');
const modalOverlay  = document.getElementById('modalOverlay');
const modalClose    = document.getElementById('modalClose');
const modalImg      = document.getElementById('modalImg');
const modalStepNum  = document.getElementById('modalStepNum');
const modalStepTime = document.getElementById('modalStepTime');
const modalTitle    = document.getElementById('modalTitle');
const modalDesc     = document.getElementById('modalDesc');
const uploadOverlay = document.getElementById('uploadOverlay');
const uploadProgressBar = document.getElementById('uploadProgressBar');
const uploadSub     = document.getElementById('uploadSub');
const btnSettings      = document.getElementById('btnSettings');
const settingsOverlay  = document.getElementById('settingsOverlay');
const btnBack          = document.getElementById('btnBack');
const settingHighlight = document.getElementById('settingHighlight');
const settingFlash     = document.getElementById('settingFlash');
const settingCaptureMode = document.getElementById('settingCaptureMode');
const settingQuality   = document.getElementById('settingQuality');
const qualityVal       = document.getElementById('qualityVal');
const settingAutoNav   = document.getElementById('settingAutoNav');
const settingMobileMode = document.getElementById('settingMobileMode');
const settingPiiBlur   = document.getElementById('settingPiiBlur');

let isRecording  = false;
let isPaused     = false;
let isMobileMode = false;

// ── 설정 기본값 ──────────────────────────────────────────────────
const SETTINGS_DEFAULTS = {
  highlight:   true,
  flash:       true,
  captureMode: 'interactive',
  quality:     82,
  autoNav:     true,
  mobileMode:  false,
  piiBlur:     true,
};

// ── 초기화 ───────────────────────────────────────────────────────
function init() {
  chrome.storage.local.get(
    ['isRecording', 'isPaused', 'steps', 'extensionToken', 'settings'],
    (r) => {
      isRecording = !!r.isRecording;
      isPaused    = !!r.isPaused;
      updateView();
      renderSteps(r.steps || []);
      updateLoginState(!!r.extensionToken);
      loadSettingsUI(r.settings || {});
    }
  );
}

// ── 설정 UI 로드 ──────────────────────────────────────────────────
function loadSettingsUI(saved) {
  const s = { ...SETTINGS_DEFAULTS, ...saved };
  settingHighlight.checked      = s.highlight;
  settingFlash.checked          = s.flash;
  settingCaptureMode.value      = s.captureMode;
  settingQuality.value          = s.quality;
  qualityVal.textContent        = s.quality + '%';
  settingAutoNav.checked        = s.autoNav;
  settingMobileMode.checked     = s.mobileMode;
  settingPiiBlur.checked        = s.piiBlur;
}

function saveSettings() {
  const s = {
    highlight:   settingHighlight.checked,
    flash:       settingFlash.checked,
    captureMode: settingCaptureMode.value,
    quality:     Number(settingQuality.value),
    autoNav:     settingAutoNav.checked,
    mobileMode:  settingMobileMode.checked,
    piiBlur:     settingPiiBlur.checked,
  };
  chrome.storage.local.set({ settings: s });
  // content.js에 설정 변경 알림
  chrome.storage.local.get('targetTabId', ({ targetTabId }) => {
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
settingFlash.addEventListener('change',       saveSettings);
settingCaptureMode.addEventListener('change', saveSettings);
settingAutoNav.addEventListener('change',     saveSettings);
settingMobileMode.addEventListener('change',  saveSettings);
settingPiiBlur.addEventListener('change',     saveSettings);
settingQuality.addEventListener('input', () => {
  qualityVal.textContent = settingQuality.value + '%';
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
    chrome.tabs.create({ url: 'https://mimic-nine-ashen.vercel.app/extension-link' });
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
      pauseLabel.textContent = '재개';
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
      pauseLabel.textContent = '일시정지';
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
    // 모바일 배지
    const mobileBadgeEl = document.getElementById('mobileBadge');
    if (mobileBadgeEl) mobileBadgeEl.style.display = isMobileMode ? 'inline-flex' : 'none';
  } else {
    viewIdle.style.display = 'block';
    viewRecording.style.display = 'none';
  }
  // 하단 액션 바: 녹화 중일 때만 표시
  const bar = document.getElementById('bottomActionBar');
  if (bar) bar.style.display = isRecording ? 'flex' : 'none';
}

// ── 스텝 카운트 동기화 ────────────────────────────────────────────
function updateStepCounts(count) {
  const text = `${count} step${count !== 1 ? 's' : ''}`;
  stepCount.textContent = text;
  recStepCount.textContent = text;
}

// ── 스텝 렌더 ────────────────────────────────────────────────────
function renderSteps(steps) {
  stepsList.querySelectorAll('.step-card, .domain-header').forEach((c) => c.remove());
  updateStepCounts(steps.length);
  if (steps.length === 0) {
    emptyState.style.display = 'flex';
    expandedStepId = null;
    return;
  }
  emptyState.style.display = 'none';

  expandedStepId = null;

  const hostnames = new Set(steps.map(s => s.domainInfo?.hostname).filter(Boolean));
  const showDomainHeaders = hostnames.size > 1;

  let lastHostname = null;
  steps.forEach((step, i) => {
    const hostname = step.domainInfo?.hostname ?? null;
    if (showDomainHeaders && hostname && hostname !== lastHostname) {
      stepsList.appendChild(buildDomainHeader(step.domainInfo));
      lastHostname = hostname;
    }
    const card = buildStepCard(step, i + 1);
    // 모든 스텝 썸네일 즉시 펼침
    const tw = card.querySelector('.step-thumb');
    if (tw) tw.style.display = 'block';
    card.classList.add('expanded');
    stepsList.appendChild(card);
  });
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
  name.textContent = domainInfo.name || domainInfo.hostname;

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
  labelEl.textContent = step.actionLabel || step.title || `Step ${num}`;

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

  const thumbImg = document.createElement('img');
  thumbImg.alt = '';
  thumbImg.style.cssText = 'display:none;width:100%;border-radius:5px;display:block;';

  const thumbPlaceholder = document.createElement('div');
  thumbPlaceholder.className = 'step-thumb-placeholder';
  thumbPlaceholder.textContent = '로딩 중...';

  // ── 클릭포인트 + 하이라이트 오버레이 ─────────────────────────
  const thumbOverlay = document.createElement('div');
  thumbOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;border-radius:5px;overflow:hidden;';

  thumbWrap.append(thumbImg, thumbPlaceholder, thumbOverlay);

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

  return card;
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
      placeholder.style.display = 'none';
      // 전체 스크린샷 위에 클릭포인트/하이라이트 오버레이 렌더
      if (overlayEl) renderThumbOverlay(overlayEl, imgEl, step, null);
    } else {
      placeholder.textContent = '이미지 없음';
    }
  } catch {
    placeholder.textContent = '이미지 없음';
  }
}

// elementRect(0~1 정규화)를 기준으로 Blob 이미지를 크롭해 반환
// 패딩 5%(정규화), 전체의 70% 이상이면 원본 반환
async function cropToElement(blob, elementRect) {
  if (!elementRect) return null;
  const { x, y, width, height } = elementRect;
  if (width < 0.002 || height < 0.002) return null;

  const PAD = 0.06; // 정규화 패딩 6%
  const sx_n = Math.max(0, x - PAD);
  const sy_n = Math.max(0, y - PAD);
  const sw_n = Math.min(1 - sx_n, width  + PAD * 2);
  const sh_n = Math.min(1 - sy_n, height + PAD * 2);

  if (sw_n * sh_n > 0.70) return null; // 전체의 70% 이상이면 크롭 불필요

  const bmp = await createImageBitmap(blob);
  const iw = bmp.width, ih = bmp.height;
  const sx = Math.round(sx_n * iw);
  const sy = Math.round(sy_n * ih);
  const sw = Math.min(iw - sx, Math.round(sw_n * iw));
  const sh = Math.min(ih - sy, Math.round(sh_n * ih));

  const canvas = new OffscreenCanvas(sw, sh);
  canvas.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
}

// 썸네일 위에 클릭포인트(빨간 원) + 하이라이트 박스 오버레이 렌더
// 전체 스크린샷 기준 좌표 사용 (크롭 없음)
function renderThumbOverlay(overlayEl, imgEl, step, _unused) {
  overlayEl.replaceChildren();
  const er = step.elementRect;

  // 하이라이트 박스
  if (er && er.width > 0.002 && er.height > 0.002) {
    const hl = document.createElement('div');
    hl.style.cssText = [
      'position:absolute', 'box-sizing:border-box', 'pointer-events:none',
      `left:${er.x * 100}%`, `top:${er.y * 100}%`,
      `width:${er.width * 100}%`, `height:${er.height * 100}%`,
      'border:2px solid #F59E0B',
      'background:rgba(255,200,0,0.15)',
      'border-radius:4px',
    ].join(';');
    overlayEl.appendChild(hl);
  }

  // 클릭 포인트
  const cx = step.click_x, cy = step.click_y;
  if (cx != null && cy != null && (cx > 0 || cy > 0) && cx >= 0 && cx <= 1 && cy >= 0 && cy <= 1) {
    renderClickDot(overlayEl, cx, cy);

    // 클릭 위치 확대경 박스 (우하단 코너)
    renderZoomInset(overlayEl, imgEl, cx, cy);
  }
}

// 클릭 위치 주변을 확대해서 우하단에 인셋으로 표시
function renderZoomInset(overlayEl, imgEl, cx, cy) {
  const INSET_SIZE = 80;  // px (인셋 박스 크기)
  const ZOOM_RADIUS = 0.12; // 원본 이미지에서 확대할 영역 반경 (정규화)

  const canvas = document.createElement('canvas');
  canvas.width  = INSET_SIZE;
  canvas.height = INSET_SIZE;
  canvas.style.cssText = [
    'position:absolute', 'bottom:6px', 'right:6px',
    `width:${INSET_SIZE}px`, `height:${INSET_SIZE}px`,
    'border-radius:8px',
    'border:2px solid #fff',
    'box-shadow:0 2px 8px rgba(0,0,0,0.4)',
    'pointer-events:none',
    'background:#000',
  ].join(';');

  overlayEl.appendChild(canvas);

  // imgEl이 로드된 후 렌더
  function drawInset() {
    if (imgEl.naturalWidth === 0) return;
    const iw = imgEl.naturalWidth;
    const ih = imgEl.naturalHeight;

    const sx = Math.max(0, (cx - ZOOM_RADIUS) * iw);
    const sy = Math.max(0, (cy - ZOOM_RADIUS) * ih);
    const sw = Math.min(iw - sx, ZOOM_RADIUS * 2 * iw);
    const sh = Math.min(ih - sy, ZOOM_RADIUS * 2 * ih);

    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, INSET_SIZE, INSET_SIZE);

    // 중앙 클릭 포인트 표시
    const dotX = INSET_SIZE / 2;
    const dotY = INSET_SIZE / 2;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239,68,68,0.9)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 외부 링
    ctx.beginPath();
    ctx.arc(dotX, dotY, 12, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(239,68,68,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (imgEl.complete && imgEl.naturalWidth > 0) {
    drawInset();
  } else {
    imgEl.addEventListener('load', drawInset, { once: true });
  }
}

function renderClickDot(overlayEl, nx, ny) {
  const dot = document.createElement('div');
  dot.style.cssText = [
    'position:absolute', 'pointer-events:none',
    'width:14px', 'height:14px', 'border-radius:50%',
    'background:rgba(239,68,68,0.9)',
    'border:2px solid #fff',
    'box-shadow:0 0 0 3px rgba(239,68,68,0.35)',
    'transform:translate(-50%,-50%)',
    `left:${nx * 100}%`, `top:${ny * 100}%`,
  ].join(';');
  overlayEl.appendChild(dot);
}

// 줌 오버레이 닫기
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
  const blob        = zoomOverlay?._blob;
  if (!zoomImg || !step || !blob) return;
  startBlurMode(step, zoomImg, blob);
});

// 새 탭에서 원본 열기 — imageUrl(Supabase) 우선, 없으면 현재 objectURL
document.getElementById('thumbZoomNewTab')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const overlay = document.getElementById('thumbZoomOverlay');
  const src = overlay?.dataset.imageUrl || document.getElementById('thumbZoomImg')?.src;
  if (src) chrome.tabs.create({ url: src });
});

// ── 드래그 블러 (줌 오버레이 기준) ──────────────────────────────
function startBlurMode(step, zoomImg, originalBlob) {
  if (zoomImg.dataset.blurMode === '1') return;
  zoomImg.dataset.blurMode = '1';

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
    const imgRect = zoomImg.getBoundingClientRect();
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

// 간단 토스트 (기존 restoreToast와 별개의 경량 버전)
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

// ── 모달 ─────────────────────────────────────────────────────────
let _modalObjectUrl = null;

async function openModal(step, num) {
  // 이전 objectURL 해제
  if (_modalObjectUrl) { URL.revokeObjectURL(_modalObjectUrl); _modalObjectUrl = null; }

  modalImg.src = '';
  modalStepNum.textContent  = `Step ${num}`;
  modalStepTime.textContent = formatTime(step.timestamp);
  modalTitle.textContent    = step.title || `Step ${num}`;
  modalDesc.textContent     = step.description || '';
  modalOverlay.classList.add('open');

  // IndexedDB 우선, 없으면 imageUrl(Supabase) fallback
  const blob = await idbGetScreenshot(step.stepNumber);
  if (blob) {
    _modalObjectUrl = URL.createObjectURL(blob);
    modalImg.src = _modalObjectUrl;
  } else if (step.imageUrl) {
    modalImg.src = step.imageUrl;
  }
}
modalImg.addEventListener('click', () => {
  const src = modalImg.src;
  if (src && !src.startsWith('blob:')) chrome.tabs.create({ url: src });
});
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
function closeModal() {
  modalOverlay.classList.remove('open');
  modalImg.src = '';
  if (_modalObjectUrl) { URL.revokeObjectURL(_modalObjectUrl); _modalObjectUrl = null; }
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
async function startRecording(mobile = false) {
  const tabs = await chrome.tabs.query({ active: true });
  const targetTab = tabs.find(t => t.url?.startsWith('http://') || t.url?.startsWith('https://'));

  if (!targetTab || isBlockedUrl(targetTab.url)) {
    showBlockedBanner();
    return;
  }
  hideBlockedBanner();

  isMobileMode = mobile;
  isRecording  = true;
  isPaused     = false;

  const sessionId = crypto.randomUUID();
  // targetTabId를 먼저 저장해 background.js 캐시가 갱신된 뒤 isRecording을 세팅
  await new Promise((resolve) => chrome.storage.local.set({ targetTabId: targetTab.id }, resolve));
  await chrome.storage.local.set({
    isRecording: true,
    sessionId,
    stepNumber: 0,
    steps: [],
    isMobileMode: mobile,
  });

  // background.js의 storage.onChanged 경로와 별개로 content.js에 직접 전송 —
  // 두 경로 중 먼저 도착한 것이 카운트다운을 트리거하고, 이미 녹화 중이면 무시됨
  chrome.tabs.sendMessage(targetTab.id, { type: 'START_RECORDING' }, () => {
    void chrome.runtime.lastError;
  });

  updateView();
  renderSteps([]);
}

// ── 녹화 시작 버튼 ───────────────────────────────────────────────
// 설정의 mobileMode가 켜져 있으면 안내 모달 먼저 표시
btnStart.addEventListener('click', () => {
  const mobile = settingMobileMode.checked;
  if (mobile) {
    document.getElementById('mobileModal').classList.add('open');
  } else {
    startRecording(false);
  }
});

// ── 모바일 안내 모달 이벤트 ──────────────────────────────────────
const mobileModal     = document.getElementById('mobileModal');
const btnMobileReady  = document.getElementById('btnMobileReady');
const btnMobileCancel = document.getElementById('btnMobileCancel');
const restoreToast    = document.getElementById('restoreToast');
const btnRestoreClose = document.getElementById('btnRestoreClose');

btnMobileCancel.addEventListener('click', () => {
  mobileModal.classList.remove('open');
});

mobileModal.addEventListener('click', (e) => {
  if (e.target === mobileModal) mobileModal.classList.remove('open');
});

btnMobileReady.addEventListener('click', () => {
  mobileModal.classList.remove('open');
  startRecording(true);
});

btnRestoreClose.addEventListener('click', () => {
  restoreToast.classList.remove('show');
});

// ── 일시정지 / 재개 ───────────────────────────────────────────────
btnPause.addEventListener('click', () => {
  isPaused = !isPaused;
  chrome.storage.local.set({ isPaused });
  updateView();
});

// ── 수동 캡처 ────────────────────────────────────────────────────
// popup → background 직접 호출 시 sender.tab이 없어 captureVisibleTab 타깃을 못 잡음
// → targetTabId로 content.js에 전달, content.js가 CAPTURE_SCREENSHOT을 보내면
//   sender.tab이 정확히 채워져 background가 올바른 탭을 캡처함
btnSnap.addEventListener('click', () => {
  btnSnap.disabled = true;
  chrome.storage.local.get('targetTabId', ({ targetTabId }) => {
    if (!targetTabId) { btnSnap.disabled = false; return; }
    chrome.tabs.sendMessage(targetTabId, { type: 'MANUAL_CAPTURE' }, () => {
      void chrome.runtime.lastError;
      btnSnap.disabled = false;
    });
  });
});

// ── 실행취소 ─────────────────────────────────────────────────────
btnUndo.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'UNDO_STEP' }, () => { void chrome.runtime.lastError; });
});

// ── 블러 도구 — 마지막 스텝 이미지를 줌 오버레이에 열고 블러 모드 진입 ─
btnBlurTool?.addEventListener('click', async () => {
  const { steps } = await chrome.storage.local.get('steps');
  if (!steps || steps.length === 0) { showToast('블러할 스텝이 없습니다'); return; }
  const lastStep = steps[steps.length - 1];
  const blob = await idbGetScreenshot(lastStep.stepNumber);
  if (!blob) { showToast('이미지를 불러올 수 없습니다'); return; }

  const zoomOverlay = document.getElementById('thumbZoomOverlay');
  const zoomImg     = document.getElementById('thumbZoomImg');
  if (!zoomOverlay || !zoomImg) return;

  const blobSrc = URL.createObjectURL(blob);
  _thumbObjectUrls.push(blobSrc);
  zoomImg.src = blobSrc;
  zoomOverlay.dataset.imageUrl = '';
  zoomOverlay._zoomUrl = blobSrc;
  zoomOverlay._step = lastStep;
  zoomOverlay._blob = blob;
  zoomOverlay.classList.add('open');

  // 오버레이가 렌더된 후 블러 모드 진입
  requestAnimationFrame(() => startBlurMode(lastStep, zoomImg, blob));
});

// ── 모바일 모드 해제 안내 토스트 ─────────────────────────────────
function showRestoreToast() {
  if (!isMobileMode) return;
  isMobileMode = false;
  chrome.storage.local.remove('isMobileMode');
  const toast = document.getElementById('restoreToast');
  if (toast) {
    toast.classList.add('show');
    // 10초 후 자동 닫힘
    setTimeout(() => toast.classList.remove('show'), 10000);
  }
}

// ── 중지 (저장 없이) ─────────────────────────────────────────────
btnDiscard.addEventListener('click', () => {
  isRecording = false;
  isPaused    = false;
  hideCaptureBlockedToast();
  chrome.runtime.sendMessage({ type: 'CLEAR_STEPS' }, () => { void chrome.runtime.lastError; });
  // isRecording: false 먼저 세팅 → background가 targetTabId로 STOP_RECORDING 전송
  // 그 후 targetTabId 등 나머지 키 제거
  chrome.storage.local.set({ isRecording: false }, () => {
    chrome.storage.local.remove(['targetTabId', 'steps', 'stepNumber', 'sessionId']);
  });
  updateView();
  renderSteps([]);
  showRestoreToast();
});

// ── 완료 및 편집 ─────────────────────────────────────────────────
btnFinish.addEventListener('click', async () => {
  btnFinish.disabled = true;

  const { sessionId } = await chrome.storage.local.get('sessionId');

  isRecording = false;
  isPaused    = false;
  hideCaptureBlockedToast();
  updateView();
  showUploadOverlay();
  showRestoreToast();

  // isRecording: false 먼저 세팅 → background가 targetTabId로 STOP_RECORDING 전송
  chrome.storage.local.set({ isRecording: false }, () => {
    chrome.storage.local.remove(['targetTabId', 'steps', 'stepNumber']);
    chrome.storage.local.set({ sessionId: null });
  });

  chrome.runtime.sendMessage({ type: 'FINALIZE_SESSION', sessionId }, (res) => {
    void chrome.runtime.lastError;
    if (res?.ok && res?.tutorial_id) {
      chrome.tabs.create({ url: `https://mimic-nine-ashen.vercel.app/manual/${res.tutorial_id}/editor` });
    }
    btnFinish.disabled = false;
  });
});

// ── 업로드 오버레이 ───────────────────────────────────────────────
function showUploadOverlay() {
  uploadProgressBar.style.animation = 'none';
  uploadProgressBar.offsetHeight;
  uploadProgressBar.style.animation = '';

  uploadSub.textContent = '스크린샷 압축 중...';
  uploadOverlay.classList.add('visible');

  const messages = [
    { delay: 900,  text: 'Storage 업로드 중...' },
    { delay: 1800, text: 'AI 분석 완료 중...' },
    { delay: 2600, text: '매뉴얼 생성 중...' },
    { delay: 3200, text: '완료!' },
  ];
  messages.forEach(({ delay, text }) => {
    setTimeout(() => {
      if (uploadOverlay.classList.contains('visible')) uploadSub.textContent = text;
    }, delay);
  });

  setTimeout(() => {
    uploadOverlay.classList.remove('visible');
    renderSteps([]);
  }, 3800);
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
  if (changes.isRecording && !changes.isRecording.newValue && isRecording) {
    isRecording = false;
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

function showGuideView() {
  viewIdle.style.display      = 'none';
  viewRecording.style.display = 'none';
  const bar = document.getElementById('bottomActionBar');
  if (bar) bar.style.display = 'none';
  viewGuide.style.display = 'flex';
}

function hideGuideView() {
  viewGuide.style.display = 'none';
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
chrome.storage.local.get(['guideModeActive', 'guideSteps', 'guideCurrentStep'], (r) => {
  if (r.guideModeActive && r.guideSteps?.length > 0) {
    guideSteps = r.guideSteps;
    guideCurrentStep = r.guideCurrentStep || 0;
    showGuideView();
    renderGuideStep(guideSteps, guideCurrentStep);
  }
});

// storage 변화 감지: START_GUIDE 이후 guideModeActive가 세팅되면 Guide Me 뷰로 전환
chrome.storage.onChanged.addListener((changes) => {
  if (changes.guideModeActive?.newValue === true) {
    chrome.storage.local.get(['guideSteps', 'guideCurrentStep'], (r) => {
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
});

init();
