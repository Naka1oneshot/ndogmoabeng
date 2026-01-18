-- =====================================================
-- PHASE 1: INFECTION GAME TYPE - DATABASE SCHEMA
-- =====================================================

-- 1) Add INFECTION to game_types catalog
INSERT INTO public.game_types (code, name, description, status, default_starting_tokens, is_active)
VALUES (
  'INFECTION',
  'Infection à Ndogmoabeng',
  'Un jeu de rôles cachés où virus et factions s''affrontent dans l''ombre. Découvrez les porteurs, sabotez les ennemis, et survivez à l''épidémie.',
  'AVAILABLE',
  50,
  true
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = 'AVAILABLE',
  default_starting_tokens = 50,
  is_active = true;

-- 2) Add role/infection columns to game_players (if not exist)
ALTER TABLE public.game_players 
ADD COLUMN IF NOT EXISTS role_code text,
ADD COLUMN IF NOT EXISTS team_code text,
ADD COLUMN IF NOT EXISTS pvic integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS immune_permanent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_carrier boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_contagious boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS infected_at_manche integer,
ADD COLUMN IF NOT EXISTS will_contaminate_at_manche integer,
ADD COLUMN IF NOT EXISTS will_die_at_manche integer,
ADD COLUMN IF NOT EXISTS has_antibodies boolean DEFAULT false;

-- 3) Create infection_round_state table
CREATE TABLE IF NOT EXISTS public.infection_round_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  session_game_id uuid NOT NULL REFERENCES public.session_games(id) ON DELETE CASCADE,
  manche integer NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'LOCKED', 'RESOLVED')),
  opened_at timestamptz DEFAULT now(),
  locked_at timestamptz,
  resolved_at timestamptz,
  sy_success_count integer DEFAULT 0,
  sy_required_success integer DEFAULT 2,
  config jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_game_id, manche)
);

-- Enable RLS
ALTER TABLE public.infection_round_state ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Host can manage infection_round_state"
ON public.infection_round_state FOR ALL
USING (EXISTS (
  SELECT 1 FROM games g WHERE g.id = infection_round_state.game_id AND g.host_user_id = auth.uid()
));

CREATE POLICY "Players can view infection_round_state"
ON public.infection_round_state FOR SELECT
USING (true);

-- 4) Create infection_inputs table (player choices per round)
CREATE TABLE IF NOT EXISTS public.infection_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  session_game_id uuid NOT NULL REFERENCES public.session_games(id) ON DELETE CASCADE,
  manche integer NOT NULL,
  player_id uuid NOT NULL,
  player_num integer NOT NULL,
  updated_at timestamptz DEFAULT now(),
  -- AE sabotage
  ae_sabotage_target_num integer,
  -- Corruption
  corruption_amount integer DEFAULT 0,
  -- BA shot
  ba_shot_target_num integer,
  -- PV actions
  pv_shot_target_num integer,
  pv_antidote_target_num integer,
  pv_patient0_target_num integer,
  -- OC lookup
  oc_lookup_target_num integer,
  -- SY research
  sy_research_target_num integer,
  -- Votes
  vote_test_target_num integer,
  vote_suspect_pv_target_num integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_game_id, manche, player_id)
);

-- Enable RLS
ALTER TABLE public.infection_inputs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Host can manage infection_inputs"
ON public.infection_inputs FOR ALL
USING (EXISTS (
  SELECT 1 FROM games g WHERE g.id = infection_inputs.game_id AND g.host_user_id = auth.uid()
));

CREATE POLICY "Players can insert their own inputs"
ON public.infection_inputs FOR INSERT
WITH CHECK (true);

CREATE POLICY "Players can update their own inputs"
ON public.infection_inputs FOR UPDATE
USING (true);

CREATE POLICY "Players can view infection_inputs"
ON public.infection_inputs FOR SELECT
USING (true);

-- 5) Create infection_shots table (timestamped shots for resolution order)
CREATE TABLE IF NOT EXISTS public.infection_shots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  session_game_id uuid NOT NULL REFERENCES public.session_games(id) ON DELETE CASCADE,
  manche integer NOT NULL,
  shooter_num integer NOT NULL,
  shooter_role text NOT NULL CHECK (shooter_role IN ('BA', 'PV')),
  target_num integer NOT NULL,
  server_ts timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPLIED', 'IGNORED')),
  ignore_reason text,
  created_at timestamptz DEFAULT now()
);

-- Index for resolution order
CREATE INDEX IF NOT EXISTS idx_infection_shots_order 
ON public.infection_shots(session_game_id, manche, server_ts);

-- Enable RLS
ALTER TABLE public.infection_shots ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Host can manage infection_shots"
ON public.infection_shots FOR ALL
USING (EXISTS (
  SELECT 1 FROM games g WHERE g.id = infection_shots.game_id AND g.host_user_id = auth.uid()
));

CREATE POLICY "Players can insert shots"
ON public.infection_shots FOR INSERT
WITH CHECK (true);

CREATE POLICY "Players can view infection_shots"
ON public.infection_shots FOR SELECT
USING (true);

-- 6) Create infection_chat_messages table
CREATE TABLE IF NOT EXISTS public.infection_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  session_game_id uuid NOT NULL REFERENCES public.session_games(id) ON DELETE CASCADE,
  manche integer,
  channel_type text NOT NULL CHECK (channel_type IN ('PUBLIC', 'PV', 'SY', 'MP')),
  channel_key text NOT NULL,
  author_num integer NOT NULL,
  author_name text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient channel queries
CREATE INDEX IF NOT EXISTS idx_infection_chat_channel 
ON public.infection_chat_messages(session_game_id, channel_type, channel_key);

-- Enable RLS
ALTER TABLE public.infection_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies (MJ can see all)
CREATE POLICY "Host can manage infection_chat_messages"
ON public.infection_chat_messages FOR ALL
USING (EXISTS (
  SELECT 1 FROM games g WHERE g.id = infection_chat_messages.game_id AND g.host_user_id = auth.uid()
));

-- Players can only see their authorized channels (PUBLIC always, PV/SY if matching role, MP if participant)
CREATE POLICY "Players can view authorized chat"
ON public.infection_chat_messages FOR SELECT
USING (
  channel_type = 'PUBLIC'
  OR channel_type IN ('PV', 'SY') -- Will be filtered in app layer based on role
  OR channel_type = 'MP' -- Will be filtered in app layer based on participation
);

CREATE POLICY "Players can send messages"
ON public.infection_chat_messages FOR INSERT
WITH CHECK (true);

-- 7) Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.infection_round_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.infection_inputs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.infection_shots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.infection_chat_messages;