import { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, Crown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';
import confetti from 'canvas-confetti';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  pvic: number | null;
  avatar_url?: string | null;
  clan?: string | null;
}

interface TeamRanking {
  name: string;
  totalPvic: number;
  players: Player[];
}

interface SheriffVictoryPodiumProps {
  players: Player[];
  teamRanking: TeamRanking[];
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
        <PopoverContent className="bg-[#2A2215] border-[#D4AF37]/30 text-white p-3 max-w-[280px]">
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
        <TooltipContent className="bg-[#2A2215] border-[#D4AF37]/30 text-white max-w-[350px]">
          <p className="break-words">{name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SheriffVictoryPodium({
  players,
  teamRanking,
  onClose,
}: SheriffVictoryPodiumProps) {
  const [showPodium, setShowPodium] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  
  // Confetti burst function
  const fireConfetti = useCallback(() => {
    const duration = 5000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Left side burst
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#D4AF37', '#FFD700', '#FFA500', '#FF6347', '#32CD32'],
      });

      // Right side burst
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#D4AF37', '#FFD700', '#FFA500', '#FF6347', '#32CD32'],
      });
    }, 250);

    // Initial big burst
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#D4AF37', '#FFD700', '#FFA500'],
      zIndex: 100,
    });
  }, []);
  
  useEffect(() => {
    // Animate podium entry
    setTimeout(() => setShowPodium(true), 500);
    setTimeout(() => {
      setShowRanking(true);
      fireConfetti();
    }, 1500);
  }, [fireConfetti]);
  
  const top3 = teamRanking.slice(0, 3);
  const rest = teamRanking.slice(3);
  
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
  
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-[#1A1510] to-[#0A0806] z-50 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 bg-[#1A1510]/95 backdrop-blur border-b border-[#D4AF37]/30 z-40">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img src={logoNdogmoabeng} alt="Logo" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-[#D4AF37]">🤠 Résultats Finaux</h1>
              <p className="text-sm text-[#9CA3AF]">Le Shérif de Ndogmoabeng</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-[#D4AF37] hover:bg-[#D4AF37]/10">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      <div className="p-4 max-w-4xl mx-auto">
        {/* Confetti / Celebration Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎉🏆🎉</div>
          <h2 className="text-3xl font-bold text-[#D4AF37]">Félicitations aux Vainqueurs!</h2>
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
              <div className="text-lg font-bold text-white mb-1 text-center px-2">
                <TeamNameWithTooltip name={top3[1].name} className="break-words" />
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
              <div className="text-xl font-bold text-white mb-1 text-center px-2">
                <TeamNameWithTooltip name={top3[0].name} className="break-words" />
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
              <div className="text-base font-bold text-white mb-1 text-center px-2">
                <TeamNameWithTooltip name={top3[2].name} className="break-words" />
              </div>
              <div className="text-lg font-bold text-amber-600 mb-2">{top3[2].totalPvic} PVic</div>
              <div className={`${getPodiumHeight(2)} w-20 bg-gradient-to-t from-amber-800 to-amber-600 rounded-t-lg flex items-end justify-center pb-2`}>
                <span className="text-xl font-bold text-white">3</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Full Ranking */}
        <div className={`bg-[#2A2215] border border-[#D4AF37]/20 rounded-xl p-4 transition-all duration-1000 ${showRanking ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h3 className="text-[#D4AF37] font-bold text-lg mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Classement Complet
          </h3>
          <div className="space-y-2">
            {teamRanking.map((team, idx) => (
              <div
                key={team.name}
                className={`flex items-center justify-between p-3 rounded-lg ${idx < 3 ? 'bg-[#D4AF37]/10 border border-[#D4AF37]/30' : 'bg-[#1A1510]'}`}
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
                    {team.players.length > 3 && (
                      <div className="h-8 w-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-xs text-[#D4AF37]">
                        +{team.players.length - 3}
                      </div>
                    )}
                  </div>
                  <TeamNameWithTooltip name={team.name} className="font-medium break-words" />
                </div>
                <span className={`font-bold whitespace-nowrap ${idx < 3 ? 'text-[#D4AF37] text-lg' : 'text-[#9CA3AF]'}`}>
                  {team.totalPvic} PVic
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
