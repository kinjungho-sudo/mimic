-- Basic 출시 알림 신청을 mm_pro_signups에 저장할 수 있도록 허용한다.
-- 사용자 계정의 실제 plan 제약(free/pro/team)은 변경하지 않는다.

ALTER TABLE mm_pro_signups
  DROP CONSTRAINT IF EXISTS mm_pro_signups_plan_interested_check;

ALTER TABLE mm_pro_signups
  ADD CONSTRAINT mm_pro_signups_plan_interested_check
  CHECK (plan_interested IN ('basic', 'pro', 'team'));
