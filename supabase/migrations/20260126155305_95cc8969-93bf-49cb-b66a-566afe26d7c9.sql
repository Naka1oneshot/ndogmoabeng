-- Add INSERT policy for MJ/host to insert game_events (for ADVENTURE_CINEMATIC broadcasts)
-- The existing "Host can manage game_events" policy only has USING clause which doesn't apply to INSERT
-- We need a WITH CHECK clause for INSERT operations

-- First, drop the existing policy and recreate with proper WITH CHECK
DROP POLICY IF EXISTS "Host can manage game_events" ON public.game_events;

-- Create a proper policy for hosts that covers all operations including INSERT
CREATE POLICY "Host can manage game_events"
ON public.game_events
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = game_events.game_id
      AND g.host_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = game_events.game_id
      AND g.host_user_id = auth.uid()
  )
);