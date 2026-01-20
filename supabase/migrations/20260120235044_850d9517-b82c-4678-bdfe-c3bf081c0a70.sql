-- Add type and image_url columns to monster_catalog
ALTER TABLE public.monster_catalog 
ADD COLUMN IF NOT EXISTS type TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Update monster data with proper names and types based on user's mapping
UPDATE public.monster_catalog SET name = 'Pangolin', type = 'Classique' WHERE id = 1;
UPDATE public.monster_catalog SET name = 'Pangolin', type = 'Classique' WHERE id = 2;
UPDATE public.monster_catalog SET name = 'Mamba Vert', type = 'Élite' WHERE id = 3;
UPDATE public.monster_catalog SET name = 'Taipan du Désert', type = 'Élite' WHERE id = 4;
UPDATE public.monster_catalog SET name = 'Tigre', type = 'Épique' WHERE id = 5;
UPDATE public.monster_catalog SET name = 'Moustique Tigre', type = 'Féroce' WHERE id = 6;
UPDATE public.monster_catalog SET name = 'Jaguar', type = 'Héroïque' WHERE id = 7;