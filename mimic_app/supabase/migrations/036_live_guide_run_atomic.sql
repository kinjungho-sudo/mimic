-- 라이브 가이드 무료 한도 원자적 check-and-increment (race condition 방지)
-- 한도 미만일 때만 증가하고 증가 후 값을 반환. 한도 도달 시 미증가 → NULL 반환.
CREATE OR REPLACE FUNCTION consume_free_live_guide_run(uid uuid, free_limit int)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE mm_users
  SET live_guide_runs = COALESCE(live_guide_runs, 0) + 1
  WHERE id = uid AND COALESCE(live_guide_runs, 0) < free_limit
  RETURNING live_guide_runs;
$$;
