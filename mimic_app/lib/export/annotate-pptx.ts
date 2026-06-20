// PPTX(pptxgenjs) 슬라이드 위에 어노테이션을 네이티브 도형으로 그린다. 신규 의존성 없음.
// 좌표 규칙: 어노테이션은 이미지 대비 0~100%. pptx는 인치 단위, 좌상단 원점(이미지 %와 동일 방향).
// rect = 슬라이드 위 "실제 표시 이미지" 사각형(인치). contain 레터박스를 호출부에서 미리 계산해 넘긴다.
// fill 없음은 transparency:100 으로 표현(pptxgenjs fill:{type:'none'} 호환성 회피).
import { FONT_REF_WIDTH, estimateTextW, toHex6, type ExportAnnotation as Annotation } from './annotations-shared';

interface ImgRect { x: number; y: number; w: number; h: number }

export function drawAnnotationsOnPptx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pptx: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slide: any,
  annotations: Annotation[] | null | undefined,
  rect: ImgRect,
): void {
  if (!annotations?.length) return;
  const { x: rx, y: ry, w: rw, h: rh } = rect;
  if (rw <= 0 || rh <= 0) return;
  const S = pptx.ShapeType;

  const toX = (p: number) => rx + (p / 100) * rw;
  const toY = (p: number) => ry + (p / 100) * rh;
  // strokeWidth(%) → points. 인치 = (sw/100)*rw, pt = ×72.
  const strokePt = (sw: number) => Math.max((sw / 100) * rw * 72, 1);
  // FONT_REF_WIDTH(1100px) 기준 측정값 → 인치 (fontSize·padding을 이미지 폭에 비례 변환)
  const refToIn = (v1100: number) => (v1100 / FONT_REF_WIDTH) * rw;
  const NOFILL = { color: 'FFFFFF', transparency: 100 };

  // ── spotlight: 어두운 오버레이 + 구멍(주변 4개 띠) ──
  for (const a of annotations) {
    if (a.type !== 'spotlight') continue;
    const sx1 = toX(Math.min(a.x1, a.x2)), sx2 = toX(Math.max(a.x1, a.x2));
    const sy1 = toY(Math.min(a.y1, a.y2)), sy2 = toY(Math.max(a.y1, a.y2));
    const dark = { color: '000000', transparency: 65 };
    const band = (x: number, y: number, w: number, h: number) => {
      if (w > 0.01 && h > 0.01) slide.addShape(S.rect, { x, y, w, h, fill: dark, line: { width: 0 } });
    };
    band(rx, ry, rw, sy1 - ry);
    band(rx, sy2, rw, (ry + rh) - sy2);
    band(rx, sy1, sx1 - rx, sy2 - sy1);
    band(sx2, sy1, (rx + rw) - sx2, sy2 - sy1);
  }

  for (const a of annotations) {
    if (a.type === 'spotlight' || a.type === 'crop') continue;
    const hex = toHex6(a.color as unknown as string);
    const x1 = toX(a.x1), y1 = toY(a.y1), x2 = toX(a.x2), y2 = toY(a.y2);
    const minX = Math.min(x1, x2), minY = Math.min(y1, y2);
    const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
    const sw = strokePt(a.strokeWidth);

    if (a.type === 'mosaic') {
      slide.addShape(S.rect, { x: minX, y: minY, w, h, fill: { color: '808080' }, line: { width: 0 } });
      continue;
    }
    if (a.type === 'highlight') {
      slide.addShape(S.rect, { x: minX, y: minY, w, h, fill: { color: hex, transparency: 65 }, line: { width: 0 } });
      continue;
    }
    if (a.type === 'rect' || a.type === 'recorderBox' || a.type === 'roundedRect') {
      const isRec = a.type === 'recorderBox';
      const shapeType = a.type === 'roundedRect' ? S.roundRect : S.rect;
      slide.addShape(shapeType, {
        x: minX, y: minY, w, h,
        line: { color: isRec ? 'EF4444' : hex, width: sw },
        fill: isRec ? { color: 'EF4444', transparency: 92 } : NOFILL,
        ...(a.type === 'roundedRect' ? { rectRadius: Math.min(w, h) * 0.15 } : {}),
      });
      continue;
    }
    if (a.type === 'ellipse') {
      slide.addShape(S.ellipse, { x: minX, y: minY, w, h, line: { color: hex, width: sw }, fill: NOFILL });
      continue;
    }
    if (a.type === 'line' || a.type === 'arrow') {
      const opts: Record<string, unknown> = {
        x: minX, y: minY, w, h,
        line: a.type === 'arrow'
          ? { color: hex, width: sw, endArrowType: 'triangle' }
          : { color: hex, width: sw },
        flipH: x2 < x1,
        flipV: y2 < y1,
      };
      slide.addShape(S.line, opts);
      continue;
    }
    if (a.type === 'marker') {
      const R = Math.max(0.12, rw * 0.022); // 인치 반지름
      const cx = x1, cy = y1;
      slide.addShape(S.ellipse, { x: cx - R, y: cy - R, w: 2 * R, h: 2 * R, fill: { color: hex }, line: { width: 0 } });
      slide.addText(String(a.markerNumber ?? 1), {
        x: cx - R, y: cy - R, w: 2 * R, h: 2 * R,
        align: 'center', valign: 'middle', margin: 0,
        fontSize: Math.max(8, R * 1.1 * 72), bold: true, color: 'FFFFFF',
      });
      continue;
    }
    if (a.type === 'text' && a.text) {
      const fSizeRef = a.fontSize ?? 16;             // 1100px 기준 px
      const fSizePt = refToIn(fSizeRef) * 72;
      const lines = a.text.split('\n');
      const boxWRef = estimateTextW(a.text, fSizeRef) + 2 * 12;
      const boxHRef = lines.length * (fSizeRef * 1.4) + 2 * 8;
      const boxW = refToIn(boxWRef), boxH = refToIn(boxHRef);
      const cx = (x1 + x2) / 2;
      const hasBg = a.hasBg !== false;
      slide.addText(a.text, {
        x: cx - boxW / 2, y: minY, w: boxW, h: boxH,
        align: 'center', valign: 'top', margin: 0,
        fontSize: fSizePt, bold: a.fontBold ?? false, color: hex,
        fill: hasBg ? { color: '0A0A0F', transparency: 8 } : NOFILL,
      });
      continue;
    }
  }
}
