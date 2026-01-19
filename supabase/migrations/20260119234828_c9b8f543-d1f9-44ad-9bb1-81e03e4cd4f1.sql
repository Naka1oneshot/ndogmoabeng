-- Table pour tracker les points de fidélité NDG
CREATE TABLE public.loyalty_points (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  balance integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  total_spent integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index unique sur user_id pour garantir un seul enregistrement par utilisateur
CREATE UNIQUE INDEX loyalty_points_user_id_idx ON public.loyalty_points(user_id);

-- Table pour l'historique des transactions de points
CREATE TABLE public.loyalty_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('earned', 'spent', 'granted', 'adjustment')),
  source text NOT NULL,
  note text,
  granted_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX loyalty_transactions_user_id_idx ON public.loyalty_transactions(user_id);
CREATE INDEX loyalty_transactions_created_at_idx ON public.loyalty_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for loyalty_points
CREATE POLICY "Users can view their own loyalty points"
ON public.loyalty_points
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all loyalty points"
ON public.loyalty_points
FOR ALL
USING (true)
WITH CHECK (true);

-- Policies for loyalty_transactions
CREATE POLICY "Users can view their own transactions"
ON public.loyalty_transactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all transactions"
ON public.loyalty_transactions
FOR ALL
USING (true)
WITH CHECK (true);

-- Function to add loyalty points
CREATE OR REPLACE FUNCTION public.add_loyalty_points(
  p_user_id uuid,
  p_amount integer,
  p_transaction_type text,
  p_source text,
  p_note text DEFAULT NULL,
  p_granted_by uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  -- Insert or update loyalty points balance
  INSERT INTO public.loyalty_points (user_id, balance, total_earned, updated_at)
  VALUES (p_user_id, p_amount, CASE WHEN p_amount > 0 THEN p_amount ELSE 0 END, now())
  ON CONFLICT (user_id) DO UPDATE SET
    balance = loyalty_points.balance + p_amount,
    total_earned = CASE WHEN p_amount > 0 THEN loyalty_points.total_earned + p_amount ELSE loyalty_points.total_earned END,
    total_spent = CASE WHEN p_amount < 0 THEN loyalty_points.total_spent + ABS(p_amount) ELSE loyalty_points.total_spent END,
    updated_at = now()
  RETURNING balance INTO v_new_balance;

  -- Record the transaction
  INSERT INTO public.loyalty_transactions (user_id, amount, transaction_type, source, note, granted_by)
  VALUES (p_user_id, p_amount, p_transaction_type, p_source, p_note, p_granted_by);

  RETURN v_new_balance;
END;
$$;

-- Function to get user loyalty info
CREATE OR REPLACE FUNCTION public.get_user_loyalty_info(p_user_id uuid)
RETURNS TABLE(balance integer, total_earned integer, total_spent integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(lp.balance, 0) as balance,
    COALESCE(lp.total_earned, 0) as total_earned,
    COALESCE(lp.total_spent, 0) as total_spent
  FROM (SELECT 1) dummy
  LEFT JOIN public.loyalty_points lp ON lp.user_id = p_user_id;
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_loyalty_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_loyalty_points_updated_at
BEFORE UPDATE ON public.loyalty_points
FOR EACH ROW
EXECUTE FUNCTION public.update_loyalty_points_updated_at();