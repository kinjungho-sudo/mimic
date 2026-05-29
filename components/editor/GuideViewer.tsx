'use client';

import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import type { ManualStep } from './ManualEditor';
import { AnnotationPreview } from './AnnotationPreview';

interface GuideViewerProps {
  steps: ManualStep[];
  activeId: string | null;
  onActiveChange: (id: string) => void;
}

export function GuideViewer({ steps, activeId, onActiveChange }: GuideViewerProps) {
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

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1, overflowY: 'auto',
        background: '#F8F9FA',
        padding: '40px 0 80px',
      }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 40px' }}>
        {steps.map(step => (
          <div
            key={step.id}
            data-step-id={step.id}
            ref={el => { stepRefs.current[step.id] = el; }}
            style={{ marginBottom: '48px', scrollMarginTop: '24px' }}
          >
            <ViewerStepCard step={step} />
          </div>
        ))}

        {steps.length === 0 && (
          <div style={{
            textAlign: 'center', paddingTop: '80px',
            color: '#9CA3AF',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.4 }}>📄</div>
            <div style={{ fontSize: '14px' }}>단계가 없습니다.</div>
            <div style={{ fontSize: '12.5px', marginTop: '4px', opacity: 0.7 }}>우측 상단의 편집 버튼을 눌러 시작하세요.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ViewerStepCard({ step }: { step: ManualStep }) {
  return (
    <div style={{
      background: 'white', borderRadius: '12px',
      border: '1px solid #E5E7EB',
      boxShadow: '0 1px 4px rgba(17,24,39,0.05)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '20px 24px 16px' }}>
        {/* Step badge */}
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
          <h3 style={{
            margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827',
            lineHeight: 1.4,
          }}>
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

      {/* Screenshot */}
      {step.screenshotUrl && (
        <div style={{ margin: '0 24px 24px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E5E7EB', position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={step.screenshotUrl} alt={step.actionTitle} style={{ width: '100%', display: 'block' }} />
          {(step.annotations?.length ?? 0) > 0 && (
            <AnnotationPreview annotations={step.annotations!} imageUrl={step.screenshotUrl} />
          )}
        </div>
      )}
    </div>
  );
}
