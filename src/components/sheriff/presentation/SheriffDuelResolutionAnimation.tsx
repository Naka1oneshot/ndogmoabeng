import { useState, useEffect, useRef } from 'react';
import { Search, Check } from 'lucide-react';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  avatar_url?: string | null;
}

interface PlayerChoice {
  tokens_entering: number | null;
  has_illegal_tokens: boolean;
}

interface Duel {
  id: string;
  player1_number: number;
  player2_number: number;
  player1_searches: boolean | null;
  player2_searches: boolean | null;
  player1_vp_delta: number;
  player2_vp_delta: number;
  resolution_summary: any;
}

interface SheriffDuelResolutionAnimationProps {
  duel: Duel;
  player1: Player | undefined;
  player2: Player | undefined;
  choice1: PlayerChoice | undefined;
  choice2: PlayerChoice | undefined;
  onComplete: () => void;
}

export function SheriffDuelResolutionAnimation({
  duel,
  player1,
  player2,
  choice1,
  choice2,
  onComplete,
}: SheriffDuelResolutionAnimationProps) {
  const [phase, setPhase] = useState<'search' | 'tokens' | 'pvic' | 'done'>('search');
  const [p1TokenDisplay, setP1TokenDisplay] = useState<number>(0);
  const [p2TokenDisplay, setP2TokenDisplay] = useState<number>(0);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  
  const p1Tokens = choice1?.tokens_entering ?? 20;
  const p2Tokens = choice2?.tokens_entering ?? 20;
  
  // Keep ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  useEffect(() => {
    // Phase 1: Show search choices for 2.5s
    const timer1 = setTimeout(() => {
      setPhase('tokens');
      // Start random token animation
      let count = 0;
      const maxCount = 15;
      animationRef.current = setInterval(() => {
        setP1TokenDisplay(Math.floor(Math.random() * 31) + 10);
        setP2TokenDisplay(Math.floor(Math.random() * 31) + 10);
        count++;
        if (count >= maxCount) {
          if (animationRef.current) clearInterval(animationRef.current);
          // Show final values
          setP1TokenDisplay(p1Tokens);
          setP2TokenDisplay(p2Tokens);
        }
      }, 80);
    }, 2500);
    
    // Phase 2 ends, Phase 3 starts at 5.5s
    const timer2 = setTimeout(() => {
      setPhase('pvic');
    }, 5500);
    
    // Complete at 8.5s
    const timer3 = setTimeout(() => {
      setPhase('done');
    }, 8500);
    
    const timer4 = setTimeout(() => {
      onCompleteRef.current();
    }, 8800);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, [p1Tokens, p2Tokens]); // Remove onComplete from deps
  
  // Get initials from display name
  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const renderPlayerCard = (
    player: Player | undefined,
    searches: boolean | null,
    tokensDisplay: number,
    vpDelta: number,
    hasIllegal: boolean,
    showTokens: boolean,
    showPvic: boolean
  ) => {
    return (
      <div className="text-center transition-all duration-500">
        {/* Avatar */}
        <div className="relative inline-block mb-4">
          {player?.avatar_url ? (
            <img
              src={player.avatar_url}
              alt=""
              className="h-28 w-28 lg:h-36 lg:w-36 rounded-full object-cover border-4 border-[#D4AF37]"
            />
          ) : (
            <div className="h-28 w-28 lg:h-36 lg:w-36 rounded-full bg-gradient-to-br from-[#D4AF37]/40 to-[#8B4513]/40 flex items-center justify-center border-4 border-[#D4AF37] text-4xl lg:text-5xl font-bold text-[#D4AF37]">
              {getInitials(player?.display_name)}
            </div>
          )}
        </div>
        
        {/* Name */}
        <div className="text-xl lg:text-2xl font-bold text-white mb-2">{player?.display_name}</div>
        
        {/* Phase 1: Search Choice */}
        <div className={`transition-all duration-500 ${phase === 'search' ? 'opacity-100 scale-100' : 'opacity-60 scale-95'}`}>
          <div className={`inline-flex items-center gap-2 px-5 py-3 rounded-full text-lg font-bold ${
            searches 
              ? 'bg-red-500/30 text-red-400 border-2 border-red-500' 
              : 'bg-green-500/30 text-green-400 border-2 border-green-500'
          }`}>
            {searches ? <Search className="h-6 w-6" /> : <Check className="h-6 w-6" />}
            {searches ? '🔍 Fouille' : '👋 Laisse passer'}
          </div>
        </div>
        
        {/* Phase 2: Tokens */}
        {showTokens && (
          <div className={`mt-4 transition-all duration-500 ${phase === 'tokens' ? 'opacity-100 scale-110' : 'opacity-80 scale-100'}`}>
            <div className="text-sm text-[#9CA3AF] mb-1">Jetons emmenés</div>
            <div className={`text-4xl lg:text-5xl font-black ${
              phase === 'tokens' && tokensDisplay !== (choice1?.tokens_entering ?? choice2?.tokens_entering ?? 20)
                ? 'text-[#D4AF37] animate-pulse' 
                : hasIllegal 
                  ? 'text-red-400' 
                  : 'text-green-400'
            }`}>
              {tokensDisplay}💎
            </div>
            {phase !== 'tokens' && (
              <div className={`text-sm mt-1 ${hasIllegal ? 'text-red-400' : 'text-green-400'}`}>
                {hasIllegal ? '⚠️ Contrebande' : '✓ Légal'}
              </div>
            )}
          </div>
        )}
        
        {/* Phase 3: PVic Delta */}
        {showPvic && (
          <div className={`mt-4 transition-all duration-700 ${phase === 'pvic' ? 'opacity-100 scale-110' : 'opacity-0 scale-75'}`}>
            <div className="text-sm text-[#9CA3AF] mb-1">Points de Victoire</div>
            <div className={`text-5xl lg:text-6xl font-black flex items-center justify-center gap-2 ${
              vpDelta > 0 ? 'text-green-400' : vpDelta < 0 ? 'text-red-400' : 'text-[#9CA3AF]'
            }`}>
              {vpDelta > 0 && <span className="text-green-400">▲</span>}
              {vpDelta < 0 && <span className="text-red-400">▼</span>}
              {vpDelta === 0 && <span className="text-[#9CA3AF]">●</span>}
              {vpDelta > 0 ? '+' : ''}{vpDelta}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  const getPhaseTitle = () => {
    switch (phase) {
      case 'search': return '⚖️ Décisions de fouille';
      case 'tokens': return '💎 Jetons emmenés';
      case 'pvic': return '🏆 Résultat';
      default: return '';
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center">
      <div className="text-center max-w-4xl px-4 w-full">
        {/* Phase Title */}
        <h2 className={`text-3xl lg:text-4xl font-bold text-[#D4AF37] mb-10 transition-all duration-500 ${
          phase === 'done' ? 'opacity-0' : 'opacity-100'
        }`}>
          {getPhaseTitle()}
        </h2>
        
        {/* Players */}
        <div className="flex items-start justify-center gap-8 lg:gap-20">
          {renderPlayerCard(
            player1,
            duel.player1_searches,
            p1TokenDisplay,
            duel.player1_vp_delta,
            choice1?.has_illegal_tokens ?? false,
            phase !== 'search',
            phase === 'pvic' || phase === 'done'
          )}
          
          <div className="text-5xl lg:text-7xl font-black text-[#D4AF37] mt-16 lg:mt-20">VS</div>
          
          {renderPlayerCard(
            player2,
            duel.player2_searches,
            p2TokenDisplay,
            duel.player2_vp_delta,
            choice2?.has_illegal_tokens ?? false,
            phase !== 'search',
            phase === 'pvic' || phase === 'done'
          )}
        </div>
      </div>
    </div>
  );
}
