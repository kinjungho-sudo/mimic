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
const manifest = JSON.parse(read('manifest.json'));

assert.equal(manifest.version, '1.7.25');
assert.deepEqual(
  manifest.content_scripts[0].js.slice(0, 3),
  ['targeting.js', 'guide-engine.js', 'content.js'],
  'replay confidence helpers must load before the guide engine',
);
assert.deepEqual(
  new Set(manifest.web_accessible_resources[0].resources),
  new Set([
    'assets/parro-ai-avatar.png',
    'assets/parro-ai-avatar-neutral.png',
    'assets/parro-ai-avatar-listen.png',
    'assets/parro-ai-avatar-talk.png',
    'assets/parro-ai-avatar-point.png',
    'assets/parro-ai-avatar-think.png',
    'assets/parro-ai-avatar-search.png',
    'assets/parro-ai-avatar-warning.png',
    'assets/parro-ai-avatar-error.png',
    'assets/parro-ai-avatar-blocked.png',
    'assets/parro-ai-avatar-clarify.png',
    'assets/parro-ai-avatar-success.png',
  ]),
  'the Recorder package must expose the Parro mascot assets',
);

const startGuide = section(background, "if (message.action === 'START_GUIDE')", '// ── 내부 메시지 라우터');
assert.match(background, /function normalizeAllowedWebappOrigin\(candidate\)/);
assert.match(background, /function resolveGuideRequestOrigin\(senderOrigin, requestedOrigin\)/);
assert.match(startGuide, /resolveGuideRequestOrigin\(sender\.origin, message\.webapp_origin\)/);
assert.match(startGuide, /const origin = guideRequestOrigin/);
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
assert.match(background, /message\.type === 'EXIT_GUIDE' \|\| message\.type === 'GUIDE_COMPLETE'[\s\S]*clearGuideSession\(\)/);
assert.match(background, /if \(!state\.guideModeActive \|\| state\.guideTabId !== tabId/);
assert.match(background, /new Set\(\['navigating', 'searching', 'ready', 'page_mismatch', 'not_found'\]\)/);

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
assert.match(waiting, /'화면을 아래로 스크롤해주세요'/);
assert.match(waiting, /window\.scrollBy\(\{/);
assert.match(waiting, /const removeWaitingPrompt = \(\) =>/,
  'missing-target waits must remove the page overlay when the target is declared not found');
assert.match(waiting, /if \(nextStatus === 'not_found'\) removeWaitingPrompt\(\)/,
  'not_found must leave the page clean while the side panel retry stays available');
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
assert.match(engine, /data-act="toggle-guide-voice"/, 'Live Guide overlays must expose voice playback controls');
assert.match(engine, /GUIDE_VOICE_PREFERENCE_KEY = 'guideVoiceEnabled'/);
assert.match(engine, /step\?\.audio_url/);
assert.match(engine, /new Audio\(\)/);
assert.match(engine, /window\.SpeechSynthesisUtterance/);
assert.match(engine, /window\.speechSynthesis\.speak\(utterance\)/);
assert.match(engine, /utterance\.lang = \/\[가-힣\]\/\.test\(text\) \? 'ko-KR' : 'en-US'/);
assert.match(engine, /function stopGuideVoice\(\)/);
assert.match(engine, /function hide\(\) \{\s*stopGuideVoice\(\);/);
assert.match(engine, /data-act="toggle-guide-voice"/, 'Live Guide bubbles must expose voice playback controls');
assert.match(engine, /GUIDE_VOICE_PREFERENCE_KEY = 'guideVoiceEnabled'/);
assert.match(engine, /step\?\.audio_url/);
assert.match(engine, /new Audio\(\)/);
assert.match(engine, /window\.SpeechSynthesisUtterance/);
assert.match(engine, /window\.speechSynthesis\.speak\(utterance\)/);
assert.match(engine, /chrome\.storage\.onChanged\?\.addListener/);
assert.match(engine, /utterance\.lang = \/\[가-힣\]\/.test\(text\) \? 'ko-KR' : 'en-US'/);
assert.match(engine, /function stopGuideVoice\(\)/);
assert.match(engine, /function hide\(\) \{\s*stopGuideVoice\(\);/);
assert.match(engine, /data-role="guide-copy"/);
assert.match(engine, /data-expanded="true"/);
assert.match(engine, /white-space:normal;overflow-wrap:anywhere/);
assert.doesNotMatch(engine, /data-act="toggle-guide-copy"|-webkit-line-clamp:3|slice\(0, 60\)/);
assert.match(engine, /data-role="coach-avatar"/);
assert.match(engine, /background:transparent;border:none;box-shadow:none/);
assert.match(engine, /\.parro-avatar-stack,\.parro-avatar-layer\{animation:none!important\}/);
assert.match(engine, /\.parro-avatar-layer--secondary\{display:none!important\}/);
assert.doesNotMatch(engine, /parro-ripple|mimic-ripple|const pulse =|state\.pulse/);
assert.match(popup, /data-guide-mascot-frame="borderless"/);
assert.match(popup, /assets\/parro-ai-avatar-neutral\.png/);
assert.match(engine, /tooltip\.setAttribute\('data-role', 'guide-bubble'\)/);
assert.doesNotMatch(engine, /parro-3d-(talk|point|success)\.png/);
assert.match(engine, /appendGuideViewportFrame\(root\)/, 'resolved Live Guide steps must show the viewport-edge guide frame');
assert.match(engine, /appendGuideViewportFrame\(shadow\)/, 'explanation Live Guide steps must show the viewport-edge guide frame');

assert.match(engine, /assets\/\$\{name\}`\)\}\?v=20260813/);
assert.match(popup, /assets\/parro-ai-avatar-neutral\.png\?v=20260813/);
assert.match(popup, /id="guideTargetStatus"/);
assert.match(popup, /id="guideTargetRetry"/);
const popupScript = read('popup.js');
assert.match(content, /saveText:\s+true/, 'new capture sessions must retain typed text by default');
assert.match(content, /const rect = el\.getBoundingClientRect\(\);[\s\S]*normalizeRect\(topRect, vw, vh\)/,
  'typing captures must use the complete editable DOM bounds');
assert.doesNotMatch(content, /selection\.getRangeAt|range\.getBoundingClientRect/,
  'typing geometry must not collapse to a contenteditable caret or selection line');
assert.match(content, /let typingGeometrySnapshot = null/,
  'typing captures must cache stable geometry while the user is still typing');
assert.match(content, /typingGeometrySnapshot = captureTypingGeometrySnapshot\(el\)/,
  'input events must refresh typing geometry before a send-click can steal focus');
assert.match(content, /reusableTypingGeometrySnapshot\(el, label\)[\s\S]*captureTypingGeometrySnapshot\(el, label\)/,
  'typing flush must prefer cached in-field geometry and only then fall back to live DOM');
assert.match(popupScript, /saveText:\s+true/, 'the Recorder settings UI must default typed-text retention on');
assert.match(popupScript, /not_found: \{ label: '대상을 찾지 못했습니다'/);
assert.match(popupScript, /type: 'SHOW_OVERLAY_FOR_STEP', stepIndex: guideCurrentStep/);

console.log(JSON.stringify({ ok: true, checks: 73, scope: 'live-guide-avatar-readable-overlay-voice-contract' }));
