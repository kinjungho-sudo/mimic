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
  '?붾㈃ ?뺤씤',
  '?④퀎 吏꾪뻾',
  '?대┃',
  '?낅젰',
  '?좏깮',
  '?대룞',
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
  { pattern: /docs\.google\.com\/presentation/i, base: '?뚯씪紐??곸뿭', noActionBase: '?щ씪?대뱶 ?몄쭛 ?붾㈃' },
  { pattern: /docs\.google\.com\/spreadsheets/i, base: '?뚯씪紐??곸뿭', noActionBase: '?ㅽ봽?덈뱶?쒗듃 ?몄쭛 ?붾㈃' },
  { pattern: /docs\.google\.com\/document/i, base: '?뚯씪紐??곸뿭', noActionBase: '臾몄꽌 ?몄쭛 ?붾㈃' },
];

const SLACK_LABEL_CONTEXTS = new Map([
  ['apps', '??硫붾돱'],
  ['app', '??硫붾돱'],
  ['oauth', 'OAuth ?ㅼ젙'],
  ['general', 'general 梨꾨꼸'],
  ['functions', 'Functions 硫붾돱'],
  ['function', 'Functions 硫붾돱'],
]);

const GMAIL_CONTEXTS: Array<{ pattern: RegExp; base: string }> = [
  { pattern: /받은\s*편지함|받은편지함|inbox/i, base: '받은편지함' },
  { pattern: /읽지\s*않은\s*메일|메일함|mail/i, base: '메일함' },
  { pattern: /답장|reply/i, base: '답장' },
  { pattern: /보내기|send/i, base: '메일 보내기' },
  { pattern: /본문|body|message/i, base: '메일 본문' },
  { pattern: /숨은\s*참조|bcc/i, base: '숨은참조 수신자' },
  { pattern: /참조|\bcc\b/i, base: '참조 수신자' },
  { pattern: /받는\s*사람|recipient|to:/i, base: '받는 사람' },
];

function cleanText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[쨌??-\s]+|[쨌??-\s]+$/g, '')
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
  const text = normalized(value);
  return RAW_CAPTURE_LABELS.has(text);
}

function isLongCapturedContent(value: string | null | undefined): boolean {
  const text = cleanText(value);
  if (text.length < 45) return false;
  return /媛먯궗|蹂대궡二쇱떊|諛쏅뒗\s*?щ엺|?깊븿|?낅뜲?댄듃|?꾨＼?꾪듃|?대끂?뚯씠???띿뒪??s*諛뺤뒪|硫붿씪|?댁슜/.test(text);
}

