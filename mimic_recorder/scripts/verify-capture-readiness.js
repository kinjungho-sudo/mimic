'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const recorderRoot = path.resolve(__dirname, '..');
const popupHtml = fs.readFileSync(path.join(recorderRoot, 'popup.html'), 'utf8');
const popupJs = fs.readFileSync(path.join(recorderRoot, 'popup.js'), 'utf8');

let checks = 0;
function check(assertion) {
  assertion();
  checks += 1;
}

check(() => assert.match(popupHtml, /id="captureReadiness"[\s\S]*role="status"[\s\S]*aria-live="polite"/));
check(() => assert.match(popupHtml, /id="captureReadinessRetry"[\s\S]*다시 확인/));
check(() => assert.match(popupJs, /if \(!navigator\.onLine\)/));
check(() => assert.match(popupJs, /new AbortController\(\)/));
check(() => assert.match(popupJs, /method: 'HEAD'/));
check(() => assert.match(popupJs, /cache: 'no-store'/));
check(() => assert.match(popupJs, /인터넷에 연결되어 있지 않습니다/));
check(() => assert.match(popupJs, /Parro 서버에 연결할 수 없습니다/));
check(() => assert.match(popupJs, /window\.addEventListener\('online'/));
check(() => assert.match(popupJs, /window\.addEventListener\('offline'/));

check(() => {
  const start = popupJs.indexOf('async function startRecording()');
  const readiness = popupJs.indexOf('await checkCaptureReadiness()', start);
  const recordingState = popupJs.indexOf('isRecording  = true', start);
  assert.ok(start >= 0 && readiness > start && recordingState > readiness,
    'capture readiness must pass before recording state changes');
});

check(() => {
  const start = popupJs.indexOf('function checkCaptureReadiness()');
  const end = popupJs.indexOf("captureReadinessRetry?.addEventListener", start);
  const block = popupJs.slice(start, end);
  assert.doesNotMatch(block, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i,
    'readiness probing must remain read-only');
});

console.log(JSON.stringify({
  ok: true,
  checks,
  scope: 'recorder-capture-readiness-contract',
  networkMutation: false,
  captureStarted: false,
}));
