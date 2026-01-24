-- Drop the existing delete policy
DROP POLICY IF EXISTS "Host can delete their games" ON public.games;

-- Create a new policy that allows host OR super admin to delete games
CREATE POLICY "Host or super admin can delete games" 
ON public.games 
FOR DELETE 
USING (
  auth.uid() = host_user_id 
  OR is_super_admin(auth.uid())
);