// 이미지 확대 프레이밍(image_zoom/offset)이 어노테이션을 화면 밖으로 자르지 않도록 보정.
// 표시 변환은 transform: translate(ox*100%, oy*100%) scale(z) · transformOrigin center 기준.
//   → 이미지 정규좌표 c(0~1)가 화면 중앙에 오려면 offset = z * (0.5 - c).
//   → 확대 시 보이는 창은 c ± 1/(2z) 범위(이미지의 1/z 만큼만 보임).

export type Framing = { zoom: number; offsetX: number; offsetY: number };
export type Box = { minX: number; minY: number; maxX: number; maxY: number }; // 0~1 정규좌표

// x1/y1/x2/y2(0~100 pct) 어노테이션 목록 → 0~1 바운딩 박스
export function annotationsBox(
  annotations?: { x1: number; y1: number; x2: number; y2: number }[] | null,
): Box | null {
  if (!annotations?.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const a of annotations) {
    minX = Math.min(minX, a.x1, a.x2); maxX = Math.max(maxX, a.x1, a.x2);
    minY = Math.min(minY, a.y1, a.y2); maxY = Math.max(maxY, a.y1, a.y2);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX: minX / 100, minY: minY / 100, maxX: maxX / 100, maxY: maxY / 100 };
}

// 확대 프레이밍 f를 보정해, box(어노테이션 영역)가 확대 창 안에 모두 들어오게 한다.
// 필요하면 배율을 낮추고(box가 창보다 크면), 중심을 box 쪽으로 당긴다. 배율은 절대 키우지 않는다.
export function fitFramingToBox(f: Framing, box: Box | null, pad = 0.02): Framing {
  if (!box || f.zoom <= 1) return f;
  const minX = Math.max(0, box.minX - pad), maxX = Math.min(1, box.maxX + pad);
  const minY = Math.max(0, box.minY - pad), maxY = Math.min(1, box.maxY + pad);
  const bw = Math.max(0, maxX - minX), bh = Math.max(0, maxY - minY);

  // box가 창(1/z)보다 크면 들어오도록 배율을 낮춘다(키우진 않음).
  let z = f.zoom;
  if (bw > 0) z = Math.min(z, 1 / bw);
  if (bh > 0) z = Math.min(z, 1 / bh);
  z = Math.max(1, z);
  if (z <= 1.001) return { zoom: 1, offsetX: 0, offsetY: 0 };

  const h = 1 / (2 * z); // 창 반폭
  // 창 [c-h, c+h]가 [lo0, hi0]를 포함하고 이미지([h,1-h]) 안에 있도록 중심 c 클램프
  const fitCenter = (cOrig: number, lo0: number, hi0: number) => {
    const lo = Math.max(h, hi0 - h);
    const hi = Math.min(1 - h, lo0 + h);
    if (lo > hi) return (lo0 + hi0) / 2; // 안전망(이론상 도달 안 함)
    return Math.min(hi, Math.max(lo, cOrig));
  };
  const cxOrig = 0.5 - f.offsetX / f.zoom;
  const cyOrig = 0.5 - f.offsetY / f.zoom;
  const cx = fitCenter(cxOrig, minX, maxX);
  const cy = fitCenter(cyOrig, minY, maxY);

  return {
    zoom: Math.round(z * 1000) / 1000,
    offsetX: Math.round(z * (0.5 - cx) * 1000) / 1000,
    offsetY: Math.round(z * (0.5 - cy) * 1000) / 1000,
  };
}
