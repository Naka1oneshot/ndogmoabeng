-- =============================================
-- RIVIERES - Tables spécifiques au jeu "Les Rivières de Ndogmoabeng"
-- =============================================

-- 1) river_session_state : état global d'une session RIVIERES
CREATE TABLE public.river_session_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  session_game_id uuid NOT NULL UNIQUE REFERENCES public.session_games(id) ON DELETE CASCADE,
  manche_active integer NOT NULL DEFAULT 1 CHECK (manche_active BETWEEN 1 AND 3),
  niveau_active integer NOT NULL DEFAULT 1 CHECK (niveau_active BETWEEN 1 AND 5),
  cagnotte_manche integer NOT NULL DEFAULT 0,
  danger_dice_count integer NULL,
  danger_raw integer NULL,
  danger_effectif integer NULL,
  status text NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'ENDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_river_session_state_game ON public.river_session_state(game_id);
CREATE INDEX idx_river_session_state_session ON public.river_session_state(session_game_id);

-- 2) river_player_stats : statistiques par joueur pour une session RIVIERES
CREATE TABLE public.river_player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  session_game_id uuid NOT NULL REFERENCES public.session_games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  player_num integer NOT NULL,
  validated_levels integer NOT NULL DEFAULT 0,
  keryndes_available boolean NOT NULL DEFAULT true,
  current_round_status text NOT NULL DEFAULT 'EN_BATEAU' CHECK (current_round_status IN ('EN_BATEAU', 'A_TERRE', 'CHAVIRE')),
  descended_level integer NULL CHECK (descended_level IS NULL OR descended_level BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_game_id, player_id),
  UNIQUE(session_game_id, player_num)
);

CREATE INDEX idx_river_player_stats_game ON public.river_player_stats(game_id);
CREATE INDEX idx_river_player_stats_session ON public.river_player_stats(session_game_id);

-- 3) river_level_history : historique des niveaux résolus
CREATE TABLE public.river_level_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  session_game_id uuid NOT NULL REFERENCES public.session_games(id) ON DELETE CASCADE,
  manche integer NOT NULL CHECK (manche BETWEEN 1 AND 3),
  niveau integer NOT NULL CHECK (niveau BETWEEN 1 AND 5),
  dice_count integer NULL,
  danger_raw integer NULL,
  danger_effectif integer NULL,
  total_mises integer NOT NULL DEFAULT 0,
  outcome text NOT NULL CHECK (outcome IN ('SUCCESS', 'FAIL')),
  cagnotte_before integer NOT NULL DEFAULT 0,
  cagnotte_after integer NOT NULL DEFAULT 0,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  public_summary text NULL,
  mj_summary text NULL,
  UNIQUE(session_game_id, manche, niveau)
);

CREATE INDEX idx_river_level_history_session ON public.river_level_history(session_game_id);

-- 4) river_decisions : décisions des joueurs par niveau
CREATE TABLE public.river_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  session_game_id uuid NOT NULL REFERENCES public.session_games(id) ON DELETE CASCADE,
  manche integer NOT NULL CHECK (manche BETWEEN 1 AND 3),
  niveau integer NOT NULL CHECK (niveau BETWEEN 1 AND 5),
  player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  player_num integer NOT NULL,
  decision text NOT NULL CHECK (decision IN ('RESTE', 'DESCENDS')),
  mise_demandee integer NOT NULL DEFAULT 0 CHECK (mise_demandee >= 0),
  mise_effective integer NULL,
  keryndes_choice text NOT NULL DEFAULT 'NONE' CHECK (keryndes_choice IN ('NONE', 'AV1_CANOT', 'AV2_REDUCE')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'LOCKED')),
  UNIQUE(session_game_id, manche, niveau, player_id)
);

CREATE INDEX idx_river_decisions_session ON public.river_decisions(session_game_id);
CREATE INDEX idx_river_decisions_level ON public.river_decisions(session_game_id, manche, niveau);

-- =============================================
-- RLS Policies
-- =============================================

-- river_session_state
ALTER TABLE public.river_session_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host can manage river_session_state"
  ON public.river_session_state FOR ALL
  USING (EXISTS (
    SELECT 1 FROM games g WHERE g.id = river_session_state.game_id AND g.host_user_id = auth.uid()
  ));

CREATE POLICY "Players can view river_session_state"
  ON public.river_session_state FOR SELECT
  USING (true);

-- river_player_stats
ALTER TABLE public.river_player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host can manage river_player_stats"
  ON public.river_player_stats FOR ALL
  USING (EXISTS (
    SELECT 1 FROM games g WHERE g.id = river_player_stats.game_id AND g.host_user_id = auth.uid()
  ));

CREATE POLICY "Players can view river_player_stats"
  ON public.river_player_stats FOR SELECT
  USING (true);

-- river_level_history
ALTER TABLE public.river_level_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host can manage river_level_history"
  ON public.river_level_history FOR ALL
  USING (EXISTS (
    SELECT 1 FROM games g WHERE g.id = river_level_history.game_id AND g.host_user_id = auth.uid()
  ));

CREATE POLICY "Players can view river_level_history"
  ON public.river_level_history FOR SELECT
  USING (true);

-- river_decisions
ALTER TABLE public.river_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host can manage river_decisions"
  ON public.river_decisions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM games g WHERE g.id = river_decisions.game_id AND g.host_user_id = auth.uid()
  ));

CREATE POLICY "Players can view river_decisions"
  ON public.river_decisions FOR SELECT
  USING (true);

CREATE POLICY "Players can insert their own decisions"
  ON public.river_decisions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Players can update their own decisions"
  ON public.river_decisions FOR UPDATE
  USING (status = 'DRAFT');

-- =============================================
-- Enable Realtime
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.river_session_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.river_player_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.river_decisions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.river_level_history;

-- =============================================
-- Update game_types for RIVIERES
-- =============================================
UPDATE public.game_types 
SET 
  status = 'AVAILABLE',
  default_starting_tokens = 100,
  default_config = '{
    "rounds": 3,
    "levelsPerRound": 5,
    "keryndesReduce": 20,
    "bonusSurvivor": 50,
    "bonusDescendPerLevel": 10,
    "validatedThreshold": 9,
    "penaltyDivisor": 9,
    "dice_rules": []
  }'::jsonb
WHERE code = 'RIVIERES';