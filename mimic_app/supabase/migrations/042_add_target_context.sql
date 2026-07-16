-- Versioned DOM target metadata for reliable replay and geometry QA.
ALTER TABLE mm_capture_events ADD COLUMN IF NOT EXISTS target_context jsonb;
ALTER TABLE mm_steps ADD COLUMN IF NOT EXISTS target_context jsonb;

COMMENT ON COLUMN mm_capture_events.target_context IS
  'Recorder target evidence: coordinate schema, confidence, accessible name, frame path, and shadow path.';
COMMENT ON COLUMN mm_steps.target_context IS
  'Replay target evidence copied from capture events. Used for iframe/shadow traversal and confidence-aware fallback.';
