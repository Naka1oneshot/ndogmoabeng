-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Players can view same game players" ON public.game_players;

-- Recreate the policy without self-referencing game_players table
-- Use a simpler approach: players can view if they are in the same game via their user_id or token
CREATE POLICY "Players can view same game players" 
ON public.game_players 
FOR SELECT 
USING (
  -- Host can always view
  EXISTS (
    SELECT 1 FROM games g 
    WHERE g.id = game_players.game_id 
    AND g.host_user_id = auth.uid()
  )
  OR
  -- User is authenticated and is a player in this game (check via user_id directly on same row pattern)
  (
    auth.uid() IS NOT NULL 
    AND game_id IN (
      SELECT g.id FROM games g 
      WHERE g.id = game_players.game_id
      AND (
        -- Check if user is the host
        g.host_user_id = auth.uid()
        OR
        -- Check if user has a pending invitation
        EXISTS (
          SELECT 1 FROM game_invitations gi 
          WHERE gi.game_id = g.id 
          AND gi.invited_user_id = auth.uid() 
          AND gi.status = 'pending'
        )
      )
    )
  )
  OR
  -- Anonymous players with valid token can view their own game
  -- This is handled via a simpler direct check - if public games, allow reading
  EXISTS (
    SELECT 1 FROM games g 
    WHERE g.id = game_players.game_id 
    AND g.is_public = true
  )
  OR
  -- Authenticated users who are players in the game (using user_id match)
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
);