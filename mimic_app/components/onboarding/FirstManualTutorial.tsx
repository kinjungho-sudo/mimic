'use client';

import { useEffect, useState } from 'react';
import { BRAND_COLORS } from '@/lib/brand';

export type FirstManualTutorialStatus = 'started' | 'dismissed' | 'completed';

const STORAGE_PREFIX = 'parro:first-manual-tutorial:v1';
const FIRST_TUTORIAL_RELEASED_AT = Date.parse('2026-07-12T00:00:00Z');

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function getFirstManualTutorialStatus(userId: string): FirstManualTutorialStatus | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(storageKey(userId));
  return value === 'started' || value === 'dismissed' || value === 'completed' ? value : null;
}

export function setFirstManualTutorialStatus(userId: string, status: FirstManualTutorialStatus) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(userId), status);
}

export function isFirstManualTutorialEligible(createdAt: string | undefined) {
  if (!createdAt) return false;
  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) && timestamp >= FIRST_TUTORIAL_RELEASED_AT;
}

export type FirstRunLiveGuidePhase = 'welcome' | 'create' | 'record' | 'page-select' | 'finished';

type TargetRect = { top: number; left: number; width: number; height: number };

const guideSteps: Record<Exclude<FirstRunLiveGuidePhase, 'welcome' | 'finished'>, {
  selector: string;
  eyebrow: string;
  title: string;
  description: string;
  progress: string;
}> = {
  create: {
    selector: '[data-first-guide="create"]',
    eyebrow: '첫 번째 미션',
    title: '새 매뉴얼을 시작해볼까요?',
    description: '빛나고 있는 ‘새로 만들기’를 직접 눌러보세요.',
    progress: '1 / 3',
  },
  record: {
    selector: '[data-first-guide="record"]',
    eyebrow: '좋아요, 바로 찾았어요',
    title: '이번에는 화면을 녹화해요',
    description: '‘새 매뉴얼(녹화)’을 누르면 평소 하던 일이 매뉴얼로 바뀌기 시작해요.',
    progress: '2 / 3',
  },
  'page-select': {
    selector: '[data-first-guide="page-select"]',
    eyebrow: '마지막 준비',
    title: '녹화할 화면을 선택하세요',
    description: '페이지를 선택하면 Recorder가 실제 업무 화면으로 안내할게요.',
    progress: '3 / 3',
  },
};

