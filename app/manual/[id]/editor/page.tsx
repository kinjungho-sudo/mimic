'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Share2, Check, Download, Pencil, Undo2, Settings, Video } from 'lucide-react';
import { GuideToc } from '@/components/editor/GuideToc';
import { GuideViewer } from '@/components/editor/GuideViewer';
import { ManualEditor, ManualStep } from '@/components/editor/ManualEditor';
import { ShareModal } from '@/components/editor/ShareModal';
import { useTutorial } from '@/hooks/useTutorial';
import { useAutosave } from '@/hooks/useAutosave';
import { updateStep } from '@/lib/api/steps';
import type { Step, Tutorial } from '@/types';

// ── Adapters ──────────────────────────────────────────────

function stepsToManualSteps(steps: Step[]): ManualStep[] {
  return steps.map(s => ({
    id: s.id,
    number: s.step_number,
    actionTitle: s.user_title ?? s.ai_title ?? '',
    description: s.user_script ?? s.ai_description ?? '',
    screenshotUrl: s.screenshot_url || undefined,
    annotations: (s.user_annotations as import('@/components/editor/ImageAnnotationEditor').Annotation[] | null) ?? [],
    pageUrl:         s.page_url        ?? null,
    domainHostname:  s.domain_hostname ?? null,
    domainName:      s.domain_name     ?? null,
    domainFavicon:   s.domain_favicon  ?? null,
    // legacy fields kept for EditorDomainHeader in ManualEditor
    domain_name:    s.domain_name     ?? null,
    domain_favicon: s.domain_favicon  ?? null,
  }));
}

