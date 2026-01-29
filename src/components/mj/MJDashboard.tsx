import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGameTheme } from '@/contexts/ThemeContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ForestButton } from '@/components/ui/ForestButton';
import { QRCodeDisplay } from '@/components/game/QRCodeDisplay';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { AdventureProgressDisplay } from '@/components/game/AdventureProgressDisplay';
import { AdventureTransitionGuide } from './AdventureTransitionGuide';
import { GameTypeInDevelopment } from '@/components/game/GameTypeInDevelopment';
import { GameStartAnimation } from '@/components/game/GameStartAnimation';
import { GameTransitionAnimation } from '@/components/game/GameTransitionAnimation';
import { InviteFriendsModal } from '@/components/game/InviteFriendsModal';
import { MJPlayersTab } from './MJPlayersTab';
import { MJEventsTab } from './MJEventsTab';
import MJLobbyChatViewer from './MJLobbyChatViewer';
import { MJRivieresDashboard } from '@/components/rivieres/MJRivieresDashboard';
import { MJInfectionDashboard } from '@/components/infection/MJInfectionDashboard';
import { MJSheriffDashboard } from '@/components/sheriff/MJSheriffDashboard';
import { MJForetDashboard } from '@/components/foret/dashboard/MJForetDashboard';
import { MJLionDashboard } from '@/components/lion/MJLionDashboard';
import { MJActionsMenu } from './MJActionsMenu';
import { LandscapeModePrompt } from './LandscapeModePrompt';
import { ForetAutoModeToggle } from '@/components/foret/ForetAutoModeToggle';
import { ForetAutoCountdownOverlay } from '@/components/foret/ForetAutoCountdownOverlay';
import { useForetAutoController } from '@/hooks/useForetAutoController';
import { ForetRulesOverlay } from '@/components/foret/rules/ForetRulesOverlay';
import {
  ChevronLeft, Loader2, Users, 
  MessageSquare, Copy, Check, Edit2, X, Save, Coins,
  UserPlus, BookOpen
} from 'lucide-react';

import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { UserAvatarButton } from '@/components/ui/UserAvatarButton';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

