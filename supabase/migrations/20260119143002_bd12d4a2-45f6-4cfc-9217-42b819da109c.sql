-- Create a secure function to get registration count for an event
-- This allows public access to the count without exposing personal data
CREATE OR REPLACE FUNCTION public.get_event_registration_count(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.meetup_registrations
  WHERE meetup_event_id = p_event_id
    AND status != 'CANCELLED';
$$;