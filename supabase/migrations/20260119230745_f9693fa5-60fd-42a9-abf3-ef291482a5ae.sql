-- Allow authenticated users to view basic profile info of their friends
CREATE POLICY "Users can view friends profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.friendships
    WHERE 
      (friendships.requester_id = auth.uid() AND friendships.addressee_id = profiles.user_id)
      OR
      (friendships.addressee_id = auth.uid() AND friendships.requester_id = profiles.user_id)
  )
);