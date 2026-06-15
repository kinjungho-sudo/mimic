'use client';

import { useState, useEffect, useRef } from 'react';

// 따라하기 시각 레이어(이미지 + 핫스팟 인디케이터 + AI 캐릭터 말풍선).
// 플레이어와 스튜디오가 동일 컴포넌트를 써서 "보는 사람이 보는 화면"이 100% 일치하도록 한다.

export const CORNER = 1.5; // 좌상단 0,0 가짜 핫스팟(이동/캡처 단계) 판정 임계
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function Mascot({ size = 40 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(79,70,229,0.4)' }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="7" width="16" height="12" rx="4" fill="white" />
        <circle cx="9.5" cy="13" r="1.7" fill="#4f46e5" />
        <circle cx="14.5" cy="13" r="1.7" fill="#4f46e5" />
        <path d="M9.5 16.2c1.6 1 3.4 1 5 0" stroke="#4f46e5" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="12" y1="3.5" x2="12" y2="7" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="12" cy="3" r="1.3" fill="white" />
      </svg>
    </div>
  );
}

interface Props {
  screenshotUrl?: string | null;
  hotspotX: number | null;          // 0~100 (%) — none/이동단계는 null
  hotspotY: number | null;
  kind: 'click' | 'type';
  typeText?: string | null;         // type 인디케이터에 표시/입력될 텍스트
  animateType?: boolean;            // true=뷰어(자동 타이핑 애니메이션), false/미설정=스튜디오(정적 표시)
  title: string;
  body?: string;
  minimized?: boolean;
  showAudioBadge?: boolean;
  nudge?: boolean;
  imageCursor?: string;             // 'pointer'(플레이어) | 'crosshair'(스튜디오)
  imgMaxHeight?: string;
  onImageClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMascotClick?: (e: React.MouseEvent) => void;
  onBubbleClick?: (e: React.MouseEvent) => void;   // 플레이어: 접기
  wrapRef?: React.RefObject<HTMLDivElement>; // 스튜디오 드래그 측정용
  children?: React.ReactNode;       // 이미지 위 추가 오버레이(스튜디오 드래그 핸들 등)
}

