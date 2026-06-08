'use client';

import { useState, useRef, useEffect } from 'react';
import type { ManualStep } from './ManualEditor';
import { faviconUrl, faviconFallbackUrl, hostnameToServiceName } from '@/lib/favicon';

interface GuideTocProps {
  steps: ManualStep[];
  activeId: string | null;
  onSelect: (id: string) => void;
  editable?: boolean;
  onReorder?: (steps: ManualStep[]) => void;
  onAdd?: () => void;
  onDelete?: (id: string) => void;
  onInsertAfter?: (afterId: string) => void;
  onRenameDomain?: (hostname: string, newName: string) => void;
  onDeleteCategory?: (hostname: string | null) => void;
}

export function GuideToc({ steps, activeId, onSelect, editable, onReorder, onDelete, onRenameDomain, onDeleteCategory }: GuideTocProps) {
  const [editingDomain, setEditingDomain] = useState<{ hostname: string; value: string } | null>(null);
  const domainInputRef = useRef<HTMLInputElement>(null);
  const [draggingIds, setDraggingIds] = useState<Set<string>>(new Set());
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<'before' | 'after'>('after');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const listRef = useRef<HTMLDivElement>(null);

  // activeId가 바뀌면 TOC 목록을 해당 항목으로 자동 스크롤
  useEffect(() => {
    if (!activeId) return;
    const el = itemRefs.current[activeId];
    const container = listRef.current;
    if (!el || !container) return;
    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const cTop = container.scrollTop;
    const cBottom = cTop + container.clientHeight;
    if (elTop < cTop || elBottom > cBottom) {
      container.scrollTo({ top: elTop - container.clientHeight / 3, behavior: 'smooth' });
    }
  }, [activeId]);

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

  // ── 도메인 그룹핑 — hostname 기준 (domain_name이 달라도 hostname 같으면 동일 그룹) ──
  type DomainGroup = { hostname: string | null; name: string | null; favicon: string | null; count: number };
  const domainGroups: DomainGroup[] = [];
  steps.forEach(step => {
    const hostname = step.domainHostname ?? null;
    const last = domainGroups[domainGroups.length - 1];
    // hostname 기준으로만 그룹핑 — domain_name이 달라도 hostname이 같으면 동일 그룹
    if (last && last.hostname === hostname) {
      last.count++;
    } else {
      domainGroups.push({ hostname, name: hostnameToServiceName(hostname), favicon: step.domainFavicon ?? null, count: 1 });
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* 선택 중일 때 개수 + 삭제/해제 버튼 */}
            {editable && selectedCount > 0 && (
              <>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#3730a3' }}>
                  {selectedCount}개
                </span>
                {onDelete && (
                  <button
                    onClick={() => { Array.from(selectedIds).forEach(id => onDelete(id)); setSelectedIds(new Set()); }}
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
              </>
            )}
            {/* 전체 선택 체크박스 — 우측 끝 */}
            {editable && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={selectedCount === steps.length && steps.length > 0}
                  ref={el => { if (el) el.indeterminate = selectedCount > 0 && selectedCount < steps.length; }}
                  onChange={e => e.target.checked ? setSelectedIds(new Set(steps.map(s => s.id))) : setSelectedIds(new Set())}
                  style={{ width: '12px', height: '12px', accentColor: '#3730a3', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '10px', color: '#9CA3AF' }}>전체</span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Steps */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 0 8px' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                    <FaviconImg favicon={group.favicon} hostname={group.hostname} size={14} />
                    {editable && editingDomain?.hostname === group.hostname ? (
                      <input
                        ref={domainInputRef}
                        value={editingDomain.value}
                        onChange={e => setEditingDomain(prev => prev ? { ...prev, value: e.target.value } : null)}
                        onBlur={() => {
                          if (editingDomain && group.hostname) {
                            onRenameDomain?.(group.hostname, editingDomain.value.trim() || (group.hostname ?? ''));
                          }
                          setEditingDomain(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
                          if (e.key === 'Escape') setEditingDomain(null);
                        }}
                        style={{ fontSize: '11.5px', fontWeight: 700, color: '#3730a3', border: 'none', borderBottom: '1.5px solid #3730a3', outline: 'none', background: 'transparent', width: '100%', padding: '0', fontFamily: 'inherit' }}
                        autoFocus
                      />
                    ) : (
                      <span
                        title={editable ? '클릭하여 이름 변경' : undefined}
                        onClick={() => {
                          if (!editable) return;
                          setEditingDomain({ hostname: group.hostname ?? '', value: group.name ?? group.hostname ?? '' });
                          setTimeout(() => domainInputRef.current?.select(), 0);
                        }}
                        style={{ fontSize: '11.5px', fontWeight: 700, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: editable ? 'text' : 'default', flex: 1 }}
                      >
                        {group.name ?? group.hostname}
                        {editable && <span style={{ fontSize: '9px', color: '#D1D5DB', marginLeft: '4px' }}>✏</span>}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '6px' }}>
                    <span style={{ fontSize: '10.5px', color: '#9CA3AF' }}>
                      {group.count} Steps
                    </span>
                    {editable && onDeleteCategory && (
                      <button
                        onClick={() => {
                          if (window.confirm(`'${group.name ?? group.hostname}' 카테고리의 스텝 ${group.count}개를 모두 삭제할까요?`)) {
                            onDeleteCategory(group.hostname);
                          }
                        }}
                        title="카테고리 삭제"
                        style={{ width: '16px', height: '16px', borderRadius: '3px', border: 'none', background: 'transparent', color: '#D1D5DB', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.1)'; e.currentTarget.style.color = '#DC2626'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#D1D5DB'; }}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 드롭 before 인디케이터 */}
              {isDragTarget && dragOverPos === 'before' && (
                <div style={{ height: '2px', background: '#3730a3', margin: '0 14px', borderRadius: '2px' }} />
              )}

              {/* 스텝 아이템 */}
              <div
                ref={el => { itemRefs.current[step.id] = el; }}
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
