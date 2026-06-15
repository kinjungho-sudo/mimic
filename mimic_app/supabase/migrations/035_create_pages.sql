-- Pages 빌더 — 여러 가이드(튜토리얼) + 텍스트 + 영상 블록을 한 문서로 엮는 큐레이션 페이지.
-- 기존 mm_tutorials의 share_token/visibility/folder_id/workspace_id 구조를 그대로 따른다.

CREATE TABLE IF NOT EXISTS mm_pages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES mm_users(id) ON DELETE CASCADE,
  title         text NOT NULL DEFAULT '제목 없는 페이지',
  description   text,
  status        text NOT NULL DEFAULT 'draft'   CHECK (status     IN ('draft', 'published')),
  visibility    text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  share_token   text UNIQUE,
  share_password text,
  cover_color   text,
  folder_id     uuid REFERENCES mm_folders(id)    ON DELETE SET NULL,
  workspace_id  uuid REFERENCES mm_workspaces(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  deleted_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pages_user_id      ON mm_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_pages_workspace_id ON mm_pages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pages_share_token  ON mm_pages(share_token);

-- 페이지 본문 블록 — 순서 있는 콘텐츠 단위.
--   block_type:
--     'heading'  → content = { text, level }
--     'text'     → content = { markdown }
--     'video'    → content = { url }                     (Loom/YouTube 등)
--     'tutorial' → content = { tutorial_id, default_open } (가이드 임베드, 접힘/펼침)
CREATE TABLE IF NOT EXISTS mm_page_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     uuid NOT NULL REFERENCES mm_pages(id) ON DELETE CASCADE,
  order_index int  NOT NULL,
  block_type  text NOT NULL CHECK (block_type IN ('heading', 'text', 'video', 'tutorial')),
  content     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_blocks_page_id ON mm_page_blocks(page_id, order_index);

-- ── RLS (API는 service role로 우회하지만 방어적으로 동기화) ──
ALTER TABLE mm_pages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm_page_blocks ENABLE ROW LEVEL SECURITY;

-- 워크스페이스 멤버/오너 여부 헬퍼 조건을 인라인.
DROP POLICY IF EXISTS pages_owner_all   ON mm_pages;
DROP POLICY IF EXISTS pages_public_read ON mm_pages;

CREATE POLICY pages_owner_all ON mm_pages FOR ALL USING (
  user_id = auth.uid()
  OR (workspace_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM mm_workspace_members m WHERE m.workspace_id = mm_pages.workspace_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM mm_workspaces w WHERE w.id = mm_pages.workspace_id AND w.owner_id = auth.uid())
  ))
) WITH CHECK (
  user_id = auth.uid()
  OR (workspace_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM mm_workspace_members m WHERE m.workspace_id = mm_pages.workspace_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM mm_workspaces w WHERE w.id = mm_pages.workspace_id AND w.owner_id = auth.uid())
  ))
);

CREATE POLICY pages_public_read ON mm_pages FOR SELECT USING (
  status = 'published' AND share_token IS NOT NULL
);

DROP POLICY IF EXISTS page_blocks_owner_all   ON mm_page_blocks;
DROP POLICY IF EXISTS page_blocks_public_read ON mm_page_blocks;

CREATE POLICY page_blocks_owner_all ON mm_page_blocks FOR ALL USING (
  EXISTS (SELECT 1 FROM mm_pages p WHERE p.id = mm_page_blocks.page_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM mm_pages p WHERE p.id = mm_page_blocks.page_id AND p.user_id = auth.uid())
);

CREATE POLICY page_blocks_public_read ON mm_page_blocks FOR SELECT USING (
  EXISTS (SELECT 1 FROM mm_pages p WHERE p.id = mm_page_blocks.page_id AND p.status = 'published' AND p.share_token IS NOT NULL)
);
