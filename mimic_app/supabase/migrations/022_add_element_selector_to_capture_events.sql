-- Extension의 element_selector/xpath를 capture_events에 저장
-- MCP 에이전트 재현 시 선택자 우선, 좌표 fallback 구조에서 사용
ALTER TABLE mm_capture_events
  ADD COLUMN IF NOT EXISTS element_selector TEXT NULL,
  ADD COLUMN IF NOT EXISTS element_xpath     TEXT NULL;
