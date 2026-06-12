'use client';

import { useState } from 'react';
import DOMPurify from 'dompurify';
import type { ManualStep } from '@/components/editor/ManualEditor';

interface Props {
  steps: ManualStep[];
  initialIdx?: number;
  onClose: () => void;
}

export function FollowAlongOverlay({ steps, initialIdx = 0, onClose }: Props) {
  const [idx, setIdx] = useState(initialIdx);
  const step = steps[idx];
  const total = steps.length;
  const isFirst = idx === 0;
  const isLast = idx === total - 1;

  if (!step) return null;

  const sanitizedDesc = step.description
    ? DOMPurify.sanitize(step.description, { ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'br', 'span'], ALLOWED_ATTR: [] })
    : '';

  const MAX_DOTS = 7;
  const shown = Math.min(total, MAX_DOTS);
  const offset = total > MAX_DOTS ? Math.max(0, Math.min(idx - Math.floor(MAX_DOTS / 2), total - MAX_DOTS)) : 0;

  const cx = step.click_x ?? null;
  const cy = step.click_y ?? null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(5,5,10,0.72)', zIndex: 70, backdropFilter: 'blur(6px)' }}
      />

      {/* Main panel */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 71,
        width: 'min(560px, 94vw)',
        maxHeight: '92vh',
        overflowY: 'auto',
        background: '#F1F2F6',
        borderRadius: '16px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      }}>
        {/* Header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: 'white',
          borderRadius: '16px 16px 0 0',
          borderBottom: '1px solid #E5E7EB',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" /><path d="M12 8v4l3 3" />
            </svg>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>따라하기</span>
            <span style={{ fontSize: '10px', color: '#9CA3AF', background: '#F3F4F6', padding: '1px 6px', borderRadius: '4px' }}>{idx + 1} / {total}</span>
          </div>
          <button
            onClick={onClose}
            style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#F3F4F6', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#6B7280' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px', gap: '12px', overflowY: 'auto' }}>
          {/* Screenshot + hotspot */}
          {step.screenshotUrl && (
            <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.18)', flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={step.screenshotUrl}
                alt={step.actionTitle}
                style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '52vh', objectFit: 'contain', background: '#000' }}
              />
              {/* element_rect 하이라이트 */}
              {step.element_rect && (
                <div style={{
                  position: 'absolute',
                  top: `${step.element_rect.y * 100}%`,
                  left: `${step.element_rect.x * 100}%`,
                  width: `${step.element_rect.width * 100}%`,
                  height: `${step.element_rect.height * 100}%`,
                  boxShadow: '0 0 0 3px #4F46E5, 0 0 0 9999px rgba(0,0,0,0.4)',
                  borderRadius: '3px',
                  pointerEvents: 'none',
                  zIndex: 5,
                }} />
              )}
              {/* click_x/y 파문 */}
              {cx != null && cy != null && !step.element_rect && (
                <div style={{
                  position: 'absolute',
                  left: `${cx}%`,
                  top: `${cy}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '14px', height: '14px',
                  pointerEvents: 'none',
                  zIndex: 5,
                }}>
                  <span style={{ position: 'absolute', top: '50%', left: '50%', width: '10px', height: '10px', marginTop: '-5px', marginLeft: '-5px', borderRadius: '50%', background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 8px rgba(255,255,255,0.7), 0 0 14px rgba(99,102,241,0.5)', animation: 'followDotPulse 1.8s ease-in-out infinite' }} />
                  <span style={{ position: 'absolute', top: '50%', left: '50%', width: '10px', height: '10px', marginTop: '-5px', marginLeft: '-5px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.75)', animation: 'followRipple 2s ease-out infinite' }} />
                  <span style={{ position: 'absolute', top: '50%', left: '50%', width: '10px', height: '10px', marginTop: '-5px', marginLeft: '-5px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.5)', animation: 'followRipple 2s ease-out infinite', animationDelay: '0.65s' }} />
                  <span style={{ position: 'absolute', top: '50%', left: '50%', width: '10px', height: '10px', marginTop: '-5px', marginLeft: '-5px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.3)', animation: 'followRipple 2s ease-out infinite', animationDelay: '1.3s' }} />
                </div>
              )}
            </div>
          )}

          {/* Tooltip card */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(17,24,39,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
            padding: '16px 18px 14px',
            flexShrink: 0,
          }}>
            {/* 닫기 버튼 (장식용) */}
            <button style={{ position: 'absolute' as const, display: 'none' }} aria-hidden />

            {/* 스텝 뱃지 */}
            <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#4F46E5', background: 'rgba(79,70,229,0.1)', padding: '2px 8px', borderRadius: '20px', marginBottom: '8px' }}>
              {idx + 1} / {total}
            </div>

            {/* 제목 */}
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '0 0 6px', lineHeight: 1.4 }}>
              {step.actionTitle || <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(제목 없음)</span>}
            </p>

            {/* 설명 */}
            {sanitizedDesc && (
              <div
                style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.6, margin: '0 0 14px' }}
                dangerouslySetInnerHTML={{ __html: sanitizedDesc }}
              />
            )}

            {/* dots + 버튼 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {Array.from({ length: shown }, (_, i) => (
                  <div
                    key={i}
                    onClick={() => setIdx(i + offset)}
                    style={{ width: '6px', height: '6px', borderRadius: '50%', background: i + offset === idx ? '#4F46E5' : '#E5E7EB', cursor: 'pointer', transition: 'background 0.2s' }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {!isFirst && (
                  <button
                    onClick={() => setIdx(i => i - 1)}
                    style={{ height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, border: 'none', cursor: 'pointer', background: '#F3F4F6', color: '#374151' }}
                  >이전</button>
                )}
                <button
                  onClick={() => { if (!isLast) setIdx(i => i + 1); else onClose(); }}
                  style={{ height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, border: 'none', cursor: 'pointer', background: '#4F46E5', color: 'white' }}
                >
                  {isLast ? '완료 ✓' : '다음 →'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 키보드 힌트 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          padding: '8px 14px 10px',
          fontSize: '11px', color: '#9CA3AF',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={isFirst}
            style={{ background: 'none', border: 'none', cursor: isFirst ? 'default' : 'pointer', color: isFirst ? '#D1D5DB' : '#9CA3AF', fontSize: '11px', padding: '2px 4px' }}
          >‹ 이전</button>
          <span>{idx + 1} / {total}</span>
          <button
            onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
            disabled={isLast}
            style={{ background: 'none', border: 'none', cursor: isLast ? 'default' : 'pointer', color: isLast ? '#D1D5DB' : '#9CA3AF', fontSize: '11px', padding: '2px 4px' }}
          >다음 ›</button>
        </div>
      </div>

      <style>{`
        @keyframes followRipple {
          0%   { opacity: 0.85; transform: scale(1); }
          100% { opacity: 0;    transform: scale(7); }
        }
        @keyframes followDotPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}
