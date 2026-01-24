import { useState, useEffect } from 'react';
import { Search, Check, X, AlertTriangle, PartyPopper } from 'lucide-react';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  avatar_url?: string | null;
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
  onComplete: () => void;
}

export function SheriffDuelResolutionAnimation({
  duel,
  player1,
  player2,
  onComplete,
}: SheriffDuelResolutionAnimationProps) {
  const [phase, setPhase] = useState<'reveal' | 'result' | 'done'>('reveal');
  
  useEffect(() => {
    // Show reveal
    setTimeout(() => {
      setPhase('result');
    }, 1500);
    
    // Complete
    setTimeout(() => {
      setPhase('done');
      setTimeout(onComplete, 300);
    }, 4000);
  }, [onComplete]);
  
  const renderPlayerResult = (
    player: Player | undefined,
    searches: boolean | null,
    vpDelta: number,
    side: 'left' | 'right'
  ) => {
    const isWinner = vpDelta > 0;
    const isLoser = vpDelta < 0;
    
    return (
      <div className={`text-center transition-all duration-500 ${phase === 'result' ? 'scale-105' : ''}`}>
        <div className="relative inline-block">
          {player?.avatar_url ? (
            <img
              src={player.avatar_url}
              alt=""
              className={`h-24 w-24 rounded-full object-cover border-4 ${isWinner ? 'border-green-500' : isLoser ? 'border-red-500' : 'border-[#D4AF37]'}`}
            />
          ) : (
            <div className={`h-24 w-24 rounded-full bg-[#D4AF37]/30 flex items-center justify-center border-4 ${isWinner ? 'border-green-500' : isLoser ? 'border-red-500' : 'border-[#D4AF37]'} text-3xl font-bold text-[#D4AF37]`}>
              {player?.player_number}
            </div>
          )}
          
          {/* Action icon */}
          <div className={`absolute -bottom-2 -right-2 h-10 w-10 rounded-full flex items-center justify-center ${searches ? 'bg-red-500' : 'bg-green-500'}`}>
            {searches ? <Search className="h-5 w-5 text-white" /> : <Check className="h-5 w-5 text-white" />}
          </div>
        </div>
        
        <div className="mt-3 text-lg font-bold text-white">{player?.display_name}</div>
        <div className="text-sm text-[#9CA3AF] mb-2">
          {searches ? '🔍 A fouillé' : '✓ Laissé passer'}
        </div>
        
        {phase === 'result' && (
          <div className={`text-2xl font-bold mt-2 ${vpDelta > 0 ? 'text-green-400' : vpDelta < 0 ? 'text-red-400' : 'text-[#9CA3AF]'}`}>
            {vpDelta > 0 ? '+' : ''}{vpDelta} PV
            {isWinner && <PartyPopper className="inline h-5 w-5 ml-1" />}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center">
      <div className="text-center max-w-2xl px-4">
        <h2 className="text-2xl font-bold text-[#D4AF37] mb-8">
          {phase === 'reveal' ? '⚖️ Résolution...' : '🎯 Résultat!'}
        </h2>
        
        <div className="flex items-start justify-center gap-16">
          {renderPlayerResult(player1, duel.player1_searches, duel.player1_vp_delta, 'left')}
          
          <div className="text-4xl font-black text-[#D4AF37] mt-8">VS</div>
          
          {renderPlayerResult(player2, duel.player2_searches, duel.player2_vp_delta, 'right')}
        </div>
        
        {phase === 'result' && duel.resolution_summary && (
          <div className="mt-8 p-4 bg-[#2A2215] rounded-xl border border-[#D4AF37]/30 text-[#9CA3AF]">
            {typeof duel.resolution_summary === 'string' 
              ? duel.resolution_summary 
              : JSON.stringify(duel.resolution_summary)}
          </div>
        )}
      </div>
    </div>
  );
}
