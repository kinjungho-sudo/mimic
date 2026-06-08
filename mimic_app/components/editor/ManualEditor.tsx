'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, ZoomIn, X,
  Bold, Italic, Underline, ExternalLink, Sparkles, Loader2,
  Check,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { ImageAnnotationEditor, type Annotation } from './ImageAnnotationEditor';
import { AnnotationPreview } from './AnnotationPreview';
import { faviconUrl, faviconFallbackUrl, hostnameToServiceName } from '@/lib/favicon';

export interface ManualStep {
  id: string;
  number: number;
  actionTitle: string;
  description: string;       // stored as HTML string
  screenshotUrl?: string;
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
  crop_rect?: { x: number; y: number; w: number; h: number } | null;
  imageZoom?: number;
}

interface ManualEditorProps {
  steps: ManualStep[];
  onChange: (steps: ManualStep[]) => void;
  onSave?: (id: string, patch: Partial<ManualStep>) => void;
  hideToc?: boolean;
  activeId?: string | null;
}

// ── ManualEditor ──────────────────────────────────────────

export function ManualEditor({ steps, onChange, onSave, hideToc, activeId: externalActiveId }: ManualEditorProps) {
  const [internalActiveId, setInternalActiveId] = useState<string | null>(
    steps.length > 0 ? steps[0].id : null
  );
  const activeId = hideToc ? (externalActiveId ?? internalActiveId) : internalActiveId;
  const setActiveId = setInternalActiveId;
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [annotatingId, setAnnotatingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAiLoading, setBulkAiLoading] = useState<string | null>(null);
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!internalActiveId && steps.length > 0) setActiveId(steps[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  // When parent TOC drives navigation, scroll to the step
  useEffect(() => {
    if (!hideToc || !externalActiveId) return;
    contentRefs.current[externalActiveId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalActiveId]);

  const updateStep = (id: string, patch: Partial<ManualStep>) =>
    onChange(steps.map(s => s.id === id ? { ...s, ...patch } : s));

  const deleteStep = (id: string) => {
    const next = steps.filter(s => s.id !== id).map((s, i) => ({ ...s, number: i + 1 }));
    onChange(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

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

  const bulkAiRewrite = async (instruction: string, label: string) => {
    // 전체 스텝을 순서대로 보내되, 선택된 것만 실제로 교체
    const allWithText = steps.map(s => ({
      id: s.id,
      text: s.description.replace(/<[^>]+>/g, '').trim(),
    }));
    const targets = allWithText.filter(s => selectedIds.has(s.id) && s.text);
    if (!targets.length) return;
    setBulkAiLoading(label);
    try {
      const res = await fetch('/api/ai/rewrite-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: allWithText, instruction }),
      });
      const { results } = await res.json();
      if (!Array.isArray(results)) return;
      // 선택된 스텝만 업데이트
      const updated = new Map(
        results
          .filter((r: { id: string; result: string }) => selectedIds.has(r.id) && r.result)
          .map((r: { id: string; result: string }) => [r.id, r.result])
      );
      const next = steps.map(s => updated.has(s.id) ? { ...s, description: updated.get(s.id)! } : s);
      onChange(next);
      next.filter(s => updated.has(s.id)).forEach(s => onSave?.(s.id, { description: s.description }));
    } finally {
      setBulkAiLoading(null);
    }
  };

  const addStep = () => {
    const newStep: ManualStep = {
      id: `step-${Date.now()}`,
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
            {steps.map((step, idx) => {
              const prevHostname = idx > 0 ? steps[idx - 1].domainHostname : null;
              const showHeader = !!step.domainHostname && step.domainHostname !== prevHostname;
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
            })}
          </div>
          <div style={{ padding: '8px 12px 16px', borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
            <button
              onClick={addStep}
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
                if (!window.confirm(`선택한 ${selectedIds.size}개 단계를 삭제할까요?`)) return;
                const next = steps.filter(s => !selectedIds.has(s.id)).map((s, i) => ({ ...s, number: i + 1 }));
                onChange(next); clearSelection();
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '26px', padding: '0 10px', borderRadius: '5px', border: '1px solid #FEE2E2', background: 'white', color: '#EF4444', fontSize: '11.5px', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}
            >
              <Trash2 size={11} /> 삭제
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
                <div style={{ width: '100%', maxWidth: '720px', padding: '0 20px', boxSizing: 'border-box' }}>
                  <StepCard
                    step={step}
                    isActive={activeId === step.id}
                    isSelected={selectedIds.has(step.id)}
                    onToggleSelect={() => toggleSelect(step.id)}
                    onFocus={() => setActiveId(step.id)}
                    onUpdate={patch => updateStep(step.id, patch)}
                    onSave={patch => { updateStep(step.id, patch); onSave?.(step.id, patch); }}
                    onDelete={() => deleteStep(step.id)}
                    onZoom={() => step.screenshotUrl && setZoomUrl(step.screenshotUrl)}
                    onAnnotate={() => step.screenshotUrl && setAnnotatingId(step.id)}
                    onRemoveImage={() => { updateStep(step.id, { screenshotUrl: undefined, annotations: [] }); onSave?.(step.id, { screenshotUrl: undefined, annotations: [] }); }}
                  />
                </div>
              </div>
            ))
          )}

          {/* 위/아래 이동 플로팅 버튼 — sticky로 scroll-snap 컨테이너 안에 고정 */}
          <div style={{ position: 'sticky', bottom: '16px', display: 'flex', justifyContent: 'flex-end', paddingRight: '20px', pointerEvents: 'none', zIndex: 20, scrollSnapAlign: 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', pointerEvents: 'auto' }}>
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

          {/* 단계 추가 버튼 — 마지막 스텝 아래 */}
          <div style={{ scrollSnapAlign: 'none', display: 'flex', justifyContent: 'center', padding: '20px 0 40px' }}>
            <button
              onClick={addStep}
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
        const initialAnnotations = (step.annotations && step.annotations.length > 0)
          ? step.annotations
          : buildInputAnnotation(step);
        return (
          <ImageAnnotationEditor
            imageUrl={step.screenshotUrl!}
            annotations={initialAnnotations}
            initialFocusX={step.click_x ?? 50}
            initialFocusY={step.click_y ?? 50}
            onChange={annotations => {
              // 함수형 업데이트로 stale closure 방지
              const id = annotatingId;
              onChange(steps.map(s => s.id === id ? { ...s, annotations } : s));
              onSave?.(id, { annotations });
            }}
            onClose={() => setAnnotatingId(null)}
          />
        );
      })()}
    </div>
  );
}

