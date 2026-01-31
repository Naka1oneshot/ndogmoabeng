import { useEffect, useMemo, useState } from 'react';
import { Trophy, Ship, Waves, CheckCircle, XCircle, X, Coins, TrendingDown, Award, BarChart3 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import confetti from 'canvas-confetti';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';
import { WinnerPrizeBadge } from '@/components/shared/WinnerPrizeBadge';

interface RankedPlayer {
  id: string;
  display_name: string;
  player_number: number | null;
  jetons: number;
  clan: string | null;
  avatar_url: string | null;
  validated_levels: number;
  score_value: number;
  penalty_applied: boolean;
  current_status: string;
}

interface LevelHistory {
  manche: number;
  niveau: number;
  outcome: 'SUCCESS' | 'FAIL';
}

interface HistoricalDecision {
  player_id: string;
  player_num: number;
  decision: string;
  mise_effective: number | null;
  manche: number;
  niveau: number;
}

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
}

interface RivieresVictoryPodiumProps {
  ranking: RankedPlayer[];
  levelHistory: LevelHistory[];
  allDecisions: HistoricalDecision[];
  players: Player[];
  onClose: () => void;
  /** Adventure pot amount to display for the winner (only shown if provided and > 0) */
  adventurePotAmount?: number | null;
}

