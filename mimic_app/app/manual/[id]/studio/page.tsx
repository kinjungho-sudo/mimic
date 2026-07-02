'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Check, Loader2, MousePointerClick, Type, Ban, RotateCcw, EyeOff, Eye, GripVertical, ZoomIn, ImagePlus, PenTool, Volume2, VolumeX } from 'lucide-react';
import { useTutorial } from '@/hooks/useTutorial';
import { updateStep, reorderSteps } from '@/lib/api/steps';
import { clickToPct, inferKind, toFollowSteps } from '@/lib/follow';
import { resolveStepAudio } from '@/lib/voice/playback';
import { InteractiveFollowPlayer } from '@/components/viewer/InteractiveFollowPlayer';
import { FollowStage } from '@/components/viewer/FollowStage';
import { ImageAnnotationEditor, type Annotation } from '@/components/editor/ImageAnnotationEditor';
import { logError } from '@/lib/logging/logger';
import type { Step, Tutorial, FollowConfig } from '@/types';

const TOP_BAR_ICON_SIZE = 14;

// DB Step → 스튜디오 편집 단위
type StudioStep = {
  id: string;
  number: number;
  screenshotUrl: string | null;
  pageUrl: string | null;
  title: string;             // user_title (편집) — 문서 매뉴얼과 공유. ai_title 폴백으로 초기화
  description: string;       // user_script (편집, HTML 제거) — 문서 매뉴얼과 공유
  clickXPct: number | null;  // 녹화 좌표 (0~100)
  clickYPct: number | null;
  stepType: string | null;
  annotations: Annotation[];
  voiceAudioUrl: string | null;
  voiceAudioStartMs: number | null;
  voiceAudioEndMs: number | null;
  domRect: { x: number; y: number; w: number; h: number } | null; // DOM 요소 영역(0~100 pct) — 확대 애니메이션 중심
  follow: FollowConfig;      // 따라하기 전용 시각 설정 (핫스팟·종류·숨김·typeText)
};

type StudioAudioAsset = {
  id?: string;
  step_id: string;
  audio_url: string;
  duration_ms?: number | null;
  script_text?: string | null;
};

function toStudioStep(s: Step): StudioStep {
  return {
    id: s.id,
    number: s.step_number,
    screenshotUrl: s.screenshot_url || null,
    pageUrl: s.page_url ?? null,
    title: s.user_title || s.ai_title || '',
    description: (s.user_script || s.ai_description || '').replace(/<[^>]+>/g, ''),
    clickXPct: clickToPct((s as Step & { click_x?: number | null }).click_x),
    clickYPct: clickToPct((s as Step & { click_y?: number | null }).click_y),
    stepType: s.step_type ?? null,
    annotations: (s.user_annotations as Annotation[] | null) ?? [],
    voiceAudioUrl: s.voice_audio_url ?? null,
    voiceAudioStartMs: s.voice_audio_start_ms ?? null,
    voiceAudioEndMs: s.voice_audio_end_ms ?? null,
    domRect: (() => {
      const raw = (s as Step & { element_rect?: { x?: number; y?: number; width?: number; height?: number } | null }).element_rect;
      if (!raw || raw.x == null) return null;
      return { x: (raw.x ?? 0) * 100, y: (raw.y ?? 0) * 100, w: (raw.width ?? 0) * 100, h: (raw.height ?? 0) * 100 };
    })(),
    follow: (s.follow_config as FollowConfig) ?? {},
  };
}

// 저작값 + 자동추론을 합쳐 현재 적용되는 핫스팟/종류 계산 (캔버스 표시용)
// none = 인디케이터 미표시 → 핫스팟 null
function resolved(s: StudioStep) {
  const rk = s.follow.kind ?? inferKind(s.title, s.description);
  const none = rk === 'none';
  return {
    hotspotX: none ? null : (s.follow.hotspotX != null ? s.follow.hotspotX : s.clickXPct),
    hotspotY: none ? null : (s.follow.hotspotY != null ? s.follow.hotspotY : s.clickYPct),
    kind: (none ? 'click' : rk) as 'click' | 'type',
    userPlaced: s.follow.hotspotX != null,  // 직접 찍은 좌표 — 좌상단도 표시 유지
    none,
  };
}

