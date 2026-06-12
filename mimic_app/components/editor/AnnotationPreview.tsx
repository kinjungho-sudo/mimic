'use client';

import { useId, useRef, useState, useEffect } from 'react';
import type { Annotation } from './ImageAnnotationEditor';

export function AnnotationPreview({ annotations, imageUrl }: { annotations: Annotation[]; imageUrl: string }) {
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
        <rect x="0" y="0" width={imgW} height={imgH} fill="rgba(0,0,0,0.52)" mask={`url(#${spotlightMaskId})`} />
      )}

      {annotations.map(a => {
        const { type, x1, y1, x2, y2, color } = a;
        // strokeWidth는 이미지 너비의 % → 픽셀로 변환
        const strokePx = (a.strokeWidth / 100) * imgW;
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

        if (type === 'rect' || type === 'recorderBox') return (
          <rect key={a.id} x={minX} y={minY} width={w} height={h}
            stroke={type === 'recorderBox' ? '#EF4444' : color}
            strokeWidth={Math.max(strokePx, 1)} fill={type === 'recorderBox' ? 'rgba(239,68,68,0.08)' : 'none'} rx={1} />
        );

        if (type === 'roundedRect') {
          const rx = Math.min(w * 0.15, h * 0.15, 12);
          return (
            <rect key={a.id} x={minX} y={minY} width={w} height={h}
              stroke={color} strokeWidth={Math.max(strokePx, 1)} fill="none" rx={rx} />
          );
        }

        if (type === 'ellipse') return (
          <ellipse key={a.id}
            cx={(ax1 + ax2) / 2} cy={(ay1 + ay2) / 2}
            rx={w / 2} ry={h / 2}
            stroke={color} strokeWidth={Math.max(strokePx, 1)} fill="none" />
        );

        if (type === 'arrow') {
          const dx = ax2 - ax1, dy = ay2 - ay1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1) return null;
          const ux = dx / len, uy = dy / len;
          const headLen = Math.max(strokePx * 4, 10);
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
          const R = Math.max(10, imgW * 0.022);
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
          const fSize = a.fontSize ?? 16;
          const bold = a.fontBold ?? false;
          const bColor = a.borderColor;
          const align = a.textAlign ?? 'left';
          const bg = a.hasBg !== false;
          const lines = a.text.split('\n');
          const padX = 8, padY = 5;
          // 글자 폭을 fontSize 기반으로 추정 (한글/영문 혼용 고려)
          const maxLineLen = Math.max(...lines.map(l => {
            // 한글은 영문보다 넓음
            return Array.from(l).reduce((sum, ch) => sum + (ch.charCodeAt(0) > 0x3000 ? 1.0 : 0.6), 0);
          }));
          const textPixelW = maxLineLen * fSize + padX * 2;
          // %→px 변환 없이 px 단위로 직접 배치 (viewBox 기반이므로 px 직접 사용)
          const boxW = Math.max(textPixelW, fSize * 3);
          const boxH = lines.length * fSize * 1.45 + padY * 2;
          const textX = align === 'left' ? minX + padX : align === 'center' ? minX + boxW / 2 : minX + boxW - padX;
          const anchor = align === 'left' ? 'start' : align === 'center' ? 'middle' : 'end';
          // 가독성: 편집기와 동일한 진한 배경 + 글자 외곽선(배경 밖으로 넘쳐도 읽힘)
          const bgFill = bg ? 'rgba(10,10,15,0.92)' : 'none';
          const strokeColor = bColor && bColor !== 'transparent' ? bColor : 'none';
          const hex = color.replace('#', '');
          const luma = 0.299 * (parseInt(hex.slice(0, 2), 16) || 0) + 0.587 * (parseInt(hex.slice(2, 4), 16) || 0) + 0.114 * (parseInt(hex.slice(4, 6), 16) || 0);
          const outline = luma > 160 ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)'; // 밝은 글자→어두운 외곽선, 어두운 글자→밝은 외곽선
          return (
            <g key={a.id}>
              {bg && (
                <rect x={minX} y={minY} width={boxW} height={boxH}
                  fill={bgFill}
                  stroke={strokeColor}
                  strokeWidth={strokeColor !== 'none' ? 1.5 : 0}
                  rx={5}
                />
              )}
              {lines.map((line, i) => (
                <text key={i}
                  x={textX} y={minY + padY + i * fSize * 1.45}
                  fill={color} fontSize={fSize} fontWeight={bold ? 700 : 400}
                  textAnchor={anchor} dominantBaseline="text-before-edge"
                  stroke={outline} strokeWidth={Math.max(1.5, fSize / 8)} strokeLinejoin="round"
                  style={{ paintOrder: 'stroke' }}
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
