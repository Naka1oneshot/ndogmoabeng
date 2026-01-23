import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Swords, Gamepad2, TrendingUp, Crown, Calendar, ExternalLink } from 'lucide-react';
import { useFriendships } from '@/hooks/useFriendships';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUserProfile } from '@/hooks/useUserProfile';

interface Friend {
  friendship_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

interface FriendComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friend: Friend | null;
}

interface Comparison {
  my_games_played: number;
  my_games_won: number;
  friend_games_played: number;
  friend_games_won: number;
  games_together: number;
  my_wins_together: number;
  friend_wins_together: number;
}

interface GameTogether {
  game_id: string;
  game_name: string;
  game_type_code: string;
  played_at: string;
  my_result: 'won' | 'lost' | 'played';
  friend_result: 'won' | 'lost' | 'played';
  my_display_name: string;
  friend_display_name: string;
}

export function FriendComparisonModal({ open, onOpenChange, friend }: FriendComparisonModalProps) {
  const navigate = useNavigate();
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [games, setGames] = useState<GameTogether[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { getFriendComparison, getGamesTogether } = useFriendships();
  const { profile } = useUserProfile();

  useEffect(() => {
    if (open && friend) {
      setLoading(true);
      Promise.all([
        getFriendComparison(friend.user_id),
        getGamesTogether(friend.user_id),
      ]).then(([comp, gms]) => {
        setComparison(comp);
        setGames(gms);
        setLoading(false);
      });
    }
  }, [open, friend, getFriendComparison, getGamesTogether]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getWinRate = (won: number, played: number) => {
    if (played === 0) return 0;
    return Math.round((won / played) * 100);
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'won':
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Victoire</Badge>;
      case 'lost':
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Défaite</Badge>;
      default:
        return <Badge variant="secondary">Joué</Badge>;
    }
  };

  if (!friend) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <button
              onClick={() => {
                onOpenChange(false);
                navigate(`/profile/${friend.user_id}`);
              }}
              className="hover:opacity-80 transition-opacity"
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={friend.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary">
                  {getInitials(friend.display_name)}
                </AvatarFallback>
              </Avatar>
            </button>
            <span>
              Comparaison avec{' '}
              <button
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/profile/${friend.user_id}`);
                }}
                className="hover:underline hover:text-primary transition-colors"
              >
                {friend.display_name}
              </button>
            </span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="stats" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Statistiques
            </TabsTrigger>
            <TabsTrigger value="games" className="flex items-center gap-2">
              <Swords className="w-4 h-4" />
              Parties ensemble
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="flex-1 overflow-auto space-y-6 p-1">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : comparison ? (
              <>
                {/* Overall Stats Comparison */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-primary/10">
                    <p className="text-sm text-muted-foreground mb-1">Vous</p>
                    <p className="text-2xl font-bold">{comparison.my_games_won}</p>
                    <p className="text-xs text-muted-foreground">victoires</p>
                    <p className="text-sm mt-1">
                      {getWinRate(comparison.my_games_won, comparison.my_games_played)}%
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-muted flex items-center justify-center">
                    <div>
                      <Trophy className="w-8 h-8 mx-auto text-yellow-500 mb-2" />
                      <p className="text-xs text-muted-foreground">Taux de victoire</p>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-secondary/50">
                    <p className="text-sm text-muted-foreground mb-1">{friend.display_name}</p>
                    <p className="text-2xl font-bold">{comparison.friend_games_won}</p>
                    <p className="text-xs text-muted-foreground">victoires</p>
                    <p className="text-sm mt-1">
                      {getWinRate(comparison.friend_games_won, comparison.friend_games_played)}%
                    </p>
                  </div>
                </div>

                {/* Games Played */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <Gamepad2 className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold">{comparison.my_games_played}</p>
                    <p className="text-sm text-muted-foreground">Vos parties</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <Gamepad2 className="w-6 h-6 mx-auto mb-2 text-secondary-foreground" />
                    <p className="text-2xl font-bold">{comparison.friend_games_played}</p>
                    <p className="text-sm text-muted-foreground">Parties de {friend.display_name}</p>
                  </div>
                </div>

                {/* Head to Head */}
                <div className="p-4 rounded-lg border bg-card">
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <Swords className="w-5 h-5" />
                    Face à face ({comparison.games_together} parties ensemble)
                  </h3>
                  
                  {comparison.games_together > 0 ? (
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-3 rounded-lg bg-green-500/10">
                        <Crown className="w-5 h-5 mx-auto mb-1 text-green-500" />
                        <p className="text-xl font-bold text-green-600">{comparison.my_wins_together}</p>
                        <p className="text-xs text-muted-foreground">Vos victoires</p>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-muted flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-lg font-bold">
                            {comparison.games_together - comparison.my_wins_together - comparison.friend_wins_together}
                          </p>
                          <p className="text-xs text-muted-foreground">Égalités</p>
                        </div>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-red-500/10">
                        <Crown className="w-5 h-5 mx-auto mb-1 text-red-500" />
                        <p className="text-xl font-bold text-red-600">{comparison.friend_wins_together}</p>
                        <p className="text-xs text-muted-foreground">Victoires de {friend.display_name}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      Vous n'avez pas encore joué ensemble
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Impossible de charger les statistiques
              </p>
            )}
          </TabsContent>

          <TabsContent value="games" className="flex-1 overflow-auto p-1">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : games.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Swords className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Vous n'avez pas encore joué ensemble</p>
              </div>
            ) : (
              <div className="space-y-3">
                {games.map((game) => (
                  <div
                    key={game.game_id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{game.game_name}</h4>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(game.played_at), 'dd MMM yyyy', { locale: fr })}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{profile?.display_name || 'Vous'}:</span>
                        {getResultBadge(game.my_result)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{friend.display_name}:</span>
                        {getResultBadge(game.friend_result)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
