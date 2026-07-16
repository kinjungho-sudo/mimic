import Anthropic from '@anthropic-ai/sdk';
import type { Step } from '@/types';
import { CLAUDE_MODEL } from '@/lib/ai/model';
import { BRAND_COLORS } from '@/lib/brand';
import { isCaptureTutorialTitleGrounded } from '@/lib/ai/capture-fallback';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export function hasAnthropicApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

function hasClaudeApiKey(operation: string): boolean {
  if (hasAnthropicApiKey()) return true;
  console.error(`${operation} skipped: ANTHROPIC_API_KEY is not configured`);
  return false;
}

export type GenerateDraftStatus =
  | 'ok'
  | 'missing_key'
  | 'api_error'
  | 'parse_error'
  | 'empty_steps';

export type GenerateDraftResult = {
  steps: Array<{ id: string; user_title: string; user_script: string }>;
  tutorial_title: string;
  status: GenerateDraftStatus;
  reason?: string;
  responsePreview?: string;
};

// Haiku는 ```json ... ``` 블록으로 감싸서 응답하는 경향이 있어 파싱 전에 제거
function stripMarkdown(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function parseJsonObject(text: string): unknown {
  const clean = stripMarkdown(text);
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(clean.slice(start, end + 1));
    }
    throw new Error('No JSON object found in Claude response');
  }
}

type ActionInfo = {
  type?: string;
  label?: string;
  tag?: string;
  role?: string;
  href?: string;
  text?: string;
  targetContext?: {
    captureSurface?: 'web' | 'desktop';
    captureApp?: string | null;
    accessibleName?: string | null;
    contextLabel?: string | null;
    pageTitle?: string | null;
  };
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
  elementContext?: ElementContext,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'
): Promise<{ title: string; description: string }> {
  if (!hasClaudeApiKey('analyzeScreenshot')) return { title: '', description: '' };

  let domain = '';
  try { domain = new URL(pageUrl).hostname; } catch { domain = pageUrl; }
  const isDesktopCapture = actionInfo?.targetContext?.captureSurface === 'desktop';
  const desktopWindow = actionInfo?.targetContext?.pageTitle
    || actionInfo?.targetContext?.contextLabel
    || actionInfo?.targetContext?.captureApp
    || '';

  let actionHint = '';
  if (actionInfo) {
    const { type, label, href } = actionInfo;
    const safeLabel = isSensitiveLabel(label) ? undefined : label;
    const safeHref = sanitizeHref(href);

    if (isDesktopCapture)
      actionHint = `\n데스크톱 앱 창은 "${desktopWindow || safeLabel || 'Windows 앱'}"입니다. "${safeLabel || ''}"은 클릭 대상의 접근성 이름일 수 있으며, 창 이름은 클릭 대상 이름으로 간주하지 마세요.`;
    else if (type === 'type' && safeLabel)
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

  let locationHint = '';
  if (elementContext) {
    const { clickX, clickY, elementRect, viewportW, viewportH, elementSelector } = elementContext;
    if (clickX != null && clickY != null)
      locationHint += `\n클릭 위치: 화면의 가로 ${Math.round(clickX * 100)}%, 세로 ${Math.round(clickY * 100)}% 지점`;
    if (elementRect && viewportW && viewportH) {
      const rx = (elementRect.x / viewportW * 100).toFixed(1);
      const ry = (elementRect.y / viewportH * 100).toFixed(1);
      const rw = (elementRect.width / viewportW * 100).toFixed(1);
      const rh = (elementRect.height / viewportH * 100).toFixed(1);
      locationHint += `\n클릭된 요소 영역: 좌상단 (${rx}%, ${ry}%), 크기 ${rw}% × ${rh}%`;
    }
    if (elementSelector)
      locationHint += `\n요소 selector: ${elementSelector}`;
  }

  const titleGuide = (() => {
    const type = actionInfo?.type;
    if (isDesktopCapture) return '마우스 포인터 끝 또는 클릭 좌표 아래 실제 컨트롤의 기능을 나타내는 "[대상 기능] 선택/실행/입력" 형식';
    if (type === 'type') return '"[업무 내용] 입력" 형식 (예: "검색 조건 입력", "수신자 입력")';
    if (type === 'navigate') return '"[업무 화면] 이동/확인" 형식 — URL path 절대 사용 금지';
    if (type === 'toggle') return '"[설정 목적] 선택/해제" 형식';
    if (type === 'select') return '"[업무 항목] 선택" 형식';
    return '원시 UI 라벨 대신 사용자의 업무 목적을 나타내는 "[목적] 확인/실행" 형식';
  })();

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 128,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
          {
            type: 'text',
            text: `이 스크린샷은 사용자가 ${isDesktopCapture ? `"${desktopWindow || 'Windows 앱'}" 데스크톱 앱에서` : `"${domain}" 페이지에서`} 수행한 액션입니다.${actionHint}${locationHint}

제목만 생성하세요. JSON만 반환, 다른 텍스트 없이.

[title 규칙]
- ${titleGuide}으로 20자 이내
- ${isDesktopCapture ? '마우스 포인터의 뾰족한 끝과 클릭 좌표가 가리키는 컨트롤을 최우선으로 판독할 것' : '화면에 보인 접근성 문자열이나 단축키 설명을 그대로 복사하지 말 것'}
- ${isDesktopCapture ? '기호 버튼은 의미로 바꿀 것 (예: + → "더하기 선택", = → "계산 실행", 디스크 아이콘 → "저장 실행")' : '"Code 클릭", "Open menuHomepage 클릭"처럼 대상 텍스트만 옮긴 제목 금지'}
- ${isDesktopCapture ? `"${desktopWindow || '앱'} 클릭", "화면 확인", "버튼 클릭"처럼 앱/창 이름이나 일반명만 쓴 제목 금지` : '대상과 업무 목적이 구체적으로 드러나야 함'}
- 특정 상품명·브랜드명·수량·고유명사 절대 포함 금지

{"title": "..."}`,
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
      description: '',
    };
  } catch {
    return { title: '스텝', description: '' };
  }
}

