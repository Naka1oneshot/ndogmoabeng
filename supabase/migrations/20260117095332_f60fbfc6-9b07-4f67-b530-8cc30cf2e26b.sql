-- Add unique constraint on inventory table for idempotent upserts
-- This ensures we can safely call the start-game function multiple times without duplicating items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_game_owner_objet_unique'
  ) THEN
    ALTER TABLE public.inventory 
    ADD CONSTRAINT inventory_game_owner_objet_unique 
    UNIQUE (game_id, owner_num, objet);
  END IF;
END $$;