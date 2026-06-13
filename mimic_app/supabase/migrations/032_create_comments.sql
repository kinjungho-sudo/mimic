-- 032_create_comments.sql
-- 팀 워크스페이스 협업용 댓글. 단일 테이블로 스텝별/매뉴얼 전체 댓글 + 대댓글을 모두 처리.
--   step_id   NULL  → 매뉴얼 전체 댓글
--   parent_id NULL  → 최상위 댓글, 값 있으면 해당 댓글의 대댓글(Reply)

CREATE TABLE IF NOT EXISTS mm_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id uuid NOT NULL REFERENCES mm_tutorials(id) ON DELETE CASCADE,
  step_id     uuid REFERENCES mm_steps(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES mm_comments(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES mm_users(id) ON DELETE CASCADE,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_mm_comments_tutorial ON mm_comments(tutorial_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mm_comments_step ON mm_comments(step_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mm_comments_parent ON mm_comments(parent_id);

ALTER TABLE mm_comments ENABLE ROW LEVEL SECURITY;

-- API 라우트는 service-role 클라이언트 + guardTutorialAccess 로 권한을 처리한다.
-- 아래 정책은 익명/일반 키 직접 접근에 대한 방어선(소유자 또는 워크스페이스 구성원만 접근).
CREATE POLICY "comments_access" ON mm_comments
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
