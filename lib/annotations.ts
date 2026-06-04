import type { Annotation } from '@/components/editor/ImageAnnotationEditor';

// ── buildClickHighlight ────────────────────────────────────
//
// element_rect + click_x/y 기반으로 Guidde 스타일 어노테이션 4종을 결정론적으로 생성.
// AI 좌표 계산 없음 — 모든 위치를 수식으로 확정.
//
// 생성 어노테이션:
//   1. spotlight  — element_rect 영역만 밝게, 나머지 어둡게
//   2. rect       — element_rect에 빨간 테두리
//   3. arrow      — element_rect 바깥 → element_rect 중심
//   4. text       — 화살표 시작점 옆, "① [label] 클릭" 형식
//
// 좌표 단위: 모두 0-100 (이미지 % 기준, Annotation 타입 규격)

type Rect = { x: number; y: number; width: number; height: number }; // 0-1 normalized

export function buildClickHighlight(params: {
  elementRect: Rect;
  stepNumber: number;
  label: string;       // ai_title 등 짧은 액션 설명
}): Annotation[] {
  const { elementRect: r, stepNumber, label } = params;

  // element_rect (0-1) → 0-100%
  const ex1 = r.x * 100;
  const ey1 = r.y * 100;
  const ex2 = (r.x + r.width) * 100;
  const ey2 = (r.y + r.height) * 100;
  const eCy = (ey1 + ey2) / 2;  // 요소 수직 중심

  const rightRoom = 100 - ex2;
  const leftRoom  = ex1;
  const arrowLen  = 22; // 충분히 긴 화살표로 요소에서 멀리 시작

  // 방향 결정 및 화살표 시작점/끝점 계산
  // 끝점: 요소 테두리 엣지 (요소 내부로 들어가지 않음)
  let arrowX1: number, arrowY1: number;
  let arrowX2: number, arrowY2: number;
  let direction: 'right' | 'left' | 'top';

  if (rightRoom >= 22) {
    direction = 'right';
    arrowX1 = Math.min(ex2 + arrowLen, 96);  // 시작: 요소 우측 바깥 멀리
    arrowY1 = eCy;
    arrowX2 = ex2;                             // 끝: 요소 우측 테두리
    arrowY2 = eCy;
  } else if (leftRoom >= 22) {
    direction = 'left';
    arrowX1 = Math.max(ex1 - arrowLen, 4);   // 시작: 요소 좌측 바깥 멀리
    arrowY1 = eCy;
    arrowX2 = ex1;                             // 끝: 요소 좌측 테두리
    arrowY2 = eCy;
  } else {
    direction = 'top';
    arrowX1 = (ex1 + ex2) / 2;
    arrowY1 = Math.max(ey1 - arrowLen, 4);   // 시작: 요소 위쪽 바깥 멀리
    arrowX2 = (ex1 + ex2) / 2;
    arrowY2 = ey1;                             // 끝: 요소 상단 테두리
  }

  // 텍스트 라벨: 화살표 막대 위에 (막대 중간 지점의 위쪽)
  const markerSymbol = numberToMarker(stepNumber);
  const labelText = `${markerSymbol} ${label}`;

  const estCharW = 0.75;
  const textW = Math.min(labelText.length * estCharW + 5, 38);
  const textH = 6.5;

  // 화살표 막대 중간 지점 계산
  const midX = (arrowX1 + arrowX2) / 2;
  const midY = (arrowY1 + arrowY2) / 2;

  let tx1: number, ty1: number;
  if (direction === 'right') {
    // 수평 화살표: 텍스트를 막대 위쪽 중간에
    tx1 = midX - textW / 2;
    ty1 = midY - textH - 1.5;
  } else if (direction === 'left') {
    tx1 = midX - textW / 2;
    ty1 = midY - textH - 1.5;
  } else {
    // 수직 화살표: 텍스트를 막대 오른쪽 중간에
    tx1 = midX + 2;
    ty1 = midY - textH / 2;
  }
  // 이미지 경계 내로 clamp
  tx1 = Math.max(1, Math.min(100 - textW - 1, tx1));
  ty1 = Math.max(1, Math.min(100 - textH - 1, ty1));

  const base = (suffix: string) => `guidde-${stepNumber}-${suffix}`;

  return [
    // 1. Spotlight
    {
      id: base('spotlight'),
      type: 'spotlight' as const,
      x1: ex1, y1: ey1, x2: ex2, y2: ey2,
      color: '#000000',
      strokeWidth: 0,
    },
    // 2. 빨간 테두리 rect
    {
      id: base('border'),
      type: 'rect' as const,
      x1: ex1, y1: ey1, x2: ex2, y2: ey2,
      color: '#EF4444',
      strokeWidth: 0.5,
    },
    // 3. 화살표
    {
      id: base('arrow'),
      type: 'arrow' as const,
      x1: arrowX1, y1: arrowY1,
      x2: arrowX2, y2: arrowY2,
      color: '#EF4444',
      strokeWidth: 0.55,
    },
    // 4. 텍스트 라벨
    {
      id: base('label'),
      type: 'text' as const,
      x1: tx1, y1: ty1,
      x2: tx1 + textW, y2: ty1 + textH,
      text: labelText,
      color: '#FFFFFF',
      fontSize: 13,
      fontBold: true,
      hasBg: true,
      borderColor: 'transparent',
      strokeWidth: 0,
    },
  ];
}

// ── numberToMarker ─────────────────────────────────────────
// 스텝 번호 → 원문자 (①②③... 10 이상은 숫자 그대로)
export function numberToMarker(n: number): string {
  const markers = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩',
                   '⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
  return n >= 1 && n <= markers.length ? markers[n - 1] : String(n);
}

// ── toEditorAnnotation ─────────────────────────────────────
// Claude AI 원형 포맷 → 에디터 Annotation 타입 변환 (레거시, generate-annotations API용)
export function toEditorAnnotation(raw: Record<string, unknown>, index: number): Annotation {
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
