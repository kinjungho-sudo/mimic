-- Shared fixed-window rate limits. Vercel runs many short-lived instances, so the
-- in-memory limiter cannot stop password guessing or AI cost abuse on its own.
-- Only the service-role server path may call consume_rate_limit.

begin;

create table if not exists public.mm_rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

alter table public.mm_rate_limits enable row level security;
revoke all on table public.mm_rate_limits from anon, authenticated;

create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_reset timestamptz;
begin
  insert into public.mm_rate_limits as r (key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case when r.reset_at <= now() then 1 else r.count + 1 end,
        reset_at = case when r.reset_at <= now() then now() + make_interval(secs => p_window_seconds) else r.reset_at end
  returning r.count, r.reset_at into v_count, v_reset;

  -- Occasionally drop long-expired windows so the table stays small.
  if random() < 0.01 then
    delete from public.mm_rate_limits where reset_at < now() - interval '1 day';
  end if;

  return query select v_count <= p_limit, greatest(0, ceil(extract(epoch from (v_reset - now())))::integer);
end;
$$;

revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

commit;
