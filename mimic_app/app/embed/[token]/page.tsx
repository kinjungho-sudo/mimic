'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AnnotationPreview } from '@/components/editor/AnnotationPreview';
import type { Annotation } from '@/components/editor/ImageAnnotationEditor';

interface EmbedStep {
  id: string;
  title: string;
  caption: string;
  screenshot_url: string | null;
  user_annotations?: Annotation[];
}

interface EmbedAnnotation {
  id: string;
  step_id: string;
  title: string;
  body: string;
}

interface EmbedPayload {
  id: string;
  title: string;
  steps: EmbedStep[];
  annotations: EmbedAnnotation[];
}

export default function EmbedPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<EmbedPayload | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'protected' | 'notfound'>('loading');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    fetch(`/api/play/${token}`)
      .then(async r => {
        if (!r.ok) { setState('notfound'); return; }
        const json = await r.json();
        if (json?.protected) { setState('protected'); return; }
        setData(json);
        setState('ready');
      })
      .catch(() => setState('notfound'));
  }, [token]);

  if (state === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F8F9FA' }}>
        <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '3px solid rgba(55,48,163,0.15)', borderTopColor: '#3730a3', animation: 'embspin 0.8s linear infinite' }} />
        <style>{`@keyframes embspin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (state === 'notfound' || state === 'protected') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F8F9FA', padding: '24px' }}>
        <div style={{ textAlign: 'center', color: '#6B7280', fontSize: '13.5px', lineHeight: 1.6 }}>
          {state === 'protected'
            ? '비밀번호로 보호된 매뉴얼입니다.'
            : '매뉴얼을 찾을 수 없습니다.'}
          <br />
          <a href={`/play/${token}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-block', marginTop: '12px', color: '#3730a3', fontWeight: 600, textDecoration: 'none', fontSize: '13px' }}>
            전체 화면에서 열기 →
          </a>
        </div>
      </div>
    );
  }

  const tutorial = data!;

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', padding: isMobile ? '20px 0 40px' : '32px 0 56px' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: isMobile ? '0 12px' : '0 20px' }}>
        <h1 style={{ fontSize: isMobile ? '18px' : '23px', fontWeight: 700, color: '#111827', marginBottom: isMobile ? '16px' : '24px', letterSpacing: '-0.02em' }}>
          {tutorial.title}
        </h1>

        {tutorial.steps.map((step, idx) => {
          const annotations = tutorial.annotations.filter(a => a.step_id === step.id);
          return (
            <div key={step.id} style={{ marginBottom: isMobile ? '16px' : '28px', background: 'white', borderRadius: isMobile ? '10px' : '14px', border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 6px rgba(17,24,39,0.06)' }}>
              <div style={{ padding: isMobile ? '13px 15px 11px' : '16px 22px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px', borderBottom: step.screenshot_url ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ width: '27px', height: '27px', borderRadius: '7px', background: '#3730a3', color: 'white', fontSize: '12px', fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {String(idx + 1).padStart(2, '0')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: isMobile ? '14px' : '15.5px', fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>{step.title}</h3>
                  {step.caption && <p style={{ margin: '5px 0 0', fontSize: isMobile ? '13px' : '13.5px', color: '#4B5563', lineHeight: 1.65 }}>{step.caption}</p>}
                </div>
              </div>
              {step.screenshot_url && (
                <div style={{ position: 'relative', background: '#F3F4F6' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={step.screenshot_url} alt={step.title} style={{ width: '100%', display: 'block' }} />
                  {(step.user_annotations?.length ?? 0) > 0 && (
                    <AnnotationPreview
                      annotations={step.user_annotations!}
                      imageUrl={step.screenshot_url}
                    />
                  )}
                </div>
              )}
              {annotations.length > 0 && (
                <div style={{ padding: isMobile ? '12px 15px' : '14px 22px', borderTop: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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

        {/* MIMIC 워터마크 — 전체 화면 링크 */}
        <div style={{ textAlign: 'center', marginTop: isMobile ? '14px' : '20px' }}>
          <a href={`/play/${token}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: '#9CA3AF', textDecoration: 'none' }}>
            <span style={{ fontWeight: 700, fontFamily: 'Georgia, serif', color: '#6B7280' }}>MIMIC</span>으로 제작 · 전체 화면에서 보기 →
          </a>
        </div>
      </div>
    </div>
  );
}
