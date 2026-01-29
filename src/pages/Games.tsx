import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useGameTypes } from '@/hooks/useGameTypes';
import { GameCard } from '@/components/games/GameCard';
import { GameTypeEditModal } from '@/components/admin/GameTypeEditModal';
import { RivieresRulesOverlay } from '@/components/rivieres/rules/RivieresRulesOverlay';
import { ForetRulesOverlay } from '@/components/foret/rules/ForetRulesOverlay';
import { InfectionRulesOverlay } from '@/components/infection/rules/InfectionRulesOverlay';
import { SheriffRulesOverlay } from '@/components/sheriff/rules/SheriffRulesOverlay';
import { LionRulesOverlay } from '@/components/lion/rules/LionRulesOverlay';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { MobileBottomBar } from '@/components/landing/MobileBottomBar';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { GameTypeData } from '@/hooks/useGameTypes';

export default function Games() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdminOrSuper } = useUserRole();
  const { gameTypes, loading, refetch } = useGameTypes();
  
  const [rivieresRulesOpen, setRivieresRulesOpen] = useState(false);
  const [foretRulesOpen, setForetRulesOpen] = useState(false);
  const [infectionRulesOpen, setInfectionRulesOpen] = useState(false);
  const [sheriffRulesOpen, setSheriffRulesOpen] = useState(false);
  const [lionRulesOpen, setLionRulesOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<GameTypeData | null>(null);

  const handleCreateGame = (gameCode: string) => {
    if (user) {
      navigate('/mj', { state: { selectedGameType: gameCode } });
    } else {
      navigate('/auth', { state: { redirectTo: '/mj', selectedGameType: gameCode } });
    }
  };

  const handleRulesClick = (gameCode: string) => {
    if (gameCode === 'RIVIERES') setRivieresRulesOpen(true);
    else if (gameCode === 'FORET') setForetRulesOpen(true);
    else if (gameCode === 'INFECTION') setInfectionRulesOpen(true);
    else if (gameCode === 'SHERIFF') setSheriffRulesOpen(true);
    else if (gameCode === 'LION') setLionRulesOpen(true);
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
      <LionRulesOverlay 
        open={lionRulesOpen} 
        onClose={() => setLionRulesOpen(false)}
        role="PLAYER"
        defaultMode="QUICK"
      />
      
      <GameTypeEditModal
        open={!!editingGame}
        onClose={() => setEditingGame(null)}
        gameType={editingGame}
        onSaved={refetch}
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
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {gameTypes.map((game) => (
                  <GameCard
                    key={game.code}
                    game={game}
                    onRulesClick={handleRulesClick}
                    onCreateGame={handleCreateGame}
                    onEditClick={setEditingGame}
                    isAdmin={isAdminOrSuper}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        <LandingFooter />
        <MobileBottomBar />
      </div>
    </>
  );
}
