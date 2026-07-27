import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  DESKTOP_ONBOARDING_STEPS,
  MOBILE_ONBOARDING_STEPS,
  ONBOARDING_EVENT_TYPES,
  PARRO_ONBOARDING_FIRST_STEP,
  buildOnboardingCompletionPatch,
  buildOnboardingStartPatch,
  getNextOnboardingStep,
  getPreviousOnboardingStep,
} from '../lib/onboarding.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '..');
const readApp = (...parts) => readFileSync(path.join(appRoot, ...parts), 'utf8');
const readRepo = (...parts) => readFileSync(path.join(repoRoot, ...parts), 'utf8');
let checks = 0;
const check = (assertion) => {
  assertion();
  checks += 1;
};

const desktopIds = DESKTOP_ONBOARDING_STEPS.map(step => step.id);
const mobileIds = MOBILE_ONBOARDING_STEPS.map(step => step.id);

check(() => assert.equal(desktopIds[0], PARRO_ONBOARDING_FIRST_STEP));
check(() => assert.equal(desktopIds.at(-1), 'complete'));
check(() => assert.equal(mobileIds[0], PARRO_ONBOARDING_FIRST_STEP));
check(() => assert.equal(mobileIds.at(-1), 'complete'));
check(() => assert.equal(new Set(desktopIds).size, desktopIds.length));
check(() => assert.equal(new Set(mobileIds).size, mobileIds.length));
check(() => assert.deepEqual(
  desktopIds,
  ['home-create', 'home-blank-manual', 'editor-title', 'editor-content', 'complete'],
));
check(() => assert.deepEqual(mobileIds, desktopIds));
check(() => assert.equal(
  DESKTOP_ONBOARDING_STEPS.find(step => step.id === 'home-create')?.advanceOn,
  undefined,
));
check(() => assert.equal(
  DESKTOP_ONBOARDING_STEPS.find(step => step.id === 'home-blank-manual')?.advanceOn,
  'target-click',
));
check(() => assert.ok(desktopIds.includes('editor-title')));
check(() => assert.ok(desktopIds.includes('editor-content')));
check(() => assert.doesNotMatch(desktopIds.join(','), /recording|practice|share|guides/));
check(() => assert.equal(getNextOnboardingStep('home-create', false)?.id, 'home-blank-manual'));
check(() => assert.equal(getPreviousOnboardingStep('home-blank-manual', false)?.id, 'home-create'));

const completedAt = '2026-07-20T01:02:03.000Z';
const replayAt = '2026-07-24T05:06:07.000Z';
const replayPatch = buildOnboardingStartPatch({ run_count: 3 }, replayAt);
check(() => assert.equal(replayPatch.current_step, PARRO_ONBOARDING_FIRST_STEP));
check(() => assert.equal(replayPatch.run_count, 4));
check(() => assert.equal(replayPatch.status, 'in_progress'));
const completePatch = buildOnboardingCompletionPatch({ initial_completed_at: completedAt }, replayAt);
check(() => assert.equal(completePatch.initial_completed_at, completedAt));
check(() => assert.equal(completePatch.last_completed_at, replayAt));
check(() => assert.equal(completePatch.status, 'completed'));
check(() => assert.deepEqual(
  ONBOARDING_EVENT_TYPES,
  [
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
  ],
));

const migration = readApp('supabase', 'migrations', '20260724090000_create_user_onboarding.sql');
for (const column of [
  'user_id',
  'guide_key',
  'guide_version',
  'status',
  'current_step',
  'initial_completed_at',
  'last_started_at',
  'last_completed_at',
  'dismissed_at',
  'run_count',
  'practice_manual_id',
  'created_at',
  'updated_at',
]) {
  check(() => assert.match(migration, new RegExp(`\\b${column}\\b`)));
}
check(() => assert.match(migration, /PRIMARY KEY \(user_id, guide_key, guide_version\)/));
check(() => assert.match(migration, /ENABLE ROW LEVEL SECURITY/));
check(() => assert.match(migration, /auth\.uid\(\) = user_id/));
check(() => assert.match(migration, /practice_capture_token uuid/));
check(() => assert.match(migration, /practice_capture_consumed_at timestamptz/));

