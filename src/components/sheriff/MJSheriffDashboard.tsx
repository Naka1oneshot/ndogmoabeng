import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Users, Shield, Target, Play, Lock, CheckCircle, 
  RefreshCw, Copy, Check, UserX, Loader2, Pencil, Save, X,
  Bot, Trash2, Swords, Eye, Dices, Presentation
} from 'lucide-react';
import { getSheriffThemeClasses, SHERIFF_COLORS } from './SheriffTheme';
import { toast } from 'sonner';
import { KickPlayerModal } from '@/components/game/KickPlayerModal';
import { useUserRole } from '@/hooks/useUserRole';
import { PlayerRowCompact } from '@/components/mj/PlayerRowCompact';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdventureProgressDisplay } from '@/components/game/AdventureProgressDisplay';
import { SheriffBotConfigPanel, SheriffBotConfig } from './SheriffBotConfigPanel';
import { SheriffBotHistoryPanel } from './SheriffBotHistoryPanel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { History } from 'lucide-react';

interface Game {
  id: string;
  name: string;
  join_code: string;
  status: string;
  manche_active: number | null;
  phase: string;
  starting_tokens: number;
  current_session_game_id: string | null;
  selected_game_type_code: string | null;
  mode?: string;
  adventure_id?: string | null;
  current_step_index?: number;
}

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  clan: string | null;
  mate_num: number | null;
  status: string | null;
  jetons: number | null;
  pvic: number | null;
  last_seen: string | null;
  joined_at: string;
  is_host: boolean;
  player_token: string | null;
  is_bot?: boolean;
  user_id?: string | null;
  clan_locked?: boolean;
  clan_token_used?: boolean;
}

interface PlayerChoice {
  id: string;
  player_number: number;
  visa_choice: string | null;
  visa_cost_applied: number;
  tokens_entering: number | null;
  has_illegal_tokens: boolean;
  victory_points_delta: number;
}

interface Duel {
  id: string;
  duel_order: number;
  player1_number: number;
  player2_number: number;
  player1_searches: boolean | null;
  player2_searches: boolean | null;
  status: string;
  player1_vp_delta: number;
  player2_vp_delta: number;
  resolution_summary: any;
}

interface RoundState {
  id: string;
  phase: string;
  current_duel_order: number | null;
  total_duels: number;
  common_pool_initial: number;
  common_pool_spent: number;
  bot_config?: SheriffBotConfig | null;
}

interface EditForm {
  display_name: string;
  player_number: number | null;
  clan: string | null;
  mate_num: number | null;
  jetons: number;
}

interface MJSheriffDashboardProps {
  game: Game;
  onBack: () => void;
}