export function FirstRunLiveGuide({
  firstName,
  phase,
  onStart,
  onDismiss,
}: {
  firstName: string;
  phase: FirstRunLiveGuidePhase;
  onStart: () => void;
  onDismiss: () => void;
}) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    if (phase === 'welcome' || phase === 'finished') {
      setTargetRect(null);
      return;
    }

    const step = guideSteps[phase];
    let target: HTMLElement | null = null;
    let observer: ResizeObserver | null = null;
    let frame = 0;

    const measure = () => {
      target = Array.from(document.querySelectorAll<HTMLElement>(step.selector)).find(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) ?? null;
      if (!target) {
        setTargetRect(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const padding = phase === 'record' ? 8 : 7;
      setTargetRect({
        top: Math.max(8, rect.top - padding),
        left: Math.max(8, rect.left - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();
    const retry = window.setInterval(() => {
      measure();
      if (target && !observer) {
        observer = new ResizeObserver(scheduleMeasure);
        observer.observe(target);
      }
    }, 180);
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, true);

    return () => {
      window.clearInterval(retry);
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, true);
    };
  }, [phase]);

  if (phase === 'finished') return null;

  if (phase === 'welcome') {
    return (
      <div role="dialog" aria-modal="true" aria-labelledby="first-guide-title" style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'grid', placeItems: 'center', padding: 20, background: 'radial-gradient(circle at 50% 42%, rgba(0,155,142,0.18), rgba(2,8,23,0.82) 48%, rgba(2,8,23,0.94))', backdropFilter: 'blur(8px)', overflow: 'hidden' }}>
        <div className="parro-guide-radar" aria-hidden="true" />
        <div style={{ position: 'relative', width: 'min(520px, 100%)', padding: '38px clamp(24px, 6vw, 46px) 34px', borderRadius: 28, background: 'rgba(255,255,255,0.97)', boxShadow: '0 30px 100px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.22)', textAlign: 'center', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', inset: '0 0 auto', height: 5, background: `linear-gradient(90deg, ${BRAND_COLORS.primary}, #17C9B6, ${BRAND_COLORS.guide})` }} />
          <div className="parro-guide-orb" aria-hidden="true">
            <span>P</span>
            <i />
          </div>
          <div style={{ marginTop: 20, color: BRAND_COLORS.primary, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em' }}>PARRO LIVE GUIDE</div>
          <h2 id="first-guide-title" style={{ margin: '8px 0 12px', color: '#0F172A', fontSize: 'clamp(25px, 6vw, 38px)', lineHeight: 1.18, letterSpacing: '-0.045em' }}>
            {firstName ? `${firstName}님, ` : ''}<br />첫 매뉴얼을 같이 만들어봐요
          </h2>
          <p style={{ margin: '0 auto 24px', maxWidth: 390, color: '#64748B', fontSize: 14, lineHeight: 1.7 }}>
            지금부터 제가 화면 위에서 다음 행동을 직접 알려드릴게요. 설명을 읽기보다 빛나는 곳을 따라 눌러보세요.
          </p>
          <button type="button" onClick={onStart} style={{ width: '100%', minHeight: 50, border: 0, borderRadius: 14, background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, #17C9B6)`, color: 'white', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 12px 30px rgba(0,155,142,0.28)' }}>
            Live Guide 시작하기
          </button>
          <button type="button" onClick={onDismiss} style={{ marginTop: 10, minHeight: 36, padding: '0 12px', border: 0, background: 'transparent', color: '#94A3B8', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            지금은 둘러볼게요
          </button>
        </div>
        <style>{`
          .parro-guide-radar{position:absolute;width:min(82vw,720px);aspect-ratio:1;border-radius:50%;border:1px solid rgba(23,201,182,.16);box-shadow:0 0 0 90px rgba(23,201,182,.035),0 0 0 180px rgba(23,201,182,.025);animation:parro-radar 4s ease-in-out infinite}
          .parro-guide-orb{position:relative;margin:0 auto;width:78px;height:78px;border-radius:24px;display:grid;place-items:center;background:linear-gradient(145deg,#009B8E,#17C9B6);color:white;font-size:31px;font-weight:900;box-shadow:0 18px 40px rgba(0,155,142,.3);animation:parro-orb 2.4s ease-in-out infinite}
          .parro-guide-orb i{position:absolute;inset:-9px;border:1px solid rgba(0,155,142,.3);border-radius:30px;animation:parro-ring 2.4s ease-out infinite}
          @keyframes parro-radar{50%{transform:scale(1.04);opacity:.7}}
          @keyframes parro-orb{50%{transform:translateY(-6px) rotate(-2deg)}}
          @keyframes parro-ring{70%,100%{inset:-22px;opacity:0}}
          @media (prefers-reduced-motion:reduce){.parro-guide-radar,.parro-guide-orb,.parro-guide-orb i{animation:none!important}}
        `}</style>
      </div>
    );
  }

  const step = guideSteps[phase];
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const tooltipTop = targetRect
    ? Math.max(16, Math.min(
        viewportHeight - 220,
        targetRect.top + targetRect.height + 220 < viewportHeight
          ? targetRect.top + targetRect.height + 18
          : targetRect.top - 198
      ))
    : Math.max(20, viewportHeight / 2 - 100);
  const tooltipLeft = targetRect
    ? Math.max(16, Math.min(viewportWidth - 336, targetRect.left + targetRect.width - 320))
    : Math.max(16, viewportWidth / 2 - 160);

  return (
    <div aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 3000, pointerEvents: 'none' }}>
      {targetRect && (
        <>
          <div style={{ position: 'fixed', inset: `0 0 auto 0`, height: targetRect.top, background: 'rgba(2,8,23,.72)', pointerEvents: 'auto' }} />
          <div style={{ position: 'fixed', top: targetRect.top, left: 0, width: targetRect.left, height: targetRect.height, background: 'rgba(2,8,23,.72)', pointerEvents: 'auto' }} />
          <div style={{ position: 'fixed', top: targetRect.top, left: targetRect.left + targetRect.width, right: 0, height: targetRect.height, background: 'rgba(2,8,23,.72)', pointerEvents: 'auto' }} />
          <div style={{ position: 'fixed', top: targetRect.top + targetRect.height, insetInline: 0, bottom: 0, background: 'rgba(2,8,23,.72)', pointerEvents: 'auto' }} />
          <div className="parro-target-pulse" style={{ position: 'fixed', top: targetRect.top, left: targetRect.left, width: targetRect.width, height: targetRect.height, borderRadius: phase === 'record' ? 15 : 12, boxShadow: '0 0 0 3px #17C9B6, 0 0 0 9px rgba(23,201,182,.22), 0 0 34px rgba(23,201,182,.7)' }} />
        </>
      )}
      <aside style={{ position: 'fixed', top: tooltipTop, left: tooltipLeft, width: 320, maxWidth: 'calc(100vw - 32px)', padding: 17, borderRadius: 17, background: '#071A22', color: 'white', boxShadow: '0 20px 60px rgba(0,0,0,.42), 0 0 0 1px rgba(23,201,182,.24)', pointerEvents: 'auto', animation: 'parro-tip-in .28s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 9, background: 'linear-gradient(145deg,#009B8E,#17C9B6)', fontSize: 13, fontWeight: 900 }}>P</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#17C9B6', fontSize: 10.5, fontWeight: 800, letterSpacing: '.07em' }}>{step.eyebrow}</div>
            <div style={{ color: 'rgba(255,255,255,.48)', fontSize: 10.5 }}>{step.progress}</div>
          </div>
          <button type="button" onClick={onDismiss} aria-label="Live Guide 닫기" style={{ width: 28, height: 28, border: 0, borderRadius: 8, background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.55)', cursor: 'pointer' }}>×</button>
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, lineHeight: 1.35 }}>{step.title}</h3>
        <p style={{ margin: 0, color: '#B8C7CC', fontSize: 12.5, lineHeight: 1.6 }}>{step.description}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 13, color: '#17C9B6', fontSize: 11.5, fontWeight: 700 }}>
          <span className="parro-click-dot" /> 빛나는 곳을 직접 눌러주세요
        </div>
      </aside>
      <style>{`
        .parro-target-pulse{animation:parro-target 1.45s ease-in-out infinite;pointer-events:none}
        .parro-click-dot{width:7px;height:7px;border-radius:50%;background:#17C9B6;box-shadow:0 0 0 0 rgba(23,201,182,.6);animation:parro-dot 1.35s infinite}
        @keyframes parro-target{50%{box-shadow:0 0 0 3px #17C9B6,0 0 0 14px rgba(23,201,182,.08),0 0 46px rgba(23,201,182,.9)}}
        @keyframes parro-dot{70%{box-shadow:0 0 0 8px rgba(23,201,182,0)}}
        @keyframes parro-tip-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.parro-target-pulse,.parro-click-dot{animation:none!important}}
      `}</style>
    </div>
  );
}

export function FirstManualComplete({ onClose, onOpenGuide }: { onClose: () => void; onOpenGuide: () => void }) {
  return (
    <aside
      role="status"
      aria-live="polite"
      style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 80, width: 'min(390px, calc(100vw - 32px))', padding: 20, borderRadius: 16, background: '#FFFFFF', border: '1px solid rgba(0,155,142,0.25)', boxShadow: '0 20px 55px rgba(15,23,42,0.2)' }}
    >
      <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
        <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, flexShrink: 0, borderRadius: 12, background: BRAND_COLORS.guideSoft, color: BRAND_COLORS.primary, fontSize: 19, fontWeight: 800 }}>✓</span>
        <div>
          <div style={{ color: BRAND_COLORS.primary, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', marginBottom: 4 }}>첫 매뉴얼 완성</div>
          <h2 style={{ margin: 0, color: '#0F172A', fontSize: 18, letterSpacing: '-0.025em' }}>녹화가 편집 가능한 매뉴얼이 됐어요</h2>
          <p style={{ margin: '8px 0 16px', color: '#64748B', fontSize: 12.5, lineHeight: 1.6 }}>제목과 단계 설명을 다듬거나, 연습 가이드에서 실제 사용자 경험을 확인해보세요.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={onOpenGuide} style={{ minHeight: 36, padding: '0 13px', borderRadius: 9, border: 0, background: BRAND_COLORS.primary, color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>연습 가이드 보기</button>
            <button type="button" onClick={onClose} style={{ minHeight: 36, padding: '0 11px', borderRadius: 9, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>계속 편집하기</button>
          </div>
        </div>
      </div>
    </aside>
  );
}
