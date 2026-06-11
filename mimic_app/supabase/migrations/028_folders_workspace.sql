-- mm_folders에 workspace_id 추가 — 팀 공유 폴더 지원
--   workspace_id = NULL  → 개인 폴더 (기존 동작 유지)
--   workspace_id = uuid  → 팀 공유 폴더 (해당 워크스페이스 멤버 전원이 공유)
ALTER TABLE mm_folders
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES mm_workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_folders_workspace_id ON mm_folders(workspace_id);

-- RLS — 기존 정책은 user_id = auth.uid() 전용.
-- 팀 폴더는 워크스페이스 멤버/오너도 접근 가능해야 함. (API는 service role로 우회하지만 방어적으로 동기화)
DROP POLICY IF EXISTS folders_select ON mm_folders;
DROP POLICY IF EXISTS folders_insert ON mm_folders;
DROP POLICY IF EXISTS folders_update ON mm_folders;
DROP POLICY IF EXISTS folders_delete ON mm_folders;

-- 워크스페이스 멤버 여부 (멤버 테이블 또는 오너)
-- 공통 조건을 각 정책에 인라인
CREATE POLICY folders_select ON mm_folders FOR SELECT USING (
  user_id = auth.uid()
  OR (workspace_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM mm_workspace_members m WHERE m.workspace_id = mm_folders.workspace_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM mm_workspaces w WHERE w.id = mm_folders.workspace_id AND w.owner_id = auth.uid())
  ))
);

CREATE POLICY folders_insert ON mm_folders FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR (workspace_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM mm_workspace_members m WHERE m.workspace_id = mm_folders.workspace_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM mm_workspaces w WHERE w.id = mm_folders.workspace_id AND w.owner_id = auth.uid())
  ))
);

CREATE POLICY folders_update ON mm_folders FOR UPDATE USING (
  user_id = auth.uid()
  OR (workspace_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM mm_workspace_members m WHERE m.workspace_id = mm_folders.workspace_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM mm_workspaces w WHERE w.id = mm_folders.workspace_id AND w.owner_id = auth.uid())
  ))
);

CREATE POLICY folders_delete ON mm_folders FOR DELETE USING (
  user_id = auth.uid()
  OR (workspace_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM mm_workspace_members m WHERE m.workspace_id = mm_folders.workspace_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM mm_workspaces w WHERE w.id = mm_folders.workspace_id AND w.owner_id = auth.uid())
  ))
);
