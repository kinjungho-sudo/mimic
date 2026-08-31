import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appRoot, '..');
const background = fs.readFileSync(path.join(repoRoot, 'mimic_recorder/background.js'), 'utf8');
const finalizeRoute = fs.readFileSync(path.join(appRoot, 'app/api/capture/finalize/route.ts'), 'utf8');

let checks = 0;
const check = (fn) => { fn(); checks += 1; };

check(() => assert.match(background, /CAPTURE_API_TIMEOUT_MS\s*=\s*45000/));
check(() => assert.match(background, /FINALIZE_API_TIMEOUT_MS\s*=\s*120000/));
check(() => assert.match(background, /STORAGE_UPLOAD_TIMEOUT_MS\s*=\s*45000/));
check(() => assert.match(background, /async function fetchWithTimeout\(/));
check(() => assert.match(background, /controller\.abort\(\)/));
check(() => assert.match(background, /REQUEST_TIMEOUT/));
check(() => assert.match(background, /timeoutMs:\s*FINALIZE_API_TIMEOUT_MS/));
check(() => assert.match(background, /STORAGE_UPLOAD_TIMEOUT_MS,\s*\n\s*\)/));
check(() => assert.match(finalizeRoute, /INITIAL_AI_POLISH_TIMEOUT_MS\s*=\s*12_000/));
check(() => assert.match(finalizeRoute, /await withTimeout\(\(async \(\) =>/));
check(() => assert.match(finalizeRoute, /INITIAL_AI_POLISH_TIMEOUT_MS\)/));
check(() => assert.match(finalizeRoute, /const generated = analysis\?\.description \?\? ''/));

const fetchTimeoutStart = background.indexOf('async function fetchWithTimeout');
const fetchTimeoutEnd = background.indexOf('async function authedFetch', fetchTimeoutStart);
assert.ok(fetchTimeoutStart >= 0 && fetchTimeoutEnd > fetchTimeoutStart);
const fetchTimeoutSource = background.slice(fetchTimeoutStart, fetchTimeoutEnd);
let observedAbort = false;
const runtime = {
  AbortController,
  clearTimeout,
  setTimeout,
  fetch: (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      observedAbort = true;
      reject(new DOMException('aborted', 'AbortError'));
    }, { once: true });
  }),
};
vm.runInNewContext(`${fetchTimeoutSource}\nthis.fetchWithTimeout = fetchWithTimeout;`, runtime);

await assert.rejects(
  runtime.fetchWithTimeout('https://dev.invalid/slow', {}, 10),
  error => error?.code === 'REQUEST_TIMEOUT' && /REQUEST_TIMEOUT:10/.test(error.message),
);
checks += 1;
check(() => assert.equal(observedAbort, true));

console.log(JSON.stringify({ ok: true, checks, scope: 'capture-save-timeout-contract' }));
