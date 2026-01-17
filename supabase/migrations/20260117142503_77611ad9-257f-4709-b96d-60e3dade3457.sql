-- Create game_events table for historical tracking
CREATE TABLE public.game_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  manche INTEGER NOT NULL DEFAULT 1,
  phase TEXT NOT NULL DEFAULT 'PHASE1_MISES',
  visibility TEXT NOT NULL DEFAULT 'MJ' CHECK (visibility IN ('MJ', 'PUBLIC')),
  event_type TEXT NOT NULL,
  player_id UUID,
  player_num INTEGER,
  message TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_game_events_game_manche_phase ON public.game_events(game_id, manche, phase);
CREATE INDEX idx_game_events_created_at ON public.game_events(created_at);

-- Enable RLS
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

-- Host can manage all events
CREATE POLICY "Host can manage game_events"
ON public.game_events
FOR ALL
USING (EXISTS (
  SELECT 1 FROM games g
  WHERE g.id = game_events.game_id AND g.host_user_id = auth.uid()
));

-- Players can view PUBLIC events
CREATE POLICY "Players can view public events"
ON public.game_events
FOR SELECT
USING (visibility = 'PUBLIC');

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_events;