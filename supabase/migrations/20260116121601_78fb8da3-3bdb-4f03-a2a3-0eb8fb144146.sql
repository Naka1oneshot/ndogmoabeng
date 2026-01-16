-- Add device_id column to game_players
ALTER TABLE public.game_players 
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Create session_bans table
CREATE TABLE IF NOT EXISTS public.session_bans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, device_id)
);

-- Enable RLS on session_bans
ALTER TABLE public.session_bans ENABLE ROW LEVEL SECURITY;

-- Policies for session_bans
CREATE POLICY "Host can manage session_bans" 
ON public.session_bans 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM games g 
  WHERE g.id = session_bans.game_id AND g.host_user_id = auth.uid()
));

CREATE POLICY "Anyone can view session_bans for joining" 
ON public.session_bans 
FOR SELECT 
USING (true);

-- Add unique constraint for device_id per game (only for non-null device_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_players_game_device 
ON public.game_players(game_id, device_id) 
WHERE device_id IS NOT NULL AND status = 'ACTIVE';

-- Enable realtime for session_bans
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_bans;