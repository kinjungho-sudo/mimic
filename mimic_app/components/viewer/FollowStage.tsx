'use client';

import { useState, useEffect, useRef, useId } from 'react';

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
  typeTextColor?: string;           // 타이핑 인디케이터 글자색 (기본 #111827)
  animateType?: boolean;            // true=뷰어(자동 타이핑 애니메이션), false/미설정=스튜디오(정적 표시)
  isFirstStep?: boolean;            // true일 때만 클릭 힌트 표시
  title: string;
  body?: string;
  minimized?: boolean;
  showAudioBadge?: boolean;
  nudge?: boolean;
  spotlight?: boolean;              // true=플레이어 스포트라이트(배경 어두움 + 핫스팟만 밝음)
  imageCursor?: string;             // 'pointer'(플레이어) | 'crosshair'(스튜디오)
  imgMaxHeight?: string;
  onImageClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMascotClick?: (e: React.MouseEvent) => void;
  onBubbleClick?: (e: React.MouseEvent) => void;   // 플레이어: 접기
  wrapRef?: React.RefObject<HTMLDivElement>; // 스튜디오 드래그 측정용
  children?: React.ReactNode;       // 이미지 위 추가 오버레이(스튜디오 드래그 핸들 등)
}

export function FollowStage({
  screenshotUrl, hotspotX: hx, hotspotY: hy, kind, typeText, typeTextColor, animateType = false,
  isFirstStep = false, title, body,
  minimized = false, showAudioBadge = false, nudge = false, spotlight = false,
  imageCursor = 'default', imgMaxHeight = 'calc(100vh - 150px)',
  onImageClick, onMascotClick, onBubbleClick, wrapRef, children,
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const ref = wrapRef ?? innerRef;
  const [box, setBox] = useState({ w: 0, h: 0 });
  const rawId = useId();
  const maskId = 'mfp' + rawId.replace(/:/g, '');

  // 텍스트 인디케이터 자동 타이핑 — 뷰어에서만(animateType). 스튜디오는 입력값 그대로 표시
  // 짧을수록 느리게(70ms), 길수록 빠르게(최소 22ms)
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    if (!animateType || kind !== 'type' || !typeText) { setTyped(0); return; }
    setTyped(0);
    let i = 0;
    const speed = Math.max(22, 70 - typeText.length * 0.9);
    const id = setInterval(() => {
      i += 1;
      setTyped(i);
      if (i >= typeText.length) clearInterval(id);
    }, speed);
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
  // 스포트라이트 구멍 반경: 이미지 너비의 9%, 최대 80px
  const spotR = box.w ? Math.min(Math.round(box.w * 0.09), 80) : 72;
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
  // 클릭 힌트는 첫 스텝에서만 표시 (type·이동형은 항상)
  const showHint = !hasHotspot || isType || isFirstStep;

  const Bubble = (
    <div style={{ background: 'white', borderRadius: '14px', padding: '15px 18px', boxShadow: '0 16px 48px rgba(0,0,0,0.30), 0 2px 8px rgba(0,0,0,0.12)', maxWidth: `${BW}px`, animation: nudge ? 'mfp-nudge 0.4s' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: '#111827', lineHeight: 1.4, flex: 1 }}>{prefix} {title}</div>
        <span style={{ fontSize: '11px', color: '#C4C9D4', flexShrink: 0, marginTop: '2px' }}>—</span>
      </div>
      {body && (
        <div style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.55, marginTop: '6px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{body}</div>
      )}
      {showHint && <div style={{ fontSize: '12px', color: '#6366F1', marginTop: '12px', fontWeight: 500 }}>{hint}</div>}
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
      // side !== 'bottom': flex-end 정렬로 인한 mascot 하단 위치(UNIT_H - 40 = 92px)를 marginTop으로 보존 → 클릭 시 점프 없음
      <button onClick={onMascotClick} title="안내 펼치기" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, pointerEvents: 'auto', marginTop: side !== 'bottom' ? `${UNIT_H - 40}px` : undefined }}><Mascot /></button>
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

      {/* 스포트라이트 오버레이 — 플레이어 전용(spotlight=true). SVG 마스크로 핫스팟 주변만 밝게 */}
      {spotlight && hasHotspot && !isType && (
        <svg aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 3, animation: 'mfp-spotlight-in 0.55s ease-out forwards' }}>
          <defs>
            <mask id={maskId}>
              <rect width="100%" height="100%" fill="white" />
              <circle cx={`${hx}%`} cy={`${hy}%`} r={spotR} fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.52)" mask={`url(#${maskId})`} />
        </svg>
      )}

      {/* 클릭 인디케이터 — 물결 링 + 중심 도트(spotlight 시). 서브 컬러(인디고) 25% 불투명 */}
      {hasHotspot && !isType && (
        <div style={{ position: 'absolute', left: `${hx}%`, top: `${hy}%`, transform: 'translate(-50%,-50%)', width: '22px', height: '22px', pointerEvents: 'none', zIndex: 4 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2.5px solid rgba(99,102,241,0.30)', animation: 'mfp-ripple 1.9s ease-out infinite' }} />
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2.5px solid rgba(99,102,241,0.22)', animation: 'mfp-ripple 1.9s ease-out infinite', animationDelay: '0.63s' }} />
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2.5px solid rgba(99,102,241,0.15)', animation: 'mfp-ripple 1.9s ease-out infinite', animationDelay: '1.26s' }} />
          {spotlight && (
            <span style={{ position: 'absolute', width: '10px', height: '10px', borderRadius: '50%', background: '#6366f1', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', boxShadow: '0 0 0 2.5px white, 0 2px 10px rgba(99,102,241,0.5)' }} />
          )}
        </div>
      )}

      {/* 타이핑 인디케이터 — 흰 배경 입력 필드 박스 + 깜빡 커서 + 라벨. 글자색 커스텀 가능(기본 #111827) */}
      {hasHotspot && isType && (
        <div style={{ position: 'absolute', left: `${hx}%`, top: `${hy}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 4 }}>
          <div style={{ position: 'relative', minWidth: '128px', maxWidth: '320px', height: '38px', borderRadius: '9px', border: '2px solid #6366f1', background: 'rgba(255,255,255,0.96)', boxShadow: '0 0 0 4px rgba(99,102,241,0.18), 0 6px 20px rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', padding: '0 12px', animation: 'mfp-field 1.8s ease-in-out infinite' }}>
            {hasTypeText ? (
              <>
                <span style={{ fontSize: '13px', color: typeTextColor ?? '#111827', fontWeight: 600, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shownType}</span>
                <span style={{ width: '2px', height: '18px', marginLeft: '2px', flexShrink: 0, background: typeTextColor ?? '#6366f1', borderRadius: '2px', animation: 'mfp-caret 1s step-end infinite' }} />
              </>
            ) : (
              <>
                <span style={{ width: '2px', height: '18px', background: '#6366f1', borderRadius: '2px', animation: 'mfp-caret 1s step-end infinite' }} />
                <span style={{ marginLeft: '7px', fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic', fontWeight: 500, letterSpacing: '0.04em' }}>텍스트 입력…</span>
              </>
            )}
          </div>
          <span style={{ position: 'absolute', top: '-13px', left: '0', fontSize: '10px', fontWeight: 800, color: '#fff', background: '#6366f1', padding: '2px 8px', borderRadius: '8px 8px 8px 2px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', whiteSpace: 'nowrap', letterSpacing: '0.03em' }}>⌨ 입력</span>
        </div>
      )}

      {/* AI 캐릭터 + 말풍선 */}
      {hasHotspot && (
        <div style={{ position: 'absolute', left: `${bubbleLeft}px`, top: `${bubbleTop}px`, zIndex: 6, pointerEvents: 'none' }}>
          {renderUnit(bubbleSide)}
        </div>
      )}

      {/* 핫스팟 없는 이동/설명형 — 우측 하단 */}
      {!hasHotspot && (
        <div style={{ position: 'absolute', right: '18px', bottom: '18px', zIndex: 6, pointerEvents: 'none', maxWidth: '92%' }}>
          {renderUnit('bottom')}
        </div>
      )}

      {children}

      <style>{`
        @keyframes mfp-ripple { 0%{opacity:.95;transform:scale(0.3)} 100%{opacity:0;transform:scale(5.2)} }
        @keyframes mfp-caret { 50%{opacity:0} }
        @keyframes mfp-nudge { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
        @keyframes mfp-field { 0%,100%{box-shadow:0 0 0 4px rgba(99,102,241,0.18), 0 6px 20px rgba(0,0,0,0.28)} 50%{box-shadow:0 0 0 7px rgba(99,102,241,0.28), 0 6px 24px rgba(0,0,0,0.35)} }
        @keyframes mfp-spotlight-in { from{opacity:0} to{opacity:1} }
      `}</style>
    </div>
  );
}