// ── 입력 필드 annotation 자동 생성 ────────────────────────
// element_rect(0-1)가 있을 때 화살표 + "내용 입력" 텍스트를 자동으로 배치
function buildInputAnnotation(step: ManualStep): Annotation[] {
  const r = step.element_rect;
  if (!r || r.width === 0 || r.height === 0) return [];

  // 0-1 → 0-100 변환
  const left   = r.x      * 100;
  void (r.y * 100); // top — 현재 미사용
  const right  = (r.x + r.width)  * 100;
  const bottom = (r.y + r.height) * 100;
  const centerX = (left + right) / 2;

  // 라벨 텍스트: actionTitle이 있으면 사용, 없으면 기본값
  const labelText = step.actionTitle
    ? step.actionTitle.replace(/^입력,?\s*/i, '').trim() || '내용 입력'
    : '내용 입력';

  // 화살표: 필드 중앙 아래 20% 지점에서 필드 하단 중앙으로
  const arrowStartY = Math.min(bottom + 18, 95);
  const arrowEndY   = bottom + 2;

  const arrowId = Math.random().toString(36).slice(2, 9);
  const textId  = Math.random().toString(36).slice(2, 9);

  const arrow: Annotation = {
    id: arrowId,
    type: 'arrow',
    x1: centerX, y1: arrowStartY,
    x2: centerX, y2: arrowEndY,
    color: '#3B82F6',
    strokeWidth: 0.5,
  };

  // 텍스트 박스: 화살표 시작점 바로 아래
  const textTop  = arrowStartY + 1;
  const textLeft = Math.max(2, centerX - 12);
  const textRight = Math.min(98, centerX + 12);

  const text: Annotation = {
    id: textId,
    type: 'text',
    x1: textLeft, y1: textTop,
    x2: textRight, y2: textTop + 8,
    text: labelText,
    color: '#FFFFFF',
    borderColor: 'transparent',
    strokeWidth: 0.25,
    fontSize: 14,
    fontBold: true,
    textAlign: 'center',
    hasBg: true,
  };

  return [arrow, text];
}

