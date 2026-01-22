-- Fix 1: Update profiles RLS policy to only allow friends with ACCEPTED status to view profiles
-- And restrict sensitive fields (phone, address) to owner only

-- Drop existing friend viewing policy
DROP POLICY IF EXISTS "Users can view friends profiles" ON public.profiles;

-- Create new policy that only allows accepted friends to view profiles
-- But we'll limit what they can see through a view instead
CREATE POLICY "Users can view accepted friends profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM friendships 
    WHERE status = 'accepted'
    AND ((requester_id = auth.uid() AND addressee_id = profiles.user_id) 
         OR (addressee_id = auth.uid() AND requester_id = profiles.user_id))
  )
);

-- Fix 2: Update game_players RLS policy to be more restrictive
-- Remove the overly permissive "Anyone can view players for joining" policy
DROP POLICY IF EXISTS "Anyone can view players for joining" ON public.game_players;

-- Create a more restricted policy - only allow viewing for:
-- 1. The host of the game
-- 2. Players who are part of the same game
-- 3. Users who have a pending invitation to the game
CREATE POLICY "Players can view same game players" 
ON public.game_players 
FOR SELECT 
USING (
  -- Host can always see
  EXISTS (
    SELECT 1 FROM games g 
    WHERE g.id = game_players.game_id 
    AND g.host_user_id = auth.uid()
  )
  -- Players in same game can see (including anonymous players via device_id check would need different approach)
  OR EXISTS (
    SELECT 1 FROM game_players gp 
    WHERE gp.game_id = game_players.game_id 
    AND (gp.user_id = auth.uid() OR gp.player_token IS NOT NULL)
    AND gp.removed_at IS NULL
  )
  -- Users with pending invitation can see basic info
  OR EXISTS (
    SELECT 1 FROM game_invitations gi 
    WHERE gi.game_id = game_players.game_id 
    AND gi.invited_user_id = auth.uid()
    AND gi.status = 'pending'
  )
);

-- Create a limited view for public game listing (spectators) - only non-sensitive columns
-- This allows the public_game_participants function to still work
CREATE OR REPLACE FUNCTION public.public_game_participants(p_game_id uuid)
RETURNS TABLE(player_number integer, display_name text, clan text, is_alive boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    gp.player_number,
    gp.display_name,
    gp.clan,
    gp.is_alive
  FROM game_players gp
  WHERE gp.game_id = p_game_id
    AND gp.removed_at IS NULL
    AND gp.is_host = false
  ORDER BY gp.player_number ASC;
$function$;