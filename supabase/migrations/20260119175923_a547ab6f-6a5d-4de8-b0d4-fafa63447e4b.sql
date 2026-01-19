-- Create friendships table
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

-- Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Policies: Users can see friendships where they are involved
CREATE POLICY "Users can view their own friendships"
ON public.friendships FOR SELECT
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Users can create friend requests
CREATE POLICY "Users can send friend requests"
ON public.friendships FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requester_id AND status = 'pending');

-- Users can update friendships they received (to accept/decline)
CREATE POLICY "Users can respond to friend requests"
ON public.friendships FOR UPDATE
TO authenticated
USING (auth.uid() = addressee_id OR auth.uid() = requester_id);

-- Users can delete friendships they are part of
CREATE POLICY "Users can delete their friendships"
ON public.friendships FOR DELETE
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Create index for faster lookups
CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);
CREATE INDEX idx_friendships_status ON public.friendships(status);

-- Function to search users by display name
CREATE OR REPLACE FUNCTION public.search_users_for_friendship(p_search_term text, p_limit int DEFAULT 10)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  friendship_status text,
  friendship_id uuid,
  is_requester boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.display_name,
    p.avatar_url,
    f.status AS friendship_status,
    f.id AS friendship_id,
    (f.requester_id = auth.uid()) AS is_requester
  FROM profiles p
  LEFT JOIN friendships f ON (
    (f.requester_id = auth.uid() AND f.addressee_id = p.user_id) OR
    (f.addressee_id = auth.uid() AND f.requester_id = p.user_id)
  )
  WHERE p.user_id != auth.uid()
    AND p.display_name ILIKE '%' || p_search_term || '%'
  ORDER BY p.display_name
  LIMIT p_limit;
END;
$$;

-- Function to get friend stats comparison
CREATE OR REPLACE FUNCTION public.get_friend_comparison(p_friend_user_id uuid)
RETURNS TABLE(
  my_games_played bigint,
  my_games_won bigint,
  friend_games_played bigint,
  friend_games_won bigint,
  games_together bigint,
  my_wins_together bigint,
  friend_wins_together bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_id uuid := auth.uid();
BEGIN
  RETURN QUERY
  WITH my_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE g.status IN ('ENDED', 'FINISHED', 'ARCHIVED')) AS games_played,
      COUNT(*) FILTER (WHERE g.winner_declared = true AND gp.is_alive = true) AS games_won
    FROM game_players gp
    JOIN games g ON g.id = gp.game_id
    WHERE gp.user_id = v_my_id AND gp.is_host = false
  ),
  friend_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE g.status IN ('ENDED', 'FINISHED', 'ARCHIVED')) AS games_played,
      COUNT(*) FILTER (WHERE g.winner_declared = true AND gp.is_alive = true) AS games_won
    FROM game_players gp
    JOIN games g ON g.id = gp.game_id
    WHERE gp.user_id = p_friend_user_id AND gp.is_host = false
  ),
  together_stats AS (
    SELECT 
      COUNT(DISTINCT g.id) AS games_together,
      COUNT(DISTINCT g.id) FILTER (
        WHERE g.winner_declared = true 
        AND EXISTS (
          SELECT 1 FROM game_players gp2 
          WHERE gp2.game_id = g.id AND gp2.user_id = v_my_id AND gp2.is_alive = true
        )
      ) AS my_wins,
      COUNT(DISTINCT g.id) FILTER (
        WHERE g.winner_declared = true 
        AND EXISTS (
          SELECT 1 FROM game_players gp2 
          WHERE gp2.game_id = g.id AND gp2.user_id = p_friend_user_id AND gp2.is_alive = true
        )
      ) AS friend_wins
    FROM games g
    WHERE g.status IN ('ENDED', 'FINISHED', 'ARCHIVED')
      AND EXISTS (SELECT 1 FROM game_players gp1 WHERE gp1.game_id = g.id AND gp1.user_id = v_my_id AND gp1.is_host = false)
      AND EXISTS (SELECT 1 FROM game_players gp2 WHERE gp2.game_id = g.id AND gp2.user_id = p_friend_user_id AND gp2.is_host = false)
  )
  SELECT 
    ms.games_played,
    ms.games_won,
    fs.games_played,
    fs.games_won,
    ts.games_together,
    ts.my_wins,
    ts.friend_wins
  FROM my_stats ms, friend_stats fs, together_stats ts;
END;
$$;

-- Function to get games played together
CREATE OR REPLACE FUNCTION public.get_games_together(p_friend_user_id uuid, p_limit int DEFAULT 20)
RETURNS TABLE(
  game_id uuid,
  game_name text,
  game_type_code text,
  played_at timestamptz,
  my_result text,
  friend_result text,
  my_display_name text,
  friend_display_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_id uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT 
    g.id AS game_id,
    g.name AS game_name,
    COALESCE(g.selected_game_type_code, 'unknown') AS game_type_code,
    g.created_at AS played_at,
    CASE 
      WHEN g.winner_declared AND gp_me.is_alive = true THEN 'won'
      WHEN g.winner_declared AND gp_me.is_alive = false THEN 'lost'
      ELSE 'played'
    END AS my_result,
    CASE 
      WHEN g.winner_declared AND gp_friend.is_alive = true THEN 'won'
      WHEN g.winner_declared AND gp_friend.is_alive = false THEN 'lost'
      ELSE 'played'
    END AS friend_result,
    gp_me.display_name AS my_display_name,
    gp_friend.display_name AS friend_display_name
  FROM games g
  JOIN game_players gp_me ON gp_me.game_id = g.id AND gp_me.user_id = v_my_id AND gp_me.is_host = false
  JOIN game_players gp_friend ON gp_friend.game_id = g.id AND gp_friend.user_id = p_friend_user_id AND gp_friend.is_host = false
  WHERE g.status IN ('ENDED', 'FINISHED', 'ARCHIVED')
  ORDER BY g.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Enable realtime for friendships
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;