// ── TocItem ───────────────────────────────────────────────

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
  onZoom: () => void;
  onAnnotate: () => void;
  onRemoveImage: () => void;
}

function StepCard({ step, isActive, isSelected, onToggleSelect, onFocus, onUpdate, onSave, onDelete, onZoom, onAnnotate, onRemoveImage }: StepCardProps) {
  const [hovering, setHovering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const showControls = hovering || isActive;

  const handleImageUpload = useCallback((file: File) => {
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
      <TextFormatToolbar editorRef={editorRef} />

      {/* Card header */}
      <div style={{ padding: '8px 36px 8px 20px' }}>
        {/* Number + Title + 우측 아이콘 가로 행 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#F59E0B', flexShrink: 0, lineHeight: 1.4 }}>
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
            value={step.actionTitle}
            onChange={e => onUpdate({ actionTitle: e.target.value })}
            onFocus={onFocus}
            onBlur={e => { e.currentTarget.style.background = 'transparent'; handleTitleBlur(e); }}
            placeholder="단계 제목을 입력하세요"
            style={{
              flex: 1, fontSize: '13px', fontWeight: 600, color: '#111827',
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
                <ExternalLink size={13} />
              </button>
            )}
            {step.screenshotUrl && (
              <button title="이미지 확대" onClick={onZoom} style={iconBtnSm}
                onMouseEnter={e => { e.currentTarget.style.color = '#374151'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; }}
              >
                <ZoomIn size={13} />
              </button>
            )}
            <button onClick={onDelete} title="단계 삭제" style={iconBtnSm}
              onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Rich text description */}
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
            fontSize: '12.5px', color: '#4B5563',
            lineHeight: 1.5, fontFamily: 'inherit',
            minHeight: '20px',
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
      </div>

      {/* Screenshot area — 클릭하면 바로 편집 진입 */}
      <ScreenshotArea
        step={step}
        onUploadClick={() => fileInputRef.current?.click()}
        onDrop={handleImgDrop}
        onAnnotate={onAnnotate}
        onRemove={onRemoveImage}
        onZoomChange={zoom => { onUpdate({ imageZoom: zoom }); onSave({ imageZoom: zoom }); }}
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

function TextFormatToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement> }) {
  const [active, setActive] = useState<ActiveState>({ bold: false, italic: false, underline: false });

  const syncActive = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !editorRef.current?.contains(sel.anchorNode)) return;
    setActive({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
    });
  }, [editorRef]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.addEventListener('keyup', syncActive);
    el.addEventListener('mouseup', syncActive);
    document.addEventListener('selectionchange', syncActive);
    return () => {
      el.removeEventListener('keyup', syncActive);
      el.removeEventListener('mouseup', syncActive);
      document.removeEventListener('selectionchange', syncActive);
    };
  }, [editorRef, syncActive]);

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    requestAnimationFrame(syncActive);
    editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '8px 14px', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
      <select
        defaultValue="3"
        onChange={e => exec('fontSize', e.target.value)}
        style={{ fontSize: '11.5px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', borderRadius: '5px', padding: '3px 6px', cursor: 'pointer', marginRight: '6px', outline: 'none' }}
      >
        <option value="1">10px</option>
        <option value="2">12px</option>
        <option value="3">14px</option>
        <option value="4">16px</option>
        <option value="5">18px</option>
        <option value="6">24px</option>
        <option value="7">32px</option>
      </select>
      <Divider />
      <ToolBtn title="굵게 (Ctrl+B)" isActive={active.bold} onMouseDown={e => { e.preventDefault(); exec('bold'); }}><Bold size={13} /></ToolBtn>
      <ToolBtn title="기울임 (Ctrl+I)" isActive={active.italic} onMouseDown={e => { e.preventDefault(); exec('italic'); }}><Italic size={13} /></ToolBtn>
      <ToolBtn title="밑줄 (Ctrl+U)" isActive={active.underline} onMouseDown={e => { e.preventDefault(); exec('underline'); }}><Underline size={13} /></ToolBtn>
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
  onZoomChange: (zoom: number) => void;
}

