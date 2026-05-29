-- Add user_annotations JSONB column to mm_steps for storing image annotation overlays
ALTER TABLE mm_steps ADD COLUMN IF NOT EXISTS user_annotations jsonb NULL DEFAULT '[]';
