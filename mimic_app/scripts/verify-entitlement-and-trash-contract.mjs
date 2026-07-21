import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { entitlementsForPlan, hasEntitlement } from '../lib/entitlements.ts';
import { TRASH_RETENTION_DAYS, trashCutoff } from '../lib/trash-retention.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(path.join(root, ...parts), 'utf8');

assert.equal(hasEntitlement('free', 'team_workspace'), false);
assert.equal(hasEntitlement('free', 'branding'), false);
assert.equal(hasEntitlement('free', 'protected_sharing'), false);
assert.equal(hasEntitlement('free', 'office_export'), false);
assert.equal(hasEntitlement('free', 'ai_rewrite'), false);
assert.equal(hasEntitlement('free', 'live_guide'), false);
assert.equal(hasEntitlement('basic', 'office_export'), true);
assert.equal(hasEntitlement('basic', 'live_guide'), false);
assert.equal(hasEntitlement('pro', 'branding'), true);
assert.equal(hasEntitlement('pro', 'team_workspace'), false);
assert.equal(hasEntitlement('team', 'team_workspace'), true);
assert.equal(entitlementsForPlan('enterprise').desktop_companion, true);

const workspaceRoute = read('app', 'api', 'workspaces', 'route.ts');
const brandingRoute = read('app', 'api', 'user', 'branding', 'route.ts');
const tutorialRoute = read('app', 'api', 'tutorials', '[id]', 'route.ts');
const pptxRoute = read('app', 'api', 'export', 'pptx', '[id]', 'route.ts');
const docxRoute = read('app', 'api', 'export', 'docx', '[id]', 'route.ts');
const rewriteRoute = read('app', 'api', 'ai', 'rewrite', 'route.ts');
const liveGuideRoute = read('app', 'api', 'guide', '[token]', 'route.ts');
const trashRoute = read('app', 'api', 'trash', 'route.ts');
const cleanupRoute = read('app', 'api', 'cron', 'cleanup-trash', 'route.ts');
const vercel = JSON.parse(read('vercel.json'));
const landing = read('app', 'landingpage', 'page.tsx');
const home = read('app', 'home', 'page.tsx');
const desktopSetup = read('app', 'desktop-setup', 'page.tsx');

assert.match(workspaceRoute, /requireUserEntitlement\(auth\.userId, 'team_workspace'/);
assert.match(brandingRoute, /requireUserEntitlement\(auth\.userId, 'branding'/);
assert.match(tutorialRoute, /requireTutorialEntitlement\(id, 'protected_sharing'/);
assert.match(pptxRoute, /requireTutorialEntitlement\(id, 'office_export'/);
assert.match(docxRoute, /requireTutorialEntitlement\(id, 'office_export'/);
assert.match(rewriteRoute, /requireUserEntitlement\(auth\.userId, 'ai_rewrite'/);
assert.match(liveGuideRoute, /hasEntitlement\(plan, 'live_guide'\)/);
assert.doesNotMatch(liveGuideRoute, /consume_free_live_guide_run/);

assert.equal(TRASH_RETENTION_DAYS, 7);
assert.equal(Date.parse(trashCutoff(Date.UTC(2026, 6, 21))), Date.UTC(2026, 6, 14));
assert.match(trashRoute, /\.gte\('deleted_at', trashCutoff\(\)\)/);
assert.match(cleanupRoute, /request\.nextUrl\.searchParams\.get\('dry_run'\) === '1'/);
assert.match(cleanupRoute, /\.lt\('deleted_at', cutoff\)/);
assert.ok(vercel.crons.some(cron => cron.path === '/api/cron/cleanup-trash'));

assert.doesNotMatch(landing, /href:\s*'#'/);
assert.match(landing, /소개 자료 요청/);
assert.match(home, /'aria-label': `\$\{tutorial\.title\} 매뉴얼 열기`/);
assert.match(home, /aria-label="공지 닫기"/);
assert.match(home, /displayedTutorials\.slice\(0, visibleTutorialCount\)/);
assert.doesNotMatch(desktopSetup, /getDesktopExtensionIds|response\?\.error\}\)`/);

console.log(JSON.stringify({ ok: true, checks: 32, scope: 'entitlement-and-trash-contract' }));
