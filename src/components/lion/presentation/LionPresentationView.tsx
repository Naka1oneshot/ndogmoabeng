import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLionGameState } from '../useLionGameState';
import { 
  LionTheme, 
  LionCardDisplay, 
  LionScoreDisplay, 
  LionTurnIndicator 
} from '../LionTheme';
import { LionRulesOverlay } from '../rules/LionRulesOverlay';
import { Loader2, RefreshCw, BookOpen, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LionPresentationViewProps {
  game: {
    id: string;
    current_session_game_id: string | null;
    name: string;
  };
  onClose: () => void;
}

type AnimationPhase = 'IDLE' | 'SHOW_DEALER' | 'CARD_PLACED' | 'GUESS_MADE' | 'REVEAL' | 'RESULT';

export function LionPresentationView({ game, onClose }: LionPresentationViewProps) {
  const [showRules, setShowRules] = useState(false);
  const [animPhase, setAnimPhase] = useState<AnimationPhase>('IDLE');
  const [lastTurnId, setLastTurnId] = useState<string | null>(null);

  const sessionGameId = game.current_session_game_id;
  const { 
    gameState, 
    currentTurn, 
    playerA, 
    playerB,
    loading, 
    refetch,
    getPlayerById
  } = useLionGameState(sessionGameId || undefined);

  // Track turn changes and animate
  useEffect(() => {
    if (!currentTurn) return;

    if (currentTurn.id !== lastTurnId) {
      // New turn started
      setLastTurnId(currentTurn.id);
      setAnimPhase('SHOW_DEALER');
    } else if (currentTurn.resolved && animPhase !== 'RESULT') {
      // Turn was resolved
      runRevealAnimation();
    } else if (currentTurn.active_locked && !currentTurn.guess_locked && animPhase === 'SHOW_DEALER') {
      setAnimPhase('CARD_PLACED');
    } else if (currentTurn.guess_locked && !currentTurn.resolved && animPhase !== 'GUESS_MADE') {
      setAnimPhase('GUESS_MADE');
    }
  }, [currentTurn, lastTurnId, animPhase]);

  const runRevealAnimation = async () => {
    setAnimPhase('REVEAL');
    await new Promise(r => setTimeout(r, 1500));
    setAnimPhase('RESULT');
  };

  const activePlayer = gameState ? getPlayerById(gameState.active_player_id) : null;
  const guesserPlayer = gameState ? getPlayerById(gameState.guesser_player_id) : null;

  if (loading) {
    return (
      <LionTheme>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-amber-400" />
        </div>
      </LionTheme>
    );
  }

  if (!gameState || gameState.status === 'NOT_STARTED') {
    return (
      <LionTheme>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-amber-300 mb-4">🦁 Le CŒUR du Lion</h1>
            <p className="text-amber-200 text-xl">En attente du démarrage...</p>
          </div>
        </div>
      </LionTheme>
    );
  }

  if (gameState.status === 'FINISHED') {
    const winner = gameState.winner_player_id === playerA?.id ? playerA : playerB;
    const loser = gameState.winner_player_id === playerA?.id ? playerB : playerA;

    return (
      <LionTheme>
        <div className="min-h-screen flex items-center justify-center p-8">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-8xl mb-8"
            >
              🏆
            </motion.div>
            <h1 className="text-5xl font-bold text-amber-300 mb-6 lion-text-glow">
              {winner?.display_name} Triomphe !
            </h1>
            <LionScoreDisplay
              playerAName={playerA?.display_name || 'A'}
              playerBName={playerB?.display_name || 'B'}
              scoreA={playerA?.pvic || 0}
              scoreB={playerB?.pvic || 0}
            />
          </motion.div>
        </div>
      </LionTheme>
    );
  }

  return (
    <LionTheme>
      <LionRulesOverlay 
        open={showRules} 
        onClose={() => setShowRules(false)} 
        role="MJ"
      />

      {/* Fixed Controls */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowRules(true)}
          className="text-amber-400 hover:text-amber-300 bg-amber-950/80"
        >
          <BookOpen className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={refetch}
          className="text-amber-400 hover:text-amber-300 bg-amber-950/80"
        >
          <RefreshCw className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-amber-400 hover:text-amber-300 bg-amber-950/80"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        {/* Title */}
        <motion.h1 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-3xl md:text-4xl font-bold text-amber-300 mb-4 text-center"
        >
          🦁 Le CŒUR du Lion
        </motion.h1>

        {/* Scores */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8"
        >
          <LionScoreDisplay
            playerAName={playerA?.display_name || 'Joueur A'}
            playerBName={playerB?.display_name || 'Joueur B'}
            scoreA={playerA?.pvic || 0}
            scoreB={playerB?.pvic || 0}
            activePlayerId={gameState.active_player_id}
            playerAId={playerA?.id}
          />
        </motion.div>

        {/* Turn Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <LionTurnIndicator
            currentTurn={gameState.turn_index}
            totalTurns={22}
            isSuddenDeath={gameState.status === 'SUDDEN_DEATH'}
            suddenPairIndex={gameState.sudden_pair_index}
          />
        </motion.div>

        {/* Main Game Area */}
        {currentTurn && (
          <div className="flex flex-col items-center">
            {/* Player Names */}
            <div className="flex items-center justify-center gap-8 mb-6">
              <motion.div
                animate={{ scale: activePlayer ? 1.1 : 1 }}
                className="text-center"
              >
                <p className="text-amber-400">Actif</p>
                <p className="text-xl font-bold text-amber-200">{activePlayer?.display_name}</p>
              </motion.div>
              <div className="text-amber-600 text-2xl">⚔️</div>
              <motion.div className="text-center">
                <p className="text-amber-400">Devineur</p>
                <p className="text-xl font-bold text-amber-200">{guesserPlayer?.display_name}</p>
              </motion.div>
            </div>

            {/* Cards Display */}
            <div className="flex items-center justify-center gap-8 md:gap-16">
              {/* Dealer Card */}
              <motion.div
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="text-center"
              >
                <p className="text-amber-400 mb-3">Croupier</p>
                <LionCardDisplay value={currentTurn.dealer_card} size="lg" />
              </motion.div>

              {/* VS */}
              <div className="text-4xl text-amber-500 lion-text-glow">VS</div>

              {/* Active Card */}
              <motion.div className="text-center">
                <p className="text-amber-400 mb-3">Carte Jouée</p>
                <AnimatePresence mode="wait">
                  {animPhase === 'REVEAL' || animPhase === 'RESULT' ? (
                    <motion.div
                      key="revealed"
                      initial={{ rotateY: 180, scale: 0.8 }}
                      animate={{ rotateY: 0, scale: 1 }}
                      transition={{ duration: 0.6 }}
                    >
                      <LionCardDisplay value={currentTurn.active_card} size="lg" />
                    </motion.div>
                  ) : currentTurn.active_locked ? (
                    <motion.div
                      key="facedown"
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.4 }}
                    >
                      <LionCardDisplay value={null} faceDown size="lg" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="waiting"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-20 h-28 border-2 border-dashed border-amber-600 rounded-lg flex items-center justify-center"
                    >
                      <span className="text-amber-500">?</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Guess Display */}
            <AnimatePresence>
              {(currentTurn.guess_locked || animPhase === 'RESULT') && (
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-8 text-center"
                >
                  <p className="text-amber-400 mb-2">{guesserPlayer?.display_name} annonce :</p>
                  <div className={`text-3xl font-bold ${
                    currentTurn.guess_choice === 'HIGHER' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {currentTurn.guess_choice === 'HIGHER' ? '⬆️ PLUS HAUT' : '⬇️ PLUS BAS'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result */}
            <AnimatePresence>
              {animPhase === 'RESULT' && currentTurn.resolved && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-8 p-6 bg-amber-900/60 rounded-xl border-2 border-amber-500 lion-glow"
                >
                  <p className="text-2xl text-amber-200 text-center">
                    Différence : <span className="font-bold text-amber-300">{currentTurn.d}</span>
                  </p>
                  {currentTurn.d === 0 ? (
                    <p className="text-xl text-amber-400 text-center mt-2">
                      Aucun point ce tour !
                    </p>
                  ) : currentTurn.pvic_delta_guesser > 0 ? (
                    <motion.p 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-2xl text-green-400 text-center mt-2 font-bold"
                    >
                      {guesserPlayer?.display_name} +{currentTurn.pvic_delta_guesser} PVic !
                    </motion.p>
                  ) : (
                    <motion.p 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-2xl text-amber-400 text-center mt-2 font-bold"
                    >
                      {activePlayer?.display_name} +{currentTurn.pvic_delta_active} PVic !
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status Messages */}
            <AnimatePresence>
              {animPhase === 'SHOW_DEALER' && !currentTurn.active_locked && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-8 text-xl text-amber-400"
                >
                  ⏳ En attente de la carte de {activePlayer?.display_name}...
                </motion.p>
              )}
              {animPhase === 'CARD_PLACED' && !currentTurn.guess_locked && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-8 text-xl text-amber-400"
                >
                  ⏳ En attente du choix de {guesserPlayer?.display_name}...
                </motion.p>
              )}
              {animPhase === 'GUESS_MADE' && !currentTurn.resolved && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  exit={{ opacity: 0 }}
                  className="mt-8 text-xl text-amber-400"
                >
                  ⏳ Résolution en cours...
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </LionTheme>
  );
}
