'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Trash2, RotateCcw } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

type Tool = 'select' | 'pan' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'highlight' | 'mosaic';
type Color = string;
// 8 resize handles for box shapes, 2 endpoint handles for arrows
type Handle = 'tl'|'tc'|'tr'|'ml'|'mr'|'bl'|'bc'|'br'|'p1'|'p2';

export interface Annotation {
  id: string;
  type: 'arrow' | 'rect' | 'ellipse' | 'text' | 'highlight' | 'mosaic';
  x1: number; y1: number; // 0–100 pct of image
  x2: number; y2: number;
  text?: string;
  color: Color;
  strokeWidth: number; // % of image width
}

interface ImageAnnotationEditorProps {
  imageUrl: string;
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  onClose: () => void;
  // 0-100 pct: initial auto-zoom focus point (e.g. click position)
  initialFocusX?: number;
  initialFocusY?: number;
}

// ── Constants ──────────────────────────────────────────────

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#111827'];
const STROKE_OPTIONS = [{ value: 0.3 }, { value: 0.5 }, { value: 0.9 }];

const TOOL_CONFIG: Record<Tool, { label: string; icon: React.ReactNode }> = {
  select:    { label: '선택',    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3l14 9-7 1-4 7z"/></svg> },
  pan:       { label: '이동',    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M12 12v.01"/><path d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg> },
  arrow:     { label: '화살표',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/></svg> },
  rect:      { label: '사각형',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
  ellipse:   { label: '원',      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="10" ry="7"/></svg> },
  text:      { label: '텍스트',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> },
  highlight: { label: '형광펜',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg> },
  mosaic:    { label: '모자이크', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="16" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/><rect x="16" y="9" width="5" height="5"/><rect x="2" y="16" width="5" height="5"/><rect x="9" y="16" width="5" height="5"/><rect x="16" y="16" width="5" height="5"/></svg> },
};

// Cursor per handle
const HANDLE_CURSOR: Record<Handle, string> = {
  tl: 'nwse-resize', tc: 'ns-resize',   tr: 'nesw-resize',
  ml: 'ew-resize',                        mr: 'ew-resize',
  bl: 'nesw-resize', bc: 'ns-resize',   br: 'nwse-resize',
  p1: 'crosshair', p2: 'crosshair',
};

function genId() { return Math.random().toString(36).slice(2, 9); }

// ── Main Component ─────────────────────────────────────────

export function ImageAnnotationEditor({ imageUrl, annotations, onChange, onClose, initialFocusX = 50, initialFocusY = 50 }: ImageAnnotationEditorProps) {
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState<Color>('#EF4444');
  const [strokeIdx, setStrokeIdx] = useState(1);
  const [items, setItems] = useState<Annotation[]>(annotations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<Partial<Annotation> | null>(null);

  // ── Zoom / Pan ──
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panDragRef = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null);
  const spaceHeldRef = useRef(false);

  // Text editing overlay
  const [editingText, setEditingText] = useState<{ id: string } | null>(null);
  const textInputRef = useRef<HTMLDivElement>(null);

  // Unified drag state: move body OR resize by handle
  const [dragState, setDragState] = useState<{
    id: string;
    handle: Handle | null; // null = move
    startX: number; startY: number;
    origX1: number; origY1: number; origX2: number; origY2: number;
  } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const strokeWidth = STROKE_OPTIONS[strokeIdx].value;

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

  // ── Auto-zoom to focus point when image loads ──
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const apply = () => {
      const container = containerRef.current;
      if (!container) return;
      const cw = container.clientWidth, ch = container.clientHeight;
      const iw = img.naturalWidth || img.clientWidth, ih = img.naturalHeight || img.clientHeight;
      const renderedW = Math.min(900, cw - 64);
      const scale = Math.min(renderedW / iw, (ch - 64) / ih);
      const rw = iw * scale, rh = ih * scale;
      const ZOOM = 2;
      const focusPxX = (initialFocusX / 100) * rw;
      const focusPxY = (initialFocusY / 100) * rh;
      const px = (cw / 2 - focusPxX * ZOOM) / ZOOM;
      const py = (ch / 2 - focusPxY * ZOOM) / ZOOM;
      setZoom(ZOOM);
      setPan({ x: px, y: py });
    };
    if (img.complete) apply();
    else img.addEventListener('load', apply, { once: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Wheel zoom (always active, cursor-anchored) ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const img = imgRef.current;
      if (!img) return;
      const rect = img.getBoundingClientRect();
      const mx = e.clientX - rect.left; // mouse position relative to image (in screen px)
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.85 : 1 / 0.85;
      setZoom(prev => {
        const next = Math.max(0.5, Math.min(8, prev * delta));
        // keep the point under cursor fixed
        const _ratio = next / prev; void _ratio;
        setPan(p => ({
          x: mx / prev + p.x - mx / next,
          y: my / prev + p.y - my / next,
        }));
        return next;
      });
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // ── Space key → temporary pan mode ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat) { spaceHeldRef.current = true; } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') { spaceHeldRef.current = false; } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // ── Pan drag (pan tool or space held) ──
  const isPanMode = tool === 'pan';
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (spaceHeldRef.current || isPanMode) {
      e.preventDefault();
      e.stopPropagation();
      panDragRef.current = { startX: e.clientX, startY: e.clientY, origPanX: pan.x, origPanY: pan.y };
      return;
    }
  }, [isPanMode, pan]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!panDragRef.current) return;
      const dx = (e.clientX - panDragRef.current.startX) / zoom;
      const dy = (e.clientY - panDragRef.current.startY) / zoom;
      setPan({ x: panDragRef.current.origPanX + dx, y: panDragRef.current.origPanY + dy });
    };
    const up = () => { panDragRef.current = null; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [zoom]);

  // ── Drawing ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-text-editor]')) return;
    if (editingText) { commitTextRef.current(); return; }
    if (tool === 'select') { setSelectedId(null); return; }
    if (tool === 'pan' || spaceHeldRef.current) return;

    e.preventDefault();
    setSelectedId(null);
    const { x, y } = toVB(e);

    if (tool === 'text') {
      const newItem: Annotation = { id: genId(), type: 'text', x1: x, y1: y, x2: x, y2: y, text: '', color, strokeWidth };
      setItems(prev => [...prev, newItem]);
      setEditingText({ id: newItem.id });
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
      const final = { ...prev } as Annotation;
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

  useEffect(() => {
    if (!drawing) return;
    const up = (e: MouseEvent) => finishDrawing(e);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [drawing, finishDrawing]);

  // ── Select / Move / Resize ──
  const startDrag = useCallback((e: React.MouseEvent, id: string, handle: Handle | null) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    const { x, y } = toVB(e);
    const item = items.find(a => a.id === id);
    if (!item) return;
    setDragState({ id, handle, startX: x, startY: y, origX1: item.x1, origY1: item.y1, origX2: item.x2, origY2: item.y2 });
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
      const { handle, origX1: ox1, origY1: oy1, origX2: ox2, origY2: oy2 } = dragState;

      setItems(cur => cur.map(a => {
        if (a.id !== dragState.id) return a;
        if (!handle) {
          // Move
          return { ...a, x1: ox1 + dx, y1: oy1 + dy, x2: ox2 + dx, y2: oy2 + dy };
        }
        // Arrow endpoints
        if (handle === 'p1') return { ...a, x1: ox1 + dx, y1: oy1 + dy };
        if (handle === 'p2') return { ...a, x2: ox2 + dx, y2: oy2 + dy };
        // Box resize: anchor is opposite corner/edge
        let { x1, y1, x2, y2 } = a;
        if (handle === 'tl') { x1 = ox1 + dx; y1 = oy1 + dy; }
        if (handle === 'tc') { y1 = oy1 + dy; }
        if (handle === 'tr') { x2 = ox2 + dx; y1 = oy1 + dy; }
        if (handle === 'ml') { x1 = ox1 + dx; }
        if (handle === 'mr') { x2 = ox2 + dx; }
        if (handle === 'bl') { x1 = ox1 + dx; y2 = oy2 + dy; }
        if (handle === 'bc') { y2 = oy2 + dy; }
        if (handle === 'br') { x2 = ox2 + dx; y2 = oy2 + dy; }
        return { ...a, x1, y1, x2, y2 };
      }));
    };
    const up = () => setDragState(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [dragState]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setItems(prev => prev.filter(a => a.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingText) return;
      if (e.key === 'Escape') setSelectedId(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); deleteSelected(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, editingText, deleteSelected]);

  // Focus text overlay when it appears
  useEffect(() => {
    if (!editingText) return;
    const t = setTimeout(() => {
      textInputRef.current?.focus();
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

  // Track rendered image size for pixel-accurate SVG viewBox
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 });
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const update = () => { const r = img.getBoundingClientRect(); if (r.width > 0) setImgSize({ w: r.width, h: r.height }); };
    img.addEventListener('load', update);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(img);
    return () => { img.removeEventListener('load', update); ro.disconnect(); };
  }, []);

  const strokePx = (strokeWidth / 100) * imgSize.w;
  const cursor = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';
  const editingItem = editingText ? items.find(a => a.id === editingText.id) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Toolbar ── */}
      <div style={{ height: '52px', flexShrink: 0, background: '#1F2937', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '4px', padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '3px' }}>
          {(Object.keys(TOOL_CONFIG) as Tool[]).map(t => {
            const active = tool === t;
            return (
              <button key={t} title={TOOL_CONFIG[t].label}
                onClick={() => { if (editingText) commitTextRef.current(); setTool(t); }}
                style={{ width: '34px', height: '34px', borderRadius: '6px', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', background: active ? 'white' : 'transparent', color: active ? '#111827' : 'rgba(255,255,255,0.6)', transition: 'all 0.12s' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >{TOOL_CONFIG[t].icon}</button>
            );
          })}
        </div>

        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.12)', margin: '0 8px' }} />

        {tool !== 'mosaic' && (
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, border: color === c ? '2.5px solid white' : '2px solid transparent', cursor: 'pointer', flexShrink: 0, outline: 'none' }}
              />
            ))}
          </div>
        )}
        {tool === 'mosaic' && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>블러 처리할 영역을 드래그하세요</span>}

        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.12)', margin: '0 8px' }} />

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

        {/* Zoom indicator + reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px' }}>
          <button onClick={() => setZoom(z => Math.max(0.5, z / 1.3))}
            style={{ width: '28px', height: '28px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px', display: 'grid', placeItems: 'center' }}
          >−</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            style={{ minWidth: '46px', height: '28px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
          >{Math.round(zoom * 100)}%</button>
          <button onClick={() => setZoom(z => Math.min(8, z * 1.3))}
            style={{ width: '28px', height: '28px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px', display: 'grid', placeItems: 'center' }}
          >+</button>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.12)', marginRight: '8px' }} />

        <button onClick={() => setItems(prev => prev.slice(0, -1))}
          style={{ height: '34px', padding: '0 12px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        ><RotateCcw size={12} /> 되돌리기</button>

        {selectedId && (
          <button onClick={deleteSelected}
            style={{ height: '34px', padding: '0 12px', borderRadius: '7px', border: '1px solid rgba(220,38,38,0.4)', background: 'rgba(220,38,38,0.1)', color: '#FCA5A5', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', marginLeft: '4px' }}
          ><Trash2 size={12} /> 삭제</button>
        )}

        <button onClick={onClose}
          style={{ height: '34px', padding: '0 14px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '12.5px', cursor: 'pointer', marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        ><X size={13} /> 닫기</button>

        <button onClick={handleSave}
          style={{ height: '34px', padding: '0 18px', borderRadius: '7px', border: 'none', background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', color: 'white', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', marginLeft: '6px' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(79,70,229,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
        >저장</button>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '32px', overflow: 'hidden', position: 'relative',
          cursor: (isPanMode || spaceHeldRef.current) ? (panDragRef.current ? 'grabbing' : 'grab') : cursor,
        }}
        onMouseDown={e => { handleCanvasMouseDown(e); if (!isPanMode && !spaceHeldRef.current) handleMouseDown(e); }}
        onMouseMove={handleMouseMove}
      >
        <div style={{
          position: 'relative', display: 'inline-block', userSelect: 'none',
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: '0 0',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={imageUrl} alt="편집 중" draggable={false}
            style={{ display: 'block', maxWidth: 'min(900px, calc(100vw - 64px))', maxHeight: 'calc(100vh - 120px)', borderRadius: '6px' }}
          />

          <svg
            viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor, overflow: 'visible' }}
          >
            <defs>
              <filter id="mosaic-blur" x="-5%" y="-5%" width="110%" height="110%">
                <feGaussianBlur stdDeviation="8" />
              </filter>
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
                imageUrl={imageUrl}
                onBodyMouseDown={e => startDrag(e, a.id, null)}
                onHandleMouseDown={(e, h) => startDrag(e, a.id, h)}
              />
            ))}

            {drawing && (
              <AnnotationShape
                annotation={drawing as Annotation}
                isSelected={false}
                tool={tool}
                imgW={imgSize.w}
                imgH={imgSize.h}
                strokePx={(drawing.strokeWidth ?? strokeWidth) / 100 * imgSize.w}
                imageUrl={imageUrl}
              />
            )}
          </svg>

          {/* Text editing overlay */}
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
                minWidth: '80px', maxWidth: '240px',
                padding: '3px 6px',
                background: 'rgba(0,0,0,0.65)',
                color: editingItem.color,
                border: `1.5px solid ${editingItem.color}`,
                borderRadius: '3px',
                fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
                outline: 'none', cursor: 'text',
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                lineHeight: 1.4, zIndex: 10,
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}
            />
          )}
        </div>
      </div>

      <div style={{ height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
        {tool === 'text' ? '클릭 후 텍스트 입력 · Enter 확정' :
         tool === 'select' ? '클릭으로 선택 · 드래그로 이동 · 핸들로 크기 조절 · Delete 삭제' :
         tool === 'pan' ? '드래그로 화면 이동 · 스크롤로 확대/축소 · Space 누른 채 드래그도 가능' :
         tool === 'mosaic' ? '블러 처리할 영역을 드래그하세요' :
         '클릭 후 드래그하여 그립니다 · 스크롤로 확대/축소 · Space+드래그로 이동'}
      </div>
    </div>
  );
}

