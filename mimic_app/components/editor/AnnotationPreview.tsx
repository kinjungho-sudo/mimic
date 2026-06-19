'use client';

import { useId, useRef, useState, useEffect } from 'react';
import type { Annotation } from './ImageAnnotationEditor';
import { FONT_REF_WIDTH, estimateTextW } from './ImageAnnotationEditor';

// sizeScale: 이미지가 크롭/줌으로 확대 표시될 때 어노테이션이 같이 커지지 않도록 선·글씨 크기를 역보정(크롭=cropW, 줌=1/zoom). 위치는 영향 없음.
export function AnnotationPreview({ annotations, imageUrl, sizeScale = 1 }: { annotations: Annotation[]; imageUrl: string; sizeScale?: number }) {
  const uid = useId().replace(/:/g, '');
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  // 부모 img의 실제 렌더 크기 측정 — load 완료 후 + ResizeObserver
  useEffect(() => {
    const svg = imgRef.current as unknown as SVGSVGElement | null;
    const container = svg?.parentElement;
    if (!container) return;
    const img = container.querySelector('img') as HTMLImageElement | null;
    if (!img) return;

    const update = () => {
      const r = img.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setImgSize({ w: r.width, h: r.height });
    };

    // 이미지가 이미 로드된 경우 즉시 측정
    if (img.complete && img.naturalWidth > 0) {
      update();
    } else {
      img.addEventListener('load', update, { once: true });
    }

    const ro = new ResizeObserver(update);
    ro.observe(img);
    return () => {
      img.removeEventListener('load', update);
      ro.disconnect();
    };
  }, [imageUrl]); // imageUrl 바뀌면 재측정

  const filterId = `mosaic-blur-${uid}`;
  const spotlightMaskId = `spotlight-mask-${uid}`;
  const spotlights = annotations.filter(a => a.type === 'spotlight');

  const { w: imgW, h: imgH } = imgSize ?? { w: 1, h: 1 };
  // 편집기와 동일한 폰트 스케일 — 표시폭 ÷ 기준폭(FONT_REF_WIDTH). 크롭/줌 확대분은 sizeScale로 역보정.
  const fontScale = imgW * sizeScale / FONT_REF_WIDTH;

  // % 좌표 → 픽셀 좌표
  const px = (v: number) => v / 100 * imgW;
  const py = (v: number) => v / 100 * imgH;

  return (
    <svg
      ref={imgRef as React.RefObject<SVGSVGElement>}
      viewBox={imgSize ? `0 0 ${imgW} ${imgH}` : '0 0 1 1'}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
    >
      {imgSize && (<>
      <defs>
        <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="8" result="blurred" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        {spotlights.length > 0 && (
          <mask id={spotlightMaskId}>
            <rect x="0" y="0" width={imgW} height={imgH} fill="white" />
            {spotlights.map(a => {
              const minX = Math.min(a.x1, a.x2), minY = Math.min(a.y1, a.y2);
              const w = Math.abs(a.x2 - a.x1), h = Math.abs(a.y2 - a.y1);
              return <rect key={a.id} x={px(minX)} y={py(minY)} width={px(w)} height={py(h)} fill="black" />;
            })}
          </mask>
        )}
      </defs>

      {spotlights.length > 0 && (
        <rect x="0" y="0" width={imgW} height={imgH} fill="rgba(0,0,0,0.35)" mask={`url(#${spotlightMaskId})`} />
      )}

      {annotations.map(a => {
        const { type, x1, y1, x2, y2, color } = a;
        // strokeWidth는 이미지 너비의 % → 픽셀로 변환 (크롭/줌 확대분 역보정)
        const strokePx = (a.strokeWidth / 100) * imgW * sizeScale;
        const ax1 = px(x1), ay1 = py(y1), ax2 = px(x2), ay2 = py(y2);
        const minX = Math.min(ax1, ax2), minY = Math.min(ay1, ay2);
        const w = Math.abs(ax2 - ax1), h = Math.abs(ay2 - ay1);

        if (type === 'spotlight' || type === 'crop') return null;

        if (type === 'mosaic') {
          const clipId = `mosaic-clip-${uid}-${a.id}`;
          return (
            <g key={a.id}>
              <defs>
                <clipPath id={clipId}><rect x={minX} y={minY} width={w} height={h} /></clipPath>
              </defs>
              <image href={imageUrl} x="0" y="0" width={imgW} height={imgH}
                preserveAspectRatio="none" filter={`url(#${filterId})`} clipPath={`url(#${clipId})`} />
            </g>
          );
        }

        if (type === 'highlight') return (
          <rect key={a.id} x={minX} y={minY} width={w} height={h} fill={color} opacity={0.35} rx={1} />
        );

        if (type === 'rect' || type === 'recorderBox') {
          const sp = Math.max(strokePx, 1), o = sp / 2;
          // 테두리를 요소 바깥쪽에 — 안쪽 콘텐츠/텍스트를 덮지 않도록
          return (
            <rect key={a.id} x={minX - o} y={minY - o} width={w + sp} height={h + sp}
              stroke={type === 'recorderBox' ? '#EF4444' : color}
              strokeWidth={sp} fill={type === 'recorderBox' ? 'rgba(239,68,68,0.08)' : 'none'} rx={1} />
          );
        }

        if (type === 'roundedRect') {
          const sp = Math.max(strokePx, 1), o = sp / 2;
          const rx = Math.min(w * 0.15, h * 0.15, 12) + o;
          return (
            <rect key={a.id} x={minX - o} y={minY - o} width={w + sp} height={h + sp}
              stroke={color} strokeWidth={sp} fill="none" rx={rx} />
          );
        }

        if (type === 'ellipse') {
          const sp = Math.max(strokePx, 1), o = sp / 2;
          return (
            <ellipse key={a.id}
              cx={(ax1 + ax2) / 2} cy={(ay1 + ay2) / 2}
              rx={w / 2 + o} ry={h / 2 + o}
              stroke={color} strokeWidth={sp} fill="none" />
          );
        }

        if (type === 'line') {
          return (
            <line key={a.id} x1={ax1} y1={ay1} x2={ax2} y2={ay2}
              stroke={color} strokeWidth={Math.max(strokePx, 1)} strokeLinecap="round" />
          );
        }

        if (type === 'arrow') {
          const dx = ax2 - ax1, dy = ay2 - ay1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1) return null;
          const ux = dx / len, uy = dy / len;
          const headLen = Math.max(strokePx * 2, 8);
          const headW = headLen * 0.55;
          const lx2 = ax2 - ux * headLen * 0.65;
          const ly2 = ay2 - uy * headLen * 0.65;
          const qx = ax2 - ux * headLen + uy * headW, qy = ay2 - uy * headLen - ux * headW;
          const rx2 = ax2 - ux * headLen - uy * headW, ry2 = ay2 - uy * headLen + ux * headW;
          return (
            <g key={a.id}>
              <line x1={ax1} y1={ay1} x2={lx2} y2={ly2}
                stroke={color} strokeWidth={Math.max(strokePx, 1)} strokeLinecap="round" />
              <polygon points={`${ax2},${ay2} ${qx},${qy} ${rx2},${ry2}`} fill={color} />
            </g>
          );
        }

        if (type === 'marker') {
          const R = Math.max(10, imgW * sizeScale * 0.022);
          return (
            <g key={a.id}>
              <circle cx={ax1} cy={ay1} r={R} fill={color} />
              <circle cx={ax1} cy={ay1} r={R} fill="none" stroke="white" strokeWidth={1.5} opacity={0.5} />
              <text x={ax1} y={ay1} fill="white" fontSize={R * 1.1} fontWeight="700"
                textAnchor="middle" dominantBaseline="central"
              >{a.markerNumber ?? 1}</text>
            </g>
          );
        }

        if (type === 'text' && a.text) {
          // 편집기와 100% 동일하게 렌더 — 그림 영역(x1~x2) 중심 기준, fontSize는 fontScale 보정
          const fSize = (a.fontSize ?? 16) * fontScale;
          const bold = a.fontBold ?? false;
          const bColor = a.borderColor ?? 'rgba(0,0,0,0.65)';
          const bg = a.hasBg !== false;
          const lines = a.text.split('\n');
          const padX = 12, padY = 8;
          const lineH = fSize * 1.4;
          // 박스 너비: 그림 영역 너비와 텍스트 너비 중 큰 쪽. 중심은 그림 영역의 가로 중심.
          const contentW = estimateTextW(a.text, fSize) + 2 * padX;
          const boxW = Math.max(w, contentW);
          const boxH = Math.max(h, lines.length * lineH + 2 * padY);
          const cx = (ax1 + ax2) / 2;  // 그림 영역 가로 중심
          const boxX = cx - boxW / 2;
          const bgFill = bg ? 'rgba(10,10,15,0.92)' : 'none';
          const strokeColor = bColor !== 'transparent' ? bColor : 'none';
          return (
            <g key={a.id}>
              {bg && (
                <rect x={boxX} y={minY} width={boxW} height={boxH}
                  fill={bgFill}
                  stroke={strokeColor}
                  strokeWidth={strokeColor !== 'none' ? 1.5 : 0}
                  rx={6}
                />
              )}
              {lines.map((line, i) => (
                <text key={i}
                  x={cx} y={minY + padY + i * lineH}
                  fill={color} fontSize={fSize} fontWeight={bold ? 700 : 400}
                  textAnchor="middle" dominantBaseline="text-before-edge"
                >{line}</text>
              ))}
            </g>
          );
        }

        return null;
      })}
      </>)}
    </svg>
  );
}
