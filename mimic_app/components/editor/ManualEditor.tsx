'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, ZoomIn, X,
  Bold, Italic, Underline, ExternalLink, Sparkles, Loader2,
  Check, Mic, Play, Pause, MessageSquare, Type, Copy,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { ImageAnnotationEditor, type Annotation } from './ImageAnnotationEditor';
import { AnnotationPreview } from './AnnotationPreview';
import { buildClickHighlight } from '@/lib/annotations';
import { pixelateRegion, type BlurRegion } from '@/lib/pixelate';
import { faviconUrl, faviconFallbackUrl, hostnameToServiceName } from '@/lib/favicon';
import { hasGuideConfig } from '@/lib/follow';
import { annotationsBox, fitFramingToBox } from '@/lib/framing';
import type { FollowConfig } from '@/types';

export interface ManualStep {
  id: string;
  number: number;
  actionTitle: string;
  titleFontSize?: number | null;  // 제목 글자 크기(px). null=기본 18px
  followConfig?: FollowConfig | null;  // 라이브 가이드 설정(kind/typeText 등) — 편집기·스튜디오 공유
  description: string;       // stored as HTML string
  screenshotUrl?: string;
  // 영구 블러 적용 전 원본 URL (있으면 '되돌리기' 가능)
  originalScreenshotUrl?: string | null;
  annotations?: Annotation[];
  pageUrl?:        string | null;
  domainHostname?: string | null;
  domainName?:     string | null;
  domainFavicon?:  string | null;
  // legacy snake_case kept for existing editor domain header logic
  domain_name?: string | null;
  domain_favicon?: string | null;
  click_x?: number | null;   // 0-100 pct
  click_y?: number | null;
  element_rect?: { x: number; y: number; width: number; height: number } | null; // 0-1 normalized
  is_stale?: boolean;
  pii_detected?: boolean;
  crop_rect?: { x: number; y: number; w: number; h: number } | null;
  imageZoom?: number;
  // 팬 오프셋 — 이미지 크기 대비 translate 비율 (0 = 중앙)
  imageOffsetX?: number;
  imageOffsetY?: number;
  // 음성 전사 — 원본(다듬기 전) 토글 + 구간 재생
  voiceTranscriptRaw?: string | null;
  voiceAudioUrl?: string | null;
  voiceAudioStartMs?: number | null;
  voiceAudioEndMs?: number | null;
  type_text?: string | null;
}

interface ManualEditorProps {
  steps: ManualStep[];
  onChange: (steps: ManualStep[]) => void;
  onSave?: (id: string, patch: Partial<ManualStep>) => void;
  onDeleteStep?: (id: string) => void;
  onDuplicateStep?: (id: string) => void;
  duplicatingStepId?: string | null;
  onInsertAfter?: (afterId: string) => void;
  onAddStep?: () => void;
  hideToc?: boolean;
  activeId?: string | null;
  onActiveChange?: (id: string) => void;
  selectedIds?: Set<string>;
  onSelectChange?: (ids: Set<string>) => void;
  onAddComment?: (stepId: string) => void;
}

// ── ManualEditor ──────────────────────────────────────────