// ── AnnotationShape ─────────────────────────────────────────

interface AnnotationShapeProps {
  annotation: Annotation;
  isSelected: boolean;
  tool: Tool;
  imgW: number;
  imgH: number;
  strokePx: number;
  imageUrl: string;
  onBodyMouseDown?: (e: React.MouseEvent) => void;
  onHandleMouseDown?: (e: React.MouseEvent, h: Handle) => void;
}

// PPT-style selection handles rendered as SVG circles/rects
function SelectionHandles({ minX, minY, w, h, onHandle }: {
  minX: number; minY: number; w: number; h: number;
  onHandle: (e: React.MouseEvent, h: Handle) => void;
}) {
  const R = 5; // handle radius px
  const BORDER_COLOR = '#2563EB';
  const HANDLE_FILL = 'white';
  const HANDLE_STROKE = '#2563EB';

  // 8 handle positions: [handle, cx, cy]
  const handles: [Handle, number, number][] = [
    ['tl', minX,         minY        ],
    ['tc', minX + w / 2, minY        ],
    ['tr', minX + w,     minY        ],
    ['ml', minX,         minY + h / 2],
    ['mr', minX + w,     minY + h / 2],
    ['bl', minX,         minY + h    ],
    ['bc', minX + w / 2, minY + h    ],
    ['br', minX + w,     minY + h    ],
  ];

  return (
    <g>
      {/* Selection border */}
      <rect x={minX} y={minY} width={w} height={h}
        stroke={BORDER_COLOR} strokeWidth={1.5} fill="none" strokeDasharray="none" pointerEvents="none" />
      {/* 8 handles */}
      {handles.map(([hKey, cx, cy]) => (
        <rect
          key={hKey}
          x={cx - R} y={cy - R} width={R * 2} height={R * 2}
          fill={HANDLE_FILL} stroke={HANDLE_STROKE} strokeWidth={1.5}
          style={{ cursor: HANDLE_CURSOR[hKey] }}
          onMouseDown={e => { e.stopPropagation(); onHandle(e, hKey); }}
        />
      ))}
    </g>
  );
}

