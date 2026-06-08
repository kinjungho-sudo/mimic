-- Phase 2-2: AI 스마트 크롭 지원 필드
-- crop_rect: Claude Vision이 감지한 클릭 요소 경계 {x, y, w, h} (0~1 정규화)
-- viewport_w/h: 캡처 당시 뷰포트 크기 (크롭 정확도 향상용)
ALTER TABLE mm_steps
  ADD COLUMN IF NOT EXISTS crop_rect   JSONB NULL,
  ADD COLUMN IF NOT EXISTS viewport_w  INT   NULL,
  ADD COLUMN IF NOT EXISTS viewport_h  INT   NULL;

ALTER TABLE mm_capture_events
  ADD COLUMN IF NOT EXISTS viewport_w INT NULL,
  ADD COLUMN IF NOT EXISTS viewport_h INT NULL;
