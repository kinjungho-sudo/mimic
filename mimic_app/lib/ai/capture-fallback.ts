export type CaptureFallbackStepInput = {
  id: string;
  ai_title: string | null;
  ai_description: string | null;
  page_url: string | null;
  step_number: number;
  domain_name?: string | null;
  type_text?: string | null;
};

export type CaptureFallbackActionInfo = {
  type?: string;
  label?: string;
  text?: string;
  tag?: string;
  role?: string;
  href?: string;
} | null | undefined;

export type CaptureFallbackContext = {
  actionInfo?: CaptureFallbackActionInfo;
  elementText?: string | null;
  noAction?: boolean;
};

const WEAK_TITLES = new Set([
  '화면 확인',
  '단계 진행',
  '클릭',
  '입력',
  '선택',
  '이동',
]);

const GENERIC_LABELS = new Set([
  'edit',
  'button',
  'link',
  'menu',
  'untitled',
  'click',
  'submit',
  'open',
  'close',
  'icon',
  'image',
  'svg',
  'div',
  'span',
  'checkout',
  'payment',
  'pay',
  'order',
  'orders',
  'cart',
  'basket',
  'product',
  'products',
]);

const RAW_CAPTURE_LABELS = new Set([
  'apps',
  'app',
  'oauth',
  'general',
  'functions',
  'function',
]);

const GOOGLE_DOC_CONTEXTS: Array<{ pattern: RegExp; base: string; noActionBase: string }> = [
  { pattern: /docs\.google\.com\/presentation/i, base: '파일명 영역', noActionBase: '슬라이드 편집 화면' },
  { pattern: /docs\.google\.com\/spreadsheets/i, base: '파일명 영역', noActionBase: '스프레드시트 편집 화면' },
  { pattern: /docs\.google\.com\/document/i, base: '파일명 영역', noActionBase: '문서 편집 화면' },
];

const SLACK_LABEL_CONTEXTS = new Map([
  ['apps', '앱 메뉴'],
  ['app', '앱 메뉴'],
  ['oauth', 'OAuth 설정'],
  ['general', 'general 채널'],
  ['functions', 'Functions 메뉴'],
  ['function', 'Functions 메뉴'],
]);

const GMAIL_CONTEXTS: Array<{ pattern: RegExp; base: string }> = [
  { pattern: /받은\s*편지함|받은편지함|inbox/i, base: '받은편지함' },
  { pattern: /읽지\s*않은\s*메일|메일함|mail/i, base: '메일함' },
  { pattern: /답장|reply/i, base: '답장' },
  { pattern: /보내기|send/i, base: '메일 보내기' },
  { pattern: /제목|subject/i, base: '메일 제목' },
  { pattern: /본문|body|message/i, base: '메일 본문' },
  { pattern: /숨은\s*참조|bcc/i, base: '숨은참조 수신자' },
  { pattern: /참조|\bcc\b/i, base: '참조 수신자' },
  { pattern: /받는\s*사람|recipient|to:/i, base: '받는 사람' },
];

const ECOMMERCE_URL_CONTEXTS: Array<{ pattern: RegExp; base: string; noActionBase?: string }> = [
  { pattern: /\/(np\/)?search|[?&]q=|[?&]keyword=/i, base: '검색 결과' },
  { pattern: /cart|basket/i, base: '장바구니' },
  { pattern: /checkout|payment|pay|order|orders|주문|결제/i, base: '주문 정보', noActionBase: '주문 화면' },
  { pattern: /product|products|goods|item|items|\/vp\//i, base: '상품 정보' },
];

function cleanText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[·•\-\s]+|[·•\-\s]+$/g, '')
    .trim();
}

function normalized(value: string | null | undefined): string {
  return cleanText(value).toLowerCase();
}

function isGenericLabel(value: string | null | undefined): boolean {
  const text = normalized(value);
  if (!text) return true;
  if (GENERIC_LABELS.has(text)) return true;
  return /^(edit|button|link|menu|click|untitled)(\s+\d+)?$/i.test(text);
}

function isRawCaptureLabel(value: string | null | undefined): boolean {
  return RAW_CAPTURE_LABELS.has(normalized(value));
}

function isLongCapturedContent(value: string | null | undefined): boolean {
  const text = cleanText(value);
  if (text.length < 45) return false;
  return /감사|보내주신|받는\s*사람|성함|업데이트|프롬프트|어노테이션|텍스트\s*박스|메일|내용/.test(text);
}

