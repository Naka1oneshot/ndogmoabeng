-- Drop the existing SELECT policy that only allows authenticated users
DROP POLICY IF EXISTS "Tout le monde peut voir les parties en LOBBY par join_code" ON public.games;

-- Create a new SELECT policy that allows both authenticated and anonymous users to see games
CREATE POLICY "Anyone can view games by join_code"
ON public.games
FOR SELECT
USING (true);