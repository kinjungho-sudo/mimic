'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';

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
  steps: Step[];
  markers: Marker[];
  annotations: Annotation[];
  audio_assets: AudioAsset[];
};

function PasswordGate({ protectedTitle, token, onUnlock }: { protectedTitle: string; token: string; onUnlock: (data: Tutorial) => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!pw.trim()) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/play/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) { setError(true); return; }
      const data = await res.json();
      onUnlock(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0A0A0F', display: 'grid', placeItems: 'center', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '380px', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(79,70,229,0.15)', border: '1px solid rgba(79,70,229,0.3)', display: 'grid', placeItems: 'center', margin: '0 auto 20px', color: '#818CF8' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'white', margin: '0 0 8px' }}>{protectedTitle}</h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>이 매뉴얼은 비밀번호로 보호되어 있습니다.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(false); }}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="비밀번호 입력"
            autoFocus
            style={{
              width: '100%', height: '46px', padding: '0 16px',
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${error ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none',
              fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s',
            }}
          />
          {error && <p style={{ fontSize: '12px', color: '#F87171', margin: 0 }}>비밀번호가 틀렸습니다.</p>}
          <button
            onClick={submit}
            disabled={loading || !pw.trim()}
            style={{
              height: '46px', borderRadius: '10px', border: 'none',
              background: pw.trim() ? 'linear-gradient(135deg, #4F46E5, #7C3AED)' : 'rgba(255,255,255,0.08)',
              color: pw.trim() ? 'white' : 'rgba(255,255,255,0.3)',
              fontSize: '14px', fontWeight: 600, cursor: pw.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s', boxShadow: pw.trim() ? '0 4px 14px rgba(79,70,229,0.35)' : 'none',
            }}
          >
            {loading ? '확인 중…' : '입장하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlayerPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [protectedTitle, setProtectedTitle] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [showDesc, setShowDesc] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed] = useState('1.25x');
  const [isPlaying, setIsPlaying] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch(`/api/play/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data.protected) {
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
    if (!tutorial) return;
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
  }, [currentStep, tutorial]);

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
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#4F46E5', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>불러오는 중...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0A0A0F', display: 'grid', placeItems: 'center', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>404</div>
          <h1 style={{ fontSize: '20px', fontWeight: 500, marginBottom: '8px' }}>매뉴얼을 찾을 수 없어요</h1>
          <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>링크가 만료되었거나 잘못된 주소입니다.</p>
          <Link href="/landingpage" style={{ display: 'inline-block', padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>홈으로</Link>
        </div>
      </div>
    );
  }

  if (passwordRequired && !tutorial) {
    return <PasswordGate protectedTitle={protectedTitle} token={token} onUnlock={data => { setTutorial(data); setPasswordRequired(false); }} />;
  }

  if (!tutorial) return null;

  const step = tutorial.steps[currentStep] ?? null;
  const stepMarkers = step ? tutorial.markers.filter(m => m.step_id === step.id).sort((a, b) => a.order_index - b.order_index) : [];
  const stepAnnotations = step ? tutorial.annotations.filter(a => a.step_id === step.id).sort((a, b) => a.marker_index - b.marker_index) : [];
  const totalSteps = tutorial.steps.length;

  const goTo = (idx: number) => {
    setCurrentStep(Math.max(0, Math.min(idx, totalSteps - 1)));
    setIsPlaying(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0A0A0F', display: 'flex', flexDirection: 'column', fontFamily: "'Pretendard', -apple-system, sans-serif", color: 'white', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '14px', background: 'linear-gradient(180deg, rgba(0,0,0,0.5), transparent)', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500, opacity: 0.9 }}>
          <BrandMark /> MIMIC
          <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 8px' }}>·</span>
        </div>
        <span style={{ fontSize: '13.5px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '380px' }}>{tutorial.title}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          {[
            { title: '공유', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> },
            { title: '다운로드', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
            { title: '전체화면', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg> },
          ].map(btn => (
            <button key={btn.title} title={btn.title} onClick={btn.title === '전체화면' ? () => document.documentElement.requestFullscreen?.() : undefined}
              style={{ width: '36px', height: '36px', borderRadius: '8px', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.7)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.18s ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
            >{btn.icon}</button>
          ))}
          <button title="종료" onClick={() => window.history.back()}
            style={{ width: '36px', height: '36px', borderRadius: '8px', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.7)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.18s ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </header>

      {/* Sidebar trigger */}
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '30px', zIndex: 30, cursor: 'pointer' }}
        onMouseEnter={() => setShowSidebar(true)} onMouseLeave={() => setShowSidebar(false)}
      />

      {/* Sidebar */}
      <aside onMouseEnter={() => setShowSidebar(true)} onMouseLeave={() => setShowSidebar(false)}
        style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '220px', background: 'rgba(20,20,28,0.85)', backdropFilter: 'blur(20px)', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '64px 14px 20px', zIndex: 28, transform: showSidebar ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.2s ease' }}
      >
        <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', padding: '0 6px', fontWeight: 500 }}>슬라이드</div>
        {tutorial.steps.map((s, idx) => {
          const isDone = idx < currentStep;
          const isCurrent = idx === currentStep;
          return (
            <div key={s.id} onClick={() => { goTo(idx); setShowSidebar(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '7px', fontSize: '12px', color: isCurrent ? 'white' : 'rgba(255,255,255,0.7)', cursor: 'pointer', marginBottom: '2px', background: isCurrent ? 'rgba(79,70,229,0.18)' : 'transparent', transition: 'background 0.18s ease' }}
              onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: isDone ? '#10B981' : isCurrent ? '#4F46E5' : 'rgba(255,255,255,0.10)', display: 'grid', placeItems: 'center', fontSize: '10px', fontWeight: 500, flexShrink: 0, color: 'white' }}>
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
        <div style={{ position: 'absolute', top: '50%', left: '6px', transform: 'translateY(-50%)', width: '20px', height: '40px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.08)', borderRadius: '0 8px 8px 0', color: 'rgba(255,255,255,0.5)', zIndex: 25 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      )}

      {/* Canvas */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `88px ${showDesc && stepAnnotations.length > 0 ? '360px' : '56px'} 120px 56px`, transition: 'padding-right 0.3s ease' }}>
        {/* Chapter card */}
        {step && (
          <div style={{ position: 'absolute', top: '78px', left: '36px', background: 'rgba(255,255,255,0.92)', color: '#111827', padding: '8px 14px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', zIndex: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', borderRadius: '999px', fontSize: '10.5px', fontWeight: 500, whiteSpace: 'nowrap' }}>Step {currentStep + 1}</span>
            <span style={{ color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>{step.title}</span>
          </div>
        )}

        <div style={{ width: '100%', maxWidth: '1100px', aspectRatio: '16/9', background: 'white', borderRadius: '12px', position: 'relative', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)' }}>
          {step?.screenshot_url ? (
            <img src={step.screenshot_url} alt={step.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
              <div style={{ textAlign: 'center', color: '#9CA3AF' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', opacity: 0.4 }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p style={{ fontSize: '13px', margin: 0 }}>{step?.title ?? '스크린샷 없음'}</p>
              </div>
            </div>
          )}

          {/* Markers */}
          {stepMarkers.map((m, i) => (
            <span key={m.id} style={{ position: 'absolute', top: `${m.y_pct}%`, left: `${m.x_pct}%`, width: '32px', height: '32px', borderRadius: '50%', background: i === stepMarkers.length - 1 ? '#4F46E5' : '#DC2626', color: 'white', display: 'grid', placeItems: 'center', fontSize: '13px', fontWeight: 500, zIndex: 5, boxShadow: i === stepMarkers.length - 1 ? '0 0 0 8px rgba(79,70,229,0.25), 0 4px 12px rgba(79,70,229,0.5)' : '0 4px 12px rgba(220,38,38,0.4)', transform: 'translate(-50%, -50%)' }}>
              {m.label || (i + 1)}
            </span>
          ))}

          {/* Caption */}
          {step?.caption && (
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: '24px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '10px 18px', borderRadius: '8px', fontSize: '13.5px', maxWidth: '76%', textAlign: 'center', zIndex: 6 }}>
              {step.caption}
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
              <div key={ann.id} style={{ display: 'flex', gap: '12px', padding: '12px 10px', borderRadius: '8px', marginBottom: '4px', background: isLast ? 'rgba(79,70,229,0.18)' : 'transparent', cursor: 'pointer' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: isLast ? '#4F46E5' : 'rgba(255,255,255,0.10)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 500, flexShrink: 0, marginTop: '1px' }}>{i + 1}</span>
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
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 24px', background: 'linear-gradient(0deg, rgba(0,0,0,0.5), transparent)', display: 'flex', alignItems: 'center', gap: '18px', zIndex: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => goTo(currentStep - 1)} disabled={currentStep === 0}
            style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none', cursor: currentStep === 0 ? 'not-allowed' : 'pointer', opacity: currentStep === 0 ? 0.4 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={() => setIsPlaying(p => !p)}
            style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'white', color: '#111', display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.4)', transition: 'transform 0.18s ease' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isPlaying
              ? <svg width="20" height="20" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor"/></svg>
            }
          </button>
          <button onClick={() => goTo(currentStep + 1)} disabled={currentStep === totalSteps - 1}
            style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none', cursor: currentStep === totalSteps - 1 ? 'not-allowed' : 'pointer', opacity: currentStep === totalSteps - 1 ? 0.4 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', height: '28px' }}>
            {tutorial.steps.map((_, idx) => {
              const isDone = idx < currentStep;
              const isCurrent = idx === currentStep;
              return (
                <span key={idx} onClick={() => goTo(idx)} style={{ width: isCurrent ? '16px' : '10px', height: isCurrent ? '16px' : '10px', borderRadius: '50%', background: isDone ? '#4F46E5' : isCurrent ? 'white' : 'rgba(255,255,255,0.25)', cursor: 'pointer', flexShrink: 0, boxShadow: isCurrent ? '0 0 0 3px rgba(79,70,229,0.6)' : 'none', transition: 'all 0.18s ease' }} />
              );
            })}
          </div>
          <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.75)', marginLeft: '12px', whiteSpace: 'nowrap' }}>
            {currentStep + 1} / {totalSteps} 슬라이드{step ? ` · ${step.title}` : ''}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {stepAnnotations.length > 0 && (
            <button onClick={() => setShowDesc(d => !d)} title="설명 패널"
              style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: showDesc ? 'rgba(79,70,229,0.3)' : 'rgba(255,255,255,0.08)', color: 'white', border: 'none', cursor: 'pointer', transition: 'background 0.18s ease' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            </button>
          )}
          <div style={{ position: 'relative' }} ref={settingsRef}>
            <button onClick={() => setShowSettings(s => !s)} title="설정"
              style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none', cursor: 'pointer', transition: 'background 0.18s ease' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>

            {/* Settings popover */}
            {showSettings && (
              <div style={{ position: 'absolute', right: '0', bottom: '52px', width: '280px', background: 'rgba(20,20,28,0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', color: 'white', zIndex: 25, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                <h4 style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)', margin: '0 0 8px', fontWeight: 500 }}>재생 속도</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                  {['1.0x', '1.25x', '1.5x', '2.0x'].map(s => (
                    <button key={s} onClick={() => setSpeed(s)}
                      style={{ padding: '6px', borderRadius: '6px', fontSize: '11px', color: speed === s ? 'white' : 'rgba(255,255,255,0.7)', background: speed === s ? '#4F46E5' : 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
