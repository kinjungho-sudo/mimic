'use client';

import { useEffect, useRef, useState } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isScrollingProg = useRef(false); // 프로그래밍 스크롤 중 observer 무시

  // TOC 클릭 → 해당 스텝으로 스크롤
  useEffect(() => {
    if (!activeId) return;
    const el = stepRefs.current[activeId];
    if (!el) return;
    isScrollingProg.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => { isScrollingProg.current = false; }, 600);
  }, [activeId]);

  // IntersectionObserver — 스냅 후 보이는 스텝을 TOC에 반영
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const els = Object.entries(stepRefs.current).filter(([, el]) => el);
    if (!els.length) return;

    const obs = new IntersectionObserver(
      entries => {
        if (isScrollingProg.current) return;
        const visible = entries.filter(e => e.intersectionRatio >= 0.5);
        if (!visible.length) return;
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const id = (visible[0].target as HTMLElement).dataset.stepId;
        if (id) onActiveChange(id);
      },
      { threshold: 0.5, root: container }
    );
    els.forEach(([, el]) => obs.observe(el!));
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  if (!steps.length) {
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
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        background: '#F8F9FA',
      }}
    >
      {steps.map(step => (
        <div
          key={step.id}
          data-step-id={step.id}
          ref={el => { stepRefs.current[step.id] = el; }}
          style={{
            scrollSnapAlign: 'start',
            // 각 스텝이 뷰포트 전체 높이를 차지해서 딱 한 장씩 보임
            minHeight: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 20px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ width: '100%', maxWidth: '1000px' }}>
            <ViewerStepCard step={step} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ViewerStepCard({ step }: { step: ManualStep }) {
  const hasImage = !!step.screenshotUrl;
  const zoom = step.imageZoom ?? 1;
  const offX = step.imageOffsetX ?? 0;
  const offY = step.imageOffsetY ?? 0;
  const cr = step.crop_rect;
  const hasCrop = !!cr && cr.w > 0 && cr.w < 0.99;
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natH2W, setNatH2W] = useState<number | null>(null);

  // crop_rect CSS clip: 1/w 배율로 이미지 확대 + x/y offset으로 원하는 영역만 표시
  const imgScale = hasCrop ? 1 / cr!.w : 1;
  const imgMarginLeft = hasCrop ? `-${(cr!.x / cr!.w) * 100}%` : undefined;
  const imgMarginTop = hasCrop && natH2W !== null
    ? `-${cr!.y * imgScale * natH2W * 100}%`
    : undefined;

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
          <h3 style={{ margin: 0, fontSize: `${step.titleFontSize ?? 20}px`, fontWeight: 600, color: '#111827', lineHeight: 1.45 }}>
            {step.actionTitle || <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(제목 없음)</span>}
          </h3>
          {step.description && (
            <div
              style={{ marginTop: '4px', fontSize: '16px', color: '#4B5563', lineHeight: 1.65 }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(step.description, { USE_PROFILES: { html: true } }) }}
            />
          )}
        </div>
      </div>

      {/* 이미지 */}
      {hasImage && (
        <div style={{ position: 'relative', background: '#F3F4F6', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            position: 'relative',
            transform: !hasCrop && zoom > 1
              ? `translate(${offX * 100}%, ${offY * 100}%) scale(${zoom})`
              : undefined,
            transformOrigin: 'center center',
            overflow: 'hidden',
          }}>
            {/* img 박스가 실제 콘텐츠와 정확히 일치해야 어노테이션 오버레이 좌표가 맞음 (letterbox 금지) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={step.screenshotUrl}
              alt={step.actionTitle}
              draggable={false}
              onLoad={e => {
                const img = e.currentTarget;
                if (natH2W === null && img.naturalWidth > 0)
                  setNatH2W(img.naturalHeight / img.naturalWidth);
              }}
              style={{
                width: hasCrop ? `${imgScale * 100}%` : 'auto',
                maxWidth: hasCrop ? 'none' : '100%',
                height: 'auto',
                display: 'block',
                userSelect: 'none',
                maxHeight: hasCrop ? 'none' : 'calc(100vh - 320px)',
                marginLeft: imgMarginLeft,
                marginTop: imgMarginTop,
              }}
            />
          </div>
          {/* SVG overlay: crop wrapper 밖에 배치 — overflow:hidden 영향 없이 어노테이션 표시 */}
          {(step.annotations?.length ?? 0) > 0 && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <AnnotationPreview
                annotations={step.annotations!}
                imageUrl={step.screenshotUrl!}
                imgRef={imgRef}
                cropRect={hasCrop ? cr! : undefined}
                sizeScale={hasCrop ? cr!.w : (zoom > 1 ? 1 / zoom : 1)}
              />
            </div>
          )}
          {!hasCrop && zoom > 1 && (
            <div style={{ position: 'absolute', bottom: '8px', right: '8px', fontSize: '10px', fontWeight: 600, color: 'white', background: 'rgba(20,20,30,0.6)', backdropFilter: 'blur(6px)', padding: '2px 7px', borderRadius: '5px', pointerEvents: 'none' }}>
              {Math.round(zoom * 100)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// DomainSectionHeader — GuideToc에서도 동일 로직 사용 중이므로 유지
export function DomainSectionHeader({ hostname, name, favicon }: { hostname: string; name: string | null; favicon: string | null }) {
  const [faviconOk, setFaviconOk] = useState(true);
  const faviconSrc = favicon || `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  const displayName = name || hostname;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '7px 14px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
      {faviconOk && <img src={faviconSrc} alt="" width={14} height={14} style={{ flexShrink: 0 }} onError={() => setFaviconOk(false)} />}
      <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#374151' }}>{displayName}</span>
      <span style={{ fontSize: '10.5px', color: '#9CA3AF' }}>{hostname}</span>
    </div>
  );
}
