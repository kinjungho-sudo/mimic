(() => {
  let isRecording = false;
  let isPaused    = false;
  let isCapturing = false;
  let stepNumber  = 0;

  let settings = {
    highlight:   true,
    flash:       true,
    captureMode: 'interactive',
    quality:     82,
    autoNav:     false,
    piiBlur:     true,
  };

  // ── 중복 방지 상태 ───────────────────────────────────────────────
  // 마지막으로 캡처한 요소와 타임스탬프를 기억해 동일 요소 재클릭 무시
  let lastCapturedTarget    = null;
  let lastCapturedTime      = 0;
  const DEDUP_SAME_ELEMENT  = 1200; // ms — 같은 요소 재클릭 무시 간격
  const DEDUP_DOUBLE_CLICK  = 400;  // ms — 더블클릭 감지 간격

  // ── 타이핑 추적 ──────────────────────────────────────────────────
  let typingTarget      = null;  // 현재 입력 중인 엘리먼트
  let pendingInputStep  = null;  // 타이핑 덮어쓰기용 stepNumber
  let typingTimer       = null;  // 입력 멈춤 감지 타이머
  const TYPING_DEBOUNCE = 1500;  // ms — 입력 멈춤 후 자동 캡처 대기

  // 캡처 신호:
  //   1) 입력 멈춤 1.5초 후 자동 캡처 (타이머 기반, 덮어쓰기)
  //   2) Enter (single-line input)
  //   3) Ctrl/Meta+Enter (textarea, contenteditable — 채팅 제출)
  //   4) 다른 인터랙티브 요소로 포커스 이동 (클릭 핸들러에서 처리)

  // 필드의 역할을 설명하는 레이블 추출 (실제 값 대신 사용)
  function getFieldLabel(el) {
    // designMode 문서의 body — 이메일 본문 등
    if (document.designMode === 'on' && el === document.body) return '본문';
    // 1. <label for="id"> 연결
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return label.textContent.trim().slice(0, 60);
    }
    // 2. 감싸는 <label>
    const parentLabel = el.closest('label');
    if (parentLabel) {
      const text = parentLabel.textContent.trim().slice(0, 60);
      if (text) return text;
    }
    // 3. aria-label / placeholder / title
    return (
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      el.getAttribute('title') ||
      el.getAttribute('name') ||
      '텍스트'
    ).trim().slice(0, 60);
  }

  // ── PII 감지 패턴 ──────────────────────────────────────────────
  // 오탐 없이 확실한 패턴만 자동 블러. 주소·카드·계좌는 드래그 블러로 처리.
  const PII_PATTERNS = [
    { type: 'email',    re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g },
    { type: 'phone_kr', re: /0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/g },
    { type: 'rrn',      re: /\d{6}-[1-4]\d{6}/g },
  ];

  // 비밀번호 필드만 자동 숨김 — 나머지는 드래그 블러
  const SENSITIVE_INPUT_TYPES = new Set(['password']);
  const SENSITIVE_LABEL_RE = /비밀번호|패스워드|password/i;

  let _blurredEls = [];

  function applyPIIBlur() {
    if (!settings.piiBlur) return [];
    _blurredEls = [];
    const regions = [];

    // 1) 민감 input/textarea — 필드 자체를 숨김
    document.querySelectorAll('input, textarea, select').forEach(el => {
      const type  = (el.type || '').toLowerCase();
      const label = getFieldLabel(el);
      if (!SENSITIVE_INPUT_TYPES.has(type) && !SENSITIVE_LABEL_RE.test(label)) return;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const orig = el.style.cssText;
      // visibility:hidden 만으로는 input의 value 텍스트가 사라지지 않을 수 있어
      // color:transparent를 함께 적용해 텍스트 픽셀을 확실히 제거
      el.style.visibility = 'hidden';
      el.style.color = 'transparent';
      _blurredEls.push({ el, orig });
      regions.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, type: 'input' });
    });

    // 2) 텍스트 노드에서 PII 패턴 탐지 → span으로 래핑 후 숨김
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    // 이미 숨긴 span의 자식 노드는 중복 처리 방지
    const processedNodes = new WeakSet();

    for (const node of textNodes) {
      if (processedNodes.has(node)) continue;
      const text = node.textContent;
      if (!text.trim()) continue;

      let matched = false;

      // 2-a) PII 정규식 매칭
      for (const { type, re } of PII_PATTERNS) {
        re.lastIndex = 0;
        if (!re.test(text)) continue;

        const range = document.createRange();
        range.selectNode(node);
        const rects = range.getClientRects();
        for (const rect of rects) {
          if (rect.width === 0 || rect.height === 0) continue;
          regions.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, type });
        }
        matched = true;
        break;
      }

      // 2-b) 민감 컨테이너 탐지 — "배송지 | 이름" 텍스트와 같은 줄/직계 형제인 경우만
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
      const rects = range.getClientRects();
      for (const rect of rects) {
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

  function notifyTypingProgress(el) {
    const label = getFieldLabel(el);
    const isMasked = SENSITIVE_INPUT_TYPES.has((el.type || '').toLowerCase()) || SENSITIVE_LABEL_RE.test(label);
    const value = isMasked ? '' : (el.isContentEditable ? (el.textContent || '') : (el.value || ''));
    chrome.runtime.sendMessage({ type: 'TYPING_PROGRESS', text: value, label, masked: isMasked }, () => { void chrome.runtime.lastError; });
  }

  function flushTyping(el) {
    clearTimeout(typingTimer);
    typingTimer = null;
    if (!isRecording || isPaused || isCapturing) { typingTarget = null; pendingInputStep = null; return; }
    // isCapturing을 즉시 선점 — sendMessage 호출 전 다른 이벤트가 진입하지 못하도록
    isCapturing = true;
    typingTarget = null;
    const hasValue = el ? (el.isContentEditable ? !!(el.textContent || '').trim() : !!(el.value || '').trim()) : false;

    if (!hasValue) {
      // 타이핑 없이 필드를 떠남 — focus_input 스텝은 이미 찍혔으니 그대로 유지
      isCapturing = false;
      pendingInputStep = null;
      return;
    }

    const label = getFieldLabel(el);

    // pendingInputStep이 있으면 focus_input 스텝을 type으로 덮어쓰기
    // 없으면(타이핑만 감지된 경우) 새 스텝 생성
    const overwriteStep = pendingInputStep;
    pendingInputStep = null;

    if (overwriteStep !== null) {
      // 같은 stepNumber로 재캡처 — background.js의 saveStepLocally가 덮어씀
      lastCapturedTarget = el;
      lastCapturedTime   = Date.now();
      chrome.runtime.sendMessage({
        type: 'CAPTURE_SCREENSHOT',
        stepData: {
          url: location.href, timestamp: Date.now(),
          clickX: 0, clickY: 0,
          windowWidth: window.innerWidth, windowHeight: window.innerHeight,
          stepNumber: overwriteStep,
          overwrite: true,
          actionInfo: { type: 'type', text: label },
        },
      }, () => { void chrome.runtime.lastError; isCapturing = false; });
    } else {
      stepNumber  += 1;
      lastCapturedTarget = el;
      lastCapturedTime   = Date.now();
      chrome.runtime.sendMessage({
        type: 'CAPTURE_SCREENSHOT',
        stepData: {
          url: location.href, timestamp: Date.now(),
          clickX: 0, clickY: 0,
          windowWidth: window.innerWidth, windowHeight: window.innerHeight,
          stepNumber,
          actionInfo: { type: 'type', text: label },
        },
      }, () => { void chrome.runtime.lastError; isCapturing = false; });
    }
  }

  document.addEventListener('input', (e) => {
    if (!isRecording || isPaused) return;
    const el = e.target;
    // designMode('on') 문서는 body 전체가 편집 가능 — isContentEditable이 false여도 허용
    const isDesignModeBody = document.designMode === 'on' && el === document.body;
    if (!isDesignModeBody && !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ||
          el.isContentEditable)) return;

    // 다른 인풋으로 전환 시 이전 것 flush
    if (typingTarget && typingTarget !== el) {
      flushTyping(typingTarget);
    }
    typingTarget = el;
    notifyTypingProgress(el);

    // 처음 입력 시작: 새 스텝 번호 확보 (이후 덮어쓰기에 사용)
    if (pendingInputStep === null) {
      stepNumber += 1;
      pendingInputStep = stepNumber;
    }

    // 타이머 리셋 — 1.5초 멈추면 현재 화면 캡처 (같은 스텝 덮어쓰기)
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      if (!isRecording || isPaused || isCapturing || typingTarget !== el) return;
      const overwriteStep = pendingInputStep;
      pendingInputStep = null; // 타이머 캡처 후 재설정 — 다음 입력은 새 스텝
      const label = getFieldLabel(el);
      isCapturing = true;
      lastCapturedTarget = el;
      lastCapturedTime   = Date.now();
      chrome.runtime.sendMessage({
        type: 'CAPTURE_SCREENSHOT',
        stepData: {
          url: location.href, timestamp: Date.now(),
          clickX: 0, clickY: 0,
          windowWidth: window.innerWidth, windowHeight: window.innerHeight,
          stepNumber: overwriteStep,
          overwrite: true,
          actionInfo: { type: 'type', text: label },
        },
      }, () => { void chrome.runtime.lastError; isCapturing = false; });
    }, TYPING_DEBOUNCE);
  }, true);

  // ── 타이핑 필드 하이라이트 오버레이 ────────────────────────────
  // 타이핑 캡처 시 입력 중인 필드를 강조 표시해서 스크린샷에 포함시킴
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

  // ── 파일명 하이라이트 오버레이 ─────────────────────────────────
  // 업로드/다운로드 캡처 시 파일명을 확대·하이라이트해서 스크린샷에 포함시킴
  let fileHighlightOverlay = null;

  function showFileHighlight(fileNames) {
    removeFileHighlight();
    const ov = document.createElement('div');
    ov.style.cssText = [
      'position:fixed', 'bottom:72px', 'left:50%',
      'transform:translateX(-50%)',
      'z-index:2147483646',
      'background:rgba(20,20,30,0.88)',
      'color:#fff',
      'border-radius:10px',
      'padding:10px 20px',
      'display:flex', 'align-items:center', 'gap:10px',
      'max-width:520px',
      'box-shadow:0 4px 20px rgba(0,0,0,0.45)',
      'pointer-events:none',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    ].join(';');

    const icon = document.createElement('span');
    icon.textContent = '📎';
    icon.style.cssText = 'font-size:18px;flex-shrink:0';

    const label = document.createElement('span');
    label.style.cssText = [
      'font-size:14px', 'font-weight:600',
      'color:#A5F3FC',  // 연한 하늘색 — 눈에 띄게
      'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis',
      'max-width:440px',
    ].join(';');
    label.textContent = fileNames;

    ov.append(icon, label);
    document.documentElement.appendChild(ov);
    fileHighlightOverlay = ov;
  }

  function removeFileHighlight() {
    if (fileHighlightOverlay) { fileHighlightOverlay.remove(); fileHighlightOverlay = null; }
  }

  // ── 파일 업로드 결과 캡처 ───────────────────────────────────────
  // input[type=file] 선택 완료 → 파일명과 함께 현재 화면 캡처
  document.addEventListener('change', (e) => {
    if (!isRecording || isPaused || isCapturing) return;
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || el.type !== 'file') return;
    if (!el.files || el.files.length === 0) return;

    const fileNames = [...el.files].map(f => f.name).join(', ');
    isCapturing = true;
    stepNumber += 1;
    lastCapturedTarget = el;
    lastCapturedTime   = Date.now();

    // 파일 선택 직후 약간 대기 — UI가 파일명을 반영할 시간
    // 파일명 하이라이트 오버레이를 먼저 표시한 뒤 캡처
    setTimeout(() => {
      if (!isRecording || isPaused) { isCapturing = false; return; }
      showFileHighlight(fileNames);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        chrome.runtime.sendMessage({
          type: 'CAPTURE_SCREENSHOT',
          stepData: {
            url: location.href, timestamp: Date.now(),
            clickX: 0, clickY: 0,
            windowWidth: window.innerWidth, windowHeight: window.innerHeight,
            stepNumber,
            actionInfo: { type: 'upload', text: fileNames, tag: 'input' },
          },
        }, () => { void chrome.runtime.lastError; isCapturing = false; });
      }));
    }, 400);
  }, true);

  // 제출 키 감지 → flush
  // single-line input : Enter
  // textarea / contenteditable : Ctrl+Enter 또는 Meta+Enter (Mac)
  document.addEventListener('keydown', (e) => {
    if (!isRecording || isPaused) return;
    if (e.key !== 'Enter') return;
    if (!typingTarget) return;

    const el = e.target;
    const isTextarea     = el instanceof HTMLTextAreaElement;
    const isContentEdit  = el.isContentEditable;
    const isSingleLine   = el instanceof HTMLInputElement;
    const isModified     = e.ctrlKey || e.metaKey;

    if (isSingleLine) {
      // 단일 라인 input: Enter = 제출
      flushTyping(el);
    } else if ((isTextarea || isContentEdit) && isModified) {
      // 멀티라인/채팅: Ctrl+Enter 또는 Cmd+Enter = 제출
      flushTyping(el);
    }
    // 그 외 Enter(textarea 줄바꿈, Alt+Enter 등)는 무시
  }, true);

  // ── INTERACTIVE 셀렉터 ───────────────────────────────────────────
  const INTERACTIVE = [
    'a[href]', 'button', 'input', 'select', 'textarea', 'label',
    '[role="button"]', '[role="link"]', '[role="menuitem"]', '[role="tab"]',
    '[role="checkbox"]', '[role="radio"]', '[role="switch"]', '[role="option"]',
    '[onclick]', '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  // ── 초기화 ───────────────────────────────────────────────────────
  // 설정만 로드. isRecording/stepNumber는 START_RECORDING 메시지로만 세팅.
  // stale storage로 인한 유령 녹화(페이지 이동 후 자동 녹화 시작) 방지.
  chrome.storage.local.get(['settings', 'isPaused'], (r) => {
    isPaused = !!r.isPaused;
    if (r.settings) settings = { ...settings, ...r.settings };
  });

  // ── 녹화 시작 카운트다운 오버레이 ──────────────────────────────
  function showCountdown(onDone) {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'background:rgba(0,0,0,0.72)',
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'gap:16px',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'pointer-events:none',
    ].join(';');

    const badge = document.createElement('div');
    badge.style.cssText = [
      'display:flex', 'align-items:center', 'gap:10px',
      'background:rgba(255,255,255,0.1)',
      'border:1px solid rgba(255,255,255,0.2)',
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

    // 전역 keyframe 한 번만 삽입
    if (!document.getElementById('mimic-kf')) {
      const kf = document.createElement('style');
      kf.id = 'mimic-kf';
      kf.textContent = '@keyframes mimic-blink{0%,100%{opacity:1}50%{opacity:0.2}}@keyframes mimic-pop{0%{transform:scale(1.4);opacity:0}60%{opacity:1}100%{transform:scale(1);opacity:1}}@keyframes mimic-start{0%{transform:scale(0.8);opacity:0}50%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}';
      document.head.appendChild(kf);
    }

    document.documentElement.appendChild(overlay);

    const steps = [
      { text: '3', color: '#fff',    anim: 'mimic-pop 0.35s ease forwards' },
      { text: '2', color: '#fff',    anim: 'mimic-pop 0.35s ease forwards' },
      { text: '1', color: '#fff',    anim: 'mimic-pop 0.35s ease forwards' },
      { text: 'START', color: '#4ade80', anim: 'mimic-start 0.4s ease forwards', size: '56px' },
    ];

    let i = 0;
    function tick() {
      if (i >= steps.length) {
        overlay.remove();
        onDone();
        return;
      }
      const s = steps[i++];
      numEl.textContent = s.text;
      numEl.style.color = s.color;
      numEl.style.fontSize = s.size || '96px';
      numEl.style.animation = 'none';
      void numEl.offsetWidth; // reflow
      numEl.style.animation = s.anim;
      setTimeout(tick, i < steps.length ? 900 : 700);
    }
    tick();
  }

  // 카운트다운 진행 중 플래그 — 비동기 gap에서 중복 START_RECORDING 진입 차단
  let _countingDown = false;

  // ── 메시지 수신 ──────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'START_RECORDING') {
      // 이미 녹화 중이거나 카운트다운 중이면 무시
      if (isRecording || _countingDown) { sendResponse({ ok: true }); return false; }
      _countingDown      = true;
      lastCapturedTarget = null;
      lastCapturedTime   = 0;
      sendResponse({ ok: true });
      // stepNumber를 storage 기준으로 맞춤 — 페이지 이동 후 재주입 시 카운터 동기화
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
    // 캡처 직전 오버레이 숨김 — background가 sendMessage로 호출, 응답 후 captureVisibleTab
    if (msg.type === 'HIDE_OVERLAY_FOR_CAPTURE') {
      // hover overlay는 제거하지 않음 — 캡처 스크린샷에 클릭 하이라이트로 포함
      // 타이핑 중인 필드 하이라이트 — 캡처 스크린샷에 포함 (파란 테두리)
      if (typingTarget && document.contains(typingTarget)) {
        showTypingHighlight(typingTarget);
      }
      const piiRegions = applyPIIBlur();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          sendResponse({ ok: true, piiRegions });
        });
      });
      return true; // 비동기 응답
    }
    if (msg.type === 'RESTORE_OVERLAY') {
      hideHoverPointer(); // 캡처 완료 후 hover overlay 제거
      restorePIIBlur();
      removeTypingHighlight();
      removeFileHighlight();
      isCapturing = false;
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'MANUAL_CAPTURE') {
      if (!isRecording || isCapturing) { sendResponse({ ok: false }); return false; }
      isCapturing = true;
      stepNumber += 1;
      chrome.runtime.sendMessage({
        type: 'CAPTURE_SCREENSHOT',
        stepData: {
          url: location.href, timestamp: Date.now(),
          clickX: 0, clickY: 0,
          windowWidth: window.innerWidth, windowHeight: window.innerHeight,
          stepNumber, manual: true,
        },
      }, () => {
        flashCapture();
        isCapturing = false;
        void chrome.runtime.lastError;
      });
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });

  // ── 호버 포인터 ──────────────────────────────────────────────────
  let hoverOverlay = null;
  let hoverTarget  = null;

  function findInteractiveTarget(el) {
    if (!el || el === document.documentElement) return null;
    if (settings.captureMode === 'all') return el;

    // designMode 문서(스마트에디터 등) — body 클릭을 입력 필드로 처리
    if (document.designMode === 'on') return document.body;

    // 1) INTERACTIVE 셀렉터에 매칭되는 가장 가까운 조상 탐색
    const found = el.closest(INTERACTIVE);
    if (found) return found;

    // 2) 못 찾았을 때: JS addEventListener로 동적 바인딩된 클릭 핸들러는
    //    [onclick] 어트리뷰트가 없어서 셀렉터에 안 잡힘 (쿠팡 상품카드 등).
    //    이 경우 클릭된 요소에서 8단계까지 올라가며 cursor:pointer인 요소를 찾아 fallback
    let cur = el;
    for (let i = 0; i < 8; i++) {
      if (!cur || cur === document.documentElement) break;
      const style = window.getComputedStyle(cur);
      if (style.cursor === 'pointer') return cur;
      cur = cur.parentElement;
    }

    // 3) 그래도 못 찾으면 null — body/div 같은 래퍼를 캡처하지 않음
    return null;
  }

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

  document.addEventListener('mousemove', (e) => {
    if (!isRecording || isPaused || isCapturing) { hideHoverPointer(); return; }
    const target = findInteractiveTarget(e.target);
    if (!target) { hideHoverPointer(); return; }
    if (target === hoverTarget) return;
    hoverTarget = target;
    showHoverPointer(target);
  }, true);

  document.addEventListener('mouseleave', hideHoverPointer, true);

  // ── 클릭 캡처 ────────────────────────────────────────────────────
  document.addEventListener('click', handleClick, true);

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
      // 1순위: id (전역 고유)
      if (el.id) return `#${CSS.escape(el.id)}`;

      const tag = el.tagName.toLowerCase();

      // 2순위: 테스트/접근성 속성 (안정적, 의미 있음)
      for (const attr of ['data-testid', 'data-cy', 'data-test', 'aria-label', 'name']) {
        const val = el.getAttribute(attr);
        if (val) {
          const sel = `${tag}[${attr}="${CSS.escape(val)}"]`;
          // 페이지에서 유일한지 확인
          if (document.querySelectorAll(sel).length === 1) return sel;
        }
      }

      // 3순위: 의미있는 텍스트 콘텐츠로 특정 (버튼/링크에 유용)
      if (['button', 'a', 'label'].includes(tag)) {
        const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        if (text && text.length >= 2) {
          // :scope 없이 querySelectorAll — 텍스트 매칭은 JS로만 가능하므로 건너뜀
          // 대신 type + text 조합 속성으로 대체
        }
      }

      // 4순위: 부모까지 포함한 고유 경로 (nth-of-type으로 보강)
      const buildPath = (node, depth) => {
        if (depth <= 0 || !node || node === document.documentElement) return '';
        const t  = node.tagName.toLowerCase();
        let sel  = t;
        if (node.id) return `#${CSS.escape(node.id)}`;

        // 클래스 (최대 2개, 안정적인 것만)
        const stableClasses = [...node.classList].filter(c =>
          !/is-|has-|active|hover|focus|selected|disabled|loading|error|open|closed/.test(c)
        ).slice(0, 2);
        if (stableClasses.length) {
          sel += stableClasses.map(c => `.${CSS.escape(c)}`).join('');
        }

        // 같은 부모 내 같은 태그+클래스 형제 중 몇 번째인지
        if (node.parentElement) {
          const siblings = [...node.parentElement.children].filter(c => c.tagName === node.tagName);
          if (siblings.length > 1) {
            const idx = siblings.indexOf(node) + 1;
            sel += `:nth-of-type(${idx})`;
          }
        }

        const parentPath = buildPath(node.parentElement, depth - 1);
        return parentPath ? `${parentPath} > ${sel}` : sel;
      };

      // 경로 깊이를 3 → 2 → 1 순으로 시도하며 유일성 확인
      for (const depth of [3, 2, 1]) {
        const path = buildPath(el, depth);
        if (!path) continue;
        try {
          if (document.querySelectorAll(path).length === 1) return path;
        } catch { /* 유효하지 않은 셀렉터 무시 */ }
      }

      // 최후: 단순 태그 + 첫 두 클래스 (고유성 미보장이지만 없는 것보다 나음)
      const cls = [...el.classList].slice(0, 2).map(c => `.${CSS.escape(c)}`).join('');
      return tag + cls;
    } catch { return ''; }
  }

  function getActionType(el) {
    const tag  = el.tagName.toLowerCase();
    const type = el.getAttribute('type') || '';
    if (tag === 'a') return 'navigate';
    if (tag === 'input' && ['checkbox', 'radio'].includes(type)) return 'toggle';
    // select, datalist, combobox — 클릭 순간 드롭다운이 열리므로 즉시 캡처 필요
    if (tag === 'select') return 'select';
    if (el.getAttribute('list')) return 'select'; // <input list="..."> datalist
    if (el.getAttribute('role') === 'combobox') return 'select';
    // 일반 텍스트 입력 — flushTyping에서 캡처하므로 클릭 시 캡처 안 함
    if (tag === 'input' || tag === 'textarea' || el.isContentEditable) return 'focus_input';
    // designMode 문서의 body — 스마트에디터 등 iframe 에디터
    if (document.designMode === 'on' && tag === 'body') return 'focus_input';
    return 'click';
  }

  function handleClick(e) {
    if (!isRecording || isPaused || isCapturing) return;

    const target = findInteractiveTarget(e.target);
    if (!target) return;

    const now = Date.now();

    // ── 중복 클릭 필터 ───────────────────────────────────────────
    // 1) 더블클릭: 400ms 이내 동일 요소 재클릭
    // 2) 재클릭: 1200ms 이내 동일 요소 재클릭
    if (target === lastCapturedTarget && (now - lastCapturedTime) < DEDUP_SAME_ELEMENT) return;

    const actionType = getActionType(target);

    // ── 일반 텍스트 입력 필드: 클릭 시 캡처 안 함, typingTarget만 세팅 ──
    // 실제 캡처는 flushTyping(Enter / 다른 곳 클릭)에서 수행
    if (actionType === 'focus_input') {
      // 다른 인풋에서 이동한 경우 이전 타이핑 먼저 flush
      if (typingTarget && typingTarget !== target) {
        flushTyping(typingTarget);
      }
      // 이미 이 필드를 타이핑 중이면 재클릭 무시
      if (typingTarget === target) return;
      typingTarget     = target;
      pendingInputStep = null; // focus_input 즉시 캡처 없으므로 덮어쓸 스텝 없음
      return;
    }

    // 진행 중이던 타이핑 — 다른 버튼 클릭으로 포커스 이동 = 입력 완료 신호
    if (typingTarget) {
      flushTyping(typingTarget);
      if (isCapturing) return;
    }

    const rect  = target.getBoundingClientRect();
    const label = getElementLabel(target);
    const href  = target.getAttribute('href') || target.closest('a')?.getAttribute('href') || '';
    const vw = window.innerWidth, vh = window.innerHeight;

    // navigate 클릭: background가 stepNumber 관리 + 캡처 단독 처리.
    // content.js는 stepNumber를 올리지 않고 클릭 메타데이터만 저장.
    if (actionType === 'navigate') {
      lastCapturedTarget = target;
      lastCapturedTime   = now;
      const navStepData = {
        url:             location.href,
        timestamp:       Date.now(),
        clickX:          e.clientX,
        clickY:          e.clientY,
        windowWidth:     vw,
        windowHeight:    vh,
        viewportW:       vw,
        viewportH:       vh,
        elementRect:     { x: rect.x / vw, y: rect.y / vh, width: rect.width / vw, height: rect.height / vh },
        elementSelector: getElementSelector(target),
        actionInfo:      { type: actionType, label, tag: target.tagName.toLowerCase(), href: href.slice(0, 200) },
      };
      // lastCaptureTime을 navigate 클릭 즉시 설정 — tabs.onUpdated 발화 전 autoNav 쿨다운 확보
      chrome.storage.local.set({ pendingCapture: navStepData, lastCaptureTime: now });
      return;
    }

    isCapturing        = true;
    stepNumber        += 1;
    lastCapturedTarget = target;
    lastCapturedTime   = now;

    const stepData = {
      url:             location.href,
      timestamp:       Date.now(),
      clickX:          e.clientX,
      clickY:          e.clientY,
      windowWidth:     vw,
      windowHeight:    vh,
      viewportW:       vw,
      viewportH:       vh,
      stepNumber,
      elementRect:     { x: rect.x / vw, y: rect.y / vh, width: rect.width / vw, height: rect.height / vh },
      elementSelector: getElementSelector(target),
      actionInfo:      { type: actionType, label, tag: target.tagName.toLowerCase(), href: href.slice(0, 200) },
    };

    // <a download> 링크 클릭 — 파일명 하이라이트 오버레이 표시
    const downloadAttr = target.getAttribute('download');
    const isDownloadLink = target.tagName.toLowerCase() === 'a' && downloadAttr !== null;
    if (isDownloadLink) {
      const fileName = downloadAttr || href.split('/').pop().split('?')[0] || '파일';
      showFileHighlight(fileName);
    }

    // same-origin iframe에서 bubble된 클릭은 top frame에서 중복 처리 방지.
    // iframe content.js가 이미 처리했으므로 top frame에서는 무시.
    if (window === window.top && e.target.ownerDocument !== document) {
      isCapturing = false;
      return;
    }

    // SW가 죽어 콜백이 안 와도 10초 후 자동 해제
    const captureSafetyTimer = setTimeout(() => { isCapturing = false; }, 10000);
    chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT', stepData }, () => {
      clearTimeout(captureSafetyTimer);
      void chrome.runtime.lastError;
      isCapturing = false;
    });
  }

  // ── storage 변경 감지 (일시정지/재개 동기화) ─────────────────────
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if ('isPaused' in changes) {
      isPaused = !!changes.isPaused.newValue;
    }
  });

  // ── URL 변경 감지 (SPA 이동) ─────────────────────────────────────
  // cross-origin 이동은 background.js tabs.onUpdated 가 처리.
  // SPA 이동(same-origin)은 content.js가 단독 처리하고,
  // spaNavCapturing 플래그로 background.js autoNav 중복 캡처를 차단한다.
  // all_frames:true 환경에서 iframe content.js가 중복 실행되지 않도록
  // 최상위 프레임(window === window.top)에서만 감지한다.
  if (window === window.top) {
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (!isRecording || isPaused || isCapturing) return;
      if (!settings.autoNav) return;
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      // background.js autoNav 중복 방지 플래그 세팅
      chrome.storage.local.set({ spaNavCapturing: true });
      setTimeout(() => {
        if (!isRecording || isPaused || isCapturing) return;
        isCapturing = true;
        stepNumber += 1;
        chrome.runtime.sendMessage({
          type: 'CAPTURE_SCREENSHOT',
          stepData: {
            url: location.href, timestamp: Date.now(),
            clickX: 0, clickY: 0,
            windowWidth: window.innerWidth, windowHeight: window.innerHeight,
            stepNumber,
            actionInfo: { type: 'navigate', label: document.title || '' },
          },
        }, () => {
          isCapturing = false;
          chrome.storage.local.remove('spaNavCapturing');
          void chrome.runtime.lastError;
        });
      }, 1500);
    }).observe(document, { subtree: true, childList: true });
  }

  // ── 포인터 오버레이 ──────────────────────────────────────────────
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

  // ── 클립보드 붙여넣기로 수동 스크린샷 수신 ──────────────────────
  // 캡처가 차단된 페이지에서 OS 스크린샷(Win+Shift+S)을 Ctrl+V로 붙여넣으면
  // 해당 이미지를 스텝으로 추가한다. 텍스트 입력 중에는 무시한다.
  document.addEventListener('paste', (e) => {
    if (!isRecording || isPaused || isCapturing) return;
    // 텍스트 입력 필드에서 발생한 paste는 무시 (실제 입력 의도)
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

      // isCapturing을 FileReader 비동기 전에 먼저 세팅 — 병렬 이벤트 차단
      isCapturing = true;

      const reader = new FileReader();
      reader.onloadend = () => {
        // stepNumber는 background가 storage 기준으로 결정하므로 여기서는 증가시키지 않음
        chrome.runtime.sendMessage({
          type: 'MANUAL_IMAGE_STEP',
          dataUrl:  reader.result,
          stepData: {
            url:          location.href,
            timestamp:    Date.now(),
            clickX:       0,
            clickY:       0,
            windowWidth:  window.innerWidth,
            windowHeight: window.innerHeight,
            manual:       true,
            actionInfo:   { type: 'click', label: '클립보드 붙여넣기 캡처' },
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

    // Shadow DOM으로 외부 CSS 격리
    const host = document.createElement('div');
    host.id = 'mimic-overlay-root';
    host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483640;';
    document.documentElement.appendChild(host);
    guideShadowHost = host;

    const shadow = host.attachShadow({ mode: 'closed' });

    // ── 하이라이트 박스 ──────────────────────────────────────────
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
        'background:rgba(255,200,0,0.18)',
        'border:2.5px solid #F59E0B',
        'border-radius:6px',
        'box-shadow:0 0 0 4px rgba(245,158,11,0.18)',
        'z-index:2',
      ].join(';');
      shadow.appendChild(hl);
    }

    // ── 클릭 포인트 펄스 ─────────────────────────────────────────
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

    // ── 자막 바 ──────────────────────────────────────────────────
    if (step.instruction) {
      const bar = document.createElement('div');
      bar.style.cssText = [
        'position:fixed', 'bottom:24px',
        'left:50%', 'transform:translateX(-50%)',
        'max-width:600px', 'width:calc(100% - 48px)',
        'background:rgba(0,0,0,0.82)', 'color:#fff',
        'border-radius:12px', 'padding:12px 20px',
        'font-size:15px', 'line-height:1.6',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'pointer-events:none', 'z-index:4',
        'box-shadow:0 4px 24px rgba(0,0,0,0.4)',
        'text-align:center',
      ].join(';');
      bar.textContent = step.instruction; // textContent — XSS 안전
      shadow.appendChild(bar);
    }
  }

  // SHOW_OVERLAY / HIDE_OVERLAY 메시지 처리
  // 기존 onMessage 리스너에 합류 (IIFE 내부에서 추가)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SHOW_OVERLAY' && message.step) {
      showGuideOverlay(message.step);
    }
    if (message.type === 'HIDE_OVERLAY') {
      removeGuideOverlay();
    }
  });

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
})();
