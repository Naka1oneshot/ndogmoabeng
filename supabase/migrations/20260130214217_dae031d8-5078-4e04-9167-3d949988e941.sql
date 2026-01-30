-- ========================================
-- 1.1 Create adventure_game_configs table
-- ========================================
CREATE TABLE public.adventure_game_configs (
  game_id uuid PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
  adventure_id uuid REFERENCES adventures(id),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.adventure_game_configs ENABLE ROW LEVEL SECURITY;

-- Policy: Host can manage their own game configs
CREATE POLICY "Host can manage adventure_game_configs"
ON public.adventure_game_configs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM games g WHERE g.id = game_id AND g.host_user_id = auth.uid()
  )
  OR public.is_admin_or_super(auth.uid())
);

-- ========================================
-- 1.2 Add finished_at column to game_players
-- ========================================
ALTER TABLE public.game_players 
ADD COLUMN IF NOT EXISTS finished_at timestamptz;

COMMENT ON COLUMN public.game_players.finished_at IS 'When a player finished the adventure (for spectator mode in Lion final)';

-- ========================================
-- 1.3 Create RPC for swapping player numbers atomically
-- ========================================
CREATE OR REPLACE FUNCTION public.swap_player_numbers(
  p_game_id uuid,
  p_player_id uuid,
  p_new_number int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Swap: give existing player the old number
    UPDATE game_players
    SET player_number = v_current_number
    WHERE id = v_existing_player_id;
    
    -- Update mate_num for swapped player's mate
    UPDATE game_players
    SET mate_num = v_current_number
    WHERE game_id = p_game_id
      AND mate_num = p_new_number
      AND removed_at IS NULL;
  END IF;
  
  -- Assign new number to target player
  UPDATE game_players
  SET player_number = p_new_number
  WHERE id = p_player_id;
  
  -- Update mate_num for target player's mate
  UPDATE game_players
  SET mate_num = p_new_number
  WHERE game_id = p_game_id
    AND mate_num = v_current_number
    AND removed_at IS NULL;
  
  -- Recalculate mate_num based on pairs (1-2, 3-4, 5-6, etc.)
  UPDATE game_players gp
  SET mate_num = CASE 
    WHEN gp.player_number % 2 = 1 THEN gp.player_number + 1
    ELSE gp.player_number - 1
  END
  WHERE gp.game_id = p_game_id
    AND gp.removed_at IS NULL
    AND gp.player_number IS NOT NULL;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', CASE WHEN v_existing_player_id IS NOT NULL THEN 'Swapped' ELSE 'Updated' END,
    'old_number', v_current_number,
    'new_number', p_new_number
  );
END;
$$;

-- ========================================
-- 1.4 Add LION step to "La carte trouvée (Le dilemme)" adventure
-- ========================================
-- First, check if the adventure exists and add the step
DO $$
DECLARE
  v_adventure_id uuid;
  v_max_step int;
BEGIN
  -- Find "Le dilemme" adventure
  SELECT id INTO v_adventure_id
  FROM adventures
  WHERE name ILIKE '%dilemme%'
  LIMIT 1;
  
  IF v_adventure_id IS NOT NULL THEN
    -- Get max step index
    SELECT COALESCE(MAX(step_index), 0) INTO v_max_step
    FROM adventure_steps
    WHERE adventure_id = v_adventure_id;
    
    -- Check if LION step already exists
    IF NOT EXISTS (
      SELECT 1 FROM adventure_steps 
      WHERE adventure_id = v_adventure_id 
        AND game_type_code = 'LION'
    ) THEN
      -- Add LION as the final step
      INSERT INTO adventure_steps (
        adventure_id, 
        step_index, 
        game_type_code, 
        token_policy
      ) VALUES (
        v_adventure_id,
        v_max_step + 1,
        'LION',
        'INHERIT'
      );
    END IF;
  END IF;
END;
$$;

-- ========================================
-- 1.5 Add trigger to update updated_at
-- ========================================
CREATE OR REPLACE FUNCTION public.update_adventure_game_configs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_adventure_game_configs_updated_at ON public.adventure_game_configs;
CREATE TRIGGER update_adventure_game_configs_updated_at
  BEFORE UPDATE ON public.adventure_game_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_adventure_game_configs_updated_at();

-- Enable realtime for adventure_game_configs
ALTER PUBLICATION supabase_realtime ADD TABLE public.adventure_game_configs;