import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261004074748_p0_security_hardening.sql'),
  'utf8',
);
const devSchema = fs.readFileSync(
  path.join(root, 'supabase/dev-setup/01_mimic_dev_schema.sql'),
  'utf8',
);
const deleteRoute = fs.readFileSync(path.join(root, 'app/api/user/delete/route.ts'), 'utf8');
const claudeSettings = JSON.parse(
  fs.readFileSync(path.join(root, '../.claude/settings.json'), 'utf8'),
);

for (const signature of [
  'increment_daily_manual_count(uuid)',
  'increment_execution_completed(uuid)',
  'consume_free_live_guide_run(uuid, integer)',
]) {
  assert.match(
    migration,
    new RegExp(`revoke execute on function public\\.${signature.replace(/[()]/g, '\\$&')} from public, anon, authenticated;`),
    `${signature} must reject direct public, anon, and authenticated execution`,
  );
  assert.match(
    migration,
    new RegExp(`grant execute on function public\\.${signature.replace(/[()]/g, '\\$&')} to service_role;`),
    `${signature} must be callable only through the service-role server path`,
  );
}

assert.equal((migration.match(/set search_path = ''/g) ?? []).length, 7);
assert.match(migration, /revoke execute on function public\.handle_new_user\(\) from public, anon, authenticated, service_role;/);
assert.match(migration, /revoke execute on function public\.purge_old_trash\(\) from public, anon, authenticated, service_role;/);
assert.match(migration, /create policy mm_subscriptions_owner_read[\s\S]*for select[\s\S]*to authenticated/);
assert.match(migration, /revoke insert, update, delete on table public\.mm_subscriptions from anon, authenticated;/);
assert.match(migration, /drop policy if exists "anon upload" on storage\.objects;/);
assert.match(migration, /drop policy if exists "mimic_tts_auth_insert" on storage\.objects;/);
assert.match(migration, /create policy "authenticated upload own screenshots"/);
assert.match(migration, /\(storage\.foldername\(name\)\)\[1\] = 'playbook-uploads'/);
assert.match(migration, /\(storage\.foldername\(name\)\)\[2\] = \(select auth\.uid\(\)::text\)/);

assert.doesNotMatch(devSchema, /create policy "anon (?:upload|update naviaction|read)"/);
assert.match(devSchema, /create policy "authenticated playbook upload"/);
assert.match(devSchema, /create policy mm_subscriptions_owner_read/);

for (const prefix of [
  'playbook-uploads/',
  'manual-captures/',
  'blurred/',
  'thumbnails/',
  'live-guide-help/',
]) {
  assert.ok(deleteRoute.includes(prefix), `account deletion must remove ${prefix} objects`);
}
for (const bucket of ['naviaction', 'avatars', 'branding', 'screenshots', 'audio', 'mimic-tts']) {
  assert.ok(deleteRoute.includes(`'${bucket}'`), `account deletion must cover ${bucket}`);
}
assert.ok(
  deleteRoute.indexOf("await removePrefix(supabase, 'naviaction'")
    < deleteRoute.indexOf("supabase.from('mm_capture_sessions').delete()"),
  'Storage cleanup must complete before account rows are deleted',
);

assert.deepEqual(
  claudeSettings.permissions.deny,
  ['mcp__mimic__execute_sql', 'mcp__mimic__apply_migration'],
);

console.log('P0 security hardening contract verified.');
