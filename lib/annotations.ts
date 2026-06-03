// 자동 생성 기본 프롬프트 — 모든 스텝에 적용되는 표준 어노테이션 세트
export const AUTO_ANNOTATION_PROMPT =
  '클릭된 요소에 노란색 하이라이트 박스를 치고, 빨간 화살표로 가리켜줘. ' +
  '클릭 지점 주변에 빨간 원을 그리고 "클릭" 캡션을 달아줘. ' +
  '하이라이트 박스, 화살표, "여기를 클릭하세요" 텍스트를 모두 배치해줘.';

// AI 원형 포맷 → 에디터 Annotation 타입 변환
export function toEditorAnnotation(raw: Record<string, unknown>, index: number) {
  const type = raw.type as string;
  const style = (raw.style ?? {}) as Record<string, unknown>;
  const geo = (raw.geometry ?? {}) as Record<string, unknown>;
  const label = raw.label as string | undefined;
  const color = (style.color as string) ?? '#EF4444';

  const x = (geo.x as number) * 100;
  const y = (geo.y as number) * 100;
  const w = (geo.width as number) * 100;
  const h = (geo.height as number) * 100;

  const base = {
    id: `ai-${Date.now()}-${index}`,
    color,
    strokeWidth: 0.5,
  };

  if (type === 'rectangle') {
    return { ...base, type: 'highlight' as const, x1: x, y1: y, x2: x + w, y2: y + h };
  }
  if (type === 'circle') {
    return { ...base, type: 'ellipse' as const, strokeWidth: 0.3, x1: x, y1: y, x2: x + w, y2: y + h };
  }
  if (type === 'arrow') {
    return { ...base, type: 'arrow' as const, x1: x, y1: y, x2: x + w, y2: y + h };
  }
  if (type === 'text') {
    return {
      ...base, type: 'text' as const,
      x1: x, y1: y, x2: x + w, y2: y + h,
      text: label ?? '',
      fontSize: 14,
      borderColor: 'rgba(255,255,255,0.6)',
    };
  }
  return { ...base, type: 'rect' as const, x1: x, y1: y, x2: x + w, y2: y + h };
}
