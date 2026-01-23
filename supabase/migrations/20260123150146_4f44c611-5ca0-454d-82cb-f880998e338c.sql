-- Fix the get_user_email function to add proper authorization checks
-- Only allow admins or the user themselves to retrieve email

CREATE OR REPLACE FUNCTION public.get_user_email(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins/super_admins or the user themselves to get email
  IF NOT (public.is_admin_or_super(auth.uid()) OR auth.uid() = user_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins or the user themselves can access email';
  END IF;
  
  RETURN (SELECT email FROM auth.users WHERE id = user_id);
END;
$$;