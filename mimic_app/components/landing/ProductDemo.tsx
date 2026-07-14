'use client';

/* eslint-disable @next/next/no-img-element -- Public guide captures are user-generated Supabase assets. */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import styles from './ProductDemo.module.css';

type GuideStep = {
  title: string;
  description: string;
  screenshotUrl: string;
  hotspotX: number;
  hotspotY: number;
};

const GUIDE_STEPS: GuideStep[] = [
  {
    title: '가족관계증명서 선택',
    description: '정부24 메인 페이지의 자주 찾는 서비스에서 가족관계증명서를 클릭합니다.',
    screenshotUrl: 'https://gqynptpjomcqzxyykqic.supabase.co/storage/v1/object/public/naviaction/81d0d80d-e3b6-420e-aaad-3b70a73f02c6/step_01.jpg',
    hotspotX: 41.8,
    hotspotY: 54.4,
  },
  {
    title: '발급하기 버튼 클릭',
    description: '우측 하단의 파란색 발급하기 버튼을 클릭합니다.',
    screenshotUrl: 'https://gqynptpjomcqzxyykqic.supabase.co/storage/v1/object/public/naviaction/81d0d80d-e3b6-420e-aaad-3b70a73f02c6/step_02.jpg',
    hotspotX: 74.6,
    hotspotY: 77.9,
  },
  {
    title: '회원 신청하기 선택',
    description: "팝업창에서 '회원 신청하기' 버튼을 클릭합니다.",
    screenshotUrl: 'https://gqynptpjomcqzxyykqic.supabase.co/storage/v1/object/public/naviaction/81d0d80d-e3b6-420e-aaad-3b70a73f02c6/step_03.jpg',
    hotspotX: 46.3,
    hotspotY: 48.3,
  },
  {
    title: '간편인증 수단 선택',
    description: '원하는 간편인증 수단을 선택합니다.',
    screenshotUrl: 'https://gqynptpjomcqzxyykqic.supabase.co/storage/v1/object/public/naviaction/81d0d80d-e3b6-420e-aaad-3b70a73f02c6/step_04.jpg',
    hotspotX: 63.8,
    hotspotY: 61.6,
  },
  {
    title: '인증 요청 페이지로 이동',
    description: '인증 요청 버튼을 눌러 인증 절차를 진행합니다.',
    screenshotUrl: 'https://gqynptpjomcqzxyykqic.supabase.co/storage/v1/object/public/naviaction/81d0d80d-e3b6-420e-aaad-3b70a73f02c6/step_05.jpg',
    hotspotX: 78,
    hotspotY: 82,
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
    <svg width="27" height="32" viewBox="0 0 22 26" fill="none" aria-hidden="true">
      <path d="M4 2 L4 20 L8.5 15.8 L11.4 22.6 L14 21.4 L11.1 14.8 L17 14.8 Z" fill="white" stroke="#111827" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function BrowserChrome() {
  return (
    <div className={styles.browserChrome}>
      <span className={styles.windowDot} />
      <span className={styles.windowDot} />
      <span className={styles.windowDot} />
      <div className={styles.addressBar}>
        <span aria-hidden="true">⌁</span>
        plus.gov.kr
      </div>
      <div className={styles.secureBadge}>실제 캡처</div>
    </div>
  );
}

function GuideFrame({ step, stepIndex, compact = false, reducedMotion = false }: {
  step: GuideStep;
  stepIndex: number;
  compact?: boolean;
  reducedMotion?: boolean;
}) {
  const position = {
    '--hotspot-x': `${step.hotspotX}%`,
    '--hotspot-y': `${step.hotspotY}%`,
  } as CSSProperties;

  return (
    <div className={`${styles.guideFrame} ${compact ? styles.compactFrame : ''} ${reducedMotion ? styles.staticFrame : ''}`} style={position}>
      <BrowserChrome />
      <div className={styles.captureViewport}>
        <img
          src={step.screenshotUrl}
          alt={`${step.title} 실제 매뉴얼 캡처`}
          draggable={false}
          loading={compact ? 'eager' : 'lazy'}
          decoding="async"
        />
        <div className={styles.spotlight} aria-hidden="true" />
        <span className={styles.hotspotRing} aria-hidden="true" />
        <span className={styles.clickPulse} aria-hidden="true" />
        <span className={styles.pointer} aria-hidden="true"><Pointer /></span>
        <div className={styles.coachmark}>
          <span className={styles.coachmarkNumber}>{stepIndex + 1}</span>
          <div>
            <strong>{step.title}</strong>
            <p>{step.description}</p>
          </div>
        </div>
        <div className={styles.progressBadge}>
          <span>{stepIndex + 1} / {GUIDE_STEPS.length}</span>
          <i><em style={{ width: `${((stepIndex + 1) / GUIDE_STEPS.length) * 100}%` }} /></i>
        </div>
      </div>
    </div>
  );
}

export function HeroRecordingDemo() {
  const { ref, playing, reducedMotion } = usePlayback('120px');
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setActive(current => (current + 1) % GUIDE_STEPS.length), 3600);
    return () => window.clearTimeout(timer);
  }, [active, playing]);

  return (
    <div ref={ref} className={styles.heroDemo} data-playing={playing}>
      <div className={styles.heroEyebrow}>
        <span><i /> 실제 생성된 가이드</span>
        <b>5단계</b>
      </div>
      <GuideFrame key={active} step={GUIDE_STEPS[active]} stepIndex={active} compact reducedMotion={reducedMotion} />
      <div className={styles.heroStepDots} aria-label={`현재 ${active + 1}단계`}>
        {GUIDE_STEPS.map((step, index) => (
          <button
            key={step.title}
            type="button"
            aria-label={`${index + 1}단계 ${step.title}`}
            aria-current={active === index ? 'step' : undefined}
            onClick={() => setActive(index)}
          />
        ))}
      </div>
    </div>
  );
}

