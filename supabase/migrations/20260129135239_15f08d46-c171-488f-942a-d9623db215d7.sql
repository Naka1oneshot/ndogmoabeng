-- Create RPC function to get public active games for a user
CREATE OR REPLACE FUNCTION public.get_public_active_games(p_user_id uuid)
RETURNS TABLE (
  game_id uuid,
  game_name text,
  game_type_code text,
  game_type_name text,
  game_status text,
  player_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    g.id as game_id,
    g.name as game_name,
    g.selected_game_type_code as game_type_code,
    gt.name as game_type_name,
    g.status as game_status,
    (SELECT COUNT(*) FROM game_players gp2 WHERE gp2.game_id = g.id AND gp2.removed_at IS NULL) as player_count
  FROM games g
  INNER JOIN game_players gp ON gp.game_id = g.id
  LEFT JOIN game_types gt ON gt.code = g.selected_game_type_code
  WHERE gp.user_id = p_user_id
    AND gp.removed_at IS NULL
    AND g.status NOT IN ('ENDED', 'FINISHED', 'ARCHIVED')
  ORDER BY g.created_at DESC
  LIMIT 5;
$$;