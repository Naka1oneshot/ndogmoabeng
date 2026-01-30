
-- COMPLETE rewrite of the cascade delete function with ALL FK dependencies
DROP FUNCTION IF EXISTS public.admin_delete_game_cascade(uuid);

CREATE OR REPLACE FUNCTION public.admin_delete_game_cascade(p_game_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session_game_ids uuid[];
  v_player_ids uuid[];
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

  -- Get all player_ids for this game
  SELECT array_agg(id) INTO v_player_ids
  FROM game_players
  WHERE game_id = p_game_id;

  -- ============================================
  -- STEP 1: Delete ALL tables with FK to game_players
  -- ============================================
  
  IF v_player_ids IS NOT NULL AND array_length(v_player_ids, 1) > 0 THEN
    -- LION tables (order matters: state first, then turns, then hands/decks)
    DELETE FROM lion_game_state WHERE active_player_id = ANY(v_player_ids) OR guesser_player_id = ANY(v_player_ids) OR winner_player_id = ANY(v_player_ids);
    DELETE FROM lion_turns WHERE dealer_owner_player_id = ANY(v_player_ids) OR active_player_id = ANY(v_player_ids) OR guesser_player_id = ANY(v_player_ids);
    DELETE FROM lion_hands WHERE owner_player_id = ANY(v_player_ids);
    DELETE FROM lion_decks WHERE owner_player_id = ANY(v_player_ids);
    
    -- River tables
    DELETE FROM river_decisions WHERE player_id = ANY(v_player_ids);
    DELETE FROM river_player_stats WHERE player_id = ANY(v_player_ids);
    
    -- Sheriff tables
    DELETE FROM sheriff_player_choices WHERE player_id = ANY(v_player_ids);
    
    -- Adventure/Stage scores
    DELETE FROM stage_scores WHERE game_player_id = ANY(v_player_ids);
    DELETE FROM adventure_scores WHERE game_player_id = ANY(v_player_ids);
    
    -- Reconnect links
    DELETE FROM player_reconnect_links WHERE game_player_id = ANY(v_player_ids);
  END IF;

  -- ============================================
  -- STEP 2: Delete session-scoped data by session_game_id
  -- ============================================
  
  IF v_session_game_ids IS NOT NULL AND array_length(v_session_game_ids, 1) > 0 THEN
    -- Additional cleanup by session_game_id (fallback)
    DELETE FROM lion_game_state WHERE session_game_id = ANY(v_session_game_ids);
    DELETE FROM lion_turns WHERE session_game_id = ANY(v_session_game_ids);
    DELETE FROM lion_hands WHERE session_game_id = ANY(v_session_game_ids);
    DELETE FROM lion_decks WHERE session_game_id = ANY(v_session_game_ids);
  END IF;

  -- ============================================
  -- STEP 3: Delete game-scoped data by game_id
  -- ============================================
  
  -- Infection data
  DELETE FROM infection_shots WHERE game_id = p_game_id;
  DELETE FROM infection_inputs WHERE game_id = p_game_id;
  DELETE FROM infection_round_state WHERE game_id = p_game_id;
  DELETE FROM infection_chat_messages WHERE game_id = p_game_id;
  
  -- River session data
  DELETE FROM river_level_history WHERE game_id = p_game_id;
  DELETE FROM river_player_levels WHERE game_id = p_game_id;
  DELETE FROM river_session_state WHERE game_id = p_game_id;
  
  -- Forest/standard game data
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
  
  -- Logs
  DELETE FROM logs_joueurs WHERE game_id = p_game_id;
  DELETE FROM logs_mj WHERE game_id = p_game_id;
  DELETE FROM session_events WHERE game_id = p_game_id;
  
  -- Invitations
  DELETE FROM game_invitations WHERE game_id = p_game_id;

  -- ============================================
  -- STEP 4: Delete players (all FK refs are now cleared)
  -- ============================================
  DELETE FROM game_players WHERE game_id = p_game_id;
  
  -- ============================================
  -- STEP 5: Delete session_games
  -- ============================================
  DELETE FROM session_games WHERE session_id = p_game_id;
  
  -- ============================================
  -- STEP 6: Delete the game itself
  -- ============================================
  DELETE FROM games WHERE id = p_game_id;

  RETURN true;
END;
$$;
