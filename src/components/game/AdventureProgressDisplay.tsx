import { Badge } from '@/components/ui/badge';
import { Swords, Droplets, Bug, ChevronRight } from 'lucide-react';

interface AdventureProgressDisplayProps {
  mode: string;
  currentStepIndex?: number;
  currentGameTypeCode?: string | null;
  adventureSteps?: { game_type_code: string; step_index: number }[];
  compact?: boolean;
}

const GAME_INFO: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  RIVIERES: { label: 'Rivières', icon: Droplets, color: 'text-blue-400' },
  FORET: { label: 'Forêt', icon: Swords, color: 'text-emerald-400' },
  INFECTION: { label: 'Infection', icon: Bug, color: 'text-red-400' },
};

// Default trilogy order
const DEFAULT_ADVENTURE_ORDER = ['RIVIERES', 'FORET', 'INFECTION'];

export function AdventureProgressDisplay({
  mode,
  currentStepIndex = 0,
  currentGameTypeCode,
  adventureSteps,
  compact = false,
}: AdventureProgressDisplayProps) {
  const isAdventure = mode === 'ADVENTURE';

  // Determine the games order
  const gamesOrder = adventureSteps
    ? adventureSteps.sort((a, b) => a.step_index - b.step_index).map((s) => s.game_type_code)
    : DEFAULT_ADVENTURE_ORDER;

  if (!isAdventure) {
    // Single game mode
    const gameCode = currentGameTypeCode || 'FORET';
    const gameInfo = GAME_INFO[gameCode] || GAME_INFO.FORET;
    const Icon = gameInfo.icon;

    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-secondary/50">
          Partie unique
        </Badge>
        {currentGameTypeCode && (
          <span className={`flex items-center gap-1 text-sm ${gameInfo.color}`}>
            <Icon className="w-3 h-3" />
            {gameInfo.label}
          </span>
        )}
      </div>
    );
  }

  // Adventure mode - show progression
  return (
    <div className="flex flex-col gap-1">
      <Badge variant="default" className="w-fit bg-primary/80">
        Aventure
      </Badge>
      <div className="flex items-center gap-1 flex-wrap">
        {gamesOrder.map((gameCode, index) => {
          const gameInfo = GAME_INFO[gameCode] || { label: gameCode, icon: Swords, color: 'text-muted-foreground' };
          const Icon = gameInfo.icon;

          const isPast = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isFuture = index > currentStepIndex;

          let stateClasses = '';
          if (isPast) {
            stateClasses = 'text-muted-foreground line-through opacity-60';
          } else if (isCurrent) {
            stateClasses = `${gameInfo.color} font-semibold`;
          } else {
            stateClasses = 'text-muted-foreground/50';
          }

          return (
            <div key={gameCode} className="flex items-center">
              <span
                className={`flex items-center gap-1 text-xs ${stateClasses} ${
                  isCurrent ? 'bg-secondary/80 px-2 py-0.5 rounded' : ''
                }`}
              >
                <Icon className={`w-3 h-3 ${isCurrent ? 'animate-pulse' : ''}`} />
                {!compact && gameInfo.label}
              </span>
              {index < gamesOrder.length - 1 && (
                <ChevronRight className="w-3 h-3 text-muted-foreground/30 mx-0.5" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
