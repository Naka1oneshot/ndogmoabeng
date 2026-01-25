import { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, Crown, X, Skull, FlaskConical, Syringe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { INFECTION_COLORS, INFECTION_ROLE_LABELS } from '../InfectionTheme';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';
import confetti from 'canvas-confetti';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  pvic: number | null;
  role_code: string | null;
  team_code: string | null;
  is_alive: boolean | null;
  mate_num: number | null;
  avatar_url?: string | null;
}

interface RankingEntry {
  name: string;
  totalPvic: number;
  players: Player[];
  key: string; // unique key for rendering
}

interface InfectionVictoryPodiumProps {
  players: Player[];
  winner: 'SY' | 'PV' | 'CV' | null;
  gameMode: string;
  gameId: string;
  onClose: () => void;
}

// Component for team name with tooltip/popover
function TeamNameWithTooltip({ name, className }: { name: string; className?: string }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const content = (
    <span className={`${className || ''}`}>{name}</span>
  );

  if (isMobile) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="cursor-pointer">{content}</div>
        </PopoverTrigger>
        <PopoverContent className="bg-[#1E293B] border-[#2AB3A6]/30 text-white p-3 max-w-[280px]">
          <div className="text-sm font-medium break-words">{name}</div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{content}</div>
        </TooltipTrigger>
        <TooltipContent className="bg-[#1E293B] border-[#2AB3A6]/30 text-white max-w-[350px]">
          <p className="break-words">{name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Stats Panel Component
function StatsPanel({ 
  syPlayers,
  pvPlayers,
  cvPlayers,
  winner,
  showStats,
  className = ""
}: { 
  syPlayers: Player[];
  pvPlayers: Player[];
  cvPlayers: Player[];
  winner: 'SY' | 'PV' | 'CV' | null;
  showStats: boolean;
  className?: string;
}) {
  const syAlive = syPlayers.filter(p => p.is_alive !== false);
  const pvAlive = pvPlayers.filter(p => p.is_alive !== false);
  const cvAlive = cvPlayers.filter(p => p.is_alive !== false);
  
  return (
    <div className={`space-y-4 transition-all duration-1000 ${showStats ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'} ${className}`}>
      {/* CV Stats */}
      <div className={`bg-[#1E293B] border rounded-xl p-4 ${winner === 'CV' ? 'border-[#60A5FA]' : 'border-[#60A5FA]/30'}`}>
        <h3 className="text-[#60A5FA] font-bold text-lg mb-3 flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Citoyens {winner === 'CV' && '🏆'}
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9CA3AF]">Membres</span>
            <span className="text-white font-medium">{cvPlayers.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9CA3AF]">Survivants</span>
            <span className="text-[#60A5FA] font-medium">{cvAlive.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9CA3AF]">PVic total</span>
            <span className="text-white font-bold">{cvPlayers.reduce((s, p) => s + (p.pvic || 0), 0)}</span>
          </div>
        </div>
      </div>

      {/* SY Stats */}
      <div className={`bg-[#1E293B] border rounded-xl p-4 ${winner === 'SY' ? 'border-[#2AB3A6]' : 'border-[#2AB3A6]/30'}`}>
        <h3 className="text-[#2AB3A6] font-bold text-lg mb-3 flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Synthétistes {winner === 'SY' && '🏆'}
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9CA3AF]">Membres</span>
            <span className="text-white font-medium">{syPlayers.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9CA3AF]">Survivants</span>
            <span className="text-[#2AB3A6] font-medium">{syAlive.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9CA3AF]">PVic total</span>
            <span className="text-white font-bold">{syPlayers.reduce((s, p) => s + (p.pvic || 0), 0)}</span>
          </div>
        </div>
      </div>
      
      {/* PV Stats */}
      <div className={`bg-[#1E293B] border rounded-xl p-4 ${winner === 'PV' ? 'border-[#B00020]' : 'border-[#B00020]/30'}`}>
        <h3 className="text-[#B00020] font-bold text-lg mb-3 flex items-center gap-2">
          <Syringe className="h-5 w-5" />
          Porte-Venin {winner === 'PV' && '🏆'}
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9CA3AF]">Membres</span>
            <span className="text-white font-medium">{pvPlayers.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9CA3AF]">Survivants</span>
            <span className="text-[#B00020] font-medium">{pvAlive.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9CA3AF]">PVic total</span>
            <span className="text-white font-bold">{pvPlayers.reduce((s, p) => s + (p.pvic || 0), 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InfectionVictoryPodium({
  players,
  winner,
  gameMode,
  gameId,
  onClose,
}: InfectionVictoryPodiumProps) {
  const isMobile = useIsMobile();
  const [showPodium, setShowPodium] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loadingScores, setLoadingScores] = useState(true);
  
  // Determine if this is a team game (any player has a mate_num)
  const isTeamGame = players.some(p => p.mate_num !== null);
  
  // Debug log
  useEffect(() => {
    console.log('[InfectionVictoryPodium] Received players:', players.length, 'isTeamGame:', isTeamGame, 'gameMode:', gameMode);
    console.log('[InfectionVictoryPodium] Players data:', players.map(p => ({ name: p.display_name, pvic: p.pvic, role: p.role_code, team: p.team_code })));
  }, [players, isTeamGame, gameMode]);
  
  // Fetch adventure cumulative scores if in adventure mode
  useEffect(() => {
    const buildRanking = async () => {
      // Filter out host and ensure players have player_number
      const validPlayers = players.filter(p => p.player_number !== null);
      console.log('[InfectionVictoryPodium] Valid players for ranking:', validPlayers.length);
      
      if (validPlayers.length === 0) {
        console.log('[InfectionVictoryPodium] No valid players, setting empty ranking');
        setRanking([]);
        setLoadingScores(false);
        return;
      }
      
      if (gameMode === 'ADVENTURE' && isTeamGame) {
        // Fetch cumulative scores from adventure_scores
        const playerIds = validPlayers.map(p => p.id);
        const { data: adventureScores, error } = await supabase
          .from('adventure_scores')
          .select('game_player_id, total_score_value')
          .in('game_player_id', playerIds);
        
        if (error) console.error('[InfectionVictoryPodium] Adventure scores error:', error);
        
        const scoreMap = new Map<string, number>();
        adventureScores?.forEach(s => {
          scoreMap.set(s.game_player_id, s.total_score_value || 0);
        });
        
        // Build team ranking with cumulative scores
        const teamMap = new Map<number, Player[]>();
        validPlayers.forEach(p => {
          if (p.player_number === null || p.mate_num === null) return;
          const teamKey = Math.min(p.player_number, p.mate_num);
          if (!teamMap.has(teamKey)) {
            teamMap.set(teamKey, []);
          }
          teamMap.get(teamKey)!.push(p);
        });
        
        const teams: RankingEntry[] = [];
        teamMap.forEach((teamPlayers, mateNum) => {
          const name = teamPlayers.map(p => p.display_name).join(' & ');
          // Use cumulative adventure score + current session pvic
          const totalPvic = teamPlayers.reduce((sum, p) => {
            const cumulativeScore = scoreMap.get(p.id) || 0;
            return sum + cumulativeScore + (p.pvic || 0);
          }, 0);
          teams.push({ name, totalPvic, players: teamPlayers, key: `team-${mateNum}` });
        });
        
        setRanking(teams.sort((a, b) => b.totalPvic - a.totalPvic));
      } else if (isTeamGame) {
        // Single game with teams
        const teamMap = new Map<number, Player[]>();
        validPlayers.forEach(p => {
          if (p.player_number === null || p.mate_num === null) return;
          const teamKey = Math.min(p.player_number, p.mate_num);
          if (!teamMap.has(teamKey)) {
            teamMap.set(teamKey, []);
          }
          teamMap.get(teamKey)!.push(p);
        });
        
        const teams: RankingEntry[] = [];
        teamMap.forEach((teamPlayers, mateNum) => {
          const name = teamPlayers.map(p => p.display_name).join(' & ');
          const totalPvic = teamPlayers.reduce((sum, p) => sum + (p.pvic || 0), 0);
          teams.push({ name, totalPvic, players: teamPlayers, key: `team-${mateNum}` });
        });
        
        setRanking(teams.sort((a, b) => b.totalPvic - a.totalPvic));
      } else {
        // Individual ranking (no teams) - most common for bots
        console.log('[InfectionVictoryPodium] Building individual ranking from', validPlayers.length, 'players');
        const individuals: RankingEntry[] = validPlayers
          .map(p => ({
            name: p.display_name,
            totalPvic: p.pvic || 0,
            players: [p],
            key: `player-${p.player_number}`,
          }))
          .sort((a, b) => b.totalPvic - a.totalPvic);
        
        console.log('[InfectionVictoryPodium] Individual ranking:', individuals.map(i => ({ name: i.name, pvic: i.totalPvic })));
        setRanking(individuals);
      }
      setLoadingScores(false);
    };
    
    if (players.length > 0) {
      buildRanking();
    } else {
      setLoadingScores(false);
    }
  }, [players, gameMode, gameId, isTeamGame]);
  
  // Separate players by team
  const syPlayers = players.filter(p => p.team_code === 'SY');
  const pvPlayers = players.filter(p => p.team_code === 'PV');
  const cvPlayers = players.filter(p => p.team_code === 'CITOYEN' || p.team_code === 'NEUTRE');
  
  // Confetti burst function
  const fireConfetti = useCallback(() => {
    const duration = 5000;
    const animationEnd = Date.now() + duration;
    const colors = winner === 'SY' 
      ? ['#2AB3A6', '#34D399', '#10B981', '#6EE7B7']
      : ['#B00020', '#EF4444', '#DC2626', '#F87171'];

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        particleCount,
        spread: 360,
        startVelocity: 30,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors,
        zIndex: 100,
      });

      confetti({
        particleCount,
        spread: 360,
        startVelocity: 30,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors,
        zIndex: 100,
      });
    }, 250);

    // Initial big burst
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { x: 0.5, y: 0.5 },
      colors,
      zIndex: 100,
    });
  }, [winner]);
  
  useEffect(() => {
    setTimeout(() => setShowPodium(true), 500);
    setTimeout(() => {
      setShowRanking(true);
      fireConfetti();
    }, 1500);
    setTimeout(() => setShowStats(true), 2000);
  }, [fireConfetti]);
  
  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  const top3 = ranking.slice(0, 3);
  
  const getMedalIcon = (position: number) => {
    switch (position) {
      case 0:
        return <Crown className="h-8 w-8 text-yellow-400" />;
      case 1:
        return <Medal className="h-7 w-7 text-gray-300" />;
      case 2:
        return <Medal className="h-6 w-6 text-amber-600" />;
      default:
        return null;
    }
  };
  
  const getPodiumHeight = (position: number) => {
    switch (position) {
      case 0:
        return 'h-40';
      case 1:
        return 'h-28';
      case 2:
        return 'h-20';
      default:
        return 'h-16';
    }
  };
  
  const getWinnerInfo = () => {
    if (winner === 'SY') {
      return {
        title: 'Victoire des Synthétistes !',
        subtitle: "L'antidote a été trouvé ! La population est sauvée.",
        icon: FlaskConical,
        color: '#2AB3A6',
      };
    } else if (winner === 'CV') {
      return {
        title: 'Victoire des Citoyens du Village !',
        subtitle: 'Tous les Porte-Venin ont été éliminés. Le village est sauf.',
        icon: Trophy,
        color: '#60A5FA',
      };
    } else if (winner === 'PV') {
      return {
        title: 'Victoire des Porte-Venin !',
        subtitle: "Le virus s'est propagé. L'humanité est condamnée.",
        icon: Syringe,
        color: '#B00020',
      };
    }
    return {
      title: 'Partie Terminée',
      subtitle: 'Résultats de la partie',
      icon: Trophy,
      color: '#D4AF37',
    };
  };
  
  const winnerInfo = getWinnerInfo();
  const WinnerIcon = winnerInfo.icon;
  
  // Show loading state while fetching adventure scores
  if (loadingScores) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: INFECTION_COLORS.bgPrimary }}>
        <div className="text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 animate-pulse" style={{ color: INFECTION_COLORS.accent }} />
          <p style={{ color: INFECTION_COLORS.textSecondary }}>Calcul des scores...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 z-50 overflow-auto" style={{ backgroundColor: INFECTION_COLORS.bgPrimary }}>
      {/* Header */}
      <div className="sticky top-0 backdrop-blur border-b z-40" style={{ backgroundColor: `${INFECTION_COLORS.bgSecondary}E6`, borderColor: `${winnerInfo.color}50` }}>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img src={logoNdogmoabeng} alt="Logo" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold" style={{ color: winnerInfo.color }}>🦠 Résultats Finaux</h1>
              <p className="text-sm" style={{ color: INFECTION_COLORS.textSecondary }}>Infection - Ndogmoabeng</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} style={{ color: INFECTION_COLORS.textSecondary }}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Desktop Stats - Fixed on right edge */}
      <div className="hidden lg:block fixed right-4 top-24 w-72 z-30">
        <StatsPanel syPlayers={syPlayers} pvPlayers={pvPlayers} cvPlayers={cvPlayers} winner={winner} showStats={showStats} />
      </div>
      
      <div className="p-4 lg:pr-80 max-w-5xl mx-auto">
        {/* Winner Banner */}
        <div className="text-center mb-8">
          <WinnerIcon className="h-16 w-16 mx-auto mb-4" style={{ color: winnerInfo.color }} />
          <h2 className="text-3xl font-bold mb-2" style={{ color: winnerInfo.color }}>{winnerInfo.title}</h2>
          <p style={{ color: INFECTION_COLORS.textSecondary }}>{winnerInfo.subtitle}</p>
        </div>
        
        {/* Podium */}
        <div className={`flex items-end justify-center gap-4 mb-12 transition-all duration-1000 ${showPodium ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {/* 2nd Place */}
          {top3[1] && (
            <div className="text-center flex flex-col items-center">
              <div className="mb-2">{getMedalIcon(1)}</div>
              <div className="flex flex-wrap justify-center gap-1 mb-2">
                {top3[1].players.slice(0, 3).map(p => (
                  p.avatar_url ? (
                    <img key={p.id} src={p.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover border-2 border-gray-300" />
                  ) : (
                    <div key={p.id} className="h-10 w-10 rounded-full bg-gray-300/30 flex items-center justify-center border-2 border-gray-300 text-sm font-bold text-gray-300">
                      {p.player_number}
                    </div>
                  )
                ))}
              </div>
              <div className="text-lg font-bold text-white mb-1 text-center px-2 max-w-32">
                <TeamNameWithTooltip name={top3[1].name} className="break-words line-clamp-2" />
              </div>
              <div className="text-xl font-bold text-gray-300 mb-2">{top3[1].totalPvic} PVic</div>
              <div className={`${getPodiumHeight(1)} w-24 bg-gradient-to-t from-gray-600 to-gray-400 rounded-t-lg flex items-end justify-center pb-2`}>
                <span className="text-2xl font-bold text-white">2</span>
              </div>
            </div>
          )}
          
          {/* 1st Place */}
          {top3[0] && (
            <div className="text-center flex flex-col items-center">
              <div className="mb-2">{getMedalIcon(0)}</div>
              <div className="flex flex-wrap justify-center gap-1 mb-2">
                {top3[0].players.slice(0, 3).map(p => (
                  p.avatar_url ? (
                    <img key={p.id} src={p.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover border-2 border-yellow-400" />
                  ) : (
                    <div key={p.id} className="h-12 w-12 rounded-full bg-yellow-400/30 flex items-center justify-center border-2 border-yellow-400 text-lg font-bold text-yellow-400">
                      {p.player_number}
                    </div>
                  )
                ))}
              </div>
              <div className="text-xl font-bold text-white mb-1 text-center px-2 max-w-40">
                <TeamNameWithTooltip name={top3[0].name} className="break-words line-clamp-2" />
              </div>
              <div className="text-2xl font-bold text-yellow-400 mb-2">{top3[0].totalPvic} PVic</div>
              <div className={`${getPodiumHeight(0)} w-28 bg-gradient-to-t from-yellow-600 to-yellow-400 rounded-t-lg flex items-end justify-center pb-2`}>
                <span className="text-3xl font-bold text-white">1</span>
              </div>
            </div>
          )}
          
          {/* 3rd Place */}
          {top3[2] && (
            <div className="text-center flex flex-col items-center">
              <div className="mb-2">{getMedalIcon(2)}</div>
              <div className="flex flex-wrap justify-center gap-1 mb-2">
                {top3[2].players.slice(0, 3).map(p => (
                  p.avatar_url ? (
                    <img key={p.id} src={p.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover border-2 border-amber-600" />
                  ) : (
                    <div key={p.id} className="h-9 w-9 rounded-full bg-amber-600/30 flex items-center justify-center border-2 border-amber-600 text-sm font-bold text-amber-600">
                      {p.player_number}
                    </div>
                  )
                ))}
              </div>
              <div className="text-base font-bold text-white mb-1 text-center px-2 max-w-28">
                <TeamNameWithTooltip name={top3[2].name} className="break-words line-clamp-2" />
              </div>
              <div className="text-lg font-bold text-amber-600 mb-2">{top3[2].totalPvic} PVic</div>
              <div className={`${getPodiumHeight(2)} w-20 bg-gradient-to-t from-amber-800 to-amber-600 rounded-t-lg flex items-end justify-center pb-2`}>
                <span className="text-xl font-bold text-white">3</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Full Ranking - Now ABOVE role reveal */}
        <div className={`bg-[#1E293B] border border-[#475569] rounded-xl p-4 mb-6 transition-all duration-1000 ${showRanking ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: INFECTION_COLORS.accent }}>
            <Trophy className="h-5 w-5" />
            {isTeamGame ? 'Classement par Équipe' : 'Classement Individuel'}
            {gameMode === 'ADVENTURE' && <Badge variant="outline" className="ml-2 text-xs border-[#D4AF37] text-[#D4AF37]">Cumul Aventure</Badge>}
          </h3>
          {ranking.length > 0 ? (
            <div className="space-y-2">
              {ranking.map((entry, idx) => (
                <div
                  key={entry.key}
                  className={`flex items-center justify-between p-3 rounded-lg ${idx < 3 ? 'bg-[#D4AF37]/10 border border-[#D4AF37]/30' : 'bg-[#0F172A]'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 text-center font-bold ${idx === 0 ? 'text-yellow-400 text-xl' : idx === 1 ? 'text-gray-300 text-lg' : idx === 2 ? 'text-amber-600 text-lg' : 'text-[#9CA3AF]'}`}>
                      #{idx + 1}
                    </span>
                    <div className="flex gap-1">
                      {entry.players.slice(0, 3).map(p => (
                        p.avatar_url ? (
                          <img key={p.id} src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover border border-[#D4AF37]/30" />
                        ) : (
                          <div key={p.id} className="h-8 w-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-xs font-bold text-[#D4AF37]">
                            {p.player_number}
                          </div>
                        )
                      ))}
                    </div>
                    <span className="font-medium text-white truncate max-w-[200px]">
                      <TeamNameWithTooltip name={entry.name} />
                    </span>
                  </div>
                  <span className={`font-bold whitespace-nowrap ${idx < 3 ? 'text-[#D4AF37] text-lg' : 'text-[#9CA3AF]'}`}>
                    {entry.totalPvic} PVic
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#9CA3AF] text-center py-4">Aucune donnée de classement disponible</p>
          )}
        </div>

        {/* Role Reveal Section - Now BELOW ranking */}
        <div className={`bg-[#1E293B] border border-[#475569] rounded-xl p-4 mb-6 transition-all duration-1000 ${showRanking ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: INFECTION_COLORS.accent }}>
            <Skull className="h-5 w-5" />
            Révélation des Rôles
          </h3>
          {players.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {players.filter(p => p.player_number !== null).sort((a, b) => (a.player_number || 0) - (b.player_number || 0)).map(p => {
                const roleInfo = p.role_code ? INFECTION_ROLE_LABELS[p.role_code] : null;
                const isWinner = 
                  (winner === 'SY' && p.team_code === 'SY') || 
                  (winner === 'PV' && p.team_code === 'PV') ||
                  (winner === 'CV' && (p.team_code === 'CITOYEN' || p.team_code === 'NEUTRE'));
                
                return (
                  <div 
                    key={p.id} 
                    className={`p-2 rounded-lg border ${isWinner ? 'border-[#D4AF37]/50 bg-[#D4AF37]/10' : 'border-[#475569] bg-[#0F172A]'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[#D4AF37] font-mono text-sm">#{p.player_number}</span>
                      {p.is_alive === false && <Skull className="h-3 w-3 text-[#B00020]" />}
                      {isWinner && <Trophy className="h-3 w-3 text-[#D4AF37]" />}
                    </div>
                    <div className={`text-sm font-medium truncate ${p.is_alive === false ? 'line-through text-[#6B7280]' : 'text-white'}`}>
                      {p.display_name}
                    </div>
                    {roleInfo && (
                      <Badge 
                        variant="outline"
                        className="mt-1 text-xs"
                        style={{ borderColor: roleInfo.color, color: roleInfo.color }}
                      >
                        {roleInfo.short}
                      </Badge>
                    )}
                    <div className="mt-1 text-xs text-[#9CA3AF]">
                      {p.pvic || 0} PVic
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[#9CA3AF] text-center py-4">Aucun joueur disponible</p>
          )}
        </div>
        
        {/* Mobile Stats - shown below ranking */}
        <div className="lg:hidden mt-6">
          <StatsPanel syPlayers={syPlayers} pvPlayers={pvPlayers} cvPlayers={cvPlayers} winner={winner} showStats={showStats} />
        </div>
      </div>
    </div>
  );
}
