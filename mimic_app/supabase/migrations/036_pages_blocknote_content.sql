-- 가이드북: BlockNote 전면 재작성 — 블록을 per-row(mm_page_blocks)에서
-- mm_pages.content(BlockNote 문서 JSON 배열) 단일 컬럼으로 전환한다.
-- mm_page_blocks는 0 rows이므로 데이터 마이그레이션 불필요. 폐기 예정(당장 DROP은 안 함).

ALTER TABLE mm_pages
  ADD COLUMN IF NOT EXISTS content jsonb NOT NULL DEFAULT '[]'::jsonb;
