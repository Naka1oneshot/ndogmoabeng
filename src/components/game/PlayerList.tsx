import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Player {
  id: string;
  display_name: string;
  is_host: boolean;
  joined_at: string;
  last_seen: string | null;
  status: string | null;
}

interface PlayerListProps {
  gameId: string;
  className?: string;
  showInactive?: boolean; // For MJ view
}

// Players are considered active if last_seen within TTL
const PRESENCE_TTL_SECONDS = 25;

export function PlayerList({ gameId, className, showInactive = false }: PlayerListProps) {
  const [players, setPlayers] = useState<Player[]>([]);

  const isPlayerActive = useCallback((player: Player): boolean => {
    // Host is always shown
    if (player.is_host) return true;
    
    // Check status
    if (player.status === 'LEFT') return false;
    
    // Check last_seen TTL
    if (!player.last_seen) return false;
    
    const lastSeen = new Date(player.last_seen).getTime();
    const now = Date.now();
    const diffSeconds = (now - lastSeen) / 1000;
    
    return diffSeconds < PRESENCE_TTL_SECONDS;
  }, []);

  const fetchPlayers = useCallback(async () => {
    const { data, error } = await supabase
      .from('game_players')
      .select('id, display_name, is_host, joined_at, last_seen, status')
      .eq('game_id', gameId)
      .order('joined_at', { ascending: true });

    if (!error && data) {
      setPlayers(data);
    }
  }, [gameId]);

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

    // Also poll every 5 seconds to catch TTL expiry
    const pollInterval = setInterval(() => {
      // Force re-render to update TTL-based filtering
      setPlayers(prev => [...prev]);
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [gameId, fetchPlayers]);

  // Filter active players (use player.id as key to avoid duplicates)
  const activePlayers = showInactive 
    ? players 
    : players.filter(isPlayerActive);
  
  // Deduplicate by id (should not be needed but safety net)
  const uniquePlayers = Array.from(
    new Map(activePlayers.map(p => [p.id, p])).values()
  );

  // Count excludes host
  const activeCount = uniquePlayers.filter(p => !p.is_host).length;

  return (
    <div className={cn('card-gradient rounded-lg border border-border p-4', className)}>
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg">Joueurs ({activeCount})</h3>
      </div>

      {uniquePlayers.filter(p => !p.is_host).length === 0 ? (
        <p className="text-muted-foreground text-center py-6">
          En attente de joueurs...
        </p>
      ) : (
        <ul className="space-y-2">
          {uniquePlayers
            .filter(p => !p.is_host)
            .map((player, index, arr) => (
              <li
                key={player.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-md bg-secondary/50 transition-all',
                  index === arr.length - 1 && 'animate-pulse-glow'
                )}
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                  {player.display_name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 font-medium">{player.display_name}</span>
                {player.is_host && (
                  <Crown className="h-4 w-4 text-forest-gold" />
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
