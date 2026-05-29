'use client';

import { useState } from 'react';
import type { ManualStep } from './ManualEditor';

interface GuideTocProps {
  steps: ManualStep[];
  activeId: string | null;
  onSelect: (id: string) => void;
  editable?: boolean;
  onReorder?: (steps: ManualStep[]) => void;
  onAdd?: () => void;
  onDelete?: (id: string) => void;
}

export function GuideToc({ steps, activeId, onSelect, editable, onReorder, onAdd, onDelete }: GuideTocProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id); };
  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId || !onReorder) { setDraggingId(null); setDragOverId(null); return; }
    const from = steps.findIndex(s => s.id === draggingId);
    const to = steps.findIndex(s => s.id === targetId);
    const next = [...steps];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next.map((s, i) => ({ ...s, number: i + 1 })));
    setDraggingId(null); setDragOverId(null);
  };

  return (
    <aside style={{
      width: '240px', flexShrink: 0,
      background: 'white',
      borderRight: '1px solid #E5E7EB',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid #F3F4F6',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          목차
        </div>
        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
          {steps.length}개 단계
        </div>
      </div>

      {/* Steps */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {steps.map(step => {
          const isActive = step.id === activeId;
          const isDragOver = dragOverId === step.id && draggingId !== step.id;
          const isHover = hoverId === step.id;

          return (
            <div
              key={step.id}
              draggable={editable}
              onDragStart={() => handleDragStart(step.id)}
              onDragOver={e => handleDragOver(e, step.id)}
              onDrop={() => handleDrop(step.id)}
              onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
              onClick={() => onSelect(step.id)}
              onMouseEnter={() => setHoverId(step.id)}
              onMouseLeave={() => setHoverId(null)}
              style={{
                padding: '10px 14px',
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                cursor: 'pointer',
                background: isDragOver ? 'rgba(79,70,229,0.06)' : isActive ? '#EEF2FF' : isHover ? '#F9FAFB' : 'transparent',
                borderLeft: `3px solid ${isActive || isDragOver ? '#4F46E5' : 'transparent'}`,
                borderTop: isDragOver ? '2px solid #4F46E5' : '2px solid transparent',
                transition: 'background 0.12s',
                position: 'relative',
              }}
            >
              {/* Thumbnail */}
              <div style={{
                width: '52px', height: '36px', borderRadius: '5px', flexShrink: 0,
                background: step.screenshotUrl ? `url(${step.screenshotUrl}) center/cover` : '#F3F4F6',
                border: `1px solid ${isActive ? '#C7D2FE' : '#E5E7EB'}`,
                overflow: 'hidden', position: 'relative',
              }}>
                {!step.screenshotUrl && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: '3px', padding: '5px' }}>
                    {[70, 50, 60].map((w, i) => (
                      <div key={i} style={{ height: '3px', width: `${w}%`, background: '#D1D5DB', borderRadius: '2px' }} />
                    ))}
                  </div>
                )}
                <div style={{
                  position: 'absolute', bottom: '2px', left: '2px',
                  width: '16px', height: '16px', borderRadius: '4px',
                  background: isActive ? '#4F46E5' : '#6B7280',
                  color: 'white', fontSize: '9px', fontWeight: 700,
                  display: 'grid', placeItems: 'center',
                }}>
                  {step.number}
                </div>
              </div>

              {/* Title */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '12px', fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#1E1B4B' : '#374151',
                  lineHeight: 1.4,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {step.actionTitle || '(제목 없음)'}
                </div>
              </div>

              {/* Delete button — shown on hover in edit mode */}
              {editable && onDelete && isHover && (
                <button
                  onClick={e => { e.stopPropagation(); onDelete(step.id); }}
                  title="삭제"
                  style={{
                    position: 'absolute', top: '6px', right: '6px',
                    width: '20px', height: '20px', borderRadius: '4px',
                    border: 'none', background: 'rgba(220,38,38,0.08)',
                    color: '#DC2626', display: 'grid', placeItems: 'center', cursor: 'pointer',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add step (edit mode) */}
      {editable && onAdd && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
          <button
            onClick={onAdd}
            style={{
              width: '100%', height: '34px',
              border: '1.5px dashed #D1D5DB', borderRadius: '7px',
              background: 'transparent', color: '#6B7280',
              fontSize: '12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.color = '#4F46E5'; e.currentTarget.style.background = 'rgba(79,70,229,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            단계 추가
          </button>
        </div>
      )}
    </aside>
  );
}
