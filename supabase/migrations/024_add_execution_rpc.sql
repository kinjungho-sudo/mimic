CREATE OR REPLACE FUNCTION increment_execution_completed(session_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE mm_execution_sessions
  SET completed_steps = completed_steps + 1
  WHERE id = session_id;
$$;
