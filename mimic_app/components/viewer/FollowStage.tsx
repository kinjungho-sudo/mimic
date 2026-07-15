'use client';

import { useState, useEffect, useRef, useId } from 'react';
import { AnnotationPreview } from '@/components/editor/AnnotationPreview';
import { ParroMascot } from '@/components/brand/ParroMascot';
import { BRAND_COLORS } from '@/lib/brand';
import type { Annotation } from '@/components/editor/ImageAnnotationEditor';

// 따라하기 시각 레이어(이미지 + 핫스팟 인디케이터 + AI 캐릭터 말풍선).
// 플레이어와 스튜디오가 동일 컴포넌트를 써서 "보는 사람이 보는 화면"이 100% 일치하도록 한다.

export const CORNER = 1.5; // 좌상단 0,0 가짜 핫스팟(이동/캡처 단계) 판정 임계
const MAX_AUTO_ZOOM = 1.6;
const GUIDE_GRADIENT = `linear-gradient(135deg,${BRAND_COLORS.primary},${BRAND_COLORS.guide})`;
const GUIDE_RING = 'rgba(0,155,142,0.20)';
const GUIDE_RING_SOFT = 'rgba(0,155,142,0.14)';
const GUIDE_RING_STRONG = 'rgba(0,155,142,0.28)';
const GUIDE_SHADOW = 'rgba(0,155,142,0.34)';
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function Mascot({ size = 40 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '14px', background: 'linear-gradient(135deg,#F1FBF9,#E4F3F6)', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: `0 4px 14px ${GUIDE_SHADOW}`, overflow: 'hidden' }}>
      <ParroMascot size={size * 0.96} />
    </div>
  );
}

interface Props {
  screenshotUrl?: string | null;
  hotspotX: number | null;          // 0~100 (%) — none/이동단계는 null
  hotspotY: number | null;
  allowCornerHotspot?: boolean;     // true=사용자가 직접 찍은 좌상단 핫스팟 허용(0,0 가짜 센티넬 억제 해제)
  kind: 'click' | 'type';
  guideMode?: 'interactive' | 'explanation';
  annotations?: Annotation[] | null;
  typeText?: string | null;         // type 인디케이터에 표시/입력될 텍스트
  typeInputMode?: 'copy' | 'auto' | null; // copy=복사 후 직접 입력, auto=자동 타이핑 연출
  typeBoxWidth?: number | null;     // type 인디케이터 너비(px)
  typeBoxHeight?: number | null;    // type 인디케이터 높이(px)
  typeTextColor?: string;           // 타이핑 인디케이터 글자색 (기본 #111827)
  animateType?: boolean;            // true=뷰어(자동 타이핑 애니메이션), false/미설정=스튜디오(정적 표시)
  showTypeIndicator?: boolean;      // false=말풍선만 표시하고 필드 위 입력 오버레이는 숨김
  isFirstStep?: boolean;            // true일 때만 클릭 힌트 표시
  stepNumber?: number | null;       // 말풍선 머리 넘버링(목차 순서). 있으면 손가락 이모지 대신 번호 배지
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
  bubbleAnchor?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null;  // 말풍선 고정 위치. 미설정=핫스팟 상대 자동
  wrapRef?: React.RefObject<HTMLDivElement>; // 스튜디오 드래그 측정용
  children?: React.ReactNode;       // 이미지 위 추가 오버레이(스튜디오 드래그 핸들 등)
  // 실습하기 시네마틱 시퀀스 — undefined=애니메이션 없음(스튜디오), 전달 시 raw→zooming→focused
  animPhase?: 'raw' | 'zooming' | 'focused';
  domRect?: { x: number; y: number; w: number; h: number } | null; // DOM bounding box (0~100 pct)
}

