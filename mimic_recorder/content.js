(() => {
  // 중복 주입 방지 — 같은 프레임에 두 번 실행되면 즉시 종료
  // (최상위 return은 classic script에서 SyntaxError — 반드시 IIFE 안에서)
  if (window.__mimicContentLoaded) return;
  window.__mimicContentLoaded = true;

  // iframe editors need typing capture; visual guide UI stays in the top frame.
  const IS_TOP_FRAME = window === window.top;

  // ── 로그 헬퍼 (background 링버퍼로 릴레이) ──────────────────────
  function log(level, ...args) {
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    const tag = `[MIMIC][${level.toUpperCase()}][content]`;
    if (level === 'error')      console.error(tag, msg);
    else if (level === 'warn')  console.warn(tag, msg);
    else if (level === 'debug') console.debug(tag, msg);
    else                        console.log(tag, msg);
    chrome.runtime.sendMessage({ type: 'RELAY_LOG', level, source: 'content', msg })
      .catch(() => {});
  }

  // ── 상수 ─────────────────────────────────────────────────────────
  const DEDUP_SAME_ELEMENT  = 1200;  // ms — 같은 요소 재클릭 무시 간격
  const DEDUP_DOUBLE_CLICK  = 400;   // ms — 더블클릭 감지 간격
  const DEDUP_REFOCUS_MS    = 10000; // ms — 같은 입력칸 재포커스 클릭 스텝 중복 방지(이 시간 지나면 재캡처 허용)
  const CAPTURE_SAFETY_MS   = 5000;  // ms — isCapturing stuck 방지 타임아웃
  const TYPING_FRAME_THROTTLE = 300; // ms — 타이핑 중 '전송 직전' 롤링 프레임 캡처 간격
  // (captureVisibleTab 쿼터는 초당 2회 — 300ms 시도 중 일부는 rate-limit으로 무시되나,
  //  실패해도 직전 프레임을 유지하므로 안전. 성공분이 더 잦아져 텍스트가 더 최신에 가깝다.)
  const TYPING_FRAME_SETTLE  = 350;  // ms — 입력이 잠깐 멈춰 화면이 안정된 '완료' 시점에 1장 더 버퍼링
  //  (throttle 프레임은 조합 중간값 "주"가 남을 수 있다 → 멈춤 시점 프레임으로 덮어써 완성 화면을 보장.)

  const INTERACTIVE = [
    'a[href]', 'button', 'input', 'select', 'textarea', 'label',
    '[role="button"]', '[role="link"]', '[role="menuitem"]', '[role="tab"]',
    '[role="checkbox"]', '[role="radio"]', '[role="switch"]', '[role="option"]',
    '[role="textbox"]', '[contenteditable="true"]', '[contenteditable="plaintext-only"]',
    '[onclick]', '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  // ── 상태 ─────────────────────────────────────────────────────────
  let isRecording      = false;
  let isPaused         = false;
  let isCapturing      = false;
  let isCapturingStart = 0;
  let stepNumber       = 0;

  let settings = {
    highlight: true,
    autoNav:   true,
    saveText:  false,
    captureInputClicks: false,
  };

  let lastCapturedTarget = null;
  let lastCapturedTime   = 0;
  let lastFocusInputTarget = null;  // 같은 입력칸 재포커스 dedup용
  let lastFocusInputTime   = 0;
  let typingTarget       = null;
  let pendingInputStep   = null;
  let typingUrl          = null;   // 입력 세션 시작 시 URL — 재마운트 필드 판정용
  let typingTimer        = null;
  let _pointerDownSnapshot = null;
  let typingFocusSnapshot = null;
  let _countingDown      = false;
  let _lastTypingFrameTime = 0;     // 롤링 타이핑 프레임 throttle 기준
  let _typingFrameTimer  = null;    // 입력 멈춤(완료) 시점 프레임 1장 예약 타이머
  let _isComposing       = false;   // 한/일/중 IME 조합 중 여부 — 조합 중간값 캡처 방지

  // 비밀번호 등 민감 입력의 '타이핑 텍스트 저장'을 막는 마스킹용 (블러와 무관)
  const SENSITIVE_INPUT_TYPES = new Set(['password']);
  const SENSITIVE_LABEL_RE    = /비밀번호|패스워드|password/i;

  // ── 초기화 ───────────────────────────────────────────────────────
  chrome.storage.local.get(['settings', 'isPaused'], (r) => {
    isPaused = !!r.isPaused;
    if (r.settings) settings = { ...settings, ...r.settings };
  });

  // 페이지 이동(전체 새로고침) 후 녹화 상태 복원 — 이 탭이 녹화 대상일 때만.
  // 새 content script는 isRecording이 false로 시작하므로, 복원하지 않으면
  // 이동한 페이지에서의 클릭/타이핑/호버가 캡처되지 않는다. 카운트다운은 없이 즉시 재개.
  chrome.runtime.sendMessage({ type: 'GET_TAB_RECORDING_STATE' }, (res) => {
    void chrome.runtime.lastError;
    if (res && res.isRecording && !isRecording && !_countingDown) {
      isRecording = true;
      isPaused    = !!res.isPaused;
      stepNumber  = res.stepNumber || 0;
    }
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
    try {
      return { vw: window.top.innerWidth, vh: window.top.innerHeight };
    } catch {
      return { vw: window.innerWidth, vh: window.innerHeight };
    }
  }

  function getFrameOffsetToTop() {
    let x = 0;
    let y = 0;
    let win = window;
    try {
      while (win !== win.top) {
        const frame = win.frameElement;
        if (!frame) break;
        const rect = frame.getBoundingClientRect();
        x += rect.left;
        y += rect.top;
        win = win.parent;
      }
    } catch {
      return { x: 0, y: 0 };
    }
    return { x, y };
  }

  function toTopRect(rect) {
    const offset = getFrameOffsetToTop();
    return {
      x: rect.x + offset.x,
      y: rect.y + offset.y,
      left: rect.left + offset.x,
      top: rect.top + offset.y,
      width: rect.width,
      height: rect.height,
    };
  }

  function toTopPoint(x, y) {
    const offset = getFrameOffsetToTop();
    return { x: x + offset.x, y: y + offset.y };
  }

  function rectCenter(el) {
    const rect = el ? el.getBoundingClientRect() : null;
    const point = rect ? toTopPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) : { x: 0, y: 0 };
    return {
      cx: point.x,
      cy: point.y,
    };
  }

  // 뷰포트 교차 영역으로 클램프 — 화면보다 큰 요소(긴 텍스트 붙여넣기로 늘어난 textarea 등)의
  // 하이라이트/저장 rect가 화면 밖으로 벗어나 어긋나지 않도록 보이는 부분만 강조·저장한다.
  function clampRectToViewport(rect, vw, vh) {
    const rx = rect.left != null ? rect.left : rect.x;
    const ry = rect.top  != null ? rect.top  : rect.y;
    const left   = Math.max(0, rx);
    const top    = Math.max(0, ry);
    const right  = Math.min(vw, rx + rect.width);
    const bottom = Math.min(vh, ry + rect.height);
    const width  = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    return { x: left, y: top, left, top, width, height };
  }

  function normalizeRect(rect, vw, vh) {
    const c = clampRectToViewport(rect, vw, vh);
    return { x: c.x / vw, y: c.y / vh, width: c.width / vw, height: c.height / vh };
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
  // 자동 PII 블러는 제거됨. 정규식 DOM 감지는 (1) 패턴 없는 이름·주소 등
  // 진짜 민감정보는 못 잡고 (2) 공용 전화번호 등 덜 민감한 걸 오폭하며
  // (3) 거짓 안심을 유발한다. 가림은 사용자 통제 하의 '수동 드래그 블러'(popup)로만.
  // 서버 finalize의 Claude Vision detectPII가 비파괴 '검토 필요' 플래그로 보완한다.
  // 두 함수는 캡처 파이프라인 시그니처 유지를 위해 no-op으로 남긴다.

  function getEditableTarget(el) {
    if (!el) return null;
    if (document.designMode === 'on') return document.body;
    const node = el.nodeType === Node.ELEMENT_NODE ? el : el.parentElement;
    if (!node) return null;
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) return node;
    const editor = node.closest?.(
      '[contenteditable="true"],[contenteditable="plaintext-only"],[role="textbox"],.ProseMirror,.ql-editor,.se2_inputarea,.se_editArea,.note-editable,[data-contents="true"]'
    );
    if (editor && editor.isContentEditable) {
      let root = editor;
      while (root.parentElement && root.parentElement.isContentEditable) root = root.parentElement;
      return root;
    }
    if (node.isContentEditable) {
      let root = node;
      while (root.parentElement && root.parentElement.isContentEditable) root = root.parentElement;
      return root;
    }
    return null;
  }

  function getEditableText(el) {
    if (!el) return '';
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value || '';
    const text = typeof el.innerText === 'string' && el.innerText.trim()
      ? el.innerText
      : (el.textContent || '');
    return text
      .replace(/\u00a0/g, ' ')
      .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function applyPIIBlur() {
    return [];
  }

  function restorePIIBlur() {
    /* no-op — 자동 블러 제거됨 */
  }

  // ── 타이핑 진행 알림 ─────────────────────────────────────────────
  function notifyTypingProgress(el) {
    const label    = getFieldLabel(el);
    const isMasked = SENSITIVE_INPUT_TYPES.has((el.type || '').toLowerCase()) || SENSITIVE_LABEL_RE.test(label);
    const value    = isMasked ? '' : getEditableText(el);
    chrome.runtime.sendMessage({ type: 'TYPING_PROGRESS', text: value, label, masked: isMasked }, () => { void chrome.runtime.lastError; });
  }

  // ── 재마운트 필드 판정 ───────────────────────────────────────────
  // Gemini(Quill) 같은 리치 에디터는 빈 값 전환·여러 줄 확장 시 입력 노드를 통째로
  // 갈아끼운다. 옛 타겟이 DOM에서 분리됐고 같은 페이지의 진행 중 세션이 있으면
  // 같은 논리적 필드로 간주해 세션(pendingInputStep)을 유지한다 — 입력 스텝 분할 방지.
  function isRemountedTyping(oldEl) {
    return !!oldEl && !oldEl.isConnected && pendingInputStep !== null && location.href === typingUrl;
  }

  // ── 타이핑 flush ─────────────────────────────────────────────────
  // 한 입력 필드 = 한 스텝. 첫 입력 때 예약한 pendingInputStep을 계속 overwrite 한다.
  //   finalize=false : 입력 멈춤(디바운스) — 같은 스텝 갱신, 세션 유지
  //   finalize=true  : 포커스 이동/Enter/녹화 종료 — 세션 종료(다음 입력은 새 스텝)
  //   opts.usePrecapture : Enter/다른 요소 클릭 등 액션 직전 선캡처 프레임을 스텝 이미지로 우선 사용
  //   opts.peekPrecapture : 선캡처 프레임을 소비(폐기)하지 않고 둠 — 뒤따르는 클릭 스텝이 같은 프레임 재사용
  function flushTyping(el, finalize = true, opts = {}) {
    clearTimeout(typingTimer);
    typingTimer = null;
    const endSession = () => {
      if (finalize) {
        clearTimeout(_typingFrameTimer);
        pendingInputStep = null;
        typingTarget = null;
        typingUrl = null;
        typingFocusSnapshot = null;
      }
    };

    if (!isRecording || isPaused || isCapturing) { endSession(); return; }

    const textValue = getEditableText(el);
    const hasValue = !!textValue.trim();
    if (!hasValue) { endSession(); return; }

    if (pendingInputStep === null) {
      stepNumber += 1;
      pendingInputStep = stepNumber;
      typingUrl = location.href;
      chrome.storage.local.set({ stepNumber });  // 슬롯 예약 → nav 캡처와 번호 충돌 방지
    }
    const stepForThis = pendingInputStep;

    const label = getFieldLabel(el);
    // 입력 원문 보관 — 비밀번호 등 민감 필드는 저장하지 않는다(라벨도 '비밀번호 입력').
    // 짧으면 스텝 라벨에 '입력, "내용"'으로, 길면 본문(typedText)에 전문 보관해 매뉴얼 생성 참고자료로 쓴다.
    const isMasked  = SENSITIVE_INPUT_TYPES.has((el.type || '').toLowerCase()) || SENSITIVE_LABEL_RE.test(label);
    const typedText = isMasked ? '' : textValue;
    const safetyTimer = startCapturingSafely();
    const done = () => { clearTimeout(safetyTimer); isCapturing = false; };

    const { cx, cy } = rectCenter(el);
    const { vw, vh } = getViewportSize();
    // Preserve the original input-click target for Live Guide replay.
    const rect = el.getBoundingClientRect();
    const focusSnapshot = typingFocusSnapshot;
    const elementRect = focusSnapshot?.elementRect ?? normalizeRect(toTopRect(rect), vw, vh);
    const elementSelector = focusSnapshot?.elementSelector ?? getElementSelector(el);
    const elementXPath = focusSnapshot?.elementXPath ?? getElementXPath(el);
    const clickX = focusSnapshot?.clickX ?? cx;
    const clickY = focusSnapshot?.clickY ?? cy;
    const role = focusSnapshot?.role || el.getAttribute('role') || undefined;
    const labelDebug = focusSnapshot?.labelDebug ?? buildLabelDebug(el, label);

    lastCapturedTarget = el;
    lastCapturedTime   = Date.now();
    sendCapture({
      url: location.href, timestamp: Date.now(),
      clickX, clickY,
      windowWidth: vw, windowHeight: vh,
      viewportW: vw, viewportH: vh,
      stepNumber: stepForThis, overwrite: true, useTypingFrame: true,
      usePrecapture: !!opts.usePrecapture, peekPrecapture: !!opts.peekPrecapture,
      typedText,
      elementRect, elementSelector, elementXPath,
      actionInfo: { type: 'type', label, text: label, typedText, masked: isMasked, tag: el.tagName.toLowerCase(), role, labelDebug },
    }, done);

    endSession();
  }

  // ── 녹화 해제(로컬) ──────────────────────────────────────────────
  // STOP_RECORDING 메시지(활성 탭)와 storage.onChanged(모든 무장 탭) 양쪽에서 호출.
  // 크로스 사이트 녹화에서 STOP은 활성 탭에만 전달되므로, 나머지 탭은 storage 전파로 해제된다.
  function disarmRecordingLocal() {
    if (typingTarget) flushTyping(typingTarget, true);  // 디바운스 전 마지막 입력 텍스트 저장
    isRecording        = false;
    isPaused           = false;
    hideHoverPointer();
    clearTimeout(typingTimer);
    clearTimeout(_typingFrameTimer);
    typingTimer        = null;
    _typingFrameTimer  = null;
    typingTarget       = null;
    pendingInputStep   = null;
    typingFocusSnapshot = null;
    typingUrl          = null;
    lastCapturedTarget = null;
  }

  // ── 오버레이 헬퍼 ────────────────────────────────────────────────
  function makeBorderOverlay(rect) {
    const ov = document.createElement('div');
    applyOverlayStyle(ov, rect);
    return ov;
  }

  function applyOverlayStyle(ov, rawRect) {
    const P = 3;
    // 화면보다 큰 요소(긴 텍스트 붙여넣기 등)는 보이는 영역으로 클램프 — 테두리가 화면 밖으로 나가지 않게
    const rect = clampRectToViewport(rawRect, window.innerWidth, window.innerHeight);
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
  // 선캡처(pointerdown) 직전 호버 테두리를 제거한 뒤, 캡처가 끝나기 전 mousemove로
  // 다시 그려져 스크린샷에 굽히는 것을 막기 위한 억제 만료 시각.
  let suppressHoverUntil = 0;

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
    if (!IS_TOP_FRAME) return;
    const flash = document.createElement('div');
    flash.style.cssText = [
      'position:fixed', 'inset:0',
      'background:#fff', 'opacity:0.72',
      'pointer-events:none', 'z-index:2147483647',
      'transition:opacity 0.28s ease-out',
    ].join(';');
    document.documentElement.appendChild(flash);
    requestAnimationFrame(() => {
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 320);
    });
  }

  // ── 클릭 위치 붉은 원형 펄스 + 일시 확대 ───────────────────────
  // 캡처 직전 클릭 펄스/줌 효과 취소용 참조 — 스크린샷에 굽히지 않게
  let _pulseEl = null;

  function cancelClickEffects() {
    if (_pulseEl) { _pulseEl.remove(); _pulseEl = null; }
  }

  function showClickHighlight(x, y) {
    if (!settings.highlight) return;

    // 붉은 원형 펄스
    const pulse = document.createElement('div');
    pulse.style.cssText = [
      'position:fixed',
      `left:${x}px`, `top:${y}px`,
      'width:0', 'height:0',
      'pointer-events:none', 'z-index:2147483647',
    ].join(';');

    const ring = document.createElement('div');
    ring.style.cssText = [
      'position:absolute',
      'width:48px', 'height:48px',
      'border-radius:50%',
      'background:rgba(239,68,68,0.35)',
      'border:2.5px solid #EF4444',
      'transform:translate(-50%,-50%) scale(0)',
      'transition:transform 0.32s cubic-bezier(0.22,1,0.36,1), opacity 0.32s ease',
      'opacity:1',
    ].join(';');

    const dot = document.createElement('div');
    dot.style.cssText = [
      'position:absolute',
      'width:12px', 'height:12px',
      'border-radius:50%',
      'background:#EF4444',
      'transform:translate(-50%,-50%)',
      'box-shadow:0 0 0 3px rgba(239,68,68,0.4)',
    ].join(';');

    pulse.append(ring, dot);
    document.documentElement.appendChild(pulse);
    _pulseEl = pulse;

    requestAnimationFrame(() => {
      ring.style.transform = 'translate(-50%,-50%) scale(1)';
      setTimeout(() => {
        ring.style.opacity = '0';
        ring.style.transform = 'translate(-50%,-50%) scale(1.6)';
        setTimeout(() => {
          pulse.remove();
          if (_pulseEl === pulse) _pulseEl = null;
        }, 350);
      }, 300);
    });

  }

  // ── 녹화 시작 카운트다운 오버레이 ──────────────────────────────
  function showCountdown(onDone, opts) {
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
    badgeText.textContent = opts && opts.label ? opts.label : '화면 녹화가 시작됩니다';
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
      { text: opts && opts.startText ? opts.startText : 'START', color: opts && opts.accentColor ? opts.accentColor : '#4ade80', anim: 'mimic-start 0.4s ease forwards', size: '56px' },
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
      if (!IS_TOP_FRAME) {
        isRecording = true;
        isPaused = false;
        sendResponse({ ok: true });
        return false;
      }
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
      disarmRecordingLocal();
      sendResponse({ ok: true });
      return false;
    }

    // 크로스 사이트 녹화: 녹화 전부터 열려 있던 탭을 사용자가 활성화하면 background가 보냄.
    // 이미 무장됐거나 카운트다운 중이면 무시, 아니면 카운트다운 없이 조용히 녹화 재개.
    if (msg.type === 'RESYNC_RECORDING') {
      if (!isRecording && !_countingDown) {
        isRecording = true;
        isPaused    = !!msg.isPaused;
        if ((msg.stepNumber || 0) > stepNumber) stepNumber = msg.stepNumber || 0;
      }
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
      // 캡처 직전: 라이브 호버 테두리/클릭 펄스/줌 효과를 모두 제거해 스크린샷에 굽지 않게 한다.
      // (줌 scale(1.06)이 남아 있으면 캡처 이미지가 일그러져 어노테이션 좌표가 어긋난다)
      // 클릭/타이핑 위치 강조는 편집기가 element_rect 기준으로 비파괴 적용한다.
      hideHoverPointer();
      cancelClickEffects();
      const piiRegions = applyPIIBlur();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // viewport 크기 동봉 — 기기 에뮬레이션에서는 tab.width(실제 창)와 달라서
          // background가 이 값으로 블러 좌표를 환산해야 위치가 맞는다
          sendResponse({ ok: true, piiRegions, viewportW: window.innerWidth, viewportH: window.innerHeight });
        });
      });
      return true;
    }

    if (msg.type === 'RESTORE_OVERLAY') {
      restorePIIBlur();
      removeFileHighlight();
      isCapturing = false;
      hoverTarget = null;
      sendResponse({ ok: true });
      return false;
    }

    if (msg.type === 'MANUAL_CAPTURE_FLASH') {
      flashCapture();
      sendResponse({ ok: true });
      return false;
    }

    if (msg.type === 'SHOW_GUIDE_COUNTDOWN') {
      if (!IS_TOP_FRAME) { sendResponse({ ok: true }); return false; }
      showCountdown(() => {}, { label: 'Live Guide 시작됩니다', accentColor: '#a78bfa', startText: 'GO' });
      sendResponse({ ok: true });
      return false;
    }

    if (msg.type === 'SHOW_OVERLAY' && msg.step) {
      if (!IS_TOP_FRAME) return false;
      if (window.MimicGuide) window.MimicGuide.show(msg.step, {
        index: msg.index ?? 0,
        total: msg.total ?? 1,
        onAdvance: (reason) => chrome.runtime.sendMessage({ type: 'GUIDE_NEXT', viaClick: reason === 'click' }),
        onPrev:    () => chrome.runtime.sendMessage({ type: 'GUIDE_PREV' }),
        onExit:    () => { chrome.runtime.sendMessage({ type: 'EXIT_GUIDE' }); window.MimicGuide.hide(); },
      });
      return false;
    }
    if (msg.type === 'HIDE_OVERLAY') { if (IS_TOP_FRAME && window.MimicGuide) window.MimicGuide.hide(); return false; }

    return false;
  });

  // ── 인터랙티브 타겟 탐색 ────────────────────────────────────────
  function findInteractiveTarget(el) {
    if (!el || el === document.documentElement) return null;
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

    // 아이콘 버튼 보강 — svg/path/img/i 같은 아이콘을 클릭했는데 위 신호로 못 잡은 경우
    // (cursor:pointer가 명시 안 된 커스텀 위젯·캔버스형 에디터의 작은 아이콘 버튼),
    // 가장 가까운 '클릭 가능해 보이는' 작은 조상을 타겟으로 삼는다. 아이콘 클릭에만 한정해 오탐 방지.
    const tag0 = el.tagName ? el.tagName.toLowerCase() : '';
    const cls0 = typeof el.className === 'string' ? el.className : (el.className?.baseVal ?? '');
    const ICON_TAG  = /^(svg|path|use|symbol|polygon|circle|rect|g|img|i)$/;
    const ICONISH   = /(^|[-_ ])(icon|btn|button|action|clickable|toggle|chip|fab|plus|add|menu|caret|arrow|close|more|kebab|dots|trigger)([-_ ]|$)/i;
    if (ICON_TAG.test(tag0) || ICONISH.test(cls0)) {
      cur = el;
      for (let i = 0; i < 6; i++) {
        if (!cur || cur === document.documentElement || cur === document.body) break;
        const cs   = window.getComputedStyle(cur);
        const ccls = typeof cur.className === 'string' ? cur.className : (cur.className?.baseVal ?? '');
        const looksClickable =
          cs.cursor === 'pointer' ||
          cur.getAttribute('role') ||
          cur.getAttribute('aria-label') || cur.getAttribute('title') ||
          cur.getAttribute('aria-haspopup') != null || cur.getAttribute('aria-expanded') != null ||
          cur.hasAttribute('onclick') || cur.getAttribute('tabindex') != null ||
          ICONISH.test(ccls);
        const r = cur.getBoundingClientRect();
        const sized = r.width > 0 && r.height > 0 &&
                      r.width <= window.innerWidth * 0.5 && r.height <= window.innerHeight * 0.5;
        if (looksClickable && sized) return cur;
        cur = cur.parentElement;
      }
    }

    return null;
  }

  // ── 엘리먼트 메타 추출 ───────────────────────────────────────────
  function cleanLabelText(value, max = 80) {
    return (value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  const GENERIC_LABEL_RE = /^(edit|button|menu|link|image|presentation|document|textbox|text box|input|field|item|option|open|close|more|toolbar)$/i;

  function isGenericLabel(label) {
    const cleaned = cleanLabelText(label).toLowerCase();
    return !cleaned || GENERIC_LABEL_RE.test(cleaned);
  }

  function isGoogleFileAreaGeneric(label) {
    const cleaned = cleanLabelText(label).toLowerCase();
    return location.hostname === 'docs.google.com' && /^(edit|presentation|document)$/.test(cleaned);
  }

  function getGoogleFileTitle() {
    if (location.hostname !== 'docs.google.com') return '';

    const candidates = [
      document.querySelector('[data-tooltip="Rename"]'),
      document.querySelector('[aria-label*="Rename" i]'),
      document.querySelector('[role="textbox"][aria-label*="title" i]'),
      document.querySelector('[role="textbox"][aria-label*="name" i]'),
      document.querySelector('input[aria-label*="title" i]'),
      document.querySelector('input[aria-label*="name" i]'),
    ].filter(Boolean);

    for (const el of candidates) {
      const text =
        cleanLabelText(el.getAttribute('aria-label')) ||
        cleanLabelText(el.getAttribute('data-tooltip')) ||
        cleanLabelText(el.getAttribute('value')) ||
        cleanLabelText(el.textContent);
      const cleaned = text.replace(/^(rename|edit)\s*/i, '').trim();
      if (cleaned && !isGenericLabel(cleaned)) return cleaned.slice(0, 80);
    }

    const title = cleanLabelText(document.title.replace(/\s*-\s*Google (Slides|Docs|Sheets).*$/i, ''));
    return isGenericLabel(title) ? '' : title;
  }

  function directText(el) {
    if (!el) return '';
    return cleanLabelText(
      [...el.childNodes]
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent || '')
        .join(' ')
    );
  }

  function isIconOnly(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    if (/^(svg|path|use|symbol|polygon|circle|rect|g|img|i)$/.test(tag)) return true;
    const cls = typeof el.className === 'string' ? el.className : (el.className?.baseVal ?? '');
    return /(^|[-_ ])(icon|caret|arrow|close|more|kebab|dots)([-_ ]|$)/i.test(cls) && !cleanLabelText(el.textContent);
  }

  function bestLabelFrom(el) {
    if (!el || !el.getAttribute) return '';
    const raw = collectLabelCandidates(el);
    const specific = [
      raw.ariaLabel,
      raw.title,
      raw.describedBy,
      raw.directText,
      raw.rawText,
      raw.placeholder,
      raw.value,
      raw.name,
      raw.googleFileTitle,
    ].find(v => v && !isGenericLabel(v));
    return specific || raw.googleFileTitle || raw.directText || raw.rawText || raw.ariaLabel || raw.title || raw.role || '';
  }

  function textFromIds(ids) {
    return (ids || '')
      .split(/\s+/)
      .map(id => document.getElementById(id))
      .filter(Boolean)
      .map(el => cleanLabelText(el.textContent))
      .filter(Boolean)
      .join(' ');
  }

  function collectLabelCandidates(el) {
    return {
      ariaLabel: cleanLabelText(el?.getAttribute?.('aria-label')),
      title: cleanLabelText(el?.getAttribute?.('title')),
      describedBy: cleanLabelText(textFromIds(el?.getAttribute?.('aria-describedby'))),
      directText: directText(el),
      rawText: cleanLabelText(el?.textContent),
      placeholder: cleanLabelText(el?.getAttribute?.('placeholder')),
      value: cleanLabelText(el?.getAttribute?.('value')),
      name: cleanLabelText(el?.getAttribute?.('name')),
      role: cleanLabelText(el?.getAttribute?.('role')),
      googleFileTitle: getGoogleFileTitle(),
    };
  }

  function labelFallbackReason(candidates, chosenLabel) {
    if (!chosenLabel) return 'empty';
    if (candidates.ariaLabel && isGenericLabel(candidates.ariaLabel) && chosenLabel !== candidates.ariaLabel) return 'generic-aria-label';
    if (candidates.title && isGenericLabel(candidates.title) && chosenLabel !== candidates.title) return 'generic-title';
    if (candidates.rawText && isGenericLabel(candidates.rawText) && chosenLabel !== candidates.rawText) return 'generic-visible-text';
    return 'primary';
  }

  function buildLabelDebug(el, chosenLabel) {
    const candidates = collectLabelCandidates(el);
    return {
      chosenLabel,
      rawText: candidates.rawText || null,
      ariaLabel: candidates.ariaLabel || null,
      title: candidates.title || null,
      role: candidates.role || null,
      selector: getElementSelector(el),
      fallbackReason: labelFallbackReason(candidates, chosenLabel),
    };
  }

  function refineActionTarget(clickedEl, target) {
    if (!clickedEl || !target || clickedEl === target) return target;
    const node = clickedEl.nodeType === Node.ELEMENT_NODE ? clickedEl : clickedEl.parentElement;
    if (!node || !target.contains(node)) return target;

    let cur = node;
    while (cur && cur !== target && cur !== document.body && cur !== document.documentElement) {
      const label = bestLabelFrom(cur);
      if (label && !isIconOnly(cur)) return cur;
      cur = cur.parentElement;
    }

    const semantic = node.closest('[role="menuitem"],[role="option"],[role="tab"],[role="button"],[role="link"],button,a[href],label,select,input,textarea,[onclick],[tabindex]:not([tabindex="-1"])');
    if (semantic && target.contains(semantic)) return semantic;
    return target;
  }

  function getElementLabel(el, clickedEl = null) {
    const clickedLabel = clickedEl && clickedEl !== el && !isIconOnly(clickedEl)
      ? bestLabelFrom(clickedEl)
      : '';
    const ownLabel = bestLabelFrom(el);
    if (ownLabel && !isGenericLabel(ownLabel)) return ownLabel;
    if (clickedLabel && !isGenericLabel(clickedLabel)) return clickedLabel;
    if (isGoogleFileAreaGeneric(ownLabel) || isGoogleFileAreaGeneric(clickedLabel)) {
      return getGoogleFileTitle() || '파일명 영역';
    }
    return getGoogleFileTitle() || ownLabel || clickedLabel || '';
  }

  // Freeze click metadata before the target DOM can react or move.

  function buildPointerDownSnapshot(captureEl, target, clickedEl, event) {
    if (!captureEl || typeof captureEl.getBoundingClientRect !== 'function') return null;
    const rect = captureEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const { vw, vh } = getViewportSize();
    const topClick = toTopPoint(event.clientX, event.clientY);
    const label = getElementLabel(captureEl, clickedEl);
    return {
      target: captureEl,
      time: Date.now(),
      x: event.clientX,
      y: event.clientY,
      clickX: topClick.x,
      clickY: topClick.y,
      elementRect: normalizeRect(toTopRect(rect), vw, vh),
      elementSelector: getElementSelector(captureEl),
      elementXPath: getElementXPath(captureEl),
      label,
      role: captureEl.getAttribute('role') || target.getAttribute('role') || undefined,
      labelDebug: buildLabelDebug(captureEl, label),
    };
  }

  function getRecentPointerSnapshot(event) {
    if (!_pointerDownSnapshot) return null;
    if ((Date.now() - _pointerDownSnapshot.time) > 1200) return null;
    if (Math.abs(_pointerDownSnapshot.x - event.clientX) > 12) return null;
    if (Math.abs(_pointerDownSnapshot.y - event.clientY) > 12) return null;
    return _pointerDownSnapshot;
  }

  // 클래스가 안정적인지 판정 — 상태 클래스·CSS-in-JS 해시·동적 토큰을 거부(셀렉터 견고성의 핵심)
  function isStableClass(c) {
    if (!c || c.length > 30) return false;
    if (/is-|has-|active|hover|focus|selected|disabled|loading|error|open|closed/.test(c)) return false;
    if (/^css-[0-9a-z]+/i.test(c)) return false;                   // emotion
    if (/^sc-[0-9a-zA-Z]+$/.test(c)) return false;                 // styled-components
    if (/^jsx-\d+$/.test(c)) return false;                         // styled-jsx
    if (/__[A-Za-z0-9]{4,}$/.test(c)) return false;                // CSS Modules 해시 접미사
    if (/(?:^|[-_])[0-9a-f]{6,}(?:[-_]|$)/i.test(c)) return false; // 16진 해시 세그먼트
    if (/\d{4,}/.test(c)) return false;                            // 4자리+ 연속 숫자(카운터/해시)
    return true;
  }

  // id가 안정적인지 판정 — 프레임워크 생성 동적 id(React useId, Radix 등)를 거부
  function isStableId(id) {
    if (!id || id.length > 60) return false;
    if (/^(radix-|headlessui-|react-select-|downshift-|rc_select_|mui-|ember\d|:|«)/i.test(id)) return false;
    if (/:r[0-9a-z]+:?/i.test(id)) return false;  // React useId
    if (/[0-9a-f]{8,}/i.test(id)) return false;   // 긴 해시 세그먼트
    return true;
  }

  function getElementSelector(el) {
    try {
      if (el.id && isStableId(el.id)) return `#${CSS.escape(el.id)}`;
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
        if (node.id && isStableId(node.id)) return `#${CSS.escape(node.id)}`;

        const stableClasses = [...node.classList].filter(isStableClass).slice(0, 2);
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

      const cls = [...el.classList].filter(isStableClass).slice(0, 2).map(c => `.${CSS.escape(c)}`).join('');
      return tag + cls;
    } catch { return ''; }
  }

  // XPath 리터럴 — 텍스트에 따옴표가 섞여도 안전하게 감싼다
  function xpathLiteral(s) {
    if (s.indexOf("'") === -1) return `'${s}'`;
    if (s.indexOf('"') === -1) return `"${s}"`;
    return 'concat(' + s.split("'").map(p => `'${p}'`).join(`,"'",`) + ')';
  }

  function countXPath(xp) {
    try {
      return document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength;
    } catch { return -1; }
  }

  // 안정 id를 앵커로 구조 XPath 생성 (id 없으면 루트까지 tag[index] 경로)
  function buildXPath(node) {
    const segs = [];
    let cur = node;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      if (cur.id && isStableId(cur.id)) {
        segs.unshift(`//*[@id=${xpathLiteral(cur.id)}]`);
        return segs.join('/');
      }
      const t = cur.tagName.toLowerCase();
      const sibs = cur.parentElement ? [...cur.parentElement.children].filter(c => c.tagName === cur.tagName) : [cur];
      const idx = sibs.indexOf(cur) + 1;
      segs.unshift(sibs.length > 1 ? `${t}[${idx}]` : t);
      cur = cur.parentElement;
    }
    return '/' + segs.join('/');
  }

  // 견고한 XPath — 짧고 고유한 보이는 텍스트 앵커 우선(Typeform 질문/버튼에 강함), 없으면 구조 경로
  function getElementXPath(el) {
    try {
      const tag = el.tagName.toLowerCase();
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (text && text.length <= 40) {
        const xp = `//${tag}[normalize-space(.)=${xpathLiteral(text)}]`;
        if (countXPath(xp) === 1) return xp;
      }
      const path = buildXPath(el);
      return path.length <= 480 ? path : '';
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
    if (tag === 'input' || tag === 'textarea' || el.isContentEditable || el.getAttribute('role') === 'textbox') return 'focus_input';
    if (document.designMode === 'on' && tag === 'body') return 'focus_input';
    return 'click';
  }

  // ── 호버 이벤트 ──────────────────────────────────────────────────
  document.addEventListener('mousemove', (e) => {
    if (!isRecording || isPaused) { hideHoverPointer(); return; }
    // '클릭 하이라이트' 설정 OFF 시 호버 테두리도 표시하지 않는다
    // (설정 문구가 "클릭한 요소 주변 빨간 테두리" — 펄스와 테두리 둘 다 이 설정 소관)
    if (!settings.highlight) { hideHoverPointer(); return; }
    if (isCapturing && (Date.now() - isCapturingStart) >= CAPTURE_SAFETY_MS) isCapturing = false;
    if (isCapturing) return;
    if (Date.now() < suppressHoverUntil) return;  // 선캡처 윈도우 — 테두리 재등장 금지
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

  // ── 클릭 직전 프레임 선캡처 ──────────────────────────────────────
  // pointerdown은 click보다 먼저, 페이지가 클릭에 반응(리플로우/전환)하기 전에 발생한다.
  // 이 시점에 미리 한 장 찍어두면, 클릭으로 레이아웃이 바뀌기 전 화면을 스텝
  // 스크린샷으로 쓸 수 있어 클릭 좌표·하이라이트가 실제 화면과 어긋나지 않는다.
  document.addEventListener('pointerdown', (e) => {
    if (!isRecording || isPaused || isCapturing) return;
    if (e.button !== undefined && e.button !== 0) return;  // 좌클릭만
    const target = findInteractiveTarget(e.target);
    if (!target) return;
    const actionTarget = refineActionTarget(e.target, target);
    const actionType = getActionType(target);
    const captureEl = actionType === 'focus_input' ? target : actionTarget;
    _pointerDownSnapshot = buildPointerDownSnapshot(captureEl, target, e.target, e);
    hideHoverPointer();                          // 호버 테두리 제거
    suppressHoverUntil = Date.now() + 500;       // 캡처 끝날 때까지 재등장 억제
    // 테두리 제거가 화면에 리페인트된 다음 프레임에 선캡처 요청 — 라이브 캡처 경로의
    // double-rAF와 동일한 보장. (동기 전송 시 background가 리페인트 전 프레임을 잡아 테두리가 굽힘)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      chrome.runtime.sendMessage({ type: 'PRECAPTURE_FRAME' }, () => { void chrome.runtime.lastError; });
    }));
  }, true);

  // ── 클릭 캡처 ────────────────────────────────────────────────────
  document.addEventListener('click', handleClick, true);

  function handleClick(e) {
    if (!isRecording || isPaused || isCapturing) {
      if (isCapturing) log('debug', `click skipped — isCapturing step ${stepNumber}`);
      return;
    }
    // 크로스 사이트 녹화: 로드된 모든 탭이 무장되므로, 이 탭이 화면에 보일 때만 캡처한다.
    // (백그라운드 탭의 프로그래매틱 클릭은 captureVisibleTab이 활성 탭을 잡아 오발됨)
    if (document.visibilityState !== 'visible') return;

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

      showClickHighlight(e.clientX, e.clientY);
      const safetyTimer = startCapturingSafely();
      stepNumber        += 1;
      lastCapturedTarget = document.body;
      lastCapturedTime   = now;
      const { vw, vh } = getViewportSize();
      const topClick = toTopPoint(e.clientX, e.clientY);
      log('debug', `blank click step ${stepNumber} at (${e.clientX}, ${e.clientY})`);
      sendCapture({
        url: location.href, timestamp: Date.now(),
        clickX: topClick.x, clickY: topClick.y,
        windowWidth: vw, windowHeight: vh,
        viewportW: vw, viewportH: vh,
        stepNumber,
        elementRect: null, elementSelector: null,
        actionInfo: { type: 'click', label: '화면 클릭', tag: clickedEl.tagName.toLowerCase(), labelDebug: { chosenLabel: '화면 클릭', rawText: null, ariaLabel: null, title: null, role: null, selector: null, fallbackReason: 'blank-click' } },
      }, () => { clearTimeout(safetyTimer); isCapturing = false; });
      return;
    }

    const actionTarget = refineActionTarget(clickedEl, target);
    const now = Date.now();
    const actionType = getActionType(target);
    if (actionType !== 'focus_input' && actionTarget === lastCapturedTarget && (now - lastCapturedTime) < DEDUP_SAME_ELEMENT) return;

    // 입력 필드 포커스: typingTarget 세팅 + 클릭 자체도 캡처 (항상 캡처 정책)
    if (actionType === 'focus_input') {
      // 같은 입력칸을 짧은 간격으로 다시 클릭하면 중복 '입력 필드' 클릭 스텝을 만들지 않는다.
      // (DEDUP_REFOCUS_MS 경과 후 재클릭은 의도가 있다고 보고 다시 캡처.) 타이핑 세션은 유지.
      if (target === lastFocusInputTarget && (now - lastFocusInputTime) < DEDUP_REFOCUS_MS) {
        typingTarget = target;
        typingFocusSnapshot = getRecentPointerSnapshot(e) || typingFocusSnapshot;
        return;  // 클릭 스텝 캡처 생략
      }
      // 다른 필드로 옮겼을 때만 이전 입력을 마감(flush가 세션을 끝냄 → 새 스텝).
      // 같은 필드 재클릭·리치 에디터 재마운트는 세션을 유지해 입력 스텝이 쪼개지지 않게 한다.
      if (typingTarget && typingTarget !== target && !isRemountedTyping(typingTarget)) {
        flushTyping(typingTarget, true, { usePrecapture: true, peekPrecapture: true });
      }
      typingTarget = target;
      typingFocusSnapshot = getRecentPointerSnapshot(e);
      lastFocusInputTarget = target;
      lastFocusInputTime   = now;
      if (!settings.captureInputClicks) return;
      // 아래로 진행해서 캡처
    } else {
      // 진행 중이던 타이핑 flush — 클릭(액션) 직전 선캡처 프레임을 타이핑 스텝 이미지로 쓰고,
      // 소비하지 않아(peek) 아래 클릭 스텝이 같은 프레임을 재사용한다.
      if (typingTarget) flushTyping(typingTarget, true, { usePrecapture: true, peekPrecapture: true });
    }

    showClickHighlight(e.clientX, e.clientY);

    const captureEl = actionType === 'focus_input' ? target : actionTarget;
    const pointerSnapshot = getRecentPointerSnapshot(e);
    const rect  = captureEl.getBoundingClientRect();
    const label = pointerSnapshot?.label || getElementLabel(captureEl, clickedEl);
    const href  = captureEl.getAttribute('href') || captureEl.closest('a')?.getAttribute('href') || target.getAttribute('href') || target.closest('a')?.getAttribute('href') || '';
    const role  = pointerSnapshot?.role || captureEl.getAttribute('role') || target.getAttribute('role') || undefined;
    const { vw, vh } = getViewportSize();
    const topClick = toTopPoint(e.clientX, e.clientY);
    const elementRect = pointerSnapshot?.elementRect ?? normalizeRect(toTopRect(rect), vw, vh);
    const elementSelector = pointerSnapshot?.elementSelector ?? getElementSelector(captureEl);
    const elementXPath = pointerSnapshot?.elementXPath ?? getElementXPath(captureEl);
    const labelDebug = pointerSnapshot?.labelDebug ?? buildLabelDebug(captureEl, label);

    // navigate 클릭(링크 등)도 '사용자 클릭'이므로 클릭 스텝으로만 캡처한다.
    // 이동 후 도착 페이지는 더 이상 자동 캡처하지 않는다 (페이지 이동 캡처 제거).
    if (actionType === 'navigate') {
      log('debug', `navigate-as-click step ${stepNumber + 1} el=${target.tagName} href=${href.slice(0, 60)}`);
      const navSafetyTimer = startCapturingSafely();
      stepNumber        += 1;
      lastCapturedTarget = captureEl;
      lastCapturedTime   = now;

      const srcStep = {
        url: location.href, timestamp: Date.now(),
        clickX: topClick.x, clickY: topClick.y,
        windowWidth: vw, windowHeight: vh,
        viewportW: vw, viewportH: vh,
        stepNumber, usePrecapture: true,
        elementRect,
        elementSelector,
        elementXPath,
        actionInfo:      { type: 'click', label, tag: captureEl.tagName.toLowerCase(), role, href: href.slice(0, 200), labelDebug },
      };

      sendCapture(srcStep, () => { clearTimeout(navSafetyTimer); isCapturing = false; });
      return;
    }

    const safetyTimer = startCapturingSafely();
    stepNumber        += 1;
    lastCapturedTarget = captureEl;
    lastCapturedTime   = now;

    const stepData = {
      url: location.href, timestamp: Date.now(),
      clickX: topClick.x, clickY: topClick.y,
      windowWidth: vw, windowHeight: vh,
      viewportW: vw, viewportH: vh,
      stepNumber, usePrecapture: true,
      elementRect,
      elementSelector,
      elementXPath,
      actionInfo:      { type: actionType, label, tag: captureEl.tagName.toLowerCase(), role, href: href.slice(0, 200), labelDebug },
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

  // ── 타이핑 '완료' 프레임 예약 ────────────────────────────────────
  // 입력이 TYPING_FRAME_SETTLE 동안 멈추면(=조합 완료·화면 안정) '전송 직전' 프레임을 1장 버퍼링한다.
  // 매 키 입력마다 찍는 throttle 프레임에는 조합 중간값("주")이 남을 수 있어, 멈춤 시점 프레임으로 덮어쓴다.
  function scheduleTypingFrame() {
    clearTimeout(_typingFrameTimer);
    _typingFrameTimer = setTimeout(() => {
      if (_isComposing) return;  // 아직 조합 중이면 미완성값 — 건너뜀
      hideHoverPointer();        // 호버 테두리가 프레임에 끼지 않게
      chrome.runtime.sendMessage({ type: 'TYPING_FRAME' }, () => { void chrome.runtime.lastError; });
    }, TYPING_FRAME_SETTLE);
  }

  // ── input 이벤트 (타이핑 추적) ──────────────────────────────────
  document.addEventListener('input', (e) => {
    if (!isRecording || isPaused) return;
    if (document.visibilityState !== 'visible') return;  // 보이는 탭에서만 (크로스 사이트 녹화)
    const el = getEditableTarget(e.target);
    if (!el) return;

    if (typingTarget && typingTarget !== el) {
      if (isRemountedTyping(typingTarget)) {
        // 같은 필드의 노드 교체 — 세션 유지한 채 타겟만 갱신 (스텝 분할 금지)
        log('debug', `typing target remounted — keep session step ${pendingInputStep}`);
      } else {
        flushTyping(typingTarget);  // 진짜 다른 필드 → 이전 입력 마감
      }
    }
    typingTarget = el;
    notifyTypingProgress(el);

    // 전송 직전 화면을 확보하기 위한 롤링 프레임 — throttle로 쿼터(초당 2회) 보호.
    // 확정(flushTyping) 시 background가 이 최신 프레임을 스텝 이미지로 사용한다.
    // (즉시 Enter/이동 같은 멈춤 없는 케이스용 폴백 — 멈춤 시 settle 프레임이 덮어쓴다.)
    const nowTf = Date.now();
    if (nowTf - _lastTypingFrameTime > TYPING_FRAME_THROTTLE) {
      _lastTypingFrameTime = nowTf;
      hideHoverPointer();  // 호버 테두리가 프레임에 굽히지 않게
      chrome.runtime.sendMessage({ type: 'TYPING_FRAME' }, () => { void chrome.runtime.lastError; });
    }
    // 입력이 잠깐 멈춘 '완료' 시점에 완성 화면을 1장 더 버퍼링 → 어느 경로로 flush되든 최종값 보장.
    scheduleTypingFrame();

    if (pendingInputStep === null) {
      stepNumber += 1;
      pendingInputStep = stepNumber;
      typingUrl = location.href;
      chrome.storage.local.set({ stepNumber });  // 슬롯 예약 (nav 캡처 번호 충돌 방지)
    }

    // 입력 중에는 캡처하지 않는다. Enter/포커스 이동/다른 요소 클릭/종료 시에만 확정 캡처한다.
    clearTimeout(typingTimer);
    typingTimer = null;
  }, true);

  // ── IME 조합 추적 (한/일/중) ──────────────────────────────────────
  // compositionstart~end 사이의 input 값은 미완성 조합("중ㄱ")이다.
  // 조합 중에는 디바운스 flush를 막고, 조합 완료(compositionend) 후 최종값("중계")으로 재예약한다.
  document.addEventListener('compositionstart', () => { _isComposing = true; }, true);
  document.addEventListener('compositionend', (e) => {
    _isComposing = false;
    if (!isRecording || isPaused) return;
    const el = getEditableTarget(e.target);
    if (typingTarget !== el) return;
    // 조합 완료 후 완성 화면 프레임만 갱신한다. 캡처는 명시적인 완료 신호에서만 한다.
    scheduleTypingFrame();
    clearTimeout(typingTimer);
    typingTimer = null;
  }, true);

  // 크로스 사이트 녹화: 타이핑 중 다른 탭으로 전환하면 진행 중 입력을 즉시 확정한다.
  // 디바운스 타이머가 탭이 숨겨진 뒤 발동하면 captureVisibleTab이 새 활성 탭을 잡으므로,
  // 아직 타이핑 프레임이 신선한 가시→비가시 전환 순간에 버퍼 프레임으로 마감한다.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isRecording && !isPaused && typingTarget) {
      flushTyping(typingTarget, true);
    }
  });

  // ── keydown: Enter = flush ────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (!isRecording || isPaused) return;
    if (e.isComposing) return;  // IME 조합 확정용 Enter — 미완성값 flush 방지
    if (e.key !== 'Enter' || !typingTarget) return;
    const el            = getEditableTarget(e.target);
    if (!el) return;
    const isSingleLine  = el instanceof HTMLInputElement;
    const isMultiLine   = el instanceof HTMLTextAreaElement || el.isContentEditable;
    const isModified    = e.ctrlKey || e.metaKey;
    if (isSingleLine || (isMultiLine && isModified)) {
      // Enter 제출 직전(폼 제출·페이지 이동·입력창 초기화 전) 화면을 그 순간 선캡처해
      // 타이핑 스텝 이미지로 쓴다 — 클릭의 pointerdown 선캡처와 동일한 '액션 정렬' 기법.
      hideHoverPointer();
      chrome.runtime.sendMessage({ type: 'PRECAPTURE_FRAME' }, () => { void chrome.runtime.lastError; });
      flushTyping(el, true, { usePrecapture: true });
    }
  }, true);

  // ── focusout: 필드 이탈 = 입력 확정 (Tango식 "필드 단위 = 한 스텝") ───────
  // 이메일·문서처럼 Enter로 끝나지 않는 긴 입력은, 다른 요소로 포커스가 옮겨갈 때
  // 최종 내용을 한 번 캡처해 확정한다. relatedTarget(다음 포커스 대상)이 있을 때만 —
  // 창 전환(사이드패널 클릭 등 window blur)으로 인한 조기 확정은 피한다.
  document.addEventListener('focusout', (e) => {
    if (!isRecording || isPaused) return;
    const el = getEditableTarget(e.target);
    if (!typingTarget || el !== typingTarget) return;
    if (!e.relatedTarget && IS_TOP_FRAME) return;  // 페이지 밖으로 포커스 이탈(창 전환)은 무시
    // relatedTarget(다음 포커스 대상)이 있다 = 그 요소의 pointerdown 선캡처가 떠 있다.
    // 그 '액션 직전' 프레임(완성 텍스트)을 타이핑 스텝 이미지로 쓰고, peek로 클릭 스텝과 공유한다.
    flushTyping(typingTarget, true, { usePrecapture: true, peekPrecapture: true });
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
          actionInfo: { type: 'upload', label: fileNames, text: fileNames, tag: 'input' },
        }, () => { clearTimeout(safetyTimer); isCapturing = false; });
      }));
    }, 400);
  }, true);

  // ── storage 변경 감지 (isPaused 동기화) ─────────────────────────
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    // 크로스 사이트 녹화: 녹화 종료를 storage로 전파받아 모든 무장 탭이 동시에 해제된다.
    // (STOP_RECORDING 메시지는 활성 탭 하나에만 가므로, 다른 탭은 이 경로로 멈춘다.)
    if ('isRecording' in changes && changes.isRecording.newValue === false && isRecording) {
      disarmRecordingLocal();
    }
    if ('isPaused' in changes) isPaused = !!changes.isPaused.newValue;
    // 설정 변경을 storage에서 직접 동기화 — UPDATE_SETTINGS 메시지가 유실되어도
    // (탭 이동 직후 등) 하이라이트/PII 토글이 즉시 반영되게 한다.
    if ('settings' in changes) {
      settings = { ...settings, ...(changes.settings.newValue || {}) };
      if (!settings.highlight) hideHoverPointer();
    }
    // background(페이지 이동 캡처 등)가 stepNumber를 올리면 로컬 카운터도 따라 올려
    // content/background 양쪽 카운터 desync로 인한 stepNumber 충돌을 방지한다.
    if ('stepNumber' in changes) {
      const v = changes.stepNumber.newValue || 0;
      if (v > stepNumber) stepNumber = v;
    }
  });

  // SPA 페이지 이동 자동 캡처는 제거됨 — 사용자 클릭/타이핑만 스텝으로 담는다.
  // (이동의 결과 화면은 다음 사용자 액션에서 자연스럽게 캡처됨)

  // ── 클립보드 붙여넣기로 수동 스크린샷 수신 ──────────────────────
  document.addEventListener('paste', (e) => {
    if (!isRecording || isPaused || isCapturing) return;
    const active = document.activeElement;
    if (getEditableTarget(active)) return;

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
  // 오버레이 렌더링/요소탐지/자동진행은 guide-engine.js(window.MimicGuide)가 담당.
  // (content_scripts에서 content.js보다 먼저 로드됨) SHOW_OVERLAY/HIDE_OVERLAY 핸들러 참조.
})();
