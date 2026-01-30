-- Add scoring configuration columns to lion_game_state
ALTER TABLE public.lion_game_state
  ADD COLUMN IF NOT EXISTS scoring_equal_correct integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS scoring_equal_wrong integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS scoring_use_diff boolean NOT NULL DEFAULT true;

-- Comments for clarity
COMMENT ON COLUMN public.lion_game_state.scoring_equal_correct IS 'Points when guesser correctly predicts EQUAL';
COMMENT ON COLUMN public.lion_game_state.scoring_equal_wrong IS 'Points to active player when guesser fails to predict equality';
COMMENT ON COLUMN public.lion_game_state.scoring_use_diff IS 'If true, use |A-D| for non-equal outcomes; if false could use fixed value';