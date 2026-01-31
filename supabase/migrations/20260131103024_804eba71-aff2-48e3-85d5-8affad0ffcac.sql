-- =====================================================================
-- Function: get_adventure_finalists_scores
-- Returns Lion finalists and their scores for a completed adventure game
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_adventure_finalists_scores(
  p_game_id UUID,
  p_user_id UUID
)
RETURNS TABLE(
  adventure_game_id UUID,
  adventure_name TEXT,
  finalist_1_id UUID,
  finalist_1_name TEXT,
  finalist_1_score_total BIGINT,
  finalist_2_id UUID,
  finalist_2_name TEXT,
  finalist_2_score_total BIGINT,
  winner_player_id UUID,
  winner_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_participant BOOLEAN;
  v_adventure_id UUID;
  v_winner_declared BOOLEAN;
  v_lion_session_game_id UUID;
BEGIN
  -- Verify if p_user_id is a participant in this game (player or former player)
  SELECT EXISTS (
    SELECT 1
    FROM game_players
    WHERE game_id = p_game_id
      AND user_id = p_user_id
      AND is_host = false
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    -- User is not a participant, return empty
    RETURN;
  END IF;

  -- Get adventure info and check if game is adventure mode
  SELECT g.adventure_id, g.winner_declared
  INTO v_adventure_id, v_winner_declared
  FROM games g
  WHERE g.id = p_game_id;

  IF v_adventure_id IS NULL THEN
    -- Not an adventure game, return empty
    RETURN;
  END IF;

  -- Find the LION session_game for this adventure
  SELECT sg.id INTO v_lion_session_game_id
  FROM session_games sg
  WHERE sg.session_id = p_game_id
    AND sg.game_type_code = 'LION'
  ORDER BY sg.step_index DESC
  LIMIT 1;

  -- Get the 2 finalists (ACTIVE status players in Lion or top team by cumulative scores)
  RETURN QUERY
  WITH lion_finalists AS (
    -- First try: get players who were ACTIVE in Lion session
    SELECT 
      gp.id AS player_id,
      gp.display_name,
      gp.player_number,
      gp.mate_num,
      gp.pvic,
      COALESCE(ascore.total_score_value, 0)::BIGINT AS cumulative_score
    FROM game_players gp
    LEFT JOIN adventure_scores ascore 
      ON ascore.session_id = p_game_id 
      AND ascore.game_player_id = gp.id
    WHERE gp.game_id = p_game_id
      AND gp.is_host = false
      AND gp.removed_at IS NULL
    ORDER BY COALESCE(ascore.total_score_value, 0) DESC, gp.player_number ASC
    LIMIT 2
  ),
  -- Get lion_game_state winner if available
  lion_winner AS (
    SELECT lgs.winner_player_id
    FROM lion_game_state lgs
    WHERE lgs.session_game_id = v_lion_session_game_id
    LIMIT 1
  ),
  finalist_data AS (
    SELECT 
      array_agg(lf.player_id ORDER BY lf.cumulative_score DESC, lf.player_number ASC) AS finalist_ids,
      array_agg(lf.display_name ORDER BY lf.cumulative_score DESC, lf.player_number ASC) AS finalist_names,
      array_agg(lf.cumulative_score ORDER BY lf.cumulative_score DESC, lf.player_number ASC) AS finalist_scores
    FROM lion_finalists lf
  )
  SELECT 
    p_game_id AS adventure_game_id,
    g.name AS adventure_name,
    fd.finalist_ids[1] AS finalist_1_id,
    fd.finalist_names[1] AS finalist_1_name,
    fd.finalist_scores[1] AS finalist_1_score_total,
    fd.finalist_ids[2] AS finalist_2_id,
    fd.finalist_names[2] AS finalist_2_name,
    fd.finalist_scores[2] AS finalist_2_score_total,
    lw.winner_player_id,
    (SELECT gp2.display_name FROM game_players gp2 WHERE gp2.id = lw.winner_player_id) AS winner_name
  FROM games g
  CROSS JOIN finalist_data fd
  LEFT JOIN lion_winner lw ON true
  WHERE g.id = p_game_id
    AND array_length(fd.finalist_ids, 1) = 2;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_adventure_finalists_scores(UUID, UUID) TO authenticated;