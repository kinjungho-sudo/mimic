'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Trash2, RotateCcw } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

type Tool = 'select' | 'eraser' | 'crop' | 'mosaic' | 'ellipse' | 'rect' | 'arrow' | 'text' | 'marker' | 'spotlight';
type Color = string;
type Handle = 'tl'|'tc'|'tr'|'ml'|'mr'|'bl'|'bc'|'br'|'p1'|'p2';

export interface Annotation {
  id: string;
  type: 'arrow' | 'rect' | 'ellipse' | 'text' | 'highlight' | 'mosaic' | 'marker' | 'spotlight' | 'recorderBox' | 'crop';
  x1: number; y1: number; // 0–100 pct of image
  x2: number; y2: number;
  text?: string;
  color: Color;
  strokeWidth: number;
  markerNumber?: number;
}

interface ImageAnnotationEditorProps {
  imageUrl: string;
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  onClose: () => void;
  initialFocusX?: number;
  initialFocusY?: number;
}

// ── Constants ──────────────────────────────────────────────

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#111827'];
const STROKE_OPTIONS = [{ value: 0.3 }, { value: 0.5 }, { value: 0.9 }];

// Group A: 이미지 변환 / Group B: 그리기 도구
const TOOL_GROUPS: { tools: Tool[] }[] = [
  { tools: ['crop', 'mosaic', 'eraser'] },
  { tools: ['select', 'ellipse', 'rect', 'arrow', 'text', 'marker', 'spotlight'] },
];

const TOOL_CONFIG: Record<Tool, { label: string; icon: React.ReactNode }> = {
  select: {
    label: '선택',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M4 0 L18 10 L11 11 L8 18 Z"/></svg>,
  },
  eraser: {
    label: '지우개',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16l10-10 7 7-1.5 1.5"/><path d="M6 17l3-3"/></svg>,
  },
  crop: {
    label: '자르기',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2v14a2 2 0 002 2h14"/><path d="M18 22V8a2 2 0 00-2-2H2"/></svg>,
  },
  mosaic: {
    label: '모자이크',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="16" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/><rect x="16" y="9" width="5" height="5"/><rect x="2" y="16" width="5" height="5"/><rect x="9" y="16" width="5" height="5"/><rect x="16" y="16" width="5" height="5"/></svg>,
  },
  ellipse: {
    label: '원',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><ellipse cx="12" cy="12" rx="10" ry="7"/></svg>,
  },
  rect: {
    label: '사각형',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="16" rx="1"/></svg>,
  },
  arrow: {
    label: '화살표',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/></svg>,
  },
  text: {
    label: '텍스트',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
  },
  marker: {
    label: '마커',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
        <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="10" fontWeight="700">①</text>
      </svg>
    ),
  },
  spotlight: {
    label: '스포트라이트',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>,
  },
};

const HANDLE_CURSOR: Record<Handle, string> = {
  tl: 'nwse-resize', tc: 'ns-resize',   tr: 'nesw-resize',
  ml: 'ew-resize',                        mr: 'ew-resize',
  bl: 'nesw-resize', bc: 'ns-resize',   br: 'nwse-resize',
  p1: 'crosshair', p2: 'crosshair',
};

function genId() { return Math.random().toString(36).slice(2, 9); }

// 점과 선분 사이 거리 (% 단위, 이미지 비율 보정)
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number, aspectW: number, aspectH: number) {
  const dx = (x2 - x1) * aspectW, dy = (y2 - y1) * aspectH;
  const lenSq = dx * dx + dy * dy;
  const ppx = (px - x1) * aspectW, ppy = (py - y1) * aspectH;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (ppx * dx + ppy * dy) / lenSq));
  const rx = ppx - t * dx, ry = ppy - t * dy;
  return Math.sqrt(rx * rx + ry * ry);
}

