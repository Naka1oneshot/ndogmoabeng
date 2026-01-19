-- Create friend_chat_messages table for chat between friends
CREATE TABLE public.friend_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text', -- 'text' or 'game_invite'
  payload JSONB, -- For game invites: { game_id, game_name, join_code }
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.friend_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view messages they sent or received
CREATE POLICY "Users can view their messages"
ON public.friend_chat_messages
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Policy: Users can send messages (only to friends - validated in app)
CREATE POLICY "Users can send messages"
ON public.friend_chat_messages
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Policy: Users can mark messages as read
CREATE POLICY "Users can update their received messages"
ON public.friend_chat_messages
FOR UPDATE
USING (auth.uid() = receiver_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_chat_messages;

-- Create indexes for performance
CREATE INDEX idx_friend_chat_sender ON public.friend_chat_messages(sender_id, created_at DESC);
CREATE INDEX idx_friend_chat_receiver ON public.friend_chat_messages(receiver_id, created_at DESC);
CREATE INDEX idx_friend_chat_unread ON public.friend_chat_messages(receiver_id, read_at) WHERE read_at IS NULL;