import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
let checks = 0;
const check = (fn) => { fn(); checks += 1; };

const migration = read('supabase/migrations/20261008100000_shared_rate_limits.sql');
const devSchema = read('supabase/dev-setup/01_mimic_dev_schema.sql');
for (const sql of [migration, devSchema]) {
  check(() => assert.match(sql, /create table if not exists public\.mm_rate_limits/));
  check(() => assert.match(sql, /revoke execute on function public\.consume_rate_limit\(text, integer, integer\) from public, anon, authenticated;/));
  check(() => assert.match(sql, /grant execute on function public\.consume_rate_limit\(text, integer, integer\) to service_role;/));
}
check(() => assert.match(migration, /security definer\s+set search_path = ''/));

const limiter = read('lib/rate-limit.ts');
check(() => assert.match(limiter, /rpc\('consume_rate_limit'/));
check(() => assert.match(limiter, /export function rateLimitAi\(userId: string\): Promise<NextResponse \| null> \{\s+return rateLimitShared/));

// Every AI route must await the shared limiter; a missing await silently disables it.
const aiRoutes = [
  'app/api/ai/rewrite/route.ts', 'app/api/ai/rewrite-all/route.ts', 'app/api/capture/analyze/route.ts',
  'app/api/generate-annotations/route.ts', 'app/api/generate-markers/route.ts', 'app/api/generate-script/route.ts',
  'app/api/steps/[id]/generate-description/route.ts', 'app/api/tts/route.ts',
];
for (const route of aiRoutes) check(() => assert.match(read(route), /await rateLimitAi\(/, `${route} must await rateLimitAi`));

const play = read('app/api/play/[token]/route.ts');
check(() => assert.ok(play.indexOf('share-pw:') < play.indexOf('verifyPassword(password'), 'password guesses must be limited before verification'));

for (const route of ['contact', 'events', 'survey', 'pro-signup']) {
  check(() => assert.match(read(`app/api/${route}/route.ts`), /await rateLimitPublic\(request, '[a-z-]+'/, `${route} must be rate limited`));
}
for (const route of ['events', 'survey']) {
  check(() => assert.match(read(`app/api/${route}/route.ts`), /isKnownGuideId\(/, `${route} must reject unknown guide ids`));
}

// Free daily manual limit counts today's manuals (KST) instead of the never-reset counter.
const finalize = read('app/api/capture/finalize/route.ts');
check(() => assert.doesNotMatch(finalize, /TODO: 정식 서비스 전 플랜별 한도 복구/));
check(() => assert.match(finalize, /if \(!practiceCandidate\) \{\s+const limitResponse = await enforceFreeDailyManualLimit/));
check(() => assert.match(finalize, /\.gte\('created_at', startOfKstDay\(\)\.toISOString\(\)\)/));
check(() => assert.match(read('lib/entitlements.ts'), /unlimited_manuals: \['basic', 'pro', 'team', 'enterprise'\]/));
check(() => assert.match(fs.readFileSync(path.join(root, '../mimic_recorder/background.js'), 'utf8'), /parsed\?\.error === 'daily_limit_reached'/));

console.log(JSON.stringify({ ok: true, checks, scope: 'shared-rate-limits-and-daily-limit' }));
