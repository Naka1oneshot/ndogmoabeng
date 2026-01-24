-- Add bot_config column to sheriff_round_state for storing bot behavior settings
ALTER TABLE public.sheriff_round_state 
ADD COLUMN IF NOT EXISTS bot_config JSONB DEFAULT NULL;