function hasCountNoise(value: string | null | undefined): boolean {
  const text = cleanText(value);
  return /(\d[\d,.\s]*개|[\d,]{3,})/.test(text) && /메일|알림|읽지|받은편지함|badge|count/i.test(text);
}

function hasMachineToken(value: string | null | undefined): boolean {
  const text = cleanText(value);
  if (!text) return false;
  const tokens = text.match(/[a-z0-9][a-z0-9_-]{7,}/gi) ?? [];
  return tokens.some(token => {
    const compact = token.replace(/[-_]/g, '');
    if (/^[a-f0-9]{12,}$/i.test(compact)) return true;
    if (/^[a-z0-9]{16,}$/i.test(compact) && /\d/.test(compact) && /[a-z]/i.test(compact)) return true;
    return /^[a-z]?[a-z0-9]{8,}$/i.test(compact) && /\d/.test(compact) && /[a-f0-9]{8,}/i.test(compact);
  });
}

function hasEmailAddress(value: string | null | undefined): boolean {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(cleanText(value));
}

function hasCapturedEditorChrome(value: string | null | undefined): boolean {
  const text = cleanText(value);
  return /아이콘 추가|커버 추가|댓글 추가|AI 기능은|명령에는/.test(text);
}

function hasAccessibilityShortcutNoise(value: string | null | undefined): boolean {
  const text = cleanText(value);
  return /open\s*menu.*homepage|homepage.*g\s*then\s*d|g\s*then\s*d|[a-z][A-Z]then\s+[a-z][A-Z]/i.test(text);
}

export function cleanCaptureTypeText(value: string | null | undefined): string | null {
  const raw = cleanText(value);
  if (!raw) return null;
  const hasNotionChrome = /아이콘 추가|커버 추가|댓글 추가/.test(raw);
  let text = raw.replace(/^(?:아이콘 추가\s+)?(?:커버 추가\s+)?(?:댓글 추가\s+)*/g, '').trim();
  if (hasNotionChrome) {
    text = text
      .replace(/\s+AI 기능은.*$/i, '')
      .replace(/\s+시작하기(?:\s+.*)?$/i, '')
      .trim();
  }
  return text || null;
}

export function isLowQualityCaptureLabel(value: string | null | undefined): boolean {
  const text = cleanText(value);
  return !text
    || isGenericLabel(text)
    || isRawCaptureLabel(text)
    || hasMachineToken(text)
    || isLongCapturedContent(text)
    || hasCapturedEditorChrome(text)
    || hasAccessibilityShortcutNoise(text);
}

function isWeakTitle(value: string | null | undefined): boolean {
  const text = cleanText(value);
  return !text || WEAK_TITLES.has(text) || /^단계\s*\d+\s*진행$/.test(text);
}

function actionBaseFromTitle(value: string): string {
  return cleanText(value)
    .replace(/\s*(클릭|확인|선택|입력|이동|하기)$/i, '')
    .trim();
}

function isLikelyRawDomActionBase(value: string): boolean {
  const text = cleanText(value);
  if (!text) return true;
  if (/^[a-z]$/i.test(text)) return true;
  if (/^(code|homepage|open menu)$/i.test(text)) return true;
  if (hasAccessibilityShortcutNoise(text)) return true;
  if (/^(search|검색)$/i.test(text)) return true;
  if (/\.{3}|…|—/.test(text)) return true;
  if (/아이콘 추가|커버 추가|댓글 추가/.test(text)) return true;
  if (/^(\+|파일 등 추가|페이지|새 페이지|텍스트|데이터베이스|ChatGPT와 채팅)$/i.test(text)) return true;
  if (/^Create documentation\b/i.test(text)) return true;
  if (/^블록을 아래에 추가하려면/i.test(text)) return true;
  if (/%|PRDs|tech specs/i.test(text)) return true;
  if (text.length > 32 && /클릭|선택|입력|확인|%|PRDs|tech specs/i.test(text)) return true;
  return false;
}

function isLikelyRawDomActionTitle(value: string | null | undefined): boolean {
  const text = cleanText(value);
  if (!text) return true;
  if (!/(클릭|확인|선택|입력|이동)$/.test(text)) return false;
  return isLikelyRawDomActionBase(actionBaseFromTitle(text));
}

