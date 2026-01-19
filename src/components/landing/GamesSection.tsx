import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ForestButton } from '@/components/ui/ForestButton';
import { GAMES_DATA } from '@/data/ndogmoabengData';
import { MapPin, Users, Gamepad2, UsersRound } from 'lucide-react';

import rivieresImage from '@/assets/games/rivieres-ndogmoabeng.png';
import foretImage from '@/assets/games/foret-ndogmoabeng.png';
import infectionImage from '@/assets/games/infection-ndogmoabeng.png';

const GAME_IMAGES: Record<string, string> = {
  RIVIERES: rivieresImage,
  FORET: foretImage,
  INFECTION: infectionImage,
};

export function GamesSection() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleCreateGame = (gameCode: string) => {
    if (user) {
      // If user is authenticated, go to MJ dashboard with pre-selected game type
      navigate('/mj', { state: { selectedGameType: gameCode } });
    } else {
      // If not authenticated, redirect to auth first
      navigate('/auth', { state: { redirectTo: '/mj', selectedGameType: gameCode } });
    }
  };

  return (
    <section id="jeux" className="py-20 scroll-mt-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl text-glow mb-4">
            Nos Jeux
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Trois expériences uniques au cœur de l'univers de Ndogmoabeng
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {GAMES_DATA.map((game) => (
            <Card 
              key={game.id} 
              className="card-gradient border-border/50 hover:border-primary/50 transition-colors group overflow-hidden"
            >
              {/* Game image */}
              <div className="aspect-[3/4] relative overflow-hidden">
                <img 
                  src={GAME_IMAGES[game.code]} 
                  alt={game.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
              </div>

              <CardHeader className="pb-2">
                <Badge variant="outline" className="w-fit mb-2 text-primary border-primary/50">
                  {game.tagline}
                </Badge>
                <h3 className="font-display text-xl">
                  {game.name}
                </h3>
              </CardHeader>

              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <UsersRound className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-foreground font-medium">{game.minPlayers} joueurs minimum</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{game.lieu}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{game.clan}</span>
                </div>
                {game.personnages && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {game.personnages.slice(0, 3).map((p, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {p}
                      </Badge>
                    ))}
                    {game.personnages.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{game.personnages.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
                {game.objetCle && (
                  <p className="text-primary/80 italic text-sm">
                    "{game.objetCle}"
                  </p>
                )}
              </CardContent>

              <CardFooter>
                <ForestButton 
                  className="w-full"
                  onClick={() => handleCreateGame(game.code)}
                >
                  <Gamepad2 className="h-4 w-4" />
                  Créer une partie
                </ForestButton>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
