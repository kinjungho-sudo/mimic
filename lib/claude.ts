import Anthropic from '@anthropic-ai/sdk';
import type { Step } from '@/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Haiku는 ```json ... ``` 블록으로 감싸서 응답하는 경향이 있어 파싱 전에 제거
function stripMarkdown(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

type ActionInfo = {
  type?: string;
  label?: string;
  tag?: string;
  role?: string;
  href?: string;
  text?: string;
} | undefined;

// input type 또는 필드 라벨이 민감정보에 해당하는지 판별
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SENSITIVE_INPUT_TYPES = new Set(['password', 'tel', 'credit-card', 'card', 'cc']);
const SENSITIVE_LABEL_PATTERNS = [
  /비밀번호|패스워드|암호|password/i,
  /카드\s*번호|card\s*number|카드번호/i,
  /주민\s*등록|주민번호|resident|rrn|ssn|social.security/i,
  /계좌\s*번호|account\s*number/i,
  /개인\s*식별|identification|id\s*number|고유\s*번호/i,
  /cvv|cvc|cvc2|보안코드|security\s*code/i,
  /pin\b|핀\s*번호/i,
  /otp|인증\s*번호|인증코드|verification\s*code/i,
  /토큰|token|secret|api.?key/i,
];

function isSensitiveLabel(label: string | undefined): boolean {
  if (!label) return false;
  return SENSITIVE_LABEL_PATTERNS.some(re => re.test(label));
}

// href URL에서 민감 쿼리 파라미터(token, key, secret, code 등)를 제거하고 origin+path만 반환
function sanitizeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href);
    const SENSITIVE_PARAMS = ['token', 'key', 'secret', 'code', 'password', 'access_token',
      'refresh_token', 'auth', 'api_key', 'apikey', 'session', 'sig', 'signature'];
    SENSITIVE_PARAMS.forEach(p => url.searchParams.delete(p));
    return url.origin + url.pathname;
  } catch {
    // 상대경로 등 파싱 불가 URL은 쿼리 제거 후 반환
    return href.split('?')[0];
  }
}

type ElementContext = {
  clickX?: number;        // 0~1 정규화 클릭 좌표
  clickY?: number;
  elementRect?: {         // 클릭된 DOM 요소의 bounding box (CSS px 절대값)
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  viewportW?: number;     // 캡처 당시 window.innerWidth (CSS px)
  viewportH?: number;
  elementSelector?: string | null;
};

export async function analyzeScreenshot(
  base64Image: string,
  pageUrl: string,
  actionInfo?: ActionInfo,
  elementContext?: ElementContext
): Promise<{ title: string; description: string }> {
  let domain = '';
  try { domain = new URL(pageUrl).hostname; } catch { domain = pageUrl; }

  // 행동 힌트 문자열 생성
  // 규칙: text(실제 입력값)는 절대 포함 안 함, 민감 label도 포함 안 함, href는 쿼리 파라미터 제거
  let actionHint = '';
  if (actionInfo) {
    const { type, label, href } = actionInfo;
    const safeLabel = isSensitiveLabel(label) ? undefined : label;
    const safeHref = sanitizeHref(href);

    if (type === 'type' && safeLabel)
      actionHint = `\n사용자가 "${safeLabel}" 필드에 텍스트를 입력했습니다.`;
    else if (type === 'type')
      actionHint = `\n사용자가 입력 필드에 텍스트를 입력했습니다.`;
    else if (type === 'navigate' && safeLabel)
      actionHint = `\n사용자가 "${safeLabel}" 링크를 클릭했습니다${safeHref ? ` (목적지: ${safeHref})` : ''}.`;
    else if (type === 'toggle' && safeLabel)
      actionHint = `\n사용자가 "${safeLabel}" 체크박스/라디오를 선택했습니다.`;
    else if (type === 'select' && safeLabel)
      actionHint = `\n사용자가 드롭다운에서 "${safeLabel}"을 선택했습니다.`;
    else if (type === 'focus_input' && safeLabel)
      actionHint = `\n사용자가 "${safeLabel}" 입력 필드를 클릭했습니다.`;
    else if (safeLabel)
      actionHint = `\n사용자가 "${safeLabel}" 버튼/요소를 클릭했습니다.`;
  }

  // 클릭 위치 및 요소 위치 힌트 — 웹앱 편집기가 하이라이트/확대/화살표 위치를 결정할 때 사용
  let locationHint = '';
  if (elementContext) {
    const { clickX, clickY, elementRect, viewportW, viewportH, elementSelector } = elementContext;

    if (clickX != null && clickY != null) {
      locationHint += `\n클릭 위치: 화면의 가로 ${Math.round(clickX * 100)}%, 세로 ${Math.round(clickY * 100)}% 지점`;
    }

    if (elementRect && viewportW && viewportH) {
      // elementRect는 CSS px 절대값 → 비율로 변환해서 프롬프트에 포함
      const rx = (elementRect.x / viewportW * 100).toFixed(1);
      const ry = (elementRect.y / viewportH * 100).toFixed(1);
      const rw = (elementRect.width / viewportW * 100).toFixed(1);
      const rh = (elementRect.height / viewportH * 100).toFixed(1);
      locationHint += `\n클릭된 요소 영역: 좌상단 (${rx}%, ${ry}%), 크기 ${rw}% × ${rh}%`;
    }

    if (elementSelector) {
      locationHint += `\n요소 selector: ${elementSelector}`;
    }
  }

  const titleGuide = (() => {
    const type = actionInfo?.type;
    if (type === 'type') return '"[입력 내용] 입력" 형식 (예: "이메일 주소 입력")';
    if (type === 'navigate') return '"[목적지] 이동" 형식 (예: "설정 페이지 이동")';
    if (type === 'toggle') return '"[항목] 선택/해제" 형식';
    if (type === 'select') return '"[항목] 선택" 형식';
    return '"[대상] 클릭" 형식 (예: "로그인 버튼 클릭")';
  })();

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `이 스크린샷은 사용자가 "${domain}" 페이지에서 수행한 액션입니다.${actionHint}${locationHint}

스크린샷과 위 행동 정보를 바탕으로 아래 JSON만 반환하세요. 다른 텍스트 없이.
title은 ${titleGuide}으로 20자 이내로 작성하세요.

응답 형식 (JSON만, 마크다운 없이):
{
  "title": "행동 동사가 포함된 짧은 제목 (20자 이내)",
  "description": "AI가 이 액션을 재현할 수 있도록 구체적 설명 (60자 이내)"
}`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const parsed = JSON.parse(stripMarkdown(text));
    return {
      title: String(parsed.title || '').slice(0, 20),
      description: String(parsed.description || '').slice(0, 60),
    };
  } catch {
    return { title: '스텝', description: '다음 단계를 진행하세요.' };
  }
}

