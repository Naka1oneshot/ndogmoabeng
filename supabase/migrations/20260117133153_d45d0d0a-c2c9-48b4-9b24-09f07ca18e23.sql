-- Table pour stocker les résultats de combat (idempotence)
CREATE TABLE public.combat_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  manche INTEGER NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  public_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  mj_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  kills JSONB NOT NULL DEFAULT '[]'::jsonb,
  forest_state JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, manche)
);

-- Enable RLS
ALTER TABLE public.combat_results ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Host can manage combat_results"
  ON public.combat_results
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM games g
    WHERE g.id = combat_results.game_id AND g.host_user_id = auth.uid()
  ));

CREATE POLICY "Players can view public combat_results"
  ON public.combat_results
  FOR SELECT
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_results;