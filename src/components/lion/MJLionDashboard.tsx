import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useLionGameState } from './useLionGameState';
import { 
  LionTheme, 
  LionCardDisplay, 
  LionScoreDisplay, 
  LionTurnIndicator 
} from './LionTheme';
import { LionRulesOverlay } from './rules/LionRulesOverlay';
import { LionScoringSettings } from './LionScoringSettings';
import { 
  Loader2, 
  RefreshCw, 
  BookOpen, 
  Play, 
  CheckCircle, 
  XCircle,
  SkipForward,
  Monitor,
  RotateCcw,
  Flag
} from 'lucide-react';

interface MJLionDashboardProps {
  game: {
    id: string;
    current_session_game_id: string | null;
    name: string;
  };
  onPresentationMode?: () => void;
}

export function MJLionDashboard({ game, onPresentationMode }: MJLionDashboardProps) {
  const { toast } = useToast();
  const [showRules, setShowRules] = useState(false);
  const [starting, setStarting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const sessionGameId = game.current_session_game_id;
  const { 
    gameState, 
    currentTurn, 
    playerA, 
    playerB,
    decks,
    loading, 
    refetch,
    getPlayerById
  } = useLionGameState(sessionGameId || undefined);

  const handleStartGame = async () => {
    if (!sessionGameId) return;

    setStarting(true);
    try {
      const response = await supabase.functions.invoke('start-lion', {
        body: { session_game_id: sessionGameId }
      });

      if (response.error) throw response.error;

      toast({
        title: '🦁 Partie lancée !',
        description: 'Le CŒUR du Lion commence.',
      });

      refetch();
    } catch (err) {
      console.error('Start game error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de démarrer la partie',
        variant: 'destructive'
      });
    } finally {
      setStarting(false);
    }
  };

  const handleResolveTurn = async () => {
    if (!sessionGameId) return;

    setResolving(true);
    try {
      const response = await supabase.functions.invoke('lion-resolve-turn', {
        body: { session_game_id: sessionGameId }
      });

      if (response.error) throw response.error;

      toast({
        title: 'Tour résolu',
        description: `Différence: ${response.data.d}, points attribués.`,
      });

      refetch();
    } catch (err) {
      console.error('Resolve error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de résoudre le tour',
        variant: 'destructive'
      });
    } finally {
      setResolving(false);
    }
  };

  const handleNextTurn = async () => {
    if (!sessionGameId) return;

    setAdvancing(true);
    try {
      const response = await supabase.functions.invoke('lion-next-turn', {
        body: { session_game_id: sessionGameId }
      });

      if (response.error) throw response.error;

      if (response.data.finished) {
        toast({
          title: '🏆 Partie terminée !',
          description: `${response.data.winner} remporte la victoire !`,
        });
      } else if (response.data.suddenDeath) {
        toast({
          title: '⚔️ Mort Subite !',
          description: 'Égalité ! Duo de tours décisifs.',
        });
      } else {
        toast({
          title: 'Tour suivant',
          description: `Tour ${response.data.turnIndex}`,
        });
      }

      refetch();
    } catch (err) {
      console.error('Next turn error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de passer au tour suivant',
        variant: 'destructive'
      });
    } finally {
      setAdvancing(false);
    }
  };

  const handleToggleAutoResolve = async () => {
    if (!gameState) return;

    try {
      await supabase
        .from('lion_game_state')
        .update({ auto_resolve: !gameState.auto_resolve })
        .eq('id', gameState.id);

      refetch();
    } catch (err) {
      console.error('Toggle auto-resolve error:', err);
    }
  };

  const handleResetChoices = async (resetActive: boolean, resetGuesser: boolean) => {
    if (!sessionGameId) return;

    setResetting(true);
    try {
      const response = await supabase.functions.invoke('lion-reset-turn-choices', {
        body: { 
          session_game_id: sessionGameId,
          reset_active: resetActive,
          reset_guesser: resetGuesser
        }
      });

      if (response.error) throw response.error;

      const messages = [];
      if (response.data.reset_active) messages.push('carte du joueur actif');
      if (response.data.reset_guesser) messages.push('choix du devineur');

      toast({
        title: 'Choix réinitialisés',
        description: `Réinitialisé : ${messages.join(', ')}`,
      });

      refetch();
    } catch (err) {
      console.error('Reset choices error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de réinitialiser les choix',
        variant: 'destructive'
      });
    } finally {
      setResetting(false);
    }
  };

  const handleFinishGame = async () => {
    if (!sessionGameId || !game.id) return;

    setFinishing(true);
    try {
      // Get the winner info
      const winnerId = gameState?.winner_player_id;
      let winnerUserId: string | null = null;

      if (winnerId) {
        const { data: winnerData } = await supabase
          .from('game_players')
          .select('user_id')
          .eq('id', winnerId)
          .single();
        winnerUserId = winnerData?.user_id || null;
      }

      // Update game status to ENDED
      const { error: gameError } = await supabase
        .from('games')
        .update({ 
          status: 'ENDED', 
          phase: 'FINISHED',
          phase_locked: true
        })
        .eq('id', game.id);

      if (gameError) throw gameError;

      // Update player profile statistics
      const { error: statsError } = await supabase.rpc('update_player_stats_on_game_end', {
        p_game_id: game.id,
        p_winner_user_id: winnerUserId
      });

      if (statsError) {
        console.error('Stats update error:', statsError);
      }

      toast({
        title: '✅ Partie archivée',
        description: 'Les statistiques ont été enregistrées.',
      });

      refetch();
    } catch (err) {
      console.error('Finish game error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de terminer la partie',
        variant: 'destructive'
      });
    } finally {
      setFinishing(false);
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

  const activePlayer = gameState ? getPlayerById(gameState.active_player_id) : null;
  const guesserPlayer = gameState ? getPlayerById(gameState.guesser_player_id) : null;

  return (
    <LionTheme>
      <LionRulesOverlay 
        open={showRules} 
        onClose={() => setShowRules(false)} 
        role="MJ"
      />

      <div className="min-h-screen p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-amber-300">🦁 MJ - Le CŒUR du Lion</h1>
            <p className="text-amber-400 text-sm">{game.name}</p>
          </div>
          <div className="flex gap-2">
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
            {onPresentationMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPresentationMode}
                className="border-amber-600 text-amber-300"
              >
                <Monitor className="h-4 w-4 mr-2" />
                Présentation
              </Button>
            )}
          </div>
        </div>

        {/* Not Started */}
        {(!gameState || gameState.status === 'NOT_STARTED') && (
          <Card className="bg-amber-900/40 border-amber-700 mb-6">
            <CardContent className="pt-6">
              <div className="text-center mb-4">
                <p className="text-amber-200 mb-2">
                  Joueurs présents: {playerA?.display_name || '?'} vs {playerB?.display_name || '?'}
                </p>
                <p className="text-amber-400 text-sm">
                  {(!playerA || !playerB) 
                    ? '⚠️ 2 joueurs requis pour démarrer' 
                    : '✓ Prêt à démarrer'}
                </p>
              </div>
              <Button
                onClick={handleStartGame}
                disabled={starting || !playerA || !playerB}
                className="w-full lion-btn-primary"
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Démarrer la partie
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Game In Progress */}
        {gameState && gameState.status !== 'NOT_STARTED' && gameState.status !== 'FINISHED' && (
          <>
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

            {/* Current Turn Status */}
            {currentTurn && (
              <Card className="bg-amber-900/40 border-amber-700 mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-amber-300">État du tour</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-amber-400 text-sm mb-2">Carte Croupier</p>
                      <div className="flex justify-center">
                        <LionCardDisplay value={currentTurn.dealer_card} size="md" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-amber-400 text-sm mb-2">Carte Actif</p>
                      <div className="flex justify-center">
                        {currentTurn.resolved ? (
                          <LionCardDisplay value={currentTurn.active_card} size="md" />
                        ) : (
                          <LionCardDisplay value={null} faceDown size="md" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-amber-300">Actif ({activePlayer?.display_name})</span>
                      {currentTurn.active_locked ? (
                        <span className="text-green-400 flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" /> Verrouillé
                        </span>
                      ) : (
                        <span className="text-amber-500 flex items-center gap-1">
                          <XCircle className="h-4 w-4" /> En attente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-amber-300">Devineur ({guesserPlayer?.display_name})</span>
                      {currentTurn.guess_locked ? (
                        <span className="text-green-400 flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" /> {currentTurn.guess_choice}
                        </span>
                      ) : (
                        <span className="text-amber-500 flex items-center gap-1">
                          <XCircle className="h-4 w-4" /> En attente
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Resolution Result */}
                  {currentTurn.resolved && (
                    <div className="bg-amber-800/40 rounded-lg p-3 mb-4">
                      <p className="text-center text-amber-200">
                        Différence: <strong>{currentTurn.d}</strong> |
                        {currentTurn.d === 0 ? (
                          <span> Aucun point</span>
                        ) : currentTurn.pvic_delta_guesser > 0 ? (
                          <span className="text-green-400"> Devineur +{currentTurn.pvic_delta_guesser}</span>
                        ) : (
                          <span className="text-amber-400"> Actif +{currentTurn.pvic_delta_active}</span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Manual Actions */}
                  {!gameState.auto_resolve && (
                    <div className="space-y-2">
                      {/* Reset buttons - only when not resolved */}
                      {!currentTurn.resolved && (currentTurn.active_locked || currentTurn.guess_locked) && (
                        <div className="flex gap-2 mb-2">
                          {currentTurn.active_locked && (
                            <Button
                              onClick={() => handleResetChoices(true, false)}
                              disabled={resetting}
                              variant="outline"
                              size="sm"
                              className="flex-1 border-amber-600 text-amber-300 hover:bg-amber-900/40"
                            >
                              {resetting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                              Réinit. carte
                            </Button>
                          )}
                          {currentTurn.guess_locked && (
                            <Button
                              onClick={() => handleResetChoices(false, true)}
                              disabled={resetting}
                              variant="outline"
                              size="sm"
                              className="flex-1 border-amber-600 text-amber-300 hover:bg-amber-900/40"
                            >
                              {resetting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                              Réinit. choix
                            </Button>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          onClick={handleResolveTurn}
                          disabled={resolving || !currentTurn.active_locked || !currentTurn.guess_locked || currentTurn.resolved}
                          className="flex-1"
                          variant="secondary"
                        >
                          {resolving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Résoudre
                        </Button>
                        <Button
                          onClick={handleNextTurn}
                          disabled={advancing || !currentTurn.resolved}
                          className="flex-1 lion-btn-primary"
                        >
                          {advancing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <SkipForward className="h-4 w-4 mr-2" />}
                          Tour suivant
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Settings */}
            <Card className="bg-amber-900/40 border-amber-700 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-300">Paramètres</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-resolve" className="text-amber-200">
                    Auto-résolution
                  </Label>
                  <Switch
                    id="auto-resolve"
                    checked={gameState.auto_resolve}
                    onCheckedChange={handleToggleAutoResolve}
                  />
                </div>
                <p className="text-amber-400 text-xs mt-1">
                  Active: résout automatiquement quand les 2 joueurs ont verrouillé
                </p>
              </CardContent>
            </Card>

            {/* Scoring Settings */}
            <div className="mb-6">
              <LionScoringSettings
                gameStateId={gameState.id}
                scoringEqualCorrect={gameState.scoring_equal_correct ?? 10}
                scoringEqualWrong={gameState.scoring_equal_wrong ?? 10}
                onUpdate={refetch}
                disabled={gameState.turn_index > 1}
              />
            </div>

            {/* Deck Status */}
            <Card className="bg-amber-900/40 border-amber-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-300">Decks restants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {decks.map(deck => {
                    const owner = getPlayerById(deck.owner_player_id);
                    return (
                      <div key={deck.id} className="text-center">
                        <p className="text-amber-400 text-sm">{owner?.display_name}</p>
                        <p className="text-amber-200 text-xs">
                          {deck.remaining_cards.length} cartes
                        </p>
                        <p className="text-amber-500 text-xs">
                          [{deck.remaining_cards.sort((a, b) => a - b).join(', ')}]
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Game Finished */}
        {gameState?.status === 'FINISHED' && (
          <Card className="bg-amber-900/40 border-amber-700">
            <CardContent className="pt-6 text-center">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-2xl font-bold text-amber-300 mb-4">
                Partie terminée !
              </h2>
              <LionScoreDisplay
                playerAName={playerA?.display_name || 'Joueur A'}
                playerBName={playerB?.display_name || 'Joueur B'}
                scoreA={playerA?.pvic || 0}
                scoreB={playerB?.pvic || 0}
              />
              <p className="text-amber-200 mt-4 mb-6">
                Vainqueur: {getPlayerById(gameState.winner_player_id || '')?.display_name}
              </p>
              
              <Button
                onClick={handleFinishGame}
                disabled={finishing}
                className="lion-btn-primary"
              >
                {finishing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Flag className="h-4 w-4 mr-2" />
                )}
                Archiver et enregistrer les stats
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </LionTheme>
  );
}
