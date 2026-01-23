
-- Create RPC function to get public profile data (no sensitive info)
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  games_played integer,
  games_won integer,
  total_rewards integer,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.user_id,
    p.display_name,
    p.avatar_url,
    COALESCE(p.games_played, 0)::integer,
    COALESCE(p.games_won, 0)::integer,
    COALESCE(p.total_rewards, 0)::integer,
    p.created_at
  FROM profiles p
  WHERE p.user_id = p_user_id;
$$;

-- Create RPC function to get public game history (limited info)
CREATE OR REPLACE FUNCTION public.get_public_game_history(p_user_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE(
  game_id uuid,
  game_name text,
  game_type_code text,
  game_type_name text,
  played_at timestamp with time zone,
  result text,
  player_display_name text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id AS game_id,
    g.name AS game_name,
    COALESCE(g.selected_game_type_code, 'unknown') AS game_type_code,
    COALESCE(gt.name, 'Inconnu') AS game_type_name,
    g.created_at AS played_at,
    CASE 
      WHEN g.winner_declared AND gp.is_alive = true THEN 'won'
      WHEN g.winner_declared AND gp.is_alive = false THEN 'lost'
      ELSE 'played'
    END AS result,
    gp.display_name AS player_display_name
  FROM games g
  JOIN game_players gp ON gp.game_id = g.id AND gp.user_id = p_user_id AND gp.is_host = false
  LEFT JOIN game_types gt ON gt.code = g.selected_game_type_code
  WHERE g.status IN ('ENDED', 'FINISHED', 'ARCHIVED')
  ORDER BY g.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Create RPC function to compare with any user (not just friends)
CREATE OR REPLACE FUNCTION public.get_public_comparison(p_target_user_id uuid)
RETURNS TABLE(
  my_games_played bigint,
  my_games_won bigint,
  target_games_played bigint,
  target_games_won bigint,
  games_together bigint,
  my_wins_together bigint,
  target_wins_together bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_my_id uuid := auth.uid();
BEGIN
  IF v_my_id IS NULL THEN
    -- Return empty if not authenticated
    RETURN QUERY SELECT 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  RETURN QUERY
  WITH my_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE g.status IN ('ENDED', 'FINISHED', 'ARCHIVED')) AS games_played,
      COUNT(*) FILTER (WHERE g.winner_declared = true AND gp.is_alive = true) AS games_won
    FROM game_players gp
    JOIN games g ON g.id = gp.game_id
    WHERE gp.user_id = v_my_id AND gp.is_host = false
  ),
  target_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE g.status IN ('ENDED', 'FINISHED', 'ARCHIVED')) AS games_played,
      COUNT(*) FILTER (WHERE g.winner_declared = true AND gp.is_alive = true) AS games_won
    FROM game_players gp
    JOIN games g ON g.id = gp.game_id
    WHERE gp.user_id = p_target_user_id AND gp.is_host = false
  ),
  together_stats AS (
    SELECT 
      COUNT(DISTINCT g.id) AS games_together,
      COUNT(DISTINCT g.id) FILTER (
        WHERE g.winner_declared = true 
        AND EXISTS (
          SELECT 1 FROM game_players gp2 
          WHERE gp2.game_id = g.id AND gp2.user_id = v_my_id AND gp2.is_alive = true
        )
      ) AS my_wins,
      COUNT(DISTINCT g.id) FILTER (
        WHERE g.winner_declared = true 
        AND EXISTS (
          SELECT 1 FROM game_players gp2 
          WHERE gp2.game_id = g.id AND gp2.user_id = p_target_user_id AND gp2.is_alive = true
        )
      ) AS target_wins
    FROM games g
    WHERE g.status IN ('ENDED', 'FINISHED', 'ARCHIVED')
      AND EXISTS (SELECT 1 FROM game_players gp1 WHERE gp1.game_id = g.id AND gp1.user_id = v_my_id AND gp1.is_host = false)
      AND EXISTS (SELECT 1 FROM game_players gp2 WHERE gp2.game_id = g.id AND gp2.user_id = p_target_user_id AND gp2.is_host = false)
  )
  SELECT 
    ms.games_played,
    ms.games_won,
    ts.games_played,
    ts.games_won,
    tgs.games_together,
    tgs.my_wins,
    tgs.target_wins
  FROM my_stats ms, target_stats ts, together_stats tgs;
END;
$$;
