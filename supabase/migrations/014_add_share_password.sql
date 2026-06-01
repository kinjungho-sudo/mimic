-- 뷰어 비밀번호 보호 (Phase 1-5)
ALTER TABLE mm_tutorials
  ADD COLUMN IF NOT EXISTS share_password TEXT NULL;
