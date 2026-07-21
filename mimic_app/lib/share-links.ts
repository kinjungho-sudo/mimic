type SharedStep = { id: string };

export function buildStepShareUrl(value: string, stepId: string): string {
  if (!value || !stepId) return value;
  try {
    const parsed = new URL(value, 'https://parro.local');
    parsed.searchParams.set('step', stepId);
    return parsed.toString();
  } catch {
    return value;
  }
}

export function resolveSharedStepIndex(
  value: string | null | undefined,
  steps: SharedStep[],
): number | null {
  const target = value?.trim();
  if (!target) return null;

  const idIndex = steps.findIndex(step => step.id === target);
  if (idIndex >= 0) return idIndex;

  // 초기 실험 링크의 1-based 단계 번호도 계속 열리게 하되,
  // 새 링크는 재정렬에도 안정적인 step id만 사용한다.
  if (!/^\d+$/.test(target)) return null;
  const numberedIndex = Number(target) - 1;
  return numberedIndex >= 0 && numberedIndex < steps.length ? numberedIndex : null;
}
