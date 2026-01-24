import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGameTheme } from '@/contexts/ThemeContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ForestButton } from '@/components/ui/ForestButton';
import { QRCodeDisplay } from '@/components/game/QRCodeDisplay';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { GameTypeInDevelopment } from '@/components/game/GameTypeInDevelopment';
import { GameStartAnimation } from '@/components/game/GameStartAnimation';
import { GameTransitionAnimation } from '@/components/game/GameTransitionAnimation';
import { InviteFriendsModal } from '@/components/game/InviteFriendsModal';
import { MJPlayersTab } from './MJPlayersTab';
import { MJBetsTab } from './MJBetsTab';
import { MJPhase2Tab } from './MJPhase2Tab';
import { MJInventoryTab } from './MJInventoryTab';
import { MJCombatTab } from './MJCombatTab';
import { MJEventsTab } from './MJEventsTab';
import { MJMonstersConfigTab } from './MJMonstersConfigTab';
import { MJItemsShopTab } from './MJItemsShopTab';
import { MJShopPhaseTab } from './MJShopPhaseTab';
import MJTeamChatViewer from './MJTeamChatViewer';
import MJLobbyChatViewer from './MJLobbyChatViewer';
import { MJRivieresDashboard } from '@/components/rivieres/MJRivieresDashboard';
import { MJInfectionDashboard } from '@/components/infection/MJInfectionDashboard';
import { MJSheriffDashboard } from '@/components/sheriff/MJSheriffDashboard';
import { MJActionsMenu } from './MJActionsMenu';
import { LandscapeModePrompt } from './LandscapeModePrompt';
import {
  ChevronLeft, Loader2, Users, 
  MessageSquare, Copy, Check, Edit2, X, Save, Coins, Package,
  Bug, Store, Swords, Target, UserPlus
} from 'lucide-react';

import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { UserAvatarButton } from '@/components/ui/UserAvatarButton';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

// Implemented game types
const IMPLEMENTED_GAME_TYPES = ['FORET', 'RIVIERES', 'INFECTION', 'SHERIFF'];


interface Game {
  id: string;
  name: string;
  join_code: string;
  status: string;
  manche_active: number;
  phase: string;
  phase_locked: boolean;
  starting_tokens: number;
  x_nb_joueurs: number;
  sens_depart_egalite: string;
  created_at: string;
  current_session_game_id: string | null;
  mode: string;
  adventure_id: string | null;
  current_step_index: number;
  selected_game_type_code: string | null;
}

interface MJDashboardProps {
  game: Game;
  onBack: () => void;
}

