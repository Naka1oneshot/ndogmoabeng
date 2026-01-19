import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LobbyPlayerListProps {
  gameId: string;
  currentPlayerNum?: number;
}

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  clan: string | null;
  last_seen: string | null;
  is_host: boolean;
}

const LobbyPlayerList: React.FC<LobbyPlayerListProps> = ({ gameId, currentPlayerNum }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if player was seen within last 2 minutes
  const isOnline = (lastSeen: string | null): boolean => {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    return diffMs < 2 * 60 * 1000; // 2 minutes
  };

  useEffect(() => {
    const fetchPlayers = async () => {
      const { data, error } = await supabase
        .from('game_players')
        .select('id, display_name, player_number, clan, last_seen, is_host')
        .eq('game_id', gameId)
        .eq('status', 'ACTIVE')
        .order('player_number');

      if (!error && data) {
        // Exclude host from list
        setPlayers(data.filter(p => !p.is_host && p.player_number !== null));
      }
      setLoading(false);
    };

    fetchPlayers();

    // Real-time subscription for player updates
    const channel = supabase
      .channel(`lobby-players-${gameId}`)
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

    // Refresh every 30 seconds to update online status
    const interval = setInterval(fetchPlayers, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [gameId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 bg-muted rounded" />
        ))}
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
        <Users className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Aucun joueur connecté</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Joueurs en salle ({players.length})</span>
      </div>
      
      <div className="space-y-1">
        {players.map((player) => {
          const online = isOnline(player.last_seen);
          const isCurrentPlayer = player.player_number === currentPlayerNum;
          
          return (
            <div
              key={player.id}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                isCurrentPlayer ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'
              }`}
            >
              {/* Player number */}
              <span className="w-7 h-7 bg-primary/20 rounded-full flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {player.player_number}
              </span>
              
              {/* Name and clan */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isCurrentPlayer ? 'text-primary' : ''}`}>
                  {player.display_name}
                  {isCurrentPlayer && <span className="text-xs ml-1">(vous)</span>}
                </p>
                {player.clan && (
                  <p className="text-xs text-muted-foreground truncate">{player.clan}</p>
                )}
              </div>
              
              {/* Online status */}
              <div className="shrink-0">
                {online ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 gap-1">
                    <Wifi className="h-3 w-3" />
                    <span className="text-[10px]">En ligne</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
                    <WifiOff className="h-3 w-3" />
                    <span className="text-[10px]">Absent</span>
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LobbyPlayerList;
