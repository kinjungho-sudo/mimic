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
check(() => assert.ok(desktopIds.includes('recording-setup')));
check(() => assert.ok(desktopIds.includes('practice-finish')));
check(() => assert.ok(desktopIds.includes('editor-title')));
check(() => assert.ok(desktopIds.includes('editor-steps')));
check(() => assert.ok(desktopIds.includes('editor-content')));
check(() => assert.ok(desktopIds.includes('editor-share')));
check(() => assert.ok(desktopIds.includes('editor-guides')));
check(() => assert.equal(getNextOnboardingStep('home-workspaces', false)?.id, 'home-create'));
check(() => assert.equal(getPreviousOnboardingStep('home-create', false)?.id, 'home-workspaces'));

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
check(() => assert.match(api, /eligible_for_auto_prompt: !progress && contentCount === 0/));
check(() => assert.match(api, /mm_tutorials/));
check(() => assert.match(api, /mm_pages/));
check(() => assert.match(api, /mm_manuals/));
check(() => assert.match(api, /buildOnboardingStartPatch/));
check(() => assert.match(api, /buildOnboardingCompletionPatch/));
check(() => assert.match(api, /clear_practice_manual/));
check(() => assert.match(api, /mm_onboarding_events/));

const provider = readApp('components', 'onboarding', 'ParroOnboardingProvider.tsx');
check(() => assert.match(provider, /MutationObserver/));
check(() => assert.match(provider, /prefers-reduced-motion/));
check(() => assert.match(provider, /window\.confirm/));
check(() => assert.match(provider, /Live Guide 시작/));
check(() => assert.match(provider, /나중에 하기/));
check(() => assert.match(provider, /내 매뉴얼 만들기/));
check(() => assert.match(provider, /연습 매뉴얼 열기/));
check(() => assert.match(provider, /처음부터 다시 보기/));
check(() => assert.match(provider, /휴지통으로 이동/));
check(() => assert.match(provider, /completionOpen \? 100/));
check(() => assert.doesNotMatch(provider, /setTimeout\(\(\) => setActive\(false\)/));

const home = readApp('app', 'home', 'page.tsx');
check(() => assert.match(home, /Live Guide 다시 보기/g));
check(() => assert.match(home, /data-parro-guide="home-workspaces"/));
check(() => assert.match(home, /data-parro-guide="home-create-trigger"/));
check(() => assert.match(home, /data-parro-guide="home-create-menu"/));
check(() => assert.match(home, /data-parro-guide="home-web-recording"/));
check(() => assert.match(home, /window\.addEventListener\('parro:open-create-menu', openCreateMenu\)/));
check(() => assert.match(home, /onboardingMode=/));

check(() => assert.match(provider, /window\.dispatchEvent\(new Event\('parro:open-create-menu'\)\)/));
check(() => assert.match(provider, /currentStep\.id === 'home-web-recording'/));

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

const recordingModal = readApp('components', 'dashboard', 'RecordingModal.tsx');
check(() => assert.match(recordingModal, /OPEN_ONBOARDING_PRACTICE/));
check(() => assert.match(recordingModal, /onboarding_token/));
check(() => assert.match(recordingModal, /target="_blank"/));
check(() => assert.doesNotMatch(recordingModal, /window\.location\.href = STORE_URL/));
check(() => assert.match(recordingModal, /data-parro-guide="recording-setup"/));
check(() => assert.match(recordingModal, /data-parro-guide="recording-start"/));

const background = readRepo('mimic_recorder', 'background.js');
check(() => assert.match(background, /message\.action === 'OPEN_ONBOARDING_PRACTICE'/));
check(() => assert.match(background, /practiceUrl\.pathname !== '\/onboarding\/practice'/));
check(() => assert.match(background, /onboardingToken/));
check(() => assert.match(background, /onboarding_token: onboardingToken/));
check(() => assert.match(background, /onboarding_practice \? '&onboarding=1'/));

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
