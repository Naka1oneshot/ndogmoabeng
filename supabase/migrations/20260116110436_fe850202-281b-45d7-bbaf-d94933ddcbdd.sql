-- Add columns for tracking removal details
ALTER TABLE public.game_players 
ADD COLUMN IF NOT EXISTS removed_reason text,
ADD COLUMN IF NOT EXISTS removed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS removed_by uuid;