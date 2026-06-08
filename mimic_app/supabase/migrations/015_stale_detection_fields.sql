-- Phase 2-1: Stale Guide Detection
ALTER TABLE mm_steps
  ADD COLUMN IF NOT EXISTS freshness_checked_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS is_stale             BOOLEAN     NOT NULL DEFAULT false;
