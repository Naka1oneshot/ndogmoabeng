import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useGameTypes } from '@/hooks/useGameTypes';
import { GameCard } from '@/components/games/GameCard';
import { GameTypeEditModal } from '@/components/admin/GameTypeEditModal';
import { ForestButton } from '@/components/ui/ForestButton';
import { RivieresRulesOverlay } from '@/components/rivieres/rules/RivieresRulesOverlay';
import { ForetRulesOverlay } from '@/components/foret/rules/ForetRulesOverlay';
import { InfectionRulesOverlay } from '@/components/infection/rules/InfectionRulesOverlay';
import { SheriffRulesOverlay } from '@/components/sheriff/rules/SheriffRulesOverlay';
import { ArrowRight, Loader2 } from 'lucide-react';
import { GameTypeData } from '@/hooks/useGameTypes';

export function GamesSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdminOrSuper } = useUserRole();
  const { gameTypes, loading, refetch } = useGameTypes();
  
  const [rivieresRulesOpen, setRivieresRulesOpen] = useState(false);
  const [foretRulesOpen, setForetRulesOpen] = useState(false);
  const [infectionRulesOpen, setInfectionRulesOpen] = useState(false);
  const [sheriffRulesOpen, setSheriffRulesOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<GameTypeData | null>(null);

  // Filter games with homepage_order set and sort by order
  const homepageGames = gameTypes
    .filter(game => game.homepage_order !== null)
    .sort((a, b) => (a.homepage_order || 0) - (b.homepage_order || 0))
    .slice(0, 3);
  
  const hasMoreGames = gameTypes.length > 3;

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
      
      <GameTypeEditModal
        open={!!editingGame}
        onClose={() => setEditingGame(null)}
        gameType={editingGame}
        onSaved={refetch}
      />

      <section id="jeux" className="py-20 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl text-glow mb-4">
              Nos Jeux
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Découvrez nos expériences uniques au cœur de l'univers de Ndogmoabeng
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : homepageGames.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-8">
              {homepageGames.map((game) => (
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
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Aucun jeu sélectionné pour l'accueil.</p>
              {isAdminOrSuper && (
                <p className="text-sm mt-2">Éditez les jeux pour définir leur position sur l'accueil.</p>
              )}
            </div>
          )}

          {hasMoreGames && (
            <div className="text-center mt-10">
              <ForestButton 
                variant="outline"
                onClick={() => navigate('/jeux')}
                className="gap-2"
              >
                Voir tous les jeux
                <ArrowRight className="h-4 w-4" />
              </ForestButton>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
