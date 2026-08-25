import { BRAND_NAME } from '@/lib/brand';

// FAQ 정적 데이터 — route.ts에서 export 시 Next.js 빌드 오류 발생하므로 분리

export const QUICK_QUESTIONS = [
  { id: 'what',      label: `${BRAND_NAME}가 뭔가요?` },
  { id: 'install',   label: '확장 프로그램 설치' },
  { id: 'desktop',   label: 'Desktop Companion 설치' },
  { id: 'record',    label: '매뉴얼 만드는 법' },
  { id: 'guide-me',  label: '연습/라이브 가이드 Beta 차이' },
  { id: 'price',     label: '요금제 안내' },
  { id: 'limit',     label: '생성 한도 초과' },
  { id: 'share',     label: '공유 방법' },
  { id: 'export',    label: 'PDF/PPTX/Word 내보내기' },
  { id: 'workspace', label: '팀 워크스페이스' },
  { id: 'contact',   label: '문의하기' },
];
