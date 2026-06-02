'use client';

import { useId } from 'react';
import type { Annotation } from './ImageAnnotationEditor';

// strokeWidth는 이미지 너비의 % — SVG가 100%×100%이므로 viewBox 없이 %좌표를 직접 사용할 때
// 선 굵기는 이미지 너비에 비례한 실제 px로 변환해야 함.
// 하지만 SVG가 percentage 단위 좌표를 쓰므로 stroke를 % 단위로 표현.
// strokeWidth(% of imgW) × 1% = strokeWidth%  → 실제로는 strokeWidth 자체를 '%' 단위로 쓰면 됨.
// 예: strokeWidth=0.5 → stroke-width="0.5%"

export function AnnotationPreview({ annotations, imageUrl }: { annotations: Annotation[]; imageUrl: string }) {
  const uid = useId().replace(/:/g, '');
  const filterId = `mosaic-blur-${uid}`;
  const spotlightMaskId = `spotlight-mask-${uid}`;

  const spotlights = annotations.filter(a => a.type === 'spotlight');

  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
      <defs>
        <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        {spotlights.length > 0 && (
          <mask id={spotlightMaskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlights.map(a => {
              const minX = Math.min(a.x1, a.x2), minY = Math.min(a.y1, a.y2);
              const w = Math.abs(a.x2 - a.x1), h = Math.abs(a.y2 - a.y1);
              return <rect key={a.id} x={`${minX}%`} y={`${minY}%`} width={`${w}%`} height={`${h}%`} fill="black" />;
            })}
          </mask>
        )}
      </defs>

      {spotlights.length > 0 && (
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.62)" mask={`url(#${spotlightMaskId})`} />
      )}

      {annotations.map(a => {
        const { type, x1, y1, x2, y2, color } = a;
        // strokeWidth는 이미지 너비의 % → SVG stroke-width도 '%' 단위로 사용
        const sw = `${a.strokeWidth}%`;
        const minX = Math.min(x1, x2), minY = Math.min(y1, y2);
        const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);

        if (type === 'spotlight' || type === 'crop') return null;

        if (type === 'mosaic') {
          const clipId = `mosaic-clip-${uid}-${a.id}`;
          return (
            <g key={a.id}>
              <defs>
                <clipPath id={clipId}><rect x={`${minX}%`} y={`${minY}%`} width={`${w}%`} height={`${h}%`} /></clipPath>
              </defs>
              <image href={imageUrl} x="0" y="0" width="100%" height="100%"
                preserveAspectRatio="none" filter={`url(#${filterId})`} clipPath={`url(#${clipId})`} />
            </g>
          );
        }

        if (type === 'highlight') return (
          <rect key={a.id} x={`${minX}%`} y={`${minY}%`} width={`${w}%`} height={`${h}%`} fill={color} opacity={0.35} rx="0.5%" />
        );

        if (type === 'rect' || type === 'recorderBox') return (
          <rect key={a.id} x={`${minX}%`} y={`${minY}%`} width={`${w}%`} height={`${h}%`}
            stroke={type === 'recorderBox' ? '#EF4444' : color}
            strokeWidth={sw} fill={type === 'recorderBox' ? 'rgba(239,68,68,0.08)' : 'none'} rx="0.3%" />
        );

        if (type === 'ellipse') return (
          <ellipse key={a.id}
            cx={`${(x1+x2)/2}%`} cy={`${(y1+y2)/2}%`}
            rx={`${w/2}%`} ry={`${h/2}%`}
            stroke={color} strokeWidth={sw} fill="none" />
        );

        if (type === 'arrow') {
          // % 좌표 기반 화살표 — SVG viewBox 없이 % 좌표 사용
          // 벡터 계산은 % 단위 그대로 (SVG는 비율로 표현됨)
          const dx = x2 - x1, dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 0.5) return null;
          const ux = dx / len, uy = dy / len;
          // 화살촉 크기 — strokeWidth 비례, % 단위
          const headLen = a.strokeWidth * 4;
          const headW = headLen * 0.5;
          // 줄기 끝을 화살촉 안쪽으로 당김
          const lx2 = x2 - ux * headLen * 0.6;
          const ly2 = y2 - uy * headLen * 0.6;
          // 화살촉 삼각형 꼭짓점 (% 단위)
          const px = x2, py = y2;
          const qx = x2 - ux * headLen + uy * headW, qy = y2 - uy * headLen - ux * headW;
          const rx2 = x2 - ux * headLen - uy * headW, ry2 = y2 - uy * headLen + ux * headW;
          return (
            <g key={a.id}>
              <line
                x1={`${x1}%`} y1={`${y1}%`}
                x2={`${lx2}%`} y2={`${ly2}%`}
                stroke={color} strokeWidth={sw} strokeLinecap="round"
              />
              <polygon
                points={`${px}%,${py}% ${qx}%,${qy}% ${rx2}%,${ry2}%`}
                fill={color}
              />
            </g>
          );
        }

        if (type === 'text' && a.text) {
          // fontSize는 px 단위 — SVG에 px로 직접 넣으면 이미지 표시 크기에 관계없이 일정하게 렌더링됨
          // 뷰어에서도 에디터와 동일한 크기로 보여야 하므로 px 그대로 사용
          const fSize = a.fontSize ?? 16;
          const bold = a.fontBold ?? false;
          const bColor = a.borderColor;
          const lines = a.text.split('\n');
          const charW = fSize * (bold ? 0.65 : 0.58);
          const maxLineLen = Math.max(...lines.map(l => l.length));
          const textW = maxLineLen * charW;
          const textH = lines.length * fSize * 1.4;
          const padX = 8, padY = 4;
          return (
            <g key={a.id}>
              {/* 텍스트 박스 배경 */}
              <rect
                x={`${x1}%`} y={`${y1}%`}
                width={textW} height={textH + padY}
                transform={`translate(-${padX / 2}, -${padY / 2})`}
                fill="rgba(0,0,0,0.25)"
                stroke={bColor && bColor !== 'transparent' ? bColor : 'none'}
                strokeWidth={bColor && bColor !== 'transparent' ? 1.5 : 0}
                rx={2}
              />
              {lines.map((line, i) => (
                <text key={i}
                  x={`${x1}%`} y={`${y1}%`}
                  dy={i * fSize * 1.4}
                  fill={color}
                  fontSize={fSize}
                  fontWeight={bold ? 700 : 400}
                  dominantBaseline="text-before-edge"
                >{line}</text>
              ))}
            </g>
          );
        }

        if (type === 'marker') {
          // 마커 반지름도 % 단위로 — 이미지 너비의 약 2.2%
          const r = '2.2%';
          return (
            <g key={a.id}>
              <circle cx={`${x1}%`} cy={`${y1}%`} r={r} fill={color} />
              <text x={`${x1}%`} y={`${y1}%`} fill="white"
                fontSize="1.8%" fontWeight="700"
                textAnchor="middle" dominantBaseline="central"
              >{a.markerNumber ?? 1}</text>
            </g>
          );
        }

        return null;
      })}
    </svg>
  );
}
