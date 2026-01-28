-- =====================================================
-- SHERIFF: Support for Final Duel (Q5 - Unpaired Player)
-- =====================================================

-- Add columns to sheriff_round_state for tracking final duel state
ALTER TABLE public.sheriff_round_state
ADD COLUMN IF NOT EXISTS unpaired_player_num integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS final_duel_challenger_num integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS final_duel_status text DEFAULT 'NONE' CHECK (final_duel_status IN ('NONE', 'PENDING_RECHOICE', 'READY', 'RESOLVED')),
ADD COLUMN IF NOT EXISTS final_duel_id uuid DEFAULT NULL;

-- Add column to sheriff_duels to mark it as the final duel
ALTER TABLE public.sheriff_duels
ADD COLUMN IF NOT EXISTS is_final boolean DEFAULT false;

-- Add columns to sheriff_player_choices for final duel token re-choice
ALTER TABLE public.sheriff_player_choices
ADD COLUMN IF NOT EXISTS tokens_entering_final integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tokens_entering_final_confirmed boolean DEFAULT false;

-- Add foreign key constraint (optional, for data integrity)
-- We skip FK on final_duel_id to avoid circular dependencies

COMMENT ON COLUMN public.sheriff_round_state.unpaired_player_num IS 'Player number left without a duel partner (odd player count)';
COMMENT ON COLUMN public.sheriff_round_state.final_duel_challenger_num IS 'Player number of the biggest PVic loser, chosen to re-duel the unpaired player';
COMMENT ON COLUMN public.sheriff_round_state.final_duel_status IS 'State machine for final duel: NONE -> PENDING_RECHOICE -> READY -> RESOLVED';
COMMENT ON COLUMN public.sheriff_round_state.final_duel_id IS 'UUID of the final duel in sheriff_duels';
COMMENT ON COLUMN public.sheriff_duels.is_final IS 'True if this duel is the special final duel for unpaired player';
COMMENT ON COLUMN public.sheriff_player_choices.tokens_entering_final IS 'Tokens chosen by challenger for final duel (21-30)';
COMMENT ON COLUMN public.sheriff_player_choices.tokens_entering_final_confirmed IS 'True when challenger has confirmed their final duel tokens';