export function FollowStage({
  screenshotUrl, hotspotX: hx, hotspotY: hy, allowCornerHotspot = false, kind, typeText, typeInputMode, typeBoxWidth, typeBoxHeight, typeTextColor, guideMode = 'interactive', annotations = null, animateType = false,
  showTypeIndicator = true,
  isFirstStep = false, stepNumber = null, title, body,
  minimized = false, showAudioBadge = false, nudge = false, spotlight = false,
  imageCursor = 'default', imgMaxHeight = 'calc(100vh - 150px)',
  bubbleAnchor, animPhase, domRect = null,
  onImageClick, onMascotClick, onBubbleClick, wrapRef, children,
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const ref = wrapRef ?? innerRef;
  const [box, setBox] = useState({ w: 0, h: 0 });
  const rawId = useId();
  const maskId = 'mfp' + rawId.replace(/:/g, '');

  // 텍스트 인디케이터 자동 타이핑 — 뷰어에서만(animateType). 스튜디오는 입력값 그대로 표시
  // 글자당 110ms 고정 — 또박또박 읽을 수 있는 차분한 속도
  const [typed, setTyped] = useState(0);
  const [copied, setCopied] = useState(false);
  const isAutoType = typeInputMode === 'auto' || (typeInputMode == null && animateType);
  useEffect(() => {
    if (!animateType || !isAutoType || kind !== 'type' || !typeText) { setTyped(0); return; }
    setTyped(0);
    let i = 0;
    const speed = 110;
    const id = setInterval(() => {
      i += 1;
      setTyped(i);
      if (i >= typeText.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [animateType, isAutoType, kind, typeText]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => { const r = el.getBoundingClientRect(); setBox({ w: r.width, h: r.height }); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, screenshotUrl]);

  // 좌상단 0,0 가짜 핫스팟(자동추론 아티팩트)은 억제하되, 사용자가 직접 찍은 좌표는 그대로 인정
  const hasHotspot = hx != null && hy != null && (allowCornerHotspot || !(hx < CORNER && hy < CORNER));
  const isType = kind === 'type';
  // 스포트라이트 구멍 반경: 이미지 너비의 9%, 최대 80px (domRect 없을 때 폴백)
  const spotR = box.w ? Math.min(Math.round(box.w * 0.09), 80) : 72;

  // 시네마틱 시퀀스 — animPhase가 없으면(스튜디오) 애니메이션 없이 항상 focused 상태
  const isAnimated = animPhase != null;
  const phase = animPhase ?? 'focused';
  const showMask = !isAnimated || phase !== 'raw';       // spotlight 마스크: zooming부터 표시
  const showOverlays = !isAnimated || phase === 'focused'; // 핫스팟·말풍선: focused 시만 표시

  // 줌 계산 — domRect 요소 중심으로 확대 (스케일: 기하평균 기반, 1.5~4배 클램프)
  const zoomCX = domRect ? domRect.x + domRect.w / 2 : (hx ?? 50);
  const zoomCY = domRect ? domRect.y + domRect.h / 2 : (hy ?? 50);
  const zoomScale = (domRect && isAnimated && phase !== 'raw')
    ? clamp(40 / Math.sqrt(Math.max(domRect.w * domRect.h, 0.25)), 1.5, MAX_AUTO_ZOOM)
    : 1;
  const zoomStyle = (domRect && isAnimated)
    ? { transform: `scale(${zoomScale})`, transformOrigin: `${zoomCX}% ${zoomCY}%`, transition: phase === 'raw' ? 'none' : 'transform 1.4s ease-in-out' }
    : {};
  const typeStr = typeText ?? '';
  const hasTypeText = typeStr.trim().length > 0;
  const shownType = animateType && isAutoType ? typeStr.slice(0, typed) : typeStr;
  const typeIndicatorWidth = typeBoxWidth != null ? clamp(typeBoxWidth, 120, 520) : null;
  const typeIndicatorHeight = clamp(typeBoxHeight ?? 38, 32, 96);
  const typeIndicatorFontSize = clamp(Math.round(typeIndicatorHeight * 0.34), 12, 18);
  const showCopyControl = isType && !isAutoType && hasTypeText;
  const copyTypeText = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!typeStr.trim()) return;
    try {
      await navigator.clipboard.writeText(typeStr);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  // 말풍선 위치 — anchor 고정 위치 우선, 없으면 핫스팟 상대 위치
  const BW = box.w ? clamp(box.w - 28, 170, 340) : 300;
  const UNIT_W = BW + 50, UNIT_H = 132;
  let bubbleLeft = 0, bubbleTop = 0, bubbleSide: 'left' | 'right' = 'right';
  if (bubbleAnchor && box.w && box.h) {
    const isRight = bubbleAnchor.includes('right');
    const isBottom = bubbleAnchor.includes('bottom');
    bubbleSide = isRight ? 'left' : 'right';
    bubbleLeft = isRight ? box.w - UNIT_W - 12 : 12;
    bubbleTop = isBottom ? box.h - UNIT_H - 12 : 12;
  } else if (hasHotspot && box.w) {
    const hxPx = (hx! / 100) * box.w, hyPx = (hy! / 100) * box.h;
    bubbleSide = hxPx < box.w / 2 ? 'right' : 'left';
    bubbleLeft = bubbleSide === 'right' ? hxPx + 26 : hxPx - 26 - UNIT_W;
    bubbleTop = hyPx - UNIT_H / 2;
    bubbleLeft = clamp(bubbleLeft, 8, Math.max(8, box.w - UNIT_W - 8));
    bubbleTop = clamp(bubbleTop, 8, Math.max(8, box.h - UNIT_H - 8));
  }

  // 줌 적용 시 말풍선은 zoom wrapper 밖에서 렌더링 → 시각적 핫스팟 위치로 재계산
  // transform: scale(S) 후 점 (px,py)의 시각 위치 = pivot + (px-pivot)*S
  let outBubbleLeft = bubbleLeft;
  let outBubbleTop = bubbleTop;
  if (!bubbleAnchor && hasHotspot && box.w && box.h && isAnimated) {
    const zoomCXpx = (zoomCX / 100) * box.w;
    const zoomCYpx = (zoomCY / 100) * box.h;
    const visHxPx = zoomCXpx + ((hx! / 100) * box.w - zoomCXpx) * zoomScale;
    const visHyPx = zoomCYpx + ((hy! / 100) * box.h - zoomCYpx) * zoomScale;
    outBubbleLeft = bubbleSide === 'right' ? visHxPx + 26 : visHxPx - 26 - UNIT_W;
    outBubbleTop = visHyPx - UNIT_H / 2;
    outBubbleLeft = clamp(outBubbleLeft, 8, Math.max(8, box.w - UNIT_W - 8));
    outBubbleTop = clamp(outBubbleTop, 8, Math.max(8, box.h - UNIT_H - 8));
  }

  const hint = guideMode === 'explanation'
    ? "안내를 확인한 뒤 아래 '다음 →'을 눌러 계속하세요"
    : !hasHotspot ? "아래 '다음 →'을 눌러 계속하세요" : isType ? '여기에 입력하면 돼요' : '표시된 곳을 클릭하면 다음으로 넘어가요';
  // 말풍선은 평문 렌더 — 설명에 섞인 HTML 태그(<font>, <b> 등)/엔티티가 그대로 노출되지 않도록 제거
  const plainBody = body
    ? body.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
    : body;
  const bubbleText = plainBody || title;
  // 클릭 힌트는 첫 스텝에서만 표시 (type·이동형은 항상)
  const showHint = !hasHotspot || isType || isFirstStep;

  const Bubble = (
    <div style={{ background: 'white', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 16px 48px rgba(0,0,0,0.30), 0 2px 8px rgba(0,0,0,0.12)', maxWidth: `${BW}px`, animation: nudge ? 'mfp-nudge 0.4s' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
        {stepNumber != null && (
          <span style={{ flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%', background: GUIDE_GRADIENT, color: '#fff', fontSize: '13px', fontWeight: 800, display: 'grid', placeItems: 'center', marginTop: '1px', boxShadow: `0 2px 6px ${GUIDE_SHADOW}` }}>{stepNumber}</span>
        )}
        {bubbleText && (
          <div style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.55, flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{bubbleText}</div>
        )}
        <span style={{ fontSize: '11px', color: '#C4C9D4', flexShrink: 0, marginTop: '2px' }}>—</span>
      </div>
      {showHint && <div style={{ fontSize: '12px', color: BRAND_COLORS.primary, marginTop: '14px', fontWeight: 500 }}>{hint}</div>}
    </div>
  );

  const MascotBtn = (
    <button onClick={onMascotClick} title={showAudioBadge ? '음성 듣기' : '안내'} style={{ border: 'none', background: 'transparent', cursor: onMascotClick ? 'pointer' : 'default', padding: 0, position: 'relative' }}>
      <Mascot />
      {showAudioBadge && <span style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}><svg width="9" height="9" viewBox="0 0 24 24" fill={BRAND_COLORS.primary}><path d="M3 10v4h4l5 5V5L7 10H3z" /></svg></span>}
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
    return (
      <div style={{ width: 'min(520px, calc(100vw - 32px))', minHeight: '260px', display: 'grid', placeItems: 'center', padding: '24px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', maxWidth: '420px' }}>
          <Mascot />
          {Bubble}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', lineHeight: 0, cursor: imageCursor, maxWidth: '100%', maxHeight: '100%' }}>
      {/* 줌 래퍼 — domRect+animPhase 있을 때만 scale 적용. children(스튜디오 핸들)은 밖에 둠 */}
      {/* onClick은 스케일 적용된 이 div에 부착 — getBoundingClientRect가 줌 후 박스를 반환해 클릭 좌표가 원본 이미지 좌표로 정확히 매핑됨 */}
      <div onClick={onImageClick} style={{ position: 'relative', lineHeight: 0, ...zoomStyle }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={screenshotUrl} alt={title} draggable={false} style={{ display: 'block', maxWidth: '100%', maxHeight: imgMaxHeight, width: 'auto', height: 'auto', userSelect: 'none' }} />
        {!!annotations?.length && (
          <AnnotationPreview annotations={annotations} imageUrl={screenshotUrl} />
        )}

        {/* 스포트라이트 오버레이 — zooming부터 표시. domRect 있으면 직사각형 구멍, 없으면 원형 */}
        {showMask && spotlight && hasHotspot && !isType && (
          <svg aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2, animation: 'mfp-spotlight-in 0.55s ease-out forwards' }}>
            <defs>
              <mask id={maskId}>
                <rect width="100%" height="100%" fill="white" />
                {domRect
                  ? <rect x={`${domRect.x}%`} y={`${domRect.y}%`} width={`${domRect.w}%`} height={`${domRect.h}%`} rx="6" fill="black" />
                  : <circle cx={`${hx}%`} cy={`${hy}%`} r={spotR} fill="black" />
                }
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.52)" mask={`url(#${maskId})`} />
          </svg>
        )}

        {/* DOM 직사각형 하이라이트 — focused 시 등장. domRect 있을 때만 */}
        {showOverlays && domRect && hasHotspot && !isType && (
          <div style={{
            position: 'absolute', left: `${domRect.x}%`, top: `${domRect.y}%`,
            width: `${domRect.w}%`, height: `${domRect.h}%`,
            border: `2.5px solid ${BRAND_COLORS.guide}`, borderRadius: '6px',
            boxShadow: `0 0 0 3px ${GUIDE_RING}`,
            pointerEvents: 'none', zIndex: 3,
            animation: isAnimated ? 'mfp-rect-in 0.35s ease-out' : undefined,
          }} />
        )}

        {/* 클릭 인디케이터 — 물결 링만(중심 도트 없음). 버튼을 가리지 않게 작고 은은하게. focused 시만 */}
        {showOverlays && hasHotspot && !isType && (
          <div style={{ position: 'absolute', left: `${hx}%`, top: `${hy}%`, transform: 'translate(-50%,-50%)', width: '16px', height: '16px', pointerEvents: 'none', zIndex: 4 }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${GUIDE_RING_STRONG}`, animation: 'mfp-ripple 2s ease-out infinite' }} />
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${GUIDE_RING_SOFT}`, animation: 'mfp-ripple 2s ease-out infinite', animationDelay: '0.66s' }} />
          </div>
        )}

        {/* 타이핑 인디케이터 — focused 시만 */}
        {showTypeIndicator && showOverlays && hasHotspot && isType && (
          <div style={{ position: 'absolute', left: `${hx}%`, top: `${hy}%`, transform: 'translate(-50%,-50%)', pointerEvents: showCopyControl ? 'auto' : 'none', zIndex: 4 }}>
            <div style={{ position: 'relative', minWidth: typeIndicatorWidth == null ? '128px' : undefined, width: typeIndicatorWidth == null ? undefined : `${typeIndicatorWidth}px`, maxWidth: typeIndicatorWidth == null ? '320px' : undefined, height: `${typeIndicatorHeight}px`, borderRadius: '9px', border: `2px solid ${BRAND_COLORS.guide}`, background: 'rgba(255,255,255,0.96)', boxShadow: `0 0 0 4px ${GUIDE_RING_SOFT}, 0 6px 20px rgba(0,0,0,0.28)`, display: 'flex', alignItems: 'center', padding: '0 12px', animation: 'mfp-field 1.8s ease-in-out infinite' }}>
              {hasTypeText ? (
                <>
                  <span style={{ flex: 1, minWidth: 0, fontSize: `${typeIndicatorFontSize}px`, color: typeTextColor ?? '#111827', WebkitTextFillColor: typeTextColor ?? '#111827', fontWeight: 600, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shownType}</span>
                  {isAutoType ? (
                    <span style={{ width: '2px', height: `${Math.max(18, Math.round(typeIndicatorHeight * 0.48))}px`, marginLeft: '2px', flexShrink: 0, background: typeTextColor ?? '#111827', borderRadius: '2px', animation: 'mfp-caret 1s step-end infinite' }} />
                  ) : (
                    <button onClick={copyTypeText} style={{ flexShrink: 0, marginLeft: 8, height: Math.max(24, Math.min(30, typeIndicatorHeight - 8)), padding: '0 9px', borderRadius: 7, border: `1px solid ${BRAND_COLORS.border}`, background: copied ? BRAND_COLORS.guideSoft : '#F8FAFC', color: BRAND_COLORS.pointer, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                      {copied ? '복사됨' : '복사'}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span style={{ width: '2px', height: `${Math.max(18, Math.round(typeIndicatorHeight * 0.48))}px`, background: BRAND_COLORS.guide, borderRadius: '2px', animation: 'mfp-caret 1s step-end infinite' }} />
                  <span style={{ marginLeft: '7px', fontSize: `${Math.max(12, typeIndicatorFontSize - 1)}px`, color: '#111827', WebkitTextFillColor: '#111827', fontStyle: 'italic', fontWeight: 600, letterSpacing: '0.04em' }}>텍스트 입력…</span>
                </>
              )}
            </div>
            <span style={{ position: 'absolute', top: '-13px', left: '0', fontSize: '10px', fontWeight: 800, color: '#fff', background: BRAND_COLORS.guide, padding: '2px 8px', borderRadius: '8px 8px 8px 2px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', whiteSpace: 'nowrap', letterSpacing: '0.03em' }}>{isAutoType ? '⌨ 자동 입력' : '⌨ 복사 후 입력'}</span>
          </div>
        )}

      </div>

      {/* AI 캐릭터 + 말풍선 — zoom wrapper 밖 렌더링으로 확대 영향 없이 항상 화면 안에 표시 */}
      {showOverlays && (hasHotspot || (bubbleAnchor && box.w > 0)) && (
        <div style={{ position: 'absolute', left: `${outBubbleLeft}px`, top: `${outBubbleTop}px`, zIndex: 6, pointerEvents: 'none', animation: isAnimated ? 'mfp-bubble-in 0.35s ease-out' : undefined }}>
          {renderUnit(bubbleSide)}
        </div>
      )}

      {/* 핫스팟 없고 앵커도 없는 이동/설명형 — focused 시만 */}
      {showOverlays && !hasHotspot && !bubbleAnchor && (
        <div style={{ position: 'absolute', right: '18px', bottom: '18px', zIndex: 6, pointerEvents: 'none', maxWidth: '92%' }}>
          {renderUnit('bottom')}
        </div>
      )}

      {children}

      <style>{`
        @keyframes mfp-ripple { 0%{opacity:.8;transform:scale(0.4)} 100%{opacity:0;transform:scale(3.2)} }
        @keyframes mfp-caret { 50%{opacity:0} }
        @keyframes mfp-nudge { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
        @keyframes mfp-field { 0%,100%{box-shadow:0 0 0 4px ${GUIDE_RING_SOFT}, 0 6px 20px rgba(0,0,0,0.28)} 50%{box-shadow:0 0 0 7px ${GUIDE_RING_STRONG}, 0 6px 24px rgba(0,0,0,0.35)} }
        @keyframes mfp-spotlight-in { from{opacity:0} to{opacity:1} }
        @keyframes mfp-rect-in { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
        @keyframes mfp-bubble-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
