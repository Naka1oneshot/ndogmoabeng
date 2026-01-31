import { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Info } from 'lucide-react';

// Game type code to display name mapping
const GAME_TYPE_NAMES: Record<string, string> = {
  RIVIERES: 'Rivières',
  FORET: 'Forêt',
  SHERIFF: 'Shérif',
  INFECTION: 'Infection',
  LION: 'Lion',
};

interface PvicBreakdown {
  [sessionGameId: string]: number;
}

interface SessionGameInfo {
  id: string;
  game_type_code: string;
  stepIndex?: number;
}

interface PvicBreakdownTooltipProps {
  playerId: string;
  gameId: string;
  totalPvic: number;
  currentGameReward?: number;
  className?: string;
}

/**
 * A tooltip that shows the breakdown of PVic across adventure games
 */
export function PvicBreakdownTooltip({ 
  playerId, 
  gameId, 
  totalPvic, 
  currentGameReward = 0,
  className = '' 
}: PvicBreakdownTooltipProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [breakdown, setBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchBreakdown = async () => {
    if (fetched) return;
    setLoading(true);
    
    try {
      // Fetch adventure_scores for this player
      const { data: scoreData } = await supabase
        .from('adventure_scores')
        .select('breakdown')
        .eq('game_player_id', playerId)
        .eq('session_id', gameId)
        .maybeSingle();

      if (scoreData?.breakdown) {
        const breakdownObj = scoreData.breakdown as PvicBreakdown;
        const sessionGameIds = Object.keys(breakdownObj);

        if (sessionGameIds.length > 0) {
          // Fetch session_games to get game_type_code
          const { data: sessionGames } = await supabase
            .from('session_games')
            .select('id, game_type_code, step_index')
            .in('id', sessionGameIds);

          if (sessionGames) {
            const breakdownList = sessionGames.map((sg: SessionGameInfo) => {
              const gameTypeName = GAME_TYPE_NAMES[sg.game_type_code] || sg.game_type_code;
              return {
                name: gameTypeName,
                value: breakdownObj[sg.id] || 0,
              };
            }).filter(item => item.value !== 0);

            // Sort by adventure order
            const order = ['Rivières', 'Forêt', 'Shérif', 'Infection', 'Lion'];
            breakdownList.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
            
            setBreakdown(breakdownList);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching PVic breakdown:', e);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  // Fetch on open
  useEffect(() => {
    if (open && !fetched) {
      fetchBreakdown();
    }
  }, [open, fetched]);

  const content = (
    <span className={`inline-flex items-center gap-1 cursor-pointer ${className}`}>
      {totalPvic} PVic
      <Info className="h-3 w-3 opacity-50" />
    </span>
  );

  const tooltipContent = (
    <div className="space-y-1.5 min-w-[140px]">
      <div className="font-semibold text-xs border-b border-border pb-1">Détail PVic</div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Chargement...</div>
      ) : breakdown.length > 0 ? (
        <>
          {breakdown.map((item, idx) => (
            <div key={idx} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
          {currentGameReward > 0 && (
            <div className="flex justify-between text-xs text-primary">
              <span>+ Ce jeu</span>
              <span className="font-medium">+{currentGameReward}</span>
            </div>
          )}
          <div className="flex justify-between text-xs font-bold border-t border-border pt-1 mt-1">
            <span>Total</span>
            <span>{totalPvic}</span>
          </div>
        </>
      ) : (
        <div className="text-xs text-muted-foreground">
          Pas encore de détails disponibles
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button 
            type="button"
            className="inline-flex items-center"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
          >
            {content}
          </button>
        </PopoverTrigger>
        <PopoverContent 
          side="top" 
          className="w-auto p-3 bg-popover border border-border shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {tooltipContent}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center">
            {content}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="p-3 max-w-[200px]">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
