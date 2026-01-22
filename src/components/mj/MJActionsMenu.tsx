import { useState } from 'react';
import { 
  Menu, Presentation, Trophy, FastForward, Trash2, Loader2, BarChart3
} from 'lucide-react';
import { ForestButton } from '@/components/ui/ForestButton';
import { BotVsHumanStatsSheet } from './BotVsHumanStatsSheet';
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
  gameTypeCode: string | null;
  sessionGameId: string | null;
  startingTokens: number;
  isAdventure: boolean;
  currentStepIndex: number;
  advancingStep: boolean;
  deleting: boolean;
  onNextSessionGame: () => Promise<void>;
  onDeleteGame: () => Promise<void>;
}

export function MJActionsMenu({
  gameId,
  gameName,
  gameStatus,
  gameTypeCode,
  sessionGameId,
  startingTokens,
  isAdventure,
  currentStepIndex,
  advancingStep,
  deleting,
  onNextSessionGame,
  onDeleteGame,
}: MJActionsMenuProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showNextGameDialog, setShowNextGameDialog] = useState(false);
  const [statsSheetOpen, setStatsSheetOpen] = useState(false);

  const isForet = gameTypeCode === 'FORET' || !gameTypeCode;
  const isInGame = gameStatus === 'IN_GAME';
  const isEnded = gameStatus === 'ENDED' || gameStatus === 'FINISHED';

  const handlePresentationMode = () => {
    window.open(`/presentation/${gameId}`, '_blank');
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
              className="bg-purple-600 hover:bg-purple-700"
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
