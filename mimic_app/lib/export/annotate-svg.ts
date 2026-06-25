// 원본 스크린샷(base64 data URI) 위에 어노테이션을 얹은 완성 SVG 문자열을 만든다.
// DOCX 내보내기에서 @resvg/resvg-js로 PNG 래스터화해 이미지에 "구워" 넣기 위함
// (Word는 PDF/PPTX처럼 벡터 오버레이를 지원하지 않으므로 이미지 합성이 필요).
//
// 좌표/크기 규칙은 뷰어(components/editor/AnnotationPreview.tsx)와 100% 동일:
//   - 어노테이션 좌표(x1,y1,x2,y2)·strokeWidth는 이미지 대비 0~100%
//   - viewBox는 이미지 자연 픽셀(imgW×imgH), crop/zoom은 적용하지 않음(전체 이미지 기준)
// resvg(usvg) 호환을 위해 rgba()는 fill/stroke + *-opacity 로 분리한다.
import { FONT_REF_WIDTH, estimateTextW, type ExportAnnotation as Annotation } from './annotations-shared';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 신뢰값(우리가 생성)이지만 SVG 주입 방지용으로 hex/rgb(a)/named 색상만 허용
function safeColor(c: unknown): string {
  if (typeof c === 'string' && /^(#[0-9a-fA-F]{3,8}|rgba?\([\d.,\s]+\)|[a-zA-Z]+)$/.test(c.trim())) {
    return c.trim();
  }
  return '#EF4444';
}

export function buildAnnotatedSvg(
  imgDataUri: string,
  imgW: number,
  imgH: number,
  annotations: Annotation[] | null | undefined,
): string {
  const px = (v: number) => (v / 100) * imgW;
  const py = (v: number) => (v / 100) * imgH;
  const fontScale = imgW / FONT_REF_WIDTH;
  const anns = annotations ?? [];
  const parts: string[] = [];

  // 배경: 원본 스크린샷
  parts.push(`<image href="${imgDataUri}" x="0" y="0" width="${imgW}" height="${imgH}" preserveAspectRatio="none"/>`);

  // ── spotlight: 어두운 오버레이 + 구멍(주변 4개 띠) ──
  for (const a of anns) {
    if (a.type !== 'spotlight') continue;
    const sx1 = px(Math.min(a.x1, a.x2)), sx2 = px(Math.max(a.x1, a.x2));
    const sy1 = py(Math.min(a.y1, a.y2)), sy2 = py(Math.max(a.y1, a.y2));
    const band = (x: number, y: number, w: number, h: number) => {
      if (w > 0.5 && h > 0.5)
        parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000000" fill-opacity="0.35"/>`);
    };
    band(0, 0, imgW, sy1);
    band(0, sy2, imgW, imgH - sy2);
    band(0, sy1, sx1, sy2 - sy1);
    band(sx2, sy1, imgW - sx2, sy2 - sy1);
  }

  for (const a of anns) {
    if (a.type === 'spotlight' || a.type === 'crop') continue;
    const color = safeColor(a.color);
    const ax1 = px(a.x1), ay1 = py(a.y1), ax2 = px(a.x2), ay2 = py(a.y2);
    const minX = Math.min(ax1, ax2), minY = Math.min(ay1, ay2);
    const w = Math.abs(ax2 - ax1), h = Math.abs(ay2 - ay1);
    const sp = Math.max((a.strokeWidth / 100) * imgW, 1), o = sp / 2;

    if (a.type === 'mosaic') {
      parts.push(`<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#808080"/>`);
      continue;
    }
    if (a.type === 'highlight') {
      parts.push(`<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="${color}" fill-opacity="0.35" rx="1"/>`);
      continue;
    }
    if (a.type === 'rect' || a.type === 'recorderBox') {
      const isRec = a.type === 'recorderBox';
      const stroke = isRec ? '#EF4444' : color;
      const fill = isRec ? ' fill="#EF4444" fill-opacity="0.08"' : ' fill="none"';
      parts.push(`<rect x="${minX - o}" y="${minY - o}" width="${w + sp}" height="${h + sp}" stroke="${stroke}" stroke-width="${sp}"${fill} rx="1"/>`);
      continue;
    }
    if (a.type === 'roundedRect') {
      const rx = Math.min(w * 0.15, h * 0.15, 12) + o;
      parts.push(`<rect x="${minX - o}" y="${minY - o}" width="${w + sp}" height="${h + sp}" stroke="${color}" stroke-width="${sp}" fill="none" rx="${rx}"/>`);
      continue;
    }
    if (a.type === 'ellipse') {
      parts.push(`<ellipse cx="${(ax1 + ax2) / 2}" cy="${(ay1 + ay2) / 2}" rx="${w / 2 + o}" ry="${h / 2 + o}" stroke="${color}" stroke-width="${sp}" fill="none"/>`);
      continue;
    }
    if (a.type === 'line') {
      parts.push(`<line x1="${ax1}" y1="${ay1}" x2="${ax2}" y2="${ay2}" stroke="${color}" stroke-width="${sp}" stroke-linecap="round"/>`);
      continue;
    }
    if (a.type === 'arrow') {
      const dx = ax2 - ax1, dy = ay2 - ay1;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;
      const ux = dx / len, uy = dy / len;
      const headLen = Math.max(sp * 3, 10), headW = headLen * 0.55;
      const lx2 = ax2 - ux * headLen * 0.65, ly2 = ay2 - uy * headLen * 0.65;
      const qx = ax2 - ux * headLen + uy * headW, qy = ay2 - uy * headLen - ux * headW;
      const rx2 = ax2 - ux * headLen - uy * headW, ry2 = ay2 - uy * headLen + ux * headW;
      parts.push(`<line x1="${ax1}" y1="${ay1}" x2="${lx2}" y2="${ly2}" stroke="${color}" stroke-width="${sp}" stroke-linecap="round"/>`);
      parts.push(`<polygon points="${ax2},${ay2} ${qx},${qy} ${rx2},${ry2}" fill="${color}"/>`);
      continue;
    }
    if (a.type === 'marker') {
      const R = Math.max(10, imgW * 0.022);
      const num = esc(String(a.markerNumber ?? 1));
      parts.push(`<circle cx="${ax1}" cy="${ay1}" r="${R}" fill="${color}"/>`);
      parts.push(`<circle cx="${ax1}" cy="${ay1}" r="${R}" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-opacity="0.5"/>`);
      parts.push(`<text x="${ax1}" y="${ay1 + R * 0.38}" fill="#FFFFFF" font-size="${R * 1.1}" font-weight="700" font-family="Noto Sans KR" text-anchor="middle">${num}</text>`);
      continue;
    }
    if (a.type === 'text' && a.text) {
      const fSize = (a.fontSize ?? 16) * fontScale;
      const bold = a.fontBold ?? false;
      const bg = a.hasBg !== false;
      const lines = a.text.split('\n');
      const padX = 12, padY = 8, lineH = fSize * 1.4;
      const boxW = estimateTextW(a.text, fSize) + 2 * padX;
      const boxH = lines.length * lineH + 2 * padY;
      const cx = (ax1 + ax2) / 2, boxX = cx - boxW / 2;
      if (bg) {
        parts.push(`<rect x="${boxX}" y="${minY}" width="${boxW}" height="${boxH}" fill="#0A0A0F" fill-opacity="0.92" stroke="#000000" stroke-opacity="0.65" stroke-width="1.5" rx="6"/>`);
      }
      lines.forEach((line, i) => {
        const baseline = minY + padY + i * lineH + fSize * 0.8;
        parts.push(`<text x="${cx}" y="${baseline}" fill="${color}" font-size="${fSize}" font-weight="${bold ? 700 : 400}" font-family="Noto Sans KR" text-anchor="middle">${esc(line)}</text>`);
      });
      continue;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${imgW}" height="${imgH}" viewBox="0 0 ${imgW} ${imgH}">${parts.join('')}</svg>`;
}
