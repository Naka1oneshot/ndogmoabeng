-- ====================================
-- PARTIE A: Rivières - RPC atomiques pour lease
-- ====================================

-- Fonction RPC pour acquérir le lease de manière atomique
CREATE OR REPLACE FUNCTION public.acquire_river_auto_lease(
  p_session_id uuid,
  p_user_id uuid,
  p_lease_ms integer DEFAULT 20000
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean;
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
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Fonction RPC pour libérer le lease de manière atomique
CREATE OR REPLACE FUNCTION public.release_river_auto_lease(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE river_session_state
  SET 
    auto_runner_user_id = NULL,
    auto_runner_lease_until = NULL,
    updated_at = now()
  WHERE id = p_session_id
    AND auto_runner_user_id = p_user_id;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- ====================================
-- PARTIE B: Forêt - Champs robustesse dans session_games
-- ====================================

-- Ajouter champs robustesse pour Forêt
ALTER TABLE public.session_games
  ADD COLUMN IF NOT EXISTS auto_runner_user_id uuid,
  ADD COLUMN IF NOT EXISTS auto_runner_lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS auto_fail_bets integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_fail_positions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_fail_resolve_combat integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_fail_shop integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_last_error text,
  ADD COLUMN IF NOT EXISTS auto_waiting_for text,
  ADD COLUMN IF NOT EXISTS auto_anim_ack_at timestamptz;

-- Fonction RPC pour acquérir le lease Forêt de manière atomique
CREATE OR REPLACE FUNCTION public.acquire_foret_auto_lease(
  p_session_game_id uuid,
  p_user_id uuid,
  p_lease_ms integer DEFAULT 20000
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean;
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
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Fonction RPC pour libérer le lease Forêt de manière atomique
CREATE OR REPLACE FUNCTION public.release_foret_auto_lease(
  p_session_game_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE session_games
  SET 
    auto_runner_user_id = NULL,
    auto_runner_lease_until = NULL,
    auto_updated_at = now()
  WHERE id = p_session_game_id
    AND auto_runner_user_id = p_user_id;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Fonction RPC pour reset les compteurs d'échecs Forêt
CREATE OR REPLACE FUNCTION public.reset_foret_auto_fail_counters(
  p_session_game_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE session_games
  SET 
    auto_fail_bets = 0,
    auto_fail_positions = 0,
    auto_fail_resolve_combat = 0,
    auto_fail_shop = 0,
    auto_last_error = NULL,
    auto_updated_at = now()
  WHERE id = p_session_game_id;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;