export function isLowQualityCaptureTitle(value: string | null | undefined): boolean {
  const text = cleanText(value);
  if (isWeakTitle(text)) return true;
  if (isLowQualityCaptureLabel(text)) return true;
  if (hasEmailAddress(text)) return true;
  if (hasCountNoise(text)) return true;
  if (isLikelyRawDomActionTitle(text)) return true;
  if (/^\d+\s+(클릭|확인|선택|입력|이동)$/i.test(text)) return true;
  const rawLabelPattern = Array.from(RAW_CAPTURE_LABELS).join('|');
  return new RegExp(`^(${rawLabelPattern}|edit|button|link|menu|untitled|click)\\s+(클릭|확인|선택|입력|이동)$`, 'i').test(text);
}

export function isLowQualityCaptureScript(value: string | null | undefined): boolean {
  const text = cleanText(value);
  if (!text) return true;
  if (hasMachineToken(text)) return true;
  if (hasEmailAddress(text)) return true;
  if (hasCountNoise(text)) return true;
  if (isLongCapturedContent(text)) return true;
  if (hasCapturedEditorChrome(text)) return true;
  if (/^\d+(을|를)?\s*(클릭|확인|선택|입력|이동)합니다\.?$/i.test(text)) return true;
  const actionScriptMatch = /^(.+?)(을|를)?\s*(클릭|확인|선택|입력|이동)합니다\.?$/i.exec(text);
  if (actionScriptMatch && isLikelyRawDomActionBase(actionScriptMatch[1])) return true;
  if (/어노테이션|텍스트\s*박스|포함/.test(text)) return true;
  const rawLabelPattern = Array.from(RAW_CAPTURE_LABELS).join('|');
  return new RegExp(`^(${rawLabelPattern}|edit|button|link|menu|untitled|click)(을|를)?\\s*(클릭|확인|선택|입력|이동)합니다\\.?$`, 'i').test(text);
}

function hasFinalConsonant(text: string): boolean {
  const ch = text.trim().at(-1);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function objectParticle(text: string): string {
  return hasFinalConsonant(text) ? '을' : '를';
}

function locationParticle(text: string): string {
  return hasFinalConsonant(text) ? '으로' : '로';
}

function verbForAction(type: string | undefined, noAction: boolean): '클릭' | '입력' | '선택' | '이동' | '확인' {
  if (type === 'type' || type === 'focus_input') return '입력';
  if (type === 'select' || type === 'toggle') return '선택';
  if (type === 'navigate') return '이동';
  if (noAction) return '확인';
  return '클릭';
}

function titleVerbFor(base: string, actionType: string | undefined, noAction: boolean): ReturnType<typeof verbForAction> {
  const verb = verbForAction(actionType, noAction);
  if (/^GitHub\s|GitHub|저장소 코드|저장소 화면/.test(base)) return '확인';
  if (/메일함|받은편지함/.test(base)) return '확인';
  if (/주문 정보|주문 화면|결제 정보|결제 화면/.test(base)) return '확인';
  if (/메일 보내기/.test(base)) return '클릭';
  if (/자동 완성/.test(base)) return '클릭';
  if (verb === '입력' && /입력$/.test(base)) return '확인';
  return verb;
}

function recipientTarget(base: string): string {
  if (/숨은참조/.test(base)) return '숨은참조 수신자';
  if (/참조/.test(base)) return '참조 수신자';
  if (/받는 사람|수신자/.test(base)) return '수신자';
  return base;
}

function scriptFor(base: string, verb: ReturnType<typeof verbForAction>): string {
  if (/자동 완성/.test(base)) {
    return `${recipientTarget(base)}를 자동완성 목록에서 선택합니다.`;
  }
  if (/^(받는 사람|수신자|참조 수신자|숨은참조 수신자)$/.test(base) && verb === '입력') {
    return `${recipientTarget(base)} 칸에 이메일 주소를 입력합니다.`;
  }
  if (base === '메일 제목' && verb === '입력') return '메일 제목을 입력합니다.';
  if (base === '메일 본문' && verb === '입력') return '메일 본문을 입력합니다.';
  if (base === '메일 보내기' && verb === '클릭') return '보내기 버튼을 클릭합니다.';
  if (verb === '입력') return `${base}${locationParticle(base)} 내용을 입력합니다.`;
  if (verb === '선택') return `${base}${objectParticle(base)} 선택합니다.`;
  if (verb === '이동') return `${base}${locationParticle(base)} 이동합니다.`;
  if (verb === '확인') return `${base}${objectParticle(base)} 확인합니다.`;
  return `${base}${objectParticle(base)} 클릭합니다.`;
}

function contextFromCapturedLabel(label: string | null | undefined): string {
  const text = cleanText(label);
  if (!text) return '';
  if (/^(search|검색)$/i.test(text) || /검색\s*(창|어|필드|입력)/i.test(text)) return '검색창';
  if (/장바구니\s*담기|add\s*to\s*cart/i.test(text)) return '장바구니 담기 버튼';
  if (hasEmailAddress(text)) {
    if (/숨은\s*참조|bcc/i.test(text)) return '숨은참조 수신자 자동 완성';
    if (/참조|\bcc\b/i.test(text)) return '참조 수신자 자동 완성';
    return '수신자 자동 완성';
  }
  const gmail = GMAIL_CONTEXTS.find(context => context.pattern.test(text));
  if (gmail) return gmail.base;
  if (/프롬프트|prompt/i.test(text)) return '프롬프트';
  return '';
}

function labelFromUrl(pageUrl: string | null | undefined): string {
  if (!pageUrl) return '';
  try {
    const url = new URL(pageUrl);
    const segments = url.pathname
      .split('/')
      .map(segment => decodeURIComponent(segment).replace(/[-_]+/g, ' ').trim())
      .filter(segment => segment && !/^[a-f0-9-]{12,}$/i.test(segment));
    const label = cleanText(segments.at(-1) || '');
    return isGenericLabel(label) ? '' : label;
  } catch {
    return '';
  }
}

function contextFromUrl(pageUrl: string | null | undefined, noAction: boolean): string {
  if (!pageUrl) return '';
  const match = GOOGLE_DOC_CONTEXTS.find(context => context.pattern.test(pageUrl));
  if (match) return noAction ? match.noActionBase : match.base;
  const ecommerce = ECOMMERCE_URL_CONTEXTS.find(context => context.pattern.test(pageUrl));
  if (ecommerce) return noAction && ecommerce.noActionBase ? ecommerce.noActionBase : ecommerce.base;
  try {
    const url = new URL(pageUrl);
    const hostname = url.hostname.replace(/^www\./, '');
    if (hostname === 'github.com') {
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length >= 2) return noAction ? 'GitHub 저장소 화면' : 'GitHub 저장소';
      return 'GitHub 화면';
    }
    if (hostname) return noAction ? `${hostname} 화면` : `${hostname} 주요 영역`;
  } catch {
    return '';
  }
  return '';
}

