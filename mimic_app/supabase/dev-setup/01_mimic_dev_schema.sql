-- ============================================================================
-- MIMIC 전용 개발(dev) DB 스키마 — 운영(project1)의 살아있는 구조를 그대로 복제
-- ----------------------------------------------------------------------------
-- 사용법: 새로 만든 Supabase 프로젝트의 [SQL Editor]에 이 파일 전체를 붙여넣고 RUN.
-- - 데이터는 포함하지 않음(빈 스키마만). 운영(project1)은 건드리지 않음.
-- - 운영의 실제 구조를 catalog에서 추출해 작성함 (레포 마이그레이션 파일은 운영과
--   어긋나 있어 사용하지 않음).
-- - mm_users.id 는 auth.users(id) 를 참조 → Supabase Auth가 기본 제공하므로 그대로 동작.
-- - 신규 가입 시 handle_new_user 트리거가 mm_users 행을 자동 생성.
-- 생성일 기준: 운영 project1(gqynptpjomcqzxyykqic) 스냅샷
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_bytes (초대 토큰 기본값)

-- ===== 1. 테이블 (FK는 뒤에서 일괄 추가, 생성 순서 의존성 회피) =================

create table mm_users (
  id uuid primary key,
  email text not null unique,
  name text,
  avatar_url text,
  auth_provider text not null default 'email',
  plan text not null default 'free' check (plan in ('free','pro_waitlist','pro','team')),
  daily_manual_count integer not null default 0,
  daily_limit integer not null default 3,
  agreements jsonb,
  created_at timestamptz not null default now(),
  live_guide_runs integer not null default 0
);

create table mm_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table mm_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null,
  role text not null default 'viewer' check (role in ('admin','editor','viewer')),
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table mm_workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  inviter_id uuid not null,
  email text not null,
  role text not null default 'viewer' check (role in ('admin','editor','viewer')),
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  status text not null default 'pending' check (status in ('pending','accepted','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create table mm_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  color text not null default '#4F46E5',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid
);

create table mm_tutorials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default '제목 없음',
  session_id text,
  mode text not null default 'interactive' check (mode in ('interactive','guide')),
  status text not null default 'draft' check (status in ('draft','published')),
  visibility text not null default 'private' check (visibility in ('private','public')),
  share_token text unique,
  output_ratio text not null default '16:9' check (output_ratio in ('16:9','1:1','9:16')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  cover_color text,
  thumbnail_url text,
  workspace_id uuid,
  folder_id uuid,
  share_password text,
  deleted_at timestamptz,
  tts_enabled boolean not null default false,
  tts_voice text not null default 'nova' check (tts_voice in ('nova','alloy')),
  content_mode text default 'action' check (content_mode in ('action','education'))
);

create table mm_steps (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null,
  step_number integer not null,
  order_index integer not null,
  screenshot_url text not null,
  page_url text,
  ai_title text,
  ai_description text,
  user_title text,
  user_script text,
  created_at timestamptz not null default now(),
  user_annotations jsonb default '[]'::jsonb,
  domain_name text,
  domain_favicon text,
  domain_hostname text,
  click_x double precision,
  click_y double precision,
  element_rect jsonb,
  viewport_w integer,
  viewport_h integer,
  element_selector text,
  element_xpath text,
  target_context jsonb,
  crop_rect jsonb,
  pii_detected boolean default false,
  image_zoom double precision,
  image_offset_x double precision,
  image_offset_y double precision,
  voice_transcript_raw text,
  voice_audio_url text,
  voice_audio_start_ms integer,
  voice_audio_end_ms integer,
  follow_config jsonb,
  original_screenshot_url text,
  title_font_size integer,
  type_text text
);

create table mm_markers (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null,
  marker_number integer not null check (marker_number >= 1 and marker_number <= 9),
  position_x double precision not null check (position_x >= 0 and position_x <= 1),
  position_y double precision not null check (position_y >= 0 and position_y <= 1),
  script_offset_ms integer not null default 0,
  connected_effects jsonb not null default '[]'::jsonb,
  typing_text text,
  ai_generated boolean not null default true,
  created_at timestamptz not null default now()
);

create table mm_annotations (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null,
  marker_id uuid,
  type text not null check (type in ('text','arrow','rectangle','circle','underline')),
  style jsonb not null default '{}'::jsonb,
  geometry jsonb not null default '{}'::jsonb,
  show_duration_ms integer not null default 3000,
  created_at timestamptz not null default now()
);

create table mm_audio_assets (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null unique,
  audio_url text not null,
  duration_ms integer not null default 0,
  script_text text not null,
  voice text not null default 'nova' check (voice in ('nova','alloy')),
  created_at timestamptz not null default now()
);

create table mm_capture_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'active' check (status in ('active','completed','abandoned')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  audio_url text
);

create table mm_capture_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  screenshot_url text not null,
  click_x integer not null,
  click_y integer not null,
  url text not null,
  element_text text,
  "timestamp" timestamptz not null default now(),
  ai_title text,
  ai_description text,
  domain_name text,
  domain_favicon text,
  domain_hostname text,
  created_at timestamptz not null default now(),
  element_rect jsonb,
  element_selector text,
  element_xpath text,
  target_context jsonb,
  step_number integer,
  audio_offset_ms integer,
  crop_box jsonb,
  type_text text
);

