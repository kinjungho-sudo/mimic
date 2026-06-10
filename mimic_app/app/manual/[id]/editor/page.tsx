'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, Undo2, Redo2, Volume2, VolumeX, Loader2, RefreshCw, MonitorPlay, Wand2, Zap } from 'lucide-react';
import { GuideToc } from '@/components/editor/GuideToc';
import { ManualEditor, ManualStep } from '@/components/editor/ManualEditor';
import { SdkPreviewPanel } from '@/components/editor/SdkPreviewPanel';
import { useTutorial } from '@/hooks/useTutorial';
import { useAutosave } from '@/hooks/useAutosave';
import { useAuth } from '@/hooks/useAuth';
import { useCollaboration } from '@/hooks/useCollaboration';
import type { Collaborator } from '@/hooks/useCollaboration';
import { updateStep, createStep, deleteStep, reorderSteps } from '@/lib/api/steps';
import { getTutorial } from '@/lib/api/tutorials';
import type { Step, Tutorial } from '@/types';

// ── Adapters ──────────────────────────────────────────────

// DB click 좌표 → 0~100 pct (현행 0~1 실수, 레거시 0~10000 정수 혼재 방어)
function clickToPct(v: number | null | undefined): number | null {
  if (v == null) return null;
  if (v <= 1) return v * 100;
  if (v > 100) return v / 100;
  return v;
}

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
    pii_detected: (s as Step & { pii_detected?: boolean }).pii_detected ?? false,
    crop_rect: (s as Step & { crop_rect?: { x: number; y: number; w: number; h: number } | null }).crop_rect ?? null,
    element_rect: (s as Step & { element_rect?: { x: number; y: number; width: number; height: number } | null }).element_rect ?? null,
    imageZoom: (s as Step & { image_zoom?: number | null }).image_zoom ?? 1,
    // click_x/y: DB 0~1 실수 → ×100 → 0~100 pct (ManualEditor CSS % 계약)
    click_x: clickToPct((s as Step & { click_x?: number | null }).click_x),
    click_y: clickToPct((s as Step & { click_y?: number | null }).click_y),
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
  // 녹화 직후 진입 — 스텝 생성 대기 폴링
  const [pollingState, setPollingState] = useState<'idle' | 'polling' | 'timeout'>('idle');
  const [saving, setSaving] = useState(false);
  const [freshnessChecking, setFreshnessChecking] = useState(false);
  const [freshnessResult, setFreshnessResult] = useState<{ checked: number; stale: number } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [patching, setPatching] = useState(false);
  const [patchResult, setPatchResult] = useState<{ patched: number } | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsVoice, setTtsVoice] = useState<'nova' | 'alloy'>('nova');
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [collabToast, setCollabToast] = useState<{ stepId: string; name: string; color: string } | null>(null);
  const collabToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const tempIdCounter = useRef(0);
  const [tocSelectedIds, setTocSelectedIds] = useState<Set<string>>(new Set());
  const [autoGenProgress, setAutoGenProgress] = useState<{ done: number; total: number } | null>(null);

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
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const setManualStepsWithHistory = useCallback((next: ManualStep[]) => {
    undoRef.current = [...undoRef.current.slice(-49), manualSteps];
    redoRef.current = [];
    setManualSteps(next);
    setCanUndo(true);
    setCanRedo(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualSteps]);

  const handleUndo = useCallback(() => {
    if (undoRef.current.length === 0) return;
    const prev = undoRef.current[undoRef.current.length - 1];
    redoRef.current = [...redoRef.current, manualSteps];
    undoRef.current = undoRef.current.slice(0, -1);
    setManualSteps(prev);
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualSteps]);

  const handleRedo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const next = redoRef.current[redoRef.current.length - 1];
    undoRef.current = [...undoRef.current, manualSteps];
    redoRef.current = redoRef.current.slice(0, -1);
    setManualSteps(next);
    setCanUndo(true);
    setCanRedo(redoRef.current.length > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualSteps]);

  const handleGuideMe = useCallback(() => {
    const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID?.replace(/^﻿/, '').trim();
    if (!extensionId) {
      alert('Guide Me를 사용하려면 MIMIC 확장프로그램을 설치해주세요.');
      return;
    }
    const shareToken = (tutorial as Tutorial & { share_token?: string | null })?.share_token;
    if (!shareToken) {
      alert('먼저 게시(Publish) 후 Guide Me를 사용할 수 있습니다.');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).chrome?.runtime?.sendMessage(
        extensionId,
        { action: 'START_GUIDE', share_token: shareToken },
        (response: { ok?: boolean } | undefined) => {
          if (!response?.ok) {
            alert('확장프로그램이 응답하지 않습니다. 설치 여부를 확인해주세요.');
          }
        }
      );
    } catch {
      alert('Guide Me를 시작할 수 없습니다. 확장프로그램을 설치해주세요.');
    }
  }, [tutorial]);

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
    // TTS 설정 초기화
    const t = tutorial as Tutorial & { tts_enabled?: boolean; tts_voice?: string };
    setTtsEnabled(t.tts_enabled ?? false);
    setTtsVoice((t.tts_voice as 'nova' | 'alloy') ?? 'nova');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial?.id]);

  // 녹화 직후 진입: 스텝이 없으면 2초마다 폴링 (최대 30초)
  useEffect(() => {
    if (loading) return;
    if (!tutorial) return;
    if (tutorial.steps.length > 0) return; // 이미 스텝 있으면 불필요

    setPollingState('polling');
    const INTERVAL = 2000;
    const MAX_ATTEMPTS = 15; // 2s × 15 = 30s
    let attempts = 0;

    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const fresh = await getTutorial(id);
        if (fresh.steps.length > 0) {
          clearInterval(timer);
          setPollingState('idle');
          const steps = stepsToManualSteps(fresh.steps);
          setManualSteps(steps);
          setTitle(fresh.title);
          if (!activeId) setActiveId(fresh.steps[0].id);
        }
      } catch { /* 네트워크 오류는 무시하고 계속 */ }

      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(timer);
        setPollingState('timeout');
      }
    }, INTERVAL);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial?.id, loading]);

  // 에디터 최초 로드 시 description 없는 스텝 자동 AI 생성
  useEffect(() => {
    if (!tutorial) return;
    const empty = tutorial.steps.filter(s =>
      !s.id.startsWith('step-') &&
      !(s.user_script ?? s.ai_description ?? '').trim()
    );
    if (empty.length === 0) return;

    let cancelled = false;
    setAutoGenProgress({ done: 0, total: empty.length });

    (async () => {
      for (let i = 0; i < empty.length; i++) {
        if (cancelled) break;
        const step = empty[i];
        try {
          const res = await fetch(`/api/steps/${step.id}/generate-description`, { method: 'POST' });
          if (res.ok) {
            const { description } = await res.json();
            if (description && !cancelled) {
              setManualSteps(prev => prev.map(s =>
                s.id === step.id ? { ...s, description } : s
              ));
            }
          }
        } catch { /* 개별 실패는 무시하고 다음 스텝 계속 */ }
        if (!cancelled) setAutoGenProgress({ done: i + 1, total: empty.length });
      }
      if (!cancelled) {
        setAutoGenProgress(null);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial?.id]);

  // 활성 스텝 변경 시 Presence 전송 (협업 커서)
  useEffect(() => { updatePresence(activeId); }, [activeId, updatePresence]);

  // Autosave title
  useAutosave(id, titleDirty ? { title } : null);

  const saveTtsSetting = useCallback(async (enabled: boolean, voice: 'nova' | 'alloy') => {
    await fetch(`/api/tutorials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tts_enabled: enabled, tts_voice: voice }),
    });
  }, [id]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleTtsToggle = useCallback(async (enabled: boolean) => {
    setTtsEnabled(enabled);
    await saveTtsSetting(enabled, ttsVoice);
  }, [ttsVoice, saveTtsSetting]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleTtsVoiceChange = useCallback(async (voice: 'nova' | 'alloy') => {
    setTtsVoice(voice);
    await saveTtsSetting(ttsEnabled, voice);
  }, [ttsEnabled, saveTtsSetting]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleGenerateAllTts = useCallback(async () => {
    const targets = manualSteps.filter(s =>
      !s.id.startsWith('step-') && s.description.replace(/<[^>]+>/g, '').trim()
    );
    if (!targets.length) return;
    setTtsGenerating(true);
    try {
      await Promise.all(targets.map(s =>
        fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stepId: s.id,
            scriptText: s.description.replace(/<[^>]+>/g, '').trim(),
            voice: ttsVoice,
          }),
        })
      ));
    } finally {
      setTtsGenerating(false);
    }
  }, [manualSteps, ttsVoice]);

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


  const handleCheckFreshness = useCallback(async () => {
    setFreshnessChecking(true);
    setFreshnessResult(null);
    try {
      const res = await fetch(`/api/tutorials/${id}/check-freshness`, { method: 'POST' });
      const data = await res.json();
      setFreshnessResult(data);
      // is_stale 업데이트된 스텝 반영을 위해 페이지 데이터 새로고침
      if (data.stale > 0) {
        setManualSteps(prev => prev.map(s => ({ ...s })));
      }
    } catch {
      setFreshnessResult({ checked: 0, stale: -1 });
    } finally {
      setFreshnessChecking(false);
    }
  }, [id]);

  const handlePatchSteps = useCallback(async () => {
    setPatching(true);
    setPatchResult(null);
    try {
      const res = await fetch(`/api/tutorials/${id}/patch-steps`, { method: 'POST' });
      const data = await res.json();
      setPatchResult(data);
      // 보완된 내용 반영을 위해 로컬 상태 갱신 트리거 (페이지 새로고침 없이)
      if (data.patched > 0) {
        window.location.reload();
      }
    } catch {
      setPatchResult({ patched: -1 });
    } finally {
      setPatching(false);
    }
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
    const tempId = `step-tmp-${++tempIdCounter.current}`;
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
    const tempId = `step-tmp-${++tempIdCounter.current}`;
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

      {/* ── 매뉴얼 생성 대기 오버레이 (녹화 직후 진입 시) ── */}
      {pollingState !== 'idle' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(255,255,255,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          {pollingState === 'polling' ? (
            <>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '3px solid rgba(55,48,163,0.18)', borderTopColor: '#3730a3', animation: 'spin 0.9s linear infinite' }} />
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: 0 }}>매뉴얼을 자동으로 제작하고 있습니다</p>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>AI가 각 단계를 분석 중입니다 — 잠시만 기다려 주세요</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: 0 }}>제작 중 오류가 발생했습니다</p>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>스텝이 생성되지 않았습니다. 페이지를 새로고침하거나 다시 녹화해 주세요.</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button onClick={() => window.location.reload()} style={{ padding: '9px 18px', borderRadius: '8px', background: '#3730a3', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                  새로고침
                </button>
                <button onClick={() => router.push('/home')} style={{ padding: '9px 18px', borderRadius: '8px', background: 'white', color: '#374151', border: '1px solid #D1D5DB', cursor: 'pointer', fontSize: '13px' }}>
                  대시보드로
                </button>
              </div>
            </>
          )}
        </div>
      )}

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
            {/* 빈 스텝 보완 */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={handlePatchSteps}
                disabled={patching}
                title="어노테이션/제목이 없는 스텝 일괄 보완"
                style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', cursor: patching ? 'not-allowed' : 'pointer', opacity: patching ? 0.6 : 1, transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!patching) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
              >
                {patching ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={13} />}
                빈 스텝 보완
              </button>
              {patchResult && patchResult.patched !== -1 && (
                <div style={{
                  position: 'absolute', top: '38px', right: 0, zIndex: 30,
                  background: 'white', border: '1px solid #E5E7EB', borderRadius: '10px',
                  padding: '10px 14px', fontSize: '12px', color: '#374151',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)', whiteSpace: 'nowrap',
                }}>
                  {patchResult.patched === 0 ? (
                    <span style={{ color: '#059669' }}>✓ 모든 스텝이 이미 완성됐어요</span>
                  ) : (
                    <span style={{ color: '#4F46E5' }}>✓ {patchResult.patched}개 스텝을 보완했어요</span>
                  )}
                  <button onClick={() => setPatchResult(null)} style={{ marginLeft: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '11px', padding: 0 }}>✕</button>
                </div>
              )}
            </div>

            {/* SDK 미리보기 토글 */}
            <button
              onClick={() => setShowPreview(v => !v)}
              title="SDK 툴팁 미리보기"
              style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: showPreview ? '#4F46E5' : '#374151', background: showPreview ? 'rgba(79,70,229,0.08)' : 'white', border: `1px solid ${showPreview ? '#4F46E5' : '#E5E7EB'}`, cursor: 'pointer', transition: 'all 0.15s', fontWeight: showPreview ? 600 : 400 }}
              onMouseEnter={e => { if (!showPreview) e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { if (!showPreview) e.currentTarget.style.background = 'white'; }}
            >
              <MonitorPlay size={13} />
              미리보기
            </button>

            {/* Guide Me — 확장프로그램으로 실제 화면 오버레이 가이드 시작 */}
            {(() => {
              const shareToken = (tutorial as Tutorial & { share_token?: string | null })?.share_token;
              return (
                <button
                  onClick={handleGuideMe}
                  title={shareToken ? 'Guide Me 시작 — 실제 화면에서 오버레이 가이드' : '게시 후 사용 가능'}
                  style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: shareToken ? '#374151' : '#D1D5DB', background: 'white', border: '1px solid #E5E7EB', cursor: shareToken ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (shareToken) e.currentTarget.style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
                >
                  <Zap size={13} />
                  Guide Me
                </button>
              );
            })()}

            {/* 최신성 확인 버튼 */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={handleCheckFreshness}
                disabled={freshnessChecking}
                title="페이지 UI 변경 여부 확인"
                style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', cursor: freshnessChecking ? 'not-allowed' : 'pointer', opacity: freshnessChecking ? 0.6 : 1, transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!freshnessChecking) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
              >
                <RefreshCw size={13} style={freshnessChecking ? { animation: 'spin 1s linear infinite' } : {}} />
                최신성 확인
              </button>
              {freshnessResult && (
                <div style={{
                  position: 'absolute', top: '38px', right: 0, zIndex: 30,
                  background: 'white', border: '1px solid #E5E7EB', borderRadius: '10px',
                  padding: '10px 14px', fontSize: '12px', color: '#374151',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)', whiteSpace: 'nowrap',
                }}>
                  {freshnessResult.stale === -1 ? (
                    <span style={{ color: '#DC2626' }}>확인 중 오류가 발생했어요</span>
                  ) : freshnessResult.checked === 0 ? (
                    <span style={{ color: '#6B7280' }}>확인할 페이지 URL이 없어요</span>
                  ) : freshnessResult.stale === 0 ? (
                    <span style={{ color: '#059669' }}>✓ 모든 단계가 최신 상태예요 ({freshnessResult.checked}개 확인)</span>
                  ) : (
                    <span style={{ color: '#D97706' }}>⚠ {freshnessResult.stale}개 단계가 업데이트 필요해요</span>
                  )}
                  <button
                    onClick={() => setFreshnessResult(null)}
                    style={{ marginLeft: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '11px', padding: 0 }}
                  >✕</button>
                </div>
              )}
            </div>
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              title="실행 취소 (Ctrl+Z)"
              style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: canUndo ? '#374151' : '#D1D5DB', background: 'white', border: '1px solid #E5E7EB', cursor: canUndo ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (canUndo) e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
            >
              <Undo2 size={13} /> 실행 취소
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              title="다시 실행 (Ctrl+Shift+Z)"
              style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: canRedo ? '#374151' : '#D1D5DB', background: 'white', border: '1px solid #E5E7EB', cursor: canRedo ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (canRedo) e.currentTarget.style.background = '#F9FAFB'; }}
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
            selectedIds={tocSelectedIds}
            onSelectChange={setTocSelectedIds}
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
            onDeleteCategory={(hostname) => {
              const toDelete = manualSteps.filter(s => s.domainHostname === hostname);
              toDelete.forEach(s => handleDeleteStep(s.id));
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
            {/* TTS 설정 — 튜토리얼 단위 ON/OFF */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, borderLeft: '1px solid #F3F4F6', paddingLeft: '12px' }}>
              <button
                onClick={() => handleTtsToggle(!ttsEnabled)}
                title={ttsEnabled ? 'AI 음성 끄기' : 'AI 음성 켜기'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 10px', borderRadius: '6px', border: `1px solid ${ttsEnabled ? '#6d28d9' : '#E5E7EB'}`, background: ttsEnabled ? 'rgba(109,40,217,0.07)' : 'white', color: ttsEnabled ? '#6d28d9' : '#9CA3AF', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {ttsEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                AI 음성
              </button>
              {ttsEnabled && (
                <>
                  <select
                    value={ttsVoice}
                    onChange={e => handleTtsVoiceChange(e.target.value as 'nova' | 'alloy')}
                    style={{ fontSize: '11.5px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', borderRadius: '5px', padding: '3px 6px', cursor: 'pointer', outline: 'none', height: '28px' }}
                  >
                    <option value="nova">Nova (여성)</option>
                    <option value="alloy">Alloy (남성)</option>
                  </select>
                  <button
                    onClick={handleGenerateAllTts}
                    disabled={ttsGenerating}
                    title="전체 스텝 음성 생성"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '28px', padding: '0 10px', borderRadius: '6px', border: '1px solid #6d28d9', background: '#6d28d9', color: 'white', fontSize: '11.5px', fontWeight: 500, cursor: ttsGenerating ? 'not-allowed' : 'pointer', opacity: ttsGenerating ? 0.65 : 1, transition: 'all 0.15s' }}
                  >
                    {ttsGenerating ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Volume2 size={11} />}
                    {ttsGenerating ? '생성 중…' : '전체 생성'}
                  </button>
                </>
              )}
            </div>
            {/* AI 자동 생성 진행 인디케이터 */}
            {autoGenProgress && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, fontSize: '11.5px', color: '#6d28d9' }}>
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                <span>AI 작성 중 {autoGenProgress.done}/{autoGenProgress.total}</span>
              </div>
            )}
            <span style={{ fontSize: '10.5px', color: '#C4C9D4', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {createdAt}
            </span>
          </div>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <ManualEditor
            steps={manualSteps}
            hideToc
            activeId={activeId}
            onActiveChange={setActiveId}
            selectedIds={tocSelectedIds}
            onSelectChange={setTocSelectedIds}
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
          {showPreview && (
            <SdkPreviewPanel
              steps={manualSteps}
              activeId={activeId}
              onClose={() => setShowPreview(false)}
            />
          )}
          </div>
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
