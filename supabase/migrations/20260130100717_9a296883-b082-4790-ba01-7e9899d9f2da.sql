-- Migration: Allow 'EQUAL' in lion_turns.guess_choice constraint
-- This fixes the bug where selecting "ÉGAL" in Le Cœur du Lion game was rejected by DB

-- Drop existing constraint if it exists
ALTER TABLE public.lion_turns
  DROP CONSTRAINT IF EXISTS lion_turns_guess_choice_check;

-- Recreate constraint with EQUAL included
ALTER TABLE public.lion_turns
  ADD CONSTRAINT lion_turns_guess_choice_check
  CHECK (guess_choice IS NULL OR guess_choice IN ('HIGHER', 'LOWER', 'EQUAL'));