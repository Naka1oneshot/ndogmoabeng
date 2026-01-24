import { useState } from 'react';
import { 
  Menu, Presentation, Trophy, FastForward, Trash2, Loader2, BarChart3, Zap
} from 'lucide-react';
import { ForestButton } from '@/components/ui/ForestButton';
import { BotVsHumanStatsSheet } from './BotVsHumanStatsSheet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MJActionsMenuProps {
  gameId: string;
  gameName: string;
  gameStatus: string;
  gamePhase: string;
  mancheActive: number;
  gameTypeCode: string | null;
  sessionGameId: string | null;
  startingTokens: number;
  isAdventure: boolean;
  currentStepIndex: number;
  advancingStep: boolean;
  deleting: boolean;
  isAllBots: boolean;
  onNextSessionGame: () => Promise<void>;
  onDeleteGame: () => Promise<void>;
  onGameUpdate: () => void;
}

export function MJActionsMenu({
  gameId,
  gameName,
  gameStatus,
  gamePhase,
  mancheActive,
  gameTypeCode,
  sessionGameId,
  startingTokens,
  isAdventure,
  currentStepIndex,
  advancingStep,
  deleting,
  isAllBots,
  onNextSessionGame,
  onDeleteGame,
  onGameUpdate,
}: MJActionsMenuProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showNextGameDialog, setShowNextGameDialog] = useState(false);
  const [statsSheetOpen, setStatsSheetOpen] = useState(false);
  const [passingManche, setPassingManche] = useState(false);
  const [simulatingGame, setSimulatingGame] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState('');

  const isForet = gameTypeCode === 'FORET' || !gameTypeCode;
  const isInGame = gameStatus === 'IN_GAME';
  const isEnded = gameStatus === 'ENDED' || gameStatus === 'FINISHED';

  // Show "Passer la manche" only for Forêt games with 100% bots
  const canPassManche = isForet && isInGame && isAllBots;

  const handlePresentationMode = () => {
    window.open(`/presentation/${gameId}`, '_blank');
  };

  // Full round automation: Close Phase1 → Publish Positions → Resolve Combat → Resolve Shop
  const handlePasserManche = async () => {
    setPassingManche(true);
    try {
      // Step 1: Close Phase 1 (if in PHASE1_MISES)
      if (gamePhase === 'PHASE1_MISES') {
        toast.info('🎲 Clôture des mises et calcul des priorités...');
        const { data: closeData, error: closeError } = await supabase.functions.invoke('close-phase1-bets', {
          body: { gameId },
        });
        if (closeError || !closeData?.success) {
          throw new Error(closeData?.error || 'Erreur lors de la clôture Phase 1');
        }
        toast.success(`✅ Phase 1 clôturée ! ${closeData.playerCount} joueurs classés.`);
        await new Promise(r => setTimeout(r, 500)); // Small delay for UI feedback
      }

      // Step 2: Publish positions (final positions)
      toast.info('📍 Calcul des positions finales...');
      const { data: posData, error: posError } = await supabase.functions.invoke('publish-positions', {
        body: { gameId },
      });
      if (posError || !posData?.success) {
        throw new Error(posData?.error || 'Erreur lors de la publication des positions');
      }
      toast.success('✅ Positions finales publiées !');
      await new Promise(r => setTimeout(r, 500));

      // Step 3: Resolve combat - CHECK FOR GAME END HERE
      toast.info('⚔️ Résolution des combats...');
      const { data: combatData, error: combatError } = await supabase.functions.invoke('resolve-combat', {
        body: { gameId },
      });
      if (combatError || !combatData?.success) {
        throw new Error(combatData?.error || 'Erreur lors de la résolution du combat');
      }
      toast.success('✅ Combat résolu !');
      
      // Check if combat resolution ended the game (all monsters dead)
      if (combatData.gameEnded) {
        toast.success('🏆 Partie terminée ! Tous les monstres sont vaincus.');
        onGameUpdate();
        return;
      }
      await new Promise(r => setTimeout(r, 500));

      // Step 4: Generate shop (only if game not ended)
      toast.info('🛒 Génération du shop...');
      await supabase.functions.invoke('generate-shop', {
        body: { gameId },
      });
      await new Promise(r => setTimeout(r, 300));

      // Step 5: Resolve shop (moves to next round)
      toast.info('🛍️ Résolution du shop...');
      const { data: shopData, error: shopError } = await supabase.functions.invoke('resolve-shop', {
        body: { gameId },
      });
      if (shopError || !shopData?.success) {
        throw new Error(shopData?.error || 'Erreur lors de la résolution du shop');
      }

      if (shopData.gameEnded) {
        toast.success('🏆 Partie terminée ! Tous les monstres sont vaincus.');
      } else {
        toast.success(`🎯 Manche ${mancheActive} terminée → Passage à la manche ${shopData.nextRound?.manche || mancheActive + 1}`);
      }
      
      onGameUpdate();
    } catch (error) {
      console.error('Passer manche error:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors du passage de manche');
    } finally {
      setPassingManche(false);
    }
  };

  // Full game simulation: Loop through all rounds until game ends
  const handleSimulerPartie = async () => {
    setSimulatingGame(true);
    let currentManche = mancheActive;
    let gameEnded = false;
    
    try {
      while (!gameEnded) {
        setSimulationProgress(`Manche ${currentManche}...`);
        
        // Step 1: Close Phase 1
        toast.info(`🎲 Manche ${currentManche} - Clôture des mises...`);
        const { data: closeData, error: closeError } = await supabase.functions.invoke('close-phase1-bets', {
          body: { gameId },
        });
        if (closeError || !closeData?.success) {
          throw new Error(closeData?.error || 'Erreur clôture Phase 1');
        }
        await new Promise(r => setTimeout(r, 300));

        // Step 2: Publish positions
        const { data: posData, error: posError } = await supabase.functions.invoke('publish-positions', {
          body: { gameId },
        });
        if (posError || !posData?.success) {
          throw new Error(posData?.error || 'Erreur positions');
        }
        await new Promise(r => setTimeout(r, 300));

        // Step 3: Resolve combat - CHECK FOR GAME END HERE
        const { data: combatData, error: combatError } = await supabase.functions.invoke('resolve-combat', {
          body: { gameId },
        });
        if (combatError || !combatData?.success) {
          throw new Error(combatData?.error || 'Erreur combat');
        }
        
        // Check if combat resolution ended the game (all monsters dead)
        if (combatData.gameEnded) {
          gameEnded = true;
          toast.success(`🏆 Partie terminée après ${currentManche} manches ! Tous les monstres sont vaincus.`);
          break;
        }
        await new Promise(r => setTimeout(r, 300));

        // Step 4: Generate shop (only if game not ended)
        await supabase.functions.invoke('generate-shop', {
          body: { gameId },
        });
        await new Promise(r => setTimeout(r, 200));

        // Step 5: Resolve shop
        const { data: shopData, error: shopError } = await supabase.functions.invoke('resolve-shop', {
          body: { gameId },
        });
        if (shopError || !shopData?.success) {
          throw new Error(shopData?.error || 'Erreur shop');
        }

        if (shopData.gameEnded) {
          gameEnded = true;
          toast.success(`🏆 Partie terminée après ${currentManche} manches !`);
        } else {
          currentManche = shopData.nextRound?.manche || currentManche + 1;
        }
        
        // Safety: max 20 rounds to prevent infinite loop
        if (currentManche > 20) {
          toast.warning('⚠️ Limite de 20 manches atteinte');
          break;
        }
      }
      
      onGameUpdate();
    } catch (error) {
      console.error('Simulation error:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur simulation');
    } finally {
      setSimulatingGame(false);
      setSimulationProgress('');
    }
  };

  return (
    <>
      {/* Desktop: Show buttons inline */}
      <div className="hidden sm:flex items-center gap-3 flex-wrap">
        {isForet && isInGame && (
          <>
            <ForestButton 
              size="sm" 
              onClick={handlePresentationMode}
              className="bg-purple-600/90 hover:bg-purple-600"
            >
              <Presentation className="h-4 w-4 mr-1" />
              Mode Présentation
            </ForestButton>
            <BotVsHumanStatsSheet 
              gameId={gameId} 
              sessionGameId={sessionGameId}
              startingTokens={startingTokens}
            />
          </>
        )}

        {/* Passer la manche - Only for 100% bot games in Forêt */}
        {canPassManche && (
          <>
            <ForestButton
              size="sm"
              className="bg-amber-600/90 hover:bg-amber-600"
              disabled={passingManche || simulatingGame}
              onClick={handlePasserManche}
            >
              {passingManche ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Zap className="h-4 w-4 mr-1" />
              )}
              Passer la manche
            </ForestButton>
            <ForestButton
              size="sm"
              className="bg-orange-600/90 hover:bg-orange-600"
              disabled={passingManche || simulatingGame}
              onClick={handleSimulerPartie}
            >
              {simulatingGame ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  {simulationProgress || 'Simulation...'}
                </>
              ) : (
                <>
                  <FastForward className="h-4 w-4 mr-1" />
                  Simuler la partie
                </>
              )}
            </ForestButton>
          </>
        )}

        {isForet && isEnded && (
          <ForestButton 
            size="sm" 
            onClick={handlePresentationMode}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            <Trophy className="h-4 w-4 mr-1" />
            Voir le Podium
          </ForestButton>
        )}

        {isAdventure && isInGame && (
          <ForestButton
            size="sm"
            className="bg-primary hover:bg-primary/90"
            disabled={advancingStep}
            onClick={() => setShowNextGameDialog(true)}
          >
            {advancingStep ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <FastForward className="h-4 w-4 mr-1" />
            )}
            Jeu suivant
          </ForestButton>
        )}

        <ForestButton
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={deleting}
          onClick={() => setShowDeleteDialog(true)}
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Trash2 className="h-4 w-4 mr-1" />
          )}
          Supprimer
        </ForestButton>
      </div>

      {/* Mobile: Hamburger menu */}
      <div className="flex sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ForestButton variant="outline" size="sm">
              <Menu className="h-4 w-4" />
            </ForestButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-background border border-border z-50">
            {isForet && isInGame && (
              <>
                <DropdownMenuItem onClick={handlePresentationMode}>
                  <Presentation className="h-4 w-4 mr-2" />
                  Mode Présentation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatsSheetOpen(true)}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Stats Bots vs Humains
                </DropdownMenuItem>
              </>
            )}

            {/* Passer la manche - Only for 100% bot games */}
            {canPassManche && (
              <>
                <DropdownMenuItem
                  onClick={handlePasserManche}
                  disabled={passingManche || simulatingGame}
                >
                  {passingManche ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Passer la manche
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleSimulerPartie}
                  disabled={passingManche || simulatingGame}
                >
                  {simulatingGame ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <FastForward className="h-4 w-4 mr-2" />
                  )}
                  {simulatingGame ? simulationProgress : 'Simuler la partie'}
                </DropdownMenuItem>
              </>
            )}

            {isForet && isEnded && (
              <DropdownMenuItem onClick={handlePresentationMode}>
                <Trophy className="h-4 w-4 mr-2" />
                Voir le Podium
              </DropdownMenuItem>
            )}

            {isAdventure && isInGame && (
              <DropdownMenuItem 
                onClick={() => setShowNextGameDialog(true)}
                disabled={advancingStep}
              >
                {advancingStep ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FastForward className="h-4 w-4 mr-2" />
                )}
                Jeu suivant
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem 
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleting}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Supprimer la partie
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats Sheet (triggered from mobile menu) */}
      <BotVsHumanStatsSheet 
        gameId={gameId} 
        sessionGameId={sessionGameId ?? undefined}
        startingTokens={startingTokens}
        open={statsSheetOpen}
        onOpenChange={setStatsSheetOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la partie ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données de la partie
              "{gameName}" seront définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowDeleteDialog(false);
                onDeleteGame();
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Next Game Confirmation Dialog */}
      <AlertDialog open={showNextGameDialog} onOpenChange={setShowNextGameDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Passer au jeu suivant ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action terminera le jeu actuel (étape {currentStepIndex}) et démarrera 
              la prochaine étape de l'aventure. Les inventaires seront réinitialisés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setShowNextGameDialog(false);
                onNextSessionGame();
              }}
            >
              Continuer l'aventure
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
