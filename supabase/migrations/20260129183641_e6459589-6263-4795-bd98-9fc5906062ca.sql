-- Add clan affinity quiz columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS clan_affinity_id TEXT NULL,
ADD COLUMN IF NOT EXISTS clan_affinity_scores JSONB NULL,
ADD COLUMN IF NOT EXISTS clan_affinity_details JSONB NULL,
ADD COLUMN IF NOT EXISTS clan_affinity_completed_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS clan_affinity_quiz_version INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS clan_affinity_seed TEXT NULL;

-- Add constraint for valid clan IDs
ALTER TABLE public.profiles
ADD CONSTRAINT check_clan_affinity_id CHECK (
  clan_affinity_id IS NULL OR
  clan_affinity_id IN (
    'maison-royale',
    'fraternite-zoulous',
    'maison-keryndes',
    'akande',
    'cercle-aseyra',
    'sources-akila',
    'ezkar'
  )
);

-- Update RLS policy for profiles to ensure users can update their own rows
-- First drop existing update policy if exists, then recreate
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);