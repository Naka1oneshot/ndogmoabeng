-- RPC: Liste publique des parties en cours (sécurisée, anti-triche)
CREATE OR REPLACE FUNCTION public.public_list_live_games()
RETURNS TABLE (
  game_id uuid,
  name text,
  status text,
  phase text,
  manche_active int,
  mode text,
  selected_game_type_code text,
  current_session_game_id uuid,
  current_step_index int,
  game_type_name text,
  player_count bigint,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    g.id AS game_id,
    g.name,
    g.status,
    g.phase,
    g.manche_active,
    g.mode,
    g.selected_game_type_code,
    g.current_session_game_id,
    g.current_step_index,
    COALESCE(
      (SELECT gt.name FROM game_types gt WHERE gt.code = 
        CASE 
          WHEN g.mode = 'ADVENTURE' AND g.current_session_game_id IS NOT NULL THEN
            (SELECT sg.game_type_code FROM session_games sg WHERE sg.id = g.current_session_game_id)
          ELSE g.selected_game_type_code
        END
      ),
      'Non défini'
    ) AS game_type_name,
    (SELECT COUNT(*) FROM game_players gp WHERE gp.game_id = g.id AND gp.removed_at IS NULL AND gp.is_host = false) AS player_count,
    g.created_at AS updated_at
  FROM games g
  WHERE g.status IN ('LOBBY', 'RUNNING', 'IN_GAME')
    AND g.winner_declared = false
  ORDER BY g.created_at DESC
  LIMIT 50;
$$;

-- RPC: Feed public d'une partie (chronique spectateur, anti-triche)
CREATE OR REPLACE FUNCTION public.public_game_feed(p_game_id uuid)
RETURNS TABLE (
  entry_id uuid,
  event_timestamp timestamptz,
  manche int,
  phase_label text,
  source_type text,
  message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_session_game_id uuid;
BEGIN
  SELECT current_session_game_id INTO v_current_session_game_id
  FROM games WHERE id = p_game_id;

  RETURN QUERY
  SELECT 
    lj.id AS entry_id,
    lj.timestamp AS event_timestamp,
    lj.manche,
    lj.type AS phase_label,
    'LOG_JOUEUR'::text AS source_type,
    lj.message
  FROM logs_joueurs lj
  WHERE lj.game_id = p_game_id
    AND (v_current_session_game_id IS NULL OR lj.session_game_id = v_current_session_game_id OR lj.session_game_id IS NULL)
  
  UNION ALL
  
  SELECT 
    se.id AS entry_id,
    se.created_at AS event_timestamp,
    NULL::int AS manche,
    se.type AS phase_label,
    'SESSION_EVENT'::text AS source_type,
    se.message
  FROM session_events se
  WHERE se.game_id = p_game_id
    AND se.audience IN ('ALL', 'PUBLIC', 'SPECTATORS')
  
  UNION ALL
  
  SELECT 
    ge.id AS entry_id,
    ge.created_at AS event_timestamp,
    ge.manche,
    ge.phase AS phase_label,
    'GAME_EVENT'::text AS source_type,
    ge.message
  FROM game_events ge
  WHERE ge.game_id = p_game_id
    AND ge.visibility IN ('PUBLIC', 'PLAYER', 'ALL')
    AND (v_current_session_game_id IS NULL OR ge.session_game_id = v_current_session_game_id OR ge.session_game_id IS NULL)
  
  UNION ALL
  
  SELECT 
    cr.id AS entry_id,
    cr.resolved_at AS event_timestamp,
    cr.manche,
    'COMBAT_RESULT'::text AS phase_label,
    'COMBAT_RESULT'::text AS source_type,
    COALESCE(
      (cr.public_summary->>'message')::text,
      'Résultats du combat - Manche ' || cr.manche::text
    ) AS message
  FROM combat_results cr
  WHERE cr.game_id = p_game_id
    AND cr.public_summary IS NOT NULL
    AND (v_current_session_game_id IS NULL OR cr.session_game_id = v_current_session_game_id OR cr.session_game_id IS NULL)
  
  UNION ALL
  
  SELECT 
    rlh.id AS entry_id,
    rlh.resolved_at AS event_timestamp,
    rlh.manche,
    'RIVER_RESULT'::text AS phase_label,
    'RIVER_RESULT'::text AS source_type,
    COALESCE(
      rlh.public_summary,
      'Résolution niveau ' || rlh.niveau::text || ' - ' || rlh.outcome
    ) AS message
  FROM river_level_history rlh
  WHERE rlh.game_id = p_game_id
    AND (v_current_session_game_id IS NULL OR rlh.session_game_id = v_current_session_game_id)
  
  ORDER BY event_timestamp ASC, manche ASC NULLS FIRST;
END;
$$;

-- RPC: Infos publiques d'une partie (header spectateur)
CREATE OR REPLACE FUNCTION public.public_game_info(p_game_id uuid)
RETURNS TABLE (
  game_id uuid,
  name text,
  status text,
  phase text,
  manche_active int,
  mode text,
  game_type_code text,
  game_type_name text,
  current_step_index int,
  player_count bigint,
  is_ended boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    g.id AS game_id,
    g.name,
    g.status,
    g.phase,
    g.manche_active,
    g.mode,
    CASE 
      WHEN g.mode = 'ADVENTURE' AND g.current_session_game_id IS NOT NULL THEN
        (SELECT sg.game_type_code FROM session_games sg WHERE sg.id = g.current_session_game_id)
      ELSE g.selected_game_type_code
    END AS game_type_code,
    COALESCE(
      (SELECT gt.name FROM game_types gt WHERE gt.code = 
        CASE 
          WHEN g.mode = 'ADVENTURE' AND g.current_session_game_id IS NOT NULL THEN
            (SELECT sg.game_type_code FROM session_games sg WHERE sg.id = g.current_session_game_id)
          ELSE g.selected_game_type_code
        END
      ),
      'Non défini'
    ) AS game_type_name,
    g.current_step_index,
    (SELECT COUNT(*) FROM game_players gp WHERE gp.game_id = g.id AND gp.removed_at IS NULL AND gp.is_host = false) AS player_count,
    (g.status IN ('ENDED', 'FINISHED', 'ARCHIVED') OR g.winner_declared = true) AS is_ended
  FROM games g
  WHERE g.id = p_game_id;
$$;

-- RPC: Liste des participants publics (noms seulement, pas de rôles/statuts secrets)
CREATE OR REPLACE FUNCTION public.public_game_participants(p_game_id uuid)
RETURNS TABLE (
  player_number int,
  display_name text,
  clan text,
  is_alive boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    gp.player_number,
    gp.display_name,
    gp.clan,
    gp.is_alive
  FROM game_players gp
  WHERE gp.game_id = p_game_id
    AND gp.removed_at IS NULL
    AND gp.is_host = false
  ORDER BY gp.player_number ASC;
$$;