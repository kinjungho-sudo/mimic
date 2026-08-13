'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const section = (source, start, end) => {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing section: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing section boundary: ${end}`);
  return source.slice(from, to);
};

const background = read('background.js');
const content = read('content.js');
const engine = read('guide-engine.js');
const popup = read('popup.html');
const popupScript = read('popup.js');
const previewPage = read('guide-preview.html');
const previewScript = read('guide-preview.js');
const manifest = JSON.parse(read('manifest.json'));
const liveGuideServer = fs.readFileSync(
  path.resolve(root, '..', 'mimic_app', 'lib', 'live-guide', 'server.ts'),
  'utf8',
);
const playbookServer = fs.readFileSync(
  path.resolve(root, '..', 'mimic_app', 'lib', 'live-guide', 'playbook-server.ts'),
  'utf8',
);

assert.equal(manifest.version, '1.7.20');
assert.deepEqual(
  manifest.content_scripts[0].js.slice(0, 3),
  ['targeting.js', 'guide-engine.js', 'content.js'],
  'replay confidence helpers must load before the guide engine',
);
assert.deepEqual(
  manifest.web_accessible_resources[0].resources,
  ['assets/parro-3d-neutral.png'],
  'the Recorder package must expose only the stable front-facing Parro mascot',
);

