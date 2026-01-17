-- Create table for team messages
CREATE TABLE public.team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  sender_num INTEGER NOT NULL,
  sender_name TEXT NOT NULL,
  mate_group INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_team_messages_game_mate ON public.team_messages(game_id, mate_group);
CREATE INDEX idx_team_messages_created ON public.team_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Players can read messages from their mate group
CREATE POLICY "Players can read team messages"
ON public.team_messages
FOR SELECT
USING (true);

-- Policy: Players can insert their own messages
CREATE POLICY "Players can send team messages"
ON public.team_messages
FOR INSERT
WITH CHECK (true);

-- Enable realtime for team messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;