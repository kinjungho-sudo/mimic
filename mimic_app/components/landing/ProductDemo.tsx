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

function LiveGuideScene({ stepIndex, compact = false, reducedMotion = false }: { stepIndex: number; compact?: boolean; reducedMotion?: boolean }) {
  const step = DEMO_STEPS[stepIndex];
  return (
    <div className={`${styles.sceneFrame} ${compact ? styles.compactScene : ''}`}>
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
  const [scene, setScene] = useState<0 | 1>(0);
  const [recordPhase, setRecordPhase] = useState(0);
  const [liveStep, setLiveStep] = useState(0);

  const selectHeroScene = useCallback((next: 0 | 1) => {
    setScene(next);
    if (next === 0) setRecordPhase(0);
    else setLiveStep(0);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const delay = scene === 0 ? (recordPhase < 3 ? 1750 : 2200) : 2600;
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
    <div ref={ref} className={styles.heroDemo} data-playing={playing}>
      <div className={styles.heroEyebrow}>
        <span><i /> 기록부터 실제 실행까지</span>
        <b>{scene === 0 ? 'CAPTURE' : 'LIVE GUIDE'}</b>
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
        ? <RecorderScene phase={reducedMotion ? 3 : recordPhase} compact reducedMotion={reducedMotion} />
        : <LiveGuideScene stepIndex={liveStep} compact reducedMotion={reducedMotion} />}
    </div>
  );
}

const EDITOR_PHASES = [
  { label: '웹 매뉴얼 생성', caption: '녹화 내용을 편집기로 변환' },
  { label: '제목 편집', caption: 'AI 초안을 업무에 맞게 수정' },
  { label: '단계 편집', caption: '설명과 강조 위치를 다듬기' },
  { label: '저장 완료', caption: '공유 가능한 매뉴얼 완성' },
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

function ManualEditorScene({ phase, reducedMotion }: { phase: number; reducedMotion: boolean }) {
  const selectedStep = phase >= 2 ? 1 : 0;
  const title = phase >= 1 ? '정부24에서 주민등록표 등본 발급하기' : '정부24 주민등록표 등본 발급';

  return (
    <div className={`${styles.editorScene} ${reducedMotion ? styles.reducedMotion : ''}`}>
      <EditorChrome saved={phase >= 3} />
      <div className={styles.editorAppBar}>
        <div><span className={styles.parroMark}>P</span><strong>Parro</strong><i /></div>
        <span>웹 매뉴얼 편집기</span>
        <div><button type="button">미리보기</button><button type="button">공유하기</button></div>
      </div>

      <div className={styles.editorWorkspace}>
        <aside className={styles.editorSidebar}>
          <div className={styles.sidebarTitle}><span>←</span><div><small>매뉴얼</small><strong>{title}</strong></div></div>
          <div className={styles.editorStepList}>
            {DEMO_STEPS.map((step, index) => (
              <button type="button" key={step.title} className={selectedStep === index ? styles.selectedEditorStep : ''}>
                <span>{index + 1}</span>
                <img src={step.screenshotUrl} alt="" draggable={false} />
                <div><strong>{step.title}</strong><small>{index === selectedStep ? '편집 중' : '자동 저장됨'}</small></div>
              </button>
            ))}
          </div>
          <button type="button" className={styles.addStepButton}>＋ 단계 추가</button>
        </aside>

        <main className={styles.editorCanvas}>
          <div className={styles.canvasToolbar}><span>실행 취소</span><i /><span>100%</span><span>화면 맞춤</span></div>
          <div className={styles.canvasStage}>
            <div className={styles.manualPage}>
              <div className={styles.manualPageHeading}>
                <span>STEP {selectedStep + 1}</span>
                <strong>{DEMO_STEPS[selectedStep].title}</strong>
                <p>{phase >= 2 ? '서비스 개요 우측의 파란색 발급하기 버튼을 클릭하세요.' : DEMO_STEPS[selectedStep].description}</p>
              </div>
              <div className={styles.manualCapture}>
                <img src={DEMO_STEPS[selectedStep].screenshotUrl} alt="웹 매뉴얼 편집 화면" draggable={false} />
                {phase >= 2 && <div className={styles.editorAnnotation}><span>2</span></div>}
              </div>
            </div>
          </div>
        </main>

        <aside className={styles.editorInspector}>
          <div className={styles.inspectorTabs}><strong>콘텐츠</strong><span>디자인</span></div>
          <label>매뉴얼 제목</label>
          <div className={`${styles.titleField} ${phase === 1 ? styles.fieldEditing : ''}`}>{title}{phase === 1 && <i />}</div>
          <label>단계 제목</label>
          <div className={styles.inspectorField}>{DEMO_STEPS[selectedStep].title}</div>
          <label>단계 설명</label>
          <div className={`${styles.descriptionField} ${phase === 2 ? styles.fieldEditing : ''}`}>
            {phase >= 2 ? '서비스 개요 우측의 파란색 발급하기 버튼을 클릭하세요.' : DEMO_STEPS[selectedStep].description}
            {phase === 2 && <i />}
          </div>
          <div className={styles.annotationTools}>
            <span>강조 도구</span>
            <div><button type="button">□ 박스</button><button type="button">➜ 화살표</button><button type="button">● 마커</button></div>
          </div>
        </aside>
      </div>

      {phase === 0 && (
        <div className={styles.generatingOverlay}>
          <div className={styles.generatingCard}>
            <span className={styles.parroMark}>P</span>
            <strong>웹 매뉴얼을 만들고 있어요</strong>
            <p>저장된 화면과 클릭 정보를 편집 가능한 단계로 변환합니다.</p>
            <i><em /></i>
            <small>3개 단계를 구성하는 중…</small>
          </div>
        </div>
      )}
      {phase >= 3 && <div className={styles.savedToast}><span>✓</span><div><strong>편집 완료</strong><small>공유 가능한 웹 매뉴얼로 저장됐어요</small></div></div>}
    </div>
  );
}

export function ProductDemo() {
  const { ref, playing, reducedMotion } = usePlayback();
  const [phase, setPhase] = useState(0);

  const selectPhase = useCallback((next: number) => setPhase(next), []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setPhase(current => (current + 1) % EDITOR_PHASES.length), phase === 3 ? 3200 : 2500);
    return () => window.clearTimeout(timer);
  }, [phase, playing]);

  return (
    <section id="tour" className={styles.productSection}>
      <div ref={ref} className={styles.productInner} data-playing={playing}>
        <div className={styles.sectionHeading}>
          <span>WEB MANUAL EDITOR</span>
          <h2>녹화가 끝나면, 편집 가능한 웹 매뉴얼이 됩니다</h2>
          <p>자동 생성된 제목과 단계 설명을 바로 다듬고, 클릭 위치와 강조 표시까지 편집한 뒤 링크 하나로 공유하세요.</p>
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
          <ManualEditorScene phase={reducedMotion ? 3 : phase} reducedMotion={reducedMotion} />
        </div>

        <p className={styles.motionNote}>
          {reducedMotion ? '모션 감소 설정에 따라 편집 완료 상태를 표시합니다.' : '웹 매뉴얼 생성과 편집 과정이 자동 재생되며, 위 단계를 눌러 원하는 장면을 직접 볼 수 있습니다.'}
        </p>
      </div>
    </section>
  );
}
