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

function usePlayback(rootMargin = '0px 0px -12% 0px') {
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
      threshold: 0.18,
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
      <div className={styles.browserNav} aria-hidden="true"><span>‹</span><span>›</span><span>↻</span></div>
      <div className={styles.addressBar}><span className={styles.lock}>⌁</span><span>{url}</span><em>☆</em></div>
      {recording ? <div className={styles.recBadge}><i /> REC <span className={styles.timer}><b>00:01</b><b>00:12</b><b>00:24</b></span></div> : null}
      <div className={styles.browserProfile}>J</div><span className={styles.browserMenu}>⋮</span>
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
  const steps = [
    { title: '온보딩 문서 열기', meta: 'docs.company.com', tone: 'blue' },
    { title: '파일 메뉴 펼치기', meta: '메뉴 클릭', tone: 'amber' },
    { title: '공유 설정 열기', meta: '버튼 클릭', tone: 'green' },
  ];
  return (
    <div className={`${styles.scene} ${styles.recordingScene} ${reducedMotion ? styles.staticScene : ''}`}>
      <BrowserChrome url="docs.company.com/onboarding" recording />
      <div className={styles.recordingBody}>
        <div className={styles.workSurface}>
          <div className={styles.docsHeader}>
            <div className={styles.docsIcon}>▤</div>
            <div className={styles.docsTitle}><strong>신규 입사자 온보딩</strong><span>☆　☁ 저장됨</span></div>
            <div className={styles.docsPresence}><span>MK</span><span>SL</span></div>
            <button className={styles.docsComment} type="button">▢</button>
            <button className={styles.docsShare} type="button"><span>🔒</span> 공유</button>
          </div>
          <div className={styles.docsMenu}><span>파일</span><span>수정</span><span>보기</span><span>삽입</span><span>서식</span><span>도구</span><span>확장 프로그램</span><span>도움말</span><em>↶　↷　🖨　100%　본문　A−　A+</em></div>
          <div className={styles.docsCanvas}>
            <div className={styles.ruler}><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span></div>
            <article className={styles.documentPage}>
              <small>TEAM PLAYBOOK　·　2026</small>
              <h4>신규 입사자 첫날 체크리스트</h4>
              <p className={styles.docLead}>첫 출근 전 계정과 필수 문서를 준비하고 담당자에게 공유합니다.</p>
              <div className={styles.docSection}><b>1. 업무 계정 준비</b><span>회사 이메일과 협업 도구 계정을 생성합니다.</span><span>ERP 권한은 소속 팀 기준으로 요청합니다.</span></div>
              <div className={styles.docChecklist}><span><i>✓</i> 회사 이메일 생성</span><span><i>✓</i> Slack 워크스페이스 초대</span><span><i /> 온보딩 문서 공유</span></div>
              <div className={styles.docNote}><b>담당자 메모</b><span>완료 후 팀 리더에게 링크를 전달해 주세요.</span></div>
            </article>
            <div className={styles.pageCount}>1 / 2</div>
            <span className={styles.clickRipple} />
            <span className={styles.captureFlash} />
            <div className={styles.recordPointer}><Pointer /></div>
          </div>
        </div>
        <aside className={styles.recorderPanel}>
          <div className={styles.panelBrand}><span className={styles.parroMark}>P</span><div><strong>Parro Recorder</strong><small>새 매뉴얼</small></div><button type="button">•••</button></div>
          <div className={styles.panelStatus}><span><i /> 녹화 중</span><b>00:24</b><em>자동 저장</em></div>
          <div className={styles.recordingTitle}><strong>신규 입사자 온보딩</strong><span>클릭하면 스텝이 자동 생성됩니다</span></div>
          <p>캡처된 스텝 <b>3</b></p>
          <div className={styles.stepList}>
            {steps.map((step, index) => (
              <div className={styles.recordStep} style={{ '--step': index } as React.CSSProperties} key={step.title}>
                <div className={`${styles.stepThumb} ${styles[step.tone]}`}><span /><i /><b>{index + 1}</b></div>
                <div><strong>{step.title}</strong><small>{step.meta} · 방금 전</small></div><em>⋮</em>
              </div>
            ))}
          </div>
          <div className={styles.panelFooter}><button type="button" className={styles.pauseButton}>Ⅱ</button><span>3 steps 저장됨</span><button type="button">녹화 완료</button></div>
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
          <div className={styles.editorBrand}><span className={styles.parroMark}>P</span><strong>Parro</strong><button type="button">＋</button></div>
          <div className={styles.editorDocTitle}><small>내 매뉴얼　›</small><strong>신규 입사자 온보딩</strong><span><i /> 모든 변경사항 저장됨</span></div>
          <p>스텝 <b>4</b></p>
          {['온보딩 문서 열기', '파일 메뉴 펼치기', '공유 설정 열기', '링크 복사'].map((step, index) => <div className={index === 2 ? styles.activeEditorStep : ''} key={step}><div className={styles.editorThumb}><span /><i /></div><span>{index + 1}</span><b>{step}</b><em>⋮</em></div>)}
          <button className={styles.addStep} type="button">＋ 스텝 추가</button>
        </aside>
        <main className={styles.editorCanvas}>
          <div className={styles.editorTop}><div className={styles.annotationTools}><span title="선택">↖</span><span title="화살표">↗</span><span title="박스">□</span><span title="텍스트">T</span><span title="모자이크">▦</span><i /><span>−</span><b>100%</b><span>＋</span></div><div className={styles.editorActions}><span>↶　↷</span><b>AI 설명 완성</b><button type="button">공유</button></div></div>
          <div className={styles.canvasCard}>
            <div className={styles.canvasMeta}><span>STEP 03</span><em>자동 저장됨</em></div><h4>오른쪽 위의 공유 버튼을 클릭하세요</h4><p>팀원이 문서를 확인할 수 있도록 링크 접근 권한을 설정합니다.</p>
            <div className={styles.canvasMock}><div className={styles.miniDocsHeader}><b>신규 입사자 온보딩</b><span>MK　SL</span><button type="button">🔒 공유</button></div><div className={styles.miniDocPage}><strong>신규 입사자 첫날 체크리스트</strong><i /><i /><i /><div><span>✓ 회사 이메일 생성</span><span>✓ Slack 워크스페이스 초대</span></div></div><button className={styles.annotatedShare} type="button">🔒 공유</button><svg className={styles.drawArrow} viewBox="0 0 190 110" aria-hidden="true"><path d="M12 96 C58 90, 94 46, 158 28"/><path d="M140 18 L164 27 L146 46"/></svg><span className={styles.annotationLabel}>여기를 클릭</span></div>
          </div>
          <div className={styles.sharePopover}>
            <div className={styles.shareHeader}><div><strong>매뉴얼 공유</strong><small>신규 입사자 온보딩</small></div><button type="button">×</button></div>
            <div className={styles.publishRow}><span><b>웹 링크 공개</b><small>링크가 있는 모든 사용자가 볼 수 있어요</small></span><i><em /></i></div>
            <div className={styles.accessRow}><span>👥</span><div><small>일반 액세스</small><b>링크가 있는 모든 사용자</b></div><em>보기 전용　⌄</em></div>
            <strong className={styles.exportTitle}>파일로 내보내기</strong>
            <div className={styles.exportIcons}>{['Web', 'PPTX', 'Word', 'PDF'].map((label, index) => <span style={{ '--export': index } as React.CSSProperties} key={label}><i>{label.slice(0, 1)}</i>{label}</span>)}</div>
            <div className={styles.shareLink}><span>parro.so/p/onboarding-guide</span><button type="button">링크 복사</button></div>
            <div className={styles.copiedToast}>✓ 링크를 복사했습니다</div>
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
        <div className={styles.govUtility}>이 누리집은 대한민국 공식 전자정부 누리집입니다.<span>로그인　회원가입　정부24 이용안내</span></div>
        <header><strong><span>●</span> 정부24</strong><div className={styles.govSearch}>찾으시는 서비스를 입력하세요 <span>⌕</span></div><nav>민원서비스　혜택알리미　정책정보　고객센터</nav></header>
        <div className={styles.govNav}><span>MyGOV</span><b>민원서비스</b><span>보조금24</span><span>정책정보</span><span>고객센터</span></div>
        <div className={styles.govContent}>
          <small>홈 〉 민원서비스 〉 증명서 발급</small><div className={styles.govTitle}><div><h4>주민등록표 등본(초본) 발급</h4><span>주민등록법 시행규칙 : 별지서식 1호</span></div><button type="button">☆ 관심 서비스</button></div>
          <div className={styles.govNotice}><b>서비스 안내</b><span>주민등록표 등본 또는 초본을 인터넷으로 발급받을 수 있습니다.</span></div>
          <div className={styles.govInfo}><div><b>신청방법</b><span>인터넷, 방문, 무인발급기</span></div><div><b>수수료</b><span>온라인 발급 무료</span></div><div><b>처리기간</b><span>즉시 처리</span></div></div>
          <div className={styles.govForm}><strong>신청 정보</strong><label>신청인 이름<div className={styles.typedInput}><input aria-label="신청인 이름" value="" readOnly /><span>홍길동</span><i /></div></label><label className={styles.govSelect}>발급 형태<div>전체 발급 <span>⌄</span></div></label></div>
          <button className={styles.applyButton} type="button">발급하기</button>
          <span className={styles.guideSpotlight} />
          <div className={styles.guidePointer}><Pointer /></div>
          <div className={styles.avatar}><Image src="/brand/parro-mark.svg" alt="" width={32} height={32} /></div>
          <div className={styles.guideBubble}><span>파란 발급하기 버튼을 클릭하세요</span></div>
          <div className={styles.guideProgress}><span><b>3</b> / 4</span><i><em /></i></div>
          <div className={styles.successToast}><b>✓</b><span>다음 단계로 이동했어요<small>신청 정보를 확인해 주세요</small></span></div>
          <div className={styles.nextScreen}><span>✓</span><div><small>신청 단계 4 / 4</small><strong>발급 정보를 확인해 주세요</strong><p>입력한 내용을 확인한 뒤 민원 신청을 완료합니다.</p></div><button type="button">신청하기</button></div>
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

  const handleTabKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % SCENES.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + SCENES.length) % SCENES.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = SCENES.length - 1;
    else return;

    event.preventDefault();
    selectScene(nextIndex);
    document.getElementById(`product-demo-tab-${nextIndex}`)?.focus();
  }, [selectScene]);

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
            <button id={`product-demo-tab-${index}`} key={scene.tab} type="button" role="tab" aria-selected={active === index} aria-controls="product-demo-panel" tabIndex={active === index ? 0 : -1} className={active === index ? styles.activeTab : ''} onClick={() => selectScene(index)} onKeyDown={(event) => handleTabKeyDown(event, index)}>
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
