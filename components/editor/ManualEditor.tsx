'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, ZoomIn, X, Pencil,
  Bold, Italic, Underline, Sparkles, Loader2,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { ImageAnnotationEditor, type Annotation } from './ImageAnnotationEditor';
import { AnnotationPreview } from './AnnotationPreview';

export interface ManualStep {
  id: string;
  number: number;
  actionTitle: string;
  description: string;       // stored as HTML string
  screenshotUrl?: string;
  annotations?: Annotation[];
  domain_name?: string | null;
  domain_favicon?: string | null;
  click_x?: number | null;   // 0-100 pct, for auto-zoom in annotation editor
  click_y?: number | null;
}

interface ManualEditorProps {
  steps: ManualStep[];
  onChange: (steps: ManualStep[]) => void;
  onSave?: (id: string, patch: Partial<ManualStep>) => void;
  // When true, hides the internal TOC sidebar (used when parent provides its own TOC)
  hideToc?: boolean;
  // Expose scroll-to-step so parent TOC can drive navigation
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
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
    setDraggingId(null); setDragOverId(null);
  };

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
      {/* ── Left TOC (hidden when parent provides its own) ── */}
      <aside style={{ width: '220px', flexShrink: 0, background: 'white', borderRight: '1px solid #E5E7EB', display: hideToc ? 'none' : 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '16px 16px 10px', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          목차
        </div>
        <div style={{ flex: 1, padding: '8px 0' }}>
          {steps.map(step => (
            <TocItem
              key={step.id}
              step={step}
              isActive={activeId === step.id}
              isDragOver={dragOverId === step.id && draggingId !== step.id}
              onSelect={() => scrollToStep(step.id)}
              onRename={title => updateStep(step.id, { actionTitle: title })}
              onDragStart={() => handleDragStart(step.id)}
              onDragOver={e => handleDragOver(e, step.id)}
              onDrop={() => handleDrop(step.id)}
              onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
            />
          ))}
        </div>
        <div style={{ padding: '8px 12px 16px', borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
          <button
            onClick={addStep}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '36px', border: '1.5px dashed #D1D5DB', borderRadius: '8px', background: 'transparent', fontSize: '12px', color: '#6B7280', cursor: 'pointer', transition: 'all 0.15s ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.color = '#4F46E5'; e.currentTarget.style.background = 'rgba(79,70,229,0.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Plus size={13} /> 단계 추가
          </button>
        </div>
      </aside>

      {/* ── Right content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 0 80px', background: '#F8F9FA' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 40px' }}>
          {steps.map((step, idx) => {
            const prevDomain = idx > 0 ? steps[idx - 1].domain_name : null;
            const showDomainHeader = !!step.domain_name && step.domain_name !== prevDomain;
            return (
              <div key={step.id}>
                {showDomainHeader && (
                  <EditorDomainHeader name={step.domain_name!} favicon={step.domain_favicon ?? null} />
                )}
                <div
                  ref={el => { contentRefs.current[step.id] = el; }}
                  style={{ marginBottom: '48px', scrollMarginTop: '24px' }}
                >
                  <StepCard
                    step={step}
                    isActive={activeId === step.id}
                    onFocus={() => setActiveId(step.id)}
                    onUpdate={patch => updateStep(step.id, patch)}
                    onSave={patch => { updateStep(step.id, patch); onSave?.(step.id, patch); }}
                    onDelete={() => deleteStep(step.id)}
                    onZoom={() => step.screenshotUrl && setZoomUrl(step.screenshotUrl)}
                    onAnnotate={() => step.screenshotUrl && setAnnotatingId(step.id)}
                  />
                </div>
              </div>
            );
          })}
          <button
            onClick={addStep}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', height: '52px', border: '2px dashed #D1D5DB', borderRadius: '12px', background: 'transparent', fontSize: '13.5px', color: '#6B7280', cursor: 'pointer', transition: 'all 0.18s ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.color = '#4F46E5'; e.currentTarget.style.background = 'rgba(79,70,229,0.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Plus size={15} /> 단계 추가
          </button>
        </div>
      </div>

      {zoomUrl && <ImageZoomModal url={zoomUrl} onClose={() => setZoomUrl(null)} />}

      {annotatingId && (() => {
        const step = steps.find(s => s.id === annotatingId)!;
        return (
          <ImageAnnotationEditor
            imageUrl={step.screenshotUrl!}
            annotations={step.annotations ?? []}
            initialFocusX={step.click_x ?? 50}
            initialFocusY={step.click_y ?? 50}
            onChange={annotations => {
              updateStep(annotatingId, { annotations });
              onSave?.(annotatingId, { annotations });
            }}
            onClose={() => setAnnotatingId(null)}
          />
        );
      })()}
    </div>
  );
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
        background: isDragOver ? 'rgba(79,70,229,0.06)' : isActive ? '#EEF2FF' : 'transparent',
        borderLeft: `3px solid ${isDragOver || isActive ? '#4F46E5' : 'transparent'}`,
        borderTop: isDragOver ? '2px solid #4F46E5' : '2px solid transparent',
        cursor: editing ? 'text' : 'grab', transition: 'background 0.15s ease', userSelect: 'none',
      }}
      onMouseEnter={e => { if (!isActive && !isDragOver) e.currentTarget.style.background = '#F9FAFB'; }}
      onMouseLeave={e => { if (!isActive && !isDragOver) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ color: '#CBD5E1', fontSize: '10px', lineHeight: 1.6, flexShrink: 0, cursor: 'grab', letterSpacing: '-1px' }}>⠿</span>
      <span style={{ fontSize: '11px', fontWeight: 600, color: isActive ? '#4F46E5' : '#9CA3AF', minWidth: '20px', flexShrink: 0, lineHeight: 1.6 }}>
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
          style={{ flex: 1, fontSize: '12.5px', fontWeight: 500, color: '#111827', border: '1px solid #4F46E5', borderRadius: '4px', padding: '1px 6px', outline: 'none', background: 'white', lineHeight: 1.5 }}
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

  onFocus: () => void;
  onUpdate: (patch: Partial<ManualStep>) => void;
  onSave: (patch: Partial<ManualStep>) => void;
  onDelete: () => void;
  onZoom: () => void;
  onAnnotate: () => void;
}

function StepCard({ step, isActive, onFocus, onUpdate, onSave, onDelete, onZoom, onAnnotate }: StepCardProps) {
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
        border: `1.5px solid ${isActive ? '#F59E0B' : '#E5E7EB'}`,
        boxShadow: isActive ? '0 0 0 3px rgba(245,158,11,0.10), 0 4px 16px rgba(17,24,39,0.06)' : '0 1px 4px rgba(17,24,39,0.04)',
        transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
        overflow: 'hidden',
      }}
    >
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />

      {/* ── Always-visible text format toolbar ── */}
      <TextFormatToolbar editorRef={editorRef} />

      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '12px 20px 16px' }}>
        {/* Step badge */}
        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#F59E0B', color: 'white', fontSize: '13px', fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: '1px' }}>
          {String(step.number).padStart(2, '0')}
        </div>

        {/* Title + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <input
            value={step.actionTitle}
            onChange={e => onUpdate({ actionTitle: e.target.value })}
            onFocus={onFocus}
            onBlur={e => { e.currentTarget.style.background = 'transparent'; handleTitleBlur(e); }}
            placeholder="단계 제목을 입력하세요"
            style={{
              width: '100%', fontSize: '15px', fontWeight: 600, color: '#111827',
              background: 'transparent', border: 'none', outline: 'none',
              padding: '3px 6px', margin: '0 -6px',
              lineHeight: 1.4, borderRadius: '6px', cursor: 'text',
              transition: 'background 0.15s ease', boxSizing: 'border-box',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; }}
            onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.background = 'transparent'; }}
          />

          {/* Rich text description (contenteditable) */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onFocus={onFocus}
            onInput={handleEditorInput}
            onBlur={e => { e.currentTarget.style.background = 'transparent'; handleEditorBlur(); }}
            data-placeholder="이 단계에 대한 설명을 입력하세요."
            style={{
              width: '100%', marginTop: '6px',
              fontSize: '13.5px', color: '#4B5563',
              lineHeight: 1.6, fontFamily: 'inherit',
              minHeight: '24px',
              outline: 'none',
              borderRadius: '6px',
              padding: '3px 6px', margin: '6px -6px 0',
              cursor: 'text',
              transition: 'background 0.15s ease',
              boxSizing: 'border-box',
            } as React.CSSProperties}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; }}
            onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.background = 'transparent'; }}
          />
        </div>

        {/* Right action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', opacity: showControls ? 1 : 0, transition: 'opacity 0.18s ease', flexShrink: 0 }}>
          {step.screenshotUrl && (
            <button title="이미지 확대" onClick={onZoom} style={iconBtn}>
              <ZoomIn size={13} />
            </button>
          )}
          <button onClick={onDelete} title="삭제" style={iconBtn}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#DC2626'; e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = 'rgba(220,38,38,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = 'white'; }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Screenshot area */}
      <ScreenshotArea
        step={step}
        onUploadClick={() => fileInputRef.current?.click()}
        onDrop={handleImgDrop}
        onZoom={onZoom}
        onAnnotate={onAnnotate}
      />
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: '30px', height: '30px', display: 'grid', placeItems: 'center',
  borderRadius: '8px', border: '1px solid #E5E7EB',
  background: 'white', color: '#6B7280', cursor: 'pointer',
};

