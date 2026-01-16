-- Add columns for anonymous player support
ALTER TABLE public.game_players
  ADD COLUMN IF NOT EXISTS player_token text,
  ADD COLUMN IF NOT EXISTS player_number integer;

-- Make user_id nullable for anonymous players
ALTER TABLE public.game_players
  ALTER COLUMN user_id DROP NOT NULL;

-- Create unique index for player_token per game
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_players_token ON public.game_players(game_id, player_token) WHERE player_token IS NOT NULL;

-- Create unique index for player_number per game
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_players_number ON public.game_players(game_id, player_number) WHERE player_number IS NOT NULL;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Les joueurs peuvent quitter une partie" ON public.game_players;
DROP POLICY IF EXISTS "Les joueurs peuvent rejoindre une partie" ON public.game_players;
DROP POLICY IF EXISTS "Les joueurs peuvent voir les participants de leur partie" ON public.game_players;

-- New RLS policies that support both authenticated admins and anonymous players

-- SELECT: Allow host to see all players, and allow reading for anonymous access (needed for join flow)
CREATE POLICY "Host can view all players in their games"
ON public.game_players
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM games g 
    WHERE g.id = game_players.game_id 
    AND g.host_user_id = auth.uid()
  )
);

-- Allow anonymous read for player validation (service role handles the actual validation)
CREATE POLICY "Anyone can view players for joining"
ON public.game_players
FOR SELECT
USING (true);

-- INSERT: Host can add (for creating MJ entry), and anonymous players can join via edge function
CREATE POLICY "Host can add players to their games"
ON public.game_players
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM games g 
    WHERE g.id = game_players.game_id 
    AND g.host_user_id = auth.uid()
  )
  OR 
  (user_id IS NULL AND player_token IS NOT NULL)
);

-- UPDATE: Only host can update players (for resetting tokens)
CREATE POLICY "Host can update players in their games"
ON public.game_players
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM games g 
    WHERE g.id = game_players.game_id 
    AND g.host_user_id = auth.uid()
  )
);

-- DELETE: Host can remove players
CREATE POLICY "Host can remove players from their games"
ON public.game_players
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM games g 
    WHERE g.id = game_players.game_id 
    AND g.host_user_id = auth.uid()
  )
);