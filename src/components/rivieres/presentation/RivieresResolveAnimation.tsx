import { useEffect, useState, useRef } from 'react';
import { Ship, Waves, Skull, CheckCircle, Target, Coins } from 'lucide-react';

interface RivieresResolveAnimationProps {
  danger: number;
  totalMises: number;
  outcome: 'SUCCESS' | 'FAIL';
  niveau: number;
  manche: number;
  onComplete: () => void;
}

export function RivieresResolveAnimation({
  danger,
  totalMises,
  outcome,
  niveau,
  manche,
  onComplete,
}: RivieresResolveAnimationProps) {
  const [phase, setPhase] = useState<'danger' | 'counter' | 'result' | 'done'>('danger');
  const [displayedMises, setDisplayedMises] = useState(0);
  const [boatPosition, setBoatPosition] = useState(0); // 0-100
  const counterRef = useRef<NodeJS.Timeout | null>(null);

  // Phase progression
  useEffect(() => {
    // Phase 1: Show danger (1.5s)
    const dangerTimer = setTimeout(() => setPhase('counter'), 1500);

    // Phase 2: Counter (2.5s with spinning)
    const counterTimer = setTimeout(() => setPhase('result'), 4000);

    // Phase 3: Result animation (3s)
    const resultTimer = setTimeout(() => setPhase('done'), 7000);

    // Complete
    const completeTimer = setTimeout(onComplete, 8000);

    return () => {
      clearTimeout(dangerTimer);
      clearTimeout(counterTimer);
      clearTimeout(resultTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  // Counter spinning effect
  useEffect(() => {
    if (phase === 'counter') {
      let elapsed = 0;
      const duration = 2500;
      const startTime = Date.now();

      counterRef.current = setInterval(() => {
        elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for dramatic effect
        const eased = 1 - Math.pow(1 - progress, 3);
        
        // Random fluctuation that settles to final value
        const fluctuation = progress < 0.8 
          ? Math.floor(Math.random() * totalMises * 1.5)
          : Math.round(totalMises * eased);
        
        setDisplayedMises(fluctuation);

        if (progress >= 1) {
          setDisplayedMises(totalMises);
          if (counterRef.current) clearInterval(counterRef.current);
        }
      }, 50);

      return () => {
        if (counterRef.current) clearInterval(counterRef.current);
      };
    }
  }, [phase, totalMises]);

  // Boat animation on result
  useEffect(() => {
    if (phase === 'result') {
      // Animate boat
      let frame = 0;
      const animate = () => {
        frame++;
        if (outcome === 'SUCCESS') {
          // Boat advances smoothly
          setBoatPosition(Math.min(frame * 2, 100));
        } else {
          // Boat tilts and sinks
          setBoatPosition(Math.min(frame * 1.5, 50));
        }
        if (frame < 60) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);

      // Play sound
      const soundFile = outcome === 'SUCCESS' ? '/sounds/combat-kill.mp3' : '/sounds/foghorn.mp3';
      const audio = new Audio(soundFile);
      audio.volume = 0.5;
      audio.play().catch(() => {});
    }
  }, [phase, outcome]);

  const isSuccess = outcome === 'SUCCESS';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className={`absolute inset-0 transition-all duration-1000 ${
        phase === 'result' 
          ? (isSuccess ? 'bg-gradient-to-br from-green-900/90 via-[#0B1020] to-green-900/90' : 'bg-gradient-to-br from-red-900/90 via-[#0B1020] to-red-900/90')
          : 'bg-gradient-to-br from-[#0B1020] via-[#151B2D] to-[#0B1020]'
      }`} />

      {/* Animated waves */}
      <div className="absolute bottom-0 left-0 right-0 h-1/3 overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={`absolute ${phase === 'result' && !isSuccess ? 'animate-wave-violent' : 'animate-wave'}`}
            style={{
              left: `${i * 10}%`,
              bottom: `${10 + (i % 4) * 8}%`,
              animationDelay: `${i * 0.1}s`,
            }}
          >
            <Waves className={`h-16 w-16 ${isSuccess && phase === 'result' ? 'text-green-500/30' : phase === 'result' ? 'text-red-500/40' : 'text-blue-500/30'}`} />
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center">
        {/* Phase 1: Danger reveal */}
        {phase === 'danger' && (
          <div className="animate-scale-in">
            <div className="flex items-center justify-center gap-4 mb-6">
              <Target className="h-16 w-16 text-red-500 animate-pulse" />
            </div>
            <h1 className="text-5xl font-bold text-red-400 mb-2">DANGER</h1>
            <div className="text-8xl font-bold text-red-500 animate-pulse">
              {danger}
            </div>
            <p className="text-xl text-[#9CA3AF] mt-4">
              Manche {manche} • Niveau {niveau}
            </p>
          </div>
        )}

        {/* Phase 2: Counter spinning */}
        {phase === 'counter' && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-2 gap-16">
              {/* Danger side */}
              <div className="text-center">
                <Target className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h2 className="text-2xl text-red-400 mb-2">DANGER</h2>
                <div className="text-6xl font-bold text-red-500">{danger}</div>
              </div>

              {/* VS */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="text-4xl font-bold text-[#D4AF37]">VS</span>
              </div>

              {/* Mises side */}
              <div className="text-center">
                <Coins className="h-12 w-12 text-[#4ADE80] mx-auto mb-4 animate-spin" />
                <h2 className="text-2xl text-[#4ADE80] mb-2">MISES</h2>
                <div className={`text-6xl font-bold transition-all ${displayedMises >= danger ? 'text-green-400' : 'text-amber-400'}`}>
                  {displayedMises}
                </div>
              </div>
            </div>

            <p className="text-xl text-[#9CA3AF] mt-8 animate-pulse">
              Comptage en cours...
            </p>
          </div>
        )}

        {/* Phase 3: Result with boat animation */}
        {(phase === 'result' || phase === 'done') && (
          <div className="animate-scale-in">
            {/* Comparison */}
            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="text-2xl text-red-400 mb-1">Danger</div>
                <div className="text-5xl font-bold text-red-500">{danger}</div>
              </div>
              <div className="text-3xl text-[#9CA3AF]">{isSuccess ? '≤' : '>'}</div>
              <div className="text-center">
                <div className="text-2xl text-[#4ADE80] mb-1">Mises</div>
                <div className="text-5xl font-bold text-[#4ADE80]">{totalMises}</div>
              </div>
            </div>

            {/* Boat track */}
            <div className="relative h-32 w-full max-w-lg mx-auto mb-8">
              {/* Track */}
              <div className="absolute bottom-8 left-0 right-0 h-2 bg-blue-900/50 rounded-full" />
              
              {/* Boat */}
              <div 
                className={`absolute bottom-6 transition-all duration-1000 ${
                  !isSuccess && phase === 'result' ? 'rotate-45 opacity-50' : ''
                }`}
                style={{ left: `${boatPosition}%`, transform: `translateX(-50%) ${!isSuccess && phase === 'result' ? 'rotate(45deg)' : ''}` }}
              >
                <Ship className={`h-16 w-16 ${isSuccess ? 'text-[#D4AF37]' : 'text-red-500'}`} />
                {!isSuccess && phase === 'result' && (
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                    <Waves className="h-8 w-8 text-blue-400 animate-pulse" />
                  </div>
                )}
              </div>

              {/* Start/End markers */}
              <div className="absolute bottom-6 left-0 text-[#9CA3AF]">N{niveau}</div>
              <div className="absolute bottom-6 right-0 text-[#4ADE80]">N{niveau + 1}</div>
            </div>

            {/* Result message */}
            <div className={`flex items-center justify-center gap-4 ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
              {isSuccess ? (
                <>
                  <CheckCircle className="h-16 w-16 animate-bounce" />
                  <div>
                    <h1 className="text-5xl font-bold">RÉUSSITE !</h1>
                    <p className="text-xl mt-2">Le bateau avance au niveau suivant</p>
                  </div>
                </>
              ) : (
                <>
                  <Skull className="h-16 w-16 animate-pulse" />
                  <div>
                    <h1 className="text-5xl font-bold">CHAVIREMENT !</h1>
                    <p className="text-xl mt-2">Le bateau a coulé...</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
