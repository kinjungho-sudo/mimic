'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Trash2, RotateCcw, Bold } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

type Tool = 'select' | 'eraser' | 'mosaic' | 'ellipse' | 'rect' | 'roundedRect' | 'arrow' | 'text' | 'marker' | 'spotlight';
type Color = string;
type Handle = 'tl'|'tc'|'tr'|'ml'|'mr'|'bl'|'bc'|'br'|'p1'|'p2';

export interface Annotation {
  id: string;
  type: 'arrow' | 'rect' | 'roundedRect' | 'ellipse' | 'text' | 'highlight' | 'mosaic' | 'marker' | 'spotlight' | 'recorderBox' | 'crop';
  x1: number; y1: number; // 0–100 pct of image
  x2: number; y2: number;
  text?: string;
  color: Color;
  borderColor?: string;
  strokeWidth: number;
  fontSize?: number;
  fontBold?: boolean;
  markerNumber?: number;
  textAlign?: 'left' | 'center' | 'right';
  hasBg?: boolean;
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

const STROKE_OPTIONS = [
  { value: 0.25, label: 'S' },
  { value: 0.5,  label: 'M' },
  { value: 0.9,  label: 'L' },
];

const FONT_SIZES = [12, 14, 16, 18, 22, 28, 36];
const DEFAULT_BORDER = 'rgba(255,255,255,0.6)';

// 그룹 A: 지우개/블러, 그룹 B: 도형/텍스트
const TOOL_GROUPS: { tools: Tool[] }[] = [
  { tools: ['mosaic', 'eraser'] },
  { tools: ['select', 'ellipse', 'rect', 'roundedRect', 'arrow', 'text', 'marker', 'spotlight'] },
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
  roundedRect: {
    label: '둥근 사각형',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="16" rx="5"/></svg>,
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
  tl: 'nwse-resize', tc: 'ns-resize', tr: 'nesw-resize',
  ml: 'ew-resize',                     mr: 'ew-resize',
  bl: 'nesw-resize', bc: 'ns-resize', br: 'nwse-resize',
  p1: 'crosshair', p2: 'crosshair',
};

// 완성 후 select로 전환되는 툴
const SHAPE_TOOLS: Tool[] = ['ellipse', 'rect', 'roundedRect', 'arrow', 'mosaic', 'spotlight', 'text'];

function genId() { return Math.random().toString(36).slice(2, 9); }

function AlignIcon({ align }: { align: 'left' | 'center' | 'right' }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      {align === 'left'   && <><line x1="1" y1="3" x2="13" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="1" y1="7" x2="9"  y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="1" y1="11" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>}
      {align === 'center' && <><line x1="1" y1="3" x2="13" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="11" x2="12" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>}
      {align === 'right'  && <><line x1="1" y1="3" x2="13" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="5" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>}
    </svg>
  );
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number, aw: number) {
  const dx = (x2 - x1) * aw, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const ppx = (px - x1) * aw, ppy = py - y1;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (ppx * dx + ppy * dy) / lenSq));
  return Math.sqrt((ppx - t * dx) ** 2 + (ppy - t * dy) ** 2);
}

