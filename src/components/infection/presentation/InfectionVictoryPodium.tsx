import { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, Crown, X, Skull, FlaskConical, Syringe, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
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

interface TeamRanking {
  name: string;
  totalPvic: number;
  players: Player[];
  mate_num: number;
}

interface InfectionVictoryPodiumProps {
  players: Player[];
  winner: 'SY' | 'PV' | null;
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
  winner,
  showStats,
  className = ""
}: { 
  syPlayers: Player[];
  pvPlayers: Player[];
  winner: 'SY' | 'PV' | null;
  showStats: boolean;
  className?: string;
}) {
  const syAlive = syPlayers.filter(p => p.is_alive !== false);
  const pvAlive = pvPlayers.filter(p => p.is_alive !== false);
  
  return (
    <div className={`space-y-4 transition-all duration-1000 ${showStats ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'} ${className}`}>
      {/* SY Stats */}
      <div className={`bg-[#1E293B] border rounded-xl p-4 ${winner === 'SY' ? 'border-[#2AB3A6]' : 'border-[#2AB3A6]/30'}`}>
        <h3 className="text-[#2AB3A6] font-bold text-lg mb-3 flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Syndicat {winner === 'SY' && '🏆'}
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
          Porteurs {winner === 'PV' && '🏆'}
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
  onClose,
}: InfectionVictoryPodiumProps) {
  const isMobile = useIsMobile();
  const [showPodium, setShowPodium] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  // Build team ranking based on mate_num
  const teamRanking: TeamRanking[] = (() => {
    const teamMap = new Map<number, Player[]>();
    
    players.forEach(p => {
      if (p.mate_num === null || p.player_number === null) return;
      
      const teamKey = Math.min(p.player_number, p.mate_num);
      if (!teamMap.has(teamKey)) {
        teamMap.set(teamKey, []);
      }
      teamMap.get(teamKey)!.push(p);
    });
    
    const teams: TeamRanking[] = [];
    teamMap.forEach((teamPlayers, mateNum) => {
      const name = teamPlayers.map(p => p.display_name).join(' & ');
      const totalPvic = teamPlayers.reduce((sum, p) => sum + (p.pvic || 0), 0);
      teams.push({ name, totalPvic, players: teamPlayers, mate_num: mateNum });
    });
    
    return teams.sort((a, b) => b.totalPvic - a.totalPvic);
  })();
  
  // Separate players by team
  const syPlayers = players.filter(p => p.team_code === 'SY');
  const pvPlayers = players.filter(p => p.team_code === 'PV');
  
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
  
  const top3 = teamRanking.slice(0, 3);
  
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
        title: 'Victoire du Syndicat !',
        subtitle: 'Le remède a été trouvé. La population est sauvée.',
        icon: FlaskConical,
        color: '#2AB3A6',
      };
    } else if (winner === 'PV') {
      return {
        title: 'Victoire des Porteurs !',
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
        <StatsPanel syPlayers={syPlayers} pvPlayers={pvPlayers} winner={winner} showStats={showStats} />
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
        
        {/* Role Reveal Section */}
        <div className={`bg-[#1E293B] border border-[#475569] rounded-xl p-4 mb-6 transition-all duration-1000 ${showRanking ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: INFECTION_COLORS.accent }}>
            <Skull className="h-5 w-5" />
            Révélation des Rôles
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {players.sort((a, b) => (a.player_number || 0) - (b.player_number || 0)).map(p => {
              const roleInfo = p.role_code ? INFECTION_ROLE_LABELS[p.role_code] : null;
              const isWinner = (winner === 'SY' && p.team_code === 'SY') || (winner === 'PV' && p.team_code === 'PV');
              
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
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Full Team Ranking */}
        <div className={`bg-[#1E293B] border border-[#475569] rounded-xl p-4 transition-all duration-1000 ${showRanking ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: INFECTION_COLORS.accent }}>
            <Trophy className="h-5 w-5" />
            Classement par Équipe
          </h3>
          <div className="space-y-2">
            {teamRanking.map((team, idx) => (
              <div
                key={team.mate_num}
                className={`flex items-center justify-between p-3 rounded-lg ${idx < 3 ? 'bg-[#D4AF37]/10 border border-[#D4AF37]/30' : 'bg-[#0F172A]'}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 text-center font-bold ${idx === 0 ? 'text-yellow-400 text-xl' : idx === 1 ? 'text-gray-300 text-lg' : idx === 2 ? 'text-amber-600 text-lg' : 'text-[#9CA3AF]'}`}>
                    #{idx + 1}
                  </span>
                  <div className="flex gap-1">
                    {team.players.slice(0, 3).map(p => (
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
                    <TeamNameWithTooltip name={team.name} />
                  </span>
                </div>
                <span className={`font-bold whitespace-nowrap ${idx < 3 ? 'text-[#D4AF37] text-lg' : 'text-[#9CA3AF]'}`}>
                  {team.totalPvic} PVic
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Mobile Stats - shown below ranking */}
        <div className="lg:hidden mt-6">
          <StatsPanel syPlayers={syPlayers} pvPlayers={pvPlayers} winner={winner} showStats={showStats} />
        </div>
      </div>
    </div>
  );
}
