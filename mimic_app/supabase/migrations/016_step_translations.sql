-- Phase 2-4: 가이드 다국어 번역 캐시 테이블
CREATE TABLE IF NOT EXISTS mm_step_translations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id    uuid        NOT NULL REFERENCES mm_steps(id) ON DELETE CASCADE,
  lang       CHAR(5)     NOT NULL,   -- 'en', 'ja', 'zh-CN', 'es', 'fr' 등
  title      TEXT        NULL,
  script     TEXT        NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (step_id, lang)
);

ALTER TABLE mm_step_translations ENABLE ROW LEVEL SECURITY;

-- 소유자만 읽기/쓰기 (step → tutorial → user 경로)
CREATE POLICY "translations_own" ON mm_step_translations
  FOR ALL USING (
    step_id IN (
      SELECT s.id FROM mm_steps s
      JOIN mm_tutorials t ON t.id = s.tutorial_id
      WHERE t.user_id = auth.uid()
    )
  );

-- 퍼블리시된 튜토리얼은 익명 읽기 가능
CREATE POLICY "translations_public_read" ON mm_step_translations
  FOR SELECT USING (
    step_id IN (
      SELECT s.id FROM mm_steps s
      JOIN mm_tutorials t ON t.id = s.tutorial_id
      WHERE t.status = 'published' AND t.share_token IS NOT NULL
    )
  );
