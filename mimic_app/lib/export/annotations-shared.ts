// 서버사이드 내보내기(PDF/PPTX)에서 어노테이션을 그릴 때 쓰는 공통 헬퍼.
// 뷰어(components/editor/AnnotationPreview.tsx)와 동일한 좌표/크기 규칙을 재현한다.
// 어노테이션 좌표(x1,y1,x2,y2)·strokeWidth는 모두 "이미지 대비 0~100%" 단위다.
//
// ⚠️ ImageAnnotationEditor.tsx('use client')의 estimateTextW/FONT_REF_WIDTH를
//    직접 import하면 클라이언트 번들이 서버 라우트로 끌려오므로, 여기에 동일 규칙을 복제한다.

// 서버 내보내기 전용 어노테이션 타입 (클라이언트 컴포넌트 ImageAnnotationEditor의 Annotation과
// 구조적으로 호환되는 부분집합). 'use client' 컴포넌트를 서버 라우트로 import하지 않기 위해 분리.
export interface ExportAnnotation {
  type: 'arrow' | 'line' | 'rect' | 'roundedRect' | 'ellipse' | 'text' | 'highlight' | 'mosaic' | 'marker' | 'spotlight' | 'recorderBox' | 'crop';
  x1: number; y1: number; x2: number; y2: number; // 0~100 % of image
  color: string;
  strokeWidth: number;
  text?: string;
  fontSize?: number;
  fontBold?: boolean;
  markerNumber?: number;
  hasBg?: boolean;
}

// 텍스트 폰트 크기 기준 너비 — 표시 폭을 이 값으로 나눈 비율로 fontSize 보정(편집기↔뷰어 일치)
export const FONT_REF_WIDTH = 1100;

// 가장 긴 줄의 텍스트 너비 추정 (뷰어 estimateTextW와 동일). CJK/전각은 넓게.
export function estimateTextW(text: string, fSize: number): number {
  let max = 0;
  for (const line of text.split('\n')) {
    let cw = 0;
    for (const ch of line) cw += /[가-힣　-鿿＀-￯]/.test(ch) ? fSize * 0.98 : fSize * 0.56;
    if (cw > max) max = cw;
  }
  return max;
}

// hex(#RGB/#RRGGBB)·rgb()·rgba() 문자열 → {r,g,b} (0~1). 파싱 실패 시 빨강.
export function parseColor(c: string | undefined | null): { r: number; g: number; b: number } {
  const fallback = { r: 0.937, g: 0.267, b: 0.267 };
  if (!c || typeof c !== 'string') return fallback;
  const s = c.trim();
  const hex = s.replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16) / 255,
      g: parseInt(hex[1] + hex[1], 16) / 255,
      b: parseInt(hex[2] + hex[2], 16) / 255,
    };
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
    };
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map(p => parseFloat(p.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every(n => !Number.isNaN(n))) {
      return { r: parts[0] / 255, g: parts[1] / 255, b: parts[2] / 255 };
    }
  }
  return fallback;
}

// hex/rgb 문자열 → 6자리 hex (pptxgenjs 색상 인자용, '#' 없이). 실패 시 빨강.
export function toHex6(c: string | undefined | null): string {
  const { r, g, b } = parseColor(c);
  const h = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

// PNG/JPEG 헤더에서 자연 크기 추출 (이미지 비율 유지·레터박스 정렬용). 실패 시 null.
export function getImageDims(buf: Buffer): { w: number; h: number } | null {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
      }
      off += 2 + buf.readUInt16BE(off + 2);
    }
  }
  return null;
}
