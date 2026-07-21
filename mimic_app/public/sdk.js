/**
 * Parro Live Guide SDK
 * Usage: <script src="https://your-parro-app.example/sdk.js" data-parro-guide="SHARE_TOKEN"></script>
 * API: window.ParroSDK.start('SHARE_TOKEN')
 * Query param: ?parro_guide=SHARE_TOKEN
 * Legacy script attribute remains supported: data-guide="SHARE_TOKEN"
 * Legacy API names remain supported: window.MimicSDK.start('SHARE_TOKEN')
 * Legacy query param remains supported: ?mimic_guide=SHARE_TOKEN
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
  var BRAND_PRIMARY = '#009B8E';
  var BRAND_PRIMARY_HOVER = '#00796F';
  var BRAND_PRIMARY_SOFT = 'rgba(0,155,142,.12)';
  var BRAND_PRIMARY_RING = 'rgba(0,155,142,.36)';
  var BRAND_PRIMARY_PULSE = 'rgba(0,155,142,.9)';
  var BRAND_PRIMARY_PULSE_SOFT = 'rgba(0,155,142,.3)';
  var BRAND_GUIDE_PULSE = 'rgba(18,184,134,1)';
  var BRAND_GUIDE_PULSE_SOFT = 'rgba(18,184,134,.22)';
  var BRAND_GUIDE = '#12B886';
  var BRAND_POINTER = '#102033';

  // ── 스타일 주입 ────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('parro-sdk-styles') || document.getElementById('mimic-sdk-styles')) return;
    var style = document.createElement('style');
    style.id = 'parro-sdk-styles';
    style.textContent = [
      '.parro-overlay,.mimic-overlay{position:fixed;inset:0;z-index:' + (Z - 2) + ';pointer-events:none}',
      '.parro-backdrop,.mimic-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:' + (Z - 3) + ';transition:opacity .25s}',
      '.parro-highlight,.mimic-highlight{position:absolute;border-radius:6px;box-shadow:0 0 0 4px ' + BRAND_PRIMARY + ',0 0 0 9999px rgba(0,0,0,0.45);pointer-events:none;transition:all .25s;z-index:' + (Z - 1) + '}',
      '.parro-tooltip,.mimic-tooltip{position:absolute;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(17,24,39,.18),0 0 0 1px rgba(0,0,0,.06);padding:18px 20px 16px;min-width:260px;max-width:340px;pointer-events:all;z-index:' + Z + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '.parro-tooltip-center,.mimic-tooltip-center{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%)}',
      '.parro-step-badge,.mimic-step-badge{display:inline-block;font-size:11px;font-weight:700;color:' + BRAND_PRIMARY + ';background:' + BRAND_PRIMARY_SOFT + ';padding:2px 8px;border-radius:20px;margin-bottom:8px}',
      '.parro-tooltip-title,.mimic-tooltip-title{font-size:14px;font-weight:700;color:#111827;margin:0 0 6px;line-height:1.4}',
      '.parro-tooltip-caption,.mimic-tooltip-caption{font-size:13px;color:#4B5563;line-height:1.6;margin:0 0 14px}',
      '.parro-tooltip-actions,.mimic-tooltip-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.parro-btn,.mimic-btn{height:32px;padding:0 14px;border-radius:7px;font-size:12.5px;font-weight:600;border:none;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:5px}',
      '.parro-btn-primary,.mimic-btn-primary{background:' + BRAND_PRIMARY + ';color:#fff}',
      '.parro-btn-primary:hover,.mimic-btn-primary:hover{background:' + BRAND_PRIMARY_HOVER + '}',
      '.parro-btn-secondary,.mimic-btn-secondary{background:#F3F4F6;color:#374151}',
      '.parro-btn-secondary:hover,.mimic-btn-secondary:hover{background:#E5E7EB}',
      '.parro-btn-ghost,.mimic-btn-ghost{background:none;color:#9CA3AF;font-size:12px;padding:0 8px}',
      '.parro-btn-ghost:hover,.mimic-btn-ghost:hover{color:#6B7280}',
      '.parro-progress,.mimic-progress{display:flex;align-items:center;gap:4px}',
      '.parro-progress-dot,.mimic-progress-dot{width:6px;height:6px;border-radius:50%;background:#E5E7EB;transition:background .2s}',
      '.parro-progress-dot.active,.mimic-progress-dot.active{background:' + BRAND_PRIMARY + '}',
      '.parro-float-btn,.mimic-float-btn{position:fixed;bottom:24px;right:24px;width:48px;height:48px;border-radius:50%;background:' + BRAND_PRIMARY + ';color:#fff;border:none;cursor:pointer;box-shadow:0 4px 14px ' + BRAND_PRIMARY_RING + ';display:flex;align-items:center;justify-content:center;z-index:' + (Z - 4) + ';transition:all .2s}',
      '.parro-float-btn:hover,.mimic-float-btn:hover{background:' + BRAND_PRIMARY_HOVER + ';transform:scale(1.08)}',
      '.parro-close,.mimic-close{position:absolute;top:10px;right:10px;background:none;border:none;cursor:pointer;color:#9CA3AF;padding:4px;line-height:1}',
      '.parro-close:hover,.mimic-close:hover{color:#6B7280}',
    ].join('');
    document.head.appendChild(style);
  }

  // ── DOM 유틸 ───────────────────────────────────────────────
  function normalizeTargetText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function targetTextSimilarity(left, right) {
    var a = normalizeTargetText(left);
    var b = normalizeTargetText(right);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return Math.max(0.68, Math.min(a.length, b.length) / Math.max(a.length, b.length));
    return 0;
  }

  function targetName(el) {
    return el && (
      el.getAttribute('aria-label')
      || el.getAttribute('title')
      || el.getAttribute('placeholder')
      || el.getAttribute('name')
      || el.value
      || el.textContent
      || ''
    );
  }

  function visibleTarget(el) {
    if (!el || !el.isConnected || /^(HTML|BODY)$/.test(el.tagName || '')) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    var style = (el.ownerDocument && el.ownerDocument.defaultView || window).getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01;
  }

  function targetEvidenceMatches(el, targetContext) {
    if (!visibleTarget(el)) return false;
    var expectedName = targetContext && targetContext.accessibleName;
    return !expectedName || targetTextSimilarity(targetName(el), expectedName) >= 0.55;
  }

  function guidePageMatches(pageUrl) {
    try {
      var expected = new URL(pageUrl);
      var current = new URL(location.href);
      var normalizePath = function (path) { return path.length > 1 ? path.replace(/\/$/, '') : path; };
      var routeHash = function (url) {
        var hash = decodeURIComponent(url.hash || '');
        if (!/^#!?\//.test(hash)) return '';
        return hash.replace(/^#!?/, '').split('?')[0].replace(/\/$/, '') || '/';
      };
      if (!/^https?:$/.test(expected.protocol)
        || expected.origin !== current.origin
        || normalizePath(expected.pathname) !== normalizePath(current.pathname)) return false;
      var expectedRoute = routeHash(expected);
      if (expectedRoute && expectedRoute !== routeHash(current)) return false;
      var volatileKey = /^(utm_.+|fbclid|gclid|_ga|code|state|session|session_id|timestamp|ts|_t)$/i;
      var matches = true;
      expected.searchParams.forEach(function (value, key) {
        if (!volatileKey.test(key) && current.searchParams.get(key) !== value) matches = false;
      });
      return matches;
    } catch (e) {
      return false;
    }
  }

  function findElement(selector, xpath, targetContext) {
    var root = document;
    var framePath = targetContext && Array.isArray(targetContext.framePath) ? targetContext.framePath : [];
    var shadowPath = targetContext && Array.isArray(targetContext.shadowPath) ? targetContext.shadowPath : [];
    try {
      for (var f = 0; f < framePath.length; f += 1) {
        var frame = root.querySelector(framePath[f]);
        if (!frame || !frame.contentDocument) return null;
        root = frame.contentDocument;
      }
      for (var s = 0; s < shadowPath.length; s += 1) {
        var host = root.querySelector(shadowPath[s]);
        if (!host || !host.shadowRoot) return null;
        root = host.shadowRoot;
      }
    } catch (e) {
      // Cross-origin frames cannot be traversed by the embed SDK. Returning null
      // keeps the guide hidden instead of highlighting an unrelated element.
      return null;
    }
    if (selector) {
      try {
        var matches = Array.prototype.slice.call(root.querySelectorAll(selector)).filter(function (el) {
          return targetEvidenceMatches(el, targetContext);
        });
        if (matches.length === 1) return matches[0];
      } catch (e) { /* invalid selector */ }
    }
    if (xpath && root.nodeType === Node.DOCUMENT_NODE) {
      try {
        var result = root.evaluate(xpath, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (targetEvidenceMatches(result.singleNodeValue, targetContext)) return result.singleNodeValue;
      } catch (e) { /* invalid xpath */ }
    }
    return null;
  }

  function getRect(el) {
    var r = el.getBoundingClientRect();
    var top = r.top;
    var left = r.left;
    var width = r.width;
    var height = r.height;
    var ownerWindow = el.ownerDocument && el.ownerDocument.defaultView;
    try {
      while (ownerWindow && ownerWindow !== window) {
        var frame = ownerWindow.frameElement;
        if (!frame) break;
        var fr = frame.getBoundingClientRect();
        var scaleX = fr.width / Math.max(1, ownerWindow.innerWidth);
        var scaleY = fr.height / Math.max(1, ownerWindow.innerHeight);
        left = fr.left + left * scaleX;
        top = fr.top + top * scaleY;
        width *= scaleX;
        height *= scaleY;
        ownerWindow = ownerWindow.parent;
      }
    } catch (e) { /* cross-origin paths are rejected by findElement */ }
    return { top: top, left: left, width: width, height: height };
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
    this._audio = null;
  }

  Guide.prototype.start = function (startIndex) {
    if (this._running) this.destroy();
    this._running = true;
    this.current = startIndex || 0;
    injectStyles();
    this._render();
  };

  Guide.prototype._stopAudio = function () {
    try {
      if (this._audio) {
        this._audio.pause();
        this._audio.src = '';
      }
    } catch (e) { /* noop */ }
    this._audio = null;
  };

  Guide.prototype._playAudio = function (url) {
    if (!url) return;
    this._stopAudio();
    try {
      this._audio = new Audio(url);
      this._audio.play().catch(function () {});
    } catch (e) { /* noop */ }
  };

  Guide.prototype._render = function () {
    this._clean();
    var step = this.steps[this.current];
    if (!step) { this.destroy(); return; }

    var self = this;
    if (!step.page_url || !guidePageMatches(step.page_url)) {
      this._retryTimer = setTimeout(function () { if (self._running) self._render(); }, 900);
      return;
    }
    var targetEl = findElement(step.element_selector, step.element_xpath, step.target_context);

    // 대상이 확인되지 않으면 아무 화면에도 fallback 카드/딤을 띄우지 않는다.
    if (!targetEl) {
      this._retryTimer = setTimeout(function () { if (self._running) self._render(); }, 900);
      return;
    }

    // 하이라이트
    if (targetEl) {
      var highlight = document.createElement('div');
      highlight.className = 'parro-highlight mimic-highlight';
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
    }

    // 툴팁 생성
    var tooltip = document.createElement('div');
    tooltip.className = 'parro-tooltip mimic-tooltip';

    // 닫기 버튼
    var closeBtn = document.createElement('button');
    closeBtn.className = 'parro-close mimic-close';
    closeBtn.setAttribute('aria-label', '닫기');
    closeBtn.appendChild(makeCloseIcon());
    closeBtn.addEventListener('click', function () { self.destroy(); });
    tooltip.appendChild(closeBtn);

    // 뱃지
    var badge = document.createElement('div');
    badge.className = 'parro-step-badge mimic-step-badge';
    badge.textContent = (this.current + 1) + ' / ' + this.steps.length;
    tooltip.appendChild(badge);

    // 제목
    var titleEl = document.createElement('p');
    titleEl.className = 'parro-tooltip-title mimic-tooltip-title';
    titleEl.textContent = step.title || '';
    tooltip.appendChild(titleEl);

    // 설명
    if (step.caption) {
      var caption = document.createElement('p');
      caption.className = 'parro-tooltip-caption mimic-tooltip-caption';
      caption.textContent = step.caption;
      tooltip.appendChild(caption);
    }

    // 진행 dots + 버튼
    var actions = document.createElement('div');
    actions.className = 'parro-tooltip-actions mimic-tooltip-actions';

    // 진행 dots
    var progress = document.createElement('div');
    progress.className = 'parro-progress mimic-progress';
    var MAX_DOTS = 7;
    var total = this.steps.length;
    var shown = Math.min(total, MAX_DOTS);
    var offset = total > MAX_DOTS ? Math.max(0, Math.min(this.current - Math.floor(MAX_DOTS / 2), total - MAX_DOTS)) : 0;
    for (var i = 0; i < shown; i++) {
      var dot = document.createElement('div');
      dot.className = 'parro-progress-dot mimic-progress-dot' + (i + offset === this.current ? ' active' : '');
      progress.appendChild(dot);
    }
    actions.appendChild(progress);

    // 버튼 그룹
    var btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:6px;align-items:center';

    if (step.audio_url) {
      var audioBtn = document.createElement('button');
      audioBtn.className = 'parro-btn parro-btn-secondary mimic-btn mimic-btn-secondary';
      audioBtn.textContent = '음성';
      audioBtn.addEventListener('click', function () { self._playAudio(step.audio_url); });
      btnGroup.appendChild(audioBtn);
    }

    if (this.current > 0) {
      var prevBtn = document.createElement('button');
      prevBtn.className = 'parro-btn parro-btn-secondary mimic-btn mimic-btn-secondary';
      prevBtn.textContent = '이전';
      prevBtn.addEventListener('click', function () { self.prev(); });
      btnGroup.appendChild(prevBtn);
    }

    var isLast = this.current === this.steps.length - 1;
    var nextBtn = document.createElement('button');
    nextBtn.className = 'parro-btn parro-btn-primary mimic-btn mimic-btn-primary';
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
      tooltip.classList.add('parro-tooltip-center', 'mimic-tooltip-center');
    }

    this._els.tooltip = tooltip;

    // 키보드 이벤트
    this._keyHandler = function (e) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') self.next();
      if (e.key === 'ArrowLeft') self.prev();
      if (e.key === 'Escape') self.destroy();
    };
    document.addEventListener('keydown', this._keyHandler);
    this._playAudio(step.audio_url);
  };

  Guide.prototype._clean = function () {
    this._stopAudio();
    if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null; }
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
    btn.className = 'parro-float-btn mimic-float-btn';
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
    input.addEventListener('focus', function () { input.style.borderColor = BRAND_PRIMARY; });
    input.addEventListener('blur', function () { input.style.borderColor = '#E5E7EB'; });

    var errMsg = document.createElement('p');
    errMsg.style.cssText = 'margin:0 0 10px;font-size:12px;color:#EF4444;display:none';
    errMsg.textContent = '비밀번호가 올바르지 않습니다.';

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'parro-btn parro-btn-secondary mimic-btn mimic-btn-secondary';
    cancelBtn.style.flex = '1';
    cancelBtn.textContent = '취소';
    cancelBtn.addEventListener('click', function () { overlay.remove(); });

    var okBtn = document.createElement('button');
    okBtn.className = 'parro-btn parro-btn-primary mimic-btn mimic-btn-primary';
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
      .catch(function (e) { console.error('[Parro]', e); });
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
    // 1. <script data-parro-guide="TOKEN"> 방식 (legacy data-guide도 지원)
    // data-float: 플로팅 버튼 모드 / data-manual: 자동 시작 안 함 / 기본: 즉시 자동 시작
    var scripts = document.querySelectorAll('script[data-parro-guide],script[data-guide]');
    for (var i = 0; i < scripts.length; i++) {
      var token = scripts[i].getAttribute('data-parro-guide') || scripts[i].getAttribute('data-guide');
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

    // 2. ?parro_guide=TOKEN 쿼리파라미터 (legacy ?mimic_guide=TOKEN도 지원)
    try {
      var params = new URLSearchParams(location.search);
      var qToken = params.get('parro_guide') || params.get('mimic_guide');
      if (qToken) startGuide(qToken, {});
    } catch (e) { /* old browser */ }

    // 3. data-parro-float 속성이 있는 요소에 플로팅 버튼 연결 (legacy data-mimic-float도 지원)
    var floatEls = document.querySelectorAll('[data-parro-float],[data-mimic-float]');
    for (var j = 0; j < floatEls.length; j++) {
      var ft = floatEls[j].getAttribute('data-parro-float') || floatEls[j].getAttribute('data-mimic-float');
      if (ft) startGuide(ft, { float: true });
    }
  }

  // window.ParroSDK 공개. window.MimicSDK는 기존 임베드 호환을 위해 같은 객체를 가리킨다.
  var parroSdk = {
    start: function (token, options) { startGuide(token, options); },
    stop: function () { if (activeGuide) activeGuide.destroy(); },
    // URL 패턴이 현재 페이지와 일치할 때만 가이드 시작 (* 와일드카드 지원)
    // 예: ParroSDK.startOnUrl('https://app.example.com/dashboard*', 'TOKEN')
    startOnUrl: function (urlPattern, token, options) {
      if (matchesPattern(urlPattern)) startGuide(token, options);
    },
    version: '1.0.0',
  };
  window.ParroSDK = parroSdk;
  window.MimicSDK = parroSdk;

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

  function getAutoRunElement(primaryId, legacyId) {
    return document.getElementById(primaryId) || document.getElementById(legacyId);
  }

  function injectAutoRunStyles() {
    if (document.getElementById('parro-autorun-styles') || document.getElementById('mimic-autorun-styles')) return;
    var s = document.createElement('style');
    s.id = 'parro-autorun-styles';
    s.textContent = [
      // 파란 테두리 pulse — body에 직접 적용
      '@keyframes parroBorderPulse {',
      '  0%,100% { box-shadow: inset 0 0 0 4px ' + BRAND_PRIMARY_PULSE + ', inset 0 0 0 6px ' + BRAND_PRIMARY_PULSE_SOFT + '; }',
      '  50%     { box-shadow: inset 0 0 0 4px ' + BRAND_GUIDE_PULSE + ',   inset 0 0 0 10px ' + BRAND_GUIDE_PULSE_SOFT + '; }',
      '}',
      '@keyframes mimicBorderPulse {',
      '  0%,100% { box-shadow: inset 0 0 0 4px ' + BRAND_PRIMARY_PULSE + ', inset 0 0 0 6px ' + BRAND_PRIMARY_PULSE_SOFT + '; }',
      '  50%     { box-shadow: inset 0 0 0 4px ' + BRAND_GUIDE_PULSE + ',   inset 0 0 0 10px ' + BRAND_GUIDE_PULSE_SOFT + '; }',
      '}',
      // 클릭 ripple
      '@keyframes parroRipple {',
      '  0%   { transform: translate(-50%,-50%) scale(0); opacity: 1; }',
      '  100% { transform: translate(-50%,-50%) scale(3); opacity: 0; }',
      '}',
      '@keyframes mimicRipple {',
      '  0%   { transform: translate(-50%,-50%) scale(0); opacity: 1; }',
      '  100% { transform: translate(-50%,-50%) scale(3); opacity: 0; }',
      '}',
      // 커서 등장
      '@keyframes parroCursorIn {',
      '  from { opacity: 0; transform: scale(0.5); }',
      '  to   { opacity: 1; transform: scale(1); }',
      '}',
      '@keyframes mimicCursorIn {',
      '  from { opacity: 0; transform: scale(0.5); }',
      '  to   { opacity: 1; transform: scale(1); }',
      '}',
      // 상태 바 등장
      '@keyframes parroBarIn {',
      '  from { opacity: 0; transform: translateX(-50%) translateY(20px); }',
      '  to   { opacity: 1; transform: translateX(-50%) translateY(0); }',
      '}',
      '@keyframes mimicBarIn {',
      '  from { opacity: 0; transform: translateX(-50%) translateY(20px); }',
      '  to   { opacity: 1; transform: translateX(-50%) translateY(0); }',
      '}',
      '@keyframes parroAvatarTalk {',
      '  0%,100% { transform: translateY(0) rotate(0deg); }',
      '  35% { transform: translateY(-2px) rotate(-1.5deg); }',
      '  70% { transform: translateY(-1px) rotate(1deg); }',
      '}',
      '@keyframes parroAvatarFramePrimary {',
      '  0%,54%,100% { opacity:1; transform:translateY(0) scale(1); }',
      '  64%,82% { opacity:0; transform:translateY(1px) scale(.985); }',
      '  91% { opacity:1; transform:translateY(0) scale(1); }',
      '}',
      '@keyframes parroAvatarFrameSecondary {',
      '  0%,54%,100% { opacity:0; transform:translateY(1px) scale(.98); }',
      '  64%,82% { opacity:1; transform:translateY(0) scale(1); }',
      '  91% { opacity:0; transform:translateY(-1px) scale(.99); }',
      '}',
      '#parro-autorun-cursor,#mimic-autorun-cursor {',
      '  position: fixed; z-index: 2147483640; pointer-events: none;',
      '  width: 24px; height: 24px;',
      '  transition: left 0.35s cubic-bezier(.4,0,.2,1), top 0.35s cubic-bezier(.4,0,.2,1);',
      '  animation: parroCursorIn 0.3s ease;',
      '  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));',
      '}',
      '#parro-autorun-bar,#mimic-autorun-bar {',
      '  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);',
      '  z-index: 2147483641; pointer-events: auto;',
      '  display: flex; align-items: center; gap: 12px;',
      '  background: rgba(17,24,39,0.94); color: white;',
      '  padding: 10px 20px; border-radius: 999px;',
      '  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      '  font-size: 13px; font-weight: 500;',
      '  box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08);',
      '  animation: parroBarIn 0.3s ease;',
      '  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);',
      '  white-space: nowrap;',
      '}',
      '#parro-autorun-bar .mar-icon,#mimic-autorun-bar .mar-icon { position:relative;display:inline-flex;width:24px;height:24px;flex:none;align-items:center;justify-content:center;overflow:hidden;animation:parroAvatarTalk 1.6s ease-in-out infinite; }',
      '#parro-autorun-bar .mar-icon img,#mimic-autorun-bar .mar-icon img { position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain;user-select:none;pointer-events:none; }',
      '#parro-autorun-bar .mar-icon-primary,#mimic-autorun-bar .mar-icon-primary { animation:parroAvatarFramePrimary 4s ease-in-out infinite; }',
      '#parro-autorun-bar .mar-icon-secondary,#mimic-autorun-bar .mar-icon-secondary { opacity:0;animation:parroAvatarFrameSecondary 4s ease-in-out infinite; }',
      '@media (prefers-reduced-motion:reduce){#parro-autorun-bar .mar-icon,#mimic-autorun-bar .mar-icon,#parro-autorun-bar .mar-icon img,#mimic-autorun-bar .mar-icon img{animation:none!important}#parro-autorun-bar .mar-icon-secondary,#mimic-autorun-bar .mar-icon-secondary{display:none}}',
      '#parro-autorun-bar .mar-label,#mimic-autorun-bar .mar-label { color: rgba(255,255,255,0.55); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }',
      '#parro-autorun-bar .mar-title,#mimic-autorun-bar .mar-title { max-width: 200px; overflow: hidden; text-overflow: ellipsis; }',
      '#parro-autorun-bar .mar-progress,#mimic-autorun-bar .mar-progress { display: flex; align-items: center; gap: 6px; color: rgba(255,255,255,0.5); font-size: 12px; }',
      '#parro-autorun-bar .mar-bar,#mimic-autorun-bar .mar-bar { width: 80px; height: 3px; background: rgba(255,255,255,0.15); border-radius: 999px; overflow: hidden; }',
      '#parro-autorun-bar .mar-bar-fill,#mimic-autorun-bar .mar-bar-fill { height: 100%; background: ' + BRAND_GUIDE + '; border-radius: 999px; transition: width 0.4s ease; }',
      '#parro-autorun-bar .mar-btn,#mimic-autorun-bar .mar-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: white; border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; transition: background 0.15s; }',
      '#parro-autorun-bar .mar-btn:hover,#mimic-autorun-bar .mar-btn:hover { background: rgba(255,255,255,0.2); }',
      '#parro-autorun-bar .mar-divider,#mimic-autorun-bar .mar-divider { width: 1px; height: 18px; background: rgba(255,255,255,0.12); }',
      '.parro-autorun-active,.mimic-autorun-active { animation: parroBorderPulse 2s ease-in-out infinite !important; }',
    ].join('\n');
    document.head.appendChild(s);
  }

  function createAutoRunCursor() {
    var el = document.createElement('div');
    el.id = 'parro-autorun-cursor';
    el.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">'
      + '<path d="M4 2 L18 12 L11 13 L8 20 Z" fill="white" stroke="' + BRAND_POINTER + '" stroke-width="1.5" stroke-linejoin="round"/>'
      + '<circle cx="18" cy="18" r="4" fill="' + BRAND_GUIDE + '"/>'
      + '</svg>';
    el.style.left = '-100px';
    el.style.top = '-100px';
    document.body.appendChild(el);
    return el;
  }

  function createAutoRunBar(stepTitle, stepNum, totalSteps) {
    var el = document.createElement('div');
    el.id = 'parro-autorun-bar';
    var pct = totalSteps > 0 ? Math.round((stepNum / totalSteps) * 100) : 0;

    // 정적 구조만 innerHTML로 (외부 데이터 없음)
    el.innerHTML = '<span class="mar-icon"><img class="mar-icon-primary" src="' + BASE_URL + '/brand/parro-ai-avatar-talk.png" alt="" draggable="false"><img class="mar-icon-secondary" src="' + BASE_URL + '/brand/parro-ai-avatar-point.png" alt="" draggable="false"></span>'
      + '<span class="mar-label">AI 실행 중 · BETA</span>'
      + '<span class="mar-divider"></span>'
      + '<span class="mar-title" id="parro-ar-title"></span>'
      + '<span class="mar-progress">'
      + '  <span id="parro-ar-step"></span>'
      + '  <span class="mar-bar"><span class="mar-bar-fill" id="parro-ar-fill"></span></span>'
      + '</span>'
      + '<span class="mar-divider"></span>'
      + '<button class="mar-btn" id="parro-ar-pause">⏸ 일시정지</button>'
      + '<button class="mar-btn" id="parro-ar-stop">⏹ 중단</button>';

    // 외부 데이터는 textContent로 안전하게 삽입
    el.querySelector('#parro-ar-title').textContent = stepTitle || '';
    el.querySelector('#parro-ar-step').textContent = stepNum + ' / ' + totalSteps;
    el.querySelector('#parro-ar-fill').style.width = pct + '%';

    document.body.appendChild(el);

    document.getElementById('parro-ar-pause').onclick = function () {
      autoRunPaused = !autoRunPaused;
      this.textContent = autoRunPaused ? '▶ 재개' : '⏸ 일시정지';
      var autoRunApi = window.ParroAutoRun || window.MimicAutoRun;
      if (autoRunApi && autoRunApi._onPause) autoRunApi._onPause(autoRunPaused);
    };
    document.getElementById('parro-ar-stop').onclick = function () {
      var autoRunApi = window.ParroAutoRun || window.MimicAutoRun;
      if (autoRunApi) autoRunApi.stop();
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
      'animation:parroRipple 0.5s ease-out forwards',
    ].join(';');
    document.body.appendChild(ripple);
    setTimeout(function () { ripple.parentNode && ripple.parentNode.removeChild(ripple); }, 520);
  }

  // window.ParroAutoRun 공개 인터페이스. window.MimicAutoRun은 기존 임베드 호환 alias.
  var parroAutoRun = {
    // AI 에이전트가 실행 시작 시 호출
    start: function (options) {
      options = options || {};
      injectAutoRunStyles();
      document.documentElement.classList.add('parro-autorun-active');
      autoRunCursor = createAutoRunCursor();
      autoRunBar = createAutoRunBar(options.stepTitle || '', options.stepNum || 0, options.totalSteps || 0);
      autoRunPaused = false;
    },

    // AI가 다음 스텝으로 이동할 때 상태 업데이트
    updateStep: function (stepNum, totalSteps, stepTitle) {
      if (!autoRunBar) return;
      var titleEl = getAutoRunElement('parro-ar-title', 'mimic-ar-title');
      var stepEl = getAutoRunElement('parro-ar-step', 'mimic-ar-step');
      var fillEl = getAutoRunElement('parro-ar-fill', 'mimic-ar-fill');
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
      document.documentElement.classList.remove('parro-autorun-active');
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
  window.ParroAutoRun = parroAutoRun;
  window.MimicAutoRun = parroAutoRun;
})();
