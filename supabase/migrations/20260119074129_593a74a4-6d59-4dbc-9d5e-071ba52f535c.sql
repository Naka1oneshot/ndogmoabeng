-- Add new columns to meetup_registrations for companions and notes
ALTER TABLE public.meetup_registrations
ADD COLUMN companions_count integer NOT NULL DEFAULT 0,
ADD COLUMN companions_names text[] DEFAULT '{}',
ADD COLUMN user_note text NULL;