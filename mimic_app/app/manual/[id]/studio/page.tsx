'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Check, Loader2, MousePointerClick, Type, RotateCcw, EyeOff, Eye } from 'lucide-react';
import { useTutorial } from '@/hooks/useTutorial';
import { updateStep } from '@/lib/api/steps';
import { clickToPct, inferKind, toFollowSteps } from '@/lib/follow';
import { InteractiveFollowPlayer } from '@/components/viewer/InteractiveFollowPlayer';
import { logError } from '@/lib/logger';
import type { Step, Tutorial, FollowConfig } from '@/types';

// DB Step → 스튜디오 편집 단위
type StudioStep = {
  id: string;
  number: number;
  screenshotUrl: string | null;
  autoTitle: string;          // 슬라이드 제목 (instruction 미설정 시 폴백)
  autoBody: string;
  clickXPct: number | null;   // 녹화 좌표 (0~100)
  clickYPct: number | null;
  follow: FollowConfig;       // 저작값 (편집 편의상 로컬은 항상 객체)
};

function toStudioStep(s: Step): StudioStep {
  return {
    id: s.id,
    number: s.step_number,
    screenshotUrl: s.screenshot_url || null,
    autoTitle: s.user_title ?? s.ai_title ?? '',
    autoBody: (s.user_script ?? s.ai_description ?? '').replace(/<[^>]+>/g, ''),
    clickXPct: clickToPct((s as Step & { click_x?: number | null }).click_x),
    clickYPct: clickToPct((s as Step & { click_y?: number | null }).click_y),
    follow: (s.follow_config as FollowConfig) ?? {},
  };
}

// 저작값 + 자동추론을 합쳐 현재 적용되는 핫스팟/종류 계산 (캔버스 표시용)
function resolved(s: StudioStep) {
  const fc = s.follow;
  return {
    hotspotX: fc.hotspotX != null ? fc.hotspotX : s.clickXPct,
    hotspotY: fc.hotspotY != null ? fc.hotspotY : s.clickYPct,
    kind: (fc.kind ?? inferKind(s.autoTitle, s.autoBody)) as 'click' | 'type',
  };
}

// 빈 필드 제거 → 전부 비면 null (DB 깨끗하게)
function normalize(fc: FollowConfig): FollowConfig | null {
  const clean: FollowConfig = {};
  if (fc.hotspotX != null) clean.hotspotX = fc.hotspotX;
  if (fc.hotspotY != null) clean.hotspotY = fc.hotspotY;
  if (fc.kind) clean.kind = fc.kind;
  if (fc.instruction && fc.instruction.trim()) clean.instruction = fc.instruction.trim();
  if (fc.hidden) clean.hidden = true;
  return Object.keys(clean).length ? clean : null;
}

