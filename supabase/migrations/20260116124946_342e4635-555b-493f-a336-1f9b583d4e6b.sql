-- Add starting_tokens column to games table with default 50
ALTER TABLE public.games 
ADD COLUMN starting_tokens integer NOT NULL DEFAULT 50;

-- Backfill existing participants: set jetons to game's starting_tokens (or 50) for those with 0 tokens
UPDATE public.game_players gp
SET jetons = COALESCE(g.starting_tokens, 50)
FROM public.games g
WHERE gp.game_id = g.id 
  AND gp.jetons = 0
  AND gp.is_host = false;