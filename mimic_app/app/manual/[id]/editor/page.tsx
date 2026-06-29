'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Undo2, Redo2, Volume2, VolumeX, Loader2, Eye, Wand2, MessageSquare, Clock, Share2, Palette, Download, Check, Link2 } from 'lucide-react';
import { GuideToc } from '@/components/editor/GuideToc';
import { ManualEditor, ManualStep } from '@/components/editor/ManualEditor';
import { MergeModal } from '@/components/editor/MergeModal';
import { CommentsPanel } from '@/components/editor/CommentsPanel';
import { ActivityPanel } from '@/components/editor/ActivityPanel';
import { ExportModal } from '@/components/editor/ExportModal';
import { ShareModal } from '@/components/editor/ShareModal';
import { AgentChat } from '@/components/chat/AgentChat';
import { useTutorial } from '@/hooks/useTutorial';
import { useAutosave } from '@/hooks/useAutosave';
import { useAuth } from '@/hooks/useAuth';
import { useCollaboration } from '@/hooks/useCollaboration';
import type { Collaborator } from '@/hooks/useCollaboration';
import { updateStep, createStep, deleteStep, reorderSteps, duplicateStep } from '@/lib/api/steps';
import { getTutorial } from '@/lib/api/tutorials';
import { stripGeneratedSpotlights } from '@/lib/annotations';
import { logError } from '@/lib/logging/logger';
import { hasGuideConfig } from '@/lib/follow';
import type { Step, Tutorial } from '@/types';

