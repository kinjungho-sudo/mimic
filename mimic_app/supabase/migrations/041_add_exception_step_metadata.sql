-- Preserve recorder/live-guide steps even when screenshots or DOM targets are unavailable.
ALTER TABLE mm_capture_events ALTER COLUMN screenshot_url DROP NOT NULL;
ALTER TABLE mm_steps ALTER COLUMN screenshot_url DROP NOT NULL;

ALTER TABLE mm_capture_events ADD COLUMN IF NOT EXISTS step_type text DEFAULT 'normal_interactive_step';
ALTER TABLE mm_steps ADD COLUMN IF NOT EXISTS step_type text DEFAULT 'normal_interactive_step';

ALTER TABLE mm_capture_events ADD COLUMN IF NOT EXISTS capture_source text DEFAULT 'auto';
ALTER TABLE mm_steps ADD COLUMN IF NOT EXISTS capture_source text DEFAULT 'auto';

ALTER TABLE mm_capture_events ADD COLUMN IF NOT EXISTS capture_failure_reason text;
ALTER TABLE mm_steps ADD COLUMN IF NOT EXISTS capture_failure_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mm_capture_events_step_type_check') THEN
    ALTER TABLE mm_capture_events ADD CONSTRAINT mm_capture_events_step_type_check
      CHECK (step_type IS NULL OR step_type IN (
        'normal_interactive_step',
        'visual_only_step',
        'visual_overlay_step',
        'manual_capture_step',
        'blocked_step',
        'skipped_step'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mm_steps_step_type_check') THEN
    ALTER TABLE mm_steps ADD CONSTRAINT mm_steps_step_type_check
      CHECK (step_type IS NULL OR step_type IN (
        'normal_interactive_step',
        'visual_only_step',
        'visual_overlay_step',
        'manual_capture_step',
        'blocked_step',
        'skipped_step'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mm_capture_events_capture_source_check') THEN
    ALTER TABLE mm_capture_events ADD CONSTRAINT mm_capture_events_capture_source_check
      CHECK (capture_source IS NULL OR capture_source IN ('auto', 'manual', 'none'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mm_steps_capture_source_check') THEN
    ALTER TABLE mm_steps ADD CONSTRAINT mm_steps_capture_source_check
      CHECK (capture_source IS NULL OR capture_source IN ('auto', 'manual', 'none'));
  END IF;
END $$;