// Implemented game types
const IMPLEMENTED_GAME_TYPES = ['FORET', 'RIVIERES', 'INFECTION', 'SHERIFF', 'LION'];


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
  const [isAllBots, setIsAllBots] = useState(false);
  const [totalAdventureSteps, setTotalAdventureSteps] = useState(3);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [foretRulesOpen, setForetRulesOpen] = useState(false);
  
  // Adventure cumulative scores - grouped by team (mates)
  const [adventureScores, setAdventureScores] = useState<{ 
    teamKey: string; 
    playerNames: string[]; 
    totalScore: number;
    playerIds: string[];
    hasCurrentGameScore: boolean; // Track if score includes in-progress game estimates
  }[]>([]);
  const [showAllScores, setShowAllScores] = useState(false);
  
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
  const isForetGame = game.selected_game_type_code === 'FORET';

  // Forêt Auto Mode Controller
  const { state: foretAutoState, toggleAutoMode: toggleForetAutoMode, resetFailCounters: resetForetFailCounters, isActionInFlight: foretAutoInFlight } = useForetAutoController(
    game.id,
    game.current_session_game_id
  );
  // Detect game start transition for FORET animation
  useEffect(() => {
    if (previousGameStatusRef.current === 'LOBBY' && game.status === 'IN_GAME' && 
        game.selected_game_type_code === 'FORET') {
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

  // Fetch adventure cumulative scores - grouped by team (mates)
  // For RIVIERES: Calculate simulated PVic based on validated_levels and jetons in real-time
  // For SHERIFF: Calculate based on visa costs and duel results
  useEffect(() => {
    if (!isAdventure || !game.adventure_id) return;
    
    const fetchAdventureScores = async () => {
      // Get adventure scores from adventure_scores table
      const { data: scores } = await supabase
        .from('adventure_scores')
        .select('game_player_id, total_score_value')
        .eq('session_id', game.id);
      
      // Get current game players with their live scores and mate_num
      const { data: players } = await supabase
        .from('game_players')
        .select('id, display_name, recompenses, pvic, player_number, mate_num, jetons')
        .eq('game_id', game.id)
        .eq('status', 'ACTIVE')
        .eq('is_host', false);
      
      // For RIVIERES: Get river_player_stats to calculate simulated PVic
      let riverStatsMap = new Map<string, { validated_levels: number }>();
      if (game.selected_game_type_code === 'RIVIERES' && game.current_session_game_id) {
        const { data: riverStats } = await supabase
          .from('river_player_stats')
          .select('player_id, validated_levels')
          .eq('session_game_id', game.current_session_game_id);
        
        if (riverStats) {
          riverStatsMap = new Map(riverStats.map(s => [s.player_id, { validated_levels: s.validated_levels }]));
        }
      }
      
      // For SHERIFF: Get cumulative delta from sheriff_player_choices
      // IMPORTANT: victory_points_delta already includes duel results (updated by sheriff-resolve-duel)
      // Do NOT add from sheriff_duels separately - that would cause double counting!
      let sheriffDeltaMap = new Map<number, number>(); // player_number -> cumulative delta percentage
      if (game.selected_game_type_code === 'SHERIFF' && game.current_session_game_id) {
        const { data: choices } = await supabase
          .from('sheriff_player_choices')
          .select('player_number, victory_points_delta')
          .eq('session_game_id', game.current_session_game_id);
        
        if (choices) {
          for (const choice of choices) {
            sheriffDeltaMap.set(choice.player_number, choice.victory_points_delta || 0);
          }
        }
      }
      
      if (players) {
        const scoresMap = new Map(scores?.map(s => [s.game_player_id, s.total_score_value]) || []);
        
        // Build player -> team map and aggregate scores by team
        const playerMap = new Map(players.map(p => [p.player_number, p]));
        const teamScores = new Map<string, { 
          playerNames: string[]; 
          totalScore: number;
          playerIds: string[];
          hasCurrentGameScore: boolean; // Track if score includes in-progress game estimates
        }>();
        
        // Helper function to calculate CURRENT GAME'S ESTIMATED score (not accumulated)
        // This is for live estimation during active games ONLY
        // For FORET: only count recompenses from current game (kills/rewards)
        // For RIVIERES: simulate based on current jetons and validated_levels
        // For SHERIFF: calculate based on pvic_initial + delta percentage
        // NOTE: adventure_scores already contains pvic from previous games, so we should NOT add pvic again
        const calculateCurrentGameScore = (player: any): number => {
          if (game.selected_game_type_code === 'RIVIERES') {
            // For RIVIERES: Simulate PVic based on validated_levels and jetons
            const riverStats = riverStatsMap.get(player.id);
            const validatedLevels = riverStats?.validated_levels || 0;
            const jetons = player.jetons || 0;
            
            // Same formula as in rivieres-resolve-level
            if (validatedLevels < 9) {
              return Math.round((validatedLevels * jetons) / 9);
            } else {
              return Math.round(jetons);
            }
          } else if (game.selected_game_type_code === 'SHERIFF') {
            // For SHERIFF: Calculate PVic Act = PVic Init + (PVic Init × delta%)
            // This MUST match MJPlayersTab exactly:
            // PVic Act = pvic + Math.round(pvic * (delta / 100))
            // where pvic is the value from game_players.pvic (the initial value at start of Sheriff)
            const deltaPercent = sheriffDeltaMap.get(player.player_number) || 0;
            const pvicInit = player.pvic || 0;
            const pvicAct = pvicInit + Math.round(pvicInit * (deltaPercent / 100));
            // Return PVic Act - this is the FINAL score for this player in Sheriff
            // The caller should NOT add adventure_scores for SHERIFF
            return pvicAct;
          } else {
            // For FORET and others: Use only recompenses (current game kills/rewards)
            // pvic is already included in adventure_scores, don't double-count it
            return (player.recompenses || 0);
          }
        };
        
        // Processed players (to avoid counting twice)
        const processedPlayers = new Set<number>();
        
        // For SHERIFF, calculateCurrentGameScore returns PVic Act directly (includes history)
        // For other games, we add adventureScore + currentGameScore
        const isSheriff = game.selected_game_type_code === 'SHERIFF';
        
        for (const player of players) {
          if (processedPlayers.has(player.player_number!)) continue;
          
          const adventureScore = scoresMap.get(player.id) || 0;
          const currentGameScore = calculateCurrentGameScore(player);
          // For SHERIFF: currentGameScore IS the PVic Act, don't add adventureScore
          // For other games: add adventureScore + currentGameScore
          let totalScore = isSheriff ? currentGameScore : (adventureScore + currentGameScore);
          const playerNames: string[] = [player.display_name];
          const playerIds: string[] = [player.id];
          
          processedPlayers.add(player.player_number!);
          
          // Check if player has a mate
          if (player.mate_num && playerMap.has(player.mate_num)) {
            const mate = playerMap.get(player.mate_num)!;
            if (!processedPlayers.has(mate.player_number!)) {
              const mateAdventureScore = scoresMap.get(mate.id) || 0;
              const mateCurrentScore = calculateCurrentGameScore(mate);
              // Same logic for mate
              totalScore += isSheriff ? mateCurrentScore : (mateAdventureScore + mateCurrentScore);
              playerNames.push(mate.display_name);
              playerIds.push(mate.id);
              processedPlayers.add(mate.player_number!);
            }
          }
          
          // Create team key (sorted player ids to ensure uniqueness)
          const teamKey = playerIds.sort().join('-');
          // Mark as having current game score if any player has non-zero current score
          const hasCurrentGameScore = currentGameScore > 0 || (player.mate_num && playerMap.has(player.mate_num) && calculateCurrentGameScore(playerMap.get(player.mate_num)!) > 0);
          teamScores.set(teamKey, { playerNames, totalScore, playerIds, hasCurrentGameScore: hasCurrentGameScore || false });
        }
        
        // Convert to array and sort by score
        const sortedTeams = Array.from(teamScores.entries())
          .map(([teamKey, data]) => ({
            teamKey,
            playerNames: data.playerNames,
            totalScore: data.totalScore,
            playerIds: data.playerIds,
            hasCurrentGameScore: data.hasCurrentGameScore
          }))
          .sort((a, b) => b.totalScore - a.totalScore);
        
        setAdventureScores(sortedTeams);
      }
    };
    
    fetchAdventureScores();
    
    // Subscribe to changes - base subscriptions for all game types
    const channel = supabase
      .channel(`adventure-scores-${game.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'adventure_scores', filter: `session_id=eq.${game.id}` },
        () => fetchAdventureScores()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` },
        () => fetchAdventureScores()
      )
      .subscribe();
    
    // Game-specific subscriptions
    let gameSpecificChannel: any = null;
    
    if (game.current_session_game_id) {
      if (game.selected_game_type_code === 'RIVIERES') {
        // RIVIERES: Subscribe to river_player_stats for validated_levels updates
        gameSpecificChannel = supabase
          .channel(`adventure-river-stats-${game.current_session_game_id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'river_player_stats', filter: `session_game_id=eq.${game.current_session_game_id}` },
            () => fetchAdventureScores()
          )
          .subscribe();
      } else if (game.selected_game_type_code === 'FORET') {
        // FORET: Subscribe to combat_results for kill updates (recompenses are updated in game_players)
        gameSpecificChannel = supabase
          .channel(`adventure-combat-${game.current_session_game_id}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'combat_results', filter: `session_game_id=eq.${game.current_session_game_id}` },
            () => fetchAdventureScores()
          )
          .subscribe();
      } else if (game.selected_game_type_code === 'INFECTION') {
        // INFECTION: Subscribe to infection_round_state for round resolution (AE pvic updates via corruption)
        gameSpecificChannel = supabase
          .channel(`adventure-infection-${game.current_session_game_id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'infection_round_state', filter: `session_game_id=eq.${game.current_session_game_id}` },
            () => fetchAdventureScores()
          )
          .subscribe();
      } else if (game.selected_game_type_code === 'SHERIFF') {
        // SHERIFF: Subscribe to sheriff_player_choices and sheriff_duels for delta updates
        gameSpecificChannel = supabase
          .channel(`adventure-sheriff-${game.current_session_game_id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'sheriff_player_choices', filter: `session_game_id=eq.${game.current_session_game_id}` },
            () => fetchAdventureScores()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'sheriff_duels', filter: `session_game_id=eq.${game.current_session_game_id}` },
            () => fetchAdventureScores()
          )
          .subscribe();
      }
    }
    
    return () => {
      supabase.removeChannel(channel);
      if (gameSpecificChannel) {
        supabase.removeChannel(gameSpecificChannel);
      }
    };
  }, [game.id, game.adventure_id, isAdventure, game.selected_game_type_code, game.current_session_game_id]);

  // Fetch player count and isAllBots for animation and bot automation
  // PERMANENT FIX: Multiple fetch attempts to handle race conditions
  useEffect(() => {
    const fetchPlayerInfo = async () => {
      const { data: players, count } = await supabase
        .from('game_players')
        .select('id, is_bot', { count: 'exact' })
        .eq('game_id', game.id)
        .eq('is_host', false)
        .eq('status', 'ACTIVE');
      
      console.log('[MJDashboard] Player count fetched:', count);
      setPlayerCount(count || 0);
      
      // Check if all players are bots
      const allBots = players && players.length > 0 && players.every(p => p.is_bot === true);
      setIsAllBots(allBots || false);
    };
    
    // Initial fetch
    fetchPlayerInfo();
    
    // PERMANENT FIX: Retry after delays to catch late-arriving bot insertions
    const retryTimer = setTimeout(fetchPlayerInfo, 1000);
    const safetyTimer = setTimeout(fetchPlayerInfo, 3000);
    
    return () => {
      clearTimeout(retryTimer);
      clearTimeout(safetyTimer);
    };
  }, [game.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`mj-dashboard-${game.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${game.id}` },
        (payload) => {
          // FIX: Update local game state immediately for lobby->game transition
          console.log('[MJDashboard] games UPDATE received:', payload.new);
          if (payload.new && typeof payload.new === 'object' && 'status' in payload.new) {
            setGame(prev => ({ ...prev, ...payload.new as Game }));
          } else {
            // Fallback: refetch if payload is incomplete
            console.log('[MJDashboard] Payload incomplete, refetching game...');
            fetchGame();
          }
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

  // Guard: Game type not defined - show error state
  if (!game.selected_game_type_code) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ForestButton variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </ForestButton>
          <h2 className="font-display text-xl">{game.name}</h2>
          <GameStatusBadge status={game.status} />
        </div>
        
        <div className="card-gradient rounded-lg border border-destructive/50 p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold text-destructive mb-2">Type de jeu non défini</h3>
          <p className="text-muted-foreground mb-4">
            Cette partie n'a pas de type de jeu défini (selected_game_type_code = null).
            Cela peut arriver si la création de la partie a échoué partiellement.
          </p>
          <div className="flex gap-4 justify-center">
            <ForestButton onClick={() => window.location.reload()}>
              Recharger
            </ForestButton>
            <ForestButton variant="outline" onClick={onBack}>
              Retour à la liste
            </ForestButton>
          </div>
        </div>
      </div>
    );
  }

  // Check if game type is implemented
  const isGameTypeImplemented = IMPLEMENTED_GAME_TYPES.includes(game.selected_game_type_code);

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
          {isForetGame && (
            <ForestButton variant="outline" size="sm" onClick={() => setForetRulesOpen(true)}>
              <BookOpen className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Règles</span>
            </ForestButton>
          )}
          <ThemeToggle />
          <UserAvatarButton size="sm" onLeaveGame={onBack} />
        </div>
      </div>

      <ForetRulesOverlay
        open={foretRulesOpen}
        onClose={() => setForetRulesOpen(false)}
        gameId={game.id}
        sessionGameId={game.current_session_game_id || undefined}
        userRole="MJ"
      />

      <InviteFriendsModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        gameId={game.id}
        gameName={game.name}
        joinCode={game.join_code}
      />

      {/* Adventure Progress Display with Cumulative Scores */}
      {isAdventure && (
        <div className="card-gradient rounded-lg border border-primary/30 p-4 space-y-4">
          <AdventureProgressDisplay
            mode={game.mode}
            currentStepIndex={game.current_step_index}
            currentGameTypeCode={game.selected_game_type_code}
            adventureId={game.adventure_id}
            showTitle={true}
          />
          
          {/* Adventure Token Transition Rules */}
          <div className="pt-3 border-t border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-muted-foreground">Règles de Transition (Jetons)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className={`p-2 rounded-lg border ${game.selected_game_type_code === 'RIVIERES' ? 'bg-primary/20 border-primary/50' : 'bg-secondary/30 border-border/30'}`}>
                <div className="font-medium text-blue-400">🌊 Rivières</div>
                <div className="text-muted-foreground">Début: <span className="font-mono font-bold text-foreground">100💎</span></div>
              </div>
              <div className={`p-2 rounded-lg border ${game.selected_game_type_code === 'FORET' ? 'bg-primary/20 border-primary/50' : 'bg-secondary/30 border-border/30'}`}>
                <div className="font-medium text-green-400">🌲 Forêt</div>
                <div className="text-muted-foreground">Début: <span className="font-mono font-bold text-foreground">50💎</span></div>
              </div>
              <div className={`p-2 rounded-lg border ${game.selected_game_type_code === 'SHERIFF' ? 'bg-primary/20 border-primary/50' : 'bg-secondary/30 border-border/30'}`}>
                <div className="font-medium text-amber-400">🤠 Shérif</div>
                <div className="text-muted-foreground">Début: <span className="font-mono font-bold text-foreground">0💎</span></div>
              </div>
              <div className={`p-2 rounded-lg border ${game.selected_game_type_code === 'INFECTION' ? 'bg-primary/20 border-primary/50' : 'bg-secondary/30 border-border/30'}`}>
                <div className="font-medium text-purple-400">🦠 Infection</div>
                <div className="text-muted-foreground">Hérite: <span className="font-mono font-bold text-foreground">du Shérif</span></div>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground/70">
              💡 Clan Royaux: +50% bonus sur les jetons de départ
            </div>
          </div>
          
          {/* Adventure Transition Guide - Detailed initialization info */}
          <div className="pt-3 border-t border-border/50">
            <AdventureTransitionGuide />
          </div>
          
          {/* Cumulative PVic Ranking - Team based with podium toggle */}
          {adventureScores.length > 0 && (
            <div className="pt-3 border-t border-border/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">🏆 Classement Équipes</span>
                  <span className="text-xs text-muted-foreground/70">(PVic cumulés)</span>
                </div>
                {adventureScores.length > 3 && (
                  <button
                    onClick={() => setShowAllScores(!showAllScores)}
                    className="text-xs text-primary hover:underline"
                  >
                    {showAllScores ? 'Voir moins' : `Voir tout (${adventureScores.length})`}
                  </button>
                )}
              </div>
              <div className="grid gap-2">
                {(showAllScores ? adventureScores : adventureScores.slice(0, 3)).map((team, index) => (
                  <div 
                    key={team.teamKey}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                      index === 0 
                        ? 'bg-yellow-500/20 border border-yellow-500/30' 
                        : index === 1 
                          ? 'bg-slate-400/20 border border-slate-400/30'
                          : index === 2
                            ? 'bg-amber-600/20 border border-amber-600/30'
                            : 'bg-secondary/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-bold w-8 text-center ${
                        index === 0 ? 'text-yellow-400' : 
                        index === 1 ? 'text-slate-300' : 
                        index === 2 ? 'text-amber-500' : 'text-muted-foreground'
                      }`}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </span>
                      <span className={`font-medium ${
                        index < 3 ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {team.playerNames.length > 1 
                          ? team.playerNames.join(' & ')
                          : team.playerNames[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold text-base ${
                        index === 0 ? 'text-yellow-400' : 
                        index === 1 ? 'text-slate-300' : 
                        index === 2 ? 'text-amber-500' : 'text-primary'
                      }`}>
                        {team.totalScore} pts
                      </span>
                      {team.hasCurrentGameScore && game.status !== 'ENDED' && (
                        <span className="text-xs text-muted-foreground/70 flex items-center gap-0.5" title="Score incluant une estimation du jeu en cours">
                          🔄 estimé
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Game info bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 md:gap-3 text-sm">
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
        {/* Auto Mode Toggle - only for FORET and IN_GAME */}
        {isForetGame && game.status === 'IN_GAME' && (
          <div className="p-2 md:p-3 bg-secondary/50 rounded-lg flex items-center justify-center">
            <ForetAutoModeToggle
              isAutoMode={foretAutoState.autoMode}
              currentStep={foretAutoState.currentStep}
              isLoading={foretAutoInFlight}
              onToggle={toggleForetAutoMode}
              runnerStatus={foretAutoState.runnerStatus}
              lastError={foretAutoState.lastError}
              failCounts={foretAutoState.failCounts}
              onResetFailCounters={resetForetFailCounters}
            />
          </div>
        )}
      </div>

      {/* Forêt Auto Mode Countdown Overlay */}
      {isForetGame && foretAutoState.autoMode && (
        <ForetAutoCountdownOverlay
          countdownEndsAt={foretAutoState.countdownEndsAt}
          countdownType={foretAutoState.countdownType}
          isHost={true}
        />
      )}

      {/* Action buttons - now using MJActionsMenu */}
      <MJActionsMenu
        gameId={game.id}
        gameName={game.name}
        gameStatus={game.status}
        gamePhase={game.phase}
        mancheActive={game.manche_active}
        gameTypeCode={game.selected_game_type_code}
        sessionGameId={game.current_session_game_id}
        startingTokens={game.starting_tokens}
        isAdventure={!!isAdventure}
        currentStepIndex={game.current_step_index}
        advancingStep={advancingStep}
        deleting={deleting}
        isAllBots={isAllBots}
        onNextSessionGame={handleNextSessionGame}
        onDeleteGame={handleDeleteGame}
        onGameUpdate={fetchGame}
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
          adventureId={game.adventure_id}
          currentStepIndex={game.current_step_index}
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

      {/* FORET Dashboard - using dedicated component */}
      {game.selected_game_type_code === 'FORET' && (
        <MJForetDashboard
          game={game}
          isAdventure={!!isAdventure}
          onNextGame={isAdventure ? handleNextSessionGame : undefined}
          onGameUpdate={fetchGame}
        />
      )}

      {/* LION Dashboard - In-game mode (only when game has actually started) */}
      {game.selected_game_type_code === 'LION' && game.current_session_game_id && game.status !== 'LOBBY' && (
        <MJLionDashboard
          game={{
            id: game.id,
            current_session_game_id: game.current_session_game_id,
            name: game.name,
          }}
          onPresentationMode={() => window.open(`/presentation/${game.id}`, '_blank')}
        />
      )}

      {/* LION Lobby - Show player management when game is in LOBBY status */}
      {game.selected_game_type_code === 'LION' && game.status === 'LOBBY' && (
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
    </div>
    </>
  );
}
