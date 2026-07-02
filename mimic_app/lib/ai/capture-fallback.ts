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
  { pattern: /mail\.google\.com/i, base: 'Gmail 작업 영역', noActionBase: 'Gmail 화면' },
];

const SLACK_LABEL_CONTEXTS = new Map([
  ['apps', '앱 메뉴'],
  ['app', '앱 메뉴'],
  ['oauth', 'OAuth 설정'],
  ['general', 'general 채널'],
  ['functions', 'Functions 메뉴'],
  ['function', 'Functions 메뉴'],
]);

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
  if (/^\d+$/.test(text)) return true;
  if (GENERIC_LABELS.has(text)) return true;
  return /^(edit|button|link|menu|click|untitled)(\s+\d+)?$/i.test(text);
}

function isRawCaptureLabel(value: string | null | undefined): boolean {
  const text = normalized(value);
  return RAW_CAPTURE_LABELS.has(text);
}

function isWeakTitle(value: string | null | undefined): boolean {
  const text = cleanText(value);
  return !text || WEAK_TITLES.has(text) || /^단계\s*\d+\s*진행$/.test(text);
}

export function isLowQualityCaptureTitle(value: string | null | undefined): boolean {
  const text = cleanText(value);
  if (isWeakTitle(text)) return true;
  if (isGenericLabel(text)) return true;
  if (/^\d+\s+(클릭|확인|선택|입력|이동)$/i.test(text)) return true;
  const rawLabelPattern = Array.from(RAW_CAPTURE_LABELS).join('|');
  return new RegExp(`^(${rawLabelPattern}|edit|button|link|menu|untitled|click)\\s+(클릭|확인|선택|입력|이동)$`, 'i').test(text);
}

export function isLowQualityCaptureScript(value: string | null | undefined): boolean {
  const text = cleanText(value);
  if (!text) return true;
  if (/^\d+(을|를)?\s*(클릭|확인|선택|입력|이동)합니다\.?$/i.test(text)) return true;
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

function scriptFor(base: string, verb: ReturnType<typeof verbForAction>): string {
  if (verb === '입력') return `${base}${locationParticle(base)} 내용을 입력합니다.`;
  if (verb === '선택') return `${base}${objectParticle(base)} 선택합니다.`;
  if (verb === '이동') return `${base}${locationParticle(base)} 이동합니다.`;
  if (verb === '확인') return `${base}${objectParticle(base)} 확인합니다.`;
  return `${base}${objectParticle(base)} 클릭합니다.`;
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
  try {
    const url = new URL(pageUrl);
    const hostname = url.hostname.replace(/^www\./, '');
    if (hostname) return noAction ? `${hostname} 화면` : `${hostname} 주요 영역`;
  } catch {
    return '';
  }
  return '';
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

function contextFromLabel(
  label: string | null | undefined,
  pageUrl: string | null | undefined,
  domainName: string | null | undefined,
  noAction: boolean
): string {
  const text = cleanText(label);
  const key = text.toLowerCase();
  if (!text || !hasSlackContext(pageUrl, domainName)) return '';
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
    if (text && !isGenericLabel(text) && !isRawCaptureLabel(text)) return text;
  }
  return '';
}

export function buildCaptureFallbackDraft(
  step: CaptureFallbackStepInput,
  context: CaptureFallbackContext = {}
): { id: string; user_title: string; user_script: string } {
  const actionType = context.actionInfo?.type;
  const noActionFromEvent = context.noAction ?? false;
  const pageContext = contextFromUrl(step.page_url, noActionFromEvent);
  const labelContext = contextFromLabel(
    context.actionInfo?.label,
    step.page_url,
    step.domain_name,
    noActionFromEvent
  );
  const specificBase = firstUseful([
    !isLowQualityCaptureTitle(step.ai_title) ? step.ai_title : null,
    labelContext,
    context.actionInfo?.label,
    context.actionInfo?.text,
    context.elementText,
    labelFromUrl(step.page_url),
    pageContext,
    step.domain_name,
  ]);
  const base = specificBase || '화면';
  const noAction = noActionFromEvent || !specificBase;
  const verb = verbForAction(actionType, noAction);
  const userTitle = !isLowQualityCaptureTitle(step.ai_title)
    ? cleanText(step.ai_title)
    : `${base} ${verb}`;
  const userScript = !isLowQualityCaptureScript(step.ai_description)
    ? cleanText(step.ai_description)
    : scriptFor(base, verb);

  return {
    id: step.id,
    user_title: userTitle.slice(0, 80),
    user_script: userScript,
  };
}

export function isUsableCaptureDraft(
  draft: { user_title?: string | null; user_script?: string | null } | null | undefined
): boolean {
  const title = draft?.user_title?.trim() || '';
  const script = draft?.user_script?.trim() || '';
  return !!title
    && !!script
    && !isLowQualityCaptureTitle(title)
    && !isLowQualityCaptureScript(script);
}

export function buildCaptureFallbackTutorialTitle(
  drafts: Array<{ user_title: string }>
): string {
  const firstActionTitle = drafts
    .map(draft => cleanText(draft.user_title))
    .find(title => title && !isLowQualityCaptureTitle(title) && title !== '화면 확인');

  if (!firstActionTitle) return '';
  if (firstActionTitle.endsWith('하기')) return firstActionTitle.slice(0, 30);
  return `${firstActionTitle}하기`.slice(0, 30);
}
