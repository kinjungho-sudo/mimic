'use client';

/* eslint-disable @next/next/no-img-element -- These are public captures from a real Parro recording. */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import styles from './ProductDemo.module.css';

type DemoStep = {
  title: string;
  description: string;
  screenshotUrl: string;
  rect: { x: number; y: number; width: number; height: number };
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
  },
  {
    title: '발급하기 클릭',
    description: '서비스 개요 우측의 발급하기 버튼을 클릭합니다.',
    screenshotUrl: `${CAPTURE_BASE}/step_02.jpg`,
    rect: { x: 69.1, y: 73.3, width: 27.5, height: 9.4 },
  },
  {
    title: '회원 신청하기 선택',
    description: '신청 방식 팝업에서 회원 신청하기를 선택합니다.',
    screenshotUrl: `${CAPTURE_BASE}/step_03.jpg`,
    rect: { x: 33.8, y: 46.8, width: 15.3, height: 7.7 },
  },
];

function usePlayback(rootMargin = '80px') {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
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

  return { ref, playing: inView && !reducedMotion, reducedMotion };
}

function Pointer() {
  return (
    <svg width="26" height="31" viewBox="0 0 22 26" fill="none" aria-hidden="true">
      <path d="M4 2 L4 20 L8.5 15.8 L11.4 22.6 L14 21.4 L11.1 14.8 L17 14.8 Z" fill="white" stroke="#111827" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function BrowserChrome({ live = false }: { live?: boolean }) {
  return (
    <div className={styles.browserChrome}>
      <span className={styles.windowDot} />
      <span className={styles.windowDot} />
      <span className={styles.windowDot} />
      <div className={styles.addressBar}><span>⌁</span> plus.gov.kr</div>
      <div className={live ? styles.liveBadge : styles.captureBadge}>
        <i /> {live ? 'Live Guide 실행 중' : 'REC'}
      </div>
    </div>
  );
}

function TargetViewport({ step, live, reducedMotion }: {
  step: DemoStep;
  live: boolean;
  reducedMotion: boolean;
}) {
  const vars = {
    '--target-x': `${step.rect.x}%`,
    '--target-y': `${step.rect.y}%`,
    '--target-w': `${step.rect.width}%`,
    '--target-h': `${step.rect.height}%`,
  } as CSSProperties;

  return (
    <div className={`${styles.targetViewport} ${live ? styles.liveViewport : styles.recordViewport} ${reducedMotion ? styles.reducedMotion : ''}`} style={vars}>
      <img src={step.screenshotUrl} alt={`${step.title} 실제 녹화 화면`} draggable={false} decoding="async" />
      <div className={styles.targetBox} aria-hidden="true" />
      <span className={styles.clickPulse} aria-hidden="true" />
      <span className={styles.pointer} aria-hidden="true"><Pointer /></span>
      {live && (
        <div className={styles.coachmark}>
          <span>Live Guide</span>
          <strong>{step.title}</strong>
          <p>{step.description}</p>
        </div>
      )}
    </div>
  );
}

function RecorderPanel({ phase }: { phase: number }) {
  const savedCount = Math.min(phase, DEMO_STEPS.length);
  const complete = phase >= DEMO_STEPS.length;

  return (
    <aside className={styles.recorderPanel}>
      <div className={styles.recorderHeader}>
        <div><span className={styles.parroMark}>P</span><strong>Parro Recorder</strong></div>
        <span className={styles.recordingState}><i /> 녹화 중</span>
      </div>
      <div className={styles.recordingTitle}>
        <small>새 매뉴얼</small>
        <strong>정부24 주민등록표 등본 발급</strong>
        <span>{savedCount}개 단계 자동 저장</span>
      </div>

      <div className={styles.savedSteps}>
        {DEMO_STEPS.map((step, index) => {
          const saved = index < savedCount;
          const active = index === phase && !complete;
          return (
            <div key={step.title} className={`${styles.savedStep} ${saved ? styles.saved : ''} ${active ? styles.saving : ''}`}>
              <span>{saved ? '✓' : index + 1}</span>
              <div><strong>{step.title}</strong><small>{saved ? '자동 저장됨' : active ? '클릭 감지 중…' : '다음 행동 대기'}</small></div>
            </div>
          );
        })}
      </div>

      {complete ? (
        <div className={styles.manualReady}>
          <span>✓</span>
          <div><strong>매뉴얼 생성 완료</strong><small>3단계 가이드가 준비됐어요</small></div>
          <button type="button">매뉴얼 열기</button>
        </div>
      ) : (
        <div className={styles.autoSave}><i /> 클릭할 때마다 화면과 DOM을 자동 저장합니다</div>
      )}
    </aside>
  );
}

function RecorderScene({ phase, compact = false, reducedMotion = false }: {
  phase: number;
  compact?: boolean;
  reducedMotion?: boolean;
}) {
  const step = DEMO_STEPS[Math.min(phase, DEMO_STEPS.length - 1)];
  return (
    <div className={`${styles.sceneFrame} ${compact ? styles.compactScene : ''}`}>
      <BrowserChrome />
      <div className={styles.recorderWorkspace}>
        <TargetViewport key={`rec-${phase}`} step={step} live={false} reducedMotion={reducedMotion} />
        <RecorderPanel phase={phase} />
      </div>
    </div>
  );
}

function LiveGuideScene({ stepIndex, reducedMotion = false }: { stepIndex: number; reducedMotion?: boolean }) {
  const step = DEMO_STEPS[stepIndex];
  return (
    <div className={styles.sceneFrame}>
      <BrowserChrome live />
      <TargetViewport key={`live-${stepIndex}`} step={step} live reducedMotion={reducedMotion} />
      <div className={styles.liveProgress}>
        <span>{stepIndex + 1} / {DEMO_STEPS.length}</span>
        <i><em style={{ width: `${((stepIndex + 1) / DEMO_STEPS.length) * 100}%` }} /></i>
        <strong>실제 웹의 대상 DOM에 연결됨</strong>
      </div>
    </div>
  );
}

export function HeroRecordingDemo() {
  const { ref, playing, reducedMotion } = usePlayback('120px');
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setPhase(current => (current + 1) % (DEMO_STEPS.length + 1)), phase === 3 ? 2800 : 2200);
    return () => window.clearTimeout(timer);
  }, [phase, playing]);

  return (
    <div ref={ref} className={styles.heroDemo} data-playing={playing}>
      <div className={styles.heroEyebrow}>
        <span><i /> Recorder가 클릭을 기록하는 중</span>
        <b>{Math.min(phase, 3)} / 3 저장</b>
      </div>
      <RecorderScene phase={reducedMotion ? 3 : phase} compact reducedMotion={reducedMotion} />
    </div>
  );
}

