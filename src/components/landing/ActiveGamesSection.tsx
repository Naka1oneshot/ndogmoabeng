import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ForestButton } from '@/components/ui/ForestButton';
import { JoinGameModal } from '@/components/game/JoinGameModal';
import { useActiveGamesList } from '@/hooks/useActiveGamesList';
import { Users, Gamepad2, Clock, LogIn, Globe } from 'lucide-react';

const gameTypeLabels: Record<string, string> = {
  FORET: 'La Forêt',
  RIVIERES: 'Les Rivières',
  INFECTION: 'Infection',
};

const modeLabels: Record<string, string> = {
  SINGLE_GAME: 'Partie unique',
  ADVENTURE: 'Aventure',
};

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  LOBBY: { label: 'En attente', variant: 'secondary' },
  IN_GAME: { label: 'En cours', variant: 'default' },
  RUNNING: { label: 'En cours', variant: 'default' },
};

export function ActiveGamesSection() {
  const navigate = useNavigate();
  const { games, loading } = useActiveGamesList();
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  const handleJoinPublicGame = (joinCode: string) => {
    // Navigate directly to join page with the code pre-filled
    navigate(`/join/${joinCode}`);
  };

  if (loading) {
    return (
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded w-48 mx-auto mb-4" />
              <div className="h-4 bg-muted rounded w-64 mx-auto" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (games.length === 0) {
    return (
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="card-gradient border-border/50 max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-display text-xl mb-2">
                Aucune partie publique en cours
              </h3>
              <p className="text-muted-foreground mb-6">
                Rejoignez une partie privée avec un code ou créez la vôtre !
              </p>
              <ForestButton onClick={() => setJoinModalOpen(true)}>
                <LogIn className="h-4 w-4" />
                Rejoindre avec un code
              </ForestButton>
            </CardContent>
          </Card>
        </div>
        <JoinGameModal open={joinModalOpen} onOpenChange={setJoinModalOpen} />
      </section>
    );
  }

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl text-glow mb-4">
            Parties publiques en cours
          </h2>
          <p className="text-muted-foreground">
            Rejoignez une partie ouverte à tous
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {games.map((game) => (
            <Card 
              key={game.id} 
              className="card-gradient border-border/50 hover:border-primary/30 transition-colors"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Badge variant={statusLabels[game.status]?.variant || 'outline'}>
                    <Clock className="w-3 h-3 mr-1" />
                    {statusLabels[game.status]?.label || game.status}
                  </Badge>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    <Globe className="w-3 h-3 mr-1" />
                    Publique
                  </Badge>
                </div>
                <CardTitle className="font-display text-lg">
                  {game.name}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Gamepad2 className="w-4 h-4" />
                    <span>
                      {game.selected_game_type_code 
                        ? gameTypeLabels[game.selected_game_type_code] || game.selected_game_type_code
                        : 'Non défini'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{game.playerCount} joueur{game.playerCount > 1 ? 's' : ''}</span>
                  </div>
                </div>

                <ForestButton 
                  className="w-full"
                  onClick={() => handleJoinPublicGame(game.join_code)}
                >
                  <LogIn className="h-4 w-4" />
                  Rejoindre
                </ForestButton>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-8">
          <ForestButton variant="outline" onClick={() => setJoinModalOpen(true)}>
            <LogIn className="h-4 w-4" />
            Rejoindre une partie privée avec un code
          </ForestButton>
        </div>
      </div>

      <JoinGameModal open={joinModalOpen} onOpenChange={setJoinModalOpen} />
    </section>
  );
}
