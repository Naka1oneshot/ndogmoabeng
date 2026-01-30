-- Create a function to cascade delete a game and all its related data
-- This bypasses RLS for proper cleanup
CREATE OR REPLACE FUNCTION public.admin_delete_game_cascade(p_game_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session_game_ids uuid[];
BEGIN
  -- Only allow admins or the host to delete
  IF NOT (
    is_admin_or_super(auth.uid()) 
    OR EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND host_user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins or host can delete this game';
  END IF;

  -- Get all session_game_ids for this game
  SELECT array_agg(id) INTO v_session_game_ids
  FROM session_games
  WHERE session_id = p_game_id;

  -- Delete LION game data (order matters due to FK constraints)
  IF v_session_game_ids IS NOT NULL THEN
    -- First delete lion_game_state (has FK to game_players)
    DELETE FROM lion_game_state WHERE session_game_id = ANY(v_session_game_ids);
    -- Then lion_turns (has FK to game_players)
    DELETE FROM lion_turns WHERE session_game_id = ANY(v_session_game_ids);
    -- Then lion_hands (has FK to game_players)
    DELETE FROM lion_hands WHERE session_game_id = ANY(v_session_game_ids);
    -- Then lion_decks (has FK to game_players)
    DELETE FROM lion_decks WHERE session_game_id = ANY(v_session_game_ids);
  END IF;

  -- Delete other session-scoped data
  DELETE FROM infection_shots WHERE game_id = p_game_id;
  DELETE FROM infection_inputs WHERE game_id = p_game_id;
  DELETE FROM infection_round_state WHERE game_id = p_game_id;
  DELETE FROM infection_chat_messages WHERE game_id = p_game_id;
  
  -- Delete river data
  DELETE FROM river_level_history WHERE game_id = p_game_id;
  DELETE FROM river_player_levels WHERE game_id = p_game_id;
  DELETE FROM river_session_state WHERE game_id = p_game_id;
  
  -- Delete forest/standard game data
  DELETE FROM combat_results WHERE game_id = p_game_id;
  DELETE FROM game_events WHERE game_id = p_game_id;
  DELETE FROM game_item_purchases WHERE game_id = p_game_id;
  DELETE FROM game_shop_offers WHERE game_id = p_game_id;
  DELETE FROM game_state_monsters WHERE game_id = p_game_id;
  DELETE FROM game_monsters WHERE game_id = p_game_id;
  DELETE FROM actions WHERE game_id = p_game_id;
  DELETE FROM inventory WHERE game_id = p_game_id;
  DELETE FROM battlefield WHERE game_id = p_game_id;
  DELETE FROM combat_config WHERE game_id = p_game_id;
  DELETE FROM adventure_scores WHERE session_id = p_game_id;
  
  -- Delete logs
  DELETE FROM logs_joueurs WHERE game_id = p_game_id;
  DELETE FROM logs_mj WHERE game_id = p_game_id;
  DELETE FROM session_events WHERE game_id = p_game_id;
  
  -- Delete invitations
  DELETE FROM game_invitations WHERE game_id = p_game_id;
  
  -- Delete players (after all FK references are cleared)
  DELETE FROM game_players WHERE game_id = p_game_id;
  
  -- Delete session_games
  DELETE FROM session_games WHERE session_id = p_game_id;
  
  -- Finally delete the game itself
  DELETE FROM games WHERE id = p_game_id;

  RETURN true;
END;
$$;