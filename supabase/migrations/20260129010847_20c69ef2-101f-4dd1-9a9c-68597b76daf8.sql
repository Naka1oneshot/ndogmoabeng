
-- Add LION game type to the game_types table
INSERT INTO public.game_types (code, name, description, tagline, min_players, is_active, status)
VALUES (
  'LION',
  'Le CŒUR du Lion',
  'Un duel mental de lecture et de bluff entre deux joueurs. Pose ta carte face cachée, devine celle de ton adversaire. Pourras-tu lire en lui ?',
  'Pourras-tu lire en moi ?',
  2,
  true,
  'AVAILABLE'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tagline = EXCLUDED.tagline,
  min_players = EXCLUDED.min_players,
  is_active = EXCLUDED.is_active,
  status = EXCLUDED.status;

-- 1) lion_game_state - Main game state table
CREATE TABLE public.lion_game_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  session_game_id uuid NOT NULL REFERENCES public.session_games(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'RUNNING', 'SUDDEN_DEATH', 'FINISHED')),
  turn_index integer NOT NULL DEFAULT 1,
  sudden_pair_index integer NOT NULL DEFAULT 0,
  active_player_id uuid NOT NULL REFERENCES public.game_players(id),
  guesser_player_id uuid NOT NULL REFERENCES public.game_players(id),
  winner_player_id uuid REFERENCES public.game_players(id),
  auto_resolve boolean NOT NULL DEFAULT true,
  timer_enabled boolean NOT NULL DEFAULT false,
  timer_active_seconds integer NOT NULL DEFAULT 30,
  timer_guess_seconds integer NOT NULL DEFAULT 30,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(session_game_id)
);

-- 2) lion_decks - Dealer decks (one per player)
CREATE TABLE public.lion_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_game_id uuid NOT NULL REFERENCES public.session_games(id) ON DELETE CASCADE,
  owner_player_id uuid NOT NULL REFERENCES public.game_players(id),
  remaining_cards integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6,7,8,9,10],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(session_game_id, owner_player_id)
);

-- 3) lion_hands - Player hands
CREATE TABLE public.lion_hands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_game_id uuid NOT NULL REFERENCES public.session_games(id) ON DELETE CASCADE,
  owner_player_id uuid NOT NULL REFERENCES public.game_players(id),
  remaining_cards integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6,7,8,9,10],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(session_game_id, owner_player_id)
);

-- 4) lion_turns - Turn history and current turn state
CREATE TABLE public.lion_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_game_id uuid NOT NULL REFERENCES public.session_games(id) ON DELETE CASCADE,
  turn_index integer NOT NULL,
  is_sudden_death boolean NOT NULL DEFAULT false,
  sudden_pair_index integer NOT NULL DEFAULT 0,
  dealer_owner_player_id uuid NOT NULL REFERENCES public.game_players(id),
  dealer_card integer NOT NULL CHECK (dealer_card >= 0 AND dealer_card <= 10),
  active_player_id uuid NOT NULL REFERENCES public.game_players(id),
  guesser_player_id uuid NOT NULL REFERENCES public.game_players(id),
  active_card integer CHECK (active_card >= 0 AND active_card <= 10),
  guess_choice text CHECK (guess_choice IN ('HIGHER', 'LOWER')),
  active_locked boolean NOT NULL DEFAULT false,
  guess_locked boolean NOT NULL DEFAULT false,
  resolved boolean NOT NULL DEFAULT false,
  d integer,
  pvic_delta_active integer NOT NULL DEFAULT 0,
  pvic_delta_guesser integer NOT NULL DEFAULT 0,
  active_locked_at timestamp with time zone,
  guess_locked_at timestamp with time zone,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(session_game_id, turn_index, sudden_pair_index)
);

-- Enable RLS on all tables
ALTER TABLE public.lion_game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lion_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lion_hands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lion_turns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lion_game_state
CREATE POLICY "Host can manage lion_game_state"
ON public.lion_game_state
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = lion_game_state.game_id
    AND g.host_user_id = auth.uid()
  )
);