function isCheckoutLikeUrl(pageUrl: string | null | undefined): boolean {
  return !!pageUrl && /checkout|payment|pay|order|orders|주문|결제/i.test(pageUrl);
}

function isContextuallyStaleLabel(value: string | null | undefined, pageUrl: string | null | undefined): boolean {
  const text = cleanText(value);
  if (!text || !pageUrl) return false;
  if (isCheckoutLikeUrl(pageUrl) && /장바구니\s*담기|add\s*to\s*cart/i.test(text)) return true;
  return false;
}

function hasSlackContext(pageUrl: string | null | undefined, domainName: string | null | undefined): boolean {
  if (/slack/i.test(domainName ?? '')) return true;
  if (!pageUrl) return false;
  try {
    return /slack/i.test(new URL(pageUrl).hostname);
  } catch {
    return /slack/i.test(pageUrl);
  }
}

function hasGitHubContext(pageUrl: string | null | undefined, domainName: string | null | undefined): boolean {
  if (/github/i.test(domainName ?? '')) return true;
  if (!pageUrl) return false;
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '') === 'github.com';
  } catch {
    return /github\.com/i.test(pageUrl);
  }
}

function isGitHubChromeLabel(value: string | null | undefined, pageUrl: string | null | undefined): boolean {
  const text = cleanText(value);
  if (!text || !hasGitHubContext(pageUrl, null)) return false;
  if (hasAccessibilityShortcutNoise(text)) return true;
  try {
    const url = new URL(pageUrl ?? '');
    const [owner, repo] = url.pathname.split('/').filter(Boolean);
    return [owner, repo].filter(Boolean).some(segment => segment?.toLowerCase() === text.toLowerCase());
  } catch {
    return false;
  }
}

