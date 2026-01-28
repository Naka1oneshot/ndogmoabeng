import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ForestButton } from '@/components/ui/ForestButton';
import { GameRulesSheet } from '@/components/landing/GameRulesSheet';
import { RivieresRulesOverlay } from '@/components/rivieres/rules/RivieresRulesOverlay';
import { ForetRulesOverlay } from '@/components/foret/rules/ForetRulesOverlay';
import { InfectionRulesOverlay } from '@/components/infection/rules/InfectionRulesOverlay';
import { SheriffRulesOverlay } from '@/components/sheriff/rules/SheriffRulesOverlay';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { MobileBottomBar } from '@/components/landing/MobileBottomBar';
import { GAMES_DATA } from '@/data/ndogmoabengData';
import { MapPin, Users, Gamepad2, UsersRound, BookOpen, ArrowLeft } from 'lucide-react';

import rivieresImage from '@/assets/games/rivieres-ndogmoabeng.png';
import foretImage from '@/assets/games/foret-ndogmoabeng.png';
import infectionImage from '@/assets/games/infection-ndogmoabeng.png';
import villageImage from '@/assets/games/village-ndogmoabeng.png';

const GAME_IMAGES: Record<string, string> = {
  RIVIERES: rivieresImage,
  FORET: foretImage,
  INFECTION: infectionImage,
  SHERIFF: villageImage,
};

const GAME_IMAGE_POSITIONS: Record<string, string> = {
  RIVIERES: 'object-top',
  FORET: 'object-center',
  INFECTION: 'object-center',
  SHERIFF: 'object-center',
};

export default function Games() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rivieresRulesOpen, setRivieresRulesOpen] = useState(false);
  const [foretRulesOpen, setForetRulesOpen] = useState(false);
  const [infectionRulesOpen, setInfectionRulesOpen] = useState(false);
  const [sheriffRulesOpen, setSheriffRulesOpen] = useState(false);

  const handleCreateGame = (gameCode: string) => {
    if (user) {
      navigate('/mj', { state: { selectedGameType: gameCode } });
    } else {
      navigate('/auth', { state: { redirectTo: '/mj', selectedGameType: gameCode } });
    }
  };

  const handleRulesClick = (gameCode: string) => {
    if (gameCode === 'RIVIERES') {
      setRivieresRulesOpen(true);
      return true;
    }
    if (gameCode === 'FORET') {
      setForetRulesOpen(true);
      return true;
    }
    if (gameCode === 'INFECTION') {
      setInfectionRulesOpen(true);
      return true;
    }
    if (gameCode === 'SHERIFF') {
      setSheriffRulesOpen(true);
      return true;
    }
    return false;
  };

  return (
    <>
      <RivieresRulesOverlay 
        open={rivieresRulesOpen} 
        onClose={() => setRivieresRulesOpen(false)}
        role="PLAYER"
        defaultMode="QUICK"
      />
      <ForetRulesOverlay 
        open={foretRulesOpen} 
        onClose={() => setForetRulesOpen(false)}
        userRole="PLAYER"
        defaultMode="QUICK"
      />
      <InfectionRulesOverlay 
        open={infectionRulesOpen} 
        onClose={() => setInfectionRulesOpen(false)}
        userRole="PLAYER"
        defaultMode="QUICK"
      />
      <SheriffRulesOverlay 
        open={sheriffRulesOpen} 
        onClose={() => setSheriffRulesOpen(false)}
        role="PLAYER"
        defaultMode="QUICK"
      />
      
      <div className="min-h-screen flex flex-col">
        <LandingNavbar />
        
        <main className="flex-1 pt-20 pb-24 md:pb-8">
          <div className="container mx-auto px-4">
            {/* Header */}
            <div className="mb-8">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')}
                className="mb-4 gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour à l'accueil
              </Button>
              
              <h1 className="font-display text-3xl md:text-4xl text-glow mb-4">
                Tous nos jeux
              </h1>
              <p className="text-muted-foreground max-w-2xl">
                Découvrez toutes les expériences disponibles dans l'univers de Ndogmoabeng
              </p>
            </div>

            {/* Games Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                      className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${GAME_IMAGE_POSITIONS[game.code] || 'object-center'}`}
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

                  <CardFooter className="flex flex-col gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full gap-2"
                      onClick={() => handleRulesClick(game.code)}
                    >
                      <BookOpen className="h-4 w-4" />
                      Voir règles
                    </Button>
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
        </main>

        <LandingFooter />
        <MobileBottomBar />
      </div>
    </>
  );
}
