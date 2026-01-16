-- Add phase and phase_locked columns to games table
ALTER TABLE public.games 
ADD COLUMN phase text NOT NULL DEFAULT 'PHASE1_MISES',
ADD COLUMN phase_locked boolean NOT NULL DEFAULT false;

-- Add constraint for phase values
ALTER TABLE public.games 
ADD CONSTRAINT games_phase_check 
CHECK (phase IN ('PHASE1_MISES', 'PHASE2_POSITIONS', 'PHASE3_SHOP', 'PHASE4_COMBAT', 'RESOLUTION'));

-- Create session_events table for event logging
CREATE TABLE public.session_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  audience text NOT NULL DEFAULT 'ALL',
  type text NOT NULL DEFAULT 'SYSTEM',
  message text NOT NULL,
  payload jsonb
);

-- Add constraints for audience and type
ALTER TABLE public.session_events 
ADD CONSTRAINT session_events_audience_check 
CHECK (audience IN ('ALL', 'MJ'));

ALTER TABLE public.session_events 
ADD CONSTRAINT session_events_type_check 
CHECK (type IN ('SYSTEM', 'PHASE', 'COMBAT', 'SHOP', 'INFO', 'ADMIN'));

-- Enable RLS on session_events
ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

-- Host can manage all events
CREATE POLICY "Host can manage session_events" 
ON public.session_events 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM games g WHERE g.id = session_events.game_id AND g.host_user_id = auth.uid()
));

-- Players can view public events (audience = 'ALL')
CREATE POLICY "Players can view public events" 
ON public.session_events 
FOR SELECT 
USING (audience = 'ALL');

-- Enable realtime for session_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_events;