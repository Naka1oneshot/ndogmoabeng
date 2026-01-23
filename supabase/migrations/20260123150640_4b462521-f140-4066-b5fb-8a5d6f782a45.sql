-- Create login_history table to track user login events
CREATE TABLE public.login_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  logged_in_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  device_type text,
  browser text,
  os text,
  country text,
  city text
);

-- Enable RLS
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- Users can only view their own login history
CREATE POLICY "Users can view their own login history"
ON public.login_history
FOR SELECT
USING (auth.uid() = user_id);

-- Service role can insert login history (from edge function)
CREATE POLICY "Service role can insert login history"
ON public.login_history
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_login_history_user_id ON public.login_history(user_id);
CREATE INDEX idx_login_history_logged_in_at ON public.login_history(logged_in_at DESC);

-- Enable realtime for login_history
ALTER PUBLICATION supabase_realtime ADD TABLE public.login_history;