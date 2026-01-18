import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Loader2 } from 'lucide-react';

interface GamePlayer {
  id: string;
  display_name: string;
  player_number: number;
  jetons: number;
  recompenses: number;
}

interface ForestFinalRankingProps {
  gameId: string;
  sessionGameId?: string | null;
  currentPlayerNumber: number;
}

export function ForestFinalRanking({ gameId, sessionGameId, currentPlayerNumber }: ForestFinalRankingProps) {
  const [allMonstersDead, setAllMonstersDead] = useState(false);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`forest-ranking-${gameId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'game_state_monsters', 
        filter: `game_id=eq.${gameId}` 
      }, fetchData)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'game_players', 
        filter: `game_id=eq.${gameId}` 
      }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, sessionGameId]);

  const fetchData = async () => {
    // Check if all monsters are dead
    let monstersQuery = supabase
      .from('game_state_monsters')
      .select('status')
      .eq('game_id', gameId);

    if (sessionGameId) {
      monstersQuery = monstersQuery.eq('session_game_id', sessionGameId);
    }

    const { data: monsters } = await monstersQuery;

    if (monsters && monsters.length > 0) {
      const allDead = monsters.every(m => m.status === 'MORT');
      setAllMonstersDead(allDead);

      if (allDead) {
        // Fetch players for ranking
        const { data: playersData } = await supabase
          .from('game_players')
          .select('id, display_name, player_number, jetons, recompenses')
          .eq('game_id', gameId)
          .is('removed_at', null)
          .order('player_number', { ascending: true });

        if (playersData) {
          setPlayers(playersData.map(p => ({
            ...p,
            jetons: p.jetons ?? 0,
            recompenses: p.recompenses ?? 0,
          })));
        }
      }
    }

    setLoading(false);
  };

  if (loading) {
    return null;
  }

  if (!allMonstersDead) {
    return null;
  }

  // Calculate ranking
  const ranking = players
    .map(p => ({
      ...p,
      score: p.jetons + p.recompenses,
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="card-gradient rounded-lg border-2 border-amber-500/50 bg-amber-500/10 p-6">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Trophy className="h-8 w-8 text-amber-500" />
        <h3 className="font-display text-xl">🎉 Victoire ! Tous les monstres sont vaincus !</h3>
      </div>

      <p className="text-center text-muted-foreground text-sm mb-4">
        La forêt est libérée ! Voici le classement final.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3">Rang</th>
              <th className="text-left py-2 px-3">Joueur</th>
              <th className="text-right py-2 px-3">Jetons</th>
              <th className="text-right py-2 px-3">Récompenses</th>
              <th className="text-right py-2 px-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((player, index) => {
              const isCurrentPlayer = player.player_number === currentPlayerNumber;
              return (
                <tr 
                  key={player.id} 
                  className={`border-b border-border/50 ${
                    isCurrentPlayer ? 'bg-primary/20 font-bold' : index < 3 ? 'bg-primary/5' : ''
                  }`}
                >
                  <td className="py-3 px-3">
                    <span className={`font-bold ${
                      index === 0 ? 'text-amber-500' : 
                      index === 1 ? 'text-gray-400' : 
                      index === 2 ? 'text-amber-700' : ''
                    }`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {player.display_name}
                    {isCurrentPlayer && <span className="ml-2 text-primary">(vous)</span>}
                  </td>
                  <td className="py-3 px-3 text-right">{player.jetons}</td>
                  <td className="py-3 px-3 text-right text-amber-500">+{player.recompenses}</td>
                  <td className="py-3 px-3 text-right font-bold text-lg">{player.score}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-center text-xs text-muted-foreground mt-4">
        En attente du MJ pour terminer la partie...
      </div>
    </div>
  );
}
