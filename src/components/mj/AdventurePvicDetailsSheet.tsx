import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ForestButton } from '@/components/ui/ForestButton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Loader2 } from 'lucide-react';

// Game type code to display name and emoji mapping
const GAME_TYPE_INFO: Record<string, { name: string; emoji: string; color: string }> = {
  RIVIERES: { name: 'Rivières', emoji: '🌊', color: 'text-blue-400' },
  FORET: { name: 'Forêt', emoji: '🌲', color: 'text-green-400' },
  SHERIFF: { name: 'Shérif', emoji: '🤠', color: 'text-amber-400' },
  INFECTION: { name: 'Infection', emoji: '🦠', color: 'text-purple-400' },
  LION: { name: 'Lion', emoji: '🦁', color: 'text-rose-400' },
};

// Stable column order for adventure games
const GAME_ORDER = ['RIVIERES', 'FORET', 'SHERIFF', 'INFECTION', 'LION'];

interface PvicBreakdown {
  [sessionGameId: string]: number;
}

interface PlayerBreakdown {
  playerId: string;
  playerName: string;
  playerNumber: number | null;
  totalScore: number;
  breakdown: { gameType: string; gameName: string; emoji: string; color: string; value: number }[];
  currentGameEstimate: number;
}

interface AdventurePvicDetailsSheetProps {
  gameId: string;
  adventureId: string | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AdventurePvicDetailsSheet({ 
  gameId, 
  adventureId,
  open: controlledOpen,
  onOpenChange 
}: AdventurePvicDetailsSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playerBreakdowns, setPlayerBreakdowns] = useState<PlayerBreakdown[]>([]);
  const [gameTypes, setGameTypes] = useState<string[]>([]);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  useEffect(() => {
    if (open) {
      fetchAllBreakdowns();
    }
  }, [open, gameId]);