function ScreenshotArea({ step, onUploadClick, onDrop, onAnnotate, onRemove, onZoomChange }: ScreenshotAreaProps) {
  const [dragOver, setDragOver] = useState(false);
  const [imgHover, setImgHover] = useState(false);
  const zoom = step.imageZoom ?? 1;
  const clampZoom = (z: number) => Math.round(Math.min(4, Math.max(1, z)) * 10) / 10;

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

  const hasAnnotations = (step.annotations?.length ?? 0) > 0;

  return (
    <div
      style={{ margin: '0 12px 12px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E5E7EB', position: 'relative', cursor: 'pointer' }}
      onMouseEnter={() => setImgHover(true)}
      onMouseLeave={() => setImgHover(false)}
      onClick={onAnnotate}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={step.screenshotUrl} alt={step.actionTitle} style={{ width: '100%', display: 'block' }} />

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

      {/* Annotation SVG overlay (read-only preview) */}
      {hasAnnotations && (
        <AnnotationPreview annotations={step.annotations!} imageUrl={step.screenshotUrl!} />
      )}

      {/* hover 시 편집 힌트 + 우측 상단 삭제 버튼 */}
      {imgHover && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'white', background: 'rgba(0,0,0,0.45)', padding: '4px 10px', borderRadius: '6px', backdropFilter: 'blur(4px)' }}>
              클릭하여 편집
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

      {/* 줌 컨트롤 — 뷰어 표시 배율 저장 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(20,20,30,0.72)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '3px', zIndex: 5 }}
      >
        <button onClick={() => onZoomChange(clampZoom(zoom - 0.5))} disabled={zoom <= 1} style={{ width: '24px', height: '24px', borderRadius: '5px', border: 'none', background: 'transparent', color: zoom <= 1 ? 'rgba(255,255,255,0.3)' : 'white', fontSize: '15px', cursor: zoom <= 1 ? 'not-allowed' : 'pointer', display: 'grid', placeItems: 'center', lineHeight: 1 }}>−</button>
        <span style={{ height: '24px', padding: '0 5px', color: 'white', fontSize: '10px', fontWeight: 500, display: 'flex', alignItems: 'center', minWidth: '32px', justifyContent: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => onZoomChange(clampZoom(zoom + 0.5))} disabled={zoom >= 4} style={{ width: '24px', height: '24px', borderRadius: '5px', border: 'none', background: 'transparent', color: zoom >= 4 ? 'rgba(255,255,255,0.3)' : 'white', fontSize: '15px', cursor: zoom >= 4 ? 'not-allowed' : 'pointer', display: 'grid', placeItems: 'center', lineHeight: 1 }}>+</button>
      </div>
    </div>
  );
}

// ── ImageZoomModal ────────────────────────────────────────

function ImageZoomModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setScale(s => Math.min(3, +(s + 0.2).toFixed(1)));
      if (e.key === '-') setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 60, backdropFilter: 'blur(6px)' }} />
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 61, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', overflow: 'auto' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url} alt="확대 이미지" onClick={e => e.stopPropagation()}
          style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '10px', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', transform: `scale(${scale})`, transformOrigin: 'center center', transition: 'transform 0.2s ease', cursor: 'default' }}
        />
      </div>
      <div style={{ position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)', zIndex: 62, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(30,30,40,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '12px', padding: '8px 16px', color: 'white' }}>
        <button onClick={() => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)))} style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'grid', placeItems: 'center', border: 'none', background: 'rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer', fontSize: '16px' }}>−</button>
        <span style={{ fontSize: '12.5px', fontWeight: 500, minWidth: '44px', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(1)))} style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'grid', placeItems: 'center', border: 'none', background: 'rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer', fontSize: '16px' }}>+</button>
        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
        <button onClick={() => setScale(1)} style={{ fontSize: '11.5px', fontWeight: 500, color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>초기화</button>
        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
        <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'grid', placeItems: 'center', border: 'none', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
          <X size={13} />
        </button>
        <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>ESC로 닫기</span>
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
