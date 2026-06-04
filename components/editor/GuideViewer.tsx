'use client';

import { useState } from 'react';
import DOMPurify from 'dompurify';
import type { ManualStep } from './ManualEditor';
import { AnnotationPreview } from './AnnotationPreview';

type OutputRatio = '16:9' | '1:1' | '9:16';

interface GuideViewerProps {
  steps: ManualStep[];
  activeId: string | null;
  onActiveChange: (id: string) => void;
  outputRatio?: OutputRatio;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function GuideViewer({ steps, activeId, onActiveChange, outputRatio = '16:9' }: GuideViewerProps) {
  const currentIdx = steps.findIndex(s => s.id === activeId);
  const idx = currentIdx >= 0 ? currentIdx : 0;
  const step = steps[idx] ?? null;

  const goTo = (newIdx: number) => {
    if (newIdx < 0 || newIdx >= steps.length) return;
    onActiveChange(steps[newIdx].id);
  };

  if (!step) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F9FA', color: '#9CA3AF' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.4 }}>📄</div>
          <div style={{ fontSize: '14px' }}>단계가 없습니다.</div>
          <div style={{ fontSize: '12.5px', marginTop: '4px', opacity: 0.7 }}>우측 상단의 편집 버튼을 눌러 시작하세요.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#F8F9FA' }}>
      {/* ── 슬라이드 영역 — 세로 중앙 정렬 ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
        <div style={{ width: '100%', maxWidth: '860px' }}>
          <ViewerStepCard step={step} />
        </div>
      </div>

      {/* ── 하단 네비게이션 ── */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px',
        borderTop: '1px solid #E5E7EB',
        background: 'white',
        gap: '12px',
      }}>
        {/* 이전 */}
        <button
          onClick={() => goTo(idx - 1)}
          disabled={idx === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '8px', border: '1px solid #E5E7EB', background: idx === 0 ? '#F9FAFB' : 'white', color: idx === 0 ? '#D1D5DB' : '#374151', fontSize: '12.5px', fontWeight: 500, cursor: idx === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { if (idx > 0) e.currentTarget.style.background = '#F3F4F6'; }}
          onMouseLeave={e => { e.currentTarget.style.background = idx === 0 ? '#F9FAFB' : 'white'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          이전
        </button>

        {/* 페이지 + 점 인디케이터 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'center' }}>
          <span style={{ fontSize: '12px', color: '#6B7280', whiteSpace: 'nowrap', fontWeight: 500 }}>
            <span style={{ color: '#111827', fontWeight: 700 }}>{idx + 1}</span>
            <span style={{ color: '#D1D5DB', margin: '0 3px' }}>/</span>
            {steps.length}
          </span>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {steps.length <= 15
              ? steps.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => goTo(i)}
                    title={s.actionTitle || `${i + 1}단계`}
                    style={{ width: i === idx ? '20px' : '7px', height: '7px', borderRadius: '999px', border: 'none', background: i === idx ? '#3730a3' : '#D1D5DB', cursor: 'pointer', padding: 0, transition: 'all 0.2s ease', flexShrink: 0 }}
                  />
                ))
              : <>
                  {[0, 1, 2].map(i => (
                    <button key={i} onClick={() => goTo(i)} style={{ width: i === idx ? '20px' : '7px', height: '7px', borderRadius: '999px', border: 'none', background: i === idx ? '#3730a3' : '#D1D5DB', cursor: 'pointer', padding: 0, transition: 'all 0.2s ease' }} />
                  ))}
                  {idx > 2 && idx < steps.length - 3 && (
                    <button style={{ width: '20px', height: '7px', borderRadius: '999px', border: 'none', background: '#3730a3', cursor: 'default', padding: 0 }} />
                  )}
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>…</span>
                  {[steps.length - 3, steps.length - 2, steps.length - 1].filter(i => i > 2).map(i => (
                    <button key={i} onClick={() => goTo(i)} style={{ width: i === idx ? '20px' : '7px', height: '7px', borderRadius: '999px', border: 'none', background: i === idx ? '#3730a3' : '#D1D5DB', cursor: 'pointer', padding: 0, transition: 'all 0.2s ease' }} />
                  ))}
                </>
            }
          </div>
        </div>

        {/* 다음 */}
        <button
          onClick={() => goTo(idx + 1)}
          disabled={idx === steps.length - 1}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '8px', border: 'none', background: idx === steps.length - 1 ? '#F3F4F6' : 'linear-gradient(135deg,#3730a3 0%,#6d28d9 100%)', color: idx === steps.length - 1 ? '#D1D5DB' : 'white', fontSize: '12.5px', fontWeight: 600, cursor: idx === steps.length - 1 ? 'not-allowed' : 'pointer', transition: 'all 0.15s', boxShadow: idx === steps.length - 1 ? 'none' : '0 2px 8px rgba(55,48,163,0.3)' }}
          onMouseEnter={e => { if (idx < steps.length - 1) e.currentTarget.style.boxShadow = '0 4px 14px rgba(55,48,163,0.45)'; }}
          onMouseLeave={e => { if (idx < steps.length - 1) e.currentTarget.style.boxShadow = '0 2px 8px rgba(55,48,163,0.3)'; }}
        >
          다음
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  );
}