// 빈 필드 제거 → 전부 비면 null (DB 깨끗하게)
function normalize(fc: FollowConfig): FollowConfig | null {
  const clean: FollowConfig = {};
  if (fc.hotspotX != null) clean.hotspotX = fc.hotspotX;
  if (fc.hotspotY != null) clean.hotspotY = fc.hotspotY;
  if (fc.kind) clean.kind = fc.kind;
  if (fc.typeText && fc.typeText.trim()) clean.typeText = fc.typeText.trim();
  if (fc.hidden) clean.hidden = true;
  if (fc.bubbleAnchor) clean.bubbleAnchor = fc.bubbleAnchor;
  if (fc.zoomAnim) clean.zoomAnim = true;
  return Object.keys(clean).length ? clean : null;
}

type BubbleAnchorKey = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null;
const BUBBLE_OPTS: { key: BubbleAnchorKey; label: string; icon: string }[] = [
  { key: null,           label: '자동',   icon: '↔' },
  { key: 'bottom-right', label: '우하단', icon: '↘' },
];

export default function StudioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tutorial, loading, error, publish } = useTutorial(id);

  const [steps, setSteps] = useState<StudioStep[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsVoice, setTtsVoice] = useState<'nova' | 'alloy'>('nova');
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const [audioAssets, setAudioAssets] = useState<StudioAudioAsset[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [uploadingStepId, setUploadingStepId] = useState<string | null>(null);
  const [annotatingId, setAnnotatingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const contentTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dragIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  // 최신 steps 미러 — patch에서 동기적으로 현재 follow를 읽기 위함(setState 캡처는 비동기라 stale)
  const stepsRef = useRef<StudioStep[]>([]);
  stepsRef.current = steps;

  const isViewer = tutorial ? (tutorial as Tutorial & { my_role?: string }).my_role === 'viewer' : false;

  useEffect(() => {
    if (!tutorial) return;
    const ss = tutorial.steps.map(toStudioStep);
    setSteps(ss);
    setAudioAssets((tutorial.audio_assets ?? []) as StudioAudioAsset[]);
    setTtsEnabled((tutorial as Tutorial & { tts_enabled?: boolean }).tts_enabled ?? false);
    setTtsVoice(((tutorial as Tutorial & { tts_voice?: string }).tts_voice as 'nova' | 'alloy') ?? 'nova');
    setActiveId(prev => prev ?? ss[0]?.id ?? null);
  }, [tutorial]);


  const active = steps.find(s => s.id === activeId) ?? null;

  // follow_config 패치 → 로컬 갱신 + 서버 저장
  const patch = useCallback(async (stepId: string, change: Partial<FollowConfig>) => {
    const cur = stepsRef.current.find(s => s.id === stepId)?.follow ?? {};
    const nextFollow: FollowConfig = { ...cur, ...change };
    stepsRef.current = stepsRef.current.map(s => s.id === stepId ? { ...s, follow: nextFollow } : s);
    setSteps(stepsRef.current);
    const payload = normalize(nextFollow);
    setSavingId(stepId);
    try {
      await updateStep(stepId, { follow_config: payload });
      setSavedTick(t => t + 1);
    } catch (e) {
      logError('studio.save.fail', { stepId, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setSavingId(s => (s === stepId ? null : s));
    }
  }, []);

  // 제목/설명 편집 → 로컬 즉시 반영(실시간 WYSIWYG 동기화) + 디바운스 저장.
  // user_title/user_script(문서 매뉴얼과 공유 컬럼)에 직접 저장.
  const setContent = useCallback((stepId: string, field: 'title' | 'description', value: string) => {
    stepsRef.current = stepsRef.current.map(s => s.id === stepId ? { ...s, [field]: value } : s);
    setSteps(stepsRef.current);
    const col = field === 'title' ? 'user_title' : 'user_script';
    const key = stepId + col;
    clearTimeout(contentTimers.current[key]);
    contentTimers.current[key] = setTimeout(async () => {
      setSavingId(stepId);
      try {
        await updateStep(stepId, { [col]: value });
        setSavedTick(t => t + 1);
      } catch (e) {
        logError('studio.content.fail', { stepId, message: e instanceof Error ? e.message : String(e) });
      } finally {
        setSavingId(s => (s === stepId ? null : s));
      }
    }, 600);
  }, []);

  // 드래그앤드롭 순서 변경 → order_index 영속(문서 매뉴얼·따라하기 동시 반영)
  const reorder = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    const arr = [...stepsRef.current];
    const from = arr.findIndex(s => s.id === fromId);
    const to = arr.findIndex(s => s.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    stepsRef.current = arr;
    setSteps(arr);
    reorderSteps(id, arr.map((s, i) => ({ id: s.id, order_index: i })))
      .catch(e => logError('studio.reorder.fail', { tutorialId: id, message: e instanceof Error ? e.message : String(e) }));
  }, [id]);

  // 입력 텍스트(typeText) 편집 → 로컬 즉시 반영 + 디바운스 저장 (키 입력마다 저장 방지)
  const setTypeText = useCallback((stepId: string, value: string) => {
    stepsRef.current = stepsRef.current.map(s => s.id === stepId ? { ...s, follow: { ...s.follow, typeText: value } } : s);
    setSteps(stepsRef.current);
    const key = stepId + 'typeText';
    clearTimeout(contentTimers.current[key]);
    contentTimers.current[key] = setTimeout(async () => {
      const fc = stepsRef.current.find(s => s.id === stepId)?.follow ?? {};
      setSavingId(stepId);
      try {
        await updateStep(stepId, { follow_config: normalize(fc) });
        setSavedTick(t => t + 1);
      } catch (e) {
        logError('studio.typetext.fail', { stepId, message: e instanceof Error ? e.message : String(e) });
      } finally {
        setSavingId(s => (s === stepId ? null : s));
      }
    }, 600);
  }, []);

  // 이미지 클릭/드래그 → 핫스팟 위치 지정
  const saveTtsSetting = useCallback(async (enabled: boolean, voice: 'nova' | 'alloy') => {
    await fetch(`/api/tutorials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tts_enabled: enabled, tts_voice: voice }),
    });
  }, [id]);

  const handleTtsToggle = useCallback(async (enabled: boolean) => {
    setTtsEnabled(enabled);
    await saveTtsSetting(enabled, ttsVoice);
  }, [saveTtsSetting, ttsVoice]);

  const handleTtsVoiceChange = useCallback(async (voice: 'nova' | 'alloy') => {
    setTtsVoice(voice);
    await saveTtsSetting(ttsEnabled, voice);
  }, [saveTtsSetting, ttsEnabled]);

  const handleGenerateAllTts = useCallback(async () => {
    const targets = stepsRef.current.filter(s => !s.follow.hidden && s.description.trim());
    if (!targets.length) return;
    setTtsGenerating(true);
    try {
      const results = await Promise.all(targets.map(async s => {
        const scriptText = s.description.trim();
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepId: s.id, scriptText, voice: ttsVoice }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return {
          step_id: s.id,
          audio_url: data.audio_url as string,
          duration_ms: data.duration_ms as number | null,
          script_text: scriptText,
        };
      }));
      const next = new Map(audioAssets.map(asset => [asset.step_id, asset]));
      for (const asset of results) {
        if (asset) next.set(asset.step_id, asset);
      }
      setAudioAssets(Array.from(next.values()));
    } finally {
      setTtsGenerating(false);
    }
  }, [audioAssets, ttsVoice]);

  const uploadManualCapture = useCallback(async (file: File) => {
    const target = active;
    if (!target) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploadingStepId(target.id);
    try {
      const res = await fetch(`/api/steps/${target.id}/image`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const nextFollow: FollowConfig = { ...target.follow, kind: 'none' };
      stepsRef.current = stepsRef.current.map(s => s.id === target.id
        ? { ...s, screenshotUrl: data.screenshot_url, stepType: data.step_type ?? 'visual_overlay_step', clickXPct: null, clickYPct: null, domRect: null, follow: nextFollow }
        : s);
      setSteps(stepsRef.current);
      setSavedTick(t => t + 1);
    } catch (e) {
      logError('studio.manualCapture.fail', { stepId: target.id, message: e instanceof Error ? e.message : String(e) });
      alert('수동 캡처 이미지를 저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setUploadingStepId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [active]);

  const saveAnnotations = useCallback(async (stepId: string, annotations: Annotation[]) => {
    const current = stepsRef.current.find(s => s.id === stepId);
    const nextFollow = { ...(current?.follow ?? {}), kind: 'none' as const };
    stepsRef.current = stepsRef.current.map(s => s.id === stepId ? { ...s, annotations, follow: nextFollow, stepType: s.stepType ?? 'visual_overlay_step' } : s);
    setSteps(stepsRef.current);
    setSavingId(stepId);
    try {
      await updateStep(stepId, { user_annotations: annotations, follow_config: normalize(nextFollow) });
      setSavedTick(t => t + 1);
    } catch (e) {
      logError('studio.annotations.fail', { stepId, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setSavingId(s => (s === stepId ? null : s));
    }
  }, []);

  const placeHotspot = useCallback((clientX: number, clientY: number, commit: boolean) => {
    const el = imgWrapRef.current;
    if (!el || !active) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100));
    const rounded = { hotspotX: Math.round(x * 10) / 10, hotspotY: Math.round(y * 10) / 10 };
    if (commit) {
      patch(active.id, rounded);
    } else {
      setSteps(prev => prev.map(s => s.id === active.id ? { ...s, follow: { ...s.follow, ...rounded } } : s));
    }
  }, [active, patch]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => { if (draggingRef.current) placeHotspot(e.clientX, e.clientY, false); };
    const onUp = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      placeHotspot(e.clientX, e.clientY, true);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [placeHotspot]);

  const previewSteps = useMemo(() => toFollowSteps(steps.map(s => {
    const audio = resolveStepAudio({
      id: s.id,
      user_script: s.description,
      voice_audio_url: s.voiceAudioUrl,
      voice_audio_start_ms: s.voiceAudioStartMs,
      voice_audio_end_ms: s.voiceAudioEndMs,
    }, audioAssets, ttsEnabled);
    return {
      title: s.title,
      body: s.description || null,
      screenshotUrl: s.screenshotUrl || undefined,
      clickXPct: s.clickXPct,
      clickYPct: s.clickYPct,
      audioUrl: audio?.url ?? null,
      audioStartMs: audio?.startMs ?? null,
      audioEndMs: audio?.endMs ?? null,
      followConfig: s.follow,
      stepType: s.stepType,
      annotations: s.annotations,
      domRect: s.domRect,
    };
  })), [audioAssets, steps, ttsEnabled]);

  const ensurePublished = useCallback(async () => {
    const existing = (tutorial as Tutorial & { share_token?: string | null } | null)?.share_token;
    if (existing) return existing;
    setPublishing(true);
    try {
      const result = await publish();
      return result.share_token;
    } finally {
      setPublishing(false);
    }
  }, [publish, tutorial]);

  const handleOpenPracticeGuide = useCallback(async () => {
    setPublishing(true);
    try {
      const token = await ensurePublished();
      window.open(`/play/${token}?mode=practice`, '_blank', 'noopener,noreferrer');
    } catch {
      alert('연습 가이드를 열지 못했습니다. 다시 시도해주세요.');
    } finally {
      setPublishing(false);
    }
  }, [ensurePublished]);

  if (loading) {
    return <div style={pageBg}><div style={{ color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 10 }}><Loader2 size={18} className="spin" /> 불러오는 중…</div><Styles /></div>;
  }
  if (error || !tutorial) {
    return <div style={pageBg}><div style={{ color: 'rgba(255,255,255,0.7)' }}>매뉴얼을 불러올 수 없습니다.</div></div>;
  }
  if (isViewer) {
    return (
      <div style={pageBg}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <p style={{ marginBottom: 14 }}>이 매뉴얼을 편집할 권한이 없습니다.</p>
          <button onClick={() => router.push(`/manual/${id}`)} style={primaryBtn}>매뉴얼로 돌아가기</button>
        </div>
      </div>
    );
  }

  const rv = active ? resolved(active) : null;
  const hidden = !!active?.follow.hidden;
  const zoomAnim = !!active?.follow.zoomAnim;
  const curKind = active?.follow.kind ?? null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0A0A0F', display: 'flex', flexDirection: 'column', fontFamily: "'Pretendard', -apple-system, sans-serif", color: 'white', overflow: 'hidden' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) uploadManualCapture(file);
        }}
      />
      {/* Header */}
      <header style={{ flexShrink: 0, height: 56, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(10,10,15,0.9)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <button onClick={() => router.push(`/manual/${id}/editor`)} style={ghostBtn} title="편집기로 돌아가기"><ArrowLeft size={TOP_BAR_ICON_SIZE} /></button>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>연습 가이드 편집</span>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tutorial.title}</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {savingId ? <><Loader2 size={TOP_BAR_ICON_SIZE} className="spin" /> 저장 중…</> : savedTick > 0 ? <><Check size={TOP_BAR_ICON_SIZE} color="#34d399" /> 저장됨</> : null}
        </span>
        <button onClick={() => setShowPreview(true)} title="연습 가이드(웹) 화면으로 미리보기 — 핫스팟·말풍선·입력 텍스트 설정을 확인합니다. 실제 Live Guide 오버레이 외형과는 다를 수 있어요." style={{ ...ghostBtn, width: 'auto', padding: '0 12px', gap: 6, display: 'inline-flex', alignItems: 'center', fontSize: 12.5 }}><Play size={TOP_BAR_ICON_SIZE} /> 연습 가이드 미리보기</button>
        <button onClick={handleOpenPracticeGuide} disabled={publishing} title="고객에게 전달되는 연습 가이드 실행 화면을 새 탭에서 엽니다" style={{ ...ghostBtn, width: 'auto', padding: '0 12px', gap: 6, display: 'inline-flex', alignItems: 'center', fontSize: 12.5, opacity: publishing ? 0.6 : 1 }}>
          {publishing ? <Loader2 size={TOP_BAR_ICON_SIZE} className="spin" /> : <Play size={TOP_BAR_ICON_SIZE} />} 연습 가이드 실행
        </button>
        {tutorial.status === 'published' ? (
          <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', color: '#34d399', fontWeight: 600, border: '1px solid rgba(52,211,153,0.25)', flexShrink: 0 }}>게시됨</span>
        ) : (
          <button
            onClick={async () => {
              setPublishing(true);
              try { await publish(); } catch { alert('게시에 실패했습니다. 다시 시도해주세요.'); }
              finally { setPublishing(false); }
            }}
            disabled={publishing}
            style={{ ...ghostBtn, width: 'auto', padding: '0 12px', gap: 6, display: 'inline-flex', alignItems: 'center', fontSize: 12.5, opacity: publishing ? 0.6 : 1 }}>
            {publishing ? <><Loader2 size={TOP_BAR_ICON_SIZE} className="spin" /> 게시 중…</> : '게시'}
          </button>
        )}
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 좌측 스텝 리스트 — 드래그앤드롭으로 순서 변경 */}
        <aside style={{ width: 220, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto', padding: '10px 8px' }}>
          {steps.map((s, i) => {
            const sel = s.id === activeId;
            const r = resolved(s);
            const hasHot = r.hotspotX != null && r.hotspotY != null;
            const isDragOver = dragOverId === s.id;
            return (
              <div key={s.id}
                draggable
                onDragStart={e => { dragIdRef.current = s.id; e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={e => { e.preventDefault(); if (dragOverId !== s.id) setDragOverId(s.id); }}
                onDragLeave={() => { if (dragOverId === s.id) setDragOverId(null); }}
                onDrop={e => { e.preventDefault(); if (dragIdRef.current) reorder(dragIdRef.current, s.id); dragIdRef.current = null; setDragOverId(null); }}
                onDragEnd={() => { dragIdRef.current = null; setDragOverId(null); }}
                onClick={() => setActiveId(s.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 7px', marginBottom: 4, borderRadius: 9, border: '1px solid ' + (isDragOver ? '#7c3aed' : sel ? 'rgba(124,58,237,0.6)' : 'transparent'), background: sel ? 'rgba(124,58,237,0.16)' : isDragOver ? 'rgba(124,58,237,0.08)' : 'transparent', color: 'white', cursor: 'pointer', opacity: s.follow.hidden ? 0.5 : 1 }}>
                <GripVertical size={13} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0, cursor: 'grab' }} />
                <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 6, background: sel ? '#7c3aed' : 'rgba(255,255,255,0.1)', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'rgba(255,255,255,0.85)' }}>
                  {s.title || '(제목 없음)'}
                </span>
                {s.follow.hidden
                  ? <EyeOff size={12} color="rgba(255,255,255,0.4)" />
                  : <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: hasHot ? (r.kind === 'type' ? '#60a5fa' : '#34d399') : 'rgba(255,255,255,0.25)' }} />}
              </div>
            );
          })}
        </aside>

        {/* 중앙 캔버스 — 플레이어와 동일한 FollowStage로 실제 보일 모습 그대로 표시(WYSIWYG) */}
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#070709' }}>
          {!active ? (
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>스텝을 선택하세요</span>
          ) : !active.screenshotUrl ? (
            <div style={{ width: 'min(460px, 100%)', border: '1px dashed rgba(167,139,250,0.45)', background: 'rgba(124,58,237,0.08)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
              <ImagePlus size={34} color="#c4b5fd" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 7 }}>수동 캡처가 필요한 단계</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.62)', lineHeight: 1.6, marginBottom: 16 }}>
                보안 화면이나 제한된 페이지는 이미지를 직접 추가한 뒤 Visual Overlay로 안내를 완성할 수 있습니다.
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingStepId === active.id}
                style={{ ...primaryBtn, height: 36, display: 'inline-flex', alignItems: 'center', gap: 7, opacity: uploadingStepId === active.id ? 0.65 : 1 }}
              >
                {uploadingStepId === active.id ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />} 이미지 추가
              </button>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative', lineHeight: 0, boxShadow: '0 12px 50px rgba(0,0,0,0.5)', filter: hidden ? 'grayscale(0.75) brightness(0.5)' : 'none' }}>
                <FollowStage
                  screenshotUrl={active.screenshotUrl}
                  hotspotX={rv?.hotspotX ?? null}
                  hotspotY={rv?.hotspotY ?? null}
                  allowCornerHotspot={rv?.userPlaced}
                  kind={rv?.kind ?? 'click'}
                  typeText={active.follow.typeText}
                  guideMode={rv?.none ? 'explanation' : 'interactive'}
                  annotations={active.annotations}
                  bubbleAnchor={active.follow.bubbleAnchor}
                  stepNumber={steps.findIndex(s => s.id === active.id) + 1}
                  title={active.title}
                  body={active.description || undefined}
                  imageCursor="crosshair"
                  imgMaxHeight="calc(100vh - 170px)"
                  wrapRef={imgWrapRef}
                  onImageClick={e => placeHotspot(e.clientX, e.clientY, true)}
                  onMascotClick={e => e.stopPropagation()}
                  onBubbleClick={e => e.stopPropagation()}
                >
                  {/* 드래그 핸들 — 실제 인디케이터 위에 투명 링(WYSIWYG 유지) */}
                  {rv && rv.hotspotX != null && rv.hotspotY != null && (
                    <div
                      onPointerDown={e => { e.stopPropagation(); draggingRef.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
                      title="드래그해 위치 이동"
                      style={{ position: 'absolute', left: `${rv.hotspotX}%`, top: `${rv.hotspotY}%`, transform: 'translate(-50%,-50%)', width: 42, height: 42, borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.65)', background: 'rgba(0,0,0,0.1)', cursor: 'grab', zIndex: 7, pointerEvents: 'auto' }}
                    />
                  )}
                </FollowStage>
              </div>
              <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>
                {hidden ? '숨김 처리된 스텝 — 연습 가이드에 노출되지 않습니다'
                  : rv?.none ? '인디케이터 없음 — 핫스팟을 표시하지 않고 ‘다음’으로만 진행합니다'
                  : '이미지를 클릭하거나 링을 드래그해 핫스팟 위치를 지정하세요'}
              </p>
            </>
          )}
        </main>

        {/* 우측 속성 패널 */}
        <aside style={{ width: 280, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto', padding: 18 }}>
          {!active ? null : (
            <>
              <SectionLabel>스텝 {steps.findIndex(s => s.id === active.id) + 1} · 내용</SectionLabel>
              <input
                value={active.title}
                onChange={e => setContent(active.id, 'title', e.target.value)}
                placeholder="스텝 제목"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', outline: 'none', marginBottom: 8 }}
              />
              <textarea
                value={active.description}
                onChange={e => setContent(active.id, 'description', e.target.value)}
                placeholder="이 단계 설명 (말풍선에 표시)"
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 12.5, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
              />
              <p style={hint}>제목·설명은 문서 매뉴얼과 함께 수정됩니다 — 입력하면 위 미리보기에 바로 반영돼요.</p>

              <Divider />

              <SectionLabel>AI 음성</SectionLabel>
              <div style={{ display: 'grid', gap: 8 }}>
                <button
                  onClick={() => handleTtsToggle(!ttsEnabled)}
                  style={{ ...subtleBtn, justifyContent: 'space-between' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    {ttsEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
                    {ttsEnabled ? '연습 가이드 음성 켜짐' : '연습 가이드 음성 꺼짐'}
                  </span>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: ttsEnabled ? '#7c3aed' : 'rgba(255,255,255,0.1)' }}>
                    {ttsEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>
                {ttsEnabled && (
                  <>
                    <select
                      value={ttsVoice}
                      onChange={e => handleTtsVoiceChange(e.target.value as 'nova' | 'alloy')}
                      style={{ width: '100%', height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: '#14121c', color: 'white', padding: '0 10px', fontSize: 12 }}
                    >
                      <option value="nova">Nova</option>
                      <option value="alloy">Alloy</option>
                    </select>
                    <button
                      onClick={handleGenerateAllTts}
                      disabled={ttsGenerating}
                      style={{ ...subtleBtn, opacity: ttsGenerating ? 0.65 : 1 }}
                    >
                      {ttsGenerating ? <Loader2 size={12} className="spin" /> : <Volume2 size={12} />}
                      스텝 설명으로 음성 생성
                    </button>
                  </>
                )}
              </div>
              <p style={hint}>각 스텝 설명에 작성한 문장을 읽어줍니다. 음성은 연습 가이드와 Live Guide에서만 사용되고, 문서/슬라이드 매뉴얼에서는 재생되지 않습니다.</p>

              <Divider />

              <SectionLabel>Visual Overlay</SectionLabel>
              <div style={{ display: 'grid', gap: 8 }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingStepId === active.id}
                  style={{ ...subtleBtn, opacity: uploadingStepId === active.id ? 0.65 : 1 }}
                >
                  {uploadingStepId === active.id ? <Loader2 size={12} className="spin" /> : <ImagePlus size={12} />} {active.screenshotUrl ? '이미지 교체' : '이미지 추가'}
                </button>
                <button
                  onClick={() => active.screenshotUrl && setAnnotatingId(active.id)}
                  disabled={!active.screenshotUrl}
                  style={{ ...subtleBtn, opacity: active.screenshotUrl ? 1 : 0.45, cursor: active.screenshotUrl ? 'pointer' : 'not-allowed' }}
                >
                  <PenTool size={12} /> Overlay 편집
                </button>
              </div>
              <p style={hint}>DOM과 연결되지 않는 Rectangle, Circle, Spotlight, Arrow, Tooltip을 이미지 위에 배치합니다.</p>

              <Divider />

              {/* 표시/숨김 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  {hidden ? <EyeOff size={14} /> : <Eye size={14} />} 연습 가이드에 표시
                </span>
                <button onClick={() => patch(active.id, { hidden: !hidden })} title="표시/숨김"
                  style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: hidden ? 'rgba(255,255,255,0.15)' : '#7c3aed', position: 'relative', transition: 'background 0.15s' }}>
                  <span style={{ position: 'absolute', top: 2, left: hidden ? 2 : 20, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.15s' }} />
                </button>
              </div>

              {/* 확대 애니메이션 — 켜면 연습 가이드에서 클릭 영역을 천천히 확대(기본 off) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', opacity: hidden ? 0.4 : 1 }}>
                <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <ZoomIn size={14} /> 확대 애니메이션
                </span>
                <button disabled={hidden} onClick={() => patch(active.id, { zoomAnim: !zoomAnim })} title="연습 가이드에서 클릭 영역 확대"
                  style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: hidden ? 'not-allowed' : 'pointer', background: zoomAnim ? '#7c3aed' : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'background 0.15s' }}>
                  <span style={{ position: 'absolute', top: 2, left: zoomAnim ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.15s' }} />
                </button>
              </div>

              <Divider />

              {/* 종류 */}
              <SectionLabel>인디케이터 종류</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {([
                  { key: null, label: '자동', icon: null },
                  { key: 'click', label: '클릭', icon: <MousePointerClick size={13} /> },
                  { key: 'type', label: '텍스트', icon: <Type size={13} /> },
                  { key: 'none', label: '없음', icon: <Ban size={13} /> },
                ] as { key: 'click' | 'type' | 'none' | null; label: string; icon: React.ReactNode }[]).map(opt => {
                  const sel = curKind === opt.key;
                  return (
                    <button key={String(opt.key)} disabled={hidden} onClick={() => patch(active.id, { kind: opt.key })}
                      style={{ height: 34, borderRadius: 8, border: '1px solid ' + (sel ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.12)'), background: sel ? 'rgba(124,58,237,0.2)' : 'transparent', color: sel ? 'white' : 'rgba(255,255,255,0.6)', fontSize: 11.5, fontWeight: 600, cursor: hidden ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: hidden ? 0.5 : 1 }}>
                      {opt.icon}{opt.label}
                    </button>
                  );
                })}
              </div>
              <p style={hint}>
                {curKind === 'none'
                  ? '핫스팟·인디케이터를 숨기고 ‘다음’으로만 진행합니다.'
                  : `‘자동’은 제목으로 추론합니다${curKind == null && rv ? ` (현재: ${rv.kind === 'type' ? '텍스트' : '클릭'})` : ''}.`}
              </p>

              <Divider />

              {/* 핫스팟 */}
              <SectionLabel>핫스팟 위치</SectionLabel>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                {rv?.none
                  ? <span style={{ color: 'rgba(255,255,255,0.4)' }}>인디케이터 ‘없음’ — 핫스팟 미표시</span>
                  : rv && rv.hotspotX != null
                  ? <>X {rv.hotspotX.toFixed(1)}% · Y {rv.hotspotY!.toFixed(1)}% {active.follow.hotspotX != null ? <span style={{ color: '#a78bfa' }}>(수정됨)</span> : <span style={{ color: 'rgba(255,255,255,0.4)' }}>(녹화값)</span>}</>
                  : <span style={{ color: 'rgba(255,255,255,0.4)' }}>지정 안 됨 — 이미지를 클릭하세요</span>}
              </div>
              <button disabled={hidden || active.follow.hotspotX == null} onClick={() => patch(active.id, { hotspotX: null, hotspotY: null })}
                style={{ ...subtleBtn, opacity: (hidden || active.follow.hotspotX == null) ? 0.4 : 1, cursor: (hidden || active.follow.hotspotX == null) ? 'not-allowed' : 'pointer' }}>
                <RotateCcw size={12} /> 녹화 위치로 초기화
              </button>

              <Divider />

              {/* 말풍선 위치 */}
              <SectionLabel>말풍선 위치</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                {BUBBLE_OPTS.map(opt => {
                  const sel = (active.follow.bubbleAnchor ?? null) === opt.key;
                  return (
                    <button key={String(opt.key)} disabled={hidden} onClick={() => patch(active.id, { bubbleAnchor: opt.key })}
                      style={{ height: 34, borderRadius: 7, border: '1px solid ' + (sel ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.1)'), background: sel ? 'rgba(124,58,237,0.22)' : 'transparent', color: sel ? 'white' : 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, cursor: hidden ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, opacity: hidden ? 0.4 : 1, lineHeight: 1.2 }}>
                      <span style={{ fontSize: 14 }}>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <p style={hint}>말풍선이 항상 지정 위치에 나타납니다.</p>

              {/* 입력 텍스트 — 텍스트 인디케이터일 때만 */}
              {!hidden && rv?.kind === 'type' && (
                <>
                  <Divider />
                  <SectionLabel>입력 텍스트</SectionLabel>
                  <input
                    value={active.follow.typeText ?? ''}
                    onChange={e => setTypeText(active.id, e.target.value)}
                    placeholder="자동 입력될 텍스트 (비우면 ‘텍스트 입력…’ 안내만)"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.1)', color: '#F0F0FF', WebkitTextFillColor: '#F0F0FF', caretColor: '#a78bfa', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <p style={hint}>입력하면 연습 가이드 미리보기에선 타이핑 애니메이션으로, Live Guide에선 실제 입력란에 자동 입력됩니다.</p>
                </>
              )}
            </>
          )}
        </aside>
      </div>

      {/* 미리보기 오버레이 */}
      {showPreview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(5,5,10,0.9)', backdropFilter: 'blur(4px)' }}>
          <InteractiveFollowPlayer title={tutorial.title} steps={previewSteps} onClose={() => setShowPreview(false)} closeLabel="편집으로" />
        </div>
      )}

      {annotatingId && (() => {
        const step = steps.find(s => s.id === annotatingId);
        if (!step?.screenshotUrl) return null;
        return (
          <ImageAnnotationEditor
            imageUrl={step.screenshotUrl}
            annotations={step.annotations}
            onChange={annotations => saveAnnotations(step.id, annotations)}
            onClose={() => setAnnotatingId(null)}
          />
        );
      })()}

      <Styles />
    </div>
  );
}

// ── 소품 ──────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>{children}</div>;
}
function Divider() { return <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '18px 0' }} />; }
function Styles() { return <style>{`.spin{animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>; }

const pageBg: React.CSSProperties = { position: 'fixed', inset: 0, background: '#0A0A0F', display: 'grid', placeItems: 'center', fontFamily: "'Pretendard', -apple-system, sans-serif" };
const primaryBtn: React.CSSProperties = { height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const ghostBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 };
const subtleBtn: React.CSSProperties = { width: '100%', height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 };
const hint: React.CSSProperties = { fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '8px 0 0', lineHeight: 1.5 };
