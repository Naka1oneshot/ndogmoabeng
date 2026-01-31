-- Add bot settings columns to lion_game_state
ALTER TABLE public.lion_game_state
ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bot_active_strategy TEXT DEFAULT 'random',
ADD COLUMN IF NOT EXISTS bot_guess_strategy TEXT DEFAULT 'smart',
ADD COLUMN IF NOT EXISTS bot_delay_ms INTEGER DEFAULT 1500;

-- Add comment for documentation
COMMENT ON COLUMN public.lion_game_state.bot_enabled IS 'Enable automatic bot decisions for Lion game';
COMMENT ON COLUMN public.lion_game_state.bot_active_strategy IS 'Strategy for bot active card: random, defensive, aggressive';
COMMENT ON COLUMN public.lion_game_state.bot_guess_strategy IS 'Strategy for bot guess: smart (context-aware), random, always_equal';
COMMENT ON COLUMN public.lion_game_state.bot_delay_ms IS 'Delay in ms before bot makes decision';