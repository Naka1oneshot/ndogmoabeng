import { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, Award, Crown, Star, Sparkles, Coins, Skull, Gift } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import confetti from 'canvas-confetti';

interface TeamRanking {
  display_name: string; // Team name or player name
  player_numbers: number[]; // Player numbers in team
  total_score: number;
  jetons: number;
  recompenses: number;
  kills: number;
  avatar_urls: (string | null)[];
  clans: (string | null)[];
  isTeam: boolean;
}

interface GameStats {
  totalManches: number;
  totalKills: number;
  totalRecompenses: number;
  totalJetons: number;
  topKiller: { name: string; kills: number } | null;
  topEarner: { name: string; recompenses: number } | null;
  hasTeams: boolean;
  teamCount: number;
  soloCount: number;
}

interface VictoryPodiumAnimationProps {
  show: boolean;
  rankings: TeamRanking[];
  gameStats?: GameStats;
  onComplete?: () => void;
}

export function VictoryPodiumAnimation({ show, rankings, gameStats, onComplete }: VictoryPodiumAnimationProps) {
  const [animationStep, setAnimationStep] = useState(0);
  
  // Confetti burst function
  const fireConfetti = useCallback(() => {
    const duration = 5000;
    const animationEnd = Date.now() + duration;
    const colors = ['#fbbf24', '#f59e0b', '#d97706', '#92400e', '#fcd34d', '#fef3c7'];

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: colors,
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };

    // Initial big burst
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { y: 0.6 },
      colors: colors,
    });

    // Continuous side confetti
    frame();

    // Additional bursts at intervals
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 80,
        origin: { x: 0.2, y: 0.5 },
        colors: colors,
      });
    }, 1000);

    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 80,
        origin: { x: 0.8, y: 0.5 },
        colors: colors,
      });
    }, 2000);

    // Final celebration burst
    setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 180,
        origin: { y: 0.5, x: 0.5 },
        colors: colors,
        scalar: 1.2,
      });
    }, 3000);
  }, []);
  
  useEffect(() => {
    if (!show) {
      setAnimationStep(0);
      return;
    }
    
    // Progressive animation steps
    const timers = [
      setTimeout(() => setAnimationStep(1), 500),   // Show title
      setTimeout(() => setAnimationStep(2), 1500),  // Show podium
      setTimeout(() => setAnimationStep(3), 2500),  // Show 3rd place
      setTimeout(() => setAnimationStep(4), 3500),  // Show 2nd place
      setTimeout(() => setAnimationStep(5), 4500),  // Show 1st place + confetti
      setTimeout(() => setAnimationStep(6), 5500),  // Show other rankings
    ];
    
    return () => timers.forEach(t => clearTimeout(t));
  }, [show]);

  // Trigger confetti when 1st place is revealed
  useEffect(() => {
    if (animationStep === 5) {
      fireConfetti();
    }
  }, [animationStep, fireConfetti]);
  
  if (!show || rankings.length === 0) return null;
  
  const top3 = rankings.slice(0, 3);
  const others = rankings.slice(3);
  
  const getPlaceColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-400';
      case 2: return 'text-gray-300';
      case 3: return 'text-amber-600';
      default: return 'text-muted-foreground';
    }
  };
  
  const getPlaceIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="h-8 w-8 text-yellow-400" />;
      case 2: return <Medal className="h-7 w-7 text-gray-300" />;
      case 3: return <Award className="h-6 w-6 text-amber-600" />;
      default: return null;
    }
  };
  
  const getPodiumHeight = (rank: number) => {
    switch (rank) {
      case 1: return 'h-48';
      case 2: return 'h-36';
      case 3: return 'h-28';
      default: return 'h-20';
    }
  };
  
  const getAvatarSize = (rank: number) => {
    switch (rank) {
      case 1: return 'h-24 w-24';
      case 2: return 'h-20 w-20';
      case 3: return 'h-16 w-16';
      default: return 'h-12 w-12';
    }
  };
  
  // Reorder for display: 2nd - 1st - 3rd
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumRanks = top3.length >= 3 ? [2, 1, 3] : [1, 2, 3].slice(0, top3.length);
  
  return (
    <div className="fixed inset-0 z-50 flex bg-gradient-to-b from-black via-black/95 to-primary/20">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {animationStep >= 1 && (
          <>
            <Sparkles className="absolute top-10 left-1/4 h-8 w-8 text-yellow-400/50 animate-pulse" />
            <Sparkles className="absolute top-20 right-1/4 h-6 w-6 text-yellow-400/40 animate-pulse" style={{ animationDelay: '0.5s' }} />
            <Star className="absolute top-32 left-1/3 h-4 w-4 text-yellow-400/30 animate-pulse" style={{ animationDelay: '1s' }} />
            <Star className="absolute top-16 right-1/3 h-5 w-5 text-yellow-400/30 animate-pulse" style={{ animationDelay: '0.7s' }} />
          </>
        )}
      </div>
      
      {/* Main content - Podium area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {/* Title */}
        <div className={`mb-8 text-center transition-all duration-1000 ${animationStep >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
          <div className="flex items-center justify-center gap-3 mb-2">
            <Trophy className="h-12 w-12 text-yellow-400 animate-bounce" />
            <h1 className="font-display text-4xl sm:text-5xl text-yellow-400 text-glow">
              FIN DE PARTIE
            </h1>
            <Trophy className="h-12 w-12 text-yellow-400 animate-bounce" />
          </div>
          <p className="text-lg text-muted-foreground">
            La forêt de Ndogmoabeng a été conquise !
          </p>
        </div>
      
      {/* Podium */}
      <div className={`flex items-end justify-center gap-4 mb-8 transition-all duration-1000 ${animationStep >= 2 ? 'opacity-100' : 'opacity-0'}`}>
        {podiumOrder.map((player, index) => {
          if (!player) return null;
          const rank = podiumRanks[index];
          const shouldShow = 
            (rank === 3 && animationStep >= 3) ||
            (rank === 2 && animationStep >= 4) ||
            (rank === 1 && animationStep >= 5);
          
          return (
            <div 
              key={player.player_numbers.join('-')}
              className={`flex flex-col items-center transition-all duration-700 ${shouldShow ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}
            >
              {/* Player info */}
              <div className="mb-3 text-center">
                {getPlaceIcon(rank)}
              </div>
              
              <div className={`relative ${rank === 1 ? 'animate-pulse' : ''}`}>
                {player.isTeam ? (
                  <div className="flex -space-x-4">
                    {player.avatar_urls.map((url, idx) => (
                      <Avatar key={idx} className={`${rank === 1 ? 'h-16 w-16' : rank === 2 ? 'h-14 w-14' : 'h-12 w-12'} border-4 ${rank === 1 ? 'border-yellow-400' : rank === 2 ? 'border-gray-300' : 'border-amber-600'} shadow-lg`}>
                        {url ? (
                          <AvatarImage src={url} alt={player.display_name} />
                        ) : null}
                        <AvatarFallback className={`text-lg font-bold ${getPlaceColor(rank)}`}>
                          {player.display_name.split(' & ')[idx]?.slice(0, 2).toUpperCase() || '??'}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                ) : (
                  <Avatar className={`${getAvatarSize(rank)} border-4 ${rank === 1 ? 'border-yellow-400' : rank === 2 ? 'border-gray-300' : 'border-amber-600'} shadow-lg`}>
                    {player.avatar_urls[0] ? (
                      <AvatarImage src={player.avatar_urls[0]} alt={player.display_name} />
                    ) : null}
                    <AvatarFallback className={`text-2xl font-bold ${getPlaceColor(rank)}`}>
                      {player.display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                {rank === 1 && (
                  <Crown className="absolute -top-4 left-1/2 -translate-x-1/2 h-8 w-8 text-yellow-400 animate-bounce" />
                )}
              </div>
              
              <p className={`mt-2 font-bold ${getPlaceColor(rank)} text-center max-w-[140px] ${player.isTeam ? 'text-sm' : ''} truncate`}>
                {player.display_name}
              </p>
              
              <Badge variant="outline" className={`mt-1 ${getPlaceColor(rank)} border-current`}>
                {player.total_score.toFixed(1)} pts
              </Badge>
              
              {/* Detailed stats */}
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-0.5" title="Jetons restants (÷3)">
                  <Coins className="h-3 w-3 text-primary" />
                  <span>{player.jetons}</span>
                </div>
                <div className="flex items-center gap-0.5" title="Récompenses gagnées">
                  <Gift className="h-3 w-3 text-green-500" />
                  <span>{player.recompenses}</span>
                </div>
                {player.kills > 0 && (
                  <div className="flex items-center gap-0.5" title="Monstres tués">
                    <Skull className="h-3 w-3 text-red-500" />
                    <span>{player.kills}</span>
                  </div>
                )}
              </div>
              
              {/* Podium block */}
              <div className={`mt-3 ${getPodiumHeight(rank)} w-24 sm:w-32 rounded-t-lg ${
                rank === 1 ? 'bg-gradient-to-t from-yellow-600 to-yellow-400' : 
                rank === 2 ? 'bg-gradient-to-t from-gray-600 to-gray-400' : 
                'bg-gradient-to-t from-amber-800 to-amber-600'
              } flex items-center justify-center shadow-2xl`}>
                <span className={`text-4xl font-bold ${rank === 1 ? 'text-yellow-900' : rank === 2 ? 'text-gray-800' : 'text-amber-900'}`}>
                  {rank}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Other rankings */}
      {others.length > 0 && (
        <div className={`w-full max-w-lg px-4 transition-all duration-1000 ${animationStep >= 6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="card-gradient rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center uppercase tracking-wide">
              Classement complet
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {others.map((player, index) => (
                <div 
                  key={player.player_numbers.join('-')}
                  className="flex items-center gap-3 p-2 rounded bg-secondary/50"
                >
                  <span className="w-8 text-center font-bold text-muted-foreground">
                    #{index + 4}
                  </span>
                  {player.isTeam ? (
                    <div className="flex -space-x-2">
                      {player.avatar_urls.map((url, idx) => (
                        <Avatar key={idx} className="h-6 w-6 border-2 border-background">
                          {url ? (
                            <AvatarImage src={url} alt={player.display_name} />
                          ) : null}
                          <AvatarFallback className="text-[10px]">
                            {player.display_name.split(' & ')[idx]?.slice(0, 1).toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  ) : (
                    <Avatar className="h-8 w-8">
                      {player.avatar_urls[0] ? (
                        <AvatarImage src={player.avatar_urls[0]} alt={player.display_name} />
                      ) : null}
                      <AvatarFallback className="text-xs">
                        {player.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <span className={`flex-1 font-medium truncate ${player.isTeam ? 'text-sm' : ''}`}>
                    {player.display_name}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-0.5" title="Jetons (÷3)">
                      <Coins className="h-3 w-3 text-primary" />
                      <span>{player.jetons}</span>
                    </div>
                    <div className="flex items-center gap-0.5" title="Récompenses">
                      <Gift className="h-3 w-3 text-green-500" />
                      <span>{player.recompenses}</span>
                    </div>
                    {player.kills > 0 && (
                      <div className="flex items-center gap-0.5" title="Kills">
                        <Skull className="h-3 w-3 text-red-500" />
                        <span>{player.kills}</span>
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs ml-2">
                    {player.total_score.toFixed(1)} pts
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Stats Panel - Right side */}
      {gameStats && (
        <div className={`hidden lg:flex w-80 flex-col p-6 bg-black/60 backdrop-blur-sm border-l border-border/30 transition-all duration-1000 ${animationStep >= 6 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
          <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Statistiques de la partie
          </h3>
          
          <div className="space-y-4 flex-1 overflow-y-auto">
            {/* General stats */}
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-secondary/40 rounded-lg">
                <span className="text-muted-foreground">Manches jouées</span>
                <span className="font-bold text-lg">{gameStats.totalManches}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-secondary/40 rounded-lg">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Skull className="h-4 w-4 text-red-500" />
                  Monstres tués
                </span>
                <span className="font-bold text-lg text-red-400">{gameStats.totalKills}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-secondary/40 rounded-lg">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Gift className="h-4 w-4 text-green-500" />
                  Récompenses totales
                </span>
                <span className="font-bold text-lg text-green-400">{gameStats.totalRecompenses}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-secondary/40 rounded-lg">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Coins className="h-4 w-4 text-primary" />
                  Jetons restants
                </span>
                <span className="font-bold text-lg text-primary">{gameStats.totalJetons}</span>
              </div>
            </div>

            {/* Team composition */}
            {gameStats.hasTeams && (
              <div className="border-t border-border/30 pt-4">
                <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Composition</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-secondary/30 rounded text-center">
                    <div className="text-2xl font-bold">{gameStats.teamCount}</div>
                    <div className="text-xs text-muted-foreground">Équipes</div>
                  </div>
                  <div className="p-2 bg-secondary/30 rounded text-center">
                    <div className="text-2xl font-bold">{gameStats.soloCount}</div>
                    <div className="text-xs text-muted-foreground">Solo</div>
                  </div>
                </div>
              </div>
            )}

            {/* Top performers */}
            <div className="border-t border-border/30 pt-4">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Performances</h4>
              
              {gameStats.topKiller && gameStats.topKiller.kills > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Skull className="h-4 w-4 text-red-500" />
                    <span className="text-xs text-red-400 uppercase">Chasseur</span>
                  </div>
                  <div className="font-bold truncate">{gameStats.topKiller.name}</div>
                  <div className="text-sm text-muted-foreground">{gameStats.topKiller.kills} kills</div>
                </div>
              )}
              
              {gameStats.topEarner && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Gift className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-green-400 uppercase">Meilleur butin</span>
                  </div>
                  <div className="font-bold truncate">{gameStats.topEarner.name}</div>
                  <div className="text-sm text-muted-foreground">{gameStats.topEarner.recompenses} récompenses</div>
                </div>
              )}
            </div>

            {/* Score formula explanation */}
            <div className="border-t border-border/30 pt-4">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Calcul du score</h4>
              <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg text-sm">
                <div className="font-mono text-primary">Score = Récompenses + (Jetons ÷ 3)</div>
                {gameStats.hasTeams && (
                  <div className="text-xs text-muted-foreground mt-2">
                    * Les joueurs solo ont leur score doublé pour équilibrer
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

