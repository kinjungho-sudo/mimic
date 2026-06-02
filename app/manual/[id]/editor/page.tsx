'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Share2, Check, Download, Pencil, Undo2, Redo2, Settings, PlayCircle, X } from 'lucide-react';
import { GuideToc } from '@/components/editor/GuideToc';
import { GuideViewer } from '@/components/editor/GuideViewer';
import { ManualEditor, ManualStep } from '@/components/editor/ManualEditor';
import { ShareModal } from '@/components/editor/ShareModal';
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
  }));
}

// ── Page ──────────────────────────────────────────────────

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tutorial, loading, error, publish, unpublish } = useTutorial(id);
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [manualSteps, setManualSteps] = useState<ManualStep[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [titleDirty, setTitleDirty] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [outputRatio, setOutputRatio] = useState<Tutorial['output_ratio']>('16:9');
  const [showSettings, setShowSettings] = useState(false);
  const [sharePassword, setSharePassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [freshnessChecking, setFreshnessChecking] = useState(false);
  const [freshnessResult, setFreshnessResult] = useState<{ checked: number; stale: number } | null>(null);
  const [guideMePreviewUrl, setGuideMePreviewUrl] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<{
    total_views: number; completions: number; completion_rate: number;
    step_funnel: { step: number; count: number; pct: number }[];
    avg_exit_step: number | null;
  } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [collabToast, setCollabToast] = useState<{ stepId: string; name: string; color: string } | null>(null);
  const collabToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
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

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y shortcuts (edit mode only, skip when typing)
  useEffect(() => {
    if (!editMode) return;
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
  }, [editMode, handleUndo, handleRedo]);

  // Seed state from fetched tutorial
  useEffect(() => {
    if (!tutorial) return;
    setTitle(tutorial.title);
    setOutputRatio(tutorial.output_ratio ?? '16:9');
    setSharePassword((tutorial as Tutorial & { share_password?: string }).share_password ?? '');
    const steps = stepsToManualSteps(tutorial.steps);
    setManualSteps(steps);
    if (tutorial.steps.length > 0 && !activeId) {
      setActiveId(tutorial.steps[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial?.id]);

  // 활성 스텝 변경 시 Presence 전송 (협업 커서)
  useEffect(() => { updatePresence(activeId); }, [activeId, updatePresence]);

  // 설정 패널 외부 클릭 닫기
  useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettings]);

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

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/export/pdf/${id}`);
      if (!res.ok) { alert('내보내기 실패. 스텝이 없거나 오류가 발생했습니다.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('content-disposition') ?? '';
      const utf8Match = cd.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = cd.match(/filename="([^"]+)"/i);
      a.download = utf8Match
        ? decodeURIComponent(utf8Match[1])
        : (asciiMatch?.[1] ?? `${title || 'manual'}.pdf`);
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleOpenAnalytics = useCallback(async () => {
    setShowAnalytics(true);
    if (analyticsData) return; // 이미 로드됨
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/tutorials/${id}/analytics`);
      if (res.ok) setAnalyticsData(await res.json());
    } finally {
      setAnalyticsLoading(false);
    }
  }, [id, analyticsData]);

  const handlePasswordSave = useCallback(async () => {
    setPasswordSaving(true);
    try {
      await fetch(`/api/tutorials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ share_password: sharePassword || null }),
      });
    } finally {
      setPasswordSaving(false);
    }
  }, [id, sharePassword]);

  const handleCheckFreshness = useCallback(async () => {
    setFreshnessChecking(true);
    setFreshnessResult(null);
    try {
      const res = await fetch(`/api/tutorials/${id}/check-freshness`, { method: 'POST' });
      if (!res.ok) { alert('최신성 검사에 실패했습니다.'); return; }
      const data = await res.json() as { checked: number; stale: number };
      setFreshnessResult(data);
      // stale 결과를 스텝에 반영하려면 페이지를 리로드하거나 데이터를 다시 가져와야 함
      // 간단하게: stale > 0이면 알림 후 페이지 리로드
      if (data.stale > 0) {
        alert(`${data.checked}개 단계 중 ${data.stale}개에서 UI 변경이 감지되었습니다.\n"업데이트 필요" 뱃지를 확인하세요.`);
        window.location.reload();
      } else {
        alert(`${data.checked}개 단계 모두 최신 상태입니다.`);
      }
    } finally {
      setFreshnessChecking(false);
    }
  }, [id]);

  const handleRatioChange = useCallback(async (ratio: Tutorial['output_ratio']) => {
    setOutputRatio(ratio);
    setShowSettings(false);
    await fetch(`/api/tutorials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ output_ratio: ratio }),
    }).catch(() => {});
  }, [id]);

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
          <button onClick={() => router.push('/home')} style={{ padding: '10px 20px', borderRadius: '8px', background: '#4F46E5', color: 'white', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
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
      <header style={{
        height: '52px', flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        background: 'white',
        borderBottom: '1px solid #E5E7EB',
        gap: '0',
        zIndex: 20,
      }}>
        {/* Left: back button + logo area (60px sidebar width) */}
        <div style={{ width: '60px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            onClick={() => router.push('/home')}
            title="대시보드로 돌아가기"
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              border: '1px solid #E5E7EB', background: 'white',
              display: 'grid', placeItems: 'center',
              color: '#6B7280', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#111827'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#6B7280'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        {/* Center: meta info */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '12px' }}>
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{manualSteps.length}개 단계</span>
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

          {editMode ? (
            /* ── 편집 모드: 실행 취소 + 편집 완료 ── */
            <>
              <button
                onClick={handleUndo}
                disabled={undoRef.current.length === 0}
                title="실행 취소 (Ctrl+Z)"
                style={{
                  height: '32px', padding: '0 12px', borderRadius: '7px',
                  fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px',
                  color: undoRef.current.length > 0 ? '#374151' : '#D1D5DB',
                  background: 'white', border: '1px solid #E5E7EB',
                  cursor: undoRef.current.length > 0 ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (undoRef.current.length > 0) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
              >
                <Undo2 size={13} /> 실행 취소
              </button>
              <button
                onClick={handleRedo}
                disabled={redoRef.current.length === 0}
                title="다시 실행 (Ctrl+Shift+Z)"
                style={{
                  height: '32px', padding: '0 12px', borderRadius: '7px',
                  fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px',
                  color: redoRef.current.length > 0 ? '#374151' : '#D1D5DB',
                  background: 'white', border: '1px solid #E5E7EB',
                  cursor: redoRef.current.length > 0 ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (redoRef.current.length > 0) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
              >
                <Redo2 size={13} /> 다시 실행
              </button>

              <button
                onClick={async () => { const ok = await handleSave(); if (ok) setEditMode(false); }}
                disabled={saving}
                style={{
                  height: '32px', padding: '0 16px', borderRadius: '7px',
                  fontSize: '12.5px', fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  color: 'white',
                  background: saving ? 'rgba(79,70,229,0.6)' : 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                  border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 6px rgba(79,70,229,0.3)', transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.boxShadow = '0 4px 14px rgba(79,70,229,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 6px rgba(79,70,229,0.3)'; }}
              >
                {saving ? '저장 중…' : <><Check size={13} /> 편집 완료</>}
              </button>
            </>
          ) : (
            /* ── 뷰어 모드: 설정 + PDF + 공유 + 편집 + 게시 ── */
            <>
              {/* 설정 드롭다운 */}
              <div ref={settingsRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowSettings(v => !v)}
                  title="설정"
                  style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: showSettings ? '#4F46E5' : '#374151', background: showSettings ? '#EEF2FF' : 'white', border: `1px solid ${showSettings ? '#C7D2FE' : '#E5E7EB'}`, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (!showSettings) e.currentTarget.style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { if (!showSettings) e.currentTarget.style.background = 'white'; }}
                >
                  <Settings size={13} /> 설정
                </button>

                {showSettings && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    width: '260px', background: 'white', borderRadius: '12px',
                    boxShadow: '0 8px 28px rgba(17,24,39,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
                    padding: '16px', zIndex: 100,
                  }}>
                    {/* ── 구분선 ── */}
                    <div style={{ height: '1px', background: '#F3F4F6', marginBottom: '14px' }} />

                    {/* ── 뷰어 이미지 비율 ── */}
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '10px' }}>
                      뷰어 이미지 비율
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {([
                        { value: '16:9', label: '16:9 — 와이드스크린', desc: '일반 화면 캡처에 적합' },
                        { value: '1:1',  label: '1:1 — 정사각형',    desc: '앱/모바일 UI에 적합' },
                        { value: '9:16', label: '9:16 — 세로',       desc: '스마트폰 화면에 적합' },
                      ] as { value: Tutorial['output_ratio']; label: string; desc: string }[]).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => handleRatioChange(opt.value)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                            gap: '1px', padding: '8px 10px', borderRadius: '8px', border: 'none',
                            cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s',
                            background: outputRatio === opt.value ? '#EEF2FF' : 'transparent',
                          }}
                          onMouseEnter={e => { if (outputRatio !== opt.value) e.currentTarget.style.background = '#F9FAFB'; }}
                          onMouseLeave={e => { if (outputRatio !== opt.value) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span style={{ fontSize: '12.5px', fontWeight: outputRatio === opt.value ? 600 : 400, color: outputRatio === opt.value ? '#4F46E5' : '#111827' }}>
                            {opt.label}
                          </span>
                          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{opt.desc}</span>
                        </button>
                      ))}
                    </div>

                    {/* ── 구분선 ── */}
                    <div style={{ height: '1px', background: '#F3F4F6', margin: '14px 0' }} />

                    {/* ── 공유 비밀번호 ── */}
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '10px' }}>
                      공유 비밀번호
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="password"
                        value={sharePassword}
                        onChange={e => setSharePassword(e.target.value)}
                        placeholder="비밀번호 없음"
                        style={{
                          flex: 1, height: '32px', padding: '0 10px',
                          border: '1px solid #E5E7EB', borderRadius: '7px',
                          fontSize: '12px', color: '#111827', outline: 'none',
                          fontFamily: 'inherit',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#4F46E5'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
                      />
                      <button
                        onClick={handlePasswordSave}
                        disabled={passwordSaving}
                        style={{
                          height: '32px', padding: '0 12px', borderRadius: '7px',
                          border: 'none', background: '#4F46E5', color: 'white',
                          fontSize: '12px', fontWeight: 500, cursor: passwordSaving ? 'not-allowed' : 'pointer',
                          opacity: passwordSaving ? 0.6 : 1, whiteSpace: 'nowrap',
                        }}
                      >
                        {passwordSaving ? '저장 중' : '저장'}
                      </button>
                    </div>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '6px 0 0' }}>
                      설정 시 뷰어 접근 시 비밀번호를 요구합니다. 비워두면 보호 해제.
                    </p>

                    {/* ── 구분선 ── */}
                    <div style={{ height: '1px', background: '#F3F4F6', margin: '14px 0' }} />

                    {/* ── 최신성 검사 ── */}
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '10px' }}>
                      가이드 최신성
                    </div>
                    <button
                      onClick={handleCheckFreshness}
                      disabled={freshnessChecking}
                      style={{
                        width: '100%', height: '34px', borderRadius: '7px',
                        border: '1px solid #E5E7EB', background: freshnessChecking ? '#F9FAFB' : 'white',
                        fontSize: '12px', fontWeight: 500, color: '#374151',
                        cursor: freshnessChecking ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        opacity: freshnessChecking ? 0.7 : 1,
                      }}
                      onMouseEnter={e => { if (!freshnessChecking) e.currentTarget.style.background = '#F9FAFB'; }}
                      onMouseLeave={e => { if (!freshnessChecking) e.currentTarget.style.background = 'white'; }}
                    >
                      {freshnessChecking ? '검사 중…' : '페이지 변경 감지 검사'}
                    </button>
                    {freshnessResult && (
                      <p style={{ fontSize: '11px', color: '#6B7280', margin: '6px 0 0' }}>
                        {freshnessResult.stale > 0
                          ? `⚠️ ${freshnessResult.stale}개 단계 업데이트 필요`
                          : `✓ ${freshnessResult.checked}개 단계 최신 상태`}
                      </p>
                    )}
                    <p style={{ fontSize: '10.5px', color: '#9CA3AF', margin: '4px 0 0' }}>
                      각 단계의 원본 페이지와 현재 UI를 비교합니다.
                    </p>

                  </div>
                )}
              </div>

              {/* 분석 버튼 */}
              <button
                onClick={handleOpenAnalytics}
                title="조회 통계 보기"
                style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                분석
              </button>

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

              {/* Guide Me 미리보기 — page_url 있는 스텝이 있을 때만 표시 */}
              {tutorial.share_token && manualSteps.some(s => s.pageUrl) && (
                <button
                  onClick={() => {
                    const firstUrl = manualSteps.find(s => s.pageUrl)?.pageUrl;
                    if (!firstUrl) return;
                    setGuideMePreviewUrl(`${firstUrl}${firstUrl.includes('?') ? '&' : '?'}mimic_guide=${tutorial.share_token}`);
                  }}
                  title="실제 페이지에서 Guide Me 미리보기"
                  style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#4F46E5', background: '#EEF2FF', border: '1px solid #C7D2FE', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#E0E7FF'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#EEF2FF'; }}
                >
                  <PlayCircle size={13} /> Guide Me
                </button>
              )}

              <button
                onClick={() => setEditMode(true)}
                style={{ height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
              >
                <Pencil size={13} /> 편집
              </button>

              {/* 게시 버튼 제거 — 공유 버튼에서 자동 게시 처리 */}
            </>
          )}
          </div>
          {/* Created date — small, below action row */}
          <span style={{ fontSize: '10.5px', color: '#C4C9D4', paddingRight: '2px' }}>
            {createdAt} 생성
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* TOC panel */}
        <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #E5E7EB', background: 'white', minHeight: 0 }}>
          <GuideToc
            steps={manualSteps}
            activeId={activeId}
            onSelect={setActiveId}
            editable={editMode}
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
          />
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {/* Title banner */}
          <div style={{ flexShrink: 0, padding: '20px 40px 16px', borderBottom: '1px solid #E5E7EB', background: 'white' }}>
            <input
              value={title}
              onChange={e => { setTitle(e.target.value); setTitleDirty(true); }}
              placeholder="매뉴얼 제목"
              style={{
                width: '100%', fontSize: '22px', fontWeight: 700, color: '#111827',
                background: 'transparent', border: 'none', outline: 'none',
                fontFamily: 'inherit', cursor: 'text',
              }}
            />
          </div>
          {editMode ? (
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
                  // 협업: 변경 브로드캐스트
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
                // patch만으로 직접 저장 — manualSteps 클로저 참조 제거
                updateStep(stepId, {
                  ...(patch.actionTitle !== undefined ? { user_title: patch.actionTitle || null } : {}),
                  ...(patch.description !== undefined ? { user_script: patch.description || null } : {}),
                  ...(patch.annotations !== undefined ? { user_annotations: patch.annotations } : {}),
                }).catch(() => {});
              }}
            />
          ) : (
            <GuideViewer
              steps={manualSteps}
              activeId={activeId}
              onActiveChange={setActiveId}
              outputRatio={outputRatio}
            />
          )}
        </div>
      </div>

      {/* 분석 모달 */}
      {showAnalytics && (
        <>
          <div onClick={() => setShowAnalytics(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,15,0.55)', zIndex: 60, backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 'min(520px, 92vw)', background: 'white', borderRadius: '20px',
            boxShadow: '0 30px 80px rgba(0,0,0,0.22)', zIndex: 61, overflow: 'hidden',
          }}>
            {/* 헤더 */}
            <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>조회 통계</h2>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#9CA3AF' }}>{title}</p>
              </div>
              <button onClick={() => setShowAnalytics(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF', padding: '4px' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#374151'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; }}>
                <X size={18} />
              </button>
            </div>

            {/* 바디 */}
            <div style={{ padding: '24px' }}>
              {analyticsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: '13px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid #E5E7EB', borderTopColor: '#4F46E5', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                  데이터 불러오는 중…
                </div>
              ) : analyticsData ? (
                <>
                  {/* 요약 카드 3개 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                    {[
                      { label: '총 조회수', value: String(analyticsData.total_views), sub: '명' },
                      { label: '완독 수', value: String(analyticsData.completions), sub: `/ ${analyticsData.total_views}명` },
                      { label: '완독률', value: `${analyticsData.completion_rate}%`, sub: analyticsData.avg_exit_step != null ? `평균 ${analyticsData.avg_exit_step}단계서 이탈` : '데이터 없음' },
                    ].map(card => (
                      <div key={card.label} style={{ background: '#F9FAFB', borderRadius: '10px', padding: '14px 16px' }}>
                        <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '6px' }}>{card.label}</div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>{card.value}</div>
                        <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>{card.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* 스텝별 funnel */}
                  {analyticsData.step_funnel.length > 0 ? (
                    <>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>단계별 도달률</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '220px', overflowY: 'auto' }}>
                        {analyticsData.step_funnel.map(row => (
                          <div key={row.step} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '28px', fontSize: '11px', color: '#9CA3AF', flexShrink: 0, textAlign: 'right' }}>{row.step}</div>
                            <div style={{ flex: 1, background: '#F3F4F6', borderRadius: '4px', overflow: 'hidden', height: '8px' }}>
                              <div style={{ width: `${row.pct}%`, height: '100%', background: 'linear-gradient(90deg,#4F46E5,#7C3AED)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                            </div>
                            <div style={{ width: '42px', fontSize: '11px', color: '#6B7280', flexShrink: 0 }}>{row.count}명</div>
                            <div style={{ width: '32px', fontSize: '11px', color: '#9CA3AF', flexShrink: 0, textAlign: 'right' }}>{row.pct}%</div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: '13px' }}>
                      아직 조회 데이터가 없어요.<br />
                      <span style={{ fontSize: '12px' }}>매뉴얼을 공유하면 여기에 통계가 쌓입니다.</span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: '13px' }}>데이터를 불러오지 못했습니다.</div>
              )}
            </div>
          </div>
        </>
      )}

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

      {/* Guide Me 미리보기 모달 */}
      {guideMePreviewUrl && (
        <>
          <div
            onClick={() => setGuideMePreviewUrl(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,15,0.6)', zIndex: 60, backdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 'min(92vw, 1100px)', height: 'min(88vh, 700px)',
            background: '#1E1E2E', borderRadius: '16px',
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
            zIndex: 61, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* iframe 헤더 */}
            <div style={{
              height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center',
              padding: '0 16px', gap: '10px', background: '#16161F',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['#FF5F57','#FEBC2E','#28C840'].map((c, i) => (
                  <div key={i} style={{ width: '12px', height: '12px', borderRadius: '50%', background: c }} />
                ))}
              </div>
              <div style={{
                flex: 1, height: '26px', background: 'rgba(255,255,255,0.06)',
                borderRadius: '6px', display: 'flex', alignItems: 'center',
                padding: '0 10px',
              }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {guideMePreviewUrl}
                </span>
              </div>
              <button
                onClick={() => setGuideMePreviewUrl(null)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '4px', lineHeight: 1 }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
              >
                <X size={15} />
              </button>
            </div>
            {/* iframe */}
            <iframe
              src={guideMePreviewUrl}
              style={{ flex: 1, border: 'none', display: 'block', background: 'white' }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="Guide Me 미리보기"
            />
          </div>
        </>
      )}
    </div>
  );
}
