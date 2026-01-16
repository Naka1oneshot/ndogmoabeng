import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Crown, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Player {
  id: string;
  display_name: string;
  is_host: boolean;
  joined_at: string;
  last_seen: string | null;
  status: string | null;
  player_number: number | null;
}

interface PlayerListProps {
  gameId: string;
  className?: string;
  showInactive?: boolean; // For MJ view - show LEFT/REMOVED players too
}

// Players are considered online if last_seen within TTL (for badge only)
const PRESENCE_TTL_SECONDS = 25;

export function PlayerList({ gameId, className, showInactive = false }: PlayerListProps) {
  const [players, setPlayers] = useState<Player[]>([]);

  // Check if player is currently online (for badge display only)
  const isPlayerOnline = useCallback((player: Player): boolean => {
    if (!player.last_seen) return false;
    
    const lastSeen = new Date(player.last_seen).getTime();
    const now = Date.now();
    const diffSeconds = (now - lastSeen) / 1000;
    
    return diffSeconds < PRESENCE_TTL_SECONDS;
  }, []);

  const fetchPlayers = useCallback(async () => {
    // Always fetch ACTIVE players only (unless showInactive for MJ)
    let query = supabase
      .from('game_players')
      .select('id, display_name, is_host, joined_at, last_seen, status, player_number')
      .eq('game_id', gameId);
    
    if (!showInactive) {
      // For regular view: only show ACTIVE players
      query = query.eq('status', 'ACTIVE');
    }
    
    const { data, error } = await query.order('player_number', { ascending: true });

    if (!error && data) {
      setPlayers(data);
    }
  }, [gameId, showInactive]);

  useEffect(() => {
    fetchPlayers();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`game-players-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_players',
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          fetchPlayers();
        }
      )
      .subscribe();

    // Poll every 5 seconds to update online badges
    const pollInterval = setInterval(() => {
      setPlayers(prev => [...prev]);
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [gameId, fetchPlayers]);

  // Filter out host for display, show non-host ACTIVE players
  const displayPlayers = players.filter(p => !p.is_host);
  
  // Count excludes host
  const activeCount = displayPlayers.length;

  return (
    <div className={cn('card-gradient rounded-lg border border-border p-4', className)}>
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg">Joueurs ({activeCount})</h3>
      </div>

      {displayPlayers.length === 0 ? (
        <p className="text-muted-foreground text-center py-6">
          En attente de joueurs...
        </p>
      ) : (
        <ul className="space-y-2">
          {displayPlayers.map((player, index, arr) => {
            const isOnline = isPlayerOnline(player);
            return (
              <li
                key={player.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-md bg-secondary/50 transition-all',
                  index === arr.length - 1 && 'animate-pulse-glow'
                )}
              >
                {/* Player number badge */}
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                  {player.player_number || player.display_name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 font-medium">{player.display_name}</span>
                
                {/* Online/Offline badge (informative only) */}
                <span title={isOnline ? "En ligne" : "Hors ligne"}>
                  {isOnline ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                
                {player.is_host && (
                  <Crown className="h-4 w-4 text-forest-gold" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
