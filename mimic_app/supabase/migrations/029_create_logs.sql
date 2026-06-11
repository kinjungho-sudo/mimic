-- mm_logs — 장애 진단용 로그 테이블
--   error/warn 레벨만 영구 저장(애플리케이션 로거 규칙). debug/info는 콘솔(Vercel 런타임 로그).
--   user_id/tutorial_id는 FK 없이 보관 — 참조 행이 삭제돼도 로그는 남고, 잘못된 id로 insert가 실패하지 않도록.
CREATE TABLE IF NOT EXISTS mm_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  level       text NOT NULL CHECK (level IN ('debug','info','warn','error')),
  source      text NOT NULL CHECK (source IN ('client','server')),
  event       text NOT NULL,          -- 짧은 코드, 예: 'step.delete.fail'
  message     text,
  context     jsonb,                  -- 추가 컨텍스트 (PII 금지 — ID/코드만)
  user_id     uuid,
  tutorial_id uuid,
  url         text
);

CREATE INDEX IF NOT EXISTS idx_logs_created_at ON mm_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level      ON mm_logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_event      ON mm_logs(event);

-- RLS: 정책 없음 → anon/authenticated 직접 접근 차단. 쓰기/조회는 service role(API·Supabase MCP)만.
ALTER TABLE mm_logs ENABLE ROW LEVEL SECURITY;
