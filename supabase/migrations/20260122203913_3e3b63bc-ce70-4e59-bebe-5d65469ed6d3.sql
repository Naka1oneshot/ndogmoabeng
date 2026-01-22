-- Première étape : Ajouter la valeur à l'enum (sera committée)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin' BEFORE 'admin';