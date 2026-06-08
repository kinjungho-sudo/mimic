-- 006_extension_token_kind.sql
-- 링크 토큰(일회성)과 세션 토큰(장기)을 kind 컬럼으로 구분

ALTER TABLE mm_extension_tokens
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'session'
    CHECK (kind IN ('link', 'session'));

-- 기존 토큰은 모두 session으로 간주 (DEFAULT 적용)
-- 신규 link 토큰은 redeem 시 즉시 expires_at을 now()로 소각
