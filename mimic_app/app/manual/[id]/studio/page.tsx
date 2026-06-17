'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Check, Loader2, MousePointerClick, Type, Ban, RotateCcw, EyeOff, Eye, GripVertical, PlayCircle } from 'lucide-react';
import { useTutorial } from '@/hooks/useTutorial';
import { updateStep, reorderSteps } from '@/lib/api/steps';
import { clickToPct, inferKind, toFollowSteps } from '@/lib/follow';
import { InteractiveFollowPlayer } from '@/components/viewer/InteractiveFollowPlayer';
import { FollowStage } from '@/components/viewer/FollowStage';
import { logError } from '@/lib/logger';
import type { Step, Tutorial, FollowConfig } from '@/types';

// DB Step → 스튜디오 편집 단위
type StudioStep = {
  id: string;
  number: number;
  screenshotUrl: string | null;
  title: string;             // user_title (편집) — 문서 매뉴얼과 공유. ai_title 폴백으로 초기화
  description: string;       // user_script (편집, HTML 제거) — 문서 매뉴얼과 공유
  clickXPct: number | null;  // 녹화 좌표 (0~100)
  clickYPct: number | null;
  follow: FollowConfig;      // 따라하기 전용 시각 설정 (핫스팟·종류·숨김·typeText)
};

