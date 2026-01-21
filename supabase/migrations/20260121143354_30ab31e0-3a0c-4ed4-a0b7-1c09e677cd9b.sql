-- Function to get user's completed games history
CREATE OR REPLACE FUNCTION public.get_user_game_history(p_user_id uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS TABLE(
  game_id uuid,
  game_name text,
  game_type_code text,
  game_type_name text,
  mode text,
  played_at timestamp with time zone,
  ended_at timestamp with time zone,
  was_host boolean,
  player_count bigint,
  my_jetons integer,
  my_recompenses integer,
  my_kills integer,
  my_result text,
  my_team_mate text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_total bigint;
BEGIN
  -- Get total count first
  SELECT COUNT(DISTINCT g.id) INTO v_total
  FROM games g
  JOIN game_players gp ON gp.game_id = g.id
  WHERE gp.user_id = p_user_id
    AND gp.is_host = false
    AND g.status IN ('ENDED', 'FINISHED', 'ARCHIVED');

  RETURN QUERY
  SELECT 
    g.id AS game_id,
    g.name AS game_name,
    COALESCE(g.selected_game_type_code, 'unknown') AS game_type_code,
    COALESCE(gt.name, 'Inconnu') AS game_type_name,
    g.mode,
    g.created_at AS played_at,
    COALESCE(
      (SELECT MAX(sg.ended_at) FROM session_games sg WHERE sg.session_id = g.id),
      g.created_at + interval '2 hours'
    ) AS ended_at,
    EXISTS(SELECT 1 FROM games g2 WHERE g2.id = g.id AND g2.host_user_id = p_user_id) AS was_host,
    (SELECT COUNT(*) FROM game_players gp2 WHERE gp2.game_id = g.id AND gp2.removed_at IS NULL AND gp2.is_host = false) AS player_count,
    COALESCE(gp.jetons, 0)::integer AS my_jetons,
    COALESCE(gp.recompenses, 0)::integer AS my_recompenses,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM combat_results cr
      WHERE cr.game_id = g.id
      AND jsonb_array_length(cr.kills) > 0
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(cr.kills) AS k
        WHERE (k->>'killerNum')::int = gp.player_number
      )
    ), 0)::integer AS my_kills,
    CASE 
      WHEN g.winner_declared AND gp.is_alive = true THEN 'won'
      WHEN g.winner_declared AND gp.is_alive = false THEN 'lost'
      ELSE 'played'
    END AS my_result,
    (SELECT gp3.display_name FROM game_players gp3 
     WHERE gp3.game_id = g.id AND gp3.player_number = gp.mate_num 
     LIMIT 1) AS my_team_mate,
    v_total AS total_count
  FROM games g
  JOIN game_players gp ON gp.game_id = g.id AND gp.user_id = p_user_id AND gp.is_host = false
  LEFT JOIN game_types gt ON gt.code = g.selected_game_type_code
  WHERE g.status IN ('ENDED', 'FINISHED', 'ARCHIVED')
  ORDER BY g.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;