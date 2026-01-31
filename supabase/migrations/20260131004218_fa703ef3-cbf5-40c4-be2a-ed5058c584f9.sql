-- Add SPECTATOR to the allowed statuses for game_players
ALTER TABLE public.game_players DROP CONSTRAINT IF EXISTS game_players_status_check;

ALTER TABLE public.game_players ADD CONSTRAINT game_players_status_check 
  CHECK (status = ANY (ARRAY['ACTIVE'::text, 'LEFT'::text, 'REMOVED'::text, 'SPECTATOR'::text]));