// ── Page ──────────────────────────────────────────────────

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tutorial, loading, error, publish, unpublish } = useTutorial(id);

  const [title, setTitle] = useState('');
  const [manualSteps, setManualSteps] = useState<ManualStep[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [titleDirty, setTitleDirty] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [outputRatio, setOutputRatio] = useState<Tutorial['output_ratio']>('16:9');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recording, setRecording] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const mergePollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stepSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Undo history
  const historyRef = useRef<ManualStep[][]>([]);
  const setManualStepsWithHistory = useCallback((next: ManualStep[]) => {
    historyRef.current = [...historyRef.current.slice(-49), manualSteps];
    setManualSteps(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualSteps]);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setManualSteps(prev);
  }, []);

  // Ctrl+Z shortcut (edit mode only, skip when typing)
  useEffect(() => {
    if (!editMode) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) return;
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editMode, handleUndo]);

  // Seed state from fetched tutorial
  useEffect(() => {
    if (!tutorial) return;
    setTitle(tutorial.title);
    setOutputRatio(tutorial.output_ratio ?? '16:9');
    setThumbnailUrl(tutorial.thumbnail_url ?? null);
    const steps = stepsToManualSteps(tutorial.steps);
    setManualSteps(steps);
    if (tutorial.steps.length > 0 && !activeId) {
      setActiveId(tutorial.steps[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial?.id]);

  // 설정 패널 외부 클릭 닫기
  useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettings]);

  // Autosave title
  useAutosave(id, titleDirty ? { title } : null);

  const handleSave = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const results = await Promise.all(
        manualSteps
          .filter(s => !s.id.startsWith('step-'))
          .map(s => {
            clearTimeout(stepSaveTimers.current[s.id]);
            return updateStep(s.id, {
              user_title: s.actionTitle || null,
              user_script: s.description || null,
              user_annotations: s.annotations ?? [],
            }).then(() => true).catch(() => false);
          })
      );
      const allOk = results.every(r => r);
      if (!allOk) {
        alert('일부 단계를 저장하지 못했습니다. 네트워크 연결을 확인 후 다시 시도해 주세요.');
        return false;
      }
      return true;
    } finally {
      setSaving(false);
    }
  }, [manualSteps]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/export/pdf/${id}`);
      if (!res.ok) { alert('내보내기 실패. 스텝이 없거나 오류가 발생했습니다.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ?? 'manual.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [id]);

  const handleRatioChange = useCallback(async (ratio: Tutorial['output_ratio']) => {
    setOutputRatio(ratio);
    setShowSettings(false);
    await fetch(`/api/tutorials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ output_ratio: ratio }),
    }).catch(() => {});
  }, [id]);

  const handleThumbnailUpload = useCallback(async (file: File) => {
    setThumbnailUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/tutorials/${id}/thumbnail`, { method: 'POST', body: form });
      if (!res.ok) { alert('썸네일 업로드에 실패했습니다.'); return; }
      const { thumbnail_url } = await res.json();
      setThumbnailUrl(thumbnail_url);
    } finally {
      setThumbnailUploading(false);
    }
  }, [id]);

  const handleThumbnailDelete = useCallback(async () => {
    if (!confirm('썸네일을 삭제할까요?')) return;
    await fetch(`/api/tutorials/${id}/thumbnail`, { method: 'DELETE' });
    setThumbnailUrl(null);
  }, [id]);

  const handlePublish = useCallback(async () => {
    try {
      const result = await publish();
      const url = result.share_url ?? `${window.location.origin}/play/${result.share_token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      alert(`게시 완료!\n링크가 클립보드에 복사되었습니다:\n${url}`);
    } catch {
      alert('게시 중 오류가 발생했습니다.');
    }
  }, [publish]);

  const handleAddRecording = useCallback(async () => {
    const EXT_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cr = (window as any).chrome;
    if (!EXT_ID || !cr?.runtime) {
      alert('MIMIC Recorder 크롬 확장이 설치되어 있지 않습니다.\n확장을 설치한 후 다시 시도해주세요.');
      return;
    }

    const recordingStartedAt = Date.now();

    cr.runtime.sendMessage(EXT_ID, { action: 'GET_TABS' }, (res: { tabs?: { id: number; title: string; url: string }[] }) => {
      const tabs = res?.tabs ?? [];
      const eligible = tabs.filter((t: { url: string }) => t.url.startsWith('http'));
      if (!eligible.length) {
        alert('녹화 가능한 탭을 찾을 수 없습니다. 브라우저에서 웹페이지를 열어두세요.');
        return;
      }
      const tabId = eligible[0].id;
      cr.runtime.sendMessage(EXT_ID, { action: 'START_RECORDING', tabId }, (startRes: { ok?: boolean }) => {
        if (!startRes?.ok) {
          alert('녹화 시작에 실패했습니다. 확장 상태를 확인해주세요.');
          return;
        }
        setRecording(true);
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          if (attempts > 120) {
            clearInterval(poll);
            setRecording(false);
            return;
          }
          try {
            const res = await fetch('/api/tutorials');
            if (!res.ok) return;
            const tutorials = await res.json();
            const newest = Array.isArray(tutorials) ? tutorials[0] : null;
            if (newest && newest.id !== id && new Date(newest.created_at).getTime() > recordingStartedAt - 60_000) {
              clearInterval(poll);
              mergePollerRef.current = null;
              setRecording(false);
              const mergeRes = await fetch(`/api/tutorials/${id}/merge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_tutorial_id: newest.id }),
              });
              if (!mergeRes.ok) {
                alert('병합에 실패했습니다. 새로 생성된 매뉴얼에서 스텝을 수동으로 복사해주세요.');
                return;
              }
              const { merged } = await mergeRes.json();
              window.location.reload();
              alert(`녹화 완료! ${merged}개 스텝이 추가되었습니다.`);
            }
          } catch { /* ignore */ }
        }, 5000);
        mergePollerRef.current = poll;
      });
    });
  }, [id]);

  const handleDeleteStep = useCallback((stepId: string) => {
    setManualStepsWithHistory(
      manualSteps.filter(s => s.id !== stepId).map((s, i) => ({ ...s, number: i + 1 }))
    );
    if (activeId === stepId) setActiveId(manualSteps.find(s => s.id !== stepId)?.id ?? null);
  }, [manualSteps, activeId, setManualStepsWithHistory]);

  const handleAddStep = useCallback(() => {
    const newStep: ManualStep = {
      id: `step-${Date.now()}`,
      number: manualSteps.length + 1,
      actionTitle: '새 단계',
      description: '',
    };
    setManualStepsWithHistory([...manualSteps, newStep]);
    setActiveId(newStep.id);
  }, [manualSteps, setManualStepsWithHistory]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F8F9FA' }}>
        <div style={{ textAlign: 'center', color: '#6B7280' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(79,70,229,0.18)', borderTopColor: '#4F46E5', animation: 'spin 0.9s linear infinite', margin: '0 auto 16px' }} />
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
          <button onClick={() => router.push('/home')} style={{ padding: '10px 20px', borderRadius: '8px', background: '#4F46E5', color: 'white', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const createdAt = new Date(tutorial.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* ── Top header ── */}
      <header style={{
        height: '52px', flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        background: 'white',
        borderBottom: '1px solid #E5E7EB',
        gap: '0',
        zIndex: 20,
      }}>
        {/* Left: back button + logo area (60px sidebar width) */}
        <div style={{ width: '60px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            onClick={() => router.push('/home')}
            title="대시보드로 돌아가기"
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              border: '1px solid #E5E7EB', background: 'white',
              display: 'grid', placeItems: 'center',
              color: '#6B7280', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#111827'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#6B7280'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        {/* Center: meta info */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '12px' }}>
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{manualSteps.length}개 단계</span>
          {tutorial.status === 'published' && (
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: 500 }}>
              게시됨
            </span>
          )}
          {editMode && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'rgba(16,185,129,0.9)' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
              자동 저장됨
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>

          {editMode ? (
            /* ── 편집 모드: 녹화 추가 + 실행 취소 + 편집 완료 ── */
            <>
              <button
                onClick={handleAddRecording}
                disabled={recording}
                title="녹화를 통해 스텝 추가"
                style={{
                  height: '32px', padding: '0 12px', borderRadius: '7px',
                  fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px',
                  color: recording ? '#DC2626' : '#374151',
                  background: recording ? '#FEF2F2' : 'white',
                  border: `1px solid ${recording ? '#FECACA' : '#E5E7EB'}`,
                  cursor: recording ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!recording) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { if (!recording) e.currentTarget.style.background = 'white'; }}
              >
                <Video size={13} />
                {recording ? (
                  <><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#DC2626', display: 'inline-block', animation: 'pulse 1s ease-in-out infinite' }} /> 녹화 중…</>
                ) : '녹화 추가'}
              </button>
              <button
                onClick={handleUndo}
                disabled={historyRef.current.length === 0}
                title="실행 취소 (Ctrl+Z)"
                style={{
                  height: '32px', padding: '0 12px', borderRadius: '7px',
                  fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px',
                  color: historyRef.current.length > 0 ? '#374151' : '#D1D5DB',
                  background: 'white', border: '1px solid #E5E7EB',
                  cursor: historyRef.current.length > 0 ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (historyRef.current.length > 0) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
              >
                <Undo2 size={13} /> 실행 취소
              </button>

              <button
                onClick={async () => { const ok = await handleSave(); if (ok) setEditMode(false); }}
                disabled={saving}
                style={{
                  height: '32px', padding: '0 16px', borderRadius: '7px',
                  fontSize: '12.5px', fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  color: 'white',
                  background: saving ? 'rgba(79,70,229,0.6)' : 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                  border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 6px rgba(79,70,229,0.3)', transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.boxShadow = '0 4px 14px rgba(79,70,229,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 6px rgba(79,70,229,0.3)'; }}
              >
                {saving ? '저장 중…' : <><Check size={13} /> 편집 완료</>}
              </button>
            </>
          ) : (
            /* ── 뷰어 모드: 설정 + PDF + 공유 + 편집 + 게시 ── */
            <>
              {/* 설정 드롭다운 */}
              <div ref={settingsRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowSettings(v => !v)}
                  title="설정"
                  style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: showSettings ? '#4F46E5' : '#374151', background: showSettings ? '#EEF2FF' : 'white', border: `1px solid ${showSettings ? '#C7D2FE' : '#E5E7EB'}`, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (!showSettings) e.currentTarget.style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { if (!showSettings) e.currentTarget.style.background = 'white'; }}
                >
                  <Settings size={13} /> 설정
                </button>

                {showSettings && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    width: '260px', background: 'white', borderRadius: '12px',
                    boxShadow: '0 8px 28px rgba(17,24,39,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
                    padding: '16px', zIndex: 100,
                  }}>
                    {/* ── 썸네일 ── */}
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '10px' }}>
                      카드 썸네일
                    </div>
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleThumbnailUpload(f); e.target.value = ''; }}
                    />
                    {thumbnailUrl ? (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumbnailUrl} alt="썸네일" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                          <button
                            onClick={() => thumbnailInputRef.current?.click()}
                            disabled={thumbnailUploading}
                            style={{ flex: 1, padding: '6px 0', borderRadius: '7px', fontSize: '12px', fontWeight: 500, border: '1px solid #E5E7EB', background: 'white', color: '#374151', cursor: 'pointer' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
                          >
                            교체
                          </button>
                          <button
                            onClick={handleThumbnailDelete}
                            style={{ flex: 1, padding: '6px 0', borderRadius: '7px', fontSize: '12px', fontWeight: 500, border: '1px solid #FEE2E2', background: 'white', color: '#EF4444', cursor: 'pointer' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => thumbnailInputRef.current?.click()}
                        disabled={thumbnailUploading}
                        style={{
                          width: '100%', paddingTop: '40%', position: 'relative',
                          borderRadius: '8px', border: '1.5px dashed #D1D5DB',
                          background: thumbnailUploading ? '#F9FAFB' : 'white',
                          cursor: thumbnailUploading ? 'not-allowed' : 'pointer',
                          marginBottom: '16px', transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={e => { if (!thumbnailUploading) { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.background = '#F5F3FF'; } }}
                        onMouseLeave={e => { if (!thumbnailUploading) { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.background = 'white'; } }}
                      >
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          {thumbnailUploading ? (
                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #E5E7EB', borderTopColor: '#4F46E5', animation: 'spin 0.8s linear infinite' }} />
                          ) : (
                            <>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                              </svg>
                              <span style={{ fontSize: '11.5px', color: '#6B7280' }}>이미지 업로드</span>
                              <span style={{ fontSize: '10.5px', color: '#9CA3AF' }}>JPG, PNG, WEBP · 최대 5MB</span>
                            </>
                          )}
                        </div>
                      </button>
                    )}

                    {/* ── 구분선 ── */}
                    <div style={{ height: '1px', background: '#F3F4F6', marginBottom: '14px' }} />

                    {/* ── 뷰어 이미지 비율 ── */}
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '10px' }}>
                      뷰어 이미지 비율
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {([
                        { value: '16:9', label: '16:9 — 와이드스크린', desc: '일반 화면 캡처에 적합' },
                        { value: '1:1',  label: '1:1 — 정사각형',    desc: '앱/모바일 UI에 적합' },
                        { value: '9:16', label: '9:16 — 세로',       desc: '스마트폰 화면에 적합' },
                      ] as { value: Tutorial['output_ratio']; label: string; desc: string }[]).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => handleRatioChange(opt.value)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                            gap: '1px', padding: '8px 10px', borderRadius: '8px', border: 'none',
                            cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s',
                            background: outputRatio === opt.value ? '#EEF2FF' : 'transparent',
                          }}
                          onMouseEnter={e => { if (outputRatio !== opt.value) e.currentTarget.style.background = '#F9FAFB'; }}
                          onMouseLeave={e => { if (outputRatio !== opt.value) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span style={{ fontSize: '12.5px', fontWeight: outputRatio === opt.value ? 600 : 400, color: outputRatio === opt.value ? '#4F46E5' : '#111827' }}>
                            {opt.label}
                          </span>
                          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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

              <button
                onClick={() => setEditMode(true)}
                style={{ height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#374151', background: 'white', border: '1px solid #E5E7EB', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
              >
                <Pencil size={13} /> 편집
              </button>

              <button
                onClick={handlePublish}
                style={{ height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', color: 'white', background: '#111827', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1F2937'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#111827'; }}
              >
                게시
              </button>
            </>
          )}
          </div>
          {/* Created date — small, below action row */}
          <span style={{ fontSize: '10.5px', color: '#C4C9D4', paddingRight: '2px' }}>
            {createdAt} 생성
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* TOC panel */}
        <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #E5E7EB', background: 'white', minHeight: 0 }}>
          <GuideToc
            steps={manualSteps}
            activeId={activeId}
            onSelect={setActiveId}
            editable={editMode}
            onReorder={setManualStepsWithHistory}
            onAdd={handleAddStep}
            onDelete={handleDeleteStep}
          />
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {/* Title banner */}
          <div style={{ flexShrink: 0, padding: '20px 40px 16px', borderBottom: '1px solid #E5E7EB', background: 'white' }}>
            <input
              value={title}
              onChange={e => { setTitle(e.target.value); setTitleDirty(true); }}
              placeholder="매뉴얼 제목"
              style={{
                width: '100%', fontSize: '22px', fontWeight: 700, color: '#111827',
                background: 'transparent', border: 'none', outline: 'none',
                fontFamily: 'inherit', cursor: 'text',
              }}
            />
          </div>
          {editMode ? (
            <ManualEditor
              steps={manualSteps}
              hideToc
              activeId={activeId}
              onChange={(next) => {
                setManualStepsWithHistory(next);
                next.forEach(step => {
                  const prev = manualSteps.find(s => s.id === step.id);
                  if (!prev) return;
                  if (prev.actionTitle === step.actionTitle && prev.description === step.description) return;
                  if (step.id.startsWith('step-')) return;
                  clearTimeout(stepSaveTimers.current[step.id]);
                  stepSaveTimers.current[step.id] = setTimeout(() => {
                    updateStep(step.id, {
                      user_title: step.actionTitle || null,
                      user_script: step.description || null,
                    }).catch(() => {});
                  }, 600);
                });
              }}
              onSave={(stepId, patch) => {
                if (stepId.startsWith('step-')) return;
                clearTimeout(stepSaveTimers.current[stepId]);
                const step = manualSteps.find(s => s.id === stepId);
                if (!step) return;
                const merged = { ...step, ...patch };
                updateStep(stepId, {
                  user_title: merged.actionTitle || null,
                  user_script: merged.description || null,
                  ...(merged.annotations !== undefined ? { user_annotations: merged.annotations } : {}),
                }).catch(() => {});
              }}
            />
          ) : (
            <GuideViewer
              steps={manualSteps}
              activeId={activeId}
              onActiveChange={setActiveId}
              outputRatio={outputRatio}
            />
          )}
        </div>
      </div>

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
    </div>
  );
}
