-- Insert coming_soon_enabled setting if not exists
INSERT INTO public.system_settings (key, value)
VALUES ('coming_soon_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;