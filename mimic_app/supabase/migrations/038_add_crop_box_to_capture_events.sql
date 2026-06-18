-- 캡처 단계 확대 영역(Recorder가 클릭 요소 기준으로 결정) — 원본 이미지 기준 0~1 정규화 {x,y,width,height}.
-- finalize에서 이 영역으로 image_zoom/offset 프레이밍을 계산(서버 휴리스틱 대체). 없으면 기존 동작 유지.
ALTER TABLE mm_capture_events ADD COLUMN IF NOT EXISTS crop_box jsonb;
