-- ─────────────────────────────────────────────────────────────────────────────
-- 005_create_capture_tables.sql
-- MIMIC Recorder 캡처 세션 + 이벤트 테이블
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── MM_capture_sessions ───
-- MIMIC Recorder가 녹화를 시작할 때 생성, 완료 시 status → 'done'
CREATE TABLE IF NOT EXISTS mm_capture_sessions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES mm_users(id) ON DELETE CASCADE,
  status     text        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'done', 'cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at   timestamptz NULL
);

ALTER TABLE mm_capture_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capture_sessions_own" ON mm_capture_sessions
  FOR ALL USING (auth.uid() = user_id);

-- service_role은 RLS를 우회하므로 별도 정책 불필요

CREATE INDEX IF NOT EXISTS idx_mm_capture_sessions_user_status
  ON mm_capture_sessions(user_id, status);

-- ─── MM_capture_events ───
-- 각 클릭/스크린샷 이벤트. 세션 완료 후 MM_steps로 변환됨.
CREATE TABLE IF NOT EXISTS mm_capture_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid        NOT NULL REFERENCES mm_capture_sessions(id) ON DELETE CASCADE,
  screenshot_url text        NOT NULL,
  click_x        int         NOT NULL,  -- position_x * 10000 (정수 저장)
  click_y        int         NOT NULL,  -- position_y * 10000 (정수 저장)
  url            text        NOT NULL,
  element_text   text        NULL,
  ai_title       text        NULL,      -- /api/capture/analyze 결과
  ai_description text        NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mm_capture_events ENABLE ROW LEVEL SECURITY;

-- session → user 조인으로 소유 확인
CREATE POLICY "capture_events_own" ON mm_capture_events
  FOR ALL USING (
    session_id IN (
      SELECT id FROM mm_capture_sessions WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_mm_capture_events_session
  ON mm_capture_events(session_id, created_at);
