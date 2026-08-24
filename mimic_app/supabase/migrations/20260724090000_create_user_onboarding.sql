-- Server-owned, versioned onboarding progress for the Parro getting-started Live Guide.
CREATE TABLE IF NOT EXISTS mm_user_onboarding_progress (
  user_id uuid NOT NULL REFERENCES mm_users(id) ON DELETE CASCADE,
  guide_key text NOT NULL,
  guide_version integer NOT NULL CHECK (guide_version > 0),
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed', 'dismissed')),
  current_step text,
  initial_completed_at timestamptz,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  dismissed_at timestamptz,
  run_count integer NOT NULL DEFAULT 0 CHECK (run_count >= 0),
  practice_manual_id uuid REFERENCES mm_tutorials(id) ON DELETE SET NULL,
  impression_at timestamptz,
  practice_capture_token uuid,
  practice_capture_token_issued_at timestamptz,
  practice_capture_consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, guide_key, guide_version)
);

CREATE TABLE IF NOT EXISTS mm_onboarding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES mm_users(id) ON DELETE CASCADE,
  guide_key text NOT NULL,
  guide_version integer NOT NULL CHECK (guide_version > 0),
  event_type text NOT NULL CHECK (event_type IN (
    'onboarding_impression',
    'start',
    'step_view',
    'step_complete',
    'blocked',
    'install_clicked',
    'resume',
    'dismiss',
    'complete',
    'replay_start'
  )),
  step_id text,
  browser_type text,
  extension_state text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_onboarding_progress_status
  ON mm_user_onboarding_progress (user_id, guide_key, guide_version, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mm_onboarding_progress_practice_token
  ON mm_user_onboarding_progress (practice_capture_token)
  WHERE practice_capture_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mm_onboarding_events_user_created
  ON mm_onboarding_events (user_id, created_at DESC);

DROP TRIGGER IF EXISTS mm_user_onboarding_progress_updated_at ON mm_user_onboarding_progress;
CREATE TRIGGER mm_user_onboarding_progress_updated_at
  BEFORE UPDATE ON mm_user_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE mm_user_onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm_onboarding_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS onboarding_progress_own ON mm_user_onboarding_progress;
CREATE POLICY onboarding_progress_own
  ON mm_user_onboarding_progress
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS onboarding_events_own_select ON mm_onboarding_events;
CREATE POLICY onboarding_events_own_select
  ON mm_onboarding_events
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS onboarding_events_own_insert ON mm_onboarding_events;
CREATE POLICY onboarding_events_own_insert
  ON mm_onboarding_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
