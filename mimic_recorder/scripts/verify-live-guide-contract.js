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

assert.equal(manifest.version, '1.7.5');
assert.deepEqual(
  manifest.content_scripts[0].js.slice(0, 3),
  ['targeting.js', 'guide-engine.js', 'content.js'],
  'replay confidence helpers must load before the guide engine',
);

const startGuide = section(background, "if (message.action === 'START_GUIDE')", '// ── 내부 메시지 라우터');
assert.match(startGuide, /!firstStep\?\.page_url\s*\|\|\s*!isSafeNavUrl/);
assert.match(startGuide, /createGuideTab\(firstStep\.page_url/);
assert.doesNotMatch(startGuide, /chrome\.tabs\.update\(sender/);

const guideNavigation = section(background, "if (message.type === 'GUIDE_NEXT'", '// 사이드패널에서 특정 스텝');
assert.match(guideNavigation, /idx\s*>=\s*steps\.length\s*-\s*1[\s\S]*clearGuideSession\(\)/);
assert.match(background, /message\.type === 'EXIT_GUIDE' \|\| message\.type === 'GUIDE_COMPLETE'[\s\S]*clearGuideSession\(\)/);
assert.match(background, /if \(!state\.guideModeActive \|\| state\.guideTabId !== tabId/);

const show = section(engine, 'function show(step, opts)', 'function advance(reason)');
assert.ok(
  show.indexOf("showWaiting(step, opts, 'page_mismatch')") < show.indexOf("document.createElement('div')"),
  'page validation must happen before any overlay DOM is created',
);
const waiting = section(engine, 'function showWaiting(step, opts, initialStatus)', '// AI 시각 재탐색');
assert.doesNotMatch(waiting, /document\.createElement/);
assert.match(waiting, /MutationObserver/);
assert.match(engine, /confidence\s*<\s*0\.85/);
assert.match(engine, /return \{ el: null, rect: null, source: 'none'/);

const advance = section(engine, 'function advance(reason)', 'function nudge');
assert.match(advance, /state\.completed = true;[\s\S]*hide\(\);[\s\S]*onComplete/);
const overlayMessage = section(content, "if (msg.type === 'SHOW_OVERLAY' && msg.step)", "if (msg.type === 'HIDE_OVERLAY')");
assert.match(overlayMessage, /onComplete:[\s\S]*guideApi\.hide\(\)[\s\S]*GUIDE_COMPLETE/);

assert.match(popup, /assets\/parro-ai-avatar-neutral\.png\?v=20260720/);
assert.match(popup, /id="guideTargetStatus"/);

console.log(JSON.stringify({ ok: true, checks: 16, scope: 'live-guide-fail-closed-contract' }));
