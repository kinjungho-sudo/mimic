-- Phase 3-1: Guide Me 오버레이용 DOM 선택자 저장
-- element_selector: CSS selector (가장 정확한 방법)
-- element_xpath:    XPath (fallback)
ALTER TABLE mm_capture_events
  ADD COLUMN IF NOT EXISTS element_selector TEXT NULL,
  ADD COLUMN IF NOT EXISTS element_xpath     TEXT NULL;

ALTER TABLE mm_steps
  ADD COLUMN IF NOT EXISTS element_selector TEXT NULL,
  ADD COLUMN IF NOT EXISTS element_xpath     TEXT NULL;