export function FollowStage({
  screenshotUrl, hotspotX: hx, hotspotY: hy, kind, typeText, animateType = false, title, body,
  minimized = false, showAudioBadge = false, nudge = false,
  imageCursor = 'default', imgMaxHeight = 'calc(100vh - 150px)',
  onImageClick, onMascotClick, onBubbleClick, wrapRef, children,
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const ref = wrapRef ?? innerRef;
  const [box, setBox] = useState({ w: 0, h: 0 });

  // 텍스트 인디케이터 자동 타이핑 — 뷰어에서만(animateType). 스튜디오는 입력값 그대로 표시
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    if (!animateType || kind !== 'type' || !typeText) { setTyped(0); return; }
    setTyped(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(i);
      if (i >= typeText.length) clearInterval(id);
    }, 42);
    return () => clearInterval(id);
  }, [animateType, kind, typeText]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => { const r = el.getBoundingClientRect(); setBox({ w: r.width, h: r.height }); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, screenshotUrl]);

  const hasHotspot = hx != null && hy != null && !(hx < CORNER && hy < CORNER);
  const isType = kind === 'type';
  const typeStr = typeText ?? '';
  const hasTypeText = typeStr.trim().length > 0;
  const shownType = animateType ? typeStr.slice(0, typed) : typeStr;

  // 말풍선 위치 — 이미지 박스 안으로 클램프
  const BW = box.w ? clamp(box.w - 28, 170, 340) : 300;
  const UNIT_W = BW + 50, UNIT_H = 132;
  let bubbleLeft = 0, bubbleTop = 0, bubbleSide: 'left' | 'right' = 'right';
  if (hasHotspot && box.w) {
    const hxPx = (hx! / 100) * box.w, hyPx = (hy! / 100) * box.h;
    bubbleSide = hxPx < box.w / 2 ? 'right' : 'left';
    bubbleLeft = bubbleSide === 'right' ? hxPx + 26 : hxPx - 26 - UNIT_W;
    bubbleTop = hyPx - UNIT_H / 2;
    bubbleLeft = clamp(bubbleLeft, 8, Math.max(8, box.w - UNIT_W - 8));
    bubbleTop = clamp(bubbleTop, 8, Math.max(8, box.h - UNIT_H - 8));
  }

  const hint = !hasHotspot ? "아래 '다음 →'을 눌러 계속하세요" : isType ? '여기에 입력하면 돼요' : '표시된 곳을 클릭하면 다음으로 넘어가요';
  const prefix = !hasHotspot ? '📄' : isType ? '✍️' : '👉';

  const Bubble = (
    <div style={{ background: 'white', borderRadius: '14px', padding: '11px 14px', boxShadow: '0 8px 28px rgba(0,0,0,0.28)', maxWidth: `${BW}px`, animation: nudge ? 'mfp-nudge 0.4s' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#111827', lineHeight: 1.4, flex: 1 }}>{prefix} {title}</div>
        <span style={{ fontSize: '11px', color: '#C4C9D4', flexShrink: 0, marginTop: '1px' }}>—</span>
      </div>
      {body && (
        <div style={{ fontSize: '12.5px', color: '#4B5563', lineHeight: 1.5, marginTop: '4px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{body}</div>
      )}
      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px' }}>{hint}</div>
    </div>
  );

  const MascotBtn = (
    <button onClick={onMascotClick} title={showAudioBadge ? '음성 듣기' : '안내'} style={{ border: 'none', background: 'transparent', cursor: onMascotClick ? 'pointer' : 'default', padding: 0, position: 'relative' }}>
      <Mascot />
      {showAudioBadge && <span style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}><svg width="9" height="9" viewBox="0 0 24 24" fill="#4f46e5"><path d="M3 10v4h4l5 5V5L7 10H3z" /></svg></span>}
    </button>
  );
  const BubbleBox = (
    <div onClick={onBubbleClick} title={onBubbleClick ? '눌러서 접기' : undefined} style={{ cursor: onBubbleClick ? 'pointer' : 'default' }}>{Bubble}</div>
  );
  const renderUnit = (side: 'left' | 'right' | 'bottom') => (
    minimized ? (
      <button onClick={onMascotClick} title="안내 펼치기" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, pointerEvents: 'auto' }}><Mascot /></button>
    ) : (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', pointerEvents: 'auto' }}>
        {side === 'left' ? <>{BubbleBox}{MascotBtn}</> : <>{MascotBtn}{BubbleBox}</>}
      </div>
    )
  );

  if (!screenshotUrl) {
    return <div style={{ height: '40vh', display: 'grid', placeItems: 'center', color: '#6B7280', fontSize: '13px' }}>이미지 없음</div>;
  }

  return (
    <div ref={ref} onClick={onImageClick} style={{ position: 'relative', display: 'inline-block', lineHeight: 0, cursor: imageCursor, maxWidth: '100%', maxHeight: '100%' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={screenshotUrl} alt={title} draggable={false} style={{ display: 'block', maxWidth: '100%', maxHeight: imgMaxHeight, width: 'auto', height: 'auto', userSelect: 'none' }} />

      {/* 클릭 인디케이터 — 흰 물결 */}
      {hasHotspot && !isType && (
        <div style={{ position: 'absolute', left: `${hx}%`, top: `${hy}%`, transform: 'translate(-50%,-50%)', width: '22px', height: '22px', pointerEvents: 'none', zIndex: 4 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.95)', animation: 'mfp-ripple 1.9s ease-out infinite' }} />
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.8)', animation: 'mfp-ripple 1.9s ease-out infinite', animationDelay: '0.63s' }} />
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.6)', animation: 'mfp-ripple 1.9s ease-out infinite', animationDelay: '1.26s' }} />
        </div>
      )}

      {/* 타이핑 인디케이터 — Tango식 입력 필드 박스 + 깜빡 커서 + 라벨 */}
      {hasHotspot && isType && (
        <div style={{ position: 'absolute', left: `${hx}%`, top: `${hy}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 4 }}>
          <div style={{ position: 'relative', minWidth: '128px', maxWidth: '320px', height: '36px', borderRadius: '9px', border: '2px solid #60a5fa', background: 'rgba(37,99,235,0.16)', boxShadow: '0 0 0 4px rgba(96,165,250,0.18), 0 6px 18px rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', padding: '0 12px', animation: 'mfp-field 1.8s ease-in-out infinite' }}>
            {hasTypeText ? (
              <>
                <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shownType}</span>
                <span style={{ width: '2.5px', height: '20px', marginLeft: '2px', flexShrink: 0, background: '#fff', borderRadius: '2px', boxShadow: '0 0 8px rgba(255,255,255,0.95)', animation: 'mfp-caret 1s step-end infinite' }} />
              </>
            ) : (
              <>
                <span style={{ width: '2.5px', height: '20px', background: '#fff', borderRadius: '2px', boxShadow: '0 0 8px rgba(255,255,255,0.95)', animation: 'mfp-caret 1s step-end infinite' }} />
                <span style={{ marginLeft: '7px', fontSize: '12px', color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', fontWeight: 500, letterSpacing: '0.04em' }}>텍스트 입력…</span>
              </>
            )}
          </div>
          <span style={{ position: 'absolute', top: '-13px', left: '0', fontSize: '10px', fontWeight: 800, color: '#fff', background: '#2563eb', padding: '2px 8px', borderRadius: '8px 8px 8px 2px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', whiteSpace: 'nowrap', letterSpacing: '0.03em' }}>⌨ 입력</span>
        </div>
      )}

      {/* AI 캐릭터 + 말풍선 */}
      {hasHotspot && (
        <div style={{ position: 'absolute', left: `${bubbleLeft}px`, top: `${bubbleTop}px`, zIndex: 6, pointerEvents: 'none' }}>
          {renderUnit(bubbleSide)}
        </div>
      )}

      {/* 핫스팟 없는 이동/설명형 — 하단 중앙 */}
      {!hasHotspot && (
        <div style={{ position: 'absolute', left: '50%', bottom: '18px', transform: 'translateX(-50%)', zIndex: 6, pointerEvents: 'none', maxWidth: '92%' }}>
          {renderUnit('bottom')}
        </div>
      )}

      {children}

      <style>{`
        @keyframes mfp-ripple { 0%{opacity:.95;transform:scale(0.4)} 100%{opacity:0;transform:scale(3.4)} }
        @keyframes mfp-caret { 50%{opacity:0} }
        @keyframes mfp-nudge { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
        @keyframes mfp-field { 0%,100%{box-shadow:0 0 0 4px rgba(96,165,250,0.18), 0 6px 18px rgba(0,0,0,0.32)} 50%{box-shadow:0 0 0 7px rgba(96,165,250,0.28), 0 6px 22px rgba(0,0,0,0.4)} }
      `}</style>
    </div>
  );
}
