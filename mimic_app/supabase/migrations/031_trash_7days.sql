-- 휴지통 자동 삭제 기간 30일 → 7일로 변경
CREATE OR REPLACE FUNCTION purge_old_trash()
RETURNS void AS $$
BEGIN
  DELETE FROM mm_tutorials
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 30일 cron 제거 후 7일 cron 재등록
SELECT cron.unschedule('purge_trash_30days');

SELECT cron.schedule(
  'purge_trash_7days',
  '0 15 * * *',
  $$ SELECT purge_old_trash(); $$
);
