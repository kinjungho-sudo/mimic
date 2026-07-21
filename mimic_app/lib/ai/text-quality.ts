import {
  isLowQualityCaptureScript,
  isLowQualityCaptureTitle,
} from '@/lib/ai/capture-fallback';

export type ManualTextQualityResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'empty' | 'too_short' | 'too_long' | 'low_quality'; text: string };

const MAX_TITLE_LENGTH = 200;
const MAX_SCRIPT_LENGTH = 2000;

export function cleanManualText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function isLowQualityManualTitle(value: string | null | undefined): boolean {
  const text = cleanManualText(value);
  if (!text) return true;
  if (text.length > MAX_TITLE_LENGTH) return true;
  if (/^매뉴얼\s*\d{4}[./-]\d{1,2}[./-]\d{1,2}$/i.test(text)) return true;
  return isLowQualityCaptureTitle(text);
}

export function isLowQualityManualScript(value: string | null | undefined): boolean {
  const text = cleanManualText(value);
  if (!text) return true;
  if (text.length > MAX_SCRIPT_LENGTH) return true;
  if (text.length < 6) return true;
  if (/^(확인합니다|클릭합니다|선택합니다|입력합니다)\.?$/.test(text)) return true;
  if (/^(?:검색어|내용)(?:을|를)?\s*(?:입력|작성)합니다\.?$/.test(text)) return true;
  if (/^입력\s*영역(?:을|를)?\s*선택합니다\.?$/.test(text)) return true;
  return isLowQualityCaptureScript(text);
}

export function validateGeneratedManualScript(value: string | null | undefined): ManualTextQualityResult {
  const text = cleanManualText(value);
  if (!text) return { ok: false, reason: 'empty', text };
  if (text.length > MAX_SCRIPT_LENGTH) return { ok: false, reason: 'too_long', text };
  if (text.length < 6) return { ok: false, reason: 'too_short', text };
  if (isLowQualityManualScript(text)) return { ok: false, reason: 'low_quality', text };
  return { ok: true, text };
}

export function keepUsableRewriteResults(
  sourceSteps: Array<{ id: string; text: string }>,
  results: Array<{ id: string; result: string }>
): Array<{ id: string; result: string; rejected?: boolean }> {
  const sourceById = new Map(sourceSteps.map(step => [step.id, cleanManualText(step.text)]));

  return results
    .filter(result => sourceById.has(result.id))
    .map(result => {
      const candidate = validateGeneratedManualScript(result.result);
      if (candidate.ok) return { id: result.id, result: candidate.text };

      const original = sourceById.get(result.id) ?? '';
      return {
        id: result.id,
        result: original,
        rejected: true,
      };
    })
    .filter(result => result.result);
}
