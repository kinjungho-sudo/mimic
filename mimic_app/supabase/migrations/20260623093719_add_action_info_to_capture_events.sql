ALTER TABLE mm_capture_events
  ADD COLUMN IF NOT EXISTS action_info jsonb;

COMMENT ON COLUMN mm_capture_events.action_info IS 'Recorder action metadata used by finalize for labels, type/click classification, and automatic annotations.';
