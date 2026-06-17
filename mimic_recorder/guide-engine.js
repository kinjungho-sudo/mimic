// guide-engine.js — Guide Me 라이브 오버레이 엔진 (재생 전용; 녹화 코드와 무관)
// content_scripts에서 content.js보다 먼저 로드되어 window.MimicGuide 를 노출한다.
// 부작용 없음: 호출 전까지 리스너/DOM/타이머를 만들지 않는다.
(function () {
  'use strict';
  if (window.MimicGuide) return; // 중복 주입 방지

  const Z = 2147483640;
  const COORD_BOX = 46;
  const HIT_PAD_EL = 6;
  const HIT_PAD_COORD = 28;
  const TIP_W = 300;  // 툴팁 고정 너비(px)
  const TIP_GAP = 24; // 타깃과 툴팁 사이 간격(px)
  const TIP_M = 8;    // 뷰포트 여백(px)

  let state = null;
  const regroundedSteps = new Set();  // AI 시각 재탐색 1회성 가드 (스텝당 1회)

  // ── 순수 로직 ────────────────────────────────────────────────
  function resolveTarget(step) {
    let el = null, rect = null, source = 'none';

    // 0순위: AI 시각 재탐색 좌표 (셀렉터·XPath·퍼지 모두 실패 후 복구된 위치)
    if (step._regroundXY) {
      const px = step._regroundXY.x * window.innerWidth, py = step._regroundXY.y * window.innerHeight;
      const hit = document.elementFromPoint(px, py);
      if (hit && hit.id !== 'mimic-overlay-root') { el = hit; rect = rectOf(hit); }
      else { rect = { left: px - COORD_BOX / 2, top: py - COORD_BOX / 2, width: COORD_BOX, height: COORD_BOX }; }
      return { el, rect, source: 'ai' };
    }

    // 0.5순위: 소유자가 스튜디오에서 직접 보정한 핫스팟(0~100%) — 자동 탐지보다 우선(명시 수정한 위치)
    if (step.hotspot_x != null && step.hotspot_y != null) {
      const px = (step.hotspot_x / 100) * window.innerWidth, py = (step.hotspot_y / 100) * window.innerHeight;
      const hit = document.elementFromPoint(px, py);
      if (hit && hit.id !== 'mimic-overlay-root') { el = hit; rect = rectOf(hit); }
      else { rect = { left: px - COORD_BOX / 2, top: py - COORD_BOX / 2, width: COORD_BOX, height: COORD_BOX }; }
      return { el, rect, source: 'manual' };
    }

    // 1순위: CSS Selector
    if (step.element_selector) {
      try { el = document.querySelector(step.element_selector); } catch { el = null; }
      if (el) { rect = rectOf(el); source = 'selector'; }
    }

    // 2순위: XPath
    if (!rect && step.element_xpath) {
      try {
        const xr = document.evaluate(step.element_xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const xe = xr.singleNodeValue;
        if (xe) { el = xe; rect = rectOf(xe); source = 'xpath'; }
      } catch { /* noop */ }
    }

    // 2.5순위: 퍼지 자가복구 — 셀렉터·XPath가 모두 깨졌을 때 저장 힌트(텍스트·속성·위치)로 후보 점수화
    if (!rect) {
      const fz = fuzzyFind(step);
      if (fz) { el = fz; rect = rectOf(fz); source = 'fuzzy'; }
    }

    // 3순위: 정규화 rect (0~1)
    if (!rect && step.element_rect) {
      const r = step.element_rect;
      rect = { left: r.x * window.innerWidth, top: r.y * window.innerHeight, width: r.width * window.innerWidth, height: r.height * window.innerHeight };
      source = 'rect';
    }

    // 4순위: click_x/y (0~1 정규화) — 핫스팟은 0.5순위에서 이미 처리
    if (!rect && step.click_x != null && step.click_y != null) {
      const cx = step.click_x * window.innerWidth, cy = step.click_y * window.innerHeight;
      rect = { left: cx - COORD_BOX / 2, top: cy - COORD_BOX / 2, width: COORD_BOX, height: COORD_BOX };
      source = 'coord';
    }

    return { el, rect, source };
  }

  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  // ── 퍼지 자가복구 (P2) ────────────────────────────────────────
  // 셀렉터/XPath가 모두 깨졌을 때, 저장된 힌트(보이는 텍스트·속성·위치)로 현재 DOM 후보를
  // 점수화해 같은 요소를 재발견한다. 좌표 폴백보다 정확하고, 화면이 바뀌면(텍스트 없음) null.
  function normText(s) { return (s || '').trim().replace(/\s+/g, ' '); }

  function isVisibleEl(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity || '1') > 0.01;
  }

  function tokenOverlap(a, b) {
    const ta = new Set(a.split(' ').filter(Boolean));
    const tb = new Set(b.split(' ').filter(Boolean));
    if (!ta.size || !tb.size) return 0;
    let inter = 0; ta.forEach(t => { if (tb.has(t)) inter += 1; });
    return inter / (ta.size + tb.size - inter); // Jaccard
  }

  // 저장된 selector/xpath/좌표에서 매칭 힌트 추출 (P1 텍스트앵커 XPath가 보이는 텍스트를 인코딩)
  function extractHint(step) {
    const hint = { tag: null, text: null, attrName: null, attrVal: null, nx: null, ny: null };
    const xp = step.element_xpath || '';
    const m = xp.match(/^\/\/([a-z0-9]+)\[normalize-space\(\.\)=(['"])([\s\S]*?)\2\]$/i);
    if (m) { hint.tag = m[1].toLowerCase(); hint.text = m[3]; }
    const sel = step.element_selector || '';
    const a = sel.match(/([a-z0-9]+)?\[(name|aria-label|data-testid)="([^"]*)"\]\s*$/i);
    if (a) { if (!hint.tag && a[1]) hint.tag = a[1].toLowerCase(); hint.attrName = a[2]; hint.attrVal = a[3]; }
    if (!hint.tag) { const t = sel.match(/([a-z0-9]+)\s*$/i); if (t) hint.tag = t[1].toLowerCase(); }
    if (step.click_x != null && step.click_y != null) { hint.nx = step.click_x; hint.ny = step.click_y; }
    else if (step.element_rect) { hint.nx = step.element_rect.x + step.element_rect.width / 2; hint.ny = step.element_rect.y + step.element_rect.height / 2; }
    return hint;
  }

  function scoreCandidate(el, hint, vw, vh) {
    if (!isVisibleEl(el)) return 0;
    let score = 0, w = 0;
    if (hint.text) {
      w += 0.5;
      const t = normText(el.textContent);
      if (t && t === hint.text) score += 0.5;
      else if (t && (t.includes(hint.text) || hint.text.includes(t))) score += 0.32;
      else score += 0.5 * tokenOverlap(t, hint.text);
    }
    if (hint.attrVal) {
      w += 0.3;
      const v = el.getAttribute(hint.attrName);
      if (v === hint.attrVal) score += 0.3;
      else if (v && (v.includes(hint.attrVal) || hint.attrVal.includes(v))) score += 0.18;
    }
    if (hint.tag) { w += 0.1; if (el.tagName.toLowerCase() === hint.tag) score += 0.1; }
    if (hint.nx != null) {
      w += 0.1;
      const r = el.getBoundingClientRect();
      const cx = (r.left + r.width / 2) / vw, cy = (r.top + r.height / 2) / vh;
      const d = Math.hypot(cx - hint.nx, cy - hint.ny);
      score += 0.1 * Math.max(0, 1 - d / 0.5);
    }
    return w ? score / w : 0;
  }

  function fuzzyFind(step) {
    const hint = extractHint(step);
    if (!hint.text && !hint.attrVal) return null;  // 점수 근거 없음 → 시도 안 함(좌표 폴백 유지)
    // 태그는 필터가 아닌 점수 신호 — 태그가 바뀐 경우(button→div[role=button])도 잡도록 합집합
    let sel = 'a,button,input,select,textarea,label,[role],[onclick],[tabindex]';
    if (hint.tag && /^[a-z][a-z0-9]*$/.test(hint.tag)) sel = hint.tag + ',' + sel;
    let nodes;
    try { nodes = document.querySelectorAll(sel); } catch { return null; }
    const vw = window.innerWidth, vh = window.innerHeight;
    let best = null, bestScore = 0;
    for (const el of nodes) {
      const s = scoreCandidate(el, hint, vw, vh);
      if (s > bestScore) { bestScore = s; best = el; }
    }
    return bestScore >= 0.6 ? best : null;
  }

  function pointInRect(x, y, rect, pad) {
    return x >= rect.left - pad && x <= rect.left + rect.width + pad &&
           y >= rect.top - pad && y <= rect.top + rect.height + pad;
  }

  function isHit(clientX, clientY, target, eventTarget) {
    if (!target || !target.rect) return false;
    if (target.el && eventTarget && (target.el === eventTarget || target.el.contains(eventTarget))) return true;
    const pad = target.el ? HIT_PAD_EL : HIT_PAD_COORD;
    const live = target.el ? rectOf(target.el) : target.rect;
    return pointInRect(clientX, clientY, live, pad);
  }

  // 툴팁 위치 계산 — 타깃 rect 기준, 공간 여유에 따라 아래/위 자동 선택
  function calcTipPos(r, tipH) {
    const VW = window.innerWidth, VH = window.innerHeight;
    const spaceBelow = VH - (r.top + r.height + TIP_GAP + TIP_M);
    const spaceAbove = r.top - TIP_GAP - TIP_M;
    const h = tipH || 200;

    let top, arrowDir;
    if (spaceBelow >= h || spaceBelow >= spaceAbove) {
      top = r.top + r.height + TIP_GAP;
      arrowDir = 'top';
    } else {
      top = r.top - h - TIP_GAP;
      arrowDir = 'bottom';
    }
    top = Math.max(TIP_M, Math.min(VH - h - TIP_M, top));

    let left = r.left + r.width / 2 - TIP_W / 2;
    left = Math.max(TIP_M, Math.min(VW - TIP_W - TIP_M, left));

    // 화살표 가로 위치: 타깃 중심 → 툴팁 내 상대 좌표
    const arrowLeft = Math.max(16, Math.min(TIP_W - 32, r.left + r.width / 2 - left - 8));

    return { left, top, arrowDir, arrowLeft };
  }

  // 마스코트 SVG HTML
  const MASCOT_SVG = `<svg width="27" height="27" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="7" width="16" height="12" rx="4" fill="white"/>
    <circle cx="9.5" cy="13" r="1.7" fill="#4f46e5"/>
    <circle cx="14.5" cy="13" r="1.7" fill="#4f46e5"/>
    <path d="M9.5 16.2c1.6 1 3.4 1 5 0" stroke="#4f46e5" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="12" y1="3.5" x2="12" y2="7" stroke="white" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="12" cy="3" r="1.3" fill="white"/>
  </svg>`;

  const AVATAR_STYLE = `width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);box-shadow:0 4px 16px rgba(79,70,229,.5);display:flex;align-items:center;justify-content:center;flex-shrink:0;`;

  // ── 오버레이 렌더 ─────────────────────────────────────────────
  // 단계의 page_url과 현재 페이지(origin+pathname)가 같은지 — 다르면 핫스팟을 찍지 않는다.
  function pageMatches(pageUrl) {
    try {
      const a = new URL(pageUrl), b = new URL(location.href);
      return a.origin + a.pathname === b.origin + b.pathname;
    } catch { return true; }  // 파싱 불가 시 막지 않음
  }

  function show(step, opts) {
    hide();
    opts = opts || {};

    // URL 검증 — 엉뚱한 페이지면 좌표 핫스팟을 찍지 말고 '다른 페이지' 안내만 표시
    if (step && step.page_url && !pageMatches(step.page_url)) {
      showWrongPage(step, opts);
      return;
    }

    const resolved = resolveTarget(step);

    // 요소 검증 — 셀렉터/XPath가 있는데 현재 DOM에서 못 찾으면(같은 URL의 다른 화면,
    // 또는 녹화 때 차단돼 건너뛴 단계) 좌표로 엉뚱한 핫스팟을 찍지 않는다. 대기 모드로 두고
    // 요소가 화면에 나타나면 자동으로 정상 오버레이로 전환한다.
    const expectsEl = !!(step.element_selector || step.element_xpath);
    const foundEl   = resolved.source === 'selector' || resolved.source === 'xpath' || resolved.source === 'fuzzy' || resolved.source === 'ai' || resolved.source === 'manual';
    if (expectsEl && !foundEl) {
      showWaiting(step, opts);
      maybeReground(step, opts);  // AI 시각 재탐색 1회성 시도 (성공 시 좌표 오버레이로 전환)
      return;
    }

    if (resolved.el) {
      try {
        const r = resolved.el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight || r.left < 0 || r.right > window.innerWidth) {
          resolved.el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
        }
      } catch { /* noop */ }
    }

    const host = document.createElement('div');
    host.id = 'mimic-overlay-root';
    host.style.cssText = `all:initial;position:fixed;inset:0;pointer-events:none;z-index:${Z};`;
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });

    const root = document.createElement('div');
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';

    shadow.appendChild(style(`
      @keyframes mimic-ripple { 0%{transform:scale(1);opacity:.9} 100%{transform:scale(3.5);opacity:0} }
      @keyframes mimic-nudge  { 0%,100%{transform:none} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
      @keyframes mimic-avatar-in { 0%{transform:scale(0.5) translateY(8px);opacity:0} 65%{transform:scale(1.08)} 100%{transform:scale(1) translateY(0);opacity:1} }
      @keyframes mimic-tip-in { 0%{opacity:0;transform:translateY(6px) scale(0.97)} 100%{opacity:1;transform:translateY(0) scale(1)} }
      .mimic-btn { pointer-events:auto; cursor:pointer; border:none; border-radius:8px; font-size:13px; font-weight:600; padding:7px 12px; transition:opacity .15s; }
      .mimic-btn:active { opacity:.75; }
    `));

    // 스포트라이트 하이라이트 (보라색 글로우 + 어두운 배경 오버레이)
    const hl = document.createElement('div');
    hl.style.cssText = `position:fixed;pointer-events:none;box-sizing:border-box;border:2px solid rgba(99,102,241,0.85);background:rgba(99,102,241,.06);border-radius:8px;box-shadow:0 0 0 5px rgba(99,102,241,.18),0 0 0 9999px rgba(0,0,0,.65);z-index:2;transition:left .12s,top .12s,width .12s,height .12s;`;
    root.appendChild(hl);

    // 클릭 핀 — 중심 보라 점 제거, 물결 애니메이션만
    const pulse = document.createElement('div');
    pulse.style.cssText = `position:fixed;width:0;height:0;pointer-events:none;z-index:3;`;
    const ripple = document.createElement('div');
    ripple.style.cssText = `position:absolute;width:44px;height:44px;margin-left:-22px;margin-top:-22px;border-radius:50%;border:2.5px solid rgba(99,102,241,.85);animation:mimic-ripple 1.5s ease-out infinite;`;
    const ripple2 = document.createElement('div');
    ripple2.style.cssText = `position:absolute;width:44px;height:44px;margin-left:-22px;margin-top:-22px;border-radius:50%;border:2px solid rgba(99,102,241,.55);animation:mimic-ripple 1.5s ease-out 0.75s infinite;`;
    pulse.appendChild(ripple);
    pulse.appendChild(ripple2);
    root.appendChild(pulse);

    // 플로팅 아바타 — 타깃 우상단 고정 (툴팁 안에도 별도 표시)
    const avatar = document.createElement('div');
    avatar.style.cssText = `position:fixed;${AVATAR_STYLE}pointer-events:none;z-index:6;animation:mimic-avatar-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;`;
    avatar.innerHTML = MASCOT_SVG;
    root.appendChild(avatar);

    // 플로팅 툴팁 카드
    const idx = opts.index ?? 0, total = opts.total ?? 1;
    const typeTextSnippet = step.type_text
      ? escapeHtml(String(step.type_text).length > 60 ? String(step.type_text).slice(0, 60) + '…' : String(step.type_text))
      : '';

    const tooltip = document.createElement('div');
    tooltip.style.cssText = `position:fixed;width:${TIP_W}px;box-sizing:border-box;background:rgba(17,17,20,.93);color:#fff;border-radius:14px;padding:14px;box-shadow:0 12px 40px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.07);z-index:5;pointer-events:auto;animation:mimic-tip-in 0.28s ease forwards;`;
    tooltip.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
        <div style="${AVATAR_STYLE}">${MASCOT_SVG}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="font-size:11px;font-weight:700;color:#A5B4FC;background:rgba(99,102,241,.25);padding:2px 8px;border-radius:20px">${idx + 1} / ${total}</span>
            ${resolved.source === 'none' ? '<span style="font-size:10.5px;color:#FCA5A5">요소 미발견</span>' : ''}
            <div style="flex:1"></div>
            <button class="mimic-btn" data-act="hide-tooltip" title="툴팁 숨기기" style="background:transparent;color:rgba(255,255,255,.4);padding:3px 6px;font-size:11px">👁</button>
            <button class="mimic-btn" data-act="exit" style="background:transparent;color:rgba(255,255,255,.4);padding:3px 6px;font-size:12px">✕</button>
          </div>
          <div style="font-size:14px;font-weight:600;line-height:1.5;color:#F3F4F6">${escapeHtml(step.title || '')}</div>
          ${step.instruction && step.instruction !== step.title ? `<div style="font-size:12.5px;color:#9CA3AF;line-height:1.55;margin-top:3px">${escapeHtml(step.instruction)}</div>` : ''}
        </div>
      </div>
      ${step.type_text ? `
        <div style="margin-bottom:10px;background:rgba(99,102,241,.18);border:1px solid rgba(99,102,241,.3);border-radius:8px;padding:8px 10px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:11px;color:#A5B4FC;flex-shrink:0">⌨ 입력 텍스트</span>
            <button class="mimic-btn" data-act="copy" style="margin-left:auto;background:rgba(255,255,255,.12);color:#e0e7ff;font-size:11px;padding:3px 9px">복사</button>
          </div>
          <div style="font-size:11.5px;color:#c7d2fe;line-height:1.5;margin-top:5px;word-break:break-all">${typeTextSnippet}</div>
        </div>` : ''}
      <div style="display:flex;gap:6px;align-items:center">
        <button class="mimic-btn" data-act="prev" style="background:rgba(255,255,255,.1);color:#D1D5DB;font-size:12px;padding:6px 11px">← 이전</button>
        <div style="flex:1"></div>
        <button class="mimic-btn" data-act="next" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:7px 16px">${idx + 1 >= total ? '완료 ✓' : '다음 →'}</button>
      </div>`;

    // 화살표 (툴팁 꼬리)
    const arrow = document.createElement('div');
    arrow.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;';
    tooltip.appendChild(arrow);

    root.appendChild(tooltip);

    // 툴팁 복원 버튼 (툴팁 숨김 상태일 때 우하단에 표시)
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'mimic-btn';
    restoreBtn.style.cssText = `position:fixed;right:16px;bottom:16px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:8px 14px;border-radius:20px;box-shadow:0 4px 16px rgba(79,70,229,.5);pointer-events:auto;z-index:4;font-size:12px;font-weight:700;display:none;`;
    restoreBtn.textContent = '💬 가이드 보기';
    restoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state) return;
      state.tooltipHidden = false;
      try { chrome.storage.local.set({ guideHideTooltip: false }); } catch { /* noop */ }
    });
    root.appendChild(restoreBtn);

    shadow.appendChild(root);

    state = { host, shadow, hl, pulse, avatar, tooltip, arrow, restoreBtn, resolved, step, opts, idx, total, advanced: false, completed: false, fillTimer: null, tooltipHidden: false };

    // 툴팁 숨김 설정 불러오기
    try {
      chrome.storage.local.get(['guideHideTooltip'], (r) => {
        if (state) state.tooltipHidden = !!r.guideHideTooltip;
      });
    } catch { /* noop */ }

    // 자동입력
    if (step.type_text && resolved.el) autoFill(resolved.el, String(step.type_text));

    // 툴팁 버튼 이벤트
    tooltip.addEventListener('click', (e) => {
      e.stopPropagation();
      const act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'next') advance('manual');
      else if (act === 'prev') opts.onPrev && opts.onPrev();
      else if (act === 'exit') opts.onExit && opts.onExit();
      else if (act === 'hide-tooltip') {
        if (!state) return;
        state.tooltipHidden = true;
        try { chrome.storage.local.set({ guideHideTooltip: true }); } catch { /* noop */ }
      }
      else if (act === 'copy') {
        const text = state && state.step && state.step.type_text;
        if (text) {
          navigator.clipboard.writeText(String(text))
            .then(() => {
              const b = e.target;
              b.textContent = '✓ 복사됨';
              setTimeout(() => { if (b.isConnected) b.textContent = '복사'; }, 1500);
            })
            .catch(() => {});
        }
      }
    }, true);

    // 위치 추적 RAF
    const reposition = () => {
      if (!state) return;
      const t = state.resolved;
      if (!t || !t.rect) {
        hl.style.display = 'none';
        pulse.style.display = 'none';
        avatar.style.display = 'none';
        tooltip.style.display = 'none';
      } else if (t.el && !t.el.isConnected) {
        // 요소가 DOM에서 분리됨(SPA 화면 전환) → 대기 모드로 되돌려 재탐색
        show(state.step, state.opts);
        return;
      } else {
        const r = t.el ? rectOf(t.el) : t.rect;
        // 연결돼 있지만 숨겨졌거나 0크기면 이 프레임은 그리지 않음(깜빡임 방지)
        if (t.el && (r.width < 1 || r.height < 1)) {
          hl.style.display = 'none';
          pulse.style.display = 'none';
          avatar.style.display = 'none';
          tooltip.style.display = 'none';
          state.rafId = requestAnimationFrame(reposition);
          return;
        }
        const P = 5;

        // 스포트라이트 박스
        hl.style.display = 'block';
        hl.style.left = `${r.left - P}px`;
        hl.style.top  = `${r.top  - P}px`;
        hl.style.width  = `${r.width  + P * 2}px`;
        hl.style.height = `${r.height + P * 2}px`;

        // 클릭 핀
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        pulse.style.display = 'block';
        pulse.style.left = `${cx}px`;
        pulse.style.top  = `${cy}px`;

        // 플로팅 아바타 (타깃 우상단)
        const avSize = 44;
        let avX = r.left + r.width - avSize * 0.3;
        let avY = r.top - avSize * 0.7;
        avX = Math.max(8, Math.min(window.innerWidth  - avSize - 8, avX));
        avY = Math.max(8, Math.min(window.innerHeight - avSize - 8, avY));
        avatar.style.display = 'flex';
        avatar.style.left = `${avX}px`;
        avatar.style.top  = `${avY}px`;

        // 툴팁 위치 + 화살표
        tooltip.style.display = 'block';
        const tipH = tooltip.offsetHeight || 200;
        const pos = calcTipPos(r, tipH);
        tooltip.style.left = `${pos.left}px`;
        tooltip.style.top  = `${pos.top}px`;

        if (pos.arrowDir === 'top') {
          arrow.style.cssText = `position:absolute;left:${pos.arrowLeft}px;top:-7px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:7px solid rgba(17,17,20,.93);pointer-events:none;`;
        } else {
          arrow.style.cssText = `position:absolute;left:${pos.arrowLeft}px;bottom:-7px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:7px solid rgba(17,17,20,.93);pointer-events:none;`;
        }

        // 소유자가 스튜디오에서 지정한 말풍선 위치 — 뷰포트 고정 코너로 override(화살표 숨김)
        const anchor = state.step && state.step.bubble_anchor;
        if (anchor) {
          const tH = tooltip.offsetHeight || tipH;
          const left = anchor === 'top-left' || anchor === 'bottom-left' ? TIP_M : window.innerWidth - TIP_W - TIP_M;
          const top  = anchor === 'top-left' || anchor === 'top-right'  ? TIP_M : window.innerHeight - tH - TIP_M;
          tooltip.style.left = `${left}px`;
          tooltip.style.top  = `${top}px`;
          arrow.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;display:none;';
        }
        // 툴팁 숨김 모드 적용
        if (state.tooltipHidden) tooltip.style.display = 'none';
        if (state.restoreBtn) state.restoreBtn.style.display = state.tooltipHidden ? 'flex' : 'none';
      }
      state.rafId = requestAnimationFrame(reposition);
    };
    state.rafId = requestAnimationFrame(reposition);

    // 클릭 감지 (캡처, 페이지 동작 막지 않음)
    const onDocClick = (e) => {
      if (state.advanced || state.completed) return;
      if (e.target === host) return;
      if (isHit(e.clientX, e.clientY, state.resolved, e.target)) {
        advance('click');
      } else {
        nudge();
      }
    };
    document.addEventListener('click', onDocClick, true);
    state.onDocClick = onDocClick;

    const onKey = (e) => { if (e.key === 'Escape') opts.onExit && opts.onExit(); };
    document.addEventListener('keydown', onKey, true);
    state.onKey = onKey;
  }

  function advance(reason) {
    if (!state || state.advanced || state.completed) return;
    state.advanced = true;
    if (state.idx + 1 >= state.total) {
      showComplete();
      state.opts.onComplete && state.opts.onComplete(reason);
      return;
    }
    state.opts.onAdvance && state.opts.onAdvance(reason);
  }

  function nudge() {
    if (!state || !state.tooltip) return;
    state.tooltip.style.animation = 'mimic-nudge .3s';
    setTimeout(() => { if (state && state.tooltip) state.tooltip.style.animation = ''; }, 320);
  }

  function showComplete() {
    if (!state) return;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.completed = true;
    state.hl.style.display = 'none';
    state.pulse.style.display = 'none';
    state.avatar.style.display = 'none';
    state.tooltip.innerHTML = `
      <div style="text-align:center;padding:10px 4px">
        <div style="${AVATAR_STYLE}margin:0 auto 12px;">${MASCOT_SVG}</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:6px">Live Guide 완료! 🎉</div>
        <div style="font-size:12.5px;color:#9CA3AF;margin-bottom:14px">모든 스텝을 완료했습니다.</div>
        <button class="mimic-btn" data-act="exit" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:9px 24px;width:100%">닫기</button>
      </div>`;
    state.tooltip.style.left = `${Math.max(TIP_M, (window.innerWidth - TIP_W) / 2)}px`;
    state.tooltip.style.top  = `${Math.max(TIP_M, (window.innerHeight - 220) / 2)}px`;
    state.tooltip.style.animation = 'mimic-tip-in 0.3s ease forwards';
  }

  // 현재 페이지가 단계의 page_url과 다를 때 — 오버레이 전부 숨김 (사이드패널에서만 안내)
  function showWrongPage(step, opts) {
    state = { host: null, wrongPage: true };
  }

  // 같은 URL이지만 녹화한 요소가 아직 화면에 없을 때 — 가짜 핫스팟 대신 '찾는 중' 카드를 띄우고
  // 요소가 나타나면 정상 오버레이로 자동 전환한다. (Typeform 등 SPA·녹화 차단으로 건너뛴 단계 대응)
  function showWaiting(step, opts) {
    const host = document.createElement('div');
    host.id = 'mimic-overlay-root';
    host.style.cssText = `all:initial;position:fixed;inset:0;pointer-events:none;z-index:${Z};font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;`;
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });

    const idx = opts.index ?? 0, total = opts.total ?? 1;

    const card = document.createElement('div');
    card.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);width:340px;max-width:calc(100vw - 32px);background:rgba(17,17,20,.94);color:#fff;border-radius:14px;padding:14px 16px;box-shadow:0 12px 40px rgba(0,0,0,.5);pointer-events:auto';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:11px;font-weight:700;color:#A5B4FC;background:rgba(99,102,241,.25);padding:2px 8px;border-radius:20px">${idx + 1} / ${total}</span>
        <span style="font-size:11px;color:#9CA3AF">🔍 이 단계 화면을 찾는 중…</span>
        <div style="flex:1"></div>
        <button class="wt-btn" data-act="exit" style="background:transparent;color:rgba(255,255,255,.4);padding:3px 6px">✕</button>
      </div>
      <div style="font-size:13.5px;font-weight:600;color:#F3F4F6;margin-bottom:4px">${escapeHtml(step.title || '')}</div>
      <div style="font-size:12px;color:#9CA3AF;line-height:1.5;margin-bottom:10px">안내할 항목이 화면에 아직 없습니다. 화면을 진행하면 자동으로 표시됩니다.</div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="wt-btn" data-act="prev" style="background:rgba(255,255,255,.1);color:#D1D5DB;font-size:12px;padding:6px 11px">← 이전</button>
        <div style="flex:1"></div>
        <button class="wt-btn" data-act="next" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:7px 16px">${idx + 1 >= total ? '완료 ✓' : '건너뛰기 →'}</button>
      </div>`;
    shadow.appendChild(style('.wt-btn{pointer-events:auto;cursor:pointer;border:none;border-radius:8px;font-size:13px;font-weight:600;padding:7px 12px;transition:opacity .15s}.wt-btn:active{opacity:.75}'));
    shadow.appendChild(card);

    card.addEventListener('click', (e) => {
      const act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'exit') opts.onExit && opts.onExit();
      else if (act === 'prev') opts.onPrev && opts.onPrev();
      else if (act === 'next') opts.onAdvance && opts.onAdvance('manual');
    });

    state = { host, shadow, waiting: true, waitKey: `${opts.index ?? 0}:${step.id || step.title || ''}`, findObserver: null, findTimer: null };

    // 셀렉터/XPath로 요소가 잡히면 정상 오버레이로 전환
    const tryResolve = () => {
      if (!state || !state.waiting) return false;
      const r = resolveTarget(step);
      if (r.source === 'selector' || r.source === 'xpath') {
        show(step, opts);  // hide() 후 정상 오버레이 렌더
        return true;
      }
      return false;
    };

    // 1순위: MutationObserver — DOM이 바뀌는 즉시 재시도(rAF 디바운스). 폴링보다 빠르고 CPU 절약.
    let pending = false;
    const obs = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; tryResolve(); });
    });
    try { obs.observe(document.body, { childList: true, subtree: true }); } catch { /* noop */ }
    state.findObserver = obs;

    // 안전망: 옵저버가 못 잡는 속성-only/canvas 변경 대비 — 1s 저빈도 폴링
    const safety = () => {
      if (!state || !state.waiting) return;
      if (tryResolve()) return;
      state.findTimer = setTimeout(safety, 1000);
    };
    state.findTimer = setTimeout(safety, 1000);
  }

  // AI 시각 재탐색 (P3) — 1회성. 성공 시 step._regroundXY를 세팅하고 정상 오버레이로 재렌더.
  // 셀렉터·XPath·퍼지가 모두 실패한 스텝에서만, 현재 화면 스크린샷을 Vision에 보내 위치 복구.
  function maybeReground(step, opts) {
    const key = `${opts.index ?? 0}:${step.id || step.title || ''}`;
    if (regroundedSteps.has(key)) return;
    regroundedSteps.add(key);
    let elementText = '';
    try { elementText = extractHint(step).text || ''; } catch { /* noop */ }
    try {
      chrome.runtime.sendMessage({
        type: 'AI_REGROUND',
        title: step.title || '',
        instruction: step.instruction || '',
        elementText,
        actionType: step.kind || null,
      }, (res) => {
        void chrome.runtime.lastError;
        // 응답 시점에도 같은 스텝을 대기 중일 때만 적용 (사용자가 넘어갔으면 무시)
        if (!res || !res.found || !state || !state.waiting || state.waitKey !== key) return;
        step._regroundXY = { x: res.x, y: res.y };
        show(step, opts);  // resolveTarget 0순위가 좌표를 집어 정상 오버레이로 전환
      });
    } catch { /* noop */ }
  }

  // 자동 타이핑 (React 제어 컴포넌트 대응)
  function autoFill(el, text) {
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    const isField = tag === 'input' || tag === 'textarea' || el.isContentEditable;
    if (!isField) return;
    try { el.focus({ preventScroll: true }); } catch { /* noop */ }
    const setVal = (v) => {
      if (el.isContentEditable) {
        el.textContent = v;
      } else {
        const proto = tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value');
        if (setter && setter.set) setter.set.call(el, v); else el.value = v;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    if (text.length > 50) {
      // 긴 텍스트: 즉시 입력 후 사이드패널에 복사 힌트 전송
      state.fillTimer = setTimeout(() => {
        if (!state || state.completed) return;
        setVal(text);
        el.dispatchEvent(new Event('change', { bubbles: true }));
        try { chrome.runtime.sendMessage({ type: 'SHOW_COPY_HINT', text }); } catch { /* noop */ }
      }, 280);
    } else {
      // 짧은 텍스트: 35ms/글자 타이핑 애니메이션
      let i = 0;
      const tick = () => {
        if (!state || state.completed) return;
        i += 1;
        setVal(text.slice(0, i));
        if (i < text.length) { state.fillTimer = setTimeout(tick, 35); }
        else { el.dispatchEvent(new Event('change', { bubbles: true })); }
      };
      state.fillTimer = setTimeout(tick, 280);
    }
  }

  function hide() {
    if (!state) {
      const stray = document.getElementById('mimic-overlay-root');
      if (stray) stray.remove();
      return;
    }
    if (state.rafId) cancelAnimationFrame(state.rafId);
    if (state.fillTimer) clearTimeout(state.fillTimer);
    if (state.findTimer) clearTimeout(state.findTimer);
    if (state.findObserver) state.findObserver.disconnect();
    if (state.onDocClick) document.removeEventListener('click', state.onDocClick, true);
    if (state.onKey) document.removeEventListener('keydown', state.onKey, true);
    if (state.host) state.host.remove();
    state = null;
  }

  // ── 유틸 ──────────────────────────────────────────────────────
  function style(css) { const s = document.createElement('style'); s.textContent = css; return s; }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  window.MimicGuide = { show, hide, _resolveTarget: resolveTarget, _isHit: isHit, _pointInRect: pointInRect };
})();
