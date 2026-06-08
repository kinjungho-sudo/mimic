-- ─────────────────────────────────────────────────────────────────────────────
-- 002_create_mm_rls.sql
-- 모든 MM_ 테이블 RLS 정책
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── MM_users ───
ALTER TABLE MM_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON MM_users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON MM_users
  FOR UPDATE USING (auth.uid() = id);

-- ─── MM_extension_tokens ───
ALTER TABLE MM_extension_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tokens_own" ON MM_extension_tokens
  FOR ALL USING (auth.uid() = user_id);

-- ─── MM_tutorials ───
ALTER TABLE MM_tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutorials_own" ON MM_tutorials
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "tutorials_public_share" ON MM_tutorials
  FOR SELECT USING (
    status = 'published' AND share_token IS NOT NULL
  );

-- ─── MM_steps ───
ALTER TABLE MM_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "steps_own" ON MM_steps
  FOR ALL USING (
    tutorial_id IN (SELECT id FROM MM_tutorials WHERE user_id = auth.uid())
  );

CREATE POLICY "steps_public_share" ON MM_steps
  FOR SELECT USING (
    tutorial_id IN (
      SELECT id FROM MM_tutorials
      WHERE status = 'published' AND share_token IS NOT NULL
    )
  );

-- ─── MM_markers ───
ALTER TABLE MM_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "markers_own" ON MM_markers
  FOR ALL USING (
    step_id IN (
      SELECT s.id FROM MM_steps s
      JOIN MM_tutorials t ON t.id = s.tutorial_id
      WHERE t.user_id = auth.uid()
    )
  );

CREATE POLICY "markers_public_share" ON MM_markers
  FOR SELECT USING (
    step_id IN (
      SELECT s.id FROM MM_steps s
      JOIN MM_tutorials t ON t.id = s.tutorial_id
      WHERE t.status = 'published' AND t.share_token IS NOT NULL
    )
  );

-- ─── MM_annotations ───
ALTER TABLE MM_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annotations_own" ON MM_annotations
  FOR ALL USING (
    step_id IN (
      SELECT s.id FROM MM_steps s
      JOIN MM_tutorials t ON t.id = s.tutorial_id
      WHERE t.user_id = auth.uid()
    )
  );

CREATE POLICY "annotations_public_share" ON MM_annotations
  FOR SELECT USING (
    step_id IN (
      SELECT s.id FROM MM_steps s
      JOIN MM_tutorials t ON t.id = s.tutorial_id
      WHERE t.status = 'published' AND t.share_token IS NOT NULL
    )
  );

-- ─── MM_audio_assets ───
ALTER TABLE MM_audio_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audio_assets_own" ON MM_audio_assets
  FOR ALL USING (
    step_id IN (
      SELECT s.id FROM MM_steps s
      JOIN MM_tutorials t ON t.id = s.tutorial_id
      WHERE t.user_id = auth.uid()
    )
  );

CREATE POLICY "audio_assets_public_share" ON MM_audio_assets
  FOR SELECT USING (
    step_id IN (
      SELECT s.id FROM MM_steps s
      JOIN MM_tutorials t ON t.id = s.tutorial_id
      WHERE t.status = 'published' AND t.share_token IS NOT NULL
    )
  );

-- ─── MM_view_events ───
ALTER TABLE MM_view_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_anon_insert" ON MM_view_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "events_own_select" ON MM_view_events
  FOR SELECT USING (
    tutorial_id IN (SELECT id FROM MM_tutorials WHERE user_id = auth.uid())
  );

-- ─── MM_survey_responses ───
ALTER TABLE MM_survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "survey_anon_insert" ON MM_survey_responses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "survey_own_select" ON MM_survey_responses
  FOR SELECT USING (
    tutorial_id IN (SELECT id FROM MM_tutorials WHERE user_id = auth.uid())
  );

-- ─── MM_pro_signups ───
ALTER TABLE MM_pro_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pro_signups_anon_insert" ON MM_pro_signups
  FOR INSERT WITH CHECK (true);
-- SELECT는 service_role 키로만 (관리자 API)
