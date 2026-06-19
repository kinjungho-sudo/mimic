'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Share2, Download, Pencil, PlayCircle, X, Bot, Play, Pause, Square } from 'lucide-react';
import { GuideToc } from '@/components/editor/GuideToc';
import { GuideViewer } from '@/components/editor/GuideViewer';
import { ShareModal } from '@/components/editor/ShareModal';
import { AgentChat } from '@/components/chat/AgentChat';
import { useTutorial } from '@/hooks/useTutorial';
import { useAuth } from '@/hooks/useAuth';
import type { ManualStep } from '@/components/editor/ManualEditor';
import type { Step, Tutorial } from '@/types';
import type { Annotation } from '@/components/editor/ImageAnnotationEditor';

// ── Adapter ───────────────────────────────────────────────

function clickToPct(v: number | null | undefined): number | null {
  if (v == null) return null;
  if (v <= 1) return v * 100;
  if (v > 100) return v / 100;
  return v;
}

function stepsToManualSteps(steps: Step[]): ManualStep[] {
  return steps.map(s => ({
    id: s.id,
    number: s.step_number,
    actionTitle: s.user_title ?? s.ai_title ?? '',
    titleFontSize: (s as Step & { title_font_size?: number | null }).title_font_size ?? null,
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
    imageOffsetX: (s as Step & { image_offset_x?: number | null }).image_offset_x ?? 0,
    imageOffsetY: (s as Step & { image_offset_y?: number | null }).image_offset_y ?? 0,
    element_rect: (s as Step & { element_rect?: { x: number; y: number; width: number; height: number } | null }).element_rect ?? null,
    click_x: clickToPct((s as Step & { click_x?: number | null }).click_x),
    click_y: clickToPct((s as Step & { click_y?: number | null }).click_y),
  }));
}

// ── Types ─────────────────────────────────────────────────

type RiskyStep = { step_number: number; title: string | null };
type StepResultStatus = 'success' | 'failed' | 'skipped' | 'paused' | 'running';
type StepResult = { step_number: number; status: StepResultStatus; error_message?: string | null };
type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

// ── Page ──────────────────────────────────────────────────

