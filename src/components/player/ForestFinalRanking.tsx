import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Users } from 'lucide-react';

interface GamePlayer {
  id: string;
  display_name: string;
  player_number: number;
  jetons: number;
  recompenses: number;
  mate_num: number | null;
}

interface Team {
  members: GamePlayer[];
  teamScore: number;
  teamName: string;
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
          .select('id, display_name, player_number, jetons, recompenses, mate_num')
          .eq('game_id', gameId)
          .is('removed_at', null)
          .order('player_number', { ascending: true });

        if (playersData) {
          setPlayers(playersData.map(p => ({
            ...p,
            jetons: p.jetons ?? 0,
            recompenses: p.recompenses ?? 0,
            mate_num: p.mate_num ?? null,
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

  // Build teams from mate relationships
  const buildTeams = (): Team[] => {
    const teams: Team[] = [];
    const processedPlayers = new Set<number>();

    for (const player of players) {
      if (processedPlayers.has(player.player_number)) continue;

      const teammates: GamePlayer[] = [player];
      processedPlayers.add(player.player_number);

      // Find mate if exists
      if (player.mate_num) {
        const mate = players.find(p => p.player_number === player.mate_num);
        if (mate && !processedPlayers.has(mate.player_number)) {
          teammates.push(mate);
          processedPlayers.add(mate.player_number);
        }
      }

      // Also check if anyone has this player as their mate
      const reverseMatches = players.filter(
        p => p.mate_num === player.player_number && !processedPlayers.has(p.player_number)
      );
      for (const rm of reverseMatches) {
        teammates.push(rm);
        processedPlayers.add(rm.player_number);
      }

      // Calculate team score (sum of individual scores)
      const teamScore = teammates.reduce((sum, p) => sum + p.jetons + p.recompenses, 0);
      
      // Generate team name
      const teamName = teammates.length === 1 
        ? teammates[0].display_name 
        : teammates.map(t => t.display_name).join(' & ');

      teams.push({
        members: teammates,
        teamScore,
        teamName,
      });
    }

    return teams.sort((a, b) => b.teamScore - a.teamScore);
  };

  const teams = buildTeams();
  const currentPlayerTeam = teams.find(t => 
    t.members.some(m => m.player_number === currentPlayerNumber)
  );

  return (
    <div className="card-gradient rounded-lg border-2 border-amber-500/50 bg-amber-500/10 p-6">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Trophy className="h-8 w-8 text-amber-500" />
        <h3 className="font-display text-xl">🎉 Victoire ! Tous les monstres sont vaincus !</h3>
      </div>

      <p className="text-center text-muted-foreground text-sm mb-4">
        La forêt est libérée ! Voici le classement final par équipe.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3">Rang</th>
              <th className="text-left py-2 px-3">Équipe</th>
              <th className="text-right py-2 px-3">Score Total</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, index) => {
              const isCurrentTeam = team === currentPlayerTeam;
              const isSoloPlayer = team.members.length === 1;
              
              return (
                <tr 
                  key={team.teamName} 
                  className={`border-b border-border/50 ${
                    isCurrentTeam ? 'bg-primary/20 font-bold' : index < 3 ? 'bg-primary/5' : ''
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
                    <div className="flex items-center gap-2">
                      {!isSoloPlayer && <Users className="h-4 w-4 text-primary" />}
                      <div>
                        <div className="font-medium">
                          {team.teamName}
                          {isCurrentTeam && <span className="ml-2 text-primary">(vous)</span>}
                        </div>
                        {!isSoloPlayer && (
                          <div className="text-xs text-muted-foreground">
                            {team.members.map(m => `${m.display_name}: ${m.jetons + m.recompenses}`).join(' | ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-lg text-amber-500">
                    {team.teamScore}
                  </td>
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
