'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Trash2, RotateCcw } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

type Tool = 'select' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'highlight';
type Color = string;

export interface Annotation {
  id: string;
  type: 'arrow' | 'rect' | 'ellipse' | 'text' | 'highlight';
  x1: number; y1: number;   // 0–100 in viewBox coords
  x2: number; y2: number;
  text?: string;
  color: Color;
  strokeWidth: number;      // viewBox units (0.2–0.6 range)
}

interface ImageAnnotationEditorProps {
  imageUrl: string;
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  onClose: () => void;
}

// ── Constants ──────────────────────────────────────────────

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#111827'];
// strokeWidth stored in viewBox units (viewBox 0 0 100 100)
const STROKE_OPTIONS = [
  { label: 'thin',   value: 0.3 },
  { label: 'medium', value: 0.5 },
  { label: 'thick',  value: 0.9 },
];

const TOOL_CONFIG: Record<Tool, { label: string; icon: React.ReactNode }> = {
  select:    { label: '선택',    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3l14 9-7 1-4 7z"/></svg> },
  arrow:     { label: '화살표',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/></svg> },
  rect:      { label: '사각형',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
  ellipse:   { label: '원',      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="10" ry="7"/></svg> },
  text:      { label: '텍스트',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7"/><polyline points="3 7 5 5 7 7"/></svg> },
  highlight: { label: '형광펜',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg> },
};

function genId() { return Math.random().toString(36).slice(2, 9); }

// ── Main Component ─────────────────────────────────────────

export function ImageAnnotationEditor({ imageUrl, annotations, onChange, onClose }: ImageAnnotationEditorProps) {
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState<Color>('#EF4444');
  const [strokeIdx, setStrokeIdx] = useState(1); // medium default
  const [items, setItems] = useState<Annotation[]>(annotations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<Partial<Annotation> | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState('');

  const imgRef = useRef<HTMLImageElement>(null);
  const strokeWidth = STROKE_OPTIONS[strokeIdx].value;

  // Convert mouse event to viewBox (0-100) coords relative to image
  const toVB = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  }, []);

  // commitText is defined early so it can be referenced in handlers below
  const commitTextRef = useRef<() => void>(() => {});

  const commitText = useCallback(() => {
    setEditingTextId(prev => {
      if (!prev) return null;
      setItems(cur => cur
        .map(a => a.id === prev ? { ...a, text: textDraft } : a)
        .filter(a => !(a.id === prev && !textDraft.trim()))
      );
      setTextDraft('');
      return null;
    });
  }, [textDraft]);

  // Keep ref in sync so keyboard handler always calls latest
  useEffect(() => { commitTextRef.current = commitText; }, [commitText]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool === 'select') return;
    // If we were editing text, commit it first — then continue to place new annotation
    if (editingTextId) { commitTextRef.current(); }

    e.preventDefault();
    setSelectedId(null);
    const { x, y } = toVB(e);

    if (tool === 'text') {
      const newItem: Annotation = { id: genId(), type: 'text', x1: x, y1: y, x2: x, y2: y, text: '', color, strokeWidth };
      setItems(prev => [...prev, newItem]);
      setEditingTextId(newItem.id);
      setTextDraft('');
      return;
    }
    setDrawing({ type: tool as Annotation['type'], x1: x, y1: y, x2: x, y2: y, color, strokeWidth, id: genId() });
  }, [tool, color, strokeWidth, editingTextId, toVB]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing) return;
    const { x, y } = toVB(e);
    setDrawing(prev => prev ? { ...prev, x2: x, y2: y } : null);
  }, [drawing, toVB]);

  const finishDrawing = useCallback((e?: MouseEvent) => {
    setDrawing(prev => {
      if (!prev) return null;
      const dx = Math.abs((prev.x2 ?? 0) - (prev.x1 ?? 0));
      const dy = Math.abs((prev.y2 ?? 0) - (prev.y1 ?? 0));
      if (dx < 0.5 && dy < 0.5) return null; // discard tiny drag
      // If mouseup came from outside, update x2/y2 from the event
      if (e) {
        const img = imgRef.current;
        if (img) {
          const rect = img.getBoundingClientRect();
          const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
          const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
          const completed = { ...prev, x2: x, y2: y } as Annotation;
          setItems(cur => [...cur, completed]);
          return null;
        }
      }
      setItems(cur => [...cur, prev as Annotation]);
      return null;
    });
  }, []);

  // Bug fix #1: attach mouseup to window so releasing outside container still commits
  useEffect(() => {
    if (!drawing) return;
    const up = (e: MouseEvent) => finishDrawing(e);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [drawing, finishDrawing]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setItems(prev => prev.filter(a => a.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingTextId) commitTextRef.current();
        else setSelectedId(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingTextId) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, editingTextId, deleteSelected]);

  const handleSave = () => {
    if (editingTextId) commitTextRef.current();
    onChange(items);
    onClose();
  };

  const cursor = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column' }}>
      {/* ── Top toolbar ── */}
      <div style={{ height: '52px', flexShrink: 0, background: '#1F2937', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '4px', padding: '0 16px' }}>

        {/* Tools */}
        <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '3px' }}>
          {(Object.keys(TOOL_CONFIG) as Tool[]).map(t => {
            const active = tool === t;
            return (
              <button key={t} title={TOOL_CONFIG[t].label}
                onClick={() => { if (editingTextId) commitTextRef.current(); setTool(t); }}
                style={{ width: '34px', height: '34px', borderRadius: '6px', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', background: active ? 'white' : 'transparent', color: active ? '#111827' : 'rgba(255,255,255,0.6)', transition: 'all 0.12s' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                {TOOL_CONFIG[t].icon}
              </button>
            );
          })}
        </div>

        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.12)', margin: '0 8px' }} />

        {/* Colors */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, border: color === c ? '2.5px solid white' : '2px solid transparent', cursor: 'pointer', flexShrink: 0, transition: 'border 0.1s', outline: 'none' }}
            />
          ))}
        </div>

        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.12)', margin: '0 8px' }} />

        {/* Stroke width */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {STROKE_OPTIONS.map((opt, i) => (
            <button key={i} onClick={() => setStrokeIdx(i)}
              style={{ width: '32px', height: '28px', borderRadius: '5px', border: strokeIdx === i ? '1.5px solid white' : '1.5px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
            >
              <div style={{ width: '14px', height: `${i * 2 + 2}px`, background: 'white', borderRadius: '2px' }} />
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <button onClick={() => setItems(prev => prev.slice(0, -1))} title="마지막 취소"
          style={{ height: '34px', padding: '0 12px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <RotateCcw size={12} /> 되돌리기
        </button>

        {selectedId && (
          <button onClick={deleteSelected} title="선택 삭제"
            style={{ height: '34px', padding: '0 12px', borderRadius: '7px', border: '1px solid rgba(220,38,38,0.4)', background: 'rgba(220,38,38,0.1)', color: '#FCA5A5', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', marginLeft: '4px' }}
          >
            <Trash2 size={12} /> 삭제
          </button>
        )}

        <button onClick={onClose}
          style={{ height: '34px', padding: '0 14px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '12.5px', cursor: 'pointer', marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <X size={13} /> 닫기
        </button>

        <button onClick={handleSave}
          style={{ height: '34px', padding: '0 18px', borderRadius: '7px', border: 'none', background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', color: 'white', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', marginLeft: '6px' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(79,70,229,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
        >
          저장
        </button>
      </div>

      {/* ── Canvas area ── */}
      <div
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', overflow: 'auto' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        // onMouseUp handled by window listener (bug fix #1)
      >
        <div style={{ position: 'relative', display: 'inline-block', userSelect: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="편집 중"
            draggable={false}
            style={{ display: 'block', maxWidth: 'min(900px, calc(100vw - 64px))', maxHeight: 'calc(100vh - 120px)', borderRadius: '6px' }}
          />

          {/* SVG overlay — viewBox="0 0 100 100" so coords and strokeWidth share the same unit system */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor, overflow: 'visible' }}
          >
            {items.map(a => (
              <AnnotationShape
                key={a.id}
                annotation={a}
                isSelected={selectedId === a.id}
                isEditingText={editingTextId === a.id}
                textDraft={editingTextId === a.id ? textDraft : undefined}
                onTextChange={setTextDraft}
                onCommitText={commitText}
                onSelect={() => { if (tool === 'select') setSelectedId(a.id); }}
              />
            ))}
            {drawing && (
              <AnnotationShape annotation={drawing as Annotation} isSelected={false} isEditingText={false} />
            )}
          </svg>
        </div>
      </div>

      <div style={{ height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
        {tool === 'text' ? '클릭한 위치에 텍스트 박스가 생깁니다' :
         tool === 'select' ? '어노테이션을 클릭해 선택 · Delete로 삭제' :
         '클릭 후 드래그하여 그립니다'}
      </div>
    </div>
  );
}

// ── AnnotationShape ────────────────────────────────────────

interface AnnotationShapeProps {
  annotation: Annotation;
  isSelected: boolean;
  isEditingText: boolean;
  textDraft?: string;
  onTextChange?: (v: string) => void;
  onCommitText?: () => void;
  onSelect?: () => void;
}

function TextInput({ x, y, color, value, onChange, onCommit }: {
  x: number; y: number; color: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Bug fix #4: explicit focus via setTimeout avoids foreignObject autoFocus issues
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <foreignObject x={x} y={y} width="35" height="8">
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onCommit(); } e.stopPropagation(); }}
        onMouseDown={e => e.stopPropagation()}
        style={{
          background: 'rgba(0,0,0,0.6)', color, border: `1.5px solid ${color}`, borderRadius: '2px',
          padding: '1px 3px', fontSize: '3px', fontWeight: 600, outline: 'none',
          width: '100%', fontFamily: 'inherit', boxSizing: 'border-box',
        }}
      />
    </foreignObject>
  );
}

function AnnotationShape({ annotation: a, isSelected, isEditingText, textDraft, onTextChange, onCommitText, onSelect }: AnnotationShapeProps) {
  const { type, x1, y1, x2, y2, color, strokeWidth, text } = a;

  const selStyle: React.SVGProps<SVGRectElement> = {
    stroke: '#60A5FA', strokeWidth: 0.3, strokeDasharray: '1.5 0.8', fill: 'none',
  };

  const minX = Math.min(x1, x2), minY = Math.min(y1, y2);
  const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
  const clickable = { style: { cursor: onSelect ? 'pointer' : 'crosshair' } as React.CSSProperties, onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSelect?.(); } };

  if (type === 'highlight') return (
    <g>
      <rect x={minX} y={minY} width={w} height={h} fill={color} opacity={0.35} rx={0.5} {...clickable} />
      {isSelected && <rect x={minX - 0.4} y={minY - 0.4} width={w + 0.8} height={h + 0.8} {...selStyle} />}
    </g>
  );

  if (type === 'rect') return (
    <g>
      <rect x={minX} y={minY} width={w} height={h} rx={0.3} stroke={color} strokeWidth={strokeWidth} fill="none" {...clickable} />
      {isSelected && <rect x={minX - 0.4} y={minY - 0.4} width={w + 0.8} height={h + 0.8} {...selStyle} />}
    </g>
  );

  if (type === 'ellipse') return (
    <g>
      <ellipse cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} rx={w / 2} ry={h / 2} stroke={color} strokeWidth={strokeWidth} fill="none" {...clickable} />
      {isSelected && <rect x={minX - 0.4} y={minY - 0.4} width={w + 0.8} height={h + 0.8} {...selStyle} />}
    </g>
  );

  if (type === 'arrow') {
    const markerId = `arrow-${a.id}`;
    return (
      <g>
        <defs>
          <marker id={markerId} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,4 L4,2 z" fill={color} />
          </marker>
        </defs>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={strokeWidth} markerEnd={`url(#${markerId})`} strokeLinecap="round" {...clickable} />
        {isSelected && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#60A5FA" strokeWidth={strokeWidth + 0.2} strokeDasharray="1.5 0.8" fill="none" pointerEvents="none" />}
      </g>
    );
  }

  if (type === 'text') {
    if (isEditingText && onTextChange && onCommitText) {
      return <TextInput x={x1} y={y1} color={color} value={textDraft ?? ''} onChange={onTextChange} onCommit={onCommitText} />;
    }
    if (!text) return null;
    // fontSize in viewBox units — 2.5 ≈ readable at normal image sizes
    return (
      <g>
        <text
          x={x1} y={y1}
          fill={color} fontSize={2.5} fontWeight="700" dominantBaseline="text-before-edge"
          stroke="rgba(0,0,0,0.55)" strokeWidth={0.4}
          style={{ cursor: onSelect ? 'pointer' : 'default', paintOrder: 'stroke' }}
          onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
        >
          {text}
        </text>
        {isSelected && (
          <rect x={x1 - 0.3} y={y1 - 0.3} width={text.length * 1.5 + 1} height={3.5} {...selStyle} />
        )}
      </g>
    );
  }

  return null;
}
