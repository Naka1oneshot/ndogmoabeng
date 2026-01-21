import { useEffect, useState } from 'react';
import { Skull } from 'lucide-react';
import { getMonsterImage } from '@/lib/monsterImages';

interface MonsterReplacementInfo {
  deadMonsterId: number;
  deadMonsterName: string;
  replacementMonsterId: number;
  replacementMonsterName: string;
  slot: number;
}

interface MonsterReplacementAnimationProps {
  show: boolean;
  info: MonsterReplacementInfo | null;
}

export function MonsterReplacementAnimation({ show, info }: MonsterReplacementAnimationProps) {
  const [animationPhase, setAnimationPhase] = useState<'dying' | 'moving' | 'placed'>('dying');

  useEffect(() => {
    if (show && info) {
      // Reset to dying phase
      setAnimationPhase('dying');
      
      // After dying animation (1s), start moving phase
      const moveTimer = setTimeout(() => {
        setAnimationPhase('moving');
      }, 1000);
      
      // After moving animation (1.2s), set to placed
      const placedTimer = setTimeout(() => {
        setAnimationPhase('placed');
      }, 2200);
      
      return () => {
        clearTimeout(moveTimer);
        clearTimeout(placedTimer);
      };
    }
  }, [show, info]);

  if (!show || !info) return null;

  const deadMonsterImage = getMonsterImage(info.deadMonsterId);
  const replacementMonsterImage = getMonsterImage(info.replacementMonsterId);

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center pointer-events-none">
      {/* Dark overlay */}
      <div 
        className="absolute inset-0 bg-background/70"
        style={{
          animation: 'fadeInOut 3.5s ease-in-out',
        }}
      />
      
      {/* Animation container */}
      <div className="relative w-full max-w-4xl h-96 flex items-center justify-center">
        
        {/* Dead monster fading out */}
        {animationPhase === 'dying' && (
          <div 
            className="absolute flex flex-col items-center"
            style={{
              animation: 'monsterDeath 1s ease-out forwards',
            }}
          >
            <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-xl overflow-hidden border-4 border-destructive shadow-2xl">
              {deadMonsterImage ? (
                <img 
                  src={deadMonsterImage} 
                  alt={info.deadMonsterName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-secondary flex items-center justify-center text-4xl">🐉</div>
              )}
              <div 
                className="absolute inset-0 bg-destructive/80 flex items-center justify-center"
                style={{
                  animation: 'deathOverlay 1s ease-out forwards',
                }}
              >
                <Skull className="w-16 h-16 md:w-24 md:h-24 text-white animate-pulse" />
              </div>
            </div>
            <p className="mt-4 text-xl md:text-2xl font-bold text-destructive">{info.deadMonsterName}</p>
            <p className="text-muted-foreground">Vaincu !</p>
          </div>
        )}

        {/* Replacement monster moving in */}
        {(animationPhase === 'moving' || animationPhase === 'placed') && (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Starting position indicator (queue) */}
            <div 
              className="absolute left-4 md:left-8 opacity-30 text-center"
              style={{
                animation: animationPhase === 'moving' ? 'queueFadeOut 0.5s ease-out forwards' : 'none',
              }}
            >
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-lg border-2 border-dashed border-amber-500/50 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">File d'attente</span>
              </div>
            </div>

            {/* Moving monster */}
            <div 
              className="flex flex-col items-center"
              style={{
                animation: animationPhase === 'moving' 
                  ? 'monsterSlideIn 1.2s ease-out forwards' 
                  : 'none',
                transform: animationPhase === 'placed' ? 'translateX(0) scale(1)' : undefined,
              }}
            >
              <div 
                className="relative w-32 h-32 md:w-48 md:h-48 rounded-xl overflow-hidden border-4 border-primary shadow-2xl"
                style={{
                  boxShadow: animationPhase === 'placed' 
                    ? '0 0 40px hsl(var(--primary) / 0.5)' 
                    : '0 0 20px hsl(var(--primary) / 0.3)',
                }}
              >
                {replacementMonsterImage ? (
                  <img 
                    src={replacementMonsterImage} 
                    alt={info.replacementMonsterName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center text-4xl">🐉</div>
                )}
                
                {/* Glow effect when placed */}
                {animationPhase === 'placed' && (
                  <div 
                    className="absolute inset-0 bg-primary/20"
                    style={{
                      animation: 'glowPulse 0.5s ease-out',
                    }}
                  />
                )}
              </div>
              <p className="mt-4 text-xl md:text-2xl font-bold text-primary">{info.replacementMonsterName}</p>
              <p className="text-muted-foreground">
                {animationPhase === 'moving' ? 'En approche...' : `Slot ${info.slot} - Prêt au combat !`}
              </p>
            </div>

            {/* Target position indicator (battlefield) */}
            <div 
              className="absolute right-4 md:right-8 opacity-30 text-center"
              style={{
                animation: animationPhase === 'placed' ? 'targetGlow 0.5s ease-out' : 'none',
              }}
            >
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-lg border-2 border-dashed border-primary/50 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">Slot {info.slot}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        @keyframes monsterDeath {
          0% { 
            opacity: 1; 
            transform: scale(1) rotate(0deg); 
          }
          30% { 
            transform: scale(1.1) rotate(-5deg); 
          }
          100% { 
            opacity: 0; 
            transform: scale(0.5) rotate(10deg) translateY(50px); 
          }
        }
        
        @keyframes deathOverlay {
          0% { opacity: 0; }
          50% { opacity: 0.9; }
          100% { opacity: 0.8; }
        }
        
        @keyframes monsterSlideIn {
          0% { 
            transform: translateX(-200px) scale(0.6); 
            opacity: 0.5;
          }
          50% {
            transform: translateX(-50px) scale(0.9);
            opacity: 0.8;
          }
          100% { 
            transform: translateX(0) scale(1); 
            opacity: 1;
          }
        }
        
        @keyframes queueFadeOut {
          0% { opacity: 0.3; }
          100% { opacity: 0; }
        }
        
        @keyframes glowPulse {
          0% { opacity: 0.5; }
          50% { opacity: 0.8; }
          100% { opacity: 0; }
        }
        
        @keyframes targetGlow {
          0% { opacity: 0.3; border-color: hsl(var(--primary)); }
          50% { opacity: 0.6; }
          100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

export type { MonsterReplacementInfo };
