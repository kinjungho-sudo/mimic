'use client';

/* eslint-disable @next/next/no-img-element -- These are public captures from a real Parro recording. */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ParroMascot } from '@/components/brand/ParroMascot';
import styles from './ProductDemo.module.css';

type DemoStep = {
  title: string;
  description: string;
  screenshotUrl: string;
  rect: { x: number; y: number; width: number; height: number };
  modalRect?: { x: number; y: number; width: number; height: number };
  modalOcclusionRect?: { x: number; y: number; width: number; height: number };
  slideRect?: { x: number; y: number; width: number; height: number };
  coachSide: 'left' | 'right';
};

type DemoVariant = 'default' | 'education';

type DemoProfile = {
  steps: DemoStep[];
  browserAddress: string;
  guideTitle: string;
  domainLabel: string;
};

const CAPTURE_BASE = 'https://gqynptpjomcqzxyykqic.supabase.co/storage/v1/object/public/naviaction/81d0d80d-e3b6-420e-aaad-3b70a73f02c6';

// Rectangles are measured from the source capture itself. Keeping the image at
// its native 1344:858 ratio means DOM boxes and demo annotations share one space.
const DEMO_STEPS: DemoStep[] = [
  {
    title: '주민등록등본(초본) 선택',
    description: '자주 찾는 서비스에서 주민등록등본(초본)을 클릭합니다.',
    screenshotUrl: `${CAPTURE_BASE}/step_01.jpg`,
    rect: { x: 27.2, y: 52.1, width: 21.7, height: 7 },
    coachSide: 'right',
  },
  {
    title: '발급하기 클릭',
    description: '서비스 개요 우측의 발급하기 버튼을 클릭합니다.',
    screenshotUrl: `${CAPTURE_BASE}/step_02.jpg`,
    rect: { x: 69.1, y: 73.3, width: 27.5, height: 9.4 },
    coachSide: 'left',
  },
  {
    title: '회원 신청하기 선택',
    description: '신청 방식 팝업에서 회원 신청하기를 선택합니다.',
    screenshotUrl: `${CAPTURE_BASE}/step_03.jpg`,
    rect: { x: 33.8, y: 46.8, width: 15.3, height: 7.7 },
    modalRect: { x: 27, y: 23.3, width: 44.8, height: 55 },
    modalOcclusionRect: { x: 68.8, y: 73.1, width: 3.2, height: 5.4 },
    slideRect: { x: 69.1, y: 73.3, width: 27.5, height: 9.4 },
    coachSide: 'right',
  },
];

const EDUCATION_STEPS: DemoStep[] = [
  {
    title: '발표 템플릿 선택하기',
    description: '원하는 표지 템플릿을 선택하세요',
    screenshotUrl: '/edu/demo/canva-presentation-step-01.png',
    rect: { x: 6.6, y: 27.3, width: 11.8, height: 12.6 },
    coachSide: 'right',
  },
  {
    title: '발표 제목 수정하기',
    description: '제목을 “AI 시대의 학습법”으로 바꾸세요',
    screenshotUrl: '/edu/demo/canva-presentation-step-02.png',
    rect: { x: 43.2, y: 36.8, width: 45.5, height: 12.2 },
    coachSide: 'left',
  },
  {
    title: '공유 링크 복사하기',
    description: '링크를 복사해 발표자료를 공유하세요',
    screenshotUrl: '/edu/demo/canva-presentation-step-03.png',
    rect: { x: 76.5, y: 33.5, width: 21, height: 4.8 },
    coachSide: 'left',
  },
];

const DEFAULT_PROFILE: DemoProfile = {
  steps: DEMO_STEPS,
  browserAddress: 'plus.gov.kr',
  guideTitle: '정부24에서 주민등록표 등본 발급하기',
  domainLabel: '정부24',
};

const EDUCATION_PROFILE: DemoProfile = {
  steps: EDUCATION_STEPS,
  browserAddress: 'canva.com/design',
  guideTitle: 'Canva로 수업 발표자료 만들기',
  domainLabel: 'Canva',
};