create table mm_view_events (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null,
  viewer_session_id text not null,
  step_number integer,
  event_type text not null check (event_type in ('enter','step','complete','exit')),
  "timestamp" timestamptz not null default now()
);

create table mm_survey_responses (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null,
  viewer_session_id text not null,
  q1_easier_than_pdf integer check (q1_easier_than_pdf >= 1 and q1_easier_than_pdf <= 5),
  q2_would_use_again integer check (q2_would_use_again >= 1 and q2_would_use_again <= 5),
  q3_useful_for_work integer check (q3_useful_for_work >= 1 and q3_useful_for_work <= 5),
  q4_can_reproduce boolean,
  q5_additional_feedback text,
  created_at timestamptz not null default now()
);

create table mm_pro_signups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text not null,
  plan_interested text not null default 'pro' check (plan_interested in ('basic','pro','team')),
  source text not null default 'landing' check (source in ('landing','editor','limit_modal','mypage')),
  created_at timestamptz not null default now()
);

create table mm_extension_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token text not null unique,
  used_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  kind text not null default 'session' check (kind in ('link','session'))
);

create table mm_branding (
  user_id uuid primary key,
  logo_url text,
  primary_color text not null default '#4F46E5' check (primary_color ~* '^#[0-9a-f]{6}$'),
  company_name text,
  footer_text text,
  updated_at timestamptz not null default now()
);

create table mm_comments (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null,
  step_id uuid,
  parent_id uuid,
  author_id uuid not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid
);

create table mm_activity (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null,
  actor_id uuid,
  action text not null,
  step_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table mm_manual_shares (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null,
  email text not null,
  user_id uuid,
  role text not null default 'viewer' check (role in ('viewer','editor')),
  invited_by uuid,
  created_at timestamptz not null default now(),
  unique (tutorial_id, email)
);

create table mm_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default '제목 없는 페이지',
  description text,
  status text not null default 'draft' check (status in ('draft','published')),
  visibility text not null default 'private' check (visibility in ('private','public')),
  share_token text unique,
  share_password text,
  cover_color text,
  folder_id uuid,
  workspace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  deleted_at timestamptz,
  content jsonb not null default '[]'::jsonb
);

create table mm_page_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null,
  order_index integer not null,
  block_type text not null check (block_type in ('heading','text','video','tutorial')),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table mm_execution_sessions (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid,
  user_id uuid,
  status text not null default 'pending' check (status in ('pending','running','completed','failed','paused')),
  total_steps integer,
  completed_steps integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table mm_step_results (
  id uuid primary key default gen_random_uuid(),
  execution_session_id uuid not null,
  step_id uuid,
  step_number integer not null,
  status text not null default 'skipped' check (status in ('success','failed','skipped','paused')),
  selector_used text,
  error_message text,
  executed_at timestamptz not null default now()
);

create table mm_step_translations (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null,
  lang text not null,
  title text,
  script text,
  created_at timestamptz not null default now(),
  unique (step_id, lang)
);

create table mm_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  level text not null check (level in ('debug','info','warn','error')),
  source text not null check (source in ('client','server')),
  event text not null,
  message text,
  context jsonb,
  user_id uuid,
  tutorial_id uuid,
  url text,
  category text not null default 'error' check (category in ('error','network','audit','system'))
);

