-- Add payment tracking to meetup_registrations
ALTER TABLE public.meetup_registrations
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending' NOT NULL,
ADD COLUMN IF NOT EXISTS stripe_session_id text,
ADD COLUMN IF NOT EXISTS paid_amount_cents integer,
ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Add index for payment lookup
CREATE INDEX IF NOT EXISTS idx_meetup_registrations_stripe_session 
ON public.meetup_registrations(stripe_session_id) 
WHERE stripe_session_id IS NOT NULL;

-- Comment
COMMENT ON COLUMN public.meetup_registrations.payment_status IS 'Payment status: pending, paid, failed, free';
COMMENT ON COLUMN public.meetup_registrations.stripe_session_id IS 'Stripe checkout session ID';
COMMENT ON COLUMN public.meetup_registrations.paid_amount_cents IS 'Amount paid in cents';
COMMENT ON COLUMN public.meetup_registrations.paid_at IS 'Payment confirmation timestamp';