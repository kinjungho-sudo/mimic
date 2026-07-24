'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  DESKTOP_ONBOARDING_STEPS,
  MOBILE_ONBOARDING_STEPS,
  PARRO_ONBOARDING_FIRST_STEP,
  PARRO_ONBOARDING_PRACTICE_PATH,
  getNextOnboardingStep,
  getOnboardingStep,
  getPreviousOnboardingStep,
  type OnboardingEventType,
  type OnboardingStep,
  type ParroOnboardingProgress,
} from '@/lib/onboarding';

type OnboardingApiResponse = {
  progress: ParroOnboardingProgress | null;
  eligible_for_auto_prompt: boolean;
};

type SignalDetail = {
  extensionState?: string;
};

type ParroOnboardingContextValue = {
  isActive: boolean;
  currentStepId: string | null;
  startReplay: () => Promise<void>;
  signal: (name: string, detail?: SignalDetail) => void;
};

const ParroOnboardingContext = createContext<ParroOnboardingContextValue | null>(null);

function isGuideRoute(pathname: string) {
  return pathname === '/home'
    || pathname === PARRO_ONBOARDING_PRACTICE_PATH
    || /^\/manual\/[^/]+\/editor$/.test(pathname);
}

function browserType() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'edge';
  if (/Chrome\//.test(ua) && !/OPR\//.test(ua)) return 'chrome';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'safari';
  return 'other';
}

function shouldUseMobileTour() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches || browserType() !== 'chrome';
}

function progressPercent(step: OnboardingStep, mobileTour: boolean) {
  const steps = mobileTour ? MOBILE_ONBOARDING_STEPS : DESKTOP_ONBOARDING_STEPS;
  const index = Math.max(0, steps.findIndex(item => item.id === step.id));
  return Math.round(((index + 1) / steps.length) * 100);
}

async function requestProgress(
  body: Record<string, unknown>,
): Promise<ParroOnboardingProgress | null> {
  const response = await fetch('/api/user/onboarding', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) return null;
  const data = await response.json() as { progress?: ParroOnboardingProgress };
  return data.progress ?? null;
}

