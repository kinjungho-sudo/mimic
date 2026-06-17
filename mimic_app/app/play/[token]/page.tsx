'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';
import { AnnotationPreview } from '@/components/editor/AnnotationPreview';
import { InteractiveFollowPlayer } from '@/components/viewer/InteractiveFollowPlayer';
import { createClient } from '@/lib/supabase/client';
import { toFollowSteps, clickToPct } from '@/lib/follow';
import type { FollowConfig } from '@/types';
import type { Annotation as DrawAnnotation } from '@/components/editor/ImageAnnotationEditor';

type Marker = {
  id: string;
  step_id: string;
  x_pct: number;
  y_pct: number;
  label: string;
  order_index: number;
};

type Annotation = {
  id: string;
  step_id: string;
  title: string;
  body: string;
  marker_index: number;
};

type Step = {
  id: string;
  title: string;
  caption: string;
  screenshot_url: string | null;
  order_index: number;
  click_x: number | null;
  click_y: number | null;
  image_zoom?: number | null;
  image_offset_x?: number | null;
  image_offset_y?: number | null;
  user_annotations?: DrawAnnotation[];
  follow_config?: FollowConfig | null;
};

type AudioAsset = {
  id: string;
  step_id: string;
  audio_url: string;
  duration_ms: number;
};

type Tutorial = {
  id: string;
  title: string;
  tts_enabled: boolean;
  steps: Step[];
  markers: Marker[];
  annotations: Annotation[];
  audio_assets: AudioAsset[];
};

type SurveyState = {
  ease: number;
  reuse: number;
  useful: number;
  reproduce: boolean | null;
  comment: string;
};


