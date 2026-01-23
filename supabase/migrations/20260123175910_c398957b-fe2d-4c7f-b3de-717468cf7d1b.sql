
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view game players" ON public.game_players;

-- Recreate SELECT policy with support for token-based players
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
  -- Authenticated players in the same game can view each other
  OR (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM game_players gp2 
    WHERE gp2.game_id = game_players.game_id 
    AND gp2.user_id = auth.uid()
  ))
  -- Public games are visible to all
  OR (EXISTS (
    SELECT 1 FROM games g
    WHERE g.id = game_players.game_id AND g.is_public = true
  ))
  -- Invited users can see game players
  OR (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM game_invitations gi
    WHERE gi.game_id = game_players.game_id 
    AND gi.invited_user_id = auth.uid() 
    AND gi.status = 'pending'
  ))
  -- Users can always see their own player entry
  OR (user_id = auth.uid())
  -- LOBBY games: all players in lobby can see each other (for waiting room)
  OR (EXISTS (
    SELECT 1 FROM games g
    WHERE g.id = game_players.game_id 
    AND g.status = 'LOBBY'
  ))
  -- IN_GAME: players with same game_id can see each other 
  OR (EXISTS (
    SELECT 1 FROM games g
    WHERE g.id = game_players.game_id 
    AND g.status = 'IN_GAME'
  ))
);
