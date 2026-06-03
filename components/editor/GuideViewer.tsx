'use client';

import { useEffect, useRef, useState } from 'react'; // useRef/useState used in DomainSectionHeader + scrolling
import DOMPurify from 'dompurify';
import type { ManualStep } from './ManualEditor';
import { AnnotationPreview } from './AnnotationPreview';

type OutputRatio = '16:9' | '1:1' | '9:16';

// 비율 → padding-top % — 현재 미사용 (원본 비율 유지 방식으로 변경)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    const timer = setTimeout(() => { isScrollingRef.current = false; }, 500);
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
          padding: '20px 0 60px',
        }}
      >
        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 20px' }}>
          {steps.map((step, idx) => {
            const prevDomain = idx > 0 ? steps[idx - 1].domain_name : null;
            const showDomainHeader = !!step.domain_name && step.domain_name !== prevDomain;
            return (
              <div key={step.id}>
                {showDomainHeader && (
                  <DomainSectionHeader name={step.domain_name!} favicon={step.domain_favicon ?? null} />
                )}
                <div
                  data-step-id={step.id}
                  ref={el => { stepRefs.current[step.id] = el; }}
                  style={{ marginBottom: '14px', scrollMarginTop: '16px' }}
                >
                  <ViewerStepCard step={step} />
                </div>
              </div>
            );
          })}

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

function DomainSectionHeader({ name, favicon }: { name: string; favicon: string | null }) {
  const [faviconOk, setFaviconOk] = useState(true);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      margin: '8px 0 12px',
      padding: '6px 12px',
      background: 'white',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(17,24,39,0.05)',
    }}>
      {favicon && faviconOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={favicon}
          alt=""
          width={14}
          height={14}
          style={{ flexShrink: 0 }}
          onError={() => setFaviconOk(false)}
        />
      )}
      <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#6B7280', letterSpacing: '0.02em' }}>
        {name}
      </span>
    </div>
  );
}

function ViewerStepCard({ step }: { step: ManualStep }) {
  const hasImage = !!step.screenshotUrl;
  // 편집기에서 저장한 배율 고정 적용 (1이면 원본)
  const zoom = step.imageZoom ?? 1;

  return (
    <div style={{
      background: 'white', borderRadius: '10px',
      border: '1px solid #E5E7EB',
      boxShadow: '0 1px 4px rgba(17,24,39,0.05)',
      overflow: 'hidden',
    }}>
      {/* 번호 + 제목 */}
      <div style={{ padding: '10px 16px 8px', display: 'flex', alignItems: 'flex-start', gap: '8px', borderBottom: hasImage ? '1px solid #F3F4F6' : 'none' }}>
        <div style={{
          width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
          background: '#F59E0B', color: 'white',
          fontSize: '11px', fontWeight: 700,
          display: 'grid', placeItems: 'center', marginTop: '1px',
        }}>
          {String(step.number).padStart(2, '0')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>
            {step.actionTitle || <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(제목 없음)</span>}
          </h3>
          {step.description && (
            <div
              style={{ marginTop: '3px', fontSize: '12px', color: '#4B5563', lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(step.description, { USE_PROFILES: { html: true } }) }}
            />
          )}
        </div>
      </div>

      {/* Screenshot — 편집기에서 저장한 zoom 고정 표시, 최대 높이 제한 */}
      {hasImage && (
        <div style={{ position: 'relative', background: '#F3F4F6', overflow: 'hidden', maxHeight: '55vh' }}>
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
              style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}
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
