export const PARRO_ONBOARDING_KEY = 'parro-getting-started';
export const PARRO_ONBOARDING_VERSION = 1;
export const PARRO_ONBOARDING_FIRST_STEP = 'home-workspaces';
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
  advanceOn?: 'next' | 'target-click' | 'signal';
  signal?: string;
};

export const DESKTOP_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'home-workspaces',
    title: '작업 공간을 먼저 확인해요',
    body: '개인 작업 공간과 팀 작업 공간에서 매뉴얼을 구분해 관리할 수 있어요.',
    target: 'home-workspaces',
    route: 'home',
  },
  {
    id: 'home-create',
    title: '만들기 메뉴를 열어보세요',
    body: '웹 녹화, 데스크톱 녹화, 직접 작성, 플레이북을 여기서 시작해요.',
    target: 'home-create-trigger',
    route: 'home',
    advanceOn: 'target-click',
  },
  {
    id: 'home-create-options',
    title: '업무에 맞는 방법을 골라요',
    body: '웹은 Chrome 탭, 데스크톱은 Windows 앱, 직접 작성은 빈 문서, 플레이북은 여러 자료를 묶을 때 사용해요.',
    target: 'home-create-menu',
    route: 'home',
  },
  {
    id: 'home-web-recording',
    title: '안전한 연습 녹화를 준비해요',
    body: '웹 페이지 녹화를 선택하면 Recorder가 클릭과 입력, 화면 변화를 단계로 기록해요.',
    target: 'home-web-recording',
    route: 'home',
    advanceOn: 'target-click',
  },
  {
    id: 'recording-setup',
    title: 'Recorder 연결을 확인해요',
    body: '확장 프로그램이 없으면 새 탭에서 설치한 뒤 이 화면으로 돌아와 다시 연결할 수 있어요.',
    target: 'recording-setup',
    route: 'home',
    advanceOn: 'signal',
    signal: 'recording-ready',
  },
  {
    id: 'recording-start',
    title: 'Parro 연습 페이지에서 시작해요',
    body: '연습 매뉴얼은 사용량에서 제외되며 자동 공유·게시는 되지 않아요.',
    target: 'recording-start',
    route: 'home',
    advanceOn: 'signal',
    signal: 'recording-started',
  },
  {
    id: 'practice-click',
    title: '첫 번째 버튼을 클릭해요',
    body: 'Recorder는 클릭한 위치와 바뀐 화면을 한 단계로 캡처해요.',
    target: 'practice-primary-action',
    route: 'practice',
    advanceOn: 'target-click',
  },
  {
    id: 'practice-input',
    title: '연습 문구를 입력해요',
    body: '입력 내용도 단계의 설명과 재현 정보로 저장할 수 있어요.',
    target: 'practice-input',
    route: 'practice',
    advanceOn: 'target-click',
  },
  {
    id: 'practice-finish',
    title: '잠시 멈춤·실행 취소·완료',
    body: 'Recorder에서 잠시 멈추고, 잘못 캡처한 단계는 실행 취소한 뒤 완료를 누르세요.',
    target: 'practice-finish',
    route: 'practice',
    advanceOn: 'signal',
    signal: 'editor-opened',
  },
  {
    id: 'editor-title',
    title: '매뉴얼 제목을 다듬어요',
    body: '제목을 바꾸면 읽는 사람이 매뉴얼의 목적을 바로 이해할 수 있어요.',
    target: 'editor-title',
    route: 'editor',
  },
  {
    id: 'editor-steps',
    title: '단계 순서를 확인해요',
    body: '왼쪽 목록에서 캡처된 단계의 순서를 바꾸거나 불필요한 단계를 정리할 수 있어요.',
    target: 'editor-steps',
    route: 'editor',
  },
  {
    id: 'editor-content',
    title: '설명·스크린샷·주석을 편집해요',
    body: '단계 설명과 화면 표시를 보정하면 변경 사항이 자동 저장돼요.',
    target: 'editor-manual-content',
    route: 'editor',
  },
  {
    id: 'editor-autosave',
    title: '자동 저장 상태를 확인해요',
    body: '저장 완료 표시를 확인한 뒤 안전하게 다른 화면으로 이동할 수 있어요.',
    target: 'editor-autosave',
    route: 'editor',
  },
  {
    id: 'editor-share',
    title: '공유와 게시는 별도 동작이에요',
    body: 'Parro는 자동으로 공개하지 않아요. 공유 또는 게시 버튼을 직접 눌러야 다른 사람이 볼 수 있어요.',
    target: 'editor-share',
    route: 'editor',
  },
  {
    id: 'editor-guides',
    title: '결과물의 차이를 기억해요',
    body: '웹 문서는 읽는 자료, 학습 가이드는 따라 하는 자료, Live Guide(Beta)는 실제 화면 위 안내예요. 플레이북은 여러 매뉴얼과 문서를 묶어요.',
    target: 'editor-learning-guide',
    route: 'editor',
  },
  {
    id: 'complete',
    title: 'Parro 시작 준비가 끝났어요',
    body: '필요할 때 홈과 도움말에서 언제든 Live Guide를 다시 볼 수 있어요.',
    route: 'any',
  },
];

export const MOBILE_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'home-workspaces',
    title: '개인·팀 작업 공간',
    body: '개인 작업과 팀 작업을 구분해 매뉴얼과 플레이북을 관리할 수 있어요.',
    target: 'home-workspaces',
    route: 'home',
  },
  {
    id: 'mobile-create-overview',
    title: '네 가지 만들기 방법',
    body: '웹 녹화, 데스크톱 녹화, 직접 작성, 플레이북 중 업무 흐름에 맞는 방식을 선택해요.',
    target: 'home-create-trigger',
    route: 'home',
  },
  {
    id: 'mobile-recorder-overview',
    title: 'PC에서 Recorder로 기록',
    body: 'PC Chrome에서 클릭·입력·일시정지·실행 취소·완료를 사용해 안전한 연습 녹화를 진행할 수 있어요.',
    route: 'home',
  },
  {
    id: 'mobile-editor-overview',
    title: '편집하고 자동 저장',
    body: '제목, 단계, 설명, 스크린샷, 주석을 편집하고 저장 완료 상태를 확인해요.',
    route: 'home',
  },
  {
    id: 'mobile-output-overview',
    title: '공유는 항상 직접 선택',
    body: '웹 문서·학습 가이드·Live Guide(Beta)·플레이북은 목적이 다르며, Parro가 자동 게시하거나 공유하지 않아요.',
    route: 'home',
  },
  {
    id: 'complete',
    title: 'PC에서 이어서 연습해보세요',
    body: '진행 상태가 저장됐어요. 홈과 도움말에서 언제든 처음부터 다시 볼 수 있어요.',
    route: 'any',
  },
];

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
