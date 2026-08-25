-- Live Guide learners can ask the manual owner for help from the active step.
-- Requests reuse the instructor-facing comments inbox and keep screenshots private.

alter table public.mm_comments
  add column if not exists request_kind text not null default 'comment'
    check (request_kind in ('comment', 'live_guide_help')),
  add column if not exists attachment_path text,
  add column if not exists request_context jsonb not null default '{}'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'live-guide-help',
  'live-guide-help',
  false,
  5242880,
  array['image/png', 'image/jpeg']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The app server uses the service role for uploads and signed reads. No direct
-- anon/authenticated storage policy is intentionally granted for this bucket.