export function MJSheriffDashboard({ game, onBack }: MJSheriffDashboardProps) {
  const navigate = useNavigate();
  const theme = getSheriffThemeClasses();
  const { isAdminOrSuper } = useUserRole();
  const isMobile = useIsMobile();
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [choices, setChoices] = useState<PlayerChoice[]>([]);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [roundState, setRoundState] = useState<RoundState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('control');
  
  // Player management state
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [kickModalOpen, setKickModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ 
    display_name: '', 
    player_number: null, 
    clan: null,
    mate_num: null,
    jetons: 0 
  });
  const [saving, setSaving] = useState(false);
  
  // Bot management state
  const [addingBots, setAddingBots] = useState(false);
  const [deletingBots, setDeletingBots] = useState(false);
  const [botCount, setBotCount] = useState(5);
  
  // Game settings state
  const [initialPool, setInitialPool] = useState(100);
  const [poolCostPerPlayer, setPoolCostPerPlayer] = useState(10);
  const [poolFloorPercent, setPoolFloorPercent] = useState(40);
  
  // Bot decisions state
  const [generatingBotChoices, setGeneratingBotChoices] = useState(false);
  const [generatingBotDuels, setGeneratingBotDuels] = useState(false);
  const [generatingAllBotDuels, setGeneratingAllBotDuels] = useState(false);

  const getPresenceBadge = (lastSeen: string | null) => {
    if (!lastSeen) return { color: 'bg-red-500', textColor: 'text-red-500', label: 'Déconnecté' };
    const diff = Date.now() - new Date(lastSeen).getTime();
    if (diff < 30000) return { color: 'bg-green-500', textColor: 'text-green-500', label: 'En ligne' };
    if (diff < 90000) return { color: 'bg-yellow-500', textColor: 'text-yellow-500', label: 'Hors ligne' };
    return { color: 'bg-red-500', textColor: 'text-red-500', label: 'Déconnecté' };
  };

  useEffect(() => {
    fetchData();
    
    const channel = supabase
      .channel(`sheriff-mj-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, 
        (payload) => {
          if (payload.new && payload.old) {
            const newPlayer = payload.new as any;
            const oldPlayer = payload.old as any;
            if (newPlayer.last_seen !== oldPlayer.last_seen && 
                newPlayer.jetons === oldPlayer.jetons && 
                newPlayer.status === oldPlayer.status) {
              return;
            }
          }
          fetchData();
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sheriff_player_choices', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sheriff_duels', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sheriff_round_state', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id]);

  const fetchData = async () => {
    // Fetch players
    const { data: playersData } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', game.id)
      .is('removed_at', null)
      .order('player_number', { ascending: true });

    if (playersData) {
      setPlayers(playersData as Player[]);
    }

    // Fetch game state if in game
    if (game.current_session_game_id) {
      // Fetch choices
      const { data: choicesData } = await supabase
        .from('sheriff_player_choices')
        .select('*')
        .eq('session_game_id', game.current_session_game_id);

      if (choicesData) {
        setChoices(choicesData as PlayerChoice[]);
      }

      // Fetch duels
      const { data: duelsData } = await supabase
        .from('sheriff_duels')
        .select('*')
        .eq('session_game_id', game.current_session_game_id)
        .order('duel_order', { ascending: true });

      if (duelsData) {
        setDuels(duelsData as Duel[]);
      }

      // Fetch round state
      const { data: stateData } = await supabase
        .from('sheriff_round_state')
        .select('*')
        .eq('session_game_id', game.current_session_game_id)
        .maybeSingle();

      if (stateData) {
        setRoundState(stateData as unknown as RoundState);
      }
    }

    setLoading(false);
  };

  const handleStartGame = async () => {
    if (!game.current_session_game_id) {
      toast.error('Aucune session de jeu active');
      return;
    }

    if (activePlayers.length < 2) {
      toast.error('Minimum 2 joueurs requis pour SHERIFF');
      return;
    }

    toast.info('Lancement de la partie Sheriff...');

    try {
      const { data, error } = await supabase.functions.invoke('start-sheriff', {
        body: {
          gameId: game.id,
          sessionGameId: game.current_session_game_id,
          initialPool: initialPool,
          poolCostPerPlayer: poolCostPerPlayer,
          poolFloorPercent: poolFloorPercent,
        },
      });

      if (error) {
        console.error('[MJ] start-sheriff error:', error);
        toast.error(`Erreur: ${error.message}`);
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Erreur inconnue');
        return;
      }

      toast.success(`Partie lancée avec ${data.playerCount} joueurs !`);
      fetchData();
    } catch (err) {
      console.error('[MJ] start-sheriff exception:', err);
      toast.error('Erreur lors du lancement');
    }
  };

  const handleLockChoices = async () => {
    if (!roundState || !game.current_session_game_id) return;
    
    toast.info('Verrouillage des choix et génération des duels...');

    try {
      const { data, error } = await supabase.functions.invoke('sheriff-lock-choices', {
        body: {
          gameId: game.id,
          sessionGameId: game.current_session_game_id,
        },
      });

      if (error) {
        console.error('[MJ] sheriff-lock-choices error:', error);
        toast.error(`Erreur: ${error.message}`);
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Erreur inconnue');
        return;
      }

      toast.success(`${data.duelsGenerated} duels générés !`);
      fetchData();
    } catch (err) {
      console.error('[MJ] sheriff-lock-choices exception:', err);
      toast.error('Erreur lors du verrouillage');
    }
  };

  const handleNextDuel = async () => {
    if (!roundState || !game.current_session_game_id) return;
    
    toast.info('Passage au duel suivant...');

    try {
      const { data, error } = await supabase.functions.invoke('sheriff-next-duel', {
        body: {
          gameId: game.id,
          sessionGameId: game.current_session_game_id,
        },
      });

      if (error) {
        console.error('[MJ] sheriff-next-duel error:', error);
        toast.error(`Erreur: ${error.message}`);
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Erreur inconnue');
        return;
      }

      if (data.gameComplete) {
        toast.success('Tous les duels terminés ! Partie terminée.');
      } else {
        toast.success(`Duel ${data.currentDuel} activé`);
      }
      fetchData();
    } catch (err) {
      console.error('[MJ] sheriff-next-duel exception:', err);
      toast.error('Erreur lors du passage');
    }
  };

  const handleResolveDuel = async () => {
    if (!roundState || !game.current_session_game_id) return;
    
    const currentDuel = duels.find(d => d.status === 'ACTIVE');
    if (!currentDuel) {
      toast.error('Aucun duel actif');
      return;
    }

    toast.info('Résolution du duel...');

    try {
      const { data, error } = await supabase.functions.invoke('sheriff-resolve-duel', {
        body: {
          gameId: game.id,
          sessionGameId: game.current_session_game_id,
          duelId: currentDuel.id,
        },
      });

      if (error) {
        console.error('[MJ] sheriff-resolve-duel error:', error);
        toast.error(`Erreur: ${error.message}`);
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Erreur inconnue');
        return;
      }

      toast.success('Duel résolu !');
      fetchData();
    } catch (err) {
      console.error('[MJ] sheriff-resolve-duel exception:', err);
      toast.error('Erreur lors de la résolution');
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

      if (data.newToken) {
        const { getPlayerReconnectUrl } = await import('@/lib/urlHelpers');
        const joinUrl = getPlayerReconnectUrl(game.id, data.newToken);
        try {
          await navigator.clipboard.writeText(joinUrl);
          setCopiedId(playerId);
          toast.success(`Token de ${playerName} réinitialisé et lien copié !`);
          setTimeout(() => setCopiedId(null), 2000);
        } catch {
          toast.success(`Token de ${playerName} réinitialisé`);
        }
      }
      
      fetchData();
    } catch (err) {
      console.error('[MJ] reset-player-token exception:', err);
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setResettingId(null);
    }
  };

  const handleCopyJoinLink = async (playerId: string, token: string) => {
    const { getPlayerReconnectUrl } = await import('@/lib/urlHelpers');
    const joinUrl = getPlayerReconnectUrl(game.id, token);
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

  const startEditing = (player: Player) => {
    setEditingId(player.id);
    setEditForm({
      display_name: player.display_name,
      player_number: player.player_number,
      clan: player.clan,
      mate_num: player.mate_num,
      jetons: player.jetons || 0,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ display_name: '', player_number: null, clan: null, mate_num: null, jetons: 0 });
  };

  const handleSave = async (playerId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('game_players')
        .update({
          display_name: editForm.display_name,
          player_number: editForm.player_number,
          clan: editForm.clan,
          mate_num: editForm.mate_num,
          jetons: editForm.jetons,
        })
        .eq('id', playerId);

      if (error) throw error;

      // Sync mate_num if set
      if (editForm.mate_num) {
        await supabase
          .from('game_players')
          .update({ mate_num: editForm.player_number })
          .eq('game_id', game.id)
          .eq('player_number', editForm.mate_num);
      }

      toast.success('Joueur mis à jour');
      cancelEditing();
      fetchData();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Bot management
  const handleAddBots = async () => {
    if (botCount < 1 || botCount > 20) {
      toast.error('Nombre de bots invalide (1-20)');
      return;
    }
    setAddingBots(true);
    try {
      const { data, error } = await supabase.functions.invoke('add-bots', {
        body: { gameId: game.id, count: botCount, withClans: true },
      });
      if (error || !data?.success) throw new Error(data?.error || 'Erreur');
      toast.success(`${data.botsAdded} bots ajoutés !`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'ajout des bots');
    } finally {
      setAddingBots(false);
    }
  };

  const handleDeleteAllBots = async () => {
    setDeletingBots(true);
    try {
      const { error } = await supabase
        .from('game_players')
        .delete()
        .eq('game_id', game.id)
        .eq('is_bot', true);
      
      if (error) throw error;
      toast.success('Tous les bots supprimés');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    } finally {
      setDeletingBots(false);
    }
  };

  // Bot decision handlers
  const handleBotChoices = async () => {
    if (!game.current_session_game_id) return;
    setGeneratingBotChoices(true);
    try {
      const { data, error } = await supabase.functions.invoke('sheriff-bot-decisions', {
        body: {
          gameId: game.id,
          sessionGameId: game.current_session_game_id,
          action: 'choices',
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erreur');
      toast.success(`${data.decisions_made} bots ont fait leurs choix !`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors des choix bots');
    } finally {
      setGeneratingBotChoices(false);
    }
  };

  const handleBotDuels = async () => {
    if (!game.current_session_game_id) return;
    setGeneratingBotDuels(true);
    try {
      const { data, error } = await supabase.functions.invoke('sheriff-bot-decisions', {
        body: {
          gameId: game.id,
          sessionGameId: game.current_session_game_id,
          action: 'duels',
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erreur');
      toast.success(`${data.decisions_made} décisions de duel !`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors des duels bots');
    } finally {
      setGeneratingBotDuels(false);
    }
  };

  const handleAllBotDuels = async () => {
    if (!game.current_session_game_id) return;
    setGeneratingAllBotDuels(true);
    try {
      const { data, error } = await supabase.functions.invoke('sheriff-bot-decisions', {
        body: {
          gameId: game.id,
          sessionGameId: game.current_session_game_id,
          action: 'duels_all',
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erreur');
      toast.success(`${data.decisions_made} décisions pré-remplies pour tous les duels bots !`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'automatisation des duels bots');
    } finally {
      setGeneratingAllBotDuels(false);
    }
  };

  const activePlayers = players.filter(p => p.status === 'ACTIVE' && !p.is_host && p.player_number !== null);
  const kickedPlayers = players.filter(p => p.status === 'REMOVED');
  const botPlayers = activePlayers.filter(p => p.is_bot);
  const humanPlayers = activePlayers.filter(p => !p.is_bot);

  const getPlayerName = (num: number) => {
    const p = activePlayers.find(pl => pl.player_number === num);
    return p?.display_name || `Joueur ${num}`;
  };

  const getPlayerChoice = (num: number) => {
    return choices.find(c => c.player_number === num);
  };

  const currentDuel = duels.find(d => d.status === 'ACTIVE');
  const resolvedDuels = duels.filter(d => d.status === 'RESOLVED');
  const pendingDuels = duels.filter(d => d.status === 'PENDING');

  const availablePlayerNumbers = Array.from({ length: 20 }, (_, i) => i + 1);
  const CLANS = ['Aseyra', 'Ezkar', 'Royaux', 'Zoulous', 'Keryndes', 'Akila', 'Akandé'];

  // Lobby view
  if (game.status === 'LOBBY') {
    return (
      <div className={theme.container}>
        <div className={`${theme.header}`}>
          <div className="flex items-center gap-4 p-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5 text-[#D4AF37]" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-[#D4AF37]">{game.name}</h1>
              <p className="text-sm text-[#9CA3AF]">Sheriff • Lobby • {activePlayers.length} joueurs</p>
            </div>
          </div>
          
          {/* Adventure Progress */}
          {game.mode === 'ADVENTURE' && (
            <div className="px-4 pb-3 border-t border-[#2D3748]/50">
              <div className="pt-3">
                <AdventureProgressDisplay
                  mode={game.mode}
                  currentStepIndex={game.current_step_index}
                  currentGameTypeCode={game.selected_game_type_code}
                  adventureId={game.adventure_id}
                  showTitle={true}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 space-y-6">
          {/* Start Game */}
          <div className={`${theme.card} p-6 text-center`}>
            <Shield className="h-12 w-12 mx-auto mb-4 text-[#D4AF37]" />
            <h2 className="text-xl font-bold mb-2">Le Shérif de Ndogmoabeng</h2>
            <p className="text-[#9CA3AF] mb-4">Contrôle d'entrée au Centre</p>
            
            {/* Initial Pool Configuration */}
            <div className="mb-4 p-3 rounded-lg bg-[#1A1F2C] border border-[#D4AF37]/30 space-y-4">
              <div>
                <label className="text-sm text-[#9CA3AF] block mb-2">💰 Cagnotte initiale (€)</label>
                <div className="flex items-center justify-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    step={10}
                    value={initialPool}
                    onChange={(e) => setInitialPool(Math.max(0, parseInt(e.target.value) || 0))}
                    className={`w-24 text-center ${theme.input}`}
                  />
                  <span className="text-[#D4AF37] font-bold">€</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#9CA3AF] block mb-1">Coût visa cagnotte (€/joueur)</label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={poolCostPerPlayer}
                    onChange={(e) => setPoolCostPerPlayer(Math.max(1, parseInt(e.target.value) || 10))}
                    className={`w-full text-center ${theme.input}`}
                  />
                </div>
                <div>
                  <label className="text-xs text-[#9CA3AF] block mb-1">Plancher cagnotte (%)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={poolFloorPercent}
                    onChange={(e) => setPoolFloorPercent(Math.max(0, Math.min(100, parseInt(e.target.value) || 40)))}
                    className={`w-full text-center ${theme.input}`}
                  />
                </div>
              </div>
              <p className="text-xs text-[#9CA3AF]/70">La cagnotte ne descendra pas en dessous de {Math.round(initialPool * poolFloorPercent / 100)}€</p>
            </div>
            
            <Button 
              onClick={handleStartGame} 
              disabled={activePlayers.length < 2}
              className={theme.button}
            >
              <Play className="h-4 w-4 mr-2" />
              Lancer la partie ({activePlayers.length}/2 min)
            </Button>
          </div>

          {/* Bot Management (Admin only) */}
          {isAdminOrSuper && (
            <div className={`${theme.card} p-4`}>
              <h3 className="text-sm font-medium text-[#D4AF37] mb-3">Gestion des Bots</h3>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={botCount}
                  onChange={(e) => setBotCount(parseInt(e.target.value) || 1)}
                  className={`w-20 ${theme.input}`}
                />
                <Button onClick={handleAddBots} disabled={addingBots} className={theme.button}>
                  {addingBots ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                  <span className="ml-2">Ajouter</span>
                </Button>
                {botPlayers.length > 0 && (
                  <Button onClick={handleDeleteAllBots} disabled={deletingBots} variant="destructive">
                    {deletingBots ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    <span className="ml-2">Supprimer ({botPlayers.length})</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Players List */}
          <div className={`${theme.card} p-4`}>
            <h3 className="text-sm font-medium text-[#D4AF37] mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Joueurs ({activePlayers.length})
            </h3>
            
            {isMobile ? (
              <div className="space-y-2">
                {activePlayers.map(player => (
                  <PlayerRowCompact
                    key={player.id}
                    player={{
                      ...player,
                      jetons: player.jetons || 0,
                      recompenses: player.pvic || 0,
                    }}
                    presenceBadge={getPresenceBadge(player.last_seen)}
                    onEdit={startEditing}
                    onCopyLink={player.player_token ? () => handleCopyJoinLink(player.id, player.player_token!) : undefined}
                    onResetToken={handleResetToken}
                    onKick={(p) => openKickModal(p.id, p.name)}
                    copiedId={copiedId}
                    resettingId={resettingId}
                    variant="forest"
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#D4AF37]/20 text-[#9CA3AF]">
                      <th className="text-left py-2">#</th>
                      <th className="text-left py-2">Nom</th>
                      <th className="text-left py-2">Clan</th>
                      <th className="text-left py-2">Mate</th>
                      <th className="text-right py-2">Jetons</th>
                      <th className="text-right py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePlayers.map(player => {
                      const isEditing = editingId === player.id;
                      
                      return (
                        <tr key={player.id} className="border-b border-[#D4AF37]/10">
                          {isEditing ? (
                            <>
                              <td className="py-2">
                                <Select
                                  value={editForm.player_number?.toString() || ''}
                                  onValueChange={(v) => setEditForm({ ...editForm, player_number: parseInt(v) })}
                                >
                                  <SelectTrigger className={`w-16 h-8 ${theme.input}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availablePlayerNumbers.map(n => (
                                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-2">
                                <Input
                                  value={editForm.display_name}
                                  onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                                  className={`h-8 ${theme.input}`}
                                />
                              </td>
                              <td className="py-2">
                                <Select
                                  value={editForm.clan || 'none'}
                                  onValueChange={(v) => setEditForm({ ...editForm, clan: v === 'none' ? null : v })}
                                >
                                  <SelectTrigger className={`w-24 h-8 ${theme.input}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">-</SelectItem>
                                    {CLANS.map(c => (
                                      <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-2">
                                <Select
                                  value={editForm.mate_num?.toString() || 'none'}
                                  onValueChange={(v) => setEditForm({ ...editForm, mate_num: v === 'none' ? null : parseInt(v) })}
                                >
                                  <SelectTrigger className={`w-16 h-8 ${theme.input}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">-</SelectItem>
                                    {availablePlayerNumbers.filter(n => n !== editForm.player_number).map(n => (
                                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-2 text-right">
                                <Input
                                  type="number"
                                  value={editForm.jetons}
                                  onChange={(e) => setEditForm({ ...editForm, jetons: parseInt(e.target.value) || 0 })}
                                  className={`w-20 h-8 text-right ${theme.input}`}
                                />
                              </td>
                              <td className="py-2 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => handleSave(player.id)} disabled={saving}>
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-green-500" />}
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={cancelEditing}>
                                    <X className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2 font-bold text-[#D4AF37]">{player.player_number}</td>
                              <td className="py-2">
                                <div className="flex items-center gap-2">
                                  {player.is_bot && <Bot className="h-3 w-3 text-primary" />}
                                  {player.display_name}
                                  <span className={`w-2 h-2 rounded-full ${getPresenceBadge(player.last_seen).color}`} />
                                </div>
                              </td>
                              <td className="py-2 text-[#9CA3AF]">{player.clan || '-'}</td>
                              <td className="py-2 text-[#9CA3AF]">{player.mate_num || '-'}</td>
                              <td className="py-2 text-right text-[#D4AF37]">{player.jetons}💎</td>
                              <td className="py-2 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => startEditing(player)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  {player.player_token && (
                                    <Button size="icon" variant="ghost" onClick={() => handleCopyJoinLink(player.id, player.player_token!)}>
                                      {copiedId === player.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                  )}
                                  <Button size="icon" variant="ghost" onClick={() => handleResetToken(player.id, player.display_name)}>
                                    {resettingId === player.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => openKickModal(player.id, player.display_name)}>
                                    <UserX className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {selectedPlayer && (
          <KickPlayerModal
            open={kickModalOpen}
            onOpenChange={setKickModalOpen}
            gameId={game.id}
            playerId={selectedPlayer.id}
            playerName={selectedPlayer.name}
            onSuccess={fetchData}
          />
        )}
      </div>
    );
  }

  const handlePresentationMode = () => {
    window.open(`/presentation/${game.id}`, '_blank');
  };

  // In-game view
  return (
    <div className={theme.container}>
      <div className={`${theme.header} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5 text-[#D4AF37]" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-[#D4AF37]">{game.name}</h1>
              <p className="text-sm text-[#9CA3AF]">
                Sheriff • {roundState?.phase || 'En cours'} 
                {roundState?.phase === 'DUELS' && ` • Duel ${roundState.current_duel_order}/${roundState.total_duels}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePresentationMode}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Presentation className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Présentation</span>
            </Button>
            {roundState && (
              <Badge className={theme.badge}>
                💰 {(roundState.common_pool_initial - roundState.common_pool_spent).toFixed(0)}€
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="w-full bg-[#2A2215] border-b border-[#D4AF37]/20 rounded-none h-12">
          <TabsTrigger value="control" className="flex-1"><Shield className="h-4 w-4" /></TabsTrigger>
          <TabsTrigger value="players" className="flex-1"><Users className="h-4 w-4" /></TabsTrigger>
          <TabsTrigger value="duels" className="flex-1"><Swords className="h-4 w-4" /></TabsTrigger>
          <TabsTrigger value="choices" className="flex-1"><Target className="h-4 w-4" /></TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="p-4 space-y-4">
          {/* Phase Control */}
          <div className={`${theme.card} p-4`}>
            <h3 className="text-lg font-bold text-[#D4AF37] mb-4">Contrôle du Jeu</h3>
            
            {/* Fallback if roundState is missing - repair button */}
            {!roundState && game.current_session_game_id && (
              <div className="space-y-4">
                <p className="text-amber-500 text-sm">
                  ⚠️ L'état de la partie Sheriff n'a pas été initialisé correctement. 
                  Essayez de relancer l'initialisation.
                </p>
                <Button 
                  onClick={handleStartGame}
                  className={theme.button}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Réinitialiser la partie Sheriff
                </Button>
              </div>
            )}
            
            {roundState?.phase === 'CHOICES' && (
              <div className="space-y-4">
                <p className="text-[#9CA3AF]">
                  Phase de choix: {choices.filter(c => c.visa_choice !== null).length}/{activePlayers.length} joueurs ont fait leurs choix
                </p>
                
                {/* Bot choices button */}
                {botPlayers.length > 0 && (
                  <Button 
                    onClick={handleBotChoices}
                    disabled={generatingBotChoices}
                    variant="outline"
                    className="w-full border-[#D4AF37]/50 hover:bg-[#D4AF37]/10"
                  >
                    {generatingBotChoices ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Dices className="h-4 w-4 mr-2" />
                    )}
                    🤖 Choix aléatoires des Bots ({botPlayers.length})
                  </Button>
                )}
                
                <Button 
                  onClick={handleLockChoices}
                  disabled={choices.filter(c => c.visa_choice !== null).length < activePlayers.length}
                  className={theme.button}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Verrouiller et Générer les Duels
                </Button>
              </div>
            )}

            {roundState?.phase === 'DUELS' && (
              <div className="space-y-4">
                {/* Button to automate ALL bot duels at once */}
                {botPlayers.length > 0 && (pendingDuels.length > 0 || currentDuel) && (
                  <Button 
                    onClick={handleAllBotDuels}
                    disabled={generatingAllBotDuels}
                    variant="outline"
                    className="w-full border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 bg-[#1A1F2C]"
                  >
                    {generatingAllBotDuels ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Dices className="h-4 w-4 mr-2" />
                    )}
                    🤖 Automatiser TOUS les duels Bots ({pendingDuels.length + (currentDuel ? 1 : 0)} restants)
                  </Button>
                )}

                {currentDuel ? (
                  <>
                    <div className={`${theme.card} p-4 border-[#D4AF37]`}>
                      <h4 className="text-sm font-medium text-[#9CA3AF] mb-2">Duel Actif #{currentDuel.duel_order}</h4>
                      <div className="flex items-center justify-center gap-4 text-lg">
                        <span className="text-[#D4AF37] font-bold">{getPlayerName(currentDuel.player1_number)}</span>
                        <Swords className="h-6 w-6 text-[#CD853F]" />
                        <span className="text-[#D4AF37] font-bold">{getPlayerName(currentDuel.player2_number)}</span>
                      </div>
                      <div className="flex justify-center gap-4 mt-4 text-sm">
                        <span className={currentDuel.player1_searches !== null ? 'text-green-500' : 'text-[#9CA3AF]'}>
                          {currentDuel.player1_searches !== null ? '✓ Décision prise' : '⏳ En attente'}
                        </span>
                        <span className={currentDuel.player2_searches !== null ? 'text-green-500' : 'text-[#9CA3AF]'}>
                          {currentDuel.player2_searches !== null ? '✓ Décision prise' : '⏳ En attente'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {/* Bot duel decisions button for current duel only */}
                      {botPlayers.length > 0 && (
                        (botPlayers.some(b => b.player_number === currentDuel.player1_number) && currentDuel.player1_searches === null) ||
                        (botPlayers.some(b => b.player_number === currentDuel.player2_number) && currentDuel.player2_searches === null)
                      ) && (
                        <Button 
                          onClick={handleBotDuels}
                          disabled={generatingBotDuels}
                          variant="outline"
                          className="w-full border-[#D4AF37]/30 hover:bg-[#D4AF37]/10"
                        >
                          {generatingBotDuels ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Dices className="h-4 w-4 mr-2" />
                          )}
                          🤖 Bots de ce duel uniquement
                        </Button>
                      )}
                      
                      <Button 
                        onClick={handleResolveDuel}
                        disabled={currentDuel.player1_searches === null || currentDuel.player2_searches === null}
                        className={theme.button}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Résoudre ce Duel
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    {pendingDuels.length > 0 ? (
                      <Button onClick={handleNextDuel} className={theme.button}>
                        <Play className="h-4 w-4 mr-2" />
                        Activer le Duel Suivant
                      </Button>
                    ) : (
                      <p className="text-green-500">✓ Tous les duels sont terminés !</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {roundState?.phase === 'COMPLETE' && (
              <div className="text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-green-500 text-lg font-bold">Partie Sheriff terminée !</p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className={`${theme.card} p-4`}>
            <h3 className="text-sm font-medium text-[#D4AF37] mb-3">Statistiques</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-[#D4AF37]">{resolvedDuels.length}</p>
                <p className="text-xs text-[#9CA3AF]">Duels résolus</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#CD853F]">{pendingDuels.length}</p>
                <p className="text-xs text-[#9CA3AF]">En attente</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{choices.filter(c => c.has_illegal_tokens).length}</p>
                <p className="text-xs text-[#9CA3AF]">Contrebandiers</p>
              </div>
            </div>
          </div>

          {/* Bot Config Panel */}
          {botPlayers.length > 0 && game.current_session_game_id && (
            <Collapsible>
              <div className={`${theme.card} p-4`}>
                <CollapsibleTrigger className="w-full flex items-center justify-between text-left">
                  <h3 className="text-sm font-medium text-[#D4AF37] flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    Configuration des Bots ({botPlayers.length})
                  </h3>
                  <Badge variant="outline" className="text-xs">Cliquez pour configurer</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <SheriffBotConfigPanel
                    sessionGameId={game.current_session_game_id}
                    gameId={game.id}
                    currentConfig={roundState?.bot_config}
                    currentPhase={roundState?.phase}
                    onConfigUpdate={fetchData}
                  />
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Bot History Panel */}
          {botPlayers.length > 0 && game.current_session_game_id && (
            <Collapsible>
              <div className={`${theme.card} p-4`}>
                <CollapsibleTrigger className="w-full flex items-center justify-between text-left">
                  <h3 className="text-sm font-medium text-[#D4AF37] flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Historique des Bots
                  </h3>
                  <Badge variant="outline" className="text-xs">Voir les logs</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <SheriffBotHistoryPanel
                    gameId={game.id}
                    sessionGameId={game.current_session_game_id}
                  />
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}
        </TabsContent>

        <TabsContent value="players" className="p-4">
          <div className={`${theme.card} p-4`}>
            <h3 className="text-sm font-medium text-[#D4AF37] mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Joueurs ({activePlayers.length})
            </h3>
            
            {isMobile ? (
              <div className="space-y-2">
                {activePlayers.map(player => (
                  <PlayerRowCompact
                    key={player.id}
                    player={{
                      ...player,
                      jetons: player.jetons || 0,
                      recompenses: player.pvic || 0,
                    }}
                    presenceBadge={getPresenceBadge(player.last_seen)}
                    onEdit={startEditing}
                    onCopyLink={player.player_token ? () => handleCopyJoinLink(player.id, player.player_token!) : undefined}
                    onResetToken={handleResetToken}
                    onKick={(p) => openKickModal(p.id, p.name)}
                    copiedId={copiedId}
                    resettingId={resettingId}
                    variant="forest"
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#D4AF37]/20 text-[#9CA3AF]">
                      <th className="text-left py-2">#</th>
                      <th className="text-left py-2">Nom</th>
                      <th className="text-left py-2">Clan</th>
                      <th className="text-left py-2">Mate</th>
                      <th className="text-right py-2">Jetons</th>
                      <th className="text-right py-2">PV Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePlayers.map(player => {
                      const choice = getPlayerChoice(player.player_number!);
                      return (
                        <tr key={player.id} className="border-b border-[#D4AF37]/10">
                          <td className="py-2 font-bold text-[#D4AF37]">{player.player_number}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              {player.is_bot && <Bot className="h-3 w-3 text-primary" />}
                              {player.display_name}
                            </div>
                          </td>
                          <td className="py-2 text-[#9CA3AF]">{player.clan || '-'}</td>
                          <td className="py-2 text-[#9CA3AF]">{player.mate_num || '-'}</td>
                          <td className="py-2 text-right text-[#D4AF37]">{player.jetons}💎</td>
                          <td className="py-2 text-right">
                            {choice && (
                              <span className={choice.victory_points_delta >= 0 ? 'text-green-500' : 'text-red-500'}>
                                {choice.victory_points_delta > 0 ? '+' : ''}{choice.victory_points_delta.toFixed(1)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="duels" className="p-4 space-y-4">
          {currentDuel && (
            <div className={`${theme.card} p-4 border-2 border-[#D4AF37]`}>
              <h3 className="text-sm font-medium text-[#D4AF37] mb-3">⚔️ Duel Actif</h3>
              <div className="flex items-center justify-center gap-4 text-lg">
                <div className="text-center">
                  <p className="font-bold">{getPlayerName(currentDuel.player1_number)}</p>
                  <Badge className={currentDuel.player1_searches !== null ? theme.badgeLegal : theme.badgeWarning}>
                    {currentDuel.player1_searches !== null ? (currentDuel.player1_searches ? 'Fouille' : 'Passe') : 'En attente'}
                  </Badge>
                </div>
                <Swords className="h-8 w-8 text-[#CD853F]" />
                <div className="text-center">
                  <p className="font-bold">{getPlayerName(currentDuel.player2_number)}</p>
                  <Badge className={currentDuel.player2_searches !== null ? theme.badgeLegal : theme.badgeWarning}>
                    {currentDuel.player2_searches !== null ? (currentDuel.player2_searches ? 'Fouille' : 'Passe') : 'En attente'}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {resolvedDuels.length > 0 && (
            <div className={`${theme.card} p-4`}>
              <h3 className="text-sm font-medium text-[#D4AF37] mb-3">Duels Résolus</h3>
              <div className="space-y-2">
                {resolvedDuels.map(duel => {
                  const choice1 = choices.find(c => c.player_number === duel.player1_number);
                  const choice2 = choices.find(c => c.player_number === duel.player2_number);
                  return (
                    <div key={duel.id} className="p-3 bg-[#1A1510] rounded space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          #{duel.duel_order}: {getPlayerName(duel.player1_number)} vs {getPlayerName(duel.player2_number)}
                        </span>
                        <div className="flex gap-2">
                          <Badge className={duel.player1_vp_delta >= 0 ? theme.badgeLegal : theme.badgeIllegal}>
                            {duel.player1_vp_delta > 0 ? '+' : ''}{duel.player1_vp_delta.toFixed(1)}%
                          </Badge>
                          <Badge className={duel.player2_vp_delta >= 0 ? theme.badgeLegal : theme.badgeIllegal}>
                            {duel.player2_vp_delta > 0 ? '+' : ''}{duel.player2_vp_delta.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getPlayerName(duel.player1_number)}:</span>
                          <Badge variant="outline" className={`text-xs ${choice1?.has_illegal_tokens ? 'border-red-500 text-red-400' : 'border-green-500 text-green-400'}`}>
                            {choice1?.tokens_entering ?? '?'}💎
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${duel.player1_searches ? 'border-orange-500 text-orange-400' : 'border-blue-500 text-blue-400'}`}>
                            {duel.player1_searches ? '🔍 Fouille' : '👋 Passe'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getPlayerName(duel.player2_number)}:</span>
                          <Badge variant="outline" className={`text-xs ${choice2?.has_illegal_tokens ? 'border-red-500 text-red-400' : 'border-green-500 text-green-400'}`}>
                            {choice2?.tokens_entering ?? '?'}💎
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${duel.player2_searches ? 'border-orange-500 text-orange-400' : 'border-blue-500 text-blue-400'}`}>
                            {duel.player2_searches ? '🔍 Fouille' : '👋 Passe'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {pendingDuels.length > 0 && (
            <div className={`${theme.card} p-4`}>
              <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Duels en Attente</h3>
              <div className="space-y-2">
                {pendingDuels.map(duel => (
                  <div key={duel.id} className="flex items-center justify-between p-2 bg-[#1A1510]/50 rounded opacity-60">
                    <span className="text-sm">
                      #{duel.duel_order}: {getPlayerName(duel.player1_number)} vs {getPlayerName(duel.player2_number)}
                    </span>
                    <Badge className={theme.badgeWarning}>En attente</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="choices" className="p-4">
          <div className={`${theme.card} p-4`}>
            <h3 className="text-sm font-medium text-[#D4AF37] mb-3">Choix des Joueurs</h3>
            <div className="space-y-2">
              {activePlayers.map(player => {
                const choice = getPlayerChoice(player.player_number!);
                return (
                  <div key={player.id} className="flex items-center justify-between p-3 bg-[#1A1510] rounded">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#D4AF37] w-6">{player.player_number}</span>
                      <span>{player.display_name}</span>
                    </div>
                    {choice ? (
                      <div className="flex gap-2">
                        <Badge className={theme.badge}>
                          {choice.visa_choice === 'VICTORY_POINTS' ? '⭐ PV' : '💰 Cagnotte'}
                        </Badge>
                        <Badge className={choice.has_illegal_tokens ? theme.badgeIllegal : theme.badgeLegal}>
                          {choice.tokens_entering}💎 {choice.has_illegal_tokens && '(illégal)'}
                        </Badge>
                      </div>
                    ) : (
                      <Badge className={theme.badgeWarning}>En attente</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {selectedPlayer && (
        <KickPlayerModal
          open={kickModalOpen}
          onOpenChange={setKickModalOpen}
          gameId={game.id}
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
