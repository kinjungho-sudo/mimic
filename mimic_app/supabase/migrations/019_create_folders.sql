-- mm_folders 테이블 생성
CREATE TABLE IF NOT EXISTS mm_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES mm_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#4F46E5',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folders_user_id ON mm_folders(user_id);

-- mm_tutorials에 folder_id 컬럼 추가
ALTER TABLE mm_tutorials
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES mm_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tutorials_folder_id ON mm_tutorials(folder_id);

-- RLS
ALTER TABLE mm_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY folders_select ON mm_folders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY folders_insert ON mm_folders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY folders_update ON mm_folders FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY folders_delete ON mm_folders FOR DELETE USING (user_id = auth.uid());

-- updated_at 트리거
CREATE TRIGGER mm_folders_updated_at
  BEFORE UPDATE ON mm_folders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
