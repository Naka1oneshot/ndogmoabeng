-- Add LION_TURN and LION phases to the games_phase_check constraint
ALTER TABLE public.games DROP CONSTRAINT games_phase_check;

ALTER TABLE public.games ADD CONSTRAINT games_phase_check 
CHECK (phase = ANY (ARRAY[
  'LOBBY'::text, 
  'PHASE1_MISES'::text, 
  'PHASE2_POSITIONS'::text, 
  'PHASE3_SHOP'::text, 
  'PHASE4_COMBAT'::text, 
  'RESOLUTION'::text, 
  'OPEN'::text, 
  'LOCKED'::text, 
  'RESOLVED'::text, 
  'FINISHED'::text, 
  'ENDED'::text,
  'LION_TURN'::text
]));