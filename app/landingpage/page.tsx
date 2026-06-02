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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
      </svg>
    ),
    title: '30초 매뉴얼 완성',
    body: '웹에서 평소처럼 작업하기만 하면 자동으로 단계가 나뉘고, AI가 설명까지 완성합니다.',
    comingSoon: false,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
    title: '클릭 한 번 AI 편집',
    body: '텍스트를 클릭하면 바로 편집. AI 다듬기로 어색한 표현을 자연스럽게 고쳐줍니다.',
    comingSoon: false,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
      </svg>
    ),
    title: 'AI 자막 · 음성',
    body: '스크린샷만 캡처해도 자막과 음성이 자동 생성됩니다. 마음에 안 들면 직접 조정 가능.',
    comingSoon: true,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
      </svg>
    ),
    title: '장면 줌인',
    body: '시작·종료 장면을 드래그로 지정하면 영상 같은 줌 효과가 자동 적용됩니다.',
    comingSoon: true,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
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

// 실제 API 데이터 기반 스텝 (주민등록등본 발급하기)
const DEMO_STEPS = [
  {
    num: 1,
    title: '정부24 홈페이지 이동',
    caption: 'plus.gov.kr 링크를 클릭하여 정부24 웹사이트로 이동합니다.',
    url: 'plus.gov.kr',
    img: 'https://gqynptpjomcqzxyykqic.supabase.co/storage/v1/object/public/naviaction/68ca51fc-104b-43c9-bdfc-52d0e51570b9/step_02.jpg',
  },
  {
    num: 2,
    title: '주민등록표 등본 발급 페이지 이동',
    caption: '주민등록표 등본(초본) 발급 서비스 페이지로 이동하여 신청 절차를 확인합니다.',
    url: 'www.gov.kr/mw/AA020InfoCappView.do',
    img: 'https://gqynptpjomcqzxyykqic.supabase.co/storage/v1/object/public/naviaction/68ca51fc-104b-43c9-bdfc-52d0e51570b9/step_03.jpg',
  },
  {
    num: 3,
    title: '간편인증 버튼 클릭',
    caption: '네이버, 카카오 등의 전자서명으로 로그인하는 간편인증 버튼을 클릭합니다.',
    url: 'plus.gov.kr/login',
    img: 'https://gqynptpjomcqzxyykqic.supabase.co/storage/v1/object/public/naviaction/68ca51fc-104b-43c9-bdfc-52d0e51570b9/step_06.jpg',
  },
  {
    num: 4,
    title: '민원 신청 페이지 이동',
    caption: '민원 신청 양식 페이지에서 주소 및 발급형태를 선택하고 신청하기를 클릭합니다.',
    url: 'plus.gov.kr/minwon/apply',
    img: 'https://gqynptpjomcqzxyykqic.supabase.co/storage/v1/object/public/naviaction/68ca51fc-104b-43c9-bdfc-52d0e51570b9/step_09.jpg',
  },
  {
    num: 5,
    title: '[신청하기] 버튼 클릭',
    caption: '주민등록상 주소 및 발급형태 선택 후 우측 하단의 신청하기 버튼을 클릭합니다.',
    url: 'plus.gov.kr/minwon/apply',
    img: 'https://gqynptpjomcqzxyykqic.supabase.co/storage/v1/object/public/naviaction/68ca51fc-104b-43c9-bdfc-52d0e51570b9/step_12.jpg',
  },
];

const CYCLE_WORDS = ['자동으로 완성', '바로 공유', 'AI가 생성', '링크 하나로'];
const WORD_INTERVAL_MS = 2500;
const WORD_ANIM_MS = 350;

type WordPhase = 'idle' | 'exit' | 'enter';

function useWordCycle(words: string[]) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<WordPhase>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(function tick() {
      setPhase('exit');
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % words.length);
        setPhase('enter');
        setTimeout(() => {
          setPhase('idle');
          timerRef.current = setTimeout(tick, WORD_INTERVAL_MS);
        }, WORD_ANIM_MS);
      }, WORD_ANIM_MS);
    }, WORD_INTERVAL_MS);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [words.length]);

  return { index: currentIndex, phase };
}

