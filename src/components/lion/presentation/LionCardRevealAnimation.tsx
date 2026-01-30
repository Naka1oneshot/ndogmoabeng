import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LionCardDisplay } from '../LionTheme';

interface LionCardRevealAnimationProps {
  show: boolean;
  dealerCard: number;
  activeCard: number;
  guesserChoice: 'HIGHER' | 'LOWER' | 'EQUAL' | null;
  guesserName: string;
  activeName: string;
  difference: number;
  guesserWins: boolean;
  winnerPoints: number;
  onComplete: () => void;
}

export function LionCardRevealAnimation({
  show,
  dealerCard,
  activeCard,
  guesserChoice,
  guesserName,
  activeName,
  difference,
  guesserWins,
  winnerPoints,
  onComplete
}: LionCardRevealAnimationProps) {
  const [phase, setPhase] = useState<'shuffle' | 'reveal' | 'result'>('shuffle');
  const [shuffleValue, setShuffleValue] = useState(0);

  useEffect(() => {
    if (!show) {
      setPhase('shuffle');
      return;
    }

    // Phase shuffle: chiffres aléatoires pendant 2 secondes
    let shuffleInterval: ReturnType<typeof setInterval>;
    let timeout1: ReturnType<typeof setTimeout>;
    let timeout2: ReturnType<typeof setTimeout>;

    setPhase('shuffle');
    shuffleInterval = setInterval(() => {
      setShuffleValue(Math.floor(Math.random() * 11));
    }, 80);

    // Après 2s, on révèle
    timeout1 = setTimeout(() => {
      clearInterval(shuffleInterval);
      setShuffleValue(activeCard);
      setPhase('reveal');
    }, 2000);

    // Après 1s de plus, on montre le résultat
    timeout2 = setTimeout(() => {
      setPhase('result');
    }, 3500);

    return () => {
      clearInterval(shuffleInterval);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, [show, activeCard]);

  // Auto-complete after result shown
  useEffect(() => {
    if (phase === 'result' && show) {
      const timeout = setTimeout(onComplete, 3000);
      return () => clearTimeout(timeout);
    }
  }, [phase, show, onComplete]);

  if (!show) return null;

  const winnerName = guesserWins ? guesserName : activeName;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
    >
      <div className="text-center">
        {/* Title */}
        <motion.h2
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-3xl md:text-4xl font-bold text-amber-300 mb-8"
        >
          🃏 Révélation de la carte...
        </motion.h2>

        {/* Cards */}
        <div className="flex items-center justify-center gap-8 md:gap-16 mb-8">
          {/* Dealer Card */}
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="text-center"
          >
            <p className="text-amber-400 mb-3 text-lg">Croupier</p>
            <LionCardDisplay value={dealerCard} size="lg" />
          </motion.div>

          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="text-4xl text-amber-500"
          >
            VS
          </motion.div>

          {/* Active Card - Shuffling then Reveal */}
          <motion.div className="text-center">
            <p className="text-amber-400 mb-3 text-lg">Carte Jouée</p>
            <AnimatePresence mode="wait">
              {phase === 'shuffle' ? (
                <motion.div
                  key="shuffling"
                  animate={{ 
                    rotateY: [0, 180, 360],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ duration: 0.3, repeat: Infinity }}
                >
                  <div className="w-20 h-28 lion-card flex items-center justify-center font-bold text-4xl text-amber-950">
                    {shuffleValue}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="revealed"
                  initial={{ rotateY: 180, scale: 0.5 }}
                  animate={{ rotateY: 0, scale: 1 }}
                  transition={{ duration: 0.6, type: 'spring' }}
                >
                  <LionCardDisplay value={activeCard} size="lg" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Guess Info */}
        {guesserChoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-6"
          >
            <p className="text-amber-400 text-lg">{guesserName} avait parié :</p>
            <p className={`text-2xl font-bold ${
              guesserChoice === 'HIGHER' ? 'text-green-400' : guesserChoice === 'LOWER' ? 'text-red-400' : 'text-amber-400'
            }`}>
              {guesserChoice === 'HIGHER' ? '⬆️ PLUS HAUT' : guesserChoice === 'LOWER' ? '⬇️ PLUS BAS' : '🎯 ÉGAL'}
            </p>
          </motion.div>
        )}

        {/* Result */}
        <AnimatePresence>
          {phase === 'result' && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 10 }}
              className="p-6 bg-amber-900/80 rounded-xl border-2 border-amber-500 lion-glow"
            >
              <p className="text-2xl text-amber-200 mb-2">
                Différence : <span className="font-bold text-amber-300 text-3xl">{difference}</span>
              </p>
              {winnerPoints === 0 ? (
                <p className="text-xl text-amber-400">Aucun point ce tour !</p>
              ) : (
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className={`text-3xl font-bold mt-2 ${
                    guesserWins ? 'text-green-400' : 'text-amber-400'
                  }`}
                >
                  🏆 {winnerName} +{winnerPoints} PVic !
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
