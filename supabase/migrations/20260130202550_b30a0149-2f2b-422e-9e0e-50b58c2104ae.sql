-- Drop and recreate admin_delete_game_cascade with correct Sheriff tables
DROP FUNCTION IF EXISTS public.admin_delete_game_cascade(uuid);

CREATE OR REPLACE FUNCTION public.admin_delete_game_cascade(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nullify circular FK before deleting session_games
  UPDATE games SET current_session_game_id = NULL WHERE id = p_game_id;

  -- Delete Lion game data
  DELETE FROM lion_hands WHERE session_game_id IN (SELECT id FROM session_games WHERE game_id = p_game_id);
  DELETE FROM lion_decks WHERE session_game_id IN (SELECT id FROM session_games WHERE game_id = p_game_id);
  DELETE FROM lion_game_state WHERE game_id = p_game_id;

  -- Delete adventure scores
  DELETE FROM adventure_scores WHERE session_id = p_game_id;

  -- Delete Infection game data
  DELETE FROM infection_shots WHERE game_id = p_game_id;
  DELETE FROM infection_inputs WHERE game_id = p_game_id;
  DELETE FROM infection_round_state WHERE game_id = p_game_id;
  DELETE FROM infection_chat_messages WHERE game_id = p_game_id;

  -- Delete Sheriff game data (correct tables)
  DELETE FROM sheriff_duels WHERE session_game_id IN (SELECT id FROM session_games WHERE game_id = p_game_id);
  DELETE FROM sheriff_player_choices WHERE game_id = p_game_id;
  DELETE FROM sheriff_round_state WHERE game_id = p_game_id;

  -- Delete River game data
  DELETE FROM river_level_history WHERE game_id = p_game_id;
  DELETE FROM river_session_state WHERE game_id = p_game_id;

  -- Delete session events
  DELETE FROM session_events WHERE game_id = p_game_id;

  -- Delete session games
  DELETE FROM session_games WHERE game_id = p_game_id;

  -- Delete game-related data
  DELETE FROM game_events WHERE game_id = p_game_id;
  DELETE FROM game_item_purchases WHERE game_id = p_game_id;
  DELETE FROM game_shop_offers WHERE game_id = p_game_id;
  DELETE FROM game_state_monsters WHERE game_id = p_game_id;
  DELETE FROM game_monsters WHERE game_id = p_game_id;
  DELETE FROM combat_results WHERE game_id = p_game_id;
  DELETE FROM combat_config WHERE game_id = p_game_id;
  DELETE FROM battlefield WHERE game_id = p_game_id;
  DELETE FROM inventory WHERE game_id = p_game_id;
  DELETE FROM actions WHERE game_id = p_game_id;
  DELETE FROM game_invitations WHERE game_id = p_game_id;
  DELETE FROM game_players WHERE game_id = p_game_id;

  -- Finally delete the game
  DELETE FROM games WHERE id = p_game_id;
END;
$$;