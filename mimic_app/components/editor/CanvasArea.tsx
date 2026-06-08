'use client';

import { useState, useRef } from 'react';
import { Monitor, Smartphone, Tablet, ChevronDown, Minus, Plus } from 'lucide-react';
import { MarkerMenu } from './MarkerMenu';

type DeviceType = 'desktop' | 'tablet' | 'mobile';

const DEVICE_OPTIONS: { type: DeviceType; label: string; size: string; Icon: typeof Monitor }[] = [
  { type: 'desktop', label: '데스크톱', size: '1920×1080', Icon: Monitor },
  { type: 'tablet', label: '태블릿', size: '768×1024', Icon: Tablet },
  { type: 'mobile', label: '모바일', size: '375×812', Icon: Smartphone },
];

interface Annotation {
  id: string;
  hlStyle: React.CSSProperties;
  captionStyle: React.CSSProperties;
  captionText: string;
  arrowPath: string;
  arrowViewBox: string;
  arrowStyle: React.CSSProperties;
  isActive?: boolean;
}

interface CanvasAreaProps {
  slideTitle: string;
  highlightCount: number;
  annotations: Annotation[];
  screenshotUrl?: string | null;
}

export function CanvasArea({ slideTitle, highlightCount, annotations, screenshotUrl }: CanvasAreaProps) {
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);

  const currentDevice = DEVICE_OPTIONS.find(d => d.type === device)!;

  return (
    <section
      style={{
        gridColumn: '2',
        gridRow: '2',
        background: '#FAFAFA',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        position: 'relative',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          background: 'white',
          borderBottom: '1px solid #F3F4F6',
          flexShrink: 0,
          flexWrap: 'nowrap',
        }}
      >
        <span style={{ fontSize: '12px', color: '#4B5563', fontWeight: 500, whiteSpace: 'nowrap' }}>
          {slideTitle}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 9px',
            borderRadius: '999px',
            background: 'rgba(245,158,11,0.14)',
            color: '#B45309',
            fontSize: '11px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          하이라이트 {highlightCount}
        </span>

        {/* Device chip */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setDeviceOpen(v => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'linear-gradient(135deg, #e0e7ff 0%, #F5F3FF 100%)',
              border: '1px solid rgba(55,48,163,0.20)',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 500,
              color: '#3730a3',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            <currentDevice.Icon size={13} color="#3730a3" />
            <span>{currentDevice.label} · {currentDevice.size}</span>
            <ChevronDown size={10} />
          </button>

          {/* Device switcher popover */}
          {deviceOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 20 }}
                onClick={() => setDeviceOpen(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: '6px',
                  background: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px',
                  padding: '8px',
                  boxShadow: '0 16px 40px rgba(17,24,39,0.15)',
                  zIndex: 30,
                  minWidth: '220px',
                }}
              >
                {DEVICE_OPTIONS.map(opt => (
                  <div
                    key={opt.type}
                    onClick={() => { setDevice(opt.type); setDeviceOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      color: opt.type === device ? '#3730a3' : '#4B5563',
                      fontWeight: opt.type === device ? 500 : 400,
                      background: opt.type === device ? '#e0e7ff' : 'transparent',
                      transition: 'background 0.18s ease',
                    }}
                    onMouseEnter={e => { if (opt.type !== device) e.currentTarget.style.background = '#F9FAFB'; }}
                    onMouseLeave={e => { if (opt.type !== device) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <opt.Icon size={14} />
                    {opt.label}
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '10.5px',
                        color: '#9CA3AF',
                        fontFamily: 'ui-monospace, monospace',
                      }}
                    >
                      {opt.size}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <span
          style={{
            marginLeft: 'auto',
            fontSize: '11px',
            color: '#6B7280',
            whiteSpace: 'nowrap',
          }}
        >
          빈 영역 클릭 → 하이라이트 추가 · 드래그 → 위치/크기 · 클릭 → 메뉴
        </span>

        {/* Zoom */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            background: '#FAFAFA',
            borderRadius: '6px',
            fontSize: '11.5px',
            color: '#4B5563',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          <button
            onClick={() => setZoom(z => Math.max(50, z - 10))}
            style={{ width: '22px', height: '22px', display: 'grid', placeItems: 'center', borderRadius: '4px', cursor: 'pointer' }}
          >
            <Minus size={11} />
          </button>
          {zoom}%
          <button
            onClick={() => setZoom(z => Math.min(200, z + 10))}
            style={{ width: '22px', height: '22px', display: 'grid', placeItems: 'center', borderRadius: '4px', cursor: 'pointer' }}
          >
            <Plus size={11} />
          </button>
        </span>
      </div>

      {/* Canvas surface */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 28px',
          overflow: 'hidden',
        }}
        onClick={() => setMenuAnchor(null)}
      >
        <CanvasContent
          device={device}
          zoom={zoom}
          annotations={annotations}
          screenshotUrl={screenshotUrl}
          onOpenMenu={pos => setMenuAnchor(pos)}
        />
      </div>

      {/* Marker context menu */}
      {menuAnchor && (
        <MarkerMenu
          style={{ position: 'absolute', top: menuAnchor.top, left: menuAnchor.left, zIndex: 30 }}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </section>
  );
}

/* ── Inner canvas (mock screenshot + annotations) ── */
function CanvasContent({
  device,
  zoom,
  annotations,
  screenshotUrl,
  onOpenMenu,
}: {
  device: DeviceType;
  zoom: number;
  annotations: Annotation[];
  screenshotUrl?: string | null;
  onOpenMenu: (pos: { top: number; left: number }) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleHlClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    onOpenMenu({
      top: e.clientY - rect.top + 8,
      left: e.clientX - rect.left,
    });
  };

  const canvasStyle: React.CSSProperties =
    device === 'desktop'
      ? {
          width: '100%',
          maxWidth: '880px',
          aspectRatio: '16 / 9',
          background: 'white',
          borderRadius: '10px',
          boxShadow: '0 12px 32px rgba(17,24,39,0.10), 0 2px 6px rgba(17,24,39,0.04)',
          position: 'relative',
          overflow: 'hidden',
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'center center',
        }
      : device === 'mobile'
      ? {
          height: '100%',
          maxHeight: '540px',
          aspectRatio: '9 / 19.5',
          borderRadius: '36px',
          background: '#0A0A0F',
          padding: '9px',
          boxShadow:
            '0 24px 60px rgba(17,24,39,0.30), 0 0 0 1.5px #1F2937, inset 0 0 0 1.5px #2D3748',
          position: 'relative',
          overflow: 'hidden',
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'center center',
        }
      : {
          height: '100%',
          maxHeight: '560px',
          aspectRatio: '3 / 4',
          borderRadius: '22px',
          background: '#1F2937',
          padding: '14px',
          boxShadow: '0 24px 60px rgba(17,24,39,0.25), 0 0 0 1.5px #111827',
          position: 'relative',
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'center center',
        };

  const innerStyle: React.CSSProperties =
    device === 'desktop'
      ? { width: '100%', height: '100%', position: 'relative' }
      : {
          width: '100%',
          height: '100%',
          borderRadius: device === 'mobile' ? '28px' : '12px',
          overflow: 'hidden',
          background: 'white',
          position: 'relative',
        };

  return (
    <div ref={canvasRef} style={canvasStyle}>
      <div style={innerStyle}>
        {/* Screenshot or placeholder */}
        {screenshotUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={screenshotUrl} alt="screenshot" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <MockScreenshot device={device} />
        }

        {/* Spotlight SVG overlay */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 4 }}
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <defs>
            <mask id="annotMask">
              <rect width="100" height="100" fill="white" />
              <rect x="2" y="14" width="14" height="6" rx="0.4" fill="black" />
              <rect x="22" y="68" width="22" height="11" rx="0.4" fill="black" />
              <rect x="62" y="32" width="32" height="8" rx="0.4" fill="black" />
            </mask>
            <marker
              id="annotArrowHead"
              viewBox="0 0 10 10"
              markerWidth="6"
              markerHeight="6"
              refX="9"
              refY="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 Z" fill="#F59E0B" />
            </marker>
          </defs>
          <rect
            width="100"
            height="100"
            fill="rgba(10,10,15,0.50)"
            mask="url(#annotMask)"
          />
        </svg>

        {/* Annotations */}
        {annotations.map(a => (
          <div key={a.id}>
            {/* Highlight border */}
            <div
              onClick={handleHlClick}
              style={{
                position: 'absolute',
                border: '3px solid #F59E0B',
                borderRadius: '6px',
                background: 'transparent',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.4) inset, 0 0 16px rgba(245,158,11,0.45)',
                pointerEvents: 'auto',
                cursor: 'pointer',
                zIndex: 6,
                ...(a.isActive
                  ? { animation: 'hl-pulse 1.6s ease-in-out infinite' }
                  : {}),
                ...a.hlStyle,
              }}
            />
            {/* Caption */}
            <div
              style={{
                position: 'absolute',
                background: '#0A0A0F',
                color: 'white',
                padding: '7px 14px',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: 500,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
                letterSpacing: '-0.005em',
                pointerEvents: 'none',
                zIndex: 6,
                ...a.captionStyle,
              }}
            >
              {a.captionText}
            </div>
            {/* Arrow */}
            <svg
              style={{
                position: 'absolute',
                overflow: 'visible',
                pointerEvents: 'none',
                zIndex: 6,
                ...a.arrowStyle,
              }}
              viewBox={a.arrowViewBox}
              aria-hidden="true"
            >
              <path
                d={a.arrowPath}
                stroke="#F59E0B"
                strokeWidth="2.4"
                fill="none"
                strokeLinecap="round"
                markerEnd="url(#annotArrowHead)"
              />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Mock screenshot placeholder ── */
function MockScreenshot({ device }: { device: DeviceType }) {
  const isMobile = device === 'mobile';
  return (
    <div style={{ width: '100%', height: '100%', background: 'white', position: 'relative' }}>
      {/* Browser top bar */}
      <div
        style={{
          height: isMobile ? '38px' : '32px',
          background: '#F3F4F6',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 10px',
        }}
      >
        {!isMobile && (
          <>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D1D5DB', display: 'inline-block' }} />
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D1D5DB', display: 'inline-block' }} />
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D1D5DB', display: 'inline-block' }} />
            <span style={{ marginLeft: '10px', width: '60%', height: '12px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '4px', display: 'inline-block' }} />
          </>
        )}
      </div>

      {/* Main layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '140px 1fr',
          height: `calc(100% - ${isMobile ? 38 : 32}px)`,
        }}
      >
        {/* Sidebar */}
        {!isMobile && (
          <div style={{ background: '#F9FAFB', borderRight: '1px solid #E5E7EB', padding: '14px 12px' }}>
            {[{ w: '80%', active: false }, { w: '60%', active: false }, { w: '70%', active: true }, { w: '80%', active: false }, { w: '60%', active: false }, { w: '80%', active: false }].map((r, i) => (
              <div key={i} style={{ height: '10px', background: r.active ? '#3730a3' : '#E5E7EB', borderRadius: '4px', marginBottom: '7px', width: r.w }} />
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{ padding: isMobile ? '24px 18px 60px' : '18px 22px' }}>
          <div style={{ height: '16px', width: '50%', background: '#1F2937', borderRadius: '5px', marginBottom: '14px' }} />
          <div style={{ height: '12px', background: '#E5E7EB', borderRadius: '4px', marginBottom: '8px', width: '70%' }} />
          <div style={{ height: '12px', background: '#E5E7EB', borderRadius: '4px', marginBottom: '8px', width: '90%' }} />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
              gap: '10px',
              margin: '14px 0',
            }}
          >
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: isMobile ? '42px' : '64px', border: '1px solid #E5E7EB', borderRadius: '6px', background: 'white' }} />
            ))}
          </div>
          <div style={{ height: '12px', background: '#E5E7EB', borderRadius: '4px', marginBottom: '8px', width: '70%' }} />
          <div style={{ marginTop: '16px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 14px',
                background: '#3730a3',
                color: 'white',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            >
              Configure provider
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