function hasCountNoise(value: string | null | undefined): boolean {
  const text = cleanText(value);
  return /(\d[\d,.\s]*媛?[\d,]{3,})/.test(text) && /硫붿씪|?뚮┝|?쎌?|諛쏆??몄???badge|count/i.test(text);
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

export function isLowQualityCaptureLabel(value: string | null | undefined): boolean {
  const text = cleanText(value);
  return !text || isGenericLabel(text) || isRawCaptureLabel(text) || hasMachineToken(text) || isLongCapturedContent(text);
}

function isWeakTitle(value: string | null | undefined): boolean {
  const text = cleanText(value);
  return !text || WEAK_TITLES.has(text) || /^?④퀎\s*\d+\s*吏꾪뻾$/.test(text);
}

export function isLowQualityCaptureTitle(value: string | null | undefined): boolean {
  const text = cleanText(value);
  if (isWeakTitle(text)) return true;
  if (isLowQualityCaptureLabel(text)) return true;
  if (hasEmailAddress(text)) return true;
  if (hasCountNoise(text)) return true;
  if (/^\d+\s+(\uD074\uB9AD|\uD655\uC778|\uC120\uD0DD|\uC785\uB825|\uC774\uB3D9)$/i.test(text)) return true;
  const rawLabelPattern = Array.from(RAW_CAPTURE_LABELS).join('|');
  return new RegExp(`^(${rawLabelPattern}|edit|button|link|menu|untitled|click)\\s+(?대┃|?뺤씤|?좏깮|?낅젰|?대룞)$`, 'i').test(text);
}

export function isLowQualityCaptureScript(value: string | null | undefined): boolean {
  const text = cleanText(value);
  if (!text) return true;
  if (hasMachineToken(text)) return true;
  if (hasEmailAddress(text)) return true;
  if (hasCountNoise(text)) return true;
  if (isLongCapturedContent(text)) return true;
  if (/^\d+(\uC744|\uB97C)?\s*(\uD074\uB9AD|\uD655\uC778|\uC120\uD0DD|\uC785\uB825|\uC774\uB3D9)\uD569\uB2C8\uB2E4\.?$/i.test(text)) return true;
  if (/?대끂?뚯씠???띿뒪??s*諛뺤뒪|?ы븿/.test(text)) return true;
  const rawLabelPattern = Array.from(RAW_CAPTURE_LABELS).join('|');
  return new RegExp(`^(${rawLabelPattern}|edit|button|link|menu|untitled|click)(??瑜??\\s*(?대┃|?뺤씤|?좏깮|?낅젰|?대룞)?⑸땲??\.?$`, 'i').test(text);
}

function hasFinalConsonant(text: string): boolean {
  const ch = text.trim().at(-1);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function objectParticle(text: string): string {
  return hasFinalConsonant(text) ? '?? : '瑜?;
}

function locationParticle(text: string): string {
  return hasFinalConsonant(text) ? '?쇰줈' : '濡?;
}

function verbForAction(type: string | undefined, noAction: boolean): '?대┃' | '?낅젰' | '?좏깮' | '?대룞' | '?뺤씤' {
  if (type === 'type' || type === 'focus_input') return '?낅젰';
  if (type === 'select' || type === 'toggle') return '?좏깮';
  if (type === 'navigate') return '?대룞';
  if (noAction) return '?뺤씤';
  return '?대┃';
}

function titleVerbFor(base: string, actionType: string | undefined, noAction: boolean): ReturnType<typeof verbForAction> {
  const verb = verbForAction(actionType, noAction);
  if (/硫붿씪??諛쏆??몄???.test(base)) return '?뺤씤';
  if (/硫붿씪 蹂대궡湲?.test(base)) return '?대┃';
  if (verb === '?낅젰' && /?낅젰$/.test(base)) return '?뺤씤';
  return verb;
}

function scriptFor(base: string, verb: ReturnType<typeof verbForAction>): string {
  if (verb === '?낅젰') return `${base}${locationParticle(base)} ?댁슜???낅젰?⑸땲??`;
  if (verb === '?좏깮') return `${base}${objectParticle(base)} ?좏깮?⑸땲??`;
  if (verb === '?대룞') return `${base}${locationParticle(base)} ?대룞?⑸땲??`;
  if (verb === '?뺤씤') return `${base}${objectParticle(base)} ?뺤씤?⑸땲??`;
  return `${base}${objectParticle(base)} ?대┃?⑸땲??`;
}

function contextFromCapturedLabel(label: string | null | undefined): string {
  const text = cleanText(label);
  if (!text) return '';
  if (hasEmailAddress(text)) {
    if (/숨은\s*참조|bcc/i.test(text)) return '숨은참조 수신자 자동 완성';
    if (/참조|\bcc\b/i.test(text)) return '참조 수신자 자동 완성';
    return '수신자 자동 완성';
  }
  const gmail = GMAIL_CONTEXTS.find(context => context.pattern.test(text));
  if (gmail) return gmail.base;
  if (/?꾨＼?꾪듃|prompt/i.test(text)) return '?꾨＼?꾪듃';
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
  try {
    const url = new URL(pageUrl);
    const hostname = url.hostname.replace(/^www\./, '');
    if (hostname) return noAction ? `${hostname} ?붾㈃` : `${hostname} 二쇱슂 ?곸뿭`;
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
  if (/^A[A-Z0-9]{8,}$/i.test(text)) return noAction ? '?뚰겕?ㅽ럹?댁뒪 ?붾㈃' : '?뚰겕?ㅽ럹?댁뒪 ??ぉ';
  const slackContext = SLACK_LABEL_CONTEXTS.get(key);
  if (!slackContext) return '';
  if (noAction && (key === 'apps' || key === 'app')) return '??愿由??붾㈃';
  if (noAction && key === 'oauth') return 'OAuth ?ㅼ젙 ?붾㈃';
  if (noAction && key === 'general') return 'general 梨꾨꼸 ?붾㈃';
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
    .replace(/(?낅젰)\s+\1/g, '$1')
    .replace(/(?대┃)\s+\1/g, '$1')
    .replace(/(?뺤씤)\s+\1/g, '$1');
}

export function buildCaptureFallbackDraft(
  step: CaptureFallbackStepInput,
  context: CaptureFallbackContext = {}
): { id: string; user_title: string; user_script: string } {
  const actionType = context.actionInfo?.type;
  const noActionFromEvent = context.noAction ?? false;
  const capturedValues = [context.actionInfo?.label, context.actionInfo?.text, context.elementText, step.ai_title];
  const capturedInputContext = (actionType === 'type' || actionType === 'focus_input')
    && capturedValues.some(value => isLongCapturedContent(value))
    ? '硫붿씪 蹂몃Ц'
    : '';
  const pageContext = contextFromUrl(step.page_url, noActionFromEvent);
  const labelContext = contextFromLabel(
    context.actionInfo?.label,
    step.page_url,
    step.domain_name,
    noActionFromEvent
  );
  const capturedLabelContext = capturedInputContext
    || contextFromCapturedLabel(context.actionInfo?.label)
    || contextFromCapturedLabel(context.actionInfo?.text)
    || contextFromCapturedLabel(context.elementText)
    || contextFromCapturedLabel(step.ai_title);
  const specificBase = firstUseful([
    !isLowQualityCaptureTitle(step.ai_title) ? step.ai_title : null,
    capturedLabelContext,
    labelContext,
    context.actionInfo?.label,
    context.actionInfo?.text,
    context.elementText,
    labelFromUrl(step.page_url),
    pageContext,
    step.domain_name,
  ]);
  const base = specificBase || '?붾㈃';
  const noAction = noActionFromEvent || !specificBase;
  const verb = titleVerbFor(base, actionType, noAction);
  const userTitle = !isLowQualityCaptureTitle(step.ai_title)
    ? dedupeActionNoun(cleanText(step.ai_title))
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

export function buildCaptureAnnotationLabel(title: string | null | undefined, actionType?: string | null): string {
  const text = dedupeActionNoun(title ?? '').replace(/?섍린$/, '');
  if (actionType === 'type' || actionType === 'focus_input') return '?낅젰 ?곸슜';
  if (!text || isLowQualityCaptureTitle(text) || text.length > 18) {
    return actionType === 'select' || actionType === 'toggle' ? '?좏깮 ?곸슜' : '????뺤씤';
  }
  if (/硫붿씪??諛쏆??몄???.test(text)) return '硫붿씪???뺤씤';
  return text.slice(0, 18);
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
    .find(title => title && !isLowQualityCaptureTitle(title) && title !== '?붾㈃ ?뺤씤');

  if (!firstActionTitle) return '';
  if (firstActionTitle.endsWith('?섍린')) return firstActionTitle.slice(0, 30);
  return `${firstActionTitle}?섍린`.slice(0, 30);
}
