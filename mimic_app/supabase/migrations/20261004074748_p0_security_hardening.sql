-- P0 security hardening for privileged RPCs, subscriptions, and Storage writes.
-- Existing public object URLs remain unchanged; only direct client write paths tighten.

begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.mm_users (id, email, name, avatar_url, auth_provider, plan, daily_limit)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    case when new.raw_app_meta_data->>'provider' = 'google' then 'google' else 'email' end,
    'free',
    3
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated, service_role;

create or replace function public.increment_daily_manual_count(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.mm_users
  set daily_manual_count = daily_manual_count + 1
  where id = uid;
$$;

revoke execute on function public.increment_daily_manual_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_daily_manual_count(uuid) to service_role;

create or replace function public.increment_execution_completed(session_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.mm_execution_sessions
  set completed_steps = completed_steps + 1
  where id = session_id;
$$;

revoke execute on function public.increment_execution_completed(uuid) from public, anon, authenticated;
grant execute on function public.increment_execution_completed(uuid) to service_role;

create or replace function public.consume_free_live_guide_run(uid uuid, free_limit integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.mm_users
  set live_guide_runs = coalesce(live_guide_runs, 0) + 1
  where id = uid
    and coalesce(live_guide_runs, 0) < free_limit
  returning live_guide_runs;
$$;

revoke execute on function public.consume_free_live_guide_run(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_free_live_guide_run(uuid, integer) to service_role;

create or replace function public.purge_old_trash()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.mm_tutorials
  where deleted_at is not null
    and deleted_at < now() - interval '7 days';
end;
$$;

revoke execute on function public.purge_old_trash() from public, anon, authenticated, service_role;

drop policy if exists mm_subscriptions_owner on public.mm_subscriptions;
drop policy if exists mm_subscriptions_owner_read on public.mm_subscriptions;

create policy mm_subscriptions_owner_read
on public.mm_subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke insert, update, delete on table public.mm_subscriptions from anon, authenticated;
grant select on table public.mm_subscriptions to authenticated;

drop policy if exists "authenticated upload screenshots" on storage.objects;
create policy "authenticated upload own screenshots"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'screenshots'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "mimic_tts_auth_insert" on storage.objects;
drop policy if exists "mimic_tts_auth_update" on storage.objects;

drop policy if exists "anon upload" on storage.objects;
drop policy if exists "anon update naviaction" on storage.objects;
drop policy if exists "anon read" on storage.objects;
drop policy if exists "authenticated upload naviaction" on storage.objects;

create policy "authenticated playbook upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'naviaction'
  and (storage.foldername(name))[1] = 'playbook-uploads'
  and (storage.foldername(name))[2] = (select auth.uid()::text)
);

commit;