export async function generateScript(
  steps: Step[],
  userDraft?: string
): Promise<{ script: string; markerPositions: number[] }> {
  const stepsText = steps
    .map(
      s =>
        `Step ${s.step_number}: ${s.user_title || s.ai_title || '제목 없음'}\n` +
        `설명: ${s.ai_description || ''}\n` +
        `URL: ${s.page_url || ''}`
    )
    .join('\n\n');

  const draftSection = userDraft ? `\n사용자 초안:\n${userDraft}` : '';

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `다음 매뉴얼 단계들을 보고 TTS용 한국어 스크립트를 작성해줘.

${stepsText}${draftSection}

규칙:
- 자연스럽고 친근한 한국어 (존댓말)
- 각 클릭 위치는 ①②③ 마커로 표시
- 전체 1분 이내
- JSON만 응답 (마크다운 없이):
{
  "script": "전체 스크립트 텍스트",
  "markerPositions": [마커①이 나오는 ms 위치, 마커②..., ...]
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const parsed = JSON.parse(stripMarkdown(text));
    return {
      script: String(parsed.script || ''),
      markerPositions: Array.isArray(parsed.markerPositions) ? parsed.markerPositions : [],
    };
  } catch {
    return { script: '', markerPositions: [] };
  }
}

export async function generateMarkers(steps: Step[]) {
  const stepsData = steps.map(s => ({
    id: s.id,
    title: s.user_title || s.ai_title,
    description: s.ai_description,
    page_url: s.page_url,
    screenshot_url: s.screenshot_url,
  }));

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `다음 매뉴얼 데이터를 보고 ①②③ 마커를 자동으로 배치해줘.

스텝 목록:
${JSON.stringify(stepsData, null, 2)}

규칙:
- 모든 클릭 위치 = 마커 후보
- 너무 가까운 클릭은 하나로 묶기
- 사용자 시선 흐름 자연스럽게 (좌→우, 위→아래)
- 마커 번호는 시간 순서대로
- position_x, position_y 는 0~1 정규화

응답 형식 (JSON만):
{
  "markers": [
    {
      "step_id": "uuid",
      "marker_number": 1,
      "position_x": 0.18,
      "position_y": 0.38,
      "connected_effects": ["click_sound"]
    }
  ]
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const parsed = JSON.parse(stripMarkdown(text));
    return Array.isArray(parsed.markers) ? parsed.markers : [];
  } catch {
    return [];
  }
}

