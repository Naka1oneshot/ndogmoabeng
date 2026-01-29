import { useParams, useNavigate } from 'react-router-dom';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Trophy, Gamepad2, Star, Users, Swords, Calendar, Play } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PublicClanAffinityCard } from '@/components/profile/PublicClanAffinityCard';

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, gameHistory, activeGames, comparison, loading, error } = usePublicProfile(userId || null);

  const isOwnProfile = user?.id === userId;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-6 w-48" />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground mb-4">{error || 'Profil introuvable'}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>
    );
  }

  const winRate = profile.games_played > 0 
    ? Math.round((profile.games_won / profile.games_played) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Profil Joueur</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        {/* Profile Card */}
        <Card className="overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
          <CardContent className="pt-0 -mt-10">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
              <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                <AvatarImage src={profile.avatar_url || undefined} alt={profile.display_name} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {profile.display_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center sm:text-left pb-2">
                <h2 className="text-2xl font-bold">{profile.display_name}</h2>
                <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
                  <Calendar className="h-3 w-3" />
                  Membre depuis {format(new Date(profile.created_at), 'MMMM yyyy', { locale: fr })}
                </p>
              </div>
              {isOwnProfile && (
                <Badge variant="secondary">Mon profil</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Gamepad2 className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{profile.games_played}</p>
              <p className="text-xs text-muted-foreground">Parties jouées</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Trophy className="h-6 w-6 mx-auto text-accent-foreground mb-2" />
              <p className="text-2xl font-bold">{profile.games_won}</p>
              <p className="text-xs text-muted-foreground">Victoires</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Swords className="h-6 w-6 mx-auto text-destructive mb-2" />
              <p className="text-2xl font-bold">{winRate}%</p>
              <p className="text-xs text-muted-foreground">Taux de victoire</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Star className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{profile.total_rewards}</p>
              <p className="text-xs text-muted-foreground">Récompenses</p>
            </CardContent>
          </Card>
        </div>

        {/* Clan Affinity Card */}
        <PublicClanAffinityCard
          clanAffinityId={profile.clan_affinity_id}
          clanAffinityScores={profile.clan_affinity_scores}
          clanAffinityCompletedAt={profile.clan_affinity_completed_at}
        />
        {comparison && user && !isOwnProfile && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Comparaison avec toi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Stats comparison */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-primary">{comparison.my_games_played}</p>
                    <p className="text-xs text-muted-foreground">Tes parties</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <span className="text-muted-foreground">vs</span>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{comparison.target_games_played}</p>
                    <p className="text-xs text-muted-foreground">Ses parties</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-primary">{comparison.my_games_won}</p>
                    <p className="text-xs text-muted-foreground">Tes victoires</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <Trophy className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">{comparison.target_games_won}</p>
                    <p className="text-xs text-muted-foreground">Ses victoires</p>
                  </div>
                </div>

                {/* Games together */}
                {comparison.games_together > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground text-center mb-3">
                      Vous avez joué <span className="font-bold text-foreground">{comparison.games_together}</span> parties ensemble
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <p className="text-xl font-bold text-primary">{comparison.my_wins_together}</p>
                        <p className="text-xs text-muted-foreground">Tes victoires</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-xl font-bold">{comparison.target_wins_together}</p>
                        <p className="text-xs text-muted-foreground">Ses victoires</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Games */}
        {activeGames.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5 text-primary" />
                Parties en cours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeGames.map((game) => (
                <div
                  key={game.game_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{game.game_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {game.game_type_name || 'Type inconnu'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {game.player_count}
                    </Badge>
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      En cours
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent Games */}
        {gameHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5" />
                Dernières parties
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {gameHistory.map((game) => (
                <div
                  key={game.game_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{game.game_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {game.game_type_name} • {format(new Date(game.played_at), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <Badge
                    variant={game.result === 'won' ? 'default' : game.result === 'lost' ? 'destructive' : 'secondary'}
                    className="ml-2 shrink-0"
                  >
                    {game.result === 'won' ? '🏆 Victoire' : game.result === 'lost' ? '💀 Défaite' : 'Joué'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {gameHistory.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Gamepad2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucune partie jouée pour le moment</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
