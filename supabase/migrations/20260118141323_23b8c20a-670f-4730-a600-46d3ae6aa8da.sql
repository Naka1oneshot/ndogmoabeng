
-- ========================================
-- PHASE 2: Migration rétrocompatible
-- Ajouter session_game_id aux tables runtime + backfill
-- ========================================

-- ÉTAPE 1: Créer les session_games pour les parties existantes
-- Pour chaque game existant, créer un session_games avec FORET
INSERT INTO public.session_games (session_id, step_index, game_type_code, status, manche_active, phase, started_at, ended_at)
SELECT 
  g.id,
  1,
  'FORET',
  CASE 
    WHEN g.status = 'ENDED' THEN 'ENDED'
    WHEN g.status = 'IN_GAME' THEN 'RUNNING'
    ELSE 'PENDING'
  END,
  COALESCE(g.manche_active, 1),
  g.phase,
  CASE WHEN g.status IN ('IN_GAME', 'ENDED') THEN g.created_at ELSE NULL END,
  CASE WHEN g.status = 'ENDED' THEN now() ELSE NULL END
FROM public.games g
WHERE NOT EXISTS (
  SELECT 1 FROM public.session_games sg WHERE sg.session_id = g.id
);

-- ÉTAPE 2: Mettre à jour games avec les références session_games
UPDATE public.games g
SET 
  mode = 'SINGLE_GAME',
  selected_game_type_code = 'FORET',
  current_step_index = 1,
  current_session_game_id = sg.id
FROM public.session_games sg
WHERE sg.session_id = g.id 
  AND sg.step_index = 1
  AND g.current_session_game_id IS NULL;

-- ========================================
-- ÉTAPE 3: Ajouter session_game_id à toutes les tables runtime
-- ========================================

-- actions
ALTER TABLE public.actions ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- battlefield
ALTER TABLE public.battlefield ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- combat_config
ALTER TABLE public.combat_config ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- combat_results
ALTER TABLE public.combat_results ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- game_events
ALTER TABLE public.game_events ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- game_item_purchases
ALTER TABLE public.game_item_purchases ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- game_shop_offers
ALTER TABLE public.game_shop_offers ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- shop_requests
ALTER TABLE public.shop_requests ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- game_monsters
ALTER TABLE public.game_monsters ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- game_state_monsters
ALTER TABLE public.game_state_monsters ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- monsters
ALTER TABLE public.monsters ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- pending_effects
ALTER TABLE public.pending_effects ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- inventory
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- positions_finales
ALTER TABLE public.positions_finales ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- priority_rankings
ALTER TABLE public.priority_rankings ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- round_bets
ALTER TABLE public.round_bets ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- logs_joueurs
ALTER TABLE public.logs_joueurs ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- logs_mj
ALTER TABLE public.logs_mj ADD COLUMN IF NOT EXISTS session_game_id uuid NULL;

-- ========================================
-- ÉTAPE 4: Backfill session_game_id dans toutes les tables
-- ========================================

-- actions
UPDATE public.actions a
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE a.game_id = g.id AND a.session_game_id IS NULL;

-- battlefield
UPDATE public.battlefield b
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE b.game_id = g.id AND b.session_game_id IS NULL;

-- combat_config
UPDATE public.combat_config cc
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE cc.game_id = g.id AND cc.session_game_id IS NULL;

-- combat_results
UPDATE public.combat_results cr
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE cr.game_id = g.id AND cr.session_game_id IS NULL;

-- game_events
UPDATE public.game_events ge
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE ge.game_id = g.id AND ge.session_game_id IS NULL;

-- game_item_purchases
UPDATE public.game_item_purchases gip
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE gip.game_id = g.id AND gip.session_game_id IS NULL;

-- game_shop_offers
UPDATE public.game_shop_offers gso
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE gso.game_id = g.id AND gso.session_game_id IS NULL;

-- shop_requests
UPDATE public.shop_requests sr
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE sr.game_id = g.id AND sr.session_game_id IS NULL;

-- game_monsters
UPDATE public.game_monsters gm
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE gm.game_id = g.id AND gm.session_game_id IS NULL;

-- game_state_monsters
UPDATE public.game_state_monsters gsm
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE gsm.game_id = g.id AND gsm.session_game_id IS NULL;

-- monsters
UPDATE public.monsters m
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE m.game_id = g.id AND m.session_game_id IS NULL;

-- pending_effects
UPDATE public.pending_effects pe
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE pe.game_id = g.id AND pe.session_game_id IS NULL;

-- inventory
UPDATE public.inventory i
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE i.game_id = g.id AND i.session_game_id IS NULL;

-- positions_finales
UPDATE public.positions_finales pf
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE pf.game_id = g.id AND pf.session_game_id IS NULL;

-- priority_rankings
UPDATE public.priority_rankings pr
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE pr.game_id = g.id AND pr.session_game_id IS NULL;

-- round_bets
UPDATE public.round_bets rb
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE rb.game_id = g.id AND rb.session_game_id IS NULL;

-- logs_joueurs
UPDATE public.logs_joueurs lj
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE lj.game_id = g.id AND lj.session_game_id IS NULL;

