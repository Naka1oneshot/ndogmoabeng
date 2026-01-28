-- Ajouter des colonnes de présentation à game_types pour permettre l'édition admin
ALTER TABLE public.game_types 
ADD COLUMN IF NOT EXISTS tagline TEXT,
ADD COLUMN IF NOT EXISTS lieu TEXT,
ADD COLUMN IF NOT EXISTS clan TEXT,
ADD COLUMN IF NOT EXISTS personnages TEXT[],
ADD COLUMN IF NOT EXISTS objet_cle TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS min_players INTEGER DEFAULT 2;

-- Mettre à jour les données existantes
UPDATE public.game_types SET 
  tagline = 'Le bateau en faillite',
  lieu = 'Les Rivières du nord de Ndogmoabeng',
  clan = 'Maison des Keryndes',
  personnages = ARRAY['Capitaine du nord'],
  min_players = 2
WHERE code = 'RIVIERES';

UPDATE public.game_types SET 
  tagline = 'La traversée',
  lieu = 'Les forêts autour du centre',
  clan = 'Cercle d''Aséyra',
  objet_cle = 'L''Essence de Ndogmoabeng',
  min_players = 2
WHERE code = 'FORET';

UPDATE public.game_types SET 
  tagline = 'Le contrôle',
  lieu = 'Les portes du Centre',
  clan = 'Maison Royale',
  personnages = ARRAY['Shérif du Centre'],
  min_players = 2
WHERE code = 'SHERIFF';

UPDATE public.game_types SET 
  tagline = 'La contamination',
  lieu = 'Centre du village',
  clan = 'La ligue d''Ezkar',
  personnages = ARRAY['Bras armé', 'Capitaine du nord', 'Sans cercle', 'Oeil du crépuscule', 'Synthétiste'],
  min_players = 7
WHERE code = 'INFECTION';

-- Politique RLS pour permettre aux admins de modifier game_types
CREATE POLICY "Admins can update game_types"
ON public.game_types
FOR UPDATE
TO authenticated
USING (is_admin_or_super(auth.uid()))
WITH CHECK (is_admin_or_super(auth.uid()));