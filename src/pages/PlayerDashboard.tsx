import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePlayerPresence } from '@/hooks/usePlayerPresence';
import { useGameTheme } from '@/contexts/ThemeContext';
import { useAnimationPreference } from '@/hooks/useAnimationPreference';
import { Loader2, LogOut, Clock, Zap } from 'lucide-react';
import { ForestButton } from '@/components/ui/ForestButton';
import { toast } from 'sonner';
import { GameTransitionAnimation } from '@/components/game/GameTransitionAnimation';
import { AdventureCinematicOverlay } from '@/components/adventure/AdventureCinematicOverlay';
import { useAdventureCinematic } from '@/hooks/useAdventureCinematic';
import { IMPLEMENTED_GAME_TYPES, isImplementedGame } from '@/constants/games';

import { PlayerHeader } from '@/components/player/PlayerHeader';
import { GameTypeInDevelopment } from '@/components/game/GameTypeInDevelopment';
import LobbyWaitingRoom from '@/components/lobby/LobbyWaitingRoom';

// Lazy-loaded game dashboards for code splitting
// Only the active game type is loaded, reducing initial bundle size
const PlayerRivieresDashboard = lazy(() => import('@/components/rivieres/PlayerRivieresDashboard').then(m => ({ default: m.PlayerRivieresDashboard })));
const PlayerInfectionDashboard = lazy(() => import('@/components/infection/PlayerInfectionDashboard').then(m => ({ default: m.PlayerInfectionDashboard })));
const PlayerSheriffDashboard = lazy(() => import('@/components/sheriff/PlayerSheriffDashboard').then(m => ({ default: m.PlayerSheriffDashboard })));
const PlayerForetDashboard = lazy(() => import('@/components/foret/dashboard/PlayerForetDashboard').then(m => ({ default: m.PlayerForetDashboard })));
const PlayerLionDashboard = lazy(() => import('@/components/lion/PlayerLionDashboard').then(m => ({ default: m.PlayerLionDashboard })));

// Loading fallback for lazy-loaded dashboards
function DashboardLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Chargement du jeu...</p>
      </div>
    </div>
  );
}

const LA_CARTE_TROUVEE_ID = 'a1b2c3d4-5678-9012-3456-789012345678';

interface Game {
  id: string;
  name: string;
  status: string;
  join_code: string;
  manche_active: number;
  phase: string;
  phase_locked: boolean;
  current_session_game_id: string | null;
  selected_game_type_code: string | null;
  mode?: string;
  adventure_id?: string | null;
  current_step_index?: number;
}

interface Player {
  id: string;
  displayName: string;
  playerNumber: number;
  jetons: number;
  recompenses: number;
  clan: string | null;
  mateNum: number | null;
  playerToken?: string;
  roleCode: string | null;
  teamCode: string | null;
  immunePermanent: boolean | null;
  pvic: number | null;
  isAlive: boolean | null;
}

const PLAYER_TOKEN_PREFIX = 'ndogmoabeng_player_';

