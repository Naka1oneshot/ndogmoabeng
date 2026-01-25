import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Trophy, Skull, Syringe, FlaskConical, Shield, Star, Target, CheckCircle2 } from 'lucide-react';
import { INFECTION_ROLE_LABELS, getInfectionThemeClasses } from './InfectionTheme';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  role_code: string | null;
  is_alive: boolean | null;
  jetons: number | null;
  pvic: number | null;
  team_code: string | null;
}

interface PvicBreakdown {
  player_num: number;
  pvic_earned: number;
  breakdown: string[];
}

interface InfectionGameEndScreenProps {
  gameId: string;
  sessionGameId: string;
  player: Player;
}

export function InfectionGameEndScreen({ gameId, sessionGameId, player }: InfectionGameEndScreenProps) {
  const theme = getInfectionThemeClasses();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [pvicBreakdowns, setPvicBreakdowns] = useState<PvicBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [gameId, sessionGameId]);

  const fetchData = async () => {
    // Fetch all players
    const { data: playersData } = await supabase
      .from('game_players')
      .select('id, display_name, player_number, role_code, is_alive, jetons, pvic, team_code')
      .eq('game_id', gameId)
      .is('removed_at', null)
      .order('player_number');

    if (playersData) {
      setAllPlayers(playersData as Player[]);
    }

    // Fetch victory event with PVic breakdowns
    const { data: victoryEvent } = await supabase
      .from('game_events')
      .select('message, payload')
      .eq('session_game_id', sessionGameId)
      .eq('event_type', 'GAME_END')
      .maybeSingle();

    if (victoryEvent) {
      const payload = victoryEvent.payload as { winner?: string; pvicUpdates?: PvicBreakdown[] } | null;
      setWinner(payload?.winner || (victoryEvent.message.includes('SY') ? 'SY' : 'PV'));
      if (payload?.pvicUpdates) {
        setPvicBreakdowns(payload.pvicUpdates);
      }
    }

    setLoading(false);
  };

  const getWinnerInfo = () => {
    if (winner === 'SY') {
      return {
        title: 'Victoire des Synthétistes !',
        subtitle: "L'antidote a été trouvé ! La population est sauvée.",
        icon: FlaskConical,
        color: '#2AB3A6',
        bgColor: 'bg-[#2AB3A6]/20',
      };
    } else if (winner === 'NON_PV') {
      return {
        title: 'Victoire des Citoyens du Village !',
        subtitle: 'Tous les Porte-Venin ont été éliminés. Le village est sauf.',
        icon: Trophy,
        color: '#60A5FA',
        bgColor: 'bg-[#60A5FA]/20',
      };
    } else if (winner === 'PV') {
      return {
        title: 'Victoire des Porte-Venin !',
        subtitle: "Le virus s'est propagé. L'humanité est condamnée.",
        icon: Syringe,
        color: '#B00020',
        bgColor: 'bg-[#B00020]/20',
      };
    }
    return {
      title: 'Partie terminée',
      subtitle: 'Résultats de la partie',
      icon: Trophy,
      color: '#D4AF37',
      bgColor: 'bg-[#D4AF37]/20',
    };
  };

  const winnerInfo = getWinnerInfo();
  const WinnerIcon = winnerInfo.icon;
  
  const roleInfo = player.role_code ? INFECTION_ROLE_LABELS[player.role_code] : null;
  const playerWon = (winner === 'SY' && player.team_code === 'SY') || 
                    (winner === 'NON_PV' && (player.team_code === 'CITOYEN' || player.team_code === 'NEUTRE')) ||
                    (winner === 'PV' && player.team_code === 'PV');

  // Get player's PVic breakdown
  const myBreakdown = pvicBreakdowns.find(b => b.player_num === player.player_number);

  // Sort players: winners first, then by pvic
  const sortedPlayers = [...allPlayers].sort((a, b) => {
    const aWon = (winner === 'SY' && a.team_code === 'SY') || 
                 (winner === 'NON_PV' && (a.team_code === 'CITOYEN' || a.team_code === 'NEUTRE')) || 
                 (winner === 'PV' && a.team_code === 'PV');
    const bWon = (winner === 'SY' && b.team_code === 'SY') || 
                 (winner === 'NON_PV' && (b.team_code === 'CITOYEN' || b.team_code === 'NEUTRE')) || 
                 (winner === 'PV' && b.team_code === 'PV');
    if (aWon && !bWon) return -1;
    if (!aWon && bWon) return 1;
    return (b.pvic || 0) - (a.pvic || 0);
  });

  if (loading) {
    return (
      <div className={`${theme.container} flex items-center justify-center min-h-screen`}>
        <p className="text-[#6B7280]">Chargement...</p>
      </div>
    );
  }

  return (
    <div className={`${theme.container} min-h-screen p-4`}>
      <ScrollArea className="h-[calc(100vh-2rem)]">
        {/* Winner Banner */}
        <div className={`${winnerInfo.bgColor} rounded-xl p-6 text-center mb-6 border`} style={{ borderColor: `${winnerInfo.color}50` }}>
          <WinnerIcon className="h-16 w-16 mx-auto mb-4" style={{ color: winnerInfo.color }} />
          <h1 className="text-2xl font-bold mb-2" style={{ color: winnerInfo.color }}>
            {winnerInfo.title}
          </h1>
          <p className="text-[#9CA3AF]">{winnerInfo.subtitle}</p>
        </div>

        {/* Personal Result */}
        <div className={`${theme.card} p-4 mb-6`}>
          <div className="text-center">
            <p className="text-sm text-[#6B7280] mb-2">Vous étiez</p>
            {roleInfo && (
              <Badge 
                className="text-lg px-4 py-2 mb-3"
                style={{ backgroundColor: `${roleInfo.color}20`, color: roleInfo.color }}
              >
                {roleInfo.name}
              </Badge>
            )}
            <div className={`mt-4 p-3 rounded-lg ${playerWon ? 'bg-[#2AB3A6]/10' : 'bg-[#B00020]/10'}`}>
              {playerWon ? (
                <div className="flex items-center justify-center gap-2 text-[#2AB3A6]">
                  <Trophy className="h-5 w-5" />
                  <span className="font-bold">Vous avez gagné !</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-[#B00020]">
                  <Skull className="h-5 w-5" />
                  <span className="font-bold">Vous avez perdu</span>
                </div>
              )}
            </div>
            
            {/* PVic Breakdown */}
            {myBreakdown && myBreakdown.breakdown.length > 0 && (
              <div className="mt-4 p-4 rounded-lg bg-[#1A2235] border border-[#2D3748]">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Star className="h-5 w-5 text-[#D4AF37]" />
                  <span className="font-bold text-[#D4AF37]">+{myBreakdown.pvic_earned} PVic gagnés</span>
                </div>
                <div className="space-y-1 text-sm text-left">
                  {myBreakdown.breakdown.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[#9CA3AF]">
                      <CheckCircle2 className="h-3 w-3 text-[#2AB3A6] flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Victory Conditions for role */}
            {roleInfo && roleInfo.victoryConditions && (
              <div className="mt-4 p-4 rounded-lg bg-[#0B0E14] border border-[#2D3748]">
                <p className="text-xs text-[#6B7280] mb-2 uppercase tracking-wide">Conditions de victoire ({roleInfo.short})</p>
                <div className="space-y-1 text-sm text-left">
                  {roleInfo.victoryConditions.map((vc, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 text-[#9CA3AF]">
                      <span className="flex items-center gap-2">
                        <Target className="h-3 w-3 text-[#6B7280] flex-shrink-0" />
                        {vc.condition}
                      </span>
                      <Badge variant="outline" className="text-[#D4AF37] border-[#D4AF37]/30">
                        {vc.pvic > 0 ? `${vc.pvic} PVic` : 'Variable'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4 mt-4">
              <Badge className="bg-[#D4AF37]/20 text-[#D4AF37]">💰 {player.jetons || 0} jetons</Badge>
              <Badge className="bg-[#2AB3A6]/20 text-[#2AB3A6]">⭐ {player.pvic || 0} PVic</Badge>
            </div>
          </div>
        </div>

        {/* All Players Reveal */}
        <div className={theme.card}>
          <div className="p-4 border-b border-[#2D3748]">
            <h2 className="font-semibold">Révélation des rôles</h2>
          </div>
          <div className="divide-y divide-[#2D3748]">
            {sortedPlayers.map(p => {
              const pRoleInfo = p.role_code ? INFECTION_ROLE_LABELS[p.role_code] : null;
              const pWon = (winner === 'SY' && p.team_code === 'SY') || 
                           (winner === 'NON_PV' && (p.team_code === 'CITOYEN' || p.team_code === 'NEUTRE')) || 
                           (winner === 'PV' && p.team_code === 'PV');
              const pBreakdown = pvicBreakdowns.find(b => b.player_num === p.player_number);
              
              return (
                <div key={p.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[#D4AF37] font-mono">#{p.player_number}</span>
                      <span className={p.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                        {p.display_name}
                      </span>
                      {pRoleInfo && (
                        <Badge 
                          variant="outline"
                          style={{ borderColor: pRoleInfo.color, color: pRoleInfo.color }}
                        >
                          {pRoleInfo.short}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {pBreakdown && pBreakdown.pvic_earned > 0 && (
                        <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] text-xs">
                          +{pBreakdown.pvic_earned}
                        </Badge>
                      )}
                      {p.is_alive === false && <Skull className="h-4 w-4 text-[#B00020]" />}
                      {pWon && <Trophy className="h-4 w-4 text-[#D4AF37]" />}
                    </div>
                  </div>
                  {pBreakdown && pBreakdown.breakdown.length > 0 && (
                    <div className="mt-2 pl-8 text-xs text-[#6B7280]">
                      {pBreakdown.breakdown.join(' • ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
