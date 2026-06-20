// PDF(pdf-lib) 위에 어노테이션을 벡터로 그린다. 신규 의존성 없이 pdf-lib 기본 도형만 사용.
// 좌표 규칙: 어노테이션 좌표는 이미지 대비 0~100%. PDF는 좌하단 원점(y 위로 증가).
// 뷰어(AnnotationPreview)와 동일한 위치/크기를 재현하되, crop/zoom은 적용하지 않는다(전체 이미지 기준).
import { rgb } from 'pdf-lib';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PDFPageLike = any; // pdf-lib PDFPage (라우트에서 생성된 page 전달)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PDFFontLike = any;
import { FONT_REF_WIDTH, estimateTextW, parseColor, type ExportAnnotation as Annotation } from './annotations-shared';

// rect: 이미지가 그려진 PDF 사각형. (x,y)=좌하단 코너, w/h=픽셀(pt) 크기.
interface ImgRect { x: number; y: number; w: number; h: number }

export function drawAnnotationsOnPdf(
  page: PDFPageLike,
  annotations: Annotation[] | null | undefined,
  rect: ImgRect,
  font: PDFFontLike,
  fontBold: PDFFontLike,
): void {
  if (!annotations?.length) return;
  const { x: rx, y: ry, w: rw, h: rh } = rect;
  if (rw <= 0 || rh <= 0) return;

  const toX = (pct: number) => rx + (pct / 100) * rw;
  const toY = (pct: number) => ry + rh - (pct / 100) * rh; // 상단 기준 %(y-down) → PDF y(up)
  const toLen = (pct: number) => (pct / 100) * rw;         // 너비 기준 길이(strokeWidth 등)

  // ── spotlight: 어두운 오버레이 + 구멍(주변 4개 띠) ──
  for (const a of annotations) {
    if (a.type !== 'spotlight') continue;
    const sx1 = toX(Math.min(a.x1, a.x2)), sx2 = toX(Math.max(a.x1, a.x2));
    const syTop = toY(Math.min(a.y1, a.y2)); // 구멍 위쪽(더 큰 PDF y)
    const syBot = toY(Math.max(a.y1, a.y2)); // 구멍 아래쪽(더 작은 PDF y)
    const dark = rgb(0, 0, 0), op = 0.35;
    const band = (x: number, y: number, w: number, h: number) => {
      if (w > 0.5 && h > 0.5) page.drawRectangle({ x, y, width: w, height: h, color: dark, opacity: op });
    };
    band(rx, syTop, rw, (ry + rh) - syTop);          // 위
    band(rx, ry, rw, syBot - ry);                    // 아래
    band(rx, syBot, sx1 - rx, syTop - syBot);        // 왼
    band(sx2, syBot, (rx + rw) - sx2, syTop - syBot); // 오른
  }

  for (const a of annotations) {
    if (a.type === 'spotlight' || a.type === 'crop') continue;
    const col = parseColor(a.color as unknown as string);
    const c = rgb(col.r, col.g, col.b);
    const x1 = toX(a.x1), x2 = toX(a.x2);
    const yTop = toY(Math.min(a.y1, a.y2));
    const yBot = toY(Math.max(a.y1, a.y2));
    const minX = Math.min(x1, x2);
    const w = Math.abs(x2 - x1);
    const h = yTop - yBot;
    const sp = Math.max(toLen(a.strokeWidth), 1);

    if (a.type === 'mosaic') {
      // 블러는 벡터로 불가 → 회색 리덕션 박스(내용 가림 목적은 유지)
      page.drawRectangle({ x: minX, y: yBot, width: w, height: h, color: rgb(0.5, 0.5, 0.5) });
      continue;
    }
    if (a.type === 'highlight') {
      page.drawRectangle({ x: minX, y: yBot, width: w, height: h, color: c, opacity: 0.35 });
      continue;
    }
    if (a.type === 'rect' || a.type === 'recorderBox' || a.type === 'roundedRect') {
      const o = sp / 2;
      const isRec = a.type === 'recorderBox';
      page.drawRectangle({
        x: minX - o, y: yBot - o, width: w + sp, height: h + sp,
        borderColor: isRec ? rgb(0.937, 0.267, 0.267) : c,
        borderWidth: sp,
        ...(isRec ? { color: rgb(0.937, 0.267, 0.267), opacity: 0.08 } : {}),
      });
      continue;
    }
    if (a.type === 'ellipse') {
      const o = sp / 2;
      page.drawEllipse({
        x: (x1 + x2) / 2, y: (yTop + yBot) / 2,
        xScale: w / 2 + o, yScale: h / 2 + o,
        borderColor: c, borderWidth: sp,
      });
      continue;
    }
    if (a.type === 'line') {
      page.drawLine({ start: { x: x1, y: toY(a.y1) }, end: { x: x2, y: toY(a.y2) }, thickness: sp, color: c });
      continue;
    }
    if (a.type === 'arrow') {
      const tx = x2, ty = toY(a.y2);       // 화살표 끝(촉)
      const sx = x1, sy = toY(a.y1);       // 시작
      const dx = tx - sx, dy = ty - sy;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;
      const ux = dx / len, uy = dy / len;
      const headLen = Math.max(sp * 3, 10);
      const headW = headLen * 0.55;
      // 샤프트: 촉 직전까지
      const lx2 = tx - ux * headLen * 0.65, ly2 = ty - uy * headLen * 0.65;
      page.drawLine({ start: { x: sx, y: sy }, end: { x: lx2, y: ly2 }, thickness: sp, color: c });
      // 촉: 채워진 삼각형 (drawSvgPath, 원점=촉. svg y-down이므로 PDF Δy 부호 반전)
      const bx = tx - ux * headLen, by = ty - uy * headLen; // 밑변 중심
      const px = -uy, py = ux;                              // 수직 단위벡터
      const qx = bx + px * headW, qy = by + py * headW;
      const r2x = bx - px * headW, r2y = by - py * headW;
      const path = `M 0 0 L ${qx - tx} ${-(qy - ty)} L ${r2x - tx} ${-(r2y - ty)} Z`;
      page.drawSvgPath(path, { x: tx, y: ty, color: c, borderWidth: 0 });
      continue;
    }
    if (a.type === 'marker') {
      const R = Math.max(8, rw * 0.022);
      const cx = x1, cy = toY(a.y1);
      page.drawCircle({ x: cx, y: cy, size: R, color: c });
      const num = String(a.markerNumber ?? 1);
      const fs = R * 1.1;
      const tw = fontBold.widthOfTextAtSize(num, fs);
      page.drawText(num, { x: cx - tw / 2, y: cy - fs * 0.36, size: fs, font: fontBold, color: rgb(1, 1, 1) });
      continue;
    }
    if (a.type === 'text' && a.text) {
      const fontScale = rw / FONT_REF_WIDTH;
      const fSize = (a.fontSize ?? 16) * fontScale;
      const bold = a.fontBold ?? false;
      const useFont = bold ? fontBold : font;
      const lines = a.text.split('\n');
      const padX = 12 * fontScale, padY = 8 * fontScale;
      const lineH = fSize * 1.4;
      const boxW = estimateTextW(a.text, fSize) + 2 * padX;
      const boxH = lines.length * lineH + 2 * padY;
      const cx = (x1 + x2) / 2;
      const boxX = cx - boxW / 2;
      const boxTopY = yTop; // 박스 상단(PDF y)
      const hasBg = a.hasBg !== false;
      if (hasBg) {
        page.drawRectangle({ x: boxX, y: boxTopY - boxH, width: boxW, height: boxH, color: rgb(0.04, 0.04, 0.06), opacity: 0.92, borderColor: rgb(0, 0, 0), borderWidth: 0 });
      }
      lines.forEach((line, i) => {
        const tw = useFont.widthOfTextAtSize(line, fSize);
        const lineTop = boxTopY - padY - i * lineH;
        const baseline = lineTop - fSize * 0.8; // text-before-edge → baseline ≈ top - ascent
        page.drawText(line, { x: cx - tw / 2, y: baseline, size: fSize, font: useFont, color: c });
      });
      continue;
    }
  }
}
