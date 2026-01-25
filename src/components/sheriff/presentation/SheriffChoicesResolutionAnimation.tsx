import { useState, useEffect, useRef } from 'react';

interface SheriffChoicesResolutionAnimationProps {
  initialPool: number;
  finalPool: number;
  initialPvics: number;
  finalPvics: number;
  onComplete: () => void;
}

export function SheriffChoicesResolutionAnimation({
  initialPool,
  finalPool,
  initialPvics,
  finalPvics,
  onComplete,
}: SheriffChoicesResolutionAnimationProps) {
  const [phase, setPhase] = useState<'counting' | 'reveal'>('counting');
  const [displayPool, setDisplayPool] = useState(initialPool);
  const [displayPvics, setDisplayPvics] = useState(initialPvics);
  const onCompleteRef = useRef(onComplete);
  
  // Keep ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  useEffect(() => {
    // Random counting animation
    const countingDuration = 2500;
    const interval = 50;
    let elapsed = 0;
    
    const countInterval = setInterval(() => {
      elapsed += interval;
      
      if (elapsed < countingDuration) {
        // Random fluctuation
        setDisplayPool(Math.floor(Math.random() * (initialPool * 1.5)));
        setDisplayPvics(Math.floor(Math.random() * (initialPvics * 1.5)));
      } else {
        // Reveal final values
        clearInterval(countInterval);
        setPhase('reveal');
        setDisplayPool(finalPool);
        setDisplayPvics(finalPvics);
      }
    }, interval);
    
    // Complete after reveal delay
    const completeTimer = setTimeout(() => {
      onCompleteRef.current();
    }, countingDuration + 1500);
    
    return () => {
      clearInterval(countInterval);
      clearTimeout(completeTimer);
    };
  }, [initialPool, finalPool, initialPvics, finalPvics]); // Don't include onComplete
  
  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-[#D4AF37] mb-8 animate-pulse">
          🎯 Résolution des Choix
        </h2>
        
        <div className="grid grid-cols-3 gap-8 items-center">
          {/* Pool */}
          <div className={`transition-all duration-300 ${phase === 'reveal' ? 'scale-110' : ''}`}>
            <div className="bg-gradient-to-br from-amber-600/40 to-amber-800/30 border-2 border-amber-500/60 rounded-2xl p-8">
              <div className="text-lg text-amber-300 mb-2">💰 Cagnotte</div>
              <div className={`text-5xl font-bold transition-all ${phase === 'counting' ? 'animate-pulse text-white' : 'text-amber-400'}`}>
                {displayPool}€
              </div>
              {phase === 'reveal' && initialPool !== finalPool && (
                <div className="text-sm text-amber-300/70 mt-2">
                  {finalPool - initialPool >= 0 ? '+' : ''}{finalPool - initialPool}€
                </div>
              )}
            </div>
          </div>
          
          {/* VS */}
          <div className="text-6xl font-black text-[#D4AF37] animate-pulse">
            VS
          </div>
          
          {/* PVics */}
          <div className={`transition-all duration-300 ${phase === 'reveal' ? 'scale-110' : ''}`}>
            <div className="bg-gradient-to-br from-purple-600/40 to-purple-800/30 border-2 border-purple-500/60 rounded-2xl p-8">
              <div className="text-lg text-purple-300 mb-2">⭐ Total PVics</div>
              <div className={`text-5xl font-bold transition-all ${phase === 'counting' ? 'animate-pulse text-white' : 'text-purple-400'}`}>
                {displayPvics}
              </div>
              {phase === 'reveal' && initialPvics !== finalPvics && (
                <div className="text-sm text-purple-300/70 mt-2">
                  {finalPvics - initialPvics >= 0 ? '+' : ''}{finalPvics - initialPvics}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}