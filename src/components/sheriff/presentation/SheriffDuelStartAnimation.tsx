import { useState, useEffect, useRef } from 'react';
import { Swords } from 'lucide-react';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  avatar_url?: string | null;
  clan?: string | null;
}

interface SheriffDuelStartAnimationProps {
  player1: Player | undefined;
  player2: Player | undefined;
  duelOrder: number;
  onComplete: () => void;
}

export function SheriffDuelStartAnimation({
  player1,
  player2,
  duelOrder,
  onComplete,
}: SheriffDuelStartAnimationProps) {
  const [phase, setPhase] = useState<'flying' | 'collision' | 'done'>('flying');
  const onCompleteRef = useRef(onComplete);
  
  // Keep ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  useEffect(() => {
    // Flying phase
    const flyingTimer = setTimeout(() => {
      setPhase('collision');
    }, 1500);
    
    // Collision impact then done
    const collisionTimer = setTimeout(() => {
      setPhase('done');
    }, 2500);
    
    // Complete callback
    const completeTimer = setTimeout(() => {
      onCompleteRef.current();
    }, 3000);
    
    return () => {
      clearTimeout(flyingTimer);
      clearTimeout(collisionTimer);
      clearTimeout(completeTimer);
    };
  }, []); // Empty deps - run once on mount
  
  // Get initials from display name
  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const renderPlayerAvatar = (player: Player | undefined, side: 'left' | 'right') => {
    const flyClass = phase === 'flying' 
      ? side === 'left' ? '-translate-x-[200px]' : 'translate-x-[200px]'
      : phase === 'collision' 
        ? 'scale-110' 
        : '';
    
    return (
      <div className={`transition-all duration-700 ease-out ${flyClass}`}>
        {player?.avatar_url ? (
          <img
            src={player.avatar_url}
            alt=""
            className={`h-32 w-32 rounded-full object-cover border-4 border-[#D4AF37] shadow-2xl ${phase === 'collision' ? 'animate-pulse' : ''}`}
          />
        ) : (
          <div className={`h-32 w-32 rounded-full bg-gradient-to-br from-[#D4AF37]/40 to-[#8B4513]/40 flex items-center justify-center border-4 border-[#D4AF37] text-4xl font-bold text-[#D4AF37] shadow-2xl ${phase === 'collision' ? 'animate-pulse' : ''}`}>
            {getInitials(player?.display_name)}
          </div>
        )}
        <div className="text-center mt-3">
          <div className="text-xl font-bold text-white">{player?.display_name}</div>
          <div className="text-sm text-[#9CA3AF]">{player?.clan || 'Solo'}</div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl text-[#D4AF37] font-bold mb-8 animate-pulse">
          ⚔️ DUEL {duelOrder}
        </div>
        
        <div className="flex items-center justify-center gap-16">
          {/* Player 1 */}
          {renderPlayerAvatar(player1, 'left')}
          
          {/* VS / Swords */}
          <div className={`transition-all duration-500 ${phase === 'collision' ? 'scale-150' : 'scale-100'}`}>
            {phase === 'collision' ? (
              <Swords className="h-20 w-20 text-[#D4AF37] animate-bounce" />
            ) : (
              <div className="text-6xl font-black text-[#D4AF37]">VS</div>
            )}
          </div>
          
          {/* Player 2 */}
          {renderPlayerAvatar(player2, 'right')}
        </div>
        
        {phase === 'collision' && (
          <div className="mt-8 text-2xl text-[#D4AF37] font-bold animate-bounce">
            ⚡ COMBAT! ⚡
          </div>
        )}
      </div>
    </div>
  );
}