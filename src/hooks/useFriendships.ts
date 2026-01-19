import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface Friend {
  friendship_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  is_requester: boolean;
  created_at: string;
}

interface SearchResult {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  friendship_status: string | null;
  friendship_id: string | null;
  is_requester: boolean | null;
}

interface FriendComparison {
  my_games_played: number;
  my_games_won: number;
  friend_games_played: number;
  friend_games_won: number;
  games_together: number;
  my_wins_together: number;
  friend_wins_together: number;
}

interface GameTogether {
  game_id: string;
  game_name: string;
  game_type_code: string;
  played_at: string;
  my_result: 'won' | 'lost' | 'played';
  friend_result: 'won' | 'lost' | 'played';
  my_display_name: string;
  friend_display_name: string;
}

export function useFriendships() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [sentRequests, setSentRequests] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriendships = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id,
          requester_id,
          addressee_id,
          status,
          created_at
        `)
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (error) throw error;

      // Get all user IDs we need profiles for
      const userIds = new Set<string>();
      data?.forEach(f => {
        userIds.add(f.requester_id);
        userIds.add(f.addressee_id);
      });
      userIds.delete(user.id);

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', Array.from(userIds));

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Process friendships
      const accepted: Friend[] = [];
      const pending: Friend[] = [];
      const sent: Friend[] = [];

      data?.forEach(f => {
        const isRequester = f.requester_id === user.id;
        const friendId = isRequester ? f.addressee_id : f.requester_id;
        const profile = profileMap.get(friendId);

        const friend: Friend = {
          friendship_id: f.id,
          user_id: friendId,
          display_name: profile?.display_name || 'Utilisateur inconnu',
          avatar_url: profile?.avatar_url || null,
          status: f.status as Friend['status'],
          is_requester: isRequester,
          created_at: f.created_at,
        };

        if (f.status === 'accepted') {
          accepted.push(friend);
        } else if (f.status === 'pending') {
          if (isRequester) {
            sent.push(friend);
          } else {
            pending.push(friend);
          }
        }
      });

      setFriends(accepted);
      setPendingRequests(pending);
      setSentRequests(sent);
    } catch (error) {
      console.error('Error fetching friendships:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFriendships();

    // Subscribe to realtime updates
    if (user) {
      const channel = supabase
        .channel('friendships-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friendships',
            filter: `requester_id=eq.${user.id}`,
          },
          () => fetchFriendships()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friendships',
            filter: `addressee_id=eq.${user.id}`,
          },
          () => fetchFriendships()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, fetchFriendships]);

  const searchUsers = async (searchTerm: string): Promise<SearchResult[]> => {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
      const { data, error } = await supabase.rpc('search_users_for_friendship', {
        p_search_term: searchTerm,
        p_limit: 10,
      });

      if (error) throw error;
      return (data || []) as SearchResult[];
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  };

  const sendFriendRequest = async (addresseeId: string) => {
    if (!user) return { error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('friendships')
        .insert({
          requester_id: user.id,
          addressee_id: addresseeId,
          status: 'pending',
        });

      if (error) throw error;
      
      toast.success('Demande d\'ami envoyée !');
      await fetchFriendships();
      return { error: null };
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      toast.error('Erreur lors de l\'envoi de la demande');
      return { error: error.message };
    }
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ 
          status: 'accepted',
          responded_at: new Date().toISOString(),
        })
        .eq('id', friendshipId);

      if (error) throw error;
      
      toast.success('Demande d\'ami acceptée !');
      await fetchFriendships();
      return { error: null };
    } catch (error: any) {
      console.error('Error accepting friend request:', error);
      toast.error('Erreur lors de l\'acceptation');
      return { error: error.message };
    }
  };

  const declineFriendRequest = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ 
          status: 'declined',
          responded_at: new Date().toISOString(),
        })
        .eq('id', friendshipId);

      if (error) throw error;
      
      toast.success('Demande refusée');
      await fetchFriendships();
      return { error: null };
    } catch (error: any) {
      console.error('Error declining friend request:', error);
      toast.error('Erreur lors du refus');
      return { error: error.message };
    }
  };

  const removeFriend = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;
      
      toast.success('Ami supprimé');
      await fetchFriendships();
      return { error: null };
    } catch (error: any) {
      console.error('Error removing friend:', error);
      toast.error('Erreur lors de la suppression');
      return { error: error.message };
    }
  };

  const cancelFriendRequest = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;
      
      toast.success('Demande annulée');
      await fetchFriendships();
      return { error: null };
    } catch (error: any) {
      console.error('Error canceling friend request:', error);
      toast.error('Erreur lors de l\'annulation');
      return { error: error.message };
    }
  };

  const getFriendComparison = async (friendUserId: string): Promise<FriendComparison | null> => {
    try {
      const { data, error } = await supabase.rpc('get_friend_comparison', {
        p_friend_user_id: friendUserId,
      });

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      console.error('Error getting friend comparison:', error);
      return null;
    }
  };

  const getGamesTogether = async (friendUserId: string): Promise<GameTogether[]> => {
    try {
      const { data, error } = await supabase.rpc('get_games_together', {
        p_friend_user_id: friendUserId,
        p_limit: 20,
      });

      if (error) throw error;
      return (data || []) as GameTogether[];
    } catch (error) {
      console.error('Error getting games together:', error);
      return [];
    }
  };

  return {
    friends,
    pendingRequests,
    sentRequests,
    loading,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    cancelFriendRequest,
    getFriendComparison,
    getGamesTogether,
    refetch: fetchFriendships,
  };
}