function getDemoProfile(variant: DemoVariant): DemoProfile {
  return variant === 'education' ? EDUCATION_PROFILE : DEFAULT_PROFILE;
}
function usePlayback(rootMargin = '80px') {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileQuery = window.matchMedia('(max-width: 700px)');
    const syncPreferences = () => {
      setReducedMotion(motionQuery.matches);
      setMobile(mobileQuery.matches);
    };
    syncPreferences();
    motionQuery.addEventListener('change', syncPreferences);
    mobileQuery.addEventListener('change', syncPreferences);
    return () => {
      motionQuery.removeEventListener('change', syncPreferences);
      mobileQuery.removeEventListener('change', syncPreferences);
    };
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin,
      threshold: 0.08,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, playing: inView && !reducedMotion, reducedMotion, mobile };
}

function Pointer() {
  return (
    <svg width="26" height="31" viewBox="0 0 22 26" fill="none" aria-hidden="true">
      <path d="M4 2 L4 20 L8.5 15.8 L11.4 22.6 L14 21.4 L11.1 14.8 L17 14.8 Z" fill="white" stroke="#111827" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function BrowserChrome({ address }: { address: string }) {
  return (
    <div className={styles.browserChrome}>
      <span className={styles.windowDot} />
      <span className={styles.windowDot} />
      <span className={styles.windowDot} />
      <div className={styles.addressBar}><span>⌁</span> {address}</div>
      <div className={styles.browserToolbarActions} aria-hidden="true">
        <span>☆</span>
        <span>⋮</span>
      </div>
    </div>
  );
}

function ParroMark() {
  return <span className={styles.parroMark}><img src="/brand/parro-mark.svg" alt="" width="25" height="25" /></span>;
}

function TargetViewport({ step, previousStep, live, reducedMotion, settled = false }: {
  step: DemoStep;
  previousStep?: DemoStep;
  live: boolean;
  reducedMotion: boolean;
  settled?: boolean;
}) {
  const centerOf = (target: DemoStep) => ({
    x: target.rect.x + target.rect.width / 2,
    y: target.rect.y + target.rect.height / 2,
  });
  const to = centerOf(step);
  const from = previousStep ? centerOf(previousStep) : { x: 7, y: 78 };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const bend = -Math.sign(dx || 1) * Math.min(9, distance * 0.2);
  const perpendicular = { x: -dy / distance, y: dx / distance };
  const clampPercent = (value: number) => Math.max(3, Math.min(97, value));
  const control1 = {
    x: clampPercent(from.x + dx * 0.32 + perpendicular.x * bend),
    y: clampPercent(from.y + dy * 0.32 + perpendicular.y * bend),
  };
  const control2 = {
    x: clampPercent(from.x + dx * 0.72 + perpendicular.x * bend),
    y: clampPercent(from.y + dy * 0.72 + perpendicular.y * bend),
  };
  const vars = {
    '--target-x': `${step.rect.x}%`,
    '--target-y': `${step.rect.y}%`,
    '--target-w': `${step.rect.width}%`,
    '--target-h': `${step.rect.height}%`,
    '--modal-x': `${step.modalRect?.x ?? 0}%`,
    '--modal-y': `${step.modalRect?.y ?? 0}%`,
    '--modal-w': `${step.modalRect?.width ?? 0}%`,
    '--modal-h': `${step.modalRect?.height ?? 0}%`,
    '--modal-occlusion-x': `${step.modalOcclusionRect?.x ?? 0}%`,
    '--modal-occlusion-y': `${step.modalOcclusionRect?.y ?? 0}%`,
    '--modal-occlusion-w': `${step.modalOcclusionRect?.width ?? 0}%`,
    '--modal-occlusion-h': `${step.modalOcclusionRect?.height ?? 0}%`,
    '--coach-x': `${step.coachSide === 'right' ? step.rect.x + step.rect.width : step.rect.x}%`,
    '--coach-y': `${step.rect.y + step.rect.height / 2}%`,
    '--cursor-from-x': `${from.x}%`,
    '--cursor-from-y': `${from.y}%`,
    '--cursor-control-1-x': `${control1.x}%`,
    '--cursor-control-1-y': `${control1.y}%`,
    '--cursor-control-2-x': `${control2.x}%`,
    '--cursor-control-2-y': `${control2.y}%`,
    '--cursor-to-x': `${to.x}%`,
    '--cursor-to-y': `${to.y}%`,
  } as CSSProperties;

  return (
    <div className={`${styles.targetViewport} ${live ? styles.liveViewport : styles.recordViewport} ${settled ? styles.settledViewport : ''} ${reducedMotion ? styles.reducedMotion : ''}`} style={vars}>
      <img src={step.screenshotUrl} alt={`${step.title} 실제 녹화 화면`} draggable={false} decoding="async" />
      {step.modalRect && <div className={styles.modalDepthFocus} aria-hidden="true" />}
      {step.modalOcclusionRect && <div className={styles.modalOcclusionPatch} aria-hidden="true" />}
      {live && <div className={styles.targetBox} aria-hidden="true" />}
      {live && <span className={styles.domTargetBadge} aria-hidden="true">DOM</span>}
      <span className={styles.clickPulse} aria-hidden="true" />
      <span className={styles.pointer} aria-hidden="true"><Pointer /></span>
      {live && (
        <div className={`${styles.guideCoach} ${step.coachSide === 'right' ? styles.coachRight : styles.coachLeft}`}>
          <div className={styles.guideAvatar}><ParroMascot size={68} state="neutral" motion={false} /></div>
          <div className={styles.coachmark}>
            <div className={styles.coachmarkHeading}>
              <span>Parro AI Guide</span><strong>{step.title}</strong>
            </div>
            <p>{step.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function RecorderPanel({ phase, steps }: { phase: number; steps: DemoStep[] }) {
  const savedCount = Math.min(phase, steps.length);
  const readyToFinish = phase === steps.length;
  const generating = phase > steps.length;
  const hasCapture = savedCount > 0;
  const previewIndex = Math.max(0, savedCount - 1);
  const previewStep = steps[previewIndex];
  const elapsedSeconds = 8 + Math.min(phase, steps.length) * 4;
  const nativePanelHeader = (
    <div className={styles.chromePanelHeader}>
      <div><ParroMark /><strong>Parro Recorder</strong></div>
      <span className={styles.chromePanelActions} aria-hidden="true"><b>⌖</b><b>×</b></span>
    </div>
  );
  const appHeader = (
    <div className={styles.recorderAppHeader}>
      <div><ParroMark /><strong>Parro</strong></div>
      <span>{savedCount} / {steps.length} steps</span>
      <button type="button" aria-label="녹화 설정">⋯</button>
    </div>
  );

  if (generating) {
    return (
      <aside className={`${styles.recorderPanel} ${styles.generatingPanel}`}>
        {nativePanelHeader}
        {appHeader}
        <div className={styles.panelGeneratingContent}>
          <span className={styles.buildSpinner} aria-hidden="true"><i /></span>
          <strong>매뉴얼을 만들고 있어요</strong>
          <p>3개의 단계 카드를 자동으로 만듭니다</p>
          <i><em /></i>
          <small>화면 배치 · 설명 작성 · 강조 위치 연결</small>
        </div>
      </aside>
    );
  }

  return (
    <aside className={`${styles.recorderPanel} ${readyToFinish ? styles.readyPanel : ''}`}>
      {nativePanelHeader}
      {appHeader}
      <div className={`${styles.recordingBanner} ${readyToFinish ? styles.captureCompleteBanner : ''}`}>
        <div>
          <span className={readyToFinish ? styles.readyState : styles.recordingState}><i /> {readyToFinish ? '캡처 완료' : '녹화 중'}</span>
          <time>{readyToFinish ? `${savedCount}개 단계` : `00:${String(elapsedSeconds).padStart(2, '0')}`}</time>
        </div>
        <strong>{readyToFinish ? '기록이 매뉴얼로 저장되었습니다' : '화면과 클릭을 기록하고 있습니다'}</strong>
      </div>
      <div className={styles.recordingTitle}>
        <div>
          <small>{readyToFinish ? '마지막으로 저장된 화면' : hasCapture ? '방금 캡처된 단계' : '캡처 대기 중'}</small>
          <strong>{hasCapture ? previewStep.title : '첫 번째 클릭을 기다리고 있어요'}</strong>
        </div>
        <span>{readyToFinish ? '모든 단계 저장됨' : hasCapture ? `${savedCount}개 자동 저장` : '0개 저장'}</span>
      </div>

      <div className={`${styles.captureStack} ${!hasCapture ? styles.captureStackWaiting : ''}`} aria-label="저장된 캡처 단계">
        {hasCapture ? steps.slice(0, savedCount).map((capturedStep, index) => {
          const newest = index === savedCount - 1 && !readyToFinish;
          return (
            <article key={capturedStep.title} className={`${styles.captureStackCard} ${newest ? styles.captureStackCardNew : ''}`}>
              <div className={styles.captureStackThumbnail}>
                <img src={capturedStep.screenshotUrl} alt="" loading="eager" decoding="async" />
                <span>{index + 1}</span>
              </div>
              <div className={styles.captureStackCopy}>
                <strong>{capturedStep.title}</strong>
                <small>{capturedStep.description}</small>
                <em><i /> DOM selector {newest ? '인식 완료' : '저장됨'}</em>
              </div>
              <b>{newest ? 'NEW' : '✓'}</b>
            </article>
          );
        }) : (
          <div className={styles.captureWaitingState}>
            <span>⌖</span>
            <strong>첫 번째 클릭을 기다리고 있어요</strong>
            <small>클릭하면 단계 카드가 쌓입니다</small>
          </div>
        )}
      </div>

      {readyToFinish ? (
        <div className={styles.finishArea}>
          <button type="button" className={styles.finishButton}>
            매뉴얼 만들기
            <i className={styles.finishClickPulse} />
            <b className={styles.finishPointer}><Pointer /></b>
          </button>
        </div>
      ) : (
        <div className={styles.autoSave}><i /> {hasCapture ? '클릭 화면과 동작을 저장했습니다' : '클릭하면 미리보기가 생성됩니다'}</div>
      )}
    </aside>
  );
}

function RecorderScene({ phase, steps, browserAddress, compact = false, reducedMotion = false }: {
  phase: number;
  steps: DemoStep[];
  browserAddress: string;
  compact?: boolean;
  reducedMotion?: boolean;
}) {
  const step = steps[Math.min(phase, steps.length - 1)];
  const generating = phase > steps.length;
  return (
    <div className={`${styles.sceneFrame} ${compact ? styles.compactScene : ''}`}>
      <BrowserChrome address={browserAddress} />
      <div className={styles.recorderWorkspace}>
        <div className={styles.recorderTargetWrap}>
          <TargetViewport
            key={`rec-${phase}`}
            step={step}
            previousStep={phase > 0 && phase < steps.length ? steps[phase - 1] : undefined}
            live={false}
            reducedMotion={reducedMotion}
            settled={phase >= steps.length}
          />
          {generating && (
            <div className={styles.manualBuildOverlay}>
              <div><span className={styles.buildSpinner} aria-hidden="true"><i /></span><strong>AI가 매뉴얼을 자동 완성하고 있어요</strong><span>제목과 단계 설명을 구성하고 있습니다</span></div>
            </div>
          )}
        </div>
        <RecorderPanel phase={phase} steps={steps} />
      </div>
    </div>
  );
}

function LiveGuidePanel({ stepIndex, steps, complete = false }: { stepIndex: number; steps: DemoStep[]; complete?: boolean }) {
  const safeStepIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[safeStepIndex];
  const progress = complete ? 100 : ((safeStepIndex + 1) / steps.length) * 100;

  return (
    <aside className={`${styles.recorderPanel} ${styles.liveSidePanel}`}>
      <div className={styles.chromePanelHeader}>
        <div><ParroMark /><strong>Parro Live Guide</strong></div>
        <span className={styles.chromePanelActions} aria-hidden="true"><b>⌖</b><b>×</b></span>
      </div>
      <div className={styles.recorderAppHeader}>
        <div><ParroMark /><strong>Parro</strong></div>
        <span>{complete ? '완료' : 'LIVE'}</span>
        <button type="button" aria-label="라이브 가이드 설정">⋯</button>
      </div>
      <div className={`${styles.livePanelBanner} ${complete ? styles.livePanelCompleteBanner : ''}`}>
        <div>
          <span><i /> {complete ? '라이브 가이드 완료' : '라이브 가이드 실행 중'}</span>
          <b>{complete ? 'DONE' : `STEP ${safeStepIndex + 1} / ${steps.length}`}</b>
        </div>
        <strong>{complete ? '모든 안내 단계를 성공적으로 마쳤습니다' : '현재 화면의 대상과 실시간 연결되었습니다'}</strong>
      </div>
      {complete ? (
        <div className={styles.livePanelCompleteCard}>
          <span>✓</span>
          <div><small>실행 완료</small><strong>가이드를 모두 완료했습니다</strong><p>3단계를 모두 실행했습니다</p></div>
        </div>
      ) : (
        <div className={styles.livePanelCurrent}>
          <small>현재 안내</small>
          <strong>{step.title}</strong>
          <p>{step.description}</p>
        </div>
      )}
      <div className={styles.livePanelSteps}>
        {steps.map((item, index) => {
          const done = complete || index < safeStepIndex;
          const current = !complete && index === safeStepIndex;
          return (
            <div key={item.title} className={`${done ? styles.liveStepDone : ''} ${current ? styles.liveStepCurrent : ''}`}>
              <span>{done ? '✓' : index + 1}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{done ? '완료됨' : current ? '현재 화면에서 안내 중' : '다음 단계'}</small>
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.livePanelProgress}>
        <div><span>{complete ? `${steps.length} / ${steps.length}` : `${safeStepIndex + 1} / ${steps.length}`}</span><strong>{complete ? '완료됨' : 'DOM 연결됨'}</strong></div>
        <i><em style={{ width: `${progress}%` }} /></i>
        <small>{complete ? '실행 기록을 저장했습니다' : '클릭하면 다음 단계로 이동합니다'}</small>
      </div>
    </aside>
  );
}

function LiveGuideScene({ stepIndex, steps, browserAddress, complete = false, compact = false, reducedMotion = false }: { stepIndex: number; steps: DemoStep[]; browserAddress: string; complete?: boolean; compact?: boolean; reducedMotion?: boolean }) {
  const safeStepIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[safeStepIndex];
  return (
    <div className={`${styles.sceneFrame} ${compact ? styles.compactScene : ''}`}>
      <BrowserChrome address={browserAddress} />
      <div className={`${styles.recorderWorkspace} ${styles.liveGuideWorkspace}`}>
        <div className={styles.recorderTargetWrap}>
          <TargetViewport
            key={`live-${safeStepIndex}-${complete ? 'complete' : 'active'}`}
            step={step}
            previousStep={safeStepIndex > 0 ? steps[safeStepIndex - 1] : undefined}
            live
            reducedMotion={reducedMotion}
            settled={complete}
          />
          {complete && (
            <div className={styles.liveCompleteOverlay} role="status" aria-live="polite">
              <div className={styles.liveCompleteModal}>
                <span>✓</span>
                <small>LIVE GUIDE COMPLETE</small>
                <strong>가이드를 모두 완료했습니다</strong>
                <p>3단계를 모두 마쳤습니다</p>
                <button type="button">완료</button>
              </div>
            </div>
          )}
        </div>
        <LiveGuidePanel stepIndex={safeStepIndex} steps={steps} complete={complete} />
      </div>
    </div>
  );
}

export function HeroRecordingDemo({ variant = 'default' }: { variant?: DemoVariant }) {
  const { steps, browserAddress } = getDemoProfile(variant);
  const { ref, playing, reducedMotion } = usePlayback('120px');
  const [scene, setScene] = useState<0 | 1>(0);
  const [recordPhase, setRecordPhase] = useState(0);
  const [liveStep, setLiveStep] = useState(0);
  const liveComplete = scene === 1 && liveStep >= steps.length;

  const selectHeroScene = useCallback((next: 0 | 1) => {
    setScene(next);
    if (next === 0) setRecordPhase(0);
    else setLiveStep(0);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const delay = scene === 0
      ? recordPhase < steps.length
        ? 1800
        : recordPhase === steps.length
          ? 2200
          : 1800
      : liveComplete
        ? 3200
        : 2600;
    const timer = window.setTimeout(() => {
      if (scene === 0) {
        if (recordPhase <= steps.length) setRecordPhase(value => value + 1);
        else { setScene(1); setLiveStep(0); }
      } else if (liveStep < steps.length) {
        setLiveStep(value => value + 1);
      } else {
        setScene(0);
        setRecordPhase(0);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [liveComplete, liveStep, playing, recordPhase, scene, steps.length]);

  return (
    <div ref={ref} className={styles.heroDemo} data-playing={playing} data-record-phase={scene === 0 ? recordPhase : undefined} data-demo-scene={scene === 0 ? 'capture' : 'live-guide'} data-live-complete={liveComplete || undefined}>
      <div className={styles.heroEyebrow}>
        <span><i /> 기록부터 실제 실행까지, 한 흐름으로</span>
        <b>{scene === 0 ? '● 화면 캡처 중' : liveComplete ? '✓ 라이브 가이드 완료' : '● 라이브 가이드 실행 중'}</b>
      </div>
      <div className={styles.heroSceneCaption} role="status" aria-live="polite">
        <span>{scene === 0 ? 'REC' : liveComplete ? 'DONE' : 'LIVE'}</span>
        <div>
          <strong>
            {scene === 0
              ? '지금, 클릭을 자동으로 캡처하고 있어요'
              : liveComplete
                ? '모든 안내 단계를 완료했습니다'
                : '방금 기록한 가이드가 실제 화면에 실시간 적용되고 있어요'}
          </strong>
          <small>
            {scene === 0
              ? '클릭 위치를 단계별로 저장합니다'
              : liveComplete
                ? '실행 기록을 저장했습니다'
                : '화면 안내를 따라 바로 실행하세요'}
          </small>
        </div>
      </div>
      <div className={styles.heroFlowTabs} role="tablist" aria-label="Parro 데모 흐름">
        <button type="button" role="tab" aria-selected={scene === 0} onClick={() => selectHeroScene(0)}>
          <span>1</span><strong>Recorder로 기록</strong>
        </button>
        <i>→</i>
        <button type="button" role="tab" aria-selected={scene === 1} onClick={() => selectHeroScene(1)}>
          <span>2</span><strong>Live Guide 실행</strong>
        </button>
      </div>
      {scene === 0
        ? <RecorderScene phase={reducedMotion ? 3 : recordPhase} steps={steps} browserAddress={browserAddress} compact reducedMotion={reducedMotion} />
        : <LiveGuideScene stepIndex={liveStep} steps={steps} browserAddress={browserAddress} complete={liveComplete} compact reducedMotion={reducedMotion} />}
    </div>
  );
}

const EDITOR_PHASES = [
  { label: '자동 완성', caption: '녹화가 끝나면 카드 매뉴얼 자동 생성' },
  { label: '카드 편집', caption: '제목·설명·강조 표시를 카드에서 수정' },
  { label: 'URL 공유', caption: '공유하기를 눌러 링크 하나 복사' },
  { label: '웹·슬라이드', caption: '받는 사람은 원하는 방식으로 열람' },
] as const;

function EditorChrome({ saved }: { saved: boolean }) {
  return (
    <div className={styles.editorChrome}>
      <span className={styles.windowDot} />
      <span className={styles.windowDot} />
      <span className={styles.windowDot} />
      <div className={styles.editorAddress}><span>⌁</span> parro-guide.vercel.app/manual/editor</div>
      <div className={styles.editorSaveState}><i /> {saved ? '모든 변경사항 저장됨' : '자동 저장 중'}</div>
    </div>
  );
}

function SharedViewerScene({ reducedMotion, profile }: { reducedMotion: boolean; profile: DemoProfile }) {
  const { steps, guideTitle } = profile;
  const [viewMode, setViewMode] = useState<'document' | 'slides'>('document');
  const [slideIndex, setSlideIndex] = useState(0);
  const activeSlideRect = steps[slideIndex].slideRect ?? steps[slideIndex].rect;

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setTimeout(() => setViewMode('slides'), 2600);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion || viewMode !== 'slides') return;
    const timer = window.setInterval(() => {
      setSlideIndex(current => Math.min(current + 1, steps.length - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [reducedMotion, steps.length, viewMode]);

  return (
    <div className={`${styles.editorScene} ${styles.viewerScene} ${reducedMotion ? styles.reducedMotion : ''}`}>
      <EditorChrome saved />
      <div className={styles.viewerAppBar}>
        <div className={styles.viewerBrand}><ParroMark /><strong>Parro</strong><i />{guideTitle}</div>
        <div className={styles.viewerActions}>
          <button type="button">⚡ 라이브 가이드 Beta</button>
          <div className={styles.viewerToggle}>
            <span>학습</span>
            <strong className={viewMode === 'document' ? styles.viewerModeActive : ''}>웹 문서</strong>
            <b className={viewMode === 'slides' ? styles.viewerModeActiveDark : ''}>슬라이드</b>
          </div>
        </div>
      </div>

      <div className={styles.sharedUrlRibbon}>
        <span>✓</span>
        <div><strong>공유 링크 하나로</strong><small>parro-guide.vercel.app/play/guide-7f3a</small></div>
        <em>설치 없이 바로 열람</em>
      </div>

      <div className={styles.viewerStage} data-view={viewMode}>
        {viewMode === 'document' ? (
          <section key="document" className={`${styles.viewerSinglePreview} ${styles.documentPreview}`}>
            <div className={styles.previewLabel}><span>▤</span><div><strong>웹 문서</strong><small>아래로 스크롤하며 전체 단계 확인</small></div></div>
            <div className={styles.documentPage}>
              <div className={styles.documentScrollContent}>
                <h3>{guideTitle}</h3>
                {steps.map((step, index) => (
                  <div key={step.title} className={styles.documentStepCard}>
                    <div><span>{String(index + 1).padStart(2, '0')}.</span><strong>{step.title}</strong></div>
                    <p>{step.description}</p>
                    <img src={step.screenshotUrl} alt="" draggable={false} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section key={`slide-${slideIndex}`} className={`${styles.viewerSinglePreview} ${styles.slidesPreview}`}>
            <div className={styles.previewLabel}><span>▰</span><div><strong>슬라이드</strong><small>한 장씩 넘기며 단계에 집중</small></div></div>
            <div className={styles.slideCanvas}>
              <div className={styles.slideChapter}><span>Step {slideIndex + 1}</span><strong>{steps[slideIndex].title}</strong></div>
              <div className={styles.slideImageFrame}>
                <img src={steps[slideIndex].screenshotUrl} alt="" draggable={false} />
                <div
                  className={styles.slideAnnotation}
                  style={{
                    left: `${activeSlideRect.x}%`,
                    top: `${activeSlideRect.y}%`,
                    width: `${activeSlideRect.width}%`,
                    height: `${activeSlideRect.height}%`,
                  }}
                />
              </div>
              <div className={styles.slideControls}><span>‹</span><strong>{slideIndex + 1} / {steps.length}</strong><span>›</span></div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ManualEditorScene({ phase, reducedMotion, profile }: { phase: number; reducedMotion: boolean; profile: DemoProfile }) {
  const { steps, guideTitle: title, domainLabel } = profile;
  const selectedStep = phase >= 1 ? 1 : 0;

  if (phase === 3) return <SharedViewerScene reducedMotion={reducedMotion} profile={profile} />;

  return (
    <div className={`${styles.editorScene} ${reducedMotion ? styles.reducedMotion : ''}`}>
      <EditorChrome saved={phase >= 1} />
      <div className={styles.actualEditorBar}>
        <div className={styles.editorBarIdentity}><button type="button">‹</button><strong>편집기</strong></div>
        <div className={styles.editorBarMeta}><span>3개 단계</span><strong><i /> 자동 저장됨</strong></div>
        <div className={styles.editorBarActions}>
          <button type="button">미리보기</button>
          <button type="button" className={phase === 2 ? styles.shareButtonActive : ''}>⌁ 공유</button>
          <span>✓ 게시됨</span>
        </div>
      </div>

      <div className={styles.actualEditorWorkspace}>
        <aside className={styles.actualToc}>
          <strong>목차</strong>
          <div className={styles.tocDomain}><span>P</span><b>{domainLabel}</b></div>
          <div className={styles.actualStepList}>
            {steps.map((step, index) => (
              <button type="button" key={step.title} className={selectedStep === index ? styles.selectedEditorStep : ''}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{step.title}</strong>
              </button>
            ))}
          </div>
          <button type="button" className={styles.actualAddStep}>＋ 단계 추가</button>
        </aside>

        <main className={styles.actualEditorMain}>
          <div className={styles.manualTitleBar}>
            <strong>{title}</strong>
            <div><button type="button">◉ 전체 색상</button><button type="button">✦ 전체 문장 다듬기</button></div>
          </div>
          <div className={styles.cardCanvas}>
            <article className={`${styles.stepEditorCard} ${phase === 1 ? styles.cardEditing : ''}`}>
              <div className={styles.cardFormatBar}><span>본문</span><span>B</span><span>↕</span><span>🔗</span></div>
              <div className={styles.stepCardHeading}>
                <span>{String(selectedStep + 1).padStart(2, '0')}.</span>
                <strong>{steps[selectedStep].title}</strong>
              </div>
              <p className={phase === 1 ? styles.editingText : ''}>
                {steps[selectedStep].description}
                {phase === 1 && <i />}
              </p>
              <div className={styles.stepCardCapture}>
                <img src={steps[selectedStep].screenshotUrl} alt="카드형 매뉴얼 편집 화면" draggable={false} />
                {phase >= 1 && <div className={styles.editorAnnotation}><span>{selectedStep + 1}</span></div>}
              </div>
              <div className={styles.cardFooter}><span>이미지 편집</span><span>댓글</span><span>복제</span></div>
            </article>
          </div>
        </main>
      </div>

      {phase === 0 && (
        <div className={styles.generatingOverlay}>
          <div className={styles.generatingCard}>
            <ParroMark />
            <strong>카드형 매뉴얼을 자동으로 완성하고 있어요</strong>
            <p>제목·설명·강조 위치를 자동 구성합니다</p>
            <i><em /></i>
            <small>제목 작성 · 3개 단계 구성 · 화면 배치 중…</small>
          </div>
        </div>
      )}
      {phase === 2 && (
        <div className={styles.shareDemoLayer}>
          <div className={styles.shareDemoModal}>
            <div className={styles.shareModalHeading}><strong>공유하기</strong><span>×</span></div>
            <p>{title}</p>
            <div className={styles.shareUrlRow}>
              <code>parro-guide.vercel.app/play/guide-7f3a</code>
              <button type="button">⌁ 링크 복사</button>
            </div>
            <div className={styles.shareSettingRow}><div><strong>공개 범위</strong><small>링크를 가진 사람만 볼 수 있어요</small></div><span>🔗 링크 공유⌄</span></div>
            <div className={styles.shareSettingRow}><div><strong>비밀번호 보호</strong><small>필요한 경우 접근을 제한할 수 있어요</small></div><span>설정</span></div>
            <div className={styles.copySuccess}><span>✓</span><div><strong>링크가 복사됐어요</strong><small>URL만 전달하면 바로 볼 수 있습니다</small></div></div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProductDemo({ variant = 'default' }: { variant?: DemoVariant }) {
  const profile = getDemoProfile(variant);
  const { ref, playing, reducedMotion, mobile } = usePlayback();
  const [phase, setPhase] = useState(0);

  const selectPhase = useCallback((next: number) => setPhase(next), []);

  useEffect(() => {
    if (!playing || mobile) return;
    const timer = window.setTimeout(() => setPhase(current => (current + 1) % EDITOR_PHASES.length), phase === 3 ? 6100 : 2500);
    return () => window.clearTimeout(timer);
  }, [mobile, phase, playing]);

  return (
    <section id="tour" className={styles.productSection}>
      <div ref={ref} className={styles.productInner} data-playing={playing && !mobile}>
        <div className={styles.sectionHeading}>
          <span>SMART MANUAL WORKFLOW</span>
          <h2>녹화하면 가이드가 완성됩니다</h2>
          <p>AI로 다듬고 링크로 바로 공유하세요</p>
        </div>

        <div className={styles.editorTimeline} role="tablist" aria-label="웹 매뉴얼 편집 과정">
          {EDITOR_PHASES.map((item, index) => (
            <button type="button" role="tab" key={item.label} aria-selected={phase === index} className={phase === index ? styles.activeEditorPhase : ''} onClick={() => selectPhase(index)}>
              <span>{index + 1}</span><div><strong>{item.label}</strong><small>{item.caption}</small></div>
            </button>
          ))}
        </div>

        <div className={styles.editorDemoShell} role="tabpanel">
          <div className={styles.stageTopline}>
            <div>
              <span className={styles.stagePill}><i /> EDITOR</span>
              <strong>{EDITOR_PHASES[phase].caption}</strong>
            </div>
            <span>{phase + 1} / {EDITOR_PHASES.length}</span>
          </div>
          <ManualEditorScene phase={reducedMotion ? 3 : phase} reducedMotion={reducedMotion || mobile} profile={profile} />
        </div>

        <p className={styles.motionNote}>
          {reducedMotion
            ? '공유 완료 상태를 표시합니다'
            : mobile
              ? '단계를 눌러 장면을 확인하세요'
              : 'Parro의 제작 흐름이 자동 재생됩니다'}
        </p>
      </div>
    </section>
  );
}
