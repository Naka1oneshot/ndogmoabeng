import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, Dice6, Lock, Play, Users, History, 
  AlertTriangle, CheckCircle, XCircle, Anchor, Trophy, Flag, Ship, Waves,
  RefreshCw, Copy, Check, UserX, Calculator, Zap, Bot, Plus, Trash2, Presentation
} from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { 
  rivieresCardStyle, 
  getStatusDisplay, 
  getDecisionDisplay, 
  getKeryndesDisplay 
} from './RivieresTheme';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { KickPlayerModal } from '@/components/game/KickPlayerModal';
import { MJRivieresPlayersTab } from './MJRivieresPlayersTab';
import {
  calculateDangerRange,
  generateSuggestedDanger,
  getDangerCalculationExplanation,
  getDifficultyLabel,
} from '@/lib/rivieresDangerCalculator';

interface RiverSessionState {
  id: string;
  manche_active: number;
  niveau_active: number;
  cagnotte_manche: number;
  danger_dice_count: number | null;
  danger_raw: number | null;
  danger_effectif: number | null;
  status: string;
}

interface RiverPlayerStats {
  id: string;
  player_id: string;
  player_num: number;
  validated_levels: number;
  keryndes_available: boolean;
  current_round_status: string;
  descended_level: number | null;
}

interface RiverDecision {
  id: string;
  player_id: string;
  player_num: number;
  manche: number;
  niveau: number;
  decision: string;
  mise_demandee: number;
  keryndes_choice: string;
  status: string;
}

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  clan: string | null;
  jetons: number;
  is_host: boolean;
  player_token: string | null;
  user_id: string | null;
}

interface StageScore {
  game_player_id: string;
  score_value: number;
  details: {
    validated_levels: number;
    jetons_end: number;
    penalty_applied: boolean;
  };
}

interface MJRivieresDashboardProps {
  gameId: string;
  sessionGameId: string;
  isAdventure?: boolean;
  onNextGame?: () => void;
  gameStatus?: string;
}

