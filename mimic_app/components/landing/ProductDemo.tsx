'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import styles from './ProductDemo.module.css';

type SceneProps = {
  compact?: boolean;
  reducedMotion?: boolean;
};

const SCENES = [
  {
    tab: '기록',
    title: '클릭하는 순간, SOP가 쌓입니다',
    caption: '업무를 평소처럼 진행하면 화면과 클릭 위치가 사이드바에 단계별로 기록됩니다.',
  },
  {
    tab: '편집·공유',
    title: '다듬고, 필요한 형태로 바로 공유합니다',
    caption: '자동 생성된 설명과 표시를 편집하고 Web·PPTX·Word·PDF로 내보냅니다.',
  },
  {
    tab: '라이브 가이드',
    title: '실제 화면 위에서 다음 행동을 안내합니다',
    caption: 'AI 아바타가 클릭할 곳과 입력할 내용을 보여주며 완료 단계까지 함께 갑니다.',
  },
] as const;

function usePlayback(rootMargin = '80px') {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileQuery = window.matchMedia('(max-width: 640px)');
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

  return { ref, playing: inView && !reducedMotion, reducedMotion, duration: mobile ? 5600 : 7200 };
}

function BrowserChrome({ url, recording = false }: { url: string; recording?: boolean }) {
  return (
    <div className={styles.browserChrome}>
      <span className={styles.windowDot} /><span className={styles.windowDot} /><span className={styles.windowDot} />
      <div className={styles.addressBar}><span className={styles.lock}>⌁</span>{url}</div>
      {recording ? <div className={styles.recBadge}><i /> REC <span className={styles.timer}><b>00:01</b><b>00:12</b><b>00:24</b></span></div> : null}
    </div>
  );
}

function Pointer() {
  return (
    <svg className={styles.pointerIcon} width="24" height="28" viewBox="0 0 22 26" fill="none" aria-hidden="true">
      <path d="M4 2 L4 20 L8.5 15.8 L11.4 22.6 L14 21.4 L11.1 14.8 L17 14.8 Z" fill="white" stroke="#10231f" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function RecordingScene({ reducedMotion = false }: SceneProps) {
  const steps = ['문서 열기', '메뉴 펼치기', '공유 버튼 클릭'];
  return (
    <div className={`${styles.scene} ${styles.recordingScene} ${reducedMotion ? styles.staticScene : ''}`}>
      <BrowserChrome url="docs.company.com/onboarding" recording />
      <div className={styles.recordingBody}>
        <div className={styles.workSurface}>
          <div className={styles.docToolbar}><span>파일</span><span>편집</span><span>보기</span><button type="button">공유</button></div>
          <div className={styles.documentPage}>
            <small>TEAM PLAYBOOK · 2026</small>
            <h4>신규 입사자 온보딩</h4>
            <p>첫날에 필요한 계정과 문서를 한 번에 준비합니다.</p>
            <div className={styles.fakeLines}><i /><i /><i /><i /></div>
            <div className={styles.shareTarget}>공유 설정 열기</div>
            <span className={styles.clickRipple} />
            <div className={styles.recordPointer}><Pointer /></div>
          </div>
        </div>
        <aside className={styles.recorderPanel}>
          <div className={styles.panelBrand}><span className={styles.parroMark}>P</span><strong>Parro Recorder</strong></div>
          <div className={styles.panelStatus}><span><i /> 녹화 중</span><b>자동 저장</b></div>
          <p>캡처된 스텝</p>
          <div className={styles.stepList}>
            {steps.map((step, index) => (
              <div className={styles.recordStep} style={{ '--step': index } as React.CSSProperties} key={step}>
                <span>{index + 1}</span><div><strong>{step}</strong><small>클릭 위치와 화면 저장됨</small></div><em>✓</em>
              </div>
            ))}
          </div>
          <div className={styles.panelFooter}><span>3 steps</span><button type="button">완료</button></div>
        </aside>
      </div>
    </div>
  );
}

export function EditingScene({ reducedMotion = false }: SceneProps) {
  return (
    <div className={`${styles.scene} ${styles.editingScene} ${reducedMotion ? styles.staticScene : ''}`}>
      <BrowserChrome url="app.parro.so/manual/onboarding/edit" />
      <div className={styles.editorBody}>
        <aside className={styles.editorSteps}>
          <div className={styles.panelBrand}><span className={styles.parroMark}>P</span><strong>온보딩 매뉴얼</strong></div>
          {['문서 열기', '메뉴 펼치기', '공유 버튼 클릭', '링크 복사'].map((step, index) => <div className={index === 2 ? styles.activeEditorStep : ''} key={step}><span>{index + 1}</span>{step}</div>)}
        </aside>
        <main className={styles.editorCanvas}>
          <div className={styles.editorTop}><span>↖</span><span>→</span><span>□</span><span>T</span><b>AI 설명 완성</b><button type="button">공유</button></div>
          <div className={styles.canvasCard}>
            <small>STEP 03</small><h4>공유 버튼을 클릭하세요</h4>
            <div className={styles.canvasMock}><i /><i /><i /><button type="button">공유</button><svg className={styles.drawArrow} viewBox="0 0 150 80" aria-hidden="true"><path d="M8 70 C45 66, 72 35, 121 25"/><path d="M105 16 L124 24 L111 39"/></svg></div>
          </div>
          <div className={styles.sharePopover}>
            <strong>다음 형태로 공유</strong>
            <div className={styles.exportIcons}>{['Web', 'PPTX', 'Word', 'PDF'].map((label, index) => <span style={{ '--export': index } as React.CSSProperties} key={label}><i>{label.slice(0, 1)}</i>{label}</span>)}</div>
            <div className={styles.shareLink}><span>parro.so/p/onboarding-guide</span><button type="button">링크 복사</button></div>
          </div>
          <div className={styles.editorPointer}><Pointer /></div>
          <span className={styles.editorClick} />
        </main>
      </div>
    </div>
  );
}

export function LiveGuideScene({ reducedMotion = false }: SceneProps) {
  return (
    <div className={`${styles.scene} ${styles.guideScene} ${reducedMotion ? styles.staticScene : ''}`}>
      <BrowserChrome url="gov.example.kr/certificate/apply" />
      <div className={styles.govBody}>
        <header><strong><span>●</span> 정부24</strong><nav>민원서비스　혜택알리미　정책정보　고객센터</nav></header>
        <div className={styles.govContent}>
          <small>민원서비스 〉 증명서 발급</small><h4>주민등록표 등본(초본) 발급</h4>
          <div className={styles.govInfo}><div><b>신청방법</b><span>인터넷, 방문, 무인발급기</span></div><div><b>처리기간</b><span>즉시 처리</span></div></div>
          <label>신청인 이름<div className={styles.typedInput}><input aria-label="신청인 이름" value="" readOnly /><span>홍길동</span><i /></div></label>
          <button className={styles.applyButton} type="button">발급하기</button>
          <span className={styles.guideSpotlight} />
          <div className={styles.guidePointer}><Pointer /></div>
          <div className={styles.avatar}><Image src="/brand/parro-mark.svg" alt="" width={32} height={32} /></div>
          <div className={styles.guideBubble}><span>파란 발급하기 버튼을 클릭하세요</span></div>
          <div className={styles.guideProgress}><span><b>3</b> / 4</span><i><em /></i></div>
          <div className={styles.successToast}><b>✓</b><span>다음 단계로 이동했어요<small>신청 정보를 확인해 주세요</small></span></div>
        </div>
      </div>
    </div>
  );
}

export function HeroRecordingDemo() {
  const { ref, playing, reducedMotion } = usePlayback('120px');
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setCycle(value => value + 1), 5600);
    return () => window.clearInterval(timer);
  }, [playing]);

  return (
    <div ref={ref} className={styles.heroDemo} data-playing={playing} aria-label="클릭이 SOP 단계로 기록되는 Parro 데모">
      <RecordingScene key={cycle} compact reducedMotion={reducedMotion} />
    </div>
  );
}

