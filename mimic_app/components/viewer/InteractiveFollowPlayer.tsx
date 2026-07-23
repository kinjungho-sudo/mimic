'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { FollowStage, Mascot, CORNER } from './FollowStage';
import { BRAND_COLORS } from '@/lib/brand';
import { isOversizedGuideTarget } from '@/lib/follow-target';
import type { Annotation } from '@/components/editor/ImageAnnotationEditor';

// 좌표는 전부 0~100(%) 정규화로 받는다 — 호출부(play/manual)가 각자 변환해 넘긴다.
export interface FollowStep {
  title: string;
  body?: string;
  screenshotUrl?: string | null;
  imageAltText?: string | null;
  hotspotX?: number | null;            // 0~100 (%)
  hotspotY?: number | null;            // 0~100 (%)
  hotspotUserPlaced?: boolean;         // 스튜디오에서 직접 찍은 좌표 — 좌상단도 유효(가짜 0,0 센티넬 제외)
  kind?: 'click' | 'type';             // 클릭 vs 타이핑 — 인디케이터 모양 결정
  typeText?: string | null;            // type 인디케이터에 자동 타이핑될 텍스트
  typeInputMode?: 'copy' | 'auto' | null;
  typeBoxWidth?: number | null;
  typeBoxHeight?: number | null;
  audioUrl?: string | null;            // 스텝 TTS 오디오 (있으면 음성 재생)
  audioStartMs?: number | null;
  audioEndMs?: number | null;
  bubbleAnchor?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null;
  domRect?: { x: number; y: number; w: number; h: number } | null; // DOM bounding box (0~100 pct)
  stepType?: string | null;
  guideMode?: 'interactive' | 'explanation';
  annotations?: Annotation[] | null;
  zoomAnim?: boolean;                  // 스튜디오에서 켠 경우에만 클릭 영역 확대 애니메이션 (기본 off)
  section?: string;
  riskNotice?: string | null;
}

type AnimPhase = 'raw' | 'zooming' | 'focused';

interface Props {
  steps: FollowStep[];
  title?: string;
  initialStepIndex?: number;
  onClose?: () => void;
  onComplete?: () => void;
  closeLabel?: string;
  lockAfterStep?: number | null;       // 이 인덱스 이후로 진행 시 로그인 월(소프트 게이트). null=제한 없음
}

const HIT_PCT = 7; // 핫스팟 정답 클릭 허용 반경(%)
const GUIDE_GRADIENT = `linear-gradient(135deg,${BRAND_COLORS.primary},${BRAND_COLORS.guide})`;
const GUIDE_SOFT = 'rgba(0,155,142,0.10)';

