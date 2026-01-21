-- Drop and recreate public_game_info function to include current_session_game_id
DROP FUNCTION IF EXISTS public_game_info(uuid);

CREATE FUNCTION public_game_info(p_game_id uuid)
RETURNS TABLE (
  game_id uuid,
  name text,
  status text,
  phase text,
  manche_active integer,
  mode text,
  game_type_code text,
  game_type_name text,
  current_step_index integer,
  player_count bigint,
  is_ended boolean,
  current_session_game_id uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    g.id AS game_id,
    g.name,
    g.status,
    g.phase,
    g.manche_active,
    g.mode,
    CASE 
      WHEN g.mode = 'ADVENTURE' AND g.current_session_game_id IS NOT NULL THEN
        (SELECT sg.game_type_code FROM session_games sg WHERE sg.id = g.current_session_game_id)
      ELSE g.selected_game_type_code
    END AS game_type_code,
    COALESCE(
      (SELECT gt.name FROM game_types gt WHERE gt.code = 
        CASE 
          WHEN g.mode = 'ADVENTURE' AND g.current_session_game_id IS NOT NULL THEN
            (SELECT sg.game_type_code FROM session_games sg WHERE sg.id = g.current_session_game_id)
          ELSE g.selected_game_type_code
        END
      ),
      'Non défini'
    ) AS game_type_name,
    g.current_step_index,
    (SELECT COUNT(*) FROM game_players gp WHERE gp.game_id = g.id AND gp.removed_at IS NULL AND gp.is_host = false) AS player_count,
    (g.status IN ('ENDED', 'FINISHED', 'ARCHIVED') OR g.winner_declared = true) AS is_ended,
    g.current_session_game_id
  FROM games g
  WHERE g.id = p_game_id;
$$;