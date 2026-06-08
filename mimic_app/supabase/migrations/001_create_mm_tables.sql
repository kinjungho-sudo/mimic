-- ─────────────────────────────────────────────────────────────────────────────
-- 001_create_mm_tables.sql
-- MIMIC Manual (MM_) 테이블 10개 생성
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── MM_users ───
CREATE TABLE IF NOT EXISTS MM_users (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text        NOT NULL UNIQUE,
  name          text        NOT NULL,
  avatar_url    text        NULL,
  auth_provider text        NOT NULL DEFAULT 'email',
  plan          text        NOT NULL DEFAULT 'free'
                            CHECK (plan IN ('free', 'pro_waitlist', 'pro', 'team')),
  daily_manual_count int    NOT NULL DEFAULT 0,
  daily_limit   int         NOT NULL DEFAULT 3,
  agreements    jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── MM_extension_tokens ───
CREATE TABLE IF NOT EXISTS MM_extension_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES MM_users(id) ON DELETE CASCADE,
  token      text        NOT NULL UNIQUE,
  used_at    timestamptz NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── MM_tutorials ───
CREATE TABLE IF NOT EXISTS MM_tutorials (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES MM_users(id) ON DELETE CASCADE,
  title        text        NOT NULL DEFAULT '제목 없는 매뉴얼',
  session_id   text        NULL,
  mode         text        NOT NULL DEFAULT 'interactive'
                           CHECK (mode IN ('interactive', 'guide')),
  status       text        NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'published')),
  visibility   text        NOT NULL DEFAULT 'private'
                           CHECK (visibility IN ('private', 'public')),
  share_token  text        NULL UNIQUE,
  output_ratio text        NOT NULL DEFAULT '16:9'
                           CHECK (output_ratio IN ('16:9', '1:1', '9:16')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL
);

-- ─── MM_steps ───
CREATE TABLE IF NOT EXISTS MM_steps (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id    uuid        NOT NULL REFERENCES MM_tutorials(id) ON DELETE CASCADE,
  step_number    int         NOT NULL,
  order_index    int         NOT NULL DEFAULT 0,
  screenshot_url text        NOT NULL,
  page_url       text        NULL,
  ai_title       text        NULL,
  ai_description text        NULL,
  user_title     text        NULL,
  user_script    text        NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutorial_id, step_number)
);

-- ─── MM_markers ───
CREATE TABLE IF NOT EXISTS MM_markers (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id           uuid        NOT NULL REFERENCES MM_steps(id) ON DELETE CASCADE,
  marker_number     int         NOT NULL CHECK (marker_number BETWEEN 1 AND 9),
  position_x        float       NOT NULL CHECK (position_x BETWEEN 0 AND 1),
  position_y        float       NOT NULL CHECK (position_y BETWEEN 0 AND 1),
  script_offset_ms  int         NOT NULL DEFAULT 0,
  connected_effects jsonb       NOT NULL DEFAULT '[]',
  typing_text       text        NULL,
  ai_generated      boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── MM_annotations ───
CREATE TABLE IF NOT EXISTS MM_annotations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id          uuid        NOT NULL REFERENCES MM_steps(id) ON DELETE CASCADE,
  marker_id        uuid        NULL REFERENCES MM_markers(id) ON DELETE SET NULL,
  type             text        NOT NULL
                               CHECK (type IN ('text', 'arrow', 'rectangle', 'circle', 'underline')),
  style            jsonb       NOT NULL DEFAULT '{}',
  geometry         jsonb       NOT NULL DEFAULT '{}',
  show_duration_ms int         NOT NULL DEFAULT 3000,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── MM_audio_assets ───
CREATE TABLE IF NOT EXISTS MM_audio_assets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id     uuid        NOT NULL UNIQUE REFERENCES MM_steps(id) ON DELETE CASCADE,
  audio_url   text        NOT NULL,
  duration_ms int         NOT NULL DEFAULT 0,
  script_text text        NOT NULL,
  voice       text        NOT NULL DEFAULT 'nova'
                          CHECK (voice IN ('nova', 'alloy')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── MM_view_events ───
CREATE TABLE IF NOT EXISTS MM_view_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id       uuid        NOT NULL REFERENCES MM_tutorials(id) ON DELETE CASCADE,
  viewer_session_id text        NOT NULL,
  step_number       int         NULL,
  event_type        text        NOT NULL
                                CHECK (event_type IN ('enter', 'step', 'complete', 'exit')),
  timestamp         timestamptz NOT NULL DEFAULT now()
);

-- ─── MM_survey_responses ───
CREATE TABLE IF NOT EXISTS MM_survey_responses (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id           uuid        NOT NULL REFERENCES MM_tutorials(id) ON DELETE CASCADE,
  viewer_session_id     text        NOT NULL,
  q1_easier_than_pdf    int         NOT NULL CHECK (q1_easier_than_pdf BETWEEN 1 AND 5),
  q2_would_use_again    int         NOT NULL CHECK (q2_would_use_again BETWEEN 1 AND 5),
  q3_useful_for_work    int         NOT NULL CHECK (q3_useful_for_work BETWEEN 1 AND 5),
  q4_can_reproduce      boolean     NOT NULL,
  q5_additional_feedback text       NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ─── MM_pro_signups ───
CREATE TABLE IF NOT EXISTS MM_pro_signups (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NULL REFERENCES MM_users(id) ON DELETE SET NULL,
  email            text        NOT NULL,
  plan_interested  text        NOT NULL CHECK (plan_interested IN ('pro', 'team')),
  source           text        NOT NULL
                               CHECK (source IN ('landing', 'editor', 'limit_modal', 'mypage')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_mm_tutorials_user_id ON MM_tutorials(user_id);
CREATE INDEX IF NOT EXISTS idx_mm_steps_tutorial_id ON MM_steps(tutorial_id);
CREATE INDEX IF NOT EXISTS idx_mm_markers_step_id ON MM_markers(step_id);
CREATE INDEX IF NOT EXISTS idx_mm_annotations_step_id ON MM_annotations(step_id);
CREATE INDEX IF NOT EXISTS idx_mm_view_events_tutorial_id ON MM_view_events(tutorial_id);
CREATE INDEX IF NOT EXISTS idx_mm_extension_tokens_token ON MM_extension_tokens(token);
CREATE INDEX IF NOT EXISTS idx_mm_tutorials_share_token ON MM_tutorials(share_token) WHERE share_token IS NOT NULL;
