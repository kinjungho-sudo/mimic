// guide-engine.js — Guide Me 라이브 오버레이 엔진 (재생 전용; 녹화 코드와 무관)
// content_scripts에서 content.js보다 먼저 로드되어 window.MimicGuide 를 노출한다.
// 부작용 없음: 호출 전까지 리스너/DOM/타이머를 만들지 않는다.
(function () {
  'use strict';
  if (window.MimicGuide) return; // 중복 주입 방지

  const Z = 2147483640;
  const COORD_BOX = 46;   // 좌표만 있을 때 핫스팟 한 변(px)
  const HIT_PAD_EL = 6;   // 요소/rect 클릭 허용 여유(px)
  const HIT_PAD_COORD = 28; // 좌표 핫스팟 클릭 허용 반경 여유(px)

  let state = null;
  // state: { host, shadow, els, resolved, opts, rafId, onDocClick, onKey, advanced, completed }

  // ── 순수 로직 (하버스에서 단위 검증 가능) ──────────────────
  function resolveTarget(step) {
    let el = null, rect = null, source = 'none';
    if (step.element_selector) {
      try { el = document.querySelector(step.element_selector); } catch { el = null; }
      if (el) { rect = rectOf(el); source = 'selector'; }
    }
    if (!rect && step.element_rect) {
      const r = step.element_rect;
      rect = { left: r.x * window.innerWidth, top: r.y * window.innerHeight, width: r.width * window.innerWidth, height: r.height * window.innerHeight };
      source = 'rect';
    }
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

  function pointInRect(x, y, rect, pad) {
    return x >= rect.left - pad && x <= rect.left + rect.width + pad &&
           y >= rect.top - pad && y <= rect.top + rect.height + pad;
  }

  // 클릭이 현재 스텝 타깃에 해당하는가
  function isHit(clientX, clientY, target, eventTarget) {
    if (!target || !target.rect) return false;
    if (target.el && eventTarget && (target.el === eventTarget || target.el.contains(eventTarget))) return true;
    const pad = target.source === 'coord' ? HIT_PAD_COORD : HIT_PAD_EL;
    const live = target.el ? rectOf(target.el) : target.rect;
    return pointInRect(clientX, clientY, live, pad);
  }

  // ── 오버레이 렌더 ───────────────────────────────────────────
  function show(step, opts) {
    hide();
    opts = opts || {};
    const resolved = resolveTarget(step);

    // 화면 밖이면 스크롤해서 보이게
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
      @keyframes mimic-ripple { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(2.6);opacity:0} }
      @keyframes mimic-nudge { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
      .mimic-btn { pointer-events:auto; cursor:pointer; border:none; border-radius:8px; font-size:13px; font-weight:600; padding:7px 12px; }
    `));

    // 하이라이트 박스
    const hl = document.createElement('div');
    hl.style.cssText = `position:fixed;pointer-events:none;box-sizing:border-box;border:2.5px solid #F59E0B;background:rgba(255,200,0,.16);border-radius:7px;box-shadow:0 0 0 4px rgba(245,158,11,.18),0 0 0 9999px rgba(0,0,0,.04);z-index:2;`;
    root.appendChild(hl);

    // 클릭 핀(펄스)
    const pulse = document.createElement('div');
    pulse.style.cssText = `position:fixed;width:18px;height:18px;border-radius:50%;background:rgba(239,68,68,.9);pointer-events:none;z-index:3;`;
    const ripple = document.createElement('div');
    ripple.style.cssText = `position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(239,68,68,.7);animation:mimic-ripple 1.2s ease-out infinite;`;
    pulse.appendChild(ripple);
    root.appendChild(pulse);

    // 안내 + 진행/컨트롤 바
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;bottom:22px;left:50%;transform:translateX(-50%);width:calc(100% - 40px);max-width:560px;background:rgba(17,17,20,.92);color:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 8px 30px rgba(0,0,0,.45);z-index:5;pointer-events:auto;';
    const idx = opts.index ?? 0, total = opts.total ?? 1;
    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:11px;font-weight:700;color:#A5B4FC;background:rgba(99,102,241,.2);padding:2px 8px;border-radius:20px">${idx + 1} / ${total}</span>
        ${resolved.source === 'none' ? '<span style="font-size:11px;color:#FCA5A5">요소를 못 찾았어요 — 직접 진행</span>' : ''}
        <div style="flex:1"></div>
        <button class="mimic-btn" data-act="exit" style="background:transparent;color:rgba(255,255,255,.55);padding:4px 8px">종료</button>
      </div>
      <div data-role="instr" style="font-size:14.5px;line-height:1.55;text-align:left">${escapeHtml(step.instruction || step.title || '')}</div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="mimic-btn" data-act="prev" style="background:rgba(255,255,255,.12);color:#fff">이전</button>
        <div style="flex:1"></div>
        <button class="mimic-btn" data-act="next" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff">${idx + 1 >= total ? '완료' : '다음'}</button>
      </div>`;
    root.appendChild(bar);
    shadow.appendChild(root);

    state = { host, shadow, hl, pulse, bar, resolved, step, opts, idx, total, advanced: false, completed: false, fillTimer: null };

    // 라이브 가이드 자동입력 — type_text가 있고 타깃이 입력 요소면 자동으로 타이핑
    if (step.type_text && resolved.el) autoFill(resolved.el, String(step.type_text));

    // 바 버튼: 페이지 클릭 감지와 섞이지 않도록 마킹 + stopPropagation
    bar.addEventListener('click', (e) => {
      e.stopPropagation();
      const act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'next') advance('manual');
      else if (act === 'prev') opts.onPrev && opts.onPrev();
      else if (act === 'exit') opts.onExit && opts.onExit();
    }, true);

    // 위치 추적 (스크롤/리사이즈/레이아웃 변화)
    const reposition = () => {
      const t = state && state.resolved;
      if (!t || !t.rect) { hl.style.display = 'none'; } else {
        const r = t.el ? rectOf(t.el) : t.rect;
        const P = 4;
        hl.style.display = 'block';
        hl.style.left = `${r.left - P}px`; hl.style.top = `${r.top - P}px`;
        hl.style.width = `${r.width + P * 2}px`; hl.style.height = `${r.height + P * 2}px`;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        pulse.style.display = 'block';
        pulse.style.left = `${cx - 9}px`; pulse.style.top = `${cy - 9}px`;
      }
      state.rafId = requestAnimationFrame(reposition);
    };
    state.rafId = requestAnimationFrame(reposition);

    // 자동 진행: 타깃 클릭 감지 (캡처 단계, 페이지 동작은 막지 않음)
    const onDocClick = (e) => {
      if (state.advanced || state.completed) return;
      if (e.target === host) return; // 우리 오버레이 클릭 무시
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
    if (!state || !state.bar) return;
    state.bar.style.animation = 'mimic-nudge .3s';
    setTimeout(() => { if (state && state.bar) state.bar.style.animation = ''; }, 320);
  }

  function showComplete() {
    if (!state) return;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.completed = true;
    state.hl.style.display = 'none';
    state.pulse.style.display = 'none';
    state.bar.innerHTML = `
      <div style="text-align:center;padding:6px 4px">
        <div style="font-size:22px;margin-bottom:6px">🎉</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:10px">가이드를 완료했습니다</div>
        <button class="mimic-btn" data-act="exit" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:9px 22px">닫기</button>
      </div>`;
  }

  // 입력 요소에 텍스트 자동 타이핑 (React 등 제어 컴포넌트 대응: native setter + input 이벤트)
  function autoFill(el, text) {
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    const isField = tag === 'input' || tag === 'textarea' || el.isContentEditable;
    if (!isField) return;  // 입력 요소가 아니면 자동입력 안 함(클릭형 타깃 등)
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
    let i = 0;
    const tick = () => {
      if (!state || state.completed) return;
      i += 1;
      setVal(text.slice(0, i));
      if (i < text.length) { state.fillTimer = setTimeout(tick, 35); }
      else { el.dispatchEvent(new Event('change', { bubbles: true })); }
    };
    // 하이라이트가 보인 직후 시작
    state.fillTimer = setTimeout(tick, 280);
  }

  function hide() {
    if (!state) {
      const stray = document.getElementById('mimic-overlay-root');
      if (stray) stray.remove();
      return;
    }
    if (state.rafId) cancelAnimationFrame(state.rafId);
    if (state.fillTimer) clearTimeout(state.fillTimer);
    if (state.onDocClick) document.removeEventListener('click', state.onDocClick, true);
    if (state.onKey) document.removeEventListener('keydown', state.onKey, true);
    if (state.host) state.host.remove();
    state = null;
  }

  // ── 유틸 ────────────────────────────────────────────────────
  function style(css) { const s = document.createElement('style'); s.textContent = css; return s; }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  window.MimicGuide = { show, hide, _resolveTarget: resolveTarget, _isHit: isHit, _pointInRect: pointInRect };
})();
