-- Drop and recreate get_public_profile RPC to include clan affinity fields
DROP FUNCTION IF EXISTS public.get_public_profile(UUID);

CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  games_played BIGINT,
  games_won BIGINT,
  total_rewards BIGINT,
  created_at TIMESTAMPTZ,
  clan_affinity_id TEXT,
  clan_affinity_scores JSONB,
  clan_affinity_completed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.display_name,
    p.avatar_url,
    COALESCE(p.games_played, 0)::BIGINT,
    COALESCE(p.games_won, 0)::BIGINT,
    COALESCE(p.total_rewards, 0)::BIGINT,
    p.created_at,
    p.clan_affinity_id,
    p.clan_affinity_scores,
    p.clan_affinity_completed_at
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;