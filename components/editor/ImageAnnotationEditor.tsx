'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Trash2, RotateCcw } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

type Tool = 'select' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'highlight';
type Color = string;

export interface Annotation {
  id: string;
  type: 'arrow' | 'rect' | 'ellipse' | 'text' | 'highlight';
  x1: number; y1: number;   // % of image size
  x2: number; y2: number;
  text?: string;
  color: Color;
  strokeWidth: number;
}

interface ImageAnnotationEditorProps {
  imageUrl: string;
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  onClose: () => void;
}

// ── Constants ──────────────────────────────────────────────

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#111827'];
const STROKE_WIDTHS = [2, 3, 5];

const TOOL_CONFIG: Record<Tool, { label: string; icon: React.ReactNode }> = {
  select: { label: '선택', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3l14 9-7 1-4 7z"/></svg> },
  arrow:  { label: '화살표', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/></svg> },
  rect:   { label: '사각형', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
  ellipse:{ label: '원', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="10" ry="7"/></svg> },
  text:   { label: '텍스트', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7"/><polyline points="3 7 5 5 7 7"/></svg> },
  highlight: { label: '형광펜', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg> },
};

function genId() { return Math.random().toString(36).slice(2, 9); }

// ── Main Component ─────────────────────────────────────────

export function ImageAnnotationEditor({ imageUrl, annotations, onChange, onClose }: ImageAnnotationEditorProps) {
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState<Color>('#EF4444');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [items, setItems] = useState<Annotation[]>(annotations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<Partial<Annotation> | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState('');

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Convert mouse event to % coords relative to image
  const toPercent = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool === 'select') return;
    e.preventDefault();
    setSelectedId(null);
    if (editingTextId) { commitText(); return; }

    const { x, y } = toPercent(e);
    if (tool === 'text') {
      // Immediately place a text annotation
      const newItem: Annotation = { id: genId(), type: 'text', x1: x, y1: y, x2: x + 20, y2: y + 5, text: '', color, strokeWidth };
      setItems(prev => [...prev, newItem]);
      setEditingTextId(newItem.id);
      setTextDraft('');
      return;
    }
    setDrawing({ type: tool as Annotation['type'], x1: x, y1: y, x2: x, y2: y, color, strokeWidth, id: genId() });
  }, [tool, color, strokeWidth, editingTextId, toPercent]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing) return;
    const { x, y } = toPercent(e);
    setDrawing(prev => prev ? { ...prev, x2: x, y2: y } : null);
  }, [drawing, toPercent]);

  const handleMouseUp = useCallback(() => {
    if (!drawing) return;
    const dx = Math.abs((drawing.x2 ?? 0) - (drawing.x1 ?? 0));
    const dy = Math.abs((drawing.y2 ?? 0) - (drawing.y1 ?? 0));
    if (dx < 0.5 && dy < 0.5) { setDrawing(null); return; } // too small, discard
    const completed = drawing as Annotation;
    setItems(prev => [...prev, completed]);
    setDrawing(null);
  }, [drawing]);

  const commitText = useCallback(() => {
    if (!editingTextId) return;
    setItems(prev => prev.map(a =>
      a.id === editingTextId
        ? { ...a, text: textDraft }
        : a
    ).filter(a => !(a.id === editingTextId && !textDraft.trim())));
    setEditingTextId(null);
    setTextDraft('');
  }, [editingTextId, textDraft]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setItems(prev => prev.filter(a => a.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // Keyboard: Escape = deselect/close edit, Delete = remove selected
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (editingTextId) commitText(); else setSelectedId(null); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingTextId) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, editingTextId, commitText, deleteSelected]);

  const handleSave = () => {
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
              <button key={t} title={TOOL_CONFIG[t].label} onClick={() => { setTool(t); if (editingTextId) commitText(); }}
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
              style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, border: color === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer', flexShrink: 0, transition: 'border 0.1s', outline: 'none' }}
            />
          ))}
        </div>

        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.12)', margin: '0 8px' }} />

        {/* Stroke width */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {STROKE_WIDTHS.map(w => (
            <button key={w} onClick={() => setStrokeWidth(w)}
              style={{ width: '32px', height: '28px', borderRadius: '5px', border: strokeWidth === w ? '1.5px solid white' : '1.5px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
            >
              <div style={{ width: '14px', height: `${w}px`, background: 'white', borderRadius: '2px' }} />
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Undo last */}
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

        <button onClick={onClose} title="취소"
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
        ref={containerRef}
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', overflow: 'auto' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
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

          {/* SVG overlay */}
          <svg
            ref={svgRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor, overflow: 'visible' }}
          >
            {/* Saved annotations */}
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
            {/* In-progress drawing */}
            {drawing && (
              <AnnotationShape
                annotation={drawing as Annotation}
                isSelected={false}
                isEditingText={false}
              />
            )}
          </svg>
        </div>
      </div>

      {/* ── Hint ── */}
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

function AnnotationShape({ annotation: a, isSelected, isEditingText, textDraft, onTextChange, onCommitText, onSelect }: AnnotationShapeProps) {
  const { type, x1, y1, x2, y2, color, strokeWidth, text } = a;

  // Convert % to SVG viewBox coords (0-100)
  const selectionStyle: React.SVGProps<SVGRectElement> = {
    stroke: '#60A5FA', strokeWidth: 1, strokeDasharray: '4 2', fill: 'none',
  };

  const minX = Math.min(x1, x2), minY = Math.min(y1, y2);
  const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);

  const sharedProps = {
    stroke: color,
    strokeWidth: strokeWidth * 0.12, // scale to % coords
    fill: 'none',
    style: { cursor: onSelect ? 'pointer' : 'crosshair' } as React.CSSProperties,
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSelect?.(); },
  };

  if (type === 'highlight') {
    return (
      <g>
        <rect
          x={`${minX}%`} y={`${minY}%`} width={`${w}%`} height={`${h}%`}
          fill={color} opacity={0.35} rx="2%"
          style={{ cursor: onSelect ? 'pointer' : 'crosshair' }}
          onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
        />
        {isSelected && <rect x={`${minX - 0.5}%`} y={`${minY - 0.5}%`} width={`${w + 1}%`} height={`${h + 1}%`} {...selectionStyle} />}
      </g>
    );
  }

  if (type === 'rect') {
    return (
      <g>
        <rect x={`${minX}%`} y={`${minY}%`} width={`${w}%`} height={`${h}%`} rx="0.5%" {...sharedProps} />
        {isSelected && <rect x={`${minX - 0.5}%`} y={`${minY - 0.5}%`} width={`${w + 1}%`} height={`${h + 1}%`} {...selectionStyle} />}
      </g>
    );
  }

  if (type === 'ellipse') {
    return (
      <g>
        <ellipse cx={`${(x1 + x2) / 2}%`} cy={`${(y1 + y2) / 2}%`} rx={`${w / 2}%`} ry={`${h / 2}%`} {...sharedProps} />
        {isSelected && <rect x={`${minX - 0.5}%`} y={`${minY - 0.5}%`} width={`${w + 1}%`} height={`${h + 1}%`} {...selectionStyle} />}
      </g>
    );
  }

  if (type === 'arrow') {
    const id = `arrow-${a.id}`;
    const sw = strokeWidth * 0.12;
    return (
      <g>
        <defs>
          <marker id={id} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={color} />
          </marker>
        </defs>
        <line
          x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
          stroke={color} strokeWidth={sw} markerEnd={`url(#${id})`}
          strokeLinecap="round"
          style={{ cursor: onSelect ? 'pointer' : 'crosshair' }}
          onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
        />
        {isSelected && (
          <line x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
            stroke="#60A5FA" strokeWidth={sw + 0.1} strokeDasharray="4 2" fill="none" pointerEvents="none" />
        )}
      </g>
    );
  }

  if (type === 'text') {
    if (isEditingText) {
      return (
        <foreignObject x={`${x1}%`} y={`${y1}%`} width="30%" height="10%">
          <input
            autoFocus
            value={textDraft ?? ''}
            onChange={e => onTextChange?.(e.target.value)}
            onBlur={onCommitText}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onCommitText?.(); } }}
            style={{
              background: 'rgba(0,0,0,0.55)', color, border: `1.5px solid ${color}`, borderRadius: '4px',
              padding: '3px 6px', fontSize: '13px', fontWeight: 600, outline: 'none',
              width: '100%', fontFamily: 'inherit',
            }}
          />
        </foreignObject>
      );
    }
    if (!text) return null;
    return (
      <g>
        <text
          x={`${x1}%`} y={`${y1}%`}
          fill={color} fontSize="1.8%" fontWeight="600" dominantBaseline="text-before-edge"
          style={{ cursor: onSelect ? 'pointer' : 'default', paintOrder: 'stroke' }}
          stroke="rgba(0,0,0,0.5)" strokeWidth="0.3%"
          onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
        >
          {text}
        </text>
        {isSelected && (
          <rect x={`${x1 - 0.3}%`} y={`${y1 - 0.3}%`} width={`${(text.length * 1.1) + 1}%`} height="3%" {...selectionStyle} />
        )}
      </g>
    );
  }

  return null;
}
