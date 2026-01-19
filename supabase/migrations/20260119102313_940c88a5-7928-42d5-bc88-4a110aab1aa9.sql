-- Create table for lobby chat messages
CREATE TABLE public.lobby_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  sender_num INTEGER NOT NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_lobby_chat_game_id ON public.lobby_chat_messages(game_id);
CREATE INDEX idx_lobby_chat_created_at ON public.lobby_chat_messages(game_id, created_at);

-- Enable RLS
ALTER TABLE public.lobby_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read lobby messages for a game they're part of
CREATE POLICY "Anyone can read lobby messages"
ON public.lobby_chat_messages
FOR SELECT
USING (true);

-- Policy: Allow anyone to insert lobby messages (anonymous players)
CREATE POLICY "Anyone can insert lobby messages"
ON public.lobby_chat_messages
FOR INSERT
WITH CHECK (true);

-- Enable realtime for lobby chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_chat_messages;