export function ParroOnboardingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [progress, setProgress] = useState<ParroOnboardingProgress | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeReady, setWelcomeReady] = useState(false);
  const [active, setActive] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [mobileTour, setMobileTour] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const [extensionState, setExtensionState] = useState('unknown');
  const [practiceDecision, setPracticeDecision] = useState<string | null>(null);
  const [deletingPractice, setDeletingPractice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const requestedReplayRef = useRef(false);
  const viewedStepRef = useRef<string | null>(null);
  const blockedStepRef = useRef<string | null>(null);

  const currentStep = useMemo(
    () => getOnboardingStep(progress?.current_step ?? PARRO_ONBOARDING_FIRST_STEP, mobileTour),
    [mobileTour, progress?.current_step],
  );

  const emitEvent = useCallback((
    eventType: OnboardingEventType,
    stepId?: string | null,
    state = extensionState,
  ) => {
    void fetch('/api/user/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: eventType,
        step_id: stepId ?? null,
        browser_type: browserType(),
        extension_state: state,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [extensionState]);

  const activateProgress = useCallback((next: ParroOnboardingProgress) => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setProgress(next);
    setWelcomeOpen(false);
    setCompletionOpen(next.current_step === 'complete');
    setActive(true);
  }, []);

  const startGuide = useCallback(async (replay: boolean) => {
    const next = await requestProgress({ action: 'start', replay });
    if (!next) {
      setSaveError('가이드 시작 상태를 저장하지 못했어요. 네트워크를 확인한 뒤 다시 시도해주세요.');
      return;
    }
    setSaveError(null);
    setMobileTour(shouldUseMobileTour());
    activateProgress(next);
    emitEvent(replay ? 'replay_start' : 'start', PARRO_ONBOARDING_FIRST_STEP);
  }, [activateProgress, emitEvent]);

  const startReplay = useCallback(async () => {
    await startGuide(true);
  }, [startGuide]);

  useEffect(() => {
    if (!isGuideRoute(pathname)) return;
    let cancelled = false;

    void (async () => {
      const response = await fetch('/api/user/onboarding', { cache: 'no-store' }).catch(() => null);
      if (!response?.ok || cancelled) return;
      const data = await response.json() as OnboardingApiResponse;
      if (cancelled) return;

      setMobileTour(shouldUseMobileTour());
      setProgress(data.progress);

      const wantsReplay = pathname === '/home'
        && new URLSearchParams(window.location.search).get('onboarding') === 'replay';
      if (wantsReplay && !requestedReplayRef.current) {
        requestedReplayRef.current = true;
        const url = new URL(window.location.href);
        url.searchParams.delete('onboarding');
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
        await startGuide(true);
        return;
      }

      if (data.progress?.status === 'in_progress') {
        activateProgress(data.progress);
        emitEvent('resume', data.progress.current_step);
        return;
      }

      if (pathname === '/home' && data.eligible_for_auto_prompt) {
        setWelcomeOpen(true);
        setWelcomeReady(false);
        emitEvent('onboarding_impression', PARRO_ONBOARDING_FIRST_STEP);
        const impressed = await requestProgress({ action: 'impression' });
        if (!cancelled && impressed) setProgress(impressed);
        if (!cancelled) setWelcomeReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activateProgress, emitEvent, pathname, startGuide]);

  const finishAndShowCompletion = useCallback(async () => {
    const next = await requestProgress({ action: 'complete' });
    if (!next) {
      setSaveError('완료 상태를 저장하지 못했어요. 잠시 후 다시 눌러주세요.');
      return;
    }
    setSaveError(null);
    setProgress(next);
    emitEvent('step_complete', currentStep.id);
    emitEvent('complete', 'complete');
    setCompletionOpen(true);
    setActive(true);
  }, [currentStep.id, emitEvent]);

  const moveToStep = useCallback(async (step: OnboardingStep) => {
    const next = await requestProgress({ action: 'progress', current_step: step.id });
    if (!next) {
      setSaveError('진행 상태를 저장하지 못했어요. 네트워크를 확인한 뒤 다시 시도해주세요.');
      return false;
    }
    setSaveError(null);
    setProgress(next);
    return true;
  }, []);

  const goNext = useCallback(async () => {
    const next = getNextOnboardingStep(currentStep.id, mobileTour);
    if (!next || next.id === 'complete') {
      await finishAndShowCompletion();
      return;
    }
    if (await moveToStep(next)) {
      if (next.id === 'home-web-recording') {
        window.dispatchEvent(new Event('parro:open-create-menu'));
      }
      emitEvent('step_complete', currentStep.id);
    }
  }, [currentStep.id, emitEvent, finishAndShowCompletion, mobileTour, moveToStep]);

  const goBack = useCallback(async () => {
    const previous = getPreviousOnboardingStep(currentStep.id, mobileTour);
    if (previous) await moveToStep(previous);
  }, [currentStep.id, mobileTour, moveToStep]);

  const closeGuide = useCallback(async () => {
    if (completionOpen) {
      setActive(false);
      setCompletionOpen(false);
      previousFocusRef.current?.focus();
      return;
    }
    if (!window.confirm('Live Guide를 여기서 멈출까요? 진행 상태는 저장되며 언제든 다시 시작할 수 있어요.')) {
      return;
    }
    const next = await requestProgress({ action: 'dismiss' });
    if (!next) {
      setSaveError('중단 상태를 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
      return;
    }
    setSaveError(null);
    setProgress(next);
    emitEvent('dismiss', currentStep.id);
    setActive(false);
    previousFocusRef.current?.focus();
  }, [completionOpen, currentStep.id, emitEvent]);

  const dismissWelcome = useCallback(async () => {
    const next = await requestProgress({ action: 'dismiss' });
    if (!next) {
      setSaveError('선택을 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
      return;
    }
    setSaveError(null);
    setProgress(next);
    emitEvent('dismiss', PARRO_ONBOARDING_FIRST_STEP);
    setWelcomeOpen(false);
  }, [emitEvent]);

  const signal = useCallback((name: string, detail?: SignalDetail) => {
    if (detail?.extensionState) setExtensionState(detail.extensionState);
    if (name === 'install-clicked') {
      emitEvent('install_clicked', currentStep.id, detail?.extensionState ?? extensionState);
      return;
    }
    if (!active || currentStep.advanceOn !== 'signal' || currentStep.signal !== name) return;
    void goNext();
  }, [active, currentStep.advanceOn, currentStep.id, currentStep.signal, emitEvent, extensionState, goNext]);

  useEffect(() => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<{ name?: string; detail?: SignalDetail }>;
      if (customEvent.detail?.name) signal(customEvent.detail.name, customEvent.detail.detail);
    };
    window.addEventListener('parro:onboarding-signal', listener);
    return () => window.removeEventListener('parro:onboarding-signal', listener);
  }, [signal]);

  useEffect(() => {
    if (!active || completionOpen) return;
    if (
      currentStep.route === 'home'
      && pathname !== '/home'
      && pathname !== PARRO_ONBOARDING_PRACTICE_PATH
    ) {
      router.replace('/home');
      return;
    }
    if (
      currentStep.route === 'editor'
      && !/^\/manual\/[^/]+\/editor$/.test(pathname)
      && progress?.practice_manual_id
    ) {
      router.replace(`/manual/${progress.practice_manual_id}/editor?onboarding=1`);
    }
  }, [active, completionOpen, currentStep.route, pathname, progress?.practice_manual_id, router]);

  useEffect(() => {
    if (
      pathname !== PARRO_ONBOARDING_PRACTICE_PATH
      || !active
      || currentStep.route === 'practice'
    ) return;
    let stopped = false;
    const refresh = async () => {
      const response = await fetch('/api/user/onboarding', { cache: 'no-store' }).catch(() => null);
      if (!response?.ok || stopped) return;
      const data = await response.json() as OnboardingApiResponse;
      if (data.progress?.status === 'in_progress') setProgress(data.progress);
    };
    const timer = window.setInterval(() => void refresh(), 800);
    void refresh();
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [active, currentStep.route, pathname]);

  useEffect(() => {
    if (
      active
      && pathname.startsWith('/manual/')
      && currentStep.id === 'practice-finish'
    ) {
      signal('editor-opened');
    }
  }, [active, currentStep.id, pathname, signal]);

  useEffect(() => {
    if (!active || completionOpen || viewedStepRef.current === currentStep.id) return;
    viewedStepRef.current = currentStep.id;
    emitEvent('step_view', currentStep.id);
  }, [active, completionOpen, currentStep.id, emitEvent]);

  useEffect(() => {
    if (!active || completionOpen || !currentStep.target) {
      setTargetRect(null);
      setTargetMissing(false);
      return;
    }

    let target: HTMLElement | null = null;
    let missingTimer: ReturnType<typeof setTimeout> | null = null;
    const findTarget = () => {
      target = Array.from(document.querySelectorAll<HTMLElement>(`[data-parro-guide="${currentStep.target}"]`))
        .find(element => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }) ?? null;
      if (target) {
        setTargetRect(target.getBoundingClientRect());
        setTargetMissing(false);
      }
    };
    const updateRect = () => {
      if (target?.isConnected) setTargetRect(target.getBoundingClientRect());
      else findTarget();
    };
    const clickListener = (event: MouseEvent) => {
      if (
        currentStep.advanceOn === 'target-click'
        && target
        && event.target instanceof Node
        && target.contains(event.target)
      ) {
        window.setTimeout(() => void goNext(), 100);
      }
    };

    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    document.addEventListener('click', clickListener, true);
    missingTimer = setTimeout(() => {
      if (!target) {
        setTargetMissing(true);
        setTargetRect(null);
        if (blockedStepRef.current !== currentStep.id) {
          blockedStepRef.current = currentStep.id;
          emitEvent('blocked', currentStep.id);
        }
      }
    }, 3500);

    return () => {
      observer.disconnect();
      if (missingTimer) clearTimeout(missingTimer);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      document.removeEventListener('click', clickListener, true);
    };
  }, [active, completionOpen, currentStep.advanceOn, currentStep.id, currentStep.target, emitEvent, goNext]);

  useEffect(() => {
    if (!active || completionOpen) return;
    const keyListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void closeGuide();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        void goBack();
      } else if (event.key === 'ArrowRight' && currentStep.advanceOn !== 'signal') {
        event.preventDefault();
        void goNext();
      }
    };
    window.addEventListener('keydown', keyListener);
    return () => window.removeEventListener('keydown', keyListener);
  }, [active, closeGuide, completionOpen, currentStep.advanceOn, goBack, goNext]);

  useEffect(() => {
    if ((welcomeOpen || active) && tooltipRef.current) tooltipRef.current.focus();
  }, [active, currentStep.id, welcomeOpen]);

  const deletePracticeManual = useCallback(async () => {
    if (!progress?.practice_manual_id || deletingPractice) return;
    if (!window.confirm('연습 매뉴얼을 휴지통으로 이동할까요? 이 작업은 휴지통에서 복구할 수 있어요.')) return;
    setDeletingPractice(true);
    try {
      const response = await fetch(`/api/tutorials/${progress.practice_manual_id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('delete_failed');
      const next = await requestProgress({ action: 'clear_practice_manual' });
      if (next) setProgress(next);
      setPracticeDecision('연습 매뉴얼을 휴지통으로 이동했어요.');
    } catch {
      setPracticeDecision('삭제하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setDeletingPractice(false);
    }
  }, [deletingPractice, progress?.practice_manual_id]);

  const contextValue = useMemo<ParroOnboardingContextValue>(() => ({
    isActive: active,
    currentStepId: active ? currentStep.id : null,
    startReplay,
    signal,
  }), [active, currentStep.id, signal, startReplay]);

  const percent = completionOpen ? 100 : progressPercent(currentStep, mobileTour);
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const tooltipStyle = targetRect && !targetMissing
    ? {
        top: targetRect.bottom + 250 <= viewportHeight
          ? targetRect.bottom + 14
          : Math.max(16, targetRect.top - 246),
        left: Math.min(viewportWidth - 380, Math.max(16, targetRect.left)),
      }
    : {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };

  return (
    <ParroOnboardingContext.Provider value={contextValue}>
      {children}

      {welcomeOpen && (
        <div className="parro-onboarding-modal-layer" role="presentation">
          <div
            ref={tooltipRef}
            className="parro-onboarding-welcome"
            role="dialog"
            aria-modal="true"
            aria-labelledby="parro-onboarding-welcome-title"
            tabIndex={-1}
          >
            <span className="parro-onboarding-eyebrow">PARRO LIVE GUIDE</span>
            <h2 id="parro-onboarding-welcome-title">3분 만에 Parro 익히기</h2>
            <p>첫 매뉴얼 만들기부터 편집, 공유 방식까지 실제 화면에서 차근차근 안내해드릴게요.</p>
            <div className="parro-onboarding-notice">
              모바일에서는 기능 둘러보기를 제공하고, 실제 녹화 연습은 PC Chrome에서 이어갈 수 있어요.
            </div>
            {saveError && <p className="parro-onboarding-save-error" role="alert">{saveError}</p>}
            <button className="parro-onboarding-primary" disabled={!welcomeReady} onClick={() => void startGuide(false)}>
              {welcomeReady ? 'Live Guide 시작' : '가이드 준비 중…'}
            </button>
            <button className="parro-onboarding-secondary" disabled={!welcomeReady} onClick={() => void dismissWelcome()}>
              나중에 하기
            </button>
          </div>
        </div>
      )}

      {active && (
        <div className="parro-onboarding-layer" aria-live="polite">
          {!completionOpen && targetRect && !targetMissing ? (
            <>
              <div className="parro-onboarding-shield" style={{ top: 0, left: 0, right: 0, height: Math.max(0, targetRect.top - 6) }} />
              <div className="parro-onboarding-shield" style={{ top: targetRect.top - 6, left: 0, width: Math.max(0, targetRect.left - 6), height: targetRect.height + 12 }} />
              <div className="parro-onboarding-shield" style={{ top: targetRect.top - 6, left: targetRect.right + 6, right: 0, height: targetRect.height + 12 }} />
              <div className="parro-onboarding-shield" style={{ top: targetRect.bottom + 6, left: 0, right: 0, bottom: 0 }} />
            </>
          ) : (
            <div className="parro-onboarding-shield" style={{ inset: 0 }} />
          )}
          {!completionOpen && targetRect && !targetMissing && (
            <div
              className="parro-onboarding-target"
              style={{
                top: targetRect.top - 6,
                left: targetRect.left - 6,
                width: targetRect.width + 12,
                height: targetRect.height + 12,
              }}
            />
          )}
          <div
            ref={tooltipRef}
            className={`parro-onboarding-tooltip${completionOpen ? ' is-complete' : ''}`}
            role="dialog"
            aria-modal="false"
            aria-labelledby="parro-onboarding-step-title"
            tabIndex={-1}
            style={completionOpen ? undefined : tooltipStyle}
          >
            <div className="parro-onboarding-progress-header">
              <span>{completionOpen ? '완료' : `${percent}%`}</span>
              <button aria-label="Live Guide 닫기" onClick={() => void closeGuide()}>×</button>
            </div>
            <div className="parro-onboarding-progress-track" aria-label={`진행률 ${percent}%`}>
              <span style={{ width: `${percent}%` }} />
            </div>
            <h2 id="parro-onboarding-step-title">
              {completionOpen ? 'Parro 시작 준비가 끝났어요' : currentStep.title}
            </h2>
            <p>{completionOpen
              ? '첫 완료가 저장됐어요. 홈과 도움말에서 언제든 Live Guide를 처음부터 다시 볼 수 있습니다.'
              : currentStep.body}</p>
            {saveError && <p className="parro-onboarding-save-error" role="alert">{saveError}</p>}

            {targetMissing && !completionOpen && (
              <div className="parro-onboarding-recovery" role="status">
                안내할 화면 요소를 아직 찾지 못했어요. 화면이 열린 뒤 다시 찾거나 다음 단계로 이동할 수 있어요.
                {['recording-setup', 'recording-start'].includes(currentStep.id) ? (
                  <button onClick={() => window.dispatchEvent(new Event('parro:onboarding-open-recorder'))}>
                    Recorder 준비 다시 열기
                  </button>
                ) : currentStep.route === 'practice' ? (
                  <button onClick={() => router.push(PARRO_ONBOARDING_PRACTICE_PATH)}>
                    연습 페이지 열기
                  </button>
                ) : (
                  <button onClick={() => window.location.reload()}>화면 다시 불러오기</button>
                )}
              </div>
            )}

            {completionOpen ? (
              <>
                {progress?.practice_manual_id && (
                  <div className="parro-onboarding-practice-decision">
                    <strong>연습 매뉴얼을 어떻게 할까요?</strong>
                    <span>자동으로 삭제하지 않아요. 보관하거나 직접 휴지통으로 보낼 수 있어요.</span>
                    <div>
                      <button onClick={() => setPracticeDecision('연습 매뉴얼을 보관했어요.')}>보관</button>
                      <button onClick={() => void deletePracticeManual()} disabled={deletingPractice}>
                        {deletingPractice ? '이동 중…' : '휴지통으로 이동'}
                      </button>
                    </div>
                  </div>
                )}
                {practiceDecision && <p className="parro-onboarding-decision-message">{practiceDecision}</p>}
                <div className="parro-onboarding-complete-actions">
                  <button
                    className="parro-onboarding-primary"
                    onClick={() => {
                      setActive(false);
                      window.sessionStorage.setItem('parro-open-create-menu', '1');
                      router.push('/home');
                    }}
                  >
                    내 매뉴얼 만들기
                  </button>
                  {progress?.practice_manual_id && (
                    <button
                      className="parro-onboarding-secondary"
                      onClick={() => {
                        setActive(false);
                        router.push(`/manual/${progress.practice_manual_id}/editor`);
                      }}
                    >
                      연습 매뉴얼 열기
                    </button>
                  )}
                  <button className="parro-onboarding-secondary" onClick={() => void startReplay()}>
                    처음부터 다시 보기
                  </button>
                  <button className="parro-onboarding-secondary" onClick={() => void closeGuide()}>
                    닫기
                  </button>
                </div>
              </>
            ) : (
              <div className="parro-onboarding-navigation">
                <button onClick={() => void goBack()} disabled={!getPreviousOnboardingStep(currentStep.id, mobileTour)}>
                  이전
                </button>
                <span>{percent}%</span>
                {currentStep.advanceOn === 'signal' ? (
                  <button onClick={() => void goNext()}>이 단계 건너뛰기</button>
                ) : (
                  <button className="is-primary" onClick={() => void goNext()}>다음</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        .parro-onboarding-modal-layer,
        .parro-onboarding-layer {
          position: fixed;
          inset: 0;
          z-index: 4000;
        }
        .parro-onboarding-modal-layer {
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.56);
          backdrop-filter: blur(3px);
        }
        .parro-onboarding-welcome,
        .parro-onboarding-tooltip {
          width: min(360px, calc(100vw - 32px));
          border: 1px solid #dbe4ff;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.24);
          color: #111827;
          outline: none;
        }
        .parro-onboarding-welcome {
          padding: 28px;
        }
        .parro-onboarding-eyebrow {
          color: #4f46e5;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .1em;
        }
        .parro-onboarding-welcome h2,
        .parro-onboarding-tooltip h2 {
          margin: 10px 0 8px;
          font-size: 22px;
          line-height: 1.3;
        }
        .parro-onboarding-welcome p,
        .parro-onboarding-tooltip > p {
          margin: 0 0 18px;
          color: #4b5563;
          font-size: 14px;
          line-height: 1.65;
        }
        .parro-onboarding-notice {
          margin-bottom: 18px;
          padding: 11px 12px;
          border-radius: 10px;
          background: #f5f7ff;
          color: #475569;
          font-size: 12px;
          line-height: 1.55;
        }
        .parro-onboarding-save-error {
          margin: 0 0 14px !important;
          padding: 9px 10px;
          border-radius: 8px;
          background: #fef2f2;
          color: #b91c1c !important;
          font-size: 12px !important;
          font-weight: 700;
        }
        .parro-onboarding-primary,
        .parro-onboarding-secondary {
          width: 100%;
          min-height: 42px;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
        }
        .parro-onboarding-primary {
          border: 0;
          background: linear-gradient(135deg, #4f46e5, #2563eb);
          color: white;
        }
        .parro-onboarding-primary:disabled,
        .parro-onboarding-secondary:disabled {
          cursor: wait;
          opacity: .55;
        }
        .parro-onboarding-secondary {
          margin-top: 8px;
          border: 1px solid #e5e7eb;
          background: white;
          color: #374151;
        }
        .parro-onboarding-layer {
          pointer-events: none;
          background: rgba(15, 23, 42, 0.22);
        }
        .parro-onboarding-target {
          position: fixed;
          z-index: 4001;
          pointer-events: none;
          border: 3px solid #6366f1;
          border-radius: 12px;
          box-shadow: 0 0 0 6px rgba(99, 102, 241, .2), 0 0 0 9999px rgba(15, 23, 42, .18);
          transition: top .18s ease, left .18s ease, width .18s ease, height .18s ease;
        }
        .parro-onboarding-shield {
          position: fixed;
          z-index: 4000;
          pointer-events: auto;
        }
        .parro-onboarding-tooltip {
          position: fixed;
          z-index: 4002;
          pointer-events: auto;
          padding: 18px;
        }
        .parro-onboarding-tooltip.is-complete {
          top: 50%;
          left: 50%;
          width: min(440px, calc(100vw - 32px));
          transform: translate(-50%, -50%);
        }
        .parro-onboarding-progress-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #4f46e5;
          font-size: 12px;
          font-weight: 800;
        }
        .parro-onboarding-progress-header button {
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 8px;
          background: #f3f4f6;
          color: #4b5563;
          font-size: 20px;
          cursor: pointer;
        }
        .parro-onboarding-progress-track {
          height: 5px;
          margin-top: 8px;
          overflow: hidden;
          border-radius: 999px;
          background: #e5e7eb;
        }
        .parro-onboarding-progress-track span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #4f46e5, #2563eb);
          transition: width .2s ease;
        }
        .parro-onboarding-navigation {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .parro-onboarding-navigation button {
          min-height: 36px;
          padding: 0 12px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: white;
          color: #374151;
          font-weight: 700;
          cursor: pointer;
        }
        .parro-onboarding-navigation button:disabled {
          cursor: not-allowed;
          opacity: .4;
        }
        .parro-onboarding-navigation button.is-primary {
          border-color: #4f46e5;
          background: #4f46e5;
          color: white;
        }
        .parro-onboarding-navigation span {
          flex: 1;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }
        .parro-onboarding-recovery,
        .parro-onboarding-practice-decision {
          margin: 0 0 16px;
          padding: 12px;
          border: 1px solid #fde68a;
          border-radius: 10px;
          background: #fffbeb;
          color: #78350f;
          font-size: 12px;
          line-height: 1.5;
        }
        .parro-onboarding-recovery button {
          display: block;
          margin-top: 8px;
          border: 0;
          background: transparent;
          color: #4338ca;
          font-weight: 800;
          cursor: pointer;
        }
        .parro-onboarding-practice-decision strong,
        .parro-onboarding-practice-decision span {
          display: block;
        }
        .parro-onboarding-practice-decision span {
          margin-top: 4px;
        }
        .parro-onboarding-practice-decision > div {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        .parro-onboarding-practice-decision button {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: white;
          color: #374151;
          padding: 7px 10px;
          cursor: pointer;
        }
        .parro-onboarding-decision-message {
          color: #047857 !important;
          font-weight: 700;
        }
        .parro-onboarding-complete-actions {
          display: grid;
          gap: 8px;
        }
        .parro-onboarding-complete-actions .parro-onboarding-secondary {
          margin-top: 0;
        }
        @media (max-width: 767px) {
          .parro-onboarding-tooltip:not(.is-complete) {
            top: auto !important;
            right: 12px;
            bottom: 12px;
            left: 12px !important;
            width: auto;
            transform: none !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .parro-onboarding-target,
          .parro-onboarding-progress-track span {
            transition: none;
          }
        }
      `}</style>
    </ParroOnboardingContext.Provider>
  );
}

export function useParroOnboarding() {
  const context = useContext(ParroOnboardingContext);
  if (!context) {
    throw new Error('useParroOnboarding must be used inside ParroOnboardingProvider');
  }
  return context;
}
