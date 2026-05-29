'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Share2, Check, Download, Pencil, X, Undo2 } from 'lucide-react';
import { AppSidebar } from '@/components/editor/AppSidebar';
import { GuideToc } from '@/components/editor/GuideToc';
import { GuideViewer } from '@/components/editor/GuideViewer';
import { ManualEditor, ManualStep } from '@/components/editor/ManualEditor';
import { ShareModal } from '@/components/editor/ShareModal';
import { useTutorial } from '@/hooks/useTutorial';
import { useAutosave } from '@/hooks/useAutosave';
import { updateStep } from '@/lib/api/steps';
import type { Step } from '@/types';

// ── Adapters ──────────────────────────────────────────────

function stepsToManualSteps(steps: Step[]): ManualStep[] {
  return steps.map(s => ({
    id: s.id,
    number: s.step_number,
    actionTitle: s.user_title ?? s.ai_title ?? '',
    description: s.user_script ?? s.ai_description ?? '',
    screenshotUrl: s.screenshot_url || undefined,
  }));
}

// ── Page ──────────────────────────────────────────────────

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tutorial, loading, error, publish, unpublish } = useTutorial(id);

  const [title, setTitle] = useState('');
  const [manualSteps, setManualSteps] = useState<ManualStep[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [titleDirty, setTitleDirty] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  const stepSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Undo history
  const historyRef = useRef<ManualStep[][]>([]);
  const setManualStepsWithHistory = useCallback((next: ManualStep[]) => {
    historyRef.current = [...historyRef.current.slice(-49), manualSteps];
    setManualSteps(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualSteps]);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setManualSteps(prev);
  }, []);

  // Ctrl+Z shortcut (edit mode only, skip when typing)
  useEffect(() => {
    if (!editMode) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) return;
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editMode, handleUndo]);

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

  // Autosave title
  useAutosave(id, titleDirty ? { title } : null);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await Promise.all(
        manualSteps
          .filter(s => !s.id.startsWith('step-'))
          .map(s => {
            clearTimeout(stepSaveTimers.current[s.id]);
            return updateStep(s.id, {
              user_title: s.actionTitle || null,
              user_script: s.description || null,
              user_annotations: s.annotations ?? [],
            }).catch(() => {});
          })
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [manualSteps]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/export/pdf/${id}`);
      if (!res.ok) { alert('내보내기 실패. 스텝이 없거나 오류가 발생했습니다.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ?? 'manual.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [id]);

  const handlePublish = useCallback(async () => {
    try {
      const result = await publish();
      const url = result.share_url ?? `${window.location.origin}/play/${result.share_token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      alert(`게시 완료!\n링크가 클립보드에 복사되었습니다:\n${url}`);
    } catch {
      alert('게시 중 오류가 발생했습니다.');
    }
  }, [publish]);

  const handleDeleteStep = useCallback((stepId: string) => {
    setManualStepsWithHistory(
      manualSteps.filter(s => s.id !== stepId).map((s, i) => ({ ...s, number: i + 1 }))
    );
    if (activeId === stepId) setActiveId(manualSteps.find(s => s.id !== stepId)?.id ?? null);
  }, [manualSteps, activeId, setManualStepsWithHistory]);

  const handleAddStep = useCallback(() => {
    const newStep: ManualStep = {
      id: `step-${Date.now()}`,
      number: manualSteps.length + 1,
      actionTitle: '새 단계',
      description: '',
    };
    setManualStepsWithHistory([...manualSteps, newStep]);
    setActiveId(newStep.id);
  }, [manualSteps, setManualStepsWithHistory]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F8F9FA' }}>
        <div style={{ textAlign: 'center', color: '#6B7280' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(79,70,229,0.18)', borderTopColor: '#4F46E5', animation: 'spin 0.9s linear infinite', margin: '0 auto 16px' }} />
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
          <button onClick={() => router.push('/dashboard')} style={{ padding: '10px 20px', borderRadius: '8px', background: '#4F46E5', color: 'white', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* ── Top header ── */}
      <header style={{
        height: '52px', flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 16px 0 0',
        background: 'white',
        borderBottom: '1px solid #E5E7EB',
        gap: '12px',
        zIndex: 20,
      }}>
        {/* Left: title area (aligned after sidebar+toc) */}
        <div style={{ width: '300px', flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: '16px', borderRight: '1px solid #E5E7EB', height: '100%' }}>
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); setTitleDirty(true); }}
            style={{
              fontSize: '14px', fontWeight: 600, color: '#111827',
              background: 'transparent', border: 'none', outline: 'none',
              width: '100%', cursor: 'text',
            }}
            placeholder="매뉴얼 제목"
          />
        </div>

        {/* Center: breadcrumb / status */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '16px' }}>
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
            {manualSteps.length}개 단계
          </span>
          {tutorial.status === 'published' && (
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: 500 }}>
              게시됨
            </span>
          )}
          {editMode && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'rgba(16,185,129,0.9)' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
              자동 저장됨
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {editMode && (
            <>
              <button
                onClick={handleUndo}
                disabled={historyRef.current.length === 0}
                title="실행 취소 (Ctrl+Z)"
                style={{
                  height: '32px', padding: '0 12px', borderRadius: '7px',
                  fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px',
                  color: historyRef.current.length > 0 ? '#374151' : '#D1D5DB',
                  background: 'white', border: '1px solid #E5E7EB',
                  cursor: historyRef.current.length > 0 ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (historyRef.current.length > 0) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
              >
                <Undo2 size={13} /> 실행 취소
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  height: '32px', padding: '0 14px', borderRadius: '7px',
                  fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px',
                  color: saved ? '#059669' : '#374151',
                  background: saved ? 'rgba(16,185,129,0.08)' : 'white',
                  border: `1px solid ${saved ? 'rgba(16,185,129,0.3)' : '#E5E7EB'}`,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s', opacity: saving ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!saving && !saved) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { if (!saving && !saved) e.currentTarget.style.background = 'white'; }}
              >
                {saved ? <Check size={13} /> : null}
                {saving ? '저장 중…' : saved ? '저장됨' : '저장'}
              </button>
            </>
          )}

          <button
            onClick={handleExport}
            disabled={exporting}
            title="PDF 내보내기"
            style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.6 : 1 }}
            onMouseEnter={e => { if (!exporting) e.currentTarget.style.background = '#F9FAFB'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
          >
            <Download size={13} /> {exporting ? '생성 중…' : 'PDF'}
          </button>

          <button
            onClick={() => setShowShare(true)}
            style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
          >
            <Share2 size={13} /> 공유
          </button>

          {/* Edit toggle */}
          {editMode ? (
            <button
              onClick={() => setEditMode(false)}
              style={{ height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#374151', background: '#F3F4F6', border: '1px solid #E5E7EB', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#E5E7EB'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F3F4F6'; }}
            >
              <X size={13} /> 편집 종료
            </button>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              style={{ height: '32px', padding: '0 16px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'white', background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', border: 'none', cursor: 'pointer', boxShadow: '0 1px 6px rgba(79,70,229,0.3)', transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(79,70,229,0.45)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 6px rgba(79,70,229,0.3)'; }}
            >
              <Pencil size={13} /> 편집
            </button>
          )}

          <button
            onClick={handlePublish}
            style={{ height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', color: 'white', background: '#111827', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1F2937'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#111827'; }}
          >
            게시
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left app nav */}
        <AppSidebar />

        {/* TOC panel */}
        <GuideToc
          steps={manualSteps}
          activeId={activeId}
          onSelect={setActiveId}
          editable={editMode}
          onReorder={setManualStepsWithHistory}
          onAdd={handleAddStep}
          onDelete={handleDeleteStep}
        />

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {editMode ? (
            <ManualEditor
              steps={manualSteps}
              onChange={(next) => {
                setManualStepsWithHistory(next);
                next.forEach(step => {
                  const prev = manualSteps.find(s => s.id === step.id);
                  if (!prev) return;
                  if (prev.actionTitle === step.actionTitle && prev.description === step.description) return;
                  if (step.id.startsWith('step-')) return;
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
                const step = manualSteps.find(s => s.id === stepId);
                if (!step) return;
                const merged = { ...step, ...patch };
                updateStep(stepId, {
                  user_title: merged.actionTitle || null,
                  user_script: merged.description || null,
                  ...(merged.annotations !== undefined ? { user_annotations: merged.annotations } : {}),
                }).catch(() => {});
              }}
            />
          ) : (
            <GuideViewer
              steps={manualSteps}
              activeId={activeId}
              onActiveChange={setActiveId}
            />
          )}
        </div>
      </div>

      {showShare && (
        <ShareModal
          title={title}
          shareToken={tutorial.share_token}
          shareUrl={tutorial.share_token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/play/${tutorial.share_token}` : null}
          onPublishAndShare={publish}
          onUnpublish={unpublish}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