export async function generateDraft(
  steps: Array<{ id: string; ai_title: string | null; ai_description: string | null; page_url: string | null; step_number: number; domain_name?: string | null }>
): Promise<{ steps: Array<{ id: string; user_title: string; user_script: string }>; tutorial_title: string }> {
  // 가장 많이 등장하는 domain_name을 서비스 이름으로 사용
  const domainCounts = new Map<string, number>();
  steps.forEach(s => {
    if (s.domain_name) domainCounts.set(s.domain_name, (domainCounts.get(s.domain_name) ?? 0) + 1);
  });
  const mainService = domainCounts.size > 0
    ? Array.from(domainCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  const stepsText = steps
    .map(s =>
      `[Step ${s.step_number}] id=${s.id}\n` +
      `제목: ${s.ai_title || '없음'}\n` +
      `설명: ${s.ai_description || '없음'}\n` +
      `URL: ${s.page_url || '없음'}`
    )
    .join('\n\n');

  const serviceHint = mainService ? `\n주요 서비스: ${mainService}` : '';

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `다음은 사용자가 녹화한 매뉴얼 단계들입니다. 각 단계에 대해 더 풍부하고 자연스러운 한국어 매뉴얼 초안을 작성해줘.${serviceHint}

${stepsText}

[제목 규칙 — tutorial_title]
- 30자 이내, "서비스명 + 핵심 동작" 형식
- 반드시 범용적인 행동 목적으로 작성 — 특정 상품명·수량·고유명사 절대 포함 금지
- 사용자가 이 매뉴얼로 배우는 "방법"을 표현할 것
- 좋은 예: "쿠팡에서 상품 구매하기", "Slack 채널 만들기", "구글 드라이브 파일 공유하기"
- 나쁜 예: "쿠팡에서 신라면 120g 5개 구매하기", "홍길동에게 5만원 송금하기"

[스텝 제목 규칙 — user_title]
- 20자 이내, 해당 화면에서 수행하는 핵심 행동 하나만
- 특정 상품명·브랜드명·수량 포함 금지
- 좋은 예: "검색창에 키워드 입력", "바로구매 버튼 클릭", "결제 정보 확인"
- 나쁜 예: "신라면 검색 및 상품 선택", "신라면 120g 5개 주문 완료"

[스텝 설명 규칙 — user_script]
- 1~2문장, 존댓말
- 행동 하나만 설명 — "~합니다. 이를 통해 ~가 됩니다" 같은 결과 설명 문장 금지
- 특정 상품명·수량 포함 금지, 범용 표현 사용
- 좋은 예: "검색창에 원하는 상품명을 입력합니다."
- 나쁜 예: "신라면 120g을 검색합니다. 이를 통해 상품 목록이 표시됩니다."
- 모든 step id를 포함해야 함

응답 형식 (JSON만, 마크다운 없이):
{
  "tutorial_title": "...",
  "steps": [
    { "id": "uuid", "user_title": "...", "user_script": "..." }
  ]
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const parsed = JSON.parse(stripMarkdown(text));
    return {
      tutorial_title: String(parsed.tutorial_title || ''),
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
    };
  } catch {
    return { tutorial_title: '', steps: [] };
  }
}

// 스크린샷에서 dominant color 2개를 추출해 커버 그라데이션 색상 반환
export async function extractCoverColors(
  screenshotBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'
): Promise<{ color1: string; color2: string }> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: screenshotBase64 },
          },
          {
            type: 'text',
            text: `이 스크린샷의 전체적인 색감과 분위기를 참고해서, 매뉴얼 커버로 어울리는 그라데이션 색상 2개를 골라줘. 너무 밝거나 너무 어둡지 않게, 브랜드 컬러처럼 세련되게.
JSON만 응답 (마크다운 없이):
{"color1":"#hex","color2":"#hex"}`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const parsed = JSON.parse(stripMarkdown(text));
    const hexRe = /^#[0-9a-fA-F]{6}$/;
    if (hexRe.test(parsed.color1) && hexRe.test(parsed.color2)) {
      return { color1: parsed.color1, color2: parsed.color2 };
    }
  } catch { /* fallback */ }
  return { color1: '#3730a3', color2: '#6d28d9' };
}

export async function rewriteSentence(
  original: string,
  instruction: string
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `다음 문장을 "${instruction}" 방식으로 다시 작성해줘. 수정된 문장만 반환하고, 설명이나 따옴표는 붙이지 마.

원문:
${original}`,
    }],
  });
  return response.content[0].type === 'text' ? response.content[0].text.trim() : original;
}

type StepLocationData = {
  clickX?: number | null;       // 0~1 정규화 클릭 좌표
  clickY?: number | null;
  elementRect?: {               // 클릭 요소 bounding box (0~1 정규화)
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  actionType?: string | null;   // click / navigate / toggle / focus_input / type
  actionLabel?: string | null;  // 요소 레이블
};

export async function generateAnnotations(
  userPrompt: string,
  stepContext: string,
  locationData?: StepLocationData
) {
  // 좌표 데이터를 프롬프트용 문자열로 변환
  let locationSection = '';
  if (locationData) {
    const { clickX, clickY, elementRect, actionType, actionLabel } = locationData;
    const parts: string[] = [];

    if (clickX != null && clickY != null)
      parts.push(`- 클릭 좌표: (${(clickX * 100).toFixed(1)}%, ${(clickY * 100).toFixed(1)}%) — 이미지 전체 크기 대비 비율`);

    if (elementRect)
      parts.push(`- 클릭된 요소 영역: 좌상단 (${(elementRect.x * 100).toFixed(1)}%, ${(elementRect.y * 100).toFixed(1)}%), 크기 ${(elementRect.width * 100).toFixed(1)}% × ${(elementRect.height * 100).toFixed(1)}%`);

    if (actionType)
      parts.push(`- 액션 유형: ${actionType}`);

    if (actionLabel)
      parts.push(`- 요소 이름: ${actionLabel}`);

    if (parts.length > 0)
      locationSection = `\n\n[클릭 위치 데이터]\n${parts.join('\n')}`;
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `당신은 매뉴얼 편집기의 AI 주석 생성기입니다.
사용자가 녹화한 스텝 이미지 위에 시각적 주석을 자동으로 배치해야 합니다.

[스텝 정보]
${stepContext}${locationSection}

[사용자 요청]
${userPrompt}

[좌표 규칙]
- 모든 geometry 값은 0~1 정규화 (이미지 전체 크기 대비 비율)
- x, y: 좌상단 기준
- width, height: 요소 크기 비율
- 클릭 위치 데이터가 있으면 반드시 해당 영역을 기준으로 주석 배치

[주석 배치 원칙]
- rectangle: 클릭된 요소 영역(elementRect)에 맞춰 하이라이트 박스 — 요소를 강조할 때
- arrow: 클릭 좌표(clickX, clickY)를 향해 포인팅 — 어딜 눌러야 하는지 안내할 때
- circle: 클릭 좌표 중심으로 작은 원 — 정확한 클릭 지점 표시 (width=height=0.06 정도의 작은 원)
- text: 요소 바로 위나 옆에 설명 레이블 배치
- 사용자가 여러 주석을 동시에 요청하면 annotations 배열에 모두 포함할 것

[복합 요청 예시]
사용자가 "하이라이트 박스 + 화살표 + 원 + 텍스트 캡션"을 모두 요청하면:
1. rectangle — elementRect 기반 노란 하이라이트 박스
2. arrow — 화면 우측 상단에서 clickX/Y 좌표로 향하는 빨간 화살표 (x1=clickX+0.15, y1=clickY-0.1 → x2=clickX, y2=clickY)
3. circle — clickX/Y 중심 작은 빨간 원 (width=height=0.05)
4. text — 클릭 지점 위에 "클릭" 또는 "여기를 클릭하세요" 레이블 (y는 clickY-0.07 정도 위)
모두 annotations 배열에 순서대로 반환

[스타일 가이드]
- 하이라이트 rectangle: color "#FBBF24" (노랑), opacity 0.35
- 포인팅 arrow: color "#EF4444" (빨강), opacity 1, strokeWidth 0.4
- 클릭 circle: color "#EF4444", opacity 0.8, strokeWidth 0.3
- 설명 text: color "#1e1e2e", opacity 1

응답 형식 (JSON만, 마크다운 없이):
{
  "annotations": [
    {
      "type": "rectangle" | "arrow" | "circle" | "text" | "underline",
      "style": { "color": "#FBBF24", "opacity": 0.35 },
      "geometry": { "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.05 },
      "label": "선택 사항: text 타입일 때 표시할 문자열"
    }
  ]
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const parsed = JSON.parse(stripMarkdown(text));
    return Array.isArray(parsed.annotations) ? parsed.annotations : [];
  } catch {
    return [];
  }
}
