-- Fix acquire_river_auto_lease: ROW_COUNT returns integer, not boolean
CREATE OR REPLACE FUNCTION public.acquire_river_auto_lease(p_session_id uuid, p_user_id uuid, p_lease_ms integer DEFAULT 20000)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row_count integer;
BEGIN
  UPDATE river_session_state
  SET 
    auto_runner_user_id = p_user_id,
    auto_runner_lease_until = now() + (p_lease_ms || ' milliseconds')::interval,
    updated_at = now()
  WHERE id = p_session_id
    AND (
      auto_runner_lease_until IS NULL
      OR auto_runner_lease_until <= now()
      OR auto_runner_user_id = p_user_id
    );
  
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$function$;

-- Also fix release_river_auto_lease for consistency
CREATE OR REPLACE FUNCTION public.release_river_auto_lease(p_session_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row_count integer;
BEGIN
  UPDATE river_session_state
  SET 
    auto_runner_user_id = NULL,
    auto_runner_lease_until = NULL,
    updated_at = now()
  WHERE id = p_session_id
    AND auto_runner_user_id = p_user_id;
  
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$function$;

-- Fix acquire_foret_auto_lease as well
CREATE OR REPLACE FUNCTION public.acquire_foret_auto_lease(p_session_game_id uuid, p_user_id uuid, p_lease_ms integer DEFAULT 20000)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row_count integer;
BEGIN
  UPDATE session_games
  SET 
    auto_runner_user_id = p_user_id,
    auto_runner_lease_until = now() + (p_lease_ms || ' milliseconds')::interval,
    auto_updated_at = now()
  WHERE id = p_session_game_id
    AND (
      auto_runner_lease_until IS NULL
      OR auto_runner_lease_until <= now()
      OR auto_runner_user_id = p_user_id
    );
  
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$function$;

-- Fix release_foret_auto_lease
CREATE OR REPLACE FUNCTION public.release_foret_auto_lease(p_session_game_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row_count integer;
BEGIN
  UPDATE session_games
  SET 
    auto_runner_user_id = NULL,
    auto_runner_lease_until = NULL,
    auto_updated_at = now()
  WHERE id = p_session_game_id
    AND auto_runner_user_id = p_user_id;
  
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$function$;