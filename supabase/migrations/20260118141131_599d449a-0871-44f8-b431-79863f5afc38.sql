
-- ========================================
-- PHASE 1: Multi-Game Adventure Foundation
-- ========================================

-- A1) Catalogue des types de jeux
CREATE TABLE public.game_types (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NULL,
  default_starting_tokens integer NULL DEFAULT 50,
  default_config jsonb NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_types ENABLE ROW LEVEL SECURITY;

-- Anyone can view game types
CREATE POLICY "Anyone can view game_types"
ON public.game_types FOR SELECT
USING (true);

-- Seed game_types
INSERT INTO public.game_types (code, name, description, default_starting_tokens, is_active) VALUES
  ('FORET', 'La forêt de Ndogmoabeng', 'Le jeu original de la forêt mystérieuse', 50, true),
  ('RIVIERES', 'Les rivières de Ndogmoabeng', 'Naviguez les rivières dangereuses', 50, true),
  ('INFECTION', 'Infection à Ndogmoabeng', 'Survivez à l''épidémie', 50, true),
  ('FUTUR', 'Jeu (à venir)', 'Placeholder pour un futur jeu', 50, false);

-- A2) Templates d'aventures
CREATE TABLE public.adventures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.adventures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active adventures"
ON public.adventures FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage adventures"
ON public.adventures FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- A2b) Étapes d'une aventure
CREATE TABLE public.adventure_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id uuid NOT NULL REFERENCES public.adventures(id) ON DELETE CASCADE,
  step_index integer NOT NULL,
  game_type_code text NOT NULL REFERENCES public.game_types(code),
  default_step_config jsonb NULL,
  token_policy text NOT NULL DEFAULT 'INHERIT' CHECK (token_policy IN ('INHERIT', 'RESET_TO_DEFAULT', 'SET_CUSTOM')),
  custom_starting_tokens integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Contraintes clés
  UNIQUE(adventure_id, step_index),
  UNIQUE(adventure_id, game_type_code) -- Un jeu ne peut apparaître qu'une fois par aventure
);

ALTER TABLE public.adventure_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view adventure_steps"
ON public.adventure_steps FOR SELECT
USING (true);

CREATE POLICY "Admins can manage adventure_steps"
ON public.adventure_steps FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Index for efficient lookups
CREATE INDEX idx_adventure_steps_adventure_id ON public.adventure_steps(adventure_id);

-- A3) Modifier games pour supporter les modes
ALTER TABLE public.games 
  ADD COLUMN mode text NOT NULL DEFAULT 'SINGLE_GAME' CHECK (mode IN ('SINGLE_GAME', 'ADVENTURE')),
  ADD COLUMN selected_game_type_code text NULL REFERENCES public.game_types(code),
  ADD COLUMN adventure_id uuid NULL REFERENCES public.adventures(id),
  ADD COLUMN current_step_index integer NOT NULL DEFAULT 1,
  ADD COLUMN current_session_game_id uuid NULL,
  ADD COLUMN winner_declared boolean NOT NULL DEFAULT false;

-- A4) Sessions de jeu (une instance de jeu dans une session)
CREATE TABLE public.session_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  step_index integer NOT NULL,
  game_type_code text NOT NULL REFERENCES public.game_types(code),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'ENDED')),
  manche_active integer NOT NULL DEFAULT 1,
  phase text NULL,
  config jsonb NULL,
  started_at timestamptz NULL,
  ended_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Contraintes
  UNIQUE(session_id, step_index),
  UNIQUE(session_id, game_type_code) -- Sécurité: un jeu ne peut apparaître qu'une fois par session
);

ALTER TABLE public.session_games ENABLE ROW LEVEL SECURITY;

-- Policies for session_games
CREATE POLICY "Host can manage session_games"
ON public.session_games FOR ALL
USING (EXISTS (
  SELECT 1 FROM games g
  WHERE g.id = session_games.session_id AND g.host_user_id = auth.uid()
));

CREATE POLICY "Players can view session_games"
ON public.session_games FOR SELECT
USING (true);

-- Indexes
CREATE INDEX idx_session_games_session_id ON public.session_games(session_id);
CREATE INDEX idx_session_games_session_step ON public.session_games(session_id, step_index);

-- Add foreign key for current_session_game_id after session_games exists
ALTER TABLE public.games 
  ADD CONSTRAINT fk_games_current_session_game 
  FOREIGN KEY (current_session_game_id) REFERENCES public.session_games(id);

-- A5) Scores par étape
CREATE TABLE public.stage_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_game_id uuid NOT NULL REFERENCES public.session_games(id) ON DELETE CASCADE,
  game_player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  score_value numeric NOT NULL DEFAULT 0,
  details jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_game_id, game_player_id)
);

ALTER TABLE public.stage_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host can manage stage_scores"
ON public.stage_scores FOR ALL
USING (EXISTS (
  SELECT 1 FROM session_games sg
  JOIN games g ON g.id = sg.session_id
  WHERE sg.id = stage_scores.session_game_id AND g.host_user_id = auth.uid()
));

CREATE POLICY "Players can view stage_scores"
ON public.stage_scores FOR SELECT
USING (true);

CREATE INDEX idx_stage_scores_session_game ON public.stage_scores(session_game_id);

-- A5b) Scores totaux aventure
CREATE TABLE public.adventure_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  game_player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  total_score_value numeric NOT NULL DEFAULT 0,
  breakdown jsonb NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, game_player_id)
);

ALTER TABLE public.adventure_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host can manage adventure_scores"
ON public.adventure_scores FOR ALL
USING (EXISTS (
  SELECT 1 FROM games g
  WHERE g.id = adventure_scores.session_id AND g.host_user_id = auth.uid()
));

CREATE POLICY "Players can view adventure_scores"
ON public.adventure_scores FOR SELECT
USING (true);

CREATE INDEX idx_adventure_scores_session ON public.adventure_scores(session_id);

-- Seed: Exemple d'aventure "La Trilogie de Ndogmoabeng"
INSERT INTO public.adventures (id, name, description, is_active) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'La Trilogie de Ndogmoabeng', 'Affrontez les trois épreuves légendaires de Ndogmoabeng', true);

INSERT INTO public.adventure_steps (adventure_id, step_index, game_type_code, token_policy) VALUES
  ('a0000001-0000-0000-0000-000000000001', 1, 'FORET', 'RESET_TO_DEFAULT'),
  ('a0000001-0000-0000-0000-000000000001', 2, 'RIVIERES', 'INHERIT'),
  ('a0000001-0000-0000-0000-000000000001', 3, 'INFECTION', 'INHERIT');

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stage_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.adventure_scores;
