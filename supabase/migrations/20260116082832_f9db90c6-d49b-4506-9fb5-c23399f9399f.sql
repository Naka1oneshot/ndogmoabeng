-- Table des parties
CREATE TABLE public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  host_user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Nouvelle Partie',
  join_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'LOBBY' CHECK (status IN ('LOBBY', 'IN_GAME', 'ENDED'))
);

-- Table des joueurs dans une partie
CREATE TABLE public.game_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

-- RLS pour games
CREATE POLICY "Les utilisateurs authentifiés peuvent créer des parties"
  ON public.games FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Tout le monde peut voir les parties en LOBBY par join_code"
  ON public.games FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Seul l'hôte peut mettre à jour sa partie"
  ON public.games FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_user_id);

-- RLS pour game_players
CREATE POLICY "Les joueurs peuvent rejoindre une partie"
  ON public.game_players FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les joueurs peuvent voir les participants de leur partie"
  ON public.game_players FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players gp 
      WHERE gp.game_id = game_players.game_id 
      AND gp.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_players.game_id
      AND g.host_user_id = auth.uid()
    )
  );

CREATE POLICY "Les joueurs peuvent quitter une partie"
  ON public.game_players FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for game_players
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;