const api = readApp('app', 'api', 'user', 'onboarding', 'route.ts');
check(() => assert.match(api, /process\.env\.VERCEL_ENV !== 'production'/));
check(() => assert.match(api, /automatic_onboarding_enabled: automaticOnboardingEnabled/));
check(() => assert.match(api, /eligible_for_auto_prompt: automaticOnboardingEnabled && !progress && contentCount === 0/));
check(() => assert.match(api, /mm_tutorials/));
check(() => assert.match(api, /mm_pages/));
check(() => assert.match(api, /mm_manuals/));
check(() => assert.match(api, /buildOnboardingStartPatch/));
check(() => assert.match(api, /buildOnboardingCompletionPatch/));
check(() => assert.match(api, /action: z\.literal\('dismiss_active'\)/));
check(() => assert.match(api, /existing\.status !== 'in_progress'/));
check(() => assert.match(api, /clear_practice_manual/));
check(() => assert.match(api, /practice_manual_id: z\.string\(\)\.uuid\(\)\.optional\(\)/));
check(() => assert.match(api, /mm_onboarding_events/));
check(() => assert.match(api, /if \(error\) throw error/));
check(() => assert.match(api, /Onboarding storage unavailable/));

const authClient = readApp('lib', 'auth', 'auth-client.ts');
check(() => assert.match(authClient, /body: JSON\.stringify\(\{ action: 'dismiss_active' \}\)/));
check(() => assert.ok(
  authClient.indexOf("action: 'dismiss_active'") < authClient.indexOf('supabase.auth.signOut()'),
));

