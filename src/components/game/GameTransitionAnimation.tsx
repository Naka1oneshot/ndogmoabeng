import { ArrowRight, Ship, Trees, Syringe, Sparkles, Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface GameTransitionAnimationProps {
  fromGameType: 'FORET' | 'RIVIERES' | 'INFECTION';
  toGameType: 'FORET' | 'RIVIERES' | 'INFECTION';
  stepIndex: number; // 1-based index of the next game
  totalSteps: number;
  onComplete?: () => void;
}

const GAME_INFO = {
  FORET: {
    name: 'La Forêt',
    icon: Trees,
    color: 'text-[#4ADE80]',
    bgColor: 'bg-[#1a2f1a]',
    accentBg: 'bg-[#2d4a2d]',
  },
  RIVIERES: {
    name: 'Les Rivières',
    icon: Ship,
    color: 'text-[#D4AF37]',
    bgColor: 'bg-[#0B1020]',
    accentBg: 'bg-[#1B4D3E]',
  },
  INFECTION: {
    name: 'Infection',
    icon: Syringe,
    color: 'text-[#B00020]',
    bgColor: 'bg-[#0B0E14]',
    accentBg: 'bg-[#1A2235]',
  },
};

export function GameTransitionAnimation({
  fromGameType,
  toGameType,
  stepIndex,
  totalSteps,
  onComplete,
}: GameTransitionAnimationProps) {
  const [phase, setPhase] = useState<'exit' | 'transition' | 'enter'>('exit');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fromInfo = GAME_INFO[fromGameType];
  const toInfo = GAME_INFO[toGameType];
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

  // Animate through phases
  useEffect(() => {
    const exitTimer = setTimeout(() => setPhase('transition'), 1000);
    const transitionTimer = setTimeout(() => setPhase('enter'), 2500);
    const completeTimer = setTimeout(() => onComplete?.(), 4000);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(transitionTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

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
    </div>
  );
}
