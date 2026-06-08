-- ─────────────────────────────────────────────────────────────────────────────
-- 003_modify_na_steps.sql
-- NA_steps 보안 수정 ★ CRITICAL
-- 현재 RLS 비활성 + user_id 없음 = 누구나 접근 가능
--
-- 실행 전 확인:
--   1. ADMIN_USER_ID 를 정호씨 Supabase auth.users.id로 교체
--   2. MM_tutorials 테이블이 먼저 생성되어 있어야 함 (001 실행 후)
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: user_id 컬럼 추가
ALTER TABLE NA_steps ADD COLUMN IF NOT EXISTS user_id uuid NULL;

-- Step 2: 기존 row를 정호씨 user_id로 일괄 업데이트
-- ⚠️ 아래 'REPLACE_WITH_ADMIN_USER_ID' 를 실제 auth.users.id 로 교체 후 실행
UPDATE NA_steps
SET user_id = '2013c141-5736-4b4c-8202-b423cffdb29a'
WHERE user_id IS NULL;

-- Step 3: NOT NULL + FK 추가
ALTER TABLE NA_steps
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT IF NOT EXISTS NA_steps_user_fk
    FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- Step 4: MIMIC 매뉴얼과 연결 컬럼 추가
ALTER TABLE NA_steps
  ADD COLUMN IF NOT EXISTS tutorial_id uuid NULL
  REFERENCES MM_tutorials(id) ON DELETE SET NULL;

-- Step 5: RLS 활성화 및 정책 추가
ALTER TABLE NA_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "na_steps_own" ON NA_steps
  FOR ALL USING (auth.uid() = user_id);
