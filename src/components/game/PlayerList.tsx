import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Player {
  id: string;
  display_name: string;
  is_host: boolean;
  joined_at: string;
}

interface PlayerListProps {
  gameId: string;
  className?: string;
}

export function PlayerList({ gameId, className }: PlayerListProps) {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    // Fetch initial players
    const fetchPlayers = async () => {
      const { data, error } = await supabase
        .from('game_players')
        .select('*')
        .eq('game_id', gameId)
        .order('joined_at', { ascending: true });

      if (!error && data) {
        setPlayers(data);
      }
    };

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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  return (
    <div className={cn('card-gradient rounded-lg border border-border p-4', className)}>
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg">Joueurs ({players.length})</h3>
      </div>

      {players.length === 0 ? (
        <p className="text-muted-foreground text-center py-6">
          En attente de joueurs...
        </p>
      ) : (
        <ul className="space-y-2">
          {players.map((player, index) => (
            <li
              key={player.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-md bg-secondary/50 transition-all',
                index === players.length - 1 && 'animate-pulse-glow'
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
