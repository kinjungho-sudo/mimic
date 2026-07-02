import { NextRequest, NextResponse } from 'next/server';
import { QUICK_QUESTIONS } from '@/lib/faq-data';

// ── 정적 FAQ 데이터 ────────────────────────────────────────
// Haiku API 없이 키워드 매칭으로 응답 — API 비용 0

const HELP_URL = '/help';

interface FAQ {
  keywords: string[];
  answer: string;
  related?: string[]; // 연관 질문 ID
}

const FAQ_DB: Record<string, FAQ> = {
  'what': {
    keywords: ['mimic', 'mimic이', '뭐야', '뭔가요', '무엇', '소개', '서비스'],
    answer: `MIMIC은 Chrome 확장 프로그램으로 업무 화면을 녹화해 인터랙티브 매뉴얼을 자동 생성하는 서비스입니다.\n\n클릭 한 번 한 번이 자동으로 캡처되어 단계별 스크린샷과 설명이 만들어지고, 링크로 공유하거나 연습 가이드로 따라할 수 있습니다. 원본 URL과 확장 프로그램 조건이 맞으면 라이브 가이드 Beta로 실제 페이지 위 안내도 사용할 수 있습니다.\n\n👉 자세한 소개는 [도움말](${HELP_URL}#intro)에서 확인하세요.`,
    related: ['install', 'price', 'guide-me'],
  },
  'install': {
    keywords: ['설치', '확장', '크롬', 'chrome', '프로그램', '다운', '어디서'],
    answer: `MIMIC Recorder는 Chrome 확장 프로그램입니다.\n\n**설치 방법**\n1. Chrome 웹 스토어에서 "MIMIC Recorder" 검색\n2. 확장 프로그램 설치\n3. MIMIC 웹앱에서 계정 생성 후 확장과 연결\n\nChromium 기반 브라우저(Edge, Brave)도 지원합니다. Firefox, Safari는 현재 미지원입니다.\n\n👉 [설치 가이드 보기](${HELP_URL})`,
    related: ['record', 'what'],
  },
  'record': {
    keywords: ['녹화', '캡처', '촬영', '어떻게', '만들기', '생성', '시작'],
    answer: `**화면 녹화 방법**\n1. Chrome 툴바에서 MIMIC Recorder 아이콘 클릭\n2. 녹화 시작 버튼 클릭\n3. 평소처럼 업무 진행 (클릭마다 자동 캡처)\n4. 완료 버튼으로 녹화 종료\n\n녹화 후 AI가 자동으로 각 단계의 제목과 설명을 생성합니다.\n\n직접 만들기: 대시보드 → "새 매뉴얼" → "직접 편집하기"\n\n👉 [자세한 안내](${HELP_URL})`,
    related: ['edit', 'limit'],
  },
  'edit': {
    keywords: ['편집', '수정', '에디터', '변경', '바꾸기', '제목', '설명'],
    answer: `**매뉴얼 편집 방법**\n- 대시보드에서 매뉴얼 클릭 → 우측 상단 "편집" 버튼\n- 수정 가능한 항목: 제목, 단계 설명, 어노테이션(화살표·텍스트·강조), 단계 순서\n- 단계 추가/삭제: 목차 패널에서 조작\n\n**단축키**\n- Ctrl+Z: 실행 취소\n- Ctrl+Shift+Z: 다시 실행\n\n변경사항은 자동 저장됩니다.\n\n👉 [에디터 사용법](${HELP_URL})`,
    related: ['record', 'share'],
  },
  'share': {
    keywords: ['공유', '링크', '전달', '보내기', '배포', '게시', '공개'],
    answer: `**공유 방법**\n1. 매뉴얼 상단 "공유" 버튼 클릭\n2. "게시하고 공유"로 공개 전환\n3. 링크 복사 / 카카오톡 / 이메일 중 선택\n\n**비밀번호 보호**: 설정(⚙) → 공유 비밀번호 입력\n\n공유 링크로 접속하면 슬라이드 모드와 문서 모드로 볼 수 있습니다.\n\n👉 [공유 기능 상세](${HELP_URL})`,
    related: ['guide-me', 'export'],
  },
  'guide-me': {
    keywords: ['guide me', '가이드', '오버레이', '안내', '실제 페이지', '위에서'],
    answer: `**라이브 가이드 Beta**는 실제 웹페이지 위에 오버레이를 띄워 단계별로 안내하는 기능입니다.\n\n**사용 조건**\n- 원본 URL이 저장된 매뉴얼\n- MIMIC Recorder 확장 프로그램 연결\n- 페이지 구조가 녹화 당시와 크게 달라지지 않은 상태\n\n받는 사람이 별도 설치 없이 따라해야 한다면 먼저 **연습 가이드** 링크를 공유하는 편이 안정적입니다.\n\n**키보드**: → 다음 / ← 이전 / Esc 닫기\n\n👉 [라이브 가이드 Beta 상세 안내](${HELP_URL}#guide-me)`,
    related: ['share', 'freshness'],
  },
  'export': {
    keywords: ['내보내기', 'pdf', 'pptx', 'ppt', '파워포인트', 'word', 'docx', '다운로드', '저장'],
    answer: `**지원 내보내기 형식**\n\n- PDF: 문서 공유와 출력에 적합\n- PPTX: 발표 자료나 교육 자료로 편집 가능\n- Word(.docx): 문서 편집과 사내 공유에 적합\n\n스크린샷이 많은 매뉴얼은 PDF 생성에 시간이 걸릴 수 있습니다. 페이지를 닫지 말고 기다려주세요.\n\n👉 [내보내기 안내](${HELP_URL}#export)`,
    related: ['share'],
  },
  'price': {
    keywords: ['요금', '가격', '플랜', '유료', '무료', 'pro', 'team', '비용', '얼마'],
    answer: `**요금제 안내**\n\n**무료**: 일 3회 매뉴얼 생성, 기본 공유, PDF 내보내기, 제한된 라이브 가이드 Beta 사용\n\n**Pro**: 무제한 생성, PDF/PPTX/Word 내보내기, 비밀번호 보호, 연습·라이브 가이드 Beta 제작\n\n**Team**: Pro 포함 + 팀 워크스페이스, 멤버 관리, 팀 단위 지원\n\nPro/Team 가격 문의: support@mimic.so\n\n👉 [요금제 상세](${HELP_URL}#plans)`,
    related: ['limit', 'workspace'],
  },
  'limit': {
    keywords: ['한도', '제한', '3회', '일일', '초과', '더 만들', '안돼', '못'],
    answer: `무료 플랜은 **하루 3회**까지 매뉴얼을 생성할 수 있습니다.\n\n한도 초과 시:\n- 내일 자정에 횟수가 초기화됩니다\n- Pro 플랜 업그레이드 시 매뉴얼 생성 한도를 해제할 수 있습니다\n\n업그레이드 문의: support@mimic.so\n\n👉 [요금제 보기](${HELP_URL}#plans)`,
    related: ['price'],
  },
  'workspace': {
    keywords: ['워크스페이스', '팀', '협업', '팀원', '공동', '같이', '함께', '초대'],
    answer: `**팀 워크스페이스**로 팀원들과 매뉴얼을 공동 관리할 수 있습니다.\n\n**만들기**: 사이드바 "팀 워크스페이스" → "+" 클릭\n**초대**: 워크스페이스 설정 → 이메일로 초대 링크 전송\n**관리**: 매뉴얼을 개인 워크스페이스와 팀 워크스페이스 사이에서 이동\n\n※ Team 플랜 필요\n\n👉 [워크스페이스 안내](${HELP_URL}#workspace)`,
    related: ['price', 'edit'],
  },
  'embed': {
    keywords: ['sdk', '삽입', '스크립트', '임베드', '자체', '서비스에', '설치'],
    answer: `자체 서비스 안에 라이브 가이드 Beta를 직접 삽입하는 공개 SDK는 아직 일반 제공 기능이 아닙니다.\n\n현재 권장 방식은 다음 두 가지입니다.\n- 매뉴얼 공유 링크로 안내하기\n- 연습 가이드 링크로 별도 설치 없이 따라하게 하기\n\n서비스 내 임베드나 전용 연동이 필요하면 문의로 사용 사례를 알려주세요.\n\n👉 [공유 기능 안내](${HELP_URL}#share-link)`,
    related: ['share', 'contact'],
  },
  'freshness': {
    keywords: ['최신성', '변경', '감지', '업데이트', '오래된', '달라졌', '페이지 변경'],
    answer: `녹화 당시와 현재 페이지 UI가 달라지면 라이브 가이드 Beta가 버튼을 정확히 찾지 못할 수 있습니다.\n\n이 경우 해당 단계를 다시 녹화하거나, 에디터에서 핫스팟 위치와 설명을 수정해주세요. 연습 가이드는 캡처 화면을 기준으로 동작하므로 외부 페이지 변경의 영향을 덜 받습니다.\n\n👉 [도움말 보기](${HELP_URL}#guide-me)`,
    related: ['guide-me', 'edit'],
  },
  'password': {
    keywords: ['비밀번호', '암호', '잠금', '보호', '패스워드'],
    answer: `공유 링크에 비밀번호를 설정해 접근을 제한할 수 있습니다.\n\n**설정 방법**: 매뉴얼 → 설정(⚙) → 공유 비밀번호 입력 → 저장\n\n비밀번호를 비워두면 보호가 해제됩니다.\n\n접속자는 링크 열 때 비밀번호를 입력해야 합니다.\n\n👉 [공유 기능 안내](${HELP_URL})`,
    related: ['share'],
  },
  'contact': {
    keywords: ['문의', '연락', '이메일', '지원', '고객', '피드백', '버그', '오류'],
    answer: `추가 문의사항이 있으시면 아래로 연락해주세요:\n\n📧 **support@mimic.so**\n\n도움말에서 해결되지 않는 문제, 버그 신고, 요금제 문의 모두 환영합니다.\n\n👉 [도움말에서 먼저 찾아보기](${HELP_URL})`,
    related: ['price', 'what'],
  },
};


