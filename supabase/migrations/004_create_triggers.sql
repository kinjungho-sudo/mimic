-- ─────────────────────────────────────────────────────────────────────────────
-- 004_create_triggers.sql
-- auth.users → MM_users 자동 생성 트리거
-- MM_tutorials.updated_at 자동 갱신 트리거
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── auth.users INSERT 시 MM_users 자동 생성 ───
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO MM_users (id, email, name, avatar_url, auth_provider, plan, daily_limit)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    'free',
    3
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── MM_tutorials.updated_at 자동 갱신 ───
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tutorials_updated_at ON MM_tutorials;
CREATE TRIGGER tutorials_updated_at
  BEFORE UPDATE ON MM_tutorials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 자정 KST 일일 카운트 리셋 (Supabase Dashboard > Cron Jobs 에서 설정) ───
-- SELECT cron.schedule('reset_daily_count', '0 15 * * *', $$
--   UPDATE MM_users SET daily_manual_count = 0;
-- $$);
-- (15:00 UTC = 00:00 KST)
