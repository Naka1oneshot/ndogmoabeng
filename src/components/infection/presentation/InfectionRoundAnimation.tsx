import { useEffect, useState } from 'react';
import { Skull, Heart, AlertTriangle, Sparkles } from 'lucide-react';
import { INFECTION_COLORS } from '../InfectionTheme';

interface InfectionRoundAnimationProps {
  show: boolean;
  deathCount: number;
  onComplete: () => void;
}

export function InfectionRoundAnimation({ show, deathCount, onComplete }: InfectionRoundAnimationProps) {
  const [phase, setPhase] = useState<'entering' | 'main' | 'exiting' | 'hidden'>('hidden');
  const [bloodDrops, setBloodDrops] = useState<{ id: number; x: number; delay: number }[]>([]);

  useEffect(() => {
    if (show) {
      setPhase('entering');
      
      // Generate blood drops for dramatic effect
      if (deathCount > 0) {
        const drops = Array.from({ length: deathCount * 5 }, (_, i) => ({
          id: i,
          x: Math.random() * 100,
          delay: Math.random() * 2
        }));
        setBloodDrops(drops);
      }

      // Animation timeline - faster exit
      const enterTimer = setTimeout(() => setPhase('main'), 200);
      const mainTimer = setTimeout(() => setPhase('exiting'), deathCount > 0 ? 2000 : 1500);
      const exitTimer = setTimeout(() => {
        setPhase('hidden');
        onComplete();
      }, deathCount > 0 ? 2300 : 1800);

      return () => {
        clearTimeout(enterTimer);
        clearTimeout(mainTimer);
        clearTimeout(exitTimer);
      };
    } else {
      setPhase('hidden');
    }
  }, [show, deathCount, onComplete]);

  if (phase === 'hidden') return null;

  // Different animations based on death count
  const renderContent = () => {
    if (deathCount === 0) {
      // 0 deaths - Peaceful, hopeful
      return (
        <div className="text-center animate-scale-in">
          <div className="relative inline-block">
            <Sparkles 
              className="h-20 w-20 sm:h-28 sm:w-28 mx-auto mb-6 animate-pulse" 
              style={{ color: INFECTION_COLORS.success }}
            />
            <Heart 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 sm:h-14 sm:w-14 animate-pulse" 
              style={{ color: INFECTION_COLORS.accent, animationDelay: '0.3s' }}
            />
          </div>
          <h1 
            className="text-4xl sm:text-6xl font-bold mb-4"
            style={{ color: INFECTION_COLORS.success, textShadow: `0 0 20px ${INFECTION_COLORS.success}60` }}
          >
            AUCUNE VICTIME
          </h1>
          <p className="text-xl sm:text-2xl" style={{ color: INFECTION_COLORS.textSecondary }}>
            Le village respire... pour l'instant
          </p>
        </div>
      );
    }

    if (deathCount === 1) {
      // 1 death - Somber, single loss
      return (
        <div className="text-center animate-scale-in">
          <div className="relative inline-block">
            <Skull 
              className="h-24 w-24 sm:h-32 sm:w-32 mx-auto mb-6" 
              style={{ color: INFECTION_COLORS.danger }}
            />
            <div 
              className="absolute inset-0 animate-ping opacity-30"
              style={{ backgroundColor: INFECTION_COLORS.danger }}
            />
          </div>
          <h1 
            className="text-4xl sm:text-6xl font-bold mb-4 animate-pulse"
            style={{ color: INFECTION_COLORS.danger, textShadow: `0 0 30px ${INFECTION_COLORS.danger}80` }}
          >
            UNE VICTIME
          </h1>
          <p className="text-xl sm:text-2xl mb-2" style={{ color: INFECTION_COLORS.textSecondary }}>
            Le virus a frappé...
          </p>
          <p className="text-lg" style={{ color: INFECTION_COLORS.textMuted }}>
            Un membre du village n'est plus
          </p>
        </div>
      );
    }

    // Multiple deaths - Dramatic, chaotic
    return (
      <div className="text-center animate-scale-in relative">
        {/* Blood rain effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {bloodDrops.map((drop) => (
            <div
              key={drop.id}
              className="absolute w-1 h-8 rounded-full animate-fade-in"
              style={{
                left: `${drop.x}%`,
                top: '-20px',
                backgroundColor: INFECTION_COLORS.danger,
                animation: `fall 2s linear ${drop.delay}s forwards`,
                opacity: 0.6
              }}
            />
          ))}
        </div>

        <div className="relative z-10">
          <div className="relative inline-block mb-6">
            <AlertTriangle 
              className="h-20 w-20 sm:h-28 sm:w-28 mx-auto animate-pulse" 
              style={{ color: INFECTION_COLORS.danger }}
            />
            <Skull 
              className="absolute -right-4 -top-2 h-10 w-10 sm:h-12 sm:w-12 animate-bounce" 
              style={{ color: INFECTION_COLORS.danger }}
            />
            <Skull 
              className="absolute -left-4 -top-2 h-10 w-10 sm:h-12 sm:w-12 animate-bounce" 
              style={{ color: INFECTION_COLORS.danger, animationDelay: '0.2s' }}
            />
          </div>
          
          <h1 
            className="text-5xl sm:text-7xl font-bold mb-4"
            style={{ 
              color: INFECTION_COLORS.danger, 
              textShadow: `0 0 40px ${INFECTION_COLORS.danger}, 0 0 80px ${INFECTION_COLORS.danger}60` 
            }}
          >
            HÉCATOMBE
          </h1>
          
          <div 
            className="text-6xl sm:text-8xl font-bold mb-4 animate-pulse"
            style={{ color: INFECTION_COLORS.textPrimary }}
          >
            {deathCount}
          </div>
          
          <p 
            className="text-2xl sm:text-3xl mb-2"
            style={{ color: INFECTION_COLORS.danger }}
          >
            VICTIMES
          </p>
          
          <p className="text-lg" style={{ color: INFECTION_COLORS.textMuted }}>
            Le virus se répand sans pitié...
          </p>
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-500 ${
        phase === 'entering' ? 'opacity-0 scale-95' :
        phase === 'main' ? 'opacity-100 scale-100' :
        phase === 'exiting' ? 'opacity-0 scale-105' : ''
      }`}
      style={{ 
        backgroundColor: deathCount > 1 ? `${INFECTION_COLORS.bgPrimary}F0` : `${INFECTION_COLORS.bgPrimary}E0`
      }}
    >
      {/* Screen shake effect for multiple deaths */}
      <style>
        {`
          @keyframes fall {
            0% { transform: translateY(0); opacity: 0; }
            10% { opacity: 0.6; }
            100% { transform: translateY(100vh); opacity: 0; }
          }
          
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
          }
        `}
      </style>

      <div 
        className={deathCount > 1 ? 'animate-[shake_0.5s_ease-in-out_2]' : ''}
      >
        {renderContent()}
      </div>
    </div>
  );
}
