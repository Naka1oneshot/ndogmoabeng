-- Add address and display name change tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS last_display_name_change TIMESTAMP WITH TIME ZONE;

-- Create function to check if display name can be changed (once per month)
CREATE OR REPLACE FUNCTION public.can_change_display_name(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT last_display_name_change < NOW() - INTERVAL '1 month' 
     FROM profiles 
     WHERE user_id = p_user_id),
    true
  );
$$;

-- Create function to get user game stats
CREATE OR REPLACE FUNCTION public.get_user_game_stats(p_user_id uuid)
RETURNS TABLE(
  games_played bigint,
  games_won bigint,
  games_created bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    (SELECT COUNT(*) FROM game_players gp 
     JOIN games g ON g.id = gp.game_id 
     WHERE gp.user_id = p_user_id 
     AND gp.is_host = false 
     AND g.status IN ('ENDED', 'FINISHED', 'ARCHIVED')),
    (SELECT COUNT(*) FROM game_players gp 
     JOIN games g ON g.id = gp.game_id 
     WHERE gp.user_id = p_user_id 
     AND gp.is_host = false 
     AND g.winner_declared = true
     AND gp.is_alive = true),
    (SELECT COUNT(*) FROM games WHERE host_user_id = p_user_id);
$$;