function contextFromLabel(
  label: string | null | undefined,
  pageUrl: string | null | undefined,
  domainName: string | null | undefined,
  noAction: boolean
): string {
  const text = cleanText(label);
  const key = text.toLowerCase();
  if (!text) return '';
  if (hasGitHubContext(pageUrl, domainName)) {
    const githubContexts = new Map<string, string>([
      ['code', 'GitHub 저장소 코드'],
      ['issues', 'GitHub 이슈'],
      ['pull requests', 'GitHub 풀 리퀘스트'],
      ['actions', 'GitHub Actions'],
      ['projects', 'GitHub 프로젝트'],
      ['wiki', 'GitHub 위키'],
      ['security', 'GitHub 보안 설정'],
      ['insights', 'GitHub 저장소 분석'],
      ['settings', 'GitHub 저장소 설정'],
      ['branches', 'GitHub 브랜치 설정'],
      ['show more', 'GitHub 활동 목록'],
    ]);
    const githubContext = githubContexts.get(key);
    if (githubContext) return githubContext;
    if (/^[a-z0-9_.-]+\s+[a-z0-9_.-]+$/i.test(text)) return 'GitHub 저장소';
    if (isGitHubChromeLabel(text, pageUrl)) return noAction ? 'GitHub 저장소 화면' : 'GitHub 저장소';
  }
  if (!hasSlackContext(pageUrl, domainName)) return '';
  if (/^A[A-Z0-9]{8,}$/i.test(text)) return noAction ? '워크스페이스 화면' : '워크스페이스 항목';
  const slackContext = SLACK_LABEL_CONTEXTS.get(key);
  if (!slackContext) return '';
  if (noAction && (key === 'apps' || key === 'app')) return '앱 관리 화면';
  if (noAction && key === 'oauth') return 'OAuth 설정 화면';
  if (noAction && key === 'general') return 'general 채널 화면';
  return slackContext;
}

function firstUseful(candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const text = cleanText(candidate);
    if (text && !isLowQualityCaptureLabel(text)) return text;
  }
  return '';
}

function dedupeActionNoun(title: string): string {
  return cleanText(title)
    .replace(/(입력)\s+\1/g, '$1')
    .replace(/(클릭)\s+\1/g, '$1')
    .replace(/(확인)\s+\1/g, '$1');
}

export function buildCaptureFallbackDraft(
  step: CaptureFallbackStepInput,
  context: CaptureFallbackContext = {}
): { id: string; user_title: string; user_script: string } {
  const actionType = context.actionInfo?.type;
  const noActionFromEvent = context.noAction ?? false;
  const isStale = (value: string | null | undefined) =>
    isContextuallyStaleLabel(value, step.page_url) || isGitHubChromeLabel(value, step.page_url);
  const safeActionLabel = isStale(context.actionInfo?.label) ? null : context.actionInfo?.label;
  const safeActionText = isStale(context.actionInfo?.text) ? null : context.actionInfo?.text;
  const safeElementText = isStale(context.elementText) ? null : context.elementText;
  const safeAiTitle = isStale(step.ai_title) ? null : step.ai_title;
  const capturedValues = [safeActionLabel, safeActionText, safeElementText, safeAiTitle];
  const capturedInputContext = (actionType === 'type' || actionType === 'focus_input')
    && capturedValues.some(value => isLongCapturedContent(value))
    ? '메일 본문'
    : '';
  const pageContext = contextFromUrl(step.page_url, noActionFromEvent);
  const labelContext = contextFromLabel(
    context.actionInfo?.label,
    step.page_url,
    step.domain_name,
    noActionFromEvent
  );
  const capturedLabelContext = capturedInputContext
    || contextFromCapturedLabel(safeActionLabel)
    || contextFromCapturedLabel(safeActionText)
    || contextFromCapturedLabel(safeElementText)
    || contextFromCapturedLabel(safeAiTitle);
  const specificBase = firstUseful([
    safeAiTitle && !isLowQualityCaptureTitle(safeAiTitle) ? safeAiTitle : null,
    labelContext,
    capturedLabelContext,
    safeActionLabel,
    safeActionText,
    safeElementText,
    pageContext,
    labelFromUrl(step.page_url),
    step.domain_name,
  ]);
  const base = specificBase || '화면';
  const noAction = noActionFromEvent || !specificBase;
  const verb = titleVerbFor(base, actionType, noAction);
  const userTitle = safeAiTitle && !isLowQualityCaptureTitle(safeAiTitle)
    ? dedupeActionNoun(cleanText(safeAiTitle))
    : `${base} ${verb}`;
  const userScript = !isContextuallyStaleLabel(step.ai_description, step.page_url) && !isLowQualityCaptureScript(step.ai_description)
    ? cleanText(step.ai_description)
    : scriptFor(base, verb);

  return {
    id: step.id,
    user_title: userTitle.slice(0, 80),
    user_script: userScript,
  };
}

