'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// 좌표는 전부 0~100(%) 정규화로 받는다 — 호출부(play/manual)가 각자 변환해 넘긴다.
export interface FollowStep {
  title: string;
  body?: string;
  screenshotUrl?: string | null;
  hotspotX?: number | null;            // 0~100 (%)
  hotspotY?: number | null;            // 0~100 (%)
  kind?: 'click' | 'type';             // 클릭 vs 타이핑 — 인디케이터 모양 결정
}

interface Props {
  steps: FollowStep[];
  title?: string;
  onClose?: () => void;
  onComplete?: () => void;
  closeLabel?: string;
}

function Mascot({ size = 40 }: { size?: number }) {
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

const HIT_PCT = 7; // 핫스팟 정답 클릭 허용 반경(%)
const CORNER = 1.5; // 좌상단 꼭지점(이동/캡처 단계의 0,0 가짜 핫스팟) 판정 임계
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function InteractiveFollowPlayer({ steps, title, onClose, onComplete, closeLabel = '닫기' }: Props) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const total = steps.length;
  const step = steps[idx];

  // 스텝 바뀌면 툴팁 다시 펼침 (#3)
  useEffect(() => { setMinimized(false); }, [idx]);

  // 이미지 박스 실측 — 말풍선 클램프 계산용
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => { const r = el.getBoundingClientRect(); setBox({ w: r.width, h: r.height }); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [idx, done]);

  const advance = useCallback(() => {
    setIdx(i => { if (i + 1 >= total) { setDone(true); onComplete?.(); return i; } return i + 1; });
  }, [total, onComplete]);
  const goPrev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') advance();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, goPrev, onClose, done]);

  const doNudge = () => { setNudge(true); setTimeout(() => setNudge(false), 420); };

  const onImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (done) return;
    const hx = step.hotspotX, hy = step.hotspotY;
    // 클릭 타깃 없음(이동/캡처 단계 — 좌상단 0,0 포함) → 화면 클릭으로 진행하지 않음. '다음'으로만 이동 (#2)
    if (hx == null || hy == null || (hx < CORNER && hy < CORNER)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const dist = Math.hypot(xPct - hx, yPct - hy);
    if (dist <= HIT_PCT) advance(); else doNudge();
  };

  if (!step) return null;

  const hx = step.hotspotX, hy = step.hotspotY;
  // 좌상단 꼭지점(이동/캡처 단계)은 핫스팟으로 보지 않음 (#2)
  const hasHotspot = hx != null && hy != null && !(hx < CORNER && hy < CORNER);
  const isType = step.kind === 'type';

  // 말풍선 위치 — 이미지 박스 안으로 클램프 (잘림/겹침 방지)
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
        <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#111827', lineHeight: 1.4, flex: 1 }}>{prefix} {step.title}</div>
        <span style={{ fontSize: '11px', color: '#C4C9D4', flexShrink: 0, marginTop: '1px' }}>—</span>
      </div>
      {step.body && (
        <div style={{ fontSize: '12.5px', color: '#4B5563', lineHeight: 1.5, marginTop: '4px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{step.body}</div>
      )}
      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px' }}>{hint}</div>
    </div>
  );

  // 말풍선 묶음(최소화 토글) — 누르면 접힘/펼침 (#3)
  const BubbleUnit = (children: React.ReactNode) => (
    minimized ? (
      <button onClick={(e) => { e.stopPropagation(); setMinimized(false); }} title="안내 펼치기" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, pointerEvents: 'auto' }}><Mascot /></button>
    ) : (
      <div onClick={(e) => { e.stopPropagation(); setMinimized(true); }} title="눌러서 접기" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', cursor: 'pointer', pointerEvents: 'auto' }}>{children}</div>
    )
  );

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px', gap: '10px' }}>
      {done ? (
        <div style={{ background: 'white', borderRadius: '18px', padding: '36px 40px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxWidth: '380px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><Mascot size={56} /></div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>다 따라하셨어요! 🎉</div>
          <div style={{ fontSize: '13.5px', color: '#6B7280', lineHeight: 1.6, marginBottom: '18px' }}>{total}단계를 모두 완료했습니다.</div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button onClick={() => { setIdx(0); setDone(false); }} style={{ padding: '10px 18px', borderRadius: '9px', border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>다시 따라하기</button>
            {onClose && <button onClick={onClose} style={{ padding: '10px 22px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg,#3730a3,#6d28d9)', color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{closeLabel}</button>}
          </div>
        </div>
      ) : (
        <>
          {/* 가상 브라우저 창 */}
          <div style={{ position: 'relative', width: 'min(1280px, 97%)', flex: '1 1 auto', minHeight: 0, maxHeight: 'calc(100vh - 110px)', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '34px', background: '#E9EAEE', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px', flexShrink: 0 }}>
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#FF5F57' }} />
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#FEBC2E' }} />
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#28C840' }} />
              <div style={{ flex: 1, margin: '0 10px', height: '20px', background: 'white', borderRadius: '6px', display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: '11px', color: '#6B7280', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{title || '가상 화면 — 안전하게 따라해 보세요'}</div>
            </div>

            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0b0f', overflow: 'hidden' }}>
              {step.screenshotUrl ? (
                <div ref={wrapRef} onClick={onImageClick} style={{ position: 'relative', display: 'inline-block', lineHeight: 0, cursor: 'pointer', maxWidth: '100%', maxHeight: '100%' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={step.screenshotUrl} alt={step.title} style={{ display: 'block', maxWidth: '100%', maxHeight: 'calc(100vh - 150px)', width: 'auto', height: 'auto' }} />

                  {/* 인디케이터 — 클릭(흰 물결) vs 타이핑(커서+칩) */}
                  {hasHotspot && !isType && (
                    <div style={{ position: 'absolute', left: `${hx}%`, top: `${hy}%`, transform: 'translate(-50%,-50%)', width: '22px', height: '22px', pointerEvents: 'none', zIndex: 4 }}>
                      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.95)', animation: 'mfp-ripple 1.9s ease-out infinite' }} />
                      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.8)', animation: 'mfp-ripple 1.9s ease-out infinite', animationDelay: '0.63s' }} />
                      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.6)', animation: 'mfp-ripple 1.9s ease-out infinite', animationDelay: '1.26s' }} />
                    </div>
                  )}
                  {hasHotspot && isType && (
                    <div style={{ position: 'absolute', left: `${hx}%`, top: `${hy}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 4, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '2.5px', height: '20px', background: '#fff', borderRadius: '2px', boxShadow: '0 0 8px rgba(255,255,255,0.95)', animation: 'mfp-caret 1s step-end infinite' }} />
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff', background: 'rgba(79,70,229,0.96)', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>입력</span>
                    </div>
                  )}

                  {/* AI 캐릭터 + 말풍선 (클램프 + 최소화) */}
                  {hasHotspot && (
                    <div style={{ position: 'absolute', left: `${bubbleLeft}px`, top: `${bubbleTop}px`, zIndex: 6, pointerEvents: 'none' }}>
                      {BubbleUnit(<>{bubbleSide === 'right' && <Mascot />}{Bubble}{bubbleSide === 'left' && <Mascot />}</>)}
                    </div>
                  )}

                  {/* 핫스팟 없는 이동/설명형 — 하단 중앙 */}
                  {!hasHotspot && (
                    <div style={{ position: 'absolute', left: '50%', bottom: '18px', transform: 'translateX(-50%)', zIndex: 6, pointerEvents: 'none', maxWidth: '92%' }}>
                      {BubbleUnit(<><Mascot />{Bubble}</>)}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ height: '40vh', display: 'grid', placeItems: 'center', color: '#6B7280', fontSize: '13px' }}>이미지 없음</div>
              )}
            </div>
          </div>

          {/* 컨트롤 바 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.95)', borderRadius: '12px', padding: '8px 14px', boxShadow: '0 6px 24px rgba(0,0,0,0.25)', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#4338ca', background: '#EEF2FF', padding: '3px 10px', borderRadius: '20px' }}>{idx + 1} / {total}</span>
            <button onClick={goPrev} disabled={idx === 0} style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', color: idx === 0 ? '#D1D5DB' : '#374151', fontSize: '12.5px', fontWeight: 600, cursor: idx === 0 ? 'default' : 'pointer' }}>이전</button>
            <button onClick={advance} style={{ height: '32px', padding: '0 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>{idx + 1 >= total ? '완료' : '다음 →'}</button>
            {onClose && <button onClick={onClose} style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#6B7280', fontSize: '12.5px', cursor: 'pointer' }}>{closeLabel}</button>}
          </div>
        </>
      )}

      <style>{`
        @keyframes mfp-ripple { 0%{opacity:.95;transform:scale(0.4)} 100%{opacity:0;transform:scale(3.4)} }
        @keyframes mfp-caret { 50%{opacity:0} }
        @keyframes mfp-nudge { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
      `}</style>
    </div>
  );
}