// ── TextFormatToolbar (always visible, uses execCommand) ──

const AI_ACTIONS = [
  { label: '문장 다듬기', instruction: '더 자연스럽고 읽기 쉽게 다듬어줘' },
  { label: '맞춤법 교정', instruction: '맞춤법과 띄어쓰기를 교정해줘' },
  { label: '간략하게', instruction: '핵심만 남기고 간략하게 요약해줘' },
] as const;

type ActiveState = { bold: boolean; italic: boolean; underline: boolean };

function TextFormatToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement> }) {
  const [active, setActive] = useState<ActiveState>({
    bold: false, italic: false, underline: false,
  });
  const [aiLoading, setAiLoading] = useState<string | null>(null);

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

  const handleAiRewrite = async (instruction: string, label: string) => {
    const el = editorRef.current;
    if (!el) return;
    const text = el.innerText.trim();
    if (!text) return;
    setAiLoading(label);
    try {
      const res = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, instruction }),
      });
      const { result } = await res.json();
      if (result) {
        el.innerText = result;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    } finally {
      setAiLoading(null);
    }
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '2px',
        padding: '8px 14px',
        borderBottom: '1px solid #F3F4F6',
        background: '#FAFAFA',
        flexWrap: 'wrap',
      }}
    >
      {/* Font size dropdown */}
      <select
        defaultValue="3"
        onChange={e => exec('fontSize', e.target.value)}
        style={{
          fontSize: '11.5px', color: '#374151', background: 'white',
          border: '1px solid #E5E7EB', borderRadius: '5px',
          padding: '3px 6px', cursor: 'pointer', marginRight: '6px',
          outline: 'none',
        }}
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

      <ToolBtn title="굵게 (Ctrl+B)" isActive={active.bold} onMouseDown={e => { e.preventDefault(); exec('bold'); }}>
        <Bold size={13} />
      </ToolBtn>
      <ToolBtn title="기울임 (Ctrl+I)" isActive={active.italic} onMouseDown={e => { e.preventDefault(); exec('italic'); }}>
        <Italic size={13} />
      </ToolBtn>
      <ToolBtn title="밑줄 (Ctrl+U)" isActive={active.underline} onMouseDown={e => { e.preventDefault(); exec('underline'); }}>
        <Underline size={13} />
      </ToolBtn>

      <Divider />

      {/* AI rewrite buttons */}
      <Sparkles size={12} style={{ color: '#7C3AED', marginLeft: '2px', flexShrink: 0 }} />
      {AI_ACTIONS.map(({ label, instruction }) => (
        <button
          key={label}
          disabled={!!aiLoading}
          onClick={() => handleAiRewrite(instruction, label)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            height: '26px', padding: '0 9px',
            borderRadius: '5px',
            border: '1px solid #EDE9FE',
            background: aiLoading === label ? '#EDE9FE' : 'white',
            color: '#7C3AED',
            fontSize: '11.5px', fontWeight: 500,
            cursor: aiLoading ? 'not-allowed' : 'pointer',
            opacity: aiLoading && aiLoading !== label ? 0.45 : 1,
            transition: 'all 0.12s ease',
            flexShrink: 0,
          }}
          onMouseEnter={e => { if (!aiLoading) { e.currentTarget.style.background = '#EDE9FE'; } }}
          onMouseLeave={e => { if (aiLoading !== label) e.currentTarget.style.background = 'white'; }}
        >
          {aiLoading === label
            ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
            : null}
          {label}
        </button>
      ))}
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
        borderRadius: '6px', border: `1px solid ${isActive ? '#4F46E5' : 'transparent'}`,
        background: isActive ? '#EEF2FF' : 'transparent',
        color: isActive ? '#4F46E5' : '#4B5563',
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
  onZoom: () => void;
  onAnnotate: () => void;
}

