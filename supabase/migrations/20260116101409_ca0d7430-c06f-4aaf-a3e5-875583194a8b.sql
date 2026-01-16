-- Remove the overly permissive policy (we'll use edge function for presence updates)
DROP POLICY IF EXISTS "Players can update their own presence" ON public.game_players;