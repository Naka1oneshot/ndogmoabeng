-- Add admin RLS policies for lion_decks and lion_hands (missing!)
CREATE POLICY "Admins can manage lion_decks" 
ON public.lion_decks FOR ALL 
TO public 
USING (is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can manage lion_hands" 
ON public.lion_hands FOR ALL 
TO public 
USING (is_admin_or_super(auth.uid()));

-- Drop and recreate the function with proper bypassing of RLS
-- The SECURITY DEFINER runs as the function owner but still respects RLS
-- We need to explicitly bypass RLS by using the service role pattern
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

  -- Get all player_ids for this game (needed for lion FK cleanup)
  SELECT array_agg(id) INTO v_player_ids
  FROM game_players
  WHERE game_id = p_game_id;

  -- Delete LION game data using BOTH session_game_id AND player_ids to ensure complete cleanup
  IF v_session_game_ids IS NOT NULL AND array_length(v_session_game_ids, 1) > 0 THEN
    -- First delete lion_game_state (has FK to game_players via active_player_id, guesser_player_id)
    DELETE FROM lion_game_state WHERE session_game_id = ANY(v_session_game_ids);
    
    -- Then lion_turns (has FK to game_players)
    DELETE FROM lion_turns WHERE session_game_id = ANY(v_session_game_ids);
  END IF;
  
  -- Delete lion_hands and lion_decks by owner_player_id (more reliable than session_game_id)
  IF v_player_ids IS NOT NULL AND array_length(v_player_ids, 1) > 0 THEN
    DELETE FROM lion_hands WHERE owner_player_id = ANY(v_player_ids);
    DELETE FROM lion_decks WHERE owner_player_id = ANY(v_player_ids);
  END IF;

  -- Fallback: also try by session_game_id if any remain
  IF v_session_game_ids IS NOT NULL AND array_length(v_session_game_ids, 1) > 0 THEN
    DELETE FROM lion_hands WHERE session_game_id = ANY(v_session_game_ids);
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
  
  -- Now delete players (after all FK references are cleared)
  DELETE FROM game_players WHERE game_id = p_game_id;
  
  -- Delete session_games
  DELETE FROM session_games WHERE session_id = p_game_id;
  
  -- Finally delete the game itself
  DELETE FROM games WHERE id = p_game_id;

  RETURN true;
END;
$$;