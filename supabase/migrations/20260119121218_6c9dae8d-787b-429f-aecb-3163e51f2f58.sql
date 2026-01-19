-- Add is_public column to games table for public/private game visibility
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- Add index for faster public games queries
CREATE INDEX IF NOT EXISTS idx_games_is_public ON public.games(is_public) WHERE is_public = true;