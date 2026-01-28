import { useEffect, useState, useRef } from 'react';
import { Skull, Syringe, Trophy, Sparkles } from 'lucide-react';
import { INFECTION_COLORS } from '../InfectionTheme';

interface InfectionVictoryTransitionProps {
  winner: 'SY' | 'PV' | 'CV';
  onComplete: () => void;
}

export function InfectionVictoryTransition({ winner, onComplete }: InfectionVictoryTransitionProps) {
  const [countdown, setCountdown] = useState(5);
  const [phase, setPhase] = useState<'announce' | 'countdown' | 'reveal'>('announce');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const handleSkip = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    onCompleteRef.current();
  };

  // Play transition sound
  useEffect(() => {
    try {
      audioRef.current = new Audio('/sounds/foghorn.mp3');
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

  // Phase transitions
  useEffect(() => {
    const announceTimer = setTimeout(() => setPhase('countdown'), 2000);
    timersRef.current.push(announceTimer);
    return () => {};
  }, []);

  // Countdown logic
  useEffect(() => {
    if (phase !== 'countdown') return;

    if (countdown <= 0) {
      setPhase('reveal');
      const t = setTimeout(() => onCompleteRef.current(), 1000);
      timersRef.current.push(t);
      return;
    }

    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    timersRef.current.push(timer);
    return () => {};
  }, [phase, countdown]);

  // Determine winner display
  const getWinnerDisplay = () => {
    if (winner === 'SY') {
      return {
        color: INFECTION_COLORS.teamSY,
        label: 'Les Synthétistes',
        Icon: Syringe,
      };
    } else if (winner === 'CV') {
      return {
        color: '#60A5FA', // Blue for citizens
        label: 'Les Citoyens du Village',
        Icon: Trophy,
      };
    } else {
      return {
        color: INFECTION_COLORS.accent,
        label: 'Les Porte-Venin',
        Icon: Skull,
      };
    }
  };
  
  const { color: winnerColor, label: winnerLabel, Icon: WinnerIcon } = getWinnerDisplay();

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: INFECTION_COLORS.bgPrimary }}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-20 animate-pulse"
            style={{
              backgroundColor: winnerColor,
              width: `${Math.random() * 100 + 50}px`,
              height: `${Math.random() * 100 + 50}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${Math.random() * 2 + 2}s`,
            }}
          />
        ))}
      </div>

      {/* Announce phase */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-1000 ${
          phase === 'announce' ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
        }`}
      >
        <div className="text-center">
          <div 
            className="inline-block p-6 rounded-full mb-6 animate-pulse"
            style={{ backgroundColor: `${INFECTION_COLORS.bgCard}80` }}
          >
            <Trophy className="h-20 w-20" style={{ color: INFECTION_COLORS.accent }} />
          </div>
          <h2 
            className="text-4xl font-bold mb-4"
            style={{ color: INFECTION_COLORS.textPrimary }}
          >
            FIN DE PARTIE
          </h2>
          <p style={{ color: INFECTION_COLORS.textSecondary }} className="text-xl">
            L'issue est scellée...
          </p>
        </div>
      </div>

      {/* Countdown phase */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
          phase === 'countdown' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="text-center">
          {/* Winner icon */}
          <div 
            className="inline-block p-8 rounded-full mb-8 animate-bounce"
            style={{ 
              backgroundColor: `${winnerColor}20`,
              boxShadow: `0 0 60px ${winnerColor}40`,
            }}
          >
            <WinnerIcon className="h-24 w-24" style={{ color: winnerColor }} />
          </div>

          {/* Winner announcement */}
          <h2 
            className="text-3xl font-bold mb-2"
            style={{ color: INFECTION_COLORS.textSecondary }}
          >
            Victoire de
          </h2>
          <h1 
            className="text-5xl font-black mb-8 animate-pulse"
            style={{ color: winnerColor }}
          >
            {winnerLabel}
          </h1>

          {/* Countdown number */}
          <div className="relative">
            <div 
              className="text-9xl font-black transition-all duration-300"
              style={{ 
                color: winnerColor,
                textShadow: `0 0 40px ${winnerColor}80`,
              }}
              key={countdown}
            >
              {countdown}
            </div>
            <Sparkles 
              className="absolute -top-4 -right-8 h-8 w-8 animate-spin" 
              style={{ color: INFECTION_COLORS.textSecondary, animationDuration: '3s' }} 
            />
            <Sparkles 
              className="absolute -bottom-4 -left-8 h-6 w-6 animate-spin" 
              style={{ color: INFECTION_COLORS.textSecondary, animationDuration: '4s' }} 
            />
          </div>

          <p 
            className="text-lg mt-6"
            style={{ color: INFECTION_COLORS.textSecondary }}
          >
            Podium dans...
          </p>
        </div>
      </div>

      {/* Reveal phase - flash before podium */}
      <div
        className={`absolute inset-0 transition-all duration-500 ${
          phase === 'reveal' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: winnerColor }}
      />

      {/* Skip button */}
      <button
        onClick={handleSkip}
        className="absolute bottom-8 right-8 text-sm transition-colors z-10"
        style={{ color: INFECTION_COLORS.textSecondary }}
      >
        Passer →
      </button>
    </div>
  );
}
