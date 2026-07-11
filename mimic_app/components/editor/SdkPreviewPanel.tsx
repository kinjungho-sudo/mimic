'use client';

import { useState } from 'react';
import DOMPurify from 'dompurify';
import { BRAND_COLORS } from '@/lib/brand';
import type { ManualStep } from './ManualEditor';

interface SdkPreviewPanelProps {
  steps: ManualStep[];
  activeId: string | null;
  onClose: () => void;
}

const SDK_PRIMARY_SOFT = 'rgba(0,155,142,0.12)';
const SDK_PRIMARY_MARK = 'rgba(0,155,142,0.24)';

export function SdkPreviewPanel({ steps, activeId, onClose }: SdkPreviewPanelProps) {
  const activeIdx = steps.findIndex(s => s.id === activeId);
  const [current, setCurrent] = useState(activeIdx >= 0 ? activeIdx : 0);

  const step = steps[current];
  const total = steps.length;
  const isFirst = current === 0;
  const isLast = current === total - 1;

  if (!step) {
    return (
      <div style={panelStyle}>
        <PanelHeader onClose={onClose} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: '13px' }}>
          단계가 없어요
        </div>
      </div>
    );
  }

  const sanitizedDescription = step.description
    ? DOMPurify.sanitize(step.description, { ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'br', 'span'], ALLOWED_ATTR: [] })
    : '';

  const MAX_DOTS = 7;
  const shown = Math.min(total, MAX_DOTS);
  const offset = total > MAX_DOTS ? Math.max(0, Math.min(current - Math.floor(MAX_DOTS / 2), total - MAX_DOTS)) : 0;

  return (
    <div style={panelStyle}>
      <PanelHeader onClose={onClose} />

      {/* 디바이스 프레임 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', background: '#F1F2F6', gap: '12px', overflowY: 'auto' }}>

        {/* 스크린샷 + 하이라이트 오버레이 */}
        {step.screenshotUrl && (
          <div style={{ position: 'relative', width: '100%', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={step.screenshotUrl}
              alt={step.actionTitle}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
            {/* element_rect 기반 하이라이트 */}
            {step.element_rect && (
              <div style={{
                position: 'absolute',
                top: `${step.element_rect.y * 100}%`,
                left: `${step.element_rect.x * 100}%`,
                width: `${step.element_rect.width * 100}%`,
                height: `${step.element_rect.height * 100}%`,
                boxShadow: `0 0 0 3px ${BRAND_COLORS.primary}, 0 0 0 9999px rgba(0,0,0,0.35)`,
                borderRadius: '4px',
                pointerEvents: 'none',
              }} />
            )}
            {/* click_x/y 클릭 포인트 */}
            {step.click_x != null && step.click_y != null && !step.element_rect && (
              <div style={{
                position: 'absolute',
                left: `${step.click_x}%`,
                top: `${step.click_y}%`,
                transform: 'translate(-50%, -50%)',
                width: '20px', height: '20px',
                borderRadius: '50%',
                background: SDK_PRIMARY_MARK,
                border: `2.5px solid ${BRAND_COLORS.primary}`,
                pointerEvents: 'none',
              }} />
            )}
          </div>
        )}

        {/* SDK 툴팁 (실제 SDK와 동일한 스타일) */}
        <div style={{
          width: '100%',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(17,24,39,.18), 0 0 0 1px rgba(0,0,0,.06)',
          padding: '18px 20px 16px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          position: 'relative',
        }}>
          {/* 닫기 버튼 */}
          <button style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'default', color: '#D1D5DB', padding: '4px', lineHeight: 1 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* 스텝 뱃지 */}
          <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: BRAND_COLORS.primary, background: SDK_PRIMARY_SOFT, padding: '2px 8px', borderRadius: '20px', marginBottom: '8px' }}>
            {current + 1} / {total}
          </div>

          {/* 제목 */}
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '0 0 6px', lineHeight: 1.4 }}>
            {step.actionTitle || <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(제목 없음)</span>}
          </p>

          {/* 설명 */}
          {sanitizedDescription && (
            <div
              style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.6, margin: '0 0 14px' }}
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
          )}

          {/* 진행 dots + 버튼 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {Array.from({ length: shown }, (_, i) => (
                <div
                  key={i}
                  onClick={() => setCurrent(i + offset)}
                  style={{ width: '6px', height: '6px', borderRadius: '50%', background: i + offset === current ? BRAND_COLORS.primary : '#E5E7EB', cursor: 'pointer', transition: 'background 0.2s' }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {!isFirst && (
                <button
                  onClick={() => setCurrent(c => c - 1)}
                  style={secondaryBtnStyle}
                >이전</button>
              )}
              <button
                onClick={() => { if (!isLast) setCurrent(c => c + 1); }}
                style={primaryBtnStyle}
              >
                {isLast ? '완료 ✓' : '다음 →'}
              </button>
            </div>
          </div>
        </div>

        {/* 스텝 네비게이션 힌트 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#9CA3AF' }}>
          <button
            onClick={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={isFirst}
            style={{ ...navBtnStyle, opacity: isFirst ? 0.3 : 1 }}
          >‹ 이전</button>
          <span>{current + 1} / {total}</span>
          <button
            onClick={() => setCurrent(c => Math.min(total - 1, c + 1))}
            disabled={isLast}
            style={{ ...navBtnStyle, opacity: isLast ? 0.3 : 1 }}
          >다음 ›</button>
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: '1px solid #E5E7EB', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BRAND_COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>학습 가이드</span>
        <span style={{ fontSize: '10px', color: '#9CA3AF', background: '#F3F4F6', padding: '1px 6px', borderRadius: '4px' }}>가이드 미리보기</span>
      </div>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '4px', borderRadius: '4px', display: 'grid', placeItems: 'center' }}
        title="미리보기 닫기"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  width: '320px',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  borderLeft: '1px solid #E5E7EB',
  background: 'white',
  minHeight: 0,
};

const primaryBtnStyle: React.CSSProperties = {
  height: '32px', padding: '0 14px', borderRadius: '7px',
  fontSize: '12.5px', fontWeight: 600, border: 'none', cursor: 'pointer',
  background: BRAND_COLORS.primary, color: 'white',
  display: 'inline-flex', alignItems: 'center', gap: '5px',
};

const secondaryBtnStyle: React.CSSProperties = {
  height: '32px', padding: '0 14px', borderRadius: '7px',
  fontSize: '12.5px', fontWeight: 600, border: 'none', cursor: 'pointer',
  background: '#F3F4F6', color: '#374151',
  display: 'inline-flex', alignItems: 'center',
};

const navBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#9CA3AF', fontSize: '11px', padding: '2px 4px',
};
