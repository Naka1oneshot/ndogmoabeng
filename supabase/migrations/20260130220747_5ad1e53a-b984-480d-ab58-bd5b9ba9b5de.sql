-- Fix admin_delete_game_cascade with correct column names for each table
CREATE OR REPLACE FUNCTION public.admin_delete_game_cascade(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Nullify circular FK before deleting session_games
  UPDATE games SET current_session_game_id = NULL WHERE id = p_game_id;

  -- Delete Lion game data
  -- lion_turns, lion_hands, lion_decks use session_game_id FK
  -- session_games uses session_id to reference games.id
  DELETE FROM lion_turns WHERE session_game_id IN (SELECT id FROM session_games WHERE session_id = p_game_id);
  DELETE FROM lion_hands WHERE session_game_id IN (SELECT id FROM session_games WHERE session_id = p_game_id);
  DELETE FROM lion_decks WHERE session_game_id IN (SELECT id FROM session_games WHERE session_id = p_game_id);
  -- lion_game_state has both game_id and session_game_id columns
  DELETE FROM lion_game_state WHERE game_id = p_game_id;

  -- Delete adventure/stage scores
  DELETE FROM adventure_scores WHERE session_id = p_game_id;
  DELETE FROM adventure_game_configs WHERE game_id = p_game_id;
  -- stage_scores only has session_game_id, delete via session_games
  DELETE FROM stage_scores WHERE session_game_id IN (SELECT id FROM session_games WHERE session_id = p_game_id);

  -- Delete Infection game data (all have game_id column)
  DELETE FROM infection_shots WHERE game_id = p_game_id;
  DELETE FROM infection_inputs WHERE game_id = p_game_id;
  DELETE FROM infection_round_state WHERE game_id = p_game_id;
  DELETE FROM infection_chat_messages WHERE game_id = p_game_id;

  -- Delete Sheriff game data (all have game_id column)
  DELETE FROM sheriff_duels WHERE session_game_id IN (SELECT id FROM session_games WHERE session_id = p_game_id);
  DELETE FROM sheriff_player_choices WHERE game_id = p_game_id;
  DELETE FROM sheriff_round_state WHERE game_id = p_game_id;

  -- Delete River game data (all have game_id column)
  DELETE FROM river_level_history WHERE game_id = p_game_id;
  DELETE FROM river_session_state WHERE game_id = p_game_id;

  -- Delete session events (has game_id column)
  DELETE FROM session_events WHERE game_id = p_game_id;

  -- Delete session games (uses session_id to reference games.id)
  DELETE FROM session_games WHERE session_id = p_game_id;

  -- Delete game-related data (all have game_id column)
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
$function$;