-- Add statistics columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS games_played integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS games_won integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_kills integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_rewards integer NOT NULL DEFAULT 0;

-- Create a function to update player stats when a game ends
CREATE OR REPLACE FUNCTION public.update_player_stats_on_game_end(
  p_game_id uuid,
  p_winner_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  player_record RECORD;
BEGIN
  -- Get all human players (with user_id) from the game
  FOR player_record IN 
    SELECT 
      gp.user_id,
      gp.recompenses,
      COALESCE((
        SELECT COUNT(*) 
        FROM combat_results cr 
        WHERE cr.game_id = p_game_id
        AND jsonb_array_length(cr.kills) > 0
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(cr.kills) AS k
          WHERE (k->>'killerNum')::int = gp.player_number
        )
      ), 0) as kill_count
    FROM game_players gp
    WHERE gp.game_id = p_game_id 
    AND gp.user_id IS NOT NULL
    AND gp.status = 'ACTIVE'
  LOOP
    -- Update profile stats
    UPDATE profiles
    SET 
      games_played = games_played + 1,
      games_won = CASE 
        WHEN player_record.user_id = p_winner_user_id THEN games_won + 1 
        ELSE games_won 
      END,
      total_rewards = total_rewards + COALESCE(player_record.recompenses, 0),
      updated_at = now()
    WHERE user_id = player_record.user_id;
  END LOOP;
END;
$$;