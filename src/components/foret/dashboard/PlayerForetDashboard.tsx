import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Swords, MessageSquare, Package, Zap, BookOpen, ChevronUp, ChevronDown } from 'lucide-react';

import { GameStartAnimation } from '@/components/game/GameStartAnimation';
import { CombatHistorySummarySheet } from '@/components/mj/presentation/CombatHistorySummarySheet';
import { usePresentationAnimations, PhaseTransitionOverlay, CoupDeGraceOverlay } from '@/components/game/PresentationAnimations';
import { ForetAutoCountdownOverlay } from '@/components/foret/ForetAutoCountdownOverlay';

import { PlayerHeader } from '@/components/player/PlayerHeader';
import { EventsFeed } from '@/components/player/EventsFeed';
import { BattlefieldView } from '@/components/player/BattlefieldView';
import { PlayerInventory } from '@/components/player/PlayerInventory';
import { ResultsPanel } from '@/components/player/ResultsPanel';
import { PositionsRankingPanel } from '@/components/player/PositionsRankingPanel';
import { CombatResultsPanel } from '@/components/player/CombatResultsPanel';
import { ForestFinalRanking } from '@/components/player/ForestFinalRanking';
import { PlayerActionTabs } from '@/components/player/PlayerActionTabs';
import { MancheSelector } from '@/components/player/MancheSelector';
import { ItemsCatalogPanel } from '@/components/player/ItemsCatalogPanel';
import TeamChat from '@/components/player/TeamChat';

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

interface PlayerForetDashboardProps {
  game: Game;
  player: Player;
  onLeaveGame: () => void;
  showStartAnimation: boolean;
  animationsEnabled?: boolean;
}

export function PlayerForetDashboard({ 
  game, 
  player, 
  onLeaveGame,
  showStartAnimation,
  animationsEnabled = true,
}: PlayerForetDashboardProps) {
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState('battle');
  const [selectedManche, setSelectedManche] = useState<number>(game.manche_active);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [showCatalog, setShowCatalog] = useState(false);

  // Auto countdown state (read-only for players)
  const [foretAutoCountdown, setForetAutoCountdown] = useState<{ type: string | null; endsAt: Date | null }>({ type: null, endsAt: null });

  // Auto-reset to current manche when game.manche_active changes
  useEffect(() => {
    if (game.manche_active) {
      setSelectedManche(game.manche_active);
    }
  }, [game.manche_active]);

  // Subscribe to auto countdown updates
  useEffect(() => {
    if (!game.current_session_game_id) return;

    const fetchAutoState = async () => {
      const { data } = await supabase
        .from('session_games')
        .select('auto_countdown_type, auto_countdown_ends_at')
        .eq('id', game.current_session_game_id!)
        .single();
      
      if (data) {
        setForetAutoCountdown({
          type: data.auto_countdown_type,
          endsAt: data.auto_countdown_ends_at ? new Date(data.auto_countdown_ends_at) : null,
        });
      }
    };

    fetchAutoState();

    const channel = supabase
      .channel(`player-foret-auto-${game.current_session_game_id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'session_games',
        filter: `id=eq.${game.current_session_game_id}`,
      }, (payload) => {
        const data = payload.new as { auto_countdown_type: string | null; auto_countdown_ends_at: string | null };
        setForetAutoCountdown({
          type: data.auto_countdown_type,
          endsAt: data.auto_countdown_ends_at ? new Date(data.auto_countdown_ends_at) : null,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [game.current_session_game_id]);

  // Presentation animations (phase transitions, coup de grâce)
  const {
    showPhaseTransition,
    phaseTransitionText,
    showCoupDeGrace,
    coupDeGraceInfo,
  } = usePresentationAnimations({
    gameId: game.id,
    sessionGameId: game.current_session_game_id || null,
    phase: game.phase,
    enabled: game.status === 'IN_GAME',
  });

  // Start animation overlay
  if (showStartAnimation) {
    // Note: GameStartAnimation auto-dismisses after 3s, handled by parent
    return (
      <GameStartAnimation 
        gameType="FORET" 
        playerName={player.displayName} 
        isMJ={false}
      />
    );
  }

  // Desktop layout
  if (!isMobile) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Phase Transition Animation Overlay */}
        {animationsEnabled && <PhaseTransitionOverlay show={showPhaseTransition} text={phaseTransitionText} />}
        
        {/* Coup de Grâce Animation Overlay */}
        {animationsEnabled && <CoupDeGraceOverlay show={showCoupDeGrace} info={coupDeGraceInfo} />}
        
        {/* Forêt Auto Mode Countdown Overlay */}
        {foretAutoCountdown.type && (
          <ForetAutoCountdownOverlay
            countdownEndsAt={foretAutoCountdown.endsAt}
            countdownType={foretAutoCountdown.type}
          />
        )}
        
        <PlayerHeader game={game} player={player} onLeaveGame={onLeaveGame} />

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
                sessionGameId={game.current_session_game_id}
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

  // Mobile layout with tabs
  return (
    <div className="min-h-screen flex flex-col">
      {/* Phase Transition Animation Overlay */}
      {animationsEnabled && <PhaseTransitionOverlay show={showPhaseTransition} text={phaseTransitionText} />}
      
      {/* Coup de Grâce Animation Overlay */}
      {animationsEnabled && <CoupDeGraceOverlay show={showCoupDeGrace} info={coupDeGraceInfo} />}
      
      <PlayerHeader game={game} player={player} onLeaveGame={onLeaveGame} />

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
              sessionGameId={game.current_session_game_id}
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
              <span className="text-xs">Events</span>
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
              <span className="text-xs">Actions</span>
            </TabsTrigger>
            {player.mateNum && (
              <TabsTrigger
                value="chat"
                className="flex flex-col items-center gap-1 data-[state=active]:bg-primary/10 relative"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs">Chat</span>
                {unreadChatCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold px-1.5 rounded-full min-w-[18px] text-center">
                    {unreadChatCount}
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
