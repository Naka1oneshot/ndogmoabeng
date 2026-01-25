-- Add pvic_initial to track starting PVic when Sheriff game begins
ALTER TABLE sheriff_player_choices 
ADD COLUMN IF NOT EXISTS pvic_initial INTEGER DEFAULT 0;

-- Comment for clarity
COMMENT ON COLUMN sheriff_player_choices.pvic_initial IS 'PVic du joueur au moment du lancement de la partie Sheriff';