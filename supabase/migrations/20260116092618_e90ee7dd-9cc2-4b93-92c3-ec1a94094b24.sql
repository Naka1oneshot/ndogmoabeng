
-- Modify games table: add new columns (keep status as text for backward compatibility)
ALTER TABLE public.games 
  ADD COLUMN IF NOT EXISTS manche_active integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sens_depart_egalite text DEFAULT 'ASC',
  ADD COLUMN IF NOT EXISTS x_nb_joueurs integer DEFAULT 0;

-- Modify game_players table: add new columns for player game state
ALTER TABLE public.game_players
  ADD COLUMN IF NOT EXISTS clan text,
  ADD COLUMN IF NOT EXISTS mate_num integer,
  ADD COLUMN IF NOT EXISTS jetons integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recompenses integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_alive boolean DEFAULT true;

-- Create shop_catalogue table
CREATE TABLE public.shop_catalogue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES public.games(id) ON DELETE CASCADE,
  objet text NOT NULL,
  categorie text NOT NULL,
  cout_normal integer NOT NULL DEFAULT 0,
  cout_akila integer NOT NULL DEFAULT 0,
  restock_apres_achat boolean DEFAULT false,
  is_sniper_akila boolean DEFAULT false,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, objet)
);

-- Create combat_config table
CREATE TABLE public.combat_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES public.games(id) ON DELETE CASCADE,
  objet text NOT NULL,
  categorie text,
  degats_base integer DEFAULT 0,
  soin_base integer DEFAULT 0,
  cible text,
  timing text DEFAULT 'IMMEDIAT',
  persistance text,
  ignore_protection boolean DEFAULT false,
  effet_special text,
  conso_objet boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, objet)
);

-- Create inventory table
CREATE TABLE public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  owner_num integer,
  objet text NOT NULL,
  disponible boolean DEFAULT true,
  quantite integer DEFAULT 1,
  dispo_attaque boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create round_bets table (Phase1_Mises)
CREATE TABLE public.round_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  manche integer NOT NULL,
  num_joueur integer NOT NULL,
  mise integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, manche, num_joueur)
);

-- Create actions table (Actions_Normalisées)
CREATE TABLE public.actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  manche integer NOT NULL,
  num_joueur integer NOT NULL,
  position_souhaitee integer,
  slot_attaque integer CHECK (slot_attaque >= 1 AND slot_attaque <= 3),
  protection_objet text,
  slot_protection integer CHECK (slot_protection >= 1 AND slot_protection <= 3),
  attaque1 text,
  attaque2 text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, manche, num_joueur)
);

-- Create positions_finales table
CREATE TABLE public.positions_finales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  manche integer NOT NULL,
  rang_priorite integer,
  num_joueur integer NOT NULL,
  mise integer,
  nom text,
  clan text,
  position_souhaitee integer,
  position_finale integer,
  slot_attaque integer,
  attaque1 text,
  attaque2 text,
  protection text,
  slot_protection integer,
  created_at timestamptz DEFAULT now()
);

-- Create monsters table
CREATE TABLE public.monsters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  monstre_id integer NOT NULL,
  type text NOT NULL,
  pv_max integer NOT NULL DEFAULT 10,
  pv_actuels integer NOT NULL DEFAULT 10,
  recompense integer DEFAULT 0,
  statut text DEFAULT 'EN_FILE',
  created_at timestamptz DEFAULT now()
);

-- Create battlefield table
CREATE TABLE public.battlefield (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  slot integer NOT NULL CHECK (slot >= 1 AND slot <= 3),
  monstre_id_en_place integer,
  pv_miroir integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, slot)
);

-- Create pending_effects table (Effets_En_Attente)
CREATE TABLE public.pending_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  manche integer NOT NULL,
  type text NOT NULL,
  slot integer,
  weapon text,
  by_num integer,
  created_at timestamptz DEFAULT now()
);

-- Create logs_mj table
CREATE TABLE public.logs_mj (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  timestamp timestamptz DEFAULT now(),
  manche integer,
  num_joueur integer,
  action text NOT NULL,
  details text
);

-- Create logs_joueurs table
CREATE TABLE public.logs_joueurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  timestamp timestamptz DEFAULT now(),
  manche integer,
  type text,
  message text,
  log_index serial
);

