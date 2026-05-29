'use client';

import { useId } from 'react';
import type { Annotation } from './ImageAnnotationEditor';

export function AnnotationPreview({ annotations, imageUrl }: { annotations: Annotation[]; imageUrl: string }) {
  // Unique per-instance ID prevents filter ID collisions when multiple steps
  // are rendered simultaneously (GuideViewer renders all steps at once)
  const uid = useId().replace(/:/g, '');
  const filterId = `mosaic-blur-${uid}`;

  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
      <defs>
        <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      {annotations.map(a => {
        const { type, x1, y1, x2, y2, color, strokeWidth } = a;
        const sw = strokeWidth * 0.12;
        const minX = Math.min(x1, x2), minY = Math.min(y1, y2);
        const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);

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
        if (type === 'rect') return (
          <rect key={a.id} x={`${minX}%`} y={`${minY}%`} width={`${w}%`} height={`${h}%`} stroke={color} strokeWidth={sw} fill="none" rx="0.5%" />
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
        return null;
      })}
    </svg>
  );
}
