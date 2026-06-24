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
]);

function cleanText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[·•\-\s]+|[·•\-\s]+$/g, '')
    .trim();
}

function isWeakTitle(value: string | null | undefined): boolean {
  const text = cleanText(value);
  return !text || WEAK_TITLES.has(text) || /^단계\s*\d+\s*진행$/.test(text);
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
    return cleanText(segments.at(-1) || '');
  } catch {
    return '';
  }
}

function firstUseful(candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const text = cleanText(candidate);
    if (text) return text;
  }
  return '';
}

export function buildCaptureFallbackDraft(
  step: CaptureFallbackStepInput,
  context: CaptureFallbackContext = {}
): { id: string; user_title: string; user_script: string } {
  const actionType = context.actionInfo?.type;
  const specificBase = firstUseful([
    !isWeakTitle(step.ai_title) ? step.ai_title : null,
    context.actionInfo?.label,
    context.actionInfo?.text,
    context.elementText,
    labelFromUrl(step.page_url),
    step.domain_name,
  ]);
  const base = specificBase || '화면';
  const noAction = (context.noAction ?? false) || !specificBase;
  const verb = verbForAction(actionType, noAction);
  const userTitle = !isWeakTitle(step.ai_title)
    ? cleanText(step.ai_title)
    : `${base} ${verb}`;
  const userScript = cleanText(step.ai_description) || scriptFor(base, verb);

  return {
    id: step.id,
    user_title: userTitle.slice(0, 80),
    user_script: userScript,
  };
}

export function buildCaptureFallbackTutorialTitle(
  drafts: Array<{ user_title: string }>
): string {
  const firstActionTitle = drafts
    .map(draft => cleanText(draft.user_title))
    .find(title => title && !isWeakTitle(title) && title !== '화면 확인');

  if (!firstActionTitle) return '';
  if (firstActionTitle.endsWith('하기')) return firstActionTitle.slice(0, 30);
  return `${firstActionTitle}하기`.slice(0, 30);
}