// Arrow endpoint handles
function ArrowHandles({ ax1, ay1, ax2, ay2, onHandle }: {
  ax1: number; ay1: number; ax2: number; ay2: number;
  onHandle: (e: React.MouseEvent, h: Handle) => void;
}) {
  const R = 5;
  return (
    <g>
      <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke="#2563EB" strokeWidth={1.5} strokeDasharray="4 2" pointerEvents="none" />
      {(['p1', 'p2'] as Handle[]).map(h => {
        const cx = h === 'p1' ? ax1 : ax2;
        const cy = h === 'p1' ? ay1 : ay2;
        return (
          <circle key={h} cx={cx} cy={cy} r={R}
            fill="white" stroke="#2563EB" strokeWidth={1.5}
            style={{ cursor: 'crosshair' }}
            onMouseDown={e => { e.stopPropagation(); onHandle(e, h); }}
          />
        );
      })}
    </g>
  );
}

function AnnotationShape({ annotation: a, isSelected, tool, imgW, imgH, strokePx, imageUrl, onBodyMouseDown, onHandleMouseDown }: AnnotationShapeProps) {
  const { type, x1, y1, x2, y2, color, text } = a;

  const ax1 = (x1 / 100) * imgW, ay1 = (y1 / 100) * imgH;
  const ax2 = (x2 / 100) * imgW, ay2 = (y2 / 100) * imgH;
  const minX = Math.min(ax1, ax2), minY = Math.min(ay1, ay2);
  const w = Math.abs(ax2 - ax1), h = Math.abs(ay2 - ay1);

  const isSelectTool = tool === 'select';
  const bodyCursor = isSelectTool ? 'move' : 'crosshair';

  const handleHandle = onHandleMouseDown ?? (() => {});

  if (type === 'mosaic') {
    const clipId = `mosaic-clip-${a.id}`;
    return (
      <g>
        <defs>
          <clipPath id={clipId}><rect x={minX} y={minY} width={w} height={h} /></clipPath>
        </defs>
        <image href={imageUrl} x="0" y="0" width={imgW} height={imgH}
          preserveAspectRatio="none" filter="url(#mosaic-blur)" clipPath={`url(#${clipId})`}
          style={{ pointerEvents: 'none' }} />
        <rect x={minX} y={minY} width={w} height={h} fill="transparent"
          style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
        {isSelected && onHandleMouseDown && (
          <SelectionHandles minX={minX} minY={minY} w={w} h={h} onHandle={handleHandle} />
        )}
      </g>
    );
  }

  if (type === 'highlight') return (
    <g>
      <rect x={minX} y={minY} width={w} height={h} fill={color} opacity={0.35} rx={1}
        style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
      {isSelected && onHandleMouseDown && (
        <SelectionHandles minX={minX} minY={minY} w={w} h={h} onHandle={handleHandle} />
      )}
    </g>
  );

  if (type === 'rect') return (
    <g>
      <rect x={minX} y={minY} width={w} height={h} rx={1} stroke={color} strokeWidth={strokePx} fill="none"
        style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
      {isSelected && onHandleMouseDown && (
        <SelectionHandles minX={minX} minY={minY} w={w} h={h} onHandle={handleHandle} />
      )}
    </g>
  );

  if (type === 'ellipse') return (
    <g>
      <ellipse cx={(ax1 + ax2) / 2} cy={(ay1 + ay2) / 2} rx={w / 2} ry={h / 2}
        stroke={color} strokeWidth={strokePx} fill="none"
        style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
      {isSelected && onHandleMouseDown && (
        <SelectionHandles minX={minX} minY={minY} w={w} h={h} onHandle={handleHandle} />
      )}
    </g>
  );

  if (type === 'arrow') {
    const markerId = `arrow-${a.id}`;
    const mSize = strokePx * 4;
    return (
      <g>
        <defs>
          <marker id={markerId} markerWidth={mSize} markerHeight={mSize}
            refX={mSize - 1} refY={mSize / 2} orient="auto" markerUnits="userSpaceOnUse">
            <path d={`M0,0 L0,${mSize} L${mSize},${mSize / 2} z`} fill={color} />
          </marker>
        </defs>
        {/* Wide transparent hit area */}
        <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke="transparent"
          strokeWidth={Math.max(10, strokePx * 3)}
          style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
        <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke={color} strokeWidth={strokePx}
          markerEnd={`url(#${markerId})`} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
        {isSelected && onHandleMouseDown && (
          <ArrowHandles ax1={ax1} ay1={ay1} ax2={ax2} ay2={ay2} onHandle={handleHandle} />
        )}
      </g>
    );
  }

  if (type === 'text') {
    if (!text) return null;
    const fSize = Math.max(12, imgW * 0.018);
    const textW = text.length * fSize * 0.65;
    return (
      <g>
        {/* Invisible hit rect for body drag */}
        <rect x={ax1 - 2} y={ay1 - 2} width={textW + 4} height={fSize + 8} fill="transparent"
          style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
        <text x={ax1} y={ay1} fill={color} fontSize={fSize} fontWeight="700"
          dominantBaseline="text-before-edge"
          stroke="rgba(0,0,0,0.6)" strokeWidth={fSize * 0.12}
          style={{ paintOrder: 'stroke', pointerEvents: 'none' }}>
          {text}
        </text>
        {isSelected && onHandleMouseDown && (
          <SelectionHandles minX={ax1 - 2} minY={ay1 - 2} w={textW + 4} h={fSize + 8} onHandle={handleHandle} />
        )}
      </g>
    );
  }

  return null;
}
