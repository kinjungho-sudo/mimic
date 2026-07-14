'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/common/BrandMark';
import { FollowStage } from '@/components/viewer/FollowStage';

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

type SimulatorStep = {
  eyebrow: string;
  title: string;
  body: string;
  screen: string;
  hotspotX: number;
  hotspotY: number;
  kind: 'click' | 'type';
  typeText?: string;
  domRect?: { x: number; y: number; w: number; h: number };
  hideTypeIndicator?: boolean;
};

const svgDataUri = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const simulatorDemos: SimulatorStep[] = [
  {
    eyebrow: 'Demo 1 · Click guide',
    title: '눌러야 할 버튼을 화면 위에서 바로 짚어줍니다',
    body: '사용자가 멈춘 실제 화면 위에 하이라이트가 생기고, AI 아바타가 다음에 눌러야 할 버튼을 말풍선으로 안내합니다.',
    screen: svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1120" height="680" viewBox="0 0 1120 680">
        <rect width="1120" height="680" rx="28" fill="#eef2f7"/>
        <rect x="42" y="36" width="1036" height="608" rx="26" fill="white" stroke="#dbe3ef"/>
        <rect x="42" y="36" width="1036" height="66" rx="26" fill="#101827"/>
        <circle cx="76" cy="69" r="8" fill="#ef4444"/><circle cx="104" cy="69" r="8" fill="#f59e0b"/><circle cx="132" cy="69" r="8" fill="#22c55e"/>
        <rect x="176" y="52" width="468" height="34" rx="17" fill="#1f2937"/>
        <text x="204" y="74" font-family="Inter, Arial" font-size="15" fill="#cbd5e1">workspace.acme.com/settings/members</text>
        <rect x="84" y="132" width="952" height="470" rx="24" fill="#f8fafc" stroke="#d8e0ec"/>
        <rect x="84" y="132" width="230" height="470" rx="24" fill="#0f172a"/>
        <text x="122" y="188" font-family="Inter, Arial" font-size="21" font-weight="850" fill="white">Acme Admin</text>
        <rect x="116" y="230" width="166" height="42" rx="12" fill="#1e293b"/>
        <text x="142" y="257" font-family="Inter, Arial" font-size="14" font-weight="750" fill="#cbd5e1">Dashboard</text>
        <rect x="116" y="288" width="166" height="42" rx="12" fill="#312e81"/>
        <text x="142" y="315" font-family="Inter, Arial" font-size="14" font-weight="850" fill="#ede9fe">Members</text>
        <rect x="116" y="346" width="166" height="42" rx="12" fill="#1e293b"/>
        <text x="142" y="373" font-family="Inter, Arial" font-size="14" font-weight="750" fill="#cbd5e1">Billing</text>
        <text x="360" y="192" font-family="Inter, Arial" font-size="31" font-weight="850" fill="#111827">팀 멤버 관리</text>
        <text x="360" y="226" font-family="Inter, Arial" font-size="16" fill="#64748b">새 팀원을 초대하고 권한을 지정하세요.</text>
        <rect x="360" y="272" width="604" height="74" rx="18" fill="white" stroke="#e2e8f0"/>
        <circle cx="402" cy="309" r="18" fill="#e0e7ff"/>
        <text x="395" y="315" font-family="Inter, Arial" font-size="16" font-weight="850" fill="#4338ca">J</text>
        <text x="438" y="303" font-family="Inter, Arial" font-size="15" font-weight="850" fill="#111827">Jin Park</text>
        <text x="438" y="326" font-family="Inter, Arial" font-size="13" fill="#64748b">jin@company.com · Admin</text>
        <rect x="360" y="366" width="604" height="74" rx="18" fill="white" stroke="#e2e8f0"/>
        <circle cx="402" cy="403" r="18" fill="#dcfce7"/>
        <text x="394" y="409" font-family="Inter, Arial" font-size="16" font-weight="850" fill="#15803d">S</text>
        <text x="438" y="397" font-family="Inter, Arial" font-size="15" font-weight="850" fill="#111827">Sara Kim</text>
        <text x="438" y="420" font-family="Inter, Arial" font-size="13" fill="#64748b">sara@company.com · Editor</text>
        <rect x="742" y="178" width="222" height="58" rx="16" fill="#4f46e5"/>
        <text x="801" y="213" font-family="Inter, Arial" font-size="16" font-weight="900" fill="white">멤버 초대</text>
        <rect x="742" y="178" width="222" height="58" rx="16" fill="none" stroke="#8b5cf6" stroke-width="0">
          <animate attributeName="stroke-width" values="0;5;5;0" dur="2.2s" begin=".25s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;1;1;0" dur="2.2s" begin=".25s" repeatCount="indefinite"/>
        </rect>
        <circle cx="853" cy="207" r="42" fill="none" stroke="#8b5cf6" stroke-width="0" opacity=".45">
          <animate attributeName="r" values="28;62" dur="2.2s" begin=".4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values=".45;0" dur="2.2s" begin=".4s" repeatCount="indefinite"/>
        </circle>
        <rect x="360" y="478" width="278" height="62" rx="18" fill="#eef2ff" stroke="#c7d2fe"/>
        <text x="392" y="515" font-family="Inter, Arial" font-size="15" font-weight="850" fill="#3730a3">Live Guide step 2 / 5</text>
        <text x="392" y="536" font-family="Inter, Arial" font-size="12" fill="#6366f1">다음 목표: 초대 화면 열기</text>
      </svg>
    `),
    hotspotX: 76.2,
    hotspotY: 30.4,
    kind: 'click',
    domRect: { x: 66.2, y: 26.2, w: 19.8, h: 8.6 },
  },
  {
    eyebrow: 'Demo 2 · Live Guide Beta 자동 입력',
    title: '빈 입력칸에 필요한 텍스트가 자동으로 입력됩니다',
    body: '한 번 저장한 텍스트가 실제 입력창 안에 그대로 타이핑되고, AI 아바타가 어떤 값을 넣는지 옆에서 설명합니다.',
    screen: svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1120" height="680" viewBox="0 0 1120 680">
        <rect width="1120" height="680" rx="28" fill="#f3f4f6"/>
        <rect x="42" y="36" width="1036" height="608" rx="26" fill="white" stroke="#e5e7eb"/>
        <rect x="42" y="36" width="1036" height="66" rx="26" fill="#0f172a"/>
        <circle cx="76" cy="69" r="8" fill="#ef4444"/><circle cx="104" cy="69" r="8" fill="#f59e0b"/><circle cx="132" cy="69" r="8" fill="#22c55e"/>
        <rect x="176" y="52" width="420" height="34" rx="17" fill="#1f2937"/>
        <text x="204" y="74" font-family="Inter, Arial" font-size="15" fill="#cbd5e1">admin.example.com/users/new</text>
        <rect x="88" y="138" width="642" height="454" rx="24" fill="#ffffff" stroke="#d1d5db"/>
        <text x="130" y="194" font-family="Inter, Arial" font-size="29" font-weight="850" fill="#111827">신규 사용자 초대</text>
        <text x="130" y="226" font-family="Inter, Arial" font-size="15" fill="#64748b">계정 정보를 입력하고 권한을 선택하세요.</text>
        <text x="130" y="286" font-family="Inter, Arial" font-size="14" font-weight="800" fill="#374151">이메일</text>
        <rect x="130" y="304" width="416" height="58" rx="14" fill="#f8fafc" stroke="#cbd5e1"/>
        <text x="156" y="340" font-family="Inter, Arial" font-size="17" font-weight="700" fill="#111827">
          <tspan>k</tspan><tspan opacity="0">i<animate attributeName="opacity" values="0;0;1" keyTimes="0;0.12;1" dur="2.1s" repeatCount="indefinite"/></tspan><tspan opacity="0">m<animate attributeName="opacity" values="0;0;1" keyTimes="0;0.18;1" dur="2.1s" repeatCount="indefinite"/></tspan><tspan opacity="0">@<animate attributeName="opacity" values="0;0;1" keyTimes="0;0.24;1" dur="2.1s" repeatCount="indefinite"/></tspan><tspan opacity="0">c<animate attributeName="opacity" values="0;0;1" keyTimes="0;0.30;1" dur="2.1s" repeatCount="indefinite"/></tspan><tspan opacity="0">o<animate attributeName="opacity" values="0;0;1" keyTimes="0;0.36;1" dur="2.1s" repeatCount="indefinite"/></tspan><tspan opacity="0">m<animate attributeName="opacity" values="0;0;1" keyTimes="0;0.42;1" dur="2.1s" repeatCount="indefinite"/></tspan><tspan opacity="0">p<animate attributeName="opacity" values="0;0;1" keyTimes="0;0.48;1" dur="2.1s" repeatCount="indefinite"/></tspan><tspan opacity="0">a<animate attributeName="opacity" values="0;0;1" keyTimes="0;0.54;1" dur="2.1s" repeatCount="indefinite"/></tspan><tspan opacity="0">n<animate attributeName="opacity" values="0;0;1" keyTimes="0;0.60;1" dur="2.1s" repeatCount="indefinite"/></tspan><tspan opacity="0">y<animate attributeName="opacity" values="0;0;1" keyTimes="0;0.66;1" dur="2.1s" repeatCount="indefinite"/></tspan><tspan opacity="0">.<animate attributeName="opacity" values="0;0;1" keyTimes="0;0.72;1" dur="2.1s" repeatCount="indefinite"/></tspan><tspan opacity="0">c<animate attributeName="opacity" values="0;0;1" keyTimes="0;0.78;1" dur="2.1s" repeatCount="indefinite"/></tspan><tspan opacity="0">o<animate attributeName="opacity" values="0;0;1" keyTimes="0;0.84;1" dur="2.1s" repeatCount="indefinite"/></tspan><tspan opacity="0">m<animate attributeName="opacity" values="0;0;1" keyTimes="0;0.90;1" dur="2.1s" repeatCount="indefinite"/></tspan>
        </text>
        <line x1="156" y1="319" x2="156" y2="344" stroke="#111827" stroke-width="2" opacity="0">
          <animate attributeName="x1" values="156;156;292;292" keyTimes="0;0.08;0.82;1" dur="2.1s" repeatCount="indefinite"/>
          <animate attributeName="x2" values="156;156;292;292" keyTimes="0;0.08;0.82;1" dur="2.1s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.82;1" dur="2.1s" repeatCount="indefinite"/>
        </line>
        <text x="130" y="414" font-family="Inter, Arial" font-size="14" font-weight="800" fill="#374151">역할</text>
        <rect x="130" y="432" width="160" height="52" rx="14" fill="#eef2ff" stroke="#6366f1"/>
        <text x="180" y="464" font-family="Inter, Arial" font-size="15" font-weight="800" fill="#3730a3">Editor</text>
        <rect x="314" y="432" width="160" height="52" rx="14" fill="#f8fafc" stroke="#cbd5e1"/>
        <text x="362" y="464" font-family="Inter, Arial" font-size="15" font-weight="700" fill="#64748b">Viewer</text>
        <rect x="486" y="510" width="166" height="54" rx="16" fill="#4f46e5"/>
        <text x="534" y="544" font-family="Inter, Arial" font-size="15" font-weight="850" fill="white">초대 보내기</text>
        <rect x="480" y="504" width="178" height="66" rx="20" fill="none" stroke="#ef4444" stroke-width="4"/>
        <path d="M570 490 L570 472" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/>
        <rect x="450" y="420" width="244" height="42" rx="12" fill="#1f2937"/>
        <text x="480" y="447" font-family="Inter, Arial" font-size="14" font-weight="800" fill="white">다음 목표: 초대 보내기 클릭</text>
        <rect x="764" y="138" width="270" height="454" rx="24" fill="#111827"/>
        <text x="794" y="184" font-family="Inter, Arial" font-size="14" font-weight="900" fill="#a78bfa">LIVE GUIDE BETA</text>
        <text x="794" y="214" font-family="Inter, Arial" font-size="19" font-weight="850" fill="white">신규 계정 발급</text>
        <rect x="794" y="246" width="200" height="76" rx="18" fill="#1f2937"/>
        <text x="820" y="278" font-family="Inter, Arial" font-size="14" font-weight="800" fill="#e5e7eb">2 / 5</text>
        <text x="820" y="304" font-family="Inter, Arial" font-size="13" fill="#c4b5fd">이메일을 자동 입력 중</text>
        <rect x="794" y="354" width="198" height="42" rx="12" fill="#10b981"/>
        <text x="836" y="381" font-family="Inter, Arial" font-size="13" font-weight="850" fill="white">1. 메뉴 진입 완료</text>
        <rect x="794" y="410" width="198" height="42" rx="12" fill="#312e81"/>
        <text x="830" y="437" font-family="Inter, Arial" font-size="13" font-weight="850" fill="white">2. 이메일 입력</text>
        <rect x="794" y="466" width="198" height="42" rx="12" fill="#1f2937" stroke="#374151"/>
        <text x="832" y="493" font-family="Inter, Arial" font-size="13" fill="#9ca3af">3. 초대 보내기</text>
      </svg>
    `),
    hotspotX: 30,
    hotspotY: 49,
    kind: 'type',
    typeText: 'kim@company.com',
    domRect: { x: 11.6, y: 44.7, w: 37.1, h: 8.5 },
    hideTypeIndicator: true,
  },
];

