-- Add is_bot column to game_players
ALTER TABLE public.game_players 
ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

-- Add index for bot queries
CREATE INDEX IF NOT EXISTS idx_game_players_is_bot ON public.game_players(game_id, is_bot) WHERE is_bot = true;