function HeroDemo() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback((idx: number) => {
    setAnimating(true);
    setTimeout(() => {
      setActiveIdx(idx);
      setAnimating(false);
    }, 200);
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActiveIdx(prev => {
        const next = (prev + 1) % DEMO_STEPS.length;
        setAnimating(true);
        setTimeout(() => setAnimating(false), 200);
        return next;
      });
    }, 3000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const step = DEMO_STEPS[activeIdx];

  return (
    <div style={{ position: 'relative', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{
        borderRadius: '16px 16px 0 0',
        overflow: 'hidden',
        boxShadow: '0 -4px 0 0 rgba(79,70,229,0.08), 0 20px 60px -10px rgba(79,70,229,0.25), 0 40px 80px -20px rgba(17,24,39,0.18)',
        border: '1px solid rgba(79,70,229,0.15)',
        borderBottom: 'none',
      }}>
        {/* 브라우저 상단바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF5F57' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FEBC2E' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28C840' }} />
          <div style={{ flex: 1, margin: '0 12px', padding: '4px 12px', borderRadius: '6px', background: 'white', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <span style={{ fontSize: '11.5px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {step.url}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '5px', background: 'white', border: '1px solid #E5E7EB', fontSize: '11px', color: '#374151', fontWeight: 500, flexShrink: 0 }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', animation: 'rec-blink 1.4s ease-in-out infinite', display: 'inline-block' }} />
            MIMIC 녹화 중
          </div>
        </div>

        {/* 스크린샷 영역 */}
        <div style={{ position: 'relative', height: '460px', background: '#F8F9FA', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={activeIdx}
            src={step.img}
            alt={step.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top',
              display: 'block',
              opacity: animating ? 0 : 1,
              transition: 'opacity 0.3s ease',
            }}
          />

          {/* 번호 마커 */}
          <div style={{
            position: 'absolute',
            bottom: '28%',
            right: '18%',
            width: '28px', height: '28px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            color: 'white',
            display: 'grid', placeItems: 'center',
            fontSize: '11px', fontWeight: 700,
            boxShadow: '0 0 0 6px rgba(79,70,229,0.22), 0 4px 12px rgba(79,70,229,0.5)',
            opacity: animating ? 0 : 1,
            transition: 'opacity 0.3s ease',
            zIndex: 5,
          }}>
            {step.num}
          </div>

          {/* 하단 그라디언트 + 캡션 */}
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(10,10,20,0.72) 0%, transparent 100%)',
            padding: '40px 24px 20px',
            opacity: animating ? 0 : 1,
            transition: 'opacity 0.3s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '7px', background: '#F59E0B', color: 'white', fontSize: '10px', fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                {String(step.num).padStart(2, '0')}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'white', marginBottom: '3px' }}>{step.title}</div>
                <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>{step.caption}</div>
              </div>
            </div>
          </div>

          {/* 아바타 배지 */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px 8px 8px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.96)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            zIndex: 10,
            animation: 'avatarPopIn 0.3s ease-out 0.5s both',
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
              display: 'grid', placeItems: 'center',
              flexShrink: 0,
              fontSize: '12px', color: 'white', fontWeight: 700,
            }}>
              H
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#111827', lineHeight: 1.2 }}>Henry James</div>
              <div style={{ fontSize: '10px', color: '#6B7280', lineHeight: 1.2 }}>단계 따라하는 중</div>
            </div>
          </div>
        </div>
      </div>

      {/* 하단 스텝 인디케이터 */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '6px',
        marginTop: '20px',
      }}>
        {DEMO_STEPS.map((s, i) => (
          <button
            key={i}
            onClick={() => { if (timerRef.current) clearInterval(timerRef.current); goTo(i); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: i === activeIdx ? '5px 12px 5px 8px' : '5px 10px',
              borderRadius: '999px',
              border: `1px solid ${i === activeIdx ? 'rgba(79,70,229,0.35)' : 'rgba(79,70,229,0.12)'}`,
              background: i === activeIdx ? 'rgba(79,70,229,0.08)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
          >
            <div style={{
              width: '18px', height: '18px', borderRadius: '5px',
              background: i === activeIdx ? '#F59E0B' : 'rgba(79,70,229,0.12)',
              color: i === activeIdx ? 'white' : '#9CA3AF',
              fontSize: '9px', fontWeight: 700,
              display: 'grid', placeItems: 'center',
              flexShrink: 0,
              transition: 'all 0.25s ease',
            }}>
              {String(s.num).padStart(2, '0')}
            </div>
            {i === activeIdx && (
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#4F46E5', whiteSpace: 'nowrap' }}>
                {s.title}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function HeroSection() {
  const { index, phase } = useWordCycle(CYCLE_WORDS);

  const animationStyle: React.CSSProperties =
    phase === 'exit'
      ? { animation: `wordExit ${WORD_ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards` }
      : phase === 'enter'
      ? { animation: `wordEnter ${WORD_ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards` }
      : { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0% 0% 0% 0%)' };

  return (
    <section style={{ padding: '90px 0 0', background: 'linear-gradient(160deg, #EDE8FF 0%, #F8F0FF 50%, #FFF0F8 100%)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-160px', left: '50%', transform: 'translateX(-50%)', width: '900px', height: '600px', background: 'radial-gradient(ellipse, rgba(124,58,237,0.10) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '0 32px', position: 'relative' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 14px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.20)', borderRadius: '999px', fontSize: '12.5px', color: '#7C3AED', fontWeight: 500, marginBottom: '28px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7C3AED', display: 'inline-block', animation: 'pulse-dot 1.8s ease-in-out infinite' }} />
          AI 인터랙티브 매뉴얼 플랫폼
        </span>

        <h1 style={{ margin: '0 auto 20px', fontSize: '56px', lineHeight: 1.2, fontWeight: 700, letterSpacing: '-0.03em', maxWidth: '760px', color: '#0D0D14' }}>
          당신은 그냥 하세요.<br />
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.25em', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span>매뉴얼은</span>
            <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', position: 'relative' }}>
              <span
                key={index}
                style={{
                  display: 'inline-block',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  willChange: 'transform, opacity, clip-path',
                  ...animationStyle,
                }}
              >
                {CYCLE_WORDS[index]}
              </span>
            </span>
            <span>됩니다.</span>
          </span>
        </h1>

        <p style={{ fontSize: '17px', color: '#4B5563', maxWidth: '520px', margin: '0 auto 36px', lineHeight: 1.7 }}>
          MIMIC은 어떤 작업이든 단계별 가이드로 자동 변환합니다.<br />
          캡처부터 공유까지 — 30초면 충분합니다.
        </p>

        <div className="hero-cta-row" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '56px' }}>
          <Link href="/auth/login"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 600, color: 'white', background: '#7C3AED', boxShadow: '0 4px 20px rgba(124,58,237,0.35)', textDecoration: 'none' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/></svg>
            무료 크롬 확장 설치
          </Link>
          <Link href="/auth/login"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 24px', borderRadius: '10px', fontSize: '15px', fontWeight: 500, color: '#4B5563', background: 'white', border: '1.5px solid #E5E7EB', textDecoration: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            데모 체험하기 →
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
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', margin: '0 auto 20px', display: 'grid', placeItems: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'white', marginBottom: '8px' }}>준비 중입니다</div>
              <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.65, maxWidth: '360px', margin: '0 auto 24px' }}>실제 서비스 데모 영상을 제작 중입니다. 사전예약하시면 출시 즉시 알려드립니다.</p>
              <Link href="/auth/login" onClick={() => setDemoOpen(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '10px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>
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
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', marginBottom: '16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#0D0D14', marginBottom: '6px' }}>{proModal === 'pro' ? 'Pro' : 'Team'} 플랜 사전예약</div>
              <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.6, margin: 0 }}>{proModal === 'pro' ? '출시 즉시 알림 + 얼리버드 할인 혜택을 드립니다.' : '담당자가 직접 연락드려 요금과 도입 조건을 안내해 드립니다.'}</p>
            </div>
            {!proSubmitted ? (
              <form onSubmit={handleProPlanSignup}>
                <input type="email" value={proEmail} onChange={e => setProEmail(e.target.value)} placeholder="이메일 주소" required style={{ width: '100%', height: '46px', padding: '0 14px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', color: '#111827', outline: 'none', boxSizing: 'border-box', marginBottom: '12px', fontFamily: 'inherit' }} />
                <button type="submit" style={{ width: '100%', height: '46px', borderRadius: '10px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer' }}>{proModal === 'pro' ? '사전예약 신청하기' : '도입 문의 신청하기'}</button>
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
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.92)', backdropFilter: 'saturate(180%) blur(16px)', borderBottom: '1px solid #F3F4F6' }}>
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
              style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', boxShadow: '0 2px 8px rgba(79,70,229,0.28)', textDecoration: 'none' }}
            >무료로 시작</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <HeroSection />

      {/* Problem */}
      <section style={{ padding: '96px 0', background: '#FAFAFA' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <RevealSection>
          <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#4F46E5', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>Problem</span>
          <h2 style={{ textAlign: 'center', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 auto 14px', maxWidth: '720px', lineHeight: 1.2, color: '#0D0D14' }}>이런 문제, 한 번쯤 겪어보셨죠?</h2>
          <p style={{ textAlign: 'center', fontSize: '16px', color: '#6B7280', maxWidth: '560px', margin: '0 auto 56px', lineHeight: 1.65 }}>PDF는 쌓이기만 하고, 영상은 만들기 지옥이고, PPT는 만들다 하루가 갑니다.</p>

          <div className="grid-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {[
              { emoji: '📄', title: 'PDF는 아무도 안 읽어요', body: '200페이지 매뉴얼을 만들어도 신입은 첫 페이지에서 멈춥니다. 검색도 안 되고 따라하기도 어렵죠.', quote: '"매뉴얼 어디 있어요?" — 매일 듣는 말', color: '#FEF3C7' },
              { emoji: '🎥', title: '영상 제작은 지옥이에요', body: '대본 쓰고, 녹화하고, 편집하고, 자막 달면 하루가 그냥 갑니다. 한 줄 수정하려면 처음부터 다시.', quote: '"영상 5분 만드는 데 6시간"', color: '#FEE2E2' },
              { emoji: '🖥️', title: 'PPT는 너무 오래 걸려요', body: '스크린샷 찍고, 자르고, 화살표 그리고, 정렬 맞추다 보면 한 슬라이드에 30분. UI는 또 바뀌어 있고요.', quote: '"디자인은 또 누가 다듬어?"', color: '#EEF2FF' },
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
          <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#4F46E5', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>How it works</span>
          <h2 style={{ textAlign: 'center', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 auto 14px', maxWidth: '720px', lineHeight: 1.2, color: '#0D0D14' }}>3단계로 끝나는 매뉴얼 제작</h2>
          <p style={{ textAlign: 'center', fontSize: '16px', color: '#6B7280', maxWidth: '540px', margin: '0 auto 64px', lineHeight: 1.65 }}>기존 작업을 평소처럼 하기만 하면 됩니다. 나머지는 AI가 다 합니다.</p>

          <div className="grid-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '28px', left: 'calc(16.7% + 16px)', right: 'calc(16.7% + 16px)', height: '1px', background: 'linear-gradient(90deg, #4F46E5, #7C3AED)', opacity: 0.25, zIndex: 0 }} />
            {[
              { num: '01', title: 'MIMIC Recorder 확장으로 녹화', body: '웹 작업을 평소처럼 진행하면 클릭 위치와 화면이 자동 캡처됩니다.' },
              { num: '02', title: 'AI가 자동 정리', body: '캡처된 스크린샷을 분석해 단계별 설명과 자막, 항목 마커까지 자동 생성합니다.' },
              { num: '03', title: '링크로 공유', body: '완성된 매뉴얼은 링크 한 줄로 어디든 공유. 보는 사람은 클릭으로 따라하면 끝.' },
            ].map(s => (
              <div key={s.num} style={{ padding: '40px 36px', position: 'relative', zIndex: 1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', color: 'white', fontSize: '16px', fontWeight: 700, marginBottom: '24px', boxShadow: '0 8px 20px rgba(79,70,229,0.28)' }}>{s.num}</span>
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
          <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#4F46E5', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>Use Cases</span>
          <h2 style={{ textAlign: 'center', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 auto 14px', maxWidth: '720px', lineHeight: 1.2, color: '#0D0D14' }}>어떤 팀에서 쓰고 있나요?</h2>
          <p style={{ textAlign: 'center', fontSize: '16px', color: '#6B7280', maxWidth: '540px', margin: '0 auto 56px', lineHeight: 1.65 }}>설명이 필요한 곳이라면 어디든 MIMIC으로 해결할 수 있습니다.</p>

          <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {useCases.map(uc => (
              <div key={uc.tag}
                style={{ padding: '36px', background: 'white', border: '1.5px solid #E5E7EB', borderRadius: '20px', transition: 'all 0.2s ease' }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(79,70,229,0.30)'; el.style.boxShadow = '0 12px 32px rgba(79,70,229,0.07)'; el.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = '#E5E7EB'; el.style.boxShadow = 'none'; el.style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                  <span style={{ fontSize: '28px' }}>{uc.emoji}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#4F46E5', background: '#EEF2FF', padding: '4px 10px', borderRadius: '999px', letterSpacing: '0.02em' }}>{uc.tag}</span>
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
          <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#4F46E5', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>Features</span>
          <h2 style={{ textAlign: 'center', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 auto 14px', maxWidth: '720px', lineHeight: 1.2, color: '#0D0D14' }}>한 번 만들면, 세 가지 형태로 살아납니다</h2>
          <p style={{ textAlign: 'center', fontSize: '16px', color: '#6B7280', maxWidth: '560px', margin: '0 auto 64px', lineHeight: 1.65 }}>스크린샷 한 번에 가이드 문서 · 인터랙티브 튜토리얼 · 영상까지.</p>

          <div className="grid-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {features.map(f => (
              <div key={f.title}
                style={{ padding: '28px', background: 'white', border: '1.5px solid #E5E7EB', borderRadius: '16px', transition: 'all 0.2s ease', position: 'relative' }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(79,70,229,0.35)'; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = '0 12px 32px rgba(79,70,229,0.08)'; }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = '#E5E7EB'; el.style.transform = 'none'; el.style.boxShadow = 'none'; }}
              >
                {f.comingSoon && (
                  <span style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '10.5px', fontWeight: 600, color: '#7C3AED', background: '#F5F3FF', padding: '3px 8px', borderRadius: '999px', border: '1px solid #DDD6FE' }}>출시 예정</span>
                )}
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: f.comingSoon ? 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' : 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', display: 'grid', placeItems: 'center', marginBottom: '18px', boxShadow: '0 4px 12px rgba(79,70,229,0.25)' }}>
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
          <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#4F46E5', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>Why MIMIC</span>
          <h2 style={{ textAlign: 'center', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 auto 56px', maxWidth: '720px', lineHeight: 1.2, color: '#0D0D14' }}>다른 방법과 무엇이 다른가요?</h2>

          <div style={{ background: 'white', border: '1.5px solid #E5E7EB', borderRadius: '20px', overflow: 'hidden' }}>
            {/* Header row */}
            <div className="comparison-row" style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 140px)', borderBottom: '1.5px solid #E5E7EB' }}>
              <div style={{ padding: '18px 28px', fontSize: '13px', color: '#9CA3AF' }}>기능</div>
              {['PPT / 문서', '영상 녹화', 'MIMIC'].map((col, i) => (
                <div key={col} style={{ padding: '18px 0', textAlign: 'center', fontSize: '13.5px', fontWeight: 600, color: i === 2 ? '#4F46E5' : '#374151', background: i === 2 ? '#F5F3FF' : 'transparent', borderLeft: '1px solid #F3F4F6' }}>{col}</div>
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
                      <span style={{ color: '#4F46E5' }}><CheckIcon size={16} color="#4F46E5" /></span>
                    ) : val === false ? (
                      <XIcon size={16} />
                    ) : (
                      <span style={{ fontSize: '12.5px', color: i === 2 ? '#4F46E5' : '#6B7280', fontWeight: i === 2 ? 600 : 400 }}>{val}</span>
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
          <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#4F46E5', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>Pricing</span>
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
              <div key={plan.name} style={{ background: 'white', border: plan.featured ? '2px solid #4F46E5' : '1.5px solid #E5E7EB', borderRadius: '20px', padding: '36px 28px', position: 'relative', transform: plan.featured ? 'translateY(-10px)' : 'none', boxShadow: plan.featured ? '0 16px 48px rgba(79,70,229,0.12), 0 4px 12px rgba(17,24,39,0.06)' : 'none' }}>
                {plan.featured && <span style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', color: 'white', padding: '5px 14px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>가장 인기</span>}
                <div style={{ fontSize: '14px', fontWeight: 700, color: plan.featured ? '#4F46E5' : '#6B7280', marginBottom: '4px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{plan.name}</div>
                <div style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '24px' }}>{plan.sub}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '24px' }}>
                  <span style={{ fontSize: plan.amount === '협의' ? '32px' : '42px', fontWeight: 700, letterSpacing: '-0.03em', color: '#0D0D14', lineHeight: 1 }}>{plan.amount}</span>
                  {plan.per && <span style={{ fontSize: '13.5px', color: '#9CA3AF', fontWeight: 400, paddingBottom: '4px' }}>{plan.per}</span>}
                </div>
                {plan.planKey ? (
                  <button onClick={() => { setProModal(plan.planKey as 'pro' | 'team'); setProSubmitted(false); setProEmail(''); }} style={{ display: 'block', width: '100%', margin: '0 0 28px', padding: '13px 0', borderRadius: '10px', fontSize: '14px', fontWeight: 600, textAlign: 'center', cursor: 'pointer', background: plan.featured ? 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' : 'white', color: plan.featured ? 'white' : '#374151', border: plan.featured ? 'none' : '1.5px solid #E5E7EB', boxShadow: plan.featured ? '0 4px 12px rgba(79,70,229,0.28)' : 'none', fontFamily: 'inherit' }}>{plan.cta}</button>
                ) : (
                  <Link href="/auth/login" style={{ display: 'block', width: '100%', margin: '0 0 28px', padding: '13px 0', borderRadius: '10px', fontSize: '14px', fontWeight: 600, textAlign: 'center', textDecoration: 'none', background: 'white', color: '#374151', border: '1.5px solid #E5E7EB' }}>{plan.cta}</Link>
                )}
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13.5px', color: '#4B5563', padding: '7px 0' }}>
                      <span style={{ flexShrink: 0, marginTop: '2px' }}><CheckIcon size={14} color="#4F46E5" /></span>
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
      <section id="b2b" style={{ padding: '96px 0', background: 'radial-gradient(800px 320px at 80% 0%, rgba(124,58,237,0.20), transparent 60%), radial-gradient(700px 320px at 20% 100%, rgba(79,70,229,0.20), transparent 60%), #0A0A0F', color: 'white' }}>
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
          <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#4F46E5', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>FAQ</span>
          <h2 style={{ textAlign: 'center', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 auto 14px', maxWidth: '720px', lineHeight: 1.2, color: '#0D0D14' }}>자주 묻는 질문</h2>
          <p style={{ textAlign: 'center', fontSize: '16px', color: '#6B7280', maxWidth: '560px', margin: '0 auto 64px', lineHeight: 1.65 }}>결제, 사용법, 보안까지. 더 궁금한 점은 1:1 문의로 보내주세요.</p>

          <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{ borderBottom: '1px solid #F3F4F6', overflow: 'hidden' }}>
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', padding: '22px 0', fontSize: '15.5px', fontWeight: 500, color: faqOpen === i ? '#4F46E5' : '#111827', cursor: 'pointer', background: 'none', border: 'none', transition: 'color 0.15s' }}
                >
                  {faq.q}
                  <span style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%', background: faqOpen === i ? '#EEF2FF' : '#F9FAFB', display: 'grid', placeItems: 'center', color: faqOpen === i ? '#4F46E5' : '#9CA3AF', transform: faqOpen === i ? 'rotate(45deg)' : 'none', transition: 'all 0.2s ease' }}>
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
          <div className="final-cta-inner" style={{ background: 'linear-gradient(135deg, #3730A3 0%, #4F46E5 40%, #7C3AED 100%)', borderRadius: '28px', padding: '80px 56px', textAlign: 'center', color: 'white', position: 'relative', overflow: 'hidden' }}>
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
                <button type="submit" style={{ height: '46px', padding: '0 20px', borderRadius: '9px', background: 'white', color: '#4F46E5', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', cursor: 'pointer', border: 'none' }}>사전예약 →</button>
              </form>
            ) : (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', margin: '0 auto 28px', padding: '12px 20px', borderRadius: '999px', background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.40)', color: '#D1FAE5', fontSize: '14px', fontWeight: 500 }}>
                <CheckIcon size={14} color="#6EE7B7" /> 등록되었습니다. Pro 출시일에 가장 먼저 알려드릴게요.
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', position: 'relative' }}>
              <Link href="/auth/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '15px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 700, background: 'white', color: '#4F46E5', textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
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
        @keyframes wordExit {
          0% { opacity: 1; transform: translateY(0); clip-path: inset(0% 0% 0% 0%); }
          100% { opacity: 0; transform: translateY(-100%); clip-path: inset(0% 0% 100% 0%); }
        }
        @keyframes wordEnter {
          0% { opacity: 0; transform: translateY(100%); clip-path: inset(100% 0% 0% 0%); }
          100% { opacity: 1; transform: translateY(0); clip-path: inset(0% 0% 0% 0%); }
        }
        @keyframes rec-blink {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
          50% { opacity: 0.6; box-shadow: 0 0 0 4px rgba(239,68,68,0); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 6px rgba(79,70,229,0.22), 0 2px 8px rgba(79,70,229,0.5); }
          50% { box-shadow: 0 0 0 12px rgba(79,70,229,0.10), 0 2px 8px rgba(79,70,229,0.5); }
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
