import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const migration = read('supabase/migrations/20261008090000_p1_rls_lockdown.sql');
const devSchema = read('supabase/dev-setup/01_mimic_dev_schema.sql');

const droppedPolicies = [
  'users_update_own',
  'tutorials_public_share',
  'steps_public_share',
  'markers_public_share',
  'annotations_public_share',
  'audio_assets_public_share',
  'pages_public_read',
  'page_blocks_public_read',
  'mm_manuals_public_read',
  'ext_tokens_own',
  'events_anon_insert',
  'survey_anon_insert',
  'pro_signups_anon_insert',
];

for (const policy of droppedPolicies) {
  assert.match(migration, new RegExp(`drop policy if exists ${policy} on public\\.`), `${policy} must be dropped`);
  assert.doesNotMatch(devSchema, new RegExp(`create policy ${policy} `), `dev schema must not recreate ${policy}`);
}

for (const statement of [
  'revoke insert, update, delete on table public.mm_users from anon, authenticated;',
  'revoke all on table public.mm_extension_tokens from anon, authenticated;',
  'revoke insert, update, delete on table public.mm_view_events from anon, authenticated;',
  'revoke insert, update, delete on table public.mm_survey_responses from anon, authenticated;',
  'revoke insert, update, delete on table public.mm_pro_signups from anon, authenticated;',
]) {
  assert.ok(migration.includes(statement), `migration must contain: ${statement}`);
  assert.ok(devSchema.includes(statement), `dev schema must contain: ${statement}`);
}

// The lockdown is safe only while browser code never queries tables directly.
const browserClientUsers = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const source = read(rel);
      if (source.includes("@/lib/supabase/client") && /\.from\(['"]mm_/.test(source)) browserClientUsers.push(rel);
    }
  }
};
for (const dir of ['app', 'components', 'hooks', 'lib']) walk(dir);
assert.deepEqual(browserClientUsers, [], 'browser Supabase client must not query mm_* tables directly');

console.log(JSON.stringify({ ok: true, checks: droppedPolicies.length * 2 + 11, scope: 'p1-rls-lockdown' }));
