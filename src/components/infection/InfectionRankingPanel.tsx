import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skull, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { INFECTION_ROLE_LABELS } from './InfectionTheme';

// Game type code to display name mapping
const GAME_TYPE_NAMES: Record<string, string> = {
  RIVIERES: 'Riv',
  FORET: 'Forêt',
  SHERIFF: 'Shérif',
  INFECTION: 'Infect',
};

const GAME_ORDER = ['RIVIERES', 'FORET', 'SHERIFF', 'INFECTION'];

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  pvic: number | null;
  is_alive: boolean | null;
  role_code: string | null;
  recompenses?: number | null;
}

interface SessionGameInfo {
  id: string;
  game_type_code: string;
}

interface BreakdownByPlayer {
  [playerId: string]: {
    [gameTypeCode: string]: number;
  };
}

interface InfectionRankingPanelProps {
  players: Player[];
  gameId: string;
  isAdventure: boolean;
  currentSessionGameId?: string | null;
}

export function InfectionRankingPanel({ 
  players, 
  gameId, 
  isAdventure,
  currentSessionGameId 
}: InfectionRankingPanelProps) {
  const [breakdowns, setBreakdowns] = useState<BreakdownByPlayer>({});
  const [sessionGames, setSessionGames] = useState<SessionGameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!isAdventure) {
      setLoading(false);
      return;
    }

    const fetchBreakdowns = async () => {
      try {
        // Fetch all adventure_scores for this game's players
        const playerIds = players.map(p => p.id);
        
        const { data: scoresData } = await supabase
          .from('adventure_scores')
          .select('game_player_id, breakdown')
          .eq('session_id', gameId)
          .in('game_player_id', playerIds);

        if (scoresData && scoresData.length > 0) {
          // Collect all session_game_ids from breakdowns
          const allSessionGameIds = new Set<string>();
          scoresData.forEach(score => {
            if (score.breakdown) {
              Object.keys(score.breakdown as Record<string, number>).forEach(id => {
                allSessionGameIds.add(id);
              });
            }
          });

          // Fetch session_games to get game_type_code
          let sgData: SessionGameInfo[] = [];
          if (allSessionGameIds.size > 0) {
            const { data } = await supabase
              .from('session_games')
              .select('id, game_type_code')
              .in('id', Array.from(allSessionGameIds));

            if (data) {
              sgData = data as SessionGameInfo[];
              // Sort by game order
              const sorted = [...sgData].sort((a, b) => {
                return GAME_ORDER.indexOf(a.game_type_code) - GAME_ORDER.indexOf(b.game_type_code);
              });
              setSessionGames(sorted);
            }
          }

          // Build breakdown by player
          const result: BreakdownByPlayer = {};
          scoresData.forEach(score => {
            if (score.breakdown) {
              const breakdown = score.breakdown as Record<string, number>;
              const byGameType: Record<string, number> = {};
              
              Object.entries(breakdown).forEach(([sgId, value]) => {
                const sg = sgData.find(s => s.id === sgId);
                if (sg) {
                  byGameType[sg.game_type_code] = (byGameType[sg.game_type_code] || 0) + value;
                }
              });
              
              result[score.game_player_id] = byGameType;
            }
          });
          
          setBreakdowns(result);
        }
      } catch (e) {
        console.error('Error fetching breakdowns:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchBreakdowns();
  }, [gameId, players, isAdventure]);

  // Get unique game types that have been played
  const playedGameTypes = Array.from(
    new Set(sessionGames.map(sg => sg.game_type_code))
  ).sort((a, b) => GAME_ORDER.indexOf(a) - GAME_ORDER.indexOf(b));

  const activePlayers = players.filter(p => p.player_number !== null);
  const sortedPlayers = [...activePlayers].sort((a, b) => (b.pvic || 0) - (a.pvic || 0));

  return (
    <div className="space-y-2">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-sm font-semibold text-[#D4AF37] hover:text-[#D4AF37]/80 transition-colors"
      >
        <span>Classement Complet</span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      
      {expanded && (
        <>
          {/* Header with game type columns */}
          {isAdventure && playedGameTypes.length > 0 && (
            <div className="flex items-center text-xs text-[#6B7280] border-b border-[#2A3441] pb-1 mb-1">
              <div className="flex-1">Joueur</div>
              <div className="flex gap-2 items-center">
                {playedGameTypes.map(gt => (
                  <span key={gt} className="w-12 text-center font-medium">
                    {GAME_TYPE_NAMES[gt] || gt}
                  </span>
                ))}
                <span className="w-16 text-center font-bold text-[#2AB3A6]">Total</span>
              </div>
            </div>
          )}

          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {sortedPlayers.map((p, idx) => {
              const roleInfo = p.role_code ? INFECTION_ROLE_LABELS[p.role_code] : null;
              const isTop3 = idx < 3;
              const playerBreakdown = breakdowns[p.id] || {};
              
              // Calculate current game rewards (recompenses not yet committed to pvic)
              const currentRewards = p.recompenses || 0;
              
              return (
                <div 
                  key={p.id} 
                  className={`flex items-center justify-between p-2 rounded ${
                    isTop3 ? 'bg-[#1A2235]' : 'bg-[#121A2B]'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`font-mono shrink-0 ${
                      idx === 0 ? 'text-lg font-bold text-yellow-400' :
                      idx === 1 ? 'text-lg font-bold text-gray-300' :
                      idx === 2 ? 'text-lg font-bold text-amber-600' :
                      'text-sm text-[#6B7280]'
                    }`}>
                      #{idx + 1}
                    </span>
                    <span className={`truncate ${p.is_alive === false ? 'line-through text-[#6B7280]' : ''}`}>
                      {p.display_name}
                    </span>
                    {roleInfo && (
                      <Badge 
                        className="text-xs shrink-0"
                        style={{ backgroundColor: `${roleInfo.color}20`, color: roleInfo.color }}
                      >
                        {roleInfo.short}
                      </Badge>
                    )}
                    {p.is_alive === false && (
                      <Skull className="h-3 w-3 text-[#B00020] shrink-0" />
                    )}
                  </div>
                  
                  {isAdventure && playedGameTypes.length > 0 ? (
                    <div className="flex gap-2 items-center shrink-0">
                      {playedGameTypes.map(gt => {
                        const value = playerBreakdown[gt] || 0;
                        // For current INFECTION game, show recompenses as pending
                        const isCurrent = gt === 'INFECTION' && currentSessionGameId;
                        return (
                          <span 
                            key={gt} 
                            className={`w-12 text-center text-xs ${
                              value > 0 ? 'text-[#9CA3AF]' : 'text-[#4B5563]'
                            }`}
                          >
                            {value > 0 ? value : '-'}
                            {isCurrent && currentRewards > 0 && (
                              <span className="text-primary ml-0.5">+{currentRewards}</span>
                            )}
                          </span>
                        );
                      })}
                      <span className={`w-16 text-center font-bold ${isTop3 ? 'text-[#2AB3A6]' : 'text-[#6B7280]'}`}>
                        {p.pvic || 0}
                      </span>
                    </div>
                  ) : (
                    <span className={`font-bold ${isTop3 ? 'text-[#2AB3A6]' : 'text-[#6B7280]'}`}>
                      {p.pvic || 0} PVic
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          
          {loading && isAdventure && (
            <p className="text-xs text-[#6B7280] text-center">Chargement des détails...</p>
          )}
        </>
      )}
    </div>
  );
}
