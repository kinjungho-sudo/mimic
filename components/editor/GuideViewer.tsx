'use client';

import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import type { ManualStep } from './ManualEditor';
import { AnnotationPreview } from './AnnotationPreview';

type OutputRatio = '16:9' | '1:1' | '9:16';

// 비율 → padding-top % (height/width * 100)
const RATIO_PADDING: Record<OutputRatio, string> = {
  '16:9': '56.25%',
  '1:1':  '100%',
  '9:16': '177.78%',
};

interface GuideViewerProps {
  steps: ManualStep[];
  activeId: string | null;
  onActiveChange: (id: string) => void;
  outputRatio?: OutputRatio;
}

export function GuideViewer({ steps, activeId, onActiveChange, outputRatio = '16:9' }: GuideViewerProps) {
  const stepRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  // Prevents IntersectionObserver from overwriting activeId during programmatic scroll
  const isScrollingRef = useRef(false);

  // When activeId changes from TOC click → scroll into view, suppress observer briefly
  useEffect(() => {
    if (!activeId) return;
    const el = stepRefs.current[activeId];
    if (!el) return;
    isScrollingRef.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const timer = setTimeout(() => { isScrollingRef.current = false; }, 800);
    return () => clearTimeout(timer);
  }, [activeId]);

  // Intersection observer to sync TOC highlight while user scrolls manually
  useEffect(() => {
    const els = Object.entries(stepRefs.current).filter(([, el]) => el);
    if (els.length === 0) return;

    const obs = new IntersectionObserver(
      entries => {
        if (isScrollingRef.current) return;
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const id = (visible[0].target as HTMLElement).dataset.stepId;
        if (id) onActiveChange(id);
      },
      { threshold: 0.3, root: scrollRef.current }
    );

    els.forEach(([, el]) => obs.observe(el!));
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  const scrollToTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToBottom = () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto',
          background: '#F8F9FA',
          padding: '40px 0 80px',
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px' }}>
          {steps.map(step => (
            <div
              key={step.id}
              data-step-id={step.id}
              ref={el => { stepRefs.current[step.id] = el; }}
              style={{ marginBottom: '28px', scrollMarginTop: '20px' }}
            >
              <ViewerStepCard step={step} outputRatio={outputRatio} />
            </div>
          ))}

          {steps.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: '80px', color: '#9CA3AF' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.4 }}>📄</div>
              <div style={{ fontSize: '14px' }}>단계가 없습니다.</div>
              <div style={{ fontSize: '12.5px', marginTop: '4px', opacity: 0.7 }}>우측 상단의 편집 버튼을 눌러 시작하세요.</div>
            </div>
          )}
        </div>
      </div>

      {/* 맨위 / 맨아래 플로팅 버튼 */}
      <div style={{
        position: 'absolute', bottom: '24px', right: '24px',
        display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 10,
      }}>
        <button
          onClick={scrollToTop}
          title="맨 위로"
          style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'white', border: '1px solid #E5E7EB',
            boxShadow: '0 2px 8px rgba(17,24,39,0.10)',
            display: 'grid', placeItems: 'center', cursor: 'pointer',
            color: '#6B7280', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#111827'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#6B7280'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <button
          onClick={scrollToBottom}
          title="맨 아래로"
          style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'white', border: '1px solid #E5E7EB',
            boxShadow: '0 2px 8px rgba(17,24,39,0.10)',
            display: 'grid', placeItems: 'center', cursor: 'pointer',
            color: '#6B7280', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#111827'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#6B7280'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>
    </div>
  );
}

function ViewerStepCard({ step, outputRatio }: { step: ManualStep; outputRatio: OutputRatio }) {
  const paddingTop = RATIO_PADDING[outputRatio];
  const hasImage = !!step.screenshotUrl;

  return (
    <div style={{
      background: 'white', borderRadius: '12px',
      border: '1px solid #E5E7EB',
      boxShadow: '0 1px 6px rgba(17,24,39,0.06)',
      overflow: 'hidden',
    }}>
      {/* Screenshot — 상단 전체 너비, padding 없음 */}
      {hasImage && (
        <div style={{ position: 'relative', paddingTop, background: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={step.screenshotUrl}
            alt={step.actionTitle}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'fill',
              display: 'block',
            }}
          />
          {(step.annotations?.length ?? 0) > 0 && (
            <AnnotationPreview annotations={step.annotations!} imageUrl={step.screenshotUrl!} />
          )}
          {/* 스텝 번호 배지 — 이미지 위 좌상단 */}
          <div style={{
            position: 'absolute', top: '12px', left: '12px',
            width: '28px', height: '28px', borderRadius: '50%',
            background: '#F59E0B', color: 'white',
            fontSize: '12px', fontWeight: 700,
            display: 'grid', placeItems: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          }}>
            {String(step.number).padStart(2, '0')}
          </div>
        </div>
      )}

      {/* 제목 + 설명 — 이미지 아래 */}
      <div style={{ padding: hasImage ? '16px 20px 18px' : '20px 20px 18px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* 이미지 없을 때만 번호 배지를 텍스트 옆에 표시 */}
        {!hasImage && (
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
            background: '#F59E0B', color: 'white',
            fontSize: '13px', fontWeight: 700,
            display: 'grid', placeItems: 'center', marginTop: '1px',
          }}>
            {String(step.number).padStart(2, '0')}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#111827', lineHeight: 1.45 }}>
            {step.actionTitle || <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(제목 없음)</span>}
          </h3>
          {step.description && (
            <div
              style={{ marginTop: '6px', fontSize: '13.5px', color: '#4B5563', lineHeight: 1.65 }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(step.description, { USE_PROFILES: { html: true } }) }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