function ScreenshotArea({ step, onUploadClick, onDrop, onZoom, onAnnotate }: ScreenshotAreaProps) {
  const [dragOver, setDragOver] = useState(false);
  const [imgHover, setImgHover] = useState(false);

  if (!step.screenshotUrl) {
    return (
      <div
        onClick={onUploadClick}
        onDrop={e => { setDragOver(false); onDrop(e); }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        style={{
          margin: '0 20px 20px', height: '200px',
          background: dragOver ? 'rgba(79,70,229,0.04)' : '#F9FAFB',
          border: `1.5px dashed ${dragOver ? '#4F46E5' : '#D1D5DB'}`,
          borderRadius: '8px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '10px', color: dragOver ? '#4F46E5' : '#9CA3AF',
          fontSize: '12.5px', cursor: 'pointer', transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => { if (!dragOver) { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.color = '#4F46E5'; e.currentTarget.style.background = 'rgba(79,70,229,0.03)'; } }}
        onMouseLeave={e => { if (!dragOver) { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = '#F9FAFB'; } }}
      >
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: dragOver ? 'rgba(79,70,229,0.10)' : '#F3F4F6', display: 'grid', placeItems: 'center', transition: 'background 0.15s' }}>
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
      style={{ margin: '0 20px 20px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E5E7EB', position: 'relative' }}
      onMouseEnter={() => setImgHover(true)}
      onMouseLeave={() => setImgHover(false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={step.screenshotUrl} alt={step.actionTitle} style={{ width: '100%', display: 'block' }} />

      {/* Annotation SVG overlay (read-only preview) */}
      {hasAnnotations && (
        <AnnotationPreview annotations={step.annotations!} imageUrl={step.screenshotUrl!} />
      )}

      {/* Hover overlay */}
      {imgHover && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,15,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <button
            onClick={e => { e.stopPropagation(); onAnnotate(); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'white', color: '#111827', border: 'none', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}
          >
            <Pencil size={13} /> {hasAnnotations ? '편집' : '이미지 편집'}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onZoom(); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}
          >
            <ZoomIn size={13} /> 확대
          </button>
        </div>
      )}
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

function EditorDomainHeader({ name, favicon }: { name: string; favicon: string | null }) {
  const [faviconOk, setFaviconOk] = useState(true);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      margin: '-24px 0 16px',
      padding: '5px 10px',
      background: '#F3F4F6',
      border: '1px solid #E5E7EB',
      borderRadius: '6px',
    }}>
      {favicon && faviconOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={favicon} alt="" width={13} height={13} style={{ flexShrink: 0 }} onError={() => setFaviconOk(false)} />
      )}
      <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', letterSpacing: '0.02em' }}>{name}</span>
    </div>
  );
}
