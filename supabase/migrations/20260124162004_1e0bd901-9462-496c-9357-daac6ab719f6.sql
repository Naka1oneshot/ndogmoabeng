-- Add SHERIFF game type
INSERT INTO public.game_types (code, name, description, default_starting_tokens, is_active)
VALUES ('SHERIFF', 'Le Shérif de Ndogmoabeng', 'Contrôle d''entrée au Centre - visas et fouilles', 20, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- Sheriff player choices (Step 1)
CREATE TABLE IF NOT EXISTS public.sheriff_player_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  session_game_id uuid REFERENCES public.session_games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  player_number integer NOT NULL,
  
  -- Visa choice: 'VICTORY_POINTS' or 'COMMON_POOL'
  visa_choice text,
  visa_cost_applied numeric DEFAULT 0,
  
  -- Token choice: 20 (legal) or 30 (with 10 illegal)
  tokens_entering integer,
  has_illegal_tokens boolean DEFAULT false,
  
  -- Results after duels
  final_tokens integer,
  victory_points_delta numeric DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(session_game_id, player_number)
);

-- Sheriff duels table
CREATE TABLE IF NOT EXISTS public.sheriff_duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  session_game_id uuid REFERENCES public.session_games(id) ON DELETE CASCADE,
  duel_order integer NOT NULL,
  
  -- Players in duel
  player1_number integer NOT NULL,
  player2_number integer NOT NULL,
  
  -- Decisions (null until submitted)
  player1_searches boolean,
  player2_searches boolean,
  
  -- Status: 'PENDING', 'ACTIVE', 'RESOLVED'
  status text DEFAULT 'PENDING',
  
  -- Results after resolution
  player1_vp_delta numeric DEFAULT 0,
  player2_vp_delta numeric DEFAULT 0,
  player1_tokens_lost integer DEFAULT 0,
  player2_tokens_lost integer DEFAULT 0,
  
  resolution_summary jsonb,
  
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  
  UNIQUE(session_game_id, duel_order)
);

-- Sheriff round state
CREATE TABLE IF NOT EXISTS public.sheriff_round_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  session_game_id uuid NOT NULL REFERENCES public.session_games(id) ON DELETE CASCADE,
  
  -- Phase: 'CHOICES', 'DUELS', 'COMPLETE'
  phase text DEFAULT 'CHOICES',
  
  -- Current active duel order (null during CHOICES phase)
  current_duel_order integer,
  total_duels integer DEFAULT 0,
  
  -- Common pool tracking
  common_pool_initial numeric DEFAULT 0,
  common_pool_spent numeric DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(session_game_id)
);

-- Enable RLS
ALTER TABLE public.sheriff_player_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheriff_duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheriff_round_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sheriff_player_choices
CREATE POLICY "Players can view choices in their game" ON public.sheriff_player_choices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM game_players gp 
      WHERE gp.game_id = sheriff_player_choices.game_id 
      AND gp.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage choices" ON public.sheriff_player_choices
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for sheriff_duels  
CREATE POLICY "Players can view duels in their game" ON public.sheriff_duels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM game_players gp 
      WHERE gp.game_id = sheriff_duels.game_id 
      AND gp.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage duels" ON public.sheriff_duels
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for sheriff_round_state
CREATE POLICY "Players can view round state in their game" ON public.sheriff_round_state
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM game_players gp 
      WHERE gp.game_id = sheriff_round_state.game_id 
      AND gp.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage round state" ON public.sheriff_round_state
  FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sheriff_player_choices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sheriff_duels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sheriff_round_state;