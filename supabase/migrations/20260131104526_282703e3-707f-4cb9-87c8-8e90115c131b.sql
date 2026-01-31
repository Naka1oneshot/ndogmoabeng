-- Drop existing function first (return type changed from BIGINT to NUMERIC)
DROP FUNCTION IF EXISTS public.get_adventure_finalists_scores(UUID, UUID);

-- =====================================================================
-- Function: get_adventure_finalists_scores (FIXED v2)
-- Returns Lion finalists BY TEAM (mate_num pair), not individuals
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
  finalist_1_score_total NUMERIC,
  finalist_2_id UUID,
  finalist_2_name TEXT,
  finalist_2_score_total NUMERIC,
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
  v_lion_session_game_id UUID;
BEGIN
  -- Verify if p_user_id is a participant in this game (not host, not removed)
  SELECT EXISTS (
    SELECT 1
    FROM game_players
    WHERE game_id = p_game_id
      AND user_id = p_user_id
      AND is_host = false
      AND removed_at IS NULL
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    -- User is not a valid participant, return empty
    RETURN;
  END IF;

  -- Get adventure info and check if game is adventure mode
  SELECT g.adventure_id
  INTO v_adventure_id
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

  -- Get the finalists BY TEAM (mate_num pair)
  RETURN QUERY
  WITH eligible_players AS (
    -- A) Load game_players with filters
    SELECT 
      gp.id AS player_id,
      gp.display_name,
      gp.player_number,
      gp.mate_num,
      COALESCE(ascore.total_score_value, 0) AS cumulative_score
    FROM game_players gp
    LEFT JOIN adventure_scores ascore 
      ON ascore.session_id = p_game_id 
      AND ascore.game_player_id = gp.id
    WHERE gp.game_id = p_game_id
      AND gp.is_host = false
      AND gp.removed_at IS NULL
      AND gp.mate_num IS NOT NULL
  ),
  -- C) Build teams: pair (player_number, mate_num)
  teams AS (
    SELECT 
      LEAST(ep1.player_number, ep1.mate_num) AS team_key,
      ep1.player_id AS p1_id,
      ep1.display_name AS p1_name,
      ep1.player_number AS p1_num,
      ep1.cumulative_score AS p1_score,
      ep2.player_id AS p2_id,
      ep2.display_name AS p2_name,
      ep2.player_number AS p2_num,
      ep2.cumulative_score AS p2_score,
      (ep1.cumulative_score + ep2.cumulative_score) AS team_score
    FROM eligible_players ep1
    JOIN eligible_players ep2 
      ON ep1.mate_num = ep2.player_number 
      AND ep2.mate_num = ep1.player_number
    WHERE ep1.player_number < ep1.mate_num  -- Avoid duplicates, take only one side of the pair
  ),
  -- D) Select team #1 by score DESC, tie-break by smallest player_number
  top_team AS (
    SELECT * FROM teams
    ORDER BY team_score DESC, team_key ASC
    LIMIT 1
  ),
  -- F) Get lion_game_state winner if available
  lion_winner AS (
    SELECT lgs.winner_player_id
    FROM lion_game_state lgs
    WHERE lgs.session_game_id = v_lion_session_game_id
    LIMIT 1
  )
  -- E) Return the 2 players of this team as finalist_1 / finalist_2
  SELECT 
    p_game_id AS adventure_game_id,
    g.name AS adventure_name,
    tt.p1_id AS finalist_1_id,
    tt.p1_name AS finalist_1_name,
    tt.p1_score AS finalist_1_score_total,
    tt.p2_id AS finalist_2_id,
    tt.p2_name AS finalist_2_name,
    tt.p2_score AS finalist_2_score_total,
    lw.winner_player_id,
    (SELECT gp2.display_name FROM game_players gp2 WHERE gp2.id = lw.winner_player_id) AS winner_name
  FROM games g
  CROSS JOIN top_team tt
  LEFT JOIN lion_winner lw ON true
  WHERE g.id = p_game_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_adventure_finalists_scores(UUID, UUID) TO authenticated;