// 스텝 설명 1개 생성 — 에디터에서 ✨ 버튼 클릭 시 호출
export async function generateStepDescription(
  title: string,
  pageUrl: string | null,
  screenshotBase64?: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'
): Promise<string> {
  if (!hasClaudeApiKey('generateStepDescription')) return '';

  let domain = '';
  try { domain = pageUrl ? new URL(pageUrl).hostname : ''; } catch { domain = pageUrl ?? ''; }

  const content: Anthropic.MessageParam['content'] = [];

  if (screenshotBase64) {
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: screenshotBase64 } });
  }

  content.push({
    type: 'text',
    text: `매뉴얼 스텝의 설명을 작성해줘.
스텝 제목: "${title}"${domain ? `\n페이지: ${domain}` : ''}

[규칙]
- 1~2문장, 존댓말
- 왜 필요한 단계인지와 무엇을 하면 되는지를 한 문장 중심으로 설명
- 결과 상태가 명확하면 짧게 덧붙이되 다음 단계까지 설명하지 말 것
- 특정 상품명·수량·고유명사 포함 금지, 범용 표현 사용
- 좋은 예: "원하는 항목을 찾을 수 있도록 검색 조건을 입력합니다."
- 문장만 반환 (JSON, 따옴표, 부연 없이)`,
  });

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 128,
    messages: [{ role: 'user', content }],
  });

  return response.content[0].type === 'text' ? response.content[0].text.trim() : '';
}

