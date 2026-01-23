-- Create enum types for statuses
CREATE TYPE invite_status AS ENUM (
  'paid',
  'confirmed_unpaid',
  'pending',
  'free',
  'declined',
  'not_invited_yet',
  'not_invited'
);

CREATE TYPE budget_scenario AS ENUM (
  'pessimiste',
  'probable',
  'optimiste'
);

CREATE TYPE task_status AS ENUM (
  'not_started',
  'in_progress',
  'completed',
  'blocked'
);

-- Table event_invites (guest list)
CREATE TABLE public.event_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meetup_event_id UUID NOT NULL REFERENCES public.meetup_events(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  profiles TEXT,
  invite_status invite_status NOT NULL DEFAULT 'pending',
  invited_by TEXT,
  pack_label TEXT,
  parking_amount NUMERIC DEFAULT 0,
  contributed_amount NUMERIC DEFAULT 0,
  followup_date DATE,
  cash_box TEXT,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  registration_id UUID REFERENCES public.meetup_registrations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table event_expense_items (budget expenses)
CREATE TABLE public.event_expense_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meetup_event_id UUID NOT NULL REFERENCES public.meetup_events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  expense_type TEXT NOT NULL,
  state TEXT,
  order_date DATE,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  qty_pessimiste NUMERIC DEFAULT 0,
  qty_probable NUMERIC DEFAULT 0,
  qty_optimiste NUMERIC DEFAULT 0,
  qty_real NUMERIC,
  real_unit_cost NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table event_financial_settings (per event settings)
CREATE TABLE public.event_financial_settings (
  meetup_event_id UUID PRIMARY KEY REFERENCES public.meetup_events(id) ON DELETE CASCADE,
  scenario_active budget_scenario NOT NULL DEFAULT 'probable',
  opening_balance NUMERIC DEFAULT 0,
  investment_budget NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table event_tasks
CREATE TABLE public.event_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meetup_event_id UUID NOT NULL REFERENCES public.meetup_events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status task_status NOT NULL DEFAULT 'not_started',
  owner_label TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stage TEXT,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_financial_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_invites (admin only)
CREATE POLICY "Admins can view all invites"
  ON public.event_invites FOR SELECT
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can insert invites"
  ON public.event_invites FOR INSERT
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can update invites"
  ON public.event_invites FOR UPDATE
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can delete invites"
  ON public.event_invites FOR DELETE
  USING (public.is_admin_or_super(auth.uid()));

-- RLS Policies for event_expense_items (admin only)
CREATE POLICY "Admins can view all expenses"
  ON public.event_expense_items FOR SELECT
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can insert expenses"
  ON public.event_expense_items FOR INSERT
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can update expenses"
  ON public.event_expense_items FOR UPDATE
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can delete expenses"
  ON public.event_expense_items FOR DELETE
  USING (public.is_admin_or_super(auth.uid()));

-- RLS Policies for event_financial_settings (admin only)
CREATE POLICY "Admins can view financial settings"
  ON public.event_financial_settings FOR SELECT
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can insert financial settings"
  ON public.event_financial_settings FOR INSERT
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can update financial settings"
  ON public.event_financial_settings FOR UPDATE
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can delete financial settings"
  ON public.event_financial_settings FOR DELETE
  USING (public.is_admin_or_super(auth.uid()));

-- RLS Policies for event_tasks (admin only)
CREATE POLICY "Admins can view all tasks"
  ON public.event_tasks FOR SELECT
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can insert tasks"
  ON public.event_tasks FOR INSERT
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can update tasks"
  ON public.event_tasks FOR UPDATE
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can delete tasks"
  ON public.event_tasks FOR DELETE
  USING (public.is_admin_or_super(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_event_invites_event ON public.event_invites(meetup_event_id);
CREATE INDEX idx_event_invites_status ON public.event_invites(invite_status);
CREATE INDEX idx_event_invites_phone ON public.event_invites(phone);
CREATE INDEX idx_event_expense_items_event ON public.event_expense_items(meetup_event_id);
CREATE INDEX idx_event_expense_items_type ON public.event_expense_items(expense_type);
CREATE INDEX idx_event_tasks_event ON public.event_tasks(meetup_event_id);
CREATE INDEX idx_event_tasks_status ON public.event_tasks(status);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_event_invites_updated_at
  BEFORE UPDATE ON public.event_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_expense_items_updated_at
  BEFORE UPDATE ON public.event_expense_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_financial_settings_updated_at
  BEFORE UPDATE ON public.event_financial_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_tasks_updated_at
  BEFORE UPDATE ON public.event_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-link invites with registrations
CREATE OR REPLACE FUNCTION public.link_invite_to_registration()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to find matching invite by phone or name
  UPDATE public.event_invites
  SET 
    registration_id = NEW.id,
    invite_status = CASE 
      WHEN NEW.payment_status = 'paid' THEN 'paid'::invite_status
      ELSE invite_status
    END,
    contributed_amount = CASE 
      WHEN NEW.payment_status = 'paid' AND NEW.paid_amount_cents IS NOT NULL 
      THEN GREATEST(contributed_amount, NEW.paid_amount_cents / 100.0)
      ELSE contributed_amount
    END
  WHERE meetup_event_id = NEW.meetup_event_id
    AND registration_id IS NULL
    AND (
      (phone IS NOT NULL AND phone = NEW.phone)
      OR (full_name ILIKE '%' || NEW.display_name || '%')
      OR (NEW.display_name ILIKE '%' || full_name || '%')
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER auto_link_registration_to_invite
  AFTER INSERT OR UPDATE ON public.meetup_registrations
  FOR EACH ROW EXECUTE FUNCTION public.link_invite_to_registration();

-- Function to sync payment status from registration to invite
CREATE OR REPLACE FUNCTION public.sync_registration_payment_to_invite()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND OLD.payment_status != 'paid' THEN
    UPDATE public.event_invites
    SET 
      invite_status = 'paid'::invite_status,
      contributed_amount = GREATEST(contributed_amount, COALESCE(NEW.paid_amount_cents, 0) / 100.0)
    WHERE registration_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER sync_payment_to_invite
  AFTER UPDATE ON public.meetup_registrations
  FOR EACH ROW EXECUTE FUNCTION public.sync_registration_payment_to_invite();

-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_expense_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_tasks;