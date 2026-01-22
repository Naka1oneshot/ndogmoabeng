import { useEffect, useMemo, useState } from 'react';
import { Trophy, Ship, Waves, CheckCircle, XCircle, X, Coins, TrendingDown, Award, BarChart3 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import confetti from 'canvas-confetti';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

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
}

export function RivieresVictoryPodium({ ranking, levelHistory, allDecisions, players, onClose }: RivieresVictoryPodiumProps) {
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
      {/* Animated background waves */}
      <div className="absolute bottom-0 left-0 right-0 h-1/4 overflow-hidden opacity-20">
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
        className="absolute top-4 right-4 z-20 text-[#9CA3AF] hover:text-white"
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Main layout - flex row on desktop */}
      <div className="relative z-10 h-full flex flex-col lg:flex-row">
        {/* Left/Main content - Podium and rankings */}
        <div className="flex-1 flex flex-col items-center pt-6 px-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <img src={logoNdogmoabeng} alt="Logo" className="h-14 w-14" />
            <div className="text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-[#D4AF37] flex items-center gap-3">
                <Trophy className="h-8 w-8 md:h-10 md:w-10 animate-bounce" />
                VICTOIRE RIVIÈRES
                <Trophy className="h-8 w-8 md:h-10 md:w-10 animate-bounce" />
              </h1>
              <p className="text-[#9CA3AF] mt-1">Classement Final</p>
            </div>
          </div>

          {/* Podium - Top 3 */}
          <div className="flex items-end justify-center gap-4 md:gap-8 mb-6">
            {/* 2nd place */}
            {top3[1] && (
              <div 
                className={`flex flex-col items-center transition-all duration-700 ${
                  isRevealed(1) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
              >
                <Avatar className="h-16 w-16 md:h-20 md:w-20 border-4 border-gray-300 mb-2">
                  <AvatarImage src={top3[1].avatar_url || undefined} />
                  <AvatarFallback className="bg-gray-500/20 text-gray-300 text-lg md:text-xl">
                    {top3[1].display_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm md:text-lg font-medium text-[#E8E8E8] max-w-32 md:max-w-40 text-center break-words">
                  {top3[1].display_name}
                </span>
                <div className="flex items-center gap-2 text-xs md:text-sm text-gray-400">
                  <span>{top3[1].validated_levels} niv.</span>
                  <span className="text-[#4ADE80]">{top3[1].jetons}💎</span>
                </div>
                <span className="text-xl md:text-2xl font-bold text-gray-300">{top3[1].score_value} pts</span>
                <div className="h-20 w-20 md:h-24 md:w-24 bg-gray-600 rounded-t-lg flex items-center justify-center mt-2">
                  <span className="text-3xl md:text-4xl">🥈</span>
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
                  <Avatar className="h-24 w-24 md:h-28 md:w-28 border-4 border-[#D4AF37] mb-2">
                    <AvatarImage src={top3[0].avatar_url || undefined} />
                    <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37] text-xl md:text-2xl">
                      {top3[0].display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="text-2xl md:text-3xl">👑</span>
                  </div>
                </div>
                <span className="text-lg md:text-xl font-bold text-[#D4AF37] max-w-36 md:max-w-48 text-center break-words">
                  {top3[0].display_name}
                </span>
                <div className="flex items-center gap-2 text-xs md:text-sm text-[#9CA3AF]">
                  <span>{top3[0].validated_levels} niveaux</span>
                  <span className="text-[#4ADE80] font-medium">{top3[0].jetons}💎</span>
                </div>
                <span className="text-2xl md:text-3xl font-bold text-[#D4AF37]">{top3[0].score_value} pts</span>
                <div className="h-28 w-24 md:h-32 md:w-28 bg-[#D4AF37] rounded-t-lg flex items-center justify-center mt-2">
                  <span className="text-4xl md:text-5xl">🥇</span>
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
                <Avatar className="h-14 w-14 md:h-16 md:w-16 border-4 border-amber-600 mb-2">
                  <AvatarImage src={top3[2].avatar_url || undefined} />
                  <AvatarFallback className="bg-amber-600/20 text-amber-500 text-base md:text-lg">
                    {top3[2].display_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm md:text-base font-medium text-[#E8E8E8] max-w-28 md:max-w-36 text-center break-words">
                  {top3[2].display_name}
                </span>
                <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                  <span>{top3[2].validated_levels} niv.</span>
                  <span className="text-[#4ADE80]">{top3[2].jetons}💎</span>
                </div>
                <span className="text-lg md:text-xl font-bold text-amber-500">{top3[2].score_value} pts</span>
                <div className="h-14 w-18 md:h-16 md:w-20 bg-amber-700 rounded-t-lg flex items-center justify-center mt-2">
                  <span className="text-2xl md:text-3xl">🥉</span>
                </div>
              </div>
            )}
          </div>

          {/* Rest of rankings - 2 columns on desktop */}
          {others.length > 0 && (
            <div className="w-full max-w-4xl bg-[#151B2D] border border-[#D4AF37]/20 rounded-lg p-4 flex-1 min-h-0 mb-20">
              <ScrollArea className="h-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {others.map((p, idx) => {
                    const rankIndex = idx + 3; // 0-indexed rank (3 = 4th place, etc.)
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-3 p-3 rounded-lg bg-[#0B1020]/50 border border-[#D4AF37]/10 hover:border-[#D4AF37]/30 transition-all duration-300 ${
                          isRevealed(rankIndex) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                        }`}
                      >
                        {/* Rank */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                          <span className="text-sm font-bold text-[#D4AF37]">#{idx + 4}</span>
                        </div>

                        {/* Avatar */}
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage src={p.avatar_url || undefined} />
                          <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37] text-xs">
                            {p.display_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* Name and stats */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[#E8E8E8] font-medium break-words">{p.display_name}</div>
                          <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                            <span className={p.validated_levels >= 9 ? 'text-[#4ADE80]' : 'text-amber-400'}>
                              {p.validated_levels} niv.
                            </span>
                            {p.penalty_applied && <span className="text-red-400">⚠️</span>}
                            <span className="text-[#4ADE80]">{p.jetons}💎</span>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="flex-shrink-0 text-right">
                          <div className="text-lg font-bold text-[#D4AF37]">{p.score_value}</div>
                          <div className="text-xs text-[#9CA3AF]">pts</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Ship decoration at bottom */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-20 pointer-events-none lg:left-1/4">
            <Ship className="h-24 w-24 text-[#D4AF37]" />
          </div>
        </div>

        {/* Right sidebar - Stats panel (appears last) */}
        <div 
          className={`lg:w-80 xl:w-96 p-4 lg:p-6 bg-[#0B1020]/80 border-l border-[#D4AF37]/20 overflow-y-auto transition-all duration-700 ${
            showStats ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 lg:translate-x-full'
          }`}
        >
          <div className="space-y-4">
            {/* Stats header */}
            <div className="flex items-center gap-2 text-[#D4AF37] font-bold">
              <BarChart3 className="h-5 w-5" />
              <span>Statistiques</span>
            </div>

            {/* Game stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#151B2D] border border-[#D4AF37]/20 rounded-lg px-3 py-2 text-center">
                <div className="text-[#9CA3AF] text-xs">Niveaux</div>
                <div className="text-lg font-bold text-[#D4AF37]">{totalLevels}/15</div>
              </div>
              <div className="bg-[#151B2D] border border-green-500/30 rounded-lg px-3 py-2 text-center">
                <div className="flex items-center justify-center gap-1 text-green-400 text-xs">
                  <CheckCircle className="h-3 w-3" /> Réussites
                </div>
                <div className="text-lg font-bold text-green-400">{successLevels}</div>
              </div>
              <div className="bg-[#151B2D] border border-red-500/30 rounded-lg px-3 py-2 text-center">
                <div className="flex items-center justify-center gap-1 text-red-400 text-xs">
                  <XCircle className="h-3 w-3" /> Échecs
                </div>
                <div className="text-lg font-bold text-red-400">{failLevels}</div>
              </div>
              <div className="bg-[#151B2D] border border-blue-500/30 rounded-lg px-3 py-2 text-center">
                <div className="text-blue-400 text-xs">Joueurs</div>
                <div className="text-lg font-bold text-blue-400">{totalPlayers}</div>
              </div>
              <div className="bg-[#151B2D] border border-[#4ADE80]/30 rounded-lg px-3 py-2 text-center">
                <div className="text-[#4ADE80] text-xs">Survivants</div>
                <div className="text-lg font-bold text-[#4ADE80]">{survivorsCount}</div>
              </div>
              <div className="bg-[#151B2D] border border-cyan-500/30 rounded-lg px-3 py-2 text-center">
                <div className="text-cyan-400 text-xs">Score moy.</div>
                <div className="text-lg font-bold text-cyan-400">{avgScore}</div>
              </div>
            </div>

            {/* Betting awards */}
            {(bettingStats.mostStingyPlayer || bettingStats.smallestBetOnSuccess || bettingStats.smallestBetOverall) && (
              <>
                <div className="border-t border-[#D4AF37]/20 pt-4">
                  <div className="text-[#9CA3AF] text-xs uppercase tracking-wide mb-3">Prix spéciaux</div>
                </div>
                <div className="space-y-3">
                  {bettingStats.mostStingyPlayer && (
                    <div className="bg-[#151B2D] border border-amber-500/30 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1 text-amber-400 text-xs mb-1">
                        <TrendingDown className="h-3 w-3" /> Le plus Radin
                      </div>
                      <div className="text-sm font-bold text-amber-400 break-words">{bettingStats.mostStingyPlayer.name}</div>
                      <div className="text-xs text-[#9CA3AF]">Moy. {bettingStats.mostStingyPlayer.avgBet}💎/niveau</div>
                    </div>
                  )}
                  {bettingStats.smallestBetOnSuccess && (
                    <div className="bg-[#151B2D] border border-emerald-500/30 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1 text-emerald-400 text-xs mb-1">
                        <Award className="h-3 w-3" /> Plus petit pari gagnant
                      </div>
                      <div className="text-sm font-bold text-emerald-400">{bettingStats.smallestBetOnSuccess.amount}💎</div>
                      <div className="text-xs text-[#9CA3AF] break-words">
                        {bettingStats.smallestBetOnSuccess.playerName} ({bettingStats.smallestBetOnSuccess.level})
                      </div>
                    </div>
                  )}
                  {bettingStats.smallestBetOverall && (
                    <div className="bg-[#151B2D] border border-purple-500/30 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1 text-purple-400 text-xs mb-1">
                        <Coins className="h-3 w-3" /> Plus petite mise
                      </div>
                      <div className="text-sm font-bold text-purple-400">{bettingStats.smallestBetOverall.amount}💎</div>
                      <div className="text-xs text-[#9CA3AF] break-words">
                        {bettingStats.smallestBetOverall.playerName} ({bettingStats.smallestBetOverall.level})
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