export function ManualEditor({ steps, onChange, onSave, onDeleteStep, onDuplicateStep, duplicatingStepId, onInsertAfter, onAddStep, hideToc, activeId: externalActiveId, onActiveChange, selectedIds: externalSelectedIds, onSelectChange, onAddComment }: ManualEditorProps) {
  const [internalActiveId, setInternalActiveId] = useState<string | null>(
    steps.length > 0 ? steps[0].id : null
  );
  const activeId = hideToc ? (externalActiveId ?? internalActiveId) : internalActiveId;
  const setActiveId = setInternalActiveId;
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [insertHoverId, setInsertHoverId] = useState<string | null>(null);
  const [annotatingId, setAnnotatingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const selectedIds = externalSelectedIds ?? internalSelectedIds;
  const setSelectedIds = (nextOrUpdater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(selectedIds) : nextOrUpdater;
    setInternalSelectedIds(next);
    onSelectChange?.(next);
  };
  const [bulkAiLoading, setBulkAiLoading] = useState<string | null>(null);
  const [bulkAiError, setBulkAiError] = useState<string | null>(null);
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const tempIdCounter = useRef(0);
  // TOC 클릭으로 스크롤 중일 때 IntersectionObserver 역방향 업데이트 억제
  const scrollingByClickRef = useRef(false);

  useEffect(() => {
    if (!internalActiveId && steps.length > 0) setActiveId(steps[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  // When parent TOC drives navigation, scroll to the step
  useEffect(() => {
    if (!hideToc || !externalActiveId) return;
    scrollingByClickRef.current = true;
    contentRefs.current[externalActiveId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // smooth scroll 애니메이션이 끝날 때까지 observer 억제 (약 600ms)
    const t = setTimeout(() => { scrollingByClickRef.current = false; }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalActiveId]);

  // IntersectionObserver — 스크롤로 뷰에 들어온 스텝을 activeId로 반영
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingByClickRef.current) return;
        // 가장 많이 보이는(intersectionRatio가 높은) 스텝을 active로 설정
        let bestId: string | null = null;
        let bestRatio = 0;
        entries.forEach(entry => {
          const id = (entry.target as HTMLElement).dataset.stepId;
          if (!id) return;
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestId = id;
          }
        });
        if (bestId && bestRatio > 0.3) {
          setActiveId(bestId);
          onActiveChange?.(bestId);
        }
      },
      { root: container, threshold: [0.3, 0.6, 0.9] }
    );
    Object.values(contentRefs.current).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  // steps 개수뿐 아니라 순서/교체까지 반영해 재구독 (id 시그니처)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.map(s => s.id).join(','), onActiveChange]);

  const updateStep = (id: string, patch: Partial<ManualStep>) =>
    onChange(steps.map(s => s.id === id ? { ...s, ...patch } : s));

  const autoHydratedAnnotationIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const hydrated = new Map<string, Annotation[]>();
    for (const step of steps) {
      if (autoHydratedAnnotationIds.current.has(step.id)) continue;
      if ((step.annotations?.length ?? 0) > 0 && !shouldRefreshAutoAnnotations(step)) continue;
      const annotations = buildInputAnnotation(step);
      if (annotations.length > 0) hydrated.set(step.id, annotations);
    }
    if (hydrated.size === 0) return;

    hydrated.forEach((_, stepId) => autoHydratedAnnotationIds.current.add(stepId));
    onChange(steps.map(s => {
      const annotations = hydrated.get(s.id);
      return annotations ? { ...s, annotations } : s;
    }));
    hydrated.forEach((annotations, stepId) => onSave?.(stepId, { annotations }));
  }, [steps, onChange, onSave]);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // 삭제 확인 모달이 열린 채 해당 스텝이 외부에서 제거되면 모달을 닫는다
  useEffect(() => {
    if (pendingDeleteId && !steps.some(s => s.id === pendingDeleteId)) setPendingDeleteId(null);
  }, [steps, pendingDeleteId]);

  const performDelete = (id: string) => {
    const next = steps.filter(s => s.id !== id).map((s, i) => ({ ...s, number: i + 1 }));
    onChange(next);
    onDeleteStep?.(id);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    setPendingDeleteId(null);
  };

  const deleteStep = (id: string) => setPendingDeleteId(id);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const selectAll = () => setSelectedIds(new Set(steps.map(s => s.id)));
  const clearSelection = () => setSelectedIds(new Set());

  // 비동기(AI 재작성 등) 완료 시점에 최신 steps를 읽기 위한 ref — 진행 중 다른 스텝 편집을 덮어쓰지 않도록
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const bulkAiRewrite = async (instruction: string, label: string) => {
    // 전체 스텝을 순서대로 보내되, 선택된 것만 실제로 교체
    const allWithText = steps
      .filter(s => !s.id.startsWith('step-'))
      .map(s => ({
        id: s.id,
        text: s.description.replace(/<[^>]+>/g, '').trim(),
      }));
    const targets = allWithText.filter(s => selectedIds.has(s.id) && s.text);
    if (!targets.length) return;
    setBulkAiLoading(label);
    setBulkAiError(null);
    try {
      const res = await fetch('/api/ai/rewrite-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: allWithText, instruction }),
      });
      if (!res.ok) {
        setBulkAiError('AI 재작성에 실패했어요. 잠시 후 다시 시도해주세요.');
        return;
      }
      const { results } = await res.json();
      if (!Array.isArray(results)) return;
      // 선택된 스텝만 업데이트
      const updated = new Map(
        results
          .filter((r: { id: string; result: string }) => selectedIds.has(r.id) && r.result)
          .map((r: { id: string; result: string }) => [r.id, r.result])
      );
      const next = stepsRef.current.map(s => updated.has(s.id) ? { ...s, description: updated.get(s.id)! } : s);
      onChange(next);
      next.filter(s => updated.has(s.id)).forEach(s => onSave?.(s.id, { description: s.description }));
    } finally {
      setBulkAiLoading(null);
    }
  };

  const addStep = () => {
    const newStep: ManualStep = {
      id: `step-tmp-${++tempIdCounter.current}`,
      number: steps.length + 1,
      actionTitle: '새 단계',
      description: '',
    };
    onChange([...steps, newStep]);
    setActiveId(newStep.id);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const scrollToStep = (id: string) => {
    setActiveId(id);
    contentRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id); };
  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) { setDraggingId(null); setDragOverId(null); return; }
    const fromIdx = steps.findIndex(s => s.id === draggingId);
    const toIdx = steps.findIndex(s => s.id === targetId);
    const next = [...steps];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onChange(next.map((s, i) => ({ ...s, number: i + 1 })));
    setActiveId(draggingId);
    setDraggingId(null); setDragOverId(null);
  };

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
      {/* ── Left TOC (shown only when hideToc is false) ── */}
      {!hideToc && (
        <aside style={{ width: '224px', flexShrink: 0, background: 'white', borderRight: '2px solid #E5E7EB', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '2px 0 6px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 16px 10px', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
            목차
          </div>
          <div style={{ flex: 1, padding: '8px 0' }}>
            {(() => {
              // 전역 hostname → 첫 등장 index 매핑 (A→B→A = 2그룹이 아닌 동일 그룹)
              const hostnameFirstIdx = new Map<string, number>();
              steps.forEach((s, i) => {
                if (s.domainHostname && !hostnameFirstIdx.has(s.domainHostname)) {
                  hostnameFirstIdx.set(s.domainHostname, i);
                }
              });
              return steps.map((step, idx) => {
              const showHeader = !!step.domainHostname && hostnameFirstIdx.get(step.domainHostname!) === idx;
              return (
                <div key={step.id}>
                  {showHeader && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px 4px', marginTop: idx === 0 ? 0 : '8px' }}>
                      <DomainFaviconImg favicon={step.domainFavicon} hostname={step.domainHostname} size={14} />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {step.domainName ?? step.domainHostname}
                      </span>
                    </div>
                  )}
                  <TocItem
                    step={step}
                    isActive={activeId === step.id}
                    isDragOver={dragOverId === step.id && draggingId !== step.id}
                    onSelect={() => setActiveId(step.id)}
                    onRename={title => updateStep(step.id, { actionTitle: title })}
                    onDragStart={() => handleDragStart(step.id)}
                    onDragOver={e => handleDragOver(e, step.id)}
                    onDrop={() => handleDrop(step.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                  />
                </div>
              );
            });
            })()}
          </div>
          <div style={{ padding: '8px 12px 16px', borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
            <button
              onClick={onAddStep ?? addStep}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '36px', border: '1.5px dashed #D1D5DB', borderRadius: '8px', background: 'transparent', fontSize: '12px', color: '#6B7280', cursor: 'pointer', transition: 'all 0.15s ease' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3730a3'; e.currentTarget.style.color = '#3730a3'; e.currentTarget.style.background = 'rgba(55,48,163,0.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = 'transparent'; }}
            >
              <Plus size={13} /> 단계 추가
            </button>
          </div>
        </aside>
      )}

      {/* ── Right content — scroll-snap 스크롤 편집 ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#F1F3F5' }}>

        {/* ── 상단 툴바: AI 액션 (선택 시에만 표시) ── */}
        {selectedIds.size > 0 && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 20px', borderBottom: '1px solid #E5E7EB', background: '#FFFBEB' }}>
            <span style={{ fontSize: '12px', color: '#F59E0B', fontWeight: 600 }}>{selectedIds.size}개 선택됨</span>
            <div style={{ width: '1px', height: '16px', background: '#E5E7EB', margin: '0 2px' }} />
            <Sparkles size={12} style={{ color: '#6d28d9', flexShrink: 0 }} />
            {([
              { label: '문장 다듬기', instruction: '매뉴얼 가이드라인에 맞게 다듬어줘: 행동 하나만, 1문장, 존댓말, 특정 상품명/수량 제거, 결과 설명 문장 금지' },
              { label: '맞춤법 교정', instruction: '맞춤법과 띄어쓰기를 교정해줘' },
              { label: '개조식으로', instruction: '개조식으로 변환해줘: 마침표 없이 핵심 동작만 명사형으로 짧게' },
            ] as const).map(({ label, instruction }) => (
              <button key={label} disabled={!!bulkAiLoading} onClick={() => bulkAiRewrite(instruction, label)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '26px', padding: '0 10px', borderRadius: '5px', border: '1px solid #EDE9FE', background: bulkAiLoading === label ? '#EDE9FE' : 'white', color: '#6d28d9', fontSize: '11.5px', fontWeight: 500, cursor: bulkAiLoading ? 'not-allowed' : 'pointer', opacity: bulkAiLoading && bulkAiLoading !== label ? 0.45 : 1, flexShrink: 0 }}
              >
                {bulkAiLoading === label ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                {label}
              </button>
            ))}
            <div style={{ width: '1px', height: '16px', background: '#E5E7EB', margin: '0 2px' }} />
            <button
              onClick={() => {
                if (!window.confirm(`선택한 ${selectedIds.size}개 단계를 삭제합니다. 연습 가이드와 Live Guide Beta에서도 제거됩니다. 계속할까요?`)) return;
                const removed = steps.filter(s => selectedIds.has(s.id)).map(s => s.id);
                const next = steps.filter(s => !selectedIds.has(s.id)).map((s, i) => ({ ...s, number: i + 1 }));
                onChange(next); removed.forEach(id => onDeleteStep?.(id)); clearSelection();
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '26px', padding: '0 10px', borderRadius: '5px', border: '1px solid #FEE2E2', background: 'white', color: '#EF4444', fontSize: '11.5px', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}
            >
              <Trash2 size={11} /> 삭제
            </button>
          </div>
        )}

        {/* ── bulk AI 에러 메시지 ── */}
        {bulkAiError && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px', background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
            <span style={{ fontSize: '12px', color: '#DC2626' }}>{bulkAiError}</span>
            <button onClick={() => setBulkAiError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', display: 'grid', placeItems: 'center', padding: 0 }}>
              <X size={13} />
            </button>
          </div>
        )}

        {/* ── scroll-snap 스크롤 영역 — 각 스텝이 뷰포트 1장씩 ── */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: 'scroll', scrollSnapType: 'y mandatory', position: 'relative' }}
        >
          {steps.length === 0 ? (
            <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: '14px' }}>
              단계가 없습니다.
            </div>
          ) : (
            steps.map(step => (
              <div
                key={step.id}
                ref={el => { contentRefs.current[step.id] = el; }}
                data-step-id={step.id}
                style={{ scrollSnapAlign: 'start', minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0', boxSizing: 'border-box' }}
              >
                <div style={{ width: '100%', maxWidth: '1120px', padding: '0 24px', boxSizing: 'border-box' }}>
                  <StepCard
                    step={step}
                    isActive={activeId === step.id}
                    isSelected={selectedIds.has(step.id)}
                    onToggleSelect={() => toggleSelect(step.id)}
                    onFocus={() => setActiveId(step.id)}
                    onUpdate={patch => updateStep(step.id, patch)}
                    onSave={patch => { updateStep(step.id, patch); onSave?.(step.id, patch); }}
                    onDelete={() => deleteStep(step.id)}
                    onDuplicate={() => onDuplicateStep?.(step.id)}
                    isDuplicating={duplicatingStepId === step.id}
                    onZoom={() => step.screenshotUrl && setZoomUrl(step.screenshotUrl)}
                    onAnnotate={() => { if (!step.screenshotUrl) return; setActiveId(step.id); setAnnotatingId(step.id); }}
                    onRemoveImage={() => { updateStep(step.id, { screenshotUrl: undefined, annotations: [] }); onSave?.(step.id, { screenshotUrl: undefined, annotations: [] }); }}
                    onAddComment={onAddComment ? () => onAddComment(step.id) : undefined}
                  />
                  {/* 스텝 아래 hover 시 + — 빈 단계를 바로 아래에 추가 */}
                  {onInsertAfter && !step.id.startsWith('step-') && (
                    <div
                      onMouseEnter={() => setInsertHoverId(step.id)}
                      onMouseLeave={() => setInsertHoverId(prev => (prev === step.id ? null : prev))}
                      style={{ height: '34px', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                    >
                      <div style={{ position: 'absolute', left: 0, right: 0, height: '1px', background: insertHoverId === step.id ? '#c7d2fe' : 'transparent', transition: 'background 0.15s' }} />
                      <button
                        onClick={() => onInsertAfter(step.id)}
                        title="여기에 빈 단계 추가"
                        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 12px', borderRadius: '999px', border: '1px solid #c7d2fe', background: 'white', color: '#3730a3', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: insertHoverId === step.id ? 1 : 0, transition: 'opacity 0.15s', boxShadow: '0 1px 4px rgba(55,48,163,0.12)' }}
                      >
                        <Plus size={14} /> 빈 단계 추가
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* 위/아래 이동 플로팅 버튼 — 챗봇(우하단)과 겹치지 않게 왼쪽으로 비켜 배치 */}
          <div className="editor-step-nav" style={{ position: 'fixed', bottom: '28px', right: '92px', zIndex: 20, scrollSnapAlign: 'none' }}>
            <div style={{}}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(() => {
                const currentIdx = steps.findIndex(s => s.id === activeId);
                const idx = currentIdx >= 0 ? currentIdx : 0;
                const goTo = (newIdx: number) => {
                  if (newIdx < 0 || newIdx >= steps.length) return;
                  const container = scrollRef.current;
                  const el = contentRefs.current[steps[newIdx].id];
                  if (container && el) {
                    container.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
                  }
                  setActiveId(steps[newIdx].id);
                };
                return [
                  { label: '▲ 이전', disabled: idx === 0, onClick: () => goTo(idx - 1) },
                  { label: '▼ 다음', disabled: idx === steps.length - 1, onClick: () => goTo(idx + 1) },
                ].map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.onClick}
                    disabled={btn.disabled}
                    style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid #E5E7EB', background: btn.disabled ? '#F9FAFB' : 'white', boxShadow: btn.disabled ? 'none' : '0 2px 10px rgba(17,24,39,0.12)', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: btn.disabled ? 'not-allowed' : 'pointer', color: btn.disabled ? '#D1D5DB' : '#374151', fontSize: '12px', fontWeight: 500, transition: 'all 0.15s' }}
                    onMouseEnter={e => { if (!btn.disabled) { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#111827'; } }}
                    onMouseLeave={e => { if (!btn.disabled) { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#374151'; } }}
                  >
                    {btn.label}
                  </button>
                ));
              })()}
            </div>
            </div>
          </div>

          {/* 단계 추가 버튼 — 마지막 스텝 아래 */}
          <div style={{ scrollSnapAlign: 'none', display: 'flex', justifyContent: 'center', padding: '20px 0 40px' }}>
            <button
              onClick={onAddStep ?? addStep}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '44px', padding: '0 24px', borderRadius: '10px', border: '2px dashed #D1D5DB', background: 'transparent', fontSize: '13px', color: '#6B7280', cursor: 'pointer', transition: 'all 0.18s ease' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3730a3'; e.currentTarget.style.color = '#3730a3'; e.currentTarget.style.background = 'rgba(55,48,163,0.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = 'transparent'; }}
            >
              <Plus size={15} /> 단계 추가
            </button>
          </div>
        </div>
      </div>

      {zoomUrl && <ImageZoomModal url={zoomUrl} onClose={() => setZoomUrl(null)} />}

      {annotatingId && (() => {
        const step = steps.find(s => s.id === annotatingId)!;
        // element_rect가 있고 annotations가 비어 있으면 화살표+라벨 자동 생성
        const displayAnnotations = displayAnnotationsFor(step);
        const initialAnnotations = displayAnnotations.length > 0
          ? displayAnnotations
          : buildInputAnnotation(step);
        return (
          <ImageAnnotationEditor
            imageUrl={step.screenshotUrl!}
            annotations={initialAnnotations}
            onChange={annotations => {
              // 함수형 업데이트로 stale closure 방지
              const id = annotatingId;
              onChange(steps.map(s => s.id === id ? { ...s, annotations } : s));
              onSave?.(id, { annotations });
            }}
            onClose={() => setAnnotatingId(null)}
            onPixelate={async (region: BlurRegion) => {
              const id = annotatingId;
              const target = steps.find(s => s.id === id);
              if (!target?.screenshotUrl) return;
              try {
                const blob = await pixelateRegion(target.screenshotUrl, region);
                const fd = new FormData();
                fd.append('file', new File([blob], 'blurred.jpg', { type: 'image/jpeg' }));
                const res = await fetch(`/api/steps/${id}/blur`, { method: 'POST', body: fd });
                if (!res.ok) throw new Error('upload failed');
                const data = await res.json();
                onChange(steps.map(s => s.id === id
                  ? { ...s, screenshotUrl: data.screenshot_url, originalScreenshotUrl: data.original_screenshot_url }
                  : s));
              } catch {
                alert('블러 처리에 실패했습니다. 다시 시도해 주세요.');
              }
            }}
            onRevertBlur={async () => {
              const id = annotatingId;
              try {
                const res = await fetch(`/api/steps/${id}/blur`, { method: 'DELETE' });
                if (!res.ok) throw new Error('revert failed');
                const data = await res.json();
                onChange(steps.map(s => s.id === id
                  ? { ...s, screenshotUrl: data.screenshot_url }
                  : s));
              } catch {
                alert('되돌리기에 실패했습니다.');
              }
            }}
            canRevertBlur={!!step.originalScreenshotUrl}
          />
        );
      })()}

      {/* 스텝 삭제 확인 모달 — 연습 가이드/Live Guide 설정이 있으면 함께 사라짐을 경고 */}
      {pendingDeleteId && (() => {
        const step = steps.find(s => s.id === pendingDeleteId);
        const hasGuide = hasGuideConfig(step?.followConfig);
        return (
          <div
            onClick={() => setPendingDeleteId(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(10,10,18,0.50)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: '20px' }}
          >
            <div onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '360px', background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.28)' }}
            >
              <div style={{ marginBottom: '6px', fontSize: '16px', fontWeight: 700, color: '#111827' }}>단계 삭제</div>
              {step && (
                <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(step.number).padStart(2, '0')}. {step.actionTitle || '(제목 없음)'}
                </div>
              )}
              {hasGuide && (
                <div style={{ fontSize: '12.5px', color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '9px 11px', lineHeight: 1.55, marginBottom: '10px' }}>
                  이 스텝의 <b>연습 가이드·Live Guide Beta 설정</b>(핫스팟·말풍선·입력 텍스트 등)도 함께 삭제됩니다.
                </div>
              )}
              <div style={{ fontSize: '12.5px', color: '#9CA3AF', lineHeight: 1.6, marginBottom: '20px' }}>
                삭제 후 상단 <b>실행 취소</b>(Ctrl+Z)로 되돌릴 수 있어요.
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setPendingDeleteId(null)}
                  style={{ flex: 1, height: '40px', borderRadius: '10px', border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontSize: '13.5px', fontWeight: 500, cursor: 'pointer' }}>
                  취소
                </button>
                <button onClick={() => performDelete(pendingDeleteId!)}
                  style={{ flex: 1, height: '40px', borderRadius: '10px', border: 'none', background: '#EF4444', color: 'white', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}>
                  삭제
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── 클릭 지점 기반 annotation 자동 생성 ───────────────────
// element_rect(0-1) 또는 click_x/y(0-100 pct) 기반으로
// 빨간 테두리 + 화살표 + 요약 라벨 생성
function buildInputAnnotation(step: ManualStep): Annotation[] {
  const labelText = step.actionTitle
    ? step.actionTitle.replace(/^입력,?\s*/i, '').trim() || '클릭'
    : '클릭';

  const r = step.element_rect;
  let rect: { x: number; y: number; width: number; height: number };

  if (r && r.width > 0 && r.height > 0) {
    rect = r;
  } else if (
    step.click_x != null && step.click_y != null &&
    // 0%·100% 정확히 일치하는 값은 손상된 레거시 좌표 — 모서리 어노테이션 방지
    step.click_x > 0 && step.click_x < 100 && step.click_y > 0 && step.click_y < 100
  ) {
    // 클릭 지점(0-100 pct) → 0-1 변환 후 주변 추정 영역
    const cx = step.click_x / 100, cy = step.click_y / 100;
    const x = Math.max(0, cx - 0.05), y = Math.max(0, cy - 0.02);
    rect = { x, y, width: Math.min(0.10, 1 - x), height: Math.min(0.04, 1 - y) };
  } else {
    return [];
  }

  return buildClickHighlight({
    elementRect: rect,
    stepNumber: step.number,
    label: labelText,
    clickX: step.click_x != null ? step.click_x / 100 : null,
    clickY: step.click_y != null ? step.click_y / 100 : null,
    actionType: step.type_text ? 'type' : null,
  });
}

// ── TocItem ───────────────────────────────────────────────

function isOversizedRect(rect?: ManualStep['element_rect']): boolean {
  if (!rect) return false;
  return rect.width > 0.34 || rect.height > 0.16 || rect.width * rect.height > 0.055;
}

function isAutoGeneratedAnnotationSet(step: ManualStep): boolean {
  const annotations = step.annotations ?? [];
  if (annotations.length === 0) return false;
  const prefix = `guidde-${step.number}-`;
  return annotations.some(a => typeof a.id === 'string' && a.id.startsWith(prefix))
    && annotations.every(a => typeof a.id === 'string' && a.id.startsWith(prefix));
}

function shouldRefreshAutoAnnotations(step: ManualStep): boolean {
  return isAutoGeneratedAnnotationSet(step)
    && isOversizedRect(step.element_rect)
    && step.click_x != null
    && step.click_y != null
    && step.click_x > 0
    && step.click_x < 100
    && step.click_y > 0
    && step.click_y < 100;
}

function displayAnnotationsFor(step: ManualStep): Annotation[] {
  if (shouldRefreshAutoAnnotations(step)) {
    const annotations = buildInputAnnotation(step);
    if (annotations.length > 0) return annotations;
  }
  return step.annotations ?? [];
}

interface TocItemProps {
  step: ManualStep;
  isActive: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

function TocItem({ step, isActive, isDragOver, onSelect, onRename, onDragStart, onDragOver, onDrop, onDragEnd }: TocItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(step.actionTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setDraft(step.actionTitle); }, [step.actionTitle, editing]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(step.actionTitle);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    setEditing(false);
    const trimmed = draft.trim() || step.actionTitle;
    setDraft(trimmed);
    onRename(trimmed);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={() => { if (!editing) onSelect(); }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 16px',
        background: isDragOver ? 'rgba(55,48,163,0.06)' : isActive ? '#e0e7ff' : 'transparent',
        borderLeft: `3px solid ${isDragOver || isActive ? '#3730a3' : 'transparent'}`,
        borderTop: isDragOver ? '2px solid #3730a3' : '2px solid transparent',
        cursor: editing ? 'text' : 'grab', transition: 'background 0.15s ease', userSelect: 'none',
      }}
      onMouseEnter={e => { if (!isActive && !isDragOver) e.currentTarget.style.background = '#F9FAFB'; }}
      onMouseLeave={e => { if (!isActive && !isDragOver) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ color: '#CBD5E1', fontSize: '10px', lineHeight: 1.6, flexShrink: 0, cursor: 'grab', letterSpacing: '-1px' }}>⠿</span>
      <span style={{ fontSize: '11px', fontWeight: 600, color: isActive ? '#3730a3' : '#9CA3AF', minWidth: '20px', flexShrink: 0, lineHeight: 1.6 }}>
        {String(step.number).padStart(2, '0')}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') { setEditing(false); setDraft(step.actionTitle); } }}
          onClick={e => e.stopPropagation()}
          style={{ flex: 1, fontSize: '12.5px', fontWeight: 500, color: '#111827', border: '1px solid #3730a3', borderRadius: '4px', padding: '1px 6px', outline: 'none', background: 'white', lineHeight: 1.5 }}
        />
      ) : (
        <span
          onDoubleClick={startEdit}
          onClick={e => { e.stopPropagation(); onSelect(); }}
          title="더블클릭 → 제목 변경"
          style={{ flex: 1, fontSize: '12.5px', color: isActive ? '#1E1B4B' : '#374151', fontWeight: isActive ? 500 : 400, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', cursor: 'pointer' }}
        >
          {step.actionTitle || '(제목 없음)'}
        </span>
      )}
    </div>
  );
}

// ── StepCard ──────────────────────────────────────────────

interface StepCardProps {
  step: ManualStep;
  isActive: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onFocus: () => void;
  onUpdate: (patch: Partial<ManualStep>) => void;
  onSave: (patch: Partial<ManualStep>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isDuplicating?: boolean;
  onZoom: () => void;
  onAnnotate: () => void;
  onRemoveImage: () => void;
  onAddComment?: () => void;
}

function StepCard({ step, isActive, isSelected, onToggleSelect, onFocus, onUpdate, onSave, onDelete, onDuplicate, isDuplicating, onZoom, onAnnotate, onRemoveImage, onAddComment }: StepCardProps) {
  const [hovering, setHovering] = useState(false);
  const [descGenerating, setDescGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const handleGenerateDescription = async () => {
    if (descGenerating || step.id.startsWith('step-')) return;
    setDescGenerating(true);
    try {
      const res = await fetch(`/api/steps/${step.id}/generate-description`, { method: 'POST' });
      if (!res.ok) {
        alert('설명 자동 생성에 실패했어요. 잠시 후 다시 시도해주세요.');
        return;
      }
      const { description } = await res.json();
      if (description) {
        const html = DOMPurify.sanitize(description.replace(/\n/g, '<br>'), { USE_PROFILES: { html: true } });
        onUpdate({ description: html });
        onSave({ description: html });
        if (editorRef.current && document.activeElement !== editorRef.current) {
          editorRef.current.innerHTML = html;
        }
      }
    } finally {
      setDescGenerating(false);
    }
  };

  // 음성 원본 전사 삽입 — 다듬은 본문 대신 Whisper 원문을 설명에 넣는다 (사용자가 이후 편집 가능)
  const handleInsertRawTranscript = () => {
    const raw = step.voiceTranscriptRaw;
    if (!raw) return;
    const html = DOMPurify.sanitize(raw.replace(/\n/g, '<br>'), { USE_PROFILES: { html: true } });
    onUpdate({ description: html });
    onSave({ description: html });
    if (editorRef.current && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = html;
    }
  };

  // 음성 구간 재생 — 세션 음성에서 이 스텝 구간([start,end])만 재생
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  // 언마운트 시 재생 중이던 음성 정지 — 카드가 사라져도 오디오가 계속 재생되는 누수 방지
  useEffect(() => () => { try { audioRef.current?.pause(); } catch { /* noop */ } }, []);
  const handlePlayVoice = () => {
    const url = step.voiceAudioUrl;
    if (!url) return;
    if (audioPlaying && audioRef.current) {
      audioRef.current.pause();
      setAudioPlaying(false);
      return;
    }
    // url이 바뀌면 기존 오디오 객체를 재사용하지 않는다(옛 스텝 음성 재생 방지)
    if (!audioRef.current || audioRef.current.src !== url) {
      try { audioRef.current?.pause(); } catch { /* noop */ }
      audioRef.current = new Audio(url);
    }
    const audio = audioRef.current;
    const startS = (step.voiceAudioStartMs ?? 0) / 1000;
    const endS = step.voiceAudioEndMs != null ? step.voiceAudioEndMs / 1000 : null;
    audio.currentTime = startS;
    const onTime = () => {
      if (endS != null && audio.currentTime >= endS) {
        audio.pause();
        audio.removeEventListener('timeupdate', onTime);
        setAudioPlaying(false);
      }
    };
    audio.addEventListener('timeupdate', onTime);
    audio.onended = () => setAudioPlaying(false);
    audio.play().then(() => setAudioPlaying(true)).catch(() => setAudioPlaying(false));
  };

  const showControls = hovering || isActive;

  const handleImageUpload = useCallback((file: File) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const MAX_MB = 5;
    if (!ALLOWED.includes(file.type)) {
      alert('JPG, PNG, WEBP, GIF 형식만 지원합니다.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`이미지 크기는 ${MAX_MB}MB 이하여야 합니다.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = e => onUpdate({ screenshotUrl: e.target?.result as string });
    reader.readAsDataURL(file);
  }, [onUpdate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = '';
  };

  const handleImgDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) handleImageUpload(file);
  };

  // Sync description → editor HTML (only when step.description changes externally)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const clean = DOMPurify.sanitize(step.description, { USE_PROFILES: { html: true } });
    if (el.innerHTML !== clean) {
      el.innerHTML = clean;
    }
  }, [step.description]);

  const handleEditorInput = () => {
    const raw = editorRef.current?.innerHTML ?? '';
    onUpdate({ description: DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } }) });
  };

  const handleEditorBlur = () => {
    const raw = editorRef.current?.innerHTML ?? '';
    onSave({ description: DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } }) });
  };

  const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    onSave({ actionTitle: e.target.value });
  };

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        background: 'white', borderRadius: '12px',
        border: `1.5px solid ${isSelected ? '#3730a3' : isActive ? '#F59E0B' : '#E5E7EB'}`,
        boxShadow: isSelected
          ? '0 0 0 3px rgba(55,48,163,0.12), 0 4px 16px rgba(17,24,39,0.06)'
          : isActive ? '0 0 0 3px rgba(245,158,11,0.10), 0 4px 16px rgba(17,24,39,0.06)' : '0 1px 4px rgba(17,24,39,0.04)',
        transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />

      {/* 선택 체크박스 — 카드 우측 상단 고정 */}
      <div
        onClick={e => { e.stopPropagation(); onToggleSelect(); }}
        style={{
          position: 'absolute', top: '8px', right: '8px',
          width: '20px', height: '20px', borderRadius: '5px',
          border: `2px solid ${isSelected ? '#3730a3' : '#D1D5DB'}`,
          background: isSelected ? '#3730a3' : 'white',
          display: 'grid', placeItems: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
          opacity: showControls || isSelected ? 1 : 0,
          zIndex: 2,
        }}
      >
        {isSelected && <Check size={10} color="white" strokeWidth={3} />}
      </div>

      {/* ── Text format toolbar (formatting only, no AI buttons) ── */}
      <TextFormatToolbar editorRef={editorRef} titleRef={titleRef}
        onTitleFontSize={px => { onUpdate({ titleFontSize: px }); onSave({ titleFontSize: px }); }} />

      {/* Card header */}
      <div style={{ padding: '8px 36px 8px 20px' }}>
        {/* Number + Title + 우측 아이콘 가로 행 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#F59E0B', flexShrink: 0, lineHeight: 1.4 }}>
            {String(step.number).padStart(2, '0')}.
          </span>
          {step.is_stale && (
            <span title="이 페이지의 UI가 변경되었을 수 있어요" style={{
              fontSize: '10px', fontWeight: 600, padding: '1px 6px',
              borderRadius: '20px', background: '#FEF3C7', color: '#D97706',
              border: '1px solid #FDE68A', flexShrink: 0, cursor: 'default',
            }}>업데이트 필요</span>
          )}
          <input
            ref={titleRef}
            value={step.actionTitle}
            onChange={e => onUpdate({ actionTitle: e.target.value })}
            onFocus={onFocus}
            onBlur={e => { e.currentTarget.style.background = 'transparent'; handleTitleBlur(e); }}
            placeholder="단계 제목을 입력하세요"
            style={{
              flex: 1, fontSize: `${step.titleFontSize ?? 18}px`, fontWeight: 600, color: '#111827',
              background: 'transparent', border: 'none', outline: 'none',
              padding: '3px 6px', margin: '0 -6px',
              lineHeight: 1.4, borderRadius: '6px', cursor: 'text',
              transition: 'background 0.15s ease', boxSizing: 'border-box',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; }}
            onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.background = 'transparent'; }}
          />
          {/* 우측 아이콘 — 체크박스 제외 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: showControls ? 1 : 0, transition: 'opacity 0.18s ease', flexShrink: 0 }}>
            {step.pageUrl && (
              <button
                title={step.pageUrl}
                onClick={() => window.open(step.pageUrl!, '_blank', 'noopener,noreferrer')}
                style={iconBtnSm}
                onMouseEnter={e => { e.currentTarget.style.color = '#3730a3'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; }}
              >
                <ExternalLink size={16} />
              </button>
            )}
            {step.screenshotUrl && (
              <button title="이미지 확대" onClick={onZoom} style={iconBtnSm}
                onMouseEnter={e => { e.currentTarget.style.color = '#374151'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; }}
              >
                <ZoomIn size={16} />
              </button>
            )}
            {onAddComment && !step.id.startsWith('step-') && (
              <button title="이 단계에 댓글 추가" onClick={onAddComment} style={iconBtnSm}
                onMouseEnter={e => { e.currentTarget.style.color = '#4F46E5'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; }}
              >
                <MessageSquare size={16} />
              </button>
            )}
            <button onClick={onDuplicate} disabled={isDuplicating} title={isDuplicating ? '복제 중…' : '단계 복제'} style={{ ...iconBtnSm, opacity: isDuplicating ? 0.65 : 1, cursor: isDuplicating ? 'wait' : iconBtnSm.cursor }}
              onMouseEnter={e => { if (!isDuplicating) e.currentTarget.style.color = '#0369a1'; }}
              onMouseLeave={e => { if (!isDuplicating) e.currentTarget.style.color = '#9CA3AF'; }}
            >
              {isDuplicating ? <Loader2 size={16} className="spin" /> : <Copy size={16} />}
            </button>
            <button onClick={onDelete} title="단계 삭제" style={iconBtnSm}
              onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Rich text description */}
        <div style={{ position: 'relative' }}>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onFocus={onFocus}
            onInput={handleEditorInput}
            onBlur={e => { e.currentTarget.style.background = 'transparent'; handleEditorBlur(); }}
            data-placeholder="이 단계에 대한 설명을 입력하세요."
            style={{
              width: '100%', marginTop: '4px',
              fontSize: '16px', color: '#4B5563',
              lineHeight: 1.6, fontFamily: 'inherit',
              minHeight: '24px',
              outline: 'none',
              borderRadius: '6px',
              padding: '2px 6px', margin: '4px -6px 0',
              cursor: 'text',
              transition: 'background 0.15s ease',
              boxSizing: 'border-box',
            } as React.CSSProperties}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; }}
            onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.background = 'transparent'; }}
          />
          {/* ✨ AI 설명 생성 버튼 — hover 시 표시 */}
          {(showControls || descGenerating) && !step.id.startsWith('step-') && (
            <button
              onClick={handleGenerateDescription}
              disabled={descGenerating}
              title="AI로 설명 자동 생성"
              style={{
                position: 'absolute', bottom: '-2px', right: '-6px',
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                height: '22px', padding: '0 8px',
                borderRadius: '5px', border: '1px solid #EDE9FE',
                background: descGenerating ? '#EDE9FE' : 'white',
                color: '#6d28d9', fontSize: '11px', fontWeight: 500,
                cursor: descGenerating ? 'not-allowed' : 'pointer',
                opacity: descGenerating ? 0.8 : 1,
                transition: 'all 0.15s',
                boxShadow: '0 1px 4px rgba(109,40,217,0.12)',
              }}
            >
              {descGenerating
                ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
                : <Sparkles size={12} />}
              {descGenerating ? '생성 중…' : 'AI 완성'}
            </button>
          )}

          {/* 🎙 음성 전사 컨트롤 — 원본 토글 + 구간 재생 (전사가 있을 때만) */}
          {(step.voiceTranscriptRaw || step.voiceAudioUrl) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#6d28d9', fontWeight: 600 }}>
                <Mic size={12} /> 음성 설명
              </span>
              {step.voiceAudioUrl && (
                <button
                  onClick={handlePlayVoice}
                  title="이 단계 음성 듣기"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    height: '20px', padding: '0 7px', borderRadius: '5px',
                    border: '1px solid #E5E7EB', background: 'white',
                    color: '#374151', fontSize: '10px', fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  {audioPlaying ? <Pause size={11} /> : <Play size={11} />}
                  {audioPlaying ? '정지' : '원본 듣기'}
                </button>
              )}
              {step.voiceTranscriptRaw && (
                <button
                  onClick={handleInsertRawTranscript}
                  title="다듬기 전 원본 전사를 설명에 넣기"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    height: '20px', padding: '0 7px', borderRadius: '5px',
                    border: '1px solid #E5E7EB', background: 'white',
                    color: '#374151', fontSize: '10px', fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  원본 전사 넣기
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 타이핑 텍스트 표시 — followConfig 오버라이드 우선, 없으면 캡처 원문 */}
      {(step.followConfig?.typeText || step.type_text) && (
        <div style={{ padding: '0 24px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#0369a1', fontWeight: 600, flexShrink: 0 }}>
              <Type size={12} /> 타이핑
            </span>
            <span style={{ fontSize: '12px', color: '#1e40af', background: '#EFF6FF', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
              {step.followConfig?.typeText ?? step.type_text}
            </span>
          </div>
        </div>
      )}

      {/* Screenshot area — 클릭하면 바로 편집 진입 */}
      <ScreenshotArea
        step={step}
        onUploadClick={() => fileInputRef.current?.click()}
        onDrop={handleImgDrop}
        onAnnotate={onAnnotate}
        onRemove={onRemoveImage}
        onFraming={patch => onSave(patch)}
      />

    </div>
  );
}

// 헤더 우측 작은 아이콘 버튼 (보더 없음, 투명 배경)
const iconBtnSm: React.CSSProperties = {
  width: '24px', height: '24px', display: 'grid', placeItems: 'center',
  borderRadius: '5px', border: 'none',
  background: 'transparent', color: '#9CA3AF', cursor: 'pointer',
  padding: 0,
};

// ── TextFormatToolbar (formatting only) ──────────────────

type ActiveState = { bold: boolean; italic: boolean; underline: boolean };

const FONT_SIZE_OPTIONS = [10, 12, 14, 16, 18, 20, 24, 32];
const nearestFontSize = (px: number) =>
  FONT_SIZE_OPTIONS.reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a));

function TextFormatToolbar({ editorRef, titleRef, onTitleFontSize }: { editorRef: React.RefObject<HTMLDivElement>; titleRef?: React.RefObject<HTMLInputElement>; onTitleFontSize?: (px: number) => void }) {
  const [active, setActive] = useState<ActiveState>({ bold: false, italic: false, underline: false });
  const [fontSize, setFontSize] = useState(16);
  const lastWasTitle = useRef(false);

  const syncActive = useCallback(() => {
    // 제목(input)에 커서가 있으면 제목의 실제 글자 크기를 드롭다운에 반영
    if (titleRef?.current && document.activeElement === titleRef.current) {
      lastWasTitle.current = true;
      setActive({ bold: false, italic: false, underline: false });
      const px = parseFloat(window.getComputedStyle(titleRef.current).fontSize);
      if (!Number.isNaN(px)) setFontSize(nearestFontSize(Math.round(px)));
      return;
    }
    if (editorRef.current && document.activeElement === editorRef.current) lastWasTitle.current = false;
    const sel = window.getSelection();
    if (!sel || !editorRef.current?.contains(sel.anchorNode)) return;
    setActive({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
    });
    // 선택(또는 커서) 위치의 실제 글자 크기를 읽어 드롭다운에 반영
    let node: Node | null = sel.anchorNode;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    if (node instanceof Element) {
      const px = parseFloat(window.getComputedStyle(node).fontSize);
      if (!Number.isNaN(px)) setFontSize(nearestFontSize(Math.round(px)));
    }
  }, [editorRef, titleRef]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const title = titleRef?.current;
    el.addEventListener('keyup', syncActive);
    el.addEventListener('mouseup', syncActive);
    title?.addEventListener('focus', syncActive);
    title?.addEventListener('keyup', syncActive);
    title?.addEventListener('click', syncActive);
    document.addEventListener('selectionchange', syncActive);
    return () => {
      el.removeEventListener('keyup', syncActive);
      el.removeEventListener('mouseup', syncActive);
      title?.removeEventListener('focus', syncActive);
      title?.removeEventListener('keyup', syncActive);
      title?.removeEventListener('click', syncActive);
      document.removeEventListener('selectionchange', syncActive);
    };
  }, [editorRef, titleRef, syncActive]);

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    requestAnimationFrame(syncActive);
    editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // 실제 px 단위로 글자 크기 적용 — execCommand size 7을 임시 마커로 만들고 span(font-size:px)으로 치환
  const applyFontSize = (px: number) => {
    // 제목에 커서가 있었으면 제목 글자 크기를 변경(저장)
    if (lastWasTitle.current && onTitleFontSize) {
      setFontSize(px);
      onTitleFontSize(px);
      return;
    }
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand('fontSize', false, '7');
    el.querySelectorAll('font[size="7"]').forEach(font => {
      const span = document.createElement('span');
      span.style.fontSize = `${px}px`;
      while (font.firstChild) span.appendChild(font.firstChild);
      font.replaceWith(span);
    });
    setFontSize(px);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    requestAnimationFrame(syncActive);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '8px 14px', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
      <select
        value={fontSize}
        onChange={e => applyFontSize(parseInt(e.target.value, 10))}
        style={{ fontSize: '12.5px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', borderRadius: '5px', padding: '4px 7px', cursor: 'pointer', marginRight: '6px', outline: 'none' }}
      >
        {FONT_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}px</option>)}
      </select>
      <Divider />
      <ToolBtn title="굵게 (Ctrl+B)" isActive={active.bold} onMouseDown={e => { e.preventDefault(); exec('bold'); }}><Bold size={15} /></ToolBtn>
      <ToolBtn title="기울임 (Ctrl+I)" isActive={active.italic} onMouseDown={e => { e.preventDefault(); exec('italic'); }}><Italic size={15} /></ToolBtn>
      <ToolBtn title="밑줄 (Ctrl+U)" isActive={active.underline} onMouseDown={e => { e.preventDefault(); exec('underline'); }}><Underline size={15} /></ToolBtn>
    </div>
  );
}

function Divider() {
  return <div style={{ width: '1px', height: '18px', background: '#E5E7EB', margin: '0 4px' }} />;
}

function ToolBtn({
  children, title, isActive, onMouseDown,
}: {
  children: React.ReactNode;
  title?: string;
  isActive?: boolean;
  onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      title={title}
      onMouseDown={onMouseDown}
      style={{
        width: '28px', height: '28px', display: 'grid', placeItems: 'center',
        borderRadius: '6px', border: `1px solid ${isActive ? '#3730a3' : 'transparent'}`,
        background: isActive ? '#e0e7ff' : 'transparent',
        color: isActive ? '#3730a3' : '#4B5563',
        cursor: 'pointer', transition: 'all 0.12s ease',
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#111827'; } }}
      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4B5563'; } }}
    >
      {children}
    </button>
  );
}

// ── ScreenshotArea ────────────────────────────────────────

interface ScreenshotAreaProps {
  step: ManualStep;
  onUploadClick: () => void;
  onDrop: (e: React.DragEvent) => void;
  onAnnotate: () => void;
  onRemove: () => void;
  // 줌/팬 프레이밍 변경 영속화 (image_zoom + image_offset_x/y)
  onFraming: (patch: { imageZoom: number; imageOffsetX: number; imageOffsetY: number }) => void;
}

const clampZoom = (z: number) => Math.round(Math.min(4, Math.max(1, z)) * 100) / 100;
// 이미지 가장자리가 프레임 안쪽으로 들어오지 않도록 팬 한계 = (z-1)/2
const clampOffset = (v: number, z: number) => {
  const m = Math.max(0, (z - 1) / 2);
  return Math.min(m, Math.max(-m, v));
};

function ScreenshotArea({ step, onUploadClick, onDrop, onAnnotate, onRemove, onFraming }: ScreenshotAreaProps) {
  const [dragOver, setDragOver] = useState(false);
  const [imgHover, setImgHover] = useState(false);
  const [panning, setPanning] = useState(false);

  // 로컬 뷰 상태 — 드래그/휠 중에는 로컬이 진실, 커밋 시 onFraming으로 영속
  const [view, setView] = useState({
    z: step.imageZoom ?? 1,
    x: step.imageOffsetX ?? 0,
    y: step.imageOffsetY ?? 0,
  });
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; });

  // 외부(언두 등)에서 스텝 값이 바뀌면 로컬 동기화
  useEffect(() => {
    setView({ z: step.imageZoom ?? 1, x: step.imageOffsetX ?? 0, y: step.imageOffsetY ?? 0 });
  }, [step.imageZoom, step.imageOffsetX, step.imageOffsetY]);

  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFramingRef = useRef(onFraming);
  useEffect(() => { onFramingRef.current = onFraming; });

  const scheduleCommit = useCallback((immediate = false) => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    const fire = () => {
      const v = viewRef.current;
      onFramingRef.current({ imageZoom: v.z, imageOffsetX: v.x, imageOffsetY: v.y });
    };
    if (immediate) fire();
    else commitTimer.current = setTimeout(fire, 500);
  }, []);
  useEffect(() => () => { if (commitTimer.current) clearTimeout(commitTimer.current); }, []);

  // calc(z) → 새 배율. anchor(화면 좌표)가 있으면 그 지점 고정 줌(커서 기준)
  const applyZoom = useCallback((calc: (z: number) => number, anchor?: { cx: number; cy: number }) => {
    setView(v => {
      const z2 = clampZoom(calc(v.z));
      if (z2 === v.z) return v;
      let { x, y } = v;
      const el = frameRef.current;
      const f = z2 / v.z;
      if (anchor && el) {
        const r = el.getBoundingClientRect();
        const qx = anchor.cx - (r.left + r.width / 2);
        const qy = anchor.cy - (r.top + r.height / 2);
        x = (qx - f * (qx - x * r.width)) / r.width;
        y = (qy - f * (qy - y * r.height)) / r.height;
      } else {
        x = v.x * f;
        y = v.y * f;
      }
      const next = { z: z2, x: clampOffset(x, z2), y: clampOffset(y, z2) };
      viewRef.current = next; // 커밋이 렌더 전에 실행돼도 최신값 보장
      return next;
    });
    scheduleCommit();
  }, [scheduleCommit]);

  // Ctrl/⌘+휠 줌 — 브라우저 페이지 줌 차단 필요 → non-passive 네이티브 리스너
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      applyZoom(z => z + (e.deltaY > 0 ? -0.2 : 0.2), { cx: e.clientX, cy: e.clientY });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyZoom, step.screenshotUrl]);

  // 드래그 팬(줌>1) / 클릭(이동 없음) → 어노테이션 편집
  const startPan = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button,[data-stop-pan]')) return;
    e.preventDefault();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: viewRef.current.x, oy: viewRef.current.y, moved: false };
    setPanning(true);
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      const el = frameRef.current;
      if (!d || !el) return;
      const dx = ev.clientX - d.sx;
      const dy = ev.clientY - d.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (viewRef.current.z <= 1) return;
      const r = el.getBoundingClientRect();
      setView(v => {
        const next = { ...v, x: clampOffset(d.ox + dx / r.width, v.z), y: clampOffset(d.oy + dy / r.height, v.z) };
        viewRef.current = next; // mouseup 즉시 커밋이 stale 값을 읽지 않도록 동기 갱신
        return next;
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const d = dragRef.current;
      dragRef.current = null;
      setPanning(false);
      if (!d) return;
      if (d.moved && viewRef.current.z > 1) scheduleCommit(true);
      else if (!d.moved) onAnnotate();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (!step.screenshotUrl) {
    return (
      <div
        onClick={onUploadClick}
        onDrop={e => { setDragOver(false); onDrop(e); }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        style={{
          margin: '0 12px 12px', height: '180px',
          background: dragOver ? 'rgba(55,48,163,0.04)' : '#F9FAFB',
          border: `1.5px dashed ${dragOver ? '#3730a3' : '#D1D5DB'}`,
          borderRadius: '8px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '10px', color: dragOver ? '#3730a3' : '#9CA3AF',
          fontSize: '12.5px', cursor: 'pointer', transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => { if (!dragOver) { e.currentTarget.style.borderColor = '#3730a3'; e.currentTarget.style.color = '#3730a3'; e.currentTarget.style.background = 'rgba(55,48,163,0.03)'; } }}
        onMouseLeave={e => { if (!dragOver) { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = '#F9FAFB'; } }}
      >
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: dragOver ? 'rgba(55,48,163,0.10)' : '#F3F4F6', display: 'grid', placeItems: 'center', transition: 'background 0.15s' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 500, fontSize: '13px' }}>{dragOver ? '여기에 놓으세요' : '클릭하여 이미지 업로드'}</div>
          <div style={{ fontSize: '11.5px', marginTop: '2px', opacity: 0.8 }}>PNG, JPG, WEBP · 드래그 앤 드롭 가능</div>
        </div>
      </div>
    );
  }

  const displayAnnotations = displayAnnotationsFor(step);
  const hasAnnotations = displayAnnotations.length > 0;
  // 확대해도 어노테이션이 화면 밖으로 잘리지 않도록 표시 프레이밍 보정(저장값은 그대로, 표시만 fit)
  const { zoom, offsetX: offX, offsetY: offY } = fitFramingToBox(
    { zoom: view.z, offsetX: view.x, offsetY: view.y },
    annotationsBox(displayAnnotations),
  );

  return (
    <div
      ref={frameRef}
      style={{
        margin: '0 12px 12px', borderRadius: '8px', overflow: 'hidden',
        border: '1px solid #E5E7EB', position: 'relative',
        // 뷰어(ViewerStepCard)와 동일 박스: 중앙정렬 + 회색 배경 (편집 화면 = 최종 화면, WYSIWYG)
        display: 'flex', justifyContent: 'center', background: '#F3F4F6',
        cursor: zoom > 1 ? (panning ? 'grabbing' : 'grab') : 'pointer',
      }}
      onMouseEnter={() => setImgHover(true)}
      onMouseLeave={() => setImgHover(false)}
      onMouseDown={startPan}
    >
      {/* 저장된 확대 배율 + 팬 오프셋 적용 — 이미지+어노테이션이 함께 변환 */}
      <div style={{
        position: 'relative',
        transform: zoom !== 1 || offX !== 0 || offY !== 0
          ? `translate(${offX * 100}%, ${offY * 100}%) scale(${zoom})`
          : undefined,
        transformOrigin: 'center center',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={step.screenshotUrl} alt={step.actionTitle} draggable={false} style={{ width: 'auto', maxWidth: '100%', maxHeight: 'calc(100vh - 320px)', height: 'auto', display: 'block', userSelect: 'none' }} />

        {/* Annotation SVG overlay (read-only preview) — 확대 시 어노테이션은 일정 크기 유지(역보정) */}
        {hasAnnotations && (
          <AnnotationPreview annotations={displayAnnotations} imageUrl={step.screenshotUrl!}
            sizeScale={zoom > 1 ? 1 / zoom : 1} />
        )}
      </div>

      {/* 줌 컨트롤 — 호버 또는 확대 중일 때 표시 */}
      {(imgHover || zoom > 1) && (
        <div
          data-stop-pan
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: '2px',
            background: 'rgba(20,20,30,0.78)', backdropFilter: 'blur(8px)',
            borderRadius: '8px', padding: '3px 5px', zIndex: 4,
            boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          }}
        >
          <button title="축소" onClick={() => applyZoom(z => z - 0.25)}
            style={{ width: '24px', height: '24px', borderRadius: '5px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: '15px', display: 'grid', placeItems: 'center', lineHeight: 1 }}
          >−</button>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'white', minWidth: '40px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button title="확대" onClick={() => applyZoom(z => z + 0.25)}
            style={{ width: '24px', height: '24px', borderRadius: '5px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: '15px', display: 'grid', placeItems: 'center', lineHeight: 1 }}
          >+</button>
          {(zoom !== 1 || offX !== 0 || offY !== 0) && (
            <>
              <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />
              <button title="원본 보기" onClick={() => { viewRef.current = { z: 1, x: 0, y: 0 }; setView({ z: 1, x: 0, y: 0 }); scheduleCommit(true); }}
                style={{ height: '24px', padding: '0 7px', borderRadius: '5px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '10.5px' }}
              >초기화</button>
            </>
          )}
        </div>
      )}

      {/* 스마트 크롭 적용 뱃지 */}
      {step.crop_rect && (
        <div style={{
          position: 'absolute', top: '8px', left: '8px',
          fontSize: '10px', fontWeight: 600, padding: '2px 7px',
          borderRadius: '20px', background: 'rgba(55,48,163,0.85)', color: 'white',
          backdropFilter: 'blur(4px)', pointerEvents: 'none',
        }}>
          AI 크롭
        </div>
      )}

      {/* PII 경고 배지 */}
      {step.pii_detected && (
        <div
          data-stop-pan
          title="개인정보가 노출되어 있습니다. 블러 처리를 권장합니다"
          style={{
            position: 'absolute', top: '8px', right: '8px',
            fontSize: '10px', fontWeight: 700, padding: '2px 7px',
            borderRadius: '20px', background: 'rgba(220,38,38,0.90)', color: 'white',
            backdropFilter: 'blur(4px)', cursor: 'pointer', zIndex: 3,
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          }}
          onClick={e => { e.stopPropagation(); onAnnotate(); }}
        >
          PII
        </div>
      )}

      {/* hover 시 편집 힌트 + 우측 상단 삭제 버튼 */}
      {imgHover && !panning && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'white', background: 'rgba(0,0,0,0.45)', padding: '4px 10px', borderRadius: '6px', backdropFilter: 'blur(4px)' }}>
              {zoom > 1 ? '드래그로 위치 조정 · 클릭하여 편집' : '클릭하여 편집 · Ctrl+휠 확대'}
            </span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); if (window.confirm('이미지를 삭제하시겠습니까?')) onRemove(); }}
            style={{ position: 'absolute', top: '6px', right: '6px', width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(220,38,38,0.85)', border: 'none', color: 'white', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
            title="이미지 삭제"
          >
            <Trash2 size={12} />
          </button>
        </>
      )}

    </div>
  );
}

// ── ImageZoomModal ────────────────────────────────────────

function ImageZoomModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const clampScale = (s: number) => Math.round(Math.min(5, Math.max(0.5, s)) * 10) / 10;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setScale(s => clampScale(s + 0.2));
      if (e.key === '-') setScale(s => clampScale(s - 0.2));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // scale 1일 때 pan 초기화
  useEffect(() => { if (scale <= 1) setPan({ x: 0, y: 0 }); }, [scale]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale(s => clampScale(s + delta));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    dragging.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan({
      x: dragging.current.panX + (e.clientX - dragging.current.startX),
      y: dragging.current.panY + (e.clientY - dragging.current.startY),
    });
  };

  const handleMouseUp = () => { dragging.current = null; };

  const reset = () => { setScale(1); setPan({ x: 0, y: 0 }); };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 60, backdropFilter: 'blur(6px)' }} />
      <div
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => { if (!dragging.current) onClose(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 61, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: scale > 1 ? (dragging.current ? 'grabbing' : 'grab') : 'default' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url} alt="확대 이미지"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.preventDefault()}
          draggable={false}
          style={{
            maxWidth: '90vw', maxHeight: '90vh',
            borderRadius: '10px', boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: dragging.current ? 'none' : 'transform 0.15s ease',
            userSelect: 'none', pointerEvents: 'none',
          }}
        />
      </div>
      <div style={{ position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)', zIndex: 62, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(30,30,40,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '12px', padding: '8px 16px', color: 'white' }}>
        <button onClick={() => setScale(s => clampScale(s - 0.2))} style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'grid', placeItems: 'center', border: 'none', background: 'rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer', fontSize: '16px' }}>−</button>
        <span style={{ fontSize: '12.5px', fontWeight: 500, minWidth: '44px', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => clampScale(s + 0.2))} style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'grid', placeItems: 'center', border: 'none', background: 'rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer', fontSize: '16px' }}>+</button>
        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
        <button onClick={reset} style={{ fontSize: '11.5px', fontWeight: 500, color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>초기화</button>
        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
        <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'grid', placeItems: 'center', border: 'none', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
          <X size={13} />
        </button>
        <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>휠로 확대 · 드래그로 이동 · ESC 닫기</span>
      </div>
    </>
  );
}

// ── EditorDomainHeader ────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function EditorDomainHeader({ hostname, favicon }: { hostname: string; name: string | null; favicon: string | null }) {
  const displayName = hostnameToServiceName(hostname) || hostname;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      margin: '-24px 0 16px',
      padding: '5px 10px',
      background: '#F3F4F6',
      border: '1px solid #E5E7EB',
      borderRadius: '6px',
    }}>
      <DomainFaviconImg favicon={favicon} hostname={hostname} size={13} />
      <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>{displayName}</span>
      <span style={{ fontSize: '10.5px', color: '#9CA3AF' }}>{hostname}</span>
    </div>
  );
}

// ── DomainFaviconImg — DB값 → Google API → DuckDuckGo fallback ──
function DomainFaviconImg({ favicon, hostname, size }: { favicon: string | null | undefined; hostname: string | null | undefined; size: number }) {
  const [src, setSrc] = useState<string | null>(() => faviconUrl(favicon, hostname, size));
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '3px', background: '#E5E7EB', flexShrink: 0 }} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ borderRadius: '3px', flexShrink: 0 }}
      onError={() => {
        const fallback = faviconFallbackUrl(hostname);
        if (fallback && src !== fallback) {
          setSrc(fallback);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