export function ProductDemo() {
  const { ref, playing, reducedMotion } = usePlayback();
  const [scene, setScene] = useState<0 | 1>(0);
  const [recordPhase, setRecordPhase] = useState(0);
  const [liveStep, setLiveStep] = useState(0);

  const selectScene = useCallback((next: 0 | 1) => {
    setScene(next);
    if (next === 0) setRecordPhase(0);
    else setLiveStep(0);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const delay = scene === 0 ? (recordPhase < 3 ? 2300 : 3000) : 3600;
    const timer = window.setTimeout(() => {
      if (scene === 0) {
        if (recordPhase < 3) setRecordPhase(value => value + 1);
        else { setScene(1); setLiveStep(0); }
      } else if (liveStep < DEMO_STEPS.length - 1) {
        setLiveStep(value => value + 1);
      } else {
        setScene(0);
        setRecordPhase(0);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [liveStep, playing, recordPhase, scene]);

  return (
    <section id="tour" className={styles.productSection}>
      <div ref={ref} className={styles.productInner} data-playing={playing}>
        <div className={styles.sectionHeading}>
          <span>HOW PARRO WORKS</span>
          <h2>기록부터 실행까지, 실제 업무 순서 그대로</h2>
          <p>Recorder가 클릭한 화면과 DOM을 자동 저장해 매뉴얼을 만들고, 완성된 매뉴얼은 실제 웹 위에서 Live Guide로 실행됩니다.</p>
        </div>

        <div className={styles.flowTabs} role="tablist" aria-label="Parro 동작 순서">
          <button type="button" role="tab" aria-selected={scene === 0} className={scene === 0 ? styles.activeFlowTab : ''} onClick={() => selectScene(0)}>
            <span>1</span><div><strong>Recorder로 기록</strong><small>클릭 자동 저장 → 매뉴얼 생성</small></div>
          </button>
          <i aria-hidden="true">→</i>
          <button type="button" role="tab" aria-selected={scene === 1} className={scene === 1 ? styles.activeFlowTab : ''} onClick={() => selectScene(1)}>
            <span>2</span><div><strong>Live Guide 실행</strong><small>완성된 매뉴얼을 실제 웹에서 안내</small></div>
          </button>
        </div>

        <div className={styles.demoShell} role="tabpanel">
          <div className={styles.stageTopline}>
            <div>
              <span className={styles.stagePill}><i /> {scene === 0 ? 'CAPTURE' : 'LIVE'}</span>
              <strong>{scene === 0 ? '클릭할 때마다 단계가 자동 저장됩니다' : '저장된 DOM 위치를 실제 웹에서 다시 찾습니다'}</strong>
            </div>
            <span>{scene === 0 ? `${Math.min(recordPhase, 3)} / 3 단계 저장` : `${liveStep + 1} / 3 단계 실행`}</span>
          </div>
          {scene === 0
            ? <RecorderScene phase={reducedMotion ? 3 : recordPhase} reducedMotion={reducedMotion} />
            : <LiveGuideScene stepIndex={liveStep} reducedMotion={reducedMotion} />}
        </div>

        <p className={styles.motionNote}>
          {reducedMotion ? '모션 감소 설정에 따라 완료 상태를 표시합니다.' : '두 데모는 운영 순서대로 자동 재생되며, 위 단계를 눌러 직접 전환할 수 있습니다.'}
        </p>
      </div>
    </section>
  );
}
