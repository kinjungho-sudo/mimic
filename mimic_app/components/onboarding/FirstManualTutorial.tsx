'use client';

import { BRAND_COLORS, BRAND_NAME } from '@/lib/brand';

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

const steps = [
  '녹화할 페이지를 선택해요',
  '평소처럼 클릭하며 업무를 진행해요',
  `${BRAND_NAME}가 매뉴얼 초안을 만들어요`,
];

export function FirstManualWelcome({
  firstName,
  onStart,
  onDismiss,
}: {
  firstName: string;
  onStart: () => void;
  onDismiss: () => void;
}) {
  return (
    <section
      aria-labelledby="first-manual-title"
      style={{
        maxWidth: 760,
        margin: '38px auto 0',
        border: '1px solid rgba(0,155,142,0.22)',
        borderRadius: 20,
        background: 'linear-gradient(145deg, #FFFFFF 0%, #F2FFFB 100%)',
        boxShadow: '0 18px 50px rgba(15,23,42,0.08)',
        overflow: 'hidden',
      }}
    >
      <div style={{ height: 5, background: `linear-gradient(90deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.guide})` }} />
      <div style={{ padding: '32px clamp(22px, 5vw, 46px) 36px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 999, background: BRAND_COLORS.guideSoft, color: BRAND_COLORS.primary, fontSize: 11.5, fontWeight: 700, marginBottom: 16 }}>
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: BRAND_COLORS.primary }} />
          시작 튜토리얼 · 약 3분
        </div>

        <h2 id="first-manual-title" style={{ margin: 0, color: '#0F172A', fontSize: 'clamp(23px, 4vw, 32px)', lineHeight: 1.25, letterSpacing: '-0.035em' }}>
          {firstName ? `${firstName}님, ` : ''}첫 매뉴얼을 함께 만들어볼까요?
        </h2>
        <p style={{ margin: '10px 0 26px', color: '#64748B', fontSize: 14, lineHeight: 1.7 }}>
          기능을 둘러보는 대신 실제 업무를 짧게 녹화해 결과물 하나를 완성해요.
        </p>

        <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }} className="first-manual-steps">
          {steps.map((label, index) => (
            <li key={label} style={{ minHeight: 92, padding: '14px 14px 13px', borderRadius: 13, background: 'rgba(255,255,255,0.82)', border: '1px solid #DCEFEA' }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 25, height: 25, borderRadius: 8, background: index === 0 ? BRAND_COLORS.primary : '#E8F5F2', color: index === 0 ? 'white' : BRAND_COLORS.primary, fontSize: 11, fontWeight: 800, marginBottom: 10 }}>{index + 1}</span>
              <span style={{ color: '#334155', fontSize: 12.5, lineHeight: 1.5, fontWeight: 600 }}>{label}</span>
            </li>
          ))}
        </ol>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onStart}
            style={{ minHeight: 44, padding: '0 20px', border: 0, borderRadius: 11, background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.guide})`, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,155,142,0.22)' }}
          >
            첫 매뉴얼 만들기 →
          </button>
          <button type="button" onClick={onDismiss} style={{ minHeight: 44, padding: '0 14px', border: 0, background: 'transparent', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            직접 둘러보기
          </button>
        </div>
      </div>
      <style>{`
        @media (max-width: 640px) {
          .first-manual-steps { grid-template-columns: 1fr !important; }
          .first-manual-steps li { min-height: auto !important; }
        }
      `}</style>
    </section>
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
