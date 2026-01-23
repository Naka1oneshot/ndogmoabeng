import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePlayerPresence } from '@/hooks/usePlayerPresence';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGameTheme } from '@/contexts/ThemeContext';
import { Loader2, LogOut, Swords, MessageSquare, Package, Zap, Clock, ShoppingBag, Users, BookOpen, ChevronUp, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ForestButton } from '@/components/ui/ForestButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { GameStartAnimation } from '@/components/game/GameStartAnimation';
import { GameTransitionAnimation } from '@/components/game/GameTransitionAnimation';
import { CombatHistorySummarySheet } from '@/components/mj/presentation/CombatHistorySummarySheet';
import { usePresentationAnimations, PhaseTransitionOverlay, CoupDeGraceOverlay } from '@/components/game/PresentationAnimations';

import { PlayerHeader } from '@/components/player/PlayerHeader';
import { EventsFeed } from '@/components/player/EventsFeed';
import { BattlefieldView } from '@/components/player/BattlefieldView';
import { PlayerInventory } from '@/components/player/PlayerInventory';
import { PhasePanel } from '@/components/player/PhasePanel';
import { ResultsPanel } from '@/components/player/ResultsPanel';
import { PositionsRankingPanel } from '@/components/player/PositionsRankingPanel';
import { CombatResultsPanel } from '@/components/player/CombatResultsPanel';
import { ForestFinalRanking } from '@/components/player/ForestFinalRanking';
import { PlayerActionTabs } from '@/components/player/PlayerActionTabs';
import { MancheSelector } from '@/components/player/MancheSelector';
import { ItemsCatalogPanel } from '@/components/player/ItemsCatalogPanel';
import TeamChat from '@/components/player/TeamChat';
import { GameTypeInDevelopment } from '@/components/game/GameTypeInDevelopment';
import { PlayerRivieresDashboard } from '@/components/rivieres/PlayerRivieresDashboard';
import { PlayerInfectionDashboard } from '@/components/infection/PlayerInfectionDashboard';
import LobbyWaitingRoom from '@/components/lobby/LobbyWaitingRoom';

