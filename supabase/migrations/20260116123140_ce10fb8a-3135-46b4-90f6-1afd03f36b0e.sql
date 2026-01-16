-- Add unique constraint for upsert on round_bets
ALTER TABLE public.round_bets 
ADD CONSTRAINT round_bets_game_manche_joueur_unique 
UNIQUE (game_id, manche, num_joueur);