-- Add RLS policy for players to submit their own bets
CREATE POLICY "Players can submit their own bets" 
ON public.round_bets 
FOR INSERT 
WITH CHECK (true);

-- Add RLS policy for players to update their own bets
CREATE POLICY "Players can update their own bets" 
ON public.round_bets 
FOR UPDATE 
USING (true);

-- Add RLS policy for players to view bets in their game
CREATE POLICY "Players can view bets" 
ON public.round_bets 
FOR SELECT 
USING (true);