const TOP_BAR_ICON_SIZE = 14;

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
    actionTitle: s.user_title || s.ai_title || '',
    titleFontSize: (s as Step & { title_font_size?: number | null }).title_font_size ?? null,
    followConfig: (s as Step & { follow_config?: import('@/types').FollowConfig | null }).follow_config ?? null,
    description: s.user_script || s.ai_description || '',
    screenshotUrl: s.screenshot_url || undefined,
    originalScreenshotUrl: (s as Step & { original_screenshot_url?: string | null }).original_screenshot_url ?? null,
    annotations: stripGeneratedSpotlights(s.user_annotations as import('@/components/editor/ImageAnnotationEditor').Annotation[] | null),
    pageUrl:         s.page_url        ?? null,
    domainHostname:  s.domain_hostname ?? null,
    domainName:      s.domain_name     ?? null,
    domainFavicon:   s.domain_favicon  ?? null,
    domain_name:    s.domain_name     ?? null,
    domain_favicon: s.domain_favicon  ?? null,
    is_stale: (s as Step & { is_stale?: boolean }).is_stale ?? false,
    pii_detected: (s as Step & { pii_detected?: boolean }).pii_detected ?? false,
    crop_rect: (() => {
      type CR = { x: number; y: number; width?: number; height?: number; w?: number; h?: number };
      const cr = (s as Step & { crop_rect?: CR | null }).crop_rect;
      if (!cr) return null;
      return { x: cr.x, y: cr.y, w: cr.w ?? cr.width ?? 0, h: cr.h ?? cr.height ?? 0 };
    })(),
    element_rect: (s as Step & { element_rect?: { x: number; y: number; width: number; height: number } | null }).element_rect ?? null,
    imageZoom: (s as Step & { image_zoom?: number | null }).image_zoom ?? 1,
    imageOffsetX: (s as Step & { image_offset_x?: number | null }).image_offset_x ?? 0,
    imageOffsetY: (s as Step & { image_offset_y?: number | null }).image_offset_y ?? 0,
    // click_x/y: DB 0~1 실수 → ×100 → 0~100 pct (ManualEditor CSS % 계약)
    click_x: clickToPct((s as Step & { click_x?: number | null }).click_x),
    click_y: clickToPct((s as Step & { click_y?: number | null }).click_y),
    // 음성 전사 — 원본 토글 + 구간 재생용
    voiceTranscriptRaw: (s as Step & { voice_transcript_raw?: string | null }).voice_transcript_raw ?? null,
    voiceAudioUrl:      (s as Step & { voice_audio_url?: string | null }).voice_audio_url ?? null,
    voiceAudioStartMs:  (s as Step & { voice_audio_start_ms?: number | null }).voice_audio_start_ms ?? null,
    voiceAudioEndMs:    (s as Step & { voice_audio_end_ms?: number | null }).voice_audio_end_ms ?? null,
    type_text:          (s as Step & { type_text?: string | null }).type_text ?? null,
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
  const [titleDirty, setTitleDirty] = useState(false);
  const [refiningText, setRefiningText] = useState(false);
  const [bulkColorOpen, setBulkColorOpen] = useState(false);
  // 녹화 직후 진입 — 스텝 생성 대기 폴링
  const [pollingState, setPollingState] = useState<'idle' | 'polling' | 'timeout'>('idle');
  const [showComments, setShowComments] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadingFmt, setDownloadingFmt] = useState<'pdf' | 'pptx' | 'docx' | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsVoice, setTtsVoice] = useState<'nova' | 'alloy'>('nova');
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [collabToast, setCollabToast] = useState<{ stepId: string; name: string; color: string } | null>(null);
  const collabToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const tempIdCounter = useRef(0);
  const [tocSelectedIds, setTocSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [autoGenProgress, setAutoGenProgress] = useState<{ done: number; total: number } | null>(null);
  const [showMerge, setShowMerge] = useState(false);
  const [duplicatingStepId, setDuplicatingStepId] = useState<string | null>(null);

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

  // 뷰어 권한자가 편집 URL로 진입하면 뷰어로 돌려보낸다 (홈은 '편집 우선'이라 편집 URL로 라우팅됨)
  useEffect(() => {
    if (!tutorial) return;
    if ((tutorial as Tutorial & { my_role?: string }).my_role === 'viewer') {
      router.replace(`/manual/${id}`);
    }
  }, [tutorial, id, router]);

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

  // 매뉴얼 전체 어노테이션 일괄 재색 (편집 #4) — 모든 스텝의 테두리/글자색을 한 번에 통일 후 저장
  const recolorAllSteps = useCallback((kind: 'border' | 'text', colorVal: string) => {
    const BORDER_TYPES = ['rect', 'roundedRect', 'ellipse', 'arrow', 'marker'];
    const changed: ManualStep[] = [];
    const next = manualSteps.map(s => {
      if (!s.annotations?.length) return s;
      let touched = false;
      const anns = s.annotations.map(a => {
        const hit = kind === 'border' ? BORDER_TYPES.includes(a.type) : a.type === 'text';
        if (hit && a.color !== colorVal) { touched = true; return { ...a, color: colorVal }; }
        return a;
      });
      if (!touched) return s;
      const ns = { ...s, annotations: anns };
      changed.push(ns);
      return ns;
    });
    if (!changed.length) { setBulkColorOpen(false); return; }
    setManualStepsWithHistory(next);
    changed.forEach(s => {
      if (s.id.startsWith('step-')) return;
      updateStep(s.id, { user_annotations: s.annotations ?? [] })
        .catch(e => logError('step.bulkcolor.fail', { tutorialId: id, stepId: s.id, message: e instanceof Error ? e.message : String(e) }));
    });
    setBulkColorOpen(false);
  }, [manualSteps, setManualStepsWithHistory, id]);

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

  const handleDownload = useCallback(async (fmt: 'pdf' | 'pptx' | 'docx') => {
    setDownloadingFmt(fmt);
    try {
      const res = await fetch(`/api/export/${fmt}/${id}`);
      if (!res.ok) { alert('다운로드 실패. 스텝이 없거나 오류가 발생했습니다.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('content-disposition') ?? '';
      const utf8Match = cd.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = cd.match(/filename="([^"]+)"/i);
      a.download = utf8Match ? decodeURIComponent(utf8Match[1]) : (asciiMatch?.[1] ?? `${title || 'manual'}.${fmt}`);
      a.click();
      URL.revokeObjectURL(url);
      setDownloadOpen(false);
    } finally {
      setDownloadingFmt(null);
    }
  }, [id, title]);


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

  // 에디터 최초 로드 시 description 없는 스텝 자동 AI 생성 (무료 플랜 제외)
  useEffect(() => {
    if (!tutorial) return;
    if (user?.plan === 'free' || user?.plan === 'pro_waitlist') return;
    const empty = tutorial.steps.filter(s =>
      !s.id.startsWith('step-') &&
      !(s.user_script || s.ai_description || '').trim()
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

  // 전체 문장 다듬기 — 모든 스텝의 설명 문장을 매뉴얼 가이드라인에 맞게 일괄 정제
  const handleRefineAllText = useCallback(async () => {
    const allWithText = manualSteps
      .filter(s => !s.id.startsWith('step-'))
      .map(s => ({ id: s.id, text: s.description.replace(/<[^>]+>/g, '').trim() }));
    if (!allWithText.some(s => s.text)) return;
    setRefiningText(true);
    try {
      const res = await fetch('/api/ai/rewrite-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: allWithText,
          instruction: '매뉴얼 가이드라인에 맞게 다듬어줘: 행동 하나만, 1문장, 존댓말, 특정 상품명/수량 제거, 결과 설명 문장 금지',
        }),
      });
      if (!res.ok) return;
      const { results } = await res.json();
      if (!Array.isArray(results)) return;
      const updated = new Map<string, string>(
        results
          .filter((r: { id: string; result: string }) => r.result)
          .map((r: { id: string; result: string }) => [r.id, r.result])
      );
      if (updated.size === 0) return;
      const next = manualSteps.map(s => updated.has(s.id) ? { ...s, description: updated.get(s.id)! } : s);
      setManualStepsWithHistory(next);
      next.filter(s => updated.has(s.id)).forEach(s =>
        updateStep(s.id, { user_script: s.description || null }).catch(() => {})
      );
    } finally {
      setRefiningText(false);
    }
  }, [manualSteps, setManualStepsWithHistory]);

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

  const performDeleteStep = useCallback((stepId: string) => {
    const next = manualSteps.filter(s => s.id !== stepId).map((s, i) => ({ ...s, number: i + 1 }));
    setManualStepsWithHistory(next);
    if (activeId === stepId) setActiveId(next[0]?.id ?? null);
    setPendingDeleteId(null);
    // DB 삭제 — 임시 ID(step-*)는 아직 DB에 없으므로 건너뜀
    if (!stepId.startsWith('step-')) {
      deleteStep(stepId).catch((e) => logError('step.delete.fail', { tutorialId: id, stepId, message: e instanceof Error ? e.message : String(e) }));
    }
  }, [manualSteps, activeId, setManualStepsWithHistory]);

  const handleDeleteStep = useCallback((stepId: string) => setPendingDeleteId(stepId), []);

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
    } catch (e) {
      // INSERT 실패 — 임시 스텝은 어떤 저장 경로로도 영속되지 않으므로(step- 접두사 건너뜀) 롤백.
      // 추가 직후(사용자 입력 전) 실패라 유실되는 내용 없음.
      logError('step.create.fail', { tutorialId: id, message: e instanceof Error ? e.message : String(e) });
      setManualSteps(prev => prev.filter(s => s.id !== tempId).map((s, i) => ({ ...s, number: i + 1 })));
      setActiveId(prev => (prev === tempId ? null : prev));
      alert('단계를 추가하지 못했습니다. 네트워크 연결을 확인 후 다시 시도해 주세요.');
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
    } catch (e) {
      // INSERT 실패 — 임시 스텝은 영속 불가하므로 롤백(추가 직후라 유실 내용 없음).
      logError('step.insert.fail', { tutorialId: id, message: e instanceof Error ? e.message : String(e) });
      setManualSteps(prev => prev.filter(s => s.id !== tempId).map((s, i) => ({ ...s, number: i + 1 })));
      setActiveId(prev => (prev === tempId ? afterId : prev));
      alert('단계를 추가하지 못했습니다. 네트워크 연결을 확인 후 다시 시도해 주세요.');
    }
  }, [manualSteps, setManualStepsWithHistory, id]);

  const handleDuplicateStep = useCallback(async (srcId: string) => {
    const idx = manualSteps.findIndex(s => s.id === srcId);
    if (idx < 0) return;
    const src = manualSteps[idx];
    if (srcId.startsWith('step-')) return; // 임시 스텝은 아직 DB에 없어 복제 불가
    if (duplicatingStepId) return;
    // 디바운스 대기 중인 소스 텍스트 편집을 먼저 flush — 서버는 DB 행을 복사하므로 최신화 필요
    clearTimeout(stepSaveTimers.current[srcId]);
    setDuplicatingStepId(srcId);
    try {
      await updateStep(srcId, { user_title: src.actionTitle || null, user_script: src.description || null });
      const created = await duplicateStep(srcId);
      // 서버가 DB 전체를 복사 → 로컬은 소스 콘텐츠 그대로 복제하고 실제 id만 부여
      const i = manualSteps.findIndex(s => s.id === srcId);
      const copy: ManualStep = { ...manualSteps[i], id: created.id };
      const next = [...manualSteps.slice(0, i + 1), copy, ...manualSteps.slice(i + 1)].map((s, n) => ({ ...s, number: n + 1 }));
      setManualStepsWithHistory(next);
      setActiveId(created.id);
    } catch (e) {
      logError('step.duplicate.fail', { tutorialId: id, stepId: srcId, message: e instanceof Error ? e.message : String(e) });
      alert('단계를 복제하지 못했습니다. 네트워크 연결을 확인 후 다시 시도해 주세요.');
    } finally {
      setDuplicatingStepId(null);
    }
  }, [manualSteps, id, setManualStepsWithHistory, duplicatingStepId]);

  const handleImportSteps = useCallback(async (sourceTutorialId: string, stepIds: string[]) => {
    const res = await fetch(`/api/tutorials/${id}/import-steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_tutorial_id: sourceTutorialId, step_ids: stepIds }),
    });
    if (!res.ok) throw new Error('Import failed');
    const { steps: imported } = await res.json();
    if (imported?.length) {
      setManualSteps(prev => [...prev, ...stepsToManualSteps(imported)]);
    }
  }, [id]);

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
            onClick={() => router.push('/home')}
            title="홈으로 돌아가기"
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
          {/* 모바일 전용: 목차 토글 버튼 */}
          <button
            className="editor-mobile-toc-btn"
            onClick={() => setMobileTocOpen(v => !v)}
            style={{ display: 'none', width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E5E7EB', background: mobileTocOpen ? '#e0e7ff' : 'white', alignItems: 'center', justifyContent: 'center', color: mobileTocOpen ? '#3730a3' : '#6B7280', cursor: 'pointer', flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
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
            {/* 미리보기 — 게시된 공개 뷰어 새 탭 */}
            {(() => {
              const shareToken = (tutorial as Tutorial & { share_token?: string | null })?.share_token;
              return (
                <button
                  onClick={() => { if (shareToken) window.open(`/play/${shareToken}`, '_blank'); }}
                  title={shareToken ? '공개 뷰어로 미리보기 (새 탭)' : '게시 후 미리보기 가능'}
                  disabled={!shareToken}
                  style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: shareToken ? '#374151' : '#D1D5DB', background: 'white', border: '1px solid #E5E7EB', cursor: shareToken ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (shareToken) e.currentTarget.style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
                >
                  <Eye size={TOP_BAR_ICON_SIZE} />
                  미리보기
                </button>
              );
            })()}

            {/* 댓글 패널 토글 — 팀 협업 의견 공유 */}
            <button
              onClick={() => { setShowComments(v => !v); setShowActivity(false); }}
              title="댓글 — 팀원과 의견 공유"
              style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: showComments ? '#4F46E5' : '#374151', background: showComments ? 'rgba(79,70,229,0.08)' : 'white', border: `1px solid ${showComments ? '#4F46E5' : '#E5E7EB'}`, cursor: 'pointer', transition: 'all 0.15s', fontWeight: showComments ? 600 : 400 }}
              onMouseEnter={e => { if (!showComments) e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { if (!showComments) e.currentTarget.style.background = 'white'; }}
            >
              <MessageSquare size={TOP_BAR_ICON_SIZE} />
              댓글
            </button>

            {/* 활동 로그 토글 */}
            <button
              onClick={() => { setShowActivity(v => !v); setShowComments(false); }}
              title="활동 로그 — 누가 무엇을 했는지"
              style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: showActivity ? '#4F46E5' : '#374151', background: showActivity ? 'rgba(79,70,229,0.08)' : 'white', border: `1px solid ${showActivity ? '#4F46E5' : '#E5E7EB'}`, cursor: 'pointer', transition: 'all 0.15s', fontWeight: showActivity ? 600 : 400 }}
              onMouseEnter={e => { if (!showActivity) e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { if (!showActivity) e.currentTarget.style.background = 'white'; }}
            >
              <Clock size={TOP_BAR_ICON_SIZE} />
              기록
            </button>

            {/* 다운로드 — PDF / PPTX / Word */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setDownloadOpen(o => !o)} disabled={!!downloadingFmt}
                title="다운로드 (PDF · PPTX · Word)"
                style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#374151', background: downloadOpen ? '#F3F4F6' : 'white', border: '1px solid #E5E7EB', cursor: downloadingFmt ? 'not-allowed' : 'pointer', opacity: downloadingFmt ? 0.6 : 1, transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!downloadingFmt && !downloadOpen) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { if (!downloadOpen) e.currentTarget.style.background = 'white'; }}>
                <Download size={TOP_BAR_ICON_SIZE} />
                {downloadingFmt ? '생성 중…' : '다운로드'}
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {downloadOpen && (
                <>
                  <div onClick={() => setDownloadOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{ position: 'absolute', top: '38px', right: 0, zIndex: 41, background: 'white', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '5px', minWidth: '180px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                    {([
                      { fmt: 'pdf' as const, label: 'PDF 문서', desc: '.pdf' },
                      { fmt: 'pptx' as const, label: 'PowerPoint', desc: '.pptx' },
                      { fmt: 'docx' as const, label: 'Word 문서', desc: '.docx' },
                    ]).map(opt => (
                      <button key={opt.fmt} onClick={() => handleDownload(opt.fmt)} disabled={!!downloadingFmt}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 10px', border: 'none', borderRadius: '6px', background: 'transparent', cursor: downloadingFmt ? 'not-allowed' : 'pointer', textAlign: 'left', fontSize: '12.5px', color: '#374151' }}
                        onMouseEnter={e => { if (!downloadingFmt) e.currentTarget.style.background = '#F3F4F6'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <Download size={15} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontWeight: 500 }}>{opt.label}</span>
                        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{downloadingFmt === opt.fmt ? '생성 중…' : opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 초대 — 이메일로 협업자 초대 */}
            <button
              onClick={() => setShowExport(true)}
              title="이메일로 협업자 초대"
              style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
            >
              <Share2 size={TOP_BAR_ICON_SIZE} />
              초대
            </button>

            <button
              onClick={handleUndo}
              disabled={!canUndo}
              title="실행 취소 (Ctrl+Z)"
              style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: canUndo ? '#374151' : '#D1D5DB', background: 'white', border: '1px solid #E5E7EB', cursor: canUndo ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (canUndo) e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
            >
              <Undo2 size={TOP_BAR_ICON_SIZE} /> 실행 취소
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              title="다시 실행 (Ctrl+Shift+Z)"
              style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: canRedo ? '#374151' : '#D1D5DB', background: 'white', border: '1px solid #E5E7EB', cursor: canRedo ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (canRedo) e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
            >
              <Redo2 size={TOP_BAR_ICON_SIZE} /> 다시 실행
            </button>

            {/* 공유 — 게시 후에만. ShareModal(링크 복사·공개범위·임베드) */}
            <button
              onClick={() => setShowShare(true)}
              disabled={tutorial.status !== 'published'}
              title={tutorial.status === 'published' ? '공유 링크·공개 범위 설정' : '게시 후 공유할 수 있어요'}
              style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: tutorial.status === 'published' ? '#374151' : '#D1D5DB', background: 'white', border: '1px solid #E5E7EB', cursor: tutorial.status === 'published' ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (tutorial.status === 'published') e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
            >
              <Link2 size={TOP_BAR_ICON_SIZE} /> 공유
            </button>

            {/* 게시 — 누르면 즉시 Publish. 게시되면 '게시됨' 표시(공유는 옆 버튼에서) */}
            {tutorial.status === 'published' ? (
              <span
                title="게시됨 — 공유는 '공유' 버튼에서, 게시 취소는 공유 창에서"
                style={{ height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#059669', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.35)' }}
              >
                <Check size={TOP_BAR_ICON_SIZE} /> 게시됨
              </span>
            ) : (
              <button
                onClick={async () => {
                  setPublishing(true);
                  try { await publish(); }
                  catch { alert('게시에 실패했습니다. 다시 시도해주세요.'); }
                  finally { setPublishing(false); }
                }}
                disabled={publishing}
                title="외부에 공유 가능한 상태로 게시합니다"
                style={{ height: '32px', padding: '0 16px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'white', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', border: 'none', cursor: publishing ? 'not-allowed' : 'pointer', boxShadow: '0 1px 6px rgba(55,48,163,0.3)', opacity: publishing ? 0.7 : 1, transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => { if (!publishing) e.currentTarget.style.boxShadow = '0 4px 14px rgba(55,48,163,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 6px rgba(55,48,163,0.3)'; }}
              >
                {publishing ? <Loader2 size={TOP_BAR_ICON_SIZE} style={{ animation: 'spin 1s linear infinite' }} /> : <Share2 size={TOP_BAR_ICON_SIZE} />}
                {publishing ? '게시 중…' : '게시'}
              </button>
            )}
          </>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {/* 모바일 TOC 오버레이 */}
        {mobileTocOpen && (
          <>
            <div onClick={() => setMobileTocOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
            <div style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: '80%', maxWidth: '300px', background: 'white', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '4px 0 24px rgba(0,0,0,0.18)', animation: 'drawerIn 0.22s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>목차</span>
                <button onClick={() => setMobileTocOpen(false)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: '#F3F4F6', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#6B7280' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <GuideToc
                  steps={manualSteps}
                  activeId={activeId}
                  onSelect={sid => { setActiveId(sid); setMobileTocOpen(false); }}
                  editable={true}
                  selectedIds={tocSelectedIds}
                  onSelectChange={setTocSelectedIds}
                  onReorder={(reordered) => { setManualStepsWithHistory(reordered); }}
                  onAdd={handleAddStep}
                  onDelete={handleDeleteStep}
                  onInsertAfter={handleInsertAfter}
                />
              </div>
            </div>
          </>
        )}

        {/* TOC panel — 데스크탑: 고정 / 모바일: 숨김 */}
        <div className="editor-toc-panel" style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #E5E7EB', background: 'white', minHeight: 0 }}>
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
                reorderSteps(id, dbItems).catch((e) => logError('step.reorder.fail', { tutorialId: id, message: e instanceof Error ? e.message : String(e) }));
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
              const next = manualSteps
                .filter(s => s.domainHostname !== hostname)
                .map((s, i) => ({ ...s, number: i + 1 }));
              setManualStepsWithHistory(next);
              if (toDelete.some(s => s.id === activeId)) setActiveId(next[0]?.id ?? null);
              toDelete
                .filter(s => !s.id.startsWith('step-'))
                .forEach(s => deleteStep(s.id).catch(e => logError('step.delete.fail', { tutorialId: id, stepId: s.id, message: e instanceof Error ? e.message : String(e) })));
            }}
            onClearDomain={(hostname) => {
              setManualSteps(prev => prev.map(s =>
                s.domainHostname === hostname
                  ? { ...s, domainHostname: null, domainName: null, domainFavicon: null }
                  : s
              ));
              manualSteps
                .filter(s => s.domainHostname === hostname && !s.id.startsWith('step-'))
                .forEach(s => updateStep(s.id, { domain_name: null, domain_hostname: null }).catch(e =>
                  logError('step.cleardomain.fail', { tutorialId: id, stepId: s.id, message: e instanceof Error ? e.message : String(e) })
                ));
            }}
          />
          {/* 다른 매뉴얼에서 불러오기 버튼 */}
          <div style={{ padding: '8px 10px', borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
            <button
              onClick={() => setShowMerge(true)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', fontSize: '11.5px', fontWeight: 500, color: '#6B7280', background: 'transparent', border: '1px dashed #D1D5DB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#a5b4fc'; e.currentTarget.style.color = '#3730a3'; e.currentTarget.style.background = '#EEF2FF'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
              다른 매뉴얼에서 불러오기
            </button>
          </div>
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
                flex: 1, fontSize: '20px', fontWeight: 600, color: '#111827',
                background: 'transparent', border: 'none', outline: 'none',
                fontFamily: 'inherit', cursor: 'text', minWidth: 0,
              }}
            />
            {/* 전체 색상 — 모든 스텝 어노테이션 일괄 재색 (편집 #4) */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setBulkColorOpen(v => !v)}
                title="모든 스텝의 강조 테두리·글자색을 한 번에 변경"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 10px', borderRadius: '6px', border: `1px solid ${bulkColorOpen ? '#6d28d9' : '#E5E7EB'}`, background: bulkColorOpen ? 'rgba(109,40,217,0.07)' : 'white', color: '#6d28d9', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
              >
                <Palette size={TOP_BAR_ICON_SIZE} /> 전체 색상
              </button>
              {bulkColorOpen && (
                <>
                  <div onClick={() => setBulkColorOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{ position: 'absolute', top: '34px', right: 0, zIndex: 41, background: 'white', border: '1px solid #E5E7EB', borderRadius: '10px', boxShadow: '0 8px 28px rgba(0,0,0,0.14)', padding: '12px', width: '224px' }}>
                    <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '7px' }}>강조 테두리 색 · 모든 스텝</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#111827'].map(c => (
                        <button key={c} onClick={() => recolorAllSteps('border', c)} style={{ width: '22px', height: '22px', borderRadius: '50%', background: c, border: '2px solid rgba(0,0,0,0.08)', cursor: 'pointer' }} />
                      ))}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '7px' }}>글자 색 · 모든 스텝</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {['#FFFFFF', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#111827'].map(c => (
                        <button key={c} onClick={() => recolorAllSteps('text', c)} style={{ width: '22px', height: '22px', borderRadius: '50%', background: c, border: c === '#FFFFFF' ? '1.5px solid #D1D5DB' : '2px solid rgba(0,0,0,0.08)', cursor: 'pointer' }} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={handleRefineAllText}
              disabled={refiningText}
              title="AI로 모든 스텝의 설명 문장을 매뉴얼 톤으로 다듬기"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0, height: '28px', padding: '0 10px', borderRadius: '6px', border: '1px solid #E5E7EB', background: 'white', color: '#6d28d9', fontSize: '12px', fontWeight: 500, cursor: refiningText ? 'not-allowed' : 'pointer', opacity: refiningText ? 0.65 : 1, transition: 'all 0.15s' }}
            >
              {refiningText ? <Loader2 size={TOP_BAR_ICON_SIZE} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={TOP_BAR_ICON_SIZE} />}
              전체 문장 다듬기
            </button>
            {/* TTS 설정 — 튜토리얼 단위 ON/OFF */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, borderLeft: '1px solid #F3F4F6', paddingLeft: '12px' }}>
              <button
                onClick={() => handleTtsToggle(!ttsEnabled)}
                title={ttsEnabled ? 'AI 음성 끄기' : 'AI 음성 켜기'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 10px', borderRadius: '6px', border: `1px solid ${ttsEnabled ? '#6d28d9' : '#E5E7EB'}`, background: ttsEnabled ? 'rgba(109,40,217,0.07)' : 'white', color: ttsEnabled ? '#6d28d9' : '#9CA3AF', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {ttsEnabled ? <Volume2 size={TOP_BAR_ICON_SIZE} /> : <VolumeX size={TOP_BAR_ICON_SIZE} />}
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
                    {ttsGenerating ? <Loader2 size={TOP_BAR_ICON_SIZE} style={{ animation: 'spin 1s linear infinite' }} /> : <Volume2 size={TOP_BAR_ICON_SIZE} />}
                    {ttsGenerating ? '생성 중…' : '전체 생성'}
                  </button>
                </>
              )}
            </div>
            {/* AI 자동 생성 진행 인디케이터 */}
            {autoGenProgress && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, fontSize: '11.5px', color: '#6d28d9' }}>
                <Loader2 size={TOP_BAR_ICON_SIZE} style={{ animation: 'spin 1s linear infinite' }} />
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
                  }).catch((e) => logError('step.autosave.fail', { tutorialId: id, stepId: step.id, message: e instanceof Error ? e.message : String(e) }));
                }, 600);
              });
            }}
            onDeleteStep={(stepId) => {
              // 카드 🗑️ / 다중선택 삭제도 DB에 반영 (onChange는 로컬 상태만 갱신)
              clearTimeout(stepSaveTimers.current[stepId]);
              if (stepId.startsWith('step-')) return; // 임시 ID는 아직 DB에 없음
              deleteStep(stepId).catch((e) => {
                logError('step.delete.fail', { tutorialId: id, stepId, message: e instanceof Error ? e.message : String(e) });
                alert('단계 삭제를 저장하지 못했습니다. 네트워크 연결을 확인 후 다시 시도해 주세요.');
              });
            }}
            onDuplicateStep={handleDuplicateStep}
            duplicatingStepId={duplicatingStepId}
            onInsertAfter={handleInsertAfter}
            onAddStep={handleAddStep}
            onAddComment={(stepId) => {
              setActiveId(stepId);
              setShowComments(true);
            }}
            onSave={(stepId, patch) => {
              if (stepId.startsWith('step-')) return;
              // 텍스트(제목/본문)를 함께 저장할 때만 진행 중인 텍스트 디바운스를 취소한다.
              // 어노테이션/줌/폰트 단독 저장은 다른 컬럼(부분 PATCH)이라, 텍스트 타이머를 죽이면
              // 입력 직후 600ms 안에 어노테이션을 만진 경우 미저장 텍스트가 유실된다.
              if (patch.actionTitle !== undefined || patch.description !== undefined) {
                clearTimeout(stepSaveTimers.current[stepId]);
              }
              updateStep(stepId, {
                ...(patch.actionTitle !== undefined ? { user_title: patch.actionTitle || null } : {}),
                ...(patch.titleFontSize !== undefined ? { title_font_size: patch.titleFontSize } : {}),
                ...(patch.followConfig !== undefined ? { follow_config: patch.followConfig } : {}),
                ...(patch.description !== undefined ? { user_script: patch.description || null } : {}),
                ...(patch.annotations !== undefined ? { user_annotations: patch.annotations } : {}),
                ...(patch.imageZoom !== undefined ? { image_zoom: patch.imageZoom } : {}),
                ...(patch.imageOffsetX !== undefined ? { image_offset_x: patch.imageOffsetX } : {}),
                ...(patch.imageOffsetY !== undefined ? { image_offset_y: patch.imageOffsetY } : {}),
              }).catch((e) => logError('step.save.fail', { tutorialId: id, stepId, message: e instanceof Error ? e.message : String(e) }));
            }}
          />
          {showComments && (
            <CommentsPanel
              tutorialId={id}
              activeStepId={activeId}
              steps={manualSteps.map(s => ({ id: s.id, number: s.number }))}
              currentUserId={user?.id ?? null}
              onClose={() => setShowComments(false)}
              onJumpToStep={(stepId) => setActiveId(stepId)}
            />
          )}
          {showActivity && (
            <ActivityPanel
              tutorialId={id}
              onClose={() => setShowActivity(false)}
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

      {showMerge && (
        <MergeModal
          currentTutorialId={id}
          onImport={handleImportSteps}
          onClose={() => setShowMerge(false)}
        />
      )}
      {showExport && (
        <ExportModal
          tutorialId={id}
          title={title}
          onClose={() => setShowExport(false)}
        />
      )}
      {showShare && tutorial && (
        <ShareModal
          title={title}
          shareToken={(tutorial as Tutorial & { share_token?: string | null }).share_token ?? null}
          shareUrl={(tutorial as Tutorial & { share_token?: string | null }).share_token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/play/${(tutorial as Tutorial & { share_token?: string | null }).share_token}` : null}
          tutorialId={id}
          hasPassword={!!(tutorial as Tutorial & { share_password?: string | null }).share_password}
          visibility={(tutorial as Tutorial & { visibility?: 'private' | 'public' }).visibility}
          onPublishAndShare={publish}
          onUnpublish={unpublish}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* 스텝 삭제 확인 모달 (GuideToc 경로) */}
      {pendingDeleteId && (() => {
        const step = manualSteps.find(s => s.id === pendingDeleteId);
        const hasGuide = hasGuideConfig(step?.followConfig);
        return (
          <div
            onClick={() => setPendingDeleteId(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(10,10,18,0.50)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: '20px' }}
          >
            <div onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '360px', background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.28)' }}
            >
              <div style={{ marginBottom: '6px', fontSize: '16px', fontWeight: 700, color: '#111827' }}>단계 삭제</div>
              {step && (
                <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(step.number).padStart(2, '0')}. {step.actionTitle || '(제목 없음)'}
                </div>
              )}
              {hasGuide && (
                <div style={{ fontSize: '12.5px', color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '9px 11px', lineHeight: 1.55, marginBottom: '10px' }}>
                  이 스텝의 <b>연습 가이드·Live Guide 설정</b>(핫스팟·말풍선·입력 텍스트 등)도 함께 삭제됩니다.
                </div>
              )}
              <div style={{ fontSize: '12.5px', color: '#9CA3AF', lineHeight: 1.6, marginBottom: '20px' }}>
                삭제 후 상단 <b>실행 취소</b>(Ctrl+Z)로 되돌릴 수 있어요.
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setPendingDeleteId(null)}
                  style={{ flex: 1, height: '40px', borderRadius: '10px', border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontSize: '13.5px', fontWeight: 500, cursor: 'pointer' }}>
                  취소
                </button>
                <button onClick={() => performDeleteStep(pendingDeleteId!)}
                  style={{ flex: 1, height: '40px', borderRadius: '10px', border: 'none', background: '#EF4444', color: 'white', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}>
                  삭제
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 챗봇 — 항상 떠있는 도우미 (우하단 고정, 다른 UI와 비겹침) */}
      <AgentChat />
    </div>
  );
}