export default function StudioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tutorial, loading, error } = useTutorial(id);

  const [steps, setSteps] = useState<StudioStep[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
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
    title: s.autoTitle,
    body: s.autoBody || null,
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
          <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>따라하기 스튜디오</span>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tutorial.title}</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {savingId ? <><Loader2 size={12} className="spin" /> 저장 중…</> : savedTick > 0 ? <><Check size={12} color="#34d399" /> 저장됨</> : null}
        </span>
        <button onClick={() => setShowPreview(true)} style={primaryBtn}><Play size={13} /> 미리보기</button>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 좌측 스텝 리스트 */}
        <aside style={{ width: 220, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto', padding: '10px 8px' }}>
          {steps.map((s, i) => {
            const sel = s.id === activeId;
            const r = resolved(s);
            const hasHot = r.hotspotX != null && r.hotspotY != null;
            return (
              <button key={s.id} onClick={() => setActiveId(s.id)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 9px', marginBottom: 4, borderRadius: 9, border: '1px solid ' + (sel ? 'rgba(124,58,237,0.6)' : 'transparent'), background: sel ? 'rgba(124,58,237,0.16)' : 'transparent', color: 'white', cursor: 'pointer', opacity: s.follow.hidden ? 0.5 : 1 }}>
                <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 6, background: sel ? '#7c3aed' : 'rgba(255,255,255,0.1)', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'rgba(255,255,255,0.85)' }}>
                  {s.follow.instruction || s.autoTitle || '(제목 없음)'}
                </span>
                {s.follow.hidden
                  ? <EyeOff size={12} color="rgba(255,255,255,0.4)" />
                  : <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: hasHot ? (r.kind === 'type' ? '#60a5fa' : '#34d399') : 'rgba(255,255,255,0.25)' }} />}
              </button>
            );
          })}
        </aside>

        {/* 중앙 캔버스 */}
        <main style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#070709' }}>
          {!active ? (
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>스텝을 선택하세요</span>
          ) : !active.screenshotUrl ? (
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>이 스텝에는 스크린샷이 없습니다</span>
          ) : (
            <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
              <div ref={imgWrapRef}
                onClick={e => placeHotspot(e.clientX, e.clientY, true)}
                style={{ position: 'relative', display: 'inline-block', lineHeight: 0, cursor: 'crosshair', borderRadius: 8, overflow: 'hidden', boxShadow: '0 12px 50px rgba(0,0,0,0.5)', filter: hidden ? 'grayscale(0.7) brightness(0.6)' : 'none' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={active.screenshotUrl} alt="" draggable={false} style={{ display: 'block', maxWidth: '100%', maxHeight: 'calc(100vh - 160px)', width: 'auto', height: 'auto', userSelect: 'none' }} />
                {rv && rv.hotspotX != null && rv.hotspotY != null && (
                  <div
                    onPointerDown={e => { e.stopPropagation(); draggingRef.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
                    style={{ position: 'absolute', left: `${rv.hotspotX}%`, top: `${rv.hotspotY}%`, transform: 'translate(-50%,-50%)', width: 26, height: 26, borderRadius: '50%', border: '2.5px solid ' + (rv.kind === 'type' ? '#60a5fa' : '#34d399'), background: 'rgba(0,0,0,0.25)', cursor: 'grab', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 3px rgba(0,0,0,0.35)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: rv.kind === 'type' ? '#60a5fa' : '#34d399' }} />
                  </div>
                )}
              </div>
              <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>
                {hidden ? '숨김 처리된 스텝입니다 — 따라하기에 노출되지 않습니다' : '이미지를 클릭하거나 점을 드래그해 핫스팟 위치를 지정하세요'}
              </p>
            </div>
          )}
        </main>

        {/* 우측 속성 패널 */}
        <aside style={{ width: 280, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto', padding: 18 }}>
          {!active ? null : (
            <>
              <SectionLabel>스텝 {steps.findIndex(s => s.id === active.id) + 1}</SectionLabel>

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
              <div style={{ display: 'flex', gap: 6 }}>
                {([
                  { key: null, label: '자동', icon: null },
                  { key: 'click', label: '클릭', icon: <MousePointerClick size={13} /> },
                  { key: 'type', label: '입력', icon: <Type size={13} /> },
                ] as { key: 'click' | 'type' | null; label: string; icon: React.ReactNode }[]).map(opt => {
                  const sel = curKind === opt.key;
                  return (
                    <button key={String(opt.key)} disabled={hidden} onClick={() => patch(active.id, { kind: opt.key })}
                      style={{ flex: 1, height: 34, borderRadius: 8, border: '1px solid ' + (sel ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.12)'), background: sel ? 'rgba(124,58,237,0.2)' : 'transparent', color: sel ? 'white' : 'rgba(255,255,255,0.6)', fontSize: 11.5, fontWeight: 600, cursor: hidden ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: hidden ? 0.5 : 1 }}>
                      {opt.icon}{opt.label}
                    </button>
                  );
                })}
              </div>
              <p style={hint}>‘자동’은 제목으로 추론합니다{curKind == null && rv ? ` (현재: ${rv.kind === 'type' ? '입력' : '클릭'})` : ''}.</p>

              <Divider />

              {/* 핫스팟 */}
              <SectionLabel>핫스팟 위치</SectionLabel>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                {rv && rv.hotspotX != null
                  ? <>X {rv.hotspotX.toFixed(1)}% · Y {rv.hotspotY!.toFixed(1)}% {active.follow.hotspotX != null ? <span style={{ color: '#a78bfa' }}>(수정됨)</span> : <span style={{ color: 'rgba(255,255,255,0.4)' }}>(녹화값)</span>}</>
                  : <span style={{ color: 'rgba(255,255,255,0.4)' }}>지정 안 됨 — 이미지를 클릭하세요</span>}
              </div>
              <button disabled={hidden || active.follow.hotspotX == null} onClick={() => patch(active.id, { hotspotX: null, hotspotY: null })}
                style={{ ...subtleBtn, opacity: (hidden || active.follow.hotspotX == null) ? 0.4 : 1, cursor: (hidden || active.follow.hotspotX == null) ? 'not-allowed' : 'pointer' }}>
                <RotateCcw size={12} /> 녹화 위치로 초기화
              </button>

              <Divider />

              {/* 안내문구 */}
              <SectionLabel>따라하기 안내문구</SectionLabel>
              <textarea
                key={active.id}
                disabled={hidden}
                defaultValue={active.follow.instruction ?? ''}
                onBlur={e => { const v = e.target.value; if ((active.follow.instruction ?? '') !== v) patch(active.id, { instruction: v }); }}
                placeholder={active.autoTitle || '예: 여기 로그인 버튼을 눌러요'}
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 12.5, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', outline: 'none', opacity: hidden ? 0.5 : 1 }}
              />
              <p style={hint}>비워두면 슬라이드 제목을 사용합니다.</p>
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