const features = [
  {
    icon: (
      // 나침반 / Live Guide
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" fill="rgba(255,255,255,0.1)"/>
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="rgba(255,255,255,0.9)"/>
      </svg>
    ),
    title: '학습 가이드 + Live Guide Beta',
    body: '공유받은 사람은 설치 없이 캡처 화면 위에서 먼저 연습할 수 있습니다. 확장 프로그램이 연결된 환경에서는 실제 페이지 위 Live Guide Beta로 업무를 이어갈 수 있어요.',
    comingSoon: false,
  },
  {
    icon: (
      // 번개 / 빠른 생성
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinejoin="round"/>
      </svg>
    ),
    title: '녹화 한 번이면 초안 완성',
    body: '웹에서 평소처럼 작업하면 클릭과 화면이 단계로 정리되고, AI가 제목과 설명 초안을 붙입니다. 사용자는 검수하고 다듬기만 하면 됩니다.',
    comingSoon: false,
  },
  {
    icon: (
      // 팀 / 워크스페이스
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3.1" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" fill="rgba(255,255,255,0.1)"/>
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <circle cx="17.5" cy="9" r="2.3" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" fill="none"/>
        <path d="M16.6 14.4a4.6 4.6 0 0 1 4 5.1" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    title: '팀 워크스페이스로 함께',
    body: '워크스페이스에 매뉴얼을 모아 팀과 공유하고, 이메일 초대로 멤버를 추가하세요. Admin · Editor · Viewer 3단계 권한으로 누가 보고 누가 편집할지 정할 수 있습니다.',
    comingSoon: false,
  },
  {
    icon: (
      // 돋보기 / 줌인 + 편집
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="10" cy="10" r="7" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8"/>
        <circle cx="10" cy="10" r="4" fill="rgba(255,255,255,0.25)"/>
        <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M8 10h4M10 8v4" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: '줌인 + 어노테이션 7종',
    body: '강조할 영역을 드래그하면 확대 효과가 적용됩니다. 화살표·박스·마커·모자이크·스포트라이트로 어디를 봐야 할지 명확하게.',
    comingSoon: false,
  },
  {
    icon: (
      // 문서 내보내기
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" fill="rgba(255,255,255,0.1)"/>
        <polyline points="14 2 14 8 20 8" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" fill="none"/>
        <path d="M12 18v-6M9 15l3 3 3-3" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
    title: 'PDF · PPTX · Word 내보내기',
    body: '링크 공유는 기본, 회사 양식이 필요하면 로고·브랜드 색상을 입힌 PDF, PPTX, Word 문서로 내보내세요.',
    comingSoon: false,
  },
  {
    icon: (
      // 자물쇠 / 프라이버시
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="11" width="14" height="10" rx="2" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8"/>
        <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <circle cx="12" cy="16" r="1.5" fill="rgba(255,255,255,0.9)"/>
      </svg>
    ),
    title: '민감정보 검수와 모자이크',
    body: '비밀번호 입력값은 저장하지 않고, 캡처 후 편집기에서 민감한 영역을 모자이크 처리할 수 있습니다. AI 검토 배지는 확인이 필요한 화면을 알려줍니다.',
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
    body: '사내 툴 사용법, ERP 입력 방법, 결재 SOP를 화면 그대로 녹화해 매뉴얼로. 구두 설명 없이도 누구나 보고 따라합니다.',
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

function HeroDemo() {
  const [phase, setPhase] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let timer: number | null = null;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && timer == null) {
        timer = window.setInterval(() => setPhase(current => (current + 1) % 3), 2600);
      } else if (!entry.isIntersecting && timer != null) {
        window.clearInterval(timer);
        timer = null;
      }
    }, { threshold: 0.05 });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer != null) window.clearInterval(timer);
    };
  }, []);

  const phases = [
    { label: 'Capture', title: '클릭과 화면을 단계로 기록', body: '업무를 평소처럼 진행하면, MIMIC이 필요한 장면을 자동으로 모읍니다.' },
    { label: 'Manual', title: '공유 가능한 매뉴얼로 정리', body: '제목, 설명, 하이라이트가 붙은 실행 매뉴얼이 바로 완성됩니다.' },
    { label: 'Live Guide Beta', title: '최종 목적지까지 옆에서 안내', body: '사용자는 실제 흐름을 따라가며 클릭 위치와 입력할 텍스트까지 차근차근 확인합니다.' },
  ];
  const current = phases[phase];

  void [Scene0, Scene1, Scene2, Scene3, Scene4, Scene5, Scene6];

  return (
    <div ref={rootRef} className="hero-flow-preview" style={{ position: 'relative', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ borderRadius: '18px 18px 0 0', overflow: 'hidden', boxShadow: '0 24px 70px -12px rgba(55,48,163,0.30), 0 40px 90px -30px rgba(0,0,0,0.45)', border: '1px solid rgba(167,139,250,0.18)', background: '#0F0F18' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', background: '#171720', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF5F57' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FEBC2E' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28C840' }} />
          <div style={{ flex: 1, marginLeft: '10px', padding: '5px 12px', borderRadius: '7px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.46)', fontSize: '11.5px', textAlign: 'left' }}>app.mimic.so/workflow</div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#c4b5fd', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <i style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 0 5px rgba(139,92,246,0.12)' }} />
            Live Guide
          </span>
        </div>

        <div style={{ minHeight: '470px', display: 'grid', gridTemplateColumns: '0.92fr 1.08fr', background: 'linear-gradient(135deg,#111827 0%,#0b0b13 58%,#181233 100%)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ padding: '42px 42px 38px', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 11px', borderRadius: '999px', background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(167,139,250,0.24)', color: '#ddd6fe', fontSize: '11px', fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '24px' }}>{current.label}</div>
            <h3 style={{ margin: 0, color: 'white', fontSize: 'clamp(30px, 4.2vw, 52px)', lineHeight: 1.08, letterSpacing: '-0.045em', fontWeight: 900, wordBreak: 'keep-all' }}>{current.title}</h3>
            <p style={{ margin: '18px 0 0', color: 'rgba(255,255,255,0.56)', fontSize: '15px', lineHeight: 1.75, maxWidth: '370px', wordBreak: 'keep-all' }}>{current.body}</p>

            <div style={{ display: 'grid', gap: '10px', marginTop: '36px' }}>
              {phases.map((item, index) => {
                const isActive = index === phase;
                return (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', borderRadius: '12px', border: '1px solid ' + (isActive ? 'rgba(167,139,250,0.44)' : 'rgba(255,255,255,0.08)'), background: isActive ? 'rgba(124,58,237,0.20)' : 'rgba(255,255,255,0.035)', transition: 'background .3s ease, border-color .3s ease' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '8px', display: 'grid', placeItems: 'center', background: isActive ? '#7c3aed' : 'rgba(255,255,255,0.08)', color: isActive ? 'white' : 'rgba(255,255,255,0.44)', fontSize: '11px', fontWeight: 850 }}>{index + 1}</span>
                    <span style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.52)', fontSize: '13px', fontWeight: 750 }}>{item.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ padding: '38px', display: 'grid', alignContent: 'center', gap: '18px', position: 'relative' }}>
            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                { title: '01. 신청 메뉴 클릭', meta: 'click captured', state: phase >= 0 },
                { title: '02. 담당자 이메일 입력', meta: 'kim@company.com', state: phase >= 1 },
                { title: '03. 완료 화면 도착', meta: 'Live Guide target', state: phase >= 2 },
              ].map((step, index) => (
                <div key={step.title} style={{ display: 'grid', gridTemplateColumns: '42px 1fr auto', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '14px', background: step.state ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.72)', border: '1px solid ' + (index === phase ? '#a78bfa' : 'rgba(255,255,255,0.54)'), boxShadow: index === phase ? '0 18px 42px rgba(124,58,237,0.24)' : '0 8px 24px rgba(0,0,0,0.12)', transition: 'all .35s ease' }}>
                  <span style={{ width: '42px', height: '42px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: step.state ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#eef2ff', color: step.state ? 'white' : '#6b7280', fontWeight: 900 }}>{String(index + 1).padStart(2, '0')}</span>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', color: '#111827', fontSize: '14px', lineHeight: 1.3 }}>{step.title}</strong>
                    <small style={{ display: 'block', marginTop: '4px', color: '#6b7280', fontSize: '12px' }}>{step.meta}</small>
                  </span>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: step.state ? '#10b981' : '#d1d5db' }} />
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '14px', alignItems: 'stretch' }}>
              <div style={{ padding: '18px', borderRadius: '16px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)', color: 'white', textAlign: 'left' }}>
                <div style={{ fontSize: '11px', color: '#c4b5fd', fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>Guide overlay</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'white', color: '#111827', fontSize: '13px', fontWeight: 800, boxShadow: '0 18px 38px rgba(0,0,0,0.24)' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#7c3aed', color: 'white', fontSize: '12px' }}>{phase + 1}</span>
                  다음 위치를 누르고 필요한 텍스트를 입력하세요
                </div>
              </div>
              <div style={{ padding: '18px', borderRadius: '16px', background: '#111827', border: '1px solid rgba(255,255,255,0.10)', color: 'white', textAlign: 'left' }}>
                <div style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Result</div>
                <div style={{ marginTop: '34px', height: '7px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                  <div style={{ width: String(((phase + 1) / 3) * 100) + '%', height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg,#10b981,#a78bfa)', transition: 'width .35s ease' }} />
                </div>
                <div style={{ marginTop: '10px', color: 'rgba(255,255,255,0.62)', fontSize: '12px' }}>{phase + 1} / 3 completed</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// 매뉴얼 6단계 (정부24 주민등록증 발급받기)
const GUIDE_STEPS = [
  { num: '01', title: '주민등록증 메뉴 클릭', desc: '화면 좌측의 자주 찾는 서비스 메뉴에서 주민등록증 관련 항목을 클릭합니다.' },
  { num: '02', title: '발급하기 버튼 클릭', desc: '우측 하단의 파란색 발급하기 버튼을 클릭합니다.' },
  { num: '03', title: '간편인증 로그인', desc: '간편인증을 선택해 본인 인증을 진행합니다.' },
  { num: '04', title: '발급 형태 선택', desc: '전체 발급을 선택해 모든 정보가 표시되도록 합니다.' },
  { num: '05', title: '신청하기 버튼 클릭', desc: '입력 내용을 확인한 뒤 신청하기 버튼을 클릭합니다.' },
  { num: '06', title: '나의 신청내역 확인', desc: 'MyGOV 신청내역에서 발급 완료된 문서를 출력합니다.' },
];

// ── 정부24 페이지 목업 (Scene2·4·5 공용) ──────────
function Gov24Page({ dim }: { dim?: boolean }) {
  return (
    <div style={{ width: '100%', height: '100%', background: 'white', filter: dim ? 'brightness(0.7)' : 'none', overflow: 'hidden' }}>
      {/* 상단 안내 바 */}
      <div style={{ height: '16px', background: '#F3F4F6', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '8px', color: '#9CA3AF' }}>이 누리집은 대한민국 공식 전자정부 누리집입니다.</div>
      {/* 정부24 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #EEE' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '15px' }}>🏛️</span>
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#1d4ed8' }}>정부24</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '9.5px', color: '#6B7280' }}>
          <span>정부24 AI</span><span>통합검색</span><span>로그인</span><span>회원가입</span>
        </div>
      </div>
      {/* 네비 */}
      <div style={{ display: 'flex', gap: '20px', padding: '7px 16px', borderBottom: '2px solid #1d4ed8', fontSize: '10.5px', fontWeight: 600 }}>
        {['민원서비스','혜택알리미','생활','정책정보','고객센터'].map((t,i)=>(
          <span key={t} style={{ color: i===0 ? '#1d4ed8' : '#374151' }}>{t} ▾</span>
        ))}
      </div>
      {/* 본문 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '20px', padding: '16px 20px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '10px' }}>주민등록표 등본(초본) 발급</div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>서비스 개요</div>
          <div style={{ height: '1px', background: '#E5E7EB', marginBottom: '10px' }} />
          {[['신청방법','인터넷, 방문, 무인발급기'],['신청자격','본인 또는 대리인'],['발급서류','주민등록표 등본(초본)'],['처리기간','즉시(근무시간 내 3시간)']].map(([k,v])=>(
            <div key={k} style={{ display: 'flex', gap: '12px', marginBottom: '7px' }}>
              <span style={{ fontSize: '10px', color: '#6B7280', width: '52px', flexShrink: 0 }}>{k}</span>
              <span style={{ fontSize: '10px', color: '#111827' }}>{v}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: '9px', color: '#9CA3AF', marginBottom: '6px' }}>이 페이지의 구성</div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#111827', marginBottom: '10px' }}>주민등록표 등본(초본) 발급</div>
          {['서비스 개요','기본정보','신청 방법 및 절차','제출 서류'].map((t,i)=>(
            <div key={t} style={{ fontSize: '9.5px', color: i===0?'#1d4ed8':'#9CA3AF', padding: '4px 0', borderLeft: i===0?'2px solid #1d4ed8':'2px solid transparent', paddingLeft: '8px', fontWeight: i===0?600:400 }}>{t}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 화살표 커서
function CursorIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 26 / 22)} viewBox="0 0 22 26" fill="none" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))' }}>
      <path d="M4 2 L4 20 L8.5 15.8 L11.4 22.6 L14 21.4 L11.1 14.8 L17 14.8 Z" fill="white" stroke="#1a1a1a" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

// ── 씬 0: MIMIC 홈 → "새 매뉴얼" 클릭 ──────────
function Scene0({ tick }: { tick: number }) {
  const hover = tick >= 1400;
  const click = tick >= 2600;
  const MANUALS = [
    { title: '정부24에서 주민등록증 발급받기', sub: 'plus.gov.kr · 6단계', color: '#dbeafe', icon: '🏛️' },
    { title: '쿠팡에서 상품 검색 후 구매하기', sub: 'coupang.com · 10단계', color: '#fee2e2', icon: '🛒' },
    { title: 'n8n에서 이메일 워크플로우', sub: 'n8n.cloud · 6단계', color: '#ede9fe', icon: '⚙️' },
    { title: 'Google Gemini 프롬프트 작성', sub: 'gemini · 5단계', color: '#dcfce7', icon: '✨' },
    { title: 'notebookLM 사용 가이드', sub: 'notebooklm · 24단계', color: '#fef9c3', icon: '📓' },
    { title: 'YouTube 동영상 업로드', sub: 'youtube.com · 4단계', color: '#fee2e2', icon: '▶️' },
  ];
  const FOLDERS = ['MIMIC','OZ코딩스쿨','바이브코딩','네이버','쿠팡','기타'];
  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', display: 'grid', gridTemplateColumns: '150px 1fr', position: 'relative' }}>
      {/* 왼쪽 사이드바 */}
      <div style={{ background: '#FAFAFB', borderRight: '1px solid #EEE', padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'linear-gradient(135deg,#6d28d9,#3730a3)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: '11px' }}>M</div>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#1a1a2e' }}>MIMIC</span>
        </div>
        <div style={{ fontSize: '8.5px', color: '#9CA3AF', fontWeight: 700, padding: '0 4px', marginBottom: '2px' }}>내 워크스페이스</div>
        {['전체 19','미분류 18'].map(t=>(
          <div key={t} style={{ padding: '5px 8px', borderRadius: '6px', fontSize: '10px', color: '#4B5563', background: t.startsWith('전체')?'#EDE9FE':'transparent', fontWeight: t.startsWith('전체')?600:400 }}>{t}</div>
        ))}
        <div style={{ fontSize: '8.5px', color: '#9CA3AF', fontWeight: 700, padding: '10px 4px 3px' }}>폴더 6</div>
        {FOLDERS.map(f=>(
          <div key={f} style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '10px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '2px', background: '#C4B5FD' }} />{f}
          </div>
        ))}
      </div>
      {/* 본문 */}
      <div style={{ padding: '16px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>사용자님의 매뉴얼</div>
            <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px' }}>내 매뉴얼 19 · 팀 매뉴얼 5</div>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ padding: '9px 16px', borderRadius: '9px', background: click ? '#5b21b6' : 'linear-gradient(135deg,#6d28d9,#3730a3)', color: '#fff', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', boxShadow: hover ? '0 6px 22px rgba(109,40,217,0.5)' : '0 2px 8px rgba(109,40,217,0.3)', transform: click ? 'scale(0.95)' : 'scale(1)', transition: 'all 0.2s' }}>
              <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span> 새로 만들기
            </div>
            {click && <div style={{ position: 'absolute', top: '50%', left: '50%', width: '64px', height: '64px', borderRadius: '50%', border: '2px solid rgba(109,40,217,0.55)', transform: 'translate(-50%,-50%)', animation: 'rippleOut 0.7s ease-out' }} />}
            {click && (
              <div style={{ position: 'absolute', top: '42px', right: 0, width: '164px', borderRadius: '12px', border: '1px solid #E5E7EB', background: '#fff', overflow: 'hidden', boxShadow: '0 18px 40px rgba(15,23,42,0.16)', zIndex: 12 }}>
                {['새 매뉴얼(녹화)', '새 플레이북(통합 문서)', '폴더'].map((label, idx) => (
                  <div key={label} style={{ padding: '10px 12px', borderBottom: idx === 2 ? 'none' : '1px solid #F3F4F6', color: '#111827', fontSize: '11px', fontWeight: 700, lineHeight: 1.2 }}>
                    {label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #EEE', background: '#FAFAFB', fontSize: '10.5px', color: '#9CA3AF', marginBottom: '12px' }}>🔍 매뉴얼 이름으로 검색...</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {MANUALS.map((m,i)=>(
            <div key={i} style={{ borderRadius: '10px', border: '1px solid #EEE', overflow: 'hidden', background: '#fff' }}>
              <div style={{ height: '44px', background: m.color, display: 'grid', placeItems: 'center', fontSize: '18px' }}>{m.icon}</div>
              <div style={{ padding: '8px 9px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
                <div style={{ fontSize: '8.5px', color: '#9CA3AF', marginTop: '3px' }}>{m.sub}</div>
              </div>
            </div>
          ))}
        </div>
        {/* 마우스 커서 → 새로 만들기 버튼 */}
        <div style={{ position: 'absolute', top: hover ? '22px' : '150px', right: hover ? '24px' : '40px', transition: 'top 0.8s cubic-bezier(0.4,0,0.2,1), right 0.8s cubic-bezier(0.4,0,0.2,1)', zIndex: 20, pointerEvents: 'none' }}>
          <CursorIcon />
        </div>
      </div>
    </div>
  );
}

// ── 씬 1: 3 2 1 START 카운트다운 ────────────────────────────
function Scene1({ tick }: { tick: number }) {
  const count = tick < 500 ? '3' : tick < 1000 ? '2' : tick < 1500 ? '1' : 'START';
  const isStart = count === 'START';
  return (
    <div style={{ width: '100%', height: '100%', background: '#0D0D14', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', background: isStart ? 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(109,40,217,0.25) 0%, transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />
      <div key={count} style={{ fontSize: isStart ? '72px' : '96px', fontWeight: 900, letterSpacing: isStart ? '-0.02em' : '-0.04em', color: isStart ? '#10B981' : 'white', textShadow: isStart ? '0 0 40px rgba(16,185,129,0.6)' : '0 0 40px rgba(109,40,217,0.5)', animation: 'countPop 0.25s cubic-bezier(0.34,1.8,0.64,1) both', lineHeight: 1 }}>
        {count}
      </div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: 500, letterSpacing: '0.05em' }}>
        {isStart ? '화면 녹화가 시작됩니다' : '녹화 준비 중...'}
      </div>
      <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: '12px' }}>🏛️</span>
        <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.6)' }}>plus.gov.kr</span>
        <span style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', animation: 'rec-blink 1s infinite' }} />
        <span style={{ fontSize: '11px', color: '#FCA5A5', fontWeight: 500 }}>녹화 대기</span>
      </div>
    </div>
  );
}

// ── 씬 2: 정부24 클릭 캡처 + MIMIC Recorder 패널 ──────────
function Scene2({ tick }: { tick: number }) {
  // 좌측 화면이 클릭에 따라 전환: 0=홈(주민등록등본 메뉴 클릭) → 1=발급 페이지(발급하기 클릭)
  const substep = tick < 2600 ? 0 : 1;
  // 우측 패널 스텝 누적 — 좌측 클릭과 동기화
  const steps = tick >= 4800 ? 2 : tick >= 2000 ? 1 : 0;
  const REC_STEPS = [
    { label: '클릭, 주민등록등본(초본)', time: '15:36:03' },
    { label: '클릭, 발급하기', time: '15:36:18' },
  ];
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(135deg,#2a2745,#1a1830)', overflow: 'hidden' }}>
      {/* 좌측: 정부24 브라우저 화면 (우측 Recorder 공간 비움) */}
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: '196px', overflow: 'hidden', background: '#fff', borderRight: '1px solid rgba(0,0,0,0.06)' }}>
        <div key={substep} style={{ position: 'absolute', inset: 0, animation: 'sceneIn 0.4s ease both' }}>
          <StepScreen step={substep} mode="record" />
        </div>
      </div>
      {/* 우측: 데스크톱 위에 떠있는 별도 MIMIC Recorder 창 */}
      <div style={{ position: 'absolute', top: '14px', right: '14px', bottom: '14px', width: '172px', background: '#fff', borderRadius: '12px', boxShadow: '0 18px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 20 }}>
        {/* 창 헤더 — 그라데이션 + 창 컨트롤 (별도 창 느낌) */}
        <div style={{ background: 'linear-gradient(135deg,#6d28d9,#3730a3)', padding: '9px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '5px', background: 'rgba(255,255,255,0.22)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: '10px' }}>M</div>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#fff' }}>MIMIC Recorder</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', fontSize: '9px', color: 'rgba(255,255,255,0.75)' }}><span>📌</span><span>⚙</span></div>
        </div>
        {/* REC + steps */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 11px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#EF4444', animation: 'rec-blink 1.2s infinite' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#EF4444' }}>REC</span>
            <span style={{ fontSize: '8.5px', color: '#9CA3AF', fontFamily: 'monospace' }}>00:18</span>
          </div>
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#6d28d9', background: '#EDE9FE', padding: '2px 7px', borderRadius: '999px' }}>{steps} steps</span>
        </div>
        <div style={{ fontSize: '8.5px', color: '#9CA3AF', fontWeight: 700, padding: '7px 11px 5px' }}>캡처된 스텝</div>
        <div style={{ flex: 1, overflow: 'hidden', padding: '0 9px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {steps === 0 && <div style={{ fontSize: '8.5px', color: '#C4B5FD', textAlign: 'center', padding: '14px 6px', lineHeight: 1.5 }}>화면을 클릭하면<br/>자동으로 캡처됩니다</div>}
          {REC_STEPS.slice(0, steps).map((s, i) => (
            <div key={i} style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', animation: 'sceneIn 0.4s cubic-bezier(0.34,1.4,0.64,1) both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 7px', background: '#FAFAFB' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#6d28d9', color: '#fff', fontSize: '8px', fontWeight: 700, display: 'grid', placeItems: 'center' }}>{i+1}</span>
                <span style={{ fontSize: '8px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
              </div>
              {/* 썸네일 — 클릭한 정부24 화면이 그대로 미리보기로 캡처됨 */}
              <div style={{ height: '92px', overflow: 'hidden', position: 'relative', background: '#fff' }}>
                <div style={{ width: '460px', height: '286px', transform: 'scale(0.335)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                  <StepScreen step={i} mode="card" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* 창 하단 컨트롤 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderTop: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', gap: '7px', fontSize: '10px', color: '#9CA3AF' }}><span>📷</span><span>⏸</span><span>↩</span></div>
          <div style={{ padding: '5px 12px', borderRadius: '6px', background: 'linear-gradient(135deg,#3730a3,#6d28d9)', color: '#fff', fontSize: '9.5px', fontWeight: 700 }}>✓ 완료</div>
        </div>
      </div>
    </div>
  );
}

// ── 씬 3: 완료 클릭 → 매뉴얼 자동 생성 중 (로딩) ──────────
function Scene3({ tick }: { tick: number }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(135deg,#2a2745,#1a1830)', overflow: 'hidden' }}>
      {/* 좌측: 정부24 화면 (작업 멈춤 — 어둡게) */}
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: '196px', overflow: 'hidden', background: '#fff', borderRight: '1px solid rgba(0,0,0,0.06)' }}>
        <Gov24Page dim />
      </div>
      {/* 우측: 떠있는 MIMIC Recorder 창 — 생성 중 */}
      <div style={{ position: 'absolute', top: '14px', right: '14px', bottom: '14px', width: '172px', background: '#fff', borderRadius: '12px', boxShadow: '0 18px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 20 }}>
        <div style={{ background: 'linear-gradient(135deg,#6d28d9,#3730a3)', padding: '9px 11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '18px', height: '18px', borderRadius: '5px', background: 'rgba(255,255,255,0.22)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: '10px' }}>M</div>
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#fff' }}>MIMIC Recorder</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '0 14px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', border: '3px solid #EDE9FE', borderTopColor: '#6d28d9', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>매뉴얼을 생성하고 있습니다...</div>
            <div style={{ fontSize: '9px', color: '#9CA3AF', lineHeight: 1.5 }}>AI 분석 중 — 잠시만 기다려 주세요</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>
            {[{ label: '화면 분석', done: tick >= 600 }, { label: '단계 분리', done: tick >= 1400 }, { label: '설명 생성', done: tick >= 2200 }].map(it => (
              <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: it.done ? '#10B981' : '#E5E7EB', display: 'grid', placeItems: 'center', transition: 'background 0.3s' }}>
                  {it.done && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span style={{ fontSize: '9px', color: it.done ? '#374151' : '#9CA3AF', transition: 'color 0.3s' }}>{it.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// MIMIC 앱 헤더 (Scene4·5 공용)
function MimicAppHeader({ mode }: { mode: 'doc' | 'guide' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid #EEE', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'linear-gradient(135deg,#6d28d9,#3730a3)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: '11px' }}>M</div>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151' }}>정부24에서 주민등록증 발급받기</span>
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {[['웹 문서','doc'],['Live Guide Beta','guide'],['슬라이드','slide']].map(([label, key]) => (
          <div key={key} style={{ padding: '5px 11px', borderRadius: '7px', fontSize: '10px', fontWeight: 600, background: mode === key ? '#EDE9FE' : 'transparent', color: mode === key ? '#6d28d9' : '#9CA3AF', border: mode === key ? '1px solid rgba(109,40,217,0.3)' : '1px solid transparent' }}>{label}</div>
        ))}
      </div>
    </div>
  );
}

// 정부24 미니 헤더 (스텝 화면 공용)
function Gov24Mini() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 11px', borderBottom: '1px solid #EEE', flexShrink: 0, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ fontSize: '12px' }}>🏛️</span>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8' }}>정부24</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', fontSize: '8px', color: '#9CA3AF' }}>
        <span>로그인</span><span>회원가입</span>
      </div>
    </div>
  );
}

// 스텝 화면 — step별 타겟(메뉴/버튼)을 명확히 그리고, 그 요소에 직접 어노테이션
// mode='card' : 빨간 박스 + 화살표 + 캡션 / mode='guide' : 스포트라이트(주변 딤)
function StepScreen({ step, mode }: { step: number; mode: 'card' | 'guide' | 'record' }) {
  const isHome = step === 0;
  const isAuth = step === 2;
  const cap = isHome ? '주민등록증 메뉴 클릭' : isAuth ? '간편인증 선택' : '발급하기 버튼 클릭';
  const isCard = mode === 'card';
  const isRec = mode === 'record';

  // 녹화 모드: 타겟에 커서 + 클릭 리플 (어노테이션 없음)
  const recordOverlay = (
    <>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '46px', height: '46px', borderRadius: '50%', border: '2px solid rgba(29,78,216,0.55)', animation: 'rippleOut 0.85s ease-out infinite', pointerEvents: 'none', zIndex: 5 }} />
      <div style={{ position: 'absolute', top: '56%', left: '52%', zIndex: 6, pointerEvents: 'none' }}><CursorIcon /></div>
    </>
  );

  // 타겟 요소 자식으로 들어가는 오버레이 (테두리·텍스트박스·화살표·글자 크게)
  const overlayBelow = (
    <>
      <span style={{ position: 'absolute', left: '50%', top: 'calc(100% + 2px)', transform: 'translateX(-50%)', color: '#EF4444', fontSize: '18px', fontWeight: 900, lineHeight: 1, zIndex: 6 }}>↑</span>
      <div style={{ position: 'absolute', left: '50%', top: 'calc(100% + 21px)', transform: 'translateX(-50%)', background: '#1f2937', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '5px 12px', borderRadius: '7px', whiteSpace: 'nowrap', zIndex: 6, boxShadow: '0 4px 14px rgba(0,0,0,0.28)' }}>{cap}</div>
    </>
  );
  const overlayAbove = (
    <>
      <div style={{ position: 'absolute', left: '50%', bottom: 'calc(100% + 21px)', transform: 'translateX(-50%)', background: '#1f2937', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '5px 12px', borderRadius: '7px', whiteSpace: 'nowrap', zIndex: 6, boxShadow: '0 4px 14px rgba(0,0,0,0.28)' }}>{cap}</div>
      <span style={{ position: 'absolute', left: '50%', bottom: 'calc(100% + 2px)', transform: 'translateX(-50%)', color: '#EF4444', fontSize: '18px', fontWeight: 900, lineHeight: 1, zIndex: 6 }}>↓</span>
    </>
  );
  const spotlight = (
    <div style={{ position: 'absolute', inset: '-7px', borderRadius: '12px', boxShadow: '0 0 0 4px #6d28d9, 0 0 0 2000px rgba(13,13,20,0.52)', zIndex: 4, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: '-6px', borderRadius: '14px', border: '3px solid rgba(167,139,250,0.8)', animation: 'rippleOut 1.4s ease-out infinite' }} />
      {/* 커서 + AI 말풍선이 함께 이동 */}
      <div style={{ position: 'absolute', top: '50%', left: '48%', zIndex: 7, animation: 'cursorClick 2.6s ease-in-out infinite' }}>
        {/* AI 말풍선 — 커서 왼쪽 위에 고정 부착 */}
        <div style={{ position: 'absolute', bottom: '100%', right: '4px', marginBottom: '10px', background: 'white', borderRadius: '10px 10px 10px 2px', padding: '9px 12px 8px', boxShadow: '0 10px 32px rgba(0,0,0,0.26), 0 0 0 1px rgba(0,0,0,0.05)', width: '190px', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'linear-gradient(135deg,#6d28d9,#3730a3)', display: 'grid', placeItems: 'center', fontSize: '12px', flexShrink: 0 }}>🤖</div>
            <span style={{ fontSize: '9px', fontWeight: 800, color: '#6d28d9', letterSpacing: '0.04em' }}>MIMIC AI</span>
          </div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#111827', marginBottom: '3px' }}>{GUIDE_STEPS[step]?.title}</div>
          <div style={{ fontSize: '8.5px', color: '#6B7280' }}>표시된 곳을 클릭하면 다음으로 넘어가요</div>
        </div>
        <CursorIcon size={28} />
      </div>
    </div>
  );

  if (isHome) {
    const SERVICES = ['토지(임야)대장', '주민등록등본(초본)', '자동차등록원부', '건축물대장', '가족관계증명서', '여권 재발급'];
    return (
      <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Gov24Mini />
        <div style={{ padding: '10px 12px', flex: 1, position: 'relative' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#374151', marginBottom: '7px' }}>자주 찾는 서비스</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px' }}>
            {SERVICES.map((s, i) => {
              const target = i === 1;
              return (
                <div key={i} style={{ position: 'relative', padding: '9px 5px', borderRadius: '7px', border: `${target && isCard ? '2.5px' : '1.5px'} solid ${target ? (isCard ? '#EF4444' : isRec ? '#1d4ed8' : '#E5E7EB') : '#E5E7EB'}`, background: target ? (isCard ? '#FEF2F2' : isRec ? '#EFF6FF' : '#F9FAFB') : '#F9FAFB', fontSize: '8.5px', fontWeight: target ? 700 : 500, color: target ? '#111827' : '#6B7280', textAlign: 'center', lineHeight: 1.3, zIndex: target && (mode === 'guide' || isRec) ? 5 : 1 }}>
                  {s}
                  {target && (isCard ? overlayBelow : isRec ? recordOverlay : spotlight)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 간편인증 로그인 화면 — "간편인증"이 타겟
  if (isAuth) {
    const METHODS = [
      { t: '간편인증', s: '네이버 · 카카오 · 금융기관 전자서명' },
      { t: '공동인증서', s: '개인 컴퓨터 · USB 보관 인증서' },
      { t: '금융인증서', s: '은행 앱 · 인터넷뱅킹 인증서' },
    ];
    return (
      <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Gov24Mini />
        <div style={{ padding: '11px 14px', flex: 1, position: 'relative' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#111827', marginBottom: '2px' }}>로그인 방식을 선택해 주세요</div>
          <div style={{ fontSize: '8.5px', color: '#6B7280', marginBottom: '9px' }}>한 번에 인증하고 모든 서비스 이용하기</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {METHODS.map((m, i) => {
              const target = i === 0;
              return (
                <div key={i} style={{ position: 'relative', padding: '8px 11px', borderRadius: '8px', border: `${target && isCard ? '2.5px' : '1.5px'} solid ${target ? (isCard ? '#EF4444' : isRec ? '#1d4ed8' : '#E5E7EB') : '#E5E7EB'}`, background: target ? (isCard ? '#FEF2F2' : isRec ? '#EFF6FF' : '#F9FAFB') : '#F9FAFB', zIndex: target && (mode === 'guide' || isRec) ? 5 : 1 }}>
                  <div style={{ fontSize: '10px', fontWeight: target ? 700 : 600, color: '#111827' }}>{m.t}</div>
                  <div style={{ fontSize: '7.5px', color: '#9CA3AF', marginTop: '2px' }}>{m.s}</div>
                  {target && (isCard ? overlayBelow : isRec ? recordOverlay : spotlight)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 발급 페이지 — "발급하기" 버튼이 타겟
  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Gov24Mini />
      <div style={{ padding: '10px 14px', flex: 1, position: 'relative' }}>
        <div style={{ fontSize: '12px', fontWeight: 800, color: '#111827', marginBottom: '7px' }}>주민등록표 등본(초본) 발급</div>
        <div style={{ fontSize: '8.5px', color: '#6B7280', marginBottom: '5px' }}>서비스 개요</div>
        <div style={{ height: '1px', background: '#EEE', marginBottom: '7px' }} />
        {[['신청방법', '인터넷, 방문, 무인발급기'], ['신청자격', '본인 또는 대리인'], ['처리기간', '즉시(근무시간 내 3시간)']].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: '8px', marginBottom: '5px' }}>
            <span style={{ fontSize: '8.5px', color: '#9CA3AF', width: '44px', flexShrink: 0 }}>{k}</span>
            <span style={{ fontSize: '8.5px', color: '#374151' }}>{v}</span>
          </div>
        ))}
        {/* 발급하기 버튼 (타겟) — 우측 중앙 */}
        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', width: '110px', zIndex: (mode === 'guide' || isRec) ? 5 : 1 }}>
          <div style={{ position: 'relative', padding: '9px 0', borderRadius: '6px', background: '#1d4ed8', color: '#fff', fontSize: '10.5px', fontWeight: 700, textAlign: 'center', border: isCard ? '3px solid #EF4444' : isRec ? '2px solid #93C5FD' : 'none' }}>
            발급하기
            {isCard ? overlayAbove : isRec ? recordOverlay : spotlight}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 씬 4: 매뉴얼 완성 → 편집 가능한 스텝 카드 에디터 ──────────
function Scene4({ tick }: { tick: number }) {
  const scrollY = Math.min(Math.max(tick - 1100, 0) * 0.08, 280);
  return (
    <div style={{ width: '100%', height: '100%', background: '#F4F4F7', display: 'grid', gridTemplateColumns: '146px 1fr', position: 'relative', overflow: 'hidden' }}>
      {/* 좌측 목차 */}
      <div style={{ background: '#fff', borderRight: '1px solid #EEE', padding: '11px 8px', overflow: 'hidden' }}>
        <div style={{ fontSize: '8.5px', color: '#9CA3AF', fontWeight: 700, marginBottom: '7px', padding: '0 4px' }}>목차 · 6단계</div>
        {GUIDE_STEPS.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 6px', borderRadius: '6px', marginBottom: '2px', background: i === 0 ? '#EDE9FE' : 'transparent' }}>
            <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: i === 0 ? '#6d28d9' : '#E5E7EB', color: i === 0 ? '#fff' : '#9CA3AF', fontSize: '7.5px', fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{i + 1}</span>
            <span style={{ fontSize: '8.5px', fontWeight: i === 0 ? 600 : 400, color: i === 0 ? '#4c1d95' : '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
          </div>
        ))}
      </div>
      {/* 우측 — 에디터 */}
      <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* 에디터 툴바 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #EEE', background: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>←</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151' }}>편집기</span>
            <span style={{ fontSize: '9px', color: '#9CA3AF' }}>6개 단계</span>
            <span style={{ fontSize: '8.5px', color: '#10B981', fontWeight: 600 }}>● 자동 저장됨</span>
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <span style={{ fontSize: '9px', color: '#6B7280', padding: '4px 8px', borderRadius: '6px', border: '1px solid #EEE' }}>미리보기</span>
            <span style={{ fontSize: '9px', color: '#6B7280', padding: '4px 8px', borderRadius: '6px', border: '1px solid #EEE' }}>내보내기</span>
            <span style={{ fontSize: '9px', color: '#fff', padding: '4px 10px', borderRadius: '6px', background: 'linear-gradient(135deg,#6d28d9,#3730a3)', fontWeight: 700 }}>편집 완료</span>
          </div>
        </div>
        {/* 스크롤 본문 */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <div style={{ padding: '14px 18px', transform: `translateY(${-scrollY}px)`, transition: 'transform 0.12s linear' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#111827', marginBottom: '2px' }}>정부24에서 주민등록증 발급받기</div>
            <div style={{ fontSize: '9px', color: '#9CA3AF', marginBottom: '13px' }}>2026.06.18 · 6단계 · AI 자동 생성</div>
            {GUIDE_STEPS.slice(0, 3).map((s, i) => {
              const active = i === 0;
              return (
                <div key={i} style={{ background: '#fff', borderRadius: '12px', border: active ? '1.5px solid #C4B5FD' : '1px solid #EEE', boxShadow: active ? '0 6px 20px rgba(109,40,217,0.13)' : '0 1px 3px rgba(0,0,0,0.04)', padding: '11px 13px', marginBottom: '11px', position: 'relative' }}>
                  {/* 카드 헤더 — 드래그 핸들 + 번호 + 제목 + 편집 아이콘 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span style={{ fontSize: '11px', color: '#D1D5DB' }}>⠿</span>
                      <span style={{ width: '20px', height: '20px', borderRadius: '6px', background: '#6d28d9', color: '#fff', fontSize: '9px', fontWeight: 800, display: 'grid', placeItems: 'center' }}>{s.num}</span>
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#111827' }}>{s.title}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}><span>✏️</span><span>🔍</span><span>🗑️</span></div>
                  </div>
                  {/* 편집 툴바 (활성 카드) */}
                  {active && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '4px 9px', background: '#F9FAFB', borderRadius: '6px', marginBottom: '7px', border: '1px solid #EEE' }}>
                      <span style={{ fontSize: '8.5px', color: '#6B7280' }}>14px ▾</span>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#6B7280' }}>B</span>
                      <span style={{ fontSize: '10px', fontStyle: 'italic', color: '#6B7280' }}>I</span>
                      <span style={{ fontSize: '10px', textDecoration: 'underline', color: '#6B7280' }}>U</span>
                      <span style={{ marginLeft: 'auto', fontSize: '8.5px', color: '#6d28d9', fontWeight: 700 }}>✨ AI 완성</span>
                    </div>
                  )}
                  {/* 설명 */}
                  <div style={{ fontSize: '10px', color: '#6B7280', lineHeight: 1.5, marginBottom: '9px' }}>{s.desc}</div>
                  {/* 스크린샷 + 어노테이션 */}
                  <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #E5E7EB', position: 'relative', height: '130px' }}>
                    <StepScreen step={i} mode="card" />
                  </div>
                </div>
              );
            })}
          </div>
          {/* 자동 생성 배지 */}
          <div style={{ position: 'absolute', top: '12px', right: '14px', display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '9px', fontWeight: 700, color: '#059669', zIndex: 9 }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            6단계 자동 완성
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 씬 5: 공유 — 링크/내보내기 모달 ──────────
function Scene5({ tick }: { tick: number }) {
  const copied = tick >= 2600;
  return (
    <div style={{ width: '100%', height: '100%', background: '#F4F4F7', position: 'relative', overflow: 'hidden' }}>
      {/* 뒷배경: 완성된 매뉴얼 뷰어 (흐릿) */}
      <div style={{ position: 'absolute', inset: 0, padding: '16px 22px', filter: 'blur(1px)' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: '#111827', marginBottom: '12px' }}>정부24에서 주민등록증 발급받기</div>
        {GUIDE_STEPS.slice(0, 2).map((s, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #EEE', padding: '12px 14px', marginBottom: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '20px', height: '20px', borderRadius: '6px', background: '#6d28d9', color: '#fff', fontSize: '9px', fontWeight: 800, display: 'grid', placeItems: 'center' }}>{s.num}</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>{s.title}</span>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,13,20,0.42)' }} />
      {/* 공유 모달 — 상단 정렬 (자막 겹침 방지) */}
      <div style={{ position: 'absolute', top: '26px', left: '50%', transform: 'translateX(-50%)', width: '326px', background: '#fff', borderRadius: '16px', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', overflow: 'hidden', animation: 'sceneIn 0.4s cubic-bezier(0.34,1.4,0.64,1) both', zIndex: 10 }}>
        <div style={{ padding: '15px 18px 11px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>공유하기</div>
            <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px' }}>정부24에서 주민등록증 발급받기</div>
          </div>
          <span style={{ fontSize: '14px', color: '#D1D5DB' }}>✕</span>
        </div>
        <div style={{ padding: '14px 18px' }}>
          {/* 공유 링크 */}
          <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid #E5E7EB', marginBottom: '11px' }}>
            <div style={{ flex: 1, padding: '8px 10px', fontSize: '9.5px', color: '#6B7280', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: '#F9FAFB' }}>mimic.so/play/gov24-resident-cert</div>
            <div style={{ padding: '8px 13px', background: copied ? '#10B981' : 'linear-gradient(135deg,#6d28d9,#3730a3)', color: '#fff', fontSize: '10px', fontWeight: 700, transition: 'background 0.3s', whiteSpace: 'nowrap' }}>{copied ? '✓ 복사됨' : '🔗 링크 복사'}</div>
          </div>
          {/* 공개 범위 + 비밀번호 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #EEE', fontSize: '9px', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span>🔓 링크 공유</span><span>▾</span></div>
            <div style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #EEE', fontSize: '9px', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span>🔒 비밀번호</span><span>▾</span></div>
          </div>
          {/* 내보내기 */}
          <div style={{ fontSize: '8.5px', color: '#9CA3AF', fontWeight: 700, marginBottom: '6px' }}>문서로 내보내기</div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {[['PPTX', '#FFF7ED'], ['PDF', '#FEF2F2'], ['Word', '#F0F9FF']].map(([f, bg]) => (
              <div key={f} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #EEE', background: bg, textAlign: 'center', fontSize: '9.5px', fontWeight: 700, color: '#374151' }}>{f}</div>
            ))}
          </div>
          {/* SNS */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[{ l: '카카오톡', bg: '#FEE500', c: '#111' }, { l: '이메일', bg: '#F3F4F6', c: '#374151' }, { l: 'X / Twitter', bg: '#F3F4F6', c: '#374151' }].map(b => (
              <div key={b.l} style={{ flex: 1, padding: '7px', borderRadius: '8px', background: b.bg, textAlign: 'center', fontSize: '9.5px', fontWeight: 600, color: b.c }}>{b.l}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 씬 6: 따라하기(Live Guide) — 마우스 클릭 + 우측 패널 + AI 로봇 ──────────
function Scene6({ tick }: { tick: number }) {
  const step = tick < 3500 ? 0 : 1;
  const total = 6;
  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <MimicAppHeader mode="guide" />
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {/* 좌측: 정부24 화면 + 스포트라이트(마우스 커서 포함) */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div key={step} style={{ position: 'absolute', inset: 0, animation: 'sceneIn 0.4s ease both' }}>
            <StepScreen step={step} mode="guide" />
          </div>
        </div>
        {/* 우측 사이드 패널 — Live Guide 진행 */}
        <div style={{ width: '152px', borderLeft: '1px solid #EEE', background: '#FAFAFB', display: 'flex', flexDirection: 'column', flexShrink: 0, zIndex: 12 }}>
          <div style={{ padding: '11px 11px 8px', borderBottom: '1px solid #EEE' }}>
            <div style={{ fontSize: '9px', fontWeight: 800, color: '#6d28d9', display: 'flex', alignItems: 'center', gap: '4px' }}>● LIVE GUIDE BETA</div>
            <div style={{ fontSize: '8.5px', color: '#9CA3AF', marginTop: '3px' }}>{step + 1} / {total} 단계 진행 중</div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', padding: '8px' }}>
            {GUIDE_STEPS.map((s, i) => {
              const done = i < step, cur = i === step;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 6px', borderRadius: '6px', marginBottom: '2px', background: cur ? '#EDE9FE' : 'transparent' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: done ? '#10B981' : cur ? '#6d28d9' : '#E5E7EB', color: '#fff', fontSize: '7px', fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {done ? '✓' : i + 1}
                  </span>
                  <span style={{ fontSize: '8px', fontWeight: cur ? 600 : 400, color: cur ? '#4c1d95' : done ? '#9CA3AF' : '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: done ? 'line-through' : 'none' }}>{s.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* 하단 페이지네이션 */}
      <div style={{ position: 'absolute', bottom: '12px', left: 'calc(50% - 76px)', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 14px', borderRadius: '999px', background: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.15)', border: '1px solid #EEE', zIndex: 13 }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#374151' }}>{step + 1} / {total}</span>
        <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#F3F4F6', fontSize: '9.5px', color: '#9CA3AF', fontWeight: 600 }}>이전</span>
        <span style={{ padding: '4px 12px', borderRadius: '6px', background: 'linear-gradient(135deg,#6d28d9,#3730a3)', fontSize: '9.5px', color: '#fff', fontWeight: 700 }}>다음 →</span>
      </div>
    </div>
  );
}


// ── 제품 쇼케이스: 코드로 그린 실제 화면 목업 ──
function ShowcaseMedia({ videoSrc, fallback }: { videoSrc: string; fallback: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const hasVideo = videoSrc.length > 0;
  return (
    <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E5E7EB', boxShadow: '0 24px 60px -16px rgba(55,48,163,0.18), 0 6px 20px rgba(17,24,39,0.06)', background: 'white' }}>
      {!ready && fallback}
      {hasVideo && (
        <video
          src={videoSrc} muted loop autoPlay playsInline preload="metadata"
          onCanPlay={() => setReady(true)}
          style={{ display: ready ? 'block' : 'none', width: '100%', verticalAlign: 'top' }}
        />
      )}
    </div>
  );
}

// 목업 공통: 브라우저/앱 상단바
function MockTopBar({ url, dark }: { url: string; dark?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: dark ? '#18181B' : '#F3F4F6', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : '#E5E7EB'}` }}>
      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#FF5F57' }} />
      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#FEBC2E' }} />
      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#28C840' }} />
      <div style={{ flex: 1, margin: '0 10px', padding: '3px 11px', borderRadius: '6px', background: dark ? 'rgba(255,255,255,0.07)' : 'white', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'}`, fontSize: '10.5px', color: dark ? 'rgba(255,255,255,0.45)' : '#9CA3AF' }}>{url}</div>
    </div>
  );
}

// ① 녹화 — 클릭하면 자동 캡처 (우측 MIMIC Recorder 사이드 패널에 동일 화면이 미리보기로 캡처됨)
function MockRecord() {
  const STEPS = [
    { label: '문서 열기' },
    { label: '메뉴 펼치기' },
    { label: '"공유" 버튼 클릭', hl: true },
  ];
  return (
    <div className="record-flash-demo" style={{ height: '340px', background: '#E9E9F0', position: 'relative', display: 'flex' }}>
      <div className="capture-sweep" />
      {/* 좌측 — Google Docs (녹화 대상) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <MockTopBar url="docs.google.com/document/d/…" />
        <div style={{ flex: 1, padding: '18px 22px', position: 'relative', background: 'white' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '12px' }}>2026 상반기 온보딩 문서</div>
          {[92, 100, 78, 100, 64].map((w, i) => (
            <div key={i} style={{ height: '9px', width: `${w}%`, borderRadius: '4px', background: '#F1F5F9', marginBottom: '9px' }} />
          ))}
          {/* 공유 버튼 + 클릭 하이라이트 + 커서 */}
          <div style={{ position: 'relative', display: 'inline-block', marginTop: '10px' }}>
            <div style={{ padding: '8px 18px', borderRadius: '8px', background: '#2563EB', color: 'white', fontSize: '12px', fontWeight: 600 }}>공유</div>
            <div style={{ position: 'absolute', inset: '-4px', border: '2.5px solid #EF4444', borderRadius: '11px', pointerEvents: 'none' }} />
            <span style={{ position: 'absolute', top: '50%', left: '50%', width: '40px', height: '40px', borderRadius: '50%', border: '2.5px solid rgba(37,99,235,0.5)', transform: 'translate(-50%,-50%)', animation: 'rippleOut 1.4s ease-out infinite' }} />
            <span className="capture-flash" />
            <div className="record-cursor" style={{ position: 'absolute', top: '62%', left: '58%', pointerEvents: 'none' }}><CursorIcon /></div>
          </div>
          <div className="capture-toast" style={{ position: 'absolute', left: '22px', bottom: '18px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: '#111827', boxShadow: '0 10px 28px rgba(17,24,39,0.28)', color: 'white' }}>
            <span style={{ width: '22px', height: '22px', borderRadius: '7px', background: 'linear-gradient(135deg,#7C3AED,#3730A3)', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 800 }}>✓</span>
            <span style={{ fontSize: '10.5px', lineHeight: 1.35 }}><strong style={{ display: 'block', fontSize: '11.5px' }}>클릭 캡처 완료</strong>새 스텝이 자동으로 추가됐어요</span>
          </div>
          {/* 녹화 중 배지 */}
          <div style={{ position: 'absolute', top: '14px', right: '16px', display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 11px', background: 'rgba(10,10,15,0.85)', borderRadius: '999px', fontSize: '10.5px', color: 'white', fontWeight: 500 }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', animation: 'rec-blink 1.2s infinite' }} />
            MIMIC 녹화 중
          </div>
        </div>
      </div>
      {/* 우측 — MIMIC Recorder 사이드 패널 */}
      <div style={{ width: '186px', background: 'white', borderLeft: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '19px', height: '19px', borderRadius: '6px', background: 'linear-gradient(135deg,#6d28d9,#3730a3)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: '10px' }}>M</div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#1a1a2e' }}>MIMIC Recorder</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#EF4444', animation: 'rec-blink 1.2s infinite' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#EF4444' }}>REC</span>
            <span style={{ fontSize: '8.5px', color: '#9CA3AF', fontFamily: 'monospace' }}>00:24</span>
          </div>
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#6d28d9', background: '#EDE9FE', padding: '2px 7px', borderRadius: '999px' }}>3 steps</span>
        </div>
        <div style={{ fontSize: '8.5px', color: '#9CA3AF', fontWeight: 700, padding: '7px 12px 5px' }}>캡처된 스텝</div>
        <div style={{ flex: 1, overflow: 'hidden', padding: '0 9px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {STEPS.map((s, i) => (
            <div key={i} className="record-step-card" style={{ animationDelay: `${i * 0.24}s`, border: `1px solid ${s.hl ? '#C4B5FD' : '#E5E7EB'}`, borderRadius: '8px', overflow: 'hidden', boxShadow: s.hl ? '0 2px 10px rgba(109,40,217,0.16)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 7px', background: '#FAFAFB' }}>
                <span style={{ width: '13px', height: '13px', borderRadius: '4px', background: '#6d28d9', color: '#fff', fontSize: '7.5px', fontWeight: 700, display: 'grid', placeItems: 'center' }}>{i + 1}</span>
                <span style={{ fontSize: '8px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
              </div>
              {/* 썸네일 — 좌측 문서 화면이 그대로 캡처됨 */}
              <div style={{ height: '40px', background: '#fff', padding: '5px 7px', position: 'relative' }}>
                <div style={{ height: '4px', width: '55%', borderRadius: '2px', background: '#E5E7EB', marginBottom: '3px' }} />
                {[82, 96].map((w, j) => <div key={j} style={{ height: '3px', width: `${w}%`, borderRadius: '2px', background: '#F1F5F9', marginBottom: '3px' }} />)}
                {s.hl && <div style={{ position: 'absolute', bottom: '5px', left: '7px', padding: '1.5px 6px', borderRadius: '3px', background: '#2563EB', color: '#fff', fontSize: '6px', fontWeight: 700, boxShadow: '0 0 0 1.5px #EF4444' }}>공유</div>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 11px', borderTop: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', gap: '7px', fontSize: '10px', color: '#9CA3AF' }}><span>📷</span><span>⏸</span><span>↩</span></div>
          <div style={{ padding: '5px 12px', borderRadius: '6px', background: 'linear-gradient(135deg,#3730a3,#6d28d9)', color: '#fff', fontSize: '9.5px', fontWeight: 700 }}>✓ 완료</div>
        </div>
      </div>
    </div>
  );
}

// ② 에디터 — 어노테이션 + 줌인
function MockEditor() {
  const TOOLS = ['↖', '→', '▢', '◯', 'T', '#', '▩', '☀'];
  return (
    <div style={{ height: '340px', background: '#111827', display: 'flex', flexDirection: 'column' }}>
      <MockTopBar url="app.mimic.so/editor" dark />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '150px 1fr', minHeight: 0 }}>
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.07)', padding: '12px 9px' }}>
          <div style={{ fontSize: '8.5px', color: '#6B7280', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '7px', padding: '0 3px' }}>스텝 목록</div>
          {['로그인 화면 열기', '공유 버튼 클릭', '권한 설정', '링크 복사'].map((s, i) => (
            <div key={i} style={{ padding: '6px 8px', borderRadius: '6px', marginBottom: '4px', background: i === 1 ? 'rgba(109,40,217,0.22)' : 'rgba(255,255,255,0.04)', border: `1px solid ${i === 1 ? 'rgba(109,40,217,0.45)' : 'rgba(255,255,255,0.06)'}`, fontSize: '9.5px', color: i === 1 ? 'white' : '#6B7280', fontWeight: i === 1 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {i + 1}. {s}
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 14px', position: 'relative' }}>
          {/* 어노테이션 툴바 */}
          <div style={{ display: 'inline-flex', gap: '3px', padding: '4px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '10px' }}>
            {TOOLS.map((t, i) => (
              <span key={i} style={{ width: '22px', height: '22px', borderRadius: '5px', display: 'grid', placeItems: 'center', fontSize: '10px', color: i === 1 ? 'white' : '#9CA3AF', background: i === 1 ? '#6d28d9' : 'transparent' }}>{t}</span>
            ))}
          </div>
          {/* 캔버스 — 캡처된 화면(스크린샷) 위에 어노테이션 */}
          <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', position: 'relative', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
            {/* 미니 브라우저 바 */}
            <div style={{ height: '22px', background: '#E9EAEE', display: 'flex', alignItems: 'center', gap: '4px', padding: '0 9px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF5F57' }} />
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FEBC2E' }} />
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#28C840' }} />
              <span style={{ fontSize: '8px', color: '#9CA3AF', marginLeft: '6px' }}>docs.google.com/document/d/…</span>
            </div>
            {/* 캡처된 문서 화면 */}
            <div style={{ background: '#fff', padding: '13px 15px 26px', position: 'relative' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A', marginBottom: '9px' }}>2026 상반기 온보딩 문서</div>
              {[90, 100, 72].map((w, i) => <div key={i} style={{ height: '6px', width: `${w}%`, borderRadius: '3px', background: '#F1F5F9', marginBottom: '7px' }} />)}
              {/* 공유 버튼 + 어노테이션 (빨간 박스 + 화살표 + 캡션) */}
              <div style={{ position: 'relative', display: 'inline-block', marginTop: '10px' }}>
                <div style={{ padding: '6px 16px', borderRadius: '6px', background: '#2563EB', color: 'white', fontSize: '10px', fontWeight: 600 }}>공유</div>
                <div style={{ position: 'absolute', inset: '-5px', border: '2.5px solid #EF4444', borderRadius: '9px', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: 'calc(100% + 14px)', left: '50%', transform: 'translateX(-50%)', background: '#1f2937', color: '#fff', fontSize: '8px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>여기를 클릭</div>
                <span style={{ position: 'absolute', bottom: 'calc(100% + 1px)', left: '50%', transform: 'translateX(-50%)', color: '#EF4444', fontSize: '12px', lineHeight: 1 }}>↓</span>
              </div>
              {/* 줌 컨트롤 */}
              <div style={{ position: 'absolute', bottom: '8px', right: '9px', display: 'flex', gap: '5px', padding: '3px 9px', borderRadius: '999px', background: 'rgba(17,24,39,0.85)', fontSize: '9px', color: 'white', alignItems: 'center' }}>
                <span>−</span><span style={{ fontWeight: 700 }}>140%</span><span>+</span>
              </div>
            </div>
          </div>
          {/* AI 다듬기 배지 */}
          <div style={{ position: 'absolute', bottom: '12px', left: '14px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '999px', background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(109,40,217,0.4)', fontSize: '10px', color: '#C4B5FD', fontWeight: 600 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#a78bfa"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
            AI 다듬기 적용됨
          </div>
        </div>
      </div>
    </div>
  );
}

// ③ AI 설명 초안 — AI Vision 설명 생성
function MockEduMode() {
  return (
    <div style={{ height: '340px', background: 'white', display: 'flex', flexDirection: 'column' }}>
      <MockTopBar url="app.mimic.so/manual" />
      <div style={{ flex: 1, padding: '16px 20px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>거래처 등록 교육 자료</span>
          <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#6d28d9', background: '#F5F3FF', border: '1px solid #DDD6FE', padding: '2px 8px', borderRadius: '999px' }}>AI 설명 초안</span>
        </div>
        {[
          { num: '01', title: '거래처 관리 메뉴 진입', desc: '상단 메뉴에서 [기준정보] > [거래처 관리]를 클릭합니다. 거래처 목록 화면이 표시되며, 우측 상단에서 신규 등록을 시작할 수 있습니다.' },
          { num: '02', title: '신규 거래처 정보 입력', desc: '사업자등록번호를 먼저 입력하면 중복 여부가 자동 검증됩니다. 상호명과 대표자명은 사업자등록증과 동일하게 입력해 주세요.' },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', padding: '11px 13px', borderRadius: '11px', border: '1px solid #EDEDED', marginBottom: '9px', background: 'white' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '7px', background: 'linear-gradient(135deg,#3730a3,#6d28d9)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '9px', fontWeight: 800, color: 'white' }}>{s.num}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#111827', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {s.title}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '8.5px', fontWeight: 700, color: '#7C3AED' }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="#a78bfa"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                  AI 생성
                </span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#6B7280', lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          </div>
        ))}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '999px', background: 'rgba(109,40,217,0.08)', border: '1px dashed rgba(109,40,217,0.35)', fontSize: '10px', color: '#6d28d9', fontWeight: 600 }}>
            <span style={{ display: 'inline-flex', gap: '2px' }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#6d28d9', animation: `dotBounce 1.2s ${i * 0.15}s ease-in-out infinite` }} />)}
            </span>
            AI Vision이 다음 화면을 분석하고 있어요
        </div>
      </div>
    </div>
  );
}

// ④ 라이브 가이드 — 실제 페이지 위 오버레이 (Scene6 스타일)
function MockGuideMe() {
  const GUIDE_STEPS_MOCK = [
    { num: '01', label: '주민등록초본 메뉴', done: true },
    { num: '02', label: '발급하기 버튼 클릭', active: true },
    { num: '03', label: '간편인증 로그인' },
    { num: '04', label: '발급 형태 선택' },
  ];
  return (
    <div style={{ height: '340px', background: 'white', display: 'flex', flexDirection: 'column' }}>
      <MockTopBar url="정부24.go.kr/certificate/list" />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 좌측 — 정부24 화면 (딤 + 스포트라이트) */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#f5f7fa' }}>
          {/* 딤 오버레이 */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,13,20,0.52)', zIndex: 1 }} />
          {/* 정부24 페이지 내용 */}
          <div style={{ padding: '14px 16px' }}>
            <div style={{ height: '28px', background: '#0d4a9e', borderRadius: '6px', marginBottom: '12px', display: 'flex', alignItems: 'center', padding: '0 12px', gap: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: 'white' }}>정부24</span>
              {['민원', '서비스', '정보', '나의서비스'].map(m => (
                <span key={m} style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{m}</span>
              ))}
            </div>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px' }}>주민등록초본(주민등록표 초본)</div>
            {[72, 90, 60].map((w, i) => (
              <div key={i} style={{ height: '7px', width: `${w}%`, borderRadius: '3px', background: '#d1d9e0', marginBottom: '7px' }} />
            ))}
            {/* 발급하기 버튼 — 스포트라이트 */}
            <div style={{ position: 'relative', display: 'inline-block', marginTop: '12px', zIndex: 2 }}>
              <div style={{ padding: '8px 18px', borderRadius: '7px', background: '#0d4a9e', color: 'white', fontSize: '11px', fontWeight: 700, boxShadow: '0 0 0 3px #6d28d9, 0 0 0 2000px rgba(13,13,20,0.52)' }}>
                발급하기
              </div>
              <span style={{ position: 'absolute', inset: '-6px', borderRadius: '11px', border: '2px solid rgba(167,139,250,0.9)', animation: 'rippleOut 1.6s ease-out infinite', zIndex: 3 }} />
              {/* 커서 */}
              <div style={{ position: 'absolute', top: '60%', left: '55%', zIndex: 4, pointerEvents: 'none' }}>
                <CursorIcon size={18} />
              </div>
            </div>
          </div>
        </div>
        {/* 우측 — LIVE GUIDE 사이드 패널 */}
        <div style={{ width: '168px', background: '#0d0d14', display: 'flex', flexDirection: 'column', flexShrink: 0, borderLeft: '1px solid rgba(109,40,217,0.35)' }}>
          {/* 패널 헤더 */}
          <div style={{ background: 'linear-gradient(135deg,#3730a3,#6d28d9)', padding: '9px 12px' }}>
            <div style={{ fontSize: '8.5px', fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em', marginBottom: '2px' }}>LIVE GUIDE BETA</div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'white' }}>주민등록초본 발급</div>
          </div>
          {/* AI 로봇 아바타 + 말풍선 */}
          <div style={{ padding: '10px 11px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg,#4338ca,#6d28d9)', display: 'grid', placeItems: 'center', fontSize: '15px', flexShrink: 0 }}>🤖</div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 9px' }}>
                <div style={{ fontSize: '9px', color: '#e2d9f3', lineHeight: 1.5 }}>파란 <span style={{ color: '#a78bfa', fontWeight: 700 }}>발급하기</span> 버튼을 클릭하세요 👆</div>
              </div>
            </div>
          </div>
          {/* 스텝 목록 */}
          <div style={{ flex: 1, padding: '10px 11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {GUIDE_STEPS_MOCK.map((s) => (
              <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '7px', opacity: s.done || s.active ? 1 : 0.45 }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0, background: s.done ? '#6d28d9' : s.active ? 'rgba(109,40,217,0.25)' : 'rgba(255,255,255,0.06)', border: s.active ? '1.5px solid #6d28d9' : 'none', display: 'grid', placeItems: 'center' }}>
                  {s.done
                    ? <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : <span style={{ fontSize: '6.5px', fontWeight: 700, color: s.active ? '#a78bfa' : '#6B7280' }}>{s.num}</span>}
                </div>
                <span style={{ fontSize: '9px', color: s.active ? 'white' : s.done ? '#a78bfa' : '#6B7280', fontWeight: s.active ? 700 : 400, lineHeight: 1.3 }}>{s.label}</span>
                {s.active && <span style={{ marginLeft: 'auto', width: '5px', height: '5px', borderRadius: '50%', background: '#a78bfa', flexShrink: 0, animation: 'rec-blink 1.2s infinite' }} />}
              </div>
            ))}
          </div>
          {/* 진행 바 */}
          <div style={{ padding: '9px 11px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '8.5px', color: '#6B7280' }}>진행률</span>
              <span style={{ fontSize: '8.5px', fontWeight: 700, color: '#a78bfa' }}>2 / 4</span>
            </div>
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px' }}>
              <div style={{ width: '50%', height: '100%', background: 'linear-gradient(90deg,#6d28d9,#a78bfa)', borderRadius: '999px' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ⑤ 공유·내보내기·팀
function MockShare() {
  return (
    <div style={{ height: '340px', background: '#F8F8FA', display: 'flex', flexDirection: 'column' }}>
      <MockTopBar url="app.mimic.so/manual" />
      <div style={{ flex: 1, padding: '16px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>주민등록초본 발급 안내</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              {['#FDE68A', '#BFDBFE', '#C7D2FE'].map((c, i) => (
                <span key={i} style={{ width: '18px', height: '18px', borderRadius: '50%', background: c, border: '2px solid white', marginLeft: i > 0 ? '-8px' : 0, display: 'grid', placeItems: 'center', fontSize: '8px', fontWeight: 700, color: '#374151' }}>{['김', '이', '박'][i]}</span>
              ))}
              <span style={{ fontSize: '9.5px', color: '#9CA3AF' }}>팀원 3명이 함께 편집 중</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['PDF', 'PPTX', 'Word'].map(f => (
              <span key={f} style={{ padding: '5px 11px', borderRadius: '7px', border: '1px solid #E5E7EB', background: 'white', fontSize: '10px', color: '#374151', fontWeight: 600 }}>{f} ↓</span>
            ))}
          </div>
        </div>
        {/* 공유 카드 */}
        <div style={{ background: 'white', borderRadius: '13px', border: '1px solid #EDEDED', padding: '14px 16px', marginBottom: '10px' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#374151', marginBottom: '7px' }}>공유 링크</div>
          <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid #E5E7EB' }}>
            <div style={{ flex: 1, padding: '8px 11px', background: '#F9FAFB', fontSize: '10px', color: '#6B7280', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>mimic.so/play/jumindeungbon</div>
            <span style={{ padding: '8px 13px', background: 'linear-gradient(135deg,#3730a3,#6d28d9)', color: 'white', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center' }}>링크 복사</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
            <span style={{ fontSize: '9.5px', color: '#6B7280' }}>비밀번호 보호 사용 중</span>
          </div>
        </div>
        {/* 팀 권한 카드 */}
        <div style={{ background: 'white', borderRadius: '13px', border: '1px solid #EDEDED', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(135deg,#3730a3,#6d28d9)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#111827' }}>팀 워크스페이스 공유</div>
            <div style={{ fontSize: '9.5px', color: '#9CA3AF' }}>Admin · Editor · Viewer 권한별 멤버 초대</div>
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#6d28d9', background: '#EDE9FE', padding: '2px 7px', borderRadius: '999px' }}>3명</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const SHOWCASES = [
  {
    id: 'record',
    eyebrow: 'STEP 1 · 녹화',
    title: '평소처럼 클릭하세요.\n캡처는 MIMIC이 합니다',
    desc: '크롬 확장을 켜고 하던 일을 그대로 하면 끝입니다. 클릭하는 순간마다 화면이 캡처되고 스텝이 만들어집니다. 대본도, 스크린샷 정리도 필요 없어요.',
    bullets: [
      '클릭하는 순간 자동 캡처 — 별도 조작 없음',
      'Google Docs·사내 시스템 등 어떤 웹사이트든 지원',
      '긴 화면은 전체 페이지 캡처로 한 번에',
      '비밀번호 입력값은 저장하지 않고 민감 영역은 편집기에서 모자이크',
    ],
    video: '',
    mock: <MockRecord />,
    badge: null as string | null,
  },
  {
    id: 'edit',
    eyebrow: 'STEP 2 · 편집',
    title: '화살표부터 모자이크까지,\n클릭 몇 번이면 끝',
    desc: '화살표·박스·마커·모자이크·스포트라이트 등 7가지 도구로 중요한 부분을 강조하세요. 강조하고 싶은 영역을 드래그하면 줌인 효과가 적용되고, 어색한 문장은 AI가 자연스럽게 다듬어 줍니다.',
    bullets: [
      '화살표 · 박스 · 마커 · 모자이크 · 스포트라이트 도구',
      '드래그 한 번으로 영역 확대(줌인) 효과',
      'AI 문장 다듬기로 설명을 자연스럽게',
      '드래그로 스텝 순서 변경, Ctrl+Z 실행 취소',
    ],
    video: '',
    mock: <MockEditor />,
    badge: null,
  },
  {
    id: 'edu',
    eyebrow: 'AI · 설명 초안',
    title: '스크린샷만 보고도\nAI가 설명을 써 드립니다',
    desc: '녹화가 끝나면 AI가 각 화면을 분석해 단계별 제목과 설명 초안을 작성합니다. 신입 교육 자료나 고객 안내 문서를 검수 중심으로 빠르게 완성할 수 있습니다.',
    bullets: [
      'AI Vision이 화면을 분석해 맥락을 이해',
      '단계별 제목·설명 초안 자동 작성',
      '어색한 문장은 에디터에서 AI 다듬기로 보완',
    ],
    video: '',
    mock: <MockEduMode />,
    badge: 'NEW',
  },
  {
    id: 'guideme',
    eyebrow: 'LIVE GUIDE BETA',
    title: '매뉴얼을 실행 순간까지\n화면 위에서 이어주세요',
    desc: '먼저 학습 가이드로 캡처 화면 위에서 안전하게 따라 해보고, 확장 프로그램이 연결된 환경에서는 실제 페이지 위 안내를 베타로 실행할 수 있습니다. 문서로 정리한 지식이 실제 행동까지 이어집니다.',
    bullets: [
      '공유 링크에서는 설치 없는 학습 가이드 제공',
      '확장 연결 시 실제 페이지 위 Live Guide Beta 실행',
      '저장된 셀렉터와 좌표로 클릭 위치 안내',
      'AI 재탐색은 일부 환경에서 보조적으로 사용',
    ],
    video: '',
    mock: <MockGuideMe />,
    badge: null,
  },
  {
    id: 'share',
    eyebrow: 'STEP 3 · 공유',
    title: '링크 하나로, 또는\nPDF·PPTX·Word로',
    desc: '완성된 매뉴얼은 링크 한 줄로 공유하세요 — 보는 사람은 설치도 로그인도 필요 없습니다. 회사 양식이 필요하면 로고와 브랜드 색상을 입혀 문서로 내보낼 수 있습니다.',
    bullets: [
      '링크 공유 + 비밀번호 보호',
      'PDF · PPTX · Word 내보내기 + 로고·색상 브랜딩',
      '팀 워크스페이스와 멤버 권한 관리는 기업 플랜에서 제공',
    ],
    video: '',
    mock: <MockShare />,
    badge: null,
  },
];

function ProductShowcase() {
  return (
    <section id="tour" style={{ padding: '96px 0 32px', background: 'white' }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
        <RevealSection>
          <span style={{ display: 'block', textAlign: 'center', fontSize: '11px', color: '#5b21b6', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '16px' }}>Product Tour</span>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.035em', margin: '0 auto 14px', maxWidth: '640px', lineHeight: 1.18, color: '#0D0D14' }}>매뉴얼 제작부터 실행 안내까지</h2>
          <p style={{ textAlign: 'center', fontSize: '16px', color: '#6B7280', maxWidth: '560px', margin: '0 auto 80px', lineHeight: 1.7 }}>SOP를 빠르게 만들고, 필요한 순간에는 화면 위 가이드로 실제 업무 완료까지 연결합니다.</p>
        </RevealSection>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '110px' }}>
          {SHOWCASES.map((sc, i) => (
            <RevealSection key={sc.id}>
              <div className={`showcase-row${i % 2 === 1 ? ' flip' : ''}`}>
                <div className="showcase-text" style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#6d28d9', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{sc.eyebrow}</span>
                    {sc.badge && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#3730a3,#6d28d9)', padding: '3px 9px', borderRadius: '999px', letterSpacing: '0.04em' }}>{sc.badge}</span>
                    )}
                  </div>
                  <h3 style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.3, color: '#0D0D14', margin: '0 0 16px', whiteSpace: 'pre-line' }}>{sc.title}</h3>
                  <p style={{ fontSize: '15.5px', color: '#6B7280', lineHeight: 1.75, margin: '0 0 24px' }}>{sc.desc}</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {sc.bullets.map(b => (
                      <li key={b} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '14px', color: '#374151', padding: '6px 0' }}>
                        <span style={{ flexShrink: 0, marginTop: '3px', width: '17px', height: '17px', borderRadius: '5px', background: '#F5F3FF', display: 'grid', placeItems: 'center' }}>
                          <CheckIcon size={10} color="#6d28d9" />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="showcase-media" style={{ flex: 1.15, minWidth: 0 }}>
                  <ShowcaseMedia videoSrc={sc.video} fallback={sc.mock} />
                </div>
              </div>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceSimulatorSection() {
  const [active, setActive] = useState(0);
  const step = simulatorDemos[active];

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % simulatorDemos.length);
    }, 3600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section id="simulator" className="service-simulator" style={{ padding: '104px 0', background: '#07070F', position: 'relative', overflow: 'hidden' }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px', position: 'relative', zIndex: 1 }}>
        <div className="simulator-grid">
            <div className="simulator-copy">
              <span className="simulator-eyebrow">Two live demos</span>
              <h2>Live Guide Beta가 실제 화면 위에서 어떻게 움직이는지 보여줍니다</h2>
              <p>
                첫 번째 데모는 눌러야 할 버튼이 화면 위에서 하이라이트되는 흐름입니다.
                두 번째 데모는 저장해둔 텍스트가 실제 입력칸 안에 자동으로 입력되는 흐름입니다.
              </p>
              <div className="simulator-steps" role="tablist" aria-label="MIMIC product simulator steps">
                {simulatorDemos.map((item, index) => (
                  <button
                    key={item.eyebrow}
                    type="button"
                    role="tab"
                    aria-selected={active === index}
                    className={`simulator-step${active === index ? ' active' : ''}`}
                    onClick={() => setActive(index)}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{item.eyebrow}</strong>
                    <small>{item.title}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="simulator-stage-shell" aria-live="polite">
              <div className="simulator-stage-header">
                <div>
                  <span>{step.eyebrow}</span>
                  <strong>{step.title}</strong>
                </div>
                <div className="simulator-rec-dot">
                  <i />
                  실제 화면 흐름
                </div>
              </div>
              <div className="simulator-follow-wrap">
                <FollowStage
                  key={step.eyebrow}
                  screenshotUrl={step.screen}
                  hotspotX={step.hotspotX}
                  hotspotY={step.hotspotY}
                  kind={step.kind}
                  typeText={step.typeText}
                  typeTextColor="#111827"
                  animateType={step.kind === 'type'}
                  showTypeIndicator={!step.hideTypeIndicator}
                  title={step.title}
                  body={step.body}
                  spotlight
                  stepNumber={active + 1}
                  isFirstStep={active === 0}
                  imgMaxHeight="470px"
                  bubbleAnchor="bottom-left"
                  domRect={step.domRect}
                />
              </div>
            </div>
        </div>
      </div>
    </section>
  );
}

function HeroSection() {
  return (
    <section style={{ padding: '96px 0 0', background: '#07070F', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      {/* Animated ambient orbs */}
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />
      <div className="hero-orb hero-orb-3" />
      {/* Subtle grid overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '72px 72px', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '0 32px', position: 'relative' }}>
        {/* Announcement badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 16px 5px 6px', background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.22)', borderRadius: '999px', fontSize: '12.5px', color: '#c4b5fd', fontWeight: 500, marginBottom: '36px', backdropFilter: 'blur(8px)' }}>
          <span style={{ padding: '3px 10px', borderRadius: '999px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', fontSize: '10px', fontWeight: 700, color: 'white', letterSpacing: '0.06em', flexShrink: 0 }}>NEW</span>
          매뉴얼을 만들고, Live Guide Beta로 끝까지 실행까지 안내합니다
        </div>

        <h1 style={{ margin: '0 auto 24px', fontSize: 'clamp(44px, 7vw, 84px)', lineHeight: 1.04, fontWeight: 800, letterSpacing: '-0.045em', maxWidth: '880px', color: 'white', wordBreak: 'keep-all' }}>
          Don&apos;t Explain,{' '}
          <span style={{ background: 'linear-gradient(135deg, #e0d7ff 0%, #c4b5fd 40%, #a78bfa 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', display: 'inline-block' }}>
            Just Mimic.
          </span>
        </h1>

        <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: 'rgba(255,255,255,0.48)', maxWidth: '560px', margin: '0 auto 48px', lineHeight: 1.8, fontWeight: 400 }}>
          클릭 위치만 알려주는 데서 멈추지 않습니다. 필요한 텍스트는 화면 위에서 자동으로 입력하고,<br/>
          사용자가 하려는 일을 처음부터 최종 목적지까지 차근차근 따라가게 합니다.
        </p>

        <div className="hero-cta-row" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '60px' }}>
          <Link href="/auth/login"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 28px', borderRadius: '12px', fontSize: '15px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', boxShadow: '0 0 0 1px rgba(167,139,250,0.18), 0 8px 28px rgba(109,40,217,0.48)', textDecoration: 'none' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            무료로 시작하기
          </Link>
          <a href="#tour" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '14px 22px', borderRadius: '12px', fontSize: '15px', fontWeight: 500, color: 'rgba(255,255,255,0.60)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', textDecoration: 'none' }}>
            제품 둘러보기
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          </a>
        </div>

        {/* Key metrics */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '64px' }}>
          {[
            { value: '30초', label: 'SOP·매뉴얼 초안' },
            { value: 'Live', label: '클릭 + 자동 입력 안내' },
            { value: '끝까지', label: '목표 완료까지 동행' },
          ].map((stat, i) => (
            <div key={stat.label} style={{ textAlign: 'center', padding: '16px 40px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
              <div style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '6px', background: 'linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.65) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{stat.value}</div>
              <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.28)', fontWeight: 400 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="hero-preview" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '75%', height: '120px', background: 'radial-gradient(ellipse, rgba(109,40,217,0.32) 0%, transparent 70%)', filter: 'blur(32px)', pointerEvents: 'none', zIndex: 0 }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <HeroDemo />
          </div>
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
  const [error, setError] = useState('');
  const [proModal, setProModal] = useState<'basic' | 'pro' | 'team' | null>(null);
  const [proEmail, setProEmail] = useState('');
  const [proSubmitted, setProSubmitted] = useState(false);
  const [proError, setProError] = useState('');

  const handleProSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('올바른 이메일 주소를 입력해 주세요.'); return; }
    setError('');
    try {
      const res = await fetch('/api/pro-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan_interested: 'pro', source: 'landing' }),
      });
      if (!res.ok) throw new Error(res.statusText);
      setSubmitted(true);
    } catch { setError('일시적인 오류로 등록에 실패했어요. 잠시 후 다시 시도해 주세요.'); }
  };

  const handleProPlanSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proEmail)) { setProError('올바른 이메일 주소를 입력해 주세요.'); return; }
    setProError('');
    try {
      const res = await fetch('/api/pro-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: proEmail, plan_interested: proModal, source: 'landing' }),
      });
      if (!res.ok) throw new Error(res.statusText);
      setProSubmitted(true);
    } catch { setProError('일시적인 오류로 신청에 실패했어요. 잠시 후 다시 시도해 주세요.'); }
  };

  const prices = {
    basic: billing === 'month' ? '₩9,900' : '₩8,250',
    pro: billing === 'month' ? '₩19,900' : '₩16,580',
  };

  const faqs = [
    { q: '언제든 취소할 수 있나요?', a: '네, 마이페이지에서 언제든 구독을 해지할 수 있어요. 해지 후에도 결제한 기간까지는 모든 기능을 그대로 사용하실 수 있습니다.' },
    { q: '무료 플랜의 매뉴얼은 어떻게 보관되나요?', a: '무료 플랜에서 만든 매뉴얼은 영구 보관됩니다. 매일 만들 수 있는 개수만 3개로 제한되며, 기존에 만든 매뉴얼 열람·편집·공유는 평생 자유롭게 가능합니다.' },
    { q: '어떤 결제 방법을 지원하나요?', a: '국내·해외 주요 신용카드와 카카오페이, 토스페이를 지원합니다. 기업 결제는 세금계산서 발행이 가능합니다.' },
    { q: '플랜은 자유롭게 변경할 수 있나요?', a: '언제든 업그레이드·다운그레이드할 수 있어요. 업그레이드는 즉시 반영되고, 다운그레이드는 다음 결제 주기부터 적용됩니다.' },
    { q: '환불 정책은 어떻게 되나요?', a: '결제 후 7일 이내, 유료 기능을 한 번도 사용하지 않은 경우 전액 환불이 가능합니다. 자세한 내용은 환불 정책 페이지를 참고해주세요.' },
    { q: '팀이나 회사 단위로 사용하려면 어떻게 하나요?', a: '팀 워크스페이스를 만들고 팀원을 초대하면 매뉴얼을 공유 폴더로 함께 관리할 수 있습니다. 멤버 권한으로 볼 수 있는 사람과 편집할 수 있는 사람을 나누고, 기업 맞춤 도입(보안 검토, 세금계산서 등)은 기업 데모 신청을 통해 상담해 드립니다.' },
  ];

  return (
    <div style={{ fontFamily: "'Pretendard', 'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif", color: '#111827', background: '#fff', WebkitFontSmoothing: 'antialiased' }}>

      {/* Pro 플랜 사전예약 모달 */}
      {proModal && (
        <div onClick={() => { setProModal(null); setProSubmitted(false); setProEmail(''); setProError(''); }} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.60)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '440px', boxShadow: '0 40px 80px rgba(0,0,0,0.15)' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', marginBottom: '16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#0D0D14', marginBottom: '6px' }}>{proModal === 'team' ? 'Team' : proModal === 'basic' ? 'Basic' : 'Pro'} 플랜 사전예약</div>
              <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.6, margin: 0 }}>{proModal !== 'team' ? '출시 즉시 알림 + 얼리버드 할인 혜택을 드립니다.' : '담당자가 직접 연락드려 요금과 도입 조건을 안내해 드립니다.'}</p>
            </div>
            {!proSubmitted ? (
              <form onSubmit={handleProPlanSignup}>
                <input type="email" value={proEmail} onChange={e => setProEmail(e.target.value)} placeholder="이메일 주소" required style={{ width: '100%', height: '46px', padding: '0 14px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', color: '#111827', outline: 'none', boxSizing: 'border-box', marginBottom: '12px', fontFamily: 'inherit' }} />
                <button type="submit" style={{ width: '100%', height: '46px', borderRadius: '10px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer' }}>{proModal !== 'team' ? '사전예약 신청하기' : '도입 문의 신청하기'}</button>
                {proError && <div style={{ marginTop: '10px', fontSize: '12.5px', color: '#DC2626', textAlign: 'center' }}>{proError}</div>}
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px', background: '#F0FDF4', borderRadius: '12px', color: '#15803D', fontSize: '14px', fontWeight: 500 }}>
                ✓ {proModal !== 'team' ? '등록되었습니다. 출시일에 가장 먼저 알려드릴게요!' : '접수되었습니다. 담당자가 곧 연락드릴게요!'}
              </div>
            )}
            <button onClick={() => { setProModal(null); setProSubmitted(false); setProEmail(''); setProError(''); }} style={{ width: '100%', marginTop: '12px', padding: '10px', background: 'none', border: 'none', color: '#9CA3AF', fontSize: '13px', cursor: 'pointer' }}>닫기</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(7,7,15,0.82)', backdropFilter: 'saturate(180%) blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', gap: '32px', height: '64px' }}>
          <Link href="/landingpage" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px', color: 'white', textDecoration: 'none', letterSpacing: '-0.01em' }}>
            <BrandMark />
            MIMIC
          </Link>
          <nav style={{ display: 'flex', gap: '28px', marginLeft: '8px' }}>
            {['제품 투어', '기능', '사용 방법', '요금제', '기업 문의', 'FAQ'].map((item, i) => (
              <a key={item} href={['#tour', '#features', '#how', '#pricing', '#b2b', '#faq'][i]}
                style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.50)', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'color 0.15s', fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.90)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.50)'}
              >{item}</a>
            ))}
          </nav>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link href="/download/desktop"
              style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#7de5dc', border: '1px solid rgba(0,169,157,.28)', background: 'rgba(0,169,157,.08)', textDecoration: 'none' }}
            >Desktop 앱</Link>
            <Link href="/auth/login"
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 500, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.90)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)'}
            >로그인</Link>
            <Link href="/auth/login"
              style={{ padding: '9px 18px', borderRadius: '9px', fontSize: '13.5px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', boxShadow: '0 0 0 1px rgba(167,139,250,0.2), 0 4px 12px rgba(109,40,217,0.35)', textDecoration: 'none' }}
            >무료로 시작</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <HeroSection />

      {/* Product Simulator */}
      <ServiceSimulatorSection />

      {/* Manifesto */}
      <section style={{ padding: '128px 0', background: 'linear-gradient(180deg, #07070F 0%, #0d0d1c 100%)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(109,40,217,0.20) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 0%, rgba(109,40,217,0.35) 30%, rgba(109,40,217,0.35) 70%, transparent 100%)', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 32px', textAlign: 'center', position: 'relative' }}>
          <RevealSection>
            <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7c3aed', marginBottom: '36px' }}>
              <span style={{ flex: 1, maxWidth: '80px', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5))' }} />
              The MIMIC Way
              <span style={{ flex: 1, maxWidth: '80px', height: '1px', background: 'linear-gradient(90deg, rgba(124,58,237,0.5), transparent)' }} />
            </p>
            <h2 style={{ fontSize: 'clamp(38px, 6vw, 72px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.04em', color: 'white', margin: '0 0 28px', wordBreak: 'keep-all' }}>
              절차를 기록하면<br />
              <span style={{ background: 'linear-gradient(135deg, #e0d7ff 0%, #c4b5fd 40%, #818cf8 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                실행까지 이어진다.
              </span>
            </h2>
            <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.42)', maxWidth: '500px', margin: '0 auto 56px', lineHeight: 1.8, fontWeight: 400 }}>
              녹화 버튼 하나만 켜면 됩니다. 클릭, 입력, 스크롤 — 당신의 모든 동작이 SOP가 되고, 필요한 순간에는 화면 위 안내가 됩니다.
            </p>
            <div style={{ display: 'inline-flex', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)', flexWrap: 'wrap' }}>
              {[
                { label: '절차 기록', desc: '하던 일 그대로' },
                { label: 'AI 정리', desc: 'SOP 초안 생성' },
                { label: '실행 연결', desc: '화면 위 가이드' },
              ].map((item, i) => (
                <div key={item.label} style={{ padding: '24px 36px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none', textAlign: 'center', background: i === 1 ? 'rgba(109,40,217,0.09)' : 'transparent', minWidth: '140px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '5px' }}>{item.label}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.32)' }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Problem */}
      <section style={{ padding: '100px 0', background: '#0A0A15' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <RevealSection>
            <span style={{ display: 'block', textAlign: 'center', fontSize: '11px', color: '#7c3aed', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '16px' }}>Problem</span>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.035em', margin: '0 auto 14px', maxWidth: '680px', lineHeight: 1.18, color: 'white' }}>좋은 매뉴얼도 실행 순간에는 멀어집니다</h2>
            <p style={{ textAlign: 'center', fontSize: '16px', color: 'rgba(255,255,255,0.38)', maxWidth: '600px', margin: '0 auto 60px', lineHeight: 1.7 }}>SOP와 매뉴얼은 꼭 필요합니다. 문제는 그 지식이 실제 화면 앞에서 바로 행동으로 이어지기 어렵다는 점입니다.</p>

            <div className="grid-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {[
                { emoji: '📄', title: '문서는 남지만 실행은 따로입니다', body: '정리된 SOP가 있어도 사용자는 실제 화면 앞에서 어느 버튼을 눌러야 할지 다시 확인해야 합니다.', quote: '"지금 화면에서는 어디를 눌러요?"', accent: '#F59E0B', accentRgb: '245,158,11' },
                { emoji: '🎥', title: '영상은 흐름을 보여주지만 수정이 어렵습니다', body: '업무 화면이 바뀌면 다시 녹화하고 편집해야 합니다. 필요한 순간에 특정 단계만 바로 고치기도 어렵습니다.', quote: '"버튼 위치가 바뀌었네요"', accent: '#EF4444', accentRgb: '239,68,68' },
                { emoji: '🖥️', title: '스크린샷 자료는 제작 부담이 큽니다', body: '화면을 찍고, 자르고, 표시하고, 설명을 붙이는 일이 반복됩니다. 지식을 남기는 과정이 또 하나의 업무가 됩니다.', quote: '"정리하다가 하루가 지나갔어요"', accent: '#818cf8', accentRgb: '129,140,248' },
              ].map(p => (
                <div key={p.title}
                  style={{ padding: '32px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', transition: 'all 0.25s ease', position: 'relative', overflow: 'hidden' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-6px)'; el.style.borderColor = `rgba(${p.accentRgb},0.32)`; el.style.boxShadow = `0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(${p.accentRgb},0.10)`; el.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.borderColor = 'rgba(255,255,255,0.07)'; el.style.boxShadow = 'none'; el.style.background = 'rgba(255,255,255,0.03)'; }}
                >
                  <div style={{ position: 'absolute', top: 0, left: '32px', right: '32px', height: '1.5px', background: `linear-gradient(90deg, transparent, ${p.accent}80, transparent)` }} />
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: `${p.accent}18`, border: `1px solid ${p.accent}30`, display: 'grid', placeItems: 'center', marginBottom: '20px', fontSize: '22px' }}>{p.emoji}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px', color: 'white', letterSpacing: '-0.02em' }}>{p.title}</div>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.42)', lineHeight: 1.75, margin: 0 }}>{p.body}</p>
                  <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: '12.5px', color: 'rgba(255,255,255,0.22)', fontStyle: 'italic' }}>{p.quote}</div>
                </div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ padding: '100px 0', background: 'white' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <RevealSection>
            <span style={{ display: 'block', textAlign: 'center', fontSize: '11px', color: '#5b21b6', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '16px' }}>How it works</span>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.035em', margin: '0 auto 14px', maxWidth: '680px', lineHeight: 1.18, color: '#0D0D14' }}>3단계로 이어지는 실행형 SOP</h2>
            <p style={{ textAlign: 'center', fontSize: '16px', color: '#6B7280', maxWidth: '560px', margin: '0 auto 72px', lineHeight: 1.7 }}>업무 절차를 기록하고, AI가 매뉴얼로 정리하고, 필요한 순간에는 화면 위 가이드로 이어집니다.</p>

            <div className="grid-3col how-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0', position: 'relative' }}>
              {/* Connecting line */}
              <div style={{ position: 'absolute', top: '42px', left: '20%', right: '20%', height: '2px', background: 'linear-gradient(90deg, rgba(109,40,217,0.15), rgba(109,40,217,0.5), rgba(109,40,217,0.15))', pointerEvents: 'none', zIndex: 0 }} />
              {[
                { num: '01', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.8" fill="rgba(255,255,255,0.15)"/><path d="M8 12l2.5 2.5L16 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, title: '크롬 확장 설치 후 녹화 시작', body: '웹 작업을 평소처럼 진행하면 클릭 위치와 화면이 자동 캡처됩니다.' },
                { num: '02', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="rgba(255,255,255,0.9)"/></svg>, title: 'AI가 설명과 어노테이션 자동 완성', body: '캡처된 화면을 분석해 단계별 설명·하이라이트·화살표를 자동 생성합니다.' },
                { num: '03', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.8" fill="rgba(255,255,255,0.12)"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="white"/></svg>, title: 'Live Guide Beta로 실행까지 연결', body: '정리된 SOP를 실제 화면 위 안내로 이어서, 사용자가 어느 단계에서 막혔는지 덜 고민하고 업무를 끝낼 수 있게 돕습니다.' },
              ].map((s, i) => (
                <div key={s.num} style={{ padding: '0 40px 0', position: 'relative', zIndex: 1, textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '84px', height: '84px', borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', marginBottom: '28px', boxShadow: '0 0 0 8px rgba(109,40,217,0.08), 0 12px 28px rgba(55,48,163,0.32)', position: 'relative' }}>
                    {s.icon}
                    <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '24px', height: '24px', borderRadius: '50%', background: '#0D0D14', border: '2px solid #4f46e5', display: 'grid', placeItems: 'center', fontSize: '9px', fontWeight: 800, color: '#c4b5fd' }}>{i + 1}</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px', color: '#0D0D14', letterSpacing: '-0.02em' }}>{s.title}</div>
                  <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.75, margin: 0 }}>{s.body}</p>
                </div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Product Showcase */}
      <ProductShowcase />

      {/* Use Cases */}
      <section style={{ padding: '100px 0', background: '#FAFAFA' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <RevealSection>
            <span style={{ display: 'block', textAlign: 'center', fontSize: '11px', color: '#5b21b6', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '16px' }}>Use Cases</span>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.035em', margin: '0 auto 14px', maxWidth: '640px', lineHeight: 1.18, color: '#0D0D14' }}>어떤 팀에서 쓰고 있나요?</h2>
            <p style={{ textAlign: 'center', fontSize: '16px', color: '#6B7280', maxWidth: '520px', margin: '0 auto 60px', lineHeight: 1.7 }}>설명이 필요한 곳이라면 어디든 MIMIC으로 해결할 수 있습니다.</p>

            <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {useCases.map(uc => (
                <div key={uc.tag}
                  style={{ padding: '36px', background: 'white', border: '1.5px solid #E5E7EB', borderRadius: '20px', transition: 'all 0.25s ease', position: 'relative', overflow: 'hidden' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(79,70,229,0.28)'; el.style.boxShadow = '0 16px 40px rgba(55,48,163,0.08)'; el.style.transform = 'translateY(-4px)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#E5E7EB'; el.style.boxShadow = 'none'; el.style.transform = 'none'; }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', opacity: 0, transition: 'opacity 0.25s' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #e0e7ff, #ede9fe)', display: 'grid', placeItems: 'center', fontSize: '24px', flexShrink: 0 }}>{uc.emoji}</div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#5b21b6', background: '#ede9fe', padding: '4px 12px', borderRadius: '999px', letterSpacing: '0.04em' }}>{uc.tag}</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px', color: '#0D0D14', letterSpacing: '-0.02em', lineHeight: 1.35 }}>{uc.title}</div>
                  <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.75, margin: 0 }}>{uc.body}</p>
                </div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '100px 0', background: '#0A0A15' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <RevealSection>
            <span style={{ display: 'block', textAlign: 'center', fontSize: '11px', color: '#7c3aed', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '16px' }}>Features</span>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.035em', margin: '0 auto 14px', maxWidth: '680px', lineHeight: 1.18, color: 'white' }}>SOP를 만들고, 실행까지 돕는 기능</h2>
            <p style={{ textAlign: 'center', fontSize: '16px', color: 'rgba(255,255,255,0.38)', maxWidth: '560px', margin: '0 auto 64px', lineHeight: 1.7 }}>화면 위 Live Guide Beta · 팀 워크스페이스 · 민감정보 보호까지, 업무 지식이 실제 행동으로 이어지도록.</p>

            <div className="grid-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
              {features.map(f => (
                <div key={f.title}
                  style={{ padding: '28px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', transition: 'all 0.25s ease', position: 'relative', overflow: 'hidden' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(124,58,237,0.40)'; el.style.transform = 'translateY(-5px)'; el.style.boxShadow = '0 20px 48px rgba(0,0,0,0.5), 0 0 30px rgba(109,40,217,0.12)'; el.style.background = 'rgba(109,40,217,0.06)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(255,255,255,0.07)'; el.style.transform = 'none'; el.style.boxShadow = 'none'; el.style.background = 'rgba(255,255,255,0.03)'; }}
                >
                  {f.comingSoon && (
                    <span style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '9.5px', fontWeight: 700, color: '#c4b5fd', background: 'rgba(109,40,217,0.15)', padding: '3px 9px', borderRadius: '999px', border: '1px solid rgba(109,40,217,0.3)' }}>출시 예정</span>
                  )}
                  <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', display: 'grid', placeItems: 'center', marginBottom: '20px', boxShadow: '0 4px 16px rgba(79,70,229,0.40)' }}>
                    {f.icon}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px', color: 'white', letterSpacing: '-0.01em' }}>{f.title}</div>
                  <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.42)', lineHeight: 1.75, margin: 0 }}>{f.body}</p>
                </div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Comparison */}
      <section style={{ padding: '100px 0', background: '#FAFAFA' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <RevealSection>
          <span style={{ display: 'block', textAlign: 'center', fontSize: '11px', color: '#5b21b6', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '16px' }}>Why MIMIC</span>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.035em', margin: '0 auto 60px', maxWidth: '640px', lineHeight: 1.18, color: '#0D0D14' }}>다른 방법과 무엇이 다른가요?</h2>

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
              { label: '캡처 화면 위 연습 (학습 가이드)', vals: [false, false, true] },
              { label: 'AI 자동 설명 생성', vals: [false, false, true] },
              { label: '실제 화면 위 안내 (라이브 가이드 Beta)', vals: [false, false, 'Beta'] },
              { label: '수정 용이성', vals: ['낮음', '낮음', '높음'] },
              { label: 'AI 음성 편집', vals: [false, false, true] },
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
          </RevealSection>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: '100px 0', background: 'white' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <span style={{ display: 'block', textAlign: 'center', fontSize: '11px', color: '#5b21b6', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '16px' }}>Pricing</span>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.035em', margin: '0 auto 14px', maxWidth: '640px', lineHeight: 1.18, color: '#0D0D14' }}>무료로 시작하고, 필요한 기능은 출시 알림으로</h2>
          <p style={{ textAlign: 'center', fontSize: '16px', color: '#6B7280', maxWidth: '560px', margin: '0 auto 40px', lineHeight: 1.7 }}>현재는 무료로 매뉴얼 제작을 시작할 수 있습니다. Basic·Pro는 정식 출시 전 알림 신청을 받고 있어요.</p>

          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
              {(['month', 'year'] as const).map(b => (
                <button key={b} onClick={() => setBilling(b)} style={{ padding: '9px 20px', borderRadius: '9px', fontSize: '13.5px', color: billing === b ? '#111827' : '#6B7280', fontWeight: 500, background: billing === b ? 'white' : 'transparent', boxShadow: billing === b ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', cursor: 'pointer', whiteSpace: 'nowrap', border: 'none', transition: 'all 0.15s' }}>
                  {b === 'month' ? '월간 결제' : <>연간 결제 <span style={{ display: 'inline-block', marginLeft: '6px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', color: '#059669', fontSize: '11px', fontWeight: 600 }}>2개월 무료</span></>}
                </button>
              ))}
            </div>
          </div>

          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', maxWidth: '1180px', margin: '0 auto' }}>
            {([
              {
                name: 'Free', sub: '신용카드 없이 바로 시작', amount: '₩0', per: '/ 월', featured: false,
                planKey: null as null | 'basic' | 'pro' | 'team',
                features: ['매일 매뉴얼 3개', 'MIMIC Recorder 확장 설치', '텍스트·도형 편집', '링크 공유 + PDF', '500MB 저장 공간'],
                cta: '무료로 시작',
              },
              {
                name: 'Basic', sub: '입문자와 가벼운 사용자', amount: prices.basic, per: '/ 월', featured: false,
                planKey: 'basic' as const,
                features: ['매뉴얼 생성 한도 확대', 'AI 다듬기 월 100회', 'PPTX·Word 내보내기', '비공개 + 비밀번호 보호', '2GB 저장 공간'],
                cta: '출시 알림 받기',
              },
              {
                name: 'Pro', sub: '개인 크리에이터와 파워 유저', amount: prices.pro, per: '/ 월', featured: true,
                planKey: 'pro' as const,
                features: ['Basic 플랜 모든 기능', 'AI 다듬기 무제한', 'AI 상세 설명 생성', '학습 가이드 + Live Guide Beta', 'AI 음성 편집', '5GB 저장 공간'],
                cta: '출시 알림 받기',
              },
              {
                name: 'Team', sub: '팀·기업을 위한 맞춤 플랜', amount: '협의', per: '', featured: false,
                planKey: 'team' as const,
                features: ['Pro 플랜 모든 기능', '팀 워크스페이스', '멤버 권한 관리', '확장 저장 공간', '전용 온보딩 지원', '세금계산서 발행', '우선 지원 (SLA)'],
                cta: '도입 문의하기',
              },
            ] as const).map(plan => (
              <div key={plan.name} style={{ background: 'white', border: plan.featured ? '2px solid #3730a3' : '1.5px solid #E5E7EB', borderRadius: '20px', padding: '36px 28px', position: 'relative', transform: plan.featured ? 'translateY(-10px)' : 'none', boxShadow: plan.featured ? '0 16px 48px rgba(55,48,163,0.12), 0 4px 12px rgba(17,24,39,0.06)' : 'none' }}>
                {plan.featured && <span style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', color: 'white', padding: '5px 14px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>가장 인기</span>}
                <div style={{ fontSize: '14px', fontWeight: 700, color: plan.featured ? '#3730a3' : '#6B7280', marginBottom: '4px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{plan.name}</div>
                <div style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '24px' }}>{plan.sub}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '24px' }}>
                  <span style={{ fontSize: plan.amount === '협의' ? '30px' : '36px', fontWeight: 700, letterSpacing: '-0.03em', color: '#0D0D14', lineHeight: 1 }}>{plan.amount}</span>
                  {plan.per && <span style={{ fontSize: '13.5px', color: '#9CA3AF', fontWeight: 400, paddingBottom: '4px' }}>{plan.per}</span>}
                </div>
                {plan.planKey ? (
                  <button onClick={() => { setProModal(plan.planKey as 'basic' | 'pro' | 'team'); setProSubmitted(false); setProEmail(''); }} style={{ display: 'block', width: '100%', margin: '0 0 28px', padding: '13px 0', borderRadius: '10px', fontSize: '14px', fontWeight: 600, textAlign: 'center', cursor: 'pointer', background: plan.featured ? 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)' : 'white', color: plan.featured ? 'white' : '#374151', border: plan.featured ? 'none' : '1.5px solid #E5E7EB', boxShadow: plan.featured ? '0 4px 12px rgba(55,48,163,0.28)' : 'none', fontFamily: 'inherit' }}>{plan.cta}</button>
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
            <a href="mailto:kinjungho@gmail.com?subject=기업 데모 신청" style={{ display: 'inline-flex', alignItems: 'center', padding: '15px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 600, background: 'white', color: '#111827', textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>기업 데모 신청하기</a>
            <a href="mailto:kinjungho@gmail.com?subject=자료 요청" style={{ display: 'inline-flex', alignItems: 'center', padding: '15px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', textDecoration: 'none' }}>자료 다운로드</a>
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
      <section style={{ padding: '0 0 100px', background: '#FAFAFA' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 32px' }}>
          <div className="final-cta-inner" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 35%, #4c1d95 70%, #5b21b6 100%)', borderRadius: '28px', padding: '84px 56px', textAlign: 'center', color: 'white', position: 'relative', overflow: 'hidden' }}>
            {/* Noise grain texture */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none', opacity: 0.6 }} />
            {/* Ambient glow orbs */}
            <div style={{ position: 'absolute', top: '-120px', right: '-80px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.22) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-100px', left: '-60px', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.20) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 16px', borderRadius: '999px', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', fontSize: '12px', fontWeight: 600, marginBottom: '24px', position: 'relative', letterSpacing: '0.03em', backdropFilter: 'blur(8px)' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#c4b5fd', animation: 'pulse-dot 1.8s ease-in-out infinite' }} />
              Pro 출시 알림 받기 · 사전예약
            </span>
            <h2 style={{ fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 800, letterSpacing: '-0.04em', margin: '0 0 18px', position: 'relative', lineHeight: 1.1, wordBreak: 'keep-all' }}>첫 실행형 매뉴얼을<br/>만들어보세요</h2>
            <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.70)', maxWidth: '520px', margin: '0 auto 40px', position: 'relative', lineHeight: 1.7 }}>MIMIC Recorder 확장 설치 후 평소처럼 작업하세요. SOP는 문서로 남고, 필요한 순간에는 화면 위 안내로 이어집니다.</p>

            {!submitted ? (
              <form onSubmit={handleProSignup} style={{ position: 'relative', display: 'flex', gap: '8px', maxWidth: '440px', margin: '0 auto 28px', padding: '6px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: '14px' }}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jungho@company.com" required style={{ flex: 1, height: '46px', padding: '0 16px', border: 'none', background: 'rgba(255,255,255,0.95)', borderRadius: '9px', fontSize: '14px', color: '#111827', outline: 'none' }} />
                <button type="submit" style={{ height: '46px', padding: '0 20px', borderRadius: '9px', background: 'white', color: '#3730a3', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', cursor: 'pointer', border: 'none' }}>사전예약 →</button>
              </form>
            ) : (
              <></>
            )}
            {!submitted && error && (
              <div style={{ position: 'relative', margin: '0 auto 28px', maxWidth: '440px', fontSize: '13px', color: '#FCA5A5', textAlign: 'center' }}>{error}</div>
            )}
            {submitted && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', margin: '0 auto 28px', padding: '12px 20px', borderRadius: '999px', background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.40)', color: '#D1FAE5', fontSize: '14px', fontWeight: 500 }}>
                <CheckIcon size={14} color="#6EE7B7" /> 등록되었습니다. Pro 출시일에 가장 먼저 알려드릴게요.
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', position: 'relative' }}>
              <Link href="/auth/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '15px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 700, background: 'white', color: '#3730a3', textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                무료로 시작하기
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
              <a href="mailto:kinjungho@gmail.com?subject=기업 데모 신청" style={{ display: 'inline-flex', alignItems: 'center', padding: '15px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 500, color: 'rgba(255,255,255,0.9)', border: '1.5px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', textDecoration: 'none' }}>기업 데모 신청</a>
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
              { title: '제품', links: [{ label: '기능', href: '#features' }, { label: '사용 방법', href: '#how' }, { label: '요금제', href: '#pricing' }, { label: '변경 사항', href: '#' }] },
              { title: '회사', links: [{ label: '소개', href: '#' }, { label: '블로그', href: '#' }, { label: '채용', href: '#' }, { label: '기업 문의', href: '#b2b' }] },
              { title: '지원', links: [{ label: '이용 가이드', href: '/help' }, { label: 'FAQ', href: '#faq' }, { label: '고객센터', href: 'mailto:kinjungho@gmail.com' }, { label: '상태 페이지', href: '#' }] },
              { title: '법적 고지', links: [{ label: '이용약관', href: '/legal/terms' }, { label: '개인정보처리방침', href: '/legal/privacy' }, { label: '보안', href: '#' }, { label: '환불 정책', href: '#' }] },
            ].map(col => (
              <div key={col.title}>
                <h5 style={{ margin: '0 0 18px', fontSize: '11.5px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{col.title}</h5>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {col.links.map(l => (
                    <li key={l.label} style={{ padding: '5px 0' }}>
                      <a href={l.href} style={{ color: '#4B5563', textDecoration: 'none', transition: 'color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#9CA3AF'}
                        onMouseLeave={e => e.currentTarget.style.color = '#4B5563'}
                      >{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '24px', fontSize: '12px', color: '#374151' }}>
            <div>© 2026 코마인드웍스 · MIMIC</div>
            <div style={{ display: 'flex', gap: '20px' }}>
              {['한국어', 'English', 'kinjungho@gmail.com'].map(l => (
                <a key={l} href={l.includes('@') ? `mailto:${l}` : '#'} style={{ color: '#374151', textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#6B7280'}
                  onMouseLeave={e => e.currentTarget.style.color = '#374151'}
                >{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <style suppressHydrationWarning>{`
        /* ── 앵커 이동 시 sticky 헤더(64px)에 가려지지 않도록 보정 ── */
        section[id] { scroll-margin-top: 80px; }

        /* ── 기존 애니메이션 ── */
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
        @keyframes countPop {
          0%   { transform: scale(0.4); opacity: 0; }
          60%  { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes rippleOut {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes cursorClick {
          0%   { transform: translate(30px, 26px) scale(1.05); }
          42%  { transform: translate(0, 0) scale(1); }
          56%  { transform: translate(0, 0) scale(0.78); }
          70%  { transform: translate(0, 0) scale(1); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes recPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
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
        @keyframes captureSweep {
          0%, 18% { transform: translateX(-120%); opacity: 0; }
          28% { opacity: 0.86; }
          42% { transform: translateX(130%); opacity: 0; }
          100% { transform: translateX(130%); opacity: 0; }
        }
        @keyframes captureFlash {
          0%, 35%, 100% { opacity: 0; transform: scale(0.82); }
          43% { opacity: 0.95; transform: scale(1); }
          58% { opacity: 0; transform: scale(1.55); }
        }
        @keyframes captureToast {
          0%, 34% { opacity: 0; transform: translateY(10px) scale(0.96); }
          45%, 82% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(4px) scale(0.98); }
        }
        @keyframes recordStepPop {
          0%, 22% { opacity: 0; transform: translateX(12px) scale(0.98); }
          38%, 100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes recordCursorMove {
          0%, 18% { transform: translate(-42px, -30px) scale(1.02); }
          42% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(0, 0) scale(0.82); }
          60%, 100% { transform: translate(0, 0) scale(1); }
        }
        .record-flash-demo .capture-sweep {
          position: absolute;
          inset: 0;
          z-index: 6;
          pointer-events: none;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.02) 34%, rgba(255,255,255,0.72) 50%, rgba(167,139,250,0.22) 62%, transparent 100%);
          mix-blend-mode: screen;
          animation: captureSweep 3.2s ease-in-out infinite;
        }
        .record-flash-demo .capture-flash {
          position: absolute;
          inset: -10px;
          border-radius: 16px;
          pointer-events: none;
          background: radial-gradient(circle, rgba(255,255,255,0.92) 0%, rgba(167,139,250,0.28) 48%, transparent 72%);
          animation: captureFlash 3.2s ease-out infinite;
        }
        .record-flash-demo .capture-toast {
          animation: captureToast 3.2s ease-in-out infinite;
        }
        .record-flash-demo .record-cursor {
          animation: recordCursorMove 3.2s ease-in-out infinite;
        }
        .record-flash-demo .record-step-card {
          opacity: 0;
          animation: recordStepPop 3.2s ease-out infinite forwards;
        }

        /* ── 신규: 히어로 애니메이션 ── */
        .hero-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(80px);
        }
        .hero-orb-1 {
          top: -80px; left: -120px;
          width: 560px; height: 560px;
          background: radial-gradient(circle, rgba(109,40,217,0.13) 0%, transparent 70%);
          animation: orbFloat1 14s ease-in-out infinite;
        }
        .hero-orb-2 {
          top: 40px; right: -80px;
          width: 480px; height: 480px;
          background: radial-gradient(circle, rgba(55,48,163,0.10) 0%, transparent 70%);
          animation: orbFloat2 18s ease-in-out infinite;
        }
        .hero-orb-3 {
          bottom: 120px; left: 35%;
          width: 420px; height: 280px;
          background: radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%);
          animation: orbFloat3 22s ease-in-out infinite;
        }
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(60px, 50px) scale(1.08); }
          66% { transform: translate(-40px, 70px) scale(0.94); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40% { transform: translate(-55px, 35px) scale(1.06); }
          70% { transform: translate(35px, -45px) scale(0.96); }
        }
        @keyframes orbFloat3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-28px, -18px); }
        }

        /* ── 신규: How it works 연결선 ── */
        .how-steps { padding: 0 20px; }

        /* Product simulator */
        .service-simulator {
          border-top: 1px solid rgba(255,255,255,0.06);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .simulator-grid {
          display: grid;
          grid-template-columns: minmax(300px, 0.82fr) minmax(0, 1.38fr);
          gap: 44px;
          align-items: center;
        }
        .simulator-copy h2 {
          margin: 0 0 18px;
          color: white;
          font-size: clamp(34px, 4vw, 56px);
          line-height: 1.08;
          letter-spacing: -0.045em;
          font-weight: 850;
          word-break: keep-all;
        }
        .simulator-copy p {
          margin: 0 0 30px;
          color: rgba(255,255,255,0.56);
          font-size: 16px;
          line-height: 1.8;
          max-width: 440px;
        }
        .simulator-eyebrow {
          display: inline-flex;
          margin-bottom: 18px;
          color: #c4b5fd;
          background: rgba(124,58,237,0.12);
          border: 1px solid rgba(167,139,250,0.22);
          border-radius: 999px;
          padding: 7px 12px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }
        .simulator-steps {
          display: grid;
          gap: 10px;
        }
        .simulator-step {
          appearance: none;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          background: rgba(255,255,255,0.035);
          color: rgba(255,255,255,0.72);
          padding: 16px 18px;
          text-align: left;
          cursor: pointer;
          transition: border-color .2s ease, background .2s ease, transform .2s ease;
        }
        .simulator-step:hover,
        .simulator-step:focus-visible {
          border-color: rgba(167,139,250,0.36);
          background: rgba(255,255,255,0.06);
          outline: none;
        }
        .simulator-step.active {
          border-color: rgba(167,139,250,0.42);
          background: linear-gradient(135deg, rgba(79,70,229,0.30), rgba(124,58,237,0.18));
          transform: translateX(6px);
        }
        .simulator-step span {
          display: inline-flex;
          margin-right: 10px;
          color: #c4b5fd;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }
        .simulator-step strong {
          font-size: 13px;
          color: white;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .simulator-step small {
          display: block;
          margin-top: 6px;
          color: rgba(255,255,255,0.48);
          font-size: 13px;
          line-height: 1.45;
        }
        .simulator-stage-shell {
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 28px;
          background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.035));
          box-shadow: 0 34px 90px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.10);
          backdrop-filter: blur(16px);
        }
        .simulator-stage-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 18px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .simulator-stage-header span {
          display: block;
          color: #a78bfa;
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .simulator-stage-header strong {
          color: white;
          font-size: 16px;
          letter-spacing: -0.02em;
        }
        .simulator-rec-dot {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,0.58);
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        .simulator-rec-dot i {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 0 5px rgba(239,68,68,0.14);
          animation: recPulse 1.2s ease-in-out infinite;
        }
        .simulator-follow-wrap {
          padding: 18px;
        }
        .simulator-follow-wrap > div {
          width: 100%;
        }

        /* ── 제품 쇼케이스 ── */
        .showcase-row { display: flex; gap: 64px; align-items: center; }
        .showcase-row.flip { flex-direction: row-reverse; }

        /* ── 태블릿 반응형 ── */
        @media (max-width: 1024px) {
          .pricing-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .pricing-grid > div { transform: none !important; }
          .simulator-grid { grid-template-columns: 1fr !important; }
          .simulator-copy p { max-width: 680px !important; }
          .simulator-steps { grid-template-columns: repeat(2, 1fr) !important; }
          .simulator-step.active { transform: none !important; }
        }

        /* ── 모바일 반응형 ── */
        @media (max-width: 768px) {
          .hero-orb { filter: blur(50px) !important; }
          .hero-orb-1 { width: 300px !important; height: 300px !important; }
          .hero-orb-2 { width: 250px !important; height: 250px !important; }
          .hero-orb-3 { display: none; }

          .showcase-row, .showcase-row.flip { flex-direction: column !important; gap: 28px !important; }
          .showcase-row .showcase-text h3 { font-size: 24px !important; }
          .showcase-row .showcase-media { width: 100% !important; }
          .simulator-grid { gap: 26px !important; }
          .simulator-steps { grid-template-columns: 1fr !important; }
          .simulator-stage-header { align-items: flex-start !important; flex-direction: column !important; }
          .simulator-follow-wrap { padding: 10px !important; }
          header nav { display: none !important; }
          header > div { padding: 0 16px !important; }

          h1 { font-size: 36px !important; }
          section { padding: 64px 0 !important; }
          section > div { padding: 0 16px !important; }

          .hero-preview { transform: scale(0.78); transform-origin: top center; margin: -24px -38px -120px !important; }
          .hero-cta-row { flex-direction: column !important; align-items: stretch !important; }

          .grid-3col { grid-template-columns: 1fr !important; }
          .grid-2col { grid-template-columns: 1fr !important; }

          .pricing-grid { grid-template-columns: 1fr !important; }
          .pricing-grid > div { transform: none !important; }

          .comparison-row { grid-template-columns: 1fr repeat(3, 80px) !important; font-size: 11px !important; }

          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 28px !important; }

          .b2b-btns { flex-direction: column !important; align-items: center !important; }
          .final-cta-inner { padding: 48px 20px !important; }
          .final-cta-inner h2 { font-size: 28px !important; }

          .how-steps { padding: 0 !important; }
          .how-steps > div:not(:first-child) { border-top: 1px solid rgba(0,0,0,0.07); padding-top: 32px !important; }
        }

        @media (max-width: 480px) {
          h1 { font-size: 28px !important; }
          h2 { font-size: 24px !important; }
          .comparison-row { font-size: 10px !important; grid-template-columns: 1fr repeat(3, 64px) !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}
