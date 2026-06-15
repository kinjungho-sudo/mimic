-- 파괴적 영역 픽셀화 블러(에디터)의 원본 보존/되돌리기용 백업 컬럼
-- 최초 블러 적용 시 screenshot_url을 이 컬럼에 1회 백업한다.
-- 되돌리기는 screenshot_url을 이 값으로 복원(원본은 그대로 유지 → 재블러 가능).
ALTER TABLE mm_steps ADD COLUMN IF NOT EXISTS original_screenshot_url text;
COMMENT ON COLUMN mm_steps.original_screenshot_url IS '블러 적용 전 원본 스크린샷 URL (되돌리기용, 최초 블러 시 1회 백업)';
