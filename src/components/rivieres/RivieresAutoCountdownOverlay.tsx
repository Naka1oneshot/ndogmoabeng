import { useState, useEffect } from 'react';
import { Timer, AlertTriangle } from 'lucide-react';

interface RivieresAutoCountdownOverlayProps {
  countdownEndsAt: Date | null;
  isActive: boolean;
  isHost?: boolean;
}

export function RivieresAutoCountdownOverlay({ 
  countdownEndsAt, 
  isActive,
  isHost = false,
}: RivieresAutoCountdownOverlayProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!isActive || !countdownEndsAt) {
      setRemainingSeconds(0);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const endsAt = countdownEndsAt.getTime();
      const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
      setRemainingSeconds(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);

    return () => clearInterval(interval);
  }, [isActive, countdownEndsAt]);

  if (!isActive || remainingSeconds <= 0) {
    return null;
  }

  // Urgency levels
  const isUrgent = remainingSeconds <= 5;
  const isWarning = remainingSeconds <= 10 && remainingSeconds > 5;

  return (
    <div className={`
      fixed bottom-4 left-1/2 -translate-x-1/2 z-40
      px-6 py-3 rounded-xl
      border-2 shadow-2xl
      transition-all duration-300
      ${isUrgent 
        ? 'bg-red-900/95 border-red-500 animate-pulse' 
        : isWarning 
          ? 'bg-amber-900/95 border-amber-500' 
          : 'bg-[#151B2D]/95 border-[#D4AF37]/50'
      }
    `}>
      <div className="flex items-center gap-4">
        {/* Timer icon */}
        <div className={`
          flex items-center justify-center
          w-12 h-12 rounded-full
          ${isUrgent ? 'bg-red-500/30' : isWarning ? 'bg-amber-500/30' : 'bg-[#D4AF37]/20'}
        `}>
          {isUrgent ? (
            <AlertTriangle className="h-6 w-6 text-red-400 animate-bounce" />
          ) : (
            <Timer className={`h-6 w-6 ${isWarning ? 'text-amber-400' : 'text-[#D4AF37]'}`} />
          )}
        </div>

        {/* Countdown display */}
        <div className="text-center">
          <p className={`text-xs uppercase tracking-wide ${isUrgent ? 'text-red-300' : isWarning ? 'text-amber-300' : 'text-[#9CA3AF]'}`}>
            {isHost ? 'Verrouillage automatique' : 'Temps restant'}
          </p>
          <p className={`
            text-3xl font-bold tabular-nums
            ${isUrgent ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-[#D4AF37]'}
          `}>
            {remainingSeconds}s
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-20 h-2 bg-black/30 rounded-full overflow-hidden">
          <div 
            className={`
              h-full transition-all duration-100 ease-linear
              ${isUrgent ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-[#D4AF37]'}
            `}
            style={{ width: `${(remainingSeconds / 15) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
