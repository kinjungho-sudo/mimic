'use client';

import { useId } from 'react';
import type { Annotation } from './ImageAnnotationEditor';

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

      {/* Spotlight overlay */}
      {spotlights.length > 0 && (
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.62)" mask={`url(#${spotlightMaskId})`} />
      )}

      {annotations.map(a => {
        const { type, x1, y1, x2, y2, color, strokeWidth } = a;
        const sw = strokeWidth * 0.12;
        const minX = Math.min(x1, x2), minY = Math.min(y1, y2);
        const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);

        if (type === 'spotlight') return null; // handled above

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
          <rect key={a.id} x={`${minX}%`} y={`${minY}%`} width={`${w}%`} height={`${h}%`} fill={color} opacity={0.35} rx="2%" />
        );

        if (type === 'rect' || type === 'recorderBox') return (
          <rect key={a.id} x={`${minX}%`} y={`${minY}%`} width={`${w}%`} height={`${h}%`}
            stroke={type === 'recorderBox' ? '#EF4444' : color}
            strokeWidth={sw} fill={type === 'recorderBox' ? 'rgba(239,68,68,0.08)' : 'none'} rx="0.5%" />
        );

        if (type === 'ellipse') return (
          <ellipse key={a.id} cx={`${(x1+x2)/2}%`} cy={`${(y1+y2)/2}%`} rx={`${w/2}%`} ry={`${h/2}%`} stroke={color} strokeWidth={sw} fill="none" />
        );

        if (type === 'arrow') {
          const markerId = `arrow-${uid}-${a.id}`;
          return (
            <g key={a.id}>
              <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={color} /></marker></defs>
              <line x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke={color} strokeWidth={sw} markerEnd={`url(#${markerId})`} strokeLinecap="round" />
            </g>
          );
        }

        if (type === 'text' && a.text) return (
          <text key={a.id} x={`${x1}%`} y={`${y1}%`} fill={color} fontSize="1.8%" fontWeight="600" dominantBaseline="text-before-edge" stroke="rgba(0,0,0,0.5)" strokeWidth="0.3%" style={{ paintOrder: 'stroke' }}>{a.text}</text>
        );

        if (type === 'marker') {
          return (
            <g key={a.id}>
              <circle cx={`${x1}%`} cy={`${y1}%`} r="1.8%" fill={color} />
              <text x={`${x1}%`} y={`${y1}%`} fill="white" fontSize="1.6%" fontWeight="700"
                textAnchor="middle" dominantBaseline="central">{a.markerNumber ?? 1}</text>
            </g>
          );
        }

        if (type === 'crop') return (
          <rect key={a.id} x={`${minX}%`} y={`${minY}%`} width={`${w}%`} height={`${h}%`}
            fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.3%" strokeDasharray="1% 0.5%" />
        );

        return null;
      })}
    </svg>
  );
}
