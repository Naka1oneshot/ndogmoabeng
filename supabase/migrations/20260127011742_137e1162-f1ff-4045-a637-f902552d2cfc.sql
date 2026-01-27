-- Add auto mode fields to session_games table for Forêt automation
ALTER TABLE public.session_games
ADD COLUMN IF NOT EXISTS auto_mode boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_countdown_type text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS auto_countdown_ends_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS auto_last_step text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS auto_updated_at timestamptz DEFAULT now();

-- Create index for efficient auto mode queries
CREATE INDEX IF NOT EXISTS idx_session_games_auto_mode ON public.session_games(auto_mode) WHERE auto_mode = true;

-- Comment for documentation
COMMENT ON COLUMN public.session_games.auto_mode IS 'Whether auto mode is enabled for this session';
COMMENT ON COLUMN public.session_games.auto_countdown_type IS 'Type of countdown: BETS, COMBAT_SUBMIT, SHOP, COMBAT_POSITIONS_WAIT';
COMMENT ON COLUMN public.session_games.auto_countdown_ends_at IS 'When the current countdown expires (server time)';
COMMENT ON COLUMN public.session_games.auto_last_step IS 'Last auto step completed for debugging';