function findAnswer(query: string): { answer: string; related: string[] } {
  const q = query.toLowerCase();

  // 직접 ID 매칭 (클라이언트가 id를 보낸 경우)
  if (FAQ_DB[q]) {
    return {
      answer: FAQ_DB[q].answer,
      related: FAQ_DB[q].related ?? [],
    };
  }

  // 키워드 매칭 — 가장 많이 매칭된 항목 반환
  let best: { id: string; score: number } | null = null;
  for (const [id, faq] of Object.entries(FAQ_DB)) {
    const score = faq.keywords.filter(k => q.includes(k)).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { id, score };
    }
  }

  if (best) {
    const faq = FAQ_DB[best.id];
    return { answer: faq.answer, related: faq.related ?? [] };
  }

  // 매칭 실패
  return {
    answer: `죄송합니다, 정확한 답변을 찾지 못했어요.\n\n👉 [도움말](${HELP_URL})에서 직접 검색하거나, **support@mimic.so**로 문의해주세요.`,
    related: ['contact'],
  };
}

// ── Route Handler ──────────────────────────────────────────

export async function GET() {
  // 클라이언트가 초기 로드 시 FAQ 목록 요청
  return NextResponse.json({ quickQuestions: QUICK_QUESTIONS });
}

export async function POST(request: NextRequest) {
  let body: { query?: string; faqId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const query = (body.faqId ?? body.query ?? '').trim();
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });

  const { answer, related } = findAnswer(query);
  const relatedQuestions = related
    .map(id => QUICK_QUESTIONS.find(q => q.id === id))
    .filter(Boolean);

  return NextResponse.json({ answer, related: relatedQuestions });
}
