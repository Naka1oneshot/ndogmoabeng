import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface GameInvitation {
  id: string;
  game_id: string;
  game_name: string;
  join_code: string;
  invited_by_user_id: string;
  invited_by_name: string;
  created_at: string;
}

export function useGameInvitations() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<GameInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvitations = useCallback(async () => {
    if (!user) {
      setInvitations([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch invitations from session_events where this user was invited
      const { data: events, error } = await supabase
        .from('session_events')
        .select('id, game_id, payload, created_at')
        .eq('type', 'game_invite')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter events where current user is the invitee
      const userInvitations = (events || [])
        .filter((event) => {
          const payload = event.payload as any;
          return payload?.invited_user_id === user.id;
        })
        .map((event) => {
          const payload = event.payload as any;
          return {
            id: event.id,
            game_id: event.game_id,
            game_name: payload.game_name || 'Partie',
            join_code: payload.join_code || '',
            invited_by_user_id: payload.invited_by_user_id,
            invited_by_name: payload.invited_by_name || 'Un ami',
            created_at: event.created_at,
          };
        });

      // Fetch inviter names
      const inviterIds = [...new Set(userInvitations.map(i => i.invited_by_user_id))];
      if (inviterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', inviterIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
        
        userInvitations.forEach(inv => {
          inv.invited_by_name = profileMap.get(inv.invited_by_user_id) || 'Un ami';
        });
      }

      // Check which games are still active (in LOBBY status)
      const gameIds = [...new Set(userInvitations.map(i => i.game_id))];
      if (gameIds.length > 0) {
        const { data: games } = await supabase
          .from('games')
          .select('id, status')
          .in('id', gameIds)
          .eq('status', 'LOBBY');

        const activeGameIds = new Set(games?.map(g => g.id) || []);
        
        // Only keep invitations for active games
        const activeInvitations = userInvitations.filter(inv => activeGameIds.has(inv.game_id));
        setInvitations(activeInvitations);
      } else {
        setInvitations([]);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInvitations();

    // Subscribe to new invitations
    if (user) {
      const channel = supabase
        .channel('game-invitations')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'session_events',
            filter: `type=eq.game_invite`,
          },
          () => fetchInvitations()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, fetchInvitations]);

  const dismissInvitation = async (invitationId: string) => {
    // Simply remove from local state (optional: could mark as dismissed in DB)
    setInvitations(prev => prev.filter(i => i.id !== invitationId));
  };

  return {
    invitations,
    loading,
    refetch: fetchInvitations,
    dismissInvitation,
  };
}
