-- Add columns to lion_game_state for adventure PVic tracking
-- adventure_cumulative_before: stores each finalist's cumulative PVic before Lion duel started
-- adventure_seed_pvic: stores the seed PVic for the duel (3/0 based on best cumulative)

ALTER TABLE public.lion_game_state 
ADD COLUMN IF NOT EXISTS adventure_cumulative_before jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS adventure_seed_pvic jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.lion_game_state.adventure_cumulative_before IS 'Stores cumulative adventure PVic for each finalist before Lion started: {playerId: totalPvicBefore}';
COMMENT ON COLUMN public.lion_game_state.adventure_seed_pvic IS 'Stores the seed PVic for the Lion duel: {playerId: seedValue} where best cumulative gets 3, other gets 0';