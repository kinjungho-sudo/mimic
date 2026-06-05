'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, Undo2, Redo2 } from 'lucide-react';
import { GuideToc } from '@/components/editor/GuideToc';
import { ManualEditor, ManualStep } from '@/components/editor/ManualEditor';
import { useTutorial } from '@/hooks/useTutorial';
import { useAutosave } from '@/hooks/useAutosave';
import { useAuth } from '@/hooks/useAuth';
import { useCollaboration } from '@/hooks/useCollaboration';
import type { Collaborator } from '@/hooks/useCollaboration';
import { updateStep, createStep, deleteStep, reorderSteps } from '@/lib/api/steps';
import type { Step, Tutorial } from '@/types';

// ── Adapters ──────────────────────────────────────────────

function stepsToManualSteps(steps: Step[]): ManualStep[] {
  return steps.map(s => ({
    id: s.id,
    number: s.step_number,
    actionTitle: s.user_title ?? s.ai_title ?? '',
    description: s.user_script ?? s.ai_description ?? '',
    screenshotUrl: s.screenshot_url || undefined,
    annotations: (s.user_annotations as import('@/components/editor/ImageAnnotationEditor').Annotation[] | null) ?? [],
    pageUrl:         s.page_url        ?? null,
    domainHostname:  s.domain_hostname ?? null,
    domainName:      s.domain_name     ?? null,
    domainFavicon:   s.domain_favicon  ?? null,
    domain_name:    s.domain_name     ?? null,
    domain_favicon: s.domain_favicon  ?? null,
    is_stale: (s as Step & { is_stale?: boolean }).is_stale ?? false,
    crop_rect: (s as Step & { crop_rect?: { x: number; y: number; w: number; h: number } | null }).crop_rect ?? null,
    element_rect: (s as Step & { element_rect?: { x: number; y: number; width: number; height: number } | null }).element_rect ?? null,
    imageZoom: (s as Step & { image_zoom?: number | null }).image_zoom ?? 1,
    // click_x/y: DB는 0~10000 정수, ManualStep은 0~100 퍼센트
    click_x: (s as Step & { click_x?: number | null }).click_x != null
      ? (s as Step & { click_x: number }).click_x / 100
      : null,
    click_y: (s as Step & { click_y?: number | null }).click_y != null
      ? (s as Step & { click_y: number }).click_y / 100
      : null,
  }));
}

