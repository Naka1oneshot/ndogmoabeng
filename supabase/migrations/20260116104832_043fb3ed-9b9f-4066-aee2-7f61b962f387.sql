-- Add DELETE policy for hosts on games table
CREATE POLICY "Host can delete their games"
ON public.games
FOR DELETE
USING (auth.uid() = host_user_id);