-- P1 RLS lockdown: remove direct client write and public read paths.
-- Every app read/write of these tables runs through service-role server routes,
-- so dropping these policies changes no product flow while closing:
--   1) self-service plan/quota edits on mm_users,
--   2) anon enumeration of published manuals (incl. share_token, share_password),
--   3) forged extension tokens and unthrottled anon inserts.

begin;

-- 1) mm_users: users may read their own row only. plan, daily_limit,
--    daily_manual_count, and live_guide_runs change only through the server.
drop policy if exists users_update_own on public.mm_users;
revoke insert, update, delete on table public.mm_users from anon, authenticated;

-- 2) Published content is served by token-checked API routes, never by direct table reads.
drop policy if exists tutorials_public_share on public.mm_tutorials;
drop policy if exists steps_public_share on public.mm_steps;
drop policy if exists markers_public_share on public.mm_markers;
drop policy if exists annotations_public_share on public.mm_annotations;
drop policy if exists audio_assets_public_share on public.mm_audio_assets;
drop policy if exists pages_public_read on public.mm_pages;
drop policy if exists page_blocks_public_read on public.mm_page_blocks;
drop policy if exists mm_manuals_public_read on public.mm_manuals;

-- 3) Extension tokens are issued and redeemed only by the server.
drop policy if exists ext_tokens_own on public.mm_extension_tokens;
drop policy if exists tokens_own on public.mm_extension_tokens;
revoke all on table public.mm_extension_tokens from anon, authenticated;

-- 4) Anonymous inserts go through rate-limited API routes instead of the anon key.
drop policy if exists events_anon_insert on public.mm_view_events;
drop policy if exists survey_anon_insert on public.mm_survey_responses;
drop policy if exists pro_signups_anon_insert on public.mm_pro_signups;
revoke insert, update, delete on table public.mm_view_events from anon, authenticated;
revoke insert, update, delete on table public.mm_survey_responses from anon, authenticated;
revoke insert, update, delete on table public.mm_pro_signups from anon, authenticated;

commit;
