-- Update get_friend_limited_profile to allow viewing requester's profile on pending requests
CREATE OR REPLACE FUNCTION public.get_friend_limited_profile(p_friend_user_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.user_id,
    p.display_name,
    p.avatar_url
  FROM profiles p
  WHERE p.user_id = p_friend_user_id
    AND EXISTS (
      SELECT 1 FROM friendships f
      WHERE (
        -- Accepted friendships (both directions)
        (f.status = 'accepted'
          AND ((f.requester_id = auth.uid() AND f.addressee_id = p_friend_user_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = p_friend_user_id)))
        -- Pending requests where current user is addressee (can see requester's profile)
        OR (f.status = 'pending'
          AND f.addressee_id = auth.uid() 
          AND f.requester_id = p_friend_user_id)
        -- Pending requests where current user is requester (can see addressee's profile)
        OR (f.status = 'pending'
          AND f.requester_id = auth.uid() 
          AND f.addressee_id = p_friend_user_id)
      )
    );
$function$;