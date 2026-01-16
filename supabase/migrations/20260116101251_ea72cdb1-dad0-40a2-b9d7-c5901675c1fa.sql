-- Add presence tracking columns to game_players
ALTER TABLE public.game_players 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LEFT'));

-- Update existing players to have last_seen set
UPDATE public.game_players SET last_seen = now() WHERE last_seen IS NULL;

-- Create index for efficient presence queries
CREATE INDEX IF NOT EXISTS idx_game_players_presence ON public.game_players(game_id, status, last_seen);

-- Add RLS policy for players to update their own last_seen
CREATE POLICY "Players can update their own presence" 
ON public.game_players 
FOR UPDATE 
USING (true)
WITH CHECK (true);