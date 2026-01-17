-- ============================================
-- SHOP SYSTEM TABLES
-- ============================================

-- 1. Table for shop offers per round (generated 5 items)
CREATE TABLE public.game_shop_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  manche integer NOT NULL,
  item_ids text[] NOT NULL DEFAULT '{}',
  locked boolean NOT NULL DEFAULT false,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(game_id, manche)
);

-- 2. Table for purchase history
CREATE TABLE public.game_item_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  player_num integer NOT NULL,
  item_name text NOT NULL,
  cost integer NOT NULL,
  manche integer NOT NULL,
  purchased_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add columns to item_catalog if they don't exist
ALTER TABLE public.item_catalog ADD COLUMN IF NOT EXISTS restockable boolean NOT NULL DEFAULT false;

-- Update restockable for Totem de Rupture and Flèche du Crépuscule
UPDATE public.item_catalog SET restockable = true WHERE name IN ('Totem de Rupture', 'Flèche du Crépuscule');

-- Enable RLS
ALTER TABLE public.game_shop_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_item_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_shop_offers
CREATE POLICY "Host can manage game_shop_offers" ON public.game_shop_offers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM games g WHERE g.id = game_shop_offers.game_id AND g.host_user_id = auth.uid()
    )
  );

CREATE POLICY "Players can view game_shop_offers" ON public.game_shop_offers
  FOR SELECT USING (true);

-- RLS Policies for game_item_purchases
CREATE POLICY "Host can manage game_item_purchases" ON public.game_item_purchases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM games g WHERE g.id = game_item_purchases.game_id AND g.host_user_id = auth.uid()
    )
  );

CREATE POLICY "Players can view game_item_purchases" ON public.game_item_purchases
  FOR SELECT USING (true);

CREATE POLICY "Players can insert their own purchases" ON public.game_item_purchases
  FOR INSERT WITH CHECK (true);

-- Enable realtime for shop offers
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_shop_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_item_purchases;

-- Insert shop_prices for items that are purchasable (if not already present)
INSERT INTO public.shop_prices (item_name, cost_normal, cost_akila)
SELECT name, 
  CASE 
    WHEN name = 'Totem de Rupture' THEN 5
    WHEN name = 'Flèche du Crépuscule' THEN 5
    WHEN name = 'Bazooka' THEN 15
    WHEN name = 'Grenade Frag' THEN 10
    WHEN name = 'Grenade incendiaire' THEN 8
    WHEN name = 'Mine' THEN 12
    WHEN name = 'Canon de Brume' THEN 10
    WHEN name = 'Piqure Berseker' THEN 8
    WHEN name = 'Sabre Akila' THEN 10
    WHEN name = 'Amulette de soutien' THEN 6
    WHEN name = 'Bouclier rituel' THEN 15
    WHEN name = 'Essence de Ndogmoabeng' THEN 8
    WHEN name = 'Gaz Soporifique' THEN 12
    WHEN name = 'Voile du Gardien' THEN 10
    ELSE 10
  END as cost_normal,
  CASE 
    WHEN name = 'Totem de Rupture' THEN 5
    WHEN name = 'Flèche du Crépuscule' THEN 5
    WHEN name = 'Bazooka' THEN 12
    WHEN name = 'Grenade Frag' THEN 8
    WHEN name = 'Grenade incendiaire' THEN 6
    WHEN name = 'Mine' THEN 10
    WHEN name = 'Canon de Brume' THEN 8
    WHEN name = 'Piqure Berseker' THEN 6
    WHEN name = 'Sabre Akila' THEN 8
    WHEN name = 'Amulette de soutien' THEN 5
    WHEN name = 'Bouclier rituel' THEN 12
    WHEN name = 'Essence de Ndogmoabeng' THEN 6
    WHEN name = 'Gaz Soporifique' THEN 10
    WHEN name = 'Voile du Gardien' THEN 8
    ELSE 8
  END as cost_akila
FROM public.item_catalog
WHERE purchasable = true
ON CONFLICT (item_name) DO NOTHING;