-- mm_logs 카테고리 분류 추가 — 어드민 로그/모니터링 뷰용.
--   기존 행은 모두 에러/경고였으므로 default 'error'로 백필.
--   error      : 개발·운영 중 발생하는 장애/예외 (기존 동작 유지, level error/warn만 저장)
--   network    : Extension·외부서비스 연동 호출 결과 (성공/실패) — info 레벨도 저장
--   audit      : 로그인 성공/실패, 회원 탈퇴 등 보안 감사 — info 레벨도 저장
--   system     : cron 등 시스템 동작 정상 여부 — info 레벨도 저장
ALTER TABLE mm_logs
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'error'
  CHECK (category IN ('error','network','audit','system'));

-- 어드민 뷰는 (category, created_at DESC)로 필터+정렬하므로 복합 인덱스.
CREATE INDEX IF NOT EXISTS idx_logs_category_created_at ON mm_logs(category, created_at DESC);