// Implemented game types
const IMPLEMENTED_GAME_TYPES = ['FORET', 'RIVIERES', 'INFECTION'];

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
  const isMobile = useIsMobile();

  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileTab, setMobileTab] = useState('battle');
  const [selectedManche, setSelectedManche] = useState<number>(1);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [showCatalog, setShowCatalog] = useState(false);
  
  // Apply game-specific theme
  useGameTheme(game?.selected_game_type_code);
  
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
  const isForetGame = game?.selected_game_type_code === 'FORET' || (!game?.selected_game_type_code && game?.status === 'IN_GAME');

  // Presentation animations (phase transitions, coup de grâce)
  const {
    showPhaseTransition,
    phaseTransitionText,
    showCoupDeGrace,
    coupDeGraceInfo,
  } = usePresentationAnimations({
    gameId: gameId || '',
    sessionGameId: game?.current_session_game_id || null,
    phase: game?.phase || '',
    enabled: isForetGame && game?.status === 'IN_GAME',
  });

  // Auto-reset to current manche when game.manche_active changes
  useEffect(() => {
    if (game?.manche_active) {
      setSelectedManche(game.manche_active);
    }
  }, [game?.manche_active]);

  // Detect game start transition for FORET animation
  useEffect(() => {
    if (previousGameStatusRef.current === 'LOBBY' && game?.status === 'IN_GAME' && 
        (game.selected_game_type_code === 'FORET' || !game.selected_game_type_code)) {
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
      // Step changed - fetch game types and show animation
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

    // Check if token is passed via URL query param (reconnection link)
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      // Store the token in localStorage and remove from URL
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

  const validateAndFetch = async (playerToken: string) => {
    try {
      const { data, error: validateError } = await supabase.functions.invoke('validate-player', {
        body: { gameId, playerToken },
      });

      if (validateError || !data?.valid) {
        localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);

        if (data?.removed) {
          toast.error(data.error || 'Vous avez été expulsé de cette partie');
          navigate('/');
          return;
        }

        redirectToJoin();
        return;
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

      subscribeToUpdates(playerToken);
    } catch (err) {
      console.error('Validation error:', err);
      setError('Erreur de validation');
      setLoading(false);
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

          // Check if current player was removed
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

          // Update player stats if it's our player
          setPlayer((prev) => {
            if (!prev) return prev;
            // Check if this update is for our player by comparing player_number
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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

  // Lobby view
  if (game.status === 'LOBBY') {
    return (
      <div className="min-h-screen flex flex-col">
        <PlayerHeader game={game} player={player} />
        <main className="flex-1 p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Header card */}
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

            {/* Players list and Chat */}
            <LobbyWaitingRoom
              gameId={game.id}
              playerNum={player.playerNumber}
              playerName={player.displayName}
            />

            {/* Leave button */}
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
    );
  }

  // Ended view
  if (game.status === 'ENDED' || game.status === 'FINISHED') {
    return (
      <div className="min-h-screen flex flex-col">
        <PlayerHeader game={game} player={player} />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="card-gradient rounded-lg border border-border p-8 text-center max-w-md">
            <div className="text-5xl mb-4">🏁</div>
            <h2 className="font-display text-xl mb-2">Partie terminée</h2>
            <p className="text-muted-foreground mb-4">Merci d'avoir joué !</p>
            <div className="flex gap-4 justify-center text-sm">
              <div className="bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded">
                {player.jetons} jetons
              </div>
              <div className="bg-amber-500/10 text-amber-500 px-4 py-2 rounded">
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

  // Check if game type is implemented
  const isGameTypeImplemented = IMPLEMENTED_GAME_TYPES.includes(game.selected_game_type_code || '');

  // Show "in development" screen for non-implemented game types
  if (!isGameTypeImplemented) {
    return (
      <div className="min-h-screen flex flex-col">
        <PlayerHeader game={game} player={player} />
        <main className="flex-1 p-4">
          <GameTypeInDevelopment 
            gameTypeCode={game.selected_game_type_code} 
            onBack={() => navigate('/')}
          />
        </main>
      </div>
    );
  }

  // RIVIERES Dashboard
  if (game.selected_game_type_code === 'RIVIERES' && game.current_session_game_id) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0B1020] via-[#151B2D] to-[#0B1020]">
        <PlayerHeader game={game} player={player} />
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
          />
        </main>
      </div>
    );
  }

  // INFECTION Dashboard
  if (game.selected_game_type_code === 'INFECTION') {
    return (
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
      />
    );
  }

  // Start animation overlay for FORET
  if (showStartAnimation) {
    return (
      <GameStartAnimation 
        gameType="FORET" 
        playerName={player.displayName} 
        isMJ={false} 
      />
    );
  }

  if (!isMobile) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Phase Transition Animation Overlay */}
        <PhaseTransitionOverlay show={showPhaseTransition} text={phaseTransitionText} />
        
        {/* Coup de Grâce Animation Overlay */}
        <CoupDeGraceOverlay show={showCoupDeGrace} info={coupDeGraceInfo} />
        
        <PlayerHeader game={game} player={player} onLeaveGame={handleLeave} />

        <main className="flex-1 p-4">
          <div className="max-w-7xl mx-auto grid grid-cols-3 gap-4 h-[calc(100vh-120px)]">
            {/* Left column: Events + Team Chat */}
            <div className="flex flex-col overflow-hidden h-full">
              <EventsFeed gameId={game.id} className="flex-1 min-h-0 overflow-hidden" />
              {player.mateNum && (
                <div className="h-64 flex-shrink-0 mt-4 card-gradient rounded-lg border border-border overflow-hidden relative">
                  {unreadChatCount > 0 && (
                    <div className="absolute top-2 right-2 z-10 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                      {unreadChatCount} nouveau{unreadChatCount > 1 ? 'x' : ''} message{unreadChatCount > 1 ? 's' : ''}
                    </div>
                  )}
                  <TeamChat
                    gameId={game.id}
                    playerNum={player.playerNumber}
                    playerName={player.displayName}
                    mateNum={player.mateNum}
                    onUnreadChange={setUnreadChatCount}
                    isVisible={true}
                  />
                </div>
              )}
            </div>

            {/* Center column: Battlefield + Results */}
            <div className="space-y-4 overflow-auto">
              <BattlefieldView gameId={game.id} sessionGameId={game.current_session_game_id} />
              
              {/* Forest Final Ranking */}
              <ForestFinalRanking 
                gameId={game.id} 
                sessionGameId={game.current_session_game_id}
                currentPlayerNumber={player.playerNumber}
              />
              
              {/* Manche Selector + History Button */}
              <div className="card-gradient rounded-lg border border-border p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Historique</span>
                  <MancheSelector
                    currentManche={game.manche_active}
                    selectedManche={selectedManche}
                    onMancheChange={setSelectedManche}
                  />
                </div>
                <CombatHistorySummarySheet gameId={game.id} sessionGameId={game.current_session_game_id} />
              </div>

              <PositionsRankingPanel 
                game={game} 
                currentPlayerNumber={player.playerNumber}
                selectedManche={selectedManche}
                sessionGameId={game.current_session_game_id}
              />
              <CombatResultsPanel game={game} selectedManche={selectedManche} sessionGameId={game.current_session_game_id} />
              <ResultsPanel
                gameId={game.id}
                sessionGameId={game.current_session_game_id}
                manche={game.manche_active}
                selectedManche={selectedManche}
                phase={game.phase}
                phaseLocked={game.phase_locked}
              />
            </div>

            {/* Right column: Inventory + Catalog + Phase */}
            <div className="space-y-4 overflow-auto">
              <PlayerInventory
                gameId={game.id}
                playerNumber={player.playerNumber}
                jetons={player.jetons}
                recompenses={player.recompenses}
                clan={player.clan}
                mateNum={player.mateNum}
              />
              
              {/* Collapsible Catalog Toggle */}
              <Collapsible open={showCatalog} onOpenChange={setShowCatalog}>
                <div className="card-gradient rounded-lg border border-border">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors rounded-lg">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">Catalogue des Objets</span>
                      </div>
                      {showCatalog ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0">
                      <ItemsCatalogPanel playerClan={player.clan} />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
              
              <PlayerActionTabs game={game} player={player} />
            </div>
          </div>
        </main>

      </div>
    );
  }

  // In-game view - Mobile with tabs
  return (
    <div className="min-h-screen flex flex-col">
      {/* Phase Transition Animation Overlay */}
      <PhaseTransitionOverlay show={showPhaseTransition} text={phaseTransitionText} />
      
      {/* Coup de Grâce Animation Overlay */}
      <CoupDeGraceOverlay show={showCoupDeGrace} info={coupDeGraceInfo} />
      
      <PlayerHeader game={game} player={player} onLeaveGame={handleLeave} />

      <main className="flex-1 pb-16">
        <Tabs value={mobileTab} onValueChange={setMobileTab} className="h-full">
          <TabsContent value="battle" className="p-4 space-y-4 mt-0">
            <BattlefieldView gameId={game.id} sessionGameId={game.current_session_game_id} />
            
            {/* Forest Final Ranking - Mobile */}
            <ForestFinalRanking 
              gameId={game.id} 
              sessionGameId={game.current_session_game_id}
              currentPlayerNumber={player.playerNumber}
            />
            
            {/* Manche Selector + History Button - Mobile */}
            <div className="card-gradient rounded-lg border border-border p-3 flex items-center justify-between gap-2">
              <MancheSelector
                currentManche={game.manche_active}
                selectedManche={selectedManche}
                onMancheChange={setSelectedManche}
              />
              <CombatHistorySummarySheet gameId={game.id} sessionGameId={game.current_session_game_id} />
            </div>

            <PositionsRankingPanel 
              game={game} 
              currentPlayerNumber={player.playerNumber}
              selectedManche={selectedManche}
              sessionGameId={game.current_session_game_id}
            />
            <CombatResultsPanel game={game} selectedManche={selectedManche} sessionGameId={game.current_session_game_id} />
            <ResultsPanel
              gameId={game.id}
              sessionGameId={game.current_session_game_id}
              manche={game.manche_active}
              selectedManche={selectedManche}
              phase={game.phase}
              phaseLocked={game.phase_locked}
            />
          </TabsContent>

          <TabsContent value="events" className="p-4 mt-0">
            <EventsFeed gameId={game.id} />
          </TabsContent>

          <TabsContent value="inventory" className="p-4 mt-0 space-y-4">
            <PlayerInventory
              gameId={game.id}
              playerNumber={player.playerNumber}
              jetons={player.jetons}
              recompenses={player.recompenses}
              clan={player.clan}
              mateNum={player.mateNum}
            />
            <div className="card-gradient rounded-lg border border-border p-4">
              <ItemsCatalogPanel playerClan={player.clan} />
            </div>
          </TabsContent>

          <TabsContent value="phase" className="p-4 mt-0 space-y-4">
            <PlayerActionTabs game={game} player={player} />
          </TabsContent>

          {player.mateNum && (
            <TabsContent value="chat" className="p-4 mt-0 h-[calc(100vh-180px)]">
              <div className="h-full card-gradient rounded-lg border border-border overflow-hidden">
                <TeamChat
                  gameId={game.id}
                  playerNum={player.playerNumber}
                  playerName={player.displayName}
                  mateNum={player.mateNum}
                  onUnreadChange={setUnreadChatCount}
                  isVisible={mobileTab === 'chat'}
                />
              </div>
            </TabsContent>
          )}

          {/* Fixed bottom tabs */}
          <TabsList className={`fixed bottom-0 left-0 right-0 h-14 grid ${player.mateNum ? 'grid-cols-5' : 'grid-cols-4'} bg-background/95 backdrop-blur border-t border-border rounded-none`}>
            <TabsTrigger
              value="battle"
              className="flex flex-col items-center gap-1 data-[state=active]:bg-primary/10"
            >
              <Swords className="h-4 w-4" />
              <span className="text-xs">Bataille</span>
            </TabsTrigger>
            <TabsTrigger
              value="events"
              className="flex flex-col items-center gap-1 data-[state=active]:bg-primary/10"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="text-xs">Événements</span>
            </TabsTrigger>
            <TabsTrigger
              value="inventory"
              className="flex flex-col items-center gap-1 data-[state=active]:bg-primary/10"
            >
              <Package className="h-4 w-4" />
              <span className="text-xs">Inventaire</span>
            </TabsTrigger>
            <TabsTrigger
              value="phase"
              className="flex flex-col items-center gap-1 data-[state=active]:bg-primary/10"
            >
              <Zap className="h-4 w-4" />
              <span className="text-xs">Phase</span>
            </TabsTrigger>
            {player.mateNum && (
              <TabsTrigger
                value="chat"
                className="flex flex-col items-center gap-1 data-[state=active]:bg-primary/10 relative"
              >
                <Users className="h-4 w-4" />
                <span className="text-xs">Chat</span>
                {unreadChatCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1">
                    {unreadChatCount > 99 ? '99+' : unreadChatCount}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </main>
    </div>
  );
}