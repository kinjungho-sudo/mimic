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
  const eCx = (ex1 + ex2) / 2;  // 요소 중심 X
  const eCy = (ey1 + ey2) / 2;  // 요소 중심 Y

  // 화살표 시작점: 요소 오른쪽에 여백이 충분하면 우측, 아니면 왼쪽
  // 우측 여백 = 100 - ex2, 좌측 여백 = ex1
  const rightRoom = 100 - ex2;
  const leftRoom  = ex1;
  const arrowLen  = 18; // % 단위 화살표 길이

  let arrowX1: number, arrowY1: number;

  if (rightRoom >= 20) {
    // 우측에서 진입
    arrowX1 = Math.min(ex2 + arrowLen, 96);
    arrowY1 = eCy;
  } else if (leftRoom >= 20) {
    // 좌측에서 진입
    arrowX1 = Math.max(ex1 - arrowLen, 4);
    arrowY1 = eCy;
  } else {
    // 위쪽에서 진입 (기본 fallback)
    arrowX1 = eCx;
    arrowY1 = Math.max(ey1 - arrowLen, 4);
  }

  // 화살표 끝점: 요소 테두리 중심 (요소 안으로 들어가지 않게)
  const arrowX2 = eCx;
  const arrowY2 = eCy;

  // 텍스트 라벨: 화살표 시작점 기준, 화살표 방향 반대쪽
  const markerSymbol = numberToMarker(stepNumber);
  const labelText = `${markerSymbol} ${label}`;

  // 텍스트 박스 크기 추정 (글자당 약 0.65% 너비, 높이 고정)
  const estCharW = 0.8;
  const textW = Math.min(labelText.length * estCharW + 4, 35);
  const textH = 6;

  let tx1: number, ty1: number;
  if (rightRoom >= 20) {
    // 화살표가 우측 → 텍스트는 화살표 끝(우측) 옆
    tx1 = arrowX1 - textW / 2;
    ty1 = arrowY1 - textH / 2;
  } else if (leftRoom >= 20) {
    // 화살표가 좌측
    tx1 = arrowX1 - textW / 2;
    ty1 = arrowY1 - textH / 2;
  } else {
    // 위쪽 화살표 → 텍스트는 화살표 위
    tx1 = arrowX1 - textW / 2;
    ty1 = arrowY1 - textH - 2;
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
