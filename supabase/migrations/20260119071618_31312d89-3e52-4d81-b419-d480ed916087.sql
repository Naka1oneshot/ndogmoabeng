-- Create meetup_events table
CREATE TABLE public.meetup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  city text NOT NULL,
  venue text NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  expected_players integer NOT NULL DEFAULT 0,
  price_eur numeric NOT NULL DEFAULT 0,
  pot_contribution_eur numeric NOT NULL DEFAULT 0,
  pot_potential_eur numeric NOT NULL DEFAULT 0,
  video_url text NULL,
  audio_url text NULL,
  cover_image_url text NULL,
  status text NOT NULL DEFAULT 'UPCOMING',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create meetup_registrations table
CREATE TABLE public.meetup_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_event_id uuid NOT NULL REFERENCES meetup_events(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'NEW',
  admin_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meetup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetup_registrations ENABLE ROW LEVEL SECURITY;

-- RLS policies for meetup_events
-- Public can view all events
CREATE POLICY "Anyone can view meetup events"
ON public.meetup_events
FOR SELECT
USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can manage meetup events"
ON public.meetup_events
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS policies for meetup_registrations
-- Public can insert registrations for UPCOMING events
CREATE POLICY "Anyone can register for upcoming events"
ON public.meetup_registrations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meetup_events 
    WHERE id = meetup_event_id 
    AND status = 'UPCOMING'
  )
);

-- Only admins can view registrations
CREATE POLICY "Admins can view registrations"
ON public.meetup_registrations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update registrations
CREATE POLICY "Admins can update registrations"
ON public.meetup_registrations
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete registrations
CREATE POLICY "Admins can delete registrations"
ON public.meetup_registrations
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Seed the initial event "La carte trouvée"
INSERT INTO public.meetup_events (
  slug,
  title,
  description,
  city,
  start_at,
  end_at,
  expected_players,
  price_eur,
  pot_contribution_eur,
  pot_potential_eur,
  video_url,
  audio_url,
  status
) VALUES (
  'la-carte-trouvee-2026-01-31',
  'La carte trouvée',
  'Prépare-toi à entrer dans une nuit où chaque choix compte, où les esprits s''affrontent dans l''ombre… En équipe de deux, tu devras faire preuve de stratégie, d''intuition et de coordination pour accumuler des jetons. À l''issue de la soirée, l''équipe la plus brillante remportera le trésor dissimulée de Ndogmoabeng.',
  'Paris',
  '2026-01-31 16:00:00+00',
  '2026-01-31 22:00:00+00',
  20,
  25,
  5,
  100,
  '/media/meetup-video.mp4',
  '/media/meetup-audio.mp3',
  'UPCOMING'
);

-- Enable realtime for registrations (for admin live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetup_registrations;