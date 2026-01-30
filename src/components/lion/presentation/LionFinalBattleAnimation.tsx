import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LionPlayerAvatar } from './LionPlayerAvatar';
import { Trophy, Swords } from 'lucide-react';
import confetti from 'canvas-confetti';
interface Player {
  name: string;
  avatarUrl?: string | null;
  score: number;
}

interface LionFinalBattleAnimationProps {
  show: boolean;
  playerA: Player;
  playerB: Player;
  winnerId: 'A' | 'B';
  onComplete?: () => void;
}

export function LionFinalBattleAnimation({
  show,
  playerA,
  playerB,
  winnerId,
  onComplete
}: LionFinalBattleAnimationProps) {
  const [phase, setPhase] = useState<'battle' | 'victory'>('battle');

  const fireConfetti = useCallback(() => {
    // Left side burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.2, y: 0.6 },
      colors: ['#f59e0b', '#fbbf24', '#fcd34d', '#fef3c7'],
    });
    // Right side burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.8, y: 0.6 },
      colors: ['#f59e0b', '#fbbf24', '#fcd34d', '#fef3c7'],
    });
    // Center burst
    setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#f59e0b', '#fbbf24', '#fcd34d', '#d97706'],
      });
    }, 300);
  }, []);

  useEffect(() => {
    if (!show) {
      setPhase('battle');
      return;
    }

    // Phase battle: 3s
    const timeout = setTimeout(() => {
      setPhase('victory');
    }, 3000);

    return () => clearTimeout(timeout);
  }, [show]);

  useEffect(() => {
    if (phase === 'victory') {
      // Fire confetti when victory phase starts
      fireConfetti();
      // Fire again after a short delay for extra celebration
      const timeout1 = setTimeout(fireConfetti, 1500);
      const timeout2 = setTimeout(fireConfetti, 3000);
      
      if (onComplete) {
        const completeTimeout = setTimeout(onComplete, 5000);
        return () => {
          clearTimeout(timeout1);
          clearTimeout(timeout2);
          clearTimeout(completeTimeout);
        };
      }
      return () => {
        clearTimeout(timeout1);
        clearTimeout(timeout2);
      };
    }
  }, [phase, onComplete, fireConfetti]);

  if (!show) return null;

  const winner = winnerId === 'A' ? playerA : playerB;
  const loser = winnerId === 'A' ? playerB : playerA;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
    >
      <AnimatePresence mode="wait">
        {phase === 'battle' ? (
          <motion.div
            key="battle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <motion.h2
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="text-4xl font-bold text-amber-300 mb-12"
            >
              ⚔️ DUEL FINAL ⚔️
            </motion.h2>

            <div className="flex items-center justify-center gap-8 md:gap-16">
              {/* Player A */}
              <motion.div
                animate={{ 
                  x: [0, 30, 0],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-center"
              >
                <LionPlayerAvatar 
                  name={playerA.name} 
                  avatarUrl={playerA.avatarUrl} 
                  size="xl" 
                  className="mx-auto mb-4"
                />
                <p className="text-xl font-bold text-amber-200">{playerA.name}</p>
                <p className="text-2xl font-bold text-amber-400">{playerA.score} PVic</p>
              </motion.div>

              {/* VS */}
              <motion.div
                animate={{ 
                  scale: [1, 1.3, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ duration: 0.3, repeat: Infinity }}
              >
                <Swords className="h-16 w-16 text-amber-500" />
              </motion.div>

              {/* Player B */}
              <motion.div
                animate={{ 
                  x: [0, -30, 0],
                  rotate: [0, -5, 5, 0]
                }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-center"
              >
                <LionPlayerAvatar 
                  name={playerB.name} 
                  avatarUrl={playerB.avatarUrl} 
                  size="xl" 
                  className="mx-auto mb-4"
                />
                <p className="text-xl font-bold text-amber-200">{playerB.name}</p>
                <p className="text-2xl font-bold text-amber-400">{playerB.score} PVic</p>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="victory"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 10 }}
            className="text-center"
          >
            {/* Trophy */}
            <motion.div
              animate={{ 
                y: [0, -10, 0],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="mb-8"
            >
              <Trophy className="h-32 w-32 text-amber-400 mx-auto" />
            </motion.div>

            {/* Winner */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <LionPlayerAvatar 
                name={winner.name} 
                avatarUrl={winner.avatarUrl} 
                size="xl" 
                className="mx-auto mb-4 ring-4 ring-amber-400"
              />
              <motion.h1
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-4xl md:text-5xl font-bold text-amber-300 lion-text-glow mb-4"
              >
                🏆 {winner.name} Triomphe !
              </motion.h1>
              <p className="text-3xl font-bold text-amber-400">
                {winner.score} PVic
              </p>
            </motion.div>

            {/* Loser */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 0.6 }}
              className="flex items-center justify-center gap-4"
            >
              <LionPlayerAvatar 
                name={loser.name} 
                avatarUrl={loser.avatarUrl} 
                size="md" 
                className="grayscale"
              />
              <div className="text-left">
                <p className="text-lg text-amber-400/70">{loser.name}</p>
                <p className="text-xl text-amber-500/70">{loser.score} PVic</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
