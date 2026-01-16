-- 1) Table monster_catalog (catalogue global)
CREATE TABLE public.monster_catalog (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  pv_max_default INTEGER NOT NULL DEFAULT 10,
  reward_default INTEGER NOT NULL DEFAULT 10,
  is_default_in_pool BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2) Table item_catalog (catalogue global)
CREATE TYPE item_category AS ENUM ('ATTAQUE', 'PROTECTION', 'UTILITAIRE');

CREATE TABLE public.item_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category item_category NOT NULL,
  base_damage INTEGER DEFAULT 0,
  base_heal INTEGER DEFAULT 0,
  target TEXT,
  timing TEXT DEFAULT 'IMMEDIAT',
  persistence TEXT DEFAULT 'AUCUNE',
  ignore_protection BOOLEAN DEFAULT false,
  special_effect TEXT DEFAULT 'AUCUN',
  special_value TEXT,
  consumable BOOLEAN DEFAULT true,
  notes TEXT,
  purchasable BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3) Table shop_prices
CREATE TABLE public.shop_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL REFERENCES public.item_catalog(name) ON DELETE CASCADE,
  cost_normal INTEGER NOT NULL DEFAULT 0,
  cost_akila INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(item_name)
);

-- 4) Table game_monsters (configuration par partie)
CREATE TYPE monster_initial_status AS ENUM ('EN_BATAILLE', 'EN_FILE');

CREATE TABLE public.game_monsters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  monster_id INTEGER NOT NULL REFERENCES public.monster_catalog(id) ON DELETE CASCADE,
  pv_max_override INTEGER,
  reward_override INTEGER,
  initial_status monster_initial_status NOT NULL DEFAULT 'EN_FILE',
  order_index INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, monster_id)
);

-- 5) Table game_state_monsters (état runtime)
CREATE TYPE monster_runtime_status AS ENUM ('EN_BATAILLE', 'EN_FILE', 'MORT');

CREATE TABLE public.game_state_monsters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  monster_id INTEGER NOT NULL REFERENCES public.monster_catalog(id) ON DELETE CASCADE,
  pv_current INTEGER NOT NULL,
  status monster_runtime_status NOT NULL DEFAULT 'EN_FILE',
  battlefield_slot INTEGER CHECK (battlefield_slot IS NULL OR battlefield_slot BETWEEN 1 AND 3),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, monster_id)
);

-- Enable RLS
ALTER TABLE public.monster_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_monsters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_state_monsters ENABLE ROW LEVEL SECURITY;

-- Policies for monster_catalog (read-only for everyone)
CREATE POLICY "Anyone can view monster_catalog" ON public.monster_catalog FOR SELECT USING (true);

-- Policies for item_catalog (read-only for everyone)
CREATE POLICY "Anyone can view item_catalog" ON public.item_catalog FOR SELECT USING (true);

-- Policies for shop_prices (read-only for everyone)
CREATE POLICY "Anyone can view shop_prices" ON public.shop_prices FOR SELECT USING (true);

-- Policies for game_monsters
CREATE POLICY "Host can manage game_monsters" ON public.game_monsters FOR ALL
  USING (EXISTS (SELECT 1 FROM games g WHERE g.id = game_monsters.game_id AND g.host_user_id = auth.uid()));
CREATE POLICY "Players can view game_monsters" ON public.game_monsters FOR SELECT USING (true);

-- Policies for game_state_monsters
CREATE POLICY "Host can manage game_state_monsters" ON public.game_state_monsters FOR ALL
  USING (EXISTS (SELECT 1 FROM games g WHERE g.id = game_state_monsters.game_id AND g.host_user_id = auth.uid()));
CREATE POLICY "Players can view game_state_monsters" ON public.game_state_monsters FOR SELECT USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_monsters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state_monsters;

-- SEED DATA: Monsters
INSERT INTO public.monster_catalog (id, name, pv_max_default, reward_default, is_default_in_pool) VALUES
  (1, 'Classique', 10, 10, true),
  (2, 'Classique', 10, 10, true),
  (3, 'Féroce', 12, 12, true),
  (4, 'Elite', 14, 14, true),
  (5, 'Elite', 14, 14, true),
  (6, 'Héroïque', 16, 16, true),
  (7, 'Épique', 18, 18, true);