export default function ManualViewerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tutorial, loading, error, publish, unpublish } = useTutorial(id);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user } = useAuth();

  // viewer 역할이면 편집 불가
  const myRole = tutorial ? (tutorial as Tutorial & { my_role?: string }).my_role : null;
  const isViewer = myRole === 'viewer';
  const canEdit = !isViewer;

  const [title, setTitle] = useState('');
  const [manualSteps, setManualSteps] = useState<ManualStep[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [outputRatio, setOutputRatio] = useState<Tutorial['output_ratio']>('16:9');
  const [showShare, setShowShare] = useState(false);
  const [showLiveGuideCreate, setShowLiveGuideCreate] = useState(false);
  const [showPracticeCreate, setShowPracticeCreate] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadingFmt, setDownloadingFmt] = useState<'pdf' | 'pptx' | 'docx' | null>(null);
  // Auto-Run 상태
  const [showAutoRunModal, setShowAutoRunModal] = useState(false);
  const [autoRunLoading, setAutoRunLoading] = useState(false);
  const [preflight, setPreflight] = useState<{ total: number; runnable: number; risky_steps: RiskyStep[] } | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [execStatus, setExecStatus] = useState<ExecutionStatus | null>(null);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tocOpen, setTocOpen] = useState(false);

  useEffect(() => {
    if (!tutorial) return;
    setTitle(tutorial.title);
    setOutputRatio(tutorial.output_ratio ?? '16:9');
    const steps = stepsToManualSteps(tutorial.steps);
    setManualSteps(steps);
    if (tutorial.steps.length > 0 && !activeId) setActiveId(tutorial.steps[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial?.id]);

  // 실행 상태 폴링 (2초 간격)
  useEffect(() => {
    if (!sessionId || !execStatus || ['completed', 'failed'].includes(execStatus)) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/tutorials/${id}/auto-run?session_id=${sessionId}`);
      if (!res.ok) return;
      const data = await res.json() as { status: ExecutionStatus; step_results: StepResult[] };
      setExecStatus(data.status);
      setStepResults(data.step_results ?? []);
      if (['completed', 'failed'].includes(data.status)) clearInterval(pollRef.current!);
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [sessionId, execStatus, id]);

  const handleOpenAutoRun = useCallback(async () => {
    setAutoRunLoading(true);
    setAgreed(false);
    try {
      const res = await fetch(`/api/tutorials/${id}/auto-run`, { method: 'POST' });
      if (!res.ok) { alert('실행 세션 생성에 실패했습니다.'); return; }
      const data = await res.json() as { execution_session_id: string; pre_flight: typeof preflight };
      setSessionId(data.execution_session_id);
      setPreflight(data.pre_flight);
      setStepResults([]);
      setExecStatus('pending');
      setShowAutoRunModal(true);
    } finally {
      setAutoRunLoading(false);
    }
  }, [id]);

  const handleStartAutoRun = useCallback(async () => {
    if (!sessionId) return;
    await fetch(`/api/tutorials/${id}/auto-run`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, status: 'running' }),
    });
    setExecStatus('running');
    setShowAutoRunModal(false);
  }, [sessionId, id]);

  const handlePauseResume = useCallback(async () => {
    if (!sessionId) return;
    const next = execStatus === 'paused' ? 'running' : 'paused';
    await fetch(`/api/tutorials/${id}/auto-run`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, status: next }),
    });
    setExecStatus(next);
  }, [sessionId, execStatus, id]);

  const handleStopAutoRun = useCallback(async () => {
    if (!sessionId) return;
    await fetch(`/api/tutorials/${id}/auto-run`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, status: 'failed' }),
    });
    setExecStatus('failed');
    setSessionId(null);
  }, [sessionId, id]);

  // 통합 다운로드 — PDF / PPTX / Word(docx)를 하나의 핸들러로 처리
  const handleDownload = useCallback(async (fmt: 'pdf' | 'pptx' | 'docx') => {
    setDownloadingFmt(fmt);
    try {
      const res = await fetch(`/api/export/${fmt}/${id}`);
      if (!res.ok) { alert('다운로드 실패. 스텝이 없거나 오류가 발생했습니다.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('content-disposition') ?? '';
      const utf8Match = cd.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = cd.match(/filename="([^"]+)"/i);
      a.download = utf8Match ? decodeURIComponent(utf8Match[1]) : (asciiMatch?.[1] ?? `${title || 'manual'}.${fmt}`);
      a.click();
      URL.revokeObjectURL(url);
      setDownloadOpen(false);
    } finally {
      setDownloadingFmt(null);
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
  const isRunning = execStatus === 'running' || execStatus === 'paused';
  const completedCount = stepResults.filter(r => r.status === 'success').length;
  const totalSteps = manualSteps.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* ── Header ── */}
      <header style={{
        height: '52px', flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        background: 'white',
        borderBottom: `1px solid ${isRunning ? '#a5b4fc' : '#E5E7EB'}`,
        gap: '0', zIndex: 20,
        transition: 'border-color 0.3s',
        boxShadow: isRunning ? '0 0 0 2px rgba(99,102,241,0.15)' : 'none',
      }}>
        {/* Left */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '16px', borderRight: '1px solid #F3F4F6' }}>
          <button
            onClick={() => router.push('/home')}
            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', display: 'grid', placeItems: 'center', color: '#6B7280', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#111827'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#6B7280'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>매뉴얼</span>
          {/* 모바일 전용: TOC 토글 버튼 */}
          <button
            className="viewer-toc-toggle-btn"
            onClick={() => setTocOpen(v => !v)}
            style={{ display: 'none', width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E5E7EB', background: tocOpen ? '#e0e7ff' : 'white', alignItems: 'center', justifyContent: 'center', color: tocOpen ? '#3730a3' : '#6B7280', cursor: 'pointer', flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>

        {/* Center */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '12px' }}>
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{manualSteps.length}개 단계</span>
          {tutorial.status === 'published' && (
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: 500 }}>게시됨</span>
          )}
          {/* Auto-Run 실행 중 상태 표시 */}
          {isRunning && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#6366f1', fontWeight: 600 }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', animation: 'pulse 1.2s ease-in-out infinite', display: 'inline-block' }} />
              AI 실행 중 · BETA — {completedCount} / {totalSteps}
            </span>
          )}
          {execStatus === 'completed' && (
            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>✅ 자동 실행 완료</span>
          )}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Auto-Run 실행 중 제어 버튼 */}
          {isRunning && (
            <>
              <button onClick={handlePauseResume}
                style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#6366f1', background: '#eef2ff', border: '1px solid #c7d2fe', cursor: 'pointer' }}>
                {execStatus === 'paused' ? <Play size={16} /> : <Pause size={16} />}
                {execStatus === 'paused' ? '재개' : '일시정지'}
              </button>
              <button onClick={handleStopAutoRun}
                style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', cursor: 'pointer' }}>
                <Square size={16} /> 중단
              </button>
            </>
          )}

          {/* 통합 다운로드 — 아이콘 클릭 시 PDF/PPTX/Word 선택 */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setDownloadOpen(o => !o)} disabled={!!downloadingFmt}
              title="다운로드 (PDF · PPTX · Word)"
              style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#374151', background: downloadOpen ? '#F3F4F6' : 'white', border: '1px solid #E5E7EB', cursor: downloadingFmt ? 'not-allowed' : 'pointer', opacity: downloadingFmt ? 0.6 : 1 }}
              onMouseEnter={e => { if (!downloadingFmt && !downloadOpen) e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { if (!downloadOpen) e.currentTarget.style.background = 'white'; }}>
              <Download size={18} />
              {downloadingFmt ? '생성 중…' : '다운로드'}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {downloadOpen && (
              <>
                <div onClick={() => setDownloadOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', top: '38px', right: 0, zIndex: 41, background: 'white', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '5px', minWidth: '180px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                  {([
                    { fmt: 'pdf' as const, label: 'PDF 문서', desc: '.pdf' },
                    { fmt: 'pptx' as const, label: 'PowerPoint', desc: '.pptx' },
                    { fmt: 'docx' as const, label: 'Word 문서', desc: '.docx' },
                  ]).map(opt => (
                    <button key={opt.fmt} onClick={() => handleDownload(opt.fmt)} disabled={!!downloadingFmt}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 10px', border: 'none', borderRadius: '6px', background: 'transparent', cursor: downloadingFmt ? 'not-allowed' : 'pointer', textAlign: 'left', fontSize: '12.5px', color: '#374151' }}
                      onMouseEnter={e => { if (!downloadingFmt) e.currentTarget.style.background = '#F3F4F6'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                      <Download size={15} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontWeight: 500 }}>{opt.label}</span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{downloadingFmt === opt.fmt ? '생성 중…' : opt.desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button onClick={() => setShowShare(true)}
            style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}>
            <Share2 size={17} /> 공유
          </button>

          {canEdit && manualSteps.length > 0 && tutorial.share_token && (
            <button
              onClick={() => setShowPracticeCreate(true)}
              title="실습하기 — 캡처 화면 위에서 단계별 인터랙티브 연습"
              style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}>
              <Play size={16} /> 실습하기
            </button>
          )}

          {canEdit && manualSteps.length > 0 && (
            <button
              onClick={() => setShowLiveGuideCreate(true)}
              title="라이브 가이드 편집 및 실행"
              style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#3730a3', background: '#e0e7ff', border: '1px solid #a5b4fc', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#c7d2fe'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#e0e7ff'; }}>
              <PlayCircle size={17} /> 라이브 가이드
            </button>
          )}

          {/* Auto-Run BETA 버튼 — viewer 숨김 */}
          {canEdit && !isRunning && (
            <button onClick={handleOpenAutoRun} disabled={autoRunLoading}
              style={{ height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'white', background: autoRunLoading ? 'rgba(99,102,241,0.6)' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', border: 'none', cursor: autoRunLoading ? 'not-allowed' : 'pointer', boxShadow: '0 1px 6px rgba(99,102,241,0.35)', transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => { if (!autoRunLoading) e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 6px rgba(99,102,241,0.35)'; }}>
              {autoRunLoading
                ? <span style={{ width: '11px', height: '11px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                : <Bot size={15} />}
              Auto-Run
              <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em', padding: '1px 5px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px' }}>BETA</span>
            </button>
          )}

          {/* 편집 버튼 — viewer 숨김 */}
          {canEdit && (
            <button onClick={() => router.push(`/manual/${id}/editor`)}
              style={{ height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}>
              <Pencil size={15} /> 편집
            </button>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* TOC — 데스크탑: 고정 사이드 패널 / 모바일: CSS로 숨김 */}
        <div className="viewer-toc-panel" style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #E5E7EB', background: 'white', minHeight: 0 }}>
          <GuideToc steps={manualSteps} activeId={activeId} onSelect={setActiveId} editable={false} />
        </div>

        {/* 모바일 TOC 오버레이 */}
        {tocOpen && (
          <>
            <div onClick={() => setTocOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
            <div style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: '80%', maxWidth: '300px', background: 'white', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '4px 0 24px rgba(0,0,0,0.18)', animation: 'drawerIn 0.22s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>목차</span>
                <button onClick={() => setTocOpen(false)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: '#F3F4F6', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#6B7280' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <GuideToc steps={manualSteps} activeId={activeId} onSelect={id => { setActiveId(id); setTocOpen(false); }} editable={false} />
              </div>
            </div>
          </>
        )}

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>
          {/* Viewer */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            <div style={{ flexShrink: 0, padding: '14px 40px 12px', borderBottom: '1px solid #E5E7EB', background: 'white', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
              <h1 style={{ flex: 1, margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || '제목 없음'}</h1>
              <span style={{ fontSize: '11px', color: '#C4C9D4', whiteSpace: 'nowrap', flexShrink: 0 }}>{createdAt} 생성</span>
            </div>
            <GuideViewer steps={manualSteps} activeId={activeId} onActiveChange={setActiveId} outputRatio={outputRatio} />
          </div>

          {/* Auto-Run 진행 패널 */}
          {(isRunning || execStatus === 'completed' || execStatus === 'failed') && stepResults.length > 0 && (
            <div style={{ width: '220px', flexShrink: 0, borderLeft: '1px solid #E5E7EB', background: 'white', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <Bot size={13} color="#6366f1" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>실행 결과</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#9CA3AF' }}>{completedCount}/{totalSteps}</span>
              </div>
              <div style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {manualSteps.map(step => {
                  const result = stepResults.find(r => r.step_number === step.number);
                  const status = result?.status;
                  const icon = status === 'success' ? '✅' : status === 'failed' ? '❌' : status === 'skipped' ? '⏭' : status === 'running' ? '⏳' : '○';
                  const color = status === 'success' ? '#10b981' : status === 'failed' ? '#ef4444' : status === 'skipped' ? '#9CA3AF' : '#6366f1';
                  return (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '6px', background: status ? '#F9FAFB' : 'transparent' }}>
                      <span style={{ fontSize: '12px', flexShrink: 0 }}>{icon}</span>
                      <span style={{ fontSize: '11px', color, fontWeight: status ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {step.number}. {step.actionTitle || '(제목 없음)'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Auto-Run Pre-flight 모달 ── */}
      {showAutoRunModal && preflight && (
        <>
          <div onClick={() => setShowAutoRunModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,15,0.55)', zIndex: 60, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(440px, 92vw)', background: 'white', borderRadius: '20px', boxShadow: '0 30px 80px rgba(0,0,0,0.22)', zIndex: 61, overflow: 'hidden' }}>
            {/* 헤더 */}
            <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Bot size={18} color="white" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>AI 자동 실행</h2>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', background: '#eef2ff', color: '#4f46e5', borderRadius: '4px', letterSpacing: '0.05em' }}>BETA</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>Claude 에이전트가 매뉴얼을 자동으로 실행합니다</p>
                </div>
                <button onClick={() => setShowAutoRunModal(false)} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF', padding: '4px' }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* 바디 */}
            <div style={{ padding: '20px 24px' }}>
              {/* 실행 가능 스텝 요약 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>{preflight.total}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>전체 스텝</div>
                </div>
                <div style={{ padding: '12px', background: preflight.runnable === preflight.total ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.05)', borderRadius: '10px', textAlign: 'center', border: `1px solid ${preflight.runnable === preflight.total ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: preflight.runnable === preflight.total ? '#10b981' : '#f59e0b' }}>{preflight.runnable}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>실행 가능</div>
                </div>
              </div>

              {/* 위험 스텝 경고 */}
              {preflight.risky_steps.length > 0 && (
                <div style={{ padding: '12px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px' }}>⚠️</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>위험 스텝 {preflight.risky_steps.length}개 감지</span>
                  </div>
                  {preflight.risky_steps.map((rs, i) => (
                    <div key={i} style={{ fontSize: '11.5px', color: '#6B7280', paddingLeft: '20px', lineHeight: 1.7 }}>
                      · Step {rs.step_number}: {rs.title}
                    </div>
                  ))}
                </div>
              )}

              {/* 실행 방법 안내 */}
              <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: '10px', marginBottom: '16px' }}>
                <div style={{ fontSize: '11.5px', color: '#6B7280', lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>실행 방법</div>
                  <div>1. 이 모달을 닫으면 Claude Code에서 실행을 시작하세요.</div>
                  <div>2. <code style={{ background: '#E5E7EB', padding: '1px 4px', borderRadius: '3px', fontSize: '11px' }}>&quot;[매뉴얼 제목] 자동 실행해줘&quot;</code> 라고 입력하세요.</div>
                  <div>3. Claude가 MIMIC MCP + Playwright로 자동 실행합니다.</div>
                </div>
              </div>

              {/* 동의 체크박스 */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', marginBottom: '20px' }}>
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  style={{ marginTop: '2px', flexShrink: 0, accentColor: '#4f46e5' }} />
                <span style={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.55 }}>
                  AI 자동 실행 중 발생하는 결과(클릭, 입력, 이동 등)에 대한 책임은 사용자에게 있음에 동의합니다.
                </span>
              </label>

              {/* 버튼 */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowAutoRunModal(false)}
                  style={{ flex: 1, height: '40px', borderRadius: '9px', border: '1px solid #E5E7EB', background: 'white', fontSize: '13px', color: '#374151', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}>
                  취소
                </button>
                <button onClick={handleStartAutoRun} disabled={!agreed}
                  style={{ flex: 2, height: '40px', borderRadius: '9px', border: 'none', background: agreed ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : '#E5E7EB', color: agreed ? 'white' : '#9CA3AF', fontSize: '13.5px', fontWeight: 600, cursor: agreed ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s' }}>
                  <Bot size={14} /> 실행 시작
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showShare && (
        <ShareModal
          title={title}
          shareToken={tutorial.share_token}
          shareUrl={tutorial.share_token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/play/${tutorial.share_token}` : null}
          tutorialId={id}
          hasPassword={!!(tutorial as typeof tutorial & { share_password?: string | null }).share_password}
          visibility={tutorial.visibility}
          onPublishAndShare={publish}
          onUnpublish={unpublish}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* 실습하기 — '시작'을 눌러야 플레이어로 진입 */}
      {showPracticeCreate && tutorial.share_token && (
        <div onClick={() => setShowPracticeCreate(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,10,18,0.55)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '380px', background: 'white', borderRadius: '16px', padding: '26px 24px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#f0fdf4', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
              <Play size={24} style={{ color: '#16a34a' }} />
            </div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>실습하기</div>
            <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.6, marginBottom: '20px' }}>
              캡처된 화면 위에서 단계별로 클릭을 연습합니다.<br />스튜디오에서 핫스팟·말풍선을 편집할 수도 있어요.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setShowPracticeCreate(false); router.push(`/manual/${id}/studio`); }}
                style={{ flex: 1, height: '40px', borderRadius: '10px', border: '1px solid #E5E7EB', background: 'white', color: '#6B7280', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                스튜디오 편집
              </button>
              <button onClick={() => { setShowPracticeCreate(false); window.open(`/play/${tutorial.share_token}`, '_blank'); }}
                style={{ flex: 1.6, height: '40px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Play size={15} /> 실습 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 라이브 가이드 — '생성'을 눌러야 스튜디오로 진입 */}
      {showLiveGuideCreate && (
        <div onClick={() => setShowLiveGuideCreate(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,10,18,0.55)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '380px', background: 'white', borderRadius: '16px', padding: '26px 24px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#e0e7ff', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
              <PlayCircle size={24} style={{ color: '#3730a3' }} />
            </div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>라이브 가이드 만들기</div>
            <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.6, marginBottom: '20px' }}>
              이 매뉴얼로 실제 화면 위에서 단계별로 안내하는<br />라이브 가이드를 생성합니다. 스튜디오에서 핫스팟·말풍선을 편집할 수 있어요.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowLiveGuideCreate(false)}
                style={{ flex: 1, height: '40px', borderRadius: '10px', border: '1px solid #E5E7EB', background: 'white', color: '#6B7280', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' }}>
                취소
              </button>
              <button onClick={() => { setShowLiveGuideCreate(false); router.push(`/manual/${id}/studio`); }}
                style={{ flex: 1.6, height: '40px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <PlayCircle size={15} /> 생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 챗봇 — 항상 떠있는 도우미 (우하단 고정) */}
      <AgentChat />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
}
