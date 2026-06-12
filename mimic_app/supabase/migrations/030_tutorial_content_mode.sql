-- 교육 자료 모드 컬럼 추가 (action: 업무 매뉴얼 기본값 / education: 교육 자료 — Pro 전용)
ALTER TABLE mm_tutorials
  ADD COLUMN IF NOT EXISTS content_mode text DEFAULT 'action'
  CHECK (content_mode IN ('action', 'education'));
