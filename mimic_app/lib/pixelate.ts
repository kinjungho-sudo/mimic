// 파괴적 영역 픽셀화 — mimic_recorder background.js APPLY_BLUR 알고리즘을 그대로 포팅.
// 정규화 region(0~1)을 이미지 자연 픽셀로 환산 → BLOCK 단위 평균색으로 채움 → JPEG 재인코딩.
// 브라우저 전용(OffscreenCanvas/createImageBitmap). 호출 측은 'use client'.

export interface BlurRegion {
  x: number; // 0~1 (이미지 너비 비율)
  y: number; // 0~1 (이미지 높이 비율)
  w: number; // 0~1
  h: number; // 0~1
}

const JPEG_QUALITY = 0.85;

/**
 * imageUrl을 받아 region 영역만 픽셀화한 JPEG Blob을 반환한다.
 * 레코더와 동일하게 정규화 좌표를 자연 픽셀로 환산 후 블록 평균을 적용한다.
 */
export async function pixelateRegion(imageUrl: string, region: BlurRegion): Promise<Blob> {
  // 직접 fetch → 바이트 확보 (Supabase public 버킷은 ACAO:* → CORS 통과)
  const res = await fetch(imageUrl, { mode: 'cors' });
  if (!res.ok) throw new Error(`이미지 로드 실패 (${res.status})`);
  const srcBlob = await res.blob();

  const bmp = await createImageBitmap(srcBlob);
  const iw = bmp.width, ih = bmp.height;

  const rx = Math.round(region.x * iw);
  const ry = Math.round(region.y * ih);
  const rw = Math.round(region.w * iw);
  const rh = Math.round(region.h * ih);

  if (rw < 2 || rh < 2) { bmp.close(); throw new Error('영역이 너무 작습니다'); }

  const canvas = new OffscreenCanvas(iw, ih);
  const ctx = canvas.getContext('2d');
  if (!ctx) { bmp.close(); throw new Error('캔버스 컨텍스트 생성 실패'); }
  ctx.drawImage(bmp, 0, 0);
  bmp.close();

  const BLOCK = Math.max(8, Math.round(Math.min(rw, rh) / 10));
  const imgData = ctx.getImageData(rx, ry, rw, rh);
  const d = imgData.data;
  for (let by = 0; by < rh; by += BLOCK) {
    for (let bx = 0; bx < rw; bx += BLOCK) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let dy = 0; dy < BLOCK && by + dy < rh; dy++) {
        for (let dx = 0; dx < BLOCK && bx + dx < rw; dx++) {
          const i = ((by + dy) * rw + (bx + dx)) * 4;
          r += d[i]; g += d[i + 1]; b += d[i + 2]; count++;
        }
      }
      r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
      for (let dy = 0; dy < BLOCK && by + dy < rh; dy++) {
        for (let dx = 0; dx < BLOCK && bx + dx < rw; dx++) {
          const i = ((by + dy) * rw + (bx + dx)) * 4;
          d[i] = r; d[i + 1] = g; d[i + 2] = b;
        }
      }
    }
  }
  ctx.putImageData(imgData, rx, ry);

  return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
}