CREATE POLICY "Players can read lion_game_state"
ON public.lion_game_state
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp
    JOIN public.games g ON g.id = gp.game_id
    WHERE gp.game_id = lion_game_state.game_id
    AND (gp.user_id = auth.uid() OR gp.device_id IS NOT NULL)
    AND gp.removed_at IS NULL
  )
);

CREATE POLICY "Admins can manage lion_game_state"
ON public.lion_game_state
FOR ALL
USING (public.is_admin_or_super(auth.uid()));

-- RLS Policies for lion_decks
CREATE POLICY "Host can manage lion_decks"
ON public.lion_decks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.session_games sg
    JOIN public.games g ON g.id = sg.session_id
    WHERE sg.id = lion_decks.session_game_id
    AND g.host_user_id = auth.uid()
  )
);

CREATE POLICY "Players can read lion_decks"
ON public.lion_decks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.session_games sg
    JOIN public.game_players gp ON gp.game_id = sg.session_id
    WHERE sg.id = lion_decks.session_game_id
    AND (gp.user_id = auth.uid() OR gp.device_id IS NOT NULL)
    AND gp.removed_at IS NULL
  )
);

-- RLS Policies for lion_hands
CREATE POLICY "Host can manage lion_hands"
ON public.lion_hands
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.session_games sg
    JOIN public.games g ON g.id = sg.session_id
    WHERE sg.id = lion_hands.session_game_id
    AND g.host_user_id = auth.uid()
  )
);

CREATE POLICY "Players can read own hand"
ON public.lion_hands
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp
    WHERE gp.id = lion_hands.owner_player_id
    AND (gp.user_id = auth.uid() OR gp.device_id IS NOT NULL)
    AND gp.removed_at IS NULL
  )
);

CREATE POLICY "Players can update own hand"
ON public.lion_hands
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp
    WHERE gp.id = lion_hands.owner_player_id
    AND (gp.user_id = auth.uid() OR gp.device_id IS NOT NULL)
    AND gp.removed_at IS NULL
  )
);

-- RLS Policies for lion_turns
CREATE POLICY "Host can manage lion_turns"
ON public.lion_turns
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.session_games sg
    JOIN public.games g ON g.id = sg.session_id
    WHERE sg.id = lion_turns.session_game_id
    AND g.host_user_id = auth.uid()
  )
);

CREATE POLICY "Players can read lion_turns"
ON public.lion_turns
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.session_games sg
    JOIN public.game_players gp ON gp.game_id = sg.session_id
    WHERE sg.id = lion_turns.session_game_id
    AND (gp.user_id = auth.uid() OR gp.device_id IS NOT NULL)
    AND gp.removed_at IS NULL
  )
);

CREATE POLICY "Active player can submit card"
ON public.lion_turns
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp
    WHERE gp.id = lion_turns.active_player_id
    AND (gp.user_id = auth.uid() OR gp.device_id IS NOT NULL)
    AND gp.removed_at IS NULL
  )
  AND NOT lion_turns.active_locked
);

CREATE POLICY "Guesser can submit guess"
ON public.lion_turns
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp
    WHERE gp.id = lion_turns.guesser_player_id
    AND (gp.user_id = auth.uid() OR gp.device_id IS NOT NULL)
    AND gp.removed_at IS NULL
  )
  AND NOT lion_turns.guess_locked
);

CREATE POLICY "Admins can manage lion_turns"
ON public.lion_turns
FOR ALL
USING (public.is_admin_or_super(auth.uid()));

-- Enable realtime for Lion tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.lion_game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lion_turns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lion_hands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lion_decks;

-- Create updated_at triggers
CREATE TRIGGER update_lion_game_state_updated_at
  BEFORE UPDATE ON public.lion_game_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lion_decks_updated_at
  BEFORE UPDATE ON public.lion_decks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lion_hands_updated_at
  BEFORE UPDATE ON public.lion_hands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lion_turns_updated_at
  BEFORE UPDATE ON public.lion_turns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
