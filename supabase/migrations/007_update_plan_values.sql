-- ─────────────────────────────────────────────────────────────────────────────
-- 007_update_plan_values.sql
-- plan 체계를 free / pro / team 3단계로 통일
-- pro_waitlist → pro로 마이그레이션
-- ─────────────────────────────────────────────────────────────────────────────

-- 기존 pro_waitlist 유저를 pro로 전환
UPDATE mm_users SET plan = 'pro' WHERE plan = 'pro_waitlist';

-- CHECK 제약 교체
ALTER TABLE mm_users DROP CONSTRAINT IF EXISTS mm_users_plan_check;
ALTER TABLE mm_users ADD CONSTRAINT mm_users_plan_check
  CHECK (plan IN ('free', 'pro', 'team'));

-- mm_pro_signups: plan_interested CHECK도 이미 ('pro', 'team')이므로 변경 불필요
