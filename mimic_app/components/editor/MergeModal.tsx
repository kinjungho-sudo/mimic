'use client';

import { useState, useEffect } from 'react';

interface TutorialSummary {
  id: string;
  title: string;
  mm_steps: { screenshot_url: string | null }[];
}

interface SourceStep {
  id: string;
  step_number: number;
  user_title: string | null;
  ai_title: string | null;
  screenshot_url: string | null;
}

interface MergeModalProps {
  currentTutorialId: string;
  onImport: (sourceTutorialId: string, stepIds: string[]) => Promise<void>;
  onClose: () => void;
}

export function MergeModal({ currentTutorialId, onImport, onClose }: MergeModalProps) {
  const [tutorials, setTutorials] = useState<TutorialSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedTutorialId, setSelectedTutorialId] = useState<string | null>(null);
  const [sourceSteps, setSourceSteps] = useState<SourceStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [selectedStepIds, setSelectedStepIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetch('/api/tutorials')
      .then(r => r.json())
      .then((data: TutorialSummary[]) => {
        setTutorials((data || []).filter(t => t.id !== currentTutorialId));
      })
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, [currentTutorialId]);

  const loadSteps = (tutorialId: string) => {
    setSelectedTutorialId(tutorialId);
    setSourceSteps([]);
    setSelectedStepIds(new Set());
    setLoadingSteps(true);
    fetch(`/api/tutorials/${tutorialId}`)
      .then(r => r.json())
      .then(data => setSourceSteps(data.steps ?? []))
      .catch(() => {})
      .finally(() => setLoadingSteps(false));
  };

  const toggleStep = (id: string) => {
    setSelectedStepIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedStepIds.size === sourceSteps.length) {
      setSelectedStepIds(new Set());
    } else {
      setSelectedStepIds(new Set(sourceSteps.map(s => s.id)));
    }
  };

  const handleImport = async () => {
    if (!selectedTutorialId || selectedStepIds.size === 0) return;
    setImporting(true);
    try {
      const orderedIds = sourceSteps.filter(s => selectedStepIds.has(s.id)).map(s => s.id);
      await onImport(selectedTutorialId, orderedIds);
      onClose();
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,15,0.45)', zIndex: 2000, backdropFilter: 'blur(3px)' }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 2001,
        width: 'min(780px, 96vw)',
        maxHeight: '88vh',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 24px 80px rgba(10,10,15,0.28)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#111827' }}>다른 매뉴얼에서 불러오기</h3>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#6B7280' }}>선택한 스텝을 현재 매뉴얼 끝에 추가합니다.</p>
          </div>
          <button
            onClick={onClose}
            style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#F3F4F6', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#6B7280' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* 바디 - 좌우 분할 */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* 좌측: 매뉴얼 목록 */}
          <div style={{ width: '260px', flexShrink: 0, borderRight: '1px solid #E5E7EB', overflowY: 'auto', padding: '8px' }}>
            <p style={{ margin: '6px 8px 10px', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>매뉴얼 선택</p>
            {loadingList ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '4px' }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ height: '44px', borderRadius: '8px', background: '#F3F4F6', animation: 'pulse 1.4s ease-in-out infinite' }} />
                ))}
              </div>
            ) : tutorials.length === 0 ? (
              <div style={{ padding: '24px 8px', textAlign: 'center', color: '#9CA3AF', fontSize: '12.5px' }}>
                다른 매뉴얼이 없습니다
              </div>
            ) : (
              tutorials.map(t => {
                const isSelected = t.id === selectedTutorialId;
                return (
                  <button
                    key={t.id}
                    onClick={() => loadSteps(t.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '9px 10px', borderRadius: '8px', border: 'none', textAlign: 'left', cursor: 'pointer',
                      background: isSelected ? '#EEF2FF' : 'transparent', transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F9FAFB'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {t.mm_steps?.[0]?.screenshot_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.mm_steps[0].screenshot_url} alt="" style={{ width: '36px', height: '24px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0, border: '1px solid #E5E7EB' }} />
                    ) : (
                      <div style={{ width: '36px', height: '24px', borderRadius: '4px', background: '#F3F4F6', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: isSelected ? 600 : 400, color: isSelected ? '#3730a3' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.title || '제목 없음'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>{t.mm_steps?.length ?? 0}개 스텝</div>
                    </div>
                    {isSelected && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* 우측: 스텝 목록 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            {!selectedTutorialId ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: '13px' }}>
                왼쪽에서 매뉴얼을 선택하세요
              </div>
            ) : loadingSteps ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2.5px solid rgba(55,48,163,0.15)', borderTopColor: '#3730a3', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : sourceSteps.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: '13px' }}>
                스텝이 없습니다
              </div>
            ) : (
              <>
                {/* 전체 선택 헤더 */}
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={selectedStepIds.size === sourceSteps.length && sourceSteps.length > 0}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: '#3730a3' }}
                  />
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>
                    {selectedStepIds.size > 0 ? `${selectedStepIds.size}개 선택됨` : '전체 선택'}
                  </span>
                </div>
                {/* 스텝 목록 */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
                  {sourceSteps.map(step => {
                    const isChecked = selectedStepIds.has(step.id);
                    return (
                      <button
                        key={step.id}
                        onClick={() => toggleStep(step.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                          padding: '8px 8px', borderRadius: '7px', border: `1.5px solid ${isChecked ? '#a5b4fc' : 'transparent'}`,
                          background: isChecked ? '#EEF2FF' : 'transparent', cursor: 'pointer', textAlign: 'left',
                          marginBottom: '2px', transition: 'all 0.12s',
                        }}
                        onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = '#F9FAFB'; }}
                        onMouseLeave={e => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          onClick={e => e.stopPropagation()}
                          style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: '#3730a3', flexShrink: 0 }}
                        />
                        {step.screenshot_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={step.screenshot_url} alt="" style={{ width: '52px', height: '34px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0, border: '1px solid #E5E7EB' }} />
                        ) : (
                          <div style={{ width: '52px', height: '34px', borderRadius: '4px', background: '#F3F4F6', flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '1px' }}>스텝 {step.step_number}</div>
                          <div style={{ fontSize: '13px', fontWeight: isChecked ? 600 : 400, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {step.user_title || step.ai_title || '제목 없음'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0, background: '#FAFAFA' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: '8px', background: 'white', color: '#4B5563', fontSize: '13px', fontWeight: 500, border: '1.5px solid #E5E7EB', cursor: 'pointer' }}
          >
            취소
          </button>
          <button
            onClick={handleImport}
            disabled={selectedStepIds.size === 0 || importing}
            style={{
              padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: selectedStepIds.size === 0 ? 'not-allowed' : 'pointer',
              background: selectedStepIds.size === 0 ? '#E5E7EB' : 'linear-gradient(135deg, #3730a3, #6d28d9)',
              color: selectedStepIds.size === 0 ? '#9CA3AF' : 'white',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}
          >
            {importing && <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />}
            {selectedStepIds.size > 0 ? `${selectedStepIds.size}개 스텝 불러오기` : '스텝을 선택하세요'}
          </button>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        `}</style>
      </div>
    </>
  );
}
