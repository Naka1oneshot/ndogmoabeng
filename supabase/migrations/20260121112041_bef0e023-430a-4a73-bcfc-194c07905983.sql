-- Update the function to accept and set session_game_id
CREATE OR REPLACE FUNCTION public.initialize_game_state_monsters(p_game_id uuid, p_session_game_id uuid DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.game_state_monsters (game_id, session_game_id, monster_id, pv_current, status, battlefield_slot)
  SELECT 
    p_game_id,
    p_session_game_id,
    gm.monster_id,
    COALESCE(gm.pv_max_override, mc.pv_max_default),
    gm.initial_status::text::monster_runtime_status,
    CASE 
      WHEN gm.initial_status = 'EN_BATAILLE' THEN 
        (SELECT COUNT(*) + 1 FROM game_monsters gm2 
         WHERE gm2.game_id = p_game_id 
         AND gm2.is_enabled = true 
         AND gm2.initial_status = 'EN_BATAILLE' 
         AND gm2.order_index < gm.order_index)::INTEGER
      ELSE NULL
    END
  FROM public.game_monsters gm
  JOIN public.monster_catalog mc ON mc.id = gm.monster_id
  WHERE gm.game_id = p_game_id AND gm.is_enabled = true
  ORDER BY gm.order_index
  ON CONFLICT (game_id, monster_id) DO NOTHING;
END;
$function$;