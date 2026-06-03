'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Share2, Download, Pencil, PlayCircle, X } from 'lucide-react';
import { GuideToc } from '@/components/editor/GuideToc';
import { GuideViewer } from '@/components/editor/GuideViewer';
import { ShareModal } from '@/components/editor/ShareModal';
import { useTutorial } from '@/hooks/useTutorial';
import { useAuth } from '@/hooks/useAuth';
import type { ManualStep } from '@/components/editor/ManualEditor';
import type { Step, Tutorial } from '@/types';
import type { Annotation } from '@/components/editor/ImageAnnotationEditor';

// ── Adapter ───────────────────────────────────────────────

function stepsToManualSteps(steps: Step[]): ManualStep[] {
  return steps.map(s => ({
    id: s.id,
    number: s.step_number,
    actionTitle: s.user_title ?? s.ai_title ?? '',
    description: s.user_script ?? s.ai_description ?? '',
    screenshotUrl: s.screenshot_url || undefined,
    annotations: (s.user_annotations as Annotation[] | null) ?? [],
    pageUrl:        s.page_url        ?? null,
    domainHostname: s.domain_hostname ?? null,
    domainName:     s.domain_name     ?? null,
    domainFavicon:  s.domain_favicon  ?? null,
    domain_name:    s.domain_name     ?? null,
    domain_favicon: s.domain_favicon  ?? null,
    is_stale: (s as Step & { is_stale?: boolean }).is_stale ?? false,
    imageZoom: (s as Step & { image_zoom?: number | null }).image_zoom ?? 1,
  }));
}

// ── Page ──────────────────────────────────────────────────

export default function ManualViewerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tutorial, loading, error, publish, unpublish } = useTutorial(id);
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [manualSteps, setManualSteps] = useState<ManualStep[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [outputRatio, setOutputRatio] = useState<Tutorial['output_ratio']>('16:9');
  const [showShare, setShowShare] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [guideMePreviewUrl, setGuideMePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!tutorial) return;
    setTitle(tutorial.title);
    setOutputRatio(tutorial.output_ratio ?? '16:9');
    const steps = stepsToManualSteps(tutorial.steps);
    setManualSteps(steps);
    if (tutorial.steps.length > 0 && !activeId) {
      setActiveId(tutorial.steps[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial?.id]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/export/pdf/${id}`);
      if (!res.ok) { alert('내보내기 실패. 스텝이 없거나 오류가 발생했습니다.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('content-disposition') ?? '';
      const utf8Match = cd.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = cd.match(/filename="([^"]+)"/i);
      a.download = utf8Match ? decodeURIComponent(utf8Match[1]) : (asciiMatch?.[1] ?? `${title || 'manual'}.pdf`);
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [id, title]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F8F9FA' }}>
        <div style={{ textAlign: 'center', color: '#6B7280' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(55,48,163,0.18)', borderTopColor: '#3730a3', animation: 'spin 0.9s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontSize: '14px' }}>매뉴얼 불러오는 중…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !tutorial) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F8F9FA' }}>
        <div style={{ textAlign: 'center', color: '#6B7280' }}>
          <p style={{ fontSize: '15px', marginBottom: '16px' }}>{error ?? '매뉴얼을 찾을 수 없어요.'}</p>
          <button onClick={() => router.push('/home')} style={{ padding: '10px 20px', borderRadius: '8px', background: '#3730a3', color: 'white', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const createdAt = new Date(tutorial.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* ── Header ── */}
      <header style={{
        height: '52px', flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        background: 'white',
        borderBottom: '1px solid #E5E7EB',
        gap: '0',
        zIndex: 20,
      }}>
        {/* Left */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '16px', borderRight: '1px solid #F3F4F6' }}>
          <button
            onClick={() => router.push('/home')}
            title="대시보드로 돌아가기"
            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', display: 'grid', placeItems: 'center', color: '#6B7280', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#111827'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#6B7280'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>매뉴얼</span>
        </div>

        {/* Center */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '12px' }}>
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{manualSteps.length}개 단계</span>
          {tutorial.status === 'published' && (
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: 500 }}>
              게시됨
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleExport}
            disabled={exporting}
            title="PDF 내보내기"
            style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.6 : 1 }}
            onMouseEnter={e => { if (!exporting) e.currentTarget.style.background = '#F9FAFB'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
          >
            <Download size={13} /> {exporting ? '생성 중…' : 'PDF'}
          </button>

          <button
            onClick={() => setShowShare(true)}
            style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
          >
            <Share2 size={13} /> 공유
          </button>

          {tutorial.share_token && manualSteps.some(s => s.pageUrl) && (
            <button
              onClick={() => {
                const firstUrl = manualSteps.find(s => s.pageUrl)?.pageUrl;
                if (!firstUrl) return;
                setGuideMePreviewUrl(`${firstUrl}${firstUrl.includes('?') ? '&' : '?'}mimic_guide=${tutorial.share_token}`);
              }}
              title="실제 페이지에서 Guide Me 미리보기"
              style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#3730a3', background: '#e0e7ff', border: '1px solid #a5b4fc', cursor: 'pointer' }}
            >
              <PlayCircle size={13} /> Guide Me
            </button>
          )}

          {/* 편집 버튼 — 편집기 페이지로 이동 */}
          <button
            onClick={() => router.push(`/manual/${id}/editor`)}
            style={{ height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'white', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', border: 'none', cursor: 'pointer', boxShadow: '0 1px 6px rgba(55,48,163,0.3)', transition: 'box-shadow 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(55,48,163,0.45)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 6px rgba(55,48,163,0.3)'; }}
          >
            <Pencil size={13} /> 편집
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* TOC */}
        <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #E5E7EB', background: 'white', minHeight: 0 }}>
          <GuideToc
            steps={manualSteps}
            activeId={activeId}
            onSelect={setActiveId}
            editable={false}
          />
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {/* Title banner */}
          <div style={{ flexShrink: 0, padding: '14px 40px 12px', borderBottom: '1px solid #E5E7EB', background: 'white', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <h1 style={{ flex: 1, margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title || '제목 없음'}
            </h1>
            <span style={{ fontSize: '11px', color: '#C4C9D4', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {createdAt} 생성
            </span>
          </div>

          <GuideViewer
            steps={manualSteps}
            activeId={activeId}
            onActiveChange={setActiveId}
            outputRatio={outputRatio}
          />
        </div>
      </div>

      {/* Guide Me iframe */}
      {guideMePreviewUrl && (
        <>
          <div onClick={() => setGuideMePreviewUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,15,0.55)', zIndex: 60, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(1100px, 94vw)', height: 'min(700px, 90vh)', background: 'white', borderRadius: '16px', boxShadow: '0 30px 80px rgba(0,0,0,0.25)', zIndex: 61, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Guide Me 미리보기</span>
              <button onClick={() => setGuideMePreviewUrl(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF', padding: '4px' }}>
                <X size={16} />
              </button>
            </div>
            <iframe src={guideMePreviewUrl} style={{ flex: 1, border: 'none', width: '100%' }} title="Guide Me 미리보기" />
          </div>
        </>
      )}

      {showShare && (
        <ShareModal
          title={title}
          shareToken={tutorial.share_token}
          shareUrl={tutorial.share_token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/play/${tutorial.share_token}` : null}
          onPublishAndShare={publish}
          onUnpublish={unpublish}
          onClose={() => setShowShare(false)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