export function MJRivieresDashboard({ gameId, sessionGameId, isAdventure = false, onNextGame, gameStatus = 'IN_GAME' }: MJRivieresDashboardProps) {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [state, setState] = useState<RiverSessionState | null>(null);
  const [playerStats, setPlayerStats] = useState<RiverPlayerStats[]>([]);
  const [decisions, setDecisions] = useState<RiverDecision[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Persist active tab across refreshes
  const [activeTab, setActiveTab] = useState<string>(() => {
    return sessionStorage.getItem(`rivieres-tab-${sessionGameId}`) || 'players';
  });

  // Save tab to sessionStorage when it changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    sessionStorage.setItem(`rivieres-tab-${sessionGameId}`, value);
  };

  // Danger form
  const [diceCount, setDiceCount] = useState(3);
  const [manualDanger, setManualDanger] = useState(0);

  // Missing players dialog
  const [missingPlayersDialog, setMissingPlayersDialog] = useState(false);
  const [missingPlayers, setMissingPlayers] = useState<{ player_id: string; display_name: string }[]>([]);
  const [missingActions, setMissingActions] = useState<{ [key: string]: 'DESCENDS' | 'RESTE_ZERO' }>({});

  // Logs
  const [logs, setLogs] = useState<{ id: string; action: string; details: string; manche: number }[]>([]);

  // Scores
  const [stageScores, setStageScores] = useState<StageScore[]>([]);
  const [showFinalRanking, setShowFinalRanking] = useState(false);
  const [endingGame, setEndingGame] = useState(false);

  // Start animation
  const [showStartAnimation, setShowStartAnimation] = useState(false);
  const previousGameStatusRef = useRef<string | undefined>(gameStatus);

  // Player management state
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [kickModalOpen, setKickModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);

  // Bot management state
  const [botCount, setBotCount] = useState(5);
  const [withClans, setWithClans] = useState(true);

  // Refresh decisions when manche/niveau changes
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    fetchData();
    const channel = setupRealtime();
    return () => { supabase.removeChannel(channel); };
  }, [sessionGameId]);

  // Refetch decisions when manche/niveau changes
  useEffect(() => {
    if (state) {
      fetchDecisions();
    }
  }, [state?.manche_active, state?.niveau_active]);

  const fetchDecisions = async () => {
    if (!state) return;
    const { data: decisionsData } = await supabase
      .from('river_decisions')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .eq('manche', state.manche_active)
      .eq('niveau', state.niveau_active);
    if (decisionsData) setDecisions(decisionsData);
  };

  // Detect game start transition for animation
  useEffect(() => {
    if (previousGameStatusRef.current === 'LOBBY' && gameStatus === 'IN_GAME') {
      setShowStartAnimation(true);
      const timer = setTimeout(() => setShowStartAnimation(false), 3000);
      return () => clearTimeout(timer);
    }
    previousGameStatusRef.current = gameStatus;
  }, [gameStatus]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch state
      const { data: stateData } = await supabase
        .from('river_session_state')
        .select('*')
        .eq('session_game_id', sessionGameId)
        .single();

      if (stateData) setState(stateData);

      // Fetch player stats
      const { data: statsData } = await supabase
        .from('river_player_stats')
        .select('*')
        .eq('session_game_id', sessionGameId)
        .order('player_num');

      if (statsData) setPlayerStats(statsData);

      // Fetch players (excluding host)
      const { data: playersData } = await supabase
        .from('game_players')
        .select('id, display_name, player_number, clan, jetons, is_host, player_token, user_id')
        .eq('game_id', gameId)
        .eq('status', 'ACTIVE')
        .order('player_number');

      if (playersData) setPlayers(playersData.filter(p => !p.is_host && p.player_number !== null));

      // Fetch current level decisions
      if (stateData) {
        const { data: decisionsData } = await supabase
          .from('river_decisions')
          .select('*')
          .eq('session_game_id', sessionGameId)
          .eq('manche', stateData.manche_active)
          .eq('niveau', stateData.niveau_active);

        if (decisionsData) setDecisions(decisionsData);
      }

      // Fetch logs
      const { data: logsData } = await supabase
        .from('logs_mj')
        .select('id, action, details, manche')
        .eq('session_game_id', sessionGameId)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (logsData) setLogs(logsData);

      // Fetch stage scores
      const { data: scoresData } = await supabase
        .from('stage_scores')
        .select('game_player_id, score_value, details')
        .eq('session_game_id', sessionGameId);

      if (scoresData) setStageScores(scoresData as StageScore[]);

    } catch (error) {
      console.error('Error fetching RIVIERES data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = () => {
    return supabase
      .channel(`mj-rivieres-${sessionGameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'river_session_state', filter: `session_game_id=eq.${sessionGameId}` }, 
        (payload) => { if (payload.new) setState(payload.new as RiverSessionState); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'river_player_stats', filter: `session_game_id=eq.${sessionGameId}` },
        (payload) => {
          // Update specific player stats instead of refetching all
          if (payload.new) {
            const newStats = payload.new as RiverPlayerStats;
            setPlayerStats(prev => {
              const idx = prev.findIndex(s => s.id === newStats.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = newStats;
                return updated;
              }
              return [...prev, newStats];
            });
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'river_decisions', filter: `session_game_id=eq.${sessionGameId}` },
        (payload) => {
          // Update specific decision instead of refetching all
          if (payload.new) {
            const newDecision = payload.new as RiverDecision;
            setDecisions(prev => {
              const idx = prev.findIndex(d => d.id === newDecision.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = newDecision;
                return updated;
              }
              // Only add if it's for current manche/niveau
              if (state && newDecision.manche === state.manche_active && newDecision.niveau === state.niveau_active) {
                return [...prev, newDecision];
              }
              return prev;
            });
          }
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
        (payload) => {
          // Handle new players (including bots)
          if (payload.new) {
            const newPlayer = payload.new as Player;
            if (!newPlayer.is_host && newPlayer.player_number !== null) {
              setPlayers(prev => {
                // Check if already exists
                if (prev.some(p => p.id === newPlayer.id)) return prev;
                return [...prev, newPlayer].sort((a, b) => (a.player_number || 0) - (b.player_number || 0));
              });
            }
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
        (payload) => {
          // Only update if it's not just a last_seen update
          if (payload.new && payload.old) {
            const newPlayer = payload.new as any;
            const oldPlayer = payload.old as any;
            // Skip if only last_seen changed
            if (newPlayer.last_seen !== oldPlayer.last_seen && 
                newPlayer.jetons === oldPlayer.jetons && 
                newPlayer.status === oldPlayer.status) {
              return;
            }
          }
          // Update player in list
          if (payload.new) {
            const newPlayer = payload.new as Player;
            setPlayers(prev => {
              const idx = prev.findIndex(p => p.id === newPlayer.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = newPlayer;
                return updated.filter(p => !p.is_host && p.player_number !== null);
              }
              return prev;
            });
          }
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
        (payload) => {
          if (payload.old) {
            const deletedPlayer = payload.old as Player;
            setPlayers(prev => prev.filter(p => p.id !== deletedPlayer.id));
          }
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs_mj', filter: `session_game_id=eq.${sessionGameId}` },
        (payload) => {
          // Append new log instead of refetching
          if (payload.new) {
            const newLog = payload.new as any;
            setLogs(prev => [{ id: newLog.id, action: newLog.action, details: newLog.details, manche: newLog.manche }, ...prev].slice(0, 50));
          }
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'river_level_history', filter: `session_game_id=eq.${sessionGameId}` },
        () => {
          // Level resolved - full refresh needed for scores etc.
          fetchData();
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        () => fetchData())
      .subscribe();
  };

  const handleRollDanger = async () => {
    setActionLoading('roll');
    try {
      const { data, error } = await supabase.functions.invoke('rivieres-set-danger', {
        body: { session_game_id: sessionGameId, mode: 'ROLL', dice_count: diceCount },
      });
      if (error) throw error;
      toast.success(`Danger lancé: ${data.danger_raw} (${diceCount} dés)`);
      // Force immediate refresh
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du lancer');
    } finally {
      setActionLoading(null);
    }
  };

  const handleManualDanger = async () => {
    setActionLoading('manual');
    try {
      const { data, error } = await supabase.functions.invoke('rivieres-set-danger', {
        body: { session_game_id: sessionGameId, mode: 'MANUAL', danger_value: manualDanger, dice_count: diceCount },
      });
      if (error) throw error;
      toast.success(`Danger défini: ${data.danger_raw}`);
      // Force immediate refresh
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la définition');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLockDecisions = async () => {
    setActionLoading('lock');
    try {
      const { data, error } = await supabase.functions.invoke('rivieres-lock-decisions', {
        body: { session_game_id: sessionGameId },
      });

      if (error) throw error;

      if (data.needs_mj_decision) {
        setMissingPlayers(data.missing_players);
        setMissingActions({});
        setMissingPlayersDialog(true);
      } else {
        toast.success('Décisions verrouillées');
        // Force immediate refresh after successful lock
        await fetchData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du verrouillage');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmMissingPlayers = async () => {
    setActionLoading('lock');
    try {
      const actions = Object.entries(missingActions).map(([player_id, action]) => ({
        player_id,
        action,
      }));

      const { data, error } = await supabase.functions.invoke('rivieres-lock-decisions', {
        body: { session_game_id: sessionGameId, missing_players_action: actions },
      });

      if (error) throw error;
      toast.success('Décisions verrouillées');
      setMissingPlayersDialog(false);
      // Force immediate refresh after successful lock
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveLevel = async () => {
    setActionLoading('resolve');
    try {
      const { data, error } = await supabase.functions.invoke('rivieres-resolve-level', {
        body: { session_game_id: sessionGameId },
      });

      if (error) throw error;

      if (data.outcome === 'SUCCESS') {
        toast.success('✅ Niveau réussi !');
      } else {
        toast.error('⛵ Le bateau chavire !');
      }
      // Force immediate refresh after resolution
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la résolution');
    } finally {
      setActionLoading(null);
    }
  };

  // Player management functions
  const handleResetToken = async (playerId: string, playerName: string) => {
    setResettingId(playerId);
    try {
      const { data, error } = await supabase.functions.invoke('reset-player-token', {
        body: { playerId },
      });

      if (error || !data?.success) {
        toast.error(data?.error || 'Erreur lors de la réinitialisation');
        return;
      }

      toast.success(`Token de ${playerName} réinitialisé`);
      fetchData();
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setResettingId(null);
    }
  };

  const handleCopyJoinLink = async (playerId: string, token: string) => {
    const { getPlayerReconnectUrl } = await import('@/lib/urlHelpers');
    const joinUrl = getPlayerReconnectUrl(gameId, token);
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedId(playerId);
      toast.success('Lien copié !');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  const openKickModal = (playerId: string, playerName: string) => {
    setSelectedPlayer({ id: playerId, name: playerName });
    setKickModalOpen(true);
  };

  // Bot management functions
  const handleAddBots = async () => {
    if (botCount < 1 || botCount > 50) {
      toast.error('Nombre de bots invalide (1-50)');
      return;
    }
    setActionLoading('addBots');
    try {
      const { data, error } = await supabase.functions.invoke('add-bots', {
        body: { gameId, count: botCount, withClans, withMates: false },
      });
      if (error) throw error;
      toast.success(`${data.botsAdded} bot(s) ajouté(s)`);
      fetchData();
    } catch (err: any) {
      console.error('Add bots error:', err);
      toast.error(err.message || 'Erreur lors de l\'ajout des bots');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAllBots = async () => {
    setActionLoading('deleteBots');
    try {
      const { error } = await supabase
        .from('game_players')
        .delete()
        .eq('game_id', gameId)
        .eq('is_bot', true);
      if (error) throw error;
      toast.success('Bots supprimés');
      fetchData();
    } catch (err: any) {
      console.error('Delete bots error:', err);
      toast.error('Erreur lors de la suppression');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBotDecisions = async () => {
    setActionLoading('botDecisions');
    try {
      const { data, error } = await supabase.functions.invoke('rivieres-bot-decisions', {
        body: { session_game_id: sessionGameId },
      });
      if (error) throw error;
      toast.success(`${data.decisions_made} décision(s) de bot générée(s)`);
      fetchData();
    } catch (err: any) {
      console.error('Bot decisions error:', err);
      toast.error(err.message || 'Erreur lors des décisions bots');
    } finally {
      setActionLoading(null);
    }
  };

  const botPlayers = players.filter(p => p.display_name.includes('🤖'));
  const humanPlayers = players.filter(p => !p.display_name.includes('🤖'));

  // End game handler - same actions as Forêt
  const handleEndGame = async () => {
    setEndingGame(true);
    try {
      // Find winner (player with highest score)
      const sortedPlayers = [...stageScores].sort((a, b) => b.score_value - a.score_value);
      const winnerPlayerId = sortedPlayers[0]?.game_player_id;
      const winnerPlayer = players.find(p => p.id === winnerPlayerId);
      const winnerUserId = winnerPlayer?.user_id || null;
      
      // Update game status
      const { error } = await supabase
        .from('games')
        .update({ 
          status: 'ENDED', 
          phase: 'FINISHED',
          phase_locked: true,
          winner_declared: true
        })
        .eq('id', gameId);
      
      if (error) throw error;
      
      // Update player profile statistics
      const { error: statsError } = await supabase.rpc('update_player_stats_on_game_end', {
        p_game_id: gameId,
        p_winner_user_id: winnerUserId
      });
      
      if (statsError) {
        console.error('Stats update error:', statsError);
        // Don't throw - stats update failure shouldn't block game end
      }
      
      // Log the game end
      await supabase.from('logs_mj').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: state?.manche_active || 3,
        action: 'PARTIE_TERMINEE',
        details: 'La partie Rivières a été terminée manuellement par le MJ.',
      });
      
      // Emit session event
      await supabase.from('session_events').insert({
        game_id: gameId,
        audience: 'ALL',
        type: 'GAME_END',
        message: '🏆 La partie Rivières est terminée !',
        payload: { type: 'GAME_ENDED', reason: 'MJ_DECISION', game_type: 'RIVIERES' },
      });
      
      toast.success('Partie terminée ! Statistiques des joueurs mises à jour.');
      fetchData();
    } catch (error: any) {
      console.error('End game error:', error);
      toast.error(error.message || 'Erreur lors de la fin de partie');
    } finally {
      setEndingGame(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  // Start animation overlay for MJ
  if (showStartAnimation) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1020]">
        {/* Animated background waves */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-[#1B4D3E]/30 to-transparent" />
          <div className="absolute bottom-10 left-1/4 animate-wave">
            <Waves className="h-16 w-16 text-[#D4AF37]/30" />
          </div>
          <div className="absolute bottom-20 right-1/4 animate-wave" style={{ animationDelay: '0.5s' }}>
            <Waves className="h-12 w-12 text-[#D4AF37]/20" />
          </div>
          <div className="absolute bottom-5 left-1/2 animate-wave" style={{ animationDelay: '1s' }}>
            <Waves className="h-20 w-20 text-[#D4AF37]/40" />
          </div>
        </div>

        {/* Main content */}
        <div className="relative text-center z-10 px-6">
          {/* Pulsing ship icon */}
          <div className="mb-8 animate-game-start-pulse">
            <div className="relative inline-block">
              <Ship className="h-24 w-24 text-[#D4AF37]" />
              <div className="absolute inset-0 animate-ping">
                <Ship className="h-24 w-24 text-[#D4AF37]/30" />
              </div>
            </div>
          </div>

          {/* Text animations */}
          <h1 className="text-4xl md:text-5xl font-bold text-[#D4AF37] mb-4 animate-slide-up-fade">
            Partie lancée !
          </h1>
          <p className="text-xl text-[#E8E8E8] animate-slide-up-fade" style={{ animationDelay: '0.3s' }}>
            {players.length} joueur{players.length > 1 ? 's' : ''} embarqué{players.length > 1 ? 's' : ''}
          </p>
          <p className="text-lg text-[#9CA3AF] mt-2 animate-slide-up-fade" style={{ animationDelay: '0.6s' }}>
            Que l'aventure commence...
          </p>
        </div>
      </div>
    );
  }

  // LOBBY VIEW - Use unified MJRivieresPlayersTab for player management
  if (gameStatus === 'LOBBY') {
    const handleStartGame = async () => {
      if (players.length < 1) {
        toast.error('Au moins 1 joueur requis');
        return;
      }
      
      setActionLoading('start');
      try {
        // First, call start-game to transition to IN_GAME
        const { error: startError } = await supabase.functions.invoke('start-game', {
          body: { gameId },
        });
        
        if (startError) throw startError;
        
        // Then initialize RIVIERES-specific state
        const { error: initError } = await supabase.functions.invoke('rivieres-init', {
          body: { session_game_id: sessionGameId },
        });
        
        if (initError) {
          console.error('RIVIERES init error:', initError);
          // Don't throw - game is already started, RIVIERES init might auto-retry
        }
        
        toast.success(`Partie RIVIERES lancée avec ${players.length} joueur${players.length > 1 ? 's' : ''} !`);
        fetchData();
      } catch (error: any) {
        console.error('Start game error:', error);
        toast.error(error.message || 'Erreur lors du démarrage');
      } finally {
        setActionLoading(null);
      }
    };

    return (
      <div className={`${rivieresCardStyle} p-6`}>
        <div className="flex items-center justify-center gap-3 mb-6">
          <Anchor className="h-8 w-8 text-[#D4AF37]" />
          <h2 className="text-2xl font-bold text-[#D4AF37]">Salle d'attente RIVIERES</h2>
        </div>
        
        <div className="text-center mb-6">
          <p className="text-[#9CA3AF] mb-2">
            En attente du lancement de la partie...
          </p>
          <p className="text-[#E8E8E8]">
            <span className="text-[#D4AF37] font-bold text-2xl">{players.length}</span> joueur{players.length > 1 ? 's' : ''} connecté{players.length > 1 ? 's' : ''}
            {botPlayers.length > 0 && (
              <span className="text-[#9CA3AF] text-sm ml-2">
                (dont {botPlayers.length} 🤖)
              </span>
            )}
          </p>
        </div>

        {/* Use the unified player management tab */}
        <MJRivieresPlayersTab 
          gameId={gameId} 
          isLobby={true} 
          onRefresh={fetchData} 
        />

        {/* Start button */}
        <ForestButton
          size="lg"
          onClick={handleStartGame}
          disabled={actionLoading === 'start' || players.length < 1}
          className="w-full mt-6 bg-[#4ADE80] hover:bg-[#4ADE80]/80 text-black text-lg py-6 font-bold"
        >
          {actionLoading === 'start' ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Démarrage en cours...
            </>
          ) : (
            <>
              <Ship className="h-5 w-5 mr-2" />
              Démarrer la partie RIVIERES
            </>
          )}
        </ForestButton>

        {players.length < 1 && (
          <p className="text-center text-amber-400 text-sm mt-3">
            ⚠️ Au moins 1 joueur doit être connecté pour démarrer
          </p>
        )}
      </div>
    );
  }

  if (!state) {
    return (
      <div className={`${rivieresCardStyle} p-6 text-center`}>
        <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
        <p className="text-[#E8E8E8]">Session RIVIERES non initialisée</p>
        <ForestButton 
          className="mt-4 bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black"
          onClick={async () => {
            setActionLoading('init');
            try {
              await supabase.functions.invoke('rivieres-init', {
                body: { session_game_id: sessionGameId },
              });
              toast.success('Session initialisée');
              fetchData();
            } catch (error: any) {
              toast.error(error.message || 'Erreur');
            } finally {
              setActionLoading(null);
            }
          }}
          disabled={actionLoading === 'init'}
        >
          {actionLoading === 'init' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Initialiser RIVIERES'}
        </ForestButton>
      </div>
    );
  }

  const enBateauPlayers = playerStats.filter(s => s.current_round_status === 'EN_BATEAU');
  const submittedDecisions = decisions.filter(d => d.status === 'DRAFT' || d.status === 'LOCKED');
  const lockedDecisions = decisions.filter(d => d.status === 'LOCKED');
  const totalMises = lockedDecisions.reduce((sum, d) => d.decision === 'RESTE' ? sum + d.mise_demandee : sum, 0);
  const allLocked = lockedDecisions.length > 0 && lockedDecisions.length >= enBateauPlayers.length;
  const dangerSet = state.danger_raw !== null;
  const canResolve = dangerSet && allLocked;

  // Check if game is finished (status ENDED with scores calculated)
  const isGameFinished = state.status === 'ENDED' && stageScores.length > 0;

  const getPlayerById = (id: string) => players.find(p => p.id === id);
  const getStatsByPlayerId = (id: string) => playerStats.find(s => s.player_id === id);
  const getScoreByPlayerId = (id: string) => stageScores.find(s => s.game_player_id === id);

  // Build ranking sorted by score
  const ranking = players
    .map(p => {
      const score = getScoreByPlayerId(p.id);
      const stats = getStatsByPlayerId(p.id);
      return {
        ...p,
        score_value: score?.score_value ?? 0,
        validated_levels: stats?.validated_levels ?? 0,
        penalty_applied: score?.details?.penalty_applied ?? false,
      };
    })
    .filter(p => p.player_number !== null)
    .sort((a, b) => b.score_value - a.score_value);

  return (
    <div className="space-y-4">
      {/* FINAL RANKING MODAL when game is finished */}
      {(isGameFinished || showFinalRanking) && (
        <div className={`${rivieresCardStyle} p-6 border-2 border-[#D4AF37]`}>
          <div className="flex items-center justify-center gap-3 mb-6">
            <Trophy className="h-8 w-8 text-[#D4AF37]" />
            <h2 className="text-2xl font-bold text-[#D4AF37]">
              {isAdventure ? 'Classement Intermédiaire' : 'Classement Final'}
            </h2>
            <Trophy className="h-8 w-8 text-[#D4AF37]" />
          </div>

          <table className="w-full text-sm mb-6">
            <thead className="bg-[#0B1020]">
              <tr>
                <th className="p-3 text-left text-[#D4AF37]">Rang</th>
                <th className="p-3 text-left text-[#9CA3AF]">Joueur</th>
                <th className="p-3 text-center text-[#9CA3AF]">Niveaux</th>
                <th className="p-3 text-center text-[#9CA3AF]">Jetons</th>
                <th className="p-3 text-right text-[#D4AF37]">Score</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((p, idx) => (
                <tr key={p.id} className={`border-t border-[#D4AF37]/10 ${idx === 0 ? 'bg-[#D4AF37]/10' : ''}`}>
                  <td className="p-3">
                    <span className={`text-xl font-bold ${idx === 0 ? 'text-[#D4AF37]' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-[#9CA3AF]'}`}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </span>
                  </td>
                  <td className="p-3 text-[#E8E8E8] font-medium">{p.display_name}</td>
                  <td className="p-3 text-center">
                    <span className={p.validated_levels >= 9 ? 'text-[#4ADE80]' : 'text-amber-400'}>
                      {p.validated_levels}/15
                    </span>
                    {p.penalty_applied && <span className="text-xs text-red-400 ml-1">⚠️</span>}
                  </td>
                  <td className="p-3 text-center text-[#4ADE80]">
                    {players.find(pl => pl.id === p.id)?.jetons ?? 0}💎
                  </td>
                  <td className="p-3 text-right">
                    <span className="text-xl font-bold text-[#D4AF37]">{p.score_value}</span>
                    <span className="text-[#9CA3AF] text-sm ml-1">pts</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-center gap-4">
            {!isGameFinished && (
              <ForestButton
                variant="outline"
                onClick={() => setShowFinalRanking(false)}
                className="border-[#9CA3AF] text-[#9CA3AF]"
              >
                Fermer
              </ForestButton>
            )}
            {isAdventure && onNextGame ? (
              <ForestButton
                onClick={onNextGame}
                className="bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black text-lg px-8"
              >
                <Flag className="h-5 w-5 mr-2" />
                Jeu suivant
              </ForestButton>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <ForestButton
                    disabled={endingGame}
                    className="bg-[#1B4D3E] hover:bg-[#1B4D3E]/80 text-white text-lg px-8"
                  >
                    {endingGame ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Trophy className="h-5 w-5 mr-2" />}
                    Fin de partie
                  </ForestButton>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Terminer la partie ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      La partie Rivières va être officiellement terminée.
                      Les statistiques des joueurs seront mises à jour.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleEndGame}>
                      Terminer la partie
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className={`${rivieresCardStyle} p-3 text-center`}>
          <div className="text-[#9CA3AF] text-xs">Manche</div>
          <div className="text-2xl font-bold text-[#D4AF37]">{state.manche_active}/3</div>
        </div>
        <div className={`${rivieresCardStyle} p-3 text-center`}>
          <div className="text-[#9CA3AF] text-xs">Niveau</div>
          <div className="text-2xl font-bold text-[#E8E8E8]">{state.niveau_active}/5</div>
        </div>
        <div className={`${rivieresCardStyle} p-3 text-center`}>
          <div className="text-[#9CA3AF] text-xs">Cagnotte</div>
          <div className="text-2xl font-bold text-[#4ADE80]">{state.cagnotte_manche}💎</div>
        </div>
        <div className={`${rivieresCardStyle} p-3 text-center`}>
          <div className="text-[#9CA3AF] text-xs">Danger</div>
          <div className={`text-2xl font-bold ${state.danger_effectif !== null ? 'text-[#FF6B6B]' : 'text-[#9CA3AF]'}`}>
            {state.danger_effectif ?? '—'}
          </div>
        </div>
        <div className={`${rivieresCardStyle} p-3 text-center`}>
          <div className="text-[#9CA3AF] text-xs">Statut</div>
          <Badge className={state.status === 'RUNNING' ? 'bg-green-600' : state.status === 'ENDED' ? 'bg-purple-600' : 'bg-gray-600'}>
            {state.status}
          </Badge>
        </div>
      </div>

      {/* Presentation mode button */}
      <div className="flex justify-center gap-3 flex-wrap">
        <ForestButton
          onClick={() => window.open(`/presentation/${gameId}`, '_blank')}
          className="bg-[#1B4D3E] hover:bg-[#1B4D3E]/80 text-white"
        >
          <Presentation className="h-4 w-4 mr-2" />
          Mode Présentation
        </ForestButton>

        {/* Show ranking button when game is finished but modal closed */}
        {isGameFinished && !showFinalRanking && (
          <ForestButton
            onClick={() => setShowFinalRanking(true)}
            className="bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black"
          >
            <Trophy className="h-4 w-4 mr-2" />
            Voir le classement final
          </ForestButton>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-[#20232A]">
          <TabsTrigger value="players" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <Users className="h-4 w-4 mr-1" /> Joueurs
          </TabsTrigger>
          <TabsTrigger value="actions" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <Play className="h-4 w-4 mr-1" /> Actions
          </TabsTrigger>
          <TabsTrigger value="decisions" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <Anchor className="h-4 w-4 mr-1" /> Décisions
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <History className="h-4 w-4 mr-1" /> Logs
          </TabsTrigger>
        </TabsList>

        {/* Actions Tab (merged with Calcul) */}
        <TabsContent value="actions" className="space-y-4 mt-4">
          <div className="flex justify-end mb-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                const { data: stateData } = await supabase
                  .from('river_session_state')
                  .select('*')
                  .eq('session_game_id', sessionGameId)
                  .single();
                if (stateData) setState(stateData);
                const { data: statsData } = await supabase
                  .from('river_player_stats')
                  .select('*')
                  .eq('session_game_id', sessionGameId)
                  .order('player_num');
                if (statsData) setPlayerStats(statsData);
                toast.success('Actions actualisées');
              }}
              className="text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {(() => {
            const dangerCalc = calculateDangerRange(enBateauPlayers.length, state.manche_active, state.niveau_active);
            const explanation = getDangerCalculationExplanation(dangerCalc);
            const difficulty = getDifficultyLabel(state.manche_active, state.niveau_active);
            
            return (
              <>
                {/* Danger Calculation Section */}
                <div className={`${rivieresCardStyle} p-4`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[#D4AF37] flex items-center gap-2">
                      <Calculator className="h-5 w-5" /> Calcul du Danger
                    </h3>
                    <Badge className={`${difficulty.color} bg-transparent border border-current`}>
                      {difficulty.label}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-[#9CA3AF] text-xs">Joueurs en bateau</div>
                      <div className="text-2xl font-bold text-[#E8E8E8]">{enBateauPlayers.length}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[#9CA3AF] text-xs">Manche</div>
                      <div className="text-2xl font-bold text-[#D4AF37]">{state.manche_active}/3</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[#9CA3AF] text-xs">Niveau</div>
                      <div className={`text-2xl font-bold ${dangerCalc.range.isLevel5 ? 'text-[#FF6B6B]' : 'text-[#E8E8E8]'}`}>
                        {state.niveau_active}/5
                        {dangerCalc.range.isLevel5 && <span className="text-sm ml-1">⚠️</span>}
                      </div>
                    </div>
                  </div>

                  {/* Danger Range Display */}
                  <div className={`p-4 rounded-lg border-2 ${dangerCalc.range.isLevel5 ? 'border-[#FF6B6B] bg-[#FF6B6B]/5' : 'border-[#D4AF37]/50 bg-[#D4AF37]/5'}`}>
                    <h4 className="text-[#9CA3AF] text-sm mb-2 text-center">Plage de danger recommandée</h4>
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-center">
                        <div className="text-xs text-[#9CA3AF]">Min</div>
                        <div className="text-3xl font-bold text-[#4ADE80]">{dangerCalc.range.min}</div>
                      </div>
                      <div className="text-4xl text-[#9CA3AF]">—</div>
                      <div className="text-center">
                        <div className="text-xs text-[#9CA3AF]">Max</div>
                        <div className="text-3xl font-bold text-[#FF6B6B]">{dangerCalc.range.max}</div>
                      </div>
                    </div>
                    <div className="text-center mt-3">
                      <span className="text-[#9CA3AF] text-sm">Suggestion: </span>
                      <span className="text-xl font-bold text-[#D4AF37]">{dangerCalc.range.suggested}</span>
                    </div>
                  </div>
                </div>

                {/* Danger Definition Section */}
                <div className={`${rivieresCardStyle} p-4`}>
                  <h3 className="font-bold text-[#D4AF37] mb-3 flex items-center gap-2">
                    <Dice6 className="h-5 w-5" /> Définir le Danger
                  </h3>
                  
                  {/* Auto-generate buttons */}
                  <div className="flex gap-3 flex-wrap mb-4">
                    <ForestButton
                      onClick={() => {
                        const suggestedDanger = generateSuggestedDanger(enBateauPlayers.length, state.manche_active, state.niveau_active);
                        setManualDanger(suggestedDanger);
                        toast.info(`Danger suggéré: ${suggestedDanger} (dans la plage ${dangerCalc.range.min}-${dangerCalc.range.max})`);
                      }}
                      className="bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Générer aléatoire
                    </ForestButton>
                    <ForestButton
                      onClick={() => {
                        setManualDanger(dangerCalc.range.suggested);
                        toast.info(`Danger défini: ${dangerCalc.range.suggested}`);
                      }}
                      variant="outline"
                      className="border-[#D4AF37] text-[#D4AF37]"
                    >
                      Suggestion ({dangerCalc.range.suggested})
                    </ForestButton>
                  </div>

                  {/* Manual input */}
                  <div className="flex flex-wrap gap-3 items-end">
                    <div>
                      <label className="text-xs text-[#9CA3AF]">Danger manuel</label>
                      <Input
                        type="number"
                        min={0}
                        value={manualDanger}
                        onChange={(e) => setManualDanger(Number(e.target.value))}
                        className="w-24 bg-[#0B1020] border-[#D4AF37]/30 text-white"
                      />
                    </div>
                    <ForestButton
                      onClick={handleManualDanger}
                      disabled={actionLoading === 'manual'}
                      variant="outline"
                      className="border-[#D4AF37] text-[#D4AF37]"
                    >
                      {actionLoading === 'manual' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Définir'}
                    </ForestButton>
                  </div>

                  {state.danger_raw !== null && (
                    <div className="mt-3 flex gap-4 text-sm">
                      <span className="text-[#9CA3AF]">Danger brut: <strong className="text-[#FF6B6B]">{state.danger_raw}</strong></span>
                      {state.danger_effectif !== state.danger_raw && (
                        <span className="text-[#9CA3AF]">Effectif: <strong className="text-[#FF6B6B]">{state.danger_effectif}</strong></span>
                      )}
                    </div>
                  )}
                </div>

                {/* Lock & Resolve Section */}
                <div className={`${rivieresCardStyle} p-4`}>
                  <h3 className="font-bold text-[#D4AF37] mb-3 flex items-center gap-2">
                    <Lock className="h-5 w-5" /> Actions MJ
                  </h3>
                  <div className="flex gap-3 flex-wrap">
                    {/* Bot Decisions Button - only if there are bots */}
                    {isAdmin && botPlayers.length > 0 && (
                      <ForestButton
                        onClick={handleBotDecisions}
                        disabled={actionLoading === 'botDecisions'}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {actionLoading === 'botDecisions' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4 mr-1" />}
                        Décisions Bots ({botPlayers.length})
                      </ForestButton>
                    )}
                    
                    <ForestButton
                      onClick={handleLockDecisions}
                      disabled={actionLoading === 'lock' || allLocked}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      {actionLoading === 'lock' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4 mr-1" />}
                      Clôturer décisions
                    </ForestButton>

                    <ForestButton
                      onClick={handleResolveLevel}
                      disabled={actionLoading === 'resolve' || !canResolve}
                      className={canResolve ? 'bg-[#4ADE80] hover:bg-[#4ADE80]/80 text-black font-bold shadow-lg shadow-[#4ADE80]/30' : 'bg-gray-600 text-gray-400'}
                    >
                      {actionLoading === 'resolve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                      Résoudre le niveau
                    </ForestButton>
                  </div>

                  {!canResolve && (
                    <div className="mt-3 text-sm text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {!dangerSet && 'Danger non défini. '}
                      {!allLocked && 'Décisions non verrouillées.'}
                    </div>
                  )}

                  {canResolve && (
                    <div className="mt-3 text-sm text-[#4ADE80] flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Total mises: {totalMises}💎 vs Danger: {state.danger_effectif}
                      {totalMises > (state.danger_effectif || 0) ? ' → SUCCÈS' : ' → ÉCHEC'}
                    </div>
                  )}
                </div>

                {/* Calculation explanation (collapsible) */}
                <details className={`${rivieresCardStyle} p-4`}>
                  <summary className="font-bold text-[#9CA3AF] cursor-pointer text-sm">
                    📊 Détail du calcul
                  </summary>
                  <div className="mt-3 bg-[#0B1020] rounded-lg p-3 font-mono text-xs text-[#9CA3AF] space-y-1">
                    {explanation.map((line, idx) => (
                      <div key={idx}>{line || '\u00A0'}</div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-[#9CA3AF]">
                    <p><strong>Légende:</strong></p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      <li>Manche 1: Multiplicateur ×0.7-1.1 (facile)</li>
                      <li>Manche 2: Multiplicateur ×0.9-1.4 (modéré)</li>
                      <li>Manche 3: Multiplicateur ×1.1-1.7 (difficile)</li>
                      <li>Niveau 5: Multiplicateur supplémentaire ×1.8</li>
                    </ul>
                  </div>
                </details>
              </>
            );
          })()}
        </TabsContent>

        {/* Players Tab */}
        <TabsContent value="players" className="mt-4">
          <MJRivieresPlayersTab
            gameId={gameId}
            sessionGameId={sessionGameId}
            gameStatus={gameStatus}
            onRefresh={fetchData}
          />
        </TabsContent>

        {/* Decisions Tab */}
        <TabsContent value="decisions" className="mt-4">
          <div className={`${rivieresCardStyle} p-4`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[#D4AF37]">
                Décisions Niveau {state.niveau_active} - Manche {state.manche_active}
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { fetchDecisions(); toast.success('Décisions actualisées'); }}
                className="text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {enBateauPlayers.map((stats) => {
                const player = getPlayerById(stats.player_id);
                const decision = decisions.find(d => d.player_id === stats.player_id);
                const decDisplay = decision ? getDecisionDisplay(decision.decision) : null;
                const kerDisplay = decision ? getKeryndesDisplay(decision.keryndes_choice) : null;

                return (
                  <div key={stats.id} className="flex items-center justify-between p-3 bg-[#0B1020] rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-[#D4AF37] font-bold">#{stats.player_num}</span>
                      <span className="text-[#E8E8E8]">{player?.display_name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {decision ? (
                        <>
                          <span className={decDisplay?.className}>{decDisplay?.label}</span>
                          {decision.decision === 'RESTE' && (
                            <span className="text-[#4ADE80] font-mono">{decision.mise_demandee}💎</span>
                          )}
                          {decision.keryndes_choice !== 'NONE' && (
                            <span className={kerDisplay?.className}>{kerDisplay?.label}</span>
                          )}
                          <Badge className={decision.status === 'LOCKED' ? 'bg-green-600' : 'bg-amber-600'}>
                            {decision.status === 'LOCKED' ? <Lock className="h-3 w-3" /> : '⏳'}
                          </Badge>
                        </>
                      ) : (
                        <span className="text-[#9CA3AF]">En attente...</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="mt-4">
          <div className={`${rivieresCardStyle} p-4 max-h-96 overflow-y-auto`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[#D4AF37]">Logs MJ</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const { data: logsData } = await supabase
                    .from('logs_mj')
                    .select('id, action, details, manche')
                    .eq('session_game_id', sessionGameId)
                    .order('timestamp', { ascending: false })
                    .limit(50);
                  if (logsData) setLogs(logsData);
                  toast.success('Logs actualisés');
                }}
                className="text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 text-sm">
              {logs.map((log) => (
                <div key={log.id} className="p-2 bg-[#0B1020] rounded flex gap-3">
                  <span className="text-[#9CA3AF]">M{log.manche}</span>
                  <span className="text-[#D4AF37] font-mono">{log.action}</span>
                  <span className="text-[#E8E8E8] flex-1">{log.details}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Missing Players Dialog */}
      <AlertDialog open={missingPlayersDialog} onOpenChange={setMissingPlayersDialog}>
        <AlertDialogContent className="bg-[#20232A] border-[#D4AF37]/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#D4AF37]">Joueurs sans décision</AlertDialogTitle>
            <AlertDialogDescription className="text-[#9CA3AF]">
              Ces joueurs n'ont pas soumis de décision. Choisissez leur action :
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-4">
            {missingPlayers.map((mp) => (
              <div key={mp.player_id} className="flex items-center justify-between p-3 bg-[#0B1020] rounded-lg">
                <span className="text-[#E8E8E8]">{mp.display_name}</span>
                <div className="flex gap-2">
                  <ForestButton
                    size="sm"
                    variant={missingActions[mp.player_id] === 'DESCENDS' ? 'primary' : 'outline'}
                    onClick={() => setMissingActions(prev => ({ ...prev, [mp.player_id]: 'DESCENDS' }))}
                    className={missingActions[mp.player_id] === 'DESCENDS' ? 'bg-amber-600' : 'border-amber-600 text-amber-400'}
                  >
                    Descend
                  </ForestButton>
                  <ForestButton
                    size="sm"
                    variant={missingActions[mp.player_id] === 'RESTE_ZERO' ? 'primary' : 'outline'}
                    onClick={() => setMissingActions(prev => ({ ...prev, [mp.player_id]: 'RESTE_ZERO' }))}
                    className={missingActions[mp.player_id] === 'RESTE_ZERO' ? 'bg-blue-600' : 'border-blue-600 text-blue-400'}
                  >
                    Reste (0💎)
                  </ForestButton>
                </div>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#9CA3AF] text-[#9CA3AF]">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmMissingPlayers}
              disabled={Object.keys(missingActions).length !== missingPlayers.length}
              className="bg-[#D4AF37] text-black hover:bg-[#D4AF37]/80"
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Kick Modal */}
      {selectedPlayer && (
        <KickPlayerModal
          open={kickModalOpen}
          onOpenChange={setKickModalOpen}
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          gameId={gameId}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
