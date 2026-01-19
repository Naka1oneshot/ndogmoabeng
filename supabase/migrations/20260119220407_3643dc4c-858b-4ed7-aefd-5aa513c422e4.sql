-- Rename token_games_creatable to token_balance (new unified token system)
-- Each token = 1 game init OR 1 game with clan advantage
ALTER TABLE public.user_subscription_bonuses 
  RENAME COLUMN token_games_creatable TO token_balance;

-- Drop old token_games_joinable column (no longer needed)
ALTER TABLE public.user_subscription_bonuses 
  DROP COLUMN IF EXISTS token_games_joinable;

-- Add column to track token usage for clan advantages this month
ALTER TABLE public.user_subscription_bonuses 
  ADD COLUMN IF NOT EXISTS tokens_used_for_clan INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_used_for_init INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_reset_at TIMESTAMP WITH TIME ZONE DEFAULT now();