// 지우개: annotation이 지우개 경로에 닿는지 판단
function hitTestAnnotation(a: Annotation, px: number, py: number, radiusPct: number, imgW: number, imgH: number): boolean {
  const aspect = imgW / imgH;
  const r = radiusPct * aspect;
  const cx = (a.x1 + a.x2) / 2, cy = (a.y1 + a.y2) / 2;
  const dx = (px - cx) * aspect, dy = py - cy;
  const distCenter = Math.sqrt(dx * dx + dy * dy);

  if (a.type === 'arrow') {
    return distToSegment(px, py, a.x1, a.y1, a.x2, a.y2, aspect, 1) < r;
  }
  if (a.type === 'marker') {
    return distCenter < r + 4;
  }
  if (a.type === 'text') {
    return Math.abs((px - a.x1) * aspect) < r + 8 && Math.abs(py - a.y1) < r + 3;
  }
  // box types: check if point is inside or near border
  const minX = Math.min(a.x1, a.x2), maxX = Math.max(a.x1, a.x2);
  const minY = Math.min(a.y1, a.y2), maxY = Math.max(a.y1, a.y2);
  return px >= minX - radiusPct && px <= maxX + radiusPct && py >= minY - radiusPct && py <= maxY + radiusPct;
}

// ── Main Component ─────────────────────────────────────────