-- logs_mj
UPDATE public.logs_mj lm
SET session_game_id = g.current_session_game_id
FROM public.games g
WHERE lm.game_id = g.id AND lm.session_game_id IS NULL;

-- ========================================
-- ÉTAPE 5: Ajouter les foreign keys vers session_games
-- ========================================

ALTER TABLE public.actions 
  ADD CONSTRAINT fk_actions_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.battlefield 
  ADD CONSTRAINT fk_battlefield_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.combat_config 
  ADD CONSTRAINT fk_combat_config_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.combat_results 
  ADD CONSTRAINT fk_combat_results_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.game_events 
  ADD CONSTRAINT fk_game_events_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.game_item_purchases 
  ADD CONSTRAINT fk_game_item_purchases_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.game_shop_offers 
  ADD CONSTRAINT fk_game_shop_offers_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.shop_requests 
  ADD CONSTRAINT fk_shop_requests_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.game_monsters 
  ADD CONSTRAINT fk_game_monsters_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.game_state_monsters 
  ADD CONSTRAINT fk_game_state_monsters_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.monsters 
  ADD CONSTRAINT fk_monsters_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.pending_effects 
  ADD CONSTRAINT fk_pending_effects_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.inventory 
  ADD CONSTRAINT fk_inventory_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.positions_finales 
  ADD CONSTRAINT fk_positions_finales_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.priority_rankings 
  ADD CONSTRAINT fk_priority_rankings_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.round_bets 
  ADD CONSTRAINT fk_round_bets_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.logs_joueurs 
  ADD CONSTRAINT fk_logs_joueurs_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

ALTER TABLE public.logs_mj 
  ADD CONSTRAINT fk_logs_mj_session_game 
  FOREIGN KEY (session_game_id) REFERENCES public.session_games(id) ON DELETE CASCADE;

-- ========================================
-- ÉTAPE 6: Créer les indexes pour performance
-- ========================================

CREATE INDEX IF NOT EXISTS idx_actions_session_game ON public.actions(session_game_id);
CREATE INDEX IF NOT EXISTS idx_actions_session_manche ON public.actions(session_game_id, manche);

CREATE INDEX IF NOT EXISTS idx_battlefield_session_game ON public.battlefield(session_game_id);

CREATE INDEX IF NOT EXISTS idx_combat_config_session_game ON public.combat_config(session_game_id);

CREATE INDEX IF NOT EXISTS idx_combat_results_session_game ON public.combat_results(session_game_id);
CREATE INDEX IF NOT EXISTS idx_combat_results_session_manche ON public.combat_results(session_game_id, manche);

CREATE INDEX IF NOT EXISTS idx_game_events_session_game ON public.game_events(session_game_id);
CREATE INDEX IF NOT EXISTS idx_game_events_session_created ON public.game_events(session_game_id, created_at);

CREATE INDEX IF NOT EXISTS idx_game_item_purchases_session_game ON public.game_item_purchases(session_game_id);

CREATE INDEX IF NOT EXISTS idx_game_shop_offers_session_game ON public.game_shop_offers(session_game_id);
CREATE INDEX IF NOT EXISTS idx_game_shop_offers_session_manche ON public.game_shop_offers(session_game_id, manche);

CREATE INDEX IF NOT EXISTS idx_shop_requests_session_game ON public.shop_requests(session_game_id);

CREATE INDEX IF NOT EXISTS idx_game_monsters_session_game ON public.game_monsters(session_game_id);

CREATE INDEX IF NOT EXISTS idx_game_state_monsters_session_game ON public.game_state_monsters(session_game_id);

CREATE INDEX IF NOT EXISTS idx_monsters_session_game ON public.monsters(session_game_id);

CREATE INDEX IF NOT EXISTS idx_pending_effects_session_game ON public.pending_effects(session_game_id);
CREATE INDEX IF NOT EXISTS idx_pending_effects_session_manche ON public.pending_effects(session_game_id, manche);

CREATE INDEX IF NOT EXISTS idx_inventory_session_game ON public.inventory(session_game_id);

CREATE INDEX IF NOT EXISTS idx_positions_finales_session_game ON public.positions_finales(session_game_id);
CREATE INDEX IF NOT EXISTS idx_positions_finales_session_manche ON public.positions_finales(session_game_id, manche);

CREATE INDEX IF NOT EXISTS idx_priority_rankings_session_game ON public.priority_rankings(session_game_id);
CREATE INDEX IF NOT EXISTS idx_priority_rankings_session_manche ON public.priority_rankings(session_game_id, manche);

CREATE INDEX IF NOT EXISTS idx_round_bets_session_game ON public.round_bets(session_game_id);
CREATE INDEX IF NOT EXISTS idx_round_bets_session_manche ON public.round_bets(session_game_id, manche);

CREATE INDEX IF NOT EXISTS idx_logs_joueurs_session_game ON public.logs_joueurs(session_game_id);
CREATE INDEX IF NOT EXISTS idx_logs_joueurs_session_created ON public.logs_joueurs(session_game_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_logs_mj_session_game ON public.logs_mj(session_game_id);
CREATE INDEX IF NOT EXISTS idx_logs_mj_session_created ON public.logs_mj(session_game_id, timestamp);
