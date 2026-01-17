-- Allow players to insert their own actions
CREATE POLICY "Players can insert their own actions"
ON public.actions
FOR INSERT
WITH CHECK (true);

-- Allow players to update their own actions
CREATE POLICY "Players can update their own actions"
ON public.actions
FOR UPDATE
USING (true);

-- Allow players to view actions for their game
CREATE POLICY "Players can view actions"
ON public.actions
FOR SELECT
USING (true);