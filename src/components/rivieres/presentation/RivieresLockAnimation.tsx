import { useEffect, useState } from 'react';
import { Lock, AlertTriangle, Waves } from 'lucide-react';

interface RivieresLockAnimationProps {
  onComplete: () => void;
}

export function RivieresLockAnimation({ onComplete }: RivieresLockAnimationProps) {
  const [phase, setPhase] = useState<'tension' | 'lock' | 'done'>('tension');

  useEffect(() => {
    // Phase 1: Tension building (2.5s)
    const tensionTimer = setTimeout(() => {
      setPhase('lock');
    }, 2500);

    // Phase 2: Lock reveal (1.5s)
    const lockTimer = setTimeout(() => {
      setPhase('done');
    }, 4000);

    // Complete after all animations
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 5000);

    return () => {
      clearTimeout(tensionTimer);
      clearTimeout(lockTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  // Play tension sound effect
  useEffect(() => {
    const audio = new Audio('/sounds/foghorn.mp3');
    audio.volume = 0.4;
    audio.play().catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      {/* Pulsing red background */}
      <div 
        className={`absolute inset-0 transition-all duration-500 ${
          phase === 'tension' 
            ? 'bg-gradient-to-br from-red-900/90 via-black to-red-900/90 animate-pulse' 
            : 'bg-black/95'
        }`}
      />

      {/* Animated waves during tension */}
      {phase === 'tension' && (
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-wave-violent"
              style={{
                left: `${i * 15}%`,
                bottom: `${20 + (i % 3) * 10}%`,
                animationDelay: `${i * 0.15}s`,
              }}
            >
              <Waves className="h-20 w-20 text-red-500/40" />
            </div>
          ))}
        </div>
      )}

      {/* Warning symbols during tension */}
      {phase === 'tension' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {/* Pulsing warning triangles */}
            <AlertTriangle 
              className="h-40 w-40 text-red-500 animate-ping opacity-30" 
              style={{ animationDuration: '0.8s' }}
            />
            <AlertTriangle 
              className="h-40 w-40 text-red-400 absolute top-0 left-0 animate-pulse" 
            />
            
            {/* Countdown or tension text */}
            <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <p className="text-2xl text-red-400 font-bold animate-pulse">
                ⚠️ DÉCISIONS VERROUILLÉES ⚠️
              </p>
            </div>
          </div>

          {/* Shaking effect container */}
          <div className="absolute inset-0 animate-shake" />
        </div>
      )}

      {/* Lock reveal */}
      {(phase === 'lock' || phase === 'done') && (
        <div className="relative z-10 text-center animate-scale-in">
          <div className="relative inline-block">
            <Lock className="h-32 w-32 text-[#D4AF37] animate-bounce" />
            <div className="absolute inset-0 animate-ping opacity-30">
              <Lock className="h-32 w-32 text-[#D4AF37]" />
            </div>
          </div>
          
          <h1 className="text-4xl font-bold text-[#D4AF37] mt-6 animate-slide-up-fade">
            VERROUILLÉ !
          </h1>
          <p className="text-xl text-[#E8E8E8] mt-2 animate-slide-up-fade" style={{ animationDelay: '0.2s' }}>
            Place à la résolution...
          </p>
        </div>
      )}
    </div>
  );
}