-- 레거시/미래용(운영에 존재하므로 충실히 포함) ----------------------------------
create table mm_manuals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workspace_type text not null default 'personal' check (workspace_type in ('personal','team')),
  title text not null,
  description text,
  mode text not null default 'guide_doc' check (mode in ('guide_doc','interactive_tutorial')),
  output_ratio text not null default '16:9' check (output_ratio in ('16:9','1:1','9:16')),
  visibility text not null default 'private' check (visibility in ('private','public')),
  share_token text unique,
  language text not null default 'ko',
  parent_manual_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table mm_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan text not null check (plan in ('elite','pro')),
  status text not null default 'active' check (status in ('active','cancelled','past_due')),
  next_billing_at timestamptz,
  payment_method text,
  created_at timestamptz not null default now()
);

-- ===== 2. 외래키 (FK) =========================================================
alter table mm_users add constraint mm_users_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table mm_workspaces add constraint mm_workspaces_owner_id_fkey foreign key (owner_id) references mm_users(id) on delete cascade;
alter table mm_workspace_members add constraint mm_workspace_members_workspace_id_fkey foreign key (workspace_id) references mm_workspaces(id) on delete cascade;
alter table mm_workspace_members add constraint mm_workspace_members_user_id_fkey foreign key (user_id) references mm_users(id) on delete cascade;
alter table mm_workspace_invitations add constraint mm_workspace_invitations_workspace_id_fkey foreign key (workspace_id) references mm_workspaces(id) on delete cascade;
alter table mm_workspace_invitations add constraint mm_workspace_invitations_inviter_id_fkey foreign key (inviter_id) references mm_users(id) on delete cascade;
alter table mm_folders add constraint mm_folders_user_id_fkey foreign key (user_id) references mm_users(id) on delete cascade;
alter table mm_folders add constraint mm_folders_workspace_id_fkey foreign key (workspace_id) references mm_workspaces(id) on delete cascade;
alter table mm_tutorials add constraint mm_tutorials_user_id_fkey foreign key (user_id) references mm_users(id) on delete cascade;
alter table mm_tutorials add constraint mm_tutorials_workspace_id_fkey foreign key (workspace_id) references mm_workspaces(id) on delete set null;
alter table mm_tutorials add constraint mm_tutorials_folder_id_fkey foreign key (folder_id) references mm_folders(id) on delete set null;
alter table mm_steps add constraint mm_steps_tutorial_id_fkey foreign key (tutorial_id) references mm_tutorials(id) on delete cascade;
alter table mm_markers add constraint mm_markers_step_id_fkey foreign key (step_id) references mm_steps(id) on delete cascade;
alter table mm_annotations add constraint mm_annotations_step_id_fkey foreign key (step_id) references mm_steps(id) on delete cascade;
alter table mm_annotations add constraint mm_annotations_marker_id_fkey foreign key (marker_id) references mm_markers(id) on delete set null;
alter table mm_audio_assets add constraint mm_audio_assets_step_id_fkey foreign key (step_id) references mm_steps(id) on delete cascade;
alter table mm_capture_events add constraint mm_capture_events_session_id_fkey foreign key (session_id) references mm_capture_sessions(id) on delete cascade;
alter table mm_view_events add constraint mm_view_events_tutorial_id_fkey foreign key (tutorial_id) references mm_tutorials(id) on delete cascade;
alter table mm_survey_responses add constraint mm_survey_responses_tutorial_id_fkey foreign key (tutorial_id) references mm_tutorials(id) on delete cascade;
alter table mm_pro_signups add constraint mm_pro_signups_user_id_fkey foreign key (user_id) references mm_users(id) on delete set null;
alter table mm_extension_tokens add constraint mm_extension_tokens_user_id_fkey foreign key (user_id) references mm_users(id) on delete cascade;
alter table mm_branding add constraint mm_branding_user_id_fkey foreign key (user_id) references mm_users(id) on delete cascade;
alter table mm_comments add constraint mm_comments_tutorial_id_fkey foreign key (tutorial_id) references mm_tutorials(id) on delete cascade;
alter table mm_comments add constraint mm_comments_step_id_fkey foreign key (step_id) references mm_steps(id) on delete cascade;
alter table mm_comments add constraint mm_comments_parent_id_fkey foreign key (parent_id) references mm_comments(id) on delete cascade;
alter table mm_comments add constraint mm_comments_author_id_fkey foreign key (author_id) references mm_users(id) on delete cascade;
alter table mm_comments add constraint mm_comments_resolved_by_fkey foreign key (resolved_by) references mm_users(id) on delete set null;
alter table mm_activity add constraint mm_activity_tutorial_id_fkey foreign key (tutorial_id) references mm_tutorials(id) on delete cascade;
alter table mm_activity add constraint mm_activity_actor_id_fkey foreign key (actor_id) references mm_users(id) on delete set null;
alter table mm_activity add constraint mm_activity_step_id_fkey foreign key (step_id) references mm_steps(id) on delete set null;
alter table mm_manual_shares add constraint mm_manual_shares_tutorial_id_fkey foreign key (tutorial_id) references mm_tutorials(id) on delete cascade;
alter table mm_manual_shares add constraint mm_manual_shares_user_id_fkey foreign key (user_id) references mm_users(id) on delete cascade;
alter table mm_manual_shares add constraint mm_manual_shares_invited_by_fkey foreign key (invited_by) references mm_users(id) on delete set null;
alter table mm_pages add constraint mm_pages_user_id_fkey foreign key (user_id) references mm_users(id) on delete cascade;
alter table mm_pages add constraint mm_pages_folder_id_fkey foreign key (folder_id) references mm_folders(id) on delete set null;
alter table mm_pages add constraint mm_pages_workspace_id_fkey foreign key (workspace_id) references mm_workspaces(id) on delete set null;
alter table mm_page_blocks add constraint mm_page_blocks_page_id_fkey foreign key (page_id) references mm_pages(id) on delete cascade;
alter table mm_execution_sessions add constraint mm_execution_sessions_tutorial_id_fkey foreign key (tutorial_id) references mm_tutorials(id) on delete cascade;
alter table mm_execution_sessions add constraint mm_execution_sessions_user_id_fkey foreign key (user_id) references auth.users(id);
alter table mm_step_results add constraint mm_step_results_execution_session_id_fkey foreign key (execution_session_id) references mm_execution_sessions(id) on delete cascade;
alter table mm_step_results add constraint mm_step_results_step_id_fkey foreign key (step_id) references mm_steps(id);
alter table mm_step_translations add constraint mm_step_translations_step_id_fkey foreign key (step_id) references mm_steps(id) on delete cascade;
alter table mm_manuals add constraint mm_manuals_parent_manual_id_fkey foreign key (parent_manual_id) references mm_manuals(id);

