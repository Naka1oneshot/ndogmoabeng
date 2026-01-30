
-- Drop and recreate the function with proper atomic swap logic
CREATE OR REPLACE FUNCTION public.swap_player_numbers(p_game_id uuid, p_player_id uuid, p_new_number integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_number int;
  v_existing_player_id uuid;
  v_result jsonb;
BEGIN
  -- Get current player number
  SELECT player_number INTO v_current_number
  FROM game_players
  WHERE id = p_player_id AND game_id = p_game_id;
  
  IF v_current_number IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;
  
  IF v_current_number = p_new_number THEN
    RETURN jsonb_build_object('success', true, 'message', 'No change needed');
  END IF;
  
  -- Check if new number is already taken
  SELECT id INTO v_existing_player_id
  FROM game_players
  WHERE game_id = p_game_id 
    AND player_number = p_new_number
    AND removed_at IS NULL;
  
  IF v_existing_player_id IS NOT NULL THEN
    -- Use a temporary negative number to avoid unique constraint violation
    -- Step 1: Move the existing player to a temp number (-1)
    UPDATE game_players
    SET player_number = -1
    WHERE id = v_existing_player_id;
    
    -- Step 2: Assign new number to target player
    UPDATE game_players
    SET player_number = p_new_number
    WHERE id = p_player_id;
    
    -- Step 3: Give the existing player the old number
    UPDATE game_players
    SET player_number = v_current_number
    WHERE id = v_existing_player_id;
  ELSE
    -- No conflict, just update directly
    UPDATE game_players
    SET player_number = p_new_number
    WHERE id = p_player_id;
  END IF;
  
  -- Recalculate mate_num based on pairs (1-2, 3-4, 5-6, etc.)
  UPDATE game_players gp
  SET mate_num = CASE 
    WHEN gp.player_number % 2 = 1 THEN gp.player_number + 1
    ELSE gp.player_number - 1
  END
  WHERE gp.game_id = p_game_id
    AND gp.removed_at IS NULL
    AND gp.player_number IS NOT NULL
    AND gp.player_number > 0;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', CASE WHEN v_existing_player_id IS NOT NULL 
      THEN format('Échange: J%s ↔ J%s', v_current_number, p_new_number)
      ELSE 'Numéro mis à jour' 
    END,
    'old_number', v_current_number,
    'new_number', p_new_number,
    'swapped_with', v_existing_player_id
  );
END;
$function$;
