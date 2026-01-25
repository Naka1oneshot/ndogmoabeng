import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Users, AlertTriangle } from 'lucide-react';
import { INFECTION_COLORS } from '../InfectionTheme';

interface InfectionRoundStartAnimationProps {
  show: boolean;
  manche: number;
  onComplete: () => void;
}

const DEBATE_PHRASES = [
  "Qui semble suspect ? Débattez pour démasquer les Porteurs !",
  "Observez, questionnez, accusez... Le virus se cache parmi vous !",
  "La parole est votre arme. Trouvez les infectés avant qu'il ne soit trop tard !",
  "Méfiez-vous des silencieux... et des trop bavards !",
  "Chaque vote compte. Éliminez la menace ou protégez les innocents ?",
  "Les Scientifiques cherchent l'antidote. Les PV cherchent à survivre. Et vous ?",
];

export function InfectionRoundStartAnimation({ show, manche, onComplete }: InfectionRoundStartAnimationProps) {
  const [phase, setPhase] = useState<'title' | 'debate' | 'fade'>('title');
  const [debatePhrase] = useState(() => 
    DEBATE_PHRASES[Math.floor(Math.random() * DEBATE_PHRASES.length)]
  );

  useEffect(() => {
    if (!show) {
      setPhase('title');
      return;
    }

    // Phase 1: Title (1.5s)
    const titleTimer = setTimeout(() => setPhase('debate'), 1500);
    
    // Phase 2: Debate message (2.5s more)
    const debateTimer = setTimeout(() => setPhase('fade'), 4000);
    
    // Phase 3: Fade out and complete (0.5s more)
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 4500);

    return () => {
      clearTimeout(titleTimer);
      clearTimeout(debateTimer);
      clearTimeout(completeTimer);
    };
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
        >
          {/* Animated background glow */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              background: `radial-gradient(circle at center, ${INFECTION_COLORS.accent}20 0%, transparent 70%)`,
            }}
          />

          <div className="text-center relative z-10 px-4">
            {/* Round number with dramatic entrance */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 100 }}
              className="mb-6"
            >
              <div 
                className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4"
                style={{ 
                  borderColor: INFECTION_COLORS.accent,
                  backgroundColor: `${INFECTION_COLORS.accent}20`,
                }}
              >
                <span 
                  className="text-5xl font-bold"
                  style={{ color: INFECTION_COLORS.accent }}
                >
                  {manche}
                </span>
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-4xl sm:text-5xl font-bold mb-4"
              style={{ color: INFECTION_COLORS.textPrimary }}
            >
              Début de Manche
            </motion.h1>

            {/* Subtitle with warning icon */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="flex items-center justify-center gap-2 mb-8"
            >
              <AlertTriangle className="h-5 w-5" style={{ color: INFECTION_COLORS.warning }} />
              <span className="text-lg" style={{ color: INFECTION_COLORS.textSecondary }}>
                Le virus continue de se propager...
              </span>
            </motion.div>

            {/* Debate prompt - appears in phase 2 */}
            <AnimatePresence>
              {(phase === 'debate' || phase === 'fade') && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className="max-w-lg mx-auto"
                >
                  <div 
                    className="p-6 rounded-xl border-2"
                    style={{ 
                      backgroundColor: INFECTION_COLORS.bgCard,
                      borderColor: INFECTION_COLORS.border,
                    }}
                  >
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <MessageCircle className="h-6 w-6" style={{ color: INFECTION_COLORS.accent }} />
                      <Users className="h-6 w-6" style={{ color: INFECTION_COLORS.accent }} />
                    </div>
                    <p 
                      className="text-xl font-medium leading-relaxed"
                      style={{ color: INFECTION_COLORS.textPrimary }}
                    >
                      {debatePhrase}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pulsing dots indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="flex items-center justify-center gap-2 mt-8"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: INFECTION_COLORS.accent }}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ 
                    duration: 1, 
                    repeat: Infinity, 
                    delay: i * 0.2,
                  }}
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