-- ===== 3. 인덱스 ==============================================================
create index idx_mm_activity_tutorial on mm_activity (tutorial_id, created_at desc);
create index idx_mm_annotations_step_id on mm_annotations (step_id);
create index idx_mm_comments_parent on mm_comments (parent_id);
create index idx_mm_comments_step on mm_comments (step_id) where (deleted_at is null);
create index idx_mm_comments_tutorial on mm_comments (tutorial_id) where (deleted_at is null);
create index idx_mm_extension_tokens_token on mm_extension_tokens (token);
create index idx_folders_user on mm_folders (user_id);
create index idx_folders_workspace_id on mm_folders (workspace_id);
create index idx_logs_category_created_at on mm_logs (category, created_at desc);
create index idx_logs_created_at on mm_logs (created_at desc);
create index idx_logs_event on mm_logs (event);
create index idx_logs_level on mm_logs (level);
create index idx_mm_manual_shares_email on mm_manual_shares (lower(email));
create index idx_mm_manual_shares_tutorial on mm_manual_shares (tutorial_id);
create index idx_mm_markers_step_id on mm_markers (step_id);
create index idx_page_blocks_page_id on mm_page_blocks (page_id, order_index);
create index idx_pages_share_token on mm_pages (share_token);
create index idx_pages_user_id on mm_pages (user_id);
create index idx_pages_workspace_id on mm_pages (workspace_id);
create index idx_mm_steps_tutorial_id on mm_steps (tutorial_id);
create index idx_mm_tutorials_deleted_at on mm_tutorials (deleted_at) where (deleted_at is not null);
create index idx_mm_tutorials_share_token on mm_tutorials (share_token) where (share_token is not null);
create index idx_mm_tutorials_user_id on mm_tutorials (user_id);
create index idx_tutorials_folder on mm_tutorials (folder_id);
create index idx_tutorials_workspace on mm_tutorials (workspace_id);
create index idx_mm_view_events_tutorial_id on mm_view_events (tutorial_id);
create index idx_workspace_invitations_email on mm_workspace_invitations (email);
create index idx_workspace_invitations_token on mm_workspace_invitations (token);
create index idx_workspace_members_user on mm_workspace_members (user_id);
create index idx_workspace_members_workspace on mm_workspace_members (workspace_id);