// 라이브 가이드 AI 시각 재탐색 — 셀렉터·XPath·퍼지가 모두 실패했을 때 현재 화면
// 스크린샷에서 대상 요소의 위치를 Vision으로 찾아 0~1 정규화 좌표로 반환한다.
export async function regroundElement(
  screenshotBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
  target: { title?: string; instruction?: string; elementText?: string; actionType?: string }
): Promise<{ found: boolean; x: number; y: number; confidence: number }> {
  const hints: string[] = [];
  if (target.title)       hints.push(`단계 제목: ${target.title}`);
  if (target.instruction) hints.push(`설명: ${target.instruction}`);
  if (target.elementText) hints.push(`대상 요소에 보이는 텍스트: "${target.elementText}"`);
  if (target.actionType)  hints.push(`동작 유형: ${target.actionType}`);

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 128,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: screenshotBase64 } },
        {
          type: 'text',
          text: `이 스크린샷에서 사용자가 다음으로 클릭/입력해야 할 UI 요소의 위치를 찾아줘.

${hints.join('\n')}

[규칙]
- 해당 요소가 화면에 보이면 found=true, 그 요소 '중심'의 좌표 반환
- x, y는 0~1 정규화 (x=가로 비율 왼→오, y=세로 비율 위→아래)
- confidence는 0~1 (확신 정도). 비슷한 후보가 여럿이면 낮춰라
- 화면에 명확히 없으면 found=false
JSON만 반환 (마크다운 없이): {"found": true, "x": 0.5, "y": 0.3, "confidence": 0.9}`,
        },
      ],
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const p = JSON.parse(stripMarkdown(text));
    const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
    if (p.found === true && typeof p.x === 'number' && typeof p.y === 'number') {
      return { found: true, x: clamp01(p.x), y: clamp01(p.y), confidence: Number(p.confidence) || 0.5 };
    }
  } catch { /* ignore */ }
  return { found: false, x: 0, y: 0, confidence: 0 };
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
    model: CLAUDE_MODEL,
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
    model: CLAUDE_MODEL,
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
  steps: Array<{
    id: string;
    ai_title: string | null;
    ai_description: string | null;
    user_title?: string | null;
    user_script?: string | null;
    page_url: string | null;
    step_number: number;
    domain_name?: string | null;
    noAction?: boolean;
    action_type?: string | null;
    action_label?: string | null;
    element_text?: string | null;
    context_label?: string | null;
    page_title?: string | null;
  }>
): Promise<GenerateDraftResult> {
  if (!hasClaudeApiKey('generateDraft')) {
    return { tutorial_title: '', steps: [], status: 'missing_key', reason: 'ANTHROPIC_API_KEY is not configured' };
  }

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
      `제목: ${s.user_title || s.ai_title || '없음'}\n` +
      `설명: ${s.user_script || s.ai_description || '없음'}\n` +
      `URL: ${s.page_url || '없음'}\n` +
      `Action: type=${s.action_type || 'unknown'}, label=${s.action_label || '없음'}\n` +
      `Element text: ${s.element_text || '없음'}\n` +
      `Context heading: ${s.context_label || '없음'}\n` +
      `Page title: ${s.page_title || '없음'}` +
      (s.noAction ? `\n※ 이 단계는 특정 클릭 대상이 없음(전체화면/페이지 이동/캡처) — "○○ 클릭/누르기" 동작 제목 금지` : '')
    )
    .join('\n\n');

  const serviceHint = mainService ? `\n주요 서비스: ${mainService}` : '';
  const sourceStepTitles = steps.map(s => s.user_title || s.ai_title || s.action_label || s.element_text || '');
  const draftMaxTokens = Math.min(4096, Math.max(1024, steps.length * 110));

  let text = '{}';
  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: draftMaxTokens,
      messages: [
        {
          role: 'user',
          content: `다음은 사용자가 녹화한 매뉴얼 단계들입니다. 튜토리얼 제목과 각 스텝의 제목/설명을 생성해줘.${serviceHint}

${stepsText}

[먼저 내부적으로 판단할 것 — 응답에는 쓰지 말 것]
1. 전체 단계를 처음부터 끝까지 읽고 시작·설정·완료/검증 단계로 묶는다.
2. 사용자가 마지막에 얻게 되는 결과나 확인하는 상태가 무엇인지 추론한다.
3. 첫 클릭이나 중간 설정이 아니라 그 최종 결과를 tutorial_title로 정한다.
4. 생성→설치→테스트처럼 목적이 여러 구간에 걸치면 마지막 구간까지 제목에 포함한다.
5. DOM 라벨과 원문은 맥락 증거로만 사용하고 제목/설명에 그대로 복사하지 않는다.

[제목 규칙 — tutorial_title]
- 30자 안팎, "서비스명 + 사용자가 완성하는 결과" 형식
- 첫 클릭이나 첫 화면이 아니라 전체 절차가 끝났을 때 달성하는 최종 목적을 작성
- 여러 작업 구간이 있으면 "만들고 테스트하기", "작성 후 보내기", "설정하고 게시하기"처럼 최종 구간까지 표현
- "앱 추가하기", "메뉴 열기", "화면 확인하기"처럼 무엇이 완료되는지 모호한 제목 금지
- 목적을 확신할 수 없으면 원시 버튼명을 쓰지 말고 전체 흐름에서 반복되는 업무 대상을 기준으로 중립적인 결과를 작성
- 반드시 범용적인 행동 목적으로 작성 — 특정 상품명·수량·고유명사 절대 포함 금지
- 좋은 예: "쿠팡에서 상품 구매하기", "Slack 채널 만들기", "Gmail로 메일 보내기"
- 흐름이 새 Slack 앱 생성→권한/토큰 설정→워크스페이스 설치→에이전트 대화 테스트라면 "Slack AI 에이전트 앱 만들고 테스트하기"
- 위 Slack 흐름의 나쁜 제목: "Slack에 앱 추가하기", "Create New App 클릭하기", "OAuth 설정하기"
- 나쁜 예: "Code하기", "버튼 클릭하기", "Open menuHomepage 클릭하기"
- "매뉴얼 2026. 6. 4" 같은 날짜 형식 절대 금지

[스텝 제목 규칙 — user_title]
- 20자 이내, 핵심 행동 하나만
- 클릭 대상을 읽는 대신 해당 단계가 전체 목적에서 맡는 역할을 작성
- 예: "Create New App 클릭"→"새 앱 생성 시작", "허용 클릭"→"워크스페이스 설치 승인", "너의 역할은 뭐지? 클릭"→"에이전트 응답 테스트"
- 화면에 보인 원문을 그대로 읽지 말고, 매뉴얼 사용자가 이해할 업무 맥락으로 요약
- 접근성 이름, 단축키 힌트, 브레드크럼 문자열을 이어 붙이지 말 것
- 메일/알림 개수, 긴 버튼 aria-label, 입력된 메일 본문, 프롬프트 원문, 이메일 주소는 제목에 쓰지 말 것
- Gmail 수신자/참조/숨은참조 자동완성 후보를 클릭한 단계는 이메일 주소를 복사하지 말고 주변 단계 맥락으로 "수신자 자동 완성 클릭", "참조 수신자 자동 완성 클릭", "숨은참조 수신자 자동 완성 클릭"처럼 작성
- 받는사람/참조/숨은참조 입력 직후 이메일 후보를 클릭하는 단계는 직전 입력 단계의 역할을 이어받아 제목을 작성
- 특정 상품명·브랜드명·수량 포함 금지
- uuid/hash/id처럼 보이는 긴 영문·숫자 문자열 절대 포함 금지
- 좋은 예: "메일함 확인", "참조 수신자 자동 완성 클릭", "메일 본문 입력", "입력 내용 적용", "바로구매 버튼 클릭"
- 나쁜 예: "goodjob08070@naver.com 클릭", "메일, 읽지 않은 메일 2458개 클릭", "프롬프트 입력 입력", 입력된 문장 전체를 복사한 제목
- ※ 표시된 단계(클릭 대상 없음)는 "○○ 클릭/누르기" 절대 금지 — "○○ 화면 확인", "○○ 페이지로 이동" 같은 중립 제목으로

[스텝 설명 규칙 — user_script]
- 1문장 중심, "이유 + 수행할 행동 + 완료 후 상태"가 드러나도록 작성
- 존댓말
- uuid/hash/id처럼 보이는 긴 영문·숫자 문자열과 이메일 주소 절대 포함 금지
- 입력된 메일 본문이나 프롬프트 원문을 그대로 복사하지 말고 "작성한 내용을 입력합니다", "입력 내용을 적용합니다"처럼 요약
- UI 라벨을 그대로 반복하지 말고 "어떤 칸/목록/버튼에서 무엇을 하는지"로 작성
- Gmail 예: "참조 수신자 칸에 이메일 주소를 입력합니다.", "참조 수신자를 자동완성 목록에서 선택합니다.", "메일 제목을 입력합니다.", "메일 본문을 입력합니다.", "보내기 버튼을 클릭합니다."
- 클릭 대상이 없는 단계는 화면 확인/이동 맥락으로 설명
- 빈 문자열 금지

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

    text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  } catch (err) {
    console.error('generateDraft api error:', err);
    return {
      tutorial_title: '',
      steps: [],
      status: 'api_error',
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    const parsed = parseJsonObject(text) as { tutorial_title?: string; steps?: Array<{ id: string; user_title: string; user_script?: string }> };
    const draftSteps = Array.isArray(parsed.steps)
      ? parsed.steps.map((s) => ({
          id: s.id,
          user_title: s.user_title,
          user_script: String(s.user_script || ''),
        }))
      : [];
    if (draftSteps.length === 0) {
      console.warn('generateDraft returned empty steps:', { responsePreview: text.slice(0, 500) });
      return {
        tutorial_title: String(parsed.tutorial_title || ''),
        steps: draftSteps,
        status: 'empty_steps',
        reason: 'Claude response contained no usable steps',
        responsePreview: text.slice(0, 500),
      };
    }

    const titleContext = {
      stepTitles: [...sourceStepTitles, ...draftSteps.map(step => step.user_title)],
      serviceNames: [mainService],
    };
    let tutorialTitle = String(parsed.tutorial_title || '').trim();
    if (!isCaptureTutorialTitleGrounded(tutorialTitle, titleContext)) {
      try {
        const repairResponse = await client.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 256,
          messages: [{
            role: 'user',
            content: `아래 제목은 전체 매뉴얼의 최종 목적을 충분히 설명하지 못합니다. 전체 단계의 마지막 결과까지 포함한 목적형 제목으로 다시 작성해줘.${serviceHint}

현재 제목: ${tutorialTitle || '없음'}

${stepsText}

규칙:
- 첫 클릭, 버튼명, 메뉴명, 중간 설정이 아니라 전체 절차가 끝났을 때의 결과를 작성
- 여러 구간이면 마지막 완료/검증 구간까지 포함
- "앱 추가하기", "메뉴 열기", "화면 확인하기" 같은 모호한 표현 금지
- 30자 안팎, 특정 ID·이메일·개인 이름 제외
- JSON만 응답: {"tutorial_title":"..."}`,
          }],
        });
        const repairText = repairResponse.content[0].type === 'text' ? repairResponse.content[0].text : '{}';
        const repaired = parseJsonObject(repairText) as { tutorial_title?: string };
        const repairedTitle = String(repaired.tutorial_title || '').trim();
        tutorialTitle = isCaptureTutorialTitleGrounded(repairedTitle, titleContext) ? repairedTitle : '';
      } catch (err) {
        console.error('generateDraft tutorial title repair error:', err);
        tutorialTitle = '';
      }
    }

    return {
      tutorial_title: tutorialTitle,
      steps: draftSteps,
      status: 'ok',
    };
  } catch (err) {
    console.error('generateDraft parse error:', {
      error: err,
      responsePreview: text.slice(0, 500),
    });
    return {
      tutorial_title: '',
      steps: [],
      status: 'parse_error',
      reason: err instanceof Error ? err.message : String(err),
      responsePreview: text.slice(0, 500),
    };
  }
}

// 교육 자료 모드용 초안 생성 — Vision으로 각 스텝을 분석해 교육적 설명 생성 (Pro 전용)
export async function generateEducationalDraft(
  steps: Array<{
    id: string;
    screenshot_url: string;
    ai_title: string | null;
    page_url: string | null;
    domain_name: string | null;
    step_number: number;
  }>
): Promise<{ tutorial_title: string; steps: Array<{ id: string; user_title: string; user_script: string }> }> {
  // 튜토리얼 제목 생성 (텍스트 콘텍스트 기반)
  const domainCounts = new Map<string, number>();
  steps.forEach(s => {
    if (s.domain_name) domainCounts.set(s.domain_name, (domainCounts.get(s.domain_name) ?? 0) + 1);
  });
  const mainService = domainCounts.size > 0
    ? Array.from(domainCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  const titleRes = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 64,
    messages: [{
      role: 'user',
      content: `서비스명: ${mainService || '(알 수 없음)'}
스텝 요약: ${steps.map(s => s.ai_title || '').filter(Boolean).join(', ')}

이 내용을 교육 자료로 만들 때 적합한 제목을 작성해줘.
[규칙] 30자 이내, "서비스명 이용 가이드" 또는 "서비스명 사용 방법" 형식, 특정 상품명 금지.
JSON만: {"tutorial_title": "..."}`,
    }],
  }).catch(() => null);

  let tutorial_title = '';
  if (titleRes) {
    const t = titleRes.content[0].type === 'text' ? titleRes.content[0].text : '{}';
    try { tutorial_title = String(JSON.parse(stripMarkdown(t)).tutorial_title || ''); } catch { /* ignore */ }
  }

  // 스텝별 Vision 분석 — 병렬 실행
  const stepResults = await Promise.allSettled(
    steps.map(async (step) => {
      let domain = '';
      try { domain = step.page_url ? new URL(step.page_url).hostname : (step.domain_name ?? ''); } catch { domain = step.domain_name ?? ''; }

      // 스크린샷 fetch
      let b64 = '';
      let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg';
      try {
        const imgRes = await fetch(step.screenshot_url);
        if (imgRes.ok) {
          const ct = imgRes.headers.get('content-type') ?? 'image/jpeg';
          mediaType = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const)
            .find(t => ct.includes(t)) ?? 'image/jpeg';
          b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64');
        }
      } catch { /* fallback to text only */ }

      const contentBlocks: Anthropic.MessageParam['content'] = [];
      if (b64) {
        contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } });
      }
      const actionHint = step.ai_title ? `\n현재 화면에서 수행한 행동: "${step.ai_title}"` : '';
      contentBlocks.push({
        type: 'text',
        text: `이 스크린샷은 "${domain}" 서비스의 한 화면입니다.${actionHint}

교육 자료 형식으로 이 화면을 설명해줘.

[title 규칙] 이 화면/기능의 이름을 명사형으로 (15자 이내)
[explanation 규칙] 이 기능이 무엇을 하는지, 왜 사용하는지 2문장, 존댓말, 범용 표현 (특정 상품명·수량 금지)

JSON만 반환:
{"title": "...", "explanation": "..."}`,
      });

      const res = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 256,
        messages: [{ role: 'user', content: contentBlocks }],
      });

      const text = res.content[0].type === 'text' ? res.content[0].text : '{}';
      const parsed = JSON.parse(stripMarkdown(text));
      return {
        id: step.id,
        user_title: String(parsed.title || step.ai_title || '').slice(0, 50),
        user_script: String(parsed.explanation || '').slice(0, 500),
      };
    })
  );

  const draftSteps = stepResults
    .map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { id: steps[i].id, user_title: steps[i].ai_title ?? '', user_script: '' }
    );

  return { tutorial_title, steps: draftSteps };
}

// 스크린샷에서 dominant color 2개를 추출해 커버 그라데이션 색상 반환
export async function extractCoverColors(
  screenshotBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'
): Promise<{ color1: string; color2: string }> {
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
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
  return { color1: BRAND_COLORS.primary, color2: BRAND_COLORS.guide };
}

export async function rewriteSentence(
  original: string,
  instruction: string
): Promise<string> {
  if (!hasClaudeApiKey('rewriteSentence')) return original;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `다음 매뉴얼 스텝 설명을 "${instruction}" 방식으로 다시 작성해줘.

[공통 규칙]
- 수정된 결과만 반환 (설명, 따옴표, 부연 없이)
- 특정 상품명·브랜드명·수량은 범용 표현으로 교체 (예: "신라면 120g" → "상품")
- 문장 시작은 행동 동사나 명사로

원문:
${original}`,
    }],
  });
  return response.content[0].type === 'text' ? response.content[0].text.trim() : original;
}

export async function detectPII(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'
): Promise<boolean> {
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 64,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        {
          type: 'text',
          text: `이 스크린샷에 개인정보(이메일 주소, 전화번호, 주민등록번호, 신용카드 번호, 실명)가 화면에 노출되어 있으면 true, 없으면 false를 반환해줘.
JSON만 응답: {"pii": true} 또는 {"pii": false}`,
        },
      ],
    }],
  });
  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    return JSON.parse(stripMarkdown(text)).pii === true;
  } catch {
    return false;
  }
}

// 음성 전사 다듬기 — Whisper 원문의 맞춤법·구어체·중복을 정리해 매뉴얼 설명 문장으로.
// 내용은 보존하고 표현만 다듬는다 (요약·창작 금지). step_number → 다듬은 문장.
export async function cleanTranscripts(
  items: Array<{ step_number: number; raw: string }>
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (items.length === 0) return out;

  const numbered = items.map(it => `[${it.step_number}] ${it.raw}`).join('\n');
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `다음은 사용자가 화면을 녹화하며 각 단계를 말로 설명한 음성 전사문이다. 각 항목을 매뉴얼 설명 문장으로 다듬어줘.

[규칙]
- 맞춤법·띄어쓰기 교정, 구어체("어어", "그래서 이제" 등 군더더기) 제거, 자연스러운 문어체로
- 내용은 보존 — 요약하거나 없는 내용을 지어내지 말 것
- 1~2문장의 간결한 설명으로. 전사가 비어있거나 의미 없으면 빈 문자열("")
- 존댓말 종결("~합니다", "~하세요") 유지

[전사]
${numbered}

응답 형식 (JSON만, 마크다운 없이):
{ "steps": [ { "step_number": 1, "text": "다듬은 문장" } ] }`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const parsed = JSON.parse(stripMarkdown(text));
    if (Array.isArray(parsed.steps)) {
      for (const s of parsed.steps) {
        const n = Number(s.step_number);
        const t = String(s.text || '').trim();
        if (Number.isFinite(n) && t) out.set(n, t);
      }
    }
  } catch { /* 파싱 실패 — 빈 맵 반환, 원문 폴백은 호출부에서 */ }
  return out;
}

export async function rewriteAllSteps(
  steps: { id: string; text: string }[],
  instruction: string
): Promise<{ id: string; result: string }[]> {
  if (!hasClaudeApiKey('rewriteAllSteps')) return steps.map(s => ({ id: s.id, result: s.text }));

  const numbered = steps.map((s, i) => `[${i + 1}] ${s.text}`).join('\n');
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `다음은 매뉴얼 튜토리얼의 전체 스텝 목록이야. "${instruction}" 방식으로 전체를 다듬어줘.

[공통 규칙]
- 각 스텝의 순서와 번호를 유지할 것
- 앞뒤 문맥을 고려해서 흐름이 자연스럽게 이어지도록 다듬을 것
- 특정 상품명·브랜드명·수량은 범용 표현으로 교체
- 문장 시작은 행동 동사나 명사로
- 반드시 아래 형식으로만 반환: [번호] 수정된 문장 (설명, 따옴표, 부연 없이)

스텝 목록:
${numbered}`,
    }],
  });

  if (response.content[0].type !== 'text') return steps.map(s => ({ id: s.id, result: s.text }));

  const lines = response.content[0].text.trim().split('\n').filter(l => l.trim());
  return steps.map((s, i) => {
    const line = lines.find(l => l.startsWith(`[${i + 1}]`));
    const result = line ? line.replace(/^\[\d+\]\s*/, '').trim() : s.text;
    return { id: s.id, result };
  });
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
    model: CLAUDE_MODEL,
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
