import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  phone: string | null;
  address: string | null;
  avatar_url: string | null;
  last_display_name_change: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserGameStats {
  games_played: number;
  games_won: number;
  games_created: number;
}

export interface CurrentGame {
  id: string;
  name: string;
  status: string;
  join_code: string;
  is_host: boolean;
  player_count: number;
}

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserGameStats | null>(null);
  const [currentGames, setCurrentGames] = useState<CurrentGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [canChangeDisplayName, setCanChangeDisplayName] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch profile
      let { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // If no profile exists, create one
      if (!profileData && (!profileError || profileError.code === 'PGRST116')) {
        const userEmail = user.email || '';
        const defaultDisplayName = userEmail.split('@')[0] || 'Joueur';
        
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            first_name: '',
            last_name: '',
            display_name: defaultDisplayName,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
        } else {
          profileData = newProfile;
        }
      } else if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
      }
      
      setProfile(profileData);

      // Check if can change display name
      const { data: canChange } = await supabase
        .rpc('can_change_display_name', { p_user_id: user.id });
      setCanChangeDisplayName(canChange ?? true);

      // Fetch game stats
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_user_game_stats', { p_user_id: user.id });

      if (statsError) {
        console.error('Error fetching stats:', statsError);
      } else if (statsData && statsData.length > 0) {
        setStats({
          games_played: Number(statsData[0].games_played) || 0,
          games_won: Number(statsData[0].games_won) || 0,
          games_created: Number(statsData[0].games_created) || 0,
        });
      }

      // Fetch current games (as player)
      const { data: playerGames, error: playerGamesError } = await supabase
        .from('game_players')
        .select('game_id, games!inner(id, name, status, join_code)')
        .eq('user_id', user.id)
        .eq('is_host', false)
        .is('removed_at', null);

      // Fetch current games (as host)
      const { data: hostGames, error: hostGamesError } = await supabase
        .from('games')
        .select('id, name, status, join_code')
        .eq('host_user_id', user.id)
        .in('status', ['LOBBY', 'RUNNING', 'IN_GAME']);

      // Get all game IDs to fetch player counts
      const allGameIds: string[] = [];
      if (playerGames) {
        playerGames.forEach((pg: any) => {
          if (pg.games && ['LOBBY', 'RUNNING', 'IN_GAME'].includes(pg.games.status)) {
            allGameIds.push(pg.games.id);
          }
        });
      }
      if (hostGames) {
        hostGames.forEach((g: any) => allGameIds.push(g.id));
      }

      // Fetch player counts for all games
      const playerCounts: Record<string, number> = {};
      if (allGameIds.length > 0) {
        const { data: playersData } = await supabase
          .from('game_players')
          .select('game_id')
          .in('game_id', allGameIds)
          .eq('is_host', false)
          .is('removed_at', null);

        if (playersData) {
          playersData.forEach((p: any) => {
            playerCounts[p.game_id] = (playerCounts[p.game_id] || 0) + 1;
          });
        }
      }

      const games: CurrentGame[] = [];
      
      if (playerGames) {
        playerGames.forEach((pg: any) => {
          if (pg.games && ['LOBBY', 'RUNNING', 'IN_GAME'].includes(pg.games.status)) {
            games.push({
              id: pg.games.id,
              name: pg.games.name,
              status: pg.games.status,
              join_code: pg.games.join_code,
              is_host: false,
              player_count: playerCounts[pg.games.id] || 0,
            });
          }
        });
      }

      if (hostGames) {
        hostGames.forEach((g: any) => {
          games.push({
            id: g.id,
            name: g.name,
            status: g.status,
            join_code: g.join_code,
            is_host: true,
            player_count: playerCounts[g.id] || 0,
          });
        });
      }

      setCurrentGames(games);
    } catch (err) {
      console.error('Error in useUserProfile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setStats(null);
      setCurrentGames([]);
      setLoading(false);
      return;
    }

    fetchData();

    // Subscribe to real-time updates for games (stats updates)
    const gamesChannel = supabase
      .channel('profile-games-stats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
        },
        (payload) => {
          // Refetch stats when a game status changes
          console.log('Game change detected, refetching stats...');
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_players',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Refetch when player data changes
          console.log('Player data change detected, refetching...');
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(gamesChannel);
    };
  }, [user]);

  const updateProfile = async (updates: Partial<Pick<UserProfile, 'first_name' | 'last_name' | 'display_name' | 'phone' | 'address'>>) => {
    if (!user || !profile) return { error: new Error('Not authenticated') };

    // Check if trying to change display name
    if (updates.display_name && updates.display_name !== profile.display_name) {
      if (!canChangeDisplayName) {
        toast.error('Vous ne pouvez changer votre pseudo qu\'une fois par mois');
        return { error: new Error('Display name change not allowed') };
      }
      updates = { ...updates, last_display_name_change: new Date().toISOString() } as any;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (error) {
      toast.error('Erreur lors de la mise à jour du profil');
      return { error };
    }

    toast.success('Profil mis à jour avec succès');
    
    // Refresh profile
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (updatedProfile) {
      setProfile(updatedProfile);
      // Refresh can change display name status
      const { data: canChange } = await supabase
        .rpc('can_change_display_name', { p_user_id: user.id });
      setCanChangeDisplayName(canChange ?? true);
    }

    return { error: null };
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return { error: new Error('Not authenticated'), url: null };

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/avatar.${fileExt}`;

    // Upload the file
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast.error('Erreur lors de l\'upload de l\'image');
      return { error: uploadError, url: null };
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Update profile with avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('user_id', user.id);

    if (updateError) {
      toast.error('Erreur lors de la mise à jour du profil');
      return { error: updateError, url: null };
    }

    toast.success('Photo de profil mise à jour');

    // Refresh profile
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (updatedProfile) {
      setProfile(updatedProfile);
    }

    return { error: null, url: publicUrl };
  };

  const leaveGame = async (gameId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('game_players')
      .update({ removed_at: new Date().toISOString(), removed_reason: 'left' })
      .eq('game_id', gameId)
      .eq('user_id', user.id)
      .eq('is_host', false);

    if (error) {
      toast.error('Erreur lors de la sortie de la partie');
      return { error };
    }

    toast.success('Vous avez quitté la partie');
    await fetchData();
    return { error: null };
  };

  const deleteGame = async (gameId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    // First, delete related data
    await supabase.from('game_players').delete().eq('game_id', gameId);
    await supabase.from('lobby_chat_messages').delete().eq('game_id', gameId);
    await supabase.from('session_events').delete().eq('game_id', gameId);
    await supabase.from('game_events').delete().eq('game_id', gameId);
    
    // Delete the game itself
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId)
      .eq('host_user_id', user.id);

    if (error) {
      toast.error('Erreur lors de la suppression de la partie');
      return { error };
    }

    toast.success('Partie supprimée');
    await fetchData();
    return { error: null };
  };

  return {
    profile,
    stats,
    currentGames,
    loading,
    canChangeDisplayName,
    updateProfile,
    uploadAvatar,
    leaveGame,
    deleteGame,
    refetch: fetchData,
  };
}
