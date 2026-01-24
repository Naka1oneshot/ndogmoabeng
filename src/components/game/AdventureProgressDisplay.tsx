import { Badge } from '@/components/ui/badge';
import { Swords, Droplets, Bug, ChevronRight, Shield, Map } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdventureProgressDisplayProps {
  mode: string;
  currentStepIndex?: number;
  currentGameTypeCode?: string | null;
  adventureSteps?: { game_type_code: string; step_index: number }[];
  adventureId?: string | null;
  compact?: boolean;
  showTitle?: boolean;
}

const GAME_INFO: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  RIVIERES: { label: 'Rivières', icon: Droplets, color: 'text-blue-400' },
  FORET: { label: 'Forêt', icon: Swords, color: 'text-emerald-400' },
  INFECTION: { label: 'Infection', icon: Bug, color: 'text-red-400' },
  SHERIFF: { label: 'Shérif', icon: Shield, color: 'text-amber-400' },
};

// Default trilogy order
const DEFAULT_ADVENTURE_ORDER = ['RIVIERES', 'FORET', 'INFECTION'];

export function AdventureProgressDisplay({
  mode,
  currentStepIndex = 0,
  currentGameTypeCode,
  adventureSteps: providedSteps,
  adventureId,
  compact = false,
  showTitle = false,
}: AdventureProgressDisplayProps) {
  const isAdventure = mode === 'ADVENTURE';
  const [fetchedSteps, setFetchedSteps] = useState<{ game_type_code: string; step_index: number }[]>([]);
  const [adventureName, setAdventureName] = useState<string | null>(null);

  // Fetch adventure steps if not provided and adventureId is available
  useEffect(() => {
    if (isAdventure && adventureId && !providedSteps) {
      const fetchSteps = async () => {
        const { data: stepsData } = await supabase
          .from('adventure_steps')
          .select('game_type_code, step_index')
          .eq('adventure_id', adventureId)
          .order('step_index');
        
        if (stepsData) {
          setFetchedSteps(stepsData);
        }

        // Also fetch adventure name if showTitle is true
        if (showTitle) {
          const { data: adventureData } = await supabase
            .from('adventures')
            .select('name')
            .eq('id', adventureId)
            .single();
          
          if (adventureData) {
            setAdventureName(adventureData.name);
          }
        }
      };
      fetchSteps();
    }
  }, [adventureId, isAdventure, providedSteps, showTitle]);

  // Determine the games order
  const adventureSteps = providedSteps || fetchedSteps;
  const gamesOrder = adventureSteps.length > 0
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
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="default" className="bg-primary/80 flex items-center gap-1">
          <Map className="w-3 h-3" />
          Aventure
        </Badge>
        {showTitle && adventureName && (
          <span className="text-sm font-medium text-foreground/80">{adventureName}</span>
        )}
        <span className="text-xs text-muted-foreground">
          ({currentStepIndex + 1}/{gamesOrder.length} jeux)
        </span>
      </div>
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
