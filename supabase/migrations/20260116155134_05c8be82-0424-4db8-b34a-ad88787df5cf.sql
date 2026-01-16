-- Ajouter colonnes à round_bets pour gérer mise_demandee vs mise_effective
ALTER TABLE public.round_bets 
ADD COLUMN IF NOT EXISTS mise_demandee integer,
ADD COLUMN IF NOT EXISTS mise_effective integer,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'LOCKED', 'INVALID')),
ADD COLUMN IF NOT EXISTS note text,
ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone;

-- Migrer les données existantes: mise -> mise_demandee et mise_effective
UPDATE public.round_bets 
SET mise_demandee = mise, 
    mise_effective = mise, 
    status = 'SUBMITTED', 
    submitted_at = created_at 
WHERE mise_demandee IS NULL;

-- Créer table priority_rankings pour stocker le classement après clôture Phase 1
CREATE TABLE IF NOT EXISTS public.priority_rankings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  manche integer NOT NULL,
  player_id uuid NOT NULL,
  num_joueur integer NOT NULL,
  display_name text,
  rank integer NOT NULL,
  mise_effective integer DEFAULT 0,
  tie_group_id integer,
  created_at timestamp with time zone DEFAULT now()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_priority_rankings_game_manche ON public.priority_rankings(game_id, manche);

-- Contrainte d'unicité: un seul classement par joueur par manche
ALTER TABLE public.priority_rankings 
ADD CONSTRAINT priority_rankings_unique_player_manche UNIQUE (game_id, manche, player_id);

-- Activer RLS
ALTER TABLE public.priority_rankings ENABLE ROW LEVEL SECURITY;

-- Policy: Host peut tout faire
CREATE POLICY "Host can manage priority_rankings" ON public.priority_rankings
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM games g WHERE g.id = priority_rankings.game_id AND g.host_user_id = auth.uid()
  )
);

-- Policy: Joueurs peuvent voir les classements
CREATE POLICY "Players can view priority_rankings" ON public.priority_rankings
FOR SELECT USING (true);

-- Ajouter realtime pour priority_rankings
ALTER PUBLICATION supabase_realtime ADD TABLE public.priority_rankings;