-- Drop the old constraint and create a new one based on session_game_id
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_game_owner_objet_unique;

ALTER TABLE public.inventory ADD CONSTRAINT inventory_session_owner_objet_unique 
  UNIQUE (session_game_id, owner_num, objet);

-- Also update the games_phase_check to allow INFECTION phases
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_phase_check;

ALTER TABLE public.games ADD CONSTRAINT games_phase_check 
  CHECK (phase = ANY (ARRAY['PHASE1_MISES'::text, 'PHASE2_POSITIONS'::text, 'PHASE3_SHOP'::text, 'PHASE4_COMBAT'::text, 'RESOLUTION'::text, 'OPEN'::text, 'LOCKED'::text, 'RESOLVED'::text]));