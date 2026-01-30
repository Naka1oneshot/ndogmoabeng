-- Add admin_only column to adventures table
ALTER TABLE public.adventures 
ADD COLUMN admin_only boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.adventures.admin_only IS 'If true, only admins can launch this adventure';