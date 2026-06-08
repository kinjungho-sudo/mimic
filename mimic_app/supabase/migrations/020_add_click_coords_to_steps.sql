-- Recorder 클릭 좌표를 mm_steps에 보존
-- click_x/y: 0~10000 정수 (0~1 정규화 × 10000)
-- element_rect: 클릭 요소 bounding box {x, y, width, height} (0~1 정규화)
ALTER TABLE mm_steps
  ADD COLUMN IF NOT EXISTS click_x       INT  NULL,
  ADD COLUMN IF NOT EXISTS click_y       INT  NULL,
  ADD COLUMN IF NOT EXISTS element_rect  JSONB NULL;
