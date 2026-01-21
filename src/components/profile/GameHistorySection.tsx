import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  History, 
  Trophy, 
  Skull, 
  Coins, 
  Gift, 
  Users, 
  Crown,
  ChevronLeft,
  ChevronRight,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useGameHistory } from '@/hooks/useGameHistory';
import { useNavigate } from 'react-router-dom';

const GAME_TYPE_LABELS: Record<string, string> = {
  'FORET': '🌲 Forêt',
  'INFECTION': '🦠 Infection',
  'RIVIERES': '🌊 Rivières',
};

export function GameHistorySection() {
  const navigate = useNavigate();
  const { games, loading, totalCount, page, pageSize, setPage } = useGameHistory(5);
  
  const totalPages = Math.ceil(totalCount / pageSize);

  if (loading && games.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Historique des parties
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Historique des parties
            {totalCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalCount}
              </Badge>
            )}
          </CardTitle>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[40px] text-center">
                {page}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {games.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Aucune partie terminée
          </p>
        ) : (
          <div className="space-y-3">
            {games.map((game) => (
              <div 
                key={game.game_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-muted/50 rounded-lg gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{game.game_name}</span>
                    {game.my_result === 'won' && (
                      <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                        <Trophy className="w-3 h-3 mr-1" />
                        Victoire
                      </Badge>
                    )}
                    {game.my_result === 'lost' && (
                      <Badge variant="secondary" className="opacity-70">
                        Défaite
                      </Badge>
                    )}
                    {game.was_host && (
                      <Badge variant="outline" className="border-purple-500/50 text-purple-500">
                        <Crown className="w-3 h-3 mr-1" />
                        Hôte
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                    <span>{GAME_TYPE_LABELS[game.game_type_code] || game.game_type_name}</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {game.player_count}
                    </span>
                    <span>
                      {format(new Date(game.played_at), 'd MMM yyyy', { locale: fr })}
                    </span>
                    {game.my_team_mate && (
                      <span className="text-primary">
                        avec {game.my_team_mate}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Stats */}
                  <div className="flex items-center gap-2 text-sm">
                    {game.my_kills > 0 && (
                      <div className="flex items-center gap-0.5 text-red-500" title="Kills">
                        <Skull className="w-4 h-4" />
                        <span className="font-medium">{game.my_kills}</span>
                      </div>
                    )}
                    {game.my_recompenses > 0 && (
                      <div className="flex items-center gap-0.5 text-green-500" title="Récompenses">
                        <Gift className="w-4 h-4" />
                        <span className="font-medium">{game.my_recompenses}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-0.5 text-primary" title="Jetons restants">
                      <Coins className="w-4 h-4" />
                      <span className="font-medium">{game.my_jetons}</span>
                    </div>
                  </div>

                  {/* View button for ended games */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/presentation/${game.game_id}`)}
                    title="Voir le podium"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