export function ImageAnnotationEditor({
  imageUrl, annotations, onChange, onClose,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  initialFocusX = 50,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  initialFocusY = 50,
}: ImageAnnotationEditorProps) {
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState<Color>('#EF4444');
  const [strokeIdx, setStrokeIdx] = useState(1);
  const [items, setItems] = useState<Annotation[]>(annotations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<Partial<Annotation> | null>(null);

  // Crop
  const [cropRect, setCropRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Eraser drag state
  const eraserActiveRef = useRef(false);

  // Marker number
  const nextMarkerNum = useCallback(() => {
    const nums = items.filter(a => a.type === 'marker' && a.markerNumber != null).map(a => a.markerNumber!);
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }, [items]);

  // Text editing overlay
  const [editingText, setEditingText] = useState<{ id: string } | null>(null);
  const textInputRef = useRef<HTMLDivElement>(null);

  const [dragState, setDragState] = useState<{
    id: string;
    handle: Handle | null;
    startX: number; startY: number;
    origX1: number; origY1: number; origX2: number; origY2: number;
  } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const strokeWidth = STROKE_OPTIONS[strokeIdx].value;

  // 이미지가 렌더링된 실제 px 크기 추적
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

  // ── Drawing ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-text-editor]')) return;
    if (editingText) { commitTextRef.current(); return; }
    if (tool === 'select') { setSelectedId(null); return; }

    e.preventDefault();
    setSelectedId(null);
    const { x, y } = toVB(e);

    if (tool === 'eraser') {
      eraserActiveRef.current = true;
      // Erase at click point
      setItems(prev => prev.filter(a => !hitTestAnnotation(a, x, y, 4, imgSize.w, imgSize.h)));
      return;
    }

    if (tool === 'text') {
      const newItem: Annotation = { id: genId(), type: 'text', x1: x, y1: y, x2: x, y2: y, text: '', color, strokeWidth };
      setItems(prev => [...prev, newItem]);
      setEditingText({ id: newItem.id });
      return;
    }

    if (tool === 'marker') {
      const num = nextMarkerNum();
      const newItem: Annotation = { id: genId(), type: 'marker', x1: x, y1: y, x2: x + 4, y2: y + 4, color, strokeWidth, markerNumber: num };
      setItems(prev => [...prev, newItem]);
      return;
    }

    if (tool === 'crop') {
      setCropRect({ x1: x, y1: y, x2: x, y2: y });
      return;
    }

    const annType: Annotation['type'] = tool === 'spotlight' ? 'spotlight' : tool as Annotation['type'];
    setDrawing({ type: annType, x1: x, y1: y, x2: x, y2: y, color, strokeWidth, id: genId() });
  }, [tool, color, strokeWidth, editingText, toVB, nextMarkerNum, imgSize.w, imgSize.h]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (cropRect && tool === 'crop') {
      const { x, y } = toVB(e);
      setCropRect(prev => prev ? { ...prev, x2: x, y2: y } : null);
      return;
    }
    if (tool === 'eraser' && eraserActiveRef.current) {
      const { x, y } = toVB(e);
      setItems(prev => prev.filter(a => !hitTestAnnotation(a, x, y, 4, imgSize.w, imgSize.h)));
      return;
    }
    if (!drawing) return;
    const { x, y } = toVB(e);
    setDrawing(prev => prev ? { ...prev, x2: x, y2: y } : null);
  }, [drawing, cropRect, tool, toVB, imgSize.w, imgSize.h]);

  const handleMouseUp = useCallback(() => {
    eraserActiveRef.current = false;
  }, []);

  const finishDrawing = useCallback((e?: MouseEvent) => {
    if (cropRect) return;
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
  }, [cropRect]);

  useEffect(() => {
    if (!drawing) return;
    const up = (e: MouseEvent) => finishDrawing(e);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [drawing, finishDrawing]);

  // Crop mouseup
  useEffect(() => {
    if (!cropRect) return;
    const up = (e: MouseEvent) => {
      const img = imgRef.current;
      if (!img) return;
      const rect = img.getBoundingClientRect();
      const x2 = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y2 = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      setCropRect(prev => prev ? { ...prev, x2, y2 } : null);
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [cropRect]);

  const applyCrop = useCallback(() => {
    if (!cropRect) return;
    if (Math.abs(cropRect.x2 - cropRect.x1) < 1 || Math.abs(cropRect.y2 - cropRect.y1) < 1) { setCropRect(null); return; }
    const ann: Annotation = {
      id: genId(), type: 'crop',
      x1: Math.min(cropRect.x1, cropRect.x2), y1: Math.min(cropRect.y1, cropRect.y2),
      x2: Math.max(cropRect.x1, cropRect.x2), y2: Math.max(cropRect.y1, cropRect.y2),
      color: 'transparent', strokeWidth: 0,
    };
    setItems(prev => [...prev, ann]);
    setCropRect(null);
    setTool('select');
  }, [cropRect]);

  const cancelCrop = useCallback(() => setCropRect(null), []);

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
      const dx = cx - dragState.startX, dy = cy - dragState.startY;
      const { handle, origX1: ox1, origY1: oy1, origX2: ox2, origY2: oy2 } = dragState;
      setItems(cur => cur.map(a => {
        if (a.id !== dragState.id) return a;
        if (!handle) return { ...a, x1: ox1 + dx, y1: oy1 + dy, x2: ox2 + dx, y2: oy2 + dy };
        if (handle === 'p1') return { ...a, x1: ox1 + dx, y1: oy1 + dy };
        if (handle === 'p2') return { ...a, x2: ox2 + dx, y2: oy2 + dy };
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
      if (e.key === 'Escape') {
        if (cropRect) { cancelCrop(); return; }
        setSelectedId(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); deleteSelected(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, editingText, deleteSelected, cropRect, cancelCrop]);

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

  const strokePx = (strokeWidth / 100) * imgSize.w;
  const editingItem = editingText ? items.find(a => a.id === editingText.id) : null;

  const activeCursor =
    tool === 'eraser' ? 'cell' :
    tool === 'select' ? 'default' :
    tool === 'text' ? 'text' :
    'crosshair';

  const showColor = !['mosaic', 'select', 'eraser', 'crop', 'spotlight'].includes(tool);
  const showStroke = !['text', 'mosaic', 'select', 'eraser', 'crop', 'spotlight', 'marker'].includes(tool);

  return (
    // ── 배경 dimmer ──
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── 팝업 컨테이너 ── */}
      <div
        ref={containerRef}
        style={{
          display: 'flex', flexDirection: 'column',
          background: '#1a1a1a', borderRadius: '12px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 48px)',
        }}
      >
        {/* ── 툴바 ── */}
        <div style={{
          height: '48px', flexShrink: 0,
          background: '#1F2937',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center',
          padding: '0 12px', gap: '6px',
        }}>
          {/* Tool groups */}
          {TOOL_GROUPS.map((group, gi) => (
            <div key={gi} style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '7px', padding: '3px' }}>
              {group.tools.map(t => {
                const active = tool === t;
                return (
                  <button
                    key={t}
                    title={TOOL_CONFIG[t].label}
                    onClick={() => {
                      if (editingText) commitTextRef.current();
                      if (t !== 'crop') setCropRect(null);
                      setTool(t);
                    }}
                    style={{
                      width: '32px', height: '32px', borderRadius: '5px', border: 'none',
                      display: 'grid', placeItems: 'center', cursor: 'pointer',
                      background: active ? 'white' : 'transparent',
                      color: active ? '#111827' : 'rgba(255,255,255,0.65)',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {TOOL_CONFIG[t].icon}
                  </button>
                );
              })}
            </div>
          ))}

          <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.12)' }} />

          {showColor && (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  style={{ width: '18px', height: '18px', borderRadius: '50%', background: c, border: color === c ? '2.5px solid white' : '2px solid transparent', cursor: 'pointer', flexShrink: 0, outline: 'none' }}
                />
              ))}
            </div>
          )}

          {showStroke && (
            <>
              <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.12)' }} />
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                {STROKE_OPTIONS.map((_, i) => (
                  <button key={i} onClick={() => setStrokeIdx(i)}
                    style={{ width: '28px', height: '26px', borderRadius: '4px', border: strokeIdx === i ? '1.5px solid white' : '1.5px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                  >
                    <div style={{ width: '12px', height: `${i * 2 + 2}px`, background: 'white', borderRadius: '1px' }} />
                  </button>
                ))}
              </div>
            </>
          )}

          {tool === 'mosaic' && (
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>블러 처리할 영역을 드래그</span>
          )}
          {tool === 'eraser' && (
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>지울 요소 위에서 드래그</span>
          )}
          {tool === 'spotlight' && (
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>강조할 영역을 드래그</span>
          )}

          {cropRect && (
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              <button onClick={applyCrop}
                style={{ height: '26px', padding: '0 10px', borderRadius: '5px', border: 'none', background: '#10B981', color: 'white', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
              >적용</button>
              <button onClick={cancelCrop}
                style={{ height: '26px', padding: '0 10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '11.5px', cursor: 'pointer' }}
              >취소</button>
            </div>
          )}

          <div style={{ flex: 1 }} />

          <button onClick={() => setItems(prev => prev.slice(0, -1))}
            style={{ height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '11.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          ><RotateCcw size={11} /> 되돌리기</button>

          {selectedId && (
            <button onClick={deleteSelected}
              style={{ height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid rgba(220,38,38,0.4)', background: 'rgba(220,38,38,0.1)', color: '#FCA5A5', fontSize: '11.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '2px' }}
            ><Trash2 size={11} /> 삭제</button>
          )}

          <button onClick={onClose}
            style={{ height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '12px', cursor: 'pointer', marginLeft: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          ><X size={13} /> 닫기</button>

          <button onClick={handleSave}
            style={{ height: '32px', padding: '0 16px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginLeft: '4px' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(79,70,229,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
          >저장</button>
        </div>

        {/* ── 이미지 + SVG 레이어 ── */}
        <div
          style={{ position: 'relative', display: 'inline-block', lineHeight: 0, cursor: activeCursor, flexShrink: 0 }}
          onMouseDown={e => handleMouseDown(e)}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="편집 중"
            draggable={false}
            style={{
              display: 'block',
              maxWidth: 'min(1100px, calc(100vw - 48px))',
              maxHeight: 'calc(100vh - 160px)',
              objectFit: 'contain',
            }}
          />

          <svg
            viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: activeCursor, overflow: 'visible' }}
          >
            <defs>
              <filter id="mosaic-blur" x="-5%" y="-5%" width="110%" height="110%">
                <feGaussianBlur stdDeviation="8" />
              </filter>
            </defs>

            {items.some(a => a.type === 'spotlight') && (
              <SpotlightLayer items={items} imgW={imgSize.w} imgH={imgSize.h} />
            )}
            {drawing?.type === 'spotlight' && (
              <SpotlightLayer items={[drawing as Annotation]} imgW={imgSize.w} imgH={imgSize.h} preview />
            )}

            {items.map(a => {
              if (a.type === 'spotlight') return null;
              return (
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
              );
            })}

            {drawing && drawing.type !== 'spotlight' && (
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

            {cropRect && (() => {
              const minX = Math.min(cropRect.x1, cropRect.x2) / 100 * imgSize.w;
              const minY = Math.min(cropRect.y1, cropRect.y2) / 100 * imgSize.h;
              const w = Math.abs(cropRect.x2 - cropRect.x1) / 100 * imgSize.w;
              const h = Math.abs(cropRect.y2 - cropRect.y1) / 100 * imgSize.h;
              return (
                <g pointerEvents="none">
                  <defs>
                    <mask id="crop-preview-mask">
                      <rect x={0} y={0} width={imgSize.w} height={imgSize.h} fill="white" />
                      <rect x={minX} y={minY} width={w} height={h} fill="black" />
                    </mask>
                  </defs>
                  <rect x={0} y={0} width={imgSize.w} height={imgSize.h} fill="rgba(0,0,0,0.5)" mask="url(#crop-preview-mask)" />
                  <rect x={minX} y={minY} width={w} height={h} fill="none" stroke="white" strokeWidth={1.5} strokeDasharray="5 3" />
                  <line x1={minX + w/3} y1={minY} x2={minX + w/3} y2={minY + h} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                  <line x1={minX + 2*w/3} y1={minY} x2={minX + 2*w/3} y2={minY + h} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                  <line x1={minX} y1={minY + h/3} x2={minX + w} y2={minY + h/3} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                  <line x1={minX} y1={minY + 2*h/3} x2={minX + w} y2={minY + 2*h/3} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                </g>
              );
            })()}
          </svg>

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
                left: `${editingItem.x1}%`, top: `${editingItem.y1}%`,
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

        {/* ── 하단 힌트 ── */}
        <div style={{ height: '26px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.3)', background: '#1a1a1a' }}>
          {tool === 'text' ? '클릭 후 텍스트 입력 · Enter 확정' :
           tool === 'select' ? '클릭으로 선택 · 드래그로 이동 · 핸들로 크기 조절 · Delete 삭제' :
           tool === 'eraser' ? '지울 요소 위에서 드래그 · 클릭으로 바로 삭제' :
           tool === 'crop' ? (cropRect ? '적용 또는 취소 · ESC 취소' : '자를 영역을 드래그') :
           tool === 'mosaic' ? '블러 처리할 영역을 드래그' :
           tool === 'marker' ? '클릭하면 번호 마커 추가' :
           tool === 'spotlight' ? '강조할 영역을 드래그' :
           '드래그하여 그리기 · Space+드래그로 이동'}
        </div>
      </div>
    </div>
  );
}

// ── SpotlightLayer ──────────────────────────────────────────

function SpotlightLayer({ items, imgW, imgH, preview }: {
  items: Annotation[]; imgW: number; imgH: number; preview?: boolean;
}) {
  const spotlights = items.filter(a => a.type === 'spotlight');
  if (!spotlights.length) return null;
  const maskId = `spotlight-mask-${Math.random().toString(36).slice(2)}`;
  return (
    <g style={{ pointerEvents: 'none' }}>
      <defs>
        <mask id={maskId}>
          <rect x={0} y={0} width={imgW} height={imgH} fill="white" />
          {spotlights.map(a => {
            const minX = Math.min(a.x1, a.x2) / 100 * imgW, minY = Math.min(a.y1, a.y2) / 100 * imgH;
            const w = Math.abs(a.x2 - a.x1) / 100 * imgW, h = Math.abs(a.y2 - a.y1) / 100 * imgH;
            return <rect key={a.id} x={minX} y={minY} width={w} height={h} fill="black" rx={4} />;
          })}
        </mask>
      </defs>
      <rect x={0} y={0} width={imgW} height={imgH} fill="rgba(0,0,0,0.62)" mask={`url(#${maskId})`} opacity={preview ? 0.7 : 1} />
      {spotlights.map(a => {
        const minX = Math.min(a.x1, a.x2) / 100 * imgW, minY = Math.min(a.y1, a.y2) / 100 * imgH;
        const w = Math.abs(a.x2 - a.x1) / 100 * imgW, h = Math.abs(a.y2 - a.y1) / 100 * imgH;
        return <rect key={a.id} x={minX} y={minY} width={w} height={h} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} rx={4} />;
      })}
    </g>
  );
}

// ── AnnotationShape ─────────────────────────────────────────

interface AnnotationShapeProps {
  annotation: Annotation;
  isSelected: boolean;
  tool: Tool;
  imgW: number; imgH: number;
  strokePx: number;
  imageUrl: string;
  onBodyMouseDown?: (e: React.MouseEvent) => void;
  onHandleMouseDown?: (e: React.MouseEvent, h: Handle) => void;
}

function SelectionHandles({ minX, minY, w, h, onHandle }: {
  minX: number; minY: number; w: number; h: number;
  onHandle: (e: React.MouseEvent, h: Handle) => void;
}) {
  const R = 5;
  const handles: [Handle, number, number][] = [
    ['tl', minX, minY], ['tc', minX + w/2, minY], ['tr', minX + w, minY],
    ['ml', minX, minY + h/2], ['mr', minX + w, minY + h/2],
    ['bl', minX, minY + h], ['bc', minX + w/2, minY + h], ['br', minX + w, minY + h],
  ];
  return (
    <g>
      <rect x={minX} y={minY} width={w} height={h} stroke="#2563EB" strokeWidth={1.5} fill="none" pointerEvents="none" />
      {handles.map(([hKey, cx, cy]) => (
        <rect key={hKey} x={cx - R} y={cy - R} width={R*2} height={R*2}
          fill="white" stroke="#2563EB" strokeWidth={1.5}
          style={{ cursor: HANDLE_CURSOR[hKey] }}
          onMouseDown={e => { e.stopPropagation(); onHandle(e, hKey); }}
        />
      ))}
    </g>
  );
}

function ArrowHandles({ ax1, ay1, ax2, ay2, onHandle }: {
  ax1: number; ay1: number; ax2: number; ay2: number;
  onHandle: (e: React.MouseEvent, h: Handle) => void;
}) {
  const R = 5;
  return (
    <g>
      <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke="#2563EB" strokeWidth={1.5} strokeDasharray="4 2" pointerEvents="none" />
      {(['p1', 'p2'] as Handle[]).map(h => {
        const cx = h === 'p1' ? ax1 : ax2, cy = h === 'p1' ? ay1 : ay2;
        return (
          <circle key={h} cx={cx} cy={cy} r={R} fill="white" stroke="#2563EB" strokeWidth={1.5}
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
  const ax1 = (x1/100)*imgW, ay1 = (y1/100)*imgH, ax2 = (x2/100)*imgW, ay2 = (y2/100)*imgH;
  const minX = Math.min(ax1,ax2), minY = Math.min(ay1,ay2);
  const w = Math.abs(ax2-ax1), h = Math.abs(ay2-ay1);
  const isSelectTool = tool === 'select';
  const bodyCursor = isSelectTool ? 'move' : tool === 'eraser' ? 'cell' : 'crosshair';
  const handleHandle = onHandleMouseDown ?? (() => {});

  if (type === 'recorderBox') return (
    <g>
      <rect x={minX} y={minY} width={w} height={h} rx={2}
        stroke="#EF4444" strokeWidth={Math.max(2, strokePx)} fill="rgba(239,68,68,0.08)"
        style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
      {isSelected && onHandleMouseDown && <SelectionHandles minX={minX} minY={minY} w={w} h={h} onHandle={handleHandle} />}
    </g>
  );

  if (type === 'crop') return (
    <g>
      <rect x={minX} y={minY} width={w} height={h}
        fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} strokeDasharray="5 3"
        style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
      {isSelected && onHandleMouseDown && <SelectionHandles minX={minX} minY={minY} w={w} h={h} onHandle={handleHandle} />}
    </g>
  );

  if (type === 'marker') {
    const R = Math.max(10, imgW * 0.022);
    return (
      <g style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown}>
        <circle cx={ax1} cy={ay1} r={R} fill={color} />
        <circle cx={ax1} cy={ay1} r={R} fill="none" stroke="white" strokeWidth={1.5} opacity={0.5} />
        <text x={ax1} y={ay1} fill="white" fontSize={R * 1.1} fontWeight="700"
          textAnchor="middle" dominantBaseline="central"
          stroke="rgba(0,0,0,0.3)" strokeWidth={R * 0.15}
          style={{ paintOrder: 'stroke', pointerEvents: 'none' }}
        >{a.markerNumber ?? 1}</text>
        {isSelected && <circle cx={ax1} cy={ay1} r={R+4} fill="none" stroke="#2563EB" strokeWidth={1.5} strokeDasharray="4 2" />}
      </g>
    );
  }

  if (type === 'mosaic') {
    const clipId = `mosaic-clip-${a.id}`;
    return (
      <g>
        <defs><clipPath id={clipId}><rect x={minX} y={minY} width={w} height={h} /></clipPath></defs>
        <image href={imageUrl} x="0" y="0" width={imgW} height={imgH}
          preserveAspectRatio="none" filter="url(#mosaic-blur)" clipPath={`url(#${clipId})`}
          style={{ pointerEvents: 'none' }} />
        <rect x={minX} y={minY} width={w} height={h} fill="transparent"
          style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
        {isSelected && onHandleMouseDown && <SelectionHandles minX={minX} minY={minY} w={w} h={h} onHandle={handleHandle} />}
      </g>
    );
  }

  if (type === 'highlight') return (
    <g>
      <rect x={minX} y={minY} width={w} height={h} fill={color} opacity={0.35} rx={1}
        style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
      {isSelected && onHandleMouseDown && <SelectionHandles minX={minX} minY={minY} w={w} h={h} onHandle={handleHandle} />}
    </g>
  );

  if (type === 'rect') return (
    <g>
      <rect x={minX} y={minY} width={w} height={h} rx={1} stroke={color} strokeWidth={strokePx} fill="none"
        style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
      {isSelected && onHandleMouseDown && <SelectionHandles minX={minX} minY={minY} w={w} h={h} onHandle={handleHandle} />}
    </g>
  );

  if (type === 'ellipse') return (
    <g>
      <ellipse cx={(ax1+ax2)/2} cy={(ay1+ay2)/2} rx={w/2} ry={h/2}
        stroke={color} strokeWidth={strokePx} fill="none"
        style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
      {isSelected && onHandleMouseDown && <SelectionHandles minX={minX} minY={minY} w={w} h={h} onHandle={handleHandle} />}
    </g>
  );

  if (type === 'arrow') {
    const markerId = `arrow-${a.id}`;
    const mSize = strokePx * 4;
    return (
      <g>
        <defs>
          <marker id={markerId} markerWidth={mSize} markerHeight={mSize}
            refX={mSize-1} refY={mSize/2} orient="auto" markerUnits="userSpaceOnUse">
            <path d={`M0,0 L0,${mSize} L${mSize},${mSize/2} z`} fill={color} />
          </marker>
        </defs>
        <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke="transparent"
          strokeWidth={Math.max(10, strokePx*3)} style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
        <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke={color} strokeWidth={strokePx}
          markerEnd={`url(#${markerId})`} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
        {isSelected && onHandleMouseDown && <ArrowHandles ax1={ax1} ay1={ay1} ax2={ax2} ay2={ay2} onHandle={handleHandle} />}
      </g>
    );
  }

  if (type === 'text') {
    if (!text) return null;
    const fSize = Math.max(12, imgW * 0.018);
    const textW = text.length * fSize * 0.65;
    return (
      <g>
        <rect x={ax1-2} y={ay1-2} width={textW+4} height={fSize+8} fill="transparent"
          style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
        <text x={ax1} y={ay1} fill={color} fontSize={fSize} fontWeight="700"
          dominantBaseline="text-before-edge"
          stroke="rgba(0,0,0,0.6)" strokeWidth={fSize*0.12}
          style={{ paintOrder: 'stroke', pointerEvents: 'none' }}>{text}</text>
        {isSelected && onHandleMouseDown && <SelectionHandles minX={ax1-2} minY={ay1-2} w={textW+4} h={fSize+8} onHandle={handleHandle} />}
      </g>
    );
  }

  return null;
}
