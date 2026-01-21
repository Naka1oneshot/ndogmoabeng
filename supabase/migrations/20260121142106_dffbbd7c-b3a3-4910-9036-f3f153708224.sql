-- Update games_phase_check to include FINISHED and ENDED phases
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_phase_check;

ALTER TABLE public.games ADD CONSTRAINT games_phase_check 
  CHECK (phase IN ('LOBBY', 'PHASE1_MISES', 'PHASE2_POSITIONS', 'PHASE3_SHOP', 'PHASE4_COMBAT', 'RESOLUTION', 'OPEN', 'LOCKED', 'RESOLVED', 'FINISHED', 'ENDED'));