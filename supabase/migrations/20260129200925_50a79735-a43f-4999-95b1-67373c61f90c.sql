-- Table to store clan advantages per game (editable by admins)
CREATE TABLE public.clan_advantages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_code TEXT NOT NULL,
  clan_id TEXT NOT NULL CHECK (clan_id IN ('maison-royale', 'fraternite-zoulous', 'maison-keryndes', 'akande', 'cercle-aseyra', 'sources-akila', 'ezkar')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(game_code, clan_id, title)
);

-- Enable RLS
ALTER TABLE public.clan_advantages ENABLE ROW LEVEL SECURITY;

-- Anyone can view advantages
CREATE POLICY "Anyone can view clan_advantages"
ON public.clan_advantages
FOR SELECT
USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert clan_advantages"
ON public.clan_advantages
FOR INSERT
WITH CHECK (is_admin_or_super(auth.uid()));

-- Only admins can update
CREATE POLICY "Admins can update clan_advantages"
ON public.clan_advantages
FOR UPDATE
USING (is_admin_or_super(auth.uid()));

-- Only admins can delete
CREATE POLICY "Admins can delete clan_advantages"
ON public.clan_advantages
FOR DELETE
USING (is_admin_or_super(auth.uid()));

-- Trigger to update updated_at
CREATE TRIGGER update_clan_advantages_updated_at
BEFORE UPDATE ON public.clan_advantages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial data from existing code (Forêt)
INSERT INTO public.clan_advantages (game_code, clan_id, title, description, source) VALUES
('FORET', 'maison-royale', 'Jetons de départ ×1.5', 'Les Royaux commencent avec 150 jetons au lieu de 100.', 'ForetRulesContent.tsx'),
('FORET', 'akande', 'Dégâts par défaut améliorés', 'L''arme "Par défaut" des Akandé inflige plus de dégâts.', 'item_catalog / combat_config'),
('FORET', 'sources-akila', 'Réduction boutique', 'Tous les objets coûtent environ 50% moins cher pour les Akila.', 'shop_prices table (cost_akila)'),
('FORET', 'sources-akila', 'Sniper Akila exclusif', 'Seuls les Akila peuvent utiliser le Sniper Akila (réservé).', 'is_sniper_akila flag'),
-- Infection advantages
('INFECTION', 'ezkar', 'Antidote Ezkar', 'Tous les joueurs Ezkar reçoivent un antidote supplémentaire au début.', 'InfectionFullPageClans.tsx'),
('INFECTION', 'ezkar', 'Gilet Pare-Balles', 'Tous les joueurs Ezkar reçoivent un gilet pour se protéger d''un tir.', 'InfectionFullPageClans.tsx'),
('INFECTION', 'ezkar', 'PV Ezkar : 2 doses', 'Un Porte-Venin Ezkar a 2 antidotes (rôle + clan).', 'InfectionFullPageClans.tsx');