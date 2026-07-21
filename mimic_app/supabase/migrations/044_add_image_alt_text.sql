ALTER TABLE mm_steps
  ADD COLUMN IF NOT EXISTS image_alt_text text;

COMMENT ON COLUMN mm_steps.image_alt_text IS
  '사용자가 작성한 스크린샷 대체 텍스트. null 또는 빈 값이면 제목과 설명에서 접근 가능한 기본값을 생성한다.';
