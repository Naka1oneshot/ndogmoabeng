import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePlayerPresence } from '@/hooks/usePlayerPresence';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2, LogOut, Swords, MessageSquare, Package, Zap, Clock, ShoppingBag, Users } from 'lucide-react';
import { ForestButton } from '@/components/ui/ForestButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

import { PlayerHeader } from '@/components/player/PlayerHeader';
import { EventsFeed } from '@/components/player/EventsFeed';
import { BattlefieldView } from '@/components/player/BattlefieldView';
import { PlayerInventory } from '@/components/player/PlayerInventory';
import { PhasePanel } from '@/components/player/PhasePanel';
import { ResultsPanel } from '@/components/player/ResultsPanel';
import { PositionsRankingPanel } from '@/components/player/PositionsRankingPanel';
import { CombatResultsPanel } from '@/components/player/CombatResultsPanel';
import { PlayerActionTabs } from '@/components/player/PlayerActionTabs';
import { MancheSelector } from '@/components/player/MancheSelector';
import TeamChat from '@/components/player/TeamChat';

interface Game {
  id: string;
  name: string;
  status: string;
  join_code: string;
  manche_active: number;
  phase: string;
  phase_locked: boolean;
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
}

const PLAYER_TOKEN_PREFIX = 'ndogmoabeng_player_';

export default function PlayerDashboard() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const isMobile = useIsMobile();

  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileTab, setMobileTab] = useState('battle');
  const [selectedManche, setSelectedManche] = useState<number>(1);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Auto-reset to current manche when game.manche_active changes
  useEffect(() => {
    if (game?.manche_active) {
      setSelectedManche(game.manche_active);
    }
  }, [game?.manche_active]);

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

    const playerToken = localStorage.getItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);

    if (!playerToken) {
      redirectToJoin();
      return;
    }

    validateAndFetch(playerToken);
  }, [gameId]);

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
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="card-gradient rounded-lg border border-border p-8 text-center max-w-md">
            <Clock className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
            <h2 className="font-display text-xl mb-2">Salle d'attente</h2>
            <p className="text-muted-foreground mb-4">
              En attente du Maître du Jeu pour démarrer la partie...
            </p>
            <p className="text-sm text-primary">
              Vous êtes le joueur <strong>#{player.playerNumber}</strong>
            </p>
            <button
              type="button"
              onClick={handleLeave}
              className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors mx-auto"
            >
              <LogOut className="h-4 w-4" />
              Quitter la partie
            </button>
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

  // In-game view - Desktop
  if (!isMobile) {
    return (
      <div className="min-h-screen flex flex-col">
        <PlayerHeader game={game} player={player} />

        <main className="flex-1 p-4">
          <div className="max-w-7xl mx-auto grid grid-cols-3 gap-4 h-[calc(100vh-120px)]">
            {/* Left column: Events + Team Chat */}
            <div className="space-y-4 overflow-hidden flex flex-col">
              <EventsFeed gameId={game.id} className="flex-1 min-h-0" />
              {player.mateNum && (
                <div className="h-64 card-gradient rounded-lg border border-border overflow-hidden relative">
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
              <BattlefieldView gameId={game.id} />
              
              {/* Manche Selector */}
              <div className="card-gradient rounded-lg border border-border p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Historique</span>
                <MancheSelector
                  currentManche={game.manche_active}
                  selectedManche={selectedManche}
                  onMancheChange={setSelectedManche}
                />
              </div>

              <PositionsRankingPanel 
                game={game} 
                currentPlayerNumber={player.playerNumber}
                selectedManche={selectedManche}
              />
              <CombatResultsPanel game={game} selectedManche={selectedManche} />
              <ResultsPanel
                gameId={game.id}
                manche={game.manche_active}
                selectedManche={selectedManche}
                phase={game.phase}
                phaseLocked={game.phase_locked}
              />
            </div>

            {/* Right column: Inventory + Phase */}
            <div className="space-y-4 overflow-auto">
              <PlayerInventory
                gameId={game.id}
                playerNumber={player.playerNumber}
                jetons={player.jetons}
                recompenses={player.recompenses}
                clan={player.clan}
                mateNum={player.mateNum}
              />
              <PlayerActionTabs game={game} player={player} />
            </div>
          </div>
        </main>

        {/* Leave button */}
        <div className="fixed bottom-4 right-4">
          <button
            type="button"
            onClick={handleLeave}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors bg-background/80 backdrop-blur px-3 py-2 rounded-lg border border-border"
          >
            <LogOut className="h-4 w-4" />
            Quitter
          </button>
        </div>
      </div>
    );
  }

  // In-game view - Mobile with tabs
  return (
    <div className="min-h-screen flex flex-col">
      <PlayerHeader game={game} player={player} />

      <main className="flex-1 pb-16">
        <Tabs value={mobileTab} onValueChange={setMobileTab} className="h-full">
          <TabsContent value="battle" className="p-4 space-y-4 mt-0">
            <BattlefieldView gameId={game.id} />
            
            {/* Manche Selector - Mobile */}
            <div className="card-gradient rounded-lg border border-border p-3">
              <MancheSelector
                currentManche={game.manche_active}
                selectedManche={selectedManche}
                onMancheChange={setSelectedManche}
              />
            </div>

            <PositionsRankingPanel 
              game={game} 
              currentPlayerNumber={player.playerNumber}
              selectedManche={selectedManche}
            />
            <CombatResultsPanel game={game} selectedManche={selectedManche} />
            <ResultsPanel
              gameId={game.id}
              manche={game.manche_active}
              selectedManche={selectedManche}
              phase={game.phase}
              phaseLocked={game.phase_locked}
            />
          </TabsContent>

          <TabsContent value="events" className="p-4 mt-0">
            <EventsFeed gameId={game.id} />
          </TabsContent>

          <TabsContent value="inventory" className="p-4 mt-0">
            <PlayerInventory
              gameId={game.id}
              playerNumber={player.playerNumber}
              jetons={player.jetons}
              recompenses={player.recompenses}
              clan={player.clan}
              mateNum={player.mateNum}
            />
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