export function MJDashboard({ game: initialGame, onBack }: MJDashboardProps) {
  const { user } = useAuth();
  const [game, setGame] = useState<Game>(initialGame);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState(game.name);
  const [saving, setSaving] = useState(false);
  const [advancingStep, setAdvancingStep] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [totalAdventureSteps, setTotalAdventureSteps] = useState(3);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  
  // Apply game-specific theme
  useGameTheme(game.selected_game_type_code);
  
  // Start animation state
  const [showStartAnimation, setShowStartAnimation] = useState(false);
  const previousGameStatusRef = useRef<string>(initialGame.status);
  
  // Transition animation state
  const [showTransitionAnimation, setShowTransitionAnimation] = useState(false);
  const [transitionFromGame, setTransitionFromGame] = useState<'FORET' | 'RIVIERES' | 'INFECTION'>('FORET');
  const [transitionToGame, setTransitionToGame] = useState<'FORET' | 'RIVIERES' | 'INFECTION'>('FORET');
  const previousStepIndexRef = useRef<number>(initialGame.current_step_index);
  
  const isAdventure = game.mode === 'ADVENTURE' && game.adventure_id;

  // Detect game start transition for FORET animation
  useEffect(() => {
    if (previousGameStatusRef.current === 'LOBBY' && game.status === 'IN_GAME' && 
        (game.selected_game_type_code === 'FORET' || !game.selected_game_type_code)) {
      setShowStartAnimation(true);
      const timer = setTimeout(() => setShowStartAnimation(false), 3000);
      return () => clearTimeout(timer);
    }
    previousGameStatusRef.current = game.status;
  }, [game.status, game.selected_game_type_code]);

  // Detect step change for transition animation
  useEffect(() => {
    if (isAdventure && previousStepIndexRef.current < game.current_step_index) {
      // Get previous and current game type
      const fetchGameTypes = async () => {
        const { data: steps } = await supabase
          .from('adventure_steps')
          .select('step_index, game_type_code')
          .eq('adventure_id', game.adventure_id!)
          .in('step_index', [previousStepIndexRef.current, game.current_step_index])
          .order('step_index');
        
        if (steps && steps.length >= 2) {
          const fromType = steps.find(s => s.step_index === previousStepIndexRef.current)?.game_type_code;
          const toType = steps.find(s => s.step_index === game.current_step_index)?.game_type_code;
          
          if (fromType && toType) {
            setTransitionFromGame(fromType as any);
            setTransitionToGame(toType as any);
            setShowTransitionAnimation(true);
          }
        }
        previousStepIndexRef.current = game.current_step_index;
      };
      fetchGameTypes();
    }
  }, [game.current_step_index, game.adventure_id, isAdventure]);

  // Fetch adventure total steps
  useEffect(() => {
    if (isAdventure && game.adventure_id) {
      const fetchSteps = async () => {
        const { count } = await supabase
          .from('adventure_steps')
          .select('*', { count: 'exact', head: true })
          .eq('adventure_id', game.adventure_id!);
        if (count) setTotalAdventureSteps(count);
      };
      fetchSteps();
    }
  }, [game.adventure_id, isAdventure]);

  // Fetch player count for animation
  useEffect(() => {
    const fetchPlayerCount = async () => {
      const { count } = await supabase
        .from('game_players')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .eq('is_host', false)
        .eq('status', 'ACTIVE');
      setPlayerCount(count || 0);
    };
    fetchPlayerCount();
  }, [game.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`mj-dashboard-${game.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${game.id}` },
        (payload) => {
          setGame(prev => ({ ...prev, ...payload.new }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'games', filter: `id=eq.${game.id}` },
        () => {
          toast.info('La partie a été supprimée');
          onBack();
        }
      )
      // Listen to game_players changes for player count updates (INSERT/DELETE only, skip heartbeat updates)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` },
        async () => {
          const { count } = await supabase
            .from('game_players')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id)
            .eq('is_host', false)
            .eq('status', 'ACTIVE');
          setPlayerCount(count || 0);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` },
        async () => {
          const { count } = await supabase
            .from('game_players')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id)
            .eq('is_host', false)
            .eq('status', 'ACTIVE');
          setPlayerCount(count || 0);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` },
        async (payload) => {
          // Only recount if status changed (player kicked/removed), skip last_seen updates
          const newPlayer = payload.new as any;
          const oldPlayer = payload.old as any;
          if (newPlayer.status !== oldPlayer.status) {
            const { count } = await supabase
              .from('game_players')
              .select('*', { count: 'exact', head: true })
              .eq('game_id', game.id)
              .eq('is_host', false)
              .eq('status', 'ACTIVE');
            setPlayerCount(count || 0);
          }
        }
      )
      // Listen to session_games for stage transitions
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_games', filter: `session_id=eq.${game.id}` },
        async () => {
          // Refetch game to get updated current_session_game_id
          const { data } = await supabase.from('games').select('*').eq('id', game.id).single();
          if (data) setGame(data as Game);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, onBack]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(game.join_code);
      setCopied(true);
      toast.success('Code copié !');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  const handleUpdateName = async () => {
    if (!editedName.trim()) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({ name: editedName.trim() })
        .eq('id', game.id);

      if (error) throw error;

      setGame(prev => ({ ...prev, name: editedName.trim() }));
      setEditingName(false);
      toast.success('Nom modifié');
    } catch (error) {
      console.error('Error updating name:', error);
      toast.error('Erreur lors de la modification');
    } finally {
      setSaving(false);
    }
  };

  const fetchGame = async () => {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', game.id)
      .single();

    if (data && !error) {
      setGame(data);
    } else if (error) {
      // Game was deleted
      onBack();
    }
  };

  const handleNextRound = async () => {
    const nextManche = game.manche_active + 1;
    try {
      const { error } = await supabase
        .from('games')
        .update({ 
          manche_active: nextManche, 
          phase: 'PHASE1_MISES',
          phase_locked: false
        })
        .eq('id', game.id);

      if (error) throw error;

      // Log the round change
      await supabase.from('logs_mj').insert({
        game_id: game.id,
        manche: nextManche,
        action: 'NOUVELLE_MANCHE',
        details: `Passage manuel à la manche ${nextManche}`,
      });

      await supabase.from('logs_joueurs').insert({
        game_id: game.id,
        manche: nextManche,
        type: 'PHASE',
        message: `🔄 Nouvelle manche ${nextManche} - Phase 1 : Mises`,
      });

      await supabase.from('session_events').insert({
        game_id: game.id,
        type: 'ROUND_CHANGE',
        audience: 'ALL',
        message: `Nouvelle manche ${nextManche}`,
        payload: { manche: nextManche, phase: 'PHASE1_MISES' },
      });

      toast.success(`Passage à la manche ${nextManche}`);
    } catch (error) {
      console.error('Error advancing round:', error);
      toast.error('Erreur lors du passage à la manche suivante');
    }
  };

  const handleDeleteGame = async () => {
    setDeleting(true);
    try {
      const tablesToClear = [
        'session_events',
        'session_bans',
        'pending_effects',
        'positions_finales',
        'round_bets',
        'actions',
        'inventory',
        'logs_joueurs',
        'logs_mj',
        'battlefield',
        'monsters',
        'combat_config',
        'shop_catalogue',
        'game_state_monsters',
        'game_monsters',
        'priority_rankings',
        'game_shop_offers',
        'shop_requests',
        'game_item_purchases',
        'game_events',
        'game_players',
      ];

      for (const table of tablesToClear) {
        await (supabase.from(table as any).delete().eq('game_id', game.id));
      }

      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', game.id);

      if (error) throw error;

      toast.success('Partie supprimée');
      onBack();
    } catch (error) {
      console.error('Error deleting game:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  const handleNextSessionGame = async () => {
    if (!isAdventure) return;
    
    setAdvancingStep(true);
    try {
      const { data, error } = await supabase.functions.invoke('next-session-game', {
        body: { gameId: game.id },
      });

      if (error) throw error;

      if (data.adventureComplete) {
        toast.success("🏆 L'aventure est terminée !");
      } else {
        toast.success(`Passage à l'étape ${data.stepIndex} : ${data.gameTypeCode}`);
      }
    } catch (error) {
      console.error('Error advancing to next session game:', error);
      toast.error('Erreur lors du passage au jeu suivant');
    } finally {
      setAdvancingStep(false);
    }
  };

  const joinUrl = `${window.location.origin}/join/${game.join_code}`;

  // Check if game type is implemented
  const isGameTypeImplemented = IMPLEMENTED_GAME_TYPES.includes(game.selected_game_type_code || '');

  // Transition animation overlay for adventure mode
  if (showTransitionAnimation) {
    return (
      <GameTransitionAnimation
        fromGameType={transitionFromGame}
        toGameType={transitionToGame}
        stepIndex={game.current_step_index}
        totalSteps={totalAdventureSteps}
        onComplete={() => setShowTransitionAnimation(false)}
      />
    );
  }

  // Start animation overlay for FORET
  if (showStartAnimation) {
    return (
      <GameStartAnimation 
        gameType="FORET" 
        playerCount={playerCount} 
        isMJ={true} 
      />
    );
  }

  // Show "in development" screen for non-implemented game types (only for IN_GAME status)
  if (game.status === 'IN_GAME' && !isGameTypeImplemented) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <ForestButton variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </ForestButton>
          <h2 className="font-display text-xl">{game.name}</h2>
          <GameStatusBadge status={game.status} />
        </div>
        
        <GameTypeInDevelopment 
          gameTypeCode={game.selected_game_type_code} 
          onBack={onBack}
          showBackButton={false}
        />
      </div>
    );
  }

  return (
    <>
    <LandscapeModePrompt storageKey="mj-foret-landscape-dismissed" />
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ForestButton variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </ForestButton>
          
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="h-8 w-48"
                autoFocus
              />
              <ForestButton size="sm" onClick={handleUpdateName} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </ForestButton>
              <ForestButton variant="ghost" size="sm" onClick={() => setEditingName(false)}>
                <X className="h-4 w-4" />
              </ForestButton>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl">{game.name}</h2>
              <ForestButton variant="ghost" size="sm" onClick={() => setEditingName(true)}>
                <Edit2 className="h-4 w-4" />
              </ForestButton>
            </div>
          )}
          
          <GameStatusBadge status={game.status} />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg">
            <span className="text-sm text-muted-foreground">Code:</span>
            <span className="font-mono text-lg font-bold text-primary">{game.join_code}</span>
            <ForestButton variant="ghost" size="sm" onClick={handleCopyCode}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </ForestButton>
          </div>
          {game.status === 'LOBBY' && (
            <ForestButton variant="outline" size="sm" onClick={() => setInviteModalOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Inviter</span>
            </ForestButton>
          )}
          <ThemeToggle />
          <UserAvatarButton size="sm" onLeaveGame={onBack} />
        </div>
      </div>

      <InviteFriendsModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        gameId={game.id}
        gameName={game.name}
        joinCode={game.join_code}
      />

      {/* Game info bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 md:gap-3 text-sm">
        {isAdventure && (
          <div className="p-2 md:p-3 bg-primary/20 rounded-lg text-center border border-primary/30">
            <div className="text-muted-foreground text-xs">Étape</div>
            <div className="font-bold text-base md:text-lg">{game.current_step_index}</div>
            <div className="text-xs text-muted-foreground hidden sm:block">{game.selected_game_type_code}</div>
          </div>
        )}
        <div className="p-2 md:p-3 bg-secondary/50 rounded-lg text-center">
          <div className="text-muted-foreground text-xs">Manche</div>
          <div className="font-bold text-base md:text-lg">{game.manche_active}</div>
        </div>
        <div className="p-2 md:p-3 bg-secondary/50 rounded-lg text-center">
          <div className="text-muted-foreground text-xs">Phase</div>
          <div className="font-bold text-xs md:text-sm">{game.phase.replace('PHASE', 'P').replace('_', ' ')}</div>
        </div>
        <div className="p-2 md:p-3 bg-secondary/50 rounded-lg text-center">
          <div className="text-muted-foreground text-xs">Verrouillée</div>
          <div className="font-bold text-sm">{game.phase_locked ? 'Oui' : 'Non'}</div>
        </div>
        <div className="p-2 md:p-3 bg-secondary/50 rounded-lg text-center">
          <div className="text-muted-foreground text-xs">Jetons</div>
          <div className="font-bold text-sm">{game.starting_tokens}</div>
        </div>
        <div className="p-2 md:p-3 bg-secondary/50 rounded-lg text-center">
          <div className="text-muted-foreground text-xs">Max</div>
          <div className="font-bold text-sm">{game.x_nb_joueurs || '∞'}</div>
        </div>
      </div>

      {/* Action buttons - now using MJActionsMenu */}
      <MJActionsMenu
        gameId={game.id}
        gameName={game.name}
        gameStatus={game.status}
        gameTypeCode={game.selected_game_type_code}
        sessionGameId={game.current_session_game_id}
        startingTokens={game.starting_tokens}
        isAdventure={!!isAdventure}
        currentStepIndex={game.current_step_index}
        advancingStep={advancingStep}
        deleting={deleting}
        onNextSessionGame={handleNextSessionGame}
        onDeleteGame={handleDeleteGame}
      />
      {/* QR Code (collapsible on mobile) */}
      {game.status === 'LOBBY' && (
        <details className="card-gradient rounded-lg border border-border p-4">
          <summary className="cursor-pointer font-medium flex items-center gap-2">
            📱 QR Code pour rejoindre
          </summary>
          <div className="mt-4 flex justify-center">
            <QRCodeDisplay joinCode={game.join_code} />
          </div>
        </details>
      )}

      {/* Lobby Chat Viewer - available for all game types */}
      <div className="card-gradient rounded-lg border border-border p-4">
        <MJLobbyChatViewer gameId={game.id} />
      </div>
      {/* RIVIERES Dashboard - In-game mode */}
      {game.selected_game_type_code === 'RIVIERES' && game.current_session_game_id && (
        <MJRivieresDashboard 
          gameId={game.id} 
          sessionGameId={game.current_session_game_id}
          isAdventure={!!isAdventure}
          onNextGame={isAdventure ? handleNextSessionGame : undefined}
          gameStatus={game.status}
        />
      )}

      {/* RIVIERES Lobby - Show player management when no session exists yet */}
      {game.selected_game_type_code === 'RIVIERES' && !game.current_session_game_id && (
        <Tabs defaultValue="players" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="players" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>Joueurs</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span>Événements</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="players">
            <MJPlayersTab game={game} onGameUpdate={fetchGame} />
          </TabsContent>
          <TabsContent value="events">
            <MJEventsTab game={game} />
          </TabsContent>
        </Tabs>
      )}

      {/* INFECTION Dashboard */}
      {game.selected_game_type_code === 'INFECTION' && (
        <MJInfectionDashboard game={game} onBack={onBack} />
      )}

      {/* SHERIFF Dashboard */}
      {game.selected_game_type_code === 'SHERIFF' && (
        <MJSheriffDashboard game={game} onBack={onBack} />
      )}

      {/* FORET Tabs (original) - Only show for FORET games or when no game type is selected */}
      {(game.selected_game_type_code === 'FORET' || !game.selected_game_type_code) ? (
      <Tabs defaultValue="players" className="w-full">
        {/* Primary tabs - 4 cols on mobile, 8 on desktop */}
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 h-auto">
          <TabsTrigger value="players" className="flex items-center gap-1 py-2 px-1 sm:px-3">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Joueurs</span>
          </TabsTrigger>
          <TabsTrigger value="bets" className="flex items-center gap-1 py-2 px-1 sm:px-3">
            <Coins className="h-4 w-4" />
            <span className="hidden sm:inline">Phase 1</span>
          </TabsTrigger>
          <TabsTrigger value="phase2" className="flex items-center gap-1 py-2 px-1 sm:px-3">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Phase 2</span>
          </TabsTrigger>
          <TabsTrigger value="shop" className="flex items-center gap-1 py-2 px-1 sm:px-3">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Phase 3</span>
          </TabsTrigger>
          <TabsTrigger value="monsters" className="flex items-center gap-1 py-2 px-1 sm:px-3">
            <Bug className="h-4 w-4" />
            <span className="hidden md:inline">Monstres</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-1 py-2 px-1 sm:px-3">
            <Package className="h-4 w-4" />
            <span className="hidden md:inline">Inventaires</span>
          </TabsTrigger>
          <TabsTrigger value="combat" className="flex items-center gap-1 py-2 px-1 sm:px-3">
            <Swords className="h-4 w-4" />
            <span className="hidden md:inline">Combat</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-1 py-2 px-1 sm:px-3">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden md:inline">Events</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="mt-6">
          <MJPlayersTab game={game} onGameUpdate={fetchGame} />
        </TabsContent>

        <TabsContent value="bets" className="mt-6">
          <MJBetsTab game={game} onGameUpdate={fetchGame} />
        </TabsContent>

        <TabsContent value="phase2" className="mt-6">
          <MJPhase2Tab game={game} onGameUpdate={fetchGame} />
        </TabsContent>

        <TabsContent value="shop" className="mt-6">
          <div className="space-y-6">
            <MJShopPhaseTab game={game} />
            <hr className="border-border" />
            <MJItemsShopTab game={game} />
          </div>
        </TabsContent>

        <TabsContent value="monsters" className="mt-6">
          <MJMonstersConfigTab game={game} />
        </TabsContent>

        <TabsContent value="inventory" className="mt-6">
          <MJInventoryTab game={game} />
        </TabsContent>

        <TabsContent value="combat" className="mt-6">
          <MJCombatTab 
            game={game} 
            isAdventure={!!isAdventure}
            onNextGame={isAdventure ? handleNextSessionGame : undefined}
          />
        </TabsContent>

        <TabsContent value="events" className="mt-6">
          <MJEventsTab game={game} />
          <div className="mt-6">
            <MJTeamChatViewer gameId={game.id} />
          </div>
        </TabsContent>
      </Tabs>
      ) : null}
    </div>
    </>
  );
}
