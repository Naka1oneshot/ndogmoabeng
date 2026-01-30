import { ArrowRight, Sparkles, Trophy, SkipForward } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { getGameInfo, DEFAULT_GAME_INFO } from '@/constants/games';

interface GameTransitionAnimationProps {
  fromGameType: string | null;
  toGameType: string | null;
  stepIndex: number; // 1-based index of the next game
  totalSteps: number;
  onComplete?: () => void;
}

export function GameTransitionAnimation({
  fromGameType,
  toGameType,
  stepIndex,
  totalSteps,
  onComplete,
}: GameTransitionAnimationProps) {
  const [phase, setPhase] = useState<'exit' | 'transition' | 'enter'>('exit');
  const [skipped, setSkipped] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const onCompleteRef = useRef(onComplete);

  // Keep onComplete ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Skip handler
  const handleSkip = useCallback(() => {
    if (skipped) return;
    setSkipped(true);
    
    // Clear all timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    
    // Stop audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    // Complete immediately
    onCompleteRef.current?.();
  }, [skipped]);

  // Use centralized game config with automatic fallback
  const fromInfo = getGameInfo(fromGameType);
  const toInfo = getGameInfo(toGameType);
  const FromIcon = fromInfo.icon;
  const ToIcon = toInfo.icon;

  // Play transition sound
  useEffect(() => {
    try {
      audioRef.current = new Audio('/sounds/combat-sword.mp3');
      const stored = localStorage.getItem('gameStartSoundVolume');
      const volume = stored ? parseInt(stored, 10) / 100 : 0.5;
      const muted = localStorage.getItem('gameStartSoundMuted') === 'true';
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
      audioRef.current.play().catch(console.log);
    } catch (err) {
      console.log('Audio not available:', err);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Animate through phases - FAST transitions (total ~2.5s)
  useEffect(() => {
    if (skipped) return;
    
    const exitTimer = setTimeout(() => setPhase('transition'), 600);
    const transitionTimer = setTimeout(() => setPhase('enter'), 1400);
    const completeTimer = setTimeout(() => onCompleteRef.current?.(), 2500);
    
    timersRef.current = [exitTimer, transitionTimer, completeTimer];

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [skipped]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden">
      {/* Progress indicator */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-all duration-500 ${
              i < stepIndex - 1
                ? 'bg-[#D4AF37]'
                : i === stepIndex - 1
                ? 'bg-[#D4AF37] animate-pulse scale-125'
                : 'bg-white/20'
            }`}
          />
        ))}
      </div>

      {/* Exit phase - From game fading out */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-1000 ${
          phase === 'exit' ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
        }`}
      >
        <div className="text-center">
          <div className={`inline-block p-6 rounded-full ${fromInfo.accentBg}/30 mb-4`}>
            <FromIcon className={`h-20 w-20 ${fromInfo.color}`} />
          </div>
          <div className="flex items-center justify-center gap-2 text-white/60">
            <Trophy className="h-5 w-5" />
            <span className="text-lg">Étape {stepIndex - 1} terminée</span>
          </div>
          <h2 className={`text-3xl font-bold ${fromInfo.color} mt-2`}>{fromInfo.name}</h2>
        </div>
      </div>

      {/* Transition phase - Arrow and sparkles */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ${
          phase === 'transition' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-8">
          {/* From icon (small) */}
          <div className={`p-4 rounded-full ${fromInfo.accentBg}/20 animate-pulse`}>
            <FromIcon className={`h-12 w-12 ${fromInfo.color}/50`} />
          </div>

          {/* Arrow with sparkles */}
          <div className="relative">
            <ArrowRight className="h-16 w-16 text-white animate-bounce-x" />
            <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-[#D4AF37] animate-spin-slow" />
            <Sparkles className="absolute -bottom-2 -left-2 h-5 w-5 text-[#D4AF37] animate-spin-slow" style={{ animationDelay: '0.5s' }} />
          </div>

          {/* To icon (small) */}
          <div className={`p-4 rounded-full ${toInfo.accentBg}/20 animate-pulse`}>
            <ToIcon className={`h-12 w-12 ${toInfo.color}/50`} />
          </div>
        </div>

        <div className="absolute bottom-1/3 text-center">
          <p className="text-white/80 text-xl">Prochaine étape...</p>
        </div>
      </div>

      {/* Enter phase - To game appearing */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-1000 ${
          phase === 'enter' ? 'opacity-100 scale-100' : 'opacity-0 scale-125'
        } ${toInfo.bgColor}`}
      >
        <div className="text-center">
          <div className={`inline-block p-8 rounded-full ${toInfo.accentBg}/50 mb-6 animate-game-start-pulse`}>
            <ToIcon className={`h-24 w-24 ${toInfo.color}`} />
          </div>
          <p className="text-white/60 text-lg mb-2">Étape {stepIndex} sur {totalSteps}</p>
          <h2 className={`text-4xl font-bold ${toInfo.color} animate-slide-up-fade`}>
            {toInfo.name}
          </h2>
          <p className="text-white/50 mt-4 animate-slide-up-fade" style={{ animationDelay: '0.3s' }}>
            Préparez-vous...
          </p>
        </div>
      </div>

      {/* Skip button */}
      {!skipped && (
        <Button
          onClick={handleSkip}
          variant="ghost"
          className="absolute bottom-8 right-8 text-white/60 hover:text-white hover:bg-white/10 gap-2"
        >
          <SkipForward className="h-4 w-4" />
          Passer
        </Button>
      )}
    </div>
  );
}
