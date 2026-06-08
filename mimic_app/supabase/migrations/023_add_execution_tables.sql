-- Auto-Run BETA: 매뉴얼 자동 실행 세션 + 스텝별 결과 추적
CREATE TABLE IF NOT EXISTS mm_execution_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id     uuid REFERENCES mm_tutorials(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','running','completed','failed','paused')),
  total_steps     int,
  completed_steps int NOT NULL DEFAULT 0,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

CREATE TABLE IF NOT EXISTS mm_step_results (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_session_id uuid NOT NULL REFERENCES mm_execution_sessions(id) ON DELETE CASCADE,
  step_id              uuid REFERENCES mm_steps(id),
  step_number          int NOT NULL,
  status               text NOT NULL DEFAULT 'skipped'
                         CHECK (status IN ('success','failed','skipped','paused')),
  selector_used        text,
  error_message        text,
  executed_at          timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE mm_execution_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm_step_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own sessions" ON mm_execution_sessions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "own step results" ON mm_step_results
  FOR ALL USING (
    execution_session_id IN (
      SELECT id FROM mm_execution_sessions WHERE user_id = auth.uid()
    )
  );
