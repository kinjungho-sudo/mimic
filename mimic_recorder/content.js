// 중복 주입 방지 — all_frames:true 환경에서 같은 프레임에 두 번 실행되면 즉시 종료
if (window.__mimicContentLoaded) return;
window.__mimicContentLoaded = true;

// iframe에서는 실행하지 않음 — 캡처는 top frame에서만
if (window !== window.top) return;

(() => {
  // ── 상수 ─────────────────────────────────────────────────────────
  const DEDUP_SAME_ELEMENT  = 1200;  // ms — 같은 요소 재클릭 무시 간격
  const DEDUP_DOUBLE_CLICK  = 400;   // ms — 더블클릭 감지 간격
  const TYPING_DEBOUNCE     = 1500;  // ms — 입력 멈춤 후 자동 캡처 대기
  const CAPTURE_SAFETY_MS   = 5000;  // ms — isCapturing stuck 방지 타임아웃

  const INTERACTIVE = [
    'a[href]', 'button', 'input', 'select', 'textarea', 'label',
    '[role="button"]', '[role="link"]', '[role="menuitem"]', '[role="tab"]',
    '[role="checkbox"]', '[role="radio"]', '[role="switch"]', '[role="option"]',
    '[onclick]', '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  // ── 상태 ─────────────────────────────────────────────────────────
  let isRecording      = false;
  let isPaused         = false;
  let isCapturing      = false;
  let isCapturingStart = 0;
  let _pendingManualFlash = false;
  let stepNumber       = 0;

  let settings = {
    highlight:   true,
    flash:       true,
    captureMode: 'interactive',
    quality:     82,
    autoNav:     false,
    piiBlur:     true,
  };

  let lastCapturedTarget = null;
  let lastCapturedTime   = 0;
  let typingTarget       = null;
  let pendingInputStep   = null;
  let typingTimer        = null;
  let _countingDown      = false;

  // ── PII 감지 패턴 ──────────────────────────────────────────────
  const PII_PATTERNS = [
    { type: 'email',    re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g },
    { type: 'phone_kr', re: /0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/g },
    { type: 'rrn',      re: /\d{6}-[1-4]\d{6}/g },
  ];

  const SENSITIVE_INPUT_TYPES = new Set(['password']);
  const SENSITIVE_LABEL_RE    = /비밀번호|패스워드|password/i;

  let _blurredEls = [];

  // ── 초기화 ───────────────────────────────────────────────────────
  chrome.storage.local.get(['settings', 'isPaused'], (r) => {
    isPaused = !!r.isPaused;
    if (r.settings) settings = { ...settings, ...r.settings };
  });

  // ── 유틸 ─────────────────────────────────────────────────────────
  function sendCapture(stepData, onDone) {
    chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT', stepData }, () => {
      void chrome.runtime.lastError;
      if (onDone) onDone();
    });
  }

  function startCapturingSafely() {
    isCapturing      = true;
    isCapturingStart = Date.now();
    return setTimeout(() => { isCapturing = false; }, CAPTURE_SAFETY_MS);
  }

  function getViewportSize() {
    return { vw: window.innerWidth, vh: window.innerHeight };
  }

  function rectCenter(el) {
    const rect = el ? el.getBoundingClientRect() : null;
    return {
      cx: rect ? rect.left + rect.width  / 2 : 0,
      cy: rect ? rect.top  + rect.height / 2 : 0,
    };
  }

  function normalizeRect(rect, vw, vh) {
    return { x: rect.x / vw, y: rect.y / vh, width: rect.width / vw, height: rect.height / vh };
  }

  // ── 필드 레이블 추출 ─────────────────────────────────────────────
  function getFieldLabel(el) {
    if (document.designMode === 'on' && el === document.body) return '본문';
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return label.textContent.trim().slice(0, 60);
    }
    const parentLabel = el.closest('label');
    if (parentLabel) {
      const text = parentLabel.textContent.trim().slice(0, 60);
      if (text) return text;
    }
    return (
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      el.getAttribute('title') ||
      el.getAttribute('name') ||
      '텍스트'
    ).trim().slice(0, 60);
  }

  // ── PII 블러 ──────────────────────────────────────────────────────
  function applyPIIBlur() {
    if (!settings.piiBlur) return [];
    _blurredEls = [];
    const regions = [];

    document.querySelectorAll('input, textarea, select').forEach(el => {
      const type  = (el.type || '').toLowerCase();
      const label = getFieldLabel(el);
      if (!SENSITIVE_INPUT_TYPES.has(type) && !SENSITIVE_LABEL_RE.test(label)) return;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const orig = el.style.cssText;
      el.style.visibility = 'hidden';
      el.style.color = 'transparent';
      _blurredEls.push({ el, orig });
      regions.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, type: 'input' });
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    const processedNodes = new WeakSet();

    for (const node of textNodes) {
      if (processedNodes.has(node)) continue;
      const text = node.textContent;
      if (!text.trim()) continue;

      let matched = false;
      for (const { type, re } of PII_PATTERNS) {
        re.lastIndex = 0;
        if (!re.test(text)) continue;
        const range = document.createRange();
        range.selectNode(node);
        for (const rect of range.getClientRects()) {
          if (rect.width === 0 || rect.height === 0) continue;
          regions.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, type });
        }
        matched = true;
        break;
      }
      if (!matched) continue;

      const span = document.createElement('span');
      span.style.visibility = 'hidden';
      span.dataset.mimicPii = 'detected';
      node.parentNode.insertBefore(span, node);
      span.appendChild(node);
      processedNodes.add(node);
      _blurredEls.push({ el: span, orig: '' });

      const range = document.createRange();
      range.selectNode(span);
      for (const rect of range.getClientRects()) {
        if (rect.width === 0 || rect.height === 0) continue;
        regions.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, type: 'text' });
      }
    }

    return regions;
  }

  function restorePIIBlur() {
    for (const { el, orig } of _blurredEls) {
      if (el.tagName === 'SPAN' && el.dataset.mimicPii) {
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
      } else {
        el.style.cssText = orig;
      }
    }
    _blurredEls = [];
  }

  // ── 타이핑 진행 알림 ─────────────────────────────────────────────
  function notifyTypingProgress(el) {
    const label    = getFieldLabel(el);
    const isMasked = SENSITIVE_INPUT_TYPES.has((el.type || '').toLowerCase()) || SENSITIVE_LABEL_RE.test(label);
    const value    = isMasked ? '' : (el.isContentEditable ? (el.textContent || '') : (el.value || ''));
    chrome.runtime.sendMessage({ type: 'TYPING_PROGRESS', text: value, label, masked: isMasked }, () => { void chrome.runtime.lastError; });
  }

  // ── 타이핑 flush ─────────────────────────────────────────────────
  function flushTyping(el) {
    clearTimeout(typingTimer);
    typingTimer  = null;
    typingTarget = null;
    if (!isRecording || isPaused || isCapturing) { pendingInputStep = null; return; }

    const hasValue = el ? (el.isContentEditable ? !!(el.textContent || '').trim() : !!(el.value || '').trim()) : false;
    if (!hasValue) { pendingInputStep = null; return; }

    const label        = getFieldLabel(el);
    const overwriteStep = pendingInputStep;
    pendingInputStep   = null;

    const safetyTimer = startCapturingSafely();
    const done = () => { clearTimeout(safetyTimer); isCapturing = false; };

    const { cx, cy } = rectCenter(el);
    const { vw, vh } = getViewportSize();

    if (overwriteStep !== null) {
      lastCapturedTarget = el;
      lastCapturedTime   = Date.now();
      sendCapture({
        url: location.href, timestamp: Date.now(),
        clickX: cx, clickY: cy,
        windowWidth: vw, windowHeight: vh,
        stepNumber: overwriteStep, overwrite: true,
        actionInfo: { type: 'type', text: label },
      }, done);
    } else {
      stepNumber += 1;
      lastCapturedTarget = el;
      lastCapturedTime   = Date.now();
      sendCapture({
        url: location.href, timestamp: Date.now(),
        clickX: cx, clickY: cy,
        windowWidth: vw, windowHeight: vh,
        stepNumber,
        actionInfo: { type: 'type', text: label },
      }, done);
    }
  }

  // ── 오버레이 헬퍼 ────────────────────────────────────────────────
  function makeBorderOverlay(rect) {
    const ov = document.createElement('div');
    applyOverlayStyle(ov, rect);
    return ov;
  }

  function applyOverlayStyle(ov, rect) {
    const P = 3;
    ov.style.cssText = [
      'position:fixed',
      `left:${rect.left - P}px`, `top:${rect.top - P}px`,
      `width:${rect.width + P * 2}px`, `height:${rect.height + P * 2}px`,
      `border-radius:${Math.min(rect.width, rect.height) <= 32 ? Math.floor(Math.min(rect.width, rect.height) / 2) : 6}px`,
      'border:2px solid #EF4444',
      'box-shadow:0 0 0 3px rgba(239,68,68,0.3)',
      'background:transparent',
      'pointer-events:none', 'z-index:2147483646', 'box-sizing:border-box',
    ].join(';');
  }

  let typingHighlightOverlay = null;

  function showTypingHighlight(el) {
    removeTypingHighlight();
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const P = 4;
    const ov = document.createElement('div');
    ov.style.cssText = [
      'position:fixed',
      `left:${rect.left - P}px`, `top:${rect.top - P}px`,
      `width:${rect.width + P * 2}px`, `height:${rect.height + P * 2}px`,
      `border-radius:${Math.min(8, (rect.width + P * 2) / 4)}px`,
      'border:2.5px solid #3B82F6',
      'box-shadow:0 0 0 4px rgba(59,130,246,0.25)',
      'background:transparent',
      'pointer-events:none', 'z-index:2147483646', 'box-sizing:border-box',
    ].join(';');
    document.documentElement.appendChild(ov);
    typingHighlightOverlay = ov;
  }

  function removeTypingHighlight() {
    if (typingHighlightOverlay) { typingHighlightOverlay.remove(); typingHighlightOverlay = null; }
  }

  let fileHighlightOverlay = null;

  function showFileHighlight(fileNames) {
    removeFileHighlight();
    const ov = document.createElement('div');
    ov.style.cssText = [
      'position:fixed', 'bottom:72px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:2147483646',
      'background:rgba(20,20,30,0.88)', 'color:#fff',
      'border-radius:10px', 'padding:10px 20px',
      'display:flex', 'align-items:center', 'gap:10px',
      'max-width:520px', 'box-shadow:0 4px 20px rgba(0,0,0,0.45)',
      'pointer-events:none',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    ].join(';');

    const icon = document.createElement('span');
    icon.textContent = '📎';
    icon.style.cssText = 'font-size:18px;flex-shrink:0';

    const label = document.createElement('span');
    label.style.cssText = [
      'font-size:14px', 'font-weight:600', 'color:#A5F3FC',
      'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis', 'max-width:440px',
    ].join(';');
    label.textContent = fileNames;

    ov.append(icon, label);
    document.documentElement.appendChild(ov);
    fileHighlightOverlay = ov;
  }

  function removeFileHighlight() {
    if (fileHighlightOverlay) { fileHighlightOverlay.remove(); fileHighlightOverlay = null; }
  }

  // ── 호버 포인터 ──────────────────────────────────────────────────
  let hoverOverlay = null;
  let hoverTarget  = null;

  function showHoverPointer(target) {
    const rect = target.getBoundingClientRect();
    if (!hoverOverlay) {
      hoverOverlay = makeBorderOverlay(rect);
      document.documentElement.appendChild(hoverOverlay);
    } else {
      applyOverlayStyle(hoverOverlay, rect);
    }
  }

  function hideHoverPointer() {
    if (hoverOverlay) { hoverOverlay.remove(); hoverOverlay = null; }
    hoverTarget = null;
  }

  // ── 캡처 완료 플래시 ─────────────────────────────────────────────
  function flashCapture() {
    const flash = document.createElement('div');
    flash.style.cssText = [
      'position:fixed', 'inset:0',
      'background:#fff', 'opacity:0.5',
      'pointer-events:none', 'z-index:2147483647',
      'transition:opacity 0.22s ease-out',
    ].join(';');
    document.documentElement.appendChild(flash);
    requestAnimationFrame(() => {
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 250);
    });
  }

  // ── 녹화 시작 카운트다운 오버레이 ──────────────────────────────
  function showCountdown(onDone) {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'background:rgba(0,0,0,0.72)',
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'gap:16px',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'pointer-events:none',
    ].join(';');

    const badge = document.createElement('div');
    badge.style.cssText = [
      'display:flex', 'align-items:center', 'gap:10px',
      'background:rgba(255,255,255,0.1)', 'border:1px solid rgba(255,255,255,0.2)',
      'border-radius:999px', 'padding:8px 20px',
      'color:#fff', 'font-size:13px', 'font-weight:600', 'letter-spacing:0.3px',
    ].join(';');

    const dot = document.createElement('span');
    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#EF4444;flex-shrink:0;animation:mimic-blink 1s infinite';
    const badgeText = document.createElement('span');
    badgeText.textContent = '화면 녹화가 시작됩니다';
    badge.append(dot, badgeText);

    const numEl = document.createElement('div');
    numEl.style.cssText = [
      'font-size:96px', 'font-weight:800', 'color:#fff',
      'line-height:1', 'letter-spacing:-4px',
      'text-shadow:0 4px 24px rgba(0,0,0,0.4)',
      'transition:transform 0.15s ease,opacity 0.15s ease',
    ].join(';');

    overlay.append(badge, numEl);

    if (!document.getElementById('mimic-kf')) {
      const kf = document.createElement('style');
      kf.id = 'mimic-kf';
      kf.textContent = '@keyframes mimic-blink{0%,100%{opacity:1}50%{opacity:0.2}}@keyframes mimic-pop{0%{transform:scale(1.4);opacity:0}60%{opacity:1}100%{transform:scale(1);opacity:1}}@keyframes mimic-start{0%{transform:scale(0.8);opacity:0}50%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}';
      document.head.appendChild(kf);
    }

    document.documentElement.appendChild(overlay);

    const steps = [
      { text: '3', color: '#fff',      anim: 'mimic-pop 0.35s ease forwards' },
      { text: '2', color: '#fff',      anim: 'mimic-pop 0.35s ease forwards' },
      { text: '1', color: '#fff',      anim: 'mimic-pop 0.35s ease forwards' },
      { text: 'START', color: '#4ade80', anim: 'mimic-start 0.4s ease forwards', size: '56px' },
    ];

    let i = 0;
    function tick() {
      if (i >= steps.length) { overlay.remove(); onDone(); return; }
      const s = steps[i++];
      numEl.textContent = s.text;
      numEl.style.color = s.color;
      numEl.style.fontSize = s.size || '96px';
      numEl.style.animation = 'none';
      void numEl.offsetWidth;
      numEl.style.animation = s.anim;
      setTimeout(tick, i < steps.length ? 900 : 700);
    }
    tick();
  }

  // ── 메시지 수신 ──────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'START_RECORDING') {
      if (isRecording || _countingDown) { sendResponse({ ok: true }); return false; }
      _countingDown      = true;
      lastCapturedTarget = null;
      lastCapturedTime   = 0;
      sendResponse({ ok: true });
      chrome.storage.local.get('stepNumber', (r) => {
        stepNumber = r.stepNumber || 0;
        showCountdown(() => {
          isRecording   = true;
          isPaused      = false;
          _countingDown = false;
        });
      });
      return false;
    }

    if (msg.type === 'STOP_RECORDING') {
      isRecording        = false;
      isPaused           = false;
      hideHoverPointer();
      clearTimeout(typingTimer);
      typingTimer        = null;
      typingTarget       = null;
      pendingInputStep   = null;
      lastCapturedTarget = null;
      sendResponse({ ok: true });
      return false;
    }

    if (msg.type === 'GET_STATUS') {
      sendResponse({ isRecording, isPaused });
      return false;
    }

    if (msg.type === 'UPDATE_SETTINGS') {
      settings = { ...settings, ...msg.settings };
      sendResponse({ ok: true });
      return false;
    }

    if (msg.type === 'HIDE_OVERLAY_FOR_CAPTURE') {
      if (typingTarget && document.contains(typingTarget)) showTypingHighlight(typingTarget);
      const piiRegions = applyPIIBlur();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { sendResponse({ ok: true, piiRegions }); });
      });
      return true;
    }

    if (msg.type === 'RESTORE_OVERLAY') {
      restorePIIBlur();
      removeTypingHighlight();
      removeFileHighlight();
      isCapturing = false;
      hoverTarget = null;
      if (_pendingManualFlash) { flashCapture(); _pendingManualFlash = false; }
      sendResponse({ ok: true });
      return false;
    }

    if (msg.type === 'MANUAL_CAPTURE') {
      if (!isRecording) { sendResponse({ ok: false }); return false; }
      if (isCapturing && (Date.now() - isCapturingStart) < CAPTURE_SAFETY_MS) { sendResponse({ ok: false }); return false; }
      if (isCapturing) isCapturing = false;
      isCapturing      = true;
      isCapturingStart = Date.now();
      _pendingManualFlash = true;
      stepNumber += 1;
      const { vw, vh } = getViewportSize();
      sendCapture({
        url: location.href, timestamp: Date.now(),
        clickX: 0, clickY: 0,
        windowWidth: vw, windowHeight: vh,
        stepNumber, manual: true,
      });
      sendResponse({ ok: true });
      return false;
    }

    if (msg.type === 'SHOW_OVERLAY' && msg.step) { showGuideOverlay(msg.step); return false; }
    if (msg.type === 'HIDE_OVERLAY') { removeGuideOverlay(); return false; }

    return false;
  });

  // ── 인터랙티브 타겟 탐색 ────────────────────────────────────────
  function findInteractiveTarget(el) {
    if (!el || el === document.documentElement) return null;
    if (settings.captureMode === 'all') return el;
    if (document.designMode === 'on') return document.body;

    const found = el.closest(INTERACTIVE);
    if (found) return found;

    let cur = el;
    for (let i = 0; i < 8; i++) {
      if (!cur || cur === document.documentElement) break;
      if (window.getComputedStyle(cur).cursor === 'pointer') return cur;
      cur = cur.parentElement;
    }

    cur = el;
    for (let i = 0; i < 8; i++) {
      if (!cur || cur === document.documentElement || cur === document.body) break;
      if (
        cur.hasAttribute('onclick') ||
        cur.getAttribute('role') === 'button' ||
        cur.getAttribute('role') === 'link' ||
        cur.getAttribute('tabindex') !== null ||
        (cur.dataset && Object.keys(cur.dataset).length > 0 && cur.tagName !== 'INPUT')
      ) return cur;
      cur = cur.parentElement;
    }

    return null;
  }

  // ── 엘리먼트 메타 추출 ───────────────────────────────────────────
  function getElementLabel(el) {
    return (
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60) ||
      el.getAttribute('placeholder') ||
      el.getAttribute('value') ||
      el.getAttribute('name') ||
      ''
    );
  }

  function getElementSelector(el) {
    try {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const tag = el.tagName.toLowerCase();
      for (const attr of ['data-testid', 'data-cy', 'data-test', 'aria-label', 'name']) {
        const val = el.getAttribute(attr);
        if (val) {
          const sel = `${tag}[${attr}="${CSS.escape(val)}"]`;
          if (document.querySelectorAll(sel).length === 1) return sel;
        }
      }

      const buildPath = (node, depth) => {
        if (depth <= 0 || !node || node === document.documentElement) return '';
        const t = node.tagName.toLowerCase();
        let sel = t;
        if (node.id) return `#${CSS.escape(node.id)}`;

        const stableClasses = [...node.classList].filter(c =>
          !/is-|has-|active|hover|focus|selected|disabled|loading|error|open|closed/.test(c)
        ).slice(0, 2);
        if (stableClasses.length) sel += stableClasses.map(c => `.${CSS.escape(c)}`).join('');

        if (node.parentElement) {
          const siblings = [...node.parentElement.children].filter(c => c.tagName === node.tagName);
          if (siblings.length > 1) sel += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }

        const parentPath = buildPath(node.parentElement, depth - 1);
        return parentPath ? `${parentPath} > ${sel}` : sel;
      };

      for (const depth of [3, 2, 1]) {
        const path = buildPath(el, depth);
        if (!path) continue;
        try { if (document.querySelectorAll(path).length === 1) return path; } catch { /**/ }
      }

      const cls = [...el.classList].slice(0, 2).map(c => `.${CSS.escape(c)}`).join('');
      return tag + cls;
    } catch { return ''; }
  }

  function getActionType(el) {
    const tag  = el.tagName.toLowerCase();
    const type = el.getAttribute('type') || '';
    if (tag === 'a') return 'navigate';
    if (tag === 'input' && ['checkbox', 'radio'].includes(type)) return 'toggle';
    if (tag === 'select') return 'select';
    if (el.getAttribute('list')) return 'select';
    if (el.getAttribute('role') === 'combobox') return 'select';
    if (tag === 'input' || tag === 'textarea' || el.isContentEditable) return 'focus_input';
    if (document.designMode === 'on' && tag === 'body') return 'focus_input';
    return 'click';
  }

  // ── 호버 이벤트 ──────────────────────────────────────────────────
  document.addEventListener('mousemove', (e) => {
    if (!isRecording || isPaused) { hideHoverPointer(); return; }
    if (isCapturing && (Date.now() - isCapturingStart) >= CAPTURE_SAFETY_MS) isCapturing = false;
    if (isCapturing) return;
    const target = findInteractiveTarget(e.target);
    if (!target) { hideHoverPointer(); return; }
    const overlayAlive = hoverOverlay && document.documentElement.contains(hoverOverlay);
    if (target === hoverTarget && overlayAlive) return;
    hoverTarget = target;
    showHoverPointer(target);
  }, true);

  document.documentElement.addEventListener('mouseleave', (e) => {
    if (e.relatedTarget === null) hideHoverPointer();
  });

  // ── 클릭 캡처 ────────────────────────────────────────────────────
  document.addEventListener('click', handleClick, true);

  function handleClick(e) {
    if (!isRecording || isPaused || isCapturing) return;

    const clickedEl = e.target;

    // MIMIC 자체 오버레이 클릭 무시
    if (clickedEl && typeof clickedEl.id === 'string' && clickedEl.id.toLowerCase().includes('mimic')) return;
    const _classStr = typeof clickedEl.className === 'string'
      ? clickedEl.className
      : (clickedEl.className?.baseVal ?? '');
    if (_classStr.toLowerCase().includes('mimic')) return;

    const target = findInteractiveTarget(clickedEl);

    // 빈 화면 클릭 (body/html)
    if (!target) {
      const now = Date.now();
      if (lastCapturedTarget === document.body && (now - lastCapturedTime) < DEDUP_SAME_ELEMENT) return;

      const safetyTimer = startCapturingSafely();
      stepNumber        += 1;
      lastCapturedTarget = document.body;
      lastCapturedTime   = now;
      const { vw, vh } = getViewportSize();
      sendCapture({
        url: location.href, timestamp: Date.now(),
        clickX: e.clientX, clickY: e.clientY,
        windowWidth: vw, windowHeight: vh,
        viewportW: vw, viewportH: vh,
        stepNumber,
        elementRect: null, elementSelector: null,
        actionInfo: { type: 'click', label: '화면 클릭', tag: clickedEl.tagName.toLowerCase() },
      }, () => { clearTimeout(safetyTimer); isCapturing = false; });
      return;
    }

    const now = Date.now();
    if (target === lastCapturedTarget && (now - lastCapturedTime) < DEDUP_SAME_ELEMENT) return;

    const actionType = getActionType(target);

    // 텍스트 입력 필드: 클릭 시 캡처 안 함, typingTarget만 세팅
    if (actionType === 'focus_input') {
      if (typingTarget && typingTarget !== target) flushTyping(typingTarget);
      if (typingTarget === target) return;
      typingTarget     = target;
      pendingInputStep = null;
      return;
    }

    // 진행 중이던 타이핑 flush
    if (typingTarget) flushTyping(typingTarget);

    const rect  = target.getBoundingClientRect();
    const label = getElementLabel(target);
    const href  = target.getAttribute('href') || target.closest('a')?.getAttribute('href') || '';
    const { vw, vh } = getViewportSize();

    // navigate 클릭: background가 stepNumber 관리 + 캡처 단독 처리
    if (actionType === 'navigate') {
      lastCapturedTarget = target;
      lastCapturedTime   = now;
      const navStepData = {
        url: location.href, timestamp: Date.now(),
        clickX: e.clientX, clickY: e.clientY,
        windowWidth: vw, windowHeight: vh,
        viewportW: vw, viewportH: vh,
        elementRect:     normalizeRect(rect, vw, vh),
        elementSelector: getElementSelector(target),
        actionInfo:      { type: actionType, label, tag: target.tagName.toLowerCase(), href: href.slice(0, 200) },
      };
      chrome.storage.local.set({ pendingCapture: navStepData, lastCaptureTime: now });
      return;
    }

    const safetyTimer = startCapturingSafely();
    stepNumber        += 1;
    lastCapturedTarget = target;
    lastCapturedTime   = now;

    const stepData = {
      url: location.href, timestamp: Date.now(),
      clickX: e.clientX, clickY: e.clientY,
      windowWidth: vw, windowHeight: vh,
      viewportW: vw, viewportH: vh,
      stepNumber,
      elementRect:     normalizeRect(rect, vw, vh),
      elementSelector: getElementSelector(target),
      actionInfo:      { type: actionType, label, tag: target.tagName.toLowerCase(), href: href.slice(0, 200) },
    };

    const downloadAttr    = target.getAttribute('download');
    const isDownloadLink  = target.tagName.toLowerCase() === 'a' && downloadAttr !== null;
    if (isDownloadLink) {
      const fileName = downloadAttr || href.split('/').pop().split('?')[0] || '파일';
      showFileHighlight(fileName);
    }

    // same-origin iframe에서 bubble된 클릭 중복 방지
    if (window === window.top && e.target.ownerDocument !== document) {
      isCapturing = false;
      clearTimeout(safetyTimer);
      return;
    }

    sendCapture(stepData, () => { clearTimeout(safetyTimer); isCapturing = false; });
  }

  // ── input 이벤트 (타이핑 추적) ──────────────────────────────────
  document.addEventListener('input', (e) => {
    if (!isRecording || isPaused) return;
    const el = e.target;
    const isDesignModeBody = document.designMode === 'on' && el === document.body;
    if (!isDesignModeBody && !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)) return;

    if (typingTarget && typingTarget !== el) flushTyping(typingTarget);
    typingTarget = el;
    notifyTypingProgress(el);

    if (pendingInputStep === null) {
      stepNumber += 1;
      pendingInputStep = stepNumber;
    }

    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      if (!isRecording || isPaused || isCapturing || typingTarget !== el) return;
      const overwriteStep = pendingInputStep;
      pendingInputStep = null;
      const label = getFieldLabel(el);
      const { cx: timerCX, cy: timerCY } = rectCenter(el);
      const { vw, vh } = getViewportSize();
      isCapturing = true;
      lastCapturedTarget = el;
      lastCapturedTime   = Date.now();
      sendCapture({
        url: location.href, timestamp: Date.now(),
        clickX: timerCX, clickY: timerCY,
        windowWidth: vw, windowHeight: vh,
        stepNumber: overwriteStep, overwrite: true,
        actionInfo: { type: 'type', text: label },
      }, () => { isCapturing = false; });
    }, TYPING_DEBOUNCE);
  }, true);

  // ── keydown: Enter = flush ────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (!isRecording || isPaused) return;
    if (e.key !== 'Enter' || !typingTarget) return;
    const el            = e.target;
    const isSingleLine  = el instanceof HTMLInputElement;
    const isMultiLine   = el instanceof HTMLTextAreaElement || el.isContentEditable;
    const isModified    = e.ctrlKey || e.metaKey;
    if (isSingleLine || (isMultiLine && isModified)) flushTyping(el);
  }, true);

  // ── 파일 업로드 캡처 ─────────────────────────────────────────────
  document.addEventListener('change', (e) => {
    if (!isRecording || isPaused || isCapturing) return;
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || el.type !== 'file') return;
    if (!el.files || el.files.length === 0) return;

    const fileNames  = [...el.files].map(f => f.name).join(', ');
    const { cx: fileCX, cy: fileCY } = rectCenter(el);
    const safetyTimer = startCapturingSafely();
    stepNumber        += 1;
    lastCapturedTarget = el;
    lastCapturedTime   = Date.now();
    const { vw, vh } = getViewportSize();

    setTimeout(() => {
      if (!isRecording || isPaused) { isCapturing = false; clearTimeout(safetyTimer); return; }
      showFileHighlight(fileNames);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        sendCapture({
          url: location.href, timestamp: Date.now(),
          clickX: fileCX, clickY: fileCY,
          windowWidth: vw, windowHeight: vh,
          stepNumber,
          actionInfo: { type: 'upload', text: fileNames, tag: 'input' },
        }, () => { clearTimeout(safetyTimer); isCapturing = false; });
      }));
    }, 400);
  }, true);

  // ── storage 변경 감지 (isPaused 동기화) ─────────────────────────
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if ('isPaused' in changes) isPaused = !!changes.isPaused.newValue;
  });

  // ── SPA 이동 감지 (MutationObserver) ────────────────────────────
  if (window === window.top) {
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (!isRecording || isPaused || isCapturing) return;
      if (!settings.autoNav) return;
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      chrome.storage.local.set({ spaNavCapturing: true });
      setTimeout(() => {
        if (!isRecording || isPaused || isCapturing) return;
        const { vw, vh } = getViewportSize();
        isCapturing = true;
        stepNumber += 1;
        sendCapture({
          url: location.href, timestamp: Date.now(),
          clickX: 0, clickY: 0,
          windowWidth: vw, windowHeight: vh,
          stepNumber,
          actionInfo: { type: 'navigate', label: document.title || '' },
        }, () => {
          isCapturing = false;
          chrome.storage.local.remove('spaNavCapturing');
        });
      }, 1500);
    }).observe(document, { subtree: true, childList: true });
  }

  // ── 클립보드 붙여넣기로 수동 스크린샷 수신 ──────────────────────
  document.addEventListener('paste', (e) => {
    if (!isRecording || isPaused || isCapturing) return;
    const active = document.activeElement;
    if (active && (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active.isContentEditable
    )) return;

    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      const blob = item.getAsFile();
      if (!blob) continue;

      e.preventDefault();
      e.stopPropagation();
      isCapturing = true;

      const reader = new FileReader();
      reader.onloadend = () => {
        const { vw, vh } = getViewportSize();
        chrome.runtime.sendMessage({
          type: 'MANUAL_IMAGE_STEP',
          dataUrl:  reader.result,
          stepData: {
            url: location.href, timestamp: Date.now(),
            clickX: 0, clickY: 0,
            windowWidth: vw, windowHeight: vh,
            manual: true,
            actionInfo: { type: 'click', label: '클립보드 붙여넣기 캡처' },
          },
        }, () => { void chrome.runtime.lastError; isCapturing = false; });
      };
      reader.readAsDataURL(blob);
      return;
    }
  }, true);

  // ── Guide Me 오버레이 ────────────────────────────────────────────
  let guideShadowHost = null;

  function removeGuideOverlay() {
    if (guideShadowHost) { guideShadowHost.remove(); guideShadowHost = null; }
  }

  function showGuideOverlay(step) {
    removeGuideOverlay();

    const host = document.createElement('div');
    host.id = 'mimic-overlay-root';
    host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483640;';
    document.documentElement.appendChild(host);
    guideShadowHost = host;

    const shadow = host.attachShadow({ mode: 'closed' });

    let hlRect = null;
    if (step.element_selector) {
      try {
        const el = document.querySelector(step.element_selector);
        if (el) hlRect = el.getBoundingClientRect();
      } catch { /* invalid selector */ }
    }
    if (!hlRect && step.element_rect) {
      const r = step.element_rect;
      hlRect = {
        left:   r.x      * window.innerWidth,
        top:    r.y      * window.innerHeight,
        width:  r.width  * window.innerWidth,
        height: r.height * window.innerHeight,
      };
    }

    if (hlRect && hlRect.width > 0 && hlRect.height > 0) {
      const hl = document.createElement('div');
      const P  = 4;
      hl.style.cssText = [
        'position:fixed', 'pointer-events:none', 'box-sizing:border-box',
        `left:${hlRect.left - P}px`, `top:${hlRect.top - P}px`,
        `width:${hlRect.width + P * 2}px`, `height:${hlRect.height + P * 2}px`,
        'background:rgba(255,200,0,0.18)', 'border:2.5px solid #F59E0B',
        'border-radius:6px', 'box-shadow:0 0 0 4px rgba(245,158,11,0.18)', 'z-index:2',
      ].join(';');
      shadow.appendChild(hl);
    }

    if (step.click_x != null && step.click_y != null) {
      const cx = step.click_x * window.innerWidth;
      const cy = step.click_y * window.innerHeight;

      const style = document.createElement('style');
      style.textContent = `
        @keyframes mimic-ripple {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .mimic-pulse {
          position: fixed;
          width: 20px; height: 20px;
          border-radius: 50%;
          background: rgba(239,68,68,0.85);
          pointer-events: none;
          z-index: 3;
        }
        .mimic-pulse::after {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid rgba(239,68,68,0.7);
          animation: mimic-ripple 1.2s ease-out infinite;
        }
      `;
      shadow.appendChild(style);

      const dot = document.createElement('div');
      dot.className = 'mimic-pulse';
      dot.style.left = `${cx - 10}px`;
      dot.style.top  = `${cy - 10}px`;
      shadow.appendChild(dot);
    }

    if (step.instruction) {
      const bar = document.createElement('div');
      bar.style.cssText = [
        'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
        'max-width:600px', 'width:calc(100% - 48px)',
        'background:rgba(0,0,0,0.82)', 'color:#fff',
        'border-radius:12px', 'padding:12px 20px',
        'font-size:15px', 'line-height:1.6',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'pointer-events:none', 'z-index:4',
        'box-shadow:0 4px 24px rgba(0,0,0,0.4)', 'text-align:center',
      ].join(';');
      bar.textContent = step.instruction;
      shadow.appendChild(bar);
    }
  }
})();