const startGuide = section(background, "if (message.action === 'START_GUIDE')", '// ── 내부 메시지 라우터');
assert.match(background, /function normalizeAllowedWebappOrigin\(candidate\)/);
assert.match(background, /function resolveGuideRequestOrigin\(senderOrigin, requestedOrigin\)/);
assert.match(startGuide, /resolveGuideRequestOrigin\(sender\.origin, message\.webapp_origin\)/);
assert.match(startGuide, /const origin = guideRequestOrigin/);
assert.match(startGuide, /message\.guide_source === 'playbook'/);
assert.match(startGuide, /\/api\/guide\/playbook\//);
assert.match(startGuide, /cache: 'no-store'/);
assert.match(startGuide, /!firstStep\?\.page_url\s*\|\|\s*!isSafeNavUrl/);
assert.match(startGuide, /createGuideTab\(firstStep\.page_url/);
assert.doesNotMatch(startGuide, /chrome\.tabs\.update\(sender/);
const guideStatePersist = startGuide.indexOf('await storageSet({');
const guideOverlayFallback = startGuide.indexOf(
  "scheduleGuideOverlay(guideTab.id, guideTab.status === 'complete' ? 80 : 650);",
);
assert.ok(guideStatePersist >= 0 && guideOverlayFallback > guideStatePersist,
  'START_GUIDE must schedule an overlay attempt after guide state is persisted');
assert.equal(
  startGuide.slice(guideStatePersist, guideOverlayFallback).includes("if (guideTab.status === 'complete') {\n          scheduleGuideOverlay"),
  false,
  'post-persist overlay scheduling must not depend on the initial tab status',
);

const targetPicker = section(background, "if (message.action === 'PICK_LIVE_TARGET')", "if (message.action === 'CONNECT')");
assert.match(targetPicker, /Number\.isInteger\(message\.tab_id\)/);
assert.match(targetPicker, /chrome\.tabs\.get\(requestedTabId\)/);
assert.match(targetPicker, /activeBeforePick/);
assert.match(targetPicker, /restoreStudioTab/);
assert.match(targetPicker, /ensureContentScript\(tab\.id\)/);
assert.match(targetPicker, /requestLiveTargetPick\(tab\.id\)/);
assert.match(background, /PARRO_CONTENT_READY/);
assert.match(background, /CONTENT_READY_RETRY_COUNT/);
assert.match(content, /msg\.type === 'PARRO_CONTENT_READY'/);
assert.match(content, /id = 'parro-live-target-picker'/);

const guideNavigation = section(background, "if (message.type === 'GUIDE_NEXT'", '// 사이드패널에서 특정 스텝');
assert.match(guideNavigation, /guideSkippedSteps/);
assert.match(guideNavigation, /guideCompletedSteps/);
assert.match(guideNavigation, /message\.skipped/);
assert.match(guideNavigation, /guideOriginMatches\(tab\.url, step\.page_url\)/);
assert.match(guideNavigation, /navigateGuideTab\(tab\.id, step\.page_url\)/);
const exitGuide = section(background, "if (message.type === 'EXIT_GUIDE')", "if (message.type === 'GUIDE_COMPLETE')");
assert.match(exitGuide, /clearGuideSession\(\)/, 'only an explicit exit may close the retained final panel');
const completeGuide = section(background, "if (message.type === 'GUIDE_COMPLETE')", "if (message.type === 'AI_REGROUND')");
assert.match(completeGuide, /guideFinished: true/);
assert.match(completeGuide, /hideGuideOverlayEverywhere\(\)/);
assert.doesNotMatch(completeGuide, /clearGuideSession\(\)/, 'completion must retain the side panel state');
assert.match(background, /if \(!state\.guideModeActive \|\| state\.guideFinished \|\| state\.guideTabId !== tabId/);
assert.match(background, /new Set\(\['navigating', 'searching', 'ready', 'page_mismatch', 'not_found'\]\)/);
assert.match(background, /async function showGuideWrongPage\(tabId, step, index, total\)/);
assert.match(background, /type: 'SHOW_WRONG_PAGE'/);
assert.match(content, /function renderWrongPageGuide\(msg\)/);
assert.match(content, /msg\.type === 'SHOW_WRONG_PAGE'/);

const show = section(engine, 'function show(step, opts)', 'function advance(reason)');
assert.ok(
  show.indexOf("showWaiting(step, opts, 'page_mismatch')") < show.indexOf("document.createElement('div')"),
  'page validation must happen before any overlay DOM is created',
);
const waiting = section(engine, 'function showWaiting(step, opts, initialStatus)', '// AI 시각 재탐색');
assert.match(waiting, /MutationObserver/);
assert.match(waiting, /Date\.now\(\) - state\.matchingSince >= 8000 \? 'not_found' : 'searching'/);
assert.ok(
  waiting.indexOf("!step?.page_url || !pageMatches(step.page_url)") < waiting.indexOf('ensureWaitingPrompt();'),
  'the scroll prompt must only appear after the guide page matches',
);
assert.match(waiting, /i18n\('waitingScrollDown', '화면을 아래로 스크롤해주세요'\)/);
assert.match(waiting, /window\.scrollBy\(\{/);
assert.match(waiting, /window\.addEventListener\('scroll', scheduleTryResolve, true\)/);
assert.match(engine, /window\.removeEventListener\('scroll', state\.onWaitViewportChange, true\)/);
assert.match(engine, /confidence\s*<\s*0\.85/);
assert.match(engine, /return \{ el: null, rect: null, source: 'none'/);
assert.match(engine, /function validationMessages\(\)/);
assert.match(engine, /function submissionForm\(target\)/);
assert.match(engine, /function validateSubmissionThenAdvance\(form\)/);
assert.match(engine, /if \(form\) validateSubmissionThenAdvance\(form\)/);
assert.match(engine, /function setupRequiredTextInput\(el, expectedText\)/);
assert.match(engine, /current === expectedText/);
assert.match(engine, /setAttribute\('placeholder', expectedText\)/);
assert.doesNotMatch(engine, /function autoFill\(/);

const advance = section(engine, 'function advance(reason)', 'function nudge');
assert.match(advance, /state\.completed = true;[\s\S]*hide\(\);[\s\S]*onComplete/);
const overlayMessage = section(content, "if (msg.type === 'SHOW_OVERLAY' && msg.step)", "if (msg.type === 'HIDE_OVERLAY')");
assert.match(overlayMessage, /queueLiveGuideOverlay\(msg\)/);
const renderOverlay = section(content, 'function renderLiveGuideOverlay(msg)', 'function queueLiveGuideOverlay(msg)');
assert.match(renderOverlay, /onComplete:[\s\S]*guideApi\.hide\(\)[\s\S]*GUIDE_COMPLETE/);
const queueOverlay = section(content, 'function queueLiveGuideOverlay(msg)', '// ── 메시지 수신');
assert.match(queueOverlay, /showCountdown\([\s\S]*startText: 'START'/, 'the first Live Guide step must show 3, 2, 1, START');
assert.match(queueOverlay, /_pendingGuideOverlay/, 'concurrent first-step overlay attempts must be coalesced during countdown');
assert.match(engine, /data-act="copy"/, 'typed Live Guide steps must expose a copy button');
assert.match(engine, /data-role="guide-copy"/);
assert.match(engine, /data-expanded="true"/);
assert.match(engine, /white-space:normal;overflow-wrap:anywhere/);
assert.doesNotMatch(engine, /data-act="toggle-guide-copy"|-webkit-line-clamp:3|slice\(0, 60\)/);
assert.match(engine, /coachAvatar\.setAttribute\('data-role', 'coach-avatar'\)/);
assert.match(engine, /background:transparent;border:none;box-shadow:none/);
assert.match(engine, /\.parro-avatar-stack,\.parro-avatar-layer\{animation:none!important\}/);
assert.match(engine, /\.parro-avatar-layer--secondary\{display:none!important\}/);
assert.doesNotMatch(engine, /parro-ripple|mimic-ripple|const pulse =|state\.pulse/);
assert.match(popup, /data-guide-mascot-frame="borderless"/);
assert.match(popup, /assets\/parro-3d-neutral\.png/);
assert.match(engine, /tooltip\.setAttribute\('data-role', 'guide-bubble'\)/);
assert.match(engine, /const BUBBLE_BG = 'rgba\(255,255,255,\.98\)'/);
assert.match(engine, /const BUBBLE_BORDER = '#17C9B6'/);
assert.match(engine, /border:3px solid \$\{BUBBLE_BORDER\}/);
assert.doesNotMatch(engine, /parro-3d-(talk|point|success)\.png/);
assert.match(engine, /root\.appendChild\(coachAvatar\);[\s\S]*root\.appendChild\(tooltip\);/);
assert.match(engine, /placeCoachAvatar\(coachAvatar, pos\.left, pos\.top, tipH\)/);
assert.match(engine, /animation:parro-avatar-in [^;]+ both;/);
assert.doesNotMatch(engine, /animation:parro-avatar-in [^;]+,parro-avatar-float/);
assert.match(engine, /animation:parro-bubble-in [^;]+ \.09s both/);
assert.match(engine, /appendGuideViewportFrame\(root\)/, 'resolved Live Guide steps must show the viewport-edge guide frame');
assert.match(engine, /appendGuideViewportFrame\(shadow\)/, 'explanation Live Guide steps must show the viewport-edge guide frame');
const explanation = section(engine, 'function showExplanation(step, opts)', 'function showWaiting(step, opts, initialStatus)');
assert.match(explanation, /data-act="hide-explanation"/, 'reference steps must expose a close button');
assert.match(explanation, /aria-label="\$\{escapeHtml\(i18n\('closeReferenceStep', '참고 단계 닫기'\)\)\}"/);
assert.match(explanation, /setExplanationHidden\(true\)/);
assert.match(explanation, /setExplanationHidden\(false\)/);
assert.match(explanation, /host\.setAttribute\('data-explanation-hidden'/);
assert.match(explanation, /action === 'open-guide-preview'/);
const wrongPage = section(engine, 'function showWrongPage(step, opts)', 'function safeCssColor(value, fallback)');
assert.match(wrongPage, /data-guide-state', 'wrong-page'/);
assert.match(wrongPage, /window\.history\.back\(\)/);
assert.match(wrongPage, /window\.location\.assign\(expectedUrl\.href\)/);
assert.match(wrongPage, /data-act="open-expected-page"/);
const visualPreview = section(engine, 'function renderVisualGuideImage(step)', 'function showExplanation(step, opts)');
assert.match(visualPreview, /data-act="open-guide-preview"/);
assert.match(visualPreview, /window\.open\('', 'parro-live-guide-preview'/);
assert.match(visualPreview, /annotations\.map\(renderGuideAnnotation\)/);
assert.match(engine, /const guideApi = \{ show, showWrongPage, hide,/);

assert.match(engine, /assets\/\$\{name\}`\)\}\?v=20260813/);
assert.match(popup, /assets\/parro-3d-neutral\.png\?v=20260813/);
assert.match(popup, /id="guideTargetStatus"/);
assert.match(popup, /id="guideTargetRetry"/);
assert.match(popup, /id="guideStepPreviewBtn"/);
assert.match(popup, /id="guideManualTitle"/);
assert.match(popup, /id="guideVoiceToggle"/);
assert.match(popup, /id="guideVoiceControls"/);
assert.match(popup, /id="guideVoicePlayBtn"/);
assert.match(popup, /id="guideVoiceReplayBtn"/);
assert.match(popup, /data-i18n-title="openPreviewLarge"/);
assert.match(popupScript, /guideStepPreviewBtn\?\.addEventListener\('click'/);
assert.match(popupScript, /chrome\.runtime\.getURL\(`guide-preview\.html\?key=/);
assert.match(popupScript, /chrome\.windows\.create\(\{ url, type: 'popup', width, height \}/);
assert.match(popupScript, /let guideFinished = false/);
assert.match(popupScript, /guideFinishedButton/);
assert.match(popupScript, /guideFinishedHint/);
assert.match(popupScript, /step\.manual_title/);
assert.match(popupScript, /const guideAudio = new Audio\(\)/);
assert.match(popupScript, /GUIDE_VOICE_PREFERENCE_KEY = 'guideVoiceEnabled'/);
assert.match(popupScript, /step\?\.audio_url/);
assert.match(popupScript, /step\.audio_start_ms/);
assert.match(popupScript, /step\.audio_end_ms/);
assert.match(popupScript, /guideAudio\.addEventListener\('timeupdate'/);
assert.match(popupScript, /syncGuideAudioForStep\(step, idx\)/);
assert.match(popupScript, /stopGuideAudio\(\{ clear: true \}\)/);
assert.match(liveGuideServer, /voice_audio_url, voice_audio_start_ms, voice_audio_end_ms/);
assert.match(liveGuideServer, /resolveStepAudio\(/);
assert.match(liveGuideServer, /audio_url: audio\?\.url \?\? null/);
assert.match(liveGuideServer, /tts_enabled: voiceEnabled/);
assert.match(playbookServer, /tts_enabled: loaded\.some\(guide => guide\.tts_enabled\)/);
assert.doesNotMatch(
  section(popupScript, "guideNextBtn.addEventListener('click'", '// Guide Me 활성화 여부 초기 체크'),
  /hideGuideView\(\)/,
  'finishing the last step must not hide the side panel',
);
assert.match(previewPage, /id="previewImage"/);
assert.match(previewPage, /script src="guide-preview\.js"/);
assert.match(previewScript, /chrome\.storage\.local\.get\(key\)/);
assert.match(previewScript, /chrome\.storage\.local\.remove\(key\)/);
assert.match(content, /saveText:\s+true/, 'new capture sessions must retain typed text by default');
assert.match(popupScript, /saveText:\s+true/, 'the Recorder settings UI must default typed-text retention on');
assert.match(popupScript, /not_found: \{ label: t\('targetNotFound', '대상을 찾지 못했습니다'\)/);
assert.match(popupScript, /type: 'SHOW_OVERLAY_FOR_STEP', stepIndex: guideCurrentStep/);

console.log(JSON.stringify({ ok: true, checks: 130, scope: 'live-guide-recovery-preview-completion-voice-expandable-copy-and-separated-coach-contract' }));
