-- Créer le bucket pour les assets de jeux
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-assets', 'game-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Politique: tout le monde peut lire les assets
CREATE POLICY "Public can view game assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'game-assets');

-- Politique: seuls les admins peuvent uploader
CREATE POLICY "Admins can upload game assets"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'game-assets' AND is_admin_or_super(auth.uid()));

-- Politique: seuls les admins peuvent modifier
CREATE POLICY "Admins can update game assets"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'game-assets' AND is_admin_or_super(auth.uid()));

-- Politique: seuls les admins peuvent supprimer
CREATE POLICY "Admins can delete game assets"
ON storage.objects
FOR DELETE
USING (bucket_id = 'game-assets' AND is_admin_or_super(auth.uid()));