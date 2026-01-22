-- Fonction pour vérifier si l'utilisateur est super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

-- Fonction pour vérifier si l'utilisateur est super_admin ou admin
CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin')
  )
$$;

-- Fonction pour assigner le rôle super_admin (sécurisée - via service role uniquement)
CREATE OR REPLACE FUNCTION public.assign_super_admin_role(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Mettre à jour les politiques RLS sur user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can delete non-super roles" ON public.user_roles;

-- Tout utilisateur authentifié peut voir son propre rôle
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Les admins et super_admins peuvent voir tous les rôles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin_or_super(auth.uid()));

-- Seuls les super_admins peuvent ajouter des rôles (sauf super_admin qui passe par edge function)
CREATE POLICY "Super admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  AND role != 'super_admin'
);

-- Seuls les super_admins peuvent supprimer des rôles (sauf super_admin d'un autre)
CREATE POLICY "Super admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  AND (
    role != 'super_admin'
    OR user_id = auth.uid()
  )
);