  const fetchAllBreakdowns = async () => {
    setLoading(true);
    try {
      // Fetch all players (ACTIVE + SPECTATOR, excluding host and removed)
      const { data: players } = await supabase
        .from('game_players')
        .select('id, display_name, player_number, pvic, recompenses')
        .eq('game_id', gameId)
        .in('status', ['ACTIVE', 'SPECTATOR'])
        .eq('is_host', false)
        .is('removed_at', null)
        .order('player_number');

      if (!players) {
        setPlayerBreakdowns([]);
        return;
      }

      // Fetch all session_games for this adventure to build stable columns
      const { data: sessionGames } = await supabase
        .from('session_games')
        .select('id, game_type_code, step_index')
        .eq('session_id', gameId)
        .order('step_index', { ascending: true });

      // Build stable game types from session_games (ordered by step_index)
      const stableGameTypes: string[] = [];
      const sessionGameIdByType: Record<string, string[]> = {};
      for (const sg of sessionGames || []) {
        if (!stableGameTypes.includes(sg.game_type_code)) {
          stableGameTypes.push(sg.game_type_code);
        }
        if (!sessionGameIdByType[sg.game_type_code]) {
          sessionGameIdByType[sg.game_type_code] = [];
        }
        sessionGameIdByType[sg.game_type_code].push(sg.id);
      }

      // Fetch all adventure_scores for this game
      const { data: scores } = await supabase
        .from('adventure_scores')
        .select('game_player_id, total_score_value, breakdown')
        .eq('session_id', gameId);

      // Build player breakdowns using stable game types from session_games
      const scoresMap = new Map(scores?.map(s => [s.game_player_id, s]) || []);

      const breakdowns: PlayerBreakdown[] = players.map(player => {
        const scoreData = scoresMap.get(player.id);
        const breakdown: PlayerBreakdown['breakdown'] = [];
        const breakdownObj = (scoreData?.breakdown as PvicBreakdown) || {};
        
        // Build breakdown for each stable game type (including 0 values)
        for (const gameType of stableGameTypes) {
          const sessionGameIds = sessionGameIdByType[gameType] || [];
          // Sum all session game scores for this game type
          let typeTotal = 0;
          for (const sgId of sessionGameIds) {
            typeTotal += breakdownObj[sgId] ?? 0;
          }
          
          const gameInfo = GAME_TYPE_INFO[gameType] || { 
            name: gameType, 
            emoji: '🎮', 
            color: 'text-muted-foreground' 
          };
          
          breakdown.push({
            gameType,
            gameName: gameInfo.name,
            emoji: gameInfo.emoji,
            color: gameInfo.color,
            value: typeTotal,
          });
        }

        // Sort by adventure order
        breakdown.sort((a, b) => GAME_ORDER.indexOf(a.gameType) - GAME_ORDER.indexOf(b.gameType));

        // Current game estimate (recompenses for current session)
        const currentGameEstimate = player.recompenses || 0;
        const totalScore = (scoreData?.total_score_value || 0) + currentGameEstimate;

        return {
          playerId: player.id,
          playerName: player.display_name,
          playerNumber: player.player_number,
          totalScore,
          breakdown,
          currentGameEstimate,
        };
      });

      // Sort by total score descending
      breakdowns.sort((a, b) => b.totalScore - a.totalScore);

      // Use stable game types from session_games (sorted by GAME_ORDER)
      const orderedTypes = stableGameTypes.sort((a, b) => GAME_ORDER.indexOf(a) - GAME_ORDER.indexOf(b));
      setGameTypes(orderedTypes);
      setPlayerBreakdowns(breakdowns);
    } catch (error) {
      console.error('Error fetching PVic breakdowns:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <ForestButton variant="outline" size="sm" className="gap-1.5">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Détails</span>
        </ForestButton>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Détail des PVic par jeu
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-120px)] mt-4">
            {/* Header row with game columns */}
            <div className="sticky top-0 bg-background z-10 pb-2 border-b border-border mb-2">
              <div className="grid gap-2" style={{ gridTemplateColumns: `2fr repeat(${gameTypes.length}, 1fr) auto 1fr` }}>
                <div className="text-xs font-medium text-muted-foreground">Joueur</div>
                {gameTypes.map(gt => {
                  const info = GAME_TYPE_INFO[gt];
                  return (
                    <div key={gt} className={`text-xs font-medium text-center ${info?.color || 'text-muted-foreground'}`}>
                      {info?.emoji} {info?.name.substring(0, 3)}
                    </div>
                  );
                })}
                <div className="text-xs font-medium text-center text-muted-foreground">+Act</div>
                <div className="text-xs font-medium text-right text-primary">Total</div>
              </div>
            </div>

            {/* Player rows */}
            <div className="space-y-1">
              {playerBreakdowns.map((player, index) => {
                const isTop3 = index < 3;
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
                
                return (
                  <div 
                    key={player.playerId}
                    className={`grid gap-2 py-2 px-2 rounded-lg text-sm ${
                      isTop3 ? 'bg-secondary/50' : 'hover:bg-secondary/30'
                    }`}
                    style={{ gridTemplateColumns: `2fr repeat(${gameTypes.length}, 1fr) auto 1fr` }}
                  >
                    {/* Player name */}
                    <div className="flex items-center gap-1.5 truncate">
                      {medal && <span className="text-sm">{medal}</span>}
                      <span className="text-xs text-muted-foreground">#{player.playerNumber}</span>
                      <span className={`truncate ${isTop3 ? 'font-medium' : ''}`}>
                        {player.playerName}
                      </span>
                    </div>

                    {/* Game columns */}
                    {gameTypes.map(gt => {
                      const gameScore = player.breakdown.find(b => b.gameType === gt);
                      return (
                        <div key={gt} className="text-center text-sm font-mono">
                          {gameScore ? (
                            <span className={gameScore.color}>{gameScore.value}</span>
                          ) : (
                            <span className="text-muted-foreground/30">-</span>
                          )}
                        </div>
                      );
                    })}

                    {/* Current game estimate */}
                    <div className="text-center text-sm font-mono">
                      {player.currentGameEstimate > 0 ? (
                        <span className="text-emerald-400">+{player.currentGameEstimate}</span>
                      ) : (
                        <span className="text-muted-foreground/30">-</span>
                      )}
                    </div>

                    {/* Total */}
                    <div className={`text-right font-bold ${
                      index === 0 ? 'text-yellow-400' :
                      index === 1 ? 'text-slate-300' :
                      index === 2 ? 'text-amber-500' :
                      'text-primary'
                    }`}>
                      {player.totalScore}
                    </div>
                  </div>
                );
              })}
            </div>

            {playerBreakdowns.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Aucun joueur avec des scores
              </div>
            )}

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-border">
              <div className="text-xs text-muted-foreground mb-2">Légende:</div>
              <div className="flex flex-wrap gap-3 text-xs">
                {gameTypes.map(gt => {
                  const info = GAME_TYPE_INFO[gt];
                  return (
                    <div key={gt} className="flex items-center gap-1">
                      <span>{info?.emoji}</span>
                      <span className={info?.color}>{info?.name}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-1">
                  <span className="text-emerald-400">+Act</span>
                  <span className="text-muted-foreground">= Jeu en cours (estimé)</span>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
