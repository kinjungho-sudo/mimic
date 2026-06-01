/**
 * MIMIC Guide Me SDK
 * Usage: <script src="https://mimicflow.com/sdk.js" data-guide="SHARE_TOKEN"></script>
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
    return 'https://mimicflow.com';
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

  // ── 자동 초기화 ────────────────────────────────────────────
  function autoInit() {
    // 1. <script data-guide="TOKEN"> 방식
    var scripts = document.querySelectorAll('script[data-guide]');
    for (var i = 0; i < scripts.length; i++) {
      var token = scripts[i].getAttribute('data-guide');
      var floatAttr = scripts[i].getAttribute('data-float');
      var autoAttr = scripts[i].getAttribute('data-auto');
      if (token) {
        if (floatAttr !== null) {
          startGuide(token, { float: true });
        } else if (autoAttr !== null || floatAttr === null) {
          startGuide(token, {});
        }
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
    version: '1.0.0',
  };

  // DOM 준비 후 자동 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