function hitTestAnnotation(a: Annotation, px: number, py: number, r: number, imgW: number, imgH: number): boolean {
  const aw = imgW / imgH;
  if (a.type === 'arrow') return distToSegment(px, py, a.x1, a.y1, a.x2, a.y2, aw) < r * aw;
  if (a.type === 'marker') {
    const dx = (px - a.x1) * aw, dy = py - a.y1;
    return Math.sqrt(dx * dx + dy * dy) < r * aw + 5;
  }
  const minX = Math.min(a.x1, a.x2), maxX = Math.max(a.x1, a.x2);
  const minY = Math.min(a.y1, a.y2), maxY = Math.max(a.y1, a.y2);
  return px >= minX - r && px <= maxX + r && py >= minY - r && py <= maxY + r;
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
  const [fontSize, setFontSize] = useState(16);
  const [fontBold, setFontBold] = useState(false);
  const [borderColor, setBorderColor] = useState<string>(DEFAULT_BORDER);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [hasBg, setHasBg] = useState(true);

  const lastColor = useRef(color);
  const lastStrokeIdx = useRef(strokeIdx);
  const lastFontSize = useRef(fontSize);
  const lastFontBold = useRef(fontBold);
  const lastBorderColor = useRef(borderColor);
  const lastTextAlign = useRef(textAlign);
  const lastHasBg = useRef(hasBg);
  useEffect(() => { lastColor.current = color; }, [color]);
  useEffect(() => { lastStrokeIdx.current = strokeIdx; }, [strokeIdx]);
  useEffect(() => { lastFontSize.current = fontSize; }, [fontSize]);
  useEffect(() => { lastFontBold.current = fontBold; }, [fontBold]);
  useEffect(() => { lastBorderColor.current = borderColor; }, [borderColor]);
  useEffect(() => { lastTextAlign.current = textAlign; }, [textAlign]);
  useEffect(() => { lastHasBg.current = hasBg; }, [hasBg]);

  const [items, setItems] = useState<Annotation[]>(annotations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<Partial<Annotation> | null>(null);
  const eraserActiveRef = useRef(false);
  // 텍스트 드래그 중 박스 미리보기
  const [textDrawing, setTextDrawing] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const nextMarkerNum = useCallback(() => {
    const nums = items.filter(a => a.type === 'marker' && a.markerNumber != null).map(a => a.markerNumber!);
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }, [items]);

  const [editingText, setEditingText] = useState<{ id: string } | null>(null);
  const textInputRef = useRef<HTMLDivElement>(null);

  const [dragState, setDragState] = useState<{
    id: string; handle: Handle | null;
    startX: number; startY: number;
    origX1: number; origY1: number; origX2: number; origY2: number;
  } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const toVB = useCallback((e: React.MouseEvent | MouseEvent) => {
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

  const strokeWidth = STROKE_OPTIONS[strokeIdx].value;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-text-editor]')) return;
    if (editingText) { commitTextRef.current(); return; }
    if (tool === 'select') { setSelectedId(null); setColorPopover(null); setAlignOpen(false); return; }

    e.preventDefault();
    setSelectedId(null);
    const { x, y } = toVB(e);

    if (tool === 'eraser') {
      eraserActiveRef.current = true;
      setItems(prev => prev.filter(a => !hitTestAnnotation(a, x, y, 4, imgSize.w, imgSize.h)));
      return;
    }

    if (tool === 'marker') {
      const num = nextMarkerNum();
      setItems(prev => [...prev, {
        id: genId(), type: 'marker',
        x1: x, y1: y, x2: x + 4, y2: y + 4,
        color: lastColor.current, strokeWidth, markerNumber: num,
      }]);
      return;
    }

    // 텍스트: 드래그로 박스 크기 지정
    if (tool === 'text') {
      setTextDrawing({ x1: x, y1: y, x2: x, y2: y });
      return;
    }

    const annType: Annotation['type'] =
      tool === 'spotlight' ? 'spotlight' :
      tool === 'roundedRect' ? 'roundedRect' :
      tool as Annotation['type'];
    setDrawing({
      type: annType, x1: x, y1: y, x2: x, y2: y,
      color: lastColor.current, strokeWidth: STROKE_OPTIONS[lastStrokeIdx.current].value, id: genId(),
    });
  }, [tool, strokeWidth, editingText, toVB, nextMarkerNum, imgSize.w, imgSize.h]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (tool === 'eraser' && eraserActiveRef.current) {
      const { x, y } = toVB(e);
      setItems(prev => prev.filter(a => !hitTestAnnotation(a, x, y, 4, imgSize.w, imgSize.h)));
      return;
    }
    if (textDrawing) {
      const { x, y } = toVB(e);
      setTextDrawing(prev => prev ? { ...prev, x2: x, y2: y } : null);
      return;
    }
    if (!drawing) return;
    const { x, y } = toVB(e);
    setDrawing(prev => prev ? { ...prev, x2: x, y2: y } : null);
  }, [drawing, textDrawing, tool, toVB, imgSize.w, imgSize.h]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    eraserActiveRef.current = false;

    if (textDrawing) {
      const { x, y } = toVB(e);
      const finalX2 = x, finalY2 = y;
      const dx = Math.abs(finalX2 - textDrawing.x1);
      const dy = Math.abs(finalY2 - textDrawing.y1);
      // 너무 작으면 기본 크기 사용
      const x2 = dx < 2 ? textDrawing.x1 + 15 : finalX2;
      const y2 = dy < 1 ? textDrawing.y1 + 6 : finalY2;
      const newItem: Annotation = {
        id: genId(), type: 'text',
        x1: Math.min(textDrawing.x1, x2), y1: Math.min(textDrawing.y1, y2),
        x2: Math.max(textDrawing.x1, x2), y2: Math.max(textDrawing.y1, y2),
        text: '', color: lastColor.current, strokeWidth,
        fontSize: lastFontSize.current, fontBold: lastFontBold.current,
        borderColor: lastBorderColor.current,
        textAlign: lastTextAlign.current,
        hasBg: lastHasBg.current,
      };
      setItems(prev => [...prev, newItem]);
      setTextDrawing(null);
      // 생성 직후 바로 텍스트 편집 모드로 진입
      setTimeout(() => { setTool('select'); setSelectedId(newItem.id); setEditingText({ id: newItem.id }); }, 0);
    }
  }, [textDrawing, toVB, strokeWidth]);

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
      setItems(cur => {
        const next = [...cur, final];
        if (SHAPE_TOOLS.includes(prev.type as Tool)) {
          setTimeout(() => { setTool('select'); setSelectedId(final.id); }, 0);
        }
        return next;
      });
      return null;
    });
  }, []);

  useEffect(() => {
    if (!drawing) return;
    const up = (e: MouseEvent) => finishDrawing(e);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [drawing, finishDrawing]);

  // startDrag: spotlight도 포함 (select tool 기반)
  const startDrag = useCallback((e: React.MouseEvent, id: string, handle: Handle | null) => {
    if (tool !== 'select') return;
    e.stopPropagation(); e.preventDefault();
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
        if (!handle) return { ...a, x1: ox1+dx, y1: oy1+dy, x2: ox2+dx, y2: oy2+dy };
        if (handle === 'p1') return { ...a, x1: ox1+dx, y1: oy1+dy };
        if (handle === 'p2') return { ...a, x2: ox2+dx, y2: oy2+dy };
        let { x1, y1, x2, y2 } = a;
        if (handle === 'tl') { x1=ox1+dx; y1=oy1+dy; }
        if (handle === 'tc') { y1=oy1+dy; }
        if (handle === 'tr') { x2=ox2+dx; y1=oy1+dy; }
        if (handle === 'ml') { x1=ox1+dx; }
        if (handle === 'mr') { x2=ox2+dx; }
        if (handle === 'bl') { x1=ox1+dx; y2=oy2+dy; }
        if (handle === 'bc') { y2=oy2+dy; }
        if (handle === 'br') { x2=ox2+dx; y2=oy2+dy; }
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

  // 선택된 아이템 속성을 즉시 업데이트 (커서 모드에서 속성 변경)
  const updateSelected = useCallback((patch: Partial<Annotation>) => {
    if (!selectedId) return;
    setItems(cur => cur.map(a => a.id === selectedId ? { ...a, ...patch } : a));
  }, [selectedId]);

  const editingItem = editingText ? items.find(a => a.id === editingText.id) : null;
  const selectedItem = selectedId ? items.find(a => a.id === selectedId) : null;

  // 툴바 표시 조건 — tool 또는 select 모드에서 선택된 아이템 타입 기준
  const effectiveType = tool === 'select'
    ? (selectedItem?.type ?? null)
    : tool;

  const isTextTool = tool === 'text';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isShapeTool = ['ellipse', 'rect', 'roundedRect', 'arrow'].includes(tool);

  // 현재 편집 대상의 속성값 (select 모드에서는 선택 아이템 값, 아니면 전역 state)
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const activeColor      = (tool === 'select' && selectedItem) ? selectedItem.color        : color;
  const activeStrokeIdx  = (tool === 'select' && selectedItem) ? (() => {
    const sw = selectedItem.strokeWidth;
    const idx = STROKE_OPTIONS.findIndex(o => Math.abs(o.value - sw) < 0.1);
    return idx >= 0 ? idx : strokeIdx;
  })() : strokeIdx;
  const activeFontSize   = (tool === 'select' && selectedItem?.fontSize)   ? selectedItem.fontSize   : fontSize;
  const activeFontBold   = (tool === 'select' && selectedItem)             ? (selectedItem.fontBold ?? false) : fontBold;
  const activeBorderColor= (tool === 'select' && selectedItem?.borderColor)? selectedItem.borderColor: borderColor;
  const activeTextAlign  = (tool === 'select' && selectedItem?.textAlign)  ? selectedItem.textAlign  : textAlign;
  const activeHasBg      = (tool === 'select' && selectedItem)             ? (selectedItem.hasBg !== false)  : hasBg;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  // setter: select 모드면 아이템 직접 업데이트, 아니면 전역 state
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const setActiveColor = (c: string) => {
    if (tool === 'select' && selectedId) updateSelected({ color: c });
    setColor(c);
  };
  const setActiveStrokeIdx = (i: number) => {
    if (tool === 'select' && selectedId) updateSelected({ strokeWidth: STROKE_OPTIONS[i].value });
    setStrokeIdx(i);
  };
  const setActiveFontSize = (s: number) => {
    if (tool === 'select' && selectedId) updateSelected({ fontSize: s });
    setFontSize(s);
  };
  const setActiveFontBold = (b: boolean) => {
    if (tool === 'select' && selectedId) updateSelected({ fontBold: b });
    setFontBold(b);
  };
  const setActiveBorderColor = (c: string) => {
    if (tool === 'select' && selectedId) updateSelected({ borderColor: c });
    setBorderColor(c);
  };
  const setActiveTextAlign = (a: 'left' | 'center' | 'right') => {
    if (tool === 'select' && selectedId) updateSelected({ textAlign: a });
    setTextAlign(a);
  };
  const setActiveHasBg = (b: boolean) => {
    if (tool === 'select' && selectedId) updateSelected({ hasBg: b });
    setHasBg(b);
  };
  /* eslint-enable @typescript-eslint/no-unused-vars */

  const showColor    = effectiveType !== null && !['mosaic', 'eraser', 'spotlight'].includes(effectiveType);
  const showStroke   = effectiveType !== null && ['ellipse', 'rect', 'roundedRect', 'arrow'].includes(effectiveType);
  const showTextOpts = effectiveType === 'text';

  const [colorPopover, setColorPopover] = useState<'main' | 'text' | 'border' | null>(null);
  const [alignOpen, setAlignOpen] = useState(false);

  const activeCursor =
    tool === 'eraser' ? 'cell' :
    tool === 'select' ? 'default' :
    tool === 'text' ? 'crosshair' :
    'crosshair';

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
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
        {/* ── 툴바 — 2줄 구조 ── */}
        <div style={{ flexShrink: 0, background: '#1F2937', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>

          {/* ── 1줄: 도구 버튼 + 색상 + 액션 ── */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: '6px', height: '48px' }}>
            {/* 툴 그룹 */}
            {TOOL_GROUPS.map((group, gi) => (
              <div key={gi} style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '7px', padding: '3px' }}>
                {group.tools.map(t => {
                  const active = tool === t;
                  return (
                    <button key={t} title={TOOL_CONFIG[t].label}
                      onClick={() => { if (editingText) commitTextRef.current(); setTool(t); setColorPopover(null); setAlignOpen(false); }}
                      style={{
                        width: '32px', height: '32px', borderRadius: '5px', border: 'none',
                        display: 'grid', placeItems: 'center', cursor: 'pointer',
                        background: active ? 'white' : 'transparent',
                        color: active ? '#111827' : 'rgba(255,255,255,0.65)',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    >{TOOL_CONFIG[t].icon}</button>
                  );
                })}
              </div>
            ))}

            {/* 공통 색상 버튼 — 색상이 필요한 툴/선택 상태일 때만 표시 */}
            {showColor && (
              <div style={{ position: 'relative' }}>
                <button
                  title="색상 변경"
                  onClick={e => { e.stopPropagation(); setColorPopover(colorPopover === 'main' ? null : 'main'); setAlignOpen(false); }}
                  style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.5)', background: activeColor, cursor: 'pointer', outline: 'none', flexShrink: 0 }}
                />
                {colorPopover === 'main' && (
                  <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '38px', left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: '#1F2937', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: '5px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                    {(showTextOpts ? [...COLORS, '#FFFFFF'] : COLORS).map(c => (
                      <button key={c} onClick={() => { setActiveColor(c); setColorPopover(null); }}
                        style={{ width: '22px', height: '22px', borderRadius: '50%', background: c, border: activeColor === c ? '2.5px solid white' : c === '#FFFFFF' ? '1.5px solid rgba(255,255,255,0.4)' : '2px solid transparent', cursor: 'pointer', outline: 'none', flexShrink: 0 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ flex: 1 }} />

            {/* 되돌리기 */}
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

            <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />

            <button onClick={onClose}
              style={{ height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            ><X size={13} /> 닫기</button>

            <button onClick={handleSave}
              style={{ height: '32px', padding: '0 16px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginLeft: '4px' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(55,48,163,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
            >저장</button>
          </div>

          {/* ── 2줄: 옵션 바 (색상은 1줄 공통 버튼으로 이동, 여기선 굵기/텍스트 속성/힌트만) ── */}
          {(showStroke || showTextOpts || ['mosaic','eraser','spotlight'].includes(tool)) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px', height: '38px', background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
              onClick={() => { setAlignOpen(false); }}
            >
              {/* 굵기 */}
              {showStroke && (
                <>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>굵기</span>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {STROKE_OPTIONS.map((_, i) => (
                      <button key={i} onClick={() => setActiveStrokeIdx(i)}
                        style={{ width: '28px', height: '24px', borderRadius: '4px', border: activeStrokeIdx === i ? '1.5px solid white' : '1.5px solid rgba(255,255,255,0.2)', background: activeStrokeIdx === i ? 'rgba(255,255,255,0.15)' : 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                      ><div style={{ width: '12px', height: `${i * 2 + 2}px`, background: 'white', borderRadius: '1px' }} /></button>
                    ))}
                  </div>
                </>
              )}

              {/* 텍스트 옵션 (글자색은 1줄 공통 색상 버튼으로 이동) */}
              {showTextOpts && (
                <>
                  {/* 크기 */}
                  <select value={activeFontSize} onChange={e => setActiveFontSize(Number(e.target.value))}
                    style={{ background: '#374151', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px', color: 'white', fontSize: '11px', padding: '2px 4px', cursor: 'pointer', outline: 'none', height: '26px' }}
                  >{FONT_SIZES.map(s => <option key={s} value={s} style={{ background: '#374151' }}>{s}px</option>)}</select>

                  {/* 굵게 */}
                  <button onClick={() => setActiveFontBold(!activeFontBold)} title="굵게"
                    style={{ width: '26px', height: '26px', borderRadius: '4px', border: activeFontBold ? '1.5px solid white' : '1.5px solid rgba(255,255,255,0.2)', background: activeFontBold ? 'rgba(255,255,255,0.15)' : 'transparent', color: 'white', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                  ><Bold size={11} /></button>

                  <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)' }} />

                  {/* 정렬 드롭다운 */}
                  <div style={{ position: 'relative' }}>
                    <button title="정렬" onClick={e => { e.stopPropagation(); setAlignOpen(v => !v); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '26px', padding: '0 8px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.8)', fontSize: '11px', cursor: 'pointer' }}
                    >
                      <AlignIcon align={activeTextAlign} />
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                    </button>
                    {alignOpen && (
                      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '34px', left: 0, zIndex: 100, background: '#1F2937', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                        {(['left', 'center', 'right'] as const).map(a => (
                          <button key={a} onClick={() => { setActiveTextAlign(a); setAlignOpen(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '7px', height: '28px', padding: '0 10px', borderRadius: '5px', border: 'none', background: activeTextAlign === a ? 'rgba(255,255,255,0.1)' : 'transparent', color: 'rgba(255,255,255,0.8)', fontSize: '11px', cursor: 'pointer' }}
                          >
                            <AlignIcon align={a} />
                            {a === 'left' ? '왼쪽' : a === 'center' ? '가운데' : '오른쪽'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)' }} />

                  {/* 배경 토글 */}
                  <button onClick={() => setActiveHasBg(!activeHasBg)} title={activeHasBg ? '배경 끄기' : '배경 켜기'}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '26px', padding: '0 8px', borderRadius: '4px', border: activeHasBg ? '1.5px solid white' : '1.5px solid rgba(255,255,255,0.2)', background: activeHasBg ? 'rgba(255,255,255,0.15)' : 'transparent', color: 'rgba(255,255,255,0.8)', fontSize: '11px', cursor: 'pointer' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill={activeHasBg ? 'rgba(255,255,255,0.3)' : 'none'} />
                      {!activeHasBg && <line x1="2" y1="12" x2="12" y2="2" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>}
                    </svg>
                    배경
                  </button>

                  <div style={{ flex: 1 }} />
                  {isTextTool && <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.4)' }}>드래그로 박스 크기 지정 · Enter 확정</span>}
                </>
              )}

              {/* 힌트 — 색상/굵기/텍스트 없는 툴 */}
              {!showStroke && !showTextOpts && (
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>
                  {tool === 'mosaic' && '블러 처리할 영역을 드래그하세요'}
                  {tool === 'eraser' && '지울 요소 위에서 드래그하세요'}
                  {tool === 'spotlight' && '강조할 영역을 드래그하세요'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Canvas ── */}
        <div
          style={{ position: 'relative', display: 'inline-block', lineHeight: 0, cursor: activeCursor, flexShrink: 0 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef} src={imageUrl} alt="편집 중" draggable={false}
            style={{ display: 'block', maxWidth: 'min(1100px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 160px)', objectFit: 'contain' }}
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

            {/* 스포트라이트 레이어 — 선택 가능한 spotlight 포함 */}
            <SpotlightLayer
              items={items}
              imgW={imgSize.w} imgH={imgSize.h}
              tool={tool}
              selectedId={selectedId}
              onBodyMouseDown={(id, e) => startDrag(e, id, null)}
              onHandleMouseDown={(id, h, e) => startDrag(e, id, h)}
            />
            {drawing?.type === 'spotlight' && (
              <SpotlightLayer items={[drawing as Annotation]} imgW={imgSize.w} imgH={imgSize.h} tool={tool} selectedId={null} preview />
            )}

            {/* 일반 annotation shapes (spotlight 제외) */}
            {items.map(a => {
              if (a.type === 'spotlight') return null;
              return (
                <AnnotationShape
                  key={a.id} annotation={a}
                  isSelected={selectedId === a.id}
                  tool={tool} imgW={imgSize.w} imgH={imgSize.h}
                  strokePx={(a.strokeWidth / 100) * imgSize.w}
                  imageUrl={imageUrl}
                  onBodyMouseDown={e => startDrag(e, a.id, null)}
                  onHandleMouseDown={(e, h) => startDrag(e, a.id, h)}
                  onBodyDblClick={a.type === 'text' ? () => { setTool('select'); setSelectedId(a.id); setEditingText({ id: a.id }); } : undefined}
                />
              );
            })}

            {drawing && drawing.type !== 'spotlight' && (
              <AnnotationShape
                annotation={drawing as Annotation} isSelected={false}
                tool={tool} imgW={imgSize.w} imgH={imgSize.h}
                strokePx={(drawing.strokeWidth ?? strokeWidth) / 100 * imgSize.w}
                imageUrl={imageUrl}
              />
            )}

            {/* 텍스트 드래그 박스 미리보기 */}
            {textDrawing && (() => {
              const mx = Math.min(textDrawing.x1, textDrawing.x2) / 100 * imgSize.w;
              const my = Math.min(textDrawing.y1, textDrawing.y2) / 100 * imgSize.h;
              const mw = Math.abs(textDrawing.x2 - textDrawing.x1) / 100 * imgSize.w;
              const mh = Math.abs(textDrawing.y2 - textDrawing.y1) / 100 * imgSize.h;
              return (
                <rect x={mx} y={my} width={mw} height={mh}
                  fill="rgba(55,48,163,0.08)"
                  stroke="#3730a3" strokeWidth={1.5} strokeDasharray="5 3" rx={3}
                  pointerEvents="none"
                />
              );
            })()}
          </svg>

          {/* 텍스트 편집 오버레이 */}
          {editingText && editingItem && (() => {
            const boxW = Math.abs(editingItem.x2 - editingItem.x1);
            const boxH = Math.abs(editingItem.y2 - editingItem.y1);
            return (
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
                  left: `${Math.min(editingItem.x1, editingItem.x2)}%`,
                  top: `${Math.min(editingItem.y1, editingItem.y2)}%`,
                  width: boxW > 2 ? `${boxW}%` : '80px',
                  minHeight: boxH > 1 ? `${boxH}%` : '24px',
                  padding: '4px 8px',
                  background: 'transparent',
                  border: '1.5px dashed rgba(255,255,255,0.4)',
                  borderRadius: '3px',
                  color: editingItem.color,
                  fontSize: `${editingItem.fontSize ?? 16}px`,
                  fontWeight: editingItem.fontBold ? 700 : 400,
                  textAlign: editingItem.textAlign ?? 'left',
                  fontFamily: 'inherit',
                  outline: 'none', cursor: 'text',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  lineHeight: 1.4, zIndex: 10,
                  caretColor: editingItem.color,
                  boxSizing: 'border-box',
                }}
              />
            );
          })()}
        </div>

        <div style={{ height: '24px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', background: '#1a1a1a' }}>
          {tool === 'select' ? '클릭으로 선택 · 드래그로 이동 · 핸들로 크기 조절 · Delete 삭제' :
           tool === 'marker' ? '클릭하면 번호 마커 추가' :
           tool === 'spotlight' ? '완성 후 선택 모드로 전환 — 이동 · 크기 조절 가능' :
           tool === 'text' ? '' :
           '드래그하여 그리기 · 완성 후 자동 선택 모드 전환'}
        </div>
      </div>
    </div>
  );
}

// ── SpotlightLayer — 선택/편집 가능 ──────────────────────────

interface SpotlightLayerProps {
  items: Annotation[];
  imgW: number; imgH: number;
  tool: Tool;
  selectedId: string | null;
  preview?: boolean;
  onBodyMouseDown?: (id: string, e: React.MouseEvent) => void;
  onHandleMouseDown?: (id: string, h: Handle, e: React.MouseEvent) => void;
}

function SpotlightLayer({ items, imgW, imgH, tool, selectedId, preview, onBodyMouseDown, onHandleMouseDown }: SpotlightLayerProps) {
  const spotlights = items.filter(a => a.type === 'spotlight');
  if (!spotlights.length) return null;
  const maskId = `spotlight-mask-${Math.random().toString(36).slice(2)}`;
  const isSelectTool = tool === 'select';
  const R = 5;
  const handles: Handle[] = ['tl','tc','tr','ml','mr','bl','bc','br'];

  return (
    <g>
      <defs>
        <mask id={maskId}>
          <rect x={0} y={0} width={imgW} height={imgH} fill="white" />
          {spotlights.map(a => {
            const minX = Math.min(a.x1, a.x2)/100*imgW, minY = Math.min(a.y1, a.y2)/100*imgH;
            const w = Math.abs(a.x2-a.x1)/100*imgW, h = Math.abs(a.y2-a.y1)/100*imgH;
            return <rect key={a.id} x={minX} y={minY} width={w} height={h} fill="black" rx={4} />;
          })}
        </mask>
      </defs>
      {/* 어두운 오버레이 */}
      <rect x={0} y={0} width={imgW} height={imgH}
        fill="rgba(0,0,0,0.52)" mask={`url(#${maskId})`}
        opacity={preview ? 0.7 : 1} pointerEvents="none"
      />
      {/* 각 spotlight: 테두리 + 선택 핸들 */}
      {spotlights.map(a => {
        const minX = Math.min(a.x1, a.x2)/100*imgW, minY = Math.min(a.y1, a.y2)/100*imgH;
        const w = Math.abs(a.x2-a.x1)/100*imgW, h = Math.abs(a.y2-a.y1)/100*imgH;
        const isSelected = selectedId === a.id;
        const bodyCursor = isSelectTool ? 'move' : 'crosshair';

        // 핸들 위치
        const handlePos: Record<Handle, [number, number]> = {
          tl: [minX,   minY],   tc: [minX+w/2, minY],   tr: [minX+w, minY],
          ml: [minX,   minY+h/2],                         mr: [minX+w, minY+h/2],
          bl: [minX,   minY+h], bc: [minX+w/2, minY+h], br: [minX+w, minY+h],
          p1: [0,0], p2:[0,0],
        };
        const handleCursor: Record<Handle, string> = {
          tl: 'nwse-resize', tc: 'ns-resize', tr: 'nesw-resize',
          ml: 'ew-resize',                     mr: 'ew-resize',
          bl: 'nesw-resize', bc: 'ns-resize', br: 'nwse-resize',
          p1: 'crosshair', p2: 'crosshair',
        };

        return (
          <g key={a.id}>
            {/* 클릭 영역 (투명) */}
            <rect x={minX} y={minY} width={w} height={h}
              fill="transparent"
              stroke={isSelected ? '#2563EB' : 'rgba(255,255,255,0.4)'}
              strokeWidth={isSelected ? 1.5 : 1}
              rx={4}
              style={{ cursor: bodyCursor }}
              onMouseDown={e => { if (isSelectTool && onBodyMouseDown) { e.stopPropagation(); onBodyMouseDown(a.id, e); } }}
            />
            {/* 선택 핸들 */}
            {isSelected && onHandleMouseDown && handles.map(hKey => {
              const [cx, cy] = handlePos[hKey];
              return (
                <rect key={hKey} x={cx-R} y={cy-R} width={R*2} height={R*2}
                  fill="white" stroke="#2563EB" strokeWidth={1.5}
                  style={{ cursor: handleCursor[hKey] }}
                  onMouseDown={e => { e.stopPropagation(); onHandleMouseDown(a.id, hKey, e); }}
                />
              );
            })}
          </g>
        );
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
  onBodyDblClick?: () => void;
}

function SelectionHandles({ minX, minY, w, h, onHandle }: {
  minX: number; minY: number; w: number; h: number;
  onHandle: (e: React.MouseEvent, h: Handle) => void;
}) {
  const R = 5;
  const handles: [Handle, number, number][] = [
    ['tl', minX, minY], ['tc', minX+w/2, minY], ['tr', minX+w, minY],
    ['ml', minX, minY+h/2], ['mr', minX+w, minY+h/2],
    ['bl', minX, minY+h], ['bc', minX+w/2, minY+h], ['br', minX+w, minY+h],
  ];
  return (
    <g>
      <rect x={minX} y={minY} width={w} height={h} stroke="#2563EB" strokeWidth={1.5} fill="none" pointerEvents="none" />
      {handles.map(([hKey, cx, cy]) => (
        <rect key={hKey} x={cx-R} y={cy-R} width={R*2} height={R*2}
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
        return <circle key={h} cx={cx} cy={cy} r={R} fill="white" stroke="#2563EB" strokeWidth={1.5} style={{ cursor: 'crosshair' }} onMouseDown={e => { e.stopPropagation(); onHandle(e, h); }} />;
      })}
    </g>
  );
}

function AnnotationShape({ annotation: a, isSelected, tool, imgW, imgH, strokePx, imageUrl, onBodyMouseDown, onHandleMouseDown, onBodyDblClick }: AnnotationShapeProps) {
  const { type, x1, y1, x2, y2, color, text } = a;
  const ax1 = x1/100*imgW, ay1 = y1/100*imgH, ax2 = x2/100*imgW, ay2 = y2/100*imgH;
  const minX = Math.min(ax1,ax2), minY = Math.min(ay1,ay2);
  const w = Math.abs(ax2-ax1), h = Math.abs(ay2-ay1);
  const isSelectTool = tool === 'select';
  const bodyCursor = isSelectTool ? 'move' : tool === 'eraser' ? 'cell' : 'crosshair';
  const handleHandle = onHandleMouseDown ?? (() => {});

  if (type === 'crop') return null;

  if (type === 'recorderBox') return (
    <g>
      <rect x={minX} y={minY} width={w} height={h} rx={2}
        stroke="#EF4444" strokeWidth={Math.max(2, strokePx)} fill="rgba(239,68,68,0.08)"
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
          textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none' }}
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

  if (type === 'roundedRect') {
    const rx = Math.min(w * 0.15, h * 0.15, 12);
    return (
      <g>
        <rect x={minX} y={minY} width={w} height={h} rx={rx} stroke={color} strokeWidth={strokePx} fill="none"
          style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
        {isSelected && onHandleMouseDown && <SelectionHandles minX={minX} minY={minY} w={w} h={h} onHandle={handleHandle} />}
      </g>
    );
  }

  if (type === 'ellipse') return (
    <g>
      <ellipse cx={(ax1+ax2)/2} cy={(ay1+ay2)/2} rx={w/2} ry={h/2}
        stroke={color} strokeWidth={strokePx} fill="none"
        style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
      {isSelected && onHandleMouseDown && <SelectionHandles minX={minX} minY={minY} w={w} h={h} onHandle={handleHandle} />}
    </g>
  );

  if (type === 'arrow') {
    const dx = ax2 - ax1, dy = ay2 - ay1;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len < 1) return null;
    const ux = dx/len, uy = dy/len;
    const headLen = Math.max(strokePx * 4, 10); // 최솟값 보장
    const headW  = headLen * 0.55;
    const lx2 = ax2 - ux * headLen * 0.65;
    const ly2 = ay2 - uy * headLen * 0.65;
    const px = ax2, py = ay2;
    const qx = ax2 - ux*headLen + uy*headW, qy = ay2 - uy*headLen - ux*headW;
    const rx = ax2 - ux*headLen - uy*headW, ry = ay2 - uy*headLen + ux*headW;
    return (
      <g>
        <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke="transparent"
          strokeWidth={Math.max(12, strokePx*4)}
          style={{ cursor: bodyCursor }} onMouseDown={onBodyMouseDown} />
        <line x1={ax1} y1={ay1} x2={lx2} y2={ly2}
          stroke={color} strokeWidth={Math.max(strokePx, 1)} strokeLinecap="round"
          style={{ pointerEvents: 'none' }} />
        <polygon points={`${px},${py} ${qx},${qy} ${rx},${ry}`}
          fill={color} style={{ pointerEvents: 'none' }} />
        {isSelected && onHandleMouseDown && (
          <ArrowHandles ax1={ax1} ay1={ay1} ax2={ax2} ay2={ay2} onHandle={handleHandle} />
        )}
      </g>
    );
  }

  if (type === 'text') {
    if (!text) return null;
    const fSize = a.fontSize ?? 16;
    const bold = a.fontBold ?? false;
    const bColor = a.borderColor ?? DEFAULT_BORDER;
    const align = a.textAlign ?? 'left';
    const bg = a.hasBg !== false;
    const boxW = Math.max(Math.abs(ax2 - ax1), 40);
    const boxH = Math.max(Math.abs(ay2 - ay1), fSize + 12);
    const padX = 10, padY = 6;
    const textX = align === 'left' ? minX + padX : align === 'center' ? minX + boxW / 2 : minX + boxW - padX;
    const anchor = align === 'left' ? 'start' : align === 'center' ? 'middle' : 'end';
    const bgFill = bg ? 'rgba(20,20,30,0.82)' : 'transparent';
    const strokeColor = bColor !== 'transparent' ? bColor : 'none';

    const textCursor = isSelectTool ? (onBodyDblClick ? 'text' : 'move') : bodyCursor;
    return (
      <g style={{ cursor: textCursor }} onMouseDown={onBodyMouseDown}
        onDoubleClick={e => { e.stopPropagation(); onBodyDblClick?.(); }}
      >
        {bg && (
          <rect x={minX} y={minY} width={boxW} height={boxH}
            fill={bgFill}
            stroke={strokeColor}
            strokeWidth={strokeColor !== 'none' ? 1.5 : 0}
            rx={6}
          />
        )}
        {text.split('\n').map((line, i) => (
          <text key={i}
            x={textX} y={minY + padY + i * fSize * 1.4}
            fill={color} fontSize={fSize} fontWeight={bold ? 700 : 400}
            textAnchor={anchor}
            dominantBaseline="text-before-edge"
            style={{ pointerEvents: 'none' }}
          >{line}</text>
        ))}
        {isSelected && onHandleMouseDown && (
          <SelectionHandles minX={minX} minY={minY} w={boxW} h={boxH} onHandle={handleHandle} />
        )}
      </g>
    );
  }

  return null;
}
