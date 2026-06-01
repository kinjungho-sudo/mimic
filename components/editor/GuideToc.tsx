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

  // 도메인별 그룹핑 — Tango 스타일
  // domainHostname 기준으로 연속된 그룹을 계산
  type DomainGroup = { hostname: string | null; name: string | null; favicon: string | null; count: number };
  const domainGroups: DomainGroup[] = [];
  steps.forEach(step => {
    const last = domainGroups[domainGroups.length - 1];
    if (last && last.hostname === (step.domainHostname ?? null)) {
      last.count++;
    } else {
      domainGroups.push({ hostname: step.domainHostname ?? null, name: step.domainName ?? null, favicon: step.domainFavicon ?? null, count: 1 });
    }
  });

  // 스텝 → 해당 도메인 그룹 인덱스 맵
  const stepGroupIdx: number[] = [];
  let gi = 0, cnt = 0;
  steps.forEach(() => {
    stepGroupIdx.push(gi);
    cnt++;
    if (cnt >= domainGroups[gi].count) { gi++; cnt = 0; }
  });

  return (
    <aside style={{
      flex: 1,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 0,
    }}>
      {/* Header — 목차 레이블만 */}
      <div style={{
        padding: '12px 16px 10px',
        borderBottom: '1px solid #F3F4F6',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          목차
        </div>
      </div>

      {/* Steps with domain section headers */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 8px' }}>
        {steps.map((step, idx) => {
          const isActive = step.id === activeId;
          const isDragOver = dragOverId === step.id && draggingId !== step.id;
          const isHover = hoverId === step.id;

          // 이전 스텝과 도메인이 다를 때 섹션 헤더 표시
          const prevGroup = idx > 0 ? stepGroupIdx[idx - 1] : -1;
          const curGroup = stepGroupIdx[idx];
          const showDomainHeader = curGroup !== prevGroup;
          const group = domainGroups[curGroup];

          return (
            <div key={step.id}>
              {/* 도메인 섹션 헤더 — Tango 스타일 */}
              {showDomainHeader && (group.hostname || group.name) && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: `${idx === 0 ? '10px' : '14px'} 14px 6px`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    {group.favicon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={group.favicon}
                        alt=""
                        width={14} height={14}
                        style={{ borderRadius: '3px', flexShrink: 0 }}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: '#E5E7EB', flexShrink: 0 }} />
                    )}
                    <span style={{
                      fontSize: '11.5px', fontWeight: 700, color: '#374151',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {group.name ?? group.hostname}
                    </span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: '#9CA3AF', flexShrink: 0, marginLeft: '6px' }}>
                    {group.count} Steps
                  </span>
                </div>
              )}

              {/* 스텝 아이템 */}
              <div
                draggable
                onDragStart={() => handleDragStart(step.id)}
                onDragOver={e => handleDragOver(e, step.id)}
                onDrop={() => handleDrop(step.id)}
                onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                onClick={() => onSelect(step.id)}
                onMouseEnter={() => setHoverId(step.id)}
                onMouseLeave={() => setHoverId(null)}
                style={{
                  padding: '7px 14px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  cursor: 'grab',
                  background: isDragOver ? 'rgba(79,70,229,0.06)' : isActive ? '#EEF2FF' : isHover ? '#F9FAFB' : 'transparent',
                  borderLeft: `3px solid ${isActive || isDragOver ? '#4F46E5' : 'transparent'}`,
                  borderTop: isDragOver ? '2px solid #4F46E5' : '2px solid transparent',
                  transition: 'background 0.12s',
                  position: 'relative',
                }}
              >
                {/* Step number badge */}
                <div style={{
                  width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                  background: isActive ? '#4F46E5' : '#E5E7EB',
                  color: isActive ? 'white' : '#6B7280',
                  fontSize: '10px', fontWeight: 700,
                  display: 'grid', placeItems: 'center',
                }}>
                  {step.number}
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
