import { ReactNode } from 'react';

interface LionThemeProps {
  children: ReactNode;
}

export function LionTheme({ children }: LionThemeProps) {
  return (
    <div className="lion-theme min-h-screen bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950">
      <style>{`
        .lion-theme {
          --lion-gold: #D4AF37;
          --lion-amber: #F59E0B;
          --lion-bronze: #CD7F32;
          --lion-dark: #1C1917;
          --lion-mane: #92400E;
        }
        
        .lion-card {
          background: linear-gradient(135deg, var(--lion-gold) 0%, var(--lion-bronze) 100%);
          border: 2px solid var(--lion-amber);
          border-radius: 0.5rem;
          box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
        }
        
        .lion-card-back {
          background: linear-gradient(135deg, #1C1917 0%, #44403C 100%);
          border: 2px solid var(--lion-gold);
        }
        
        .lion-btn-primary {
          background: linear-gradient(135deg, var(--lion-gold) 0%, var(--lion-amber) 100%);
          color: var(--lion-dark);
          font-weight: 600;
        }
        
        .lion-btn-primary:hover {
          background: linear-gradient(135deg, var(--lion-amber) 0%, var(--lion-gold) 100%);
        }
        
        .lion-glow {
          box-shadow: 0 0 20px rgba(212, 175, 55, 0.4);
        }
        
        .lion-text-gold {
          color: var(--lion-gold);
        }
        
        .lion-text-glow {
          text-shadow: 0 0 10px rgba(212, 175, 55, 0.6);
        }
      `}</style>
      {children}
    </div>
  );
}

// Card component for displaying a single card
interface LionCardDisplayProps {
  value: number | null;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function LionCardDisplay({ 
  value, 
  faceDown = false, 
  selected = false, 
  disabled = false,
  onClick,
  size = 'md'
}: LionCardDisplayProps) {
  const sizeClasses = {
    sm: 'w-10 h-14 text-lg',
    md: 'w-14 h-20 text-2xl',
    lg: 'w-20 h-28 text-4xl'
  };

  if (faceDown) {
    return (
      <div 
        className={`
          ${sizeClasses[size]} 
          lion-card-back 
          flex items-center justify-center 
          rounded-lg cursor-default
          ${selected ? 'ring-2 ring-amber-400' : ''}
        `}
      >
        <span className="text-amber-400 text-2xl">🦁</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeClasses[size]}
        lion-card
        flex items-center justify-center
        font-bold text-amber-950
        transition-all duration-200
        ${disabled ? 'opacity-40 cursor-not-allowed grayscale' : 'hover:scale-105 cursor-pointer'}
        ${selected ? 'ring-4 ring-amber-400 scale-110 lion-glow' : ''}
      `}
    >
      {value}
    </button>
  );
}

// Score display component
interface LionScoreDisplayProps {
  playerAName: string;
  playerBName: string;
  scoreA: number;
  scoreB: number;
  activePlayerId?: string;
  playerAId?: string;
}

export function LionScoreDisplay({ 
  playerAName, 
  playerBName, 
  scoreA, 
  scoreB,
  activePlayerId,
  playerAId
}: LionScoreDisplayProps) {
  const isAActive = activePlayerId === playerAId;
  
  return (
    <div className="flex items-center justify-center gap-4 md:gap-8">
      <div className={`text-center ${isAActive ? 'lion-glow rounded-lg p-2' : ''}`}>
        <div className="text-amber-400 font-medium text-sm md:text-base">{playerAName}</div>
        <div className="text-3xl md:text-4xl font-bold lion-text-gold lion-text-glow">{scoreA}</div>
      </div>
      <div className="text-2xl md:text-3xl text-amber-600">vs</div>
      <div className={`text-center ${!isAActive ? 'lion-glow rounded-lg p-2' : ''}`}>
        <div className="text-amber-400 font-medium text-sm md:text-base">{playerBName}</div>
        <div className="text-3xl md:text-4xl font-bold lion-text-gold lion-text-glow">{scoreB}</div>
      </div>
    </div>
  );
}

// Turn indicator
interface LionTurnIndicatorProps {
  currentTurn: number;
  totalTurns: number;
  isSuddenDeath?: boolean;
  suddenPairIndex?: number;
}

export function LionTurnIndicator({ 
  currentTurn, 
  totalTurns, 
  isSuddenDeath = false,
  suddenPairIndex = 0
}: LionTurnIndicatorProps) {
  if (isSuddenDeath) {
    return (
      <div className="text-center">
        <span className="text-amber-500 font-bold text-lg">⚔️ MORT SUBITE</span>
        <span className="text-amber-400 ml-2">
          Tour {currentTurn}/2 (Duo #{suddenPairIndex})
        </span>
      </div>
    );
  }

  return (
    <div className="text-center">
      <span className="text-amber-400 font-medium">Tour</span>
      <span className="text-amber-300 font-bold text-xl mx-2">{currentTurn}</span>
      <span className="text-amber-400 font-medium">/ {totalTurns}</span>
    </div>
  );
}

// Guess buttons
interface LionGuessButtonsProps {
  onGuess: (choice: 'HIGHER' | 'LOWER' | 'EQUAL') => void;
  disabled?: boolean;
  selectedGuess?: 'HIGHER' | 'LOWER' | 'EQUAL' | null;
}

export function LionGuessButtons({ onGuess, disabled, selectedGuess }: LionGuessButtonsProps) {
  return (
    <div className="flex flex-wrap gap-3 justify-center">
      <button
        onClick={() => onGuess('HIGHER')}
        disabled={disabled}
        className={`
          px-5 py-3 rounded-lg text-base font-bold transition-all
          ${selectedGuess === 'HIGHER' 
            ? 'bg-green-600 text-white ring-4 ring-green-400' 
            : 'bg-green-600/20 text-green-400 border-2 border-green-600 hover:bg-green-600/40'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
        `}
      >
        ⬆️ PLUS HAUT
      </button>
      <button
        onClick={() => onGuess('EQUAL')}
        disabled={disabled}
        className={`
          px-5 py-3 rounded-lg text-base font-bold transition-all
          ${selectedGuess === 'EQUAL' 
            ? 'bg-amber-600 text-white ring-4 ring-amber-400' 
            : 'bg-amber-600/20 text-amber-400 border-2 border-amber-600 hover:bg-amber-600/40'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
        `}
      >
        🎯 ÉGAL
      </button>
      <button
        onClick={() => onGuess('LOWER')}
        disabled={disabled}
        className={`
          px-5 py-3 rounded-lg text-base font-bold transition-all
          ${selectedGuess === 'LOWER' 
            ? 'bg-red-600 text-white ring-4 ring-red-400' 
            : 'bg-red-600/20 text-red-400 border-2 border-red-600 hover:bg-red-600/40'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
        `}
      >
        ⬇️ PLUS BAS
      </button>
    </div>
  );
}
