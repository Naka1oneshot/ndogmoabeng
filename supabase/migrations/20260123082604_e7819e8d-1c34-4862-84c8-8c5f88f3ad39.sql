-- =============================================
-- Security Fix: Tighten RLS policies for sensitive tables
-- =============================================

-- 1. PROFILES TABLE: Create a view for limited friend profile data
-- Drop existing friend view policy and replace with more restrictive one
DROP POLICY IF EXISTS "Users can view accepted friends profiles" ON public.profiles;

-- Create a more restrictive policy: friends can only see display_name and avatar_url
-- Users can see their own full profile, admins can see all
CREATE POLICY "Users can view their own full profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view full profiles"
ON public.profiles
FOR SELECT
USING (public.is_admin_or_super(auth.uid()));

-- Create a database function to return limited friend profile data
CREATE OR REPLACE FUNCTION public.get_friend_limited_profile(p_friend_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    p.user_id,
    p.display_name,
    p.avatar_url
  FROM profiles p
  WHERE p.user_id = p_friend_user_id
    AND EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.addressee_id = p_friend_user_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = p_friend_user_id))
    );
$$;

-- 2. MEETUP_REGISTRATIONS: Allow users to view their own registrations by phone
-- Add a policy for users to view their own registrations
CREATE POLICY "Users can view their own registrations"
ON public.meetup_registrations
FOR SELECT
USING (
  -- Match by user phone if authenticated and profile has matching phone
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.phone IS NOT NULL
      AND p.phone = meetup_registrations.phone
  )
);

-- 3. ADMIN_AUDIT_LOG: Allow admins to view logs related to their own actions
DROP POLICY IF EXISTS "Super admins can view audit log" ON public.admin_audit_log;

CREATE POLICY "Super admins can view all audit logs"
ON public.admin_audit_log
FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can view their own audit logs"
ON public.admin_audit_log
FOR SELECT
USING (
  public.is_admin_or_super(auth.uid()) 
  AND performed_by = auth.uid()
);

-- 4. GAME_PLAYERS: Create a secure view function for public game data
-- The existing RLS is complex, so create a function for limited public access
CREATE OR REPLACE FUNCTION public.get_public_game_players(p_game_id uuid)
RETURNS TABLE(
  player_number integer,
  display_name text,
  clan text,
  is_alive boolean,
  is_bot boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    gp.player_number,
    gp.display_name,
    gp.clan,
    gp.is_alive,
    gp.is_bot
  FROM game_players gp
  JOIN games g ON g.id = gp.game_id
  WHERE gp.game_id = p_game_id
    AND gp.removed_at IS NULL
    AND gp.is_host = false
    AND g.is_public = true
  ORDER BY gp.player_number;
$$;

-- Create function for authenticated game participants to see more data
CREATE OR REPLACE FUNCTION public.get_game_players_for_participant(p_game_id uuid)
RETURNS TABLE(
  player_number integer,
  display_name text,
  clan text,
  is_alive boolean,
  is_bot boolean,
  jetons integer,
  recompenses integer,
  mate_num integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_is_host boolean;
  v_is_player boolean;
  v_has_invitation boolean;
BEGIN
  -- Check if user is the host
  SELECT EXISTS(
    SELECT 1 FROM games g WHERE g.id = p_game_id AND g.host_user_id = auth.uid()
  ) INTO v_is_host;
  
  -- Check if user is a player in this game
  SELECT EXISTS(
    SELECT 1 FROM game_players gp 
    WHERE gp.game_id = p_game_id 
      AND gp.user_id = auth.uid() 
      AND gp.removed_at IS NULL
  ) INTO v_is_player;
  
  -- Check if user has a pending invitation
  SELECT EXISTS(
    SELECT 1 FROM game_invitations gi 
    WHERE gi.game_id = p_game_id 
      AND gi.invited_user_id = auth.uid() 
      AND gi.status = 'pending'
  ) INTO v_has_invitation;
  
  IF NOT (v_is_host OR v_is_player OR v_has_invitation) THEN
    -- Not authorized - return empty
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    gp.player_number,
    gp.display_name,
    gp.clan,
    gp.is_alive,
    gp.is_bot,
    gp.jetons,
    gp.recompenses,
    gp.mate_num
  FROM game_players gp
  WHERE gp.game_id = p_game_id
    AND gp.removed_at IS NULL
    AND gp.is_host = false
  ORDER BY gp.player_number;
END;
$$;