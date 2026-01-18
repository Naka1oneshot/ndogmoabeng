-- Create enum for game type status
CREATE TYPE public.game_type_status AS ENUM ('PROJECT', 'COMING_SOON', 'AVAILABLE');

-- Add status column to game_types table
ALTER TABLE public.game_types 
ADD COLUMN status public.game_type_status NOT NULL DEFAULT 'PROJECT';

-- Update existing game types with appropriate statuses
UPDATE public.game_types SET status = 'AVAILABLE' WHERE code = 'FORET';
UPDATE public.game_types SET status = 'COMING_SOON' WHERE code IN ('RIVIERES', 'INFECTION');
-- Any other game types remain as 'PROJECT' by default