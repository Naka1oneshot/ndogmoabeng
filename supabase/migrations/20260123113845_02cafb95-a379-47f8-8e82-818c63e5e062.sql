
-- Create RPC function to count confirmed participants from event_invites
CREATE OR REPLACE FUNCTION public.get_event_confirmed_count(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.event_invites
  WHERE meetup_event_id = p_event_id
    AND invite_status IN ('paid', 'confirmed_unpaid');
$$;

-- Create function to auto-create invite when registration is created/updated
CREATE OR REPLACE FUNCTION public.auto_create_invite_on_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_invite_id uuid;
  v_invite_status invite_status;
BEGIN
  -- Determine invite status based on payment status
  IF NEW.payment_status = 'paid' THEN
    v_invite_status := 'paid'::invite_status;
  ELSIF NEW.payment_status IN ('callback_requested', 'pending') THEN
    v_invite_status := 'confirmed_unpaid'::invite_status;
  ELSE
    -- Don't create invite for other statuses
    RETURN NEW;
  END IF;

  -- Check if invite already exists for this registration
  SELECT id INTO v_existing_invite_id
  FROM public.event_invites
  WHERE registration_id = NEW.id;

  IF v_existing_invite_id IS NOT NULL THEN
    -- Update existing invite
    UPDATE public.event_invites
    SET 
      invite_status = v_invite_status,
      contributed_amount = CASE 
        WHEN NEW.payment_status = 'paid' AND NEW.paid_amount_cents IS NOT NULL 
        THEN NEW.paid_amount_cents / 100.0
        ELSE contributed_amount
      END,
      updated_at = now()
    WHERE id = v_existing_invite_id;
  ELSE
    -- Check if invite exists by phone or name (for linking)
    SELECT id INTO v_existing_invite_id
    FROM public.event_invites
    WHERE meetup_event_id = NEW.meetup_event_id
      AND registration_id IS NULL
      AND (
        (phone IS NOT NULL AND phone = NEW.phone)
        OR (full_name ILIKE '%' || NEW.display_name || '%')
      )
    LIMIT 1;

    IF v_existing_invite_id IS NOT NULL THEN
      -- Link existing invite to registration
      UPDATE public.event_invites
      SET 
        registration_id = NEW.id,
        invite_status = v_invite_status,
        contributed_amount = CASE 
          WHEN NEW.payment_status = 'paid' AND NEW.paid_amount_cents IS NOT NULL 
          THEN NEW.paid_amount_cents / 100.0
          ELSE contributed_amount
        END,
        phone = COALESCE(phone, NEW.phone),
        updated_at = now()
      WHERE id = v_existing_invite_id;
    ELSE
      -- Create new invite
      INSERT INTO public.event_invites (
        meetup_event_id,
        full_name,
        phone,
        invite_status,
        registration_id,
        contributed_amount
      ) VALUES (
        NEW.meetup_event_id,
        NEW.display_name,
        NEW.phone,
        v_invite_status,
        NEW.id,
        CASE 
          WHEN NEW.payment_status = 'paid' AND NEW.paid_amount_cents IS NOT NULL 
          THEN NEW.paid_amount_cents / 100.0
          ELSE NULL
        END
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on meetup_registrations
DROP TRIGGER IF EXISTS trigger_auto_create_invite ON public.meetup_registrations;
CREATE TRIGGER trigger_auto_create_invite
  AFTER INSERT OR UPDATE OF payment_status, paid_amount_cents
  ON public.meetup_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_invite_on_registration();