-- Create function to replace player numbers with names
CREATE OR REPLACE FUNCTION public.replace_num_by_name(p_game_id uuid, p_message text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result text := p_message;
  v_player RECORD;
BEGIN
  FOR v_player IN 
    SELECT player_number, display_name 
    FROM public.game_players 
    WHERE game_id = p_game_id AND player_number IS NOT NULL
    ORDER BY player_number DESC
  LOOP
    v_result := regexp_replace(v_result, 'Joueur ' || v_player.player_number::text || '(?![0-9])', v_player.display_name, 'gi');
    v_result := regexp_replace(v_result, '(?<![0-9A-Za-z])' || v_player.player_number::text || '(?![0-9])', v_player.display_name, 'g');
  END LOOP;
  RETURN v_result;
END;
$$;

-- Create indexes for performance
CREATE INDEX idx_inventory_game_owner ON public.inventory(game_id, owner_num);
CREATE INDEX idx_round_bets_game_manche ON public.round_bets(game_id, manche);
CREATE INDEX idx_actions_game_manche ON public.actions(game_id, manche);
CREATE INDEX idx_positions_finales_game_manche ON public.positions_finales(game_id, manche);
CREATE INDEX idx_monsters_game ON public.monsters(game_id);
CREATE INDEX idx_pending_effects_game_manche ON public.pending_effects(game_id, manche);
CREATE INDEX idx_logs_mj_game ON public.logs_mj(game_id, timestamp);
CREATE INDEX idx_logs_joueurs_game ON public.logs_joueurs(game_id, timestamp);

-- Enable RLS on all new tables
ALTER TABLE public.shop_catalogue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combat_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions_finales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monsters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battlefield ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_mj ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_joueurs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Host (MJ) can manage all data for their games
CREATE POLICY "Host can manage shop_catalogue" ON public.shop_catalogue
  FOR ALL USING (EXISTS (SELECT 1 FROM games g WHERE g.id = shop_catalogue.game_id AND g.host_user_id = auth.uid()));

CREATE POLICY "Host can manage combat_config" ON public.combat_config
  FOR ALL USING (EXISTS (SELECT 1 FROM games g WHERE g.id = combat_config.game_id AND g.host_user_id = auth.uid()));

CREATE POLICY "Host can manage inventory" ON public.inventory
  FOR ALL USING (EXISTS (SELECT 1 FROM games g WHERE g.id = inventory.game_id AND g.host_user_id = auth.uid()));

CREATE POLICY "Host can manage round_bets" ON public.round_bets
  FOR ALL USING (EXISTS (SELECT 1 FROM games g WHERE g.id = round_bets.game_id AND g.host_user_id = auth.uid()));

CREATE POLICY "Host can manage actions" ON public.actions
  FOR ALL USING (EXISTS (SELECT 1 FROM games g WHERE g.id = actions.game_id AND g.host_user_id = auth.uid()));

CREATE POLICY "Host can manage positions_finales" ON public.positions_finales
  FOR ALL USING (EXISTS (SELECT 1 FROM games g WHERE g.id = positions_finales.game_id AND g.host_user_id = auth.uid()));

CREATE POLICY "Host can manage monsters" ON public.monsters
  FOR ALL USING (EXISTS (SELECT 1 FROM games g WHERE g.id = monsters.game_id AND g.host_user_id = auth.uid()));

CREATE POLICY "Host can manage battlefield" ON public.battlefield
  FOR ALL USING (EXISTS (SELECT 1 FROM games g WHERE g.id = battlefield.game_id AND g.host_user_id = auth.uid()));

CREATE POLICY "Host can manage pending_effects" ON public.pending_effects
  FOR ALL USING (EXISTS (SELECT 1 FROM games g WHERE g.id = pending_effects.game_id AND g.host_user_id = auth.uid()));

CREATE POLICY "Host can manage logs_mj" ON public.logs_mj
  FOR ALL USING (EXISTS (SELECT 1 FROM games g WHERE g.id = logs_mj.game_id AND g.host_user_id = auth.uid()));

CREATE POLICY "Host can manage logs_joueurs" ON public.logs_joueurs
  FOR ALL USING (EXISTS (SELECT 1 FROM games g WHERE g.id = logs_joueurs.game_id AND g.host_user_id = auth.uid()));

-- Players can view game data (read-only for most tables)
CREATE POLICY "Players can view shop_catalogue" ON public.shop_catalogue
  FOR SELECT USING (true);

CREATE POLICY "Players can view combat_config" ON public.combat_config
  FOR SELECT USING (true);

CREATE POLICY "Players can view their inventory" ON public.inventory
  FOR SELECT USING (true);

CREATE POLICY "Players can view positions_finales" ON public.positions_finales
  FOR SELECT USING (true);

CREATE POLICY "Players can view monsters" ON public.monsters
  FOR SELECT USING (true);

CREATE POLICY "Players can view battlefield" ON public.battlefield
  FOR SELECT USING (true);

CREATE POLICY "Players can view logs_joueurs" ON public.logs_joueurs
  FOR SELECT USING (true);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.monsters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battlefield;
ALTER PUBLICATION supabase_realtime ADD TABLE public.logs_joueurs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
