'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const editor = read('app', 'manual', '[id]', 'editor', 'page.tsx');
const share = read('components', 'editor', 'ShareModal.tsx');
const studio = read('app', 'manual', '[id]', 'studio', 'page.tsx');
const liveGuideApi = read('lib', 'api', 'liveGuide.ts');
const liveGuideRoute = read('app', 'api', 'guide', '[token]', 'route.ts');
const home = read('app', 'home', 'page.tsx');
const landing = read('app', 'landingpage', 'page.tsx');
const landingLayout = read('app', 'landingpage', 'layout.tsx');
const landingFaq = read('lib', 'landing-faq.ts');
const desktopSetup = read('app', 'desktop-setup', 'page.tsx');

assert.match(editor, /new AbortController\(\)/, 'AI rewrite must be cancellable');
assert.match(editor, /signal: controller\.signal/, 'AI rewrite fetch must use the abort signal');
assert.match(editor, /45_000/, 'AI rewrite must have a bounded timeout');
assert.match(editor, /id="refine-confirm-title"/, 'AI rewrite must use an in-app confirmation dialog');
assert.match(editor, /AI 재작성이 45초를 초과했습니다/, 'AI rewrite timeout must be explained');
assert.match(editor, /다시 시도/, 'AI rewrite failure must expose retry');
assert.doesNotMatch(editor, /window\.confirm\('전체 제목과 본문/, 'AI rewrite must not use a blocking browser confirm');

assert.match(share, /if \(hasError \|\| hasWarning\) return;/, 'publishing must wait for quality results');
assert.match(share, /제안 확인 후 게시/, 'quality warnings must require explicit approval');
assert.match(share, /awaitingWarningApproval/, 'warning approval must block link actions');

assert.match(studio, /listLiveGuideTargetTabs/, 'Studio must list target tabs before picking');
assert.match(studio, /이 대상으로 저장할까요\?/, 'Studio must confirm a picked target before saving');
assert.match(studio, /실행 취소/, 'Studio must allow reverting the last target change');
assert.match(studio, /data-testid="studio-preview-overlay"/, 'Studio preview overlay needs a stable interaction target');
assert.match(studio, /data-testid="studio-target-notice"/, 'Studio target notice needs a stable interaction target');
const previewLayer = Number(studio.match(/STUDIO_PREVIEW_LAYER_Z_INDEX\s*=\s*(\d+)/)?.[1]);
const targetNoticeLayer = Number(studio.match(/STUDIO_TARGET_NOTICE_LAYER_Z_INDEX\s*=\s*(\d+)/)?.[1]);
assert.ok(previewLayer > targetNoticeLayer, 'Studio target notices must not cover preview controls');
assert.match(liveGuideApi, /PICK_LIVE_TARGET', tab_id: tabId/, 'Studio must send the explicit target tab id');
assert.match(liveGuideApi, /RUNTIME_MESSAGE_TIMEOUT_MS\s*=\s*8_000/, 'Recorder messages must have a bounded timeout');
assert.match(liveGuideApi, /TARGET_PICK_TIMEOUT_MS\s*=\s*35_000/, 'interactive target selection must have a bounded timeout');
assert.match(liveGuideApi, /webapp_origin:\s*window\.location\.origin/, 'Live Guide must send the exact calling webapp origin');
assert.match(liveGuideRoute, /dynamic\s*=\s*'force-dynamic'/, 'Live Guide responses must not be statically cached');
assert.match(liveGuideRoute, /Cache-Control':\s*'private, no-store, max-age=0'/, 'Live Guide responses must disable browser and intermediary caches');

assert.match(home, /firstName \? `\$\{firstName\}님의 워크스페이스` : '내 워크스페이스'/, 'anonymous workspace title must not start with 님의');
assert.match(home, /`\$\{liveGuide\.used\} \/ 무제한`/, 'Live Guide paid usage needs a readable separator');
assert.match(home, /`\$\{playbook\.used\} \/ 무제한`/, 'Playbook paid usage needs a readable separator');

assert.match(landing, /LANDING_FAQS\.map/, 'visible landing FAQ must use the shared FAQ source');
assert.match(landingLayout, /LANDING_FAQS\.map/, 'FAQ structured data must use the shared FAQ source');
assert.match(landingLayout, /title:\s*BRAND_TAGLINE/, 'landing metadata must not duplicate the Parro brand suffix');
assert.match(landingFaq, /아직 일반 결제를 받고 있지 않습니다/, 'prelaunch FAQ must describe billing availability truthfully');
assert.match(landingFaq, /현재는 사용자가 직접 결제 플랜을 변경하는 기능이 제공되지 않습니다/, 'prelaunch FAQ must not promise unavailable self-service plan changes');
assert.doesNotMatch(landingFaq, /카카오페이|토스페이|전액 환불|언제든 구독을 해지/, 'prelaunch FAQ must not promise unavailable billing operations');
assert.doesNotMatch(desktopSetup, /Parro Recorder 1\.7\.4/, 'desktop setup must not hard-code an obsolete Recorder version');

console.log(JSON.stringify({ ok: true, checks: 32, scope: 'manual-ux-contract' }));
