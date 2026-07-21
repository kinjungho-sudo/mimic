export type RegeneratedStepCopy = {
  id: string;
  user_title: string;
  user_script: string;
};

export type RegenerationQualityResult =
  | { ok: true }
  | { ok: false; reason: 'missing_steps' | 'duplicate_ids' | 'internal_identifier' | 'generic_copy' | 'repetitive_copy' };

const INTERNAL_CAPTURE_HOST = /\b(?:desktop|windows)\.parro\.(?:local|app)\b/i;
const GENERIC_TITLE = /^(?:(?:Windows|서비스|데스크톱|화면)\s*)?(?:설정 진행|작업 진행|화면 확인|다음 단계 준비|최종 결과 확인)$/i;
const ACTION_NOUN = '(?:클릭|선택|확인|입력|작성|열기|이동|진행|저장|적용|전송|완료|시작)';

export function normalizeStepTitleForComparison(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\s\u00a0]+/g, ' ')
    .replace(/[.!?。！？]+$/g, '')
    .trim()
    .toLowerCase()
    .replace(/(?:하기|합니다|해요)$/g, '')
    .replace(new RegExp(`([가-힣a-z0-9]+)(?:을|를)\\s+(?=${ACTION_NOUN}$)`, 'gi'), '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalized(value: string): string {
  return normalizeStepTitleForComparison(value);
}

function isRepetitive(values: string[]): boolean {
  if (values.length < 3) return false;
  const counts = new Map<string, number>();
  for (const value of values.map(normalized).filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const maxCount = Math.max(0, ...Array.from(counts.values()));
  return maxCount >= Math.ceil(values.length * 0.6);
}

export function validateRegeneratedStepSet(
  sourceIds: string[],
  drafts: RegeneratedStepCopy[],
): RegenerationQualityResult {
  const expected = new Set(sourceIds);
  const received = new Set(drafts.map(draft => draft.id));
  if (received.size !== drafts.length) return { ok: false, reason: 'duplicate_ids' };
  if (drafts.length !== sourceIds.length || sourceIds.some(id => !received.has(id)) || drafts.some(draft => !expected.has(draft.id))) {
    return { ok: false, reason: 'missing_steps' };
  }

  if (drafts.some(draft => INTERNAL_CAPTURE_HOST.test(`${draft.user_title} ${draft.user_script}`))) {
    return { ok: false, reason: 'internal_identifier' };
  }
  if (drafts.some(draft => GENERIC_TITLE.test(draft.user_title.trim()))) {
    return { ok: false, reason: 'generic_copy' };
  }
  if (isRepetitive(drafts.map(draft => draft.user_title)) || isRepetitive(drafts.map(draft => draft.user_script))) {
    return { ok: false, reason: 'repetitive_copy' };
  }
  return { ok: true };
}
