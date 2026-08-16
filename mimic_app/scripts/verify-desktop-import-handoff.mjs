import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const middleware = read('middleware.ts');
const brand = read('lib/brand.ts');
const desktopClient = read('lib/desktop-companion-client.ts');
const recorder = read('../mimic_recorder/background.js');
const createHandoff = read('app/api/extension/desktop-browser-handoff/route.ts');
const redeemHandoff = read('app/api/auth/extension-handoff/route.ts');
const uploadTarget = read('app/api/capture/upload-target/route.ts');

const protectedList = middleware.match(/const PROTECTED = \[([\s\S]*?)\];/)?.[1] || '';
assert.doesNotMatch(protectedList, /['"]\/desktop-import['"]/, 'desktop-import must load before a web session exists');
assert.match(brand, /BRAND_DEV_EXTENSION_ID = 'fbpgolbgpdlphhlodhehiilobpanehal'/, 'web app must keep the dev Recorder extension ID reachable');
assert.match(brand, /BRAND_EXTENSION_IDS = \[BRAND_DEV_EXTENSION_ID, BRAND_NEXT_EXTENSION_ID, BRAND_EXTENSION_ID\]/, 'desktop bridge should try dev, next, and current Recorder IDs');
assert.match(desktopClient, /isExtensionConnectionError\(error\)/, 'desktop import should classify extension connection errors before showing raw messages');
assert.match(desktopClient, /Parro Recorder 확장에 연결하지 못했습니다/, 'desktop import should not show raw extension unreachable errors');
assert.match(recorder, /getDesktopEditorUrl\(imported\)/, 'desktop import must request an authenticated editor handoff');
assert.equal((recorder.match(/message\.action === 'IMPORT_DESKTOP_CAPTURE'/g) || []).length, 1, 'desktop import must have one external message handler');
assert.match(createHandoff, /requireExtensionToken\(request\)/, 'handoff creation must require the linked Recorder token');
assert.match(createHandoff, /\.eq\('user_id', auth\.userId\)/, 'handoff creation must verify manual ownership');
assert.match(redeemHandoff, /verifyOtp\(/, 'handoff redemption must establish the browser session');
assert.match(redeemHandoff, /safeEditorPath/, 'handoff destination must be constrained to a manual editor path');
assert.match(recorder, /processStepUpload\(prepared, \{ requireUploadedImage: true \}\)/, 'desktop import must stop before finalize when an image upload fails');
assert.match(recorder, /const savedStep = await processStepUpload\(prepared, \{ requireUploadedImage: true \}\)/, 'desktop import must retain each uploaded step in memory');
assert.match(recorder, /completedLocalSteps\.push\(savedStep\)/, 'desktop import must retain durable step payloads even if extension storage is stale');
assert.match(recorder, /finalizeSession\(sessionId, completedSteps, null, completedLocalSteps\)/, 'desktop finalize must use the in-memory imported steps');
assert.match(recorder, /if \(requireUploadedImage\) throw err;/, 'desktop import must not ignore save-step API failures');
assert.match(recorder, /effectiveLocalSteps = Array\.isArray\(localStepsOverride\)/, 'finalize must synchronize the explicit desktop step list');
assert.match(recorder, /\/api\/capture\/upload-target/, 'Recorder uploads must use the currently linked web app storage target');
assert.doesNotMatch(recorder, /const SUPABASE_URL\s*=/, 'Recorder must not pin a Supabase project URL');
assert.match(recorder, /return normalizeAllowedWebappOrigin\(webappOrigin\) \|\| WEBAPP_ORIGIN/, 'dev Recorder must not reuse a production web app origin');
assert.match(uploadTarget, /requireExtensionToken\(request\)/, 'upload targets must require the linked Recorder token');
assert.match(uploadTarget, /existingSession\.user_id !== auth\.userId/, 'upload targets must enforce capture-session ownership');
assert.match(uploadTarget, /createSignedUploadUrl\(path, \{ upsert: true \}\)/, 'upload targets must use a short-lived signed Storage upload');

console.log('Desktop import browser handoff contract verified.');