export function RivieresVictoryPodium({ ranking, levelHistory, allDecisions, players, onClose, adventurePotAmount }: RivieresVictoryPodiumProps) {
  // Animation states for reveal
  const [revealedRanks, setRevealedRanks] = useState<number[]>([]);
  const [showStats, setShowStats] = useState(false);

  // Trigger confetti on mount
  useEffect(() => {
    const duration = 5000;
    const end = Date.now() + duration;

    const colors = ['#D4AF37', '#4ADE80', '#60A5FA'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();

    // Play victory sound
    const audio = new Audio('/sounds/combat-kill.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  }, []);

  // Progressive reveal animation - from last to first, slowing down for podium
  useEffect(() => {
    const totalPlayers = ranking.length;
    if (totalPlayers === 0) return;

    let currentIndex = totalPlayers - 1; // Start from last place
    const timers: NodeJS.Timeout[] = [];

    const revealNext = () => {
      if (currentIndex < 0) {
        // After all ranks revealed, show stats panel
        const statsTimer = setTimeout(() => setShowStats(true), 800);
        timers.push(statsTimer);
        return;
      }

      setRevealedRanks(prev => [...prev, currentIndex]);
      
      // Calculate delay: fast for lower ranks, slower for top positions
      let delay: number;
      if (currentIndex > 5) {
        delay = 100; // Very fast for ranks 6+
      } else if (currentIndex > 2) {
        delay = 200; // Medium for ranks 4-6
      } else if (currentIndex === 2) {
        delay = 500; // Slow for 3rd place
      } else if (currentIndex === 1) {
        delay = 800; // Slower for 2nd place
      } else {
        delay = 1200; // Slowest for 1st place
      }
      
      currentIndex--;
      const timer = setTimeout(revealNext, delay);
      timers.push(timer);
    };

    // Start the reveal after a short initial delay
    const startTimer = setTimeout(revealNext, 500);
    timers.push(startTimer);

    return () => timers.forEach(t => clearTimeout(t));
  }, [ranking.length]);

  // Calculate stats
  const totalLevels = levelHistory.length;
  const successLevels = levelHistory.filter(l => l.outcome === 'SUCCESS').length;
  const failLevels = levelHistory.filter(l => l.outcome === 'FAIL').length;

  // Calculate additional stats
  const totalPlayers = ranking.length;
  const survivorsCount = ranking.filter(p => p.validated_levels >= 9).length;
  const avgScore = totalPlayers > 0 ? Math.round(ranking.reduce((sum, p) => sum + p.score_value, 0) / totalPlayers) : 0;

  // Calculate betting stats
  const bettingStats = useMemo(() => {
    const getPlayerName = (playerNum: number) => {
      const player = players.find(p => p.player_number === playerNum);
      return player?.display_name ?? `Joueur ${playerNum}`;
    };

    // Only consider decisions where player stayed in boat (RESTE)
    const stayDecisions = allDecisions.filter(d => d.decision === 'RESTE' && d.mise_effective !== null);
    
    // Calculate total bets per player (only when staying)
    const playerTotalBets = new Map<number, { total: number; count: number }>();
    stayDecisions.forEach(d => {
      const current = playerTotalBets.get(d.player_num) || { total: 0, count: 0 };
      playerTotalBets.set(d.player_num, { 
        total: current.total + (d.mise_effective || 0), 
        count: current.count + 1 
      });
    });

    // Find most stingy player (lowest average bet when staying)
    let mostStingyPlayer: { name: string; avgBet: number } | null = null;
    playerTotalBets.forEach((data, playerNum) => {
      if (data.count > 0) {
        const avg = data.total / data.count;
        if (!mostStingyPlayer || avg < mostStingyPlayer.avgBet) {
          mostStingyPlayer = { name: getPlayerName(playerNum), avgBet: Math.round(avg) };
        }
      }
    });

    // Find smallest bet on a successful level
    let smallestBetOnSuccess: { playerName: string; amount: number; level: string } | null = null;
    stayDecisions.forEach(d => {
      const level = levelHistory.find(l => l.manche === d.manche && l.niveau === d.niveau);
      if (level?.outcome === 'SUCCESS' && d.mise_effective !== null) {
        if (!smallestBetOnSuccess || d.mise_effective < smallestBetOnSuccess.amount) {
          smallestBetOnSuccess = {
            playerName: getPlayerName(d.player_num),
            amount: d.mise_effective,
            level: `M${d.manche}N${d.niveau}`
          };
        }
      }
    });

    // Find smallest bet overall (when staying in boat)
    let smallestBetOverall: { playerName: string; amount: number; level: string } | null = null;
    stayDecisions.forEach(d => {
      if (d.mise_effective !== null && d.mise_effective > 0) {
        if (!smallestBetOverall || d.mise_effective < smallestBetOverall.amount) {
          smallestBetOverall = {
            playerName: getPlayerName(d.player_num),
            amount: d.mise_effective,
            level: `M${d.manche}N${d.niveau}`
          };
        }
      }
    });

    return { mostStingyPlayer, smallestBetOnSuccess, smallestBetOverall };
  }, [allDecisions, levelHistory, players]);

  const top3 = ranking.slice(0, 3);
  const others = ranking.slice(3);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Check if a rank is revealed (0 = first place, 1 = second, etc.)
  const isRevealed = (rankIndex: number) => revealedRanks.includes(rankIndex);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#0B1020] via-[#1B4D3E]/30 to-[#0B1020] overflow-hidden">
      {/* Animated background waves - hidden on mobile for performance */}
      <div className="absolute bottom-0 left-0 right-0 h-1/4 overflow-hidden opacity-20 hidden md:block">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="absolute animate-wave"
            style={{ left: `${i * 12}%`, bottom: `${(i % 3) * 20}%`, animationDelay: `${i * 0.2}s` }}
          >
            <Waves className="h-24 w-24 text-[#D4AF37]" />
          </div>
        ))}
      </div>

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute top-2 right-2 md:top-4 md:right-4 z-20 text-[#9CA3AF] hover:text-white h-8 w-8"
      >
        <X className="h-5 w-5 md:h-6 md:w-6" />
      </Button>

      {/* Main layout - vertical scroll on mobile */}
      <div className="relative z-10 h-full flex flex-col overflow-y-auto">
        {/* Header - Compact on mobile */}
        <div className="flex items-center justify-center gap-2 md:gap-4 py-3 md:py-6 px-4 flex-shrink-0">
          <img src={logoNdogmoabeng} alt="Logo" className="h-10 w-10 md:h-14 md:w-14" />
          <div className="text-center">
            <h1 className="text-xl md:text-4xl font-bold text-[#D4AF37] flex items-center gap-2 md:gap-3">
              <Trophy className="h-6 w-6 md:h-10 md:w-10 animate-bounce" />
              VICTOIRE
              <Trophy className="h-6 w-6 md:h-10 md:w-10 animate-bounce" />
            </h1>
            <p className="text-[#9CA3AF] text-xs md:text-base mt-0.5 md:mt-1">Classement Final</p>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col lg:flex-row px-2 md:px-6 pb-4 min-h-0">
          {/* Podium and rankings */}
          <div className="flex-1 flex flex-col items-center min-h-0">
            {/* Podium - Top 3 - More compact on mobile */}
            <div className="flex items-end justify-center gap-2 md:gap-8 mb-4 md:mb-6 flex-shrink-0">
              {/* 2nd place */}
              {top3[1] && (
                <div 
                  className={`flex flex-col items-center transition-all duration-700 ${
                    isRevealed(1) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                >
                  <Avatar className="h-12 w-12 md:h-20 md:w-20 border-2 md:border-4 border-gray-300 mb-1 md:mb-2">
                    <AvatarImage src={top3[1].avatar_url || undefined} />
                    <AvatarFallback className="bg-gray-500/20 text-gray-300 text-sm md:text-xl">
                      {top3[1].display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs md:text-lg font-medium text-[#E8E8E8] max-w-20 md:max-w-40 text-center break-words line-clamp-2">
                    {top3[1].display_name}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] md:text-sm text-gray-400">
                    <span>{top3[1].validated_levels}niv</span>
                    <span className="text-[#4ADE80]">{top3[1].jetons}💎</span>
                  </div>
                  <span className="text-sm md:text-2xl font-bold text-gray-300">{top3[1].score_value}pts</span>
                  <div className="h-14 w-14 md:h-24 md:w-24 bg-gray-600 rounded-t-lg flex items-center justify-center mt-1 md:mt-2">
                    <span className="text-2xl md:text-4xl">🥈</span>
                  </div>
                </div>
              )}

              {/* 1st place */}
              {top3[0] && (
                <div 
                  className={`flex flex-col items-center transition-all duration-1000 ${
                    isRevealed(0) ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
                  }`}
                >
                  <div className="relative">
                    <Avatar className="h-16 w-16 md:h-28 md:w-28 border-2 md:border-4 border-[#D4AF37] mb-1 md:mb-2">
                      <AvatarImage src={top3[0].avatar_url || undefined} />
                      <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37] text-lg md:text-2xl">
                        {top3[0].display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -top-3 md:-top-4 left-1/2 -translate-x-1/2">
                      <span className="text-xl md:text-3xl">👑</span>
                    </div>
                  </div>
                  <span className="text-sm md:text-xl font-bold text-[#D4AF37] max-w-24 md:max-w-48 text-center break-words line-clamp-2">
                    {top3[0].display_name}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] md:text-sm text-[#9CA3AF]">
                    <span>{top3[0].validated_levels}niv</span>
                    <span className="text-[#4ADE80] font-medium">{top3[0].jetons}💎</span>
                  </div>
                  <span className="text-lg md:text-3xl font-bold text-[#D4AF37]">{top3[0].score_value}pts</span>
                  {/* Adventure pot prize for winner */}
                  {adventurePotAmount && adventurePotAmount > 0 && (
                    <WinnerPrizeBadge amount={adventurePotAmount} size="sm" className="mt-1" />
                  )}
                  <div className="h-20 w-16 md:h-32 md:w-28 bg-[#D4AF37] rounded-t-lg flex items-center justify-center mt-1 md:mt-2">
                    <span className="text-3xl md:text-5xl">🥇</span>
                  </div>
                </div>
              )}

              {/* 3rd place */}
              {top3[2] && (
                <div 
                  className={`flex flex-col items-center transition-all duration-500 ${
                    isRevealed(2) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                >
                  <Avatar className="h-10 w-10 md:h-16 md:w-16 border-2 md:border-4 border-amber-600 mb-1 md:mb-2">
                    <AvatarImage src={top3[2].avatar_url || undefined} />
                    <AvatarFallback className="bg-amber-600/20 text-amber-500 text-xs md:text-lg">
                      {top3[2].display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] md:text-base font-medium text-[#E8E8E8] max-w-16 md:max-w-36 text-center break-words line-clamp-2">
                    {top3[2].display_name}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] md:text-xs text-[#9CA3AF]">
                    <span>{top3[2].validated_levels}niv</span>
                    <span className="text-[#4ADE80]">{top3[2].jetons}💎</span>
                  </div>
                  <span className="text-sm md:text-xl font-bold text-amber-500">{top3[2].score_value}pts</span>
                  <div className="h-10 w-12 md:h-16 md:w-20 bg-amber-700 rounded-t-lg flex items-center justify-center mt-1 md:mt-2">
                    <span className="text-xl md:text-3xl">🥉</span>
                  </div>
                </div>
              )}
            </div>

            {/* Rest of rankings */}
            {others.length > 0 && (
              <div className="w-full max-w-4xl bg-[#151B2D] border border-[#D4AF37]/20 rounded-lg p-2 md:p-4 flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-3">
                    {others.map((p, idx) => {
                      const rankIndex = idx + 3;
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg bg-[#0B1020]/50 border border-[#D4AF37]/10 hover:border-[#D4AF37]/30 transition-all duration-300 ${
                            isRevealed(rankIndex) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                          }`}
                        >
                          {/* Rank */}
                          <div className="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                            <span className="text-[10px] md:text-sm font-bold text-[#D4AF37]">#{idx + 4}</span>
                          </div>

                          {/* Avatar */}
                          <Avatar className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0">
                            <AvatarImage src={p.avatar_url || undefined} />
                            <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37] text-[10px] md:text-xs">
                              {p.display_name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          {/* Name and stats */}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs md:text-base text-[#E8E8E8] font-medium truncate">{p.display_name}</div>
                            <div className="flex items-center gap-1 md:gap-2 text-[10px] md:text-xs text-[#9CA3AF]">
                              <span className={p.validated_levels >= 9 ? 'text-[#4ADE80]' : 'text-amber-400'}>
                                {p.validated_levels}niv
                              </span>
                              {p.penalty_applied && <span className="text-red-400">⚠️</span>}
                              <span className="text-[#4ADE80]">{p.jetons}💎</span>
                            </div>
                          </div>

                          {/* Score */}
                          <div className="flex-shrink-0 text-right">
                            <div className="text-sm md:text-lg font-bold text-[#D4AF37]">{p.score_value}</div>
                            <div className="text-[10px] md:text-xs text-[#9CA3AF]">pts</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Stats panel - Bottom on mobile, sidebar on desktop */}
          <div 
            className={`lg:w-72 xl:w-80 p-3 md:p-6 bg-[#0B1020]/80 lg:border-l border-t lg:border-t-0 border-[#D4AF37]/20 flex-shrink-0 transition-all duration-700 ${
              showStats ? 'opacity-100 translate-y-0 lg:translate-x-0' : 'opacity-0 translate-y-8 lg:translate-y-0 lg:translate-x-full'
            }`}
          >
            <div className="space-y-3 md:space-y-4">
              {/* Stats header */}
              <div className="flex items-center gap-2 text-[#D4AF37] font-bold text-sm md:text-base">
                <BarChart3 className="h-4 w-4 md:h-5 md:w-5" />
                <span>Statistiques</span>
              </div>

              {/* Game stats - 3 columns on mobile, 2 on desktop */}
              <div className="grid grid-cols-3 lg:grid-cols-2 gap-2 md:gap-3">
                <div className="bg-[#151B2D] border border-[#D4AF37]/20 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-center">
                  <div className="text-[#9CA3AF] text-[10px] md:text-xs">Niveaux</div>
                  <div className="text-sm md:text-lg font-bold text-[#D4AF37]">{totalLevels}/15</div>
                </div>
                <div className="bg-[#151B2D] border border-green-500/30 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-center">
                  <div className="flex items-center justify-center gap-0.5 text-green-400 text-[10px] md:text-xs">
                    <CheckCircle className="h-2.5 w-2.5 md:h-3 md:w-3" /> Réussites
                  </div>
                  <div className="text-sm md:text-lg font-bold text-green-400">{successLevels}</div>
                </div>
                <div className="bg-[#151B2D] border border-red-500/30 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-center">
                  <div className="flex items-center justify-center gap-0.5 text-red-400 text-[10px] md:text-xs">
                    <XCircle className="h-2.5 w-2.5 md:h-3 md:w-3" /> Échecs
                  </div>
                  <div className="text-sm md:text-lg font-bold text-red-400">{failLevels}</div>
                </div>
                <div className="bg-[#151B2D] border border-blue-500/30 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-center">
                  <div className="text-blue-400 text-[10px] md:text-xs">Joueurs</div>
                  <div className="text-sm md:text-lg font-bold text-blue-400">{totalPlayers}</div>
                </div>
                <div className="bg-[#151B2D] border border-[#4ADE80]/30 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-center">
                  <div className="text-[#4ADE80] text-[10px] md:text-xs">Survivants</div>
                  <div className="text-sm md:text-lg font-bold text-[#4ADE80]">{survivorsCount}</div>
                </div>
                <div className="bg-[#151B2D] border border-cyan-500/30 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-center">
                  <div className="text-cyan-400 text-[10px] md:text-xs">Score moy.</div>
                  <div className="text-sm md:text-lg font-bold text-cyan-400">{avgScore}</div>
                </div>
              </div>

              {/* Betting awards - Now visible on mobile */}
              {(bettingStats.mostStingyPlayer || bettingStats.smallestBetOnSuccess || bettingStats.smallestBetOverall) && (
                <div>
                  <div className="border-t border-[#D4AF37]/20 pt-3 md:pt-4">
                    <div className="text-[#9CA3AF] text-[10px] md:text-xs uppercase tracking-wide mb-2 md:mb-3 flex items-center gap-1">
                      <Award className="h-3 w-3 md:h-4 md:w-4 text-[#D4AF37]" />
                      Prix spéciaux
                    </div>
                  </div>
                  {/* Grid layout on mobile, stacked on desktop */}
                  <div className="grid grid-cols-3 md:grid-cols-1 gap-2 md:space-y-3 md:gap-0">
                    {bettingStats.mostStingyPlayer && (
                      <div className="bg-[#151B2D] border border-amber-500/30 rounded-lg px-2 md:px-3 py-1.5 md:py-2">
                        <div className="flex items-center gap-1 text-amber-400 text-[10px] md:text-xs mb-0.5 md:mb-1">
                          <TrendingDown className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          <span className="hidden md:inline">Le plus Radin</span>
                          <span className="md:hidden">Radin</span>
                        </div>
                        <div className="text-[10px] md:text-sm font-bold text-amber-400 break-words truncate">{bettingStats.mostStingyPlayer.name}</div>
                        <div className="text-[8px] md:text-xs text-[#9CA3AF]">{bettingStats.mostStingyPlayer.avgBet}💎/niv</div>
                      </div>
                    )}
                    {bettingStats.smallestBetOnSuccess && (
                      <div className="bg-[#151B2D] border border-emerald-500/30 rounded-lg px-2 md:px-3 py-1.5 md:py-2">
                        <div className="flex items-center gap-1 text-emerald-400 text-[10px] md:text-xs mb-0.5 md:mb-1">
                          <Award className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          <span className="hidden md:inline">Plus petit pari gagnant</span>
                          <span className="md:hidden">Pari min</span>
                        </div>
                        <div className="text-[10px] md:text-sm font-bold text-emerald-400">{bettingStats.smallestBetOnSuccess.amount}💎</div>
                        <div className="text-[8px] md:text-xs text-[#9CA3AF] break-words truncate">
                          {bettingStats.smallestBetOnSuccess.playerName}
                        </div>
                      </div>
                    )}
                    {bettingStats.smallestBetOverall && (
                      <div className="bg-[#151B2D] border border-purple-500/30 rounded-lg px-2 md:px-3 py-1.5 md:py-2">
                        <div className="flex items-center gap-1 text-purple-400 text-[10px] md:text-xs mb-0.5 md:mb-1">
                          <Coins className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          <span className="hidden md:inline">Plus petite mise</span>
                          <span className="md:hidden">Mise min</span>
                        </div>
                        <div className="text-[10px] md:text-sm font-bold text-purple-400">{bettingStats.smallestBetOverall.amount}💎</div>
                        <div className="text-[8px] md:text-xs text-[#9CA3AF] break-words truncate">
                          {bettingStats.smallestBetOverall.playerName}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
