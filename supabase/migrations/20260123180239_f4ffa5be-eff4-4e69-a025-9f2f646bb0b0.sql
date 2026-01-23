
-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view game players" ON public.game_players;

-- Create a simpler non-recursive SELECT policy
-- For game_players visibility, we use simpler conditions that don't self-reference
CREATE POLICY "Users can view game players" 
ON public.game_players 
FOR SELECT 
USING (
  -- Host can view all their game's players
  (EXISTS (
    SELECT 1 FROM games g
    WHERE g.id = game_players.game_id AND g.host_user_id = auth.uid()
  ))
  -- Admins can view all players
  OR is_admin_or_super(auth.uid())
  -- User's own entry
  OR (user_id IS NOT NULL AND user_id = auth.uid())
  -- Public games are visible to all
  OR (EXISTS (
    SELECT 1 FROM games g
    WHERE g.id = game_players.game_id AND g.is_public = true
  ))
  -- LOBBY or IN_GAME status games: visible to anyone (for waiting room and gameplay)
  OR (EXISTS (
    SELECT 1 FROM games g
    WHERE g.id = game_players.game_id 
    AND g.status IN ('LOBBY', 'IN_GAME')
  ))
);
