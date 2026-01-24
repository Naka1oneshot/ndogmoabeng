-- Add distribution_details column to river_level_history to track per-player token gains
ALTER TABLE public.river_level_history 
ADD COLUMN IF NOT EXISTS distribution_details jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.river_level_history.distribution_details IS 'JSON array of {player_id, display_name, cagnotte_share, level_bonus, total_gain} for each beneficiary when outcome is FAIL or SUCCESS at level 5';