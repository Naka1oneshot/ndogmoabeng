-- Create game_invitations table for tracking game invites between users
CREATE TABLE public.game_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  invited_by_user_id UUID NOT NULL,
  invited_user_id UUID NOT NULL,
  game_name TEXT NOT NULL,
  join_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.game_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view invitations they sent or received
CREATE POLICY "Users can view their invitations"
ON public.game_invitations
FOR SELECT
USING (auth.uid() = invited_by_user_id OR auth.uid() = invited_user_id);

-- Policy: Users can create invitations
CREATE POLICY "Users can create invitations"
ON public.game_invitations
FOR INSERT
WITH CHECK (auth.uid() = invited_by_user_id);

-- Policy: Invited users can update invitation status (accept/decline)
CREATE POLICY "Invited users can update invitation status"
ON public.game_invitations
FOR UPDATE
USING (auth.uid() = invited_user_id);

-- Policy: Users can delete their own sent invitations
CREATE POLICY "Users can delete their sent invitations"
ON public.game_invitations
FOR DELETE
USING (auth.uid() = invited_by_user_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_invitations;

-- Create index for performance
CREATE INDEX idx_game_invitations_invited_user ON public.game_invitations(invited_user_id, status);
CREATE INDEX idx_game_invitations_invited_by ON public.game_invitations(invited_by_user_id);