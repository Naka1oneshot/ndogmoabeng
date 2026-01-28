import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trees, Bug, Waves, Shield, Map } from 'lucide-react';

interface AdventureStep {
  game_type_code: string;
  step_index: number;
}

interface AdventureRevealAnimationProps {
  steps: AdventureStep[];
  onComplete: () => void;
}

const GAME_ICONS: Record<string, { icon: React.ElementType; color: string; name: string }> = {
  FORET: { icon: Trees, color: 'text-green-500', name: 'La Forêt' },
  INFECTION: { icon: Bug, color: 'text-lime-400', name: 'Infection' },
  RIVIERES: { icon: Waves, color: 'text-sky-400', name: 'Les Rivières' },
  SHERIFF: { icon: Shield, color: 'text-amber-500', name: 'Le Shérif' },
};

export function AdventureRevealAnimation({ steps, onComplete }: AdventureRevealAnimationProps) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [showTitle, setShowTitle] = useState(true);

  useEffect(() => {
    // Show title first
    const titleTimer = setTimeout(() => {
      setShowTitle(false);
      setCurrentStep(0);
    }, 800);

    return () => clearTimeout(titleTimer);
  }, []);

  useEffect(() => {
    if (currentStep >= 0 && currentStep < steps.length) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 500);
      return () => clearTimeout(timer);
    } else if (currentStep >= steps.length) {
      const completeTimer = setTimeout(() => {
        onComplete();
      }, 600);
      return () => clearTimeout(completeTimer);
    }
  }, [currentStep, steps.length, onComplete]);

  const sortedSteps = [...steps].sort((a, b) => a.step_index - b.step_index);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-6">
        {/* Title */}
        <AnimatePresence mode="wait">
          {showTitle && (
            <motion.div
              key="title"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex items-center gap-3"
            >
              <Map className="h-10 w-10 text-amber-400" />
              <h2 className="text-3xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
                La carte trouvée
              </h2>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Games sequence */}
        {!showTitle && (
          <div className="flex items-center gap-4">
            {sortedSteps.map((step, index) => {
              const gameInfo = GAME_ICONS[step.game_type_code] || { 
                icon: Map, 
                color: 'text-primary', 
                name: step.game_type_code 
              };
              const Icon = gameInfo.icon;
              const isRevealed = index <= currentStep;
              const isCurrent = index === currentStep;

              return (
                <div key={step.step_index} className="flex items-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0, rotate: -180 }}
                    animate={isRevealed ? { 
                      opacity: 1, 
                      scale: isCurrent ? 1.2 : 1, 
                      rotate: 0 
                    } : {}}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 200, 
                      damping: 15 
                    }}
                    className="flex flex-col items-center gap-2"
                  >
                    <motion.div
                      animate={isCurrent ? { 
                        boxShadow: ['0 0 0px rgba(255,255,255,0)', '0 0 30px rgba(255,255,255,0.5)', '0 0 0px rgba(255,255,255,0)']
                      } : {}}
                      transition={{ duration: 0.5 }}
                      className={`p-4 rounded-full bg-card border-2 border-border ${isCurrent ? 'ring-2 ring-primary ring-offset-2 ring-offset-black' : ''}`}
                    >
                      <Icon className={`h-8 w-8 ${gameInfo.color}`} />
                    </motion.div>
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={isRevealed ? { opacity: 1, y: 0 } : {}}
                      transition={{ delay: 0.1 }}
                      className="text-sm font-medium text-foreground"
                    >
                      {gameInfo.name}
                    </motion.span>
                  </motion.div>
                  
                  {/* Arrow between games */}
                  {index < sortedSteps.length - 1 && (
                    <motion.div
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={index < currentStep ? { opacity: 1, scaleX: 1 } : {}}
                      transition={{ duration: 0.2 }}
                      className="mx-2 text-muted-foreground"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Progress dots */}
        {!showTitle && currentStep >= steps.length && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted-foreground text-sm mt-4"
          >
            Préparez-vous pour l'aventure !
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