function toStudioStep(s: Step): StudioStep {
  return {
    id: s.id,
    number: s.step_number,
    screenshotUrl: s.screenshot_url || null,
    title: s.user_title ?? s.ai_title ?? '',
    description: (s.user_script ?? s.ai_description ?? '').replace(/<[^>]+>/g, ''),
    clickXPct: clickToPct((s as Step & { click_x?: number | null }).click_x),
    clickYPct: clickToPct((s as Step & { click_y?: number | null }).click_y),
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
  return Object.keys(clean).length ? clean : null;
}

export default function StudioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tutorial, loading, error, publish } = useTutorial(id);

  const [steps, setSteps] = useState<StudioStep[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [liveGuide, setLiveGuide] = useState<{ paid: boolean; remaining: number | null } | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
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
    setActiveId(prev => prev ?? ss[0]?.id ?? null);
  }, [tutorial]);

  useEffect(() => {
    fetch('/api/user/plan').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setLiveGuide({ paid: !!d.paid, remaining: d.liveGuide?.remaining ?? null });
    }).catch(() => {});
  }, []);

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

  const previewSteps = useMemo(() => toFollowSteps(steps.map(s => ({
    title: s.title,
    body: s.description || null,
    screenshotUrl: s.screenshotUrl || undefined,
    clickXPct: s.clickXPct,
    clickYPct: s.clickYPct,
    audioUrl: null,
    followConfig: s.follow,
  }))), [steps]);

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
  const curKind = active?.follow.kind ?? null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0A0A0F', display: 'flex', flexDirection: 'column', fontFamily: "'Pretendard', -apple-system, sans-serif", color: 'white', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{ flexShrink: 0, height: 56, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(10,10,15,0.9)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <button onClick={() => router.push(`/manual/${id}`)} style={ghostBtn} title="매뉴얼로 돌아가기"><ArrowLeft size={16} /></button>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>라이브 가이드 편집</span>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tutorial.title}</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {savingId ? <><Loader2 size={12} className="spin" /> 저장 중…</> : savedTick > 0 ? <><Check size={12} color="#34d399" /> 저장됨</> : null}
        </span>
        <button onClick={() => setShowPreview(true)} style={{ ...ghostBtn, width: 'auto', padding: '0 12px', gap: 6, display: 'inline-flex', alignItems: 'center', fontSize: 12.5 }}><Play size={13} /> 미리보기</button>
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
            {publishing ? <><Loader2 size={12} className="spin" /> 게시 중…</> : '게시'}
          </button>
        )}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
        <button
          onClick={() => {
            if (liveGuide && !liveGuide.paid && (liveGuide.remaining ?? 0) <= 0) {
              setShowUpgrade(true);
              return;
            }
            const hasSteps = steps.some(s => s.clickXPct != null || s.follow.hotspotX != null);
            if (!hasSteps) {
              alert('먼저 스텝에 핫스팟을 편집한 후 실행하세요.');
              return;
            }
            const extId = (process.env.NEXT_PUBLIC_EXTENSION_ID ?? '').replace(/^﻿/, '').trim();
            if (!extId) { alert('라이브 가이드를 사용하려면 MIMIC 확장프로그램을 설치해주세요.'); return; }
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).chrome?.runtime?.sendMessage(
                extId,
                { action: 'START_GUIDE', tutorial_id: id },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (res: any) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  if ((window as any).chrome?.runtime?.lastError || !res?.ok) {
                    if (res?.gated) { setShowUpgrade(true); return; }
                    alert('확장프로그램이 응답하지 않습니다. 설치·활성화를 확인해주세요.');
                  }
                }
              );
            } catch {
              alert('라이브 가이드를 시작할 수 없습니다. 확장프로그램을 설치해주세요.');
            }
          }}
          style={{ ...primaryBtn, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <PlayCircle size={14} /> 실행
          {liveGuide && !liveGuide.paid && (
            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: (liveGuide.remaining ?? 0) > 0 ? 'rgba(255,255,255,0.2)' : 'rgba(220,38,38,0.3)', color: 'white', fontWeight: 700 }}>
              {(liveGuide.remaining ?? 0) > 0 ? `무료 ${liveGuide.remaining}회` : '체험 종료'}
            </span>
          )}
        </button>
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
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>이 스텝에는 스크린샷이 없습니다</span>
          ) : (
            <>
              <div style={{ position: 'relative', lineHeight: 0, boxShadow: '0 12px 50px rgba(0,0,0,0.5)', filter: hidden ? 'grayscale(0.75) brightness(0.5)' : 'none' }}>
                <FollowStage
                  screenshotUrl={active.screenshotUrl}
                  hotspotX={rv?.hotspotX ?? null}
                  hotspotY={rv?.hotspotY ?? null}
                  kind={rv?.kind ?? 'click'}
                  typeText={active.follow.typeText}
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
                {hidden ? '숨김 처리된 스텝 — 따라하기에 노출되지 않습니다'
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

              {/* 표시/숨김 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  {hidden ? <EyeOff size={14} /> : <Eye size={14} />} 따라하기에 표시
                </span>
                <button onClick={() => patch(active.id, { hidden: !hidden })} title="표시/숨김"
                  style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: hidden ? 'rgba(255,255,255,0.15)' : '#7c3aed', position: 'relative', transition: 'background 0.15s' }}>
                  <span style={{ position: 'absolute', top: 2, left: hidden ? 2 : 20, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.15s' }} />
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

              {/* 입력 텍스트 — 텍스트 인디케이터일 때만 */}
              {!hidden && rv?.kind === 'type' && (
                <>
                  <Divider />
                  <SectionLabel>입력 텍스트</SectionLabel>
                  <input
                    value={active.follow.typeText ?? ''}
                    onChange={e => setTypeText(active.id, e.target.value)}
                    placeholder="자동 입력될 텍스트 (비우면 ‘텍스트 입력…’ 안내만)"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <p style={hint}>입력하면 뷰어에서 이 텍스트가 자동으로 타이핑됩니다(라이브 가이드에선 실제 입력 — 추후).</p>
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

      {/* 업그레이드 모달 */}
      {showUpgrade && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', padding: '32px' }}>
          <div style={{ background: 'white', color: '#111827', borderRadius: '18px', padding: '32px', maxWidth: '420px', width: '100%', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px' }}>라이브 가이드 무료 체험이 끝났어요</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.6, margin: '0 0 20px' }}>무료 플랜은 라이브 가이드를 5회까지 체험할 수 있어요.<br />Pro로 업그레이드하면 무제한으로 실제 화면 위에서 안내할 수 있습니다.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setShowUpgrade(false)} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', fontSize: '13px', cursor: 'pointer', color: '#6B7280' }}>닫기</button>
              <button onClick={() => router.push('/pricing')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Pro 업그레이드</button>
            </div>
          </div>
        </div>
      )}

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
