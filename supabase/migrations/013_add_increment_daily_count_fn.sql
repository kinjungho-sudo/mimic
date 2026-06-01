-- daily_manual_count atomic increment (race condition 방지)
CREATE OR REPLACE FUNCTION increment_daily_manual_count(uid uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE mm_users
  SET daily_manual_count = daily_manual_count + 1
  WHERE id = uid;
$$;
