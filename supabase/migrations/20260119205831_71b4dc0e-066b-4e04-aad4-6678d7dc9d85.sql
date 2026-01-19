-- Table pour tracker les essais et bonus d'abonnement
CREATE TABLE public.user_subscription_bonuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  trial_tier TEXT NOT NULL DEFAULT 'starter',
  trial_start_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_end_at TIMESTAMPTZ NOT NULL,
  token_games_joinable INTEGER NOT NULL DEFAULT 0,
  token_games_creatable INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes de vérification
CREATE INDEX idx_user_subscription_bonuses_user_id ON public.user_subscription_bonuses(user_id);
CREATE INDEX idx_user_subscription_bonuses_trial_end ON public.user_subscription_bonuses(trial_end_at);

-- Enable RLS
ALTER TABLE public.user_subscription_bonuses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own subscription bonus
CREATE POLICY "Users can view their own subscription bonus"
ON public.user_subscription_bonuses
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Service role can manage all (for edge functions)
CREATE POLICY "Service role can manage subscription bonuses"
ON public.user_subscription_bonuses
FOR ALL
USING (auth.role() = 'service_role');

-- Trigger pour updated_at
CREATE TRIGGER update_user_subscription_bonuses_updated_at
BEFORE UPDATE ON public.user_subscription_bonuses
FOR EACH ROW
EXECUTE FUNCTION public.update_profiles_updated_at();

-- Fonction pour créer automatiquement l'essai Starter à l'inscription
CREATE OR REPLACE FUNCTION public.create_starter_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscription_bonuses (user_id, trial_tier, trial_start_at, trial_end_at)
  VALUES (NEW.user_id, 'starter', now(), now() + INTERVAL '14 days')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger sur la création de profil pour créer l'essai
CREATE TRIGGER trigger_create_starter_trial
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.create_starter_trial();

-- Insérer les essais pour tous les utilisateurs existants (14 jours à partir d'aujourd'hui)
INSERT INTO public.user_subscription_bonuses (user_id, trial_tier, trial_start_at, trial_end_at)
SELECT user_id, 'starter', now(), now() + INTERVAL '14 days'
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;