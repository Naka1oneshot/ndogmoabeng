import { useState, useEffect } from 'react';
import { Timer, AlertTriangle, Coins, Swords, ShoppingBag, Target } from 'lucide-react';

interface ForetAutoCountdownOverlayProps {
  countdownEndsAt: Date | null;
  countdownType: string | null;
  isHost?: boolean;
}

const COUNTDOWN_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  'BETS': { 
    label: 'Temps restant pour miser', 
    icon: <Coins className="h-6 w-6" /> 
  },
  'COMBAT_SUBMIT': { 
    label: 'Temps restant pour choisir vos actions', 
    icon: <Swords className="h-6 w-6" /> 
  },
  'COMBAT_POSITIONS_WAIT': { 
    label: 'Résolution du combat dans...', 
    icon: <Target className="h-6 w-6" /> 
  },
  'SHOP': { 
    label: 'Temps restant pour le shop', 
    icon: <ShoppingBag className="h-6 w-6" /> 
  },
};

export function ForetAutoCountdownOverlay({ 
  countdownEndsAt, 
  countdownType,
  isHost = false,
}: ForetAutoCountdownOverlayProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!countdownEndsAt || !countdownType) {
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
  }, [countdownEndsAt, countdownType]);

  if (!countdownType || !countdownEndsAt || remainingSeconds <= 0) {
    return null;
  }

  const config = COUNTDOWN_LABELS[countdownType] || { 
    label: 'Temps restant', 
    icon: <Timer className="h-6 w-6" /> 
  };

  // Urgency levels
  const isUrgent = remainingSeconds <= 5;
  const isWarning = remainingSeconds <= 10 && remainingSeconds > 5;

  // Calculate max duration for progress bar
  const maxDuration = countdownType === 'COMBAT_POSITIONS_WAIT' ? 15 : 30;

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
          : 'bg-[#1a2e1a]/95 border-[#4a7c4a]/50'
      }
    `}>
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className={`
          flex items-center justify-center
          w-12 h-12 rounded-full
          ${isUrgent ? 'bg-red-500/30' : isWarning ? 'bg-amber-500/30' : 'bg-[#4a7c4a]/20'}
        `}>
          {isUrgent ? (
            <AlertTriangle className="h-6 w-6 text-red-400 animate-bounce" />
          ) : (
            <span className={isWarning ? 'text-amber-400' : 'text-[#7cb87c]'}>
              {config.icon}
            </span>
          )}
        </div>

        {/* Countdown display */}
        <div className="text-center">
          <p className={`text-xs uppercase tracking-wide ${isUrgent ? 'text-red-300' : isWarning ? 'text-amber-300' : 'text-[#9CA3AF]'}`}>
            {isHost ? `Auto: ${config.label}` : config.label}
          </p>
          <p className={`
            text-3xl font-bold tabular-nums
            ${isUrgent ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-[#7cb87c]'}
          `}>
            {remainingSeconds}s
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-20 h-2 bg-black/30 rounded-full overflow-hidden">
          <div 
            className={`
              h-full transition-all duration-100 ease-linear
              ${isUrgent ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-[#7cb87c]'}
            `}
            style={{ width: `${(remainingSeconds / maxDuration) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
