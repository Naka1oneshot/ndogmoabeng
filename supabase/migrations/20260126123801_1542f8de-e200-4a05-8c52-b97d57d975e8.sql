-- 1. Drop existing CHECK constraint on visibility and add new one with PRIVATE
ALTER TABLE public.game_events DROP CONSTRAINT IF EXISTS game_events_visibility_check;

ALTER TABLE public.game_events ADD CONSTRAINT game_events_visibility_check 
  CHECK (visibility IN ('MJ', 'PUBLIC', 'PRIVATE'));

-- 2. Add RLS policy for players to view their own private events
CREATE POLICY "Players can view private events"
ON public.game_events
FOR SELECT
USING (
  visibility = 'PRIVATE' 
  AND (
    -- Match by player_id (UUID of game_player row)
    player_id IN (
      SELECT gp.id FROM public.game_players gp 
      WHERE gp.game_id = game_events.game_id 
      AND gp.user_id = auth.uid()
    )
    OR
    -- Match by player_num for the current user in this game
    player_num IN (
      SELECT gp.player_number FROM public.game_players gp 
      WHERE gp.game_id = game_events.game_id 
      AND gp.user_id = auth.uid()
    )
  )
);