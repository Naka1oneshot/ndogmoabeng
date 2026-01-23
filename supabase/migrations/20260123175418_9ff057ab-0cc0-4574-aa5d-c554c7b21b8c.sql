
-- Drop existing restrictive policies on game_players that block admins
DROP POLICY IF EXISTS "Host can add players to their games" ON public.game_players;
DROP POLICY IF EXISTS "Host can update players in their games" ON public.game_players;
DROP POLICY IF EXISTS "Host can remove players from their games" ON public.game_players;
DROP POLICY IF EXISTS "Host can view all players in their games" ON public.game_players;
DROP POLICY IF EXISTS "Players can view same game players" ON public.game_players;

-- Recreate policies with admin access included

-- INSERT: Host OR Admin can add players
CREATE POLICY "Host or admin can add players" 
ON public.game_players 
FOR INSERT 
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM games g
    WHERE g.id = game_players.game_id AND g.host_user_id = auth.uid()
  ))
  OR is_admin_or_super(auth.uid())
  OR ((user_id IS NULL) AND (player_token IS NOT NULL))
);

-- UPDATE: Host OR Admin can update players
CREATE POLICY "Host or admin can update players" 
ON public.game_players 
FOR UPDATE 
USING (
  (EXISTS (
    SELECT 1 FROM games g
    WHERE g.id = game_players.game_id AND g.host_user_id = auth.uid()
  ))
  OR is_admin_or_super(auth.uid())
);

-- DELETE: Host OR Admin can remove players
CREATE POLICY "Host or admin can remove players" 
ON public.game_players 
FOR DELETE 
USING (
  (EXISTS (
    SELECT 1 FROM games g
    WHERE g.id = game_players.game_id AND g.host_user_id = auth.uid()
  ))
  OR is_admin_or_super(auth.uid())
);

-- SELECT: Multiple scenarios for viewing players
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
  -- Players in the same game can view each other
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
);
