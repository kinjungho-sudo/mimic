export const PARRO_ONBOARDING_KEY = 'parro-getting-started';
export const PARRO_ONBOARDING_VERSION = 1;
export const PARRO_ONBOARDING_FIRST_STEP = 'home-create';
export const PARRO_ONBOARDING_PRACTICE_PATH = '/onboarding/practice';

export const ONBOARDING_EVENT_TYPES = [
  'onboarding_impression',
  'start',
  'step_view',
  'step_complete',
  'blocked',
  'install_clicked',
  'resume',
  'dismiss',
  'complete',
  'replay_start',
] as const;

export type OnboardingEventType = typeof ONBOARDING_EVENT_TYPES[number];

export type ParroOnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

export type ParroOnboardingProgress = {
  user_id: string;
  guide_key: string;
  guide_version: number;
  status: ParroOnboardingStatus;
  current_step: string | null;
  initial_completed_at: string | null;
  last_started_at: string | null;
  last_completed_at: string | null;
  dismissed_at: string | null;
  run_count: number;
  practice_manual_id: string | null;
  created_at: string;
  updated_at: string;
};

export function buildOnboardingStartPatch(
  existing: Pick<ParroOnboardingProgress, 'run_count'> | null,
  now: string,
) {
  return {
    status: 'in_progress' as const,
    current_step: PARRO_ONBOARDING_FIRST_STEP,
    last_started_at: now,
    dismissed_at: null,
    run_count: (existing?.run_count ?? 0) + 1,
  };
}

export function buildOnboardingCompletionPatch(
  existing: Pick<ParroOnboardingProgress, 'initial_completed_at'>,
  now: string,
) {
  return {
    status: 'completed' as const,
    current_step: 'complete',
    initial_completed_at: existing.initial_completed_at ?? now,
    last_completed_at: now,
  };
}

export type OnboardingStep = {
  id: string;
  title: string;
  body: string;
  target?: string;
  route: 'home' | 'practice' | 'editor' | 'any';
  advanceOn?: 'next' | 'target-click' | 'target-input' | 'signal';
  signal?: string;
  sidePanelHint?: string;
};

export const DESKTOP_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'home-create',
    title: '새 매뉴얼을 만들어봐요',
    body: '오른쪽 위 새로 만들기에서 빈 매뉴얼을 바로 시작할 수 있어요.',
    target: 'home-create-trigger',
    route: 'home',
  },
  {
    id: 'home-blank-manual',
    title: '새 매뉴얼 직접 작성을 선택해요',
    body: '강조된 항목을 누르면 새 매뉴얼이 만들어지고 편집 화면으로 이동해요.',
    target: 'home-blank-manual',
    route: 'home',
    advanceOn: 'target-click',
  },
  {
    id: 'editor-title',
    title: '제목을 입력하는 곳이에요',
    body: '매뉴얼의 목적이 바로 보이도록 제목을 작성할 수 있어요.',
    target: 'editor-title',
    route: 'editor',
  },
  {
    id: 'editor-content',
    title: '내용을 작성하는 곳이에요',
    body: '단계를 추가하고 설명을 작성할 수 있어요. 이제 완료를 누르면 안내가 끝나요.',
    target: 'editor-manual-content',
    route: 'editor',
  },
  {
    id: 'complete',
    title: '새 매뉴얼 만들기를 익혔어요',
    body: '필요할 때 홈과 도움말에서 언제든 Live Guide를 다시 볼 수 있어요.',
    route: 'any',
  },
];

export const MOBILE_ONBOARDING_STEPS: OnboardingStep[] = DESKTOP_ONBOARDING_STEPS;

export const ONBOARDING_STEP_IDS = new Set([
  ...DESKTOP_ONBOARDING_STEPS.map(step => step.id),
  ...MOBILE_ONBOARDING_STEPS.map(step => step.id),
]);

export function getOnboardingStep(
  stepId: string | null | undefined,
  mobileTour: boolean,
): OnboardingStep {
  const steps = mobileTour ? MOBILE_ONBOARDING_STEPS : DESKTOP_ONBOARDING_STEPS;
  return steps.find(step => step.id === stepId) ?? steps[0];
}

export function getNextOnboardingStep(
  currentStepId: string,
  mobileTour: boolean,
): OnboardingStep | null {
  const steps = mobileTour ? MOBILE_ONBOARDING_STEPS : DESKTOP_ONBOARDING_STEPS;
  const index = steps.findIndex(step => step.id === currentStepId);
  return index >= 0 ? steps[index + 1] ?? null : steps[0];
}

export function getPreviousOnboardingStep(
  currentStepId: string,
  mobileTour: boolean,
): OnboardingStep | null {
  const steps = mobileTour ? MOBILE_ONBOARDING_STEPS : DESKTOP_ONBOARDING_STEPS;
  const index = steps.findIndex(step => step.id === currentStepId);
  return index > 0 ? steps[index - 1] : null;
}
