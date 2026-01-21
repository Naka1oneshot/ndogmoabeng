import { useEffect, useState } from 'react';
import { Skull } from 'lucide-react';
import { getMonsterImage } from '@/lib/monsterImages';
import emptySlotRip from '@/assets/monsters/empty-slot-rip.png';

interface EmptySlotInfo {
  deadMonsterId: number;
  deadMonsterName: string;
  slot: number;
}

interface EmptySlotAnimationProps {
  show: boolean;
  info: EmptySlotInfo | null;
  onComplete?: () => void;
}

export function EmptySlotAnimation({ show, info, onComplete }: EmptySlotAnimationProps) {
  const [animationPhase, setAnimationPhase] = useState<'dying' | 'empty' | 'rip'>('dying');

  useEffect(() => {
    if (show && info) {
      // Reset to dying phase
      setAnimationPhase('dying');
      
      // After dying animation (1s), show empty phase
      const emptyTimer = setTimeout(() => {
        setAnimationPhase('empty');
      }, 1000);
      
      // After empty message (1s), show RIP image
      const ripTimer = setTimeout(() => {
        setAnimationPhase('rip');
      }, 2000);
      
      // Complete after RIP display (1.5s)
      const completeTimer = setTimeout(() => {
        onComplete?.();
      }, 3500);
      
      return () => {
        clearTimeout(emptyTimer);
        clearTimeout(ripTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [show, info, onComplete]);

  if (!show || !info) return null;

  const deadMonsterImage = getMonsterImage(info.deadMonsterId);

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center pointer-events-none">
      {/* Dark overlay */}
      <div 
        className="absolute inset-0 bg-background/80"
        style={{
          animation: 'emptySlotFadeInOut 4s ease-in-out',
        }}
      />
      
      {/* Animation container */}
      <div className="relative w-full max-w-4xl h-96 flex items-center justify-center">
        
        {/* Dead monster fading out */}
        {animationPhase === 'dying' && (
          <div 
            className="absolute flex flex-col items-center"
            style={{
              animation: 'monsterDeathEmpty 1s ease-out forwards',
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
                  animation: 'deathOverlayEmpty 1s ease-out forwards',
                }}
              >
                <Skull className="w-16 h-16 md:w-24 md:h-24 text-white animate-pulse" />
              </div>
            </div>
            <p className="mt-4 text-xl md:text-2xl font-bold text-destructive">{info.deadMonsterName}</p>
            <p className="text-muted-foreground">Vaincu !</p>
          </div>
        )}

        {/* Empty slot message */}
        {animationPhase === 'empty' && (
          <div 
            className="flex flex-col items-center"
            style={{
              animation: 'emptyMessageAppear 1s ease-out forwards',
            }}
          >
            <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-xl border-4 border-dashed border-muted-foreground/50 flex items-center justify-center bg-muted/30">
              <div className="text-center">
                <Skull className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">Aucun monstre</p>
                <p className="text-xs text-muted-foreground">en file d'attente</p>
              </div>
            </div>
            <p className="mt-4 text-xl md:text-2xl font-bold text-muted-foreground">Slot {info.slot}</p>
            <p className="text-amber-400">La forêt se vide...</p>
          </div>
        )}

        {/* RIP image for empty slot */}
        {animationPhase === 'rip' && (
          <div 
            className="flex flex-col items-center"
            style={{
              animation: 'ripImageAppear 1.5s ease-out forwards',
            }}
          >
            <div 
              className="relative w-40 h-56 md:w-56 md:h-80 rounded-xl overflow-hidden shadow-2xl"
              style={{
                boxShadow: '0 0 60px rgba(34, 197, 94, 0.3), 0 0 120px rgba(34, 197, 94, 0.1)',
              }}
            >
              <img 
                src={emptySlotRip} 
                alt="Slot vide - RIP"
                className="w-full h-full object-cover"
              />
              <div 
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.3) 100%)',
                }}
              />
            </div>
            <p className="mt-4 text-xl md:text-2xl font-bold text-green-400/80">Slot {info.slot} - Vide</p>
            <p className="text-muted-foreground text-sm">Plus de créatures sur ce front</p>
          </div>
        )}
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes emptySlotFadeInOut {
          0% { opacity: 0; }
          8% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        @keyframes monsterDeathEmpty {
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
        
        @keyframes deathOverlayEmpty {
          0% { opacity: 0; }
          50% { opacity: 0.9; }
          100% { opacity: 0.8; }
        }
        
        @keyframes emptyMessageAppear {
          0% { 
            opacity: 0; 
            transform: scale(0.8); 
          }
          100% { 
            opacity: 1; 
            transform: scale(1); 
          }
        }
        
        @keyframes ripImageAppear {
          0% { 
            opacity: 0; 
            transform: scale(0.7) translateY(20px); 
          }
          50% {
            opacity: 1;
            transform: scale(1.05) translateY(-5px);
          }
          100% { 
            opacity: 1; 
            transform: scale(1) translateY(0); 
          }
        }
      `}</style>
    </div>
  );
}

export type { EmptySlotInfo };
