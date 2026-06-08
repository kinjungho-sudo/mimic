-- Extension이 수집한 클릭 요소 bounding box를 저장
-- 형식: {x, y, width, height} — 0~1 정규화 (save-step 라우트에서 px → 정규화 변환)
ALTER TABLE mm_capture_events
  ADD COLUMN IF NOT EXISTS element_rect JSONB NULL;
