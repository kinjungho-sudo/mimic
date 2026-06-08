-- Add domain_name and domain_favicon to capture events and steps
-- Used to render domain section headers in the editor (Tango-style)

ALTER TABLE mm_capture_events
  ADD COLUMN IF NOT EXISTS domain_hostname text NULL,
  ADD COLUMN IF NOT EXISTS domain_name     text NULL,
  ADD COLUMN IF NOT EXISTS domain_favicon  text NULL;

ALTER TABLE mm_steps
  ADD COLUMN IF NOT EXISTS domain_hostname text NULL,
  ADD COLUMN IF NOT EXISTS domain_name     text NULL,
  ADD COLUMN IF NOT EXISTS domain_favicon  text NULL;
