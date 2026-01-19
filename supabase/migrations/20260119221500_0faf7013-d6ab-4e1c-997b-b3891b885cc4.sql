-- Add columns for token usage and clan lock on game_players
ALTER TABLE public.game_players 
ADD COLUMN IF NOT EXISTS clan_token_used boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS clan_locked boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.game_players.clan_token_used IS 'Whether a Ndogmoabeng token was used for clan advantage in this game';
COMMENT ON COLUMN public.game_players.clan_locked IS 'Whether the player locked their clan choice (MJ cannot change it)';