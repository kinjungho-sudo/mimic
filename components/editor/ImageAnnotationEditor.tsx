'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Trash2, RotateCcw } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

type Tool = 'select' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'highlight' | 'mosaic';
type Color = string;

export interface Annotation {
  id: string;
  type: 'arrow' | 'rect' | 'ellipse' | 'text' | 'highlight' | 'mosaic';
  // All coords stored as 0–100 percentage of image dimensions
  x1: number; y1: number;
  x2: number; y2: number;
  text?: string;
  color: Color;
  strokeWidth: number; // stored as % of image width (e.g. 0.3 = 0.3% of width)
}

interface ImageAnnotationEditorProps {
  imageUrl: string;
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  onClose: () => void;
}

// ── Constants ──────────────────────────────────────────────

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#111827'];
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
  text:      { label: '텍스트',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> },
  highlight: { label: '형광펜',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg> },
  mosaic:    { label: '모자이크', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="16" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/><rect x="16" y="9" width="5" height="5"/><rect x="2" y="16" width="5" height="5"/><rect x="9" y="16" width="5" height="5"/><rect x="16" y="16" width="5" height="5"/></svg> },
};

function genId() { return Math.random().toString(36).slice(2, 9); }

// ── Main Component ─────────────────────────────────────────

export function ImageAnnotationEditor({ imageUrl, annotations, onChange, onClose }: ImageAnnotationEditorProps) {
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState<Color>('#EF4444');
  const [strokeIdx, setStrokeIdx] = useState(1);
  const [items, setItems] = useState<Annotation[]>(annotations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<Partial<Annotation> | null>(null);

  // Text editing: overlay div on top of image
  const [editingText, setEditingText] = useState<{ id: string; x: number; y: number } | null>(null);
  const textInputRef = useRef<HTMLDivElement>(null);

  // Drag-to-move state
  const [dragState, setDragState] = useState<{
    id: string;
    startX: number; startY: number;
    origX1: number; origY1: number; origX2: number; origY2: number;
  } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const strokeWidth = STROKE_OPTIONS[strokeIdx].value;

  // Convert mouse event → 0–100 pct coords relative to image
  const toVB = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  }, []);



  const commitTextRef = useRef<() => void>(() => {});

  const commitText = useCallback(() => {
    if (!editingText) return;
    const rawText = textInputRef.current?.innerText?.trim() ?? '';
    const id = editingText.id;
    setItems(cur => rawText
      ? cur.map(a => a.id === id ? { ...a, text: rawText } : a)
      : cur.filter(a => a.id !== id)
    );
    setEditingText(null);
    if (textInputRef.current) textInputRef.current.innerText = '';
  }, [editingText]);

  useEffect(() => { commitTextRef.current = commitText; }, [commitText]);

  // ── Mouse down: start draw or select ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Ignore if clicking on text editor overlay
    if ((e.target as HTMLElement).closest('[data-text-editor]')) return;

    if (editingText) { commitTextRef.current(); return; }

    if (tool === 'select') return;

    e.preventDefault();
    setSelectedId(null);
    const { x, y } = toVB(e);

    if (tool === 'text') {
      const newItem: Annotation = { id: genId(), type: 'text', x1: x, y1: y, x2: x, y2: y, text: '', color, strokeWidth };
      setItems(prev => [...prev, newItem]);
      // Show overlay text editor at click position
      const img = imgRef.current!;
      const rect = img.getBoundingClientRect();
      const pxX = ((x / 100) * rect.width) + rect.left - containerRef.current!.getBoundingClientRect().left;
      const pxY = ((y / 100) * rect.height) + rect.top - containerRef.current!.getBoundingClientRect().top;
      setEditingText({ id: newItem.id, x: pxX, y: pxY });
      return;
    }

    setDrawing({ type: tool as Annotation['type'], x1: x, y1: y, x2: x, y2: y, color, strokeWidth, id: genId() });
  }, [tool, color, strokeWidth, editingText, toVB]);

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
      if (dx < 0.5 && dy < 0.5) return null;
      let final = { ...prev } as Annotation;
      if (e) {
        const img = imgRef.current;
        if (img) {
          const rect = img.getBoundingClientRect();
          final.x2 = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
          final.y2 = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        }
      }
      setItems(cur => [...cur, final]);
      return null;
    });
  }, []);

  // Window mouseup for drawing
  useEffect(() => {
    if (!drawing) return;
    const up = (e: MouseEvent) => finishDrawing(e);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [drawing, finishDrawing]);

  // ── Drag to move selected annotation ──
  const handleShapeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    const { x, y } = toVB(e);
    const item = items.find(a => a.id === id);
    if (!item) return;
    setDragState({ id, startX: x, startY: y, origX1: item.x1, origY1: item.y1, origX2: item.x2, origY2: item.y2 });
  }, [tool, items, toVB]);

  useEffect(() => {
    if (!dragState) return;
    const move = (e: MouseEvent) => {
      const img = imgRef.current;
      if (!img) return;
      const rect = img.getBoundingClientRect();
      const cx = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const cy = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      const dx = cx - dragState.startX;
      const dy = cy - dragState.startY;
      setItems(cur => cur.map(a => a.id === dragState.id
        ? { ...a, x1: dragState.origX1 + dx, y1: dragState.origY1 + dy, x2: dragState.origX2 + dx, y2: dragState.origY2 + dy }
        : a
      ));
    };
    const up = () => setDragState(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragState]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setItems(prev => prev.filter(a => a.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingText) return; // let text editor handle keys
      if (e.key === 'Escape') setSelectedId(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, editingText, deleteSelected]);

  // Focus text editor when it appears
  useEffect(() => {
    if (!editingText) return;
    const t = setTimeout(() => {
      textInputRef.current?.focus();
      // Place cursor at end
      const range = document.createRange();
      const sel = window.getSelection();
      if (textInputRef.current && sel) {
        range.selectNodeContents(textInputRef.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [editingText]);

  const handleSave = () => {
    if (editingText) commitTextRef.current();
    onChange(items);
    onClose();
  };

  // SVG viewBox matches rendered pixel size → strokeWidth in px is uniform in both axes
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 });
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const update = () => {
      const r = img.getBoundingClientRect();
      if (r.width > 0) setImgSize({ w: r.width, h: r.height });
    };
    img.addEventListener('load', update);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(img);
    return () => { img.removeEventListener('load', update); ro.disconnect(); };
  }, []);

  // Convert pct coords → pixel coords for SVG (viewBox = pixel size)
  const px = (pct: number, axis: 'x' | 'y') =>
    axis === 'x' ? (pct / 100) * imgSize.w : (pct / 100) * imgSize.h;

  const strokePx = (strokeWidth / 100) * imgSize.w;

  const cursor = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';

  // Find the item being edited (for text overlay color)
  const editingItem = editingText ? items.find(a => a.id === editingText.id) : null;

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
                onClick={() => { if (editingText) commitTextRef.current(); setTool(t); }}
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

        {/* Colors (hidden for mosaic) */}
        {tool !== 'mosaic' && (
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, border: color === c ? '2.5px solid white' : '2px solid transparent', cursor: 'pointer', flexShrink: 0, transition: 'border 0.1s', outline: 'none' }}
              />
            ))}
          </div>
        )}
        {tool === 'mosaic' && (
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>블러 처리할 영역을 드래그하세요</span>
        )}

        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.12)', margin: '0 8px' }} />

        {/* Stroke width (hidden for text / mosaic) */}
        {tool !== 'text' && tool !== 'mosaic' && tool !== 'select' && (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {STROKE_OPTIONS.map((_, i) => (
              <button key={i} onClick={() => setStrokeIdx(i)}
                style={{ width: '32px', height: '28px', borderRadius: '5px', border: strokeIdx === i ? '1.5px solid white' : '1.5px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
              >
                <div style={{ width: '14px', height: `${i * 2 + 2}px`, background: 'white', borderRadius: '2px' }} />
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <button onClick={() => setItems(prev => prev.slice(0, -1))} title="마지막 취소"
          style={{ height: '34px', padding: '0 12px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <RotateCcw size={12} /> 되돌리기
        </button>

        {selectedId && (
          <button onClick={deleteSelected}
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
        ref={containerRef}
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', overflow: 'auto', position: 'relative' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
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

          {/* SVG overlay — viewBox matches actual pixel size so strokeWidth is uniform */}
          <svg
            viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor, overflow: 'visible' }}
          >
            <defs>
              {/* Mosaic blur filter */}
              <filter id="mosaic-blur" x="-5%" y="-5%" width="110%" height="110%">
                <feGaussianBlur stdDeviation="8" />
              </filter>
              {/* Define image source for mosaic clipping */}
              <image id="img-src" href={imageUrl} x="0" y="0" width={imgSize.w} height={imgSize.h} preserveAspectRatio="none" />
            </defs>

            {items.map(a => (
              <AnnotationShape
                key={a.id}
                annotation={a}
                isSelected={selectedId === a.id}
                tool={tool}
                imgW={imgSize.w}
                imgH={imgSize.h}
                strokePx={strokePx}
                onShapeMouseDown={handleShapeMouseDown}
              />
            ))}

            {/* Preview while drawing */}
            {drawing && (
              <AnnotationShape
                annotation={drawing as Annotation}
                isSelected={false}
                tool={tool}
                imgW={imgSize.w}
                imgH={imgSize.h}
                strokePx={(drawing.strokeWidth ?? strokeWidth) / 100 * imgSize.w}
              />
            )}
          </svg>

          {/* Text editing overlay — HTML contenteditable positioned over image */}
          {editingText && editingItem && (
            <div
              data-text-editor
              ref={textInputRef}
              contentEditable
              suppressContentEditableWarning
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Escape') commitTextRef.current();
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTextRef.current(); }
              }}
              onMouseDown={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: `${editingItem.x1}%`,
                top: `${editingItem.y1}%`,
                minWidth: '80px',
                maxWidth: '200px',
                padding: '3px 6px',
                background: 'rgba(0,0,0,0.65)',
                color: editingItem.color,
                border: `1.5px solid ${editingItem.color}`,
                borderRadius: '3px',
                fontSize: '14px',
                fontWeight: 700,
                fontFamily: 'inherit',
                outline: 'none',
                cursor: 'text',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                lineHeight: 1.4,
                zIndex: 10,
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}
            />
          )}
        </div>
      </div>

      <div style={{ height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
        {tool === 'text' ? '클릭한 위치에 텍스트를 입력하세요 · Enter로 확정' :
         tool === 'select' ? '도형을 클릭해 선택 · 드래그로 이동 · Delete로 삭제' :
         tool === 'mosaic' ? '블러 처리할 영역을 드래그하세요' :
         '클릭 후 드래그하여 그립니다'}
      </div>
    </div>
  );
}

// ── AnnotationShape ────────────────────────────────────────

interface AnnotationShapeProps {
  annotation: Annotation;
  isSelected: boolean;
  tool: Tool;
  imgW: number;
  imgH: number;
  strokePx: number;
  onShapeMouseDown?: (e: React.MouseEvent, id: string) => void;
}

function AnnotationShape({ annotation: a, isSelected, tool, imgW, imgH, strokePx, onShapeMouseDown }: AnnotationShapeProps) {
  const { type, x1, y1, x2, y2, color, text } = a;

  const ax1 = (x1 / 100) * imgW, ay1 = (y1 / 100) * imgH;
  const ax2 = (x2 / 100) * imgW, ay2 = (y2 / 100) * imgH;
  const minX = Math.min(ax1, ax2), minY = Math.min(ay1, ay2);
  const w = Math.abs(ax2 - ax1), h = Math.abs(ay2 - ay1);

  const selStyle = { stroke: '#60A5FA', strokeWidth: Math.max(1, strokePx * 0.4), strokeDasharray: `${strokePx * 3} ${strokePx * 1.5}`, fill: 'none' };
  const selPad = strokePx * 0.8;
  const isSelectTool = tool === 'select';
  const eventProps = onShapeMouseDown ? {
    onMouseDown: (e: React.MouseEvent) => onShapeMouseDown(e, a.id),
    style: { cursor: isSelectTool ? 'move' : 'crosshair' } as React.CSSProperties,
  } : {};

  if (type === 'mosaic') {
    const clipId = `mosaic-clip-${a.id}`;
    return (
      <g {...eventProps}>
        <defs>
          <clipPath id={clipId}>
            <rect x={minX} y={minY} width={w} height={h} />
          </clipPath>
        </defs>
        {/* Blurred copy of the image, clipped to mosaic region */}
        <image
          href={a.color /* we reuse color field as imageUrl marker — see note below */}
          x="0" y="0" width={imgW} height={imgH}
          preserveAspectRatio="none"
          filter="url(#mosaic-blur)"
          clipPath={`url(#${clipId})`}
          style={{ pointerEvents: 'none' }}
        />
        {/* Semi-transparent overlay for visibility */}
        <rect x={minX} y={minY} width={w} height={h} fill="rgba(0,0,0,0.08)" />
        {isSelected && <rect x={minX - selPad} y={minY - selPad} width={w + selPad * 2} height={h + selPad * 2} {...selStyle} />}
        {/* Transparent hit area */}
        <rect x={minX} y={minY} width={w} height={h} fill="transparent" {...eventProps} />
      </g>
    );
  }

  if (type === 'highlight') return (
    <g>
      <rect x={minX} y={minY} width={w} height={h} fill={color} opacity={0.35} rx={1} {...eventProps} />
      {isSelected && <rect x={minX - selPad} y={minY - selPad} width={w + selPad * 2} height={h + selPad * 2} {...selStyle} />}
    </g>
  );

  if (type === 'rect') return (
    <g>
      <rect x={minX} y={minY} width={w} height={h} rx={1} stroke={color} strokeWidth={strokePx} fill="none" {...eventProps} />
      {isSelected && <rect x={minX - selPad} y={minY - selPad} width={w + selPad * 2} height={h + selPad * 2} {...selStyle} />}
    </g>
  );

  if (type === 'ellipse') return (
    <g>
      <ellipse cx={(ax1 + ax2) / 2} cy={(ay1 + ay2) / 2} rx={w / 2} ry={h / 2} stroke={color} strokeWidth={strokePx} fill="none" {...eventProps} />
      {isSelected && <rect x={minX - selPad} y={minY - selPad} width={w + selPad * 2} height={h + selPad * 2} {...selStyle} />}
    </g>
  );

  if (type === 'arrow') {
    const markerId = `arrow-${a.id}`;
    // Arrow head sized relative to strokePx
    const mSize = strokePx * 4;
    return (
      <g>
        <defs>
          <marker id={markerId} markerWidth={mSize} markerHeight={mSize} refX={mSize - 1} refY={mSize / 2} orient="auto" markerUnits="userSpaceOnUse">
            <path d={`M0,0 L0,${mSize} L${mSize},${mSize / 2} z`} fill={color} />
          </marker>
        </defs>
        {/* Transparent wider hit area */}
        <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke="transparent" strokeWidth={Math.max(8, strokePx * 3)} {...eventProps} />
        <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke={color} strokeWidth={strokePx} markerEnd={`url(#${markerId})`} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
        {isSelected && <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke="#60A5FA" strokeWidth={strokePx + 1} strokeDasharray={`${strokePx * 3} ${strokePx}`} fill="none" pointerEvents="none" />}
      </g>
    );
  }

  if (type === 'text') {
    if (!text) return null;
    const fSize = Math.max(12, imgW * 0.018); // ~1.8% of image width
    return (
      <g {...eventProps}>
        <text
          x={ax1} y={ay1}
          fill={color}
          fontSize={fSize}
          fontWeight="700"
          dominantBaseline="text-before-edge"
          stroke="rgba(0,0,0,0.6)"
          strokeWidth={fSize * 0.12}
          style={{ paintOrder: 'stroke', cursor: isSelectTool ? 'move' : 'default' }}
        >
          {text}
        </text>
        {isSelected && (
          <rect x={ax1 - 2} y={ay1 - 2} width={text.length * fSize * 0.65 + 4} height={fSize + 4} {...selStyle} />
        )}
      </g>
    );
  }

  return null;
}
