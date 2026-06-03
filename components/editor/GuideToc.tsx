'use client';

import { useState } from 'react';
import type { ManualStep } from './ManualEditor';
import { faviconUrl, faviconFallbackUrl } from '@/lib/favicon';

interface GuideTocProps {
  steps: ManualStep[];
  activeId: string | null;
  onSelect: (id: string) => void;
  editable?: boolean;
  onReorder?: (steps: ManualStep[]) => void;
  onAdd?: () => void;
  onDelete?: (id: string) => void;
  onInsertAfter?: (afterId: string) => void;
}

export function GuideToc({ steps, activeId, onSelect, editable, onReorder, onDelete }: GuideTocProps) {
  const [draggingIds, setDraggingIds] = useState<Set<string>>(new Set());
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<'before' | 'after'>('after');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── 다중 선택 토글 ─────────────────────────────────────────
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── 드래그 시작: 선택 집합 또는 단일 ──────────────────────
  const handleDragStart = (e: React.DragEvent, id: string) => {
    const dragging = selectedIds.has(id) && selectedIds.size > 1
      ? new Set(selectedIds)
      : new Set([id]);
    setDraggingIds(dragging);
    // 드래그 데이터에 ID 목록 저장
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', Array.from(dragging).join(','));
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // 마우스가 아이템의 위/아래 절반 중 어디에 있는지 판단
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDragOverId(id);
    setDragOverPos(pos);
  };

  const handleDrop = (targetId: string) => {
    if (!onReorder || draggingIds.size === 0) { resetDrag(); return; }
    if (draggingIds.has(targetId) && draggingIds.size === 1) { resetDrag(); return; }

    // 드래그 대상 집합과 나머지를 분리
    const moving = steps.filter(s => draggingIds.has(s.id));
    const rest = steps.filter(s => !draggingIds.has(s.id));

    // 삽입 위치: target 기준 before/after
    const targetIdx = rest.findIndex(s => s.id === targetId);
    const insertAt = targetIdx === -1
      ? rest.length
      : dragOverPos === 'before' ? targetIdx : targetIdx + 1;

    const next = [...rest];
    next.splice(insertAt, 0, ...moving);
    onReorder(next.map((s, i) => ({ ...s, number: i + 1 })));
    setSelectedIds(new Set());
    resetDrag();
  };

  const resetDrag = () => {
    setDraggingIds(new Set());
    setDragOverId(null);
  };

  // ── 도메인 그룹핑 ──────────────────────────────────────────
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

  const stepGroupIdx: number[] = [];
  let gi = 0, cnt = 0;
  steps.forEach(() => {
    stepGroupIdx.push(gi);
    cnt++;
    if (cnt >= domainGroups[gi].count) { gi++; cnt = 0; }
  });

  const isDraggingActive = draggingIds.size > 0;
  const selectedCount = selectedIds.size;

  return (
    <aside style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            목차
          </div>
          {/* 다중 선택 중일 때 선택 수 표시 */}
          {editable && selectedCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#3730a3' }}>
                {selectedCount}개 선택
              </span>
              {onDelete && (
                <button
                  onClick={() => {
                    Array.from(selectedIds).forEach(id => onDelete(id));
                    setSelectedIds(new Set());
                  }}
                  title="선택 삭제"
                  style={{ width: '18px', height: '18px', borderRadius: '4px', border: 'none', background: 'rgba(220,38,38,0.1)', color: '#DC2626', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.18)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.1)'; }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  </svg>
                </button>
              )}
              <button
                onClick={() => setSelectedIds(new Set())}
                title="선택 해제"
                style={{ width: '18px', height: '18px', borderRadius: '4px', border: 'none', background: '#F3F4F6', color: '#6B7280', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Steps */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 8px' }}>
        {steps.map((step, idx) => {
          const isActive = step.id === activeId;
          const isDragTarget = dragOverId === step.id && !draggingIds.has(step.id);
          const isBeingDragged = draggingIds.has(step.id);
          const isHover = hoverId === step.id;
          const isSelected = selectedIds.has(step.id);

          const prevGroup = idx > 0 ? stepGroupIdx[idx - 1] : -1;
          const curGroup = stepGroupIdx[idx];
          const showDomainHeader = curGroup !== prevGroup;
          const group = domainGroups[curGroup];

          return (
            <div key={step.id}>
              {/* 도메인 헤더 */}
              {showDomainHeader && (group.hostname || group.name) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${idx === 0 ? '10px' : '14px'} 14px 6px` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    {/* favicon: DB값 → Google API → DuckDuckGo fallback */}
                    <FaviconImg favicon={group.favicon} hostname={group.hostname} size={14} />
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {group.name ?? group.hostname}
                    </span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: '#9CA3AF', flexShrink: 0, marginLeft: '6px' }}>
                    {group.count} Steps
                  </span>
                </div>
              )}

              {/* 드롭 before 인디케이터 */}
              {isDragTarget && dragOverPos === 'before' && (
                <div style={{ height: '2px', background: '#3730a3', margin: '0 14px', borderRadius: '2px' }} />
              )}

              {/* 스텝 아이템 */}
              <div
                draggable={editable}
                onDragStart={e => handleDragStart(e, step.id)}
                onDragOver={isDraggingActive ? e => handleDragOver(e, step.id) : undefined}
                onDrop={isDraggingActive ? () => handleDrop(step.id) : undefined}
                onDragEnd={resetDrag}
                onClick={() => {
                  onSelect(step.id);
                  if (!editable) setSelectedIds(new Set());
                }}
                onMouseEnter={() => setHoverId(step.id)}
                onMouseLeave={() => setHoverId(null)}
                style={{
                  padding: '7px 10px 7px 14px',
                  display: 'flex', alignItems: 'center', gap: '7px',
                  cursor: editable ? 'grab' : 'pointer',
                  opacity: isBeingDragged ? 0.4 : 1,
                  background: isSelected
                    ? 'rgba(55,48,163,0.08)'
                    : isDragTarget ? 'rgba(55,48,163,0.06)'
                    : isActive ? '#e0e7ff'
                    : isHover ? '#F9FAFB'
                    : 'transparent',
                  borderLeft: `3px solid ${isSelected || isActive || isDragTarget ? '#3730a3' : 'transparent'}`,
                  transition: 'background 0.12s',
                  position: 'relative',
                  userSelect: 'none',
                }}
              >
                {/* 편집 모드: 체크박스 */}
                {editable && (
                  <div
                    onClick={e => toggleSelect(step.id, e)}
                    style={{
                      width: '15px', height: '15px', borderRadius: '4px', flexShrink: 0,
                      border: `1.5px solid ${isSelected ? '#3730a3' : '#D1D5DB'}`,
                      background: isSelected ? '#3730a3' : 'white',
                      display: 'grid', placeItems: 'center', cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {isSelected && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                )}

                {/* 스텝 번호 배지 */}
                <div style={{
                  width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                  background: isSelected ? '#3730a3' : isActive ? '#3730a3' : '#E5E7EB',
                  color: isSelected || isActive ? 'white' : '#6B7280',
                  fontSize: '10px', fontWeight: 700, display: 'grid', placeItems: 'center',
                }}>
                  {step.number}
                </div>

                {/* 제목 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '12px', fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#1E1B4B' : '#374151', lineHeight: 1.4,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {step.actionTitle || '(제목 없음)'}
                  </div>
                </div>

                {/* 호버 삭제 버튼 (단일, 선택 없을 때만) */}
                {editable && onDelete && isHover && !isSelected && selectedCount === 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(step.id); }}
                    title="삭제"
                    style={{
                      width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0,
                      border: 'none', background: 'rgba(220,38,38,0.08)',
                      color: '#DC2626', display: 'grid', placeItems: 'center', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                    </svg>
                  </button>
                )}
              </div>

              {/* 드롭 after 인디케이터 */}
              {isDragTarget && dragOverPos === 'after' && (
                <div style={{ height: '2px', background: '#3730a3', margin: '0 14px', borderRadius: '2px' }} />
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ── FaviconImg — DB값 → Google API → DuckDuckGo 순 fallback ──
function FaviconImg({ favicon, hostname, size }: { favicon: string | null; hostname: string | null; size: number }) {
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