export function InteractiveFollowPlayer({ steps, title, initialStepIndex = 0, onClose, onComplete, closeLabel = '닫기', lockAfterStep = null }: Props) {
  const [idx, setIdx] = useState(() => Math.max(0, Math.min(initialStepIndex, steps.length - 1)));
  const [done, setDone] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showGate, setShowGate] = useState(false);  // 맛보기 후 로그인 월 (소프트 게이트)
  const [voiceOn, setVoiceOn] = useState(false);  // 음성 자동재생 토글 (기본 OFF — 아바타 클릭 재생)
  const [visible, setVisible] = useState(true);    // 스텝 전환 페이드 제어
  const [animPhase, setAnimPhase] = useState<AnimPhase>('raw'); // 줌인 시퀀스: raw→zooming→focused
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [typeDraft, setTypeDraft] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const typeAdvanceRef = useRef(false);

  const total = steps.length;
  const step = steps[idx];
  const hasAnyAudio = steps.some(s => !!s.audioUrl);
  const zoomOn = !!step?.domRect && !!step?.zoomAnim;

  useEffect(() => {
    const nextIndex = Math.max(0, Math.min(initialStepIndex, steps.length - 1));
    setIdx(nextIndex);
    setDone(false);
    setShowSkipConfirm(false);
  }, [initialStepIndex, steps.length]);

  // 스텝 바뀌면 툴팁 다시 펼침 (#3)
  useEffect(() => {
    setMinimized(false);
    setShowSkipConfirm(false);
    setTypeDraft('');
    typeAdvanceRef.current = false;
  }, [idx]);

  // 줌인 시퀀스: 스튜디오에서 확대 애니메이션을 켠(zoomAnim) 스텝 + domRect 있을 때만.
  // 원본(raw)에서 확대(zooming→focused)로 한 번만 진행하고 그대로 유지 — 다시 좁아지는 효과 없음.
  // 기본은 확대 애니메이션 없이 즉시 focused. 확대 속도는 FollowStage 트랜지션 1.4s(기존 대비 2배 느림).
  useEffect(() => {
    phaseTimers.current.forEach(clearTimeout);
    phaseTimers.current = [];
    if (!zoomOn) { setAnimPhase('focused'); return; }
    setAnimPhase('raw');
    const t1 = setTimeout(() => setAnimPhase('zooming'), 1000);
    const t2 = setTimeout(() => setAnimPhase('focused'), 2400);
    phaseTimers.current = [t1, t2];
    return () => { phaseTimers.current.forEach(clearTimeout); phaseTimers.current = []; };
  }, [idx, done, zoomOn]); // done 추가: '다시 연습하기'(idx 변화 없이 done→false)에서도 줌 시퀀스 재생

  // 언마운트 정리: 전환 중 닫히면 setState 경고/오디오 누수가 나므로 타이머·오디오 해제
  useEffect(() => () => {
    if (transTimer.current) clearTimeout(transTimer.current);
    phaseTimers.current.forEach(clearTimeout);
    try { audioRef.current?.pause(); if (audioRef.current) audioRef.current.src = ''; } catch { /* noop */ }
  }, []);

  // 음성 재생 (#5) — 직전 오디오 정지 후 재생
  const playVoice = useCallback((audio?: Pick<FollowStep, 'audioUrl' | 'audioStartMs' | 'audioEndMs'> | null) => {
    if (!audio?.audioUrl) return;
    try { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } } catch { /* noop */ }
    try {
      const a = new Audio(audio.audioUrl);
      audioRef.current = a;
      const startS = (audio.audioStartMs ?? 0) / 1000;
      const endS = audio.audioEndMs != null ? audio.audioEndMs / 1000 : null;
      a.currentTime = startS;
      const onTime = () => {
        if (endS != null && a.currentTime >= endS) {
          a.pause();
          a.removeEventListener('timeupdate', onTime);
        }
      };
      a.addEventListener('timeupdate', onTime);
      a.onended = () => a.removeEventListener('timeupdate', onTime);
      a.play().catch(() => {});
    } catch { /* noop */ }
  }, []);

  // 음성 ON이면 스텝 넘어갈 때 자동재생 (다음 클릭 = 사용자 제스처라 autoplay 허용)
  useEffect(() => {
    if (voiceOn && !done) playVoice(step);
    return () => { try { audioRef.current?.pause(); } catch { /* noop */ } };
  }, [idx, voiceOn, done, step, playVoice]);

  const onMascotClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (minimized) { setMinimized(false); return; }
    if (step.audioUrl) playVoice(step);
  };

  // 스텝 전환: 페이드아웃 → 인덱스 변경 → 페이드인. 연속 클릭 시 마지막만 실행
  const goTo = useCallback((nextIdx: number) => {
    if (transTimer.current) clearTimeout(transTimer.current);
    setVisible(false);
    transTimer.current = setTimeout(() => {
      setIdx(nextIdx);
      setMinimized(false);
      setVisible(true);
    }, 210);
  }, []);

  const advance = useCallback((source: 'action' | 'navigation' = 'navigation') => {
    const current = steps[idx];
    const hasActionTarget = current?.guideMode === 'interactive'
      && current.hotspotX != null
      && current.hotspotY != null
      && (current.hotspotUserPlaced || current.hotspotX >= CORNER || current.hotspotY >= CORNER);
    if (source === 'navigation' && hasActionTarget && !completedSteps.has(idx)) {
      setShowSkipConfirm(true);
      return;
    }
    // 맛보기 한도를 넘어가는 진행이면 로그인 월 (잠긴 콘텐츠가 남아있을 때만)
    if (lockAfterStep != null && idx >= lockAfterStep && idx + 1 < total) { setShowGate(true); return; }
    if (idx + 1 >= total) { setDone(true); onComplete?.(); return; }
    goTo(idx + 1);
  }, [steps, completedSteps, total, onComplete, lockAfterStep, idx, goTo]);
  const goPrev = useCallback(() => { if (idx > 0) goTo(idx - 1); }, [idx, goTo]);
  const returnToLastStep = useCallback(() => {
    setDone(false);
    setMinimized(false);
  }, []);
  const restartPractice = useCallback(() => {
    setDone(false);
    setCompletedSteps(new Set());
    setSkippedSteps(new Set());
    setShowSkipConfirm(false);
    goTo(0);
  }, [goTo]);

  const confirmSkip = useCallback(() => {
    setSkippedSteps(previous => new Set(previous).add(idx));
    setShowSkipConfirm(false);
    advance('action');
  }, [advance, idx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || !!target?.isContentEditable;
      if (isTyping && e.key !== 'Escape') return;
      if (done) {
        if (e.key === 'ArrowLeft' || e.key === 'Backspace') returnToLastStep();
        else if (e.key === 'Escape') onClose?.();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'Enter') advance('navigation');
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, goPrev, onClose, done, returnToLastStep]);

  const doNudge = useCallback(() => { setNudge(true); setTimeout(() => setNudge(false), 420); }, []);

  const completeTypeStep = useCallback((value: string) => {
    if (typeAdvanceRef.current || step?.kind !== 'type') return;
    const expected = step.typeText ?? '';
    if (expected ? value !== expected : value.trim().length === 0) {
      doNudge();
      return;
    }
    typeAdvanceRef.current = true;
    setCompletedSteps(previous => new Set(previous).add(idx));
    advance('action');
  }, [advance, doNudge, idx, step]);

  const onImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (done) return;
    if (step.kind === 'type') return;
    const hx = step.hotspotX, hy = step.hotspotY;
    // 클릭 타깃 없음(이동/캡처 단계 — 좌상단 0,0 포함) → 화면 클릭으로 진행하지 않음. '다음'으로만 이동 (#2)
    // 단, 사용자가 직접 찍은 좌상단 핫스팟은 유효 타깃으로 인정
    if (hx == null || hy == null || (!step.hotspotUserPlaced && hx < CORNER && hy < CORNER)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const dr = step.domRect;
    // 큰 부모 DOM은 전체를 정답으로 보지 않는다. 사용자가 지정한 실제 클릭 지점 근처만 인정한다.
    const inRect = dr && !isOversizedGuideTarget(dr)
      ? xPct >= dr.x && xPct <= dr.x + dr.w && yPct >= dr.y && yPct <= dr.y + dr.h
      : false;
    const dist = Math.hypot(xPct - hx, yPct - hy);
    if (dist <= HIT_PCT || inRect) {
      setCompletedSteps(previous => new Set(previous).add(idx));
      advance('action');
    } else doNudge();
  };

  if (!step) return null;

  const hx = step.hotspotX, hy = step.hotspotY;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px', gap: '10px' }}>
      {done ? (
        <div style={{ background: 'white', borderRadius: '18px', padding: '36px 40px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxWidth: '380px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><Mascot size={56} state="success" /></div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>연습을 완료하셨어요! 🎉</div>
          <div style={{ fontSize: '13.5px', color: '#6B7280', lineHeight: 1.6, marginBottom: skippedSteps.size > 0 ? '8px' : '18px' }}>{total}단계를 모두 확인했습니다.</div>
          {skippedSteps.size > 0 && <div style={{ margin: '0 auto 18px', padding: '8px 10px', borderRadius: 8, background: '#FFFBEB', color: '#92400E', fontSize: 12, lineHeight: 1.45 }}>{skippedSteps.size}개 단계의 행동을 건너뛰었습니다. 실제 업무 전 다시 확인해보세요.</div>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={returnToLastStep} style={{ padding: '10px 18px', borderRadius: '9px', border: `1px solid ${BRAND_COLORS.border}`, background: BRAND_COLORS.guideSoft, color: BRAND_COLORS.pointer, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{'\uB9C8\uC9C0\uB9C9 \uB2E8\uACC4\uB85C'}</button>
            <button onClick={restartPractice} style={{ padding: '10px 18px', borderRadius: '9px', border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>{'\uCC98\uC74C\uBD80\uD130 \uB2E4\uC2DC'}</button>
            {onClose && <button onClick={onClose} style={{ padding: '10px 22px', borderRadius: '9px', border: 'none', background: GUIDE_GRADIENT, color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{closeLabel}</button>}
          </div>
        </div>
      ) : (
        <>
          {/* 가상 브라우저 창 */}
          <div style={{ position: 'relative', width: 'min(1280px, 97%)', flex: '1 1 auto', minHeight: 0, maxHeight: 'calc(100vh - 110px)', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '34px', background: '#E9EAEE', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px', flexShrink: 0 }}>
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#FF5F57' }} />
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#FEBC2E' }} />
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#28C840' }} />
              <div style={{ flex: 1, margin: '0 10px', height: '20px', background: 'white', borderRadius: '6px', display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: '11px', color: '#6B7280', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{title || '가상 화면 — 안전하게 연습해 보세요'}</div>
            </div>

            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0b0f', overflow: 'hidden' }}>
              {/* 스텝 전환 페이드: 빠른 아웃(0.18s) + 부드러운 인(0.28s) */}
              <div style={{ opacity: visible ? 1 : 0, transition: visible ? 'opacity 0.28s ease' : 'opacity 0.18s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FollowStage
                  key={idx}
                  screenshotUrl={step.screenshotUrl}
                  imageAltText={step.imageAltText}
                  hotspotX={hx ?? null}
                  hotspotY={hy ?? null}
                  allowCornerHotspot={step.hotspotUserPlaced}
                  kind={step.kind ?? 'click'}
                  typeText={step.typeText}
                  typeInputMode={step.typeInputMode}
                  typeBoxWidth={step.typeBoxWidth}
                  typeBoxHeight={step.typeBoxHeight}
                  guideMode={step.guideMode}
                  bubbleAnchor={step.bubbleAnchor}
                  animateType={false}
                  isFirstStep={idx === 0}
                  stepNumber={idx + 1}
                  spotlight
                  animPhase={animPhase}
                  domRect={step.domRect ?? null}
                  title={step.title}
                  body={step.body}
                  minimized={minimized}
                  showAudioBadge={!!step.audioUrl}
                  nudge={nudge}
                  imageCursor="pointer"
                  typeValue={typeDraft}
                  onTypeValueChange={setTypeDraft}
                  onTypeComplete={completeTypeStep}
                  onImageClick={onImageClick}
                  onMascotClick={onMascotClick}
                  onBubbleClick={(e) => { e.stopPropagation(); setMinimized(true); }}
                />
              </div>
            </div>
          </div>

          {step.riskNotice && (
            <div role="note" style={{ maxWidth: 'min(920px, 94%)', margin: '-2px auto 0', padding: '5px 12px 5px 7px', borderRadius: 9, border: '1px solid rgba(245,158,11,0.5)', background: 'rgba(255,251,235,0.97)', color: '#92400E', fontSize: 11.5, lineHeight: 1.45, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Mascot size={30} state="warning" />
              <span><b>안전 확인</b> · {step.riskNotice}</span>
            </div>
          )}

          {/* 컨트롤 바 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.95)', borderRadius: '12px', padding: '8px 14px', boxShadow: '0 6px 24px rgba(0,0,0,0.25)', flexShrink: 0 }}>
            {step.section && <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', paddingRight: 10, borderRight: '1px solid #E5E7EB' }}>{step.section}</span>}
            <span style={{ fontSize: '12px', fontWeight: 700, color: BRAND_COLORS.primary, background: BRAND_COLORS.guideSoft, padding: '3px 10px', borderRadius: '20px' }}>{idx + 1} / {total}</span>
            {hasAnyAudio && (
              <button onClick={() => setVoiceOn(v => !v)} title={voiceOn ? '음성 자동재생 끄기 (아바타 클릭으로 듣기)' : '음성 자동재생 켜기'}
                style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: `1px solid ${voiceOn ? BRAND_COLORS.primary : '#E5E7EB'}`, background: voiceOn ? GUIDE_SOFT : 'white', color: voiceOn ? BRAND_COLORS.primary : '#9CA3AF', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  {voiceOn ? <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /> : <><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>}
                </svg>
                음성
              </button>
            )}
            <button onClick={goPrev} disabled={idx === 0} style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', color: idx === 0 ? '#D1D5DB' : '#374151', fontSize: '12.5px', fontWeight: 600, cursor: idx === 0 ? 'default' : 'pointer' }}>이전</button>
            <button onClick={() => advance('navigation')} style={{ height: '32px', padding: '0 14px', borderRadius: '8px', border: 'none', background: GUIDE_GRADIENT, color: 'white', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>{idx + 1 >= total ? '완료' : '다음 →'}</button>
            {onClose && <button onClick={onClose} style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#6B7280', fontSize: '12.5px', cursor: 'pointer' }}>{closeLabel}</button>}
          </div>
        </>
      )}

      {/* 맛보기 후 로그인 월 (소프트 게이트) */}
      {showGate && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(10,10,18,0.78)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '18px', padding: '32px 30px', textAlign: 'center', boxShadow: '0 24px 70px rgba(0,0,0,0.45)', maxWidth: '360px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}><Mascot size={52} state="clarify" /></div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>여기까지 미리보기예요</div>
            <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.6, marginBottom: '20px' }}>무료로 로그인하면 끝까지 따라할 수 있어요.<br />가입은 몇 초면 끝나요.</div>
            <button onClick={() => { const next = encodeURIComponent(window.location.pathname + window.location.search); window.location.href = `/auth/login?next=${next}`; }} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: GUIDE_GRADIENT, color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', marginBottom: '10px' }}>무료로 로그인하고 계속하기</button>
            <button onClick={() => setShowGate(false)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: 'transparent', color: '#9CA3AF', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>미리보기로 돌아가기</button>
          </div>
        </div>
      )}

      {showSkipConfirm && !done && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 19, background: 'rgba(10,10,18,0.56)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="skip-step-title" style={{ width: 'min(360px, 100%)', borderRadius: 15, background: 'white', color: '#111827', padding: 22, textAlign: 'center', boxShadow: '0 22px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Mascot size={52} state="blocked" /></div>
            <div id="skip-step-title" style={{ fontSize: 17, fontWeight: 800, marginBottom: 7 }}>이 단계의 행동을 건너뛸까요?</div>
            <p style={{ margin: '0 0 17px', color: '#6B7280', fontSize: 12.5, lineHeight: 1.55 }}>{step.kind === 'type' ? '표시된 입력란에 안내된 텍스트를 직접 입력하면 완료로 기록됩니다.' : '반짝이는 녹색 영역을 직접 클릭하면 완료로 기록됩니다.'} 건너뛰어도 계속할 수 있지만 완료 화면에 표시됩니다.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button onClick={() => { setShowSkipConfirm(false); doNudge(); }} style={{ height: 36, padding: '0 13px', borderRadius: 8, border: '1px solid #D1D5DB', background: 'white', color: '#374151', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>표시된 위치로 돌아가기</button>
              <button onClick={confirmSkip} style={{ height: 36, padding: '0 13px', borderRadius: 8, border: 'none', background: '#6B7280', color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>건너뛰기</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes mfp-caret { 50%{opacity:0} }
        @keyframes mfp-nudge { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
      `}</style>
    </div>
  );
}