export function buildCaptureAnnotationLabel(title: string | null | undefined, actionType?: string | null, pageUrl?: string | null): string {
  const text = dedupeActionNoun(title ?? '').replace(/하기$/, '');
  if (isContextuallyStaleLabel(text, pageUrl)) {
    const pageContext = contextFromUrl(pageUrl, false);
    return pageContext ? `${pageContext} 확인`.slice(0, 18) : '대상 확인';
  }
  if (/^(search|검색)(\s*(클릭|확인|선택|입력|이동))?$/i.test(text)) return '검색창 선택';
  if (actionType === 'type' || actionType === 'focus_input') return '입력 적용';
  if (!text || isLowQualityCaptureTitle(text) || text.length > 18) {
    return actionType === 'select' || actionType === 'toggle' ? '선택 적용' : '대상 확인';
  }
  if (/메일함|받은편지함/.test(text)) return '메일함 확인';
  return text.slice(0, 18);
}

export function isUsableCaptureDraft(
  draft: { user_title?: string | null; user_script?: string | null } | null | undefined,
  context: { pageUrl?: string | null } = {}
): boolean {
  const title = draft?.user_title?.trim() || '';
  const script = draft?.user_script?.trim() || '';
  return !!title
    && !!script
    && !isContextuallyStaleLabel(title, context.pageUrl)
    && !isContextuallyStaleLabel(script, context.pageUrl)
    && !isLowQualityCaptureTitle(title)
    && !isLowQualityCaptureScript(script);
}

export function isLowQualityCaptureTutorialTitle(value: string | null | undefined): boolean {
  const text = cleanText(value);
  if (!text) return true;
  if (isLowQualityCaptureTitle(text.replace(/하기$/, ''))) return true;
  if (isLikelyRawDomActionBase(text.replace(/하기$/, ''))) return true;
  if (/(클릭|선택|입력)하기$/.test(text)) return true;
  return /^(메일|메뉴|버튼|링크|아이콘)\s*(클릭|선택)하기$/.test(text);
}

function tutorialTitleFromStepTitle(value: string): string {
  const title = cleanText(value);
  if (!title) return '';
  if (title.endsWith('하기')) return title.slice(0, 30);

  const action = /^(.*?)\s+(클릭|선택|입력|이동|확인)$/.exec(title);
  if (!action) return `${title} 확인하기`.slice(0, 30);

  const base = action[1].trim();
  const verb = action[2];
  if (!base) return '';
  if (verb === '입력') return `${base} 입력하기`.slice(0, 30);
  if (verb === '선택') return `${base} 선택하기`.slice(0, 30);
  if (verb === '이동') return `${base} 이동하기`.slice(0, 30);
  if (verb === '확인') return `${base} 확인하기`.slice(0, 30);
  if (/(보내기|발송|전송|작성|생성|등록|저장|다운로드|구매|공유|초대|로그인|제출)$/.test(base)) {
    return (base.endsWith('기') ? base : `${base}하기`).slice(0, 30);
  }
  return `${base} 확인하기`.slice(0, 30);
}

export function buildCaptureFallbackTutorialTitle(
  drafts: Array<{ user_title: string }>
): string {
  const titles = drafts
    .map(draft => cleanText(draft.user_title))
    .filter(title => title && !isLowQualityCaptureTitle(title) && title !== '화면 확인');

  const hasMailContext = titles.some(title => /메일|받은편지함|받는 사람|참조|본문|제목|보내기|발송/.test(title));
  if (hasMailContext) {
    const hasCompose = titles.some(title => /메일 쓰기|받는 사람|참조|본문|제목 입력|메일 본문|메일 작성/.test(title));
    const hasSend = titles.some(title => /보내기|보내기 클릭|발송|메일 보내기/.test(title));
    if (hasCompose && hasSend) return '메일 작성 후 보내기';
    if (hasCompose) return '메일 작성하기';
    if (titles.some(title => /메일함|받은편지함/.test(title))) return '메일함 확인하기';
  }

  const completionTitle = [...titles].reverse().find(title =>
    /(보내기|발송|완료|저장|게시|등록|신청|구매|생성|만들기|공유|초대|로그인|제출)(?:\s*(?:클릭|확인|선택|입력|이동))?$/.test(title)
  );
  const finalMeaningfulTitle = [...titles].reverse().find(title => !/(^.+\s클릭$|^.+\s선택$)/.test(title));
  const goalTitle = completionTitle || finalMeaningfulTitle || titles.at(-1);

  if (!goalTitle) return '';
  return tutorialTitleFromStepTitle(goalTitle);
}
