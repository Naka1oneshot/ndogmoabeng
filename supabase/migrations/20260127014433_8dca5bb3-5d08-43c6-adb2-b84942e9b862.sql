-- Add robust auto mode fields to river_session_state

-- Single runner lease fields
ALTER TABLE public.river_session_state
  ADD COLUMN IF NOT EXISTS auto_runner_user_id uuid,
  ADD COLUMN IF NOT EXISTS auto_runner_lease_until timestamptz;

-- Fail counters for backoff/stop
ALTER TABLE public.river_session_state
  ADD COLUMN IF NOT EXISTS auto_fail_set_danger integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_fail_bot_decisions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_fail_lock integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_fail_resolve integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_last_error text;

-- Animation handshake ACK fields
ALTER TABLE public.river_session_state
  ADD COLUMN IF NOT EXISTS auto_waiting_for text,
  ADD COLUMN IF NOT EXISTS auto_anim_ack_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN public.river_session_state.auto_runner_user_id IS 'User ID of the MJ currently running the auto mode (lease holder)';
COMMENT ON COLUMN public.river_session_state.auto_runner_lease_until IS 'Lease expiration time - only lease holder can run auto actions';
COMMENT ON COLUMN public.river_session_state.auto_waiting_for IS 'Current animation being awaited: LOCK_ANIM or RESOLVE_ANIM';
COMMENT ON COLUMN public.river_session_state.auto_anim_ack_at IS 'Timestamp when the awaited animation was acknowledged as complete';