-- Create shop_requests table for player wishes
CREATE TABLE public.shop_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  manche INTEGER NOT NULL,
  player_id UUID NOT NULL,
  player_num INTEGER NOT NULL,
  want_buy BOOLEAN NOT NULL DEFAULT false,
  item_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, manche, player_id)
);

-- Enable RLS
ALTER TABLE public.shop_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Host can manage shop_requests"
ON public.shop_requests
FOR ALL
USING (EXISTS (
  SELECT 1 FROM games g WHERE g.id = shop_requests.game_id AND g.host_user_id = auth.uid()
));

CREATE POLICY "Players can view shop_requests"
ON public.shop_requests
FOR SELECT
USING (true);

CREATE POLICY "Players can insert their own requests"
ON public.shop_requests
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Players can update their own requests"
ON public.shop_requests
FOR UPDATE
USING (true);

-- Add columns to game_item_purchases for resolution tracking
ALTER TABLE public.game_item_purchases 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN IF NOT EXISTS resolved_by UUID,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

-- Add resolved flag to game_shop_offers to prevent double resolution
ALTER TABLE public.game_shop_offers
ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

-- Enable realtime for shop_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_requests;