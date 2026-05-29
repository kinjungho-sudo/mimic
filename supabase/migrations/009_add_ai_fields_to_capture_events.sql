-- 009_add_ai_fields_to_capture_events.sql
-- save-step API가 ai_title / ai_description을 INSERT하는데 컬럼이 없어서 500 오류 발생
-- recorder 측 /api/capture/analyze 결과를 저장하기 위한 컬럼 추가

ALTER TABLE mm_capture_events
  ADD COLUMN IF NOT EXISTS ai_title text NULL,
  ADD COLUMN IF NOT EXISTS ai_description text NULL;
