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
  coachSide: 'left' | 'right';
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
    coachSide: 'right',
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
    '--coach-x': `${step.coachSide === 'right' ? step.rect.x + step.rect.width : step.rect.x}%`,
    '--coach-y': `${step.rect.y + step.rect.height / 2}%`,
  } as CSSProperties;

  return (
    <div className={`${styles.targetViewport} ${live ? styles.liveViewport : styles.recordViewport} ${reducedMotion ? styles.reducedMotion : ''}`} style={vars}>
      <img src={step.screenshotUrl} alt={`${step.title} 실제 녹화 화면`} draggable={false} decoding="async" />
      <div className={styles.targetBox} aria-hidden="true" />
      <span className={styles.clickPulse} aria-hidden="true" />
      <span className={styles.pointer} aria-hidden="true"><Pointer /></span>
      {live && (
        <div className={`${styles.coachmark} ${step.coachSide === 'right' ? styles.coachRight : styles.coachLeft}`}>
          <div className={styles.coachmarkHeading}>
            <div className={styles.aiAvatar} aria-hidden="true">🤖</div>
            <div><span>Parro AI Guide</span><strong>{step.title}</strong></div>
          </div>
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

function SharedViewerScene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className={`${styles.editorScene} ${styles.viewerScene} ${reducedMotion ? styles.reducedMotion : ''}`}>
      <EditorChrome saved />
      <div className={styles.viewerAppBar}>
        <div className={styles.viewerBrand}><span className={styles.parroMark}>P</span><strong>Parro</strong><i />정부24에서 주민등록표 등본 발급하기</div>
        <div className={styles.viewerActions}>
          <button type="button">⚡ 라이브 가이드 Beta</button>
          <div className={styles.viewerToggle}>
            <span>학습</span><strong>웹 문서</strong><b>슬라이드</b>
          </div>
        </div>
      </div>

      <div className={styles.sharedUrlRibbon}>
        <span>✓</span>
        <div><strong>공유 링크 하나로</strong><small>parro-guide.vercel.app/play/guide-7f3a</small></div>
        <em>설치 없이 바로 열람</em>
      </div>

      <div className={styles.viewerComparison}>
        <section className={styles.documentPreview}>
          <div className={styles.previewLabel}><span>▤</span><div><strong>웹 문서</strong><small>스크롤하며 전체 단계 확인</small></div></div>
          <div className={styles.documentPage}>
            <h3>정부24에서 주민등록표 등본 발급하기</h3>
            {[0, 1].map(index => (
              <div key={DEMO_STEPS[index].title} className={styles.documentStepCard}>
                <div><span>{String(index + 1).padStart(2, '0')}.</span><strong>{DEMO_STEPS[index].title}</strong></div>
                <p>{DEMO_STEPS[index].description}</p>
                <img src={DEMO_STEPS[index].screenshotUrl} alt="" draggable={false} />
              </div>
            ))}
          </div>
        </section>

        <div className={styles.viewerSwitchArrow}><span>⇄</span><small>같은 URL</small></div>

        <section className={styles.slidesPreview}>
          <div className={styles.previewLabel}><span>▰</span><div><strong>슬라이드</strong><small>한 단계씩 집중해서 보기</small></div></div>
          <div className={styles.slideCanvas}>
            <div className={styles.slideChapter}><span>Step 2</span><strong>{DEMO_STEPS[1].title}</strong></div>
            <img src={DEMO_STEPS[1].screenshotUrl} alt="" draggable={false} />
            <div className={styles.slideAnnotation} />
            <div className={styles.slideControls}><span>‹</span><strong>2 / 3</strong><span>›</span></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ManualEditorScene({ phase, reducedMotion }: { phase: number; reducedMotion: boolean }) {
  const selectedStep = phase >= 1 ? 1 : 0;
  const title = '정부24에서 주민등록표 등본 발급하기';

  if (phase === 3) return <SharedViewerScene reducedMotion={reducedMotion} />;

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
          <div className={styles.tocDomain}><span>G</span><b>정부24</b></div>
          <div className={styles.actualStepList}>
            {DEMO_STEPS.map((step, index) => (
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
                <strong>{DEMO_STEPS[selectedStep].title}</strong>
              </div>
              <p className={phase === 1 ? styles.editingText : ''}>
                {selectedStep === 1 ? '서비스 개요 우측의 파란색 발급하기 버튼을 클릭하세요.' : DEMO_STEPS[selectedStep].description}
                {phase === 1 && <i />}
              </p>
              <div className={styles.stepCardCapture}>
                <img src={DEMO_STEPS[selectedStep].screenshotUrl} alt="카드형 매뉴얼 편집 화면" draggable={false} />
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
            <span className={styles.parroMark}>P</span>
            <strong>카드형 매뉴얼을 자동으로 완성하고 있어요</strong>
            <p>녹화한 화면과 클릭 정보를 바탕으로 제목·단계 설명·강조 위치를 구성합니다.</p>
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
          <span>SMART MANUAL WORKFLOW</span>
          <h2>자동으로 완성하고, 카드로 다듬고, URL 하나로 공유합니다</h2>
          <p>녹화가 끝나면 카드형 매뉴얼이 자동 생성됩니다. 필요한 부분만 편집한 뒤 공유 링크를 보내면 웹 문서와 슬라이드로 바로 볼 수 있어요.</p>
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
          {reducedMotion ? '모션 감소 설정에 따라 공유 완료 상태를 표시합니다.' : '실제 Parro의 매뉴얼 생성과 공유 흐름이 자동 재생되며, 위 단계를 눌러 원하는 장면을 직접 볼 수 있습니다.'}
        </p>
      </div>
    </section>
  );
}
