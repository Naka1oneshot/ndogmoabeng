-- Create system_settings table for global app configuration
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings
CREATE POLICY "Anyone can read system_settings"
ON public.system_settings
FOR SELECT
USING (true);

-- Only super admins can update settings
CREATE POLICY "Super admins can update system_settings"
ON public.system_settings
FOR UPDATE
USING (is_super_admin(auth.uid()));

-- Only super admins can insert settings
CREATE POLICY "Super admins can insert system_settings"
ON public.system_settings
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

-- Insert default chat settings (all disabled by default as requested)
INSERT INTO public.system_settings (key, value) VALUES 
  ('chat_config', '{
    "general_chat_enabled": false,
    "lobby_chat_enabled": true,
    "ingame_chat_enabled": true,
    "max_messages_per_game": 100
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;