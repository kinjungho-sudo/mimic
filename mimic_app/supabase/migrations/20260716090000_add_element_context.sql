-- Recorder target context for resilient Live Guide replay.
-- Stores iframe/shadow-root traversal hints and a small non-sensitive element fingerprint.
ALTER TABLE mm_capture_events
  ADD COLUMN IF NOT EXISTS element_context jsonb;

ALTER TABLE mm_steps
  ADD COLUMN IF NOT EXISTS element_context jsonb;

COMMENT ON COLUMN mm_capture_events.element_context IS
  'Recorder DOM context: frame selectors/url, shadow host chain, target selector, semantic fingerprint';

COMMENT ON COLUMN mm_steps.element_context IS
  'Live Guide DOM context propagated from capture event';
