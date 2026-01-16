-- Drop the old constraint and add a new one with REMOVED status
ALTER TABLE public.game_players DROP CONSTRAINT game_players_status_check;

ALTER TABLE public.game_players ADD CONSTRAINT game_players_status_check 
CHECK (status = ANY (ARRAY['ACTIVE'::text, 'LEFT'::text, 'REMOVED'::text]));