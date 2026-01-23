
-- Update RPC function to count confirmed participants including free invites
CREATE OR REPLACE FUNCTION public.get_event_confirmed_count(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.event_invites
  WHERE meetup_event_id = p_event_id
    AND invite_status IN ('paid', 'confirmed_unpaid', 'free');
$$;
