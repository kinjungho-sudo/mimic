-- 033_comments_resolve_activity_shares.sql
-- (1) 댓글 해결(resolve) 워크플로우  (2) 활동 로그  (3) 매뉴얼별 이메일 초대 공유

-- ── (1) 댓글 해결 상태 ──────────────────────────────────────
ALTER TABLE mm_comments ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE mm_comments ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES mm_users(id) ON DELETE SET NULL;

-- ── (2) 활동 로그 ───────────────────────────────────────────
-- 협업 이벤트 기록(댓글/해결/답글/공유 초대·해제 등). actor_id는 mm_users.
CREATE TABLE IF NOT EXISTS mm_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id uuid NOT NULL REFERENCES mm_tutorials(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES mm_users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  step_id     uuid REFERENCES mm_steps(id) ON DELETE SET NULL,
  meta        jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mm_activity_tutorial ON mm_activity(tutorial_id, created_at DESC);
ALTER TABLE mm_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_access" ON mm_activity
  FOR ALL USING (
    tutorial_id IN (
      SELECT id FROM mm_tutorials WHERE user_id = auth.uid()
      UNION
      SELECT t.id FROM mm_tutorials t
        JOIN mm_workspace_members m ON m.workspace_id = t.workspace_id
        WHERE m.user_id = auth.uid()
      UNION
      SELECT t.id FROM mm_tutorials t
        JOIN mm_workspaces w ON w.id = t.workspace_id
        WHERE w.owner_id = auth.uid()
    )
  );

-- ── (3) 매뉴얼별 공유(이메일 초대 + 역할) ───────────────────
-- 워크스페이스가 아닌 개인 매뉴얼을 특정인에게 보기/편집 권한으로 공유.
CREATE TABLE IF NOT EXISTS mm_manual_shares (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id uuid NOT NULL REFERENCES mm_tutorials(id) ON DELETE CASCADE,
  email       text NOT NULL,
  user_id     uuid REFERENCES mm_users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer','editor')),
  invited_by  uuid REFERENCES mm_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutorial_id, email)
);
CREATE INDEX IF NOT EXISTS idx_mm_manual_shares_tutorial ON mm_manual_shares(tutorial_id);
CREATE INDEX IF NOT EXISTS idx_mm_manual_shares_email ON mm_manual_shares(lower(email));
ALTER TABLE mm_manual_shares ENABLE ROW LEVEL SECURITY;
-- 소유자는 공유 목록 관리, 초대받은 본인은 자신의 공유 레코드 조회 가능
CREATE POLICY "manual_shares_owner" ON mm_manual_shares
  FOR ALL USING (
    tutorial_id IN (SELECT id FROM mm_tutorials WHERE user_id = auth.uid())
  );
CREATE POLICY "manual_shares_self" ON mm_manual_shares
  FOR SELECT USING (
    user_id = auth.uid()
    OR lower(email) = lower((SELECT email FROM mm_users WHERE id = auth.uid()))
  );