function DomainSectionHeader({ hostname, name, favicon }: { hostname: string; name: string | null; favicon: string | null }) {
  const [faviconOk, setFaviconOk] = useState(true);
  const faviconSrc = favicon || `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  const displayName = name || hostname;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '7px 14px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: '0 1px 3px rgba(17,24,39,0.05)' }}>
      {faviconOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={faviconSrc} alt="" width={14} height={14} style={{ flexShrink: 0 }} onError={() => setFaviconOk(false)} />
      )}
      <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#374151' }}>{displayName}</span>
      <span style={{ fontSize: '10.5px', color: '#9CA3AF' }}>{hostname}</span>
    </div>
  );
}

// DomainSectionHeader는 현재 슬라이드 방식에서 미사용이나 export 유지
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _DomainSectionHeader = DomainSectionHeader;

function ViewerStepCard({ step }: { step: ManualStep }) {
  const hasImage = !!step.screenshotUrl;
  const zoom = step.imageZoom ?? 1;

  return (
    <div style={{
      background: 'white', borderRadius: '12px',
      border: '1px solid #E5E7EB',
      boxShadow: '0 2px 12px rgba(17,24,39,0.08)',
      overflow: 'hidden',
    }}>
      {/* 번호 + 제목 + 설명 */}
      <div style={{ padding: '16px 20px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px', borderBottom: hasImage ? '1px solid #F3F4F6' : 'none' }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
          background: '#F59E0B', color: 'white',
          fontSize: '11px', fontWeight: 700,
          display: 'grid', placeItems: 'center', marginTop: '1px',
        }}>
          {String(step.number).padStart(2, '0')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827', lineHeight: 1.45 }}>
            {step.actionTitle || <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(제목 없음)</span>}
          </h3>
          {step.description && (
            <div
              style={{ marginTop: '4px', fontSize: '12.5px', color: '#4B5563', lineHeight: 1.65 }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(step.description, { USE_PROFILES: { html: true } }) }}
            />
          )}
        </div>
      </div>

      {/* 이미지 — 최대 높이 제한 없이 자연스럽게, 단 뷰포트 넘지 않게 */}
      {hasImage && (
        <div style={{ position: 'relative', background: '#F3F4F6', overflow: 'hidden' }}>
          <div style={{
            position: 'relative',
            transform: zoom > 1 ? `scale(${zoom})` : undefined,
            transformOrigin: 'center top',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={step.screenshotUrl}
              alt={step.actionTitle}
              draggable={false}
              style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', maxHeight: 'calc(100vh - 240px)', objectFit: 'contain' }}
            />
            {(step.annotations?.length ?? 0) > 0 && (
              <AnnotationPreview annotations={step.annotations!} imageUrl={step.screenshotUrl!} />
            )}
          </div>
          {zoom > 1 && (
            <div style={{ position: 'absolute', bottom: '8px', right: '8px', fontSize: '10px', fontWeight: 600, color: 'white', background: 'rgba(20,20,30,0.6)', backdropFilter: 'blur(6px)', padding: '2px 7px', borderRadius: '5px', pointerEvents: 'none' }}>
              {Math.round(zoom * 100)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}