const provider = readApp('components', 'onboarding', 'ParroOnboardingProvider.tsx');
check(() => assert.match(provider, /MutationObserver/));
check(() => assert.match(provider, /prefers-reduced-motion/));
check(() => assert.match(provider, /window\.confirm/));
check(() => assert.match(provider, /Live Guide 시작/));
check(() => assert.match(provider, /data\.automatic_onboarding_enabled && data\.progress\?\.status === 'in_progress'/));
check(() => assert.match(provider, /30초 만에 Parro 익히기/));
check(() => assert.doesNotMatch(provider, /3분 만에 Parro 익히기/));
check(() => assert.doesNotMatch(provider, /이 단계 건너뛰기/));
check(() => assert.doesNotMatch(provider, /Recorder에서 완료하면 자동 진행/));
check(() => assert.match(provider, /나중에 하기/));
check(() => assert.match(provider, /Recorder 설치나 녹화 연습 없이 바로 시작/));
check(() => assert.match(provider, /처음부터 다시 보기/));
check(() => assert.match(provider, /이동 중…/));
check(() => assert.match(provider, /disabled=\{isTransitioning\}/));
check(() => assert.match(provider, /completionOpen \? 100/));
check(() => assert.match(provider, /aria-valuenow=\{percent\}/));
check(() => assert.match(provider, /currentStep\.advanceOn === 'target-input'/));
check(() => assert.match(provider, /event\.key === 'Enter'/));
check(() => assert.doesNotMatch(provider, /inputChangeListener/));
check(() => assert.match(provider, /eventTarget\.isContentEditable/));
check(() => assert.match(provider, /parro-onboarding-side-panel-hint/));
check(() => assert.doesNotMatch(provider, /setTimeout\(\(\) => setActive\(false\)/));

const home = readApp('app', 'home', 'page.tsx');
check(() => assert.match(home, /Live Guide 다시 보기/g));
check(() => assert.match(home, /data-parro-guide="home-workspaces"/));
check(() => assert.match(home, /data-parro-guide="home-create-trigger"/));
check(() => assert.match(home, /data-parro-guide="home-create-menu"/));
check(() => assert.match(home, /data-parro-guide="home-web-recording"/));
check(() => assert.match(home, /data-parro-guide="home-blank-manual"/));
check(() => assert.match(home, /window\.addEventListener\('parro:open-create-menu', openCreateMenu\)/));
check(() => assert.match(home, /parro:onboarding-manual-created/));
check(() => assert.match(home, /disabled=\{onboardingCreateLocked\}/));
check(() => assert.doesNotMatch(home, /parro:onboarding-select-web-recording/));
check(() => assert.match(home, /새 매뉴얼 직접 작성만 선택할 수 있어요/));

check(() => assert.match(provider, /window\.dispatchEvent\(new Event\('parro:open-create-menu'\)\)/));
check(() => assert.match(provider, /next\.id === 'home-blank-manual'/));
check(() => assert.match(provider, /parro:onboarding-manual-created/));
check(() => assert.match(provider, /practice_manual_id: practiceManualId/));
check(() => assert.doesNotMatch(provider, /parro:onboarding-next/));

const help = readApp('app', 'help', 'page.tsx');
check(() => assert.match(help, /Live Guide로 다시 보기/));
check(() => assert.match(help, /\/home\?onboarding=replay/));

const practice = readApp('app', 'onboarding', 'practice', 'page.tsx');
check(() => assert.match(practice, /안전한 연습 페이지/));
check(() => assert.match(practice, /data-parro-guide="practice-primary-action"/));
check(() => assert.match(practice, /data-parro-guide="practice-input"/));
check(() => assert.match(practice, /data-parro-guide="practice-finish"/));
check(() => assert.match(practice, /자동 게시·공유되지 않습니다/));

const editor = readApp('app', 'manual', '[id]', 'editor', 'page.tsx');
const manualEditor = readApp('components', 'editor', 'ManualEditor.tsx');
for (const target of ['editor-title', 'editor-steps', 'editor-autosave', 'editor-share', 'editor-learning-guide']) {
  check(() => assert.match(editor, new RegExp(`data-parro-guide="${target}"`)));
}
check(() => assert.match(manualEditor, /data-parro-guide="editor-manual-content"/));
check(() => assert.match(editor, /초안 미리보기 \(소유자 전용, 새 탭\)/));
check(() => assert.match(editor, /\/play\/\$\{id\}\?preview=1/));

const playApi = readApp('app', 'api', 'play', '[token]', 'route.ts');
check(() => assert.match(playApi, /createServerClient/));
check(() => assert.match(playApi, /ownerId\s*\?\s*tutorialQuery\.eq\('id', token\)\.eq\('user_id', ownerId\)/));
check(() => assert.match(playApi, /Unauthorized/));

const recordingModal = readApp('components', 'dashboard', 'RecordingModal.tsx');
check(() => assert.match(recordingModal, /OPEN_ONBOARDING_PRACTICE/));
check(() => assert.match(recordingModal, /onboarding_token/));
check(() => assert.match(recordingModal, /target="_blank"/));
check(() => assert.doesNotMatch(recordingModal, /window\.location\.href = STORE_URL/));
check(() => assert.match(recordingModal, /data-parro-guide="recording-setup"/));
check(() => assert.match(recordingModal, /data-parro-guide="recording-start"/));
check(() => assert.match(recordingModal, /data-parro-guide=\{onboardingMode \? 'recording-setup'/));
check(() => assert.doesNotMatch(recordingModal, /parro:onboarding-next/));

const background = readRepo('mimic_recorder', 'background.js');
check(() => assert.match(background, /message\.action === 'OPEN_ONBOARDING_PRACTICE'/));
check(() => assert.match(background, /practiceUrl\.pathname !== '\/onboarding\/practice'/));
check(() => assert.match(background, /onboardingToken/));
check(() => assert.match(background, /onboarding_token: onboardingToken/));
check(() => assert.match(background, /onboarding_practice \? '&onboarding=1'/));

const extensionId = readApp('lib', 'extension-id.ts');
const recorderContent = readRepo('mimic_recorder', 'content.js');
check(() => assert.match(recorderContent, /environment: PROD_EXTENSION_IDS\.has\(chrome\.runtime\.id\) \? 'production' : 'development'/));
check(() => assert.match(extensionId, /sessionPreferredEnvironment === 'development'/));
check(() => assert.match(extensionId, /if \(data\.environment === 'development'\) finish\(id\)/));

const finalize = readApp('app', 'api', 'capture', 'finalize', 'route.ts');
check(() => assert.match(finalize, /liveEvents\.every\(event => isOnboardingPracticeUrl/));
check(() => assert.match(finalize, /tokenAgeMs <= 30 \* 60 \* 1000/));
check(() => assert.match(finalize, /\.is\('practice_capture_consumed_at', null\)/));
check(() => assert.match(finalize, /if \(!onboardingPractice\)/));
check(() => assert.match(finalize, /onboarding_practice: onboardingPractice/));

console.log(JSON.stringify({
  ok: true,
  checks,
  scope: 'parro-onboarding-live-guide-contract',
  desktopSteps: desktopIds.length,
  mobileSteps: mobileIds.length,
}));
