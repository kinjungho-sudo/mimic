-- 편집기 이미지 팬(위치 조정) 영속화 — image_zoom과 함께 표시 프레이밍 결정
-- 값: 이미지 크기 대비 translate 비율 (-1.5 ~ 1.5), null = 0 (중앙)
ALTER TABLE mm_steps ADD COLUMN IF NOT EXISTS image_offset_x double precision;
ALTER TABLE mm_steps ADD COLUMN IF NOT EXISTS image_offset_y double precision;
COMMENT ON COLUMN mm_steps.image_offset_x IS '이미지 가로 팬 오프셋 (이미지 너비 비율, -1.5~1.5)';
COMMENT ON COLUMN mm_steps.image_offset_y IS '이미지 세로 팬 오프셋 (이미지 높이 비율, -1.5~1.5)';