export function ProductDemo() {
  const { ref, playing, reducedMotion, duration } = usePlayback();
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);

  const selectScene = useCallback((index: number) => {
    setActive(index);
    setCycle(value => value + 1);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setActive(current => (current + 1) % SCENES.length);
      setCycle(value => value + 1);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [active, cycle, duration, playing]);

  const Scene = active === 0 ? RecordingScene : active === 1 ? EditingScene : LiveGuideScene;

  return (
    <section id="tour" className={styles.productSection}>
      <div ref={ref} className={styles.productInner} data-playing={playing}>
        <div className={styles.sectionHeading}>
          <span>Product demo</span>
          <h2>기록부터 실행까지, 한 흐름으로 보세요</h2>
          <p>설명 대신 실제 동작으로 Parro의 세 단계를 보여드립니다.</p>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Parro 제품 데모 장면">
          {SCENES.map((scene, index) => (
            <button id={`product-demo-tab-${index}`} key={scene.tab} type="button" role="tab" aria-selected={active === index} aria-controls="product-demo-panel" className={active === index ? styles.activeTab : ''} onClick={() => selectScene(index)}>
              <span>0{index + 1}</span><strong>{scene.tab}</strong><i><em /></i>
            </button>
          ))}
        </div>
        <div className={styles.stageShell}>
          <div className={styles.sceneCopy}><span>0{active + 1}</span><div><h3>{SCENES[active].title}</h3><p>{SCENES[active].caption}</p></div></div>
          <div id="product-demo-panel" role="tabpanel" aria-labelledby={`product-demo-tab-${active}`} className={styles.stage} aria-live="polite">
            <Scene key={`${active}-${cycle}`} reducedMotion={reducedMotion} />
          </div>
        </div>
        <p className={styles.motionNote}>{reducedMotion ? '모션 감소 설정에 따라 핵심 화면만 표시합니다.' : '장면은 자동으로 전환됩니다. 탭을 눌러 직접 살펴볼 수도 있습니다.'}</p>
      </div>
    </section>
  );
}
