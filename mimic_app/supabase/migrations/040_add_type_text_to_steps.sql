-- 캡처 시 입력된 원문 텍스트 — follow_config.typeText(스튜디오 오버라이드)가 없을 때 폴백.
-- 라이브 가이드 자동입력 순서: fc.typeText → mm_steps.type_text → null(자동입력 안 함).
ALTER TABLE mm_steps ADD COLUMN IF NOT EXISTS type_text text;
