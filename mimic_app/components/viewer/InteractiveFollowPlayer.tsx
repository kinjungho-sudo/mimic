'use client';

import { useState, useCallback, useEffect } from 'react';

// 좌표는 전부 0~100(%) 정규화로 받는다 — 호출부(play/manual)가 각자 변환해 넘긴다.
export interface FollowStep {
  title: string;
  body?: string;
  screenshotUrl?: string | null;
  hotspotX?: number | null;            // 0~100 (%)
  hotspotY?: number | null;            // 0~100 (%)
  highlight?: { x: number; y: number; w: number; h: number } | null; // 0~100 (%)
}

interface Props {
  steps: FollowStep[];
  onClose?: () => void;
  onComplete?: () => void;
}

// 친근한 AI 도우미 아바타 (마스코트 교체 전 플레이스홀더)
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

export function InteractiveFollowPlayer({ steps, onClose, onComplete }: Props) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [nudge, setNudge] = useState(false);

  const total = steps.length;
  const step = steps[idx];

  const advance = useCallback(() => {
    setIdx(i => {
      if (i + 1 >= total) { setDone(true); onComplete?.(); return i; }
      return i + 1;
    });
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

  // 스크린샷 위 클릭 — 핫스팟 근처면 진행, 아니면 넛지
  const onImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (done) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    if (step.hotspotX == null || step.hotspotY == null) { advance(); return; }
    const dist = Math.hypot(xPct - step.hotspotX, yPct - step.hotspotY);
    if (dist <= HIT_PCT) advance(); else doNudge();
  };

  if (!step) return null;

  const hx = step.hotspotX, hy = step.hotspotY;
  const hasHotspot = hx != null && hy != null;
  // 말풍선 위치 — 핫스팟 반대쪽으로 (가리지 않게)
  const bubbleSide = hasHotspot && hx! > 55 ? 'left' : 'right';
  const bubbleVert = hasHotspot && hy! > 62 ? 'above' : 'below';

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', gap: '14px' }}>
      {done ? (
        <div style={{ background: 'white', borderRadius: '18px', padding: '36px 40px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxWidth: '380px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><Mascot size={56} /></div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>다 따라하셨어요! 🎉</div>
          <div style={{ fontSize: '13.5px', color: '#6B7280', lineHeight: 1.6, marginBottom: '18px' }}>{total}단계를 모두 완료했습니다.</div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button onClick={() => { setIdx(0); setDone(false); }} style={{ padding: '10px 18px', borderRadius: '9px', border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>다시 따라하기</button>
            {onClose && <button onClick={onClose} style={{ padding: '10px 22px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg,#3730a3,#6d28d9)', color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>닫기</button>}
          </div>
        </div>
      ) : (
        <>
          {/* 가상 브라우저 창 */}
          <div style={{ position: 'relative', width: 'min(980px, 96%)', maxHeight: '82vh', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column' }}>
            {/* 창 상단바 */}
            <div style={{ height: '34px', background: '#E9EAEE', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px', flexShrink: 0 }}>
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#FF5F57' }} />
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#FEBC2E' }} />
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#28C840' }} />
              <div style={{ flex: 1, margin: '0 10px', height: '20px', background: 'white', borderRadius: '6px', display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: '11px', color: '#9CA3AF' }}>가상 화면 — 안전하게 따라해 보세요</div>
            </div>

            {/* 스크린샷 + 인터랙션 레이어 */}
            <div onClick={onImageClick} style={{ position: 'relative', flex: 1, minHeight: 0, cursor: 'pointer', background: '#0b0b0f', lineHeight: 0 }}>
              {step.screenshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={step.screenshotUrl} alt={step.title} style={{ width: '100%', maxHeight: '64vh', objectFit: 'contain', display: 'block' }} />
              ) : (
                <div style={{ height: '40vh', display: 'grid', placeItems: 'center', color: '#6B7280', fontSize: '13px' }}>이미지 없음</div>
              )}

              {/* 하이라이트 박스 */}
              {step.highlight && (
                <div style={{ position: 'absolute', left: `${step.highlight.x}%`, top: `${step.highlight.y}%`, width: `${step.highlight.w}%`, height: `${step.highlight.h}%`, border: '2.5px solid #F59E0B', borderRadius: '6px', boxShadow: '0 0 0 4px rgba(245,158,11,0.25), 0 0 0 9999px rgba(0,0,0,0.42)', pointerEvents: 'none', zIndex: 3 }} />
              )}

              {/* 클릭 핫스팟 */}
              {hasHotspot && (
                <div style={{ position: 'absolute', left: `${hx}%`, top: `${hy}%`, transform: 'translate(-50%,-50%)', width: '26px', height: '26px', pointerEvents: 'none', zIndex: 4 }}>
                  <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(239,68,68,0.92)', boxShadow: '0 0 10px rgba(239,68,68,0.8)' }} />
                  <span style={{ position: 'absolute', inset: '-6px', borderRadius: '50%', border: '2px solid rgba(239,68,68,0.7)', animation: 'mfp-ripple 1.4s ease-out infinite' }} />
                </div>
              )}

              {/* AI 캐릭터 + 2단 말풍선 */}
              {hasHotspot && (
                <div style={{ position: 'absolute', left: `${hx}%`, top: `${hy}%`, zIndex: 6, pointerEvents: 'none', transform: `translate(${bubbleSide === 'left' ? 'calc(-100% - 26px)' : '26px'}, ${bubbleVert === 'above' ? 'calc(-100% - 18px)' : '18px'})`, animation: nudge ? 'mfp-nudge 0.4s' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', maxWidth: '320px' }}>
                    {bubbleSide === 'right' && <Mascot />}
                    <div style={{ background: 'white', borderRadius: '14px', padding: '11px 14px', boxShadow: '0 8px 28px rgba(0,0,0,0.28)' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#111827', lineHeight: 1.4 }}>👉 {step.title}</div>
                      {step.body && <div style={{ fontSize: '12.5px', color: '#4B5563', lineHeight: 1.5, marginTop: '4px' }}>{step.body}</div>}
                      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px' }}>표시된 곳을 클릭하면 다음으로 넘어가요</div>
                    </div>
                    {bubbleSide === 'left' && <Mascot />}
                  </div>
                </div>
              )}

              {/* 핫스팟 없는 스텝(설명형) — 하단 안내 */}
              {!hasHotspot && (
                <div style={{ position: 'absolute', left: '50%', bottom: '18px', transform: 'translateX(-50%)', zIndex: 6, pointerEvents: 'none', display: 'flex', alignItems: 'flex-end', gap: '8px', maxWidth: '92%' }}>
                  <Mascot />
                  <div style={{ background: 'white', borderRadius: '14px', padding: '11px 14px', boxShadow: '0 8px 28px rgba(0,0,0,0.28)' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#111827' }}>{step.title}</div>
                    {step.body && <div style={{ fontSize: '12.5px', color: '#4B5563', lineHeight: 1.5, marginTop: '4px' }}>{step.body}</div>}
                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px' }}>화면을 클릭하면 다음으로 넘어가요</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 컨트롤 바 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.95)', borderRadius: '12px', padding: '8px 14px', boxShadow: '0 6px 24px rgba(0,0,0,0.25)' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#4338ca', background: '#EEF2FF', padding: '3px 10px', borderRadius: '20px' }}>{idx + 1} / {total}</span>
            <button onClick={goPrev} disabled={idx === 0} style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', color: idx === 0 ? '#D1D5DB' : '#374151', fontSize: '12.5px', fontWeight: 600, cursor: idx === 0 ? 'default' : 'pointer' }}>이전</button>
            <button onClick={advance} style={{ height: '32px', padding: '0 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>{idx + 1 >= total ? '완료' : '다음 →'}</button>
            {onClose && <button onClick={onClose} style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#6B7280', fontSize: '12.5px', cursor: 'pointer' }}>종료</button>}
          </div>
        </>
      )}

      <style>{`
        @keyframes mfp-ripple { 0%{opacity:.8;transform:scale(1)} 100%{opacity:0;transform:scale(2.8)} }
        @keyframes mfp-nudge { 0%,100%{} 25%{transform:translate(var(--tx,0),var(--ty,0)) translateX(-6px)} 75%{transform:translateX(6px)} }
      `}</style>
    </div>
  );
}
