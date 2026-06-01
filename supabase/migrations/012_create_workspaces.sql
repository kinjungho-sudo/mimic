-- 012_create_workspaces.sql
-- 팀 워크스페이스 기능: workspaces, members, invitations

-- ── 1. 워크스페이스 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS mm_workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  owner_id    uuid NOT NULL REFERENCES mm_users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 2. 워크스페이스 멤버 ─────────────────────────────────
-- role: 'admin' | 'editor' | 'viewer'
-- admin = 멤버 초대/권한 변경 가능
-- editor = 매뉴얼 편집 가능
-- viewer = 읽기 전용
CREATE TABLE IF NOT EXISTS mm_workspace_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES mm_workspaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES mm_users(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('admin', 'editor', 'viewer')),
  joined_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- ── 3. 초대장 ────────────────────────────────────────────
-- status: 'pending' | 'accepted' | 'expired'
CREATE TABLE IF NOT EXISTS mm_workspace_invitations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES mm_workspaces(id) ON DELETE CASCADE,
  inviter_id    uuid NOT NULL REFERENCES mm_users(id) ON DELETE CASCADE,
  email         text NOT NULL,
  role          text NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('admin', 'editor', 'viewer')),
  token         text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 4. 매뉴얼에 workspace_id 추가 ───────────────────────
-- NULL = 개인 매뉴얼 (하위 호환)
ALTER TABLE mm_tutorials
  ADD COLUMN IF NOT EXISTS workspace_id uuid
    REFERENCES mm_workspaces(id) ON DELETE SET NULL;

-- ── 5. updated_at 자동 갱신 트리거 ──────────────────────
CREATE TRIGGER mm_workspaces_updated_at
  BEFORE UPDATE ON mm_workspaces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 6. 인덱스 ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON mm_workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON mm_workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON mm_workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON mm_workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_tutorials_workspace ON mm_tutorials(workspace_id);

-- ── 7. RLS ───────────────────────────────────────────────
ALTER TABLE mm_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm_workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm_workspace_invitations ENABLE ROW LEVEL SECURITY;

-- 워크스페이스: 멤버만 조회 가능
CREATE POLICY ws_select ON mm_workspaces FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM mm_workspace_members
      WHERE workspace_id = mm_workspaces.id AND user_id = auth.uid()
    )
  );

-- 워크스페이스: 소유자만 수정/삭제
CREATE POLICY ws_insert ON mm_workspaces FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY ws_update ON mm_workspaces FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY ws_delete ON mm_workspaces FOR DELETE
  USING (owner_id = auth.uid());

-- 멤버: 같은 워크스페이스 멤버가 조회 가능
CREATE POLICY wm_select ON mm_workspace_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM mm_workspace_members AS m
      WHERE m.workspace_id = mm_workspace_members.workspace_id AND m.user_id = auth.uid()
    )
  );

-- 멤버 추가/수정/삭제: service_role (API Route)만 처리
CREATE POLICY wm_all_service ON mm_workspace_members FOR ALL
  USING (auth.role() = 'service_role');

-- 초대장: inviter 또는 초대받은 email 소유자 조회 가능 (service_role 통해 처리)
CREATE POLICY wi_all_service ON mm_workspace_invitations FOR ALL
  USING (auth.role() = 'service_role');