-- ===== 4. 함수 ================================================================
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.update_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.mm_users (id, email, name, avatar_url, auth_provider, plan, daily_limit)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    case when new.raw_app_meta_data->>'provider' = 'google' then 'google' else 'email' end,
    'free', 3
  )
  on conflict (id) do nothing;
  return new;
end; $$;

create or replace function public.consume_free_live_guide_run(uid uuid, free_limit integer)
  returns integer language sql security definer as $$
  update mm_users set live_guide_runs = coalesce(live_guide_runs, 0) + 1
  where id = uid and coalesce(live_guide_runs, 0) < free_limit
  returning live_guide_runs;
$$;

-- ===== 5. 트리거 ==============================================================
create trigger mm_folders_updated_at before update on mm_folders for each row execute function set_updated_at();
create trigger mm_workspaces_updated_at before update on mm_workspaces for each row execute function set_updated_at();
create trigger tutorials_updated_at before update on mm_tutorials for each row execute function update_updated_at();
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ===== 6. RLS 활성화 ==========================================================
alter table mm_users enable row level security;
alter table mm_workspaces enable row level security;
alter table mm_workspace_members enable row level security;
alter table mm_workspace_invitations enable row level security;
alter table mm_folders enable row level security;
alter table mm_tutorials enable row level security;
alter table mm_steps enable row level security;
alter table mm_markers enable row level security;
alter table mm_annotations enable row level security;
alter table mm_audio_assets enable row level security;
alter table mm_capture_sessions enable row level security;
alter table mm_capture_events enable row level security;
alter table mm_view_events enable row level security;
alter table mm_survey_responses enable row level security;
alter table mm_pro_signups enable row level security;
alter table mm_extension_tokens enable row level security;
alter table mm_branding enable row level security;
alter table mm_comments enable row level security;
alter table mm_activity enable row level security;
alter table mm_manual_shares enable row level security;
alter table mm_pages enable row level security;
alter table mm_page_blocks enable row level security;
alter table mm_execution_sessions enable row level security;
alter table mm_step_results enable row level security;
alter table mm_step_translations enable row level security;
alter table mm_logs enable row level security;          -- 정책 없음 = service role만 접근(운영과 동일)
alter table mm_manuals enable row level security;
alter table mm_subscriptions enable row level security;

-- ===== 7. RLS 정책 ============================================================
create policy users_select_own on mm_users for select using (auth.uid() = id);
create policy users_update_own on mm_users for update using (auth.uid() = id);

create policy ws_select on mm_workspaces for select using (owner_id = auth.uid() or exists (select 1 from mm_workspace_members where mm_workspace_members.workspace_id = mm_workspaces.id and mm_workspace_members.user_id = auth.uid()));
create policy ws_insert on mm_workspaces for insert with check (owner_id = auth.uid());
create policy ws_update on mm_workspaces for update using (owner_id = auth.uid());
create policy ws_delete on mm_workspaces for delete using (owner_id = auth.uid());

create policy wm_all_service on mm_workspace_members for all using (auth.role() = 'service_role');
create policy wi_all_service on mm_workspace_invitations for all using (auth.role() = 'service_role');

create policy folders_own on mm_folders for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy folders_select on mm_folders for select using ((user_id = auth.uid()) or ((workspace_id is not null) and ((exists (select 1 from mm_workspace_members m where m.workspace_id = mm_folders.workspace_id and m.user_id = auth.uid())) or (exists (select 1 from mm_workspaces w where w.id = mm_folders.workspace_id and w.owner_id = auth.uid())))));
create policy folders_insert on mm_folders for insert with check ((user_id = auth.uid()) or ((workspace_id is not null) and ((exists (select 1 from mm_workspace_members m where m.workspace_id = mm_folders.workspace_id and m.user_id = auth.uid())) or (exists (select 1 from mm_workspaces w where w.id = mm_folders.workspace_id and w.owner_id = auth.uid())))));
create policy folders_update on mm_folders for update using ((user_id = auth.uid()) or ((workspace_id is not null) and ((exists (select 1 from mm_workspace_members m where m.workspace_id = mm_folders.workspace_id and m.user_id = auth.uid())) or (exists (select 1 from mm_workspaces w where w.id = mm_folders.workspace_id and w.owner_id = auth.uid())))));
create policy folders_delete on mm_folders for delete using ((user_id = auth.uid()) or ((workspace_id is not null) and ((exists (select 1 from mm_workspace_members m where m.workspace_id = mm_folders.workspace_id and m.user_id = auth.uid())) or (exists (select 1 from mm_workspaces w where w.id = mm_folders.workspace_id and w.owner_id = auth.uid())))));