// ── Page ──────────────────────────────────────────────────

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tutorial, loading, error } = useTutorial(id);
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [manualSteps, setManualSteps] = useState<ManualStep[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [titleDirty, setTitleDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [collabToast, setCollabToast] = useState<{ stepId: string; name: string; color: string } | null>(null);
  const collabToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // 실시간 협업 — 워크스페이스 튜토리얼에서만 활성
  const workspaceId = tutorial
    ? (tutorial as Tutorial & { workspace_id?: string | null }).workspace_id ?? null
    : null;
  const { broadcastStepChange, updatePresence } = useCollaboration({
    tutorialId: id,
    workspaceId,
    currentUser: user ? { id: user.id, name: user.name } : null,
    steps: manualSteps,
    onRemoteStepChange: (stepId, patch) => {
      setManualSteps(prev => prev.map(s => s.id === stepId ? { ...s, ...patch } : s));
      setCollaborators(prev => {
        const editor = prev.find(c => c.activeStepId === stepId);
        if (editor) {
          if (collabToastTimer.current) clearTimeout(collabToastTimer.current);
          setCollabToast({ stepId, name: editor.name, color: editor.color });
          collabToastTimer.current = setTimeout(() => setCollabToast(null), 3000);
        }
        return prev;
      });
    },
    onCollaboratorsChange: setCollaborators,
  });

  // Undo/Redo history
  const undoRef = useRef<ManualStep[][]>([]);
  const redoRef = useRef<ManualStep[][]>([]);
  const setManualStepsWithHistory = useCallback((next: ManualStep[]) => {
    undoRef.current = [...undoRef.current.slice(-49), manualSteps];
    redoRef.current = [];
    setManualSteps(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualSteps]);

  const handleUndo = useCallback(() => {
    if (undoRef.current.length === 0) return;
    const prev = undoRef.current[undoRef.current.length - 1];
    redoRef.current = [...redoRef.current, manualSteps];
    undoRef.current = undoRef.current.slice(0, -1);
    setManualSteps(prev);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualSteps]);

  const handleRedo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const next = redoRef.current[redoRef.current.length - 1];
    undoRef.current = [...undoRef.current, manualSteps];
    redoRef.current = redoRef.current.slice(0, -1);
    setManualSteps(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualSteps]);

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const active = document.activeElement;
      const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable);
      if (e.key === 'z' && !e.shiftKey) {
        if (isTyping) return;
        e.preventDefault();
        handleUndo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        if (isTyping) return;
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  // Seed state from fetched tutorial
  useEffect(() => {
    if (!tutorial) return;
    setTitle(tutorial.title);
    const steps = stepsToManualSteps(tutorial.steps);
    setManualSteps(steps);
    if (tutorial.steps.length > 0 && !activeId) {
      setActiveId(tutorial.steps[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial?.id]);

  // 활성 스텝 변경 시 Presence 전송 (협업 커서)
  useEffect(() => { updatePresence(activeId); }, [activeId, updatePresence]);

  // Autosave title
  useAutosave(id, titleDirty ? { title } : null);

  const handleSave = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const results = await Promise.all(
        manualSteps
          .filter(s => !s.id.startsWith('step-'))
          .map(s => {
            clearTimeout(stepSaveTimers.current[s.id]);
            return updateStep(s.id, {
              user_title: s.actionTitle || null,
              user_script: s.description || null,
              user_annotations: s.annotations ?? [],
            }).then(() => true).catch(() => false);
          })
      );
      const allOk = results.every(r => r);
      if (!allOk) {
        alert('일부 단계를 저장하지 못했습니다. 네트워크 연결을 확인 후 다시 시도해 주세요.');
        return false;
      }
      return true;
    } finally {
      setSaving(false);
    }
  }, [manualSteps]);


  const handleDeleteStep = useCallback((stepId: string) => {
    const next = manualSteps.filter(s => s.id !== stepId).map((s, i) => ({ ...s, number: i + 1 }));
    setManualStepsWithHistory(next);
    if (activeId === stepId) setActiveId(next[0]?.id ?? null);
    // DB 삭제 — 임시 ID(step-*)는 아직 DB에 없으므로 건너뜀
    if (!stepId.startsWith('step-')) {
      deleteStep(stepId).catch(() => {});
    }
  }, [manualSteps, activeId, setManualStepsWithHistory]);

  const handleAddStep = useCallback(async () => {
    const stepNumber = manualSteps.length + 1;
    const orderIndex = manualSteps.length;
    // 낙관적 UI — 임시 ID로 먼저 추가
    const tempId = `step-${Date.now()}`;
    const optimistic: ManualStep = { id: tempId, number: stepNumber, actionTitle: '새 단계', description: '' };
    setManualStepsWithHistory([...manualSteps, optimistic]);
    setActiveId(tempId);
    // DB INSERT 후 실제 ID로 교체
    try {
      const created = await createStep(id, orderIndex, stepNumber);
      setManualSteps(prev => prev.map(s => s.id === tempId ? { ...s, id: created.id } : s));
      setActiveId(created.id);
    } catch {
      // 실패해도 로컬 상태는 유지, 편집 완료 시 재저장
    }
  }, [manualSteps, setManualStepsWithHistory, id]);

  const handleInsertAfter = useCallback(async (afterId: string) => {
    const idx = manualSteps.findIndex(s => s.id === afterId);
    if (idx === -1) return;
    const stepNumber = idx + 2;
    const orderIndex = idx + 1;
    const tempId = `step-${Date.now()}`;
    const next = [...manualSteps];
    next.splice(idx + 1, 0, { id: tempId, number: stepNumber, actionTitle: '새 단계', description: '' });
    setManualStepsWithHistory(next.map((s, i) => ({ ...s, number: i + 1 })));
    setActiveId(tempId);
    // DB INSERT 후 실제 ID로 교체
    try {
      const created = await createStep(id, orderIndex, stepNumber);
      setManualSteps(prev => prev.map(s => s.id === tempId ? { ...s, id: created.id } : s));
      setActiveId(created.id);
    } catch {
      // 실패해도 로컬 상태 유지
    }
  }, [manualSteps, setManualStepsWithHistory, id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F8F9FA' }}>
        <div style={{ textAlign: 'center', color: '#6B7280' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(55,48,163,0.18)', borderTopColor: '#3730a3', animation: 'spin 0.9s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontSize: '14px' }}>매뉴얼 불러오는 중…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !tutorial) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F8F9FA' }}>
        <div style={{ textAlign: 'center', color: '#6B7280' }}>
          <p style={{ fontSize: '15px', marginBottom: '16px' }}>{error ?? '매뉴얼을 찾을 수 없어요.'}</p>
          <button onClick={() => router.push('/home')} style={{ padding: '10px 20px', borderRadius: '8px', background: '#3730a3', color: 'white', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const createdAt = new Date(tutorial.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* ── Top header ── */}
      <header className="editor-header-padding" style={{
        height: '52px', flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        background: 'white',
        borderBottom: '1px solid #E5E7EB',
        gap: '0',
        zIndex: 20,
      }}>
        {/* Left: back button + page label */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '16px', borderRight: '1px solid #F3F4F6' }}>
          <button
            onClick={() => router.push(`/manual/${id}`)}
            title="매뉴얼로 돌아가기"
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              border: '1px solid #E5E7EB', background: 'white',
              display: 'grid', placeItems: 'center',
              color: '#6B7280', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#111827'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#6B7280'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>편집기</span>
        </div>

        {/* Center: meta info */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '12px' }}>
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{manualSteps.length}개 단계</span>
          {tutorial.status === 'published' && (
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: 500 }}>
              게시됨
            </span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'rgba(16,185,129,0.9)' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            자동 저장됨
          </span>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>

          {/* 협업자 아바타 */}
          {collaborators.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', marginRight: '4px' }}>
              {collaborators.slice(0, 5).map(c => (
                <div key={c.userId} title={`${c.name} 편집 중`} style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: c.color, border: '2px solid white',
                  display: 'grid', placeItems: 'center',
                  fontSize: '11px', fontWeight: 700, color: 'white',
                  marginLeft: '-6px', flexShrink: 0,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                }}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
              ))}
              {collaborators.length > 5 && (
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#6B7280', border: '2px solid white', display: 'grid', placeItems: 'center', fontSize: '10px', fontWeight: 700, color: 'white', marginLeft: '-6px' }}>
                  +{collaborators.length - 5}
                </div>
              )}
            </div>
          )}

          {/* 편집기 — 항상 편집 모드 */}
          <>
            <button
              onClick={handleUndo}
              disabled={undoRef.current.length === 0}
              title="실행 취소 (Ctrl+Z)"
              style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: undoRef.current.length > 0 ? '#374151' : '#D1D5DB', background: 'white', border: '1px solid #E5E7EB', cursor: undoRef.current.length > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (undoRef.current.length > 0) e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
            >
              <Undo2 size={13} /> 실행 취소
            </button>
            <button
              onClick={handleRedo}
              disabled={redoRef.current.length === 0}
              title="다시 실행 (Ctrl+Shift+Z)"
              style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: redoRef.current.length > 0 ? '#374151' : '#D1D5DB', background: 'white', border: '1px solid #E5E7EB', cursor: redoRef.current.length > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (redoRef.current.length > 0) e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
            >
              <Redo2 size={13} /> 다시 실행
            </button>
            <button
              onClick={async () => { const ok = await handleSave(); if (ok) router.push(`/manual/${id}`); }}
              disabled={saving}
              style={{ height: '32px', padding: '0 16px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'white', background: saving ? 'rgba(55,48,163,0.6)' : 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 1px 6px rgba(55,48,163,0.3)', transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.boxShadow = '0 4px 14px rgba(55,48,163,0.45)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 6px rgba(55,48,163,0.3)'; }}
            >
              {saving ? '저장 중…' : <><Check size={13} /> 편집 완료</>}
            </button>
          </>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* TOC panel — 모바일에서 숨김 */}
        <div className="editor-toc-panel" style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #E5E7EB', background: 'white', minHeight: 0 }}>
          <GuideToc
            steps={manualSteps}
            activeId={activeId}
            onSelect={setActiveId}
            editable={true}
            onReorder={(reordered) => {
              setManualStepsWithHistory(reordered);
              // DB order_index 일괄 저장 (임시 ID 제외)
              const dbItems = reordered
                .filter(s => !s.id.startsWith('step-'))
                .map((s, i) => ({ id: s.id, order_index: i }));
              if (dbItems.length > 0) {
                reorderSteps(id, dbItems).catch(() => {});
              }
            }}
            onAdd={handleAddStep}
            onDelete={handleDeleteStep}
            onInsertAfter={handleInsertAfter}
            onRenameDomain={(hostname, newName) => {
              setManualSteps(prev => prev.map(s =>
                s.domainHostname === hostname ? { ...s, domainName: newName } : s
              ));
              // 해당 hostname 스텝 DB 일괄 업데이트
              manualSteps
                .filter(s => s.domainHostname === hostname && !s.id.startsWith('step-'))
                .forEach(s => updateStep(s.id, { domain_name: newName }).catch(() => {}));
            }}
          />
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {/* Title banner — 컴팩트 */}
          <div style={{ flexShrink: 0, padding: '8px 20px 7px', borderBottom: '1px solid #E5E7EB', background: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              value={title}
              onChange={e => { setTitle(e.target.value); setTitleDirty(true); }}
              placeholder="매뉴얼 제목"
              style={{
                flex: 1, fontSize: '14px', fontWeight: 600, color: '#111827',
                background: 'transparent', border: 'none', outline: 'none',
                fontFamily: 'inherit', cursor: 'text', minWidth: 0,
              }}
            />
            <span style={{ fontSize: '10.5px', color: '#C4C9D4', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {createdAt}
            </span>
          </div>
          <ManualEditor
            steps={manualSteps}
            hideToc
            activeId={activeId}
            onChange={(next) => {
              setManualStepsWithHistory(next);
              next.forEach(step => {
                const prev = manualSteps.find(s => s.id === step.id);
                if (!prev) return;
                if (prev.actionTitle === step.actionTitle && prev.description === step.description) return;
                if (step.id.startsWith('step-')) return;
                broadcastStepChange(step.id, { actionTitle: step.actionTitle, description: step.description });
                clearTimeout(stepSaveTimers.current[step.id]);
                stepSaveTimers.current[step.id] = setTimeout(() => {
                  updateStep(step.id, {
                    user_title: step.actionTitle || null,
                    user_script: step.description || null,
                  }).catch(() => {});
                }, 600);
              });
            }}
            onSave={(stepId, patch) => {
              if (stepId.startsWith('step-')) return;
              clearTimeout(stepSaveTimers.current[stepId]);
              updateStep(stepId, {
                ...(patch.actionTitle !== undefined ? { user_title: patch.actionTitle || null } : {}),
                ...(patch.description !== undefined ? { user_script: patch.description || null } : {}),
                ...(patch.annotations !== undefined ? { user_annotations: patch.annotations } : {}),
                ...(patch.imageZoom !== undefined ? { image_zoom: patch.imageZoom } : {}),
              }).catch(() => {});
            }}
          />
        </div>
      </div>


      {/* 협업 변경 토스트 */}
      {collabToast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px',
          borderRadius: '10px', background: '#1E1E2E', color: 'white',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)', fontSize: '13px', fontWeight: 500,
          zIndex: 100, pointerEvents: 'none', animation: 'mimicFadeIn 0.2s ease',
        }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: collabToast.color, display: 'grid', placeItems: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
            {collabToast.name.charAt(0).toUpperCase()}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>
            <span style={{ color: 'white' }}>{collabToast.name}</span>님이 단계를 수정했어요
          </span>
        </div>
      )}
      <style>{`@keyframes mimicFadeIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style>

    </div>
  );
}