export function ProductDemo() {
  const { ref, playing, reducedMotion } = usePlayback();
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);

  const selectStep = useCallback((index: number) => {
    setActive(index);
    setCycle(value => value + 1);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setActive(current => (current + 1) % GUIDE_STEPS.length);
      setCycle(value => value + 1);
    }, 4800);
    return () => window.clearTimeout(timer);
  }, [active, cycle, playing]);

  return (
    <section id="tour" className={styles.productSection}>
      <div ref={ref} className={styles.productInner} data-playing={playing}>
        <div className={styles.sectionHeading}>
          <span>REAL PARRO GUIDE</span>
          <h2>샘플이 아니라, 실제 만든 가이드가 움직입니다</h2>
          <p>Parro로 녹화한 화면과 단계 설명, 클릭 위치를 그대로 사용했습니다. 사용자는 안내를 보며 실제 업무 순서를 자연스럽게 익힙니다.</p>
        </div>

        <div className={styles.demoShell}>
          <div className={styles.stageColumn} data-playing={playing}>
            <div className={styles.stageTopline}>
              <div>
                <span className={styles.livePill}><i /> 실제 매뉴얼</span>
                <strong>정부24에서 가족관계증명서 발급받기</strong>
              </div>
              <span className={styles.stepCount}>{GUIDE_STEPS.length}단계 학습 가이드</span>
            </div>
            <GuideFrame key={`${active}-${cycle}`} step={GUIDE_STEPS[active]} stepIndex={active} reducedMotion={reducedMotion} />
          </div>

          <aside className={styles.stepPanel} aria-label="실제 가이드 단계">
            <div className={styles.panelHeader}>
              <span>학습 가이드</span>
              <strong>따라 할 단계를 선택하세요</strong>
            </div>
            <div className={styles.stepList}>
              {GUIDE_STEPS.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  className={active === index ? styles.activeStep : ''}
                  aria-current={active === index ? 'step' : undefined}
                  onClick={() => selectStep(index)}
                >
                  <span>{index + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <small>{active === index ? step.description : `${index + 1}단계 보기`}</small>
                  </div>
                  <i />
                </button>
              ))}
            </div>
            <div className={styles.panelFooter}>
              <span>Parro Recorder로 실제 녹화</span>
              <b>캡처 · 설명 · 핫스팟 자동 생성</b>
            </div>
          </aside>
        </div>

        <p className={styles.motionNote}>
          {reducedMotion ? '모션 감소 설정에 따라 첫 단계 화면만 표시합니다.' : '단계는 자동으로 재생됩니다. 오른쪽 목록을 눌러 원하는 장면을 직접 볼 수도 있습니다.'}
        </p>
      </div>
    </section>
  );
}