function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: 'inline-flex', gap: '4px' }}>
      {[1,2,3,4,5].map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          onMouseEnter={() => setHovered(v)}
          onMouseLeave={() => setHovered(0)}
          style={{
            width: '32px', height: '32px', borderRadius: '6px',
            display: 'grid', placeItems: 'center', fontSize: '18px', cursor: 'pointer',
            background: (hovered || value) >= v ? 'rgba(245,158,11,0.16)' : '#F9FAFB',
            color: (hovered || value) >= v ? '#F59E0B' : '#9CA3AF',
            border: 'none', transition: 'all 0.15s ease',
          }}
        >★</button>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SurveyModal({ tutorialId, viewerSessionId, onClose }: { tutorialId: string; viewerSessionId: string; onClose: () => void }) {
  const [survey, setSurvey] = useState<SurveyState>({ ease: 0, reuse: 0, useful: 0, reproduce: null, comment: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorial_id: tutorialId,
          viewer_session_id: viewerSessionId,
          q1_easier_than_pdf: survey.ease || 3,
          q2_would_use_again: survey.reuse || 3,
          q3_useful_for_work: survey.useful || 3,
          q4_can_reproduce: survey.reproduce ?? true,
          q5_additional_feedback: survey.comment || undefined,
        }),
      });
    } catch {}
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,15,0.78)', zIndex: 100, display: 'grid', placeItems: 'center', padding: '32px', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: '100%', maxWidth: '520px', background: 'white', color: '#111827', borderRadius: '18px', padding: '32px', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Head */}
        <div style={{ marginBottom: '26px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', margin: '0 auto 16px', borderRadius: '16px', background: 'linear-gradient(135deg, #e0e7ff, #F5F3FF)', display: 'grid', placeItems: 'center', color: '#3730a3' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 13a3 3 0 1 0 0-6M5.436 13.683A4.001 4.001 0 0 1 7 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 0 1-1.564-.317z"/></svg>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 500, margin: '0 0 6px' }}>매뉴얼 어떠셨나요?</h2>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>5문항 · 30초면 끝나요. 다음 매뉴얼이 더 좋아질 거예요.</p>
        </div>

        {/* Q1 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>1. PDF보다 따라하기 쉬웠나요? <span style={{ fontSize: '11.5px', color: '#6B7280', fontWeight: 400 }}>(별점)</span></label>
          <StarRating value={survey.ease} onChange={v => setSurvey(s => ({ ...s, ease: v }))} />
        </div>

        {/* Q2 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>2. 다시 사용할 의향이 있나요?</label>
          <StarRating value={survey.reuse} onChange={v => setSurvey(s => ({ ...s, reuse: v }))} />
        </div>

        {/* Q3 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>3. 업무에 도움이 됐나요?</label>
          <StarRating value={survey.useful} onChange={v => setSurvey(s => ({ ...s, useful: v }))} />
        </div>

        {/* Q4 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>4. 혼자 재현이 가능할 것 같나요?</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{ label: '네, 가능해요', value: true }, { label: '아니요', value: false }].map(opt => (
              <button key={String(opt.value)} onClick={() => setSurvey(s => ({ ...s, reproduce: opt.value }))}
                style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: `1px solid ${survey.reproduce === opt.value ? '#3730a3' : '#E5E7EB'}`, background: survey.reproduce === opt.value ? '#e0e7ff' : 'white', fontSize: '13px', color: survey.reproduce === opt.value ? '#3730a3' : '#4B5563', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease' }}
              >{opt.label}</button>
            ))}
          </div>
        </div>

        {/* Q5 */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>5. 추가로 남기고 싶은 말씀이 있나요? <span style={{ fontSize: '11.5px', color: '#6B7280', fontWeight: 400 }}>(선택)</span></label>
          <textarea value={survey.comment} onChange={e => setSurvey(s => ({ ...s, comment: e.target.value }))}
            placeholder="자유롭게 의견을 남겨주세요. (예: 자막 속도, 음성 톤, 추가하면 좋을 기능 등)"
            style={{ width: '100%', minHeight: '80px', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontFamily: 'inherit', fontSize: '12.5px', lineHeight: 1.6, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #F3F4F6' }}>
          <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: '#6B7280', cursor: 'pointer', background: 'none', border: 'none' }}>건너뛰기</button>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(55,48,163,0.25)', opacity: submitting ? 0.7 : 1 }}
          >{submitting ? '제출 중...' : '제출하기'}</button>
        </div>
      </div>
    </div>
  );
}

// ── 문서형 뷰 ─────────────────────────────────────────────

function DocumentView({ tutorial }: { tutorial: Tutorial }) {
  const [isMobileDoc, setIsMobileDoc] = useState(false);
  useEffect(() => {
    const check = () => setIsMobileDoc(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#F8F9FA', padding: isMobileDoc ? '24px 0 60px' : '40px 0 80px' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: isMobileDoc ? '0 12px' : '0 24px' }}>
        <h1 style={{ fontSize: isMobileDoc ? '20px' : '26px', fontWeight: 700, color: '#111827', marginBottom: isMobileDoc ? '20px' : '32px', letterSpacing: '-0.02em' }}>
          {tutorial.title}
        </h1>
        {tutorial.steps.map((step, idx) => {
          const annotations = tutorial.annotations.filter(a => a.step_id === step.id);
          return (
            <div key={step.id} style={{ marginBottom: isMobileDoc ? '20px' : '40px', background: 'white', borderRadius: isMobileDoc ? '10px' : '14px', border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 6px rgba(17,24,39,0.06)' }}>
              {/* 스텝 헤더 */}
              <div style={{ padding: isMobileDoc ? '14px 16px 12px' : '18px 24px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px', borderBottom: step.screenshot_url ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#3730a3', color: 'white', fontSize: '12px', fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {String(idx + 1).padStart(2, '0')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: isMobileDoc ? '14px' : '16px', fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>{step.title}</h3>
                  {step.caption && <p style={{ margin: '5px 0 0', fontSize: isMobileDoc ? '13px' : '14px', color: '#4B5563', lineHeight: 1.65 }}>{step.caption}</p>}
                </div>
              </div>
              {/* 스크린샷 + 어노테이션 오버레이 */}
              {step.screenshot_url && (
                <div style={{ position: 'relative', lineHeight: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={step.screenshot_url} alt={step.title} style={{ width: '100%', display: 'block' }} />
                  {(step.user_annotations?.length ?? 0) > 0 && (
                    <AnnotationPreview annotations={step.user_annotations!} imageUrl={step.screenshot_url} />
                  )}
                </div>
              )}
              {/* 어노테이션 */}
              {annotations.length > 0 && (
                <div style={{ padding: isMobileDoc ? '12px 16px' : '16px 24px', borderTop: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {annotations.map((ann, i) => (
                    <div key={ann.id} style={{ display: 'flex', gap: '10px' }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#e0e7ff', color: '#3730a3', fontSize: '11px', fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{i + 1}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{ann.title}</div>
                        {ann.body && <p style={{ fontSize: '12.5px', color: '#6B7280', margin: '2px 0 0', lineHeight: 1.5 }}>{ann.body}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SharePopup({ title, url, onClose }: { title: string; url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [tab, setTab] = useState<'kakao' | 'email'>('kakao');

  // Kakao SDK 초기화 — async 로드 완료를 기다렸다가 init
  useEffect(() => {
    const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!jsKey) return;

    const tryInit = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Kakao = (window as any).Kakao;
      if (!Kakao) return false;
      if (!Kakao.isInitialized()) Kakao.init(jsKey);
      return true;
    };

    if (tryInit()) return;

    // SDK가 아직 로드 중이면 load 이벤트 기다림
    const script = document.querySelector('script[src*="kakao"]') as HTMLScriptElement | null;
    if (!script) return;
    const onLoad = () => tryInit();
    script.addEventListener('load', onLoad);
    return () => script.removeEventListener('load', onLoad);
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKakao = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Kakao = (window as any).Kakao;
    if (!Kakao) {
      window.open(`kakaotalk://msg/send?text=${encodeURIComponent(`${title}\n${url}`)}`, '_blank');
      return;
    }
    if (!Kakao.isInitialized()) {
      const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (jsKey) Kakao.init(jsKey);
    }
    if (!Kakao.isInitialized()) {
      window.open(`kakaotalk://msg/send?text=${encodeURIComponent(`${title}\n${url}`)}`, '_blank');
      return;
    }
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title,
        description: 'MIMIC으로 만든 단계별 인터랙티브 매뉴얼입니다.',
        imageUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/mimic-logo.png`,
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [{ title: '매뉴얼 보기', link: { mobileWebUrl: url, webUrl: url } }],
    });
  };

  const handleEmailSend = async () => {
    if (!emailTo.trim()) return;
    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await fetch('/api/share/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailTo.trim(), tutorialTitle: title, shareUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailResult({ ok: false, msg: data.error ?? '발송 실패' });
      } else {
        setEmailResult({ ok: true, msg: `${emailTo}로 발송했습니다.` });
        setEmailTo('');
      }
    } catch {
      setEmailResult({ ok: false, msg: '네트워크 오류가 발생했습니다.' });
    } finally {
      setEmailSending(false);
    }
  };

  const tabBtn = (key: typeof tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      style={{ flex: 1, height: '36px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: tab === key ? 600 : 400, background: tab === key ? 'white' : 'transparent', color: tab === key ? '#111827' : '#9CA3AF', boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none', transition: 'all 0.12s' }}
    >{label}</button>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', maxWidth: '420px', background: 'white', borderRadius: '20px', boxShadow: '0 30px 80px rgba(0,0,0,0.3)', zIndex: 81, padding: '28px 24px', fontFamily: "'Pretendard', -apple-system, sans-serif", color: '#111827' }}>
        {/* 닫기 */}
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', width: '30px', height: '30px', borderRadius: '8px', border: 'none', background: '#F3F4F6', color: '#6B7280', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#E5E7EB'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#F3F4F6'; }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <h2 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 4px' }}>공유하기</h2>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>

        {/* 링크 복사 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input readOnly value={url} style={{ flex: 1, padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: '9px', fontSize: '12px', color: '#374151', background: '#F9FAFB', outline: 'none', fontFamily: 'ui-monospace, monospace', minWidth: 0 }} />
          <button onClick={handleCopy} style={{ flexShrink: 0, padding: '0 14px', height: '40px', borderRadius: '9px', border: 'none', background: copied ? '#10B981' : '#111827', color: 'white', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'background 0.18s', whiteSpace: 'nowrap' }}>
            {copied ? '복사됨 ✓' : '링크 복사'}
          </button>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: '10px', padding: '3px', gap: '2px', marginBottom: '16px' }}>
          {tabBtn('kakao', '카카오톡으로 보내기')}
          {tabBtn('email', '이메일로 보내기')}
        </div>

        {/* 카카오톡 탭 */}
        {tab === 'kakao' && (
          <div>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 14px', lineHeight: 1.5 }}>
              카카오톡 친구 목록에서 보낼 대상을 선택합니다.
            </p>
            <button onClick={handleKakao} style={{ width: '100%', height: '48px', borderRadius: '10px', border: 'none', background: '#FEE500', color: '#391B1B', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'filter 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.96)'; }}
              onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}>
              <svg width="20" height="20" viewBox="0 0 18 18" fill="currentColor">
                <path d="M9 0C4.03 0 0 3.13 0 6.99c0 2.49 1.56 4.68 3.91 5.93l-.99 3.68c-.09.34.29.61.59.41L7.7 14.4c.43.06.87.09 1.3.09 4.97 0 9-3.13 9-6.99C18 3.13 13.97 0 9 0z"/>
              </svg>
              카카오톡으로 공유하기
            </button>
          </div>
        )}

        {/* 이메일 탭 */}
        {tab === 'email' && (
          <div>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 12px', lineHeight: 1.5 }}>
              받는 사람의 이메일 주소를 입력하면 매뉴얼 링크가 담긴 메일을 발송합니다.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                value={emailTo}
                onChange={e => { setEmailTo(e.target.value); setEmailResult(null); }}
                onKeyDown={e => { if (e.key === 'Enter') handleEmailSend(); }}
                placeholder="example@email.com"
                style={{ flex: 1, padding: '10px 14px', border: `1.5px solid ${emailResult?.ok === false ? '#EF4444' : '#E5E7EB'}`, borderRadius: '9px', fontSize: '13.5px', color: '#111827', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#3730a3'; }}
                onBlur={e => { e.currentTarget.style.borderColor = emailResult?.ok === false ? '#EF4444' : '#E5E7EB'; }}
              />
              <button
                onClick={handleEmailSend}
                disabled={emailSending || !emailTo.trim()}
                style={{ flexShrink: 0, padding: '0 16px', height: '42px', borderRadius: '9px', border: 'none', background: emailTo.trim() ? 'linear-gradient(135deg,#3730a3,#6d28d9)' : '#E5E7EB', color: emailTo.trim() ? 'white' : '#9CA3AF', fontSize: '13.5px', fontWeight: 600, cursor: emailTo.trim() && !emailSending ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', transition: 'background 0.15s', opacity: emailSending ? 0.7 : 1 }}
              >
                {emailSending ? '발송 중…' : '보내기'}
              </button>
            </div>
            {emailResult && (
              <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: emailResult.ok ? '#10B981' : '#EF4444', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {emailResult.ok ? '✓' : '✕'} {emailResult.msg}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── 비밀번호 게이트 ──────────────────────────────────────
function PasswordGate({ protectedTitle, token, onUnlock }: {
  protectedTitle: string;
  token: string;
  onUnlock: (data: Tutorial) => void;
}) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!pw.trim()) return;
    setLoading(true); setError(false);
    try {
      const res = await fetch(`/api/play/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) { setError(true); return; }
      onUnlock(await res.json());
    } catch { setError(true); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0A0A0F', display: 'grid', placeItems: 'center', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '380px', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(55,48,163,0.15)', border: '1px solid rgba(55,48,163,0.3)', display: 'grid', placeItems: 'center', margin: '0 auto 20px', color: '#818CF8' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'white', margin: '0 0 8px' }}>비밀번호 보호됨</h1>
          <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            {protectedTitle || '이 매뉴얼'}을 보려면 비밀번호를 입력하세요.
          </p>
        </div>
        <input
          type="password"
          value={pw}
          onChange={e => { setPw(e.target.value); setError(false); }}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="비밀번호"
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box', height: '48px', padding: '0 16px',
            background: 'rgba(255,255,255,0.06)', border: `1px solid ${error ? '#EF4444' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: '10px', color: 'white', fontSize: '15px', outline: 'none',
            fontFamily: 'inherit', marginBottom: error ? '8px' : '16px',
          }}
        />
        {error && <p style={{ fontSize: '12.5px', color: '#EF4444', margin: '0 0 16px' }}>비밀번호가 올바르지 않아요.</p>}
        <button
          onClick={submit}
          disabled={loading || !pw.trim()}
          style={{
            width: '100%', height: '48px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #3730a3, #6d28d9)',
            color: 'white', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading || !pw.trim() ? 0.6 : 1,
          }}
        >
          {loading ? '확인 중…' : '확인'}
        </button>
      </div>
    </div>
  );
}

// ── 플레이어 메인 ─────────────────────────────────────────

export default function PlayerPage() {
  const { token } = useParams<{ token: string }>();
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [protectedTitle, setProtectedTitle] = useState('');
  const [viewMode, setViewMode] = useState<'follow' | 'slides' | 'document'>('document');
  const [currentStep, setCurrentStep] = useState(0);
  const [showDesc, setShowDesc] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed] = useState('1.25x');
  const [isPlaying, setIsPlaying] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true); // 뷰어에서 음소거 여부 (기본 켜짐)
  const settingsRef = useRef<HTMLDivElement>(null);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  // 따라하기 소프트 게이트: 비로그인은 맛보기(처음 2스텝)만 — 로그인 상태 확인
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    createClient().auth.getSession()
      .then(({ data }) => { setIsAuthed(!!data.session); })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    fetch(`/api/play/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        if (data?.protected) {
          setProtectedTitle(data.title ?? '');
          setPasswordRequired(true);
          setLoading(false);
          return;
        }
        setTutorial(data);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [token]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!tutorial || !tutorial.tts_enabled) return;
    if (!ttsEnabled) {
      audioRef.current?.pause();
      return;
    }
    const asset = tutorial.audio_assets.find(a => a.step_id === tutorial.steps[currentStep]?.id);
    if (!asset) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    const audio = new Audio(asset.audio_url);
    audioRef.current = audio;
    audio.play().catch(() => {});
    return () => { audio.pause(); };
  }, [currentStep, tutorial, ttsEnabled]);

  useEffect(() => {
    if (isPlaying && tutorial) {
      playTimerRef.current = setInterval(() => {
        setCurrentStep(s => {
          if (s < tutorial.steps.length - 1) return s + 1;
          setIsPlaying(false);
          clearInterval(playTimerRef.current!);
          return s;
        });
      }, 3000);
    } else if (!isPlaying && playTimerRef.current) {
      clearInterval(playTimerRef.current);
    }
    return () => { if (playTimerRef.current) clearInterval(playTimerRef.current); };
  }, [isPlaying, tutorial]);

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0A0A0F', display: 'grid', placeItems: 'center', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#3730a3', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>불러오는 중...</p>
        </div>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes stepSlideIn {
            from { opacity: 0; transform: translateY(10px) scale(0.995); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes hotspotPop {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
            to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          }
          @keyframes hotspotRipple {
            0%   { opacity: 0.85; transform: scale(1); }
            100% { opacity: 0;    transform: scale(7); }
          }
          @keyframes hotspotDotPulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.3; }
          }
        `}</style>
      </div>
    );
  }

  if (passwordRequired) {
    return <PasswordGate protectedTitle={protectedTitle} token={token} onUnlock={data => { setTutorial(data); setPasswordRequired(false); }} />;
  }

  if (notFound || !tutorial) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0A0A0F', display: 'grid', placeItems: 'center', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>404</div>
          <h1 style={{ fontSize: '20px', fontWeight: 500, marginBottom: '8px' }}>매뉴얼을 찾을 수 없어요</h1>
          <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>링크가 만료되었거나 잘못된 주소입니다.</p>
          <Link href="/landingpage" style={{ display: 'inline-block', padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>홈으로</Link>
        </div>
      </div>
    );
  }

  const step = tutorial.steps[currentStep] ?? null;
  const stepMarkers = step ? tutorial.markers.filter(m => m.step_id === step.id).sort((a, b) => a.order_index - b.order_index) : [];
  const stepAnnotations = step ? tutorial.annotations.filter(a => a.step_id === step.id).sort((a, b) => a.marker_index - b.marker_index) : [];
  const totalSteps = tutorial.steps.length;

  const goTo = (idx: number) => {
    setCurrentStep(Math.max(0, Math.min(idx, totalSteps - 1)));
    setIsPlaying(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: viewMode === 'document' ? '#F8F9FA' : '#0A0A0F', display: 'flex', flexDirection: 'column', fontFamily: "'Pretendard', -apple-system, sans-serif", color: viewMode === 'document' ? '#111827' : 'white', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{
        position: 'relative', zIndex: 30, flexShrink: 0,
        height: isMobile ? '52px' : '56px', padding: isMobile ? '0 12px' : '0 20px',
        display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px',
        background: viewMode === 'document' ? 'white' : 'rgba(10,10,15,0.85)',
        borderBottom: viewMode === 'document' ? '1px solid #E5E7EB' : '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* 브랜드 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, flexShrink: 0, color: viewMode === 'document' ? '#111827' : 'white' }}>
          <BrandMark />
          {!isMobile && <span>MIMIC</span>}
        </div>
        {!isMobile && <span style={{ color: viewMode === 'document' ? '#D1D5DB' : 'rgba(255,255,255,0.2)' }}>·</span>}
        <span style={{ fontSize: isMobile ? '13px' : '13.5px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, color: viewMode === 'document' ? '#374151' : 'rgba(255,255,255,0.9)' }}>
          {tutorial.title}
        </span>

        {/* 우측 액션 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '6px', flexShrink: 0 }}>
          {/* 모드 토글: 웹 문서 ↔ 슬라이드 */}
          <div style={{ display: 'flex', background: viewMode === 'document' ? '#F3F4F6' : 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '3px', gap: '2px' }}>
            {([
              { key: 'document', label: '웹 문서', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="12" y2="16"/></svg> },
              { key: 'slides', label: '슬라이드', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
            ] as { key: 'document' | 'slides'; label: string; icon: React.ReactNode }[]).map(tab => {
              const active = viewMode === tab.key;
              const activeColor = viewMode === 'document' ? '#3730a3' : 'white';
              const inactiveColor = viewMode === 'document' ? '#6B7280' : 'rgba(255,255,255,0.5)';
              return (
                <button key={tab.key} onClick={() => setViewMode(tab.key)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: isMobile ? '5px 8px' : '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: active ? 600 : 400, background: active ? (viewMode === 'document' ? 'rgba(55,48,163,0.1)' : 'rgba(255,255,255,0.15)') : 'transparent', color: active ? activeColor : inactiveColor, transition: 'all 0.12s', boxShadow: 'none' }}>
                  {tab.icon}{!isMobile && tab.label}
                </button>
              );
            })}
          </div>

          {/* 따라하기 — 별도 강조 버튼(우측 분리, 특별 색상) */}
          {(() => {
            const active = viewMode === 'follow';
            return (
              <button onClick={() => setViewMode('follow')} title="따라하기 — 직접 클릭하며 실습"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: isMobile ? '6px 9px' : '6px 13px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, border: active ? 'none' : '1.5px solid #7c3aed', background: active ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'rgba(124,58,237,0.12)', color: active ? 'white' : '#7c3aed', boxShadow: active ? '0 2px 12px rgba(124,58,237,0.5)' : 'none', transition: 'all 0.12s' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                {!isMobile && '따라하기'}
              </button>
            );
          })()}


          {/* 전체화면 — 모바일에서 숨김 */}
          {!isMobile && (
            <button title="전체화면" onClick={() => {
                if (document.fullscreenElement) document.exitFullscreen?.();
                else document.documentElement.requestFullscreen?.();
              }}
              style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.6)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
            </button>
          )}
        </div>
      </header>

      {/* ── 따라하기 (인터랙티브) 모드 ── */}
      {viewMode === 'follow' && (
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <InteractiveFollowPlayer
            title={tutorial.title}
            lockAfterStep={authChecked && !isAuthed ? 1 : null}
            steps={toFollowSteps(tutorial.steps.map(s => ({
              title: s.title,
              body: s.caption,
              screenshotUrl: s.screenshot_url,
              clickXPct: clickToPct(s.click_x),
              clickYPct: clickToPct(s.click_y),
              audioUrl: tutorial.audio_assets?.find(a => a.step_id === s.id)?.audio_url ?? null,
              followConfig: s.follow_config ?? null,
            })))}
          />
        </div>
      )}

      {/* ── 문서형 모드 ── */}
      {viewMode === 'document' && <DocumentView tutorial={tutorial} />}

      {/* ── 슬라이드 모드 ── */}
      {viewMode === 'slides' && <>

      {/* Sidebar trigger — 데스크톱 호버 영역 */}
      {!isMobile && (
        <div style={{ position: 'absolute', top: '56px', left: 0, bottom: 0, width: '30px', zIndex: 30, cursor: 'pointer' }}
          onMouseEnter={() => setShowSidebar(true)} onMouseLeave={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar 오버레이 — 모바일에서 사이드바 열릴 때 배경 클릭으로 닫기 */}
      {isMobile && showSidebar && (
        <div onClick={() => setShowSidebar(false)}
          style={{ position: 'absolute', inset: 0, zIndex: 27, background: 'rgba(0,0,0,0.5)' }}
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={() => { if (!isMobile) setShowSidebar(true); }}
        onMouseLeave={() => { if (!isMobile) setShowSidebar(false); }}
        style={{ position: 'absolute', top: isMobile ? '52px' : '56px', left: 0, bottom: 0, width: isMobile ? '260px' : '220px', background: 'rgba(20,20,28,0.92)', backdropFilter: 'blur(20px)', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '20px 14px 20px', zIndex: 28, transform: showSidebar ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.2s ease' }}
      >
        <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', padding: '0 6px', fontWeight: 500 }}>슬라이드</div>
        {tutorial.steps.map((s, idx) => {
          const isDone = idx < currentStep;
          const isCurrent = idx === currentStep;
          return (
            <div key={s.id} onClick={() => { goTo(idx); setShowSidebar(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '7px', fontSize: '12px', color: isCurrent ? 'white' : 'rgba(255,255,255,0.7)', cursor: 'pointer', marginBottom: '2px', background: isCurrent ? 'rgba(55,48,163,0.18)' : 'transparent', transition: 'background 0.18s ease' }}
              onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: isDone ? '#10B981' : isCurrent ? '#3730a3' : 'rgba(255,255,255,0.10)', display: 'grid', placeItems: 'center', fontSize: '10px', fontWeight: 500, flexShrink: 0, color: 'white' }}>
                {isDone ? '✓' : idx + 1}
              </span>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
            </div>
          );
        })}
        <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '7px', fontSize: '11px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>클릭해서 원하는 슬라이드로 이동할 수 있어요.</div>
      </aside>

      {/* Sidebar hint arrow */}
      {!showSidebar && (
        <div
          onClick={() => isMobile && setShowSidebar(true)}
          style={{ position: 'absolute', top: '50%', left: '6px', transform: 'translateY(-50%)', width: '20px', height: '40px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.08)', borderRadius: '0 8px 8px 0', color: 'rgba(255,255,255,0.5)', zIndex: 25, cursor: isMobile ? 'pointer' : 'default' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      )}

      {/* Canvas */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? `${(isMobile ? 52 : 56) + 32}px 12px ${isMobile ? 100 : 120}px 12px` : `88px ${showDesc && stepAnnotations.length > 0 ? '360px' : '56px'} 120px 56px`, transition: 'padding-right 0.3s ease' }}>
        {/* Chapter card */}
        {step && (
          <div style={{ position: 'absolute', top: '78px', left: '36px', background: 'rgba(255,255,255,0.92)', color: '#111827', padding: '8px 14px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', zIndex: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', borderRadius: '999px', fontSize: '10.5px', fontWeight: 500, whiteSpace: 'nowrap' }}>Step {currentStep + 1}</span>
            <span style={{ color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>{step.title}</span>
          </div>
        )}

        {/* 이미지 컨테이너: 원본 비율 유지 — objectFit:cover 제거로 어노테이션 좌표 정확히 일치 */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '1100px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)', background: '#111' }}>
          {step?.screenshot_url ? (
            <>
            {/* 이미지 + 어노테이션 + 마커 — 확대 transform 적용 (자막은 이 밖에 둠) */}
            <div key={currentStep} style={{ position: 'relative', lineHeight: 0, animation: 'stepSlideIn 0.35s cubic-bezier(0.22,0.61,0.36,1) both', transform: (step.image_zoom ?? 1) > 1 ? `translate(${(step.image_offset_x ?? 0) * 100}%, ${(step.image_offset_y ?? 0) * 100}%) scale(${step.image_zoom})` : undefined, transformOrigin: 'center center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={step.screenshot_url}
                alt={step.title}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
              {/* 어노테이션 — 이미지와 동일한 크기 SVG로 정확히 겹침 */}
              {(step.user_annotations?.length ?? 0) > 0 && (
                <AnnotationPreview annotations={step.user_annotations!} imageUrl={step.screenshot_url} />
              )}
              {/* Hotspot — 클릭 위치 시각 표시만 (진행은 하단 컨트롤로, 클릭 강제 없음) */}
              {step.click_x != null && step.click_y != null && currentStep < totalSteps - 1 && (
                <span
                  style={{
                    position: 'absolute',
                    left: `${step.click_x * 100}%`,
                    top: `${step.click_y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    width: '64px', height: '64px',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    zIndex: 10,
                    animation: 'hotspotPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
                    animationDelay: '0.3s',
                  }}
                >
                  {/* 중심 점 */}
                  <span style={{ position: 'absolute', top: '50%', left: '50%', width: '10px', height: '10px', marginTop: '-5px', marginLeft: '-5px', borderRadius: '50%', background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 8px rgba(255,255,255,0.7), 0 0 16px rgba(99,102,241,0.5)', animation: 'hotspotDotPulse 1.8s ease-in-out infinite' }} />
                  {/* 파문 링 1 */}
                  <span style={{ position: 'absolute', top: '50%', left: '50%', width: '10px', height: '10px', marginTop: '-5px', marginLeft: '-5px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.75)', boxShadow: '0 0 4px rgba(99,102,241,0.4)', animation: 'hotspotRipple 2s ease-out infinite', animationDelay: '0s' }} />
                  {/* 파문 링 2 */}
                  <span style={{ position: 'absolute', top: '50%', left: '50%', width: '10px', height: '10px', marginTop: '-5px', marginLeft: '-5px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.55)', boxShadow: '0 0 4px rgba(99,102,241,0.3)', animation: 'hotspotRipple 2s ease-out infinite', animationDelay: '0.65s' }} />
                  {/* 파문 링 3 */}
                  <span style={{ position: 'absolute', top: '50%', left: '50%', width: '10px', height: '10px', marginTop: '-5px', marginLeft: '-5px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.35)', boxShadow: '0 0 4px rgba(99,102,241,0.2)', animation: 'hotspotRipple 2s ease-out infinite', animationDelay: '1.3s' }} />
                </span>
              )}
              {/* 마커 */}
              {stepMarkers.map((m, i) => (
                <span key={m.id} style={{ position: 'absolute', top: `${m.y_pct}%`, left: `${m.x_pct}%`, width: '32px', height: '32px', borderRadius: '50%', background: i === stepMarkers.length - 1 ? '#3730a3' : '#DC2626', color: 'white', display: 'grid', placeItems: 'center', fontSize: '13px', fontWeight: 500, zIndex: 5, boxShadow: i === stepMarkers.length - 1 ? '0 0 0 8px rgba(55,48,163,0.25), 0 4px 12px rgba(55,48,163,0.5)' : '0 4px 12px rgba(220,38,38,0.4)', transform: 'translate(-50%, -50%)' }}>
                  {m.label || (i + 1)}
                </span>
              ))}
            </div>
            {/* 자막 — 확대 컨테이너 밖(프레임 직속)에 두어 확대 시에도 잘리지 않음 */}
            {step.caption && (
              <div style={{
                position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                bottom: '20px',
                background: 'rgba(0,0,0,0.82)',
                backdropFilter: 'blur(8px)',
                color: 'white',
                padding: '12px 22px',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 400,
                lineHeight: 1.65,
                maxWidth: '82%',
                textAlign: 'center',
                zIndex: 6,
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                letterSpacing: '0.01em',
                whiteSpace: 'pre-wrap',
              }}>
                {step.caption}
              </div>
            )}
            </>
          ) : (
            <div style={{ aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
              <div style={{ textAlign: 'center', color: '#9CA3AF' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', opacity: 0.4 }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p style={{ fontSize: '13px', margin: 0 }}>{step?.title ?? '스크린샷 없음'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right description panel */}
      {stepAnnotations.length > 0 && (
        <aside style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '320px', background: 'rgba(20,20,28,0.85)', backdropFilter: 'blur(20px)', borderLeft: '1px solid rgba(255,255,255,0.08)', padding: '64px 18px 100px', zIndex: 18, overflowY: 'auto', transform: showDesc ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '12px', fontSize: '13px', fontWeight: 500 }}>
            <span>항목별 설명</span>
            <button onClick={() => setShowDesc(false)} style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.7)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          {stepAnnotations.map((ann, i) => {
            const isLast = i === stepAnnotations.length - 1;
            return (
              <div key={ann.id} style={{ display: 'flex', gap: '12px', padding: '12px 10px', borderRadius: '8px', marginBottom: '4px', background: isLast ? 'rgba(55,48,163,0.18)' : 'transparent', cursor: 'pointer' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: isLast ? '#3730a3' : 'rgba(255,255,255,0.10)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 500, flexShrink: 0, marginTop: '1px' }}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: '12.5px', color: 'white', fontWeight: 500, marginBottom: '4px' }}>{ann.title}</div>
                  <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, margin: 0 }}>{ann.body}</p>
                </div>
              </div>
            );
          })}
        </aside>
      )}

      {/* Bottom controls */}
      <div className="player-controls" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: isMobile ? '14px 16px 20px' : '18px 24px', background: 'linear-gradient(0deg, rgba(0,0,0,0.55), transparent)', display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '18px', zIndex: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px' }}>
          <button onClick={() => goTo(currentStep - 1)} disabled={currentStep === 0}
            style={{ width: isMobile ? '40px' : '36px', height: isMobile ? '40px' : '36px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none', cursor: currentStep === 0 ? 'not-allowed' : 'pointer', opacity: currentStep === 0 ? 0.4 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={() => setIsPlaying(p => !p)}
            style={{ width: isMobile ? '48px' : '52px', height: isMobile ? '48px' : '52px', borderRadius: '50%', background: 'white', color: '#111', display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.4)', transition: 'transform 0.18s ease' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isPlaying
              ? <svg width="20" height="20" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor"/></svg>
            }
          </button>
          <button onClick={() => goTo(currentStep + 1)} disabled={currentStep === totalSteps - 1}
            style={{ width: isMobile ? '40px' : '36px', height: isMobile ? '40px' : '36px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none', cursor: currentStep === totalSteps - 1 ? 'not-allowed' : 'pointer', opacity: currentStep === totalSteps - 1 ? 0.4 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '6px', height: '28px', flexWrap: 'wrap', overflow: 'hidden' }}>
            {tutorial.steps.map((_, idx) => {
              const isDone = idx < currentStep;
              const isCurrent = idx === currentStep;
              return (
                <span key={idx} onClick={() => goTo(idx)} style={{ width: isCurrent ? (isMobile ? '12px' : '16px') : (isMobile ? '8px' : '10px'), height: isCurrent ? (isMobile ? '12px' : '16px') : (isMobile ? '8px' : '10px'), borderRadius: '50%', background: isDone ? '#3730a3' : isCurrent ? 'white' : 'rgba(255,255,255,0.25)', cursor: 'pointer', flexShrink: 0, boxShadow: isCurrent ? '0 0 0 3px rgba(55,48,163,0.6)' : 'none', transition: 'all 0.18s ease' }} />
              );
            })}
          </div>
          {!isMobile && (
            <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.75)', marginLeft: '12px', whiteSpace: 'nowrap' }}>
              {currentStep + 1} / {totalSteps} 슬라이드{step ? ` · ${step.title}` : ''}
            </span>
          )}
          {isMobile && (
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {currentStep + 1} / {totalSteps}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {stepAnnotations.length > 0 && !isMobile && (
            <button onClick={() => setShowDesc(d => !d)} title="설명 패널"
              style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: showDesc ? 'rgba(55,48,163,0.3)' : 'rgba(255,255,255,0.08)', color: 'white', border: 'none', cursor: 'pointer', transition: 'background 0.18s ease' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            </button>
          )}
          <div style={{ position: 'relative' }} ref={settingsRef}>
            <button onClick={() => setShowSettings(s => !s)} title="설정"
              style={{ width: isMobile ? '40px' : '36px', height: isMobile ? '40px' : '36px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none', cursor: 'pointer', transition: 'background 0.18s ease' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>

            {/* Settings popover */}
            {showSettings && (
              <div style={{ position: 'absolute', right: '0', bottom: '52px', width: '280px', background: 'rgba(20,20,28,0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', color: 'white', zIndex: 25, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                <h4 style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)', margin: '0 0 8px', fontWeight: 500 }}>재생 속도</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                  {['1.0x', '1.25x', '1.5x', '2.0x'].map(s => (
                    <button key={s} onClick={() => setSpeed(s)}
                      style={{ padding: '6px', borderRadius: '6px', fontSize: '11px', color: speed === s ? 'white' : 'rgba(255,255,255,0.7)', background: speed === s ? '#3730a3' : 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                    >{s}</button>
                  ))}
                </div>
                {tutorial.tts_enabled && (
                  <>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '12px 0' }} />
                    <h4 style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)', margin: '0 0 8px', fontWeight: 500 }}>AI 음성</h4>
                    <button
                      onClick={() => setTtsEnabled(v => !v)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '7px', border: 'none', background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: '12px', cursor: 'pointer' }}
                    >
                      <span>{ttsEnabled ? '🔊 음성 켜짐' : '🔇 음성 꺼짐'}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: ttsEnabled ? '#3730a3' : 'rgba(255,255,255,0.1)' }}>
                        {ttsEnabled ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      </>}

    </div>
  );
}
