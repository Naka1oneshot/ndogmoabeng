import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLionGameState } from './useLionGameState';
import { 
  LionTheme, 
  LionCardDisplay, 
  LionScoreDisplay, 
  LionTurnIndicator,
  LionGuessButtons 
} from './LionTheme';
import { LionRulesOverlay } from './rules/LionRulesOverlay';
import { UserAvatarButton } from '@/components/ui/UserAvatarButton';
import { Loader2, RefreshCw, BookOpen, Lock, Eye, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PlayerLionDashboardProps {
  game: {
    id: string;
    current_session_game_id: string | null;
    name?: string;
  };
  player: {
    id: string;
    display_name: string;
    user_id: string | null;
  };
  onLeaveGame?: () => void;
}

export function PlayerLionDashboard({ game, player, onLeaveGame }: PlayerLionDashboardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showRules, setShowRules] = useState(false);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [selectedGuess, setSelectedGuess] = useState<'HIGHER' | 'LOWER' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReveal, setShowReveal] = useState(false);

  const sessionGameId = game.current_session_game_id;
  const { 
    gameState, 
    currentTurn, 
    myHand, 
    playerA, 
    playerB,
    loading, 
    refetch 
  } = useLionGameState(sessionGameId || undefined, player.id);

  // Determine my role this turn
  const isActive = gameState?.active_player_id === player.id;
  const isGuesser = gameState?.guesser_player_id === player.id;

  // Reset selections when turn changes
  useEffect(() => {
    setSelectedCard(null);
    setSelectedGuess(null);
    setShowReveal(false);
  }, [currentTurn?.turn_index, gameState?.sudden_pair_index]);

  // Show reveal animation when turn is resolved
  useEffect(() => {
    if (currentTurn?.resolved && !showReveal) {
      setShowReveal(true);
    }
  }, [currentTurn?.resolved]);

  const handleSubmitCard = async () => {
    if (selectedCard === null || !sessionGameId) return;

    setSubmitting(true);
    try {
      const response = await supabase.functions.invoke('lion-submit-active-card', {
        body: { 
          session_game_id: sessionGameId, 
          card: selectedCard,
          player_id: player.id
        }
      });

      if (response.error) throw response.error;
      
      toast({
        title: 'Carte posée',
        description: 'Ta carte est face cachée. En attente du devineur...',
      });
      
      refetch();
    } catch (err) {
      console.error('Submit card error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de poser la carte',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitGuess = async () => {
    if (!selectedGuess || !sessionGameId) return;

    setSubmitting(true);
    try {
      const response = await supabase.functions.invoke('lion-submit-guess', {
        body: { 
          session_game_id: sessionGameId, 
          choice: selectedGuess,
          player_id: player.id
        }
      });

      if (response.error) throw response.error;
      
      toast({
        title: 'Choix verrouillé',
        description: `Tu as choisi ${selectedGuess === 'HIGHER' ? 'PLUS HAUT' : 'PLUS BAS'}`,
      });
      
      refetch();
    } catch (err) {
      console.error('Submit guess error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de soumettre le choix',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

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
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="bg-amber-900/50 border-amber-700 max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <h2 className="text-2xl font-bold text-amber-300 mb-4">🦁 Le CŒUR du Lion</h2>
              <p className="text-amber-200">En attente du démarrage par le MJ...</p>
            </CardContent>
          </Card>
        </div>
      </LionTheme>
    );
  }

  if (gameState.status === 'FINISHED') {
    const winner = gameState.winner_player_id === playerA?.id ? playerA : playerB;
    const isWinner = gameState.winner_player_id === player.id;

    return (
      <LionTheme>
        <div className="min-h-screen flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="text-6xl mb-4">{isWinner ? '🏆' : '💔'}</div>
            <h2 className="text-3xl font-bold text-amber-300 mb-4">
              {isWinner ? 'Victoire !' : 'Défaite...'}
            </h2>
            <p className="text-xl text-amber-200 mb-6">
              {winner?.display_name} remporte la partie !
            </p>
            <LionScoreDisplay
              playerAName={playerA?.display_name || 'Joueur A'}
              playerBName={playerB?.display_name || 'Joueur B'}
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
        role="PLAYER"
      />

      <div className="min-h-screen p-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-amber-300">🦁 Le CŒUR du Lion</h1>
            <p className="text-amber-400 text-sm">
              {isActive ? "C'est ton tour de jouer" : isGuesser ? "Devine la carte !" : "Observe..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="text-amber-400 hover:text-amber-300"
              title="Accueil"
            >
              <Home className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowRules(true)}
              className="text-amber-400 hover:text-amber-300"
            >
              <BookOpen className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={refetch}
              className="text-amber-400 hover:text-amber-300"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
            <UserAvatarButton size="sm" onLeaveGame={onLeaveGame} />
          </div>
        </div>

        {/* Scores */}
        <Card className="bg-amber-900/40 border-amber-700 mb-6">
          <CardContent className="pt-4">
            <LionScoreDisplay
              playerAName={playerA?.display_name || 'Joueur A'}
              playerBName={playerB?.display_name || 'Joueur B'}
              scoreA={playerA?.pvic || 0}
              scoreB={playerB?.pvic || 0}
              activePlayerId={gameState.active_player_id}
              playerAId={playerA?.id}
            />
            <div className="mt-4">
              <LionTurnIndicator
                currentTurn={gameState.turn_index}
                totalTurns={22}
                isSuddenDeath={gameState.status === 'SUDDEN_DEATH'}
                suddenPairIndex={gameState.sudden_pair_index}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dealer Card */}
        {currentTurn && (
          <Card className="bg-amber-900/40 border-amber-700 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-amber-300 text-center">Carte du Croupier</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <LionCardDisplay value={currentTurn.dealer_card} size="lg" />
            </CardContent>
          </Card>
        )}

        {/* Active Player Actions */}
        {isActive && currentTurn && !currentTurn.active_locked && (
          <Card className="bg-amber-900/40 border-amber-700 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-amber-300">Ta Main</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 gap-2 mb-4">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(card => {
                  const available = myHand?.remaining_cards.includes(card) ?? false;
                  return (
                    <LionCardDisplay
                      key={card}
                      value={card}
                      size="sm"
                      disabled={!available}
                      selected={selectedCard === card}
                      onClick={() => available && setSelectedCard(card)}
                    />
                  );
                })}
              </div>
              <Button
                onClick={handleSubmitCard}
                disabled={selectedCard === null || submitting}
                className="w-full lion-btn-primary"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                Poser face cachée
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Active Player Waiting */}
        {isActive && currentTurn?.active_locked && !currentTurn.resolved && (
          <Card className="bg-amber-900/40 border-amber-700 mb-6">
            <CardContent className="pt-6 text-center">
              <div className="flex justify-center mb-4">
                <LionCardDisplay value={null} faceDown size="lg" />
              </div>
              <p className="text-amber-200">
                {currentTurn.guess_locked 
                  ? '⏳ Résolution en cours...'
                  : '⏳ En attente du devineur...'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Guesser Waiting for Active Player */}
        {isGuesser && currentTurn && !currentTurn.active_locked && (
          <Card className="bg-amber-900/40 border-amber-700 mb-6">
            <CardContent className="pt-6 text-center">
              <div className="flex justify-center mb-4">
                <LionCardDisplay value={null} faceDown size="lg" />
              </div>
              <p className="text-amber-200">
                ⏳ En attente que l'adversaire pose sa carte...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Guesser Actions - only after active player has locked */}
        {isGuesser && currentTurn && currentTurn.active_locked && !currentTurn.guess_locked && (
          <Card className="bg-amber-900/40 border-amber-700 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-amber-300 text-center">
                La carte posée sera...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LionGuessButtons
                onGuess={setSelectedGuess}
                selectedGuess={selectedGuess}
                disabled={submitting}
              />
              <Button
                onClick={handleSubmitGuess}
                disabled={!selectedGuess || submitting}
                className="w-full mt-4 lion-btn-primary"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                Verrouiller mon choix
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Guesser Waiting */}
        {isGuesser && currentTurn?.guess_locked && !currentTurn.resolved && (
          <Card className="bg-amber-900/40 border-amber-700 mb-6">
            <CardContent className="pt-6 text-center">
              <p className="text-xl text-amber-300 mb-2">
                {currentTurn.guess_choice === 'HIGHER' ? '⬆️ PLUS HAUT' : '⬇️ PLUS BAS'}
              </p>
              <p className="text-amber-200">
                {currentTurn.active_locked 
                  ? '⏳ Résolution en cours...'
                  : '⏳ En attente de la carte...'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Resolution Reveal */}
        <AnimatePresence>
          {currentTurn?.resolved && showReveal && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className="bg-amber-900/60 border-amber-500 mb-6 lion-glow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-amber-300 text-center flex items-center justify-center gap-2">
                    <Eye className="h-5 w-5" />
                    Résultat du tour
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center items-center gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-amber-400 text-sm mb-1">Croupier</p>
                      <LionCardDisplay value={currentTurn.dealer_card} size="md" />
                    </div>
                    <div className="text-2xl text-amber-500">vs</div>
                    <div className="text-center">
                      <p className="text-amber-400 text-sm mb-1">Jouée</p>
                      <LionCardDisplay value={currentTurn.active_card} size="md" />
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-lg text-amber-200">
                      Différence: <span className="font-bold text-amber-300">{currentTurn.d}</span>
                    </p>
                    {currentTurn.d === 0 ? (
                      <p className="text-amber-400 mt-2">Aucun point ce tour !</p>
                    ) : currentTurn.pvic_delta_guesser > 0 ? (
                      <p className="text-green-400 mt-2 font-bold">
                        Devineur +{currentTurn.pvic_delta_guesser} PVic !
                      </p>
                    ) : (
                      <p className="text-amber-400 mt-2 font-bold">
                        Actif +{currentTurn.pvic_delta_active} PVic !
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LionTheme>
  );
}
