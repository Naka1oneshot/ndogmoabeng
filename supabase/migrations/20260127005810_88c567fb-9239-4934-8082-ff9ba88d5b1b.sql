-- Add Auto Mode fields to river_session_state for Rivières automation
ALTER TABLE public.river_session_state
ADD COLUMN IF NOT EXISTS auto_mode boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_countdown_ends_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS auto_countdown_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_last_step text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS auto_updated_at timestamptz DEFAULT now();

-- Add index for efficient auto mode queries
CREATE INDEX IF NOT EXISTS idx_river_session_state_auto_mode 
ON public.river_session_state(auto_mode) 
WHERE auto_mode = true;

-- Add comment for documentation
COMMENT ON COLUMN public.river_session_state.auto_mode IS 'When true, MJ actions are automated';
COMMENT ON COLUMN public.river_session_state.auto_countdown_ends_at IS 'Server timestamp when auto countdown expires';
COMMENT ON COLUMN public.river_session_state.auto_countdown_active IS 'Whether countdown is currently running';
COMMENT ON COLUMN public.river_session_state.auto_last_step IS 'Debug: last auto step executed (WAIT_DANGER, WAIT_DECISIONS, COUNTDOWN, LOCKING, RESOLVING)';