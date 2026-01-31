import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Crown, Swords, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AdventureFinalistData {
  adventure_game_id: string;
  adventure_name: string;
  finalist_1_id: string;
  finalist_1_name: string;
  finalist_1_score_total: number; // NUMERIC from DB
  finalist_2_id: string;
  finalist_2_name: string;
  finalist_2_score_total: number; // NUMERIC from DB
  winner_player_id: string | null;
  winner_name: string | null;
}

interface AdventureGame {
  id: string;
  name: string;
  created_at: string;
  status: string;
}

export function AdventureResultsSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [adventureGames, setAdventureGames] = useState<AdventureGame[]>([]);
  const [finalistsData, setFinalistsData] = useState<Record<string, AdventureFinalistData>>({});

  useEffect(() => {
    if (!user) return;
    
    async function fetchAdventureResults() {
      setLoading(true);
      try {
        // Get completed adventure games where user participated
        const { data: games, error } = await supabase
          .from('games')
          .select('id, name, created_at, status')
          .eq('mode', 'ADVENTURE')
          .in('status', ['ENDED', 'FINISHED', 'ARCHIVED'])
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('Error fetching adventure games:', error);
          setLoading(false);
          return;
        }

        // Filter to games where user was a participant
        const participatingGames: AdventureGame[] = [];
        const finalists: Record<string, AdventureFinalistData> = {};

        for (const game of games || []) {
          // Check if user participated
          const { data: participation } = await supabase
            .from('game_players')
            .select('id')
            .eq('game_id', game.id)
            .eq('user_id', user.id)
            .eq('is_host', false)
            .maybeSingle();

          if (participation) {
            participatingGames.push(game);

            // Fetch finalists for this adventure
            const { data: finalistData, error: rpcError } = await supabase
              .rpc('get_adventure_finalists_scores', {
                p_game_id: game.id,
                p_user_id: user.id,
              });

            if (!rpcError && finalistData && finalistData.length > 0) {
              finalists[game.id] = finalistData[0] as AdventureFinalistData;
            }
          }
        }

        setAdventureGames(participatingGames);
        setFinalistsData(finalists);
      } catch (err) {
        console.error('Error in fetchAdventureResults:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAdventureResults();
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords className="w-5 h-5" />
            Résultats d'aventure
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (adventureGames.length === 0) {
    return null; // Don't show section if no adventure games
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-amber-500" />
          Résultats d'aventure
          <Badge variant="secondary" className="ml-2">
            {adventureGames.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {adventureGames.map((game) => {
            const finalistInfo = finalistsData[game.id];
            
            return (
              <div 
                key={game.id}
                className="p-4 bg-muted/50 rounded-lg border border-border/50"
              >
                {/* Adventure name */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span className="font-medium">{game.name}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/presentation/${game.id}`)}
                    className="gap-1.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Podium
                  </Button>
                </div>

                {/* Finalists */}
                {finalistInfo ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Finalist 1 */}
                    <div className={`flex items-center gap-3 p-2 rounded-md ${
                      finalistInfo.winner_player_id === finalistInfo.finalist_1_id
                        ? 'bg-yellow-500/10 border border-yellow-500/30'
                        : 'bg-background/50'
                    }`}>
                      <div className="flex-shrink-0">
                        {finalistInfo.winner_player_id === finalistInfo.finalist_1_id ? (
                          <Trophy className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            2
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{finalistInfo.finalist_1_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {finalistInfo.finalist_1_score_total} PVic
                        </p>
                      </div>
                    </div>

                    {/* Finalist 2 */}
                    <div className={`flex items-center gap-3 p-2 rounded-md ${
                      finalistInfo.winner_player_id === finalistInfo.finalist_2_id
                        ? 'bg-yellow-500/10 border border-yellow-500/30'
                        : 'bg-background/50'
                    }`}>
                      <div className="flex-shrink-0">
                        {finalistInfo.winner_player_id === finalistInfo.finalist_2_id ? (
                          <Trophy className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            2
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{finalistInfo.finalist_2_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {finalistInfo.finalist_2_score_total} PVic
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Données des finalistes non disponibles
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
