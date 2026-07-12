-- mm_steps.click_x/y: INT → double precision
-- 배경: finalize가 0~1 실수를 저장(CLAUDE.md 좌표계 규칙)하는데 컬럼이 INT라서
--       0.45 같은 값이 0/1로 반올림 → 어노테이션·핫스팟이 좌측 상단(0,0)에 생성되는 버그
ALTER TABLE mm_steps
  ALTER COLUMN click_x TYPE double precision USING click_x::double precision,
  ALTER COLUMN click_y TYPE double precision USING click_y::double precision;

-- 레거시 데이터 정규화: 과거 0~10000 정수 스케일로 저장된 값 → 0~1
UPDATE mm_steps SET click_x = click_x / 10000.0 WHERE click_x > 1;
UPDATE mm_steps SET click_y = click_y / 10000.0 WHERE click_y > 1;

COMMENT ON COLUMN mm_steps.click_x IS '클릭 X 좌표 (0~1 정규화 실수)';
COMMENT ON COLUMN mm_steps.click_y IS '클릭 Y 좌표 (0~1 정규화 실수)';

-- image_zoom: 이미지 편집기 확대 배율 저장 (API는 이미 지원하는데 컬럼이 없었음)
ALTER TABLE mm_steps ADD COLUMN IF NOT EXISTS image_zoom double precision;
COMMENT ON COLUMN mm_steps.image_zoom IS '이미지 확대 배율 (0.5~4, null=1)';
