-- Add homepage_order column to game_types
-- NULL = not on homepage, 1/2/3 = position on homepage
ALTER TABLE public.game_types 
ADD COLUMN IF NOT EXISTS homepage_order integer;

-- Add comment for clarity
COMMENT ON COLUMN public.game_types.homepage_order IS 'Order on homepage (1-3), NULL if not featured';