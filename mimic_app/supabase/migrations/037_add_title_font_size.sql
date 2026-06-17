-- 스텝 제목 글자 크기(px) 저장 — 편집기 서식바 드롭다운으로 변경, null이면 기본 20px
ALTER TABLE mm_steps ADD COLUMN IF NOT EXISTS title_font_size integer;
