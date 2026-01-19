-- Create a function to get user email by id (for admin display)
CREATE OR REPLACE FUNCTION public.get_user_email(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = user_id;
$$;

-- Grant execute to authenticated users (will be filtered by has_role in frontend)
GRANT EXECUTE ON FUNCTION public.get_user_email(uuid) TO authenticated;