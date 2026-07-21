// guide-engine.js — Live Guide 오버레이 엔진 (재생 전용; 녹화 코드와 무관)
// content_scripts에서 content.js보다 먼저 로드되어 window.ParroGuide 를 노출한다.
// 부작용 없음: 호출 전까지 리스너/DOM/타이머를 만들지 않는다.
(function () {
  'use strict';
  if (window.ParroGuide || window.MimicGuide) return; // 중복 주입 방지

  const Z = 2147483640;
  const HIT_PAD_EL = 6;
  const HIT_PAD_COORD = 28;
  const TIP_W = 292;  // 커진 코치 아바타와 균형을 맞춘 안내 카드 너비
  const TIP_GAP = 46; // 타깃을 가리지 않도록 DOM과 코치 UI 사이에 충분한 간격 확보
  const TIP_M = 12;   // 뷰포트 여백(px)
  const AVATAR_OUTSET = 82; // 말풍선 왼쪽에 놓이는 단일 아바타 영역
  const TIP_BG = 'rgba(22,20,48,.96)'; // 툴팁/화살표/대기카드 공통 배경 — 짙은 남색·보라(흰 배경 가독성)
  const OVERLAY_ROOT_ID = 'parro-overlay-root';
  const LEGACY_OVERLAY_ROOT_ID = 'mimic-overlay-root';

  let state = null;
  const regroundCache = new Map();  // AI 시각 재탐색 결과 캐시(key→{x,y} 성공 / null 실패). 재방문 시 재사용

  function isOverlayRootId(id) {
    return id === OVERLAY_ROOT_ID || id === LEGACY_OVERLAY_ROOT_ID;
  }

  // ── 순수 로직 ────────────────────────────────────────────────
  function targetRoot(step) {
    let root = document;
    const context = step.target_context || {};
    const framePath = Array.isArray(context.framePath) ? context.framePath : [];
    const shadowPath = Array.isArray(context.shadowPath) ? context.shadowPath : [];
    try {
      for (const selector of framePath) {
        const frame = root.querySelector(selector);
        if (!frame?.contentDocument) return null;
        root = frame.contentDocument;
      }
      for (const selector of shadowPath) {
        const host = root.querySelector(selector);
        if (!host?.shadowRoot) return null;
        root = host.shadowRoot;
      }
      return root;
    } catch {
      return null;
    }
  }

  function resolveTarget(step) {
    const root = targetRoot(step);
    const hasNestedTarget = !!(step.target_context?.framePath?.length || step.target_context?.shadowPath?.length);

    // 1순위: CSS Selector. querySelector()의 첫 결과를 무조건 쓰지 않고, 중복 후보를
    // 접근성 이름·주변 문맥·기록 위치로 다시 평가해 애매하면 표시하지 않는다.
    if (root && step.element_selector) {
      let matches = [];
      try { matches = Array.from(root.querySelectorAll(step.element_selector)); } catch { matches = []; }
      const selected = chooseElementCandidates(matches, step, 'selector', {
        exactSelector: true,
        uniqueSelector: matches.length === 1,
        stableSelector: step.target_context?.selectorConfidence === 'high' || isStableReplaySelector(step.element_selector),
      });
      if (selected) return selected;
    }

    // 2순위: XPath
    if (root?.nodeType === Node.DOCUMENT_NODE && step.element_xpath) {
      try {
        const xr = root.evaluate(step.element_xpath, root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        const matches = [];
        for (let i = 0; i < Math.min(xr.snapshotLength, 30); i += 1) {
          const match = xr.snapshotItem(i);
          if (match?.nodeType === Node.ELEMENT_NODE) matches.push(match);
        }
        const selected = chooseElementCandidates(matches, step, 'xpath', { xpathMatch: true });
        if (selected) return selected;
      } catch { /* noop */ }
    }

    // 3순위: 퍼지 자가복구 — 이름·속성·문맥·위치가 함께 맞는 유일한 후보만 허용한다.
    if (!hasNestedTarget) {
      const fuzzy = fuzzyFind(step);
      if (fuzzy) return fuzzy;
    }

    // 4순위: 소유자가 직접 보정한 핫스팟. 빈 좌표 박스를 그리지 않고 실제 DOM 요소가
    // 충분히 같은 대상으로 확인될 때만 사용한다.
    if (step.hotspot_x != null && step.hotspot_y != null) {
      const manual = resolvePointElement(
        (Number(step.hotspot_x) / 100) * window.innerWidth,
        (Number(step.hotspot_y) / 100) * window.innerHeight,
        step,
        'manual',
        { manualTarget: true },
      );
      if (manual) return manual;
    }

    // 5순위: AI 재탐색. 높은 신뢰도 좌표라도 실제 DOM 후보와 기록 힌트가 일치해야 한다.
    if (step._regroundXY && Number(step._regroundXY.confidence) >= 0.85) {
      const ai = resolvePointElement(
        Number(step._regroundXY.x) * window.innerWidth,
        Number(step._regroundXY.y) * window.innerHeight,
        step,
        'ai',
        { aiConfidence: Number(step._regroundXY.confidence) },
      );
      if (ai) return ai;
    }

    // 6순위: 레거시 좌표는 실제 상호작용 요소와 강한 접근성/문맥 증거가 일치할 때만 복구한다.
    if (step.click_x != null && step.click_y != null) {
      const p = normalizedClickPoint(step);
      if (p) {
        const coordinate = resolvePointElement(
          p.x * window.innerWidth,
          p.y * window.innerHeight,
          step,
          'coordinate-element',
          {},
        );
        if (coordinate) return coordinate;
      }
    }

    return { el: null, rect: null, source: 'none', confidence: 'low', score: 0, margin: 0 };
  }

  function rectOf(el) {
    const r = el.getBoundingClientRect();
    let left = r.left, top = r.top, width = r.width, height = r.height;
    let ownerWindow = el.ownerDocument?.defaultView;
    try {
      while (ownerWindow && ownerWindow !== window) {
        const frame = ownerWindow.frameElement;
        if (!frame) break;
        const fr = frame.getBoundingClientRect();
        const scaleX = fr.width / Math.max(1, ownerWindow.innerWidth);
        const scaleY = fr.height / Math.max(1, ownerWindow.innerHeight);
        left = fr.left + left * scaleX;
        top = fr.top + top * scaleY;
        width *= scaleX;
        height *= scaleY;
        ownerWindow = ownerWindow.parent;
      }
    } catch { /* nested cross-origin targets fall back to stored top rect */ }
    return { left, top, width, height };
  }

  function promoteHitTarget(hit) {
    if (!hit || isOverlayRootId(hit.id)) return null;
    const semantic = hit.closest && hit.closest(
      'button,a[href],input,select,textarea,label,[role="button"],[role="link"],[role="menuitem"],[role="option"],[role="tab"],[onclick],[tabindex]:not([tabindex="-1"])'
    );
    if (!semantic || isOverlayRootId(semantic.id)) return hit;
    const rect = rectOf(semantic);
    const area = Math.max(1, rect.width * rect.height);
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    return rect.width >= 1 && rect.height >= 1 && area / viewportArea <= 0.45 ? semantic : hit;
  }

  // ── 퍼지 자가복구 (P2) ────────────────────────────────────────
  // 셀렉터/XPath가 모두 깨졌을 때, 저장된 힌트(보이는 텍스트·속성·위치)로 현재 DOM 후보를
  // 점수화해 같은 요소를 재발견한다. 좌표 폴백보다 정확하고, 화면이 바뀌면(텍스트 없음) null.
  function isStableReplaySelector(selector) {
    const value = String(selector || '');
    return /^#[A-Za-z_]/.test(value)
      || /\[(data-testid|data-cy|data-test|aria-label|name)=["']/.test(value);
  }

  function cleanText(value, max = 240) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function textFromIds(doc, ids) {
    return String(ids || '').split(/\s+/).filter(Boolean).map((id) => {
      try { return doc.getElementById(id)?.textContent || ''; } catch { return ''; }
    }).join(' ');
  }

  function accessibleNameOf(el) {
    if (!el) return '';
    const doc = el.ownerDocument || document;
    const labelled = textFromIds(doc, el.getAttribute?.('aria-labelledby'));
    const associated = el.labels ? Array.from(el.labels).map(label => label.textContent || '').join(' ') : '';
    return cleanText(
      labelled
      || associated
      || el.getAttribute?.('aria-label')
      || el.getAttribute?.('title')
      || el.getAttribute?.('placeholder')
      || el.getAttribute?.('name')
      || el.value
      || el.textContent,
    );
  }

  function contextLabelOf(el) {
    const container = el?.closest?.('form,fieldset,section,article,[role="dialog"],[role="region"]');
    return cleanText(container?.querySelector?.('legend,h1,h2,h3,[role="heading"]')?.textContent, 120);
  }

  function isInteractiveElement(el) {
    if (!el?.matches) return false;
    if (el.matches(':disabled,[aria-disabled="true"]')) return false;
    const style = (el.ownerDocument?.defaultView || window).getComputedStyle(el);
    return el.matches('button,a[href],input:not([type="hidden"]),select,textarea,summary,label,[role="button"],[role="link"],[role="menuitem"],[role="option"],[role="tab"],[role="checkbox"],[role="radio"],[role="switch"],[role="combobox"],[role="textbox"],[onclick],[tabindex]:not([tabindex="-1"])')
      || style.cursor === 'pointer';
  }

  function geometrySimilarity(rect, step) {
    const expected = expectedGeometry(step);
    if (!expected.point && !expected.rect) return 0;
    let score = 0;
    if (expected.point) {
      if (pointInRect(expected.point.x, expected.point.y, rect, 20)) score = 1;
      else {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const diagonal = Math.max(1, Math.hypot(window.innerWidth, window.innerHeight));
        score = Math.max(score, 1 - Math.hypot(cx - expected.point.x, cy - expected.point.y) / (diagonal * 0.38));
      }
    }
    if (expected.rect) score = Math.max(score, rectOverlapRatio(rect, expected.rect));
    return Math.max(0, Math.min(1, score));
  }

  function replayCandidate(el, step, source, evidence) {
    if (!el || !el.isConnected || isOverlayRootId(el.id) || /^(HTML|BODY)$/.test(el.tagName || '')) return null;
    const rect = rectOf(el);
    if (!rect || rect.width < 1 || rect.height < 1 || !isVisibleEl(el)) return null;
    const areaRatio = Math.max(0, rect.width * rect.height) / Math.max(1, window.innerWidth * window.innerHeight);
    const context = step.target_context || {};
    const targeting = window.ParroTargeting;
    const similarity = targeting?.textSimilarity || ((a, b) => cleanText(a).toLowerCase() === cleanText(b).toLowerCase() ? 1 : 0);
    const facts = {
      visible: true,
      disabled: !!el.matches?.(':disabled,[aria-disabled="true"]'),
      interactive: isInteractiveElement(el),
      stableAttribute: ['id', 'data-testid', 'data-cy', 'data-test', 'aria-label', 'name'].some(attr => !!el.getAttribute?.(attr)),
      accessibleSimilarity: context.accessibleName ? similarity(accessibleNameOf(el), context.accessibleName) : 0,
      contextSimilarity: context.contextLabel ? similarity(contextLabelOf(el), context.contextLabel) : 0,
      pageTitleSimilarity: context.pageTitle ? similarity(document.title, context.pageTitle) : 0,
      geometrySimilarity: geometrySimilarity(rect, step),
      areaRatio,
      ...(evidence || {}),
    };
    return { el, rect, source, facts };
  }

  function chooseElementCandidates(elements, step, source, evidence) {
    const candidates = Array.from(new Set(elements || []))
      .map(el => replayCandidate(el, step, source, evidence))
      .filter(Boolean);
    if (!candidates.length) return null;
    const decision = window.ParroTargeting?.chooseReplayTarget?.(candidates);
    if (!decision?.approved || !decision.best) return null;
    return {
      el: decision.best.el,
      rect: decision.best.rect,
      source,
      confidence: decision.confidence,
      score: decision.best.score,
      margin: decision.margin,
    };
  }

  function resolvePointElement(x, y, step, source, evidence) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;
    const hit = promoteHitTarget(document.elementFromPoint(x, y));
    if (!hit || !isInteractiveElement(hit)) return null;
    return chooseElementCandidates([hit], step, source, evidence);
  }

  function normalizeUnit(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    let v = n;
    if (v > 100) v = v / 10000;
    else if (v > 1) v = v / 100;
    if (!Number.isFinite(v)) return null;
    return Math.max(0, Math.min(1, v));
  }

  function normalizedClickPoint(step) {
    const x = normalizeUnit(step.click_x);
    const y = normalizeUnit(step.click_y);
    return x == null || y == null ? null : { x, y };
  }

  function normalizedElementRect(step) {
    const r = step.element_rect;
    if (!r) return null;
    const x = normalizeUnit(r.x);
    const y = normalizeUnit(r.y);
    const width = normalizeUnit(r.width);
    const height = normalizeUnit(r.height);
    if (x == null || y == null || width == null || height == null || width <= 0 || height <= 0) return null;
    return { x, y, width, height };
  }

  function expectedGeometry(step) {
    const p = normalizedClickPoint(step);
    const nr = normalizedElementRect(step);
    const rect = nr ? {
      left: nr.x * window.innerWidth,
      top: nr.y * window.innerHeight,
      width: nr.width * window.innerWidth,
      height: nr.height * window.innerHeight,
    } : null;
    const point = p ? { x: p.x * window.innerWidth, y: p.y * window.innerHeight }
      : rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : null;
    return { point, rect };
  }

  function rectOverlapRatio(a, b) {
    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    const right = Math.min(a.left + a.width, b.left + b.width);
    const bottom = Math.min(a.top + a.height, b.top + b.height);
    const area = Math.max(0, right - left) * Math.max(0, bottom - top);
    const minArea = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
    return area / minArea;
  }

  function isVisibleEl(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = (el.ownerDocument?.defaultView || window).getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity || '1') > 0.01;
  }

  // 저장된 selector/xpath/좌표에서 매칭 힌트 추출 (P1 텍스트앵커 XPath가 보이는 텍스트를 인코딩)
  function extractHint(step) {
    const context = step.target_context || {};
    const hint = {
      tag: null,
      text: cleanText(context.accessibleName),
      contextText: cleanText(context.contextLabel),
      attrName: null,
      attrVal: null,
      nx: null,
      ny: null,
    };
    const xp = step.element_xpath || '';
    const m = xp.match(/^\/\/([a-z0-9]+)\[normalize-space\(\.\)=(['"])([\s\S]*?)\2\]$/i);
    if (m) { hint.tag = m[1].toLowerCase(); if (!hint.text) hint.text = m[3]; }
    const sel = step.element_selector || '';
    const a = sel.match(/([a-z0-9]+)?\[(name|aria-label|data-testid|data-test|data-cy)=["']([^"']*)["']\]\s*$/i);
    if (a) { if (!hint.tag && a[1]) hint.tag = a[1].toLowerCase(); hint.attrName = a[2]; hint.attrVal = a[3]; }
    if (!hint.tag) { const t = sel.match(/([a-z0-9]+)\s*$/i); if (t) hint.tag = t[1].toLowerCase(); }
    const p = normalizedClickPoint(step);
    const r = normalizedElementRect(step);
    if (p) { hint.nx = p.x; hint.ny = p.y; }
    else if (r) { hint.nx = r.x + r.width / 2; hint.ny = r.y + r.height / 2; }
    return hint;
  }

  function fuzzyFind(step) {
    const hint = extractHint(step);
    if (!hint.text && !hint.attrVal && !hint.contextText) return null;
    let sel = 'a,button,input,select,textarea,label,[role],[onclick],[tabindex]';
    if (hint.tag && /^[a-z][a-z0-9]*$/.test(hint.tag)) sel = hint.tag + ',' + sel;
    let nodes;
    try { nodes = document.querySelectorAll(sel); } catch { return null; }
    const similarity = window.ParroTargeting?.textSimilarity
      || ((a, b) => cleanText(a).toLowerCase() === cleanText(b).toLowerCase() ? 1 : 0);
    const candidates = Array.from(nodes).filter((el) => {
      if (!isVisibleEl(el)) return false;
      const nameMatch = hint.text ? similarity(accessibleNameOf(el), hint.text) : 0;
      const contextMatch = hint.contextText ? similarity(contextLabelOf(el), hint.contextText) : 0;
      const attrMatch = hint.attrVal && el.getAttribute(hint.attrName) === hint.attrVal;
      return attrMatch || nameMatch >= 0.55 || contextMatch >= 0.72;
    });
    return chooseElementCandidates(candidates, step, 'fuzzy', { fuzzyMatch: true });
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
    // 아바타가 말풍선 바깥에 있으므로 왼쪽 가장자리에서 잘리지 않게 공간을 확보한다.
    const maxLeft = Math.max(TIP_M, VW - TIP_W - TIP_M);
    const minLeft = VW >= TIP_W + AVATAR_OUTSET + TIP_M * 2 ? TIP_M + AVATAR_OUTSET : TIP_M;
    left = Math.max(minLeft, Math.min(maxLeft, left));

    // 화살표 가로 위치: 타깃 중심 → 툴팁 내 상대 좌표
    const arrowLeft = Math.max(16, Math.min(TIP_W - 32, r.left + r.width / 2 - left - 8));

    return { left, top, arrowDir, arrowLeft };
  }

  // 웹 제품과 동일한 상태형 AI 가이드 아바타.
  const avatarAsset = (name) => `${chrome.runtime.getURL(`assets/${name}`)}?v=20260720`;
  const MASCOT_IMAGE_URLS = {
    idle: avatarAsset('parro-ai-avatar-neutral.png'),
    neutral: avatarAsset('parro-ai-avatar-neutral.png'),
    listen: avatarAsset('parro-ai-avatar-listen.png'),
    talk: avatarAsset('parro-ai-avatar-talk.png'),
    point: avatarAsset('parro-ai-avatar-point.png'),
    think: avatarAsset('parro-ai-avatar-think.png'),
    search: avatarAsset('parro-ai-avatar-search.png'),
    warning: avatarAsset('parro-ai-avatar-warning.png'),
    error: avatarAsset('parro-ai-avatar-error.png'),
    blocked: avatarAsset('parro-ai-avatar-blocked.png'),
    clarify: avatarAsset('parro-ai-avatar-clarify.png'),
    success: avatarAsset('parro-ai-avatar-success.png'),
  };
  const MASCOT_SEQUENCE_STATES = {
    idle: 'listen',
    neutral: 'listen',
    listen: 'neutral',
    talk: 'point',
    point: 'talk',
    think: 'search',
    search: 'think',
    warning: 'blocked',
    error: 'clarify',
    blocked: 'warning',
    clarify: 'neutral',
    success: 'talk',
  };
  const mascotHtml = (stateName = 'neutral') => {
    const safeState = Object.prototype.hasOwnProperty.call(MASCOT_IMAGE_URLS, stateName) ? stateName : 'neutral';
    const secondaryState = MASCOT_SEQUENCE_STATES[safeState] || 'neutral';
    return `<span class="parro-avatar-stack parro-avatar-stack--${safeState} parro-avatar-sequence--${safeState}">
      <img class="parro-avatar-layer parro-avatar-layer--primary" src="${MASCOT_IMAGE_URLS[safeState]}" alt="" draggable="false">
      <img class="parro-avatar-layer parro-avatar-layer--secondary" src="${MASCOT_IMAGE_URLS[secondaryState]}" alt="" draggable="false">
    </span>`;
  };
  const AVATAR_MOTION_CSS = `
    @keyframes parro-avatar-idle-motion { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-3%) scale(1.015)} }
    @keyframes parro-avatar-listen-motion { 0%,100%{transform:translateY(0) rotate(0)} 46%{transform:translateY(-1.5%) rotate(-1.2deg)} 72%{transform:translateY(-.5%) rotate(-.4deg)} }
    @keyframes parro-avatar-talk-motion { 0%,100%{transform:translateY(0) rotate(0)} 35%{transform:translateY(-2.5%) rotate(-1.4deg)} 70%{transform:translateY(-1%) rotate(1deg)} }
    @keyframes parro-avatar-point-motion { 0%,100%{transform:translateY(0) rotate(0)} 48%{transform:translateY(-2%) rotate(-1deg)} 64%{transform:translateY(-2%) rotate(.7deg)} }
    @keyframes parro-avatar-think-motion { 0%,100%{transform:translateY(0) rotate(0)} 42%{transform:translateY(-2%) rotate(-1.8deg)} 72%{transform:translateY(-1%) rotate(-.6deg)} }
    @keyframes parro-avatar-search-motion { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-2%) scale(1.012)} }
    @keyframes parro-avatar-warning-motion { 0%,100%{transform:translateY(0) scale(1)} 45%{transform:translateY(-1%) scale(1.018)} 62%{transform:translateY(-1%) scale(1.006)} }
    @keyframes parro-avatar-error-motion { 0%,100%{transform:translateY(0) rotate(0)} 50%{transform:translateY(1.2%) rotate(-.5deg)} }
    @keyframes parro-avatar-blocked-motion { 0%,100%{transform:translateY(0)} 50%{transform:translateY(.7%)} }
    @keyframes parro-avatar-clarify-motion { 0%,100%{transform:translateY(0) rotate(0)} 48%{transform:translateY(-1.5%) rotate(1.2deg)} 74%{transform:translateY(-.5%) rotate(.35deg)} }
    @keyframes parro-avatar-success-motion { 0%,100%{transform:translateY(0) scale(1)} 28%{transform:translateY(-4%) scale(1.04)} 54%{transform:translateY(-1%) scale(.99)} }
    @keyframes parro-avatar-frame-primary { 0%,54%,100%{opacity:1;transform:translateY(0) scale(1)} 64%,82%{opacity:0;transform:translateY(1.2%) scale(.985)} 91%{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes parro-avatar-frame-secondary { 0%,54%,100%{opacity:0;transform:translateY(2%) scale(.98)} 64%,82%{opacity:1;transform:translateY(0) scale(1)} 91%{opacity:0;transform:translateY(-1%) scale(.99)} }
    .parro-avatar-stack{position:relative;display:block;width:100%;height:100%;overflow:hidden;transform-origin:50% 82%;will-change:transform}
    .parro-avatar-layer{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain;user-select:none;pointer-events:none;transform-origin:50% 82%;will-change:opacity,transform}
    .parro-avatar-layer--primary{opacity:1;animation:parro-avatar-frame-primary 8s ease-in-out infinite}
    .parro-avatar-layer--secondary{opacity:0;animation:parro-avatar-frame-secondary 8s ease-in-out infinite}
    .parro-avatar-stack--idle,.parro-avatar-stack--neutral{animation:parro-avatar-idle-motion 3.4s ease-in-out infinite}
    .parro-avatar-stack--listen{animation:parro-avatar-listen-motion 2.8s ease-in-out infinite}
    .parro-avatar-stack--talk{animation:parro-avatar-talk-motion 1.6s ease-in-out infinite}
    .parro-avatar-stack--point{animation:parro-avatar-point-motion 2s ease-in-out infinite}
    .parro-avatar-stack--think{animation:parro-avatar-think-motion 2.6s ease-in-out infinite}
    .parro-avatar-stack--search{animation:parro-avatar-search-motion 2.2s ease-in-out infinite}
    .parro-avatar-stack--warning{animation:parro-avatar-warning-motion 2.4s ease-in-out infinite}
    .parro-avatar-stack--error{animation:parro-avatar-error-motion 3.2s ease-in-out infinite}
    .parro-avatar-stack--blocked{animation:parro-avatar-blocked-motion 3.6s ease-in-out infinite}
    .parro-avatar-stack--clarify{animation:parro-avatar-clarify-motion 2.8s ease-in-out infinite}
    .parro-avatar-stack--success{animation:parro-avatar-success-motion 1.9s cubic-bezier(.34,1.2,.64,1) infinite}
    .parro-avatar-sequence--listen .parro-avatar-layer{animation-duration:6.4s}
    .parro-avatar-sequence--talk .parro-avatar-layer{animation-duration:4s}
    .parro-avatar-sequence--point .parro-avatar-layer{animation-duration:4.4s}
    .parro-avatar-sequence--think .parro-avatar-layer,.parro-avatar-sequence--search .parro-avatar-layer{animation-duration:3.6s}
    .parro-avatar-sequence--warning .parro-avatar-layer{animation-duration:4.6s}
    .parro-avatar-sequence--error .parro-avatar-layer{animation-duration:5.4s}
    .parro-avatar-sequence--blocked .parro-avatar-layer{animation-duration:5.8s}
    .parro-avatar-sequence--clarify .parro-avatar-layer{animation-duration:5.2s}
    .parro-avatar-sequence--success .parro-avatar-layer{animation-duration:4.2s}
    @media (prefers-reduced-motion:reduce){.parro-avatar-stack,.parro-avatar-layer{animation:none!important}.parro-avatar-layer--secondary{display:none}}
  `;

  const AVATAR_STYLE = `width:68px;height:68px;border-radius:19px;background:linear-gradient(135deg,#F1FBF9,#E4F3F6);box-shadow:0 8px 24px rgba(0,155,142,.34);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;`;

  // ── 오버레이 렌더 ─────────────────────────────────────────────
  const VOLATILE_QUERY_KEY = /^(utm_.+|fbclid|gclid|_ga|code|state|session|session_id|timestamp|ts|_t)$/i;

  function normalizedPath(pathname) {
    const value = String(pathname || '/').replace(/\/{2,}/g, '/');
    return value.length > 1 ? value.replace(/\/$/, '') : value;
  }

  function stableQueryMatches(recorded, current) {
    for (const [key, value] of recorded.searchParams.entries()) {
      if (VOLATILE_QUERY_KEY.test(key)) continue;
      if (current.searchParams.get(key) !== value) return false;
    }
    return true;
  }

  function routeHash(url) {
    const hash = decodeURIComponent(url.hash || '');
    if (!/^#!?\//.test(hash)) return '';
    return hash.replace(/^#!?/, '').split('?')[0].replace(/\/$/, '') || '/';
  }

  // origin/path와 기록 당시의 안정적인 query/hash route를 함께 검증한다.
  function pageMatches(pageUrl) {
    try {
      const a = new URL(pageUrl), b = new URL(location.href);
      if (!/^https?:$/.test(a.protocol) || !/^https?:$/.test(b.protocol)) return false;
      if (a.origin !== b.origin || normalizedPath(a.pathname) !== normalizedPath(b.pathname)) return false;
      const expectedHashRoute = routeHash(a);
      if (expectedHashRoute && expectedHashRoute !== routeHash(b)) return false;
      return stableQueryMatches(a, b);
    } catch { return false; }
  }

  function isExplanationStep(step) {
    if (!step) return false;
    return step.guide_mode === 'explanation'
      || step.kind === 'none'
      || step.step_type === 'visual_only_step'
      || step.step_type === 'visual_overlay_step'
      || step.step_type === 'manual_capture_step'
      || step.step_type === 'blocked_step';
  }

  function isVisibleValidationNode(el) {
    if (!el || !el.isConnected) return false;
    try {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    } catch {
      return false;
    }
  }

  function validationMessages() {
    const selectors = '[role="alert"],[aria-live="assertive"],[aria-invalid="true"],.error,.invalid-feedback,[data-error]';
    const messages = [];
    document.querySelectorAll(selectors).forEach((el) => {
      if (!isVisibleValidationNode(el)) return;
      const text = String(el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      if (text && text.length <= 240 && !messages.includes(text)) messages.push(text);
    });
    return messages;
  }

  function submissionForm(target) {
    if (!target || target.nodeType !== Node.ELEMENT_NODE) return null;
    const control = target.closest?.('button,input,[role="button"]') || target;
    const form = control.form || control.closest?.('form');
    if (!form) return null;
    const tag = String(control.tagName || '').toLowerCase();
    const type = String(control.getAttribute?.('type') || (tag === 'button' ? 'submit' : '')).toLowerCase();
    return type === 'submit' ? form : null;
  }

  function showValidationProblem(message) {
    if (!state) return;
    state.validating = false;
    state.advanced = false;
    if (state.host) state.host.setAttribute('data-validation-error', message || '입력 내용을 확인해주세요.');
    if (state.tooltip) {
      let notice = state.tooltip.querySelector('[data-parro-validation]');
      if (!notice) {
        notice = document.createElement('div');
        notice.setAttribute('data-parro-validation', 'true');
        notice.style.cssText = 'margin:10px 0 2px;padding:9px 10px;border-radius:8px;background:#FFF1F2;color:#BE123C;font-size:12px;font-weight:700;line-height:1.45;';
        state.tooltip.appendChild(notice);
      }
      notice.textContent = `${message || '입력 내용을 확인해주세요.'} 오류를 해결한 뒤 다시 눌러주세요.`;
    }
    nudge();
  }

  function validateSubmissionThenAdvance(form) {
    if (!state || state.validating) return;
    state.validating = true;
    if (state.host) state.host.removeAttribute('data-validation-error');
    const before = new Set(validationMessages());
    const onPageHide = () => advance('click');
    state.validationPageHide = onPageHide;
    window.addEventListener('pagehide', onPageHide, { once: true, capture: true });
    state.validationTimer = setTimeout(() => {
      if (!state || !state.validating) return;
      window.removeEventListener('pagehide', onPageHide, true);
      state.validationPageHide = null;
      const after = validationMessages();
      const newMessage = after.find(message => !before.has(message));
      let invalid = false;
      try { invalid = typeof form.checkValidity === 'function' && !form.checkValidity(); } catch { /* noop */ }
      if (invalid || newMessage) {
        showValidationProblem(newMessage || '필수 입력값이 올바르지 않습니다.');
        return;
      }
      state.validating = false;
      advance('click');
    }, 650);
  }

  function show(step, opts) {
    hide();
    opts = opts || {};

    // Live Guide는 기록된 실제 페이지에서만 표시한다. URL이 없거나 다르면 현재 페이지에는
    // 어떤 카드·아바타·좌표 힌트도 만들지 않고, 페이지가 맞아지는지만 조용히 감시한다.
    if (!step?.page_url || !pageMatches(step.page_url)) {
      showWaiting(step, opts, 'page_mismatch');
      return;
    }

    if (isExplanationStep(step)) {
      showExplanation(step, opts);
      opts.onTargetStatus && opts.onTargetStatus('ready');
      return;
    }

    const resolved = resolveTarget(step);

    if (!resolved.el || !resolved.rect) {
      showWaiting(step, opts, 'searching');
      maybeReground(step, opts);
      return;
    }

    opts.onTargetStatus && opts.onTargetStatus('ready', {
      source: resolved.source,
      confidence: resolved.confidence,
      score: resolved.score,
      margin: resolved.margin,
    });

    if (resolved.el) {
      try {
        const r = resolved.el.getBoundingClientRect();
        const safeMargin = 56;
        if (r.top < safeMargin || r.bottom > window.innerHeight - safeMargin || r.left < safeMargin || r.right > window.innerWidth - safeMargin) {
          // 첫 프레임부터 타깃이 보이도록 즉시 이동한다. 이후에는 RAF가 위치를 계속 추적한다.
          resolved.el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
        }
      } catch { /* noop */ }
    }

    const host = document.createElement('div');
    host.id = OVERLAY_ROOT_ID;
    host.style.cssText = `all:initial;position:fixed;inset:0;pointer-events:none;z-index:${Z};`;
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });

    const root = document.createElement('div');
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';

    shadow.appendChild(style(`
      @keyframes parro-ripple { 0%{transform:scale(.75);opacity:1} 100%{transform:scale(4.6);opacity:0} }
      @keyframes mimic-ripple { 0%{transform:scale(.75);opacity:1} 100%{transform:scale(4.6);opacity:0} }
      @keyframes parro-glow   { 0%,100%{box-shadow:0 0 0 4px rgba(18,184,134,.32),0 0 18px 5px rgba(0,155,142,.48)} 50%{box-shadow:0 0 0 8px rgba(23,201,182,.42),0 0 36px 12px rgba(18,184,134,.72)} }
      @keyframes mimic-glow   { 0%,100%{box-shadow:0 0 0 4px rgba(18,184,134,.32),0 0 18px 5px rgba(0,155,142,.48)} 50%{box-shadow:0 0 0 8px rgba(23,201,182,.42),0 0 36px 12px rgba(18,184,134,.72)} }
      @keyframes parro-nudge  { 0%,100%{transform:none} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
      @keyframes mimic-nudge  { 0%,100%{transform:none} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
      @keyframes parro-avatar-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
      @keyframes mimic-avatar-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
      @keyframes parro-tip-in { 0%{opacity:0;transform:translateY(6px) scale(0.97)} 100%{opacity:1;transform:translateY(0) scale(1)} }
      @keyframes mimic-tip-in { 0%{opacity:0;transform:translateY(6px) scale(0.97)} 100%{opacity:1;transform:translateY(0) scale(1)} }
      ${AVATAR_MOTION_CSS}
      .parro-btn,.mimic-btn { pointer-events:auto; cursor:pointer; border:none; border-radius:8px; font-size:13px; font-weight:600; padding:7px 12px; transition:opacity .15s; }
      .parro-btn:active,.mimic-btn:active { opacity:.75; }
    `));

    // 타깃 하이라이트 (네온 글로우 펄스 — 어둠막 없이 위치만 강조, Tango식)
    const hl = document.createElement('div');
    hl.style.cssText = `position:fixed;pointer-events:none;box-sizing:border-box;border:3px solid #12B886;background:rgba(18,184,134,.10);border-radius:9px;box-shadow:0 0 0 5px rgba(18,184,134,.3),0 0 24px 8px rgba(0,155,142,.52);z-index:2;transition:left .12s,top .12s,width .12s,height .12s;animation:parro-glow 1.25s ease-in-out infinite;`;
    root.appendChild(hl);

    // 클릭 핀 — 중심 보라 점 제거, 물결 애니메이션만
    const pulse = document.createElement('div');
    pulse.style.cssText = `position:fixed;width:0;height:0;pointer-events:none;z-index:3;`;
    const ripple = document.createElement('div');
    ripple.style.cssText = `position:absolute;width:56px;height:56px;margin-left:-28px;margin-top:-28px;border-radius:50%;border:4px solid rgba(18,184,134,.96);animation:parro-ripple 1.25s ease-out infinite;`;
    const ripple2 = document.createElement('div');
    ripple2.style.cssText = `position:absolute;width:56px;height:56px;margin-left:-28px;margin-top:-28px;border-radius:50%;border:3px solid rgba(23,201,182,.76);animation:parro-ripple 1.25s ease-out .625s infinite;`;
    pulse.appendChild(ripple);
    pulse.appendChild(ripple2);
    root.appendChild(pulse);

    // 단일 코치 아바타가 말풍선 바깥에서 이야기하는 구조.
    // 타깃 위에 별도 아바타를 겹치지 않고, SVG 프레임 교체 없이 미세한 부유 효과만 준다.
    const idx = opts.index ?? 0, total = opts.total ?? 1;
    const typeTextSnippet = step.type_text
      ? escapeHtml(String(step.type_text).length > 60 ? String(step.type_text).slice(0, 60) + '…' : String(step.type_text))
      : '';
    const tooltipText = step.instruction || step.title || '';
    const tooltipMascotState = 'talk';

    const tooltip = document.createElement('div');
    tooltip.style.cssText = `position:fixed;width:${TIP_W}px;box-sizing:border-box;background:${TIP_BG};color:#fff;border-radius:13px;padding:13px;box-shadow:0 12px 40px rgba(0,0,0,.45),0 0 0 1px rgba(23,201,182,.16);z-index:5;pointer-events:auto;animation:parro-tip-in 0.28s ease forwards;`;
    tooltip.innerHTML = `
      <div data-role="coach-avatar" style="position:absolute;left:-${AVATAR_OUTSET}px;top:14px;${AVATAR_STYLE}pointer-events:none;animation:parro-avatar-float 4s ease-in-out infinite">${mascotHtml(tooltipMascotState)}</div>
      <div aria-hidden="true" style="position:absolute;left:-8px;top:30px;width:16px;height:16px;background:${TIP_BG};transform:rotate(45deg);border-radius:2px;box-shadow:-1px 1px 0 rgba(23,201,182,.12);pointer-events:none"></div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px">
        <span style="font-size:11px;font-weight:700;color:#8DD63F;background:rgba(0,155,142,.24);padding:2px 8px;border-radius:20px">${idx + 1} / ${total}</span>
        ${resolved.source === 'none' ? '<span style="font-size:10.5px;color:#FFB199">요소 미발견</span>' : ''}
        <div style="flex:1"></div>
        <button class="parro-btn mimic-btn" data-act="hide-tooltip" title="말풍선 숨기기" style="background:transparent;color:rgba(255,255,255,.45);padding:3px 6px;font-size:12px">✕</button>
      </div>
      ${tooltipText ? `<div style="font-size:12.5px;color:#D1D5DB;line-height:1.55;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(tooltipText)}</div>` : ''}
      ${step.type_text ? `
        <div style="margin-top:10px;background:rgba(0,155,142,.18);border:1px solid rgba(23,201,182,.32);border-radius:8px;padding:8px 10px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:11px;color:#17C9B6;flex-shrink:0">⌨ 직접 입력</span>
            <span style="margin-left:auto;font-size:10.5px;color:#9FE4DA">일치하면 자동 완료</span>
          </div>
          <div style="font-size:11.5px;color:#BFEDE7;line-height:1.5;margin-top:5px;word-break:break-all">입력할 내용: ${typeTextSnippet}</div>
        </div>` : ''}`;

    root.appendChild(tooltip);

    // 툴팁 복원 버튼 (툴팁 숨김 상태일 때 우하단에 표시)
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'parro-btn mimic-btn';
    restoreBtn.style.cssText = `position:fixed;right:16px;bottom:16px;background:linear-gradient(135deg,#009B8E,#12B886);color:#fff;padding:8px 14px;border-radius:20px;box-shadow:0 4px 16px rgba(0,155,142,.42);pointer-events:auto;z-index:4;font-size:12px;font-weight:700;display:none;`;
    restoreBtn.textContent = '💬 가이드 보기';
    restoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state) return;
      state.tooltipHidden = false;
    });
    root.appendChild(restoreBtn);

    // 스크롤 방향 힌트 — 타깃(요소)이 뷰포트 밖으로 스크롤됐을 때 상/하단에 표시.
    // 클릭하면 타깃을 화면 중앙으로 스크롤해 길을 잃지 않게 한다. (좌표 타깃은 뷰포트 고정이라 해당 없음)
    const scrollHint = document.createElement('button');
    scrollHint.className = 'parro-btn mimic-btn';
    scrollHint.style.cssText = `position:fixed;left:50%;transform:translateX(-50%);background:${TIP_BG};color:#fff;padding:9px 16px;border-radius:22px;box-shadow:0 6px 20px rgba(0,0,0,.4),0 0 0 1px rgba(165,180,252,.18);pointer-events:auto;z-index:7;font-size:12.5px;font-weight:700;display:none;white-space:nowrap;`;
    scrollHint.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = state && state.resolved;
      if (t && t.el && t.el.isConnected) t.el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    });
    root.appendChild(scrollHint);

    shadow.appendChild(root);

    const resolveKey = `${opts.index ?? 0}:${step.id || step.title || ''}`;
    state = { host, shadow, hl, pulse, tooltip, restoreBtn, scrollHint, resolved, step, opts, idx, total, advanced: false, completed: false, tooltipHidden: false, fallbackKey: usesCoordinateFallback ? resolveKey : null };
    if (usesCoordinateFallback) maybeReground(step, opts);

    // 브라우저의 새로고침/뒤로가기 스크롤 복원이 첫 scrollIntoView를 덮어쓸 수 있어
    // 페이지가 안정된 뒤 한 번 더 확인한다. 사용자가 바로 타깃을 볼 수 있게 즉시 중앙 정렬한다.
    if (resolved.el) {
      state.revealTimer = setTimeout(() => {
        if (!state || state.resolved?.el !== resolved.el || !resolved.el.isConnected) return;
        const r = resolved.el.getBoundingClientRect();
        const margin = 56;
        if (r.top < margin || r.bottom > window.innerHeight - margin || r.left < margin || r.right > window.innerWidth - margin) {
          resolved.el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
        }
      }, 180);
    }

    // 텍스트 단계는 값을 대신 채우지 않는다. 실제 사용자가 기대값을 입력해야 완료된다.
    if ((step.type_text || step.kind === 'type' || step.action_type === 'type') && resolved.el) {
      setupRequiredTextInput(resolved.el, String(step.type_text || ''));
    }

    // 툴팁 버튼 이벤트
    tooltip.addEventListener('click', (e) => {
      e.stopPropagation();
      const act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'exit') opts.onExit && opts.onExit();
      else if (act && act.startsWith('survey-rate:')) {
        const [, group, value] = act.split(':');
        setSurveyChoice(group, value);
      }
      else if (act && act.startsWith('survey-bool:')) {
        const [, group, value] = act.split(':');
        setSurveyChoice(group, value);
      }
      else if (act === 'survey-submit') {
        submitGuideSurvey(e.target);
      }
      else if (act === 'hide-tooltip') {
        if (!state) return;
        state.tooltipHidden = true;
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
        tooltip.style.display = 'none';
        if (state.scrollHint) state.scrollHint.style.display = 'none';
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
          tooltip.style.display = 'none';
          if (state.scrollHint) state.scrollHint.style.display = 'none';
          state.rafId = requestAnimationFrame(reposition);
          return;
        }
        const P = 5;

        // 타깃이 화면 밖이거나 가장자리에 잘리면 방향 힌트 — 요소 타깃에서만(좌표는 뷰포트 고정)
        if (state.scrollHint) {
          const VH = window.innerHeight;
          const centerY = r.top + r.height / 2;
          const outsideSafeArea = t.el && r.height < VH - 112 && (r.top < 56 || r.top + r.height > VH - 56);
          const above = outsideSafeArea && centerY < VH / 2;
          const below = outsideSafeArea && !above;
          if (above || below) {
            const sh = state.scrollHint;
            sh.textContent = above ? '↑ 여기로 스크롤' : '↓ 여기로 스크롤';
            sh.style.top    = above ? '14px' : 'auto';
            sh.style.bottom = below ? '20px' : 'auto';
            sh.style.display = 'block';
          } else {
            state.scrollHint.style.display = 'none';
          }
        }

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

        // 말풍선과 아바타를 하나의 코치 UI로 함께 배치한다.
        tooltip.style.display = 'block';
        const tipH = tooltip.offsetHeight || 200;
        const pos = calcTipPos(r, tipH);
        tooltip.style.left = `${pos.left}px`;
        tooltip.style.top  = `${pos.top}px`;

        // 소유자가 스튜디오에서 지정한 말풍선 위치 — 뷰포트 고정 코너로 override
        const anchor = state.step && state.step.bubble_anchor;
        if (anchor) {
          const tH = tooltip.offsetHeight || tipH;
          const left = anchor === 'top-left' || anchor === 'bottom-left' ? TIP_M + AVATAR_OUTSET : window.innerWidth - TIP_W - TIP_M;
          const top  = anchor === 'top-left' || anchor === 'top-right'  ? TIP_M : window.innerHeight - tH - TIP_M;
          tooltip.style.left = `${left}px`;
          tooltip.style.top  = `${top}px`;
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
      if (state.advanced || state.completed || state.validating) return;
      if (e.target === host) return;
      if (state.requiresTextInput) {
        if (!state.resolved?.el || !(state.resolved.el === e.target || state.resolved.el.contains(e.target))) nudge();
        return;
      }
      if (isHit(e.clientX, e.clientY, state.resolved, e.target)) {
        const form = submissionForm(state.resolved?.el || e.target);
        if (form) validateSubmissionThenAdvance(form);
        else advance('click');
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
      const onComplete = state.opts && state.opts.onComplete;
      state.completed = true;
      hide();
      onComplete && onComplete(reason);
      return;
    }
    state.opts.onAdvance && state.opts.onAdvance(reason);
  }

  function nudge() {
    if (!state || !state.tooltip) return;
    state.tooltip.style.animation = 'parro-nudge .3s';
    setTimeout(() => { if (state && state.tooltip) state.tooltip.style.animation = ''; }, 320);
  }

  function setSurveyChoice(group, value) {
    if (!state || !state.tooltip) return;
    state.tooltip.querySelectorAll(`[data-survey-group="${group}"]`).forEach((btn) => {
      const selected = btn.getAttribute('data-survey-value') === value;
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
      btn.style.background = selected ? '#E8FFF7' : 'white';
      btn.style.color = selected ? '#00796F' : '#4b5563';
      btn.style.borderColor = selected ? '#009B8E' : '#e5e7eb';
    });
  }

  function getSurveyChoice(group, fallback) {
    if (!state || !state.tooltip) return fallback;
    const selected = state.tooltip.querySelector(`[data-survey-group="${group}"][aria-pressed="true"]`);
    return selected ? selected.getAttribute('data-survey-value') : fallback;
  }

  function submitGuideSurvey(button) {
    if (!state || !state.tooltip) return;
    const survey = state.opts && state.opts.survey;
    if (!survey || !survey.enabled) return;
    const q1 = Number(getSurveyChoice('q1', '3')) || 3;
    const q2 = Number(getSurveyChoice('q2', '3')) || 3;
    const q3 = Number(getSurveyChoice('q3', '3')) || 3;
    const completed = getSurveyChoice('q4', 'true') !== 'false';
    const issue = String(getSurveyChoice('issue', '막힌 단계 없음') || '막힌 단계 없음');
    const comment = state.tooltip.querySelector('[data-survey-comment]')?.value || '';
    if (button) {
      button.textContent = '제출 중...';
      button.disabled = true;
    }
    chrome.runtime.sendMessage({
      type: 'SUBMIT_GUIDE_SURVEY',
      payload: {
        tutorial_id: survey.tutorialId,
        viewer_session_id: survey.viewerSessionId,
        q1_easier_than_pdf: q1,
        q2_would_use_again: q2,
        q3_useful_for_work: q3,
        q4_can_reproduce: completed,
        q5_additional_feedback: JSON.stringify({
          survey_context: 'live_guide',
          selected_issue: issue,
          comment: comment.trim() || null,
          schema_version: 1,
        }),
      },
    }, () => {
      void chrome.runtime.lastError;
      if (!state || !state.tooltip) return;
      state.tooltip.innerHTML = `
        <div style="text-align:center;padding:12px 4px">
          <div style="${AVATAR_STYLE}margin:0 auto 12px;">${mascotHtml('success')}</div>
          <div style="font-size:15px;font-weight:800;margin-bottom:6px">고마워요. 반영해둘게요.</div>
          <div style="font-size:12.5px;color:#9CA3AF;margin-bottom:14px">Live Guide Beta를 더 정확하게 다듬는 데 사용할게요.</div>
          <button class="parro-btn mimic-btn" data-act="exit" style="background:linear-gradient(135deg,#009B8E,#12B886);color:#fff;padding:9px 24px;width:100%">닫기</button>
        </div>`;
    });
  }

  function showComplete() {
    if (!state) return;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.completed = true;
    state.hl.style.display = 'none';
    state.pulse.style.display = 'none';
    if (state.scrollHint) state.scrollHint.style.display = 'none';
    state.tooltip.innerHTML = `
      <div style="text-align:center;padding:10px 4px">
        <div style="${AVATAR_STYLE}margin:0 auto 12px;">${mascotHtml('success')}</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:6px">Live Guide Beta 완료! 🎉</div>
        <div style="font-size:12.5px;color:#9CA3AF;margin-bottom:14px">모든 스텝을 완료했습니다.</div>
        <button class="parro-btn mimic-btn" data-act="exit" style="background:linear-gradient(135deg,#009B8E,#12B886);color:#fff;padding:9px 24px;width:100%">닫기</button>
      </div>`;
    const survey = state.opts && state.opts.survey && state.opts.survey.enabled ? state.opts.survey : null;
    if (survey) {
      const rating = (group) => [1, 2, 3, 4, 5].map(n => `<button class="parro-btn mimic-btn" data-act="survey-rate:${group}:${n}" data-survey-group="${group}" data-survey-value="${n}" aria-pressed="false" style="width:30px;height:28px;padding:0;background:white;color:#4b5563;border:1px solid #e5e7eb">${n}</button>`).join('');
      const issueBtn = (label, selected) => `<button class="parro-btn mimic-btn" data-act="survey-rate:issue:${escapeHtml(label)}" data-survey-group="issue" data-survey-value="${escapeHtml(label)}" aria-pressed="${selected ? 'true' : 'false'}" style="padding:6px 8px;background:${selected ? '#E8FFF7' : 'white'};color:${selected ? '#00796F' : '#4b5563'};border:1px solid ${selected ? '#009B8E' : '#e5e7eb'};font-size:11.5px">${escapeHtml(label)}</button>`;
      state.tooltip.innerHTML = `
        <div style="padding:6px 2px;color:#111827">
          <div style="display:flex;gap:9px;align-items:center;margin-bottom:10px">
            <div style="${AVATAR_STYLE}width:38px;height:38px;flex-shrink:0">${mascotHtml('listen')}</div>
            <div>
              <div style="font-size:15px;font-weight:800">Live Guide Beta는 어땠나요?</div>
              <div style="font-size:12px;color:#6B7280;margin-top:2px">선택만 해도 충분해요.</div>
            </div>
          </div>
          <div style="display:grid;gap:9px;font-size:12px">
            <label style="display:grid;gap:5px;font-weight:700">1. 작업 완료에 도움이 됐나요?<div style="display:flex;gap:5px">${rating('q1')}</div></label>
            <label style="display:grid;gap:5px;font-weight:700">2. 클릭 위치나 다음 행동 안내가 정확했나요?<div style="display:flex;gap:5px">${rating('q2')}</div></label>
            <label style="display:grid;gap:5px;font-weight:700">3. 다음에도 쓰고 싶나요?<div style="display:flex;gap:5px">${rating('q3')}</div></label>
            <div style="display:grid;gap:5px;font-weight:700">4. 이번 작업을 끝까지 완료했나요?
              <div style="display:flex;gap:6px">
                <button class="parro-btn mimic-btn" data-act="survey-bool:q4:true" data-survey-group="q4" data-survey-value="true" aria-pressed="true" style="flex:1;background:#E8FFF7;color:#00796F;border:1px solid #009B8E">예</button>
                <button class="parro-btn mimic-btn" data-act="survey-bool:q4:false" data-survey-group="q4" data-survey-value="false" aria-pressed="false" style="flex:1;background:white;color:#4b5563;border:1px solid #e5e7eb">아니오</button>
              </div>
            </div>
            <div style="display:grid;gap:5px;font-weight:700">5. 가장 불편했던 점은 무엇인가요?
              <div style="display:flex;gap:5px;flex-wrap:wrap">${['막힌 단계 없음','클릭 위치 부정확','설명 부족','화면 전환 문제','텍스트 입력 문제','완료 못함'].map((label, i) => issueBtn(label, i === 0)).join('')}</div>
            </div>
            <textarea data-survey-comment placeholder="더 남기고 싶은 의견이 있으면 적어주세요. (선택)" style="width:100%;min-height:58px;box-sizing:border-box;border:1px solid #e5e7eb;border-radius:8px;padding:8px;font-size:12px;font-family:inherit;resize:vertical"></textarea>
          </div>
          <div style="display:flex;gap:7px;margin-top:12px">
            <button class="parro-btn mimic-btn" data-act="exit" style="flex:1;background:white;color:#6b7280;border:1px solid #e5e7eb;padding:9px 10px">건너뛰기</button>
            <button class="parro-btn mimic-btn" data-act="survey-submit" style="flex:1;background:linear-gradient(135deg,#009B8E,#12B886);color:#fff;padding:9px 10px">제출하기</button>
          </div>
        </div>`;
    }
    state.tooltip.style.left = `${Math.max(TIP_M, (window.innerWidth - TIP_W) / 2)}px`;
    state.tooltip.style.top  = `${Math.max(TIP_M, (window.innerHeight - 220) / 2)}px`;
    state.tooltip.style.animation = 'parro-tip-in 0.3s ease forwards';
  }

  // 현재 페이지가 단계의 page_url과 다를 때 — 세션을 끝내지 않고 참고 카드로 다음 행동을 안내한다.
  function showWrongPage(step, opts) {
    showExplanation({
      ...step,
      guide_mode: 'explanation',
      kind: 'none',
      instruction: step.instruction || '이 단계의 대상 화면이 아닙니다. 필요한 화면으로 이동한 뒤 진행해주세요.',
    }, opts);
  }

  // 같은 URL이지만 녹화한 요소가 아직 화면에 없을 때 — 가짜 핫스팟 대신 '찾는 중' 카드를 띄우고
  // 요소가 나타나면 정상 오버레이로 자동 전환한다. (Typeform 등 SPA·녹화 차단으로 건너뛴 단계 대응)
  function safeCssColor(value, fallback) {
    const s = String(value || '').trim();
    return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s) || /^rgba?\([\d\s.,%]+\)$/i.test(s) ? s : fallback;
  }

  function pctBox(a) {
    const x1 = Number(a.x1), y1 = Number(a.y1), x2 = Number(a.x2), y2 = Number(a.y2);
    if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
    const left = Math.max(0, Math.min(x1, x2));
    const top = Math.max(0, Math.min(y1, y2));
    const width = Math.max(1, Math.abs(x2 - x1));
    const height = Math.max(1, Math.abs(y2 - y1));
    return { left, top, width, height, x1, y1, x2, y2 };
  }

  function renderGuideAnnotation(a) {
    const box = pctBox(a);
    if (!box) return '';
    const color = safeCssColor(a.color || a.borderColor, '#009B8E');
    const borderColor = safeCssColor(a.borderColor || a.color, color);
    const stroke = Math.max(1, Math.min(8, Number(a.strokeWidth) || 3));
    const base = `position:absolute;left:${box.left}%;top:${box.top}%;width:${box.width}%;height:${box.height}%;box-sizing:border-box;pointer-events:none;`;
    if (a.type === 'text') {
      return `<div style="${base}width:auto;min-width:72px;max-width:70%;height:auto;background:rgba(17,24,39,.88);color:#fff;border:1px solid rgba(255,255,255,.24);border-radius:8px;padding:6px 8px;font-size:11px;line-height:1.35;box-shadow:0 8px 24px rgba(0,0,0,.28)">${escapeHtml(a.text || '')}</div>`;
    }
    if (a.type === 'marker') {
      return `<div style="position:absolute;left:${box.x1}%;top:${box.y1}%;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;background:${color};color:#fff;display:grid;place-items:center;font-size:11px;font-weight:800;box-shadow:0 6px 16px rgba(0,0,0,.25);pointer-events:none">${escapeHtml(a.markerNumber || '')}</div>`;
    }
    if (a.type === 'arrow' || a.type === 'line') {
      const dx = box.x2 - box.x1, dy = box.y2 - box.y1;
      const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const head = a.type === 'arrow'
        ? `<span style="position:absolute;right:-2px;top:50%;width:8px;height:8px;border-top:${stroke}px solid ${color};border-right:${stroke}px solid ${color};transform:translateY(-50%) rotate(45deg);transform-origin:center"></span>`
        : '';
      return `<div style="position:absolute;left:${box.x1}%;top:${box.y1}%;width:${length}%;height:${stroke}px;background:${color};transform-origin:0 50%;transform:rotate(${angle}deg);border-radius:${stroke}px;pointer-events:none">${head}</div>`;
    }
    const radius = a.type === 'ellipse' ? '999px' : a.type === 'roundedRect' ? '10px' : '4px';
    const shadow = a.type === 'spotlight' ? 'box-shadow:0 0 0 9999px rgba(0,0,0,.42),0 0 0 2px rgba(255,255,255,.75);' : '';
    const fill = a.type === 'spotlight' ? 'background:transparent;' : 'background:rgba(0,155,142,.08);';
    return `<div style="${base}${fill}border:${stroke}px solid ${borderColor};border-radius:${radius};${shadow}"></div>`;
  }

  function renderVisualGuideImage(step) {
    if (!step || !step.screenshot_url) return '';
    const annotations = Array.isArray(step.user_annotations)
      ? step.user_annotations
      : Array.isArray(step.annotations) ? step.annotations : [];
    const overlay = annotations.map(renderGuideAnnotation).join('');
    return `
      <div style="position:relative;margin:0 0 14px;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.12);background:#050507;line-height:0">
        <img src="${escapeHtml(step.screenshot_url)}" alt="" style="display:block;width:100%;max-height:240px;object-fit:contain;background:#050507">
        ${overlay ? `<div style="position:absolute;inset:0;pointer-events:none;overflow:hidden">${overlay}</div>` : ''}
      </div>`;
  }

  function showExplanation(step, opts) {
    const host = document.createElement('div');
    host.id = OVERLAY_ROOT_ID;
    host.style.cssText = `all:initial;position:fixed;inset:0;pointer-events:none;z-index:${Z};font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;`;
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });

    const idx = opts.index ?? 0, total = opts.total ?? 1;
    const title = step.title || `Step ${idx + 1}`;
    const text = step.instruction || '이 단계는 직접 진행한 뒤 다음을 눌러주세요.';

    const card = document.createElement('div');
    card.style.cssText = `position:fixed;right:16px;bottom:16px;width:360px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto;background:${TIP_BG};color:#fff;border-radius:16px;padding:16px;box-shadow:0 18px 55px rgba(0,0,0,.48),0 0 0 1px rgba(23,201,182,.16);pointer-events:auto`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="${AVATAR_STYLE}width:38px;height:38px;">${mascotHtml('clarify')}</div>
        <div style="min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
            <span style="font-size:11px;font-weight:700;color:#8DD63F">${idx + 1} / ${total}</span>
            <span style="font-size:10.5px;font-weight:800;color:#8DD63F;background:rgba(0,155,142,.22);padding:2px 7px;border-radius:999px">참고 단계</span>
          </div>
          <div style="font-size:15px;font-weight:800;line-height:1.35">${escapeHtml(title)}</div>
        </div>
      </div>
      <div style="font-size:13px;color:#D1D5DB;line-height:1.55;margin-bottom:14px">${escapeHtml(text)}</div>
      ${renderVisualGuideImage(step)}
      <div style="font-size:11.5px;color:#9CA3AF;line-height:1.45;padding-top:2px">이전·다음 단계는 Parro 사이드 패널에서 선택하세요.</div>`;
    shadow.appendChild(card);

    state = { host, shadow, explanation: true };
  }

  function showWaiting(step, opts, initialStatus) {
    const waitKey = `${opts.index ?? 0}:${step?.page_url || ''}:${step?.id || step?.title || ''}:${step?.element_selector || step?.element_xpath || step?.target_context?.accessibleName || ''}`;
    const initialWaitStatus = initialStatus || 'searching';
    state = {
      waiting: true,
      waitKey,
      waitStatus: initialWaitStatus,
      matchingSince: initialWaitStatus === 'searching' ? Date.now() : null,
      findObserver: null,
      findTimer: null,
      retryTimer: null,
    };
    opts.onTargetStatus && opts.onTargetStatus(state.waitStatus);

    // 페이지와 대상 요소가 모두 검증되면 그때 처음으로 DOM 오버레이를 만든다.
    const tryResolve = () => {
      if (!state || !state.waiting) return false;
      if (!step?.page_url || !pageMatches(step.page_url)) {
        state.matchingSince = null;
        if (state.waitStatus !== 'page_mismatch') {
          state.waitStatus = 'page_mismatch';
          opts.onTargetStatus && opts.onTargetStatus('page_mismatch');
        }
        return false;
      }
      if (isExplanationStep(step)) {
        show(step, opts);
        return true;
      }
      const r = resolveTarget(step);
      if (r.el && r.rect) {
        show(step, opts);
        return true;
      }
      if (state.matchingSince == null) state.matchingSince = Date.now();
      const nextStatus = Date.now() - state.matchingSince >= 8000 ? 'not_found' : 'searching';
      if (state.waitStatus !== nextStatus) {
        state.waitStatus = nextStatus;
        opts.onTargetStatus && opts.onTargetStatus(nextStatus);
      }
      return false;
    };

    // DOM 변화는 짧게 디바운스하고, History API만 바뀌는 SPA를 위해 저빈도 폴링을 보조로 둔다.
    let pending = false;
    const scheduleTryResolve = () => {
      if (pending) return;
      pending = true;
      state.retryTimer = setTimeout(() => { pending = false; tryResolve(); }, 120);
    };
    const obs = new MutationObserver(scheduleTryResolve);
    try {
      obs.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['id', 'class', 'style', 'role', 'aria-label', 'aria-hidden', 'disabled'],
      });
    } catch { /* noop */ }
    state.findObserver = obs;
    try {
      window.addEventListener('resize', scheduleTryResolve, true);
      state.onWaitViewportChange = scheduleTryResolve;
    } catch { /* noop */ }

    // 안전망: 옵저버가 못 잡는 속성-only/canvas 변경 대비 — 1s 저빈도 폴링
    const safety = () => {
      if (!state || !state.waiting) return;
      if (tryResolve()) return;
      state.findTimer = setTimeout(safety, 1200);
    };
    state.findTimer = setTimeout(safety, 800);
  }

  // AI 시각 재탐색 (P3) — 1회성. 성공 시 step._regroundXY를 세팅하고 정상 오버레이로 재렌더.
  // 셀렉터·XPath·퍼지가 모두 실패한 스텝에서만, 현재 화면 스크린샷을 Vision에 보내 위치 복구.
  function maybeReground(step, opts) {
    const key = `${opts.index ?? 0}:${step.page_url || ''}:${step.id || step.title || ''}:${step.element_selector || step.element_xpath || step.target_context?.accessibleName || ''}`;
    // 재방문: 이미 찾은 좌표가 있으면 AI 재호출 없이 즉시 적용(영구 대기 방지)
    const cached = regroundCache.get(key);
    if (cached) {
      // 이미 같은 AI 좌표로 다시 해석했다가 DOM 증거 검증에서 탈락했다면 조용히 대기한다.
      // 무조건 show()를 재호출하면 실패한 AI 결과로 동기 재귀가 발생할 수 있다.
      if (!step._regroundXY) {
        step._regroundXY = cached;
        show(step, opts);
      }
      return;
    }
    if (regroundCache.has(key)) return;  // 이전에 실패(null) 마킹됨 → 재시도 안 함
    regroundCache.set(key, null);        // 시도 마킹
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
        const confidence = Number(res?.confidence) || 0;
        if (!res?.found || confidence < 0.85 || !Number.isFinite(Number(res.x)) || !Number.isFinite(Number(res.y))) return;
        const xy = { x: Number(res.x), y: Number(res.y), confidence };
        regroundCache.set(key, xy);  // 성공 캐시 — 재방문 시 재사용
        // 응답 시점에도 같은 스텝을 대기 중일 때만 적용 (사용자가 넘어갔으면 캐시만 남김)
        if (!state || state.waitKey !== key) return;
        step._regroundXY = xy;
        show(step, opts);
      });
    } catch { /* noop */ }
  }

  function editableValue(el) {
    if (!el) return '';
    return el.isContentEditable ? String(el.textContent || '') : String(el.value || '');
  }

  function ensureContentEditablePlaceholderStyle() {
    const id = 'parro-guide-placeholder-style';
    if (document.getElementById(id)) return;
    const node = document.createElement('style');
    node.id = id;
    node.textContent = '[data-parro-guide-placeholder]:empty::before{content:attr(data-parro-guide-placeholder);opacity:.38;pointer-events:none}';
    (document.head || document.documentElement).appendChild(node);
  }

  // 실제 DOM 입력을 감시한다. 기대값이 있으면 빈 필드의 placeholder로만 보여주고,
  // 사용자가 동일한 값을 직접 입력했을 때에만 다음 단계로 진행한다.
  function setupRequiredTextInput(el, expectedText) {
    const tag = el?.tagName ? el.tagName.toLowerCase() : '';
    const isNativeField = tag === 'input' || tag === 'textarea';
    if (!isNativeField && !el?.isContentEditable) return;

    state.requiresTextInput = true;
    state.expectedText = expectedText;
    state.typeInputEl = el;

    if (expectedText && editableValue(el).length === 0) {
      if (isNativeField) {
        state.originalPlaceholder = el.getAttribute('placeholder');
        el.setAttribute('placeholder', expectedText);
        state.placeholderInjected = true;
      } else {
        ensureContentEditablePlaceholderStyle();
        state.originalGuidePlaceholder = el.getAttribute('data-parro-guide-placeholder');
        el.setAttribute('data-parro-guide-placeholder', expectedText);
        state.guidePlaceholderInjected = true;
      }
    }

    const checkValue = () => {
      if (!state || state.completed || state.advanced) return;
      const current = editableValue(el);
      const satisfied = expectedText ? current === expectedText : current.trim().length > 0;
      if (satisfied) advance('type');
    };
    el.addEventListener('input', checkValue, true);
    el.addEventListener('change', checkValue, true);
    el.addEventListener('compositionend', checkValue, true);
    state.onTypeInput = checkValue;
    try { el.focus({ preventScroll: true }); } catch { /* noop */ }
  }

  function hide() {
    if (!state) {
      const stray = document.getElementById(OVERLAY_ROOT_ID) || document.getElementById(LEGACY_OVERLAY_ROOT_ID);
      if (stray) stray.remove();
      return;
    }
    if (state.rafId) cancelAnimationFrame(state.rafId);
    if (state.typeInputEl && state.onTypeInput) {
      state.typeInputEl.removeEventListener('input', state.onTypeInput, true);
      state.typeInputEl.removeEventListener('change', state.onTypeInput, true);
      state.typeInputEl.removeEventListener('compositionend', state.onTypeInput, true);
    }
    if (state.typeInputEl && state.placeholderInjected) {
      if (state.originalPlaceholder == null) state.typeInputEl.removeAttribute('placeholder');
      else state.typeInputEl.setAttribute('placeholder', state.originalPlaceholder);
    }
    if (state.typeInputEl && state.guidePlaceholderInjected) {
      if (state.originalGuidePlaceholder == null) state.typeInputEl.removeAttribute('data-parro-guide-placeholder');
      else state.typeInputEl.setAttribute('data-parro-guide-placeholder', state.originalGuidePlaceholder);
    }
    if (state.revealTimer) clearTimeout(state.revealTimer);
    if (state.findTimer) clearTimeout(state.findTimer);
    if (state.retryTimer) clearTimeout(state.retryTimer);
    if (state.validationTimer) clearTimeout(state.validationTimer);
    if (state.findObserver) state.findObserver.disconnect();
    if (state.onWaitViewportChange) {
      window.removeEventListener('resize', state.onWaitViewportChange, true);
    }
    if (state.onDocClick) document.removeEventListener('click', state.onDocClick, true);
    if (state.onKey) document.removeEventListener('keydown', state.onKey, true);
    if (state.validationPageHide) window.removeEventListener('pagehide', state.validationPageHide, true);
    if (state.host) state.host.remove();
    state = null;
  }

  // ── 유틸 ──────────────────────────────────────────────────────
  function style(css) { const s = document.createElement('style'); s.textContent = css; return s; }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  const guideApi = { show, hide, _resolveTarget: resolveTarget, _isHit: isHit, _pointInRect: pointInRect };
  window.ParroGuide = guideApi;
  window.MimicGuide = guideApi;
})();