-- SEED DATA: Items
INSERT INTO public.item_catalog (name, category, base_damage, base_heal, target, timing, persistence, ignore_protection, special_effect, special_value, consumable, notes, purchasable) VALUES
  ('Deux Balles', 'ATTAQUE', 4, 0, 'MONO', 'IMMEDIAT', 'AUCUNE', false, 'AUCUN', '0', true, 'Attaque (x2, mais nécessite arme ''Arme à feu'').', false),
  ('Arme à feu', 'ATTAQUE', 8, 0, 'MONO', 'IMMEDIAT', 'AUCUNE', false, 'AUCUN', '0', true, 'Attaque normale.', false),
  ('Grenade Frag', 'ATTAQUE', 5, 0, 'AOE_3', 'IMMEDIAT', 'AUCUNE', false, 'AUCUN', '0', true, 'Attaque AOE, 5 dégâts sur chaque monstre en bataille', true),
  ('Bazooka', 'ATTAQUE', 10, 0, 'EMPLACEMENT', 'FIN_TOUR_SUIVANT', 'AUCUNE', false, 'AUCUN', '0', true, 'Explose après le tour du joueur suivant', true),
  ('Grenade incendiaire', 'ATTAQUE', 3, 0, 'AOE_3', 'IMMEDIAT', 'FIN_2_JOUEURS', false, 'DOT', '0', true, 'Inflige 3 aux 3 monstres puis 1 sur les 2 joueurs suivants', true),
  ('Canon de Brume', 'ATTAQUE', 0, 0, 'EMPLACEMENT', 'IMMEDIAT', 'JUSQUA_FIN_POSITIONS', false, 'BRUME', '0', true, 'Inflige 1 dégât à la même cible à chaque position jusqu''à la fin des positions', true),
  ('Mine', 'ATTAQUE', 10, 0, 'EMPLACEMENT', 'DEBUT_MANCHE_SUIVANTE', 'AUCUNE', false, 'AUCUN', '0', true, 'Inflige 10 dégâts au monstre présent au début de la manche suivante', true),
  ('Piqure Berseker', 'ATTAQUE', 0, 0, 'EMPLACEMENT', 'IMMEDIAT', 'AUCUNE', false, 'PENALITE_SI_NO_KILL', '-10 jetons', true, 'Si pas de coup de grâce ce tour, perd 10 jetons de mise', true),
  ('Sabre Akila', 'ATTAQUE', 5, 0, 'EMPLACEMENT', 'IMMEDIAT', 'AUCUNE', false, 'BONUS_KILL', '+5 jetons', true, 'Si coup de grâce : +5 jetons', true),
  ('Sniper Akila', 'ATTAQUE', 12, 0, 'EMPLACEMENT', 'IMMEDIAT', 'AUCUNE', true, 'AUCUN', '0', true, 'Ignore toutes protections', true),
  ('Par défaut (+2 si compagnon Akandé)', 'ATTAQUE', 3, 0, 'EMPLACEMENT', 'IMMEDIAT', 'AUCUNE', false, 'BONUS_COMPAGNON', '+2 dégâts si clan Akandé', false, 'Si joueur Akandé, ajoute +2 dégâts.', true),
  ('Amulette de soutien', 'ATTAQUE', 0, 0, 'AUCUN', 'IMMEDIAT', 'AUCUNE', false, 'DOUBLE_DAMAGE_MATE', 'x2', true, 'Double les dégâts du coéquipier de la même manche', true),
  ('Bouclier rituel', 'PROTECTION', 0, 0, 'EMPLACEMENT', 'IMMEDIAT', 'AUCUNE', false, 'INVULNERABILITE_APRES', '0', true, 'Ignore les attaques après activation (sauf si Ignore_Protection=true)', true),
  ('Voile du Gardien', 'PROTECTION', 0, 0, 'EMPLACEMENT', 'IMMEDIAT', 'AUCUNE', false, 'RENVOI_JETONS', '0', true, 'Annule attaques et fait perdre des jetons à l''attaquant', true),
  ('Gaz Soporifique', 'PROTECTION', 0, 0, 'EMPLACEMENT', 'IMMEDIAT', 'AUCUNE', false, 'ANNULATION_ATTAQUE', '0', true, 'Annule attaques suivantes après activation sur l''emplacement protégé', true),
  ('Essence de Ndogmoabeng', 'PROTECTION', 0, 7, 'EMPLACEMENT', 'IMMEDIAT', 'AUCUNE', false, 'SOIN_CAPE', '7', true, 'Soigne 7 PV (sans dépasser PV_Max)', true),
  ('Totem de Rupture', 'ATTAQUE', 3, 0, 'EMPLACEMENT', 'IMMEDIAT', 'AUCUNE', true, 'AUCUN', '0', true, 'Ignore tous effets de protection', true),
  ('Flèche du Crépuscule', 'ATTAQUE', 1, 0, 'AOE_3', 'IMMEDIAT', 'AUCUNE', false, 'AUCUN', '0', true, 'Dégâts de zone immédiats', true);

-- SEED DATA: Shop Prices
INSERT INTO public.shop_prices (item_name, cost_normal, cost_akila) VALUES
  ('Sniper Akila', 0, 0),
  ('Sabre Akila', 10, 10),
  ('Grenade Frag', 10, 10),
  ('Mine', 10, 10),
  ('Bazooka', 15, 15),
  ('Piqure Berseker', 10, 10),
  ('Amulette de soutien', 10, 10),
  ('Grenade incendiaire', 10, 10),
  ('Canon de Brume', 10, 10),
  ('Bouclier rituel', 10, 10),
  ('Essence de Ndogmoabeng', 10, 10),
  ('Voile du Gardien', 10, 10),
  ('Gaz Soporifique', 10, 10),
  ('Totem de Rupture', 3, 2),
  ('Flèche du Crépuscule', 3, 2),
  ('Par défaut (+2 si compagnon Akandé)', 0, 0);

-- Function to initialize game_monsters when a game is created
CREATE OR REPLACE FUNCTION public.initialize_game_monsters(p_game_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.game_monsters (game_id, monster_id, initial_status, order_index, is_enabled)
  SELECT 
    p_game_id,
    mc.id,
    CASE WHEN mc.id <= 3 THEN 'EN_BATAILLE'::monster_initial_status ELSE 'EN_FILE'::monster_initial_status END,
    mc.id,
    true
  FROM public.monster_catalog mc
  WHERE mc.is_default_in_pool = true
  ON CONFLICT (game_id, monster_id) DO NOTHING;
END;
$$;

-- Function to initialize game_state_monsters when game starts
CREATE OR REPLACE FUNCTION public.initialize_game_state_monsters(p_game_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot INTEGER := 1;
BEGIN
  INSERT INTO public.game_state_monsters (game_id, monster_id, pv_current, status, battlefield_slot)
  SELECT 
    p_game_id,
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
$$;