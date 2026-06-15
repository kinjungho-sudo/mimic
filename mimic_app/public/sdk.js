/**
 * MIMIC 라이브 가이드 SDK
 * Usage: <script src="https://mimic-nine-ashen.vercel.app/sdk.js" data-guide="SHARE_TOKEN"></script>
 * Or:    window.MimicSDK.start('SHARE_TOKEN')
 * Or:    ?mimic_guide=SHARE_TOKEN in URL
 */
(function () {
  'use strict';

  var BASE_URL = (function () {
    var scripts = document.querySelectorAll('script[src*="sdk.js"]');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute('src');
      if (src) {
        try {
          var u = new URL(src, location.href);
          return u.origin;
        } catch (e) { /* ignore */ }
      }
    }
    return 'https://mimic-nine-ashen.vercel.app';
  })();

  var Z = 2147483647;

  // ── 스타일 주입 ────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('mimic-sdk-styles')) return;
    var style = document.createElement('style');
    style.id = 'mimic-sdk-styles';
    style.textContent = [
      '.mimic-overlay{position:fixed;inset:0;z-index:' + (Z - 2) + ';pointer-events:none}',
      '.mimic-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:' + (Z - 3) + ';transition:opacity .25s}',
      '.mimic-highlight{position:absolute;border-radius:6px;box-shadow:0 0 0 4px #4F46E5,0 0 0 9999px rgba(0,0,0,0.45);pointer-events:none;transition:all .25s;z-index:' + (Z - 1) + '}',
      '.mimic-tooltip{position:absolute;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(17,24,39,.18),0 0 0 1px rgba(0,0,0,.06);padding:18px 20px 16px;min-width:260px;max-width:340px;pointer-events:all;z-index:' + Z + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '.mimic-tooltip-center{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%)}',
      '.mimic-step-badge{display:inline-block;font-size:11px;font-weight:700;color:#4F46E5;background:rgba(79,70,229,.1);padding:2px 8px;border-radius:20px;margin-bottom:8px}',
      '.mimic-tooltip-title{font-size:14px;font-weight:700;color:#111827;margin:0 0 6px;line-height:1.4}',
      '.mimic-tooltip-caption{font-size:13px;color:#4B5563;line-height:1.6;margin:0 0 14px}',
      '.mimic-tooltip-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.mimic-btn{height:32px;padding:0 14px;border-radius:7px;font-size:12.5px;font-weight:600;border:none;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:5px}',
      '.mimic-btn-primary{background:#4F46E5;color:#fff}',
      '.mimic-btn-primary:hover{background:#4338CA}',
      '.mimic-btn-secondary{background:#F3F4F6;color:#374151}',
      '.mimic-btn-secondary:hover{background:#E5E7EB}',
      '.mimic-btn-ghost{background:none;color:#9CA3AF;font-size:12px;padding:0 8px}',
      '.mimic-btn-ghost:hover{color:#6B7280}',
      '.mimic-progress{display:flex;align-items:center;gap:4px}',
      '.mimic-progress-dot{width:6px;height:6px;border-radius:50%;background:#E5E7EB;transition:background .2s}',
      '.mimic-progress-dot.active{background:#4F46E5}',
      '.mimic-float-btn{position:fixed;bottom:24px;right:24px;width:48px;height:48px;border-radius:50%;background:#4F46E5;color:#fff;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(79,70,229,.45);display:flex;align-items:center;justify-content:center;z-index:' + (Z - 4) + ';transition:all .2s}',
      '.mimic-float-btn:hover{background:#4338CA;transform:scale(1.08)}',
      '.mimic-close{position:absolute;top:10px;right:10px;background:none;border:none;cursor:pointer;color:#9CA3AF;padding:4px;line-height:1}',
      '.mimic-close:hover{color:#6B7280}',
    ].join('');
    document.head.appendChild(style);
  }

  // ── DOM 유틸 ───────────────────────────────────────────────
  function findElement(selector, xpath) {
    if (selector) {
      try {
        var el = document.querySelector(selector);
        if (el) return el;
      } catch (e) { /* invalid selector */ }
    }
    if (xpath) {
      try {
        var result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (result.singleNodeValue) return result.singleNodeValue;
      } catch (e) { /* invalid xpath */ }
    }
    return null;
  }

  function getRect(el) {
    var r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }

  // ── 툴팁 위치 계산 ─────────────────────────────────────────
  function calcTooltipPos(targetRect, tooltipEl) {
    var TW = tooltipEl.offsetWidth || 300;
    var TH = tooltipEl.offsetHeight || 160;
    var MARGIN = 14;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // 아래→위→오른쪽→왼쪽 순 시도
    var positions = [
      { top: targetRect.top + targetRect.height + MARGIN, left: targetRect.left },
      { top: targetRect.top - TH - MARGIN, left: targetRect.left },
      { top: targetRect.top, left: targetRect.left + targetRect.width + MARGIN },
      { top: targetRect.top, left: targetRect.left - TW - MARGIN },
    ];

    for (var i = 0; i < positions.length; i++) {
      var p = positions[i];
      if (p.top >= 0 && p.top + TH <= vh && p.left >= 0 && p.left + TW <= vw) {
        return p;
      }
    }
    // fallback: 화면 내로 클램핑
    return {
      top: Math.max(8, Math.min(positions[0].top, vh - TH - 8)),
      left: Math.max(8, Math.min(positions[0].left, vw - TW - 8)),
    };
  }

  // ── SVG DOM 헬퍼 (innerHTML 대신 DOM API로 안전하게 생성) ───
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function makeSvg(attrs, children) {
    var el = document.createElementNS(SVG_NS, 'svg');
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    children.forEach(function (child) {
      var c = document.createElementNS(SVG_NS, child.tag);
      Object.keys(child.attrs).forEach(function (k) { c.setAttribute(k, child.attrs[k]); });
      el.appendChild(c);
    });
    return el;
  }

  function makeCloseIcon() {
    return makeSvg(
      { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5' },
      [
        { tag: 'line', attrs: { x1: '18', y1: '6', x2: '6', y2: '18' } },
        { tag: 'line', attrs: { x1: '6', y1: '6', x2: '18', y2: '18' } },
      ]
    );
  }

  function makeHelpIcon() {
    return makeSvg(
      { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      [
        { tag: 'circle', attrs: { cx: '12', cy: '12', r: '10' } },
        { tag: 'path', attrs: { d: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' } },
        { tag: 'line', attrs: { x1: '12', y1: '17', x2: '12.01', y2: '17' } },
      ]
    );
  }

  // ── 데이터 fetch ───────────────────────────────────────────
  function fetchGuide(token, password) {
    var opts = password
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: password }) }
      : { method: 'GET' };
    return fetch(BASE_URL + '/api/play/' + encodeURIComponent(token), opts)
      .then(function (r) {
        if (!r.ok) throw new Error('fetch failed: ' + r.status);
        return r.json();
      });
  }

  // ── 메인 Guide 클래스 ──────────────────────────────────────
  function Guide(steps, options) {
    this.steps = steps;
    this.options = options || {};
    this.current = 0;
    this._els = {};
    this._running = false;
  }

  Guide.prototype.start = function (startIndex) {
    if (this._running) this.destroy();
    this._running = true;
    this.current = startIndex || 0;
    injectStyles();
    this._render();
  };

  Guide.prototype._render = function () {
    this._clean();
    var step = this.steps[this.current];
    if (!step) { this.destroy(); return; }

    var self = this;
    var targetEl = findElement(step.element_selector, step.element_xpath);

    // 하이라이트
    if (targetEl) {
      var highlight = document.createElement('div');
      highlight.className = 'mimic-highlight';
      var r = getRect(targetEl);
      var PAD = 4;
      highlight.style.cssText = [
        'top:' + (r.top + window.scrollY - PAD) + 'px',
        'left:' + (r.left + window.scrollX - PAD) + 'px',
        'width:' + (r.width + PAD * 2) + 'px',
        'height:' + (r.height + PAD * 2) + 'px',
      ].join(';');
      document.body.appendChild(highlight);
      this._els.highlight = highlight;

      // 요소가 뷰포트 밖이면 스크롤
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // 배경 딤
      var backdrop = document.createElement('div');
      backdrop.className = 'mimic-backdrop';
      backdrop.addEventListener('click', function () { self.destroy(); });
      document.body.appendChild(backdrop);
      this._els.backdrop = backdrop;
    }

    // 툴팁 생성
    var tooltip = document.createElement('div');
    tooltip.className = 'mimic-tooltip';

    // 닫기 버튼
    var closeBtn = document.createElement('button');
    closeBtn.className = 'mimic-close';
    closeBtn.setAttribute('aria-label', '닫기');
    closeBtn.appendChild(makeCloseIcon());
    closeBtn.addEventListener('click', function () { self.destroy(); });
    tooltip.appendChild(closeBtn);

    // 뱃지
    var badge = document.createElement('div');
    badge.className = 'mimic-step-badge';
    badge.textContent = (this.current + 1) + ' / ' + this.steps.length;
    tooltip.appendChild(badge);

    // 제목
    var titleEl = document.createElement('p');
    titleEl.className = 'mimic-tooltip-title';
    titleEl.textContent = step.title || '';
    tooltip.appendChild(titleEl);

    // 설명
    if (step.caption) {
      var caption = document.createElement('p');
      caption.className = 'mimic-tooltip-caption';
      caption.textContent = step.caption;
      tooltip.appendChild(caption);
    }

    // 진행 dots + 버튼
    var actions = document.createElement('div');
    actions.className = 'mimic-tooltip-actions';

    // 진행 dots
    var progress = document.createElement('div');
    progress.className = 'mimic-progress';
    var MAX_DOTS = 7;
    var total = this.steps.length;
    var shown = Math.min(total, MAX_DOTS);
    var offset = total > MAX_DOTS ? Math.max(0, Math.min(this.current - Math.floor(MAX_DOTS / 2), total - MAX_DOTS)) : 0;
    for (var i = 0; i < shown; i++) {
      var dot = document.createElement('div');
      dot.className = 'mimic-progress-dot' + (i + offset === this.current ? ' active' : '');
      progress.appendChild(dot);
    }
    actions.appendChild(progress);

    // 버튼 그룹
    var btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:6px;align-items:center';

    if (this.current > 0) {
      var prevBtn = document.createElement('button');
      prevBtn.className = 'mimic-btn mimic-btn-secondary';
      prevBtn.textContent = '이전';
      prevBtn.addEventListener('click', function () { self.prev(); });
      btnGroup.appendChild(prevBtn);
    }

    var isLast = this.current === this.steps.length - 1;
    var nextBtn = document.createElement('button');
    nextBtn.className = 'mimic-btn mimic-btn-primary';
    nextBtn.textContent = isLast ? '완료 ✓' : '다음 →';
    nextBtn.addEventListener('click', function () {
      if (isLast) self.destroy();
      else self.next();
    });
    btnGroup.appendChild(nextBtn);

    actions.appendChild(btnGroup);
    tooltip.appendChild(actions);

    // 위치 결정
    document.body.appendChild(tooltip);
    if (targetEl) {
      var r2 = getRect(targetEl);
      var pos = calcTooltipPos(r2, tooltip);
      tooltip.style.position = 'fixed';
      tooltip.style.top = pos.top + 'px';
      tooltip.style.left = pos.left + 'px';
    } else {
      tooltip.classList.add('mimic-tooltip-center');
    }

    this._els.tooltip = tooltip;

    // 키보드 이벤트
    this._keyHandler = function (e) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') self.next();
      if (e.key === 'ArrowLeft') self.prev();
      if (e.key === 'Escape') self.destroy();
    };
    document.addEventListener('keydown', this._keyHandler);
  };

  Guide.prototype._clean = function () {
    ['highlight', 'backdrop', 'tooltip'].forEach(function (k) {
      if (this._els[k]) { this._els[k].remove(); delete this._els[k]; }
    }, this);
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  };

  Guide.prototype.next = function () {
    if (this.current < this.steps.length - 1) {
      this.current++;
      this._render();
    } else {
      this.destroy();
    }
  };

  Guide.prototype.prev = function () {
    if (this.current > 0) {
      this.current--;
      this._render();
    }
  };

  Guide.prototype.destroy = function () {
    this._clean();
    this._running = false;
    if (this._floatBtn) { this._floatBtn.style.display = 'flex'; }
    if (typeof this.options.onComplete === 'function') this.options.onComplete();
  };

  // ── 플로팅 버튼 ────────────────────────────────────────────
  Guide.prototype.addFloatButton = function () {
    var self = this;
    injectStyles();
    var btn = document.createElement('button');
    btn.className = 'mimic-float-btn';
    btn.title = '가이드 시작';
    btn.setAttribute('aria-label', '가이드 시작');
    btn.appendChild(makeHelpIcon());
    btn.addEventListener('click', function () {
      btn.style.display = 'none';
      self._floatBtn = btn;
      self.start(0);
    });
    document.body.appendChild(btn);
    this._floatBtn = btn;
  };

  // ── 공개 API ───────────────────────────────────────────────
  var activeGuide = null;

  // 비밀번호 입력 인라인 UI — prompt() 대신 사용 (sandbox iframe 호환)
  function showPasswordUI(title, token, opts) {
    injectStyles();
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:' + (Z - 1) + ';display:grid;place-items:center';

    var box = document.createElement('div');
    box.style.cssText = 'background:white;border-radius:14px;padding:28px 24px;width:min(360px,90vw);box-shadow:0 20px 60px rgba(0,0,0,0.25);font-family:-apple-system,BlinkMacSystemFont,sans-serif';

    var heading = document.createElement('p');
    heading.style.cssText = 'margin:0 0 8px;font-size:15px;font-weight:700;color:#111827';
    heading.textContent = title || '가이드';

    var sub = document.createElement('p');
    sub.style.cssText = 'margin:0 0 16px;font-size:13px;color:#6B7280';
    sub.textContent = '이 가이드는 비밀번호로 보호되어 있습니다.';

    var input = document.createElement('input');
    input.type = 'password';
    input.placeholder = '비밀번호 입력';
    input.style.cssText = 'width:100%;box-sizing:border-box;height:38px;padding:0 12px;border:1.5px solid #E5E7EB;border-radius:8px;font-size:14px;outline:none;margin-bottom:12px';
    input.addEventListener('focus', function () { input.style.borderColor = '#4F46E5'; });
    input.addEventListener('blur', function () { input.style.borderColor = '#E5E7EB'; });

    var errMsg = document.createElement('p');
    errMsg.style.cssText = 'margin:0 0 10px;font-size:12px;color:#EF4444;display:none';
    errMsg.textContent = '비밀번호가 올바르지 않습니다.';

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'mimic-btn mimic-btn-secondary';
    cancelBtn.style.flex = '1';
    cancelBtn.textContent = '취소';
    cancelBtn.addEventListener('click', function () { overlay.remove(); });

    var okBtn = document.createElement('button');
    okBtn.className = 'mimic-btn mimic-btn-primary';
    okBtn.style.flex = '1';
    okBtn.textContent = '확인';

    var submit = function () {
      var pw = input.value.trim();
      if (!pw) return;
      okBtn.disabled = true;
      okBtn.textContent = '확인 중…';
      fetchGuide(token, pw)
        .then(function (d2) { overlay.remove(); launchGuide(d2, opts); })
        .catch(function () {
          errMsg.style.display = 'block';
          okBtn.disabled = false;
          okBtn.textContent = '확인';
          input.value = '';
          input.focus();
        });
    };

    okBtn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);
    box.appendChild(heading);
    box.appendChild(sub);
    box.appendChild(input);
    box.appendChild(errMsg);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    setTimeout(function () { input.focus(); }, 50);
  }

  function startGuide(token, options) {
    var opts = options || {};
    fetchGuide(token, opts.password)
      .then(function (data) {
        if (data.protected) {
          showPasswordUI(data.title, token, opts);
          return;
        }
        launchGuide(data, opts);
      })
      .catch(function (e) { console.error('[MIMIC]', e); });
  }

  function launchGuide(data, opts) {
    if (!data.steps || !data.steps.length) return;
    activeGuide = new Guide(data.steps, opts);

    // 플로팅 버튼 모드
    if (opts.float) {
      activeGuide.addFloatButton();
    } else {
      activeGuide.start(opts.startIndex || 0);
    }
  }

  // ── URL 패턴 매칭 ─────────────────────────────────────────
  // 현재 URL이 패턴과 일치하는지 확인 (* 와일드카드 지원)
  function matchesPattern(pattern) {
    try {
      // * → .* 로 변환 후 정규식 매칭
      var regexStr = '^' + pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*') + '$';
      return new RegExp(regexStr).test(location.href);
    } catch (e) { return false; }
  }

  // ── 자동 초기화 ────────────────────────────────────────────
  function autoInit() {
    // 1. <script data-guide="TOKEN"> 방식
    // data-float: 플로팅 버튼 모드 / data-manual: 자동 시작 안 함 / 기본: 즉시 자동 시작
    var scripts = document.querySelectorAll('script[data-guide]');
    for (var i = 0; i < scripts.length; i++) {
      var token = scripts[i].getAttribute('data-guide');
      var floatAttr = scripts[i].getAttribute('data-float');
      var manualAttr = scripts[i].getAttribute('data-manual');
      var urlPattern = scripts[i].getAttribute('data-url-pattern');
      if (!token) continue;
      if (urlPattern && !matchesPattern(urlPattern)) continue;
      if (floatAttr !== null) {
        startGuide(token, { float: true });
      } else if (manualAttr === null) {
        startGuide(token, {});
      }
    }

    // 2. ?mimic_guide=TOKEN 쿼리파라미터
    try {
      var params = new URLSearchParams(location.search);
      var qToken = params.get('mimic_guide');
      if (qToken) startGuide(qToken, {});
    } catch (e) { /* old browser */ }

    // 3. data-mimic-float 속성이 있는 요소에 플로팅 버튼 연결
    var floatEls = document.querySelectorAll('[data-mimic-float]');
    for (var j = 0; j < floatEls.length; j++) {
      var ft = floatEls[j].getAttribute('data-mimic-float');
      if (ft) startGuide(ft, { float: true });
    }
  }

  // window.MimicSDK 공개
  window.MimicSDK = {
    start: function (token, options) { startGuide(token, options); },
    stop: function () { if (activeGuide) activeGuide.destroy(); },
    // URL 패턴이 현재 페이지와 일치할 때만 가이드 시작 (* 와일드카드 지원)
    // 예: MimicSDK.startOnUrl('https://app.example.com/dashboard*', 'TOKEN')
    startOnUrl: function (urlPattern, token, options) {
      if (matchesPattern(urlPattern)) startGuide(token, options);
    },
    version: '1.0.0',
  };

  // DOM 준비 후 자동 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  // ── Auto-Run BETA ──────────────────────────────────────────
  // 라이브 가이드 확장: AI 에이전트가 브라우저를 제어하는 동안 시각적 오버레이 표시

  var autoRunOverlay = null;
  var autoRunCursor = null;
  var autoRunBar = null;
  var autoRunPaused = false;

  function injectAutoRunStyles() {
    if (document.getElementById('mimic-autorun-styles')) return;
    var s = document.createElement('style');
    s.id = 'mimic-autorun-styles';
    s.textContent = [
      // 파란 테두리 pulse — body에 직접 적용
      '@keyframes mimicBorderPulse {',
      '  0%,100% { box-shadow: inset 0 0 0 4px rgba(55,48,163,0.9), inset 0 0 0 6px rgba(55,48,163,0.3); }',
      '  50%     { box-shadow: inset 0 0 0 4px rgba(99,102,241,1),   inset 0 0 0 10px rgba(99,102,241,0.2); }',
      '}',
      // 클릭 ripple
      '@keyframes mimicRipple {',
      '  0%   { transform: translate(-50%,-50%) scale(0); opacity: 1; }',
      '  100% { transform: translate(-50%,-50%) scale(3); opacity: 0; }',
      '}',
      // 커서 등장
      '@keyframes mimicCursorIn {',
      '  from { opacity: 0; transform: scale(0.5); }',
      '  to   { opacity: 1; transform: scale(1); }',
      '}',
      // 상태 바 등장
      '@keyframes mimicBarIn {',
      '  from { opacity: 0; transform: translateX(-50%) translateY(20px); }',
      '  to   { opacity: 1; transform: translateX(-50%) translateY(0); }',
      '}',
      '#mimic-autorun-cursor {',
      '  position: fixed; z-index: 2147483640; pointer-events: none;',
      '  width: 24px; height: 24px;',
      '  transition: left 0.35s cubic-bezier(.4,0,.2,1), top 0.35s cubic-bezier(.4,0,.2,1);',
      '  animation: mimicCursorIn 0.3s ease;',
      '  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));',
      '}',
      '#mimic-autorun-bar {',
      '  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);',
      '  z-index: 2147483641; pointer-events: auto;',
      '  display: flex; align-items: center; gap: 12px;',
      '  background: rgba(17,24,39,0.94); color: white;',
      '  padding: 10px 20px; border-radius: 999px;',
      '  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      '  font-size: 13px; font-weight: 500;',
      '  box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08);',
      '  animation: mimicBarIn 0.3s ease;',
      '  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);',
      '  white-space: nowrap;',
      '}',
      '#mimic-autorun-bar .mar-icon { font-size: 16px; }',
      '#mimic-autorun-bar .mar-label { color: rgba(255,255,255,0.55); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }',
      '#mimic-autorun-bar .mar-title { max-width: 200px; overflow: hidden; text-overflow: ellipsis; }',
      '#mimic-autorun-bar .mar-progress { display: flex; align-items: center; gap: 6px; color: rgba(255,255,255,0.5); font-size: 12px; }',
      '#mimic-autorun-bar .mar-bar { width: 80px; height: 3px; background: rgba(255,255,255,0.15); border-radius: 999px; overflow: hidden; }',
      '#mimic-autorun-bar .mar-bar-fill { height: 100%; background: #6366f1; border-radius: 999px; transition: width 0.4s ease; }',
      '#mimic-autorun-bar .mar-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: white; border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; transition: background 0.15s; }',
      '#mimic-autorun-bar .mar-btn:hover { background: rgba(255,255,255,0.2); }',
      '#mimic-autorun-bar .mar-divider { width: 1px; height: 18px; background: rgba(255,255,255,0.12); }',
      '.mimic-autorun-active { animation: mimicBorderPulse 2s ease-in-out infinite !important; }',
    ].join('\n');
    document.head.appendChild(s);
  }

  function createAutoRunCursor() {
    var el = document.createElement('div');
    el.id = 'mimic-autorun-cursor';
    el.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">'
      + '<path d="M4 2 L18 12 L11 13 L8 20 Z" fill="white" stroke="#3730a3" stroke-width="1.5" stroke-linejoin="round"/>'
      + '<circle cx="18" cy="18" r="4" fill="#6366f1"/>'
      + '</svg>';
    el.style.left = '-100px';
    el.style.top = '-100px';
    document.body.appendChild(el);
    return el;
  }

  function createAutoRunBar(stepTitle, stepNum, totalSteps) {
    var el = document.createElement('div');
    el.id = 'mimic-autorun-bar';
    var pct = totalSteps > 0 ? Math.round((stepNum / totalSteps) * 100) : 0;

    // 정적 구조만 innerHTML로 (외부 데이터 없음)
    el.innerHTML = '<span class="mar-icon">🤖</span>'
      + '<span class="mar-label">AI 실행 중 · BETA</span>'
      + '<span class="mar-divider"></span>'
      + '<span class="mar-title" id="mimic-ar-title"></span>'
      + '<span class="mar-progress">'
      + '  <span id="mimic-ar-step"></span>'
      + '  <span class="mar-bar"><span class="mar-bar-fill" id="mimic-ar-fill"></span></span>'
      + '</span>'
      + '<span class="mar-divider"></span>'
      + '<button class="mar-btn" id="mimic-ar-pause">⏸ 일시정지</button>'
      + '<button class="mar-btn" id="mimic-ar-stop">⏹ 중단</button>';

    // 외부 데이터는 textContent로 안전하게 삽입
    el.querySelector('#mimic-ar-title').textContent = stepTitle || '';
    el.querySelector('#mimic-ar-step').textContent = stepNum + ' / ' + totalSteps;
    el.querySelector('#mimic-ar-fill').style.width = pct + '%';

    document.body.appendChild(el);

    document.getElementById('mimic-ar-pause').onclick = function () {
      autoRunPaused = !autoRunPaused;
      this.textContent = autoRunPaused ? '▶ 재개' : '⏸ 일시정지';
      if (window.MimicAutoRun && window.MimicAutoRun._onPause) window.MimicAutoRun._onPause(autoRunPaused);
    };
    document.getElementById('mimic-ar-stop').onclick = function () {
      window.MimicAutoRun.stop();
    };
    return el;
  }

  function showClickRipple(xPct, yPct) {
    var ripple = document.createElement('div');
    ripple.style.cssText = [
      'position:fixed',
      'z-index:2147483642',
      'pointer-events:none',
      'left:' + xPct + '%',
      'top:' + yPct + '%',
      'width:40px',
      'height:40px',
      'border:3px solid #ef4444',
      'border-radius:50%',
      'animation:mimicRipple 0.5s ease-out forwards',
    ].join(';');
    document.body.appendChild(ripple);
    setTimeout(function () { ripple.parentNode && ripple.parentNode.removeChild(ripple); }, 520);
  }

  // window.MimicAutoRun 공개 인터페이스
  window.MimicAutoRun = {
    // AI 에이전트가 실행 시작 시 호출
    start: function (options) {
      options = options || {};
      injectAutoRunStyles();
      document.documentElement.classList.add('mimic-autorun-active');
      autoRunCursor = createAutoRunCursor();
      autoRunBar = createAutoRunBar(options.stepTitle || '', options.stepNum || 0, options.totalSteps || 0);
      autoRunPaused = false;
    },

    // AI가 다음 스텝으로 이동할 때 상태 업데이트
    updateStep: function (stepNum, totalSteps, stepTitle) {
      if (!autoRunBar) return;
      var titleEl = document.getElementById('mimic-ar-title');
      var stepEl = document.getElementById('mimic-ar-step');
      var fillEl = document.getElementById('mimic-ar-fill');
      if (titleEl) titleEl.textContent = stepTitle || '';
      if (stepEl) stepEl.textContent = stepNum + ' / ' + totalSteps;
      if (fillEl) fillEl.style.width = (totalSteps > 0 ? Math.round((stepNum / totalSteps) * 100) : 0) + '%';
    },

    // AI가 클릭하기 직전 커서 이동
    moveCursor: function (xPct, yPct) {
      if (!autoRunCursor) return;
      autoRunCursor.style.left = xPct + '%';
      autoRunCursor.style.top = yPct + '%';
    },

    // AI가 클릭할 때 ripple 효과
    click: function (xPct, yPct) {
      this.moveCursor(xPct, yPct);
      showClickRipple(xPct, yPct);
    },

    // 일시정지 여부 확인
    isPaused: function () { return autoRunPaused; },

    // 실행 종료 (완료 또는 중단)
    stop: function () {
      document.documentElement.classList.remove('mimic-autorun-active');
      if (autoRunCursor && autoRunCursor.parentNode) autoRunCursor.parentNode.removeChild(autoRunCursor);
      if (autoRunBar && autoRunBar.parentNode) autoRunBar.parentNode.removeChild(autoRunBar);
      autoRunCursor = null;
      autoRunBar = null;
      autoRunPaused = false;
      if (this._onStop) this._onStop();
    },

    // 내부 콜백 (웹앱에서 설정)
    _onPause: null,
    _onStop: null,
  };
})();
