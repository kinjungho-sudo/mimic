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

  // When activeId changes from TOC click → scroll into view
  useEffect(() => {
    if (!activeId) return;
    stepRefs.current[activeId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeId]);

  // Intersection observer to track which step is in view
  useEffect(() => {
    const els = Object.entries(stepRefs.current).filter(([, el]) => el);
    if (els.length === 0) return;

    const obs = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length === 0) return;
        // pick the topmost visible
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
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 32px' }}>
          {steps.map(step => (
            <div
              key={step.id}
              data-step-id={step.id}
              ref={el => { stepRefs.current[step.id] = el; }}
              style={{ marginBottom: '48px', scrollMarginTop: '24px' }}
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

  return (
    <div style={{
      background: 'white', borderRadius: '12px',
      border: '1px solid #E5E7EB',
      boxShadow: '0 1px 4px rgba(17,24,39,0.05)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '20px 24px 16px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: '#F59E0B', color: 'white',
          fontSize: '13px', fontWeight: 700,
          display: 'grid', placeItems: 'center',
          flexShrink: 0,
        }}>
          {String(step.number).padStart(2, '0')}
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>
            {step.actionTitle || <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(제목 없음)</span>}
          </h3>
          {step.description && (
            <div
              style={{ marginTop: '8px', fontSize: '13.5px', color: '#4B5563', lineHeight: 1.65 }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(step.description, { USE_PROFILES: { html: true } }) }}
            />
          )}
        </div>
      </div>

      {/* Screenshot — 고정 비율 컨테이너 */}
      {step.screenshotUrl && (
        <div style={{ margin: '0 24px 24px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
          <div style={{ position: 'relative', paddingTop, background: '#F3F4F6' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={step.screenshotUrl}
              alt={step.actionTitle}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
            {(step.annotations?.length ?? 0) > 0 && (
              <AnnotationPreview annotations={step.annotations!} imageUrl={step.screenshotUrl} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
