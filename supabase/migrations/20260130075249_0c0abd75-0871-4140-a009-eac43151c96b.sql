-- SOLUTION DÉFINITIVE: Supprimer et recréer la fonction avec SET ROLE pour bypasser complètement RLS

DROP FUNCTION IF EXISTS public.admin_delete_game_cascade(uuid);

CREATE OR REPLACE FUNCTION public.admin_delete_game_cascade(p_game_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_game_ids uuid[];
  v_player_ids uuid[];
  v_is_authorized boolean;
BEGIN
  -- Check authorization FIRST (before any other operation)
  SELECT (
    is_admin_or_super(auth.uid()) 
    OR EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND host_user_id = auth.uid())
  ) INTO v_is_authorized;
  
  IF NOT v_is_authorized THEN
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
  -- STEP 1: Delete LION tables FIRST (most restrictive FK constraints)
  -- Use session_game_id approach which is more reliable
  -- ============================================
  
  IF v_session_game_ids IS NOT NULL AND array_length(v_session_game_ids, 1) > 0 THEN
    -- Delete lion_game_state first (has FK to game_players)
    DELETE FROM lion_game_state WHERE session_game_id = ANY(v_session_game_ids);
    
    -- Delete lion_turns (has FK to game_players)
    DELETE FROM lion_turns WHERE session_game_id = ANY(v_session_game_ids);
    
    -- Delete lion_hands (has FK to game_players)
    DELETE FROM lion_hands WHERE session_game_id = ANY(v_session_game_ids);
    
    -- Delete lion_decks (has FK to game_players)
    DELETE FROM lion_decks WHERE session_game_id = ANY(v_session_game_ids);
  END IF;

  -- Also delete by player_ids as fallback (in case session_game_id is NULL)
  IF v_player_ids IS NOT NULL AND array_length(v_player_ids, 1) > 0 THEN
    DELETE FROM lion_game_state WHERE active_player_id = ANY(v_player_ids);
    DELETE FROM lion_game_state WHERE guesser_player_id = ANY(v_player_ids);
    DELETE FROM lion_game_state WHERE winner_player_id = ANY(v_player_ids);
    DELETE FROM lion_turns WHERE dealer_owner_player_id = ANY(v_player_ids);
    DELETE FROM lion_turns WHERE active_player_id = ANY(v_player_ids);
    DELETE FROM lion_turns WHERE guesser_player_id = ANY(v_player_ids);
    DELETE FROM lion_hands WHERE owner_player_id = ANY(v_player_ids);
    DELETE FROM lion_decks WHERE owner_player_id = ANY(v_player_ids);
    
    -- Other player-dependent tables
    DELETE FROM river_decisions WHERE player_id = ANY(v_player_ids);
    DELETE FROM river_player_stats WHERE player_id = ANY(v_player_ids);
    DELETE FROM sheriff_player_choices WHERE player_id = ANY(v_player_ids);
    DELETE FROM stage_scores WHERE game_player_id = ANY(v_player_ids);
    DELETE FROM adventure_scores WHERE game_player_id = ANY(v_player_ids);
    DELETE FROM player_reconnect_links WHERE game_player_id = ANY(v_player_ids);
  END IF;

  -- ============================================
  -- STEP 2: Delete session-scoped data
  -- ============================================
  IF v_session_game_ids IS NOT NULL AND array_length(v_session_game_ids, 1) > 0 THEN
    DELETE FROM infection_chat_messages WHERE session_game_id = ANY(v_session_game_ids);
    DELETE FROM infection_inputs WHERE session_game_id = ANY(v_session_game_ids);
    DELETE FROM infection_round_state WHERE session_game_id = ANY(v_session_game_ids);
    DELETE FROM infection_shots WHERE session_game_id = ANY(v_session_game_ids);
  END IF;

  -- ============================================
  -- STEP 3: Delete game-scoped data by game_id
  -- ============================================
  DELETE FROM infection_shots WHERE game_id = p_game_id;
  DELETE FROM infection_inputs WHERE game_id = p_game_id;
  DELETE FROM infection_round_state WHERE game_id = p_game_id;
  DELETE FROM infection_chat_messages WHERE game_id = p_game_id;
  DELETE FROM river_level_history WHERE game_id = p_game_id;
  DELETE FROM river_player_levels WHERE game_id = p_game_id;
  DELETE FROM river_session_state WHERE game_id = p_game_id;
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
  DELETE FROM logs_joueurs WHERE game_id = p_game_id;
  DELETE FROM logs_mj WHERE game_id = p_game_id;
  DELETE FROM session_events WHERE game_id = p_game_id;
  DELETE FROM game_invitations WHERE game_id = p_game_id;

  -- ============================================
  -- STEP 4: Clear current_session_game_id on games table to avoid FK issue
  -- ============================================
  UPDATE games SET current_session_game_id = NULL WHERE id = p_game_id;

  -- ============================================
  -- STEP 5: Delete players (all FK refs are now cleared)
  -- ============================================
  DELETE FROM game_players WHERE game_id = p_game_id;
  
  -- ============================================
  -- STEP 6: Delete session_games
  -- ============================================
  DELETE FROM session_games WHERE session_id = p_game_id;
  
  -- ============================================
  -- STEP 7: Delete the game itself
  -- ============================================
  DELETE FROM games WHERE id = p_game_id;

  RETURN true;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.admin_delete_game_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_game_cascade(uuid) TO service_role;