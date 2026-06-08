-- ─────────────────────────────────────────────────────────────────────────────
-- 025_add_deleted_at_and_cron.sql
-- MM_tutorials soft-delete 지원 + 30일 자동 영구삭제 Cron
-- ─────────────────────────────────────────────────────────────────────────────

-- deleted_at 컬럼 추가 (이미 있으면 무시)
ALTER TABLE mm_tutorials
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- 인덱스: 휴지통 목록 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_mm_tutorials_deleted_at
  ON mm_tutorials(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ─── 30일 지난 soft-delete 행 자동 영구삭제 함수 ───
CREATE OR REPLACE FUNCTION purge_old_trash()
RETURNS void AS $$
BEGIN
  DELETE FROM mm_tutorials
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Cron 등록 (pg_cron 확장 필요 — Supabase에서 기본 제공) ───
-- 매일 00:00 KST (15:00 UTC) 에 실행
SELECT cron.schedule(
  'purge_trash_30days',
  '0 15 * * *',
  $$ SELECT purge_old_trash(); $$
);
