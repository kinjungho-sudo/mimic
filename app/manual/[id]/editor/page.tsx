'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { EditorHeader, EditorMode } from '@/components/editor/EditorHeader';
import { ManualEditor, ManualStep } from '@/components/editor/ManualEditor';
import { SlidePanel, SlideThumb } from '@/components/editor/SlidePanel';
import { CanvasArea } from '@/components/editor/CanvasArea';
import { BottomSplit } from '@/components/editor/BottomSplit';
import { ShareModal } from '@/components/editor/ShareModal';
import { useTutorial } from '@/hooks/useTutorial';
import { useAutosave } from '@/hooks/useAutosave';
import { generateAnnotations, generateTTS, generateScript } from '@/lib/api/ai';
import { updateStep } from '@/lib/api/steps';
import type { Step } from '@/types';

// ── Adapters ──────────────────────────────────────────────

function stepsToManualSteps(steps: Step[]): ManualStep[] {
  return steps.map(s => ({
    id: s.id,
    number: s.step_number,
    actionTitle: s.user_title ?? s.ai_title ?? '',
    description: s.user_script ?? s.ai_description ?? '',
    screenshotUrl: s.screenshot_url || undefined,
  }));
}

function stepsToSlideThumbs(steps: Step[]): SlideThumb[] {
  return steps.map(s => ({
    id: s.id,
    number: s.step_number,
    title: s.user_title ?? s.ai_title ?? `단계 ${s.step_number}`,
    highlightCount: 0,
    markers: [],
  }));
}

// ── Page ──────────────────────────────────────────────────

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tutorial, loading, error, publish, unpublish } = useTutorial(id);

  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<EditorMode>('document');
  const [manualSteps, setManualSteps] = useState<ManualStep[]>([]);
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [script, setScript] = useState('');
  const [titleDirty, setTitleDirty] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const stepSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Undo history — stores previous snapshots of manualSteps
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

  // Ctrl+Z / Cmd+Z global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        const active = document.activeElement;
        // Don't intercept when typing in an input/textarea/contenteditable
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) return;
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo]);

  // Seed state from fetched tutorial
  useEffect(() => {
    if (!tutorial) return;
    setTitle(tutorial.title);
    const steps = stepsToManualSteps(tutorial.steps);
    setManualSteps(steps);
    if (tutorial.steps.length > 0 && !activeSlideId) {
      setActiveSlideId(tutorial.steps[0].id);
    }
    const audio = tutorial.audio_assets?.[0];
    if (audio) setScript(audio.script_text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial?.id]);

  // Autosave title
  useAutosave(id, titleDirty ? { title } : null);

  const handleTitleChange = useCallback((t: string) => {
    setTitle(t);
    setTitleDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    await Promise.all(
      manualSteps
        .filter(s => !s.id.startsWith('step-'))
        .map(s => {
          clearTimeout(stepSaveTimers.current[s.id]);
          return updateStep(s.id, {
            user_title: s.actionTitle || null,
            user_script: s.description || null,
            user_annotations: s.annotations ?? [],
          }).catch(() => {});
        })
    );
  }, [manualSteps]);

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

  const handleAiApply = useCallback(async (prompt: string) => {
    if (!activeSlideId) return;
    await generateAnnotations(activeSlideId, prompt);
  }, [activeSlideId]);

  const handleTtsPreview = useCallback(async () => {
    if (!activeSlideId || !script) return;
    await generateTTS(activeSlideId, script);
  }, [activeSlideId, script]);

  const handleAiRegenerate = useCallback(async () => {
    if (!tutorial?.steps?.length) return;
    const result = await generateScript(tutorial.steps);
    setScript(result.script);
  }, [tutorial]);

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
          <button onClick={() => router.push('/dashboard')} style={{ padding: '10px 20px', borderRadius: '8px', background: '#4F46E5', color: 'white', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const slides = stepsToSlideThumbs(tutorial.steps);
  const activeSlide = slides.find(s => s.id === activeSlideId) ?? slides[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F8F9FA', overflow: 'hidden' }}>
      <EditorHeader
        title={title}
        tutorialId={id}
        onTitleChange={handleTitleChange}
        onPreview={() => {
          if (tutorial.share_token) window.open(`/play/${tutorial.share_token}`, '_blank');
          else alert('게시 후 미리보기가 가능합니다.');
        }}
        onSave={handleSave}
        onPublish={handlePublish}
        onShare={() => setShowShare(true)}
        onUndo={handleUndo}
        canUndo={historyRef.current.length > 0}
        mode={mode}
        onModeChange={setMode}
      />

      {mode === 'document' ? (
        <ManualEditor
          steps={manualSteps}
          onChange={(next) => {
            setManualStepsWithHistory(next);
            next.forEach((step) => {
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
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '170px 1fr', gridTemplateRows: '1fr 280px', minHeight: 0 }}>
          <SlidePanel
            slides={slides}
            activeSlideId={activeSlideId ?? slides[0]?.id ?? ''}
            onSlideSelect={setActiveSlideId}
            onAddSlide={() => alert('단계 추가는 녹화를 통해 추가할 수 있습니다.')}
          />

          <CanvasArea
            slideTitle={activeSlide ? `슬라이드 ${activeSlide.number}` : ''}
            highlightCount={activeSlide?.highlightCount ?? 0}
            annotations={[]}
            screenshotUrl={tutorial.steps.find(s => s.id === activeSlideId)?.screenshot_url}
          />

          <BottomSplit
            slideTitle={activeSlide ? `${activeSlide.number}번 · ${activeSlide.title}` : ''}
            highlightCount={activeSlide?.highlightCount ?? 0}
            script={script}
            onAiApply={handleAiApply}
            onTtsPreview={handleTtsPreview}
            onAiRegenerate={handleAiRegenerate}
          />
        </div>
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
    </div>
  );
}