create policy tutorials_own on mm_tutorials for all using (auth.uid() = user_id);
create policy tutorials_public_share on mm_tutorials for select using (status = 'published' and share_token is not null);

create policy steps_own on mm_steps for all using (tutorial_id in (select id from mm_tutorials where user_id = auth.uid()));
create policy steps_public_share on mm_steps for select using (tutorial_id in (select id from mm_tutorials where status = 'published' and share_token is not null));

create policy markers_own on mm_markers for all using (step_id in (select s.id from mm_steps s join mm_tutorials t on t.id = s.tutorial_id where t.user_id = auth.uid()));
create policy markers_public_share on mm_markers for select using (step_id in (select s.id from mm_steps s join mm_tutorials t on t.id = s.tutorial_id where t.status = 'published' and t.share_token is not null));

create policy annotations_own on mm_annotations for all using (step_id in (select s.id from mm_steps s join mm_tutorials t on t.id = s.tutorial_id where t.user_id = auth.uid()));
create policy annotations_public_share on mm_annotations for select using (step_id in (select s.id from mm_steps s join mm_tutorials t on t.id = s.tutorial_id where t.status = 'published' and t.share_token is not null));

create policy audio_own on mm_audio_assets for all using (step_id in (select s.id from mm_steps s join mm_tutorials t on t.id = s.tutorial_id where t.user_id = auth.uid()));
create policy audio_assets_public_share on mm_audio_assets for select using (step_id in (select s.id from mm_steps s join mm_tutorials t on t.id = s.tutorial_id where t.status = 'published' and t.share_token is not null));

create policy mm_capture_sessions_owner on mm_capture_sessions for all using (auth.uid() = user_id);
create policy mm_capture_events_owner on mm_capture_events for all using (session_id in (select id from mm_capture_sessions where user_id = auth.uid()));

create policy events_anon_insert on mm_view_events for insert with check (true);
create policy events_own_select on mm_view_events for select using (tutorial_id in (select id from mm_tutorials where user_id = auth.uid()));

create policy survey_anon_insert on mm_survey_responses for insert with check (true);
create policy survey_own_select on mm_survey_responses for select using (tutorial_id in (select id from mm_tutorials where user_id = auth.uid()));

create policy pro_signups_anon_insert on mm_pro_signups for insert with check (true);

create policy ext_tokens_own on mm_extension_tokens for all using (auth.uid() = user_id);

create policy comments_access on mm_comments for all using (tutorial_id in (
  select mm_tutorials.id from mm_tutorials where mm_tutorials.user_id = auth.uid()
  union select t.id from mm_tutorials t join mm_workspace_members m on m.workspace_id = t.workspace_id where m.user_id = auth.uid()
  union select t.id from mm_tutorials t join mm_workspaces w on w.id = t.workspace_id where w.owner_id = auth.uid()));

create policy activity_access on mm_activity for all using (tutorial_id in (
  select mm_tutorials.id from mm_tutorials where mm_tutorials.user_id = auth.uid()
  union select t.id from mm_tutorials t join mm_workspace_members m on m.workspace_id = t.workspace_id where m.user_id = auth.uid()
  union select t.id from mm_tutorials t join mm_workspaces w on w.id = t.workspace_id where w.owner_id = auth.uid()));

create policy manual_shares_owner on mm_manual_shares for all using (tutorial_id in (select id from mm_tutorials where user_id = auth.uid()));
create policy manual_shares_self on mm_manual_shares for select using ((user_id = auth.uid()) or (lower(email) = lower((select email from mm_users where id = auth.uid()))));

