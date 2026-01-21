import { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Crown, Star, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface PlayerRanking {
  display_name: string;
  player_number: number;
  total_score: number;
  avatar_url?: string | null;
  clan?: string | null;
}

interface VictoryPodiumAnimationProps {
  show: boolean;
  rankings: PlayerRanking[];
  onComplete?: () => void;
}

export function VictoryPodiumAnimation({ show, rankings, onComplete }: VictoryPodiumAnimationProps) {
  const [animationStep, setAnimationStep] = useState(0);
  
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
      setTimeout(() => setAnimationStep(5), 4500),  // Show 1st place
      setTimeout(() => setAnimationStep(6), 5500),  // Show other rankings
    ];
    
    return () => timers.forEach(t => clearTimeout(t));
  }, [show]);
  
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-black via-black/95 to-primary/20">
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
      
      {/* Title */}
      <div className={`mb-8 text-center transition-all duration-1000 ${animationStep >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
        <div className="flex items-center justify-center gap-3 mb-2">
          <Trophy className="h-12 w-12 text-yellow-400 animate-bounce" />
          <h1 className="font-display text-4xl sm:text-6xl text-yellow-400 text-glow">
            FIN DE PARTIE
          </h1>
          <Trophy className="h-12 w-12 text-yellow-400 animate-bounce" />
        </div>
        <p className="text-xl text-muted-foreground">
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
              key={player.player_number}
              className={`flex flex-col items-center transition-all duration-700 ${shouldShow ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}
            >
              {/* Player info */}
              <div className="mb-3 text-center">
                {getPlaceIcon(rank)}
              </div>
              
              <div className={`relative ${rank === 1 ? 'animate-pulse' : ''}`}>
                <Avatar className={`${getAvatarSize(rank)} border-4 ${rank === 1 ? 'border-yellow-400' : rank === 2 ? 'border-gray-300' : 'border-amber-600'} shadow-lg`}>
                  {player.avatar_url ? (
                    <AvatarImage src={player.avatar_url} alt={player.display_name} />
                  ) : null}
                  <AvatarFallback className={`text-2xl font-bold ${getPlaceColor(rank)}`}>
                    {player.display_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {rank === 1 && (
                  <Crown className="absolute -top-4 left-1/2 -translate-x-1/2 h-8 w-8 text-yellow-400 animate-bounce" />
                )}
              </div>
              
              <p className={`mt-2 font-bold ${getPlaceColor(rank)} text-center max-w-[120px] truncate`}>
                {player.display_name}
              </p>
              
              <Badge variant="outline" className={`mt-1 ${getPlaceColor(rank)} border-current`}>
                {player.total_score} pts
              </Badge>
              
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
                  key={player.player_number}
                  className="flex items-center gap-3 p-2 rounded bg-secondary/50"
                >
                  <span className="w-8 text-center font-bold text-muted-foreground">
                    #{index + 4}
                  </span>
                  <Avatar className="h-8 w-8">
                    {player.avatar_url ? (
                      <AvatarImage src={player.avatar_url} alt={player.display_name} />
                    ) : null}
                    <AvatarFallback className="text-xs">
                      {player.display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 font-medium truncate">
                    {player.display_name}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {player.total_score} pts
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

