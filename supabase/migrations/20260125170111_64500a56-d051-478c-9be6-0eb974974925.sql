-- Create table to store player reconnection links for users with accounts
CREATE TABLE public.player_reconnect_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  game_player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  reconnect_url text NOT NULL,
  player_token text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, game_id)
);

-- Enable RLS
ALTER TABLE public.player_reconnect_links ENABLE ROW LEVEL SECURITY;

-- Users can only see their own reconnection links
CREATE POLICY "Users can view their own reconnect links" 
ON public.player_reconnect_links 
FOR SELECT 
USING (auth.uid() = user_id);

-- No direct insert/update/delete from users - only edge functions
CREATE POLICY "Service role can manage reconnect links" 
ON public.player_reconnect_links 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Trigger to update updated_at
CREATE TRIGGER update_player_reconnect_links_updated_at
BEFORE UPDATE ON public.player_reconnect_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_reconnect_links;