create policy pages_owner_all on mm_pages for all using ((user_id = auth.uid()) or ((workspace_id is not null) and ((exists (select 1 from mm_workspace_members m where m.workspace_id = mm_pages.workspace_id and m.user_id = auth.uid())) or (exists (select 1 from mm_workspaces w where w.id = mm_pages.workspace_id and w.owner_id = auth.uid()))))) with check ((user_id = auth.uid()) or ((workspace_id is not null) and ((exists (select 1 from mm_workspace_members m where m.workspace_id = mm_pages.workspace_id and m.user_id = auth.uid())) or (exists (select 1 from mm_workspaces w where w.id = mm_pages.workspace_id and w.owner_id = auth.uid())))));
create policy pages_public_read on mm_pages for select using (status = 'published' and share_token is not null);

create policy page_blocks_owner_all on mm_page_blocks for all using (exists (select 1 from mm_pages p where p.id = mm_page_blocks.page_id and p.user_id = auth.uid())) with check (exists (select 1 from mm_pages p where p.id = mm_page_blocks.page_id and p.user_id = auth.uid()));
create policy page_blocks_public_read on mm_page_blocks for select using (exists (select 1 from mm_pages p where p.id = mm_page_blocks.page_id and p.status = 'published' and p.share_token is not null));

create policy "own sessions" on mm_execution_sessions for all using (user_id = auth.uid());
create policy "own step results" on mm_step_results for all using (execution_session_id in (select id from mm_execution_sessions where user_id = auth.uid()));

create policy mm_manuals_owner on mm_manuals for all using (auth.uid() = user_id);
create policy mm_manuals_public_read on mm_manuals for select using (visibility = 'public' and share_token is not null);

create policy mm_subscriptions_owner on mm_subscriptions for all using (auth.uid() = user_id);

-- ===== 8. Storage 버킷 + 정책 =================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('screenshots','screenshots', true, null, null),
  ('audio','audio', true, null, null),
  ('avatars','avatars', true, 2097152, array['image/jpeg','image/png','image/webp','image/gif']),
  ('branding','branding', true, null, null),
  ('mimic-tts','mimic-tts', true, 10485760, array['audio/mpeg','audio/mp3']),
  ('naviaction','naviaction', true, null, null)   -- 확장(mimic_recorder) 원본 캡처 업로드 대상
on conflict (id) do nothing;

-- screenshots
create policy "public read screenshots" on storage.objects for select to public using (bucket_id = 'screenshots');
create policy "authenticated upload screenshots" on storage.objects for insert to authenticated with check (bucket_id = 'screenshots');
create policy "owner delete screenshots" on storage.objects for delete to authenticated using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (auth.uid())::text);
-- audio
create policy "audio_read_public" on storage.objects for select to public using (bucket_id = 'audio');
create policy "audio_upload_own" on storage.objects for insert to authenticated with check (bucket_id = 'audio' and (storage.foldername(name))[1] = (auth.uid())::text);
create policy "audio_update_own" on storage.objects for update to authenticated using (bucket_id = 'audio' and (storage.foldername(name))[1] = (auth.uid())::text);
-- mimic-tts
create policy "mimic_tts_public_select" on storage.objects for select to public using (bucket_id = 'mimic-tts');
create policy "mimic_tts_auth_insert" on storage.objects for insert to authenticated with check (bucket_id = 'mimic-tts');
create policy "mimic_tts_auth_update" on storage.objects for update to authenticated using (bucket_id = 'mimic-tts');
-- naviaction (확장이 anon 키로 업로드 — INSERT+UPDATE(upsert)+SELECT 모두 anon 필요)
create policy "anon upload" on storage.objects for insert to anon with check (bucket_id = 'naviaction');
create policy "anon update naviaction" on storage.objects for update to anon using (bucket_id = 'naviaction') with check (bucket_id = 'naviaction');
create policy "anon read" on storage.objects for select to anon using (bucket_id = 'naviaction');
create policy "authenticated upload naviaction" on storage.objects for insert to authenticated with check (bucket_id = 'naviaction');
-- avatars / branding: public 읽기 + 업로드는 서버(service role)에서 처리 → 추가 정책 불필요
--   (운영에도 objects 정책이 없음. 만약 클라이언트 직접 업로드가 필요하면 정책 추가)

-- ============================================================================
-- 끝. 다음: 게스트 테스트 계정은 대시보드 Authentication > Users 에서 생성하면
-- handle_new_user 트리거가 mm_users 행을 자동 생성합니다.
-- ============================================================================