export default function PlayerDashboard() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const initRetryCountRef = useRef(0);
  const initErrorTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Apply game-specific theme
  useGameTheme(game?.selected_game_type_code);
  
  // Animation preference
  const { animationsEnabled, toggleAnimations } = useAnimationPreference();
  
  // Start animation state for FORET
  const [showStartAnimation, setShowStartAnimation] = useState(false);
  const previousGameStatusRef = useRef<string | null>(null);
  
  // Transition animation state for adventure mode
  const [showTransitionAnimation, setShowTransitionAnimation] = useState(false);
  const [transitionFromGame, setTransitionFromGame] = useState<'FORET' | 'RIVIERES' | 'INFECTION'>('FORET');
  const [transitionToGame, setTransitionToGame] = useState<'FORET' | 'RIVIERES' | 'INFECTION'>('FORET');
  const [totalAdventureSteps, setTotalAdventureSteps] = useState(3);
  const previousStepIndexRef = useRef<number | null>(null);

  const isAdventure = game?.mode === 'ADVENTURE' && game?.adventure_id;
  const isForetGame = game?.selected_game_type_code === 'FORET';

  // Adventure cinematic hook - enabled for ANY adventure mode
  const isAnyAdventure = game?.mode === 'ADVENTURE';
  const {
    isOpen: isCinematicOpen,
    currentSequence: cinematicSequence,
    currentBroadcastId: cinematicBroadcastId,
    closeOverlay: closeCinematic,
    replayLocal: replayCinematic,
  } = useAdventureCinematic(isAnyAdventure ? game?.id : undefined, {
    enabled: isAnyAdventure,
  });

  // Detect game start transition for FORET animation
  useEffect(() => {
    if (previousGameStatusRef.current === 'LOBBY' && game?.status === 'IN_GAME' && 
        game.selected_game_type_code === 'FORET') {
      setShowStartAnimation(true);
      const timer = setTimeout(() => setShowStartAnimation(false), 3000);
      return () => clearTimeout(timer);
    }
    if (game?.status) {
      previousGameStatusRef.current = game.status;
    }
  }, [game?.status, game?.selected_game_type_code]);

  // Detect step change for transition animation in adventure mode
  useEffect(() => {
    if (!game || !isAdventure) return;
    
    const currentStepIndex = game.current_step_index ?? 1;
    
    if (previousStepIndexRef.current !== null && previousStepIndexRef.current < currentStepIndex) {
      const fetchGameTypes = async () => {
        const { data: steps } = await supabase
          .from('adventure_steps')
          .select('step_index, game_type_code')
          .eq('adventure_id', game.adventure_id!)
          .in('step_index', [previousStepIndexRef.current!, currentStepIndex])
          .order('step_index');
        
        if (steps && steps.length >= 2) {
          const fromType = steps.find(s => s.step_index === previousStepIndexRef.current)?.game_type_code;
          const toType = steps.find(s => s.step_index === currentStepIndex)?.game_type_code;
          
          if (fromType && toType) {
            setTransitionFromGame(fromType as any);
            setTransitionToGame(toType as any);
            setShowTransitionAnimation(true);
          }
        }
      };
      fetchGameTypes();
    }
    
    previousStepIndexRef.current = currentStepIndex;
  }, [game?.current_step_index, game?.adventure_id, isAdventure]);

  // Fetch adventure total steps
  useEffect(() => {
    if (isAdventure && game?.adventure_id) {
      const fetchSteps = async () => {
        const { count } = await supabase
          .from('adventure_steps')
          .select('*', { count: 'exact', head: true })
          .eq('adventure_id', game.adventure_id!);
        if (count) setTotalAdventureSteps(count);
      };
      fetchSteps();
    }
  }, [game?.adventure_id, isAdventure]);

  const { handleLeave: presenceLeave } = usePlayerPresence({
    gameId,
    enabled: !!player && !!game,
    onInvalidToken: () => {
      if (gameId) {
        localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);
        redirectToJoin();
      }
    },
  });

  const redirectToJoin = async () => {
    if (!gameId) return;

    try {
      const { data: gameData } = await supabase
        .from('games')
        .select('join_code')
        .eq('id', gameId)
        .single();

      if (gameData) {
        navigate(`/join/${gameData.join_code}`);
      } else {
        setError('Partie introuvable');
        setLoading(false);
      }
    } catch {
      setError('Erreur lors de la recherche');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!gameId) {
      setError('ID de partie manquant');
      setLoading(false);
      return;
    }

    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      localStorage.setItem(`${PLAYER_TOKEN_PREFIX}${gameId}`, tokenFromUrl);
      setSearchParams({}, { replace: true });
      validateAndFetch(tokenFromUrl);
      return;
    }

    const playerToken = localStorage.getItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);

    if (!playerToken) {
      redirectToJoin();
      return;
    }

    validateAndFetch(playerToken);
  }, [gameId, searchParams]);

  const validateAndFetch = async (playerToken: string, isRetry = false) => {
    try {
      const { data, error: validateError } = await supabase.functions.invoke('validate-player', {
        body: { gameId, playerToken },
      });

      if (validateError || !data?.valid) {
        if (!isRetry && initRetryCountRef.current < 2) {
          initRetryCountRef.current++;
          setTimeout(() => validateAndFetch(playerToken, true), 800);
          return;
        }
        
        localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);

        if (data?.removed) {
          toast.error(data.error || 'Vous avez été expulsé de cette partie');
          navigate('/');
          return;
        }

        redirectToJoin();
        return;
      }

      if (initErrorTimerRef.current) {
        clearTimeout(initErrorTimerRef.current);
        initErrorTimerRef.current = null;
      }

      setPlayer({
        id: data.player.id,
        displayName: data.player.displayName,
        playerNumber: data.player.playerNumber,
        jetons: data.player.jetons ?? 0,
        recompenses: data.player.recompenses ?? 0,
        clan: data.player.clan,
        mateNum: data.player.mateNum,
        playerToken,
        roleCode: data.player.roleCode ?? null,
        teamCode: data.player.teamCode ?? null,
        immunePermanent: data.player.immunePermanent ?? null,
        pvic: data.player.pvic ?? null,
        isAlive: data.player.isAlive ?? null,
      });

      setGame(data.game as Game);
      setLoading(false);
      setError('');

      subscribeToUpdates(playerToken);
    } catch (err) {
      console.error('Validation error:', err);
      
      if (!isRetry && initRetryCountRef.current < 2) {
        initRetryCountRef.current++;
        setTimeout(() => validateAndFetch(playerToken, true), 800);
        return;
      }
      
      if (!initErrorTimerRef.current) {
        initErrorTimerRef.current = setTimeout(() => {
          setError('Erreur de validation');
          setLoading(false);
        }, 2500);
      }
    }
  };

  const subscribeToUpdates = (playerToken: string) => {
    if (!gameId) return;

    const channel = supabase
      .channel(`player-dashboard-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          setGame((prev) => (prev ? { ...prev, ...payload.new } as Game : null));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        () => {
          localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);
          toast.error('La partie a été supprimée par le MJ');
          navigate('/');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_players',
          filter: `game_id=eq.${gameId}`,
        },
        async (payload) => {
          const updatedPlayer = payload.new as {
            player_token?: string;
            status?: string;
            removed_reason?: string;
            jetons?: number;
            recompenses?: number;
            player_number?: number;
          };

          if (updatedPlayer.status === 'REMOVED') {
            const { data } = await supabase.functions.invoke('validate-player', {
              body: { gameId, playerToken },
            });

            if (!data?.valid) {
              localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);
              toast.error(data?.error || 'Vous avez été retiré de la partie par le MJ');
              navigate('/');
              return;
            }
          }

          setPlayer((prev) => {
            if (!prev) return prev;
            if (updatedPlayer.player_number === prev.playerNumber) {
              return {
                ...prev,
                jetons: updatedPlayer.jetons ?? prev.jetons,
                recompenses: updatedPlayer.recompenses ?? prev.recompenses,
              };
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleLeave = async () => {
    if (!gameId) return;

    await presenceLeave();
    localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);
    toast.info('Vous avez quitté la partie');
    navigate('/');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-destructive">{error}</p>
        <ForestButton onClick={() => navigate('/')}>Retour à l'accueil</ForestButton>
      </div>
    );
  }

  if (!game || !player) {
    return null;
  }

  // Adventure cinematic overlay (renders on top of everything for any adventure)
  const cinematicOverlay = isAnyAdventure ? (
    <AdventureCinematicOverlay
      open={isCinematicOpen}
      sequence={cinematicSequence}
      onClose={closeCinematic}
      onReplay={replayCinematic}
      isHost={false}
      broadcastId={cinematicBroadcastId || undefined}
    />
  ) : null;

  // Lobby view
  if (game.status === 'LOBBY') {
    return (
      <>
        {cinematicOverlay}
        <div className="min-h-screen flex flex-col">
        <PlayerHeader game={game} player={player} animationsEnabled={animationsEnabled} onToggleAnimations={toggleAnimations} />
        <main className="flex-1 p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="card-gradient rounded-lg border border-border p-6 text-center">
              <Clock className="h-10 w-10 text-primary mx-auto mb-3 animate-pulse" />
              <h2 className="font-display text-xl mb-2">Salle d'attente</h2>
              <p className="text-muted-foreground mb-2">
                En attente du Maître du Jeu pour démarrer la partie...
              </p>
              <p className="text-sm text-primary">
                Vous êtes le joueur <strong>#{player.playerNumber}</strong>
              </p>
            </div>

            <LobbyWaitingRoom
              gameId={game.id}
              playerNum={player.playerNumber}
              playerName={player.displayName}
            />

            <div className="text-center">
              <button
                type="button"
                onClick={handleLeave}
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors mx-auto"
              >
                <LogOut className="h-4 w-4" />
                Quitter la partie
              </button>
            </div>
          </div>
        </main>
        </div>
      </>
    );
  }

  // Ended view
  if (game.status === 'ENDED' || game.status === 'FINISHED') {
    return (
      <div className="min-h-screen flex flex-col">
        <PlayerHeader game={game} player={player} animationsEnabled={animationsEnabled} onToggleAnimations={toggleAnimations} />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="card-gradient rounded-lg border border-border p-8 text-center max-w-md">
            <div className="text-5xl mb-4">🏁</div>
            <h2 className="font-display text-xl mb-2">Partie terminée</h2>
            <p className="text-muted-foreground mb-4">Merci d'avoir joué !</p>
            <div className="flex gap-4 justify-center text-sm">
              <div className="bg-primary/10 text-primary px-4 py-2 rounded">
                {player.jetons} jetons
              </div>
              <div className="bg-accent/50 text-accent-foreground px-4 py-2 rounded">
                {player.recompenses} récompenses
              </div>
            </div>
            <ForestButton onClick={() => navigate('/')} className="mt-6">
              Retour à l'accueil
            </ForestButton>
          </div>
        </main>
      </div>
    );
  }

  // Transition animation overlay for adventure mode
  if (showTransitionAnimation) {
    return (
      <GameTransitionAnimation
        fromGameType={transitionFromGame}
        toGameType={transitionToGame}
        stepIndex={game.current_step_index ?? 1}
        totalSteps={totalAdventureSteps}
        onComplete={() => setShowTransitionAnimation(false)}
      />
    );
  }

  // Guard: Game type not defined
  if (!game.selected_game_type_code) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4 bg-background">
        <div className="flex items-center gap-3 text-destructive">
          <Zap className="h-8 w-8" />
          <span className="text-xl font-semibold">Type de jeu non défini</span>
        </div>
        <p className="text-muted-foreground text-center max-w-md">
          La partie n'a pas de type de jeu défini. Veuillez recharger ou contacter le MJ.
        </p>
        <div className="flex gap-4">
          <ForestButton onClick={() => window.location.reload()}>
            Recharger
          </ForestButton>
          <ForestButton variant="outline" onClick={() => navigate('/')}>
            Retour à l'accueil
          </ForestButton>
        </div>
      </div>
    );
  }

  // Check if game type is implemented
  const isGameTypeImplemented = IMPLEMENTED_GAME_TYPES.includes(game.selected_game_type_code);

  // Show "in development" screen for non-implemented game types
  if (!isGameTypeImplemented) {
    return (
      <div className="min-h-screen flex flex-col">
        <PlayerHeader game={game} player={player} animationsEnabled={animationsEnabled} onToggleAnimations={toggleAnimations} />
        <main className="flex-1 p-4">
          <GameTypeInDevelopment 
            gameTypeCode={game.selected_game_type_code} 
            onBack={() => navigate('/')}
          />
        </main>
      </div>
    );
  }

  // RIVIERES Dashboard - lazy loaded
  if (game.selected_game_type_code === 'RIVIERES' && game.current_session_game_id) {
    return (
      <>
        {cinematicOverlay}
        <Suspense fallback={<DashboardLoadingFallback />}>
          <div className="min-h-screen flex flex-col bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--secondary))] to-[hsl(var(--background))]">
            <PlayerHeader game={game} player={player} animationsEnabled={animationsEnabled} onToggleAnimations={toggleAnimations} />
            <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
              <PlayerRivieresDashboard
                gameId={game.id}
                sessionGameId={game.current_session_game_id}
                playerId={player.id}
                playerNumber={player.playerNumber}
                playerToken={player.playerToken || ''}
                clan={player.clan}
                jetons={player.jetons}
                gameStatus={game.status}
                displayName={player.displayName}
                animationsEnabled={animationsEnabled}
              />
            </main>
          </div>
        </Suspense>
      </>
    );
  }

  // INFECTION Dashboard - lazy loaded
  if (game.selected_game_type_code === 'INFECTION') {
    return (
      <>
        {cinematicOverlay}
        <Suspense fallback={<DashboardLoadingFallback />}>
          <PlayerInfectionDashboard 
            game={game} 
            player={{
              id: player.id,
              display_name: player.displayName,
              player_number: player.playerNumber,
              clan: player.clan,
              jetons: player.jetons,
              pvic: player.pvic ?? 0,
              is_alive: player.isAlive ?? true,
              role_code: player.roleCode,
              team_code: player.teamCode,
              immune_permanent: player.immunePermanent ?? false,
            }}
            onLeave={handleLeave}
            animationsEnabled={animationsEnabled}
          />
        </Suspense>
      </>
    );
  }

  // SHERIFF Dashboard - lazy loaded
  if (game.selected_game_type_code === 'SHERIFF') {
    return (
      <>
        {cinematicOverlay}
        <Suspense fallback={<DashboardLoadingFallback />}>
          <PlayerSheriffDashboard 
            game={game}
            player={{
              id: player.id,
              display_name: player.displayName,
              player_number: player.playerNumber,
              clan: player.clan,
              mate_num: player.mateNum,
              jetons: player.jetons,
              pvic: player.pvic ?? 0,
            }}
            onLeave={handleLeave}
            animationsEnabled={animationsEnabled}
          />
        </Suspense>
      </>
    );
  }

  // FORET Dashboard - lazy loaded
  if (game.selected_game_type_code === 'FORET') {
    return (
      <>
        {cinematicOverlay}
        <Suspense fallback={<DashboardLoadingFallback />}>
          <PlayerForetDashboard
            game={game}
            player={player}
            onLeaveGame={handleLeave}
            showStartAnimation={showStartAnimation && animationsEnabled}
            animationsEnabled={animationsEnabled}
          />
        </Suspense>
      </>
    );
  }

  // LION Dashboard - lazy loaded
  if (game.selected_game_type_code === 'LION' && game.current_session_game_id) {
    return (
      <>
        {cinematicOverlay}
        <Suspense fallback={<DashboardLoadingFallback />}>
          <PlayerLionDashboard
            game={{
              id: game.id,
              current_session_game_id: game.current_session_game_id,
            }}
            player={{
              id: player.id,
              display_name: player.displayName,
              user_id: null, // Anonymous players
            }}
          />
        </Suspense>
      </>
    );
  }

  // Fallback - should never reach here if IMPLEMENTED_GAME_TYPES is correct
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4 bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Zap className="h-8 w-8" />
        <span className="text-xl font-semibold">Type de jeu non pris en charge</span>
      </div>
      <ForestButton onClick={() => navigate('/')}>
        Retour à l'accueil
      </ForestButton>
    </div>
  );
}
