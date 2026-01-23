-- Add email column to event_invites if not exists
ALTER TABLE public.event_invites 
ADD COLUMN IF NOT EXISTS email text;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_event_invites_email ON public.event_invites(email);

-- Create an admin-only function to search users by email
CREATE OR REPLACE FUNCTION public.admin_search_user_by_email(search_email text)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to use this function
  IF NOT is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  RETURN QUERY
  SELECT 
    au.id as user_id,
    COALESCE(p.display_name, au.email) as display_name,
    p.avatar_url
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.user_id = au.id
  WHERE au.email ILIKE search_email
  LIMIT 1;
END;
$$;