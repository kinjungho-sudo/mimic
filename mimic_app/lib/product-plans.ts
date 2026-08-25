export const PRODUCT_PLANS = {
  free: {
    name: 'Free',
    monthlyPrice: '₩0',
    yearlyMonthlyPrice: '₩0',
    priceSuffix: '',
    features: ['매일 매뉴얼 3개', '클릭 동작 자동 캡처', '텍스트·도형 편집', '링크 공유 + PDF', '500MB 저장 공간'],
  },
  basic: {
    name: 'Basic',
    monthlyPrice: '₩9,900',
    yearlyMonthlyPrice: '₩8,250',
    priceSuffix: '/ 월',
    features: ['매뉴얼 생성 한도 확대', 'AI 다듬기 월 100회', 'PPTX·Word 내보내기', '비공개 + 비밀번호 보호', '2GB 저장 공간'],
  },
  pro: {
    name: 'Pro',
    monthlyPrice: '₩19,900',
    yearlyMonthlyPrice: '₩16,580',
    priceSuffix: '/ 월',
    features: ['Basic 플랜 모든 기능', 'Parro Desktop Companion', 'AI 다듬기 무제한', 'AI 상세 설명 생성', '학습 가이드 + Live Guide Beta', 'AI 음성 편집', '5GB 저장 공간'],
  },
  team: {
    name: 'Team',
    monthlyPrice: '협의',
    yearlyMonthlyPrice: '협의',
    priceSuffix: '',
    features: ['Pro 플랜 모든 기능', '팀 워크스페이스', '멤버 권한 관리', '확장 저장 공간', '전용 온보딩 지원', '세금계산서 발행', '우선 지원 (SLA)'],
  },
} as const;

export const FREE_DAILY_MANUAL_LIMIT = 3;
