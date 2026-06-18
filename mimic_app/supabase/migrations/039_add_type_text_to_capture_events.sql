-- 캡처 시 실제 입력된 텍스트(type 액션) — follow_config.typeText(스튜디오 편집)와 별개.
-- 익스텐션이 keydown 기반으로 수집한 원문. finalize에서 mm_steps.type_text로 전파.
ALTER TABLE mm_capture_events ADD COLUMN IF NOT EXISTS type_text text;
