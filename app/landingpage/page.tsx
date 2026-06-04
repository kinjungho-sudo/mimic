'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';

const CheckIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const XIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const features = [
  {
    icon: (
      // 번개 / 빠른 생성
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinejoin="round"/>
      </svg>
    ),
    title: '30초 매뉴얼 완성',
    body: '웹에서 평소처럼 작업하기만 하면 자동으로 단계가 나뉘고, AI가 설명까지 완성합니다.',
    comingSoon: false,
  },
  {
    icon: (
      // 연필 / 편집
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinejoin="round"/>
        <path d="m15 5 4 4" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>
      </svg>
    ),
    title: '클릭 한 번 AI 편집',
    body: '텍스트를 클릭하면 바로 편집. AI 다듬기로 어색한 표현을 자연스럽게 고쳐줍니다.',
    comingSoon: false,
  },
  {
    icon: (
      // 마이크 / 음성
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="9" y="2" width="6" height="11" rx="3" fill="rgba(255,255,255,0.9)"/>
        <path d="M5 10a7 7 0 0 0 14 0" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        <line x1="12" y1="19" x2="12" y2="22" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="9" y1="22" x2="15" y2="22" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'AI 자막 · 음성',
    body: '스크린샷만 캡처해도 자막과 음성이 자동 생성됩니다. 마음에 안 들면 직접 조정 가능.',
    comingSoon: true,
  },
  {
    icon: (
      // 돋보기 / 줌인
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="10" cy="10" r="7" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8"/>
        <circle cx="10" cy="10" r="4" fill="rgba(255,255,255,0.25)"/>
        <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M8 10h4M10 8v4" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: '장면 줌인',
    body: '시작·종료 장면을 드래그로 지정하면 영상 같은 줌 효과가 자동 적용됩니다.',
    comingSoon: true,
  },
  {
    icon: (
      // 링크 / 공유
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="rgba(255,255,255,0.65)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      </svg>
    ),
    title: '링크 한 줄로 공유',
    body: '완성된 매뉴얼은 링크 하나로 어디든 공유. 앱 설치 없이 바로 보고 따라할 수 있습니다.',
    comingSoon: false,
  },
];

const useCases = [
  {
    emoji: '🎧',
    tag: 'CS · 고객지원',
    title: '반복 문의, 이제 링크 하나로 끝내세요',
    body: '고객이 매번 묻는 설정법, 오류 해결 방법을 인터랙티브 매뉴얼로 만들어 링크만 공유하세요. 답변 시간이 줄고, 고객 만족도는 올라갑니다.',
  },
  {
    emoji: '🧑‍💼',
    tag: '사내 교육 · 온보딩',
    title: '신입이 처음부터 혼자 따라할 수 있게',
    body: '사내 툴 사용법, ERP 입력 방법, 결재 프로세스를 화면 그대로 녹화해 매뉴얼로. 구두 설명 없이도 누구나 보고 따라합니다.',
  },
  {
    emoji: '📹',
    tag: '크리에이터 · 튜토리얼',
    title: '영상 없이도 영상처럼 설명하세요',
    body: '유튜브 튜토리얼을 만들 시간이 없다면 MIMIC으로 대신하세요. 클릭 한 번에 인터랙티브 가이드가 완성됩니다.',
  },
  {
    emoji: '🏢',
    tag: 'SaaS · 솔루션 기업',
    title: '제품 도입 후 이탈을 막는 가장 빠른 방법',
    body: '고객이 제품을 제대로 쓸 수 있도록 기능별 가이드를 빠르게 제작하고 Help Center에 바로 배포하세요.',
  },
];

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function RevealSection({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div ref={ref} style={{ transition: 'opacity 0.6s ease, transform 0.6s ease', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)', ...style }}>
      {children}
    </div>
  );
}



// 각 스텝 duration(ms) — 합계가 전체 루프 길이
const SCENE_DURATIONS = [3000, 2800, 3000, 2800, 3200];

function HeroDemo() {
  const [scene, setScene] = useState(0);       // 0~4
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tick, setTick]   = useState(0);       // scene 내 경과 ms (애니메이션 트리거용)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = useCallback((idx: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const next = (idx + 1) % SCENE_DURATIONS.length;
      setScene(next);
      setTick(0);
      scheduleNext(next);
    }, SCENE_DURATIONS[idx]);
  }, []);

  useEffect(() => {
    setTick(0);
    scheduleNext(scene);
    // tick을 100ms마다 올려서 각 씬 내부 애니메이션 단계를 구동
    const iv = setInterval(() => setTick(t => t + 100), 100);
    return () => {
      clearInterval(iv);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);


  // 씬별 레이블 (인디케이터용)
  const SCENE_LABELS = ['확장 설치', '녹화 시작', '클릭 캡처', '영역 확대', '완성 & 공유'];
  const SCENE_URLS   = ['chrome://extensions', 'app.notion.so/workspace', 'app.notion.so/workspace', 'app.mimic.so/editor', 'app.mimic.so/play/done'];

  // 씬 렌더 — 내부 Scene 컴포넌트 사용
  // renderScene: 함수 호출 방식 (new 컴포넌트 타입 생성 방지 → 리마운트 없음)
  const renderScene = () => {
    switch(scene) {
      case 0: return Scene0();
      case 1: return Scene1();
      case 2: return Scene2();
      case 3: return Scene3();
      case 4: return Scene4();
      default: return null;
    }
  };

  const Scene0 = () => {
    const clicked = tick >= 1200;
    const recording = tick >= 1800;
    return (
      <div style={{ width: '100%', height: '100%', background: '#1E1E2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* 배경 브라우저 화면 */}
        <div style={{ position: 'absolute', inset: 0, background: '#F8F9FA', opacity: 0.4 }} />
        {/* 확장 팝업 */}
        <div style={{
          position: 'relative', zIndex: 10,
          width: '280px', background: 'white', borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          animation: 'sceneIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          {/* 팝업 헤더 */}
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#6d28d9,#3730a3)', display: 'grid', placeItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>MIMIC Recorder</div>
              <div style={{ fontSize: '11px', color: '#6B7280' }}>크롬 확장 프로그램</div>
            </div>
            <div style={{ marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
          </div>
          {/* 팝업 바디 */}
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>현재 탭에서 녹화를 시작하세요</div>
            <button style={{
              width: '100%', height: '44px', borderRadius: '10px',
              background: clicked ? 'linear-gradient(135deg,#6d28d9,#3730a3)' : 'linear-gradient(135deg,#6d28d9,#3730a3)',
              color: 'white', fontWeight: 700, fontSize: '14px', border: 'none',
              cursor: 'default',
              boxShadow: clicked ? '0 0 0 4px rgba(109,40,217,0.25)' : 'none',
              transform: clicked ? 'scale(0.97)' : 'scale(1)',
              transition: 'all 0.15s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              {recording
                ? <><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FCA5A5', animation: 'rec-blink 1s infinite' }} />녹화 중...</>
                : '▶ 녹화 시작'}
            </button>
            {recording && (
              <div style={{ marginTop: '10px', padding: '8px 12px', background: '#FEF2F2', borderRadius: '8px', fontSize: '11.5px', color: '#EF4444', fontWeight: 500, animation: 'sceneIn 0.3s ease both' }}>
                화면을 클릭하면 자동으로 단계가 캡처됩니다
              </div>
            )}
          </div>
        </div>
        {/* 상태 레이블 */}
        <div style={{ position: 'absolute', top: '16px', left: '16px', background: 'rgba(109,40,217,0.9)', color: 'white', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px', backdropFilter: 'blur(4px)' }}>
          Step 1 · 확장 프로그램 실행
        </div>
      </div>
    );
  };

  // 씬 1: 페이지 이동 + 녹화 오버레이
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const Scene1 = () => {
    const urlTyped = tick >= 600;
    const loaded = tick >= 1400;
    const URL_TEXT = 'app.notion.so/workspace';
    return (
      <div style={{ width: '100%', height: '100%', background: '#F8F9FA', position: 'relative', overflow: 'hidden' }}>
        {/* 가짜 웹페이지 */}
        <div style={{ padding: '24px', opacity: loaded ? 1 : 0, transition: 'opacity 0.4s ease' }}>
          {/* 사이트 헤더 */}
          <div style={{ height: '40px', background: 'white', borderRadius: '8px', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px', marginBottom: '16px' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: '#191919' }} />
            <div style={{ display: 'flex', gap: '16px' }}>
              {['페이지','팀스페이스','설정'].map(t => <div key={t} style={{ fontSize: '12px', color: '#6B7280' }}>{t}</div>)}
            </div>
          </div>
          {/* 페이지 콘텐츠 목업 */}
          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #E5E7EB', padding: '20px' }}>
            <div style={{ height: '22px', background: '#191919', borderRadius: '4px', width: '35%', marginBottom: '16px' }} />
            {[90, 70, 85, 60, 75].map((w, i) => (
              <div key={i} style={{ height: '10px', background: '#F3F4F6', borderRadius: '3px', width: `${w}%`, marginBottom: '8px' }} />
            ))}
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              {['새 페이지','템플릿','가져오기'].map((t,i) => (
                <div key={t} style={{ padding: '6px 12px', borderRadius: '6px', background: i===0 ? '#191919' : '#F3F4F6', color: i===0 ? 'white' : '#6B7280', fontSize: '11px', fontWeight: i===0 ? 600 : 400 }}>{t}</div>
              ))}
            </div>
          </div>
        </div>
        {/* URL 타이핑 레이블 */}
        <div style={{
          position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
          background: 'white', border: '1.5px solid #6d28d9', borderRadius: '8px',
          padding: '6px 14px', fontSize: '12px', color: '#374151', fontFamily: 'monospace',
          boxShadow: '0 4px 16px rgba(109,40,217,0.15)',
          whiteSpace: 'nowrap',
          animation: 'sceneIn 0.3s ease both',
        }}>
          {urlTyped ? URL_TEXT : URL_TEXT.slice(0, Math.floor((tick / 600) * URL_TEXT.length))}
          <span style={{ opacity: tick % 600 < 300 ? 1 : 0, color: '#6d28d9' }}>|</span>
        </div>
        {/* MIMIC 녹화 뱃지 */}
        <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'rgba(10,10,15,0.80)', backdropFilter: 'blur(6px)', borderRadius: '999px', fontSize: '11.5px', color: 'white', fontWeight: 500 }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#EF4444', animation: 'rec-blink 1.2s infinite' }} />
          MIMIC 녹화 중 · 0단계
        </div>
        <div style={{ position: 'absolute', top: '16px', left: '16px', background: 'rgba(109,40,217,0.9)', color: 'white', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px' }}>
          Step 2 · 페이지 이동
        </div>
      </div>
    );
  };

  // 씬 2: 클릭 → 빨간 테두리 하이라이트 + 클릭 ripple + 단계 캡처
  const Scene2 = () => {
    const hovered = tick >= 500;
    const clicked = tick >= 1100;
    const captured = tick >= 1700;
    // 하이라이트 대상 버튼 위치
    return (
      <div style={{ width: '100%', height: '100%', background: '#F8F9FA', display: 'grid', gridTemplateColumns: '180px 1fr' }}>
        {/* 사이드바 */}
        <div style={{ background: 'white', borderRight: '1px solid #E5E7EB', padding: '12px 0' }}>
          {['홈','페이지','데이터베이스','설정','휴지통'].map((t,i) => (
            <div key={t} style={{ padding: '7px 16px', fontSize: '12px', color: i===1 ? '#111827' : '#6B7280', fontWeight: i===1 ? 600 : 400, background: i===1 ? '#F3F4F6' : 'transparent' }}>{t}</div>
          ))}
        </div>
        {/* 메인 콘텐츠 */}
        <div style={{ padding: '20px', position: 'relative' }}>
          <div style={{ height: '18px', background: '#191919', borderRadius: '3px', width: '40%', marginBottom: '14px' }} />
          {/* 클릭 대상 버튼 — 하이라이트 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            {['새 페이지 만들기','템플릿 사용','가져오기'].map((t,i) => (
              <div
                key={t}
                style={{
                  padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: i===0?600:400,
                  background: i===0 ? (clicked ? '#6d28d9' : hovered ? '#F5F3FF' : '#191919') : '#F3F4F6',
                  color: i===0 ? (hovered && !clicked ? '#6d28d9' : 'white') : '#6B7280',
                  border: i===0 && hovered ? '2px solid #EF4444' : '2px solid transparent',
                  boxShadow: i===0 && hovered && !clicked ? '0 0 0 4px rgba(239,68,68,0.15)' : 'none',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                {t}
                {/* 클릭 ripple */}
                {clicked && i===0 && (
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: '8px',
                    background: 'rgba(255,255,255,0.3)',
                    animation: 'ripple 0.4s ease-out both',
                  }} />
                )}
              </div>
            ))}
          </div>
          {[80,65,90,55].map((w,i) => <div key={i} style={{ height: '9px', background: '#F3F4F6', borderRadius: '3px', width: `${w}%`, marginBottom: '7px' }} />)}
          {/* 캡처 완료 토스트 */}
          {captured && (
            <div style={{
              position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', background: '#111827', borderRadius: '999px',
              fontSize: '12px', color: 'white', fontWeight: 500, whiteSpace: 'nowrap',
              animation: 'sceneIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              1단계 캡처됨
            </div>
          )}
        </div>
        {/* MIMIC 오버레이 */}
        <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'rgba(10,10,15,0.80)', backdropFilter: 'blur(6px)', borderRadius: '999px', fontSize: '11.5px', color: 'white', fontWeight: 500 }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#EF4444', animation: 'rec-blink 1.2s infinite' }} />
          {captured ? '1단계 캡처됨' : hovered ? '클릭 감지 중...' : 'MIMIC 녹화 중'}
        </div>
        <div style={{ position: 'absolute', top: '16px', left: '16px', background: 'rgba(109,40,217,0.9)', color: 'white', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px' }}>
          Step 3 · 클릭 하이라이트
        </div>
      </div>
    );
  };

  // 씬 3: 특정 영역 확대 (zoom)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const Scene3 = () => {
    const zooming = tick >= 600;
    const zoomed = tick >= 1200;
    const zoomScale = zoomed ? 1.9 : zooming ? 1.4 : 1;
    return (
      <div style={{ width: '100%', height: '100%', background: '#0D0D14', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* 확대 대상 스크린샷 */}
        <div style={{
          width: '85%', background: 'white', borderRadius: '10px', overflow: 'hidden',
          transform: `scale(${zoomScale})`,
          transition: 'transform 0.6s cubic-bezier(0.34,1.2,0.64,1)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 20px 60px rgba(0,0,0,0.5)',
          transformOrigin: '60% 40%',
        }}>
          <div style={{ height: '28px', background: '#F3F4F6', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '5px', padding: '0 10px' }}>
            {['#FF5F57','#FEBC2E','#28C840'].map(c => <span key={c} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />)}
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '100px', background: '#F9FAFB', borderRadius: '6px', padding: '8px' }}>
                {[75,55,65,75,50].map((w,i) => <div key={i} style={{ height: '7px', background: i===2 ? '#6d28d9' : '#E5E7EB', borderRadius: '2px', width: `${w}%`, marginBottom: '5px' }} />)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: '12px', background: '#111827', borderRadius: '3px', width: '50%', marginBottom: '8px' }} />
                {/* 하이라이트 영역 */}
                <div style={{
                  padding: '8px 10px', background: '#F5F3FF', border: '2px solid #6d28d9', borderRadius: '7px', marginBottom: '6px',
                  boxShadow: zoomed ? '0 0 0 3px rgba(109,40,217,0.20)' : 'none',
                  transition: 'box-shadow 0.4s',
                }}>
                  <div style={{ height: '8px', background: '#DDD6FE', borderRadius: '2px', width: '80%', marginBottom: '4px' }} />
                  <div style={{ height: '8px', background: '#DDD6FE', borderRadius: '2px', width: '60%' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ padding: '5px 12px', background: '#6d28d9', borderRadius: '5px', color: 'white', fontSize: '10px', fontWeight: 600 }}>신청하기</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* 줌 배율 표시 */}
        <div style={{
          position: 'absolute', bottom: '14px', right: '14px',
          background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.18)', borderRadius: '7px',
          padding: '4px 10px', fontSize: '11.5px', color: 'white', fontWeight: 600,
          transition: 'all 0.3s',
        }}>
          {Math.round(zoomScale * 100)}%
        </div>
        {/* 확대 안내 */}
        {zooming && (
          <div style={{
            position: 'absolute', top: '14px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(109,40,217,0.85)', color: 'white', fontSize: '11.5px', fontWeight: 600,
            padding: '5px 14px', borderRadius: '999px', whiteSpace: 'nowrap',
            animation: 'sceneIn 0.3s ease both',
          }}>
            ✦ AI 자동 확대 적용 중
          </div>
        )}
        <div style={{ position: 'absolute', top: '16px', left: '16px', background: 'rgba(109,40,217,0.9)', color: 'white', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px' }}>
          Step 4 · 영역 확대
        </div>
      </div>
    );
  };

  // 씬 4: 완성 + 공유 링크
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const Scene4 = () => {
    const done = tick >= 400;
    const linkReady = tick >= 1000;
    const copied = tick >= 1900;
    return (
      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg,#1E1B4B 0%,#312E81 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ textAlign: 'center', animation: 'sceneIn 0.5s cubic-bezier(0.34,1.4,0.64,1) both' }}>
          {/* 완성 아이콘 */}
          <div style={{
            width: '72px', height: '72px', borderRadius: '20px',
            background: 'linear-gradient(135deg,#6d28d9,#3730a3)',
            margin: '0 auto 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 12px rgba(109,40,217,0.15)',
            animation: done ? 'checkPop 0.5s cubic-bezier(0.34,1.6,0.64,1) both' : 'none',
          }}>
            {done
              ? <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>}
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'white', marginBottom: '6px' }}>매뉴얼 완성!</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>5단계 · 약 30초 소요</div>

          {/* 공유 링크 */}
          {linkReady && (
            <div style={{ animation: 'sceneIn 0.4s cubic-bezier(0.34,1.4,0.64,1) both' }}>
              <div style={{
                display: 'flex', gap: '0', borderRadius: '10px', overflow: 'hidden',
                border: '1.5px solid rgba(255,255,255,0.15)', maxWidth: '380px', margin: '0 auto 12px',
              }}>
                <div style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.07)', fontSize: '11.5px', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  mimic.so/play/abc123xyz
                </div>
                <button style={{
                  padding: '10px 16px', background: copied ? '#10B981' : '#6d28d9',
                  color: 'white', fontSize: '12px', fontWeight: 600, border: 'none',
                  cursor: 'default', transition: 'background 0.3s',
                  flexShrink: 0,
                }}>
                  {copied ? '복사됨 ✓' : '링크 복사'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                {['PDF 다운로드','이메일 공유','Slack 공유'].map(t => (
                  <div key={t} style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>{t}</div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ position: 'absolute', top: '16px', left: '16px', background: 'rgba(109,40,217,0.9)', color: 'white', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px' }}>
          Step 5 · 완성 & 공유
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'relative', maxWidth: '1000px', margin: '0 auto' }}>
      {/* 브라우저 프레임 */}
      <div style={{
        borderRadius: '16px 16px 0 0',
        overflow: 'hidden',
        boxShadow: '0 20px 60px -10px rgba(55,48,163,0.28), 0 40px 80px -20px rgba(17,24,39,0.18)',
        border: '1px solid rgba(55,48,163,0.15)',
        borderBottom: 'none',
      }}>
        {/* 브라우저 상단바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#18181B', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF5F57' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FEBC2E' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28C840' }} />
          <div style={{ flex: 1, margin: '0 12px', padding: '4px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"/></svg>
            <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)' }}>
              {SCENE_URLS[scene]}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '5px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '11px', color: '#FCA5A5', fontWeight: 500, flexShrink: 0 }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', animation: 'rec-blink 1.2s ease-in-out infinite', display: 'inline-block' }} />
            MIMIC 녹화 중
          </div>
        </div>

        {/* 씬 영역 */}
        <div key={scene} style={{ height: '480px', position: 'relative', overflow: 'hidden', animation: 'sceneIn 0.35s ease both' }}>
          {renderScene()}
        </div>
      </div>

      {/* 하단 스텝 인디케이터 */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginTop: '18px' }}>
        {SCENE_LABELS.map((label, i) => {
          const isActive = i === scene;
          const isDone = i < scene;
          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: isActive ? '5px 12px 5px 7px' : '5px 8px',
                borderRadius: '999px',
                border: `1px solid ${isActive ? 'rgba(109,40,217,0.40)' : isDone ? 'rgba(16,185,129,0.30)' : 'rgba(109,40,217,0.12)'}`,
                background: isActive ? 'rgba(109,40,217,0.09)' : isDone ? 'rgba(16,185,129,0.06)' : 'transparent',
                transition: 'all 0.3s ease',
              }}
            >
              <div style={{
                width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                background: isActive ? '#6d28d9' : isDone ? '#10B981' : 'rgba(109,40,217,0.12)',
                color: 'white',
                fontSize: '9px', fontWeight: 700,
                display: 'grid', placeItems: 'center',
                transition: 'all 0.3s ease',
              }}>
                {isDone
                  ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  : <span style={{ color: isActive ? 'white' : '#9CA3AF' }}>{i + 1}</span>
                }
              </div>
              {isActive && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#6d28d9', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section style={{ padding: '90px 0 0', background: 'linear-gradient(160deg, #EDE8FF 0%, #F8F0FF 50%, #FFF0F8 100%)', textAlign: 'center', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '-160px', left: '50%', transform: 'translateX(-50%)', width: '900px', height: '600px', background: 'radial-gradient(ellipse, rgba(109,40,217,0.10) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '0 32px', position: 'relative' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 14px', background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.20)', borderRadius: '999px', fontSize: '12.5px', color: '#6d28d9', fontWeight: 500, marginBottom: '28px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6d28d9', display: 'inline-block', animation: 'pulse-dot 1.8s ease-in-out infinite' }} />
          AI 인터랙티브 매뉴얼 플랫폼
        </span>

        <h1 style={{ margin: '0 auto 20px', fontSize: '56px', lineHeight: 1.25, fontWeight: 700, letterSpacing: '-0.03em', maxWidth: '760px', color: '#0D0D14' }}>
          작업 자체가<br />
          <span style={{
            background: 'linear-gradient(135deg, #6d28d9 0%, #3730a3 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}>곧 기록이 된다.</span>
        </h1>

        <p style={{ fontSize: '17px', color: '#4B5563', maxWidth: '520px', margin: '0 auto 36px', lineHeight: 1.7 }}>
          평소처럼 일하기만 하면 매뉴얼이 완성됩니다.<br />
          캡처부터 공유까지 — 30초면 충분합니다.
        </p>

        <div className="hero-cta-row" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '56px' }}>
          <Link href="/auth/login"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 600, color: 'white', background: '#6d28d9', boxShadow: '0 4px 20px rgba(109,40,217,0.35)', textDecoration: 'none' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            무료로 시작하기
          </Link>
          <Link href="/play/d3febce4cfc9d978baa42b217363d2fd"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 24px', borderRadius: '10px', fontSize: '15px', fontWeight: 500, color: '#4B5563', background: 'white', border: '1.5px solid #E5E7EB', textDecoration: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            데모 보기
          </Link>
        </div>

        <div className="hero-preview">
          <HeroDemo />
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const [billing, setBilling] = useState<'month' | 'year'>('month');
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [proModal, setProModal] = useState<'pro' | 'team' | null>(null);
  const [proEmail, setProEmail] = useState('');
  const [proSubmitted, setProSubmitted] = useState(false);

  const handleProSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    try {
      const res = await fetch('/api/pro-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan_interested: 'pro', source: 'landing' }),
      });
      if (!res.ok) throw new Error(res.statusText);
      setSubmitted(true);
    } catch { /* ignore network/server errors — user can retry */ }
  };

  const handleProPlanSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proEmail)) return;
    try {
      await fetch('/api/pro-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: proEmail, plan_interested: proModal === 'pro' ? 'pro' : 'team', source: 'landing' }),
      });
      setProSubmitted(true);
    } catch { /* ignore */ }
  };

  const prices = { pro: billing === 'month' ? '₩9,900' : '₩8,250' };

  const faqs = [
    { q: '언제든 취소할 수 있나요?', a: '네, 마이페이지에서 언제든 구독을 해지할 수 있어요. 해지 후에도 결제한 기간까지는 모든 기능을 그대로 사용하실 수 있습니다.' },
    { q: '무료 플랜의 매뉴얼은 어떻게 보관되나요?', a: '무료 플랜에서 만든 매뉴얼은 영구 보관됩니다. 매일 만들 수 있는 개수만 3개로 제한되며, 기존에 만든 매뉴얼 열람·편집·공유는 평생 자유롭게 가능합니다.' },
    { q: '어떤 결제 방법을 지원하나요?', a: '국내·해외 주요 신용카드와 카카오페이, 토스페이를 지원합니다. 기업 결제는 세금계산서 발행이 가능합니다.' },
    { q: '플랜은 자유롭게 변경할 수 있나요?', a: '언제든 업그레이드·다운그레이드할 수 있어요. 업그레이드는 즉시 반영되고, 다운그레이드는 다음 결제 주기부터 적용됩니다.' },
    { q: '환불 정책은 어떻게 되나요?', a: '결제 후 7일 이내, 유료 기능을 한 번도 사용하지 않은 경우 전액 환불이 가능합니다. 자세한 내용은 환불 정책 페이지를 참고해주세요.' },
    { q: '팀이나 회사 단위로 사용하려면 어떻게 하나요?', a: '팀 워크스페이스 기능이 곧 출시됩니다. 우선 사용을 원하시면 기업 데모 신청을 통해 베타 액세스를 받으실 수 있습니다.' },
  ];

  return (
    <div style={{ fontFamily: "'Pretendard', 'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif", color: '#111827', background: '#fff', WebkitFontSmoothing: 'antialiased' }}>

      {/* 데모 모달 */}
      {demoOpen && (
        <div onClick={() => setDemoOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0E0E14', borderRadius: '20px', overflow: 'hidden', width: '100%', maxWidth: '880px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>MIMIC 데모 — Supabase Google OAuth 설정하기</span>
              <button onClick={() => setDemoOpen(false)} style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#9CA3AF', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: '16px' }}>×</button>
            </div>
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', margin: '0 auto 20px', display: 'grid', placeItems: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'white', marginBottom: '8px' }}>준비 중입니다</div>
              <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.65, maxWidth: '360px', margin: '0 auto 24px' }}>실제 서비스 데모 영상을 제작 중입니다. 사전예약하시면 출시 즉시 알려드립니다.</p>
              <Link href="/auth/login" onClick={() => setDemoOpen(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '10px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>
                직접 무료로 써보기 →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Pro 플랜 사전예약 모달 */}
      {proModal && (
        <div onClick={() => { setProModal(null); setProSubmitted(false); setProEmail(''); }} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.60)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '440px', boxShadow: '0 40px 80px rgba(0,0,0,0.15)' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', marginBottom: '16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#0D0D14', marginBottom: '6px' }}>{proModal === 'pro' ? 'Pro' : 'Team'} 플랜 사전예약</div>
              <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.6, margin: 0 }}>{proModal === 'pro' ? '출시 즉시 알림 + 얼리버드 할인 혜택을 드립니다.' : '담당자가 직접 연락드려 요금과 도입 조건을 안내해 드립니다.'}</p>
            </div>
            {!proSubmitted ? (
              <form onSubmit={handleProPlanSignup}>
                <input type="email" value={proEmail} onChange={e => setProEmail(e.target.value)} placeholder="이메일 주소" required style={{ width: '100%', height: '46px', padding: '0 14px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', color: '#111827', outline: 'none', boxSizing: 'border-box', marginBottom: '12px', fontFamily: 'inherit' }} />
                <button type="submit" style={{ width: '100%', height: '46px', borderRadius: '10px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer' }}>{proModal === 'pro' ? '사전예약 신청하기' : '도입 문의 신청하기'}</button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px', background: '#F0FDF4', borderRadius: '12px', color: '#15803D', fontSize: '14px', fontWeight: 500 }}>
                ✓ {proModal === 'pro' ? '등록되었습니다. 출시일에 가장 먼저 알려드릴게요!' : '접수되었습니다. 담당자가 곧 연락드릴게요!'}
              </div>
            )}
            <button onClick={() => { setProModal(null); setProSubmitted(false); setProEmail(''); }} style={{ width: '100%', marginTop: '12px', padding: '10px', background: 'none', border: 'none', color: '#9CA3AF', fontSize: '13px', cursor: 'pointer' }}>닫기</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'color-mix(in srgb, var(--mm-bg) 92%, transparent)', backdropFilter: 'saturate(180%) blur(16px)', borderBottom: '1px solid var(--mm-border-light)' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', gap: '32px', height: '64px' }}>
          <Link href="/landingpage" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '15px', color: '#111827', textDecoration: 'none' }}>
            <BrandMark />
            MIMIC
          </Link>
          <nav style={{ display: 'flex', gap: '28px', marginLeft: '8px' }}>
            {['기능', '사용 방법', '요금제', '기업 문의', 'FAQ'].map((item, i) => (
              <a key={item} href={['#features', '#how', '#pricing', '#b2b', '#faq'][i]}
                style={{ fontSize: '14px', color: '#4B5563', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#111827'}
                onMouseLeave={e => e.currentTarget.style.color = '#4B5563'}
              >{item}</a>
            ))}
          </nav>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link href="/auth/login"
              style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: '#4B5563', textDecoration: 'none', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F9FAFB'; (e.currentTarget as HTMLElement).style.color = '#111827'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#4B5563'; }}
            >로그인</Link>
            <Link href="/auth/login"
              style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', boxShadow: '0 2px 8px rgba(55,48,163,0.28)', textDecoration: 'none' }}
            >무료로 시작</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <HeroSection />

      {/* Manifesto */}
      <section style={{ padding: '120px 0', background: '#0D0D14', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(109,40,217,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 32px', textAlign: 'center', position: 'relative' }}>
          <RevealSection>
            <p style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6d28d9', marginBottom: '32px' }}>
              The MIMIC Way
            </p>
            <h2 style={{ fontSize: 'clamp(36px, 5.5vw, 64px)', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.03em', color: 'white', margin: '0 0 24px' }}>
              평소처럼 일하면<br />
              <span style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #818cf8 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                자료가 나온다.
              </span>
            </h2>
            <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.55)', maxWidth: '520px', margin: '0 auto 48px', lineHeight: 1.7, fontWeight: 400 }}>
              녹화 버튼 하나만 켜면 됩니다. 클릭, 입력, 스크롤 — 당신의 모든 동작이 그대로 단계가 되고, AI가 설명을 붙입니다.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
              {[
                { label: '별도 작업 없음', desc: '하던 일을 그대로 하면 됩니다' },
                { label: '30초 완성', desc: 'AI가 즉시 정리합니다' },
                { label: '링크 하나로 공유', desc: '앱 설치 없이 바로 공유' },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{item.label}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.40)' }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Problem */}
      <section style={{ padding: '96px 0', background: '#FAFAFA' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <RevealSection>
          <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#3730a3', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>Problem</span>
          <h2 style={{ textAlign: 'center', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 auto 14px', maxWidth: '720px', lineHeight: 1.2, color: '#0D0D14' }}>이런 문제, 한 번쯤 겪어보셨죠?</h2>
          <p style={{ textAlign: 'center', fontSize: '16px', color: '#6B7280', maxWidth: '560px', margin: '0 auto 56px', lineHeight: 1.65 }}>PDF는 쌓이기만 하고, 영상은 만들기 지옥이고, PPT는 만들다 하루가 갑니다.</p>

          <div className="grid-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {[
              { emoji: '📄', title: 'PDF는 아무도 안 읽어요', body: '200페이지 매뉴얼을 만들어도 신입은 첫 페이지에서 멈춥니다. 검색도 안 되고 따라하기도 어렵죠.', quote: '"매뉴얼 어디 있어요?" — 매일 듣는 말', color: '#FEF3C7' },
              { emoji: '🎥', title: '영상 제작은 지옥이에요', body: '대본 쓰고, 녹화하고, 편집하고, 자막 달면 하루가 그냥 갑니다. 한 줄 수정하려면 처음부터 다시.', quote: '"영상 5분 만드는 데 6시간"', color: '#FEE2E2' },
              { emoji: '🖥️', title: 'PPT는 너무 오래 걸려요', body: '스크린샷 찍고, 자르고, 화살표 그리고, 정렬 맞추다 보면 한 슬라이드에 30분. UI는 또 바뀌어 있고요.', quote: '"디자인은 또 누가 다듬어?"', color: '#e0e7ff' },
            ].map(p => (
              <div key={p.title}
                style={{ padding: '32px', background: 'white', border: '1.5px solid #E5E7EB', borderRadius: '16px', transition: 'all 0.2s ease' }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = '0 12px 32px rgba(17,24,39,0.08)'; el.style.borderColor = '#D1D5DB'; }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.transform = 'none'; el.style.boxShadow = 'none'; el.style.borderColor = '#E5E7EB'; }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: p.color, display: 'grid', placeItems: 'center', marginBottom: '20px', fontSize: '22px' }}>{p.emoji}</div>
                <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '10px', color: '#0D0D14' }}>{p.title}</div>
                <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.65, margin: 0 }}>{p.body}</p>
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed #E5E7EB', fontSize: '13px', color: '#9CA3AF', fontStyle: 'italic' }}>{p.quote}</div>
              </div>
            ))}
          </div>
          </RevealSection>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ padding: '96px 0', background: 'white' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#3730a3', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>How it works</span>
          <h2 style={{ textAlign: 'center', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 auto 14px', maxWidth: '720px', lineHeight: 1.2, color: '#0D0D14' }}>3단계로 끝나는 매뉴얼 제작</h2>
          <p style={{ textAlign: 'center', fontSize: '16px', color: '#6B7280', maxWidth: '540px', margin: '0 auto 64px', lineHeight: 1.65 }}>기존 작업을 평소처럼 하기만 하면 됩니다. 나머지는 AI가 다 합니다.</p>

          <div className="grid-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0', position: 'relative' }}>
            {[
              { num: '01', title: '크롬 확장 설치 후 녹화 시작', body: '웹 작업을 평소처럼 진행하면 클릭 위치와 화면이 자동 캡처됩니다.' },
              { num: '02', title: 'AI가 자동 정리', body: '캡처된 스크린샷을 분석해 단계별 설명과 자막, 항목 마커까지 자동 생성합니다.' },
              { num: '03', title: '링크로 공유', body: '완성된 매뉴얼은 링크 한 줄로 어디든 공유. 보는 사람은 클릭으로 따라하면 끝.' },
            ].map(s => (
              <div key={s.num} style={{ padding: '40px 36px', position: 'relative', zIndex: 1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', color: 'white', fontSize: '16px', fontWeight: 700, marginBottom: '24px', boxShadow: '0 8px 20px rgba(55,48,163,0.28)' }}>{s.num}</span>
                <div style={{ fontSize: '19px', fontWeight: 600, marginBottom: '10px', color: '#0D0D14', letterSpacing: '-0.01em' }}>{s.title}</div>
                <p style={{ fontSize: '14.5px', color: '#6B7280', lineHeight: 1.65, margin: 0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section style={{ padding: '96px 0', background: '#FAFAFA' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#3730a3', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>Use Cases</span>
          <h2 style={{ textAlign: 'center', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 auto 14px', maxWidth: '720px', lineHeight: 1.2, color: '#0D0D14' }}>어떤 팀에서 쓰고 있나요?</h2>
          <p style={{ textAlign: 'center', fontSize: '16px', color: '#6B7280', maxWidth: '540px', margin: '0 auto 56px', lineHeight: 1.65 }}>설명이 필요한 곳이라면 어디든 MIMIC으로 해결할 수 있습니다.</p>

          <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {useCases.map(uc => (
              <div key={uc.tag}
                style={{ padding: '36px', background: 'white', border: '1.5px solid #E5E7EB', borderRadius: '20px', transition: 'all 0.2s ease' }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(55,48,163,0.30)'; el.style.boxShadow = '0 12px 32px rgba(55,48,163,0.07)'; el.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = '#E5E7EB'; el.style.boxShadow = 'none'; el.style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                  <span style={{ fontSize: '28px' }}>{uc.emoji}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#3730a3', background: '#e0e7ff', padding: '4px 10px', borderRadius: '999px', letterSpacing: '0.02em' }}>{uc.tag}</span>
                </div>
                <div style={{ fontSize: '19px', fontWeight: 600, marginBottom: '10px', color: '#0D0D14', letterSpacing: '-0.01em', lineHeight: 1.3 }}>{uc.title}</div>
                <p style={{ fontSize: '14.5px', color: '#6B7280', lineHeight: 1.7, margin: 0 }}>{uc.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '96px 0', background: 'white' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#3730a3', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>Features</span>
          <h2 style={{ textAlign: 'center', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 auto 14px', maxWidth: '720px', lineHeight: 1.2, color: '#0D0D14' }}>한 번 만들면, 세 가지 형태로 살아납니다</h2>
          <p style={{ textAlign: 'center', fontSize: '16px', color: '#6B7280', maxWidth: '560px', margin: '0 auto 64px', lineHeight: 1.65 }}>스크린샷 한 번에 가이드 문서 · 인터랙티브 튜토리얼 · 영상까지.</p>

          <div className="grid-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {features.map(f => (
              <div key={f.title}
                style={{ padding: '28px', background: 'white', border: '1.5px solid #E5E7EB', borderRadius: '16px', transition: 'all 0.2s ease', position: 'relative' }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(55,48,163,0.35)'; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = '0 12px 32px rgba(55,48,163,0.08)'; }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = '#E5E7EB'; el.style.transform = 'none'; el.style.boxShadow = 'none'; }}
              >
                {f.comingSoon && (
                  <span style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '10.5px', fontWeight: 600, color: '#6d28d9', background: '#F5F3FF', padding: '3px 8px', borderRadius: '999px', border: '1px solid #DDD6FE' }}>출시 예정</span>
                )}
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: f.comingSoon ? 'linear-gradient(135deg, #6d28d9 0%, #A78BFA 100%)' : 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', display: 'grid', placeItems: 'center', marginBottom: '18px', boxShadow: '0 4px 12px rgba(55,48,163,0.25)' }}>
                  {f.icon}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#0D0D14' }}>{f.title}</div>
                <p style={{ fontSize: '13.5px', color: '#6B7280', lineHeight: 1.65, margin: 0 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section style={{ padding: '96px 0', background: '#FAFAFA' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#3730a3', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>Why MIMIC</span>
          <h2 style={{ textAlign: 'center', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 auto 56px', maxWidth: '720px', lineHeight: 1.2, color: '#0D0D14' }}>다른 방법과 무엇이 다른가요?</h2>

          <div style={{ background: 'white', border: '1.5px solid #E5E7EB', borderRadius: '20px', overflow: 'hidden' }}>
            {/* Header row */}
            <div className="comparison-row" style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 140px)', borderBottom: '1.5px solid #E5E7EB' }}>
              <div style={{ padding: '18px 28px', fontSize: '13px', color: '#9CA3AF' }}>기능</div>
              {['PPT / 문서', '영상 녹화', 'MIMIC'].map((col, i) => (
                <div key={col} style={{ padding: '18px 0', textAlign: 'center', fontSize: '13.5px', fontWeight: 600, color: i === 2 ? '#3730a3' : '#374151', background: i === 2 ? '#F5F3FF' : 'transparent', borderLeft: '1px solid #F3F4F6' }}>{col}</div>
              ))}
            </div>
            {[
              { label: '제작 시간', vals: ['1~3시간', '2~6시간', '30초~5분'] },
              { label: '클릭으로 따라하기', vals: [false, false, true] },
              { label: 'AI 자동 설명 생성', vals: [false, false, true] },
              { label: '수정 용이성', vals: ['낮음', '낮음', '높음'] },
              { label: 'AI 음성 · 자막', vals: [false, false, '출시 예정'] },
            ].map((row, ri) => (
              <div key={row.label} className="comparison-row" style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 140px)', borderBottom: ri < 5 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ padding: '16px 28px', fontSize: '14px', color: '#374151', display: 'flex', alignItems: 'center' }}>{row.label}</div>
                {row.vals.map((val, i) => (
                  <div key={i} style={{ padding: '16px 0', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', background: i === 2 ? '#FAFAFE' : 'transparent', borderLeft: '1px solid #F3F4F6' }}>
                    {val === true ? (
                      <span style={{ color: '#3730a3' }}><CheckIcon size={16} color="#3730a3" /></span>
                    ) : val === false ? (
                      <XIcon size={16} />
                    ) : (
                      <span style={{ fontSize: '12.5px', color: i === 2 ? '#3730a3' : '#6B7280', fontWeight: i === 2 ? 600 : 400 }}>{val}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: '96px 0', background: 'white' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#3730a3', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>Pricing</span>
          <h2 style={{ textAlign: 'center', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 auto 14px', maxWidth: '720px', lineHeight: 1.2, color: '#0D0D14' }}>필요한 만큼만 결제하세요</h2>
          <p style={{ textAlign: 'center', fontSize: '16px', color: '#6B7280', maxWidth: '560px', margin: '0 auto 40px', lineHeight: 1.65 }}>기본 매뉴얼은 누구나 무료로. 진짜 필요할 때만 업그레이드하세요.</p>

          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
              {(['month', 'year'] as const).map(b => (
                <button key={b} onClick={() => setBilling(b)} style={{ padding: '9px 20px', borderRadius: '9px', fontSize: '13.5px', color: billing === b ? '#111827' : '#6B7280', fontWeight: 500, background: billing === b ? 'white' : 'transparent', boxShadow: billing === b ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', cursor: 'pointer', whiteSpace: 'nowrap', border: 'none', transition: 'all 0.15s' }}>
                  {b === 'month' ? '월간 결제' : <>연간 결제 <span style={{ display: 'inline-block', marginLeft: '6px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', color: '#059669', fontSize: '11px', fontWeight: 600 }}>2개월 무료</span></>}
                </button>
              ))}
            </div>
          </div>

          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', maxWidth: '1100px', margin: '0 auto' }}>
            {([
              {
                name: 'Free', sub: '신용카드 없이 바로 시작', amount: '₩0', per: '/ 월', featured: false,
                planKey: null as null | 'pro' | 'team',
                features: ['매일 매뉴얼 3개', '기본 매뉴얼 작성', 'MIMIC Recorder 확장 설치', '텍스트·도형 편집', '링크 공유 + PDF', '500MB 저장 공간'],
                cta: '무료로 시작',
              },
              {
                name: 'Pro', sub: '개인 크리에이터와 파워 유저', amount: prices.pro, per: '/ 월', featured: true,
                planKey: 'pro' as const,
                features: ['매뉴얼 무제한 생성', 'AI 다듬기 무제한', '줌인 + 자막 효과 (출시 예정)', 'AI 음성 (출시 예정)', 'HTML·MD 내보내기', '비공개 + 비밀번호 보호', '5GB 저장 공간'],
                cta: '출시 알림 받기',
              },
              {
                name: 'Team', sub: '팀·기업을 위한 맞춤 플랜', amount: '협의', per: '', featured: false,
                planKey: 'team' as const,
                features: ['Pro 플랜 모든 기능', '팀 워크스페이스', '멤버 권한 관리', '무제한 저장 공간', '전용 온보딩 지원', '세금계산서 발행', '우선 지원 (SLA)'],
                cta: '도입 문의하기',
              },
            ] as const).map(plan => (
              <div key={plan.name} style={{ background: 'white', border: plan.featured ? '2px solid #3730a3' : '1.5px solid #E5E7EB', borderRadius: '20px', padding: '36px 28px', position: 'relative', transform: plan.featured ? 'translateY(-10px)' : 'none', boxShadow: plan.featured ? '0 16px 48px rgba(55,48,163,0.12), 0 4px 12px rgba(17,24,39,0.06)' : 'none' }}>
                {plan.featured && <span style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', color: 'white', padding: '5px 14px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>가장 인기</span>}
                <div style={{ fontSize: '14px', fontWeight: 700, color: plan.featured ? '#3730a3' : '#6B7280', marginBottom: '4px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{plan.name}</div>
                <div style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '24px' }}>{plan.sub}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '24px' }}>
                  <span style={{ fontSize: plan.amount === '협의' ? '32px' : '42px', fontWeight: 700, letterSpacing: '-0.03em', color: '#0D0D14', lineHeight: 1 }}>{plan.amount}</span>
                  {plan.per && <span style={{ fontSize: '13.5px', color: '#9CA3AF', fontWeight: 400, paddingBottom: '4px' }}>{plan.per}</span>}
                </div>
                {plan.planKey ? (
                  <button onClick={() => { setProModal(plan.planKey as 'pro' | 'team'); setProSubmitted(false); setProEmail(''); }} style={{ display: 'block', width: '100%', margin: '0 0 28px', padding: '13px 0', borderRadius: '10px', fontSize: '14px', fontWeight: 600, textAlign: 'center', cursor: 'pointer', background: plan.featured ? 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)' : 'white', color: plan.featured ? 'white' : '#374151', border: plan.featured ? 'none' : '1.5px solid #E5E7EB', boxShadow: plan.featured ? '0 4px 12px rgba(55,48,163,0.28)' : 'none', fontFamily: 'inherit' }}>{plan.cta}</button>
                ) : (
                  <Link href="/auth/login" style={{ display: 'block', width: '100%', margin: '0 0 28px', padding: '13px 0', borderRadius: '10px', fontSize: '14px', fontWeight: 600, textAlign: 'center', textDecoration: 'none', background: 'white', color: '#374151', border: '1.5px solid #E5E7EB' }}>{plan.cta}</Link>
                )}
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13.5px', color: '#4B5563', padding: '7px 0' }}>
                      <span style={{ flexShrink: 0, marginTop: '2px' }}><CheckIcon size={14} color="#3730a3" /></span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* B2B */}
      <section id="b2b" style={{ padding: '96px 0', background: 'radial-gradient(800px 320px at 80% 0%, rgba(109,40,217,0.20), transparent 60%), radial-gradient(700px 320px at 20% 100%, rgba(55,48,163,0.20), transparent 60%), #0A0A0F', color: 'white' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#A78BFA', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>For Enterprise</span>
          <h2 style={{ textAlign: 'center', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 auto 16px', maxWidth: '720px', lineHeight: 1.2, color: 'white' }}>팀 전체가 같은 방식으로<br/>일할 수 있게</h2>
          <p style={{ textAlign: 'center', fontSize: '16px', color: '#9CA3AF', maxWidth: '560px', margin: '0 auto 56px', lineHeight: 1.65 }}>반복 문의를 줄이고, 온보딩 시간을 단축하고, 지식을 조직 전체에 공유하세요. 기업 맞춤 도입 상담을 진행합니다.</p>

          <div className="b2b-btns" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <a href="mailto:hello@mimicflow.com?subject=기업 데모 신청" style={{ display: 'inline-flex', alignItems: 'center', padding: '15px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 600, background: 'white', color: '#111827', textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>기업 데모 신청하기</a>
            <a href="mailto:hello@mimicflow.com?subject=자료 요청" style={{ display: 'inline-flex', alignItems: 'center', padding: '15px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', textDecoration: 'none' }}>자료 다운로드</a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: '96px 0', background: 'white' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#3730a3', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>FAQ</span>
          <h2 style={{ textAlign: 'center', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 auto 14px', maxWidth: '720px', lineHeight: 1.2, color: '#0D0D14' }}>자주 묻는 질문</h2>
          <p style={{ textAlign: 'center', fontSize: '16px', color: '#6B7280', maxWidth: '560px', margin: '0 auto 64px', lineHeight: 1.65 }}>결제, 사용법, 보안까지. 더 궁금한 점은 1:1 문의로 보내주세요.</p>

          <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{ borderBottom: '1px solid #F3F4F6', overflow: 'hidden' }}>
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', padding: '22px 0', fontSize: '15.5px', fontWeight: 500, color: faqOpen === i ? '#3730a3' : '#111827', cursor: 'pointer', background: 'none', border: 'none', transition: 'color 0.15s' }}
                >
                  {faq.q}
                  <span style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%', background: faqOpen === i ? '#e0e7ff' : '#F9FAFB', display: 'grid', placeItems: 'center', color: faqOpen === i ? '#3730a3' : '#9CA3AF', transform: faqOpen === i ? 'rotate(45deg)' : 'none', transition: 'all 0.2s ease' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </span>
                </button>
                {faqOpen === i && (
                  <div style={{ paddingBottom: '22px', fontSize: '14.5px', color: '#6B7280', lineHeight: 1.7, maxWidth: '94%' }}>{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '0 0 96px', background: '#FAFAFA' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <div className="final-cta-inner" style={{ background: 'linear-gradient(135deg, #3730A3 0%, #3730a3 40%, #6d28d9 100%)', borderRadius: '28px', padding: '80px 56px', textAlign: 'center', color: 'white', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-100px', left: '-60px', width: '280px', height: '280px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '36px 36px', pointerEvents: 'none' }} />

            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', fontSize: '12px', fontWeight: 600, marginBottom: '20px', position: 'relative', letterSpacing: '0.02em' }}>
              ★ Pro 출시 알림 받기 · 사전예약
            </span>
            <h2 style={{ fontSize: '42px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 16px', position: 'relative', lineHeight: 1.15 }}>30초 만에 첫 매뉴얼을<br/>만들어보세요</h2>
            <p style={{ fontSize: '17px', opacity: 0.85, maxWidth: '520px', margin: '0 auto 36px', position: 'relative', lineHeight: 1.6 }}>MIMIC Recorder 확장 설치 → 평소처럼 작업 → 링크 한 줄로 공유. 그게 전부입니다.</p>

            {!submitted ? (
              <form onSubmit={handleProSignup} style={{ position: 'relative', display: 'flex', gap: '8px', maxWidth: '440px', margin: '0 auto 28px', padding: '6px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: '14px' }}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jungho@company.com" required style={{ flex: 1, height: '46px', padding: '0 16px', border: 'none', background: 'rgba(255,255,255,0.95)', borderRadius: '9px', fontSize: '14px', color: '#111827', outline: 'none' }} />
                <button type="submit" style={{ height: '46px', padding: '0 20px', borderRadius: '9px', background: 'white', color: '#3730a3', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', cursor: 'pointer', border: 'none' }}>사전예약 →</button>
              </form>
            ) : (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', margin: '0 auto 28px', padding: '12px 20px', borderRadius: '999px', background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.40)', color: '#D1FAE5', fontSize: '14px', fontWeight: 500 }}>
                <CheckIcon size={14} color="#6EE7B7" /> 등록되었습니다. Pro 출시일에 가장 먼저 알려드릴게요.
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', position: 'relative' }}>
              <Link href="/auth/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '15px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 700, background: 'white', color: '#3730a3', textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                무료로 시작하기
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
              <a href="mailto:hello@mimicflow.com?subject=기업 데모 신청" style={{ display: 'inline-flex', alignItems: 'center', padding: '15px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 500, color: 'rgba(255,255,255,0.9)', border: '1.5px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', textDecoration: 'none' }}>기업 데모 신청</a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0D0D14', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '64px 0 32px', fontSize: '13px', color: '#6B7280' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4, 1fr)', gap: '48px', paddingBottom: '48px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <Link href="/landingpage" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '15px', color: 'white', textDecoration: 'none' }}>
                <BrandMark /> MIMIC
              </Link>
              <p style={{ maxWidth: '280px', fontSize: '13px', color: '#4B5563', margin: '14px 0 20px', lineHeight: 1.7 }}>
                길게 설명할 필요 없어요. 보고 따라 하게 만드세요.<br/>
                <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '11px', opacity: 0.6 }}>Don&apos;t Explain, Just Mimic.</span>
              </p>
            </div>
            {[
              { title: '제품', links: ['기능', '사용 방법', '요금제', '변경 사항'] },
              { title: '회사', links: ['소개', '블로그', '채용', '기업 문의'] },
              { title: '지원', links: ['이용 가이드', 'FAQ', '고객센터', '상태 페이지'] },
              { title: '법적 고지', links: ['이용약관', '개인정보처리방침', '보안', '환불 정책'] },
            ].map(col => (
              <div key={col.title}>
                <h5 style={{ margin: '0 0 18px', fontSize: '11.5px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{col.title}</h5>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {col.links.map(l => (
                    <li key={l} style={{ padding: '5px 0' }}>
                      <a href="#" style={{ color: '#4B5563', textDecoration: 'none', transition: 'color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#9CA3AF'}
                        onMouseLeave={e => e.currentTarget.style.color = '#4B5563'}
                      >{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '24px', fontSize: '12px', color: '#374151' }}>
            <div>© 2026 코마인드웍스 · MIMIC</div>
            <div style={{ display: 'flex', gap: '20px' }}>
              {['한국어', 'English', 'hello@mimicflow.com'].map(l => (
                <a key={l} href="#" style={{ color: '#374151', textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#6B7280'}
                  onMouseLeave={e => e.currentTarget.style.color = '#374151'}
                >{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes avatarPopIn {
          0% { transform: scale(0.6); opacity: 0; }
          70% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes sceneIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ripple {
          from { transform: scale(1); opacity: 0.6; }
          to   { transform: scale(2.2); opacity: 0; }
        }
        @keyframes checkPop {
          0%   { transform: scale(0.5) rotate(-20deg); opacity: 0; }
          60%  { transform: scale(1.15) rotate(5deg);  opacity: 1; }
          100% { transform: scale(1) rotate(0deg);     opacity: 1; }
        }
@keyframes rec-blink {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
          50% { opacity: 0.6; box-shadow: 0 0 0 4px rgba(239,68,68,0); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 6px rgba(55,48,163,0.22), 0 2px 8px rgba(55,48,163,0.5); }
          50% { box-shadow: 0 0 0 12px rgba(55,48,163,0.10), 0 2px 8px rgba(55,48,163,0.5); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @keyframes markerPop {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          60% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }

        /* 모바일 반응형 */
        @media (max-width: 768px) {
          header nav { display: none !important; }
          header > div { padding: 0 16px !important; }

          h1 { font-size: 36px !important; }
          section { padding: 64px 0 !important; }
          section > div { padding: 0 16px !important; }

          .hero-preview { display: none !important; }
          .hero-cta-row { flex-direction: column !important; align-items: stretch !important; }

          .grid-3col { grid-template-columns: 1fr !important; }
          .grid-2col { grid-template-columns: 1fr !important; }


          .pricing-grid { grid-template-columns: 1fr !important; }
          .pricing-grid > div { transform: none !important; }

          .comparison-row { grid-template-columns: 1fr repeat(4, 80px) !important; font-size: 11px !important; }

          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 28px !important; }

          .b2b-btns { flex-direction: column !important; align-items: center !important; }
          .final-cta-inner { padding: 48px 20px !important; }
          .final-cta-inner h2 { font-size: 28px !important; }
        }

        @media (max-width: 480px) {
          h1 { font-size: 28px !important; }
          h2 { font-size: 24px !important; }
          .comparison-row { font-size: 10px !important; grid-template-columns: 1fr repeat(4, 64px) !important; }
        }
      